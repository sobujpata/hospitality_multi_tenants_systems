<?php

namespace App\Http\Controllers;

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
    public function index(): Response
    {
        $this->ensureTenantOwner();

        return Inertia::render('users/index', [
            'users' => User::query()
                ->where('tenant_id', Tenant::current()->getKey())
                ->with('roles:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'phone', 'is_active']),
            'roles' => $this->tenantRoles(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureTenantOwner();
        $data = $this->validatedData($request);

        $user = User::create([
            ...$data,
            'tenant_id' => Tenant::current()->getKey(),
            'password' => $data['password'],
            'email_verified_at' => now(),
        ]);

        $this->syncRole($user, $data['role_id'] ?? null);

        return back()->with('status', 'User created.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $this->ensureTenantOwner();
        $this->ensureTenantUser($user);
        $data = $this->validatedData($request, $user);

        $user->update([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'is_active' => $data['is_active'],
            ...($data['password'] ? ['password' => $data['password']] : []),
        ]);

        $this->syncRole($user, $data['role_id'] ?? null);

        return back()->with('status', 'User updated.');
    }

    public function destroy(User $user): RedirectResponse
    {
        $this->ensureTenantOwner();
        $this->ensureTenantUser($user);
        $user->delete();

        return back()->with('status', 'User deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedData(Request $request, ?User $user = null): array
    {
        $tenantId = Tenant::current()->getKey();

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
                'nullable',
                'integer',
                Rule::exists('roles', 'id')->where(
                    fn ($query) => $query
                        ->where('team_id', $tenantId)
                        ->where('guard_name', 'web'),
                ),
            ],
        ]);

        $data['is_active'] = (bool) ($data['is_active'] ?? true);

        return $data;
    }

    /**
     * @return Collection<int, Role>
     */
    private function tenantRoles(): Collection
    {
        app(PermissionRegistrar::class)->setPermissionsTeamId(Tenant::current()->getKey());

        return Role::query()
            ->where('team_id', Tenant::current()->getKey())
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    private function syncRole(User $user, ?int $roleId): void
    {
        app(PermissionRegistrar::class)->setPermissionsTeamId(Tenant::current()->getKey());

        $role = $roleId
            ? Role::query()
                ->whereKey($roleId)
                ->where('team_id', Tenant::current()->getKey())
                ->firstOrFail()
            : null;

        $user->syncRoles($role ? [$role->name] : []);
    }

    private function ensureTenantOwner(): void
    {
        abort_unless(
            request()->user()?->is_super_admin || request()->user()?->hasRole('Tenant Owner'),
            403,
        );
    }

    private function ensureTenantUser(User $user): void
    {
        abort_unless((int) $user->tenant_id === (int) Tenant::current()->getKey(), 404);
    }
}
