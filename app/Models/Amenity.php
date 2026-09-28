<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['tenant_id', 'name'])]
class Amenity extends Model
{
    protected $table = 'amenities';

    protected $fillable = [
        'tenant_id', 
        'branch_id',
        'name', 
        'icon_type', 
        'icon_value', 
        'category', 
        'color', 
        'is_active', 
        'sort_order'
        ];

    protected static function booted(): void
    {
        static::addGlobalScope('tenant', function (Builder $builder): void {
            $builder->where(
                $builder->getModel()->qualifyColumn('tenant_id'),
                Tenant::current()?->getKey(),
            );
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
