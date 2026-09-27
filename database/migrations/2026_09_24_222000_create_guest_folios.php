<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $table->string('logo')->nullable()->after('name');
        });

        Schema::table('bookings', function (Blueprint $table): void {
            $table->longText('checkout_signature')->nullable()->after('review_requested_at');
            $table->timestamp('checked_out_at')->nullable()->after('checkout_signature');
        });

        Schema::create('folio_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('description');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('tax_rate', 8, 3)->default(0);
            $table->decimal('discount', 12, 2)->default(0);
            $table->string('tax_type')->default('VAT');
            $table->string('item_type');
            $table->timestamps();
            $table->index(['booking_id', 'item_type']);
        });

        Schema::create('folio_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('method')->default('cash');
            $table->string('reference')->nullable();
            $table->timestamp('paid_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('folio_payments');
        Schema::dropIfExists('folio_items');
        Schema::table('bookings', function (Blueprint $table): void {
            $table->dropColumn(['checkout_signature', 'checked_out_at']);
        });
        Schema::table('tenants', function (Blueprint $table): void {
            $table->dropColumn('logo');
        });
    }
};
