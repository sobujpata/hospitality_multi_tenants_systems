<?php

namespace App\Jobs;

use App\Models\Tenant;
use App\Services\DashboardStatsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Spatie\Multitenancy\Jobs\TenantAware;

class RefreshDashboardStats implements ShouldQueue, TenantAware
{
    use Queueable;

    public function __construct(public Tenant $tenant) {}

    public function handle(DashboardStatsService $stats): void
    {
        tenancy()->initialize($this->tenant);
        $start = now()->startOfMonth();
        $end = now()->addDay()->startOfDay();
        $calculated = $stats->calculate($start, $end);
        cache()->store('redis')->put("dashboard:{$this->tenant->id}:{$start->toDateString()}:{$end->toDateString()}", $calculated, now()->addMinutes(30));
    }
}
