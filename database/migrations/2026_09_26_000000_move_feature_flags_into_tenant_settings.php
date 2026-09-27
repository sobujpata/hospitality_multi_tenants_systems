<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('feature_flags')
            ->orderBy('id')
            ->get(['tenant_id', 'key', 'enabled'])
            ->groupBy('tenant_id')
            ->each(function ($flags, int $tenantId): void {
                $tenant = DB::table('tenants')->where('id', $tenantId)->first(['settings']);

                if ($tenant === null) {
                    return;
                }

                $settings = json_decode($tenant->settings ?? '{}', true) ?: [];
                $settings['features'] = [
                    ...($settings['features'] ?? []),
                    ...$flags->mapWithKeys(fn (object $flag): array => [
                        $flag->key => (bool) $flag->enabled,
                    ])->all(),
                ];

                DB::table('tenants')->where('id', $tenantId)->update([
                    'settings' => json_encode($settings),
                ]);
            });
    }

    public function down(): void
    {
        // Feature flags are preserved in tenant settings and are not removed.
    }
};
