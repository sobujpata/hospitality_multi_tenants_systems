<?php

use App\Models\Conversation;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, int $id): bool {
    return (int) $user->id === $id;
});

Broadcast::channel('branch.{branchId}.inbox', function (User $user, int $branchId): bool {
    return (int) $user->branch_id === $branchId
        && $user->hasAnyRole(['Tenant Admin', 'Tenant Owner', 'Branch Manager', 'Receptionist']);
});

Broadcast::channel('tenant.{tenantId}.inbox', function (User $user, int $tenantId): bool {
    return (int) $user->tenant_id === $tenantId
        && $user->hasAnyRole(['Tenant Admin', 'Tenant Owner', 'Branch Manager']);
});

Broadcast::channel('conversation.{conversationId}', function (Customer|User $user, int $conversationId): bool {
    $conversation = Conversation::query()
        ->when(
            $user->tenant_id !== null,
            fn ($query) => $query->where('tenant_id', $user->tenant_id),
        )
        ->find($conversationId);

    if ($conversation === null) {
        return false;
    }

    if ($user instanceof Customer) {
        return (int) $conversation->customer_id === (int) $user->id;
    }

    return (int) $user->branch_id === (int) $conversation->branch_id
        || $user->hasRole(['Tenant Admin', 'Tenant Owner', 'Branch Manager']);
});
