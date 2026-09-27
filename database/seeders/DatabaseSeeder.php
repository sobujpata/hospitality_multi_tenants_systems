<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Spatie\Permission\PermissionRegistrar;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(PlanSeeder::class);

        Tenant::upsert([
            [
                'name' => 'Demo Hotel',
                'slug' => 'demo',
                'domain' => 'demo.localhost',
                'database' => 'demo',
                'plan' => 'trial',
                'trial_ends_at' => Carbon::now()->addDays(14),
                'is_active' => true,
            ],
            [
                'name' => 'Example Resort',
                'slug' => 'resort',
                'domain' => 'resort.localhost',
                'database' => 'resort',
                'plan' => 'pro',
                'trial_ends_at' => null,
                'is_active' => true,
            ],
        ], ['slug'], [
            'name',
            'domain',
            'database',
            'plan',
            'trial_ends_at',
            'is_active',
        ]);

        Tenant::query()->whereNull('plan_id')->update([
            'plan_id' => Plan::query()->where('slug', 'starter')->value('id'),
        ]);

        Tenant::query()->each(function (Tenant $tenant): void {
            $tenant->execute(function () use ($tenant): void {
                User::updateOrCreate(
                    ['email' => "admin@{$tenant->slug}.test"],
                    [
                        'tenant_id' => $tenant->id,
                        'name' => "{$tenant->name} Admin",
                        'password' => 'password',
                        'is_active' => true,
                    ],
                );
            });
        });

        $this->call(PermissionSeeder::class);

        Tenant::query()->each(function (Tenant $tenant): void {
            $tenant->execute(function () use ($tenant): void {
                $admin = User::query()->where('email', "admin@{$tenant->slug}.test")->firstOrFail();
                app(PermissionRegistrar::class)
                    ->setPermissionsTeamId($tenant->getKey());
                $admin->syncRoles('Tenant Owner');
            });
        });

        $this->call(UserSeeder::class);
    }
}
