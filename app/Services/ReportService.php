<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Booking;
use App\Models\FolioItem;
use App\Models\FolioPayment;
use App\Models\Task;
use App\Models\Unit;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;

class ReportService
{
    /** @return array{title: string, columns: array<int, string>, rows: array<int, array<int, mixed>>, summary: array<string, mixed>} */
    public function generate(string $type, Carbon $start, Carbon $end): array
    {
        return match ($type) {
            'daily-business' => $this->dailyBusiness($start, $end),
            'occupancy' => $this->occupancy($start, $end),
            'revenue' => $this->revenue($start, $end),
            'guest' => $this->guests($start, $end),
            'staff-performance' => $this->staffPerformance($start, $end),
            'tax' => $this->tax($start, $end),
            default => throw new \InvalidArgumentException('Unknown report type.'),
        };
    }

    /** @return array{title: string, columns: array<int, string>, rows: array<int, array<int, mixed>>, summary: array<string, mixed>} */
    private function dailyBusiness(Carbon $start, Carbon $end): array
    {
        $bookings = $this->bookings($start, $end);
        $rows = [];
        foreach (CarbonPeriod::create($start, $end->copy()->subDay()) as $date) {
            $day = $date->toDateString();
            $rows[] = [$day, $bookings->where('check_in', $date)->count(), $bookings->where('check_out', $date)->count(), $bookings->where('check_in', $date)->sum('total_amount')];
        }

        return ['title' => 'Daily Business Report', 'columns' => ['Date', 'Arrivals', 'Departures', 'Revenue'], 'rows' => $rows, 'summary' => ['revenue' => $bookings->sum('total_amount'), 'arrivals' => $bookings->whereBetween('check_in', [$start, $end])->count(), 'departures' => $bookings->whereBetween('check_out', [$start, $end])->count()]];
    }

    /** @return array{title: string, columns: array<int, string>, rows: array<int, array<int, mixed>>, summary: array<string, mixed>} */
    private function occupancy(Carbon $start, Carbon $end): array
    {
        $units = Unit::with('category', 'branch')->where('unit_type', 'room')->get();
        $bookings = $this->bookings($start, $end);
        $rows = [];
        foreach (CarbonPeriod::create($start, $end->copy()->subDay()) as $date) {
            foreach ($units->groupBy(fn (Unit $unit): string => ($unit->category?->name ?? 'Uncategorized').'|'.($unit->branch?->name ?? 'Unknown')) as $group) {
                $occupied = $bookings->filter(fn (Booking $booking): bool => $booking->check_in <= $date && $booking->check_out > $date && $group->contains('id', $booking->unit_id))->count();
                $rows[] = [$date->toDateString(), $group->first()->category?->name ?? 'Uncategorized', $group->first()->branch?->name ?? 'Unknown', $group->count(), $occupied, $group->count() ? round($occupied / $group->count() * 100, 2) : 0];
            }
        }

        return ['title' => 'Occupancy Report', 'columns' => ['Date', 'Room Type', 'Branch', 'Available Rooms', 'Occupied Rooms', 'Occupancy %'], 'rows' => $rows, 'summary' => ['room_types' => $units->groupBy('category.name')->map->count(), 'branches' => $units->groupBy('branch.name')->map->count()]];
    }

    /** @return array{title: string, columns: array<int, string>, rows: array<int, array<int, mixed>>, summary: array<string, mixed>} */
    private function revenue(Carbon $start, Carbon $end): array
    {
        $payments = FolioPayment::with('booking')->whereBetween('paid_at', [$start, $end])->get();
        $items = FolioItem::with('booking')->whereHas('booking', fn ($query) => $query->whereBetween('check_in', [$start, $end]))->get();
        $rows = $payments->map(fn (FolioPayment $payment): array => [$payment->paid_at?->toDateString(), $payment->method, $payment->booking?->source ?? 'unknown', $payment->amount, 'payment'])->all();
        foreach ($items as $item) {
            $rows[] = [$item->booking?->check_in?->toDateString(), 'folio', $item->item_type, $item->quantity * $item->unit_price - $item->discount, 'item'];
        }

        return ['title' => 'Revenue Report', 'columns' => ['Date', 'Payment Method', 'Source / Item Type', 'Amount', 'Record Type'], 'rows' => $rows, 'summary' => ['by_method' => $payments->groupBy('method')->map->sum('amount'), 'itemized_total' => $items->sum(fn (FolioItem $item): float => (float) ($item->quantity * $item->unit_price - $item->discount))]];
    }

