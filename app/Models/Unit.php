<?php

namespace App\Models;

use App\Support\BranchScope;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'tenant_id', 'branch_id', 'unit_type', 'number', 'name', 'floor', 'capacity',
    'base_price', 'price_weekend', 'amenities', 'images', 'status', 'unit_category_id',
])]
class Unit extends Model
{
    use BranchScope;

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'base_price' => 'decimal:2',
            'price_weekend' => 'decimal:2',
            'amenities' => 'array',
            'images' => 'array',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(UnitCategory::class, 'unit_category_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function roomBookings(): BelongsToMany
    {
        return $this->belongsToMany(Booking::class, 'booking_rooms')->withTimestamps();
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(UnitBlock::class);
    }
}
