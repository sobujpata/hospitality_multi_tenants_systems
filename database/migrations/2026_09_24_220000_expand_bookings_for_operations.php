<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->string('booking_ref')->nullable()->unique()->after('booking_reference');
            $table->string('type')->default('online')->after('booking_ref');
            $table->unsignedInteger('adults')->default(1)->after('check_out');
            $table->unsignedInteger('children')->default(0)->after('adults');
            $table->string('source')->nullable()->after('status');
            $table->foreignId('assigned_staff_id')->nullable()->after('source')->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->after('assigned_staff_id')->constrained('users')->nullOnDelete();
        });

        DB::table('bookings')->whereNull('booking_ref')->update([
            'booking_ref' => DB::raw('booking_reference'),
        ]);

        DB::statement("ALTER TABLE bookings MODIFY status VARCHAR(30) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table): void {
            $table->dropForeign(['assigned_staff_id']);
            $table->dropForeign(['created_by']);
            $table->dropUnique(['booking_ref']);
            $table->dropColumn([
                'booking_ref',
                'type',
                'adults',
                'children',
                'source',
                'assigned_staff_id',
                'created_by',
            ]);
        });
    }
};
