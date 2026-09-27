<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Notifications\Channels\SmsChannel;
use App\Services\SmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class BookingConfirmationSms extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Booking $booking) {}

    public function via(object $notifiable): array
    {
        return [SmsChannel::class];
    }

    public function toSms(object $notifiable): void
    {
        if ($notifiable->phone) {
            app(SmsService::class)->send($notifiable->phone, 'Booking '.$this->booking->booking_ref.' confirmed. Check-in '.$this->booking->check_in->toDateString().'.');
        }
    }
}
