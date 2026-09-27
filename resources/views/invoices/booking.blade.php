<!doctype html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:DejaVu Sans,sans-serif;color:#1e293b;font-size:12px}header{border-bottom:3px solid #d97706;padding-bottom:16px;margin-bottom:20px}h1{margin:0;color:#92400e}.muted{color:#64748b}.right{text-align:right}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#fff7ed}.summary{margin-left:auto;width:280px;margin-top:20px}.summary td{border:0}.total{font-size:16px;font-weight:bold;border-top:2px solid #d97706!important}.qr{margin-top:20px;text-align:right}
</style></head>
<body>
<header>
    @if($booking->tenant?->logo)<img src="{{ $booking->tenant->logo }}" alt="" style="height:50px;max-width:160px;object-fit:contain">@endif
    <h1>{{ $booking->branch?->name ?? 'Guest Folio' }}</h1>
    <div class="muted">{{ $booking->branch?->address }} {{ $booking->branch?->city }}</div>
</header>
<h2>Guest folio / invoice</h2>
<p><strong>{{ $booking->customer?->name }}</strong><br>Booking: {{ $booking->booking_ref ?? $booking->booking_reference }}<br>Stay: {{ $booking->check_in->toDateString() }} to {{ $booking->check_out->toDateString() }}</p>
<table><thead><tr><th>Description</th><th>Type</th><th>Qty</th><th>Tax</th><th>Discount</th><th class="right">Amount</th></tr></thead><tbody>
@php($subtotal = 0)
@php($taxes = [])
@foreach($booking->folioItems as $item)
    @php($line = ((float) $item->quantity * (float) $item->unit_price) - (float) $item->discount)
    @php($tax = $line * ((float) $item->tax_rate / 100))
    @php($subtotal += $line)
    @php($taxes[$item->tax_type] = ($taxes[$item->tax_type] ?? 0) + $tax)
    <tr><td>{{ $item->description }}</td><td>{{ str_replace('_', ' ', $item->item_type) }}</td><td>{{ $item->quantity }}</td><td>{{ $item->tax_type }} {{ number_format((float)$item->tax_rate, 2) }}%</td><td>{{ number_format((float)$item->discount, 2) }}</td><td class="right">{{ $booking->currency }} {{ number_format($line, 2) }}</td></tr>
@endforeach
</tbody></table>
<table class="summary"><tr><td>Subtotal</td><td class="right">{{ $booking->currency }} {{ number_format($subtotal, 2) }}</td></tr>
@foreach($taxes as $type => $tax)<tr><td>{{ $type }}</td><td class="right">{{ $booking->currency }} {{ number_format($tax, 2) }}</td></tr>@endforeach
<tr class="total"><td>Total</td><td class="right">{{ $booking->currency }} {{ number_format($subtotal + array_sum($taxes), 2) }}</td></tr></table>
<h3>Payment history</h3><table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr></thead><tbody>@forelse($booking->payments as $payment)<tr><td>{{ $payment->paid_at?->toDateString() }}</td><td>{{ $payment->method }}</td><td>{{ $payment->reference ?? '-' }}</td><td class="right">{{ $booking->currency }} {{ number_format((float)$payment->amount, 2) }}</td></tr>@empty<tr><td colspan="4">No payments recorded.</td></tr>@endforelse</tbody></table>
<div class="qr"><div>Scan to view this invoice online</div><img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data={{ urlencode($invoiceUrl) }}" width="110" height="110"></div>
</body></html>
