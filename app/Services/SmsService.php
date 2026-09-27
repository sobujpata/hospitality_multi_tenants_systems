<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class SmsService
{
    public function send(string $to, string $message): void
    {
        Log::info('Twilio SMS stub invoked.', ['to' => $to, 'message' => $message]);
    }
}
