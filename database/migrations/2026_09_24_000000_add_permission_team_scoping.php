<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tableNames = config('permission.table_names');
        $teamColumn = config('permission.column_names.team_foreign_key', 'team_id');

        foreach (['roles', 'model_has_roles', 'model_has_permissions'] as $tableName) {
            if (! Schema::hasColumn($tableNames[$tableName], $teamColumn)) {
                Schema::table($tableNames[$tableName], function (Blueprint $table) use ($teamColumn): void {
                    $table->unsignedBigInteger($teamColumn)->nullable()->index();
                });
            }
        }

        if (Schema::hasColumn($tableNames['roles'], $teamColumn)) {
            Schema::table($tableNames['roles'], function (Blueprint $table) use ($teamColumn): void {
                if (collect(Schema::getIndexes('roles'))->contains(
                    fn (array $index): bool => $index['unique']
                        && $index['columns'] === ['name', 'guard_name'],
                )) {
                    $table->dropUnique(['name', 'guard_name']);
                }
                $table->unique([$teamColumn, 'name', 'guard_name']);
            });
        }
    }

    public function down(): void
    {
        $tableNames = config('permission.table_names');
        $teamColumn = config('permission.column_names.team_foreign_key', 'team_id');

        Schema::table($tableNames['roles'], function (Blueprint $table) use ($teamColumn): void {
            if (collect(Schema::getIndexes('roles'))->contains(
                fn (array $index): bool => $index['unique']
                    && $index['columns'] === [$teamColumn, 'name', 'guard_name'],
            )) {
                $table->dropUnique([$teamColumn, 'name', 'guard_name']);
            }
            $table->unique(['name', 'guard_name']);
            $table->dropColumn($teamColumn);
        });

        foreach (['model_has_roles', 'model_has_permissions'] as $tableName) {
            Schema::table($tableNames[$tableName], function (Blueprint $table) use ($teamColumn): void {
                $table->dropColumn($teamColumn);
            });
        }
    }
};
