<?php

namespace App\Http\Controllers;

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
use Inertia\Inertia;
use Inertia\Response;

class TaskManagementController extends Controller
{
    public function housekeeping(Request $request): Response
    {
        return Inertia::render('housekeeping/board', [
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
            'units' => Unit::query()->where('unit_type', 'room')->orderBy('number')->get(['id', 'branch_id', 'number', 'name', 'status']),
            'tasks' => Task::query()->with(['unit:id,number,name', 'employee:id,name'])
                ->where('task_type', 'housekeeping')->latest()->get(),
        ]);
    }

    public function tasks(Request $request): Response
    {
        return Inertia::render('tasks/index', [
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
            'units' => Unit::query()->orderBy('number')->get(['id', 'branch_id', 'number', 'name']),
            'employees' => Employee::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'tasks' => Task::query()->with(['unit:id,number', 'employee:id,name'])->latest()->get(),
        ]);
    }

    public function storeTask(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', 'exists:branches,id'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'unit_id' => ['nullable', 'exists:units,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'priority' => ['required', 'in:low,medium,high,urgent'],
            'due_at' => ['nullable', 'date'],
        ]);
        Task::create([...$data, 'tenant_id' => Tenant::current()->getKey(), 'created_by' => request()->user()->id, 'task_type' => 'general', 'status' => 'pending']);

        return back()->with('status', 'Task created.');
    }

    public function updateTask(Request $request, Task $task): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['nullable', 'in:pending,in_progress,done,skipped'],
            'stage' => ['nullable', 'in:to_clean,cleaning,inspection,clean'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'priority' => ['nullable', 'in:low,medium,high,urgent'],
        ]);
        if (($data['status'] ?? null) === 'done') {
            $data['completed_at'] = now();
        }
        $task->update($data);
        if ($task->unit_id && $task->task_type === 'housekeeping' && isset($data['stage'])) {
            $task->unit->update([
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
}
