<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\FolioItem;
use App\Models\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Milon\Barcode\Facades\DNS1DFacade as DNS1D;
use Milon\Barcode\Facades\DNS2DFacade as DNS2D;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class InvoiceController extends Controller
{
    public function download(Booking $booking): Response
    {
        $customer = auth('customer')->user();

        abort_unless(
            $customer instanceof Customer
                && (int) $customer->getKey() === (int) $booking->customer_id
                && (int) $customer->tenant_id === (int) $booking->tenant_id,
            404,
        );

        $booking->load([
            'branch' => fn ($query) => $query->withoutGlobalScopes(),
            'unit' => fn ($query) => $query->withoutGlobalScopes(),
            'unit.category' => fn ($query) => $query->withoutGlobalScopes(),
            'folioItems' => fn ($query) => $query->withoutGlobalScopes(),
            'payments' => fn ($query) => $query->withoutGlobalScopes(),
            'customer',
            'tenant',
        ]);

        $tenant = $booking->tenant ?? Tenant::findOrFail($booking->tenant_id);
        $tenantLogo = null;

        if ($tenant->logo && Storage::disk('s3')->exists($tenant->logo)) {
            $logo = Storage::disk('s3')->get($tenant->logo);
            $mimeType = Storage::disk('s3')->mimeType($tenant->logo) ?: 'image/png';
            $tenantLogo = 'data:'.$mimeType.';base64,'.base64_encode($logo);
        }

        $qrCodeValue = DNS2D::getBarcodePNG($booking->qr_code ?: $booking->booking_ref, 'QRCODE', 5, 5);
        $barcodeValue = DNS1D::getBarcodePNG($booking->booking_ref, 'C128');

        if ($qrCodeValue === false || $barcodeValue === false) {
            throw new RuntimeException('Unable to generate the booking codes for this invoice.');
        }

        $folioItems = $booking->folioItems->map(function (FolioItem $item): array {
            $subtotal = ((float) $item->quantity * (float) $item->unit_price) - (float) $item->discount;
            $tax = $subtotal * ((float) $item->tax_rate / 100);

            return [
                'description' => $item->description,
                'quantity' => (float) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'subtotal' => $subtotal,
                'tax' => $tax,
                'total' => $subtotal + $tax,
            ];
        });
        $subtotal = (float) $folioItems->sum('subtotal');
        $taxTotal = (float) $folioItems->sum('tax');
        $grandTotal = $folioItems->isNotEmpty()
            ? $subtotal + $taxTotal
            : (float) $booking->total_amount;
        $settings = $tenant->settings ?? [];
        $issuerAddress = data_get($settings, 'address')
            ?? data_get($settings, 'business.address')
            ?? $booking->branch?->address;
        $issuerPhone = data_get($settings, 'contact.phone')
            ?? $booking->branch?->phone;
        $issuerEmail = data_get($settings, 'contact.email')
            ?? $booking->branch?->email;
        $cancellationPolicy = (string) data_get($settings, 'booking.cancellation_policy', '');

        return Pdf::loadView('pdf.invoice', [
            'booking' => $booking,
            'tenant' => $tenant,
            'tenantLogo' => $tenantLogo,
            'invoiceNumber' => 'INV-'.$booking->booking_ref,
            'invoiceDate' => now(),
            'folioItems' => $folioItems,
            'subtotal' => $subtotal,
            'taxTotal' => $taxTotal,
            'grandTotal' => $grandTotal,
            'qrCode' => 'data:image/png;base64,'.$qrCodeValue,
            'barcode' => 'data:image/png;base64,'.$barcodeValue,
            'issuerAddress' => $issuerAddress,
            'issuerPhone' => $issuerPhone,
            'issuerEmail' => $issuerEmail,
            'cancellationPolicy' => $cancellationPolicy,
        ])->setPaper('a4', 'portrait')
            ->download('Invoice-'.$booking->booking_ref.'.pdf');
    }
}
