<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $table->json('settings')->nullable()->after('database');
            $table->string('custom_domain')->nullable()->unique()->after('domain');
            $table->string('primary_color', 20)->nullable();
            $table->string('secondary_color', 20)->nullable();
            $table->string('language', 10)->default('en');
            $table->string('timezone', 100)->default('UTC');
            $table->string('currency', 3)->default('USD');
        });

        Schema::create('tenant_email_templates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('key');
            $table->string('subject');
            $table->longText('markdown');
            $table->timestamps();
            $table->unique(['tenant_id', 'key']);
        });

        Schema::create('tenant_integrations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('api_key')->nullable();
            $table->string('webhook_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_integrations');
        Schema::dropIfExists('tenant_email_templates');
        Schema::table('tenants', function (Blueprint $table): void {
            $table->dropUnique(['custom_domain']);
            $table->dropColumn(['settings', 'custom_domain', 'primary_color', 'secondary_color', 'language', 'timezone', 'currency']);
        });
    }
};
