<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleManagerController extends Controller
{
    public function index(): Response
    {
        $this->ensureTenantOwner();

        return Inertia::render('roles/index', [
            'roles' => Role::query()
                ->where('team_id', Tenant::current()->getKey())
                ->with('permissions:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'team_id']),
            'permissions' => Permission::query()
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureTenantOwner();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'permissions' => ['array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role = Role::create([
            'name' => $data['name'],
            'guard_name' => 'web',
            'team_id' => Tenant::current()->getKey(),
        ]);
        $role->syncPermissions($data['permissions'] ?? []);

        return back()->with('status', 'Role created.');
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        $this->ensureTenantOwner();
        $this->ensureTenantRole($role);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'permissions' => ['array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role->update(['name' => $data['name']]);
        $role->syncPermissions($data['permissions'] ?? []);

        return back()->with('status', 'Role updated.');
    }

    public function destroy(Role $role): RedirectResponse
    {
        $this->ensureTenantOwner();
        $this->ensureTenantRole($role);

        abort_if($role->name === 'Tenant Owner', 422, 'The Tenant Owner role cannot be deleted.');
        $role->delete();

        return back()->with('status', 'Role deleted.');
    }

    private function ensureTenantOwner(): void
    {
        abort_unless(
            Auth::user()?->is_super_admin || Auth::user()?->hasRole('Tenant Owner'),
            403,
        );
    }

    private function ensureTenantRole(Role $role): void
    {
        abort_unless((int) $role->team_id === (int) Tenant::current()->getKey(), 404);
    }
}
