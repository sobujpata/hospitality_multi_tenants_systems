<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('branches')->cascadeOnDelete();
            $table->enum('unit_type', ['room', 'table', 'villa', 'desk']);
            $table->string('number');
            $table->string('name');
            $table->string('floor')->nullable();
            $table->unsignedInteger('capacity')->default(1);
            $table->decimal('base_price', 12, 2)->default(0);
            $table->decimal('price_weekend', 12, 2)->nullable();
            $table->json('amenities')->nullable();
            $table->json('images')->nullable();
            $table->enum('status', ['available', 'occupied', 'maintenance', 'reserved'])->default('available');
            $table->foreignId('unit_category_id')->nullable()->constrained('unit_categories')->nullOnDelete();
            $table->timestamps();
            $table->index(['tenant_id', 'branch_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('units');
    }
};
