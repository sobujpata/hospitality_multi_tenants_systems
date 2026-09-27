<?php

namespace App\Http\Controllers;

use App\Exports\ReportExport;
use App\Models\ReportSchedule;
use App\Services\ReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class ReportController extends Controller
{
    private const REPORTS = [
        'daily-business' => 'Daily Business Report',
        'occupancy' => 'Occupancy Report',
        'revenue' => 'Revenue Report',
        'guest' => 'Guest Report',
        'staff-performance' => 'Staff Performance Report',
        'tax' => 'Tax Report',
    ];

    public function index(Request $request, ReportService $reports): Response
    {
        [$start, $end] = $this->dates($request);
        $type = $request->string('report', 'daily-business')->toString();

        abort_unless(isset(self::REPORTS[$type]), 404);

        return Inertia::render('reports/index', [
            'reportTypes' => self::REPORTS,
            'selectedReport' => $type,
            'start' => $start->toDateString(),
            'end' => $end->copy()->subDay()->toDateString(),
            'report' => $reports->generate($type, $start, $end),
            'schedules' => ReportSchedule::latest()->get(),
        ]);
    }

    public function export(Request $request, ReportService $reports): BinaryFileResponse|HttpResponse
    {
        [$start, $end] = $this->dates($request);
        $type = $request->string('report', 'daily-business')->toString();
        $format = $request->string('format', 'pdf')->toString();
        abort_unless(isset(self::REPORTS[$type]) && in_array($format, ['pdf', 'xlsx'], true), 422);
        $report = $reports->generate($type, $start, $end);
        $filename = str($type)->replace('-', '_')->append('_'.now()->format('Ymd')).toString();

        if ($format === 'xlsx') {
            return Excel::download(new ReportExport($report), $filename.'.xlsx');
        }

        return Pdf::loadView('reports.report', ['report' => $report, 'start' => $start, 'end' => $end])->download($filename.'.pdf');
    }

    public function storeSchedule(Request $request): HttpResponse
    {
        $data = $request->validate([
            'report_type' => ['required', 'in:daily-business,occupancy,revenue,guest,staff-performance,tax'],
            'recipient_email' => ['required', 'email'],
            'format' => ['required', 'in:pdf,xlsx'],
            'cadence' => ['required', 'in:daily,weekly,monthly'],
            'run_at' => ['required', 'date_format:H:i'],
        ]);
        $data['created_by'] = $request->user()->id;
        $data['next_run_at'] = now()->setTimeFromTimeString($data['run_at']);
        if ($data['next_run_at']->isPast()) {
            $data['next_run_at']->addDay();
        }
        ReportSchedule::create($data);

        return back()->with('success', 'Report schedule created.');
    }

    public function destroySchedule(ReportSchedule $schedule): HttpResponse
    {
        $schedule->delete();

        return back()->with('success', 'Report schedule removed.');
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function dates(Request $request): array
    {
        $start = Carbon::parse($request->input('start', now()->startOfMonth()->toDateString()))->startOfDay();
        $end = Carbon::parse($request->input('end', now()->toDateString()))->addDay()->startOfDay();
        abort_if($end->lessThanOrEqualTo($start) || $start->diffInDays($end) > 366, 422, 'Invalid report date range.');

        return [$start, $end];
    }
}
