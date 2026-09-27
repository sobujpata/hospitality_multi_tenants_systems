<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\TenantEmailTemplate;
use App\Models\TenantIntegration;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class TenantSettingsController extends Controller
{
    public function index(): Response
    {
        $tenant = Tenant::current()->load('planRelation');

        return Inertia::render('settings/tenant', [
            'tenant' => $tenant->only(['id', 'name', 'logo', 'timezone', 'currency', 'language', 'custom_domain', 'primary_color', 'secondary_color', 'settings']),
            'plan' => $tenant->planRelation,
            'templates' => TenantEmailTemplate::query()->orderBy('key')->get(['id', 'key', 'subject', 'markdown']),
            'integrations' => TenantIntegration::query()->orderBy('name')->get(['id', 'name', 'api_key', 'webhook_url', 'is_active']),
        ]);
    }

    public function general(Request $request): RedirectResponse
    {
        $this->authorizeSettings($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'timezone' => ['required', 'timezone'],
            'currency' => ['required', 'string', 'size:3'],
            'language' => ['required', 'string', 'max:10'],
            'logo' => ['nullable', 'image', 'max:4096'],
        ]);
        $tenant = Tenant::current();
        if ($request->hasFile('logo')) {
            if ($tenant->logo) {
                Storage::disk('s3')->delete($tenant->logo);
            }
            $data['logo'] = $request->file('logo')->store('tenant-logos', 's3');
        }
        $tenant->update($data);

        return back()->with('status', 'General settings saved.');
    }

    public function booking(Request $request): RedirectResponse
    {
        $this->authorizeSettings($request);
        $data = $request->validate([
            'cancellation_policy' => ['nullable', 'string', 'max:5000'],
            'deposit_rules' => ['nullable', 'string', 'max:5000'],
            'auto_confirm' => ['boolean'],
        ]);
        $tenant = Tenant::current();
        $tenant->update(['settings' => [...($tenant->settings ?? []), 'booking' => $data]]);

        return back()->with('status', 'Booking settings saved.');
    }

    public function branding(Request $request): RedirectResponse
    {
        $this->authorizeSettings($request);
        abort_unless(Tenant::current()->planRelation?->white_label, 403, 'White-label branding requires the Enterprise plan.');
        $data = $request->validate([
            'custom_domain' => ['nullable', 'string', 'max:255', 'regex:/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i'],
            'primary_color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'secondary_color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);
        Tenant::current()->update($data);

        return back()->with('status', 'White-label branding saved.');
    }

    public function template(Request $request, TenantEmailTemplate $template): RedirectResponse
    {
        $this->authorizeSettings($request);
        $data = $request->validate(['subject' => ['required', 'string', 'max:255'], 'markdown' => ['required', 'string', 'max:30000']]);
        $template->update($data);

        return back()->with('status', 'Email template saved.');
    }

    public function integration(Request $request): RedirectResponse
    {
        $this->authorizeSettings($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'api_key' => ['nullable', 'string', 'max:500'],
            'webhook_url' => ['nullable', 'url', 'max:500'],
            'is_active' => ['boolean'],
        ]);
        $data['tenant_id'] = Tenant::current()->getKey();
        $data['api_key'] = $data['api_key'] ?: Str::random(48);
        TenantIntegration::updateOrCreate(['tenant_id' => $data['tenant_id'], 'name' => $data['name']], $data);

        return back()->with('status', 'Integration saved. API key: '.$data['api_key']);
    }

    public function destroyIntegration(TenantIntegration $integration): RedirectResponse
    {
        $this->authorizeSettings(request());
        $integration->delete();

        return back()->with('status', 'Integration removed.');
    }

    private function authorizeSettings(Request $request): void
    {
        abort_unless($request->user()?->hasRole('Tenant Owner'), 403);
    }
}
