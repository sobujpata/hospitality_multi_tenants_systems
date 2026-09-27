<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('nationality')->nullable();
            $table->enum('id_type', ['passport', 'nid', 'driving_license'])->nullable();
            $table->string('id_number')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('gender')->nullable();
            $table->json('address')->nullable();
            $table->json('tags')->nullable();
            $table->unsignedInteger('loyalty_points')->default(0);
            $table->enum('vip_level', ['standard', 'silver', 'gold', 'platinum'])->default('standard');
            $table->text('notes')->nullable();
            $table->enum('source', ['walk-in', 'booking.com', 'website', 'phone'])->default('walk-in');
            $table->boolean('blacklisted')->default(false);
            $table->text('blacklist_reason')->nullable();
            $table->json('documents')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'email']);
            $table->fullText(['name', 'email', 'phone']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
