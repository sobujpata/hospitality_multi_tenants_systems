<?php

namespace App\Console\Commands;

use App\Jobs\RefreshDashboardStats;
use App\Models\Tenant;
use Illuminate\Console\Command;

class RefreshDashboardStatsCommand extends Command
{
    protected $signature = 'dashboard:refresh';

    protected $description = 'Refresh cached tenant dashboard statistics';

    public function handle(): int
    {
        Tenant::query()->where('is_active', true)->get()->each(fn (Tenant $tenant) => RefreshDashboardStats::dispatch($tenant));
        $this->info('Dashboard refresh jobs dispatched.');

        return self::SUCCESS;
    }
}
