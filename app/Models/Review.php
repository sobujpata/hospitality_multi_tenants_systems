<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'tenant_id',
    'customer_id',
    'booking_id',
    'branch_id',
    'rating',
    'cleanliness',
    'service',
    'location',
    'value',
    'title',
    'comment',
    'reviewed_at',
    'status',
    'is_published',
])]
class Review extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', fn (Builder $builder) => $builder->where($builder->getModel()->qualifyColumn('tenant_id'), Tenant::current()?->getKey()));
    }

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'cleanliness' => 'integer',
            'service' => 'integer',
            'location' => 'integer',
            'value' => 'integer',
            'reviewed_at' => 'datetime',
            'is_published' => 'boolean',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function getAverageSubRatingAttribute(): float
    {
        $fields = [
            $this->getAttribute('cleanliness'),
            $this->getAttribute('service'),
            $this->getAttribute('location'),
            $this->getAttribute('value'),
        ];
        $filled = array_filter($fields, static fn (mixed $rating): bool => $rating !== null && $rating !== '');

        return $filled === []
            ? (float) $this->rating
            : round(array_sum($filled) / count($filled), 1);
    }
}
