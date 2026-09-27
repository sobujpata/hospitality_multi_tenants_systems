<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;

class ReportExport implements FromArray, ShouldAutoSize, WithHeadings
{
    public function __construct(private readonly array $report) {}

    public function headings(): array
    {
        return $this->report['columns'];
    }

    public function array(): array
    {
        return $this->report['rows'];
    }
}
