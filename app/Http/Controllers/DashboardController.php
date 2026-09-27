<?php

namespace App\Http\Controllers;

use App\Models\Review;
use App\Services\DashboardStatsService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request, DashboardStatsService $stats): Response
    {
        $start = Carbon::parse($request->input('start', now()->startOfMonth()->toDateString()))->startOfDay();
        $end = Carbon::parse($request->input('end', now()->toDateString()))->addDay()->startOfDay();

        abort_if($end->lessThanOrEqualTo($start), 422, 'The dashboard end date must be after the start date.');
        abort_if($start->diffInDays($end) > 366, 422, 'Dashboard date ranges cannot exceed one year.');

        $dashboardStats = $stats->get($start, $end);
        $dashboardStats['range']['end'] = $end->copy()->subDay()->toDateString();

        return Inertia::render('dashboard', [
            'stats' => $dashboardStats,
            'recentReviews' => Review::with('customer:id,name')->latest()->limit(10)->get(),
        ]);
    }
}
