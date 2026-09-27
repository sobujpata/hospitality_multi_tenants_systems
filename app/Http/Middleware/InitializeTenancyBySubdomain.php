<?php

namespace App\Http\Middleware;

use App\TenantFinders\SubdomainTenantFinder;
use Closure;
use Illuminate\Http\Request;
use Spatie\Multitenancy\Exceptions\NoCurrentTenant;
use Spatie\Permission\PermissionRegistrar;

class InitializeTenancyBySubdomain
{
    public function handle(Request $request, Closure $next): mixed
    {
        $tenant = app(SubdomainTenantFinder::class)->findForRequest($request);

        if ($tenant === null) {
            throw NoCurrentTenant::make();
        }

        $tenant->makeCurrent();
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());

        $response = $next($request);

        return $response;
    }
}
