<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class SuperAdminTenantController extends Controller
{
    public function index(): Response
    {
        $tenants = Tenant::query()
            ->withCount('subscriptions')
            ->with('planRelation:id,name,monthly_price')
            ->orderBy('name')
            ->get()
            ->map(function (Tenant $tenant): array {
                $users = User::withoutGlobalScopes()
                    ->where('tenant_id', $tenant->id)
                    ->where('is_super_admin', false)
                    ->orderBy('name')
                    ->get(['id', 'tenant_id', 'branch_id', 'name', 'email', 'is_active']);

                $roleAssignments = DB::table('model_has_roles')
                    ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
                    ->where('model_has_roles.team_id', $tenant->id)
                    ->where('model_has_roles.model_type', User::class)
                    ->whereIn('model_has_roles.model_id', $users->pluck('id'))
                    ->get(['model_has_roles.model_id', 'roles.id', 'roles.name'])
                    ->keyBy('model_id');

                $branchNames = DB::table('branches')
                    ->where('tenant_id', $tenant->id)
                    ->pluck('name', 'id');

                return [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'domain' => $tenant->domain,
                    'database' => $tenant->database,
                    'plan_id' => $tenant->plan_id,
                    'plan' => $tenant->planRelation?->name ?? 'Unassigned',
                    'mrr' => (float) ($tenant->planRelation?->monthly_price ?? 0),
                    'trial_ends_at' => $tenant->trial_ends_at?->toDateString(),
                    'trial_active' => $tenant->onGenericTrial(),
                    'is_active' => $tenant->is_active,
                    'last_activity' => User::withoutGlobalScopes()
                        ->where('tenant_id', $tenant->id)
                        ->max('last_login_at'),
                    'subscriptions_count' => $tenant->subscriptions_count,
                    'users' => $users->map(fn (User $user): array => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'is_active' => $user->is_active,
                        'branch_id' => $user->branch_id,
                        'branch' => $branchNames[$user->branch_id] ?? null,
                        'role_id' => $roleAssignments[$user->id]->id ?? null,
                        'role' => $roleAssignments[$user->id]->name ?? 'Unassigned',
                    ])->values(),
                    'branches' => DB::table('branches')->where('tenant_id', $tenant->id)->orderBy('name')->get(['id', 'name']),
                    'roles' => DB::table('roles')->where('team_id', $tenant->id)->where('guard_name', 'web')->where('name', '!=', 'Customer')->orderBy('name')->get(['id', 'name']),
                ];
            });

        return Inertia::render('superadmin/tenants', [
            'tenants' => $tenants,
            'plans' => Plan::query()->where('is_active', true)->orderBy('monthly_price')->get(['id', 'name', 'monthly_price']),
        ]);
    }

    public function storeUser(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $this->validatedUserData($request, $tenant);
        $roleId = $data['role_id'];
        unset($data['role_id']);
        $data['tenant_id'] = $tenant->id;
        $data['password'] = Hash::make($data['password']);
        $data['email_verified_at'] = now();

        $user = User::withoutGlobalScopes()->create($data);
        $this->assignTenantRole($user, $tenant, $roleId);

        return back()->with('status', 'Tenant user created successfully.');
    }

    public function updateUser(Request $request, Tenant $tenant, string $user): RedirectResponse
    {
        $target = $this->tenantUser($tenant, $user);
        $data = $this->validatedUserData($request, $tenant, $target);
        $roleId = $data['role_id'];
        unset($data['role_id']);

        if (blank($data['password'])) {
            unset($data['password']);
        } else {
            $data['password'] = Hash::make($data['password']);
        }

        $target->update($data);
        $this->assignTenantRole($target, $tenant, $roleId);

        return back()->with('status', 'Tenant user updated successfully.');
    }

    public function destroyUser(Tenant $tenant, string $user): RedirectResponse
    {
        $this->tenantUser($tenant, $user)->delete();

        return back()->with('status', 'Tenant user removed successfully.');
    }

    private function tenantUser(Tenant $tenant, string $userId): User
    {
        return User::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->where('is_super_admin', false)
            ->findOrFail($userId);
    }

    /** @return array{name: string, email: string, password: string|null, branch_id: int|null, is_active: bool, role_id: int} */
    private function validatedUserData(Request $request, Tenant $tenant, ?User $user = null): array
    {
        $roleName = DB::table('roles')
            ->where('id', $request->input('role_id'))
            ->where('team_id', $tenant->id)
            ->value('name');
        $branchRequired = ! in_array($roleName, ['Tenant Admin', 'Tenant Owner'], true);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user?->id)],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:8'],
            'branch_id' => [Rule::requiredIf($branchRequired), 'nullable', 'integer', Rule::exists('branches', 'id')->where('tenant_id', $tenant->id)],
            'is_active' => ['required', 'boolean'],
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('team_id', $tenant->id)->where('guard_name', 'web')->where('name', '!=', 'Customer')],
        ]);

        abort_unless(
            $request->user('superadmin') !== null,
            403,
        );

        return $data;
    }

    private function assignTenantRole(User $user, Tenant $tenant, int $roleId): void
    {
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->id);
        $role = Role::query()
            ->whereKey($roleId)
            ->where('team_id', $tenant->id)
            ->where('guard_name', 'web')
            ->firstOrFail();
        $user->syncRoles([$role]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validatedTenantData($request);
        $data['database'] = $data['database'] ?: $data['slug'];
        $ownerData = $request->validate([
            'owner.name' => ['required', 'string', 'max:255'],
            'owner.email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'owner.password' => ['required', 'string', 'min:8'],
        ])['owner'];

        DB::transaction(function () use ($data, $ownerData): void {
            $tenant = Tenant::query()->create($data);
            $ownerRole = $this->provisionOwnerRole($tenant);
            $owner = User::withoutGlobalScopes()->create([
                'tenant_id' => $tenant->id,
                'name' => $ownerData['name'],
                'email' => $ownerData['email'],
                'password' => Hash::make($ownerData['password']),
                'is_active' => true,
                'email_verified_at' => now(),
            ]);

            app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->id);
            $owner->syncRoles([$ownerRole]);
        });

        return back()->with('status', 'Tenant and tenant owner created successfully.');
    }

    private function provisionOwnerRole(Tenant $tenant): Role
    {
        $sourceOwnerRole = Role::query()
            ->where('name', 'Tenant Owner')
            ->where('guard_name', 'web')
            ->where('team_id', '!=', $tenant->id)
            ->with('permissions')
            ->first();

        $role = Role::query()->create([
            'name' => 'Tenant Owner',
            'guard_name' => 'web',
            'team_id' => $tenant->id,
        ]);

        if ($sourceOwnerRole !== null) {
            $role->syncPermissions($sourceOwnerRole->permissions);
        } else {
            $role->syncPermissions(Permission::query()->where('guard_name', 'web')->get());
        }

        return $role;
    }

    public function update(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $this->validatedTenantData($request, $tenant);
        $data['database'] = $data['database'] ?: $data['slug'];

        $tenant->update($data);

        return back()->with('status', 'Tenant updated successfully.');
    }

    public function destroy(Tenant $tenant): RedirectResponse
    {
        $tenant->delete();

        return back()->with('status', 'Tenant deleted successfully.');
    }

    public function updateStatus(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);
        $tenant->update($data);

        return back()->with('status', $tenant->is_active
            ? 'Tenant account reactivated.'
            : 'Tenant account suspended.');
    }

    /**
     * @return array{name: string, slug: string, domain: string, database: string, plan_id: int|null, trial_ends_at: string|null, is_active: bool}
     */
    private function validatedTenantData(Request $request, ?Tenant $tenant = null): array
    {
        $request->merge([
            'database' => $request->input('database') ?: $request->input('slug'),
        ]);
        $tenantId = $tenant?->getKey();

        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('tenants', 'slug')->ignore($tenantId)],
            'domain' => ['required', 'string', 'max:255', Rule::unique('tenants', 'domain')->ignore($tenantId)],
            'database' => ['nullable', 'string', 'max:255', Rule::unique('tenants', 'database')->ignore($tenantId)],
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],
            'trial_ends_at' => ['nullable', 'date'],
            'is_active' => ['required', 'boolean'],
        ]);
    }
}
