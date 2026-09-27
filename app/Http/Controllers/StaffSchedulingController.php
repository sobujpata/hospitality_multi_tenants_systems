<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StaffSchedulingController extends Controller
{
    public function index(Request $request): Response
    {
        $week = Carbon::parse($request->input('week', now()->startOfWeek()->toDateString()))->startOfWeek();
        $end = $week->copy()->addDays(7);

        return Inertia::render('staff/scheduling', [
            'week' => $week->toDateString(),
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
            'employees' => Employee::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'department', 'designation']),
            'shifts' => EmployeeShift::query()->with(['employee:id,name', 'branch:id,name'])
                ->whereBetween('shift_date', [$week, $end->copy()->subDay()])
                ->orderBy('shift_date')->orderBy('starts_at')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'employee_id' => ['required', 'exists:users,id'],
            'shift_date' => ['required', 'date'],
            'starts_at' => ['required', 'date_format:H:i'],
            'ends_at' => ['required', 'date_format:H:i', 'after:starts_at'],
            'break_minutes' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
        $this->assertEmployee($data['employee_id']);
        abort_if(EmployeeShift::query()->where('employee_id', $data['employee_id'])->where('shift_date', $data['shift_date'])->where('starts_at', '<', $data['ends_at'])->where('ends_at', '>', $data['starts_at'])->exists(), 422, 'This employee already has an overlapping shift.');

        EmployeeShift::create([...$data, 'tenant_id' => Tenant::current()->getKey()]);

        return back()->with('status', 'Shift scheduled.');
    }

    public function update(Request $request, EmployeeShift $shift): RedirectResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'shift_date' => ['required', 'date'],
            'starts_at' => ['required', 'date_format:H:i'],
            'ends_at' => ['required', 'date_format:H:i', 'after:starts_at'],
        ]);
        abort_if(EmployeeShift::query()->where('employee_id', $shift->employee_id)->whereKeyNot($shift->id)->where('shift_date', $data['shift_date'])->where('starts_at', '<', $data['ends_at'])->where('ends_at', '>', $data['starts_at'])->exists(), 422, 'This employee already has an overlapping shift.');
        $shift->update($data);

        return back()->with('status', 'Shift updated.');
    }

    public function report(Request $request): StreamedResponse
    {
        $week = Carbon::parse($request->input('week', now()->startOfWeek()->toDateString()))->startOfWeek();
        $shifts = EmployeeShift::query()->with('employee:id,name')->whereBetween('shift_date', [$week, $week->copy()->addDays(6)])->get();

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
        $date = Carbon::parse($request->input('date', now()->toDateString()))->toDateString();

        return Inertia::render('staff/attendance', [
            'date' => $date,
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
            'employees' => Employee::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'department', 'attendance_qr_token']),
            'records' => AttendanceRecord::query()->with('employee:id,name')->where('attendance_date', $date)->get(),
        ]);
    }

    public function clock(Request $request): RedirectResponse
    {
        $data = $request->validate(['branch_id' => ['required', 'exists:branches,id'], 'employee_id' => ['required', 'exists:users,id'], 'pin' => ['nullable', 'string'], 'qr_token' => ['nullable', 'string']]);
        $this->assertEmployee($data['employee_id']);
        $employee = Employee::query()->findOrFail($data['employee_id']);
        abort_unless(($data['qr_token'] ?? null) === $employee->attendance_qr_token || ($data['pin'] ?? null) && Hash::check($data['pin'], $employee->attendance_pin_hash), 422, 'Invalid attendance QR code or PIN.');
        $now = now();
        $record = AttendanceRecord::query()->firstOrCreate(['employee_id' => $employee->id, 'attendance_date' => $now->toDateString()], ['tenant_id' => Tenant::current()->getKey(), 'branch_id' => $data['branch_id'], 'method' => $data['qr_token'] ? 'qr' : 'pin']);
        $isLate = EmployeeShift::query()->where('employee_id', $employee->id)->where('shift_date', $now->toDateString())->where('starts_at', '<', $now->format('H:i:s'))->exists();
        $record->update($record->clocked_in_at ? ['clocked_out_at' => $now] : ['clocked_in_at' => $now, 'is_late' => $isLate]);

        return back()->with('status', $record->clocked_out_at ? 'Clocked out.' : 'Clocked in.');
    }

    public function employeeToken(Request $request, Employee $employee): RedirectResponse
    {
        $this->assertEmployee($employee->id);
        $data = $request->validate(['pin' => ['nullable', 'string', 'min:4', 'max:12']]);
        $employee->update([
            'attendance_qr_token' => Str::random(48),
            ...($data['pin'] ? ['attendance_pin_hash' => Hash::make($data['pin'])] : []),
        ]);

        return back()->with('status', 'Attendance QR token regenerated.');
    }

    private function assertEmployee(int $id): void
    {
        abort_unless(Employee::query()->whereKey($id)->exists(), 404);
    }
}
