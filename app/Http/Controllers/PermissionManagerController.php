<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;

class PermissionManagerController extends Controller
{
    public function index(): Response
    {
        $this->ensureTenantOwner();

        return Inertia::render('permissions/index', [
            'permissions' => Permission::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureTenantOwner();
        $data = $this->validatedData($request);

        Permission::create([
            'name' => $data['name'],
            'guard_name' => 'web',
        ]);

        return back()->with('status', 'Permission created.');
    }

    public function update(Request $request, Permission $permission): RedirectResponse
    {
        $this->ensureTenantOwner();
        $data = $this->validatedData($request, $permission);
        $permission->update(['name' => $data['name']]);

        return back()->with('status', 'Permission updated.');
    }

    public function destroy(Permission $permission): RedirectResponse
    {
        $this->ensureTenantOwner();
        $permission->delete();

        return back()->with('status', 'Permission deleted.');
    }

    /**
     * @return array{name: string}
     */
    private function validatedData(Request $request, ?Permission $permission = null): array
    {
        return $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('permissions', 'name')
                    ->where(fn ($query) => $query->where('guard_name', 'web'))
                    ->ignore($permission?->getKey()),
            ],
        ]);
    }

    private function ensureTenantOwner(): void
    {
        abort_unless(
            request()->user()?->is_super_admin || request()->user()?->hasRole('Tenant Owner'),
            403,
        );
    }
}
