<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TaskAssigned implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  array<string, mixed>  $notificationData
     */
    public function __construct(
        public int $userId,
        public string $notificationId,
        public array $notificationData,
        public string $createdAt,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('App.Models.User.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'task.assigned';
    }

    /**
     * @return array{id: string, type: string, data: array<string, mixed>, read_at: null, created_at: string}
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->notificationId,
            'type' => $this->notificationData['event'] ?? 'task_assigned',
            'data' => $this->notificationData,
            'read_at' => null,
            'created_at' => $this->createdAt,
        ];
    }
}
