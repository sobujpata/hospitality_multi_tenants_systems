<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\Customer;
use App\Models\User;

class ConversationPolicy
{
    public function view(Customer|User $user, Conversation $conversation): bool
    {
        if ($user->tenant_id !== null && (int) $user->tenant_id !== (int) $conversation->tenant_id) {
            return false;
        }

        if ($user instanceof Customer) {
            return (int) $conversation->customer_id === (int) $user->id;
        }

        return $this->staffCanAccess($user, $conversation);
    }

    public function participate(Customer|User $user, Conversation $conversation): bool
    {
        return $this->view($user, $conversation);
    }

    public function update(User $user, Conversation $conversation): bool
    {
        return (int) $user->tenant_id === (int) $conversation->tenant_id
            && $this->staffCanAccess($user, $conversation);
    }

    private function staffCanAccess(User $user, Conversation $conversation): bool
    {
        return (int) $user->branch_id === (int) $conversation->branch_id
            || $user->hasRole(['Tenant Admin', 'Tenant Owner', 'Branch Manager']);
    }
}
