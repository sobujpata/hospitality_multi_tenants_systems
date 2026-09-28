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
        Schema::table('branches', function (Blueprint $table) {
            $table->string('latitude')->nullable()->after('amenities');
            $table->string('longitude')->nullable()->after('latitude');
            // ─── Google Maps Specific ───────────────────────────────────────
            $table->string('google_place_id')->nullable()->after('longitude');
            // e.g. ChIJN1t_tDeuEmsRUsoyG83frY4

            $table->string('google_maps_url')->nullable()->after('google_place_id');
            // e.g. https://maps.google.com/?q=23.796,90.412

            $table->string('google_embed_url')->nullable()->after('google_maps_url');
            // e.g. https://www.google.com/maps/embed?pb=!1m18...
            // ─── Map Display Settings ───────────────────────────────────────
            $table->tinyInteger('map_zoom_level')->default(15)->after('google_embed_url');
            // 1–20 (15 = street level, 12 = city level)

            $table->string('map_marker_color', 7)->nullable()->default('#E74C3C')->after('map_zoom_level');
            // Hex color for custom marker e.g. #E74C3C
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude']);
            $table->dropColumn(['google_place_id', 'google_maps_url', 'google_embed_url']);
            $table->dropColumn(['map_zoom_level', 'map_marker_color']);
        });
    }
};
