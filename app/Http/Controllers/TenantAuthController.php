<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Inertia\Inertia;
use Inertia\Response;
use PragmaRX\Google2FALaravel\Facade as Google2FA;

class TenantAuthController extends Controller
{
    public function login(): Response
    {
        return Inertia::render('auth/login', [
            'action' => route('tenant.login.store', ['tenant' => Tenant::current()->slug]),
            'canResetPassword' => true,
        ]);
    }

    public function authenticate(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'code' => ['nullable', 'digits:6'],
            'remember' => ['boolean'],
        ]);

        $user = User::query()
            ->where('email', mb_strtolower($credentials['email']))
            ->first();

        if (! $user || ! $user->is_active || ! Hash::check($credentials['password'], $user->password)) {
            return back()->withErrors(['email' => 'These credentials are incorrect.']);
        }

        if ($user->two_factor_secret && (! isset($credentials['code']) || ! Google2FA::verifyKey($user->two_factor_secret, $credentials['code']))) {
            return back()->withErrors(['code' => 'A valid two-factor code is required.']);
        }

        Auth::guard('web')->login($user, (bool) ($credentials['remember'] ?? false));
        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->saveQuietly();

        return redirect()->route('dashboard', ['tenant' => Tenant::current()->slug]);
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('tenant.login', ['tenant' => Tenant::current()->slug]);
    }

    public function register(): Response
    {
        return Inertia::render('auth/register', [
            'passwordRules' => PasswordRule::defaults()->toPasswordRulesString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $user = User::create([
            ...$data,
            'tenant_id' => Tenant::current()->getKey(),
        ]);

        Auth::guard('web')->login($user);

        return redirect()->route('dashboard', ['tenant' => Tenant::current()->slug]);
    }

    public function forgotPassword(): Response
    {
        return Inertia::render('auth/forgot-password');
    }

    public function sendResetLink(Request $request): RedirectResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        $status = Password::sendResetLink($request->only('email'));

        return $status === Password::RESET_LINK_SENT
            ? back()->with('status', __($status))
            : back()->withErrors(['email' => __($status)]);
    }

    public function resetPassword(Request $request, string $token): Response
    {
        return Inertia::render('auth/reset-password', [
            'token' => $token,
            'email' => $request->query('email', ''),
            'passwordRules' => PasswordRule::defaults()->toPasswordRulesString(),
        ]);
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'token' => ['required'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $status = Password::reset($data, function (User $user, string $password): void {
            $user->forceFill(['password' => $password])->save();
        });

        return $status === Password::PASSWORD_RESET
            ? redirect()->route('tenant.login', ['tenant' => Tenant::current()->slug])->with('status', __($status))
            : back()->withErrors(['email' => __($status)]);
    }

    public function enableTwoFactor(): RedirectResponse
    {
        $user = $this->authenticatedUser();
        $secret = Google2FA::generateSecretKey();
        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => null,
        ])->save();

        return back()->with('two_factor_secret', $secret);
    }

    public function confirmTwoFactor(Request $request): RedirectResponse
    {
        $request->validate(['code' => ['required', 'digits:6']]);
        $user = $this->authenticatedUser();

        if (! Google2FA::verifyKey($user->two_factor_secret, $request->string('code')->toString())) {
            return back()->withErrors(['code' => 'The authentication code is invalid.']);
        }

        $user->forceFill(['two_factor_confirmed_at' => now()])->save();

        return back()->with('status', 'Two-factor authentication enabled.');
    }

    private function authenticatedUser(): User
    {
        return Auth::guard('web')->user();
    }
}
