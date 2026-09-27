<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['tenant_id', 'branch_id', 'unit_id', 'name', 'starts_on', 'ends_on', 'multiplier', 'is_active'])]
class SeasonalPricingRule extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', fn (Builder $builder) => $builder->where('tenant_id', Tenant::current()?->getKey()));
    }

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date', 'multiplier' => 'decimal:3', 'is_active' => 'boolean'];
    }
}
