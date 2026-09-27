<!doctype html>
<html>
<head><meta charset="utf-8"><title>{{ $report['title'] }}</title><style>body{font-family:DejaVu Sans,sans-serif;font-size:11px;color:#222}h1{color:#0f766e}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f1f5f9}.summary{display:flex;gap:20px}</style></head>
<body>
    <h1>{{ $report['title'] }}</h1>
    <p>Period: {{ $start->toDateString() }} to {{ $end->copy()->subDay()->toDateString() }}</p>
    <div class="summary">@foreach($report['summary'] as $key => $value)<p><strong>{{ str($key)->replace('_', ' ')->title() }}:</strong> {{ is_scalar($value) ? $value : json_encode($value) }}</p>@endforeach</div>
    <table><thead><tr>@foreach($report['columns'] as $column)<th>{{ $column }}</th>@endforeach</tr></thead><tbody>@foreach($report['rows'] as $row)<tr>@foreach($row as $value)<td>{{ is_scalar($value) ? $value : json_encode($value) }}</td>@endforeach</tr>@endforeach</tbody></table>
</body>
</html>
