<?php

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Fortify\Features;

test('login screen can be rendered', function () {
    $response = $this->get(route('login'));

    $response->assertOk();
});

test('users can authenticate using the login screen', function () {
    $user = User::factory()->create();

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});

test('tenant users can authenticate on their own subdomain', function () {
    $tenant = Tenant::query()->create([
        'name' => 'Resort Hotel',
        'slug' => 'resort-auth-test',
        'domain' => 'resort-auth-test.localhost',
        'database' => 'resort-auth-test',
        'plan' => 'trial',
        'trial_ends_at' => now()->addDays(14),
        'is_active' => true,
    ]);
    $user = User::withoutGlobalScopes()->create([
        'tenant_id' => $tenant->id,
        'name' => 'Resort Admin',
        'email' => 'admin@resort-auth-test.test',
        'password' => 'password',
        'is_active' => true,
    ]);

    $this->post(route('tenant.login.store', ['tenant' => $tenant->slug]), [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect(route('dashboard', ['tenant' => $tenant->slug], absolute: false));

    $this->get(route('dashboard', ['tenant' => $tenant->slug]))
        ->assertOk();

    $this->assertAuthenticatedAs($user);
});

test('super admins can authenticate from the tenant login screen', function () {
    $tenant = Tenant::query()->create([
        'name' => 'Demo Hotel',
        'slug' => 'demo',
        'domain' => 'demo.localhost',
        'database' => 'demo',
        'plan' => 'trial',
        'trial_ends_at' => now()->addDays(14),
        'is_active' => true,
    ]);

    $user = User::withoutGlobalScopes()->create([
        'tenant_id' => null,
        'name' => 'Hospitality Super Admin',
        'email' => 'superadmin@hospitality.test',
        'password' => 'password',
        'is_super_admin' => true,
        'is_active' => true,
        'email_verified_at' => now(),
    ]);

    $response = $this->post(route('tenant.login.store', ['tenant' => $tenant->slug]), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticatedAs($user);
    $response->assertRedirect(route('dashboard', ['tenant' => $tenant->slug], absolute: false));
});

test('users with two factor enabled are redirected to two factor challenge', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $user = User::factory()->withTwoFactor()->create();

    $response = $this->post(route('login'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertRedirect(route('two-factor.login'));
    $response->assertSessionHas('login.id', $user->id);
    $this->assertGuest();
});

test('users can not authenticate with invalid password', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

test('users can logout', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('logout'));

    $response->assertRedirect(route('home'));

    $this->assertGuest();
});

test('users are rate limited', function () {
    $user = User::factory()->create();

    RateLimiter::increment(md5('login'.implode('|', [$user->email, '127.0.0.1'])), amount: 5);

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertTooManyRequests();
});
