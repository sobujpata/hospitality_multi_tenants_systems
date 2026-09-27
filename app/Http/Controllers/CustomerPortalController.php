<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\BookingModificationRequest;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\FolioItem;
use App\Models\Review;
use App\Models\Tenant;
use App\Models\Unit;
use App\Notifications\BookingConfirmationNotification;
use App\Notifications\ReviewRequestNotification;
use App\Services\BookingConflictDetectionService;
use App\Services\PriceCalculator;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CustomerPortalController extends Controller
{
    public function dashboard(): Response
    {
        $customer = $this->customer();
        $bookings = Booking::withoutGlobalScopes()
            ->with([
                'branch' => fn ($query) => $query->withoutGlobalScopes()->select(['id', 'name']),
                'unit' => fn ($query) => $query->withoutGlobalScopes()->select(['id', 'name', 'number']),
                'rooms' => fn ($query) => $query->withoutGlobalScopes()->select(['units.id', 'units.name', 'units.number']),
            ])
            ->where('customer_id', $customer->id)
            ->latest('check_in')
            ->get();
        $bookings->where('status', 'completed')->where('check_out', '<', now()->toDateString())->each(function (Booking $booking): void {
            if ($booking->review_requested_at === null) {
                $booking->customer->notify(new ReviewRequestNotification($booking));
                $booking->update(['review_requested_at' => now()]);
            }
        });

        return Inertia::render('portal/dashboard', [
            'customer' => $customer,
            'upcomingBookings' => $bookings->whereIn('status', ['pending', 'confirmed'])->where('check_out', '>=', now()->toDateString())->values(),
            'pastBookings' => $bookings->where('check_out', '<', now()->toDateString())->values(),
            'loyaltyPoints' => $customer->loyalty_points,
        ]);
    }

    public function createBooking(Request $request): Response
    {
        if (! auth('customer')->check()) {
            $request->session()->put('url.intended', $request->fullUrl());
        }

        $data = $request->validate([
            'check_in' => ['nullable', 'date', 'after_or_equal:today'],
            'check_out' => ['nullable', 'date', 'after:check_in'],
            'location' => ['nullable', 'string', 'max:255'],
            'branch_id' => ['nullable', 'integer'],
            'unit_id' => ['nullable', 'integer'],
            'unit_ids' => ['nullable', 'array'],
            'unit_ids.*' => ['integer', 'distinct'],
            'room_guest_names' => ['nullable', 'array'],
            'room_guest_names.*' => ['array'],
            'room_guest_names.*.*' => ['string', 'max:255'],
            'extras' => ['nullable', 'array'],
            'extras.*' => ['string', 'max:255'],
            'adults' => ['nullable', 'integer', 'min:1'],
            'children' => ['nullable', 'integer', 'min:0'],
            'special_requests' => ['nullable', 'string', 'max:2000'],
        ]);
        $hasDates = isset($data['check_in'], $data['check_out']);
        $location = trim($data['location'] ?? '');
        $branchQuery = Branch::withoutGlobalScopes()->where('is_active', true);
        if ($location !== '') {
            $branchQuery->where(function ($query) use ($location): void {
                $query->where('city', $location)->orWhere('country', $location);
            });
        }
        if (isset($data['branch_id'])) {
            $branchQuery->whereKey($data['branch_id']);
        }

        $branches = $branchQuery->orderBy('name')->get();
        $branchIds = $branches->modelKeys();
        $unitsQuery = Unit::withoutGlobalScopes()
            ->whereIn('branch_id', $branchIds)
            ->where('unit_type', 'room')
            ->where('status', 'available');
        if ($hasDates) {
            $unitsQuery
                ->whereDoesntHave('bookings', fn ($query) => $query->withoutGlobalScopes()
                    ->where('check_in', '<', $data['check_out'])
                    ->where('check_out', '>', $data['check_in'])
                    ->whereNotIn('status', ['cancelled', 'no_show']))
                ->whereDoesntHave('roomBookings', fn ($query) => $query->withoutGlobalScopes()
                    ->where('check_in', '<', $data['check_out'])
                    ->where('check_out', '>', $data['check_in'])
                    ->whereNotIn('status', ['cancelled', 'no_show']))
                ->whereDoesntHave('blocks', fn ($query) => $query
                    ->where('starts_on', '<', $data['check_out'])
                    ->where('ends_on', '>', $data['check_in']));
        }
        $units = $unitsQuery
            ->with(['category' => fn ($query) => $query->withoutGlobalScopes()])
            ->orderBy('base_price')
            ->get([
                'id', 'branch_id', 'number', 'name', 'base_price', 'price_weekend',
                'capacity', 'amenities', 'images', 'unit_category_id',
            ]);
        $availableBranchIds = $units->pluck('branch_id')->unique()->all();
        $branches = $branches
            ->whereIn('id', $availableBranchIds)
            ->map(fn (Branch $branch): array => [
                'id' => $branch->id,
                'name' => $branch->name,
                'type' => $branch->type,
                'city' => $branch->city,
                'country' => $branch->country,
                'address' => $branch->address,
                'phone' => $branch->phone,
                'email' => $branch->email,
                'cover_image' => $this->publicImageUrl($branch->cover_image),
                'star_rating' => $branch->star_rating,
                'currency' => $branch->currency,
                'amenities' => $branch->amenities ?? [],
                'available_rooms' => $units->where('branch_id', $branch->id)->count(),
                'lowest_price' => $units
                    ->where('branch_id', $branch->id)
                    ->min('base_price'),
            ])->values();

        return Inertia::render('portal/book', [
            'branches' => $branches,
            'units' => $units->map(fn (Unit $unit): array => [
                'id' => $unit->id,
                'branch_id' => $unit->branch_id,
                'number' => $unit->number,
                'name' => $unit->name,
                'base_price' => $unit->base_price,
                'price_weekend' => $unit->price_weekend,
                'capacity' => $unit->capacity,
                'amenities' => $unit->amenities ?? [],
                'images' => collect($unit->images ?? [])
                    ->map(fn (string $image): string => $this->publicImageUrl($image))
                    ->filter()
                    ->values()
                    ->all(),
                'category' => $unit->category?->name,
            ])->values(),
            'checkIn' => $data['check_in'] ?? '',
            'checkOut' => $data['check_out'] ?? '',
            'location' => $location,
            'selectedBranchId' => isset($data['branch_id']) ? (int) $data['branch_id'] : null,
            'selectedUnitId' => isset($data['unit_id']) ? (int) $data['unit_id'] : null,
            'selectedUnitIds' => collect($data['unit_ids'] ?? [])
                ->map(fn (int $unitId): int => $unitId)
                ->values(),
            'selectedRoomGuestNames' => collect($data['room_guest_names'] ?? [])
                ->map(fn (array $names): array => collect($names)->values()->all()),
            'selectedExtras' => collect($data['extras'] ?? [])
                ->intersect($branches->firstWhere('id', $data['branch_id'] ?? null)['amenities'] ?? [])
                ->values()
                ->all(),
            'adults' => $data['adults'] ?? 1,
            'children' => $data['children'] ?? 0,
            'specialRequests' => $data['special_requests'] ?? '',
            'isAuthenticated' => auth('customer')->check(),
        ]);
    }

    public function storeBooking(Request $request, BookingConflictDetectionService $conflicts, PriceCalculator $calculator): RedirectResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'unit_ids' => ['required_without:unit_id', 'array', 'min:1'],
            'unit_ids.*' => ['required', 'integer', 'distinct', 'exists:units,id'],
            'unit_id' => ['required_without:unit_ids', 'nullable', 'integer', 'exists:units,id'],
            'room_guest_names' => ['nullable', 'array'],
            'room_guest_names.*' => ['array'],
            'room_guest_names.*.*' => ['string', 'max:255'],
            'check_in' => ['required', 'date', 'after_or_equal:today'],
            'check_out' => ['required', 'date', 'after:check_in'],
            'adults' => ['nullable', 'integer', 'min:1'],
            'children' => ['nullable', 'integer', 'min:0'],
            'promo_code' => ['nullable', 'string', 'max:50'],
            'extras' => ['nullable', 'array'],
            'extras.*' => ['string', 'max:255'],
            'special_requests' => ['nullable', 'string', 'max:2000'],
        ]);
        $data['adults'] = (int) ($data['adults'] ?? 1);
        $data['children'] = (int) ($data['children'] ?? 0);
        $branch = Branch::withoutGlobalScopes()->findOrFail($data['branch_id']);
        $branch->tenant->makeCurrent();
        $unitIds = collect($data['unit_ids'] ?? [$data['unit_id']])
            ->map(fn ($unitId): int => (int) $unitId)
            ->unique()
            ->values();
        $units = Unit::withoutGlobalScopes()
            ->whereIn('id', $unitIds)
            ->where('tenant_id', $branch->tenant_id)
            ->where('branch_id', $branch->id)
            ->where('unit_type', 'room')
            ->where('status', 'available')
            ->get()
            ->keyBy('id');

        if ($units->count() !== $unitIds->count()) {
            throw ValidationException::withMessages([
                'unit_ids' => 'One or more selected rooms are no longer available at this property.',
            ]);
        }

        $guestCount = $data['adults'] + $data['children'];
        if ($guestCount > $units->sum('capacity')) {
            throw ValidationException::withMessages([
                'adults' => 'The selected rooms do not have enough guest capacity.',
            ]);
        }

        $guestNamesByRoom = collect($data['room_guest_names'] ?? [])
            ->map(fn (array $names): array => collect($names)
                ->map(fn (string $name): string => trim($name))
                ->filter()
                ->values()
                ->all());
        if ($guestNamesByRoom->keys()->diff($unitIds->map(fn (int $id): string => (string) $id))->isNotEmpty()) {
            throw ValidationException::withMessages([
                'room_guest_names' => 'Guest names can only be assigned to selected rooms.',
            ]);
        }
        if ($guestNamesByRoom->flatten()->count() > max(0, $guestCount - 1)) {
            throw ValidationException::withMessages([
                'room_guest_names' => 'Enter no more guest names than the number of guests accompanying the account holder.',
            ]);
        }
        foreach ($guestNamesByRoom as $unitId => $names) {
            $roomCapacity = (int) $units->get((int) $unitId)->capacity;
            $leadGuestOccupiesRoom = (int) $unitId === $unitIds->first();

            if (count($names) > $roomCapacity - (int) $leadGuestOccupiesRoom) {
                throw ValidationException::withMessages([
                    "room_guest_names.{$unitId}" => 'The guest names exceed this room’s capacity.',
                ]);
            }
        }

        $facilities = collect($branch->amenities ?? [])->filter(fn ($amenity): bool => is_string($amenity))->values();
        $extras = collect($data['extras'] ?? []);
        abort_if($extras->diff($facilities)->isNotEmpty(), 422, 'One or more selected facilities are not available at this branch.');
        $pricedExtras = $extras->map(fn (string $facility): array => [
            'description' => $facility,
            'price' => 0,
            'quantity' => 1,
            'item_type' => 'extra',
        ])->all();
        $booking = DB::transaction(function () use ($data, $unitIds, $guestNamesByRoom, $branch, $conflicts, $calculator, $pricedExtras): Booking {
            $roomPricing = [];
            foreach ($unitIds as $index => $unitId) {
                $conflicts->assertAvailable($unitId, $data['check_in'], $data['check_out']);
                $roomPricing[$unitId] = $calculator->calculate(
                    $unitId,
                    $data['check_in'],
                    $data['check_out'],
                    $index === 0 ? ($data['promo_code'] ?? null) : null,
                );
            }
            $pricing = [
                'nights' => $roomPricing[$unitIds->first()]['nights'],
                'base' => collect($roomPricing)->sum('base'),
                'seasonal' => collect($roomPricing)->sum('seasonal'),
                'discount' => collect($roomPricing)->sum('discount'),
                'total' => collect($roomPricing)->sum('total'),
                'currency' => $roomPricing[$unitIds->first()]['currency'],
            ];
            $calculator->consumePromoCode($data['promo_code'] ?? null, Carbon::parse($data['check_in']));

            $booking = Booking::create([
                'branch_id' => $branch->id,
                'unit_id' => $unitIds->first(),
                'check_in' => $data['check_in'],
                'check_out' => $data['check_out'],
                'adults' => $data['adults'],
                'children' => $data['children'],
                'special_requests' => $data['special_requests'] ?? null,
                'tenant_id' => $branch->tenant_id,
                'customer_id' => $this->customer()->id,
                'type' => 'online',
                'status' => 'pending',
                'source' => 'customer_portal',
                'total_amount' => $pricing['total'],
                'currency' => $pricing['currency'],
            ]);
            $booking->rooms()->attach($unitIds->mapWithKeys(fn (int $unitId): array => [
                $unitId => [
                    'tenant_id' => $branch->tenant_id,
                    'room_amount' => $roomPricing[$unitId]['total'],
                    'guest_names' => json_encode($guestNamesByRoom->get((string) $unitId, []), JSON_THROW_ON_ERROR),
                ],
            ])->all());

            FolioItem::create([
                'booking_id' => $booking->id,
                'tenant_id' => $booking->tenant_id,
                'description' => 'Room accommodation',
                'quantity' => $pricing['nights'],
                'unit_price' => $pricing['nights'] > 0 ? $pricing['seasonal'] / $pricing['nights'] : 0,
                'tax_rate' => 0,
                'discount' => $pricing['discount'],
                'tax_type' => 'VAT',
                'item_type' => 'room_charge',
            ]);
            foreach ($pricedExtras as $extra) {
                FolioItem::create([
                    'booking_id' => $booking->id,
                    'tenant_id' => $booking->tenant_id,
                    'description' => $extra['description'] ?? 'Additional service',
                    'quantity' => max(1, (int) ($extra['quantity'] ?? 1)),
                    'unit_price' => $extra['price'],
                    'tax_rate' => 0,
                    'discount' => 0,
                    'tax_type' => $extra['tax_type'] ?? 'VAT',
                    'item_type' => $extra['item_type'],
                ]);
            }

            return $booking;
        });
        $booking->customer->notify(new BookingConfirmationNotification($booking));

        return redirect('/portal')->with('status', 'Booking request submitted.');
    }

    public function modification(Request $request, Booking $booking): RedirectResponse
    {
        abort_unless($booking->customer_id === $this->customer()->id, 404);
        $data = $request->validate(['request' => ['required', 'string', 'max:2000']]);
        BookingModificationRequest::create([...$data, 'tenant_id' => Tenant::current()->getKey(), 'booking_id' => $booking->id, 'customer_id' => $this->customer()->id]);

        return back()->with('status', 'Modification request sent.');
    }

    public function review(Request $request, Booking $booking): RedirectResponse
    {
        abort_unless($booking->customer_id === $this->customer()->id && $booking->status === 'completed', 404);
        $data = $request->validate(['rating' => ['required', 'integer', 'between:1,5'], 'comment' => ['nullable', 'string', 'max:5000']]);
        Review::create([...$data, 'tenant_id' => Tenant::current()->getKey(), 'customer_id' => $this->customer()->id, 'booking_id' => $booking->id]);

        return back()->with('status', 'Thank you for your feedback.');
    }

    public function invoice(Booking $booking): \Symfony\Component\HttpFoundation\Response
    {
        abort_unless($booking->customer_id === $this->customer()->id, 404);
        $booking->load(['branch', 'unit', 'customer', 'folioItems', 'payments']);
        $invoiceUrl = url('/portal/bookings/'.$booking->id.'/invoice');
        $pdf = Pdf::loadView('invoices.booking', compact('booking', 'invoiceUrl'))->setPaper('a4');

        return $pdf->download('invoice-'.$booking->booking_reference.'.pdf');
    }

    public function checkout(Request $request, Booking $booking): RedirectResponse
    {
        abort_unless($booking->customer_id === $this->customer()->id, 404);
        $data = $request->validate(['signature' => ['required', 'string', 'starts_with:data:image/png;base64,'], 'payment_amount' => ['nullable', 'numeric', 'min:0']]);
        $booking->update(['checkout_signature' => $data['signature'], 'status' => 'checked_out', 'checked_out_at' => now()]);
        if ((float) ($data['payment_amount'] ?? 0) > 0) {
            $booking->payments()->create(['tenant_id' => Tenant::current()->getKey(), 'amount' => $data['payment_amount'], 'method' => 'card', 'paid_at' => now()]);
        }

        return back()->with('status', 'Checkout completed and signature saved.');
    }

    private function customer(): Customer
    {
        return auth('customer')->user();
    }

    private function publicImageUrl(?string $image): ?string
    {
        if (! $image) {
            return null;
        }

        if (str_starts_with($image, 'http://') || str_starts_with($image, 'https://')) {
            return $image;
        }

        if (Storage::disk('public')->exists($image)) {
            return Storage::disk('public')->url($image);
        }

        if (Storage::disk('s3')->exists($image)) {
            return Storage::disk('s3')->url($image);
        }

        return null;
    }
}
