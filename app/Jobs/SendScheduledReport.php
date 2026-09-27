<?php

namespace App\Jobs;

use App\Exports\ReportExport;
use App\Models\ReportSchedule;
use App\Services\ReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Multitenancy\Jobs\TenantAware;

class SendScheduledReport implements ShouldQueue, TenantAware
{
    use Queueable;

    public function __construct(public ReportSchedule $schedule) {}

    public function handle(ReportService $reports): void
    {
        tenancy()->initialize($this->schedule->tenant);
        $end = now()->startOfDay();
        $start = match ($this->schedule->cadence) {
            'weekly' => $end->copy()->subWeek(),
            'monthly' => $end->copy()->subMonth(),
            default => $end->copy()->subDay(),
        };
        $report = $reports->generate($this->schedule->report_type, $start, $end);
        $filename = str($this->schedule->report_type)->replace('-', '_')->append('_'.now()->format('Ymd'))->toString();
        $data = $this->schedule->format === 'xlsx'
            ? Excel::raw(new ReportExport($report), \Maatwebsite\Excel\Excel::XLSX)
            : Pdf::loadView('reports.report', ['report' => $report, 'start' => $start, 'end' => $end])->output();
        $extension = $this->schedule->format === 'xlsx' ? 'xlsx' : 'pdf';
        $mime = $this->schedule->format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';

        Mail::raw("Attached is your scheduled {$report['title']}.", function ($message) use ($filename, $extension, $mime, $data): void {
            $message->to($this->schedule->recipient_email)
                ->subject($this->schedule->tenant->name.' - scheduled report')
                ->attachData($data, $filename.'.'.$extension, ['mime' => $mime]);
        });
    }
}
