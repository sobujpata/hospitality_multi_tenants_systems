<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'tenant_id',
    'name',
    'type',
    'address',
    'city',
    'country',
    'phone',
    'email',
    'timezone',
    'currency',
    'star_rating',
    'cover_image',
    'amenities',
    'latitude',
    'longitude',
    'google_place_id',
    'google_maps_url',
    'google_embed_url',
    'map_zoom_level',
    'map_marker_color',
    'is_active',
    'settings',
])]
class Branch extends Model
{
    protected static function booted(): void
    {
        static::addGlobalScope('tenant', function (Builder $builder): void {
            $builder->where(
                $builder->getModel()->qualifyColumn('tenant_id'),
                Tenant::current()?->getKey(),
            );
        });
    }

    protected function casts(): array
    {
        return [
            'amenities' => 'array',
            'settings' => 'array',
            'is_active' => 'boolean',
            'star_rating' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    // Auto-build Google Maps URL from coordinates
    public function getGoogleMapsUrlAttribute(): string
    {
        if ($this->latitude && $this->longitude) {
            return "https://maps.google.com/?q={$this->latitude},{$this->longitude}";
        }

        return $this->attributes['google_maps_url'] ?? '#';
    }

    // Check if map coordinates are set
    public function hasCoordinates(): bool
    {
        return ! is_null($this->latitude) && ! is_null($this->longitude);
    }
}
