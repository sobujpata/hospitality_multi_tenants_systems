<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TrialUpgradePrompt extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly int $daysRemaining) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Your {$notifiable->name} trial ends in {$this->daysRemaining} day(s)")
            ->greeting("Your {$notifiable->name} trial is ending soon")
            ->line("You have {$this->daysRemaining} day(s) left in your free trial.")
            ->action('Choose a plan', route('billing.index', ['tenant' => $notifiable->slug]))
            ->line('Upgrade now to keep your workspace active.');
    }
}
