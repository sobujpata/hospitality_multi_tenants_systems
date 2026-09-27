<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\ChannelConnection;
use App\Models\Unit;
use App\Services\BookingConflictDetectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class BookingController extends Controller
{
    public function index(Request $request): Response
    {
        $start = Carbon::parse($request->input('start', now()->startOfMonth()->toDateString()));
        $end = Carbon::parse($request->input('end', $start->copy()->addDays(14)->toDateString()));

        return Inertia::render('bookings/timeline', [
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
            'units' => Unit::query()
                ->with(['bookings' => fn ($query) => $query
                    ->where('check_in', '<', $end->toDateString())
                    ->where('check_out', '>', $start->toDateString())
                    ->whereNotIn('status', ['cancelled', 'no_show'])
                    ->with('customer:id,name')])
                ->orderBy('branch_id')
                ->orderBy('number')
                ->get(['id', 'branch_id', 'number', 'name']),
        ]);
    }

    public function updateDates(
        Request $request,
        Booking $booking,
        BookingConflictDetectionService $conflicts,
    ): RedirectResponse {
        $data = $request->validate([
            'check_in' => ['required', 'date'],
            'check_out' => ['required', 'date', 'after:check_in'],
        ]);

        $conflicts->assertAvailable($booking->unit_id, $data['check_in'], $data['check_out'], $booking->id);
        $booking->update($data);

        return back()->with('status', 'Booking dates updated.');
    }

    public function availability(Request $request): Response
    {
        $start = Carbon::parse($request->input('start', now()->startOfMonth()->toDateString()));
        $end = Carbon::parse($request->input('end', $start->copy()->addDays(30)->toDateString()));

        return Inertia::render('bookings/availability', [
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
            'units' => Unit::query()
                ->with([
                    'bookings' => fn ($query) => $query
                        ->where('check_in', '<', $end)
                        ->where('check_out', '>', $start)
                        ->whereNotIn('status', ['cancelled', 'no_show'])
                        ->select(['id', 'unit_id', 'check_in', 'check_out', 'status']),
                    'blocks' => fn ($query) => $query
                        ->where('starts_on', '<', $end)
                        ->where('ends_on', '>', $start),
                ])
                ->orderBy('branch_id')
                ->orderBy('number')
                ->get(['id', 'branch_id', 'number', 'name', 'status']),
        ]);
    }

    public function channels(): Response
    {
        return Inertia::render('channels/index', [
            'connections' => ChannelConnection::query()->with('branch:id,name')->latest()->get(),
        ]);
    }

    public function channelWebhook(Request $request, string $token): JsonResponse
    {
        $connection = ChannelConnection::query()->where('webhook_token', $token)->firstOrFail();
        $connection->update(['last_synced_at' => now()]);

        return response()->json(['received' => true, 'channel' => $connection->channel]);
    }
}
