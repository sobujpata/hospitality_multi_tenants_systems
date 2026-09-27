<?php

namespace App\Support;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;

trait BranchScope
{
    protected static function bootBranchScope(): void
    {
        static::addGlobalScope('branch', function (Builder $builder): void {
            $tenant = Tenant::current();

            $builder->where(
                $builder->getModel()->qualifyColumn('tenant_id'),
                $tenant?->getKey(),
            );

            $branchId = session('branch_id');

            if ($branchId !== null) {
                $builder->where(
                    $builder->getModel()->qualifyColumn('branch_id'),
                    $branchId,
                );
            }
        });
    }

    public static function withoutBranchScope(): Builder
    {
        return static::withoutGlobalScope('branch');
    }
}
