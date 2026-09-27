<?php

namespace App\TenantFinders;

use Illuminate\Http\Request;
use Spatie\Multitenancy\Contracts\IsTenant;
use Spatie\Multitenancy\TenantFinder\TenantFinder;

class SubdomainTenantFinder extends TenantFinder
{
    public function findForRequest(Request $request): ?IsTenant
    {
        $customDomain = app(IsTenant::class)::query()
            ->where('custom_domain', $request->getHost())
            ->where('is_active', true)
            ->first();

        if ($customDomain) {
            return $customDomain;
        }

        $subdomain = $request->route('tenant');

        if ((! is_string($subdomain) || $subdomain === '') && app()->isLocal()) {
            $subdomain = config('multitenancy.local_tenant', 'demo');
        }

        if (! is_string($subdomain) || $subdomain === '') {
            return null;
        }

        return app(IsTenant::class)::query()
            ->where('slug', $subdomain)
            ->where('is_active', true)
            ->first();
    }
}
