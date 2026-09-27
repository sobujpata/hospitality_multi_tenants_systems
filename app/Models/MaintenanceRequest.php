<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['tenant_id', 'branch_id', 'unit_id', 'reported_by', 'assigned_to', 'title', 'description', 'priority', 'status', 'resolved_at'])]
class MaintenanceRequest extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', fn (Builder $builder) => $builder->where('tenant_id', Tenant::current()?->getKey()));
    }

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'reported_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'assigned_to');
    }
}
