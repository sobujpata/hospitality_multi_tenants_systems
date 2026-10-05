<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use InvalidArgumentException;

class MessageRead implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $conversationId,
        public string $readerType,
        public int $branchId,
        public int $tenantId,
        public int $unreadStaff,
    ) {
        if (! in_array($readerType, ['customer', 'staff'], true)) {
            throw new InvalidArgumentException('The reader type must be customer or staff.');
        }
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('conversation.'.$this->conversationId),
        ];
        if ($this->readerType === 'staff') {
            $channels[] = new PrivateChannel('branch.'.$this->branchId.'.inbox');
            $channels[] = new PrivateChannel('tenant.'.$this->tenantId.'.inbox');
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'message.read';
    }

    /**
     * @return array{conversation_id: int, reader_type: string, unread_staff: int}
     */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'reader_type' => $this->readerType,
            'unread_staff' => $this->unreadStaff,
        ];
    }
}
