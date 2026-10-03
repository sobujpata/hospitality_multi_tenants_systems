<?php

namespace App\Http\Middleware;

use App\Models\Customer;
use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InitializeCustomerTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $customer = auth('customer')->user();

        abort_unless($customer instanceof Customer, 401);

        $tenant = Tenant::find($customer->tenant_id);

        abort_if($tenant === null, 404);

        $tenant->makeCurrent();

        return $next($request);
    }
}
