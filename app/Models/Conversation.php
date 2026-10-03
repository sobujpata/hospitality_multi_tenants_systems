<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use InvalidArgumentException;

class Conversation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'branch_id', 'booking_id', 'customer_id',
        'assigned_staff_id', 'status', 'last_message_at',
        'last_message_preview', 'unread_customer', 'unread_staff',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'unread_customer' => 'integer',
        'unread_staff' => 'integer',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope('tenant', function (Builder $query): void {
            $tenantId = auth()->user()?->tenant_id ?? Tenant::current()?->getKey();

            if ($tenantId !== null) {
                $query->where($query->getModel()->qualifyColumn('tenant_id'), $tenantId);
            }
        });
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at')->orderBy('id');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_staff_id');
    }

    public function incrementUnread(string $for): void
    {
        $column = $this->unreadColumnFor($for);
        $this->increment($column);
    }

    public function resetUnread(string $for): void
    {
        $column = $this->unreadColumnFor($for);
        $this->update([$column => 0]);
    }

    private function unreadColumnFor(string $for): string
    {
        return match ($for) {
            'customer' => 'unread_customer',
            'staff' => 'unread_staff',
            default => throw new InvalidArgumentException('Unread counters are only available for customer or staff.'),
        };
    }
}
