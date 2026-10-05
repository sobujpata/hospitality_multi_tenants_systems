<?php

namespace App\Http\Controllers;

use App\Events\MessageRead;
use App\Models\Booking;
use App\Models\Branch;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Message;
use App\Models\User;
use App\Services\ConversationMessageService;
use App\Services\MessageSerializer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ConversationController extends Controller
{
    public function forBooking(Request $request, int $booking): JsonResponse
    {
        $customer = $request->user();
        abort_unless($customer instanceof Customer, 403);

        $booking = Booking::query()->findOrFail($booking);
        abort_unless((int) $booking->customer_id === (int) $customer->id, 404);

        $conversation = Conversation::query()
            ->with('branch:id,name,cover_image')
            ->where('booking_id', $booking->id)
            ->where('customer_id', $customer->id)
            ->first();

        return response()->json($conversation);
    }

    public function forBranch(Request $request, int $branch): JsonResponse
    {
        $customer = $request->user();
        abort_unless($customer instanceof Customer, 403);

        $branch = Branch::query()->findOrFail($branch);
        abort_unless(
            $customer->tenant_id === null
                || (int) $customer->tenant_id === (int) $branch->tenant_id,
            404,
        );

        $conversation = Conversation::query()
            ->where('branch_id', $branch->id)
            ->where('customer_id', $customer->id)
            ->whereNull('booking_id')
            ->first();

        return response()->json($conversation);
    }

    public function inbox(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);
        abort_unless($user->hasRole(['Tenant Admin', 'Tenant Owner', 'Branch Manager', 'Receptionist']), 403);

        return Inertia::render('messaging/StaffInbox', [
            'staff' => User::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'avatar', 'branch_id']),
            'currentStaffId' => $user->id,
        ]);
    }

    public function index(Request $request, MessageSerializer $messageSerializer): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        $canViewAllBranches = $user->hasRole(['Tenant Admin', 'Tenant Owner', 'Branch Manager']);
        abort_unless($user->branch_id !== null || $canViewAllBranches, 403);

        $conversations = Conversation::query()
            ->with([
                'customer:id,name,email',
                'latestMessage.sender',
                'booking:id,booking_ref',
                'branch:id,name',
                'assignedStaff:id,name,avatar',
            ])
            ->when(
                $user->branch_id !== null && ! $canViewAllBranches,
                fn ($query) => $query->where('branch_id', $user->branch_id),
            )
            ->orderByDesc('last_message_at')
            ->paginate(20)
            ->through(fn (Conversation $conversation): array => [
                'id' => $conversation->id,
                'status' => $conversation->status,
                'unread_staff' => $conversation->unread_staff,
                'unread_customer' => $conversation->unread_customer,
                'last_message_at' => $conversation->last_message_at?->toISOString(),
                'last_message_preview' => $conversation->last_message_preview,
                'customer' => [
                    'id' => $conversation->customer?->id,
                    'name' => $conversation->customer?->name ?? 'Customer',
                    'avatar' => $conversation->customer?->getAttribute('avatar'),
                ],
                'booking' => [
                    'id' => $conversation->booking?->id,
                    'booking_ref' => $conversation->booking?->booking_ref,
                ],
                'branch' => [
                    'id' => $conversation->branch?->id,
                    'name' => $conversation->branch?->name ?? '',
                ],
                'assigned_staff' => $conversation->assignedStaff === null ? null : [
                    'id' => $conversation->assignedStaff->id,
                    'name' => $conversation->assignedStaff->name,
                    'avatar' => $conversation->assignedStaff->avatar,
                ],
                'latest_message' => $conversation->latestMessage === null
                    ? null
                    : $messageSerializer->serialize($conversation->latestMessage),
            ]);

        return response()->json($conversations);
    }

    public function update(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('update', $conversation);

        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['open', 'active', 'resolved'])],
            'assigned_staff_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('users', 'id')
                    ->where('tenant_id', $conversation->tenant_id)
                    ->where('branch_id', $conversation->branch_id),
            ],
        ]);

        if (array_key_exists('assigned_staff_id', $data) && $data['assigned_staff_id'] !== null) {
            $assignee = User::query()->findOrFail($data['assigned_staff_id']);
            abort_unless((int) $assignee->branch_id === (int) $conversation->branch_id, 422);
        }

        $conversation->update($data);

        return response()->json([
            'id' => $conversation->id,
            'status' => $conversation->status,
            'assigned_staff_id' => $conversation->assigned_staff_id,
        ]);
    }

    public function store(Request $request, ConversationMessageService $messageService): JsonResponse
    {
        $customer = $request->user();
        abort_unless($customer instanceof Customer, 403);

        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'booking_id' => ['nullable', 'integer', 'exists:bookings,id'],
            'body' => ['required_without:file', 'nullable', 'string', 'max:5000'],
            'file' => ['required_without:body', 'nullable', 'file', 'max:10240'],
            'type' => ['nullable', Rule::in(['text', 'image', 'file'])],
        ]);

        $branch = Branch::query()->findOrFail($data['branch_id']);
        $booking = isset($data['booking_id'])
            ? Booking::query()->findOrFail($data['booking_id'])
            : null;

        if ($booking !== null) {
            abort_unless(
                (int) $booking->customer_id === (int) $customer->id
                    && (int) $booking->branch_id === (int) $branch->id
                    && (int) $booking->tenant_id === (int) $branch->tenant_id,
                403,
            );
        }
        abort_unless(
            $customer->tenant_id === null
                || (int) $customer->tenant_id === (int) $branch->tenant_id,
            404,
        );

        if (($data['type'] ?? null) === 'image') {
            $request->validate(['file' => ['required', 'image', 'max:10240']]);
        }

        $conversation = Conversation::query()
            ->where('customer_id', $customer->id)
            ->where('branch_id', $branch->id)
            ->when(
                $booking === null,
                fn ($query) => $query->whereNull('booking_id'),
                fn ($query) => $query->where('booking_id', $booking->id),
            )
            ->whereIn('status', ['open', 'active'])
            ->first();

        if ($conversation === null) {
            $conversation = Conversation::query()->create([
                'tenant_id' => $branch->tenant_id,
                'branch_id' => $branch->id,
                'booking_id' => $booking?->id,
                'customer_id' => $customer->id,
                'status' => 'open',
            ]);
        }

        Gate::authorize('participate', $conversation);

        $message = $messageService->send(
            $conversation,
            $customer,
            $data['body'] ?? null,
            $request->file('file'),
            $data['type'] ?? null,
        );

        return response()->json([
            'conversation' => $conversation->load(['branch:id,name,cover_image']),
            'message' => app(MessageSerializer::class)->serialize($message),
        ], 201);
    }

    public function messages(
        Request $request,
        Conversation $conversation,
        MessageSerializer $messageSerializer,
    ): JsonResponse {
        Gate::authorize('view', $conversation);

        $user = $request->user();
        abort_unless($user instanceof Customer || $user instanceof User, 403);

        $otherSenderType = $user instanceof Customer ? User::class : Customer::class;
        $readerType = $user instanceof Customer ? 'customer' : 'staff';

        $conversation->messages()
            ->where('sender_type', $otherSenderType)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        $conversation->resetUnread($readerType);

        broadcast(new MessageRead(
            (int) $conversation->id,
            $readerType,
            (int) $conversation->branch_id,
            (int) $conversation->tenant_id,
            (int) $conversation->unread_staff,
        ))->toOthers();

        $messages = $conversation->messages()
            ->with('sender')
            ->get()
            ->map(fn (Message $message): array => $messageSerializer->serialize($message));

        return response()->json($messages);
    }
}
