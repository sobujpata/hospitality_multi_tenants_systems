<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Tenant;
use App\Models\Unit;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class DashboardStatsService
{
    /** @return array<string, mixed> */
    public function get(Carbon $start, Carbon $end): array
    {
        $tenantId = (int) Tenant::current()->getKey();
        $key = "dashboard:{$tenantId}:{$start->toDateString()}:{$end->toDateString()}";

        // Use the configured cache store so local environments without the
        // PhpRedis extension can still load the dashboard.
        return Cache::store(config('cache.default'))->remember($key, now()->addMinutes(15), fn (): array => $this->calculate($start, $end));
    }

    /** @return array<string, mixed> */
    public function calculate(Carbon $start, Carbon $end): array
    {
        $units = Unit::query()->where('unit_type', 'room')->get(['id', 'branch_id', 'status']);
        $totalRooms = $units->count();
        $occupiedRooms = $units->where('status', 'occupied')->count();
        $bookings = Booking::query()
            ->with(['customer:id,name,email', 'branch:id,name'])
            ->where('check_in', '<', $end->toDateString())
            ->where('check_out', '>=', $start->toDateString())
            ->whereNotIn('status', ['cancelled', 'no_show'])
            ->get();
        $revenue = (float) $bookings->sum('total_amount');
        $nights = max(1, $start->diffInDays($end));
        $availableRoomNights = max(1, $totalRooms * $nights);
        $occupiedRoomNights = $bookings->sum(fn (Booking $booking): int => max(1, max($start->timestamp, $booking->check_in->timestamp) < min($end->timestamp, $booking->check_out->timestamp) ? Carbon::createFromTimestamp(min($end->timestamp, $booking->check_out->timestamp))->diffInDays(Carbon::createFromTimestamp(max($start->timestamp, $booking->check_in->timestamp))) : 0));

        return [
            'range' => ['start' => $start->toDateString(), 'end' => $end->toDateString()],
            'occupancy' => ['today' => $totalRooms ? round($occupiedRooms / $totalRooms * 100, 1) : 0, 'range' => round($occupiedRoomNights / $availableRoomNights * 100, 1), 'occupied' => $occupiedRooms, 'total' => $totalRooms],
            'revenue' => ['daily' => round((float) Booking::query()->whereDate('check_in', today())->whereNotIn('status', ['cancelled', 'no_show'])->sum('total_amount'), 2), 'monthly' => round((float) Booking::query()->whereBetween('check_in', [now()->startOfMonth(), now()->endOfMonth()])->whereNotIn('status', ['cancelled', 'no_show'])->sum('total_amount'), 2), 'ytd' => round((float) Booking::query()->whereYear('check_in', now()->year)->whereNotIn('status', ['cancelled', 'no_show'])->sum('total_amount'), 2), 'range' => round($revenue, 2)],
            'revpar' => round($revenue / $availableRoomNights, 2),
            'adr' => round($occupiedRoomNights ? $revenue / $occupiedRoomNights : 0, 2),
            'arrivals' => Booking::query()->with(['branch:id,name', 'unit:id,number'])->whereBetween('check_in', [$start->toDateString(), $end->toDateString()])->whereNotIn('status', ['cancelled', 'no_show'])->orderBy('check_in')->get(['id', 'booking_ref', 'check_in', 'customer_id', 'branch_id', 'unit_id'])->all(),
            'departures' => Booking::query()->with(['branch:id,name', 'unit:id,number'])->whereBetween('check_out', [$start->toDateString(), $end->toDateString()])->whereNotIn('status', ['cancelled', 'no_show'])->orderBy('check_out')->get(['id', 'booking_ref', 'check_out', 'customer_id', 'branch_id', 'unit_id'])->all(),
            'topCustomers' => $bookings->groupBy('customer_id')->map(fn ($items): array => ['name' => $items->first()->customer?->name ?? 'Guest', 'email' => $items->first()->customer?->email, 'spent' => round((float) $items->sum('total_amount'), 2)])->sortByDesc('spent')->values()->take(10)->all(),
            'occupancyTrend' => $this->dailyTrend($start, $end, $totalRooms),
            'revenueByBranch' => $bookings->groupBy(fn (Booking $booking) => $booking->branch?->name ?? 'Unknown')->map(fn ($items, $branch): array => ['branch' => $branch, 'revenue' => round((float) $items->sum('total_amount'), 2)])->values()->all(),
            'bookingSources' => $bookings->groupBy(fn (Booking $booking) => $booking->source ?: 'unknown')->map(fn ($items, $source): array => ['source' => $source, 'bookings' => $items->count()])->values()->all(),
            'monthlyComparison' => $this->monthlyComparison(),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function dailyTrend(Carbon $start, Carbon $end, int $rooms): array
    {
        return collect(range(0, max(0, $start->diffInDays($end) - 1)))->map(function (int $offset) use ($start, $rooms): array {
            $date = $start->copy()->addDays($offset);
            $occupied = Booking::query()->where('check_in', '<=', $date->toDateString())->where('check_out', '>', $date->toDateString())->whereNotIn('status', ['cancelled', 'no_show'])->count();

            return ['date' => $date->format('M j'), 'occupancy' => $rooms ? round($occupied / $rooms * 100, 1) : 0];
        })->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function monthlyComparison(): array
    {
        return collect(range(5, 0))->map(function (int $months): array {
            $date = now()->subMonths($months);

            return ['month' => $date->format('M Y'), 'revenue' => round((float) Booking::query()->whereYear('check_in', $date->year)->whereMonth('check_in', $date->month)->whereNotIn('status', ['cancelled', 'no_show'])->sum('total_amount'), 2)];
        })->all();
    }
}
