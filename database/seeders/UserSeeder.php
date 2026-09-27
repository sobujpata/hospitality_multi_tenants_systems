<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class UserSeeder extends Seeder
{
    /**
     * Seed central and tenant demo users.
     */
    public function run(): void
    {
        User::withoutGlobalScopes()->updateOrCreate(
            ['email' => 'superadmin@hospitality.test'],
            [
                'tenant_id' => null,
                'name' => 'Hospitality Super Admin',
                'phone' => '+8801700000000',
                'password' => 'password',
                'is_super_admin' => true,
                'is_active' => true,
                'email_verified_at' => now(),
            ],
        );

        Tenant::query()->each(function (Tenant $tenant): void {
            $tenant->execute(function () use ($tenant): void {
                app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());

                $users = [
                    [
                        'name' => "{$tenant->name} Hospital Admin",
                        'phone' => '+8801700000001',
                        'email' => "hospital-admin@{$tenant->slug}.test",
                        'role' => 'Tenant Owner',
                    ],
                    [
                        'name' => "{$tenant->name} Customer",
                        'phone' => '+8801700000002',
                        'email' => "customer@{$tenant->slug}.test",
                        'role' => 'Customer',
                    ],
                    [
                        'name' => "{$tenant->name} Branch Manager",
                        'phone' => '+8801700000003',
                        'email' => "manager@{$tenant->slug}.test",
                        'role' => 'Branch Manager',
                    ],
                    [
                        'name' => "{$tenant->name} Receptionist",
                        'phone' => '+8801700000004',
                        'email' => "receptionist@{$tenant->slug}.test",
                        'role' => 'Receptionist',
                    ],
                    [
                        'name' => "{$tenant->name} Housekeeping",
                        'phone' => '+8801700000005',
                        'email' => "housekeeping@{$tenant->slug}.test",
                        'role' => 'Housekeeping',
                    ],
                    [
                        'name' => "{$tenant->name} Accountant",
                        'phone' => '+8801700000006',
                        'email' => "accountant@{$tenant->slug}.test",
                        'role' => 'Accountant',
                    ],
                ];

                foreach ($users as $userData) {
                    $role = $userData['role'];
                    unset($userData['role']);

                    $user = User::updateOrCreate(
                        ['email' => $userData['email']],
                        [
                            ...$userData,
                            'tenant_id' => $tenant->getKey(),
                            'password' => 'password',
                            'is_active' => true,
                            'email_verified_at' => now(),
                        ],
                    );

                    $user->syncRoles($role);
                }
            });
        });
    }
}
