<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['tenant_id', 'name', 'unit_type', 'description'])]
class UnitCategory extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', function (Builder $builder): void {
            $builder->where($builder->getModel()->qualifyColumn('tenant_id'), Tenant::current()?->getKey());
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }
}
