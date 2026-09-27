<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable([
    'tenant_id', 'name', 'email', 'phone', 'nationality', 'id_type', 'id_number',
    'date_of_birth', 'gender', 'address', 'tags', 'loyalty_points', 'vip_level',
    'notes', 'source', 'blacklisted', 'blacklist_reason', 'documents',
    'password', 'oauth_provider', 'oauth_id', 'email_verified_at',
])]
class Customer extends Authenticatable
{
    use Notifiable;

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'address' => 'array',
            'tags' => 'array',
            'documents' => 'array',
            'loyalty_points' => 'integer',
            'blacklisted' => 'boolean',
            'password' => 'hashed',
            'email_verified_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
