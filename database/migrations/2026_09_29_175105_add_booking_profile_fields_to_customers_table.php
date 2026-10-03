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
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('arrived_from')->nullable();
            $table->string('occupation')->nullable();
            $table->string('organization')->nullable();
            $table->string('purpose_of_visit')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropColumn([
                'arrived_from',
                'occupation',
                'organization',
                'purpose_of_visit',
            ]);
        });
    }
};
