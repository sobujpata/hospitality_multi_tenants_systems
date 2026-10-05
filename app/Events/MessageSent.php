<?php

namespace App\Events;

use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Message;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use LogicException;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, Queueable, SerializesModels;

    /**
     * @var array{id: int|string, name: string, avatar: mixed, type: string}
     */
    private array $senderPayload;

    private int $branchId;

    private int $tenantId;

    private int $unreadStaff;

    public function __construct(public Message $message)
    {
        $this->onConnection('deferred');
        $message->loadMissing(['sender', 'conversation']);
        $sender = $message->sender;
        $conversation = $message->conversation;

        if (
            (! $sender instanceof Customer && ! $sender instanceof User)
            || $sender->getKey() === null
            || ! $conversation instanceof Conversation
        ) {
            throw new LogicException('A message sender must be a customer or staff user.');
        }

        $this->senderPayload = [
            'id' => $sender->getKey(),
            'name' => $sender->name,
            'avatar' => $sender->getAttribute('avatar'),
            'type' => $sender instanceof Customer ? 'customer' : 'staff',
        ];
        $this->branchId = (int) $conversation->branch_id;
        $this->tenantId = (int) $conversation->tenant_id;
        $this->unreadStaff = (int) $conversation->unread_staff;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversation.'.$this->message->conversation_id),
            new PrivateChannel('branch.'.$this->branchId.'.inbox'),
            new PrivateChannel('tenant.'.$this->tenantId.'.inbox'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'type' => $this->message->type,
            'body' => $this->message->body,
            'file_url' => $this->message->file_url,
            'file_name' => $this->message->file_name,
            'file_size' => $this->message->file_size,
            'is_read' => $this->message->is_read,
            'created_at' => $this->message->created_at?->toISOString(),
            'sender' => $this->senderPayload,
            'branch_id' => $this->branchId,
            'tenant_id' => $this->tenantId,
            'unread_staff' => $this->unreadStaff,
        ];
    }
}
