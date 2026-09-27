<?php

use App\Models\SuperAdmin;
use App\Models\Tenant;

test('super admins can create and edit tenants', function () {
    $admin = SuperAdmin::query()->create([
        'name' => 'Platform Admin',
        'email' => 'admin@example.test',
        'password' => 'password',
        'is_super_admin' => true,
        'is_active' => true,
    ]);

    $this->actingAs($admin, 'superadmin')
        ->get('/admin/tenants')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('superadmin/tenants'));

    $this->post('/admin/tenants', [
        'name' => 'Northwind Hotel',
        'slug' => 'northwind',
        'domain' => 'northwind.localhost',
        'database' => '',
        'plan_id' => null,
        'trial_ends_at' => null,
        'is_active' => true,
    ])->assertRedirect();

    $tenant = Tenant::query()->where('slug', 'northwind')->firstOrFail();
    expect($tenant->database)->toBe('northwind');

    $this->put("/admin/tenants/{$tenant->id}", [
        'name' => 'Northwind Resort',
        'slug' => 'northwind',
        'domain' => 'northwind.localhost',
        'database' => 'northwind',
        'plan_id' => null,
        'trial_ends_at' => null,
        'is_active' => false,
    ])->assertRedirect();

    expect($tenant->fresh()->name)->toBe('Northwind Resort')
        ->and($tenant->fresh()->is_active)->toBeFalse();

    $this->delete("/admin/tenants/{$tenant->id}")->assertRedirect();

    $this->assertDatabaseMissing('tenants', ['id' => $tenant->id]);
});
