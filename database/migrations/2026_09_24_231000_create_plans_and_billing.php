<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('stripe_price_id')->nullable()->unique();
            $table->decimal('monthly_price', 10, 2);
            $table->unsignedInteger('branch_limit')->nullable();
            $table->unsignedInteger('staff_limit')->nullable();
            $table->unsignedInteger('room_limit')->nullable();
            $table->boolean('white_label')->default(false);
            $table->boolean('api_access')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('tenants', function (Blueprint $table): void {
            $table->foreignId('plan_id')->nullable()->after('id')->constrained('plans')->nullOnDelete();
            $table->string('stripe_id')->nullable()->index();
            $table->string('pm_type')->nullable();
            $table->string('pm_last_four', 4)->nullable();
        });

        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->renameColumn('user_id', 'tenant_id');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table): void {
            $table->renameColumn('tenant_id', 'user_id');
        });
        Schema::table('tenants', function (Blueprint $table): void {
            $table->dropForeign(['plan_id']);
            $table->dropColumn(['plan_id', 'stripe_id', 'pm_type', 'pm_last_four']);
        });
        Schema::dropIfExists('plans');
    }
};
