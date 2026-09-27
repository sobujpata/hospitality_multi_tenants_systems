<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Cashier\Billable;
use Spatie\Multitenancy\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant
{
    use Billable;
    use Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'logo',
        'slug',
        'domain',
        'plan',
        'trial_ends_at',
        'is_active',
        'database',
        'plan_id',
        'stripe_id',
        'pm_type',
        'pm_last_four',
        'settings',
        'custom_domain',
        'primary_color',
        'secondary_color',
        'language',
        'timezone',
        'currency',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'is_active' => 'boolean',
            'settings' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Tenant $tenant): void {
            $tenant->trial_ends_at ??= now()->addDays(14);
            $tenant->plan_id ??= Plan::query()->where('slug', 'starter')->value('id');
        });
        static::created(function (Tenant $tenant): void {
            foreach ([
                ['key' => 'booking_confirmation', 'subject' => 'Booking confirmation {{ booking_ref }}', 'markdown' => '# Booking confirmed\n\nHello {{ customer_name }}, your booking **{{ booking_ref }}** is confirmed.\n\nCheck-in: {{ check_in }}\nCheck-out: {{ check_out }}'],
                ['key' => 'invoice', 'subject' => 'Invoice {{ invoice_number }}', 'markdown' => '# Your invoice\n\nHello {{ customer_name }}, your invoice **{{ invoice_number }}** is ready.\n\nTotal: {{ total }}'],
            ] as $template) {
                $tenant->emailTemplates()->create($template);
            }
        });
    }

    public function planRelation(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function featureFlags(): HasMany
    {
        return $this->hasMany(FeatureFlag::class);
    }

    public function emailTemplates(): HasMany
    {
        return $this->hasMany(TenantEmailTemplate::class);
    }

    public function integrations(): HasMany
    {
        return $this->hasMany(TenantIntegration::class);
    }

    public function featureEnabled(string $key): bool
    {
        return (bool) data_get($this->settings, "features.{$key}", false);
    }

    public function hasBillingAccess(): bool
    {
        return $this->onGenericTrial() || $this->subscribed('default');
    }

    public function brandSettings(): array
    {
        return [
            'name' => $this->name,
            'logo' => $this->logo ? Storage::disk('s3')->url($this->logo) : null,
            'primaryColor' => $this->primary_color ?: '#0f766e',
            'secondaryColor' => $this->secondary_color ?: '#d97706',
            'customDomain' => $this->custom_domain,
            'whiteLabel' => $this->planRelation?->white_label === true,
        ];
    }
}
