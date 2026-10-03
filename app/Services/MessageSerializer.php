<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Message;

class MessageSerializer
{
    /**
     * @return array<string, mixed>
     */
    public function serialize(Message $message): array
    {
        $message->loadMissing('sender');
        $sender = $message->sender;

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'type' => $message->type,
            'body' => $message->body,
            'file_url' => $message->file_url,
            'file_name' => $message->file_name,
            'file_size' => $message->file_size,
            'is_read' => $message->is_read,
            'created_at' => $message->created_at?->toISOString(),
            'sender' => [
                'id' => $sender?->getKey(),
                'name' => $sender?->name ?? 'User',
                'avatar' => $sender?->getAttribute('avatar'),
                'type' => $sender instanceof Customer ? 'customer' : 'staff',
            ],
        ];
    }
}
