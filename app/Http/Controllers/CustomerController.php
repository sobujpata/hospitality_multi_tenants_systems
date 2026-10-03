<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\FolioItem;
use App\Models\FolioPayment;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use App\Services\BookingConflictDetectionService;
use App\Services\PriceCalculator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $this->ensureStaff();
        $tenantId = Tenant::current()->getKey();
        $branchRestricted = $this->isBranchRestricted($user);
        $branchId = $this->staffBranchId($user);
        $scopedBranchId = $branchRestricted ? $branchId : (session('branch_id') !== null ? (int) session('branch_id') : null);
        $search = trim((string) $request->string('search'));
        $customers = Customer::query()
            ->where('tenant_id', $tenantId)
            ->when($branchRestricted || $scopedBranchId !== null, fn ($query) => $query->whereIn(
                'id',
                Booking::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->when($scopedBranchId, fn ($bookings) => $bookings->where('branch_id', $scopedBranchId), fn ($bookings) => $bookings->whereRaw('1 = 0'))
                    ->select('customer_id'),
            ))
            ->when($search !== '', fn ($query) => $query->where(fn ($matches) => $matches
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('phone', 'like', "%{$search}%")))
            ->orderByDesc('created_at')->orderByDesc('id')->paginate(20)->withQueryString();

        $latestBookings = Booking::withoutGlobalScopes()
            ->with('branch:id,name')
            ->where('tenant_id', $tenantId)
            ->whereIn('customer_id', $customers->getCollection()->pluck('id'))
            ->when($scopedBranchId !== null, fn ($query) => $query->where('branch_id', $scopedBranchId))
            ->orderByDesc('created_at')->get(['id', 'customer_id', 'branch_id', 'check_in'])
            ->unique('customer_id')->keyBy('customer_id');
        $customers->getCollection()->transform(function (Customer $customer) use ($latestBookings): array {
            return [
                ...$customer->toArray(),
                'latest_booking' => $latestBookings->get($customer->id) === null ? null : [
                    'check_in' => $latestBookings->get($customer->id)->check_in?->toDateString(),
                    'branch_name' => $latestBookings->get($customer->id)->branch?->name,
                ],
            ];
        });

        $branches = Branch::query()
            ->where('is_active', true)
            ->when($branchRestricted, fn ($query) => $branchId ? $query->whereKey($branchId) : $query->whereRaw('1 = 0'))
            ->when(! $branchRestricted && $scopedBranchId !== null, fn ($query) => $query->whereKey($scopedBranchId))
            ->orderBy('name')->get(['id', 'name', 'currency']);
        $units = Unit::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('unit_type', 'room')
            ->where('status', 'available')
            ->when($branchRestricted, fn ($query) => $branchId ? $query->where('branch_id', $branchId) : $query->whereRaw('1 = 0'))
            ->when(! $branchRestricted && $scopedBranchId !== null, fn ($query) => $query->where('branch_id', $scopedBranchId))
            ->orderBy('number')->get(['id', 'branch_id', 'number', 'name', 'capacity', 'child_capacity', 'base_price', 'price_weekend']);

        return Inertia::render('customers/index', [
            'customers' => $customers,
            'search' => $search,
            'branches' => $branches,
            'units' => $units,
            'branchRestricted' => $branchRestricted,
        ]);
    }

    public function show(string $tenant, Customer $customer): Response
    {
        $user = $this->ensureStaff();
        $this->assertCustomerAccess($customer, $user);
        $tenantId = Tenant::current()->getKey();
        $branchId = $this->isBranchRestricted($user) ? $this->staffBranchId($user) : (session('branch_id') !== null ? (int) session('branch_id') : null);
        $bookings = Booking::withoutGlobalScopes()
            ->with([
                'branch:id,name,currency',
                'unit:id,number,name,floor',
                'rooms:id,number,name,floor',
                'folioItems:id,booking_id,description,quantity,unit_price,tax_rate,discount,item_type',
                'payments:id,booking_id,amount,method,reference,paid_at',
                'assignedStaff:id,name',
                'creator:id,name',
            ])
            ->where('tenant_id', $tenantId)
            ->where('customer_id', $customer->getKey())
            ->when($this->isBranchRestricted($user) || $branchId !== null, fn ($query) => $branchId
                ? $query->where('branch_id', $branchId)
                : $query->whereRaw('1 = 0'))
            ->orderByDesc('check_in')->orderByDesc('created_at')->get([
                'id', 'tenant_id', 'customer_id', 'branch_id', 'unit_id', 'booking_ref', 'booking_reference',
                'type', 'check_in', 'check_out', 'adults', 'children', 'total_amount', 'currency',
                'status', 'source', 'special_requests', 'created_by', 'assigned_staff_id', 'created_at',
            ]);

        return Inertia::render('customers/show', [
            'customer' => $customer,
            'bookings' => $bookings,
            'totalSpent' => $bookings->sum(fn (Booking $booking): float => (float) $booking->payments->sum('amount')),
            'duplicates' => Customer::query()->where('tenant_id', $tenantId)->whereKeyNot($customer->getKey())
                ->where(fn ($query) => $query->where('email', $customer->email)->orWhere('phone', $customer->phone))
                ->when($this->isBranchRestricted($user) || $branchId !== null, fn ($query) => $query->whereIn(
                    'id',
                    Booking::withoutGlobalScopes()->where('tenant_id', $tenantId)
                        ->when($branchId, fn ($bookings) => $bookings->where('branch_id', $branchId), fn ($bookings) => $bookings->whereRaw('1 = 0'))
                        ->select('customer_id'),
                ))
                ->limit(10)->get(['id', 'name', 'email', 'phone']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureStaff();
        Customer::create($this->validatedData($request));

        return to_route('customers.index')->with('status', 'Customer created.');
    }

    public function storeWalkInBooking(
        Request $request,
        BookingConflictDetectionService $conflicts,
        PriceCalculator $calculator,
    ): RedirectResponse {
        $user = $this->ensureStaff();
        $tenantId = Tenant::current()->getKey();
        $branchRestricted = $this->isBranchRestricted($user);
        $assignedBranchId = $this->staffBranchId($user);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'id_type' => ['nullable', Rule::in(['passport', 'nid', 'driving_license'])],
            'id_number' => ['nullable', 'string', 'max:100'],
            'arrived_from' => ['nullable', 'string', 'max:255'],
            'occupation' => ['nullable', 'string', 'max:255'],
            'organization' => ['nullable', 'string', 'max:255'],
            'purpose_of_visit' => ['nullable', Rule::in(['tourist', 'business', 'official', 'others'])],
            'address_line' => ['nullable', 'string', 'max:2000'],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'unit_id' => ['required', 'integer', 'exists:units,id'],
            'check_in' => ['required', 'date', 'after_or_equal:today'],
            'check_out' => ['required', 'date', 'after:check_in'],
            'adults' => ['required', 'integer', 'min:1'],
            'children' => ['nullable', 'integer', 'min:0'],
            'status' => ['required', Rule::in(['confirmed', 'checked_in'])],
            'payment_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['required_with:payment_amount', Rule::in(['cash', 'card', 'bank_transfer', 'mobile_money'])],
            'payment_reference' => ['nullable', 'string', 'max:255'],
            'special_requests' => ['nullable', 'string', 'max:2000'],
        ]);

        $branch = Branch::query()->findOrFail($data['branch_id']);
        abort_unless((int) $branch->tenant_id === (int) $tenantId, 404);
        abort_unless(! $branchRestricted || (int) $branch->id === (int) $assignedBranchId, 403);
        if (session('branch_id') !== null) {
            abort_unless((int) session('branch_id') === (int) $branch->id, 403);
        }

        $unit = Unit::withoutGlobalScopes()
            ->where('tenant_id', $tenantId)
            ->where('branch_id', $branch->id)
            ->where('unit_type', 'room')
            ->where('status', 'available')
            ->findOrFail($data['unit_id']);
        if ((int) $data['adults'] > (int) $unit->capacity) {
            throw ValidationException::withMessages(['adults' => 'This room does not have enough adult capacity.']);
        }
        if ((int) ($data['children'] ?? 0) > (int) $unit->child_capacity) {
            throw ValidationException::withMessages(['children' => 'This room does not have enough child capacity.']);
        }
        if ($data['status'] === 'checked_in' && $data['check_in'] !== now()->toDateString()) {
            throw ValidationException::withMessages(['status' => 'A guest can only be checked in on today’s arrival date.']);
        }

        $pricing = $calculator->calculate(
            (int) $unit->id,
            $data['check_in'],
            $data['check_out'],
        );
        $paymentAmount = (float) ($data['payment_amount'] ?? 0);
        if ($paymentAmount > $pricing['total']) {
            throw ValidationException::withMessages(['payment_amount' => 'Payment cannot be greater than the booking total.']);
        }

        DB::transaction(function () use ($data, $user, $tenantId, $unit, $branch, $conflicts, $pricing, $paymentAmount): void {
            $conflicts->assertAvailable((int) $unit->id, $data['check_in'], $data['check_out']);

            $customerQuery = Customer::query()->where('tenant_id', $tenantId);
            $customer = null;
            if (filled($data['email'] ?? null)) {
                $customer = (clone $customerQuery)->whereRaw('LOWER(email) = ?', [strtolower($data['email'])])->lockForUpdate()->first();
            }
            if ($customer === null) {
                $customer = (clone $customerQuery)->where('phone', $data['phone'])->lockForUpdate()->first();
            }
            if ($customer?->blacklisted) {
                throw ValidationException::withMessages(['phone' => 'This customer is marked as blacklisted. Please ask a manager for help.']);
            }

            if ($customer === null) {
                $customer = Customer::create([
                    'tenant_id' => $tenantId,
                    'name' => $data['name'],
                    'email' => $data['email'] ?? null,
                    'phone' => $data['phone'],
                    'nationality' => $data['nationality'] ?? null,
                    'date_of_birth' => $data['date_of_birth'] ?? null,
                    'gender' => $data['gender'] ?? null,
                    'id_type' => $data['id_type'] ?? null,
                    'id_number' => $data['id_number'] ?? null,
                    'arrived_from' => $data['arrived_from'] ?? null,
                    'occupation' => $data['occupation'] ?? null,
                    'organization' => $data['organization'] ?? null,
                    'purpose_of_visit' => $data['purpose_of_visit'] ?? null,
                    'address' => filled($data['address_line'] ?? null) ? ['line1' => $data['address_line']] : null,
                    'vip_level' => 'standard',
                    'source' => 'walk-in',
                ]);
            } else {
                $customerData = [
                    'name' => $data['name'],
                    'phone' => $data['phone'],
                    'email' => $data['email'] ?? $customer->email,
                    'nationality' => $data['nationality'] ?? $customer->nationality,
                ];
                foreach ([
                    'date_of_birth', 'gender', 'id_type', 'id_number', 'arrived_from',
                    'occupation', 'organization', 'purpose_of_visit',
                ] as $profileField) {
                    if (filled($data[$profileField] ?? null)) {
                        $customerData[$profileField] = $data[$profileField];
                    }
                }
                if (filled($data['address_line'] ?? null)) {
                    $customerData['address'] = array_merge($customer->address ?? [], [
                        'line1' => $data['address_line'],
                    ]);
                }
                $customer->update($customerData);
            }

            $booking = Booking::create([
                'tenant_id' => $tenantId,
                'customer_id' => $customer->id,
                'branch_id' => $branch->id,
                'unit_id' => $unit->id,
                'type' => 'walk_in',
                'check_in' => $data['check_in'],
                'check_out' => $data['check_out'],
                'adults' => $data['adults'],
                'children' => $data['children'] ?? 0,
                'total_amount' => $pricing['total'],
                'currency' => $pricing['currency'],
                'status' => $data['status'],
                'source' => 'front_desk',
                'assigned_staff_id' => $user->id,
                'created_by' => $user->id,
                'special_requests' => $data['special_requests'] ?? null,
            ]);

            FolioItem::create([
                'booking_id' => $booking->id,
                'tenant_id' => $tenantId,
                'description' => 'Room accommodation',
                'quantity' => $pricing['nights'],
                'unit_price' => $pricing['nights'] > 0 ? $pricing['total'] / $pricing['nights'] : 0,
                'tax_rate' => 0,
                'discount' => 0,
                'tax_type' => 'VAT',
                'item_type' => 'room_charge',
            ]);

            if ($paymentAmount > 0) {
                FolioPayment::create([
                    'booking_id' => $booking->id,
                    'tenant_id' => $tenantId,
                    'amount' => $paymentAmount,
                    'method' => $data['payment_method'],
                    'reference' => $data['payment_reference'] ?? null,
                    'paid_at' => now(),
                ]);
            }

            if ($booking->status === 'checked_in') {
                $unit->update(['status' => 'occupied']);
            }
        });

        return to_route('customers.index')->with('status', 'Walk-in booking created.');
    }

    public function update(Request $request, string $tenant, Customer $customer): RedirectResponse
    {
        $this->assertCustomerAccess($customer, $this->ensureStaff());
        $customer->update($this->validatedData($request));

        return back()->with('status', 'Customer updated.');
    }

    public function uploadDocument(Request $request, string $tenant, Customer $customer): RedirectResponse
    {
        $this->assertCustomerAccess($customer, $this->ensureStaff());
        $data = $request->validate(['document' => ['required', 'file', 'image', 'max:5120'], 'label' => ['required', 'string', 'max:100']]);
        $path = $data['document']->store('customers/'.$customer->getKey().'/documents', 'local');
        $documents = $customer->documents ?? [];
        $documents[] = ['label' => $data['label'], 'path' => $path, 'uploaded_at' => now()->toISOString()];
        $customer->update(['documents' => $documents]);

        return back()->with('status', 'Document uploaded.');
    }

    public function merge(Request $request, string $tenant, Customer $customer): RedirectResponse
    {
        $user = $this->ensureStaff();
        $this->assertCustomerAccess($customer, $user);
        $data = $request->validate(['source_id' => ['required', 'integer']]);
        $source = Customer::query()->where('tenant_id', Tenant::current()->getKey())->findOrFail($data['source_id']);
        $this->assertCustomerAccess($source, $user);
        abort_if($source->is($customer), 422, 'A customer cannot be merged into itself.');
        DB::transaction(function () use ($customer, $source): void {
            $customer->increment('loyalty_points', $source->loyalty_points);
            $customer->update([
                'tags' => array_values(array_unique(array_merge($customer->tags ?? [], $source->tags ?? []))),
                'notes' => trim(implode("\n\n", array_filter([$customer->notes, $source->notes]))),
                'documents' => array_merge($customer->documents ?? [], $source->documents ?? []),
            ]);
            $source->delete();
        });

        return to_route('customers.show', $customer)->with('status', 'Customer records merged.');
    }

    /** @return array<string, mixed> */
    private function validatedData(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'], 'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'], 'nationality' => ['nullable', 'string', 'max:100'],
            'id_type' => ['nullable', Rule::in(['passport', 'nid', 'driving_license'])], 'id_number' => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'], 'gender' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'array'], 'tags' => ['nullable', 'array'], 'loyalty_points' => ['nullable', 'integer', 'min:0'],
            'vip_level' => ['required', Rule::in(['standard', 'silver', 'gold', 'platinum'])], 'notes' => ['nullable', 'string'],
            'source' => ['required', Rule::in(['walk-in', 'booking.com', 'website', 'phone'])],
            'blacklisted' => ['boolean'], 'blacklist_reason' => ['nullable', 'string'],
        ]);
        $data['tenant_id'] = Tenant::current()->getKey();

        return $data;
    }

    private function ensureStaff(): User
    {
        $user = request()->user();
        abort_unless($user instanceof User && ($user->is_super_admin || $user->hasAnyRole(['Tenant Owner', 'Tenant Admin', 'Branch Manager', 'Receptionist'])), 403);

        return $user;
    }

    private function isBranchRestricted(User $user): bool
    {
        return ! $user->is_super_admin
            && ! $user->hasAnyRole(['Tenant Owner', 'Tenant Admin'])
            && $user->hasAnyRole(['Branch Manager', 'Receptionist']);
    }

    private function staffBranchId(User $user): ?int
    {
        $branchId = $user->branch_id ?? session('branch_id');

        return $branchId !== null ? (int) $branchId : null;
    }

    private function assertCustomerAccess(Customer $customer, User $user): void
    {
        $tenantId = Tenant::current()->getKey();
        abort_unless((int) $customer->tenant_id === (int) $tenantId, 404);

        $branchId = $this->isBranchRestricted($user) ? $this->staffBranchId($user) : (session('branch_id') !== null ? (int) session('branch_id') : null);
        if ($this->isBranchRestricted($user) || $branchId !== null) {
            abort_unless($branchId !== null && Booking::withoutGlobalScopes()
                ->where('tenant_id', $tenantId)
                ->where('branch_id', $branchId)
                ->where('customer_id', $customer->getKey())
                ->exists(), 404);
        }
    }
}
