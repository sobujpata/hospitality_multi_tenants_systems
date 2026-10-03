<?php

namespace Database\Seeders;

use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class PermissionSeeder extends Seeder
{
    /**
     * @var array<string, list<string>>
     */
    private array $rolePermissions = [
        'Tenant Admin' => [
            'bookings.create', 'bookings.view', 'bookings.delete', 'rooms.manage',
            'staff.manage', 'reports.view', 'billing.manage', 'settings.manage',
        ],
        'Tenant Owner' => [
            'bookings.create', 'bookings.view', 'bookings.delete', 'rooms.manage',
            'staff.manage', 'reports.view', 'billing.manage', 'settings.manage',
        ],
        'Branch Manager' => [
            'bookings.create', 'bookings.view', 'bookings.delete', 'rooms.manage',
            'staff.manage', 'reports.view', 'billing.manage',
        ],
        'Receptionist' => ['bookings.create', 'bookings.view', 'rooms.manage'],
        'Housekeeping' => ['rooms.manage'],
        'Accountant' => ['reports.view', 'billing.manage'],
        'Customer' => ['bookings.create', 'bookings.view'],
    ];

    public function run(): void
    {
        $permissions = collect(array_unique(array_merge(...array_values($this->rolePermissions))))
            ->mapWithKeys(fn (string $permission): array => [
                $permission => Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']),
            ]);

        Tenant::query()->each(function (Tenant $tenant) use ($permissions): void {
            $tenant->execute(function () use ($tenant, $permissions): void {
                app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());

                foreach ($this->rolePermissions as $roleName => $rolePermissions) {
                    $role = Role::firstOrCreate([
                        'name' => $roleName,
                        'guard_name' => 'web',
                        'team_id' => $tenant->getKey(),
                    ]);
                    $role->syncPermissions($permissions->only($rolePermissions)->values());
                }
            });
        });
    }
}
