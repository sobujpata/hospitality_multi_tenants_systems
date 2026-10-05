<?php

namespace App\Http\Controllers;

use App\Events\TaskAssigned;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\MaintenanceRequest;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Notifications\HospitalityNotification;
use App\Notifications\MaintenanceResolvedNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TaskManagementController extends Controller
{
    public function housekeeping(Request $request): Response
    {
        $user = $this->ensureTaskManager($request, true);
        $canManageAllBranches = $this->canManageAllTaskBranches($user);
        $branchId = $canManageAllBranches ? null : $user->branch_id;

        return Inertia::render('housekeeping/board', [
            'branches' => Branch::query()
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->whereKey($branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('name')
                ->get(['id', 'name']),
            'units' => Unit::withoutBranchScope()
                ->where('units.tenant_id', Tenant::current()->getKey())
                ->where('unit_type', 'room')
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('number')
                ->get(['id', 'branch_id', 'number', 'name', 'status']),
            'tasks' => Task::query()->with([
                'unit' => fn ($query) => $query
                    ->withoutGlobalScope('branch')
                    ->where('units.tenant_id', Tenant::current()->getKey())
                    ->select(['id', 'number', 'name']),
                'employee:id,name',
            ])
                ->where('task_type', 'housekeeping')
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)
                    : $query->whereRaw('1 = 0'))
                ->latest()
                ->get(),
        ]);
    }

    public function tasks(Request $request): Response
    {
        $user = $this->ensureTaskAccess($request);
        $canManageAllBranches = $this->canManageAllTaskBranches($user);
        $canManageTasks = $this->canManageTasks($user);
        $branchId = $canManageAllBranches ? null : $user->branch_id;

        return Inertia::render('tasks/index', [
            'canManageAllBranches' => $canManageAllBranches,
            'canManageTasks' => $canManageTasks,
            'currentUserId' => $user->id,
            'branches' => Branch::query()
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->whereKey($branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('name')
                ->get(['id', 'name']),
            'units' => $canManageTasks ? Unit::withoutBranchScope()
                ->where('units.tenant_id', Tenant::current()->getKey())
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('number')
                ->get(['id', 'branch_id', 'number', 'name']) : collect(),
            'employees' => $canManageTasks ? Employee::query()
                ->where('is_active', true)
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('name')
                ->get(['id', 'name', 'branch_id']) : collect(),
            'tasks' => Task::query()
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)->when(! $canManageTasks, fn ($query) => $query->where(fn ($query) => $query->whereNull('assigned_to')->orWhere('assigned_to', $user->id)))
                    : $query->whereRaw('1 = 0'))
                ->with([
                    'unit' => fn ($query) => $query
                        ->withoutGlobalScope('branch')
                        ->where('units.tenant_id', Tenant::current()->getKey())
                        ->select(['id', 'number']),
                    'employee:id,name',
                    'branch:id,name',
                ])
                ->latest()
                ->get(),
        ]);
    }

    public function storeTask(Request $request): RedirectResponse
    {
        $user = $this->ensureTaskManager($request);
        $tenantId = Tenant::current()->getKey();
        $data = $request->validate([
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('tenant_id', $tenantId)],
            'assigned_to' => ['nullable', 'integer', Rule::exists('users', 'id')->where('tenant_id', $tenantId)],
            'unit_id' => ['nullable', 'integer', Rule::exists('units', 'id')->where('tenant_id', $tenantId)],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'priority' => ['required', 'in:low,medium,high,urgent'],
            'due_at' => ['nullable', 'date'],
        ]);
        $this->assertTaskBranchAccess($user, (int) $data['branch_id']);
        if (! empty($data['unit_id'])) {
            abort_unless((int) Unit::withoutBranchScope()->where('tenant_id', $tenantId)->findOrFail($data['unit_id'])->branch_id === (int) $data['branch_id'], 422, 'The selected unit is not in the selected branch.');
        }
        if (! empty($data['assigned_to'])) {
            abort_unless((int) Employee::query()->where('is_active', true)->findOrFail($data['assigned_to'])->branch_id === (int) $data['branch_id'], 422, 'The selected staff member is not assigned to the selected branch.');
        }
        $task = Task::create([...$data, 'tenant_id' => $tenantId, 'created_by' => $user->id, 'task_type' => 'general', 'status' => 'pending']);
        if ($task->assigned_to !== null) {
            $this->notifyTaskAssignee($task);
        } else {
            $this->notifyBranchStaffOfUnassignedTask($task);
        }

        return back()->with('status', 'Task created.');
    }

    public function updateTask(Request $request, string $tenant, Task $task): RedirectResponse
    {
        $user = $this->ensureTaskAccess($request, true);
        $this->assertTaskBranchAccess($user, (int) $task->branch_id);
        $canManageTasks = $this->canManageTasks($user);
        $isAssignee = (int) $task->assigned_to === (int) $user->id;
        abort_unless($canManageTasks || ($isAssignee && $task->task_type !== 'housekeeping') || ($user->hasRole('Housekeeping') && $task->task_type === 'housekeeping'), 403);
        $data = $request->validate([
            'status' => ['nullable', 'in:pending,in_progress,done,skipped'],
            'assigned_to' => [$canManageTasks ? 'nullable' : 'prohibited', 'integer', Rule::exists('users', 'id')->where('tenant_id', Tenant::current()->getKey())],
            'priority' => [$canManageTasks ? 'nullable' : 'prohibited', 'in:low,medium,high,urgent'],
            'stage' => [$canManageTasks || $user->hasRole('Housekeeping') ? 'nullable' : 'prohibited', 'in:to_clean,cleaning,inspection,clean'],
        ]);
        if (array_key_exists('assigned_to', $data) && $data['assigned_to'] !== null) {
            abort_unless((int) Employee::query()->where('is_active', true)->findOrFail($data['assigned_to'])->branch_id === (int) $task->branch_id, 422, 'The selected staff member is not assigned to this task branch.');
        }
        if (($data['status'] ?? null) === 'done') {
            $data['completed_at'] = now();
        }
        $previousAssigneeId = $task->assigned_to;
        $task->update($data);
        if ($task->assigned_to !== null && (int) $task->assigned_to !== (int) $previousAssigneeId) {
            $this->notifyTaskAssignee($task);
        } elseif ($previousAssigneeId !== null && $task->assigned_to === null) {
            $this->notifyBranchStaffOfUnassignedTask($task);
        }
        if ($task->unit_id && $task->task_type === 'housekeeping' && isset($data['stage'])) {
            Unit::withoutBranchScope()
                ->where('tenant_id', Tenant::current()->getKey())
                ->findOrFail($task->unit_id)
                ->update([
                    'status' => $data['stage'] === 'clean' ? 'available' : 'maintenance',
                ]);
        }

        return back()->with('status', 'Task updated.');
    }

    public function maintenance(): Response
    {
        return Inertia::render('maintenance/index', [
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
            'units' => Unit::query()->orderBy('number')->get(['id', 'branch_id', 'number', 'name']),
            'requests' => MaintenanceRequest::query()->with(['unit:id,number', 'reporter:id,name', 'assignee:id,name'])->latest()->get(),
        ]);
    }

    public function storeMaintenance(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'unit_id' => ['nullable', 'exists:units,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:3000'],
            'priority' => ['required', 'in:low,medium,high,urgent'],
        ]);
        $assignee = Employee::query()->whereRaw('LOWER(department) = ?', ['maintenance'])->where('is_active', true)->first();
        MaintenanceRequest::create([...$data, 'tenant_id' => Tenant::current()->getKey(), 'reported_by' => request()->user()->id, 'assigned_to' => $assignee?->id]);
        if ($data['unit_id']) {
            Unit::whereKey($data['unit_id'])->update(['status' => 'maintenance']);
        }

        return back()->with('status', $assignee ? 'Maintenance request assigned.' : 'Maintenance request logged; assign a maintenance employee.');
    }

    public function updateMaintenance(Request $request, MaintenanceRequest $maintenanceRequest): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', 'in:open,in_progress,resolved'], 'assigned_to' => ['nullable', 'exists:users,id']]);
        if ($data['status'] === 'resolved') {
            $data['resolved_at'] = now();
        }
        $maintenanceRequest->update($data);
        if ($data['status'] === 'resolved') {
            $maintenanceRequest->unit?->update(['status' => 'available']);
            Employee::query()->where('department', 'Front Desk')->where('is_active', true)->get()->each(fn (Employee $employee) => $employee->notify(new MaintenanceResolvedNotification($maintenanceRequest)));
            User::withoutGlobalScopes()->where('tenant_id', Tenant::current()->getKey())->where('is_active', true)->get()->each(fn (User $user) => $user->notify(new HospitalityNotification('maintenance_completed', 'Maintenance task completed', $maintenanceRequest->title.' has been resolved.', ['maintenance_request_id' => $maintenanceRequest->id])));
        }

        return back()->with('status', 'Maintenance request updated.');
    }

    private function ensureTaskManager(Request $request, bool $allowHousekeeping = false): User
    {
        $user = $request->user();
        $allowedRoles = $allowHousekeeping
            ? ['Tenant Owner', 'Branch Manager', 'Housekeeping']
            : ['Tenant Owner', 'Branch Manager'];
        abort_unless($user instanceof User && ($user->is_super_admin || $user->hasAnyRole($allowedRoles)), 403);

        return $user;
    }

    private function ensureTaskAccess(Request $request, bool $allowHousekeeping = false): User
    {
        $user = $request->user();
        $isManager = $user instanceof User && ($user->is_super_admin || $user->hasAnyRole(['Tenant Owner', 'Branch Manager']));
        $isHousekeeping = $allowHousekeeping && $user instanceof User && $user->hasRole('Housekeeping');
        $isBranchStaff = $user instanceof User && $user->is_active && $user->branch_id !== null;
        abort_unless($user instanceof User && ($isManager || $isHousekeeping || $isBranchStaff), 403);

        return $user;
    }

    private function canManageTasks(User $user): bool
    {
        return $this->canManageAllTaskBranches($user) || $user->hasRole('Branch Manager');
    }

    private function canManageAllTaskBranches(User $user): bool
    {
        return $user->is_super_admin || $user->hasRole('Tenant Owner');
    }

    private function notifyTaskAssignee(Task $task): void
    {
        $assignee = User::query()
            ->where('tenant_id', $task->tenant_id)
            ->where('branch_id', $task->branch_id)
            ->where('is_active', true)
            ->find($task->assigned_to);

        if ($assignee === null) {
            return;
        }

        $this->sendTaskNotification(
            $assignee,
            $task,
            [
                'event' => 'task_assigned',
                'title' => 'New task assigned',
                'message' => "{$task->title} has been assigned to you.",
            ],
        );
    }

    private function notifyBranchStaffOfUnassignedTask(Task $task): void
    {
        $staffMembers = User::query()
            ->where('tenant_id', $task->tenant_id)
            ->where('branch_id', $task->branch_id)
            ->where('is_active', true)
            ->get();

        foreach ($staffMembers as $staff) {
            $this->sendTaskNotification(
                $staff,
                $task,
                [
                    'event' => 'task_available',
                    'title' => "Unassigned task: {$task->title}",
                    'message' => 'Available for any staff member in your branch.',
                ],
            );
        }
    }

    /**
     * @param  array{event: string, title: string, message: string}  $notification
     */
    private function sendTaskNotification(User $recipient, Task $task, array $notification): void
    {
        $notificationData = [
            ...$notification,
            'task_id' => $task->id,
            'url' => '/tasks',
        ];
        $databaseNotification = $recipient->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => HospitalityNotification::class,
            'data' => $notificationData,
        ]);

        TaskAssigned::dispatch(
            (int) $recipient->id,
            (string) $databaseNotification->id,
            $notificationData,
            $databaseNotification->created_at->toISOString(),
        );
    }

    private function assertTaskBranchAccess(User $user, int $branchId): void
    {
        abort_unless(
            $this->canManageAllTaskBranches($user)
                || ($user->branch_id !== null && (int) $user->branch_id === $branchId),
            403,
        );
    }
}
