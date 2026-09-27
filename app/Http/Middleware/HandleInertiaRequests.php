<?php

namespace App\Http\Middleware;

use App\Models\Branch;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user() ?? $request->user('superadmin');
        $tenantId = Tenant::current()?->getKey();
        $roles = [];

        if ($user instanceof User && $tenantId !== null) {
            $roles = DB::table('model_has_roles as model_roles')
                ->join('roles', 'roles.id', '=', 'model_roles.role_id')
                ->where('model_roles.model_type', $user->getMorphClass())
                ->where('model_roles.model_id', $user->getKey())
                ->where('model_roles.team_id', $tenantId)
                ->where(function ($query) use ($tenantId): void {
                    $query->whereNull('roles.team_id')
                        ->orWhere('roles.team_id', $tenantId);
                })
                ->pluck('roles.name')
                ->all();
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
                'roles' => $roles,
                'customer' => $request->user('customer'),
            ],
            'flash' => [
                'status' => $request->session()->get('status'),
                'two_factor_secret' => $request->session()->get('two_factor_secret'),
            ],
            'branchOptions' => fn () => Tenant::current()
                ? Branch::query()
                    ->when($request->user()?->branch_id, fn ($query, $branchId) => $query->whereKey($branchId))
                    ->orderBy('name')
                    ->get(['id', 'name'])
                : [],
            'currentBranchId' => fn () => $request->session()->get('branch_id'),
            'featureFlags' => fn () => Tenant::current()
                ? collect(['beta_channel_manager', 'advanced_reports', 'api_access', 'white_label'])
                    ->mapWithKeys(fn (string $key): array => [$key => Tenant::current()->featureEnabled($key)])
                : [],
            'unreadNotifications' => fn () => $request->user()?->unreadNotifications()->latest()->limit(10)->get(['id', 'data', 'created_at']) ?? [],
            'tenantBranding' => fn () => Tenant::current()?->brandSettings(),
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
