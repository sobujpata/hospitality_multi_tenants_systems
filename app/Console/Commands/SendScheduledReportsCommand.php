<?php

namespace App\Console\Commands;

use App\Jobs\SendScheduledReport;
use App\Models\ReportSchedule;
use Illuminate\Console\Command;

class SendScheduledReportsCommand extends Command
{
    protected $signature = 'reports:send-scheduled';

    protected $description = 'Queue due scheduled reports for tenants';

    public function handle(): int
    {
        $schedules = ReportSchedule::withoutGlobalScopes()
            ->with('tenant')
            ->where('is_active', true)
            ->where(function ($query): void {
                $query->whereNull('next_run_at')->orWhere('next_run_at', '<=', now());
            })->get();

        foreach ($schedules as $schedule) {
            SendScheduledReport::dispatch($schedule);
            $next = match ($schedule->cadence) {
                'weekly' => now()->addWeek(),
                'monthly' => now()->addMonth(),
                default => now()->addDay(),
            };
            $schedule->newQuery()->whereKey($schedule->id)->update(['next_run_at' => $next]);
        }

        $this->info("Queued {$schedules->count()} scheduled report(s).");

        return self::SUCCESS;
    }
}
