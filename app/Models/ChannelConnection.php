<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['tenant_id', 'branch_id', 'channel', 'name', 'status', 'webhook_token', 'credentials', 'last_synced_at'])]
class ChannelConnection extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', fn (Builder $builder) => $builder->where('tenant_id', Tenant::current()?->getKey()));
        static::creating(fn (ChannelConnection $connection) => $connection->webhook_token ??= Str::random(48));
    }

    protected function casts(): array
    {
        return ['credentials' => 'encrypted:array', 'last_synced_at' => 'datetime'];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
