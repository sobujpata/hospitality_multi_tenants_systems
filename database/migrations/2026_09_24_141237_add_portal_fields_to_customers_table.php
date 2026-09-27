<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('password')->nullable();
            $table->string('oauth_provider')->nullable();
            $table->string('oauth_id')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->unique(['oauth_provider', 'oauth_id']);
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropUnique(['oauth_provider', 'oauth_id']);
            $table->dropColumn(['password', 'oauth_provider', 'oauth_id', 'email_verified_at']);
        });
    }
};
