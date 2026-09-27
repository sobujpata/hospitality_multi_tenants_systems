<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantBillingAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenant = Tenant::current();

        if ($tenant && ! $tenant->hasBillingAccess() && ! $this->isBillingRequest($request)) {
            if ($request->isMethodSafe()) {
                $request->attributes->set('tenant_read_only', true);
            } else {
                abort(402, 'Your subscription has lapsed. Update billing to restore write access.');
            }
        }

        return $next($request);
    }

    private function isBillingRequest(Request $request): bool
    {
        return $request->is('billing*') || $request->is('stripe/*') || $request->is('logout');
    }
}
