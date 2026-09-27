<?php

namespace App\Services;

use App\Models\PromoCode;
use App\Models\SeasonalPricingRule;
use App\Models\Unit;
use Carbon\CarbonPeriod;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class PriceCalculator
{
    /**
     * @param  array<int, array{price?: float|int, quantity?: int}>  $extras
     * @return array{nights: int, base: float, seasonal: float, extras: float, discount: float, total: float, currency: string}
     */
    public function calculate(int $unitId, string $checkIn, string $checkOut, ?string $promoCode = null, array $extras = []): array
    {
        $unit = Unit::query()->findOrFail($unitId);
        $start = Carbon::parse($checkIn)->startOfDay();
        $end = Carbon::parse($checkOut)->startOfDay();
        if ($end->lessThanOrEqualTo($start)) {
            throw ValidationException::withMessages(['check_out' => 'Check-out must be after check-in.']);
        }

        $rules = SeasonalPricingRule::query()
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('unit_id')->orWhere('unit_id', $unit->id))
            ->where(fn ($query) => $query->whereNull('branch_id')->orWhere('branch_id', $unit->branch_id))
            ->get();

        $base = 0.0;
        $seasonal = 0.0;
        foreach (CarbonPeriod::create($start, $end->copy()->subDay()) as $date) {
            $nightly = $date->isWeekend() && $unit->price_weekend !== null
                ? (float) $unit->price_weekend
                : (float) $unit->base_price;
            $rule = $rules->first(fn (SeasonalPricingRule $item): bool => $date->betweenIncluded($item->starts_on, $item->ends_on));
            $base += $nightly;
            $seasonal += $nightly * ($rule ? (float) $rule->multiplier : 1);
        }

        $extrasTotal = collect($extras)->sum(fn (array $extra): float => (float) ($extra['price'] ?? 0) * max(1, (int) ($extra['quantity'] ?? 1)));
        $subtotal = $seasonal + $extrasTotal;
        $discount = 0.0;
        if ($promoCode) {
            $promo = PromoCode::query()->whereRaw('LOWER(code) = ?', [strtolower($promoCode)])->first();
            if ($promo && $promo->is_active && (! $promo->usage_limit || $promo->usage_count < $promo->usage_limit)
                && (! $promo->starts_on || $start->greaterThanOrEqualTo($promo->starts_on))
                && (! $promo->ends_on || $start->lessThanOrEqualTo($promo->ends_on))) {
                $discount = $promo->discount_type === 'percentage'
                    ? $subtotal * min(100, (float) $promo->discount_value) / 100
                    : min($subtotal, (float) $promo->discount_value);
            }
        }

        return [
            'nights' => $start->diffInDays($end),
            'base' => round($base, 2),
            'seasonal' => round($seasonal, 2),
            'extras' => round($extrasTotal, 2),
            'discount' => round($discount, 2),
            'total' => round(max(0, $subtotal - $discount), 2),
            'currency' => $unit->branch?->currency ?? 'USD',
        ];
    }

    public function consumePromoCode(?string $code, Carbon $date): void
    {
        if (! $code) {
            return;
        }

        $promo = PromoCode::query()
            ->whereRaw('LOWER(code) = ?', [strtolower($code)])
            ->lockForUpdate()
            ->first();

        if ($promo && $promo->is_active
            && (! $promo->usage_limit || $promo->usage_count < $promo->usage_limit)
            && (! $promo->starts_on || $date->greaterThanOrEqualTo($promo->starts_on))
            && (! $promo->ends_on || $date->lessThanOrEqualTo($promo->ends_on))) {
            $promo->increment('usage_count');
        }
    }
}
