<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['tenant_id', 'unit_id', 'starts_on', 'ends_on', 'reason'])]
class UnitBlock extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', fn (Builder $builder) => $builder->where('tenant_id', Tenant::current()?->getKey()));
    }

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date'];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }
}
