<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Models\TenantEmailTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BookingConfirmationNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Booking $booking) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $template = TenantEmailTemplate::query()->where('key', 'booking_confirmation')->first();
        $tenant = $this->booking->tenant;
        $variables = [
            'booking_ref' => $this->booking->booking_ref,
            'customer_name' => $notifiable->name,
            'check_in' => $this->booking->check_in->toFormattedDateString(),
            'check_out' => $this->booking->check_out->toFormattedDateString(),
        ];

        if ($template) {
            return (new MailMessage)
                ->subject($this->replaceVariables($template->subject, $variables))
                ->view('emails.tenant.markdown', [
                    'markdown' => $this->replaceVariables($template->markdown, $variables),
                    'logo' => $tenant?->logo,
                    'tenantName' => $tenant?->name,
                ]);
        }

        return (new MailMessage)
            ->subject('Booking confirmation '.$this->booking->booking_ref)
            ->greeting('Your booking is confirmed.')
            ->line('Booking reference: '.$this->booking->booking_ref)
            ->line('Check-in: '.$this->booking->check_in->toFormattedDateString())
            ->line('Check-out: '.$this->booking->check_out->toFormattedDateString())
            ->action('View booking', url('/portal'))
            ->line('We look forward to welcoming you.');
    }

    private function replaceVariables(string $content, array $variables): string
    {
        return str_replace(
            array_map(fn (string $key): string => '{{ '.$key.' }}', array_keys($variables)),
            array_values($variables),
            $content,
        );
    }
}