    /** @return array{title: string, columns: array<int, string>, rows: array<int, array<int, mixed>>, summary: array<string, mixed>} */
    private function guests(Carbon $start, Carbon $end): array
    {
        $bookings = $this->bookings($start, $end)->load('customer');
        $customers = $bookings->pluck('customer')->filter()->unique('id');
        $rows = $customers->map(fn ($customer): array => [$customer->name, $customer->email, $customer->gender ?? 'Not specified', $customer->nationality ?? 'Not specified', $bookings->where('customer_id', $customer->id)->count()])->values()->all();

        return ['title' => 'Guest Report', 'columns' => ['Name', 'Email', 'Gender', 'Nationality', 'Stays'], 'rows' => $rows, 'summary' => ['new_guests' => $customers->filter(fn ($customer) => $customer->created_at?->between($start, $end))->count(), 'returning_guests' => $rows ? collect($rows)->where('4', '>', 1)->count() : 0, 'demographics' => ['gender' => $customers->groupBy('gender')->map->count(), 'nationality' => $customers->groupBy('nationality')->map->count()]]];
    }

    /** @return array{title: string, columns: array<int, string>, rows: array<int, array<int, mixed>>, summary: array<string, mixed>} */
    private function staffPerformance(Carbon $start, Carbon $end): array
    {
        $tasks = Task::with('employee')->whereBetween('completed_at', [$start, $end])->get();
        $attendance = AttendanceRecord::with('employee')->whereBetween('attendance_date', [$start, $end])->get();
        $employees = $tasks->pluck('employee')->merge($attendance->pluck('employee'))->filter()->unique('id');
        $rows = $employees->map(fn ($employee): array => [$employee->name, $tasks->where('assigned_to', $employee->id)->where('status', 'done')->count(), $attendance->where('employee_id', $employee->id)->count(), $attendance->where('employee_id', $employee->id)->where('is_late', true)->count()])->values()->all();

        return ['title' => 'Staff Performance Report', 'columns' => ['Employee', 'Tasks Completed', 'Attendance Days', 'Late Arrivals'], 'rows' => $rows, 'summary' => ['tasks_completed' => $tasks->where('status', 'done')->count(), 'attendance_days' => $attendance->count()]];
    }

    /** @return array{title: string, columns: array<int, string>, rows: array<int, array<int, mixed>>, summary: array<string, mixed>} */
    private function tax(Carbon $start, Carbon $end): array
    {
        $items = FolioItem::whereHas('booking', fn ($query) => $query->whereBetween('check_in', [$start, $end]))->get();
        $rows = $items->groupBy('tax_type')->map(fn ($group, $type): array => [$type ?: 'VAT', $group->sum(fn (FolioItem $item): float => (float) ($item->quantity * $item->unit_price - $item->discount)), $group->sum(fn (FolioItem $item): float => (float) (($item->quantity * $item->unit_price - $item->discount) * $item->tax_rate / 100))])->values()->all();

        return ['title' => 'Tax Report', 'columns' => ['Tax Type', 'Taxable Amount', 'Tax Collected'], 'rows' => $rows, 'summary' => ['tax_collected' => collect($rows)->sum(2)]];
    }

    private function bookings(Carbon $start, Carbon $end): Collection
    {
        return Booking::query()->where('check_in', '<', $end)->where('check_out', '>=', $start)->whereNotIn('status', ['cancelled', 'no_show'])->get();
    }
}
