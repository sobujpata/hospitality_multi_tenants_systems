<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'tenant_id',
    'name',
    'type',
    'address',
    'city',
    'country',
    'phone',
    'email',
    'timezone',
    'currency',
    'star_rating',
    'cover_image',
    'amenities',
    'is_active',
    'settings',
])]
class Branch extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', function (Builder $builder): void {
            $builder->where(
                $builder->getModel()->qualifyColumn('tenant_id'),
                Tenant::current()?->getKey(),
            );
        });
    }

    protected function casts(): array
    {
        return [
            'amenities' => 'array',
            'settings' => 'array',
            'is_active' => 'boolean',
            'star_rating' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
