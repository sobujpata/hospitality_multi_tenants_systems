<?php

namespace App\Services;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class ConversationMessageService
{
    public function send(
        Conversation $conversation,
        Customer|User $sender,
        ?string $body,
        ?UploadedFile $file = null,
        ?string $type = null,
    ): Message {
        $filePath = $file?->store("messages/{$conversation->id}", 's3');
        if ($file !== null && $filePath === false) {
            throw new RuntimeException('Unable to store the message attachment.');
        }
        $fileUrl = $filePath === null ? null : Storage::disk('s3')->url($filePath);
        $fileName = $file?->getClientOriginalName();
        $fileSize = $file === null ? null : $this->formatBytes($file->getSize());
        $now = now();

        $message = DB::transaction(function () use (
            $conversation,
            $sender,
            $body,
            $file,
            $fileUrl,
            $fileName,
            $fileSize,
            $type,
            $now,
        ): Message {
            $message = $conversation->messages()->create([
                'tenant_id' => $conversation->tenant_id,
                'sender_type' => $sender::class,
                'sender_id' => $sender->getKey(),
                'type' => $type ?? ($file === null
                    ? 'text'
                    : (str_starts_with((string) $file->getMimeType(), 'image/') ? 'image' : 'file')),
                'body' => $body,
                'file_url' => $fileUrl,
                'file_name' => $fileName,
                'file_size' => $fileSize,
            ]);

            $conversation->update([
                'last_message_at' => $now,
                'last_message_preview' => Str::limit($body ?? $fileName ?? '', 80),
                'status' => 'active',
            ]);
            $conversation->incrementUnread($sender instanceof Customer ? 'staff' : 'customer');

            return $message;
        });

        broadcast(new MessageSent($message->load('sender')))->toOthers();

        return $message;
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes < 1024) {
            return "{$bytes} B";
        }

        $units = ['KB', 'MB', 'GB', 'TB'];
        $size = $bytes / 1024;

        foreach ($units as $unit) {
            if ($size < 1024 || $unit === 'TB') {
                return number_format($size, 1).' '.$unit;
            }

            $size /= 1024;
        }

        return number_format($size, 1).' TB';
    }
}
