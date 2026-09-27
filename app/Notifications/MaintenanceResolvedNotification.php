<?php

namespace App\Notifications;

use App\Models\MaintenanceRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class MaintenanceResolvedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public MaintenanceRequest $request) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Maintenance resolved: '.$this->request->title)
            ->greeting('Maintenance request resolved')
            ->line($this->request->description)
            ->line('Resolved at: '.$this->request->resolved_at?->toDateTimeString())
            ->action('Open maintenance requests', url('/maintenance'));
    }
}
