<?php

namespace App\Http\Controllers;

use App\Events\UserTyping;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\User;
use App\Services\ConversationMessageService;
use App\Services\MessageSerializer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class MessageController extends Controller
{
    public function store(
        Request $request,
        Conversation $conversation,
        ConversationMessageService $messageService,
        MessageSerializer $messageSerializer,
    ): JsonResponse {
        Gate::authorize('participate', $conversation);

        $data = $request->validate([
            'body' => ['required_without:file', 'nullable', 'string', 'max:5000'],
            'file' => ['required_without:body', 'nullable', 'file', 'max:10240'],
            'type' => ['nullable', Rule::in(['text', 'image', 'file'])],
        ]);

        if (($data['type'] ?? null) === 'image') {
            $request->validate([
                'file' => ['required', 'image', 'max:10240'],
            ]);
        }

        $sender = $request->user();
        abort_unless($sender instanceof Customer || $sender instanceof User, 403);

        $message = $messageService->send(
            $conversation,
            $sender,
            $data['body'] ?? null,
            $request->file('file'),
            $data['type'] ?? null,
        );

        return response()->json($messageSerializer->serialize($message));
    }

    public function typing(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('participate', $conversation);

        $user = $request->user();
        abort_unless($user instanceof Customer || $user instanceof User, 403);

        $data = $request->validate([
            'is_typing' => ['required', 'boolean'],
        ]);

        broadcast(new UserTyping(
            $conversation->id,
            $user->name,
            (bool) $data['is_typing'],
        ))->toOthers();

        return response()->json(['ok' => true]);
    }
}
