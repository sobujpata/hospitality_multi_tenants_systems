<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['tenant_id', 'branch_id', 'employee_id', 'attendance_date', 'clocked_in_at', 'clocked_out_at', 'method', 'is_late', 'notes'])]
class AttendanceRecord extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', fn (Builder $builder) => $builder->where('tenant_id', Tenant::current()?->getKey()));
    }

    protected function casts(): array
    {
        return ['attendance_date' => 'date', 'clocked_in_at' => 'datetime', 'clocked_out_at' => 'datetime', 'is_late' => 'boolean'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
