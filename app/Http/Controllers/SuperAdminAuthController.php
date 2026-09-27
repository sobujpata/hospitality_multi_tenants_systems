<?php

namespace App\Http\Controllers;

use App\Models\SuperAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SuperAdminAuthController extends Controller
{
    public function login(): Response
    {
        return Inertia::render('auth/login', [
            'action' => route('superadmin.login.store'),
            'canResetPassword' => false,
        ]);
    }

    public function authenticate(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
        ]);

        $admin = SuperAdmin::query()
            ->where('email', mb_strtolower($credentials['email']))
            ->where('is_super_admin', true)
            ->where('is_active', true)
            ->first();

        if (! $admin || ! Hash::check($credentials['password'], $admin->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials are incorrect.'],
            ]);
        }

        auth('superadmin')->login($admin, (bool) ($credentials['remember'] ?? false));
        $admin->forceFill(['last_login_at' => now()])->saveQuietly();

        return redirect()->route('superadmin.dashboard');
    }

    public function logout(): RedirectResponse
    {
        auth('superadmin')->logout();

        return redirect()->route('superadmin.login');
    }
}
