<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'stripe_price_id', 'monthly_price', 'branch_limit', 'staff_limit', 'room_limit', 'white_label', 'api_access', 'is_active'])]
class Plan extends Model
{
    protected function casts(): array
    {
        return [
            'monthly_price' => 'decimal:2',
            'branch_limit' => 'integer',
            'staff_limit' => 'integer',
            'room_limit' => 'integer',
            'white_label' => 'boolean',
            'api_access' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function tenants(): HasMany
    {
        return $this->hasMany(Tenant::class);
    }
}
