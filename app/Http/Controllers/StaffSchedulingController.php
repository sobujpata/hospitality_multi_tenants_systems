<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Milon\Barcode\Facades\DNS2DFacade as DNS2D;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StaffSchedulingController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->ensureScheduleManager($request);
        $canManageAllBranches = $this->canManageAllBranches($user);
        $branchId = $canManageAllBranches ? null : $user->branch_id;
        $week = Carbon::parse($request->input('week', now()->startOfWeek()->toDateString()))->startOfWeek();
        $end = $week->copy()->addDays(7);

        return Inertia::render('staff/scheduling', [
            'week' => $week->toDateString(),
            'branches' => Branch::query()
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->whereKey($branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('name')
                ->get(['id', 'name']),
            'employees' => Employee::query()
                ->where('is_active', true)
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('name')
                ->get(['id', 'name', 'department', 'designation', 'branch_id']),
            'shifts' => EmployeeShift::query()->with(['employee:id,name', 'branch:id,name'])
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)
                    : $query->whereRaw('1 = 0'))
                ->whereBetween('shift_date', [$week, $end->copy()->subDay()])
                ->orderBy('shift_date')->orderBy('starts_at')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $this->ensureScheduleManager($request);
        $tenantId = Tenant::current()->getKey();
        $data = $request->validate([
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('tenant_id', $tenantId)],
            'employee_id' => ['required', 'integer', Rule::exists('users', 'id')->where('tenant_id', $tenantId)],
            'shift_date' => ['required', 'date'],
            'starts_at' => ['required', 'date_format:H:i'],
            'ends_at' => ['required', 'date_format:H:i', 'after:starts_at'],
            'break_minutes' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $this->assertBranchAccess($user, (int) $data['branch_id']);
        Employee::query()
            ->where('branch_id', $data['branch_id'])
            ->where('is_active', true)
            ->findOrFail($data['employee_id']);
        if (EmployeeShift::query()->where('employee_id', $data['employee_id'])->where('shift_date', $data['shift_date'])->where('starts_at', '<', $data['ends_at'])->where('ends_at', '>', $data['starts_at'])->exists()) {
            throw ValidationException::withMessages([
                'employee_id' => 'This employee already has an overlapping shift.',
            ]);
        }

        EmployeeShift::create([...$data, 'tenant_id' => Tenant::current()->getKey()]);

        return back()->with('status', 'Shift scheduled.');
    }

    public function update(Request $request, string $tenant, EmployeeShift $shift): RedirectResponse
    {
        $user = $this->ensureScheduleManager($request);
        $this->assertBranchAccess($user, (int) $shift->branch_id);
        $data = $request->validate([
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('tenant_id', Tenant::current()->getKey())],
            'shift_date' => ['required', 'date'],
            'starts_at' => ['required', 'date_format:H:i'],
            'ends_at' => ['required', 'date_format:H:i', 'after:starts_at'],
        ]);
        $this->assertBranchAccess($user, (int) $data['branch_id']);
        if (EmployeeShift::query()->where('employee_id', $shift->employee_id)->whereKeyNot($shift->id)->where('shift_date', $data['shift_date'])->where('starts_at', '<', $data['ends_at'])->where('ends_at', '>', $data['starts_at'])->exists()) {
            throw ValidationException::withMessages([
                'shift_date' => 'This employee already has an overlapping shift.',
            ]);
        }
        $shift->update($data);

        return back()->with('status', 'Shift updated.');
    }

    public function report(Request $request): StreamedResponse
    {
        $user = $this->ensureScheduleManager($request);
        $canManageAllBranches = $this->canManageAllBranches($user);
        $branchId = $canManageAllBranches ? null : $user->branch_id;
        $week = Carbon::parse($request->input('week', now()->startOfWeek()->toDateString()))->startOfWeek();
        $shifts = EmployeeShift::query()->with('employee:id,name')
            ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                ? $query->where('branch_id', $branchId)
                : $query->whereRaw('1 = 0'))
            ->whereBetween('shift_date', [$week, $week->copy()->addDays(6)])
            ->get();

        return response()->streamDownload(function () use ($shifts): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Employee', 'Date', 'Start', 'End', 'Hours', 'Overtime']);
            foreach ($shifts as $shift) {
                $hours = Carbon::parse($shift->starts_at)->diffInMinutes(Carbon::parse($shift->ends_at)) / 60 - ($shift->break_minutes / 60);
                fputcsv($handle, [$shift->employee->name, $shift->shift_date->toDateString(), $shift->starts_at, $shift->ends_at, round($hours, 2), $hours > 8 ? 'Yes' : 'No']);
            }
            fclose($handle);
        }, 'shift-report-'.$week->toDateString().'.csv');
    }

    public function attendance(Request $request): Response
    {
        $user = $this->ensureScheduleManager($request);
        $canManageAllBranches = $this->canManageAllBranches($user);
        $branchId = $canManageAllBranches ? null : $user->branch_id;
        $branch = $branchId !== null ? Branch::query()->find($branchId) : null;
        $dateTimezone = $branch ? $this->attendanceTimezone($branch) : (Tenant::current()?->timezone ?: config('app.timezone'));
        $date = Carbon::parse($request->input('date', Carbon::now($dateTimezone)->toDateString()))->toDateString();

        return Inertia::render('staff/attendance', [
            'date' => $date,
            'canManageAllBranches' => $canManageAllBranches,
            'issuedCredential' => $request->session()->pull('issuedAttendanceCredential'),
            'branches' => Branch::query()
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->whereKey($branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('name')
                ->get(['id', 'name', 'timezone']),
            'employees' => Employee::query()
                ->where('is_active', true)
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)
                    : $query->whereRaw('1 = 0'))
                ->with('branch:id,name,timezone')
                ->orderBy('name')
                ->get(['id', 'name', 'department', 'branch_id']),
            'records' => AttendanceRecord::query()
                ->where('attendance_date', $date)
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)
                    : $query->whereRaw('1 = 0'))
                ->get(['employee_id', 'branch_id', 'clocked_in_at', 'clocked_out_at', 'is_late'])
                ->map(fn (AttendanceRecord $record): array => [
                    'employee_id' => $record->employee_id,
                    'branch_id' => $record->branch_id,
                    'clocked_in_at' => $record->getRawOriginal('clocked_in_at'),
                    'clocked_out_at' => $record->getRawOriginal('clocked_out_at'),
                    'is_late' => $record->is_late,
                ]),
        ]);
    }

    public function clock(Request $request): RedirectResponse
    {
        $user = $this->ensureScheduleManager($request);
        $data = $request->validate([
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('tenant_id', Tenant::current()->getKey())],
            'employee_id' => ['required', 'integer', Rule::exists('users', 'id')->where('tenant_id', Tenant::current()->getKey())],
            'pin' => ['nullable', 'string'],
            'qr_token' => ['nullable', 'string'],
        ]);
        $this->assertBranchAccess($user, (int) $data['branch_id']);
        $branch = Branch::query()->findOrFail($data['branch_id']);
        $employee = Employee::query()
            ->where('branch_id', $data['branch_id'])
            ->where('is_active', true)
            ->findOrFail($data['employee_id']);
        $hasValidQr = filled($data['qr_token'] ?? null)
            && hash_equals((string) $employee->attendance_qr_token, (string) $data['qr_token']);
        $hasValidPin = filled($data['pin'] ?? null)
            && filled($employee->attendance_pin_hash)
            && Hash::check($data['pin'], $employee->attendance_pin_hash);
        if (! $hasValidQr && ! $hasValidPin) {
            throw ValidationException::withMessages([
                'pin' => 'Enter a valid attendance PIN or scan the employee QR token.',
            ]);
        }
        $now = Carbon::now($this->attendanceTimezone($branch));
        $record = AttendanceRecord::query()->firstOrCreate(['employee_id' => $employee->id, 'attendance_date' => $now->toDateString()], ['tenant_id' => Tenant::current()->getKey(), 'branch_id' => $data['branch_id'], 'method' => $data['qr_token'] ? 'qr' : 'pin']);
        $isLate = EmployeeShift::query()->where('employee_id', $employee->id)->where('shift_date', $now->toDateString())->where('starts_at', '<', $now->format('H:i:s'))->exists();
        $branchLocalTime = $now->format('Y-m-d H:i:s');
        $record->update($record->clocked_in_at ? ['clocked_out_at' => $branchLocalTime] : ['clocked_in_at' => $branchLocalTime, 'is_late' => $isLate]);

        return back()->with('status', $record->clocked_out_at ? 'Clocked out.' : 'Clocked in.');
    }

    public function employeeToken(Request $request, string $tenant, Employee $employee): RedirectResponse
    {
        $user = $this->ensureScheduleManager($request);
        $this->assertBranchAccess($user, (int) $employee->branch_id);
        $data = $request->validate(['pin' => ['nullable', 'digits_between:4,12']]);
        $qrToken = Str::random(48);
        $employee->update([
            'attendance_qr_token' => $qrToken,
            ...(filled($data['pin'] ?? null) ? ['attendance_pin_hash' => Hash::make($data['pin'])] : []),
        ]);
        $qrImage = DNS2D::getBarcodePNG($qrToken, 'QRCODE', 6, 6);
        if ($qrImage === false) {
            throw new \RuntimeException('Unable to generate the staff attendance QR code.');
        }
        $request->session()->flash('issuedAttendanceCredential', [
            'employee_id' => $employee->getKey(),
            'employee_name' => $employee->name,
            'qr_token' => $qrToken,
            'qr_image' => 'data:image/png;base64,'.$qrImage,
            'pin_was_set' => filled($data['pin'] ?? null),
        ]);

        return back()->with('status', 'Staff attendance credentials are ready. Save the QR code now.');
    }

    private function ensureScheduleManager(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && ($user->is_super_admin || $user->hasAnyRole(['Tenant Owner', 'Branch Manager'])), 403);

        return $user;
    }

    private function canManageAllBranches(User $user): bool
    {
        return $user->is_super_admin || $user->hasRole('Tenant Owner');
    }

    private function assertBranchAccess(User $user, int $branchId): void
    {
        abort_unless(
            $this->canManageAllBranches($user)
                || ($user->branch_id !== null && (int) $user->branch_id === $branchId),
            403,
        );
    }

    private function attendanceTimezone(Branch $branch): string
    {
        return $branch->timezone ?: config('app.timezone');
    }
}
