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
use Illuminate\Database\Eloquent\Builder;
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
        Booking::withoutGlobalScopes()
            ->with('customer')
            ->where('customer_id', $customer->id)
            ->where('status', 'completed')
            ->where('check_out', '<', now()->toDateString())
            ->whereNull('review_requested_at')
            ->get()
            ->each(function (Booking $booking): void {
                $booking->customer->notify(new ReviewRequestNotification($booking));
                $booking->update(['review_requested_at' => now()]);
            });

        $bookings = $this->portalBookingsQuery($customer)
            ->latest('check_in')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Booking $booking): array => $this->presentPortalBooking($booking));

        return Inertia::render('portal/dashboard', [
            'customer' => $customer,
            'bookings' => $bookings,
            'loyaltyPoints' => $customer->loyalty_points,
        ]);
    }

    public function showBooking(int $booking): Response
    {
        $customer = $this->customer();
        $booking = $this->portalBookingsQuery($customer, true)->findOrFail($booking);

        return Inertia::render('portal/booking-detail', [
            'booking' => $this->presentPortalBooking($booking, true),
            'customerId' => $customer->id,
            'customerName' => $customer->name,
            'hasExistingReview' => Review::withoutGlobalScopes()
                ->where('tenant_id', $booking->tenant_id)
                ->where('booking_id', $booking->id)
                ->where('customer_id', $customer->id)
                ->exists(),
        ]);
    }

    private function portalBookingsQuery(Customer $customer, bool $includeDetails = false): Builder
    {
        $relations = [
            'branch' => fn ($query) => $query->withoutGlobalScopes()->select($includeDetails
                ? [
                    'id', 'name', 'type', 'city', 'address', 'phone', 'email', 'cover_image',
                    'star_rating', 'amenities', 'latitude', 'longitude', 'google_maps_url',
                    'google_embed_url',
                ]
                : ['id', 'name', 'type', 'city', 'address', 'cover_image', 'star_rating']),
            'unit' => fn ($query) => $query->withoutGlobalScopes()->select($includeDetails
                ? [
                    'id', 'name', 'number', 'unit_type', 'floor', 'unit_category_id',
                    'capacity', 'child_capacity', 'images', 'amenities',
                ]
                : ['id', 'name', 'number', 'unit_type', 'floor', 'unit_category_id']),
            'unit.category' => fn ($query) => $query->withoutGlobalScopes()->select(['id', 'name']),
        ];

        if ($includeDetails) {
            $relations['folioItems'] = fn ($query) => $query->withoutGlobalScopes()
                ->select([
                    'id', 'booking_id', 'description', 'quantity', 'unit_price',
                    'tax_rate', 'item_type',
                ]);
            $relations['payments'] = fn ($query) => $query->withoutGlobalScopes()->select([
                'id', 'booking_id', 'amount', 'method', 'paid_at', 'created_at',
            ]);
        } else {
            $relations['folioItems'] = fn ($query) => $query->withoutGlobalScopes()
                ->where('item_type', 'extra')
                ->select(['id', 'booking_id', 'description', 'unit_price', 'item_type']);
        }

        return Booking::withoutGlobalScopes()
            ->with($relations)
            ->where('customer_id', $customer->id);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentPortalBooking(Booking $booking, bool $includeDetails = false): array
    {
        $checkIn = Carbon::parse($booking->check_in);
        $checkOut = Carbon::parse($booking->check_out);
        $branch = $booking->branch;
        $unit = $booking->unit;
        $folioItems = $booking->relationLoaded('folioItems') ? $booking->folioItems : collect();

        $presented = [
            'id' => $booking->id,
            'branch_id' => $booking->branch_id,
            'booking_ref' => $booking->booking_ref ?? $booking->booking_reference,
            'status' => $booking->status,
            'check_in' => $checkIn->toDateString(),
            'check_out' => $checkOut->toDateString(),
            'nights' => (int) $checkIn->diffInDays($checkOut),
            'adults' => $booking->adults,
            'children' => $booking->children,
            'total_amount' => (float) $booking->total_amount,
            'currency' => $booking->currency,
            'created_at' => $booking->created_at?->toISOString(),
            'qr_code' => $booking->qr_code,
            'branch' => [
                'id' => $branch?->id,
                'name' => $branch?->name ?? 'Property',
                'type' => $branch?->type ?? '',
                'city' => $branch?->city ?? '',
                'address_line1' => $branch?->address,
                'address_line2' => null,
                'cover_image' => $this->publicImageUrl($branch?->cover_image),
                'star_rating' => $branch?->star_rating ?? 0,
            ],
            'unit' => [
                'name' => $unit?->name ?? 'Unit',
                'number' => $unit?->number ?? '',
                'unit_type' => $unit?->unit_type ?? '',
                'floor' => is_numeric($unit?->floor) ? (int) $unit->floor : null,
            ],
            'unit_category' => [
                'name' => $unit?->category?->name ?? '',
            ],
            'extras' => $folioItems
                ->where('item_type', 'extra')
                ->map(fn ($item): array => [
                    'name' => $item->description,
                    'price' => (float) $item->unit_price,
                ])
                ->values()
                ->all(),
        ];

        if ($includeDetails) {
            $presented['qr_code_url'] = $booking->qr_code && (
                filter_var($booking->qr_code, FILTER_VALIDATE_URL) ||
                str_contains($booking->qr_code, '/')
            )
                ? $this->publicImageUrl($booking->qr_code)
                : null;
            $presented['barcode_value'] = $booking->booking_ref ?? $booking->booking_reference;
            $presented['invoice_url'] = url('/bookings/'.$booking->id.'/invoice/download');
            $presented['cancellation_policy'] = (string) data_get(
                Tenant::current()?->settings,
                'booking.cancellation_policy',
                '',
            );
            $presented['branch'] = [
                ...$presented['branch'],
                'phone' => $branch?->phone,
                'email' => $branch?->email,
                'website' => null,
                'google_maps_url' => $branch?->google_maps_url === '#'
                    ? null
                    : $branch?->google_maps_url,
                'latitude' => $branch?->latitude,
                'longitude' => $branch?->longitude,
                'google_embed_url' => $branch?->google_embed_url,
                'amenities' => $this->presentAmenities($branch?->amenities ?? []),
            ];
            $presented['unit'] = [
                ...$presented['unit'],
                'capacity' => $unit?->capacity ?? 0,
                'child_capacity' => $unit?->child_capacity ?? 0,
                'images' => collect($unit?->images ?? [])
                    ->map(fn ($image): ?string => is_string($image) ? $this->publicImageUrl($image) : null)
                    ->filter()
                    ->values()
                    ->all(),
                'amenities' => $this->presentAmenities($unit?->amenities ?? []),
            ];
            $presented['folio_items'] = $folioItems
                ->map(fn ($item): array => [
                    'description' => $item->description,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'tax_rate' => (float) $item->tax_rate,
                    'item_type' => $item->item_type,
                ])
                ->values()
                ->all();
            $presented['payments'] = $booking->payments
                ->map(fn ($payment): array => [
                    'amount' => (float) $payment->amount,
                    'method' => $payment->method,
                    'status' => $payment->paid_at ? 'paid' : 'pending',
                    'created_at' => $payment->created_at?->toISOString(),
                ])
                ->values()
                ->all();
        }

        return $presented;
    }

    /**
     * @param  array<int, mixed>  $amenities
     * @return array<int, array{name: string, icon: string, color: string}>
     */
    private function presentAmenities(array $amenities): array
    {
        return collect($amenities)
            ->map(function ($amenity): ?array {
                if (is_string($amenity)) {
                    return ['name' => $amenity, 'icon' => 'sparkles', 'color' => 'teal'];
                }

                if (! is_array($amenity) || ! is_string($amenity['name'] ?? null)) {
                    return null;
                }

                return [
                    'name' => $amenity['name'],
                    'icon' => is_string($amenity['icon'] ?? null) ? $amenity['icon'] : 'sparkles',
                    'color' => is_string($amenity['color'] ?? null) ? $amenity['color'] : 'teal',
                ];
            })
            ->filter()
            ->values()
            ->all();
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
            'step' => ['nullable', 'in:details'],
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
                'id', 'branch_id', 'unit_type', 'number', 'name', 'floor',
                'base_price', 'price_weekend', 'capacity', 'child_capacity', 'amenities', 'images',
                'status', 'unit_category_id',
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
                'latitude' => $branch->latitude,
                'longitude' => $branch->longitude,
                'google_embed_url' => $branch->google_embed_url,
                'map_zoom_level' => $branch->map_zoom_level,
                'currency' => $branch->currency,
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
                'unit_type' => $unit->unit_type,
                'number' => $unit->number,
                'name' => $unit->name,
                'floor' => $unit->floor,
                'base_price' => $unit->base_price,
                'price_weekend' => $unit->price_weekend,
                'capacity' => $unit->capacity,
                'child_capacity' => $unit->child_capacity,
                'amenities' => $unit->amenities ?? [],
                'status' => $unit->status,
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
            'adults' => $data['adults'] ?? 1,
            'children' => $data['children'] ?? 0,
            'step' => $data['step'] ?? 'selection',
            'customerDetails' => $this->bookingCustomerDetails(),
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
            'customer_details' => ['required', 'array'],
            'customer_details.name' => ['required', 'string', 'max:255'],
            'customer_details.email' => ['required', 'email', 'max:255'],
            'customer_details.phone' => ['required', 'string', 'max:50'],
            'customer_details.date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'customer_details.gender' => ['nullable', 'in:male,female,other'],
            'customer_details.arrived_from' => ['required', 'string', 'max:255'],
            'customer_details.nationality' => ['required', 'string', 'max:100'],
            'customer_details.nid' => ['nullable', 'string', 'max:100'],
            'customer_details.occupation' => ['nullable', 'string', 'max:255'],
            'customer_details.organization' => ['nullable', 'string', 'max:255'],
            'customer_details.mailing_address' => ['required', 'string', 'max:2000'],
            'customer_details.purpose_of_visit' => ['nullable', 'in:tourist,business,official,others'],
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

        if ($data['adults'] > $units->sum('capacity')) {
            throw ValidationException::withMessages([
                'adults' => 'The selected rooms do not have enough adult capacity.',
            ]);
        }
        if ($data['children'] > $units->sum('child_capacity')) {
            throw ValidationException::withMessages([
                'children' => 'The selected rooms do not have enough child capacity.',
            ]);
        }

        $customer = $this->customer();
        $customerDetails = $data['customer_details'];
        $guestCount = $data['adults'] + $data['children'];
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
        $booking = DB::transaction(function () use ($data, $customer, $customerDetails, $unitIds, $guestNamesByRoom, $branch, $conflicts, $calculator, $pricedExtras): Booking {
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

            $customerProfile = [
                'name' => $customerDetails['name'],
                'email' => $customerDetails['email'],
                'phone' => $customerDetails['phone'],
                'date_of_birth' => $customerDetails['date_of_birth'] ?? null,
                'gender' => $customerDetails['gender'] ?? null,
                'nationality' => $customerDetails['nationality'],
                'arrived_from' => $customerDetails['arrived_from'],
                'occupation' => $customerDetails['occupation'] ?? null,
                'organization' => $customerDetails['organization'] ?? null,
                'purpose_of_visit' => $customerDetails['purpose_of_visit'] ?? null,
                'address' => array_merge($customer->address ?? [], [
                    'line1' => $customerDetails['mailing_address'],
                ]),
            ];
            if (filled($customerDetails['nid'] ?? null)) {
                $customerProfile['id_type'] = 'nid';
                $customerProfile['id_number'] = $customerDetails['nid'];
            }
            $customer->update($customerProfile);

            $booking = Booking::create([
                'branch_id' => $branch->id,
                'unit_id' => $unitIds->first(),
                'check_in' => $data['check_in'],
                'check_out' => $data['check_out'],
                'adults' => $data['adults'],
                'children' => $data['children'],
                'special_requests' => $data['special_requests'] ?? null,
                'tenant_id' => $branch->tenant_id,
                'customer_id' => $customer->id,
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

    /**
     * @return array{name: string, email: string, phone: string, date_of_birth: string, gender: string, arrived_from: string, nationality: string, nid: string, occupation: string, organization: string, mailing_address: string, purpose_of_visit: string}
     */
    private function bookingCustomerDetails(): array
    {
        $customer = auth('customer')->user();
        $address = $customer?->address ?? [];
        $gender = strtolower($customer?->gender ?? '');

        return [
            'name' => $customer?->name ?? '',
            'email' => $customer?->email ?? '',
            'phone' => $customer?->phone ?? '',
            'date_of_birth' => $customer?->date_of_birth?->format('Y-m-d') ?? '',
            'gender' => in_array($gender, ['male', 'female', 'other'], true) ? $gender : '',
            'arrived_from' => $customer?->arrived_from ?? '',
            'nationality' => $customer?->nationality ?? '',
            'nid' => $customer?->id_type === 'nid' ? ($customer->id_number ?? '') : '',
            'occupation' => $customer?->occupation ?? '',
            'organization' => $customer?->organization ?? '',
            'mailing_address' => $address['line1'] ?? '',
            'purpose_of_visit' => $customer?->purpose_of_visit ?? '',
        ];
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
