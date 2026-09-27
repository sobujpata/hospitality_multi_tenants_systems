<?php

namespace App\Models;

use App\Notifications\HospitalityNotification;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['booking_id', 'tenant_id', 'amount', 'method', 'reference', 'paid_at'])]
class FolioPayment extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', fn (Builder $builder) => $builder->where('tenant_id', Tenant::current()?->getKey()));
        static::created(function (FolioPayment $payment): void {
            $tenantId = $payment->booking?->tenant_id;
            User::withoutGlobalScopes()->where('tenant_id', $tenantId)->where('is_active', true)->get()->each(fn (User $user) => $user->notify(new HospitalityNotification('payment_received', 'Payment received', 'Payment received for booking '.$payment->booking?->booking_ref.'.', ['amount' => $payment->amount, 'booking_id' => $payment->booking_id])));
        });
    }

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'paid_at' => 'datetime'];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
