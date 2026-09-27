<?php

namespace App\Models;

use App\Notifications\BookingConfirmationSms;
use App\Notifications\HospitalityNotification;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable([
    'tenant_id', 'customer_id', 'branch_id', 'unit_id', 'booking_ref', 'booking_reference',
    'type', 'check_in', 'check_out', 'adults', 'children', 'total_amount', 'currency',
    'status', 'source', 'special_requests', 'assigned_staff_id', 'created_by', 'qr_code',
    'review_requested_at', 'checkout_signature', 'checked_out_at',
])]
class Booking extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', fn (Builder $builder) => $builder->where($builder->getModel()->qualifyColumn('tenant_id'), Tenant::current()?->getKey()));
        static::creating(function (Booking $booking): void {
            $booking->booking_ref ??= 'BK-'.now()->format('Y').'-'.str_pad((string) random_int(1, 99999), 5, '0', STR_PAD_LEFT);
            $booking->booking_reference ??= $booking->booking_ref;
            $booking->qr_code ??= Str::uuid()->toString();
        });
        static::created(function (Booking $booking): void {
            $booking->updateQuietly([
                'booking_ref' => 'BK-'.$booking->created_at->format('Y').'-'.str_pad((string) $booking->id, 5, '0', STR_PAD_LEFT),
                'booking_reference' => 'BK-'.$booking->created_at->format('Y').'-'.str_pad((string) $booking->id, 5, '0', STR_PAD_LEFT),
            ]);
            User::withoutGlobalScopes()->where('tenant_id', $booking->tenant_id)->where('is_active', true)->get()->each(fn (User $user) => $user->notify(new HospitalityNotification('new_booking', 'New booking received', 'Booking '.$booking->booking_ref.' was created.', ['booking_id' => $booking->id])));
            if ($booking->customer) {
                $booking->customer->notify(new BookingConfirmationSms($booking));
            }
        });
        static::updated(function (Booking $booking): void {
            if ($booking->wasChanged('status') && $booking->status === 'cancelled') {
                User::withoutGlobalScopes()->where('tenant_id', $booking->tenant_id)->where('is_active', true)->get()->each(fn (User $user) => $user->notify(new HospitalityNotification('booking_cancelled', 'Booking cancelled', 'Booking '.$booking->booking_ref.' was cancelled.', ['booking_id' => $booking->id])));
            }
            if (! $booking->wasChanged('status') || $booking->status !== 'checked_out' || ! $booking->unit_id) {
                return;
            }

            $unit = $booking->unit;
            if (! $unit || $unit->unit_type !== 'room') {
                return;
            }

            Task::firstOrCreate(
                ['booking_id' => $booking->id, 'task_type' => 'housekeeping'],
                [
                    'tenant_id' => $booking->tenant_id,
                    'branch_id' => $booking->branch_id,
                    'unit_id' => $booking->unit_id,
                    'title' => 'Clean room '.$unit->number,
                    'description' => 'Prepare the room for the next guest after checkout.',
                    'priority' => 'high',
                    'due_at' => now()->addHours(2),
                    'status' => 'pending',
                    'stage' => 'to_clean',
                ],
            );
            $unit->update(['status' => 'maintenance']);
        });
    }

    protected function casts(): array
    {
        return [
            'check_in' => 'date',
            'check_out' => 'date',
            'total_amount' => 'decimal:2',
            'adults' => 'integer',
            'children' => 'integer',
            'review_requested_at' => 'datetime',
            'checked_out_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function rooms(): BelongsToMany
    {
        return $this->belongsToMany(Unit::class, 'booking_rooms')
            ->withPivot(['tenant_id', 'room_amount', 'guest_names'])
            ->withTimestamps();
    }

    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_staff_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function folioItems(): HasMany
    {
        return $this->hasMany(FolioItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(FolioPayment::class);
    }
}
