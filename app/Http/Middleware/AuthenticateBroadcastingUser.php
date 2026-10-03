<?php

namespace App\Http\Middleware;

use App\Models\Branch;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Tenant;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateBroadcastingUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $isStaffConversationList = $request->isMethod('GET')
            && $request->is('api/conversations');
        $customer = $isStaffConversationList
            ? null
            : Auth::guard('customer')->user();
        $tenant = $customer instanceof Customer
            ? Tenant::query()->find($customer->tenant_id)
            : $this->tenantForRequest($request);

        if ($tenant === null && $customer instanceof Customer && $customer->tenant_id === null) {
            $channelName = $request->input('channel_name');
            if (is_string($channelName)
                && preg_match('/^private-conversation\.(\d+)$/', $channelName, $matches) === 1) {
                $tenantId = Conversation::withoutGlobalScopes()
                    ->whereKey((int) $matches[1])
                    ->where('customer_id', $customer->id)
                    ->value('tenant_id');
                $tenant = $tenantId === null ? null : Tenant::query()->find($tenantId);
            }

            $conversationId = $request->route('conversation');
            if ($tenant === null && is_numeric($conversationId)) {
                $tenantId = Conversation::withoutGlobalScopes()
                    ->whereKey((int) $conversationId)
                    ->where('customer_id', $customer->id)
                    ->value('tenant_id');
                $tenant = $tenantId === null ? null : Tenant::query()->find($tenantId);
            }

            $branchId = $request->input('branch_id') ?? $request->route('branch');
            if ($tenant === null && is_numeric($branchId)) {
                $tenantId = Branch::withoutGlobalScopes()
                    ->whereKey((int) $branchId)
                    ->where('is_active', true)
                    ->value('tenant_id');
                $tenant = $tenantId === null ? null : Tenant::query()->find($tenantId);
            }

            $tenant ??= $this->tenantForRequest($request);
        }

        abort_if($tenant === null, 404);

        $tenant->makeCurrent();
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());

        $guard = $customer instanceof Customer ? 'customer' : 'web';
        $user = $customer ?? Auth::guard($guard)->user();

        abort_unless($user instanceof Customer || $user instanceof User, 401);
        Auth::shouldUse($guard);

        return $next($request);
    }

    private function tenantForRequest(Request $request): ?Tenant
    {
        $host = $request->getHost();
        $tenant = Tenant::query()
            ->where('custom_domain', $host)
            ->where('is_active', true)
            ->first();

        if ($tenant !== null) {
            return $tenant;
        }

        $tenantSlug = $request->route('tenant');
        $domain = (string) config('app.domain', 'localhost');

        if ((! is_string($tenantSlug) || $tenantSlug === '') && Str::endsWith($host, '.'.$domain)) {
            $tenantSlug = Str::beforeLast($host, '.'.$domain);
        }

        if (! is_string($tenantSlug) || $tenantSlug === '') {
            $tenantSlug = app()->isLocal()
                ? (string) config('multitenancy.local_tenant', 'demo')
                : '';
        }

        if ($tenantSlug === '') {
            return null;
        }

        return Tenant::query()
            ->where('slug', $tenantSlug)
            ->where('is_active', true)
            ->first();
    }
}
