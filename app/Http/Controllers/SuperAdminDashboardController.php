<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\PermissionRegistrar;

class SuperAdminDashboardController extends Controller
{
    private const FLAGS = [
        'beta_channel_manager' => 'Beta channel manager',
        'advanced_reports' => 'Advanced reports',
        'api_access' => 'API access',
        'white_label' => 'White label',
    ];

    public function index(): Response
    {
        $started = microtime(true);
        $tenants = Tenant::query()->with('planRelation')->withCount('subscriptions')->latest()->get();
        $dbTime = round((microtime(true) - $started) * 1000, 2);
        $activeTenantCount = $tenants->where('is_active', true)->count();
        $churnPeriodStart = now()->subDays(30);
        $subscriptionsAtPeriodStart = DB::table('subscriptions')
            ->where('created_at', '<=', $churnPeriodStart)
            ->where(function ($query) use ($churnPeriodStart): void {
                $query->whereNull('ends_at')->orWhere('ends_at', '>', $churnPeriodStart);
            })
            ->count();
        $subscriptionsChurned = DB::table('subscriptions')
            ->whereNotNull('ends_at')
            ->whereBetween('ends_at', [$churnPeriodStart, now()])
            ->count();
        $churn = $subscriptionsAtPeriodStart
            ? round($subscriptionsChurned / $subscriptionsAtPeriodStart * 100, 1)
            : 0;
        $mrr = (float) DB::table('subscriptions')
            ->join('tenants', 'subscriptions.tenant_id', '=', 'tenants.id')
            ->join('plans', 'tenants.plan_id', '=', 'plans.id')
            ->where('tenants.is_active', true)
            ->where('subscriptions.stripe_status', 'active')
            ->where(function ($query): void {
                $query->whereNull('subscriptions.ends_at')
                    ->orWhere('subscriptions.ends_at', '>', now());
            })
            ->selectRaw('COALESCE(SUM(plans.monthly_price * COALESCE(subscriptions.quantity, 1)), 0) as mrr')
            ->value('mrr');
        $signupStart = now()->subMonths(5)->startOfMonth();
        $signupsByMonth = $tenants
            ->filter(fn (Tenant $tenant): bool => $tenant->created_at?->greaterThanOrEqualTo($signupStart) ?? false)
            ->groupBy(fn (Tenant $tenant): string => $tenant->created_at->format('Y-m'))
            ->map->count();
        $signupTrend = collect(range(5, 0))
            ->map(fn (int $monthsAgo): array => [
                'month' => now()->subMonths($monthsAgo)->format('M Y'),
                'signups' => $signupsByMonth->get(now()->subMonths($monthsAgo)->format('Y-m'), 0),
            ])
            ->values();

        return Inertia::render('superadmin/dashboard', [
            'tenants' => $tenants->map(fn (Tenant $tenant): array => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'plan' => $tenant->planRelation?->name ?? 'Unassigned',
                'mrr' => (float) ($tenant->planRelation?->monthly_price ?? 0),
                'trial_ends_at' => $tenant->trial_ends_at?->toDateString(),
                'trial_active' => $tenant->onGenericTrial(),
                'active' => $tenant->is_active,
                'last_activity' => User::withoutGlobalScopes()->where('tenant_id', $tenant->id)->max('last_login_at'),
                'flags' => collect(array_keys(self::FLAGS))
                    ->mapWithKeys(fn (string $key): array => [
                        $key => $tenant->featureEnabled($key),
                    ]),
            ]),
            'plans' => Plan::query()->where('is_active', true)->orderBy('monthly_price')->get(),
            'featureFlags' => self::FLAGS,
            'stats' => [
                'total_tenants' => $tenants->count(),
                'active_tenants' => $activeTenantCount,
                'mrr' => $mrr,
                'churn_rate' => $churn,
                'active_bookings_today' => Booking::withoutGlobalScopes()
                    ->where('status', 'checked_in')
                    ->whereDate('check_in', '<=', today())
                    ->whereDate('check_out', '>', today())
                    ->count(),
                'signup_trend' => $signupTrend,
            ],
            'health' => [
                'queue_jobs' => DB::table('jobs')->count(),
                'failed_jobs' => DB::table('failed_jobs')->count(),
                'cache_hit_rate' => $this->cacheHitRate(),
                'db_query_time_ms' => $dbTime,
            ],
        ]);
    }

    public function impersonate(Tenant $tenant): RedirectResponse
    {
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());
        $owner = User::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereHas('roles', fn ($query) => $query->where('name', 'Tenant Owner'))
            ->orderBy('id')
            ->firstOrFail();
        session(['impersonator_id' => Auth::guard('superadmin')->id()]);
        Auth::guard('web')->login($owner);

        return redirect()->route('dashboard', ['tenant' => $tenant->slug]);
    }

    public function stopImpersonation(): RedirectResponse
    {
        Auth::guard('web')->logout();
        session()->forget('impersonator_id');

        return redirect()->route('superadmin.dashboard');
    }

    public function override(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $request->validate(['plan_id' => ['nullable', 'exists:plans,id'], 'trial_ends_at' => ['nullable', 'date']]);
        $tenant->update([
            'plan_id' => $data['plan_id'] ?? null,
            'trial_ends_at' => $data['trial_ends_at'] ?? $tenant->trial_ends_at,
        ]);

        return back()->with('status', 'Tenant billing override saved.');
    }

    public function flag(Request $request, Tenant $tenant): RedirectResponse
    {
        $data = $request->validate(['key' => ['required', 'in:'.implode(',', array_keys(self::FLAGS))], 'enabled' => ['required', 'boolean']]);
        $tenant->update([
            'settings' => [
                ...($tenant->settings ?? []),
                'features' => [
                    ...($tenant->settings['features'] ?? []),
                    $data['key'] => (bool) $data['enabled'],
                ],
            ],
        ]);

        return back()->with('status', 'Feature flag updated.');
    }

    private function cacheHitRate(): string
    {
        try {
            $stats = Redis::connection()->info('stats');
        } catch (\Error|\Exception) {
            return 'Unavailable';
        }

        $hits = (int) ($stats['keyspace_hits'] ?? 0);
        $misses = (int) ($stats['keyspace_misses'] ?? 0);
        $total = $hits + $misses;

        return $total > 0 ? round($hits / $total * 100, 1).'%' : 'No samples';
    }
}
