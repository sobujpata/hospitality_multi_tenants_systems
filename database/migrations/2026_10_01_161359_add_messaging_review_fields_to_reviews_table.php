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
        Schema::table('reviews', function (Blueprint $table): void {
            $table->foreignId('branch_id')->nullable()->after('booking_id')->constrained('branches')->nullOnDelete();
            $table->unsignedTinyInteger('cleanliness')->nullable()->after('rating');
            $table->unsignedTinyInteger('service')->nullable()->after('cleanliness');
            $table->unsignedTinyInteger('location')->nullable()->after('service');
            $table->unsignedTinyInteger('value')->nullable()->after('location');
            $table->string('title', 100)->nullable()->after('value');
            $table->timestamp('reviewed_at')->nullable()->after('comment');
            $table->string('status')->default('pending')->after('reviewed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table): void {
            $table->dropForeign(['branch_id']);
            $table->dropColumn([
                'branch_id',
                'cleanliness',
                'service',
                'location',
                'value',
                'title',
                'reviewed_at',
                'status',
            ]);
        });
    }
};
