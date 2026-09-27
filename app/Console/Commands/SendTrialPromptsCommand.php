<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\User;
use App\Notifications\HospitalityNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class SendTrialPromptsCommand extends Command
{
    protected $signature = 'tenants:send-trial-prompts';

    protected $description = 'Send scheduled free-trial upgrade prompts';

    public function handle(): int
    {
        $sent = 0;
        Tenant::query()->whereNotNull('trial_ends_at')->where('trial_ends_at', '>', now())->each(function (Tenant $tenant) use (&$sent): void {
            $daysRemaining = now()->diffInDays($tenant->trial_ends_at, false);
            if (! in_array($daysRemaining, [0, 1, 2, 7], true)) {
                return;
            }

            $day = 14 - $daysRemaining;
            $key = "trial-prompt:{$tenant->id}:{$day}";
            if (Cache::add($key, true, now()->addDays(15))) {
                $user = User::withoutGlobalScopes()->where('tenant_id', $tenant->id)->orderBy('id')->first();
                $user?->notify(new HospitalityNotification('trial_expiring', 'Trial expiring', "Your free trial ends in {$daysRemaining} day(s).", ['days_remaining' => $daysRemaining]));
                $sent++;
            }
        });

        $this->info("Queued {$sent} trial prompt(s).");

        return self::SUCCESS;
    }
}
