<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class HospitalityNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $event,
        public readonly string $title,
        public readonly string $message,
        public readonly array $data = [],
    ) {}

    public function via(object $notifiable): array
    {
        $preferences = $notifiable->notification_preferences ?? [];
        $channels = $preferences[$this->event] ?? ['database', 'mail', 'broadcast'];

        return array_values(array_filter([
            in_array('database', $channels, true) ? 'database' : null,
            in_array('mail', $channels, true) ? 'mail' : null,
            in_array('broadcast', $channels, true) ? 'broadcast' : null,
        ]));
    }

    public function toArray(object $notifiable): array
    {
        return ['event' => $this->event, 'title' => $this->title, 'message' => $this->message, ...$this->data];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)->subject($this->title)->greeting($this->title)->line($this->message);
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
