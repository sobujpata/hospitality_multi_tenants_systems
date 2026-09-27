<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Notifications\HospitalityNotification;
use Illuminate\Console\Command;

class SendOperationalNotificationsCommand extends Command
{
    protected $signature = 'notifications:send-operational';

    protected $description = 'Send scheduled check-in and room availability notifications';

    public function handle(): int
    {
        $sent = 0;
        Tenant::query()->where('is_active', true)->each(function (Tenant $tenant) use (&$sent): void {
            $tenant->makeCurrent();
            $users = User::query()->where('is_active', true)->get();
            Booking::query()->with('unit')->whereBetween('check_in', [now()->addHours(1), now()->addHours(2)])->whereNotIn('status', ['cancelled', 'no_show'])->get()->each(function (Booking $booking) use ($users, &$sent): void {
                $users->each(fn (User $user) => $user->notify(new HospitalityNotification('checkin_reminder', 'Check-in reminder', 'Booking '.$booking->booking_ref.' checks in within 2 hours.', ['booking_id' => $booking->id])));
                $sent++;
            });
            $available = Unit::query()->where('unit_type', 'room')->where('status', 'available')->count();
            $total = max(1, Unit::query()->where('unit_type', 'room')->count());
            if ($available / $total < 0.1) {
                $users->each(fn (User $user) => $user->notify(new HospitalityNotification('low_availability', 'Low room availability', "{$available} of {$total} rooms are available.", ['available_rooms' => $available])));
                $sent++;
            }
        });

        $this->info("Queued {$sent} operational notification group(s).");

        return self::SUCCESS;
    }
}
