<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $table->string('slug')->unique()->after('name');
            $table->string('plan')->default('trial')->after('domain');
            $table->timestamp('trial_ends_at')->nullable()->after('plan');
            $table->boolean('is_active')->default(true)->after('trial_ends_at');
        });
    }
};
