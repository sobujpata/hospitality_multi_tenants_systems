<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class UserManagerController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureCanManageUsers();
        $tenantId = Tenant::current()->getKey();
        $manager = $request->user();
        $branchRestricted = $this->isBranchRestrictedManager($manager);

        return Inertia::render('users/index', [
            'users' => User::query()
                ->where('tenant_id', $tenantId)
                ->when($branchRestricted, fn ($query) => $query->where('branch_id', $manager->branch_id))
                ->whereKeyNot($manager->id)
                ->where('is_super_admin', false)
                ->whereDoesntHave('roles', fn ($query) => $query->where('name', 'Tenant Owner'))
                ->with(['roles:id,name', 'branch:id,name'])
                ->orderBy('name')
                ->get(['id', 'branch_id', 'name', 'email', 'phone', 'is_active']),
            'roles' => $this->tenantRoles($branchRestricted),
            'branches' => Branch::query()
                ->when($branchRestricted, fn ($query) => $query->whereKey($manager->branch_id))
                ->orderBy('name')
                ->get(['id', 'name']),
            'branchRestricted' => $branchRestricted,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureCanManageUsers();
        $data = $this->validatedData($request);

        $user = User::create([
            ...$data,
            'tenant_id' => Tenant::current()->getKey(),
            'password' => $data['password'],
            'email_verified_at' => now(),
        ]);

        $this->syncRole($user, $data['role_id'] ?? null);

        return back()->with('status', 'Staff member created.');
    }

    public function update(Request $request, string $tenant, User $user): RedirectResponse
    {
        $this->ensureCanManageUsers($user);
        $data = $this->validatedData($request, $user);

        $user->update([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'branch_id' => $data['branch_id'] ?? null,
            'is_active' => $data['is_active'],
            ...($data['password'] ? ['password' => $data['password']] : []),
        ]);

        $this->syncRole($user, $data['role_id'] ?? null);

        return back()->with('status', 'Staff member updated.');
    }

    public function destroy(string $tenant, User $user): RedirectResponse
    {
        $this->ensureCanManageUsers($user);
        $user->delete();

        return back()->with('status', 'Staff member deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedData(Request $request, ?User $user = null): array
    {
        $tenantId = Tenant::current()->getKey();
        $roleId = $request->input('role_id');
        $requestedRole = is_numeric($roleId)
            ? Role::query()->whereKey((int) $roleId)->where('team_id', $tenantId)->first()
            : null;
        $branchRequired = $requestedRole?->name !== 'Tenant Admin';
        $manager = $request->user();
        $branchRestricted = $this->isBranchRestrictedManager($manager);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')
                    ->where(fn ($query) => $query->where('tenant_id', $tenantId))
                    ->ignore($user?->getKey()),
            ],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => [$user ? 'nullable' : 'required', 'string', 'min:8'],
            'is_active' => ['boolean'],
            'role_id' => [
                'required',
                'integer',
                Rule::exists('roles', 'id')->where(
                    fn ($query) => $query
                        ->where('team_id', $tenantId)
                        ->where('guard_name', 'web')
                        ->whereNotIn('name', ['Tenant Owner', 'Customer']),
                ),
            ],
            'branch_id' => [
                Rule::requiredIf($branchRequired),
                'nullable',
                'integer',
                Rule::exists('branches', 'id')->where(fn ($query) => $query->where('tenant_id', $tenantId)),
            ],
        ]);

        abort_unless(
            ! $branchRestricted || (int) ($data['branch_id'] ?? 0) === (int) $manager->branch_id,
            403,
        );
        abort_unless(
            ! $branchRestricted || ! in_array($requestedRole?->name, ['Tenant Admin', 'Tenant Owner'], true),
            403,
        );

        $data['is_active'] = (bool) ($data['is_active'] ?? true);

        return $data;
    }

    /**
     * @return Collection<int, Role>
     */
    private function tenantRoles(bool $branchRestricted): Collection
    {
        app(PermissionRegistrar::class)->setPermissionsTeamId(Tenant::current()->getKey());

        return Role::query()
            ->where('team_id', Tenant::current()->getKey())
            ->whereNotIn('name', $branchRestricted
                ? ['Tenant Admin', 'Tenant Owner', 'Customer']
                : ['Tenant Owner', 'Customer'])
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    private function syncRole(User $user, ?int $roleId): void
    {
        app(PermissionRegistrar::class)->setPermissionsTeamId(Tenant::current()->getKey());

        $role = Role::query()
            ->whereKey($roleId)
            ->where('team_id', Tenant::current()->getKey())
            ->firstOrFail();

        $user->syncRoles([$role->name]);
    }

    private function ensureCanManageUsers(?User $target = null): void
    {
        $manager = request()->user();
        abort_unless(
            $manager?->is_super_admin
                || $manager?->hasAnyRole(['Tenant Owner', 'Tenant Admin', 'Branch Manager']),
            403,
        );

        if ($target === null) {
            return;
        }

        abort_unless(
            (int) $target->tenant_id === (int) Tenant::current()->getKey()
                && ! $target->is_super_admin
                && ! $target->hasRole('Tenant Owner')
                && (int) $target->id !== (int) $manager->id,
            404,
        );
        abort_unless(
            ! $this->isBranchRestrictedManager($manager)
                || (int) $target->branch_id === (int) $manager->branch_id,
            404,
        );
    }

    private function isBranchRestrictedManager(?User $user): bool
    {
        return $user !== null
            && ! $user->is_super_admin
            && ! $user->hasAnyRole(['Tenant Owner', 'Tenant Admin'])
            && $user->hasRole('Branch Manager');
    }
}
