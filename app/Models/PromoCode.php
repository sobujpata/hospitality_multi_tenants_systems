<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['tenant_id', 'code', 'discount_type', 'discount_value', 'usage_limit', 'usage_count', 'starts_on', 'ends_on', 'is_active'])]
class PromoCode extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', fn (Builder $builder) => $builder->where('tenant_id', Tenant::current()?->getKey()));
    }

    protected function casts(): array
    {
        return ['discount_value' => 'decimal:2', 'starts_on' => 'date', 'ends_on' => 'date', 'is_active' => 'boolean'];
    }
}
