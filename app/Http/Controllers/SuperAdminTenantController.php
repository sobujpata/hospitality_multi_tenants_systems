<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SuperAdminTenantController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('superadmin/tenants', [
            'tenants' => Tenant::query()
                ->withCount('subscriptions')
                ->with('planRelation:id,name,monthly_price')
                ->orderBy('name')
                ->get()
                ->map(fn (Tenant $tenant): array => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'domain' => $tenant->domain,
                    'database' => $tenant->database,
                    'plan_id' => $tenant->plan_id,
                    'plan' => $tenant->planRelation?->name ?? 'Unassigned',
                    'mrr' => (float) ($tenant->planRelation?->monthly_price ?? 0),
                    'trial_ends_at' => $tenant->trial_ends_at?->toDateString(),
                    'trial_active' => $tenant->onGenericTrial(),
                    'is_active' => $tenant->is_active,
                    'last_activity' => User::withoutGlobalScopes()
                        ->where('tenant_id', $tenant->id)
                        ->max('last_login_at'),
                    'subscriptions_count' => $tenant->subscriptions_count,
                ]),
            'plans' => Plan::query()->where('is_active', true)->orderBy('monthly_price')->get(['id', 'name', 'monthly_price']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validatedTenantData($request);
        $data['database'] = $data['database'] ?: $data['slug'];

        Tenant::query()->create($data);

        return back()->with('status', 'Tenant created successfully.');
    }

    public function update(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $this->validatedTenantData($request, $tenant);
        $data['database'] = $data['database'] ?: $data['slug'];

        $tenant->update($data);

        return back()->with('status', 'Tenant updated successfully.');
    }

    public function destroy(Tenant $tenant): RedirectResponse
    {
        $tenant->delete();

        return back()->with('status', 'Tenant deleted successfully.');
    }

    public function updateStatus(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);
        $tenant->update($data);

        return back()->with('status', $tenant->is_active
            ? 'Tenant account reactivated.'
            : 'Tenant account suspended.');
    }

    /**
     * @return array{name: string, slug: string, domain: string, database: string, plan_id: int|null, trial_ends_at: string|null, is_active: bool}
     */
    private function validatedTenantData(Request $request, ?Tenant $tenant = null): array
    {
        $request->merge([
            'database' => $request->input('database') ?: $request->input('slug'),
        ]);
        $tenantId = $tenant?->getKey();

        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('tenants', 'slug')->ignore($tenantId)],
            'domain' => ['required', 'string', 'max:255', Rule::unique('tenants', 'domain')->ignore($tenantId)],
            'database' => ['nullable', 'string', 'max:255', Rule::unique('tenants', 'database')->ignore($tenantId)],
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],
            'trial_ends_at' => ['nullable', 'date'],
            'is_active' => ['required', 'boolean'],
        ]);
    }
}
