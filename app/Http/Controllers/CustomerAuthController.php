<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class CustomerAuthController extends Controller
{
    public function showLogin(Request $request): Response
    {
        $redirect = $request->query('redirect');
        if (is_string($redirect)
            && str_starts_with($redirect, '/')
            && ! str_starts_with($redirect, '//')
            && ! str_contains($redirect, '\\')
            && parse_url($redirect, PHP_URL_SCHEME) === null
            && parse_url($redirect, PHP_URL_HOST) === null
            && parse_url($redirect, PHP_URL_PATH) === '/portal/book') {
            $request->session()->put('url.intended', $redirect);
        }

        return Inertia::render('portal/login');
    }

    public function showRegister(): Response
    {
        return Inertia::render('portal/register');
    }

    public function profile(): Response
    {
        return Inertia::render('portal/profile', [
            'customer' => auth('customer')->user(),
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $customer = auth('customer')->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('customers', 'email')->ignore($customer->id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'array'],
        ]);
        $customer->update($data);

        return back()->with('status', 'Profile updated.');
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $customer = auth('customer')->user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);
        abort_unless($customer->password && Hash::check($data['current_password'], $customer->password), 422, 'Current password is incorrect.');
        $customer->update(['password' => $data['password']]);

        return back()->with('status', 'Password changed successfully.');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required']]);
        abort_unless(auth('customer')->attempt($credentials, $request->boolean('remember')), 422, 'Invalid customer credentials.');
        $request->session()->regenerate();

        return redirect()->intended('/portal');
    }

    public function register(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);
        $customer = Customer::create($data);
        auth('customer')->login($customer);

        return redirect()->intended('/portal');
    }

    public function logout(Request $request): RedirectResponse
    {
        auth('customer')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }

    public function social(string $provider): never
    {
        abort(503, 'Social login requires the laravel/socialite package and provider credentials.');
    }
}
