<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 34px 38px 48px; }
        body { color: #1e293b; font-family: DejaVu Sans, sans-serif; font-size: 10px; line-height: 1.5; }
        h1, h2, h3, p { margin: 0; }
        h1 { color: #92400e; font-size: 22px; }
        h2 { margin: 22px 0 9px; color: #0f172a; font-size: 13px; }
        .muted { color: #64748b; }
        .right { text-align: right; }
        .center { text-align: center; }
        .header { width: 100%; border-bottom: 2px solid #d97706; padding-bottom: 14px; }
        .header td { vertical-align: top; }
        .logo { max-width: 150px; max-height: 56px; margin-bottom: 7px; }
        .invoice-title { text-align: right; }
        .invoice-title h1 { text-transform: uppercase; letter-spacing: 1px; }
        .invoice-title p { margin-top: 3px; }
        .details { width: 100%; margin-top: 20px; }
        .details td { width: 50%; vertical-align: top; }
        .details p { margin: 2px 0; }
        .label { margin-bottom: 5px; color: #64748b; font-size: 8px; font-weight: bold; letter-spacing: .7px; text-transform: uppercase; }
        .stay { margin-top: 15px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 5px; background: #f8fafc; }
        .stay table { width: 100%; }
        .stay td { width: 25%; vertical-align: top; }
        table.items, table.payments { width: 100%; border-collapse: collapse; margin-top: 8px; }
        table.items th, table.items td, table.payments th, table.payments td { padding: 8px 7px; border-bottom: 1px solid #e2e8f0; text-align: left; }
        table.items th, table.payments th { background: #fff7ed; color: #7c2d12; font-size: 9px; }
        table.items .right, table.payments .right { text-align: right; }
        table.totals { width: 48%; margin: 12px 0 0 auto; border-collapse: collapse; }
        table.totals td { padding: 5px 7px; }
        .grand-total td { border-top: 2px solid #d97706; color: #92400e; font-size: 13px; font-weight: bold; }
        .codes { width: 100%; margin-top: 20px; }
        .codes td { width: 50%; vertical-align: top; }
        .qr { width: 100px; height: 100px; }
        .barcode { max-width: 250px; height: 55px; }
        .policy { margin-top: 17px; padding: 9px 11px; border: 1px solid #fde68a; border-radius: 4px; background: #fffbeb; }
        .footer { position: fixed; right: 0; bottom: -29px; left: 0; border-top: 1px solid #e2e8f0; padding-top: 8px; color: #64748b; text-align: center; font-size: 9px; }
        .empty { padding: 12px; color: #64748b; text-align: center; }
    </style>
</head>
<body>
    <table class="header">
        <tr>
            <td>
                @if($tenantLogo)
                    <img class="logo" src="{{ $tenantLogo }}" alt="{{ $tenant->name }} logo"><br>
                @endif
                <strong>{{ $tenant->name }}</strong>
                @if($issuerAddress)<p>{{ $issuerAddress }}</p>@endif
                @if($issuerPhone)<p>{{ $issuerPhone }}</p>@endif
                @if($issuerEmail)<p>{{ $issuerEmail }}</p>@endif
            </td>
            <td class="invoice-title">
                <h1>Tax Invoice</h1>
                <p><strong>Invoice number:</strong> {{ $invoiceNumber }}</p>
                <p><strong>Invoice date:</strong> {{ $invoiceDate->format('d M Y') }}</p>
            </td>
        </tr>
    </table>

    <table class="details">
        <tr>
            <td>
                <div class="label">Bill to</div>
                <p><strong>{{ $booking->customer?->name ?? 'Guest' }}</strong></p>
                @if($booking->customer?->email)<p>{{ $booking->customer->email }}</p>@endif
                @if($booking->customer?->phone)<p>{{ $booking->customer->phone }}</p>@endif
            </td>
            <td>
                <div class="label">Booking and property</div>
                <p><strong>Booking reference:</strong> {{ $booking->booking_ref }}</p>
                <p><strong>Property:</strong> {{ $booking->branch?->name ?? 'Property' }}</p>
            </td>
        </tr>
    </table>

    <div class="stay">
        <table>
            <tr>
                <td><span class="label">Check-in</span><br>{{ $booking->check_in->format('d M Y') }}</td>
                <td><span class="label">Check-out</span><br>{{ $booking->check_out->format('d M Y') }}</td>
                <td><span class="label">Nights</span><br>{{ $booking->check_in->diffInDays($booking->check_out) }}</td>
                <td><span class="label">Unit</span><br>{{ $booking->unit?->name ?? 'Unit' }}@if($booking->unit?->number) · {{ $booking->unit->number }}@endif</td>
            </tr>
            <tr>
                <td colspan="3"></td>
                <td class="muted">
                    @if($booking->unit?->floor)Floor {{ $booking->unit->floor }}@endif
                    @if($booking->unit?->category) · {{ $booking->unit->category->name }}@endif
                </td>
            </tr>
        </table>
    </div>

    <h2>Itemized charges</h2>
    <table class="items">
        <thead>
            <tr>
                <th>Description</th>
                <th class="right">Qty</th>
                <th class="right">Unit price</th>
                <th class="right">Tax</th>
                <th class="right">Total</th>
            </tr>
        </thead>
        <tbody>
            @forelse($folioItems as $item)
                <tr>
                    <td>{{ $item['description'] }}</td>
                    <td class="right">{{ rtrim(rtrim(number_format($item['quantity'], 2), '0'), '.') }}</td>
                    <td class="right">{{ $booking->currency }} {{ number_format($item['unit_price'], 2) }}</td>
                    <td class="right">{{ $booking->currency }} {{ number_format($item['tax'], 2) }}</td>
                    <td class="right">{{ $booking->currency }} {{ number_format($item['total'], 2) }}</td>
                </tr>
            @empty
                <tr><td colspan="5" class="empty">No folio items recorded.</td></tr>
            @endforelse
        </tbody>
    </table>

    <table class="totals">
        <tr><td>Subtotal</td><td class="right">{{ $booking->currency }} {{ number_format($subtotal, 2) }}</td></tr>
        <tr><td>Tax total</td><td class="right">{{ $booking->currency }} {{ number_format($taxTotal, 2) }}</td></tr>
        <tr class="grand-total"><td>Grand total</td><td class="right">{{ $booking->currency }} {{ number_format($grandTotal, 2) }}</td></tr>
    </table>

    <h2>Payment history</h2>
    <table class="payments">
        <thead>
            <tr><th>Date</th><th>Method</th><th>Reference</th><th class="right">Amount</th></tr>
        </thead>
        <tbody>
            @forelse($booking->payments as $payment)
                <tr>
                    <td>{{ $payment->paid_at?->format('d M Y') ?? 'Pending' }}</td>
                    <td>{{ ucfirst($payment->method) }}</td>
                    <td>{{ $payment->reference ?? '—' }}</td>
                    <td class="right">{{ $booking->currency }} {{ number_format((float) $payment->amount, 2) }}</td>
                </tr>
            @empty
                <tr><td colspan="4" class="empty">No payments recorded.</td></tr>
            @endforelse
        </tbody>
    </table>

    <table class="codes">
        <tr>
            <td>
                <div class="label">Booking QR code</div>
                <img class="qr" src="{{ $qrCode }}" alt="Booking QR code">
            </td>
            <td class="right">
                <div class="label">Booking barcode</div>
                <img class="barcode" src="{{ $barcode }}" alt="Barcode for {{ $booking->booking_ref }}">
                <div class="muted">{{ $booking->booking_ref }}</div>
            </td>
        </tr>
    </table>

    @if($cancellationPolicy !== '')
        <div class="policy">
            <strong>Cancellation policy</strong><br>
            {{ $cancellationPolicy }}
        </div>
    @endif

    <div class="footer">
        Thank you for staying with us · {{ $booking->branch?->name ?? $tenant->name }}
    </div>
</body>
</html>
