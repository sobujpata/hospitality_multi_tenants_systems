<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureStaff();
        $search = trim((string) $request->string('search'));
        $customers = Customer::query()
            ->when($search !== '', fn ($query) => $query->whereFullText(['name', 'email', 'phone'], $search, ['mode' => 'boolean']))
            ->latest()->paginate(20)->withQueryString();

        return Inertia::render('customers/index', ['customers' => $customers, 'search' => $search]);
    }

    public function show(Customer $customer): Response
    {
        $this->ensureStaff();

        return Inertia::render('customers/show', [
            'customer' => $customer,
            'bookingHistory' => [],
            'totalSpent' => 0,
            'duplicates' => Customer::query()->whereKeyNot($customer->getKey())
                ->where(fn ($query) => $query->where('email', $customer->email)->orWhere('phone', $customer->phone))
                ->limit(10)->get(['id', 'name', 'email', 'phone']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureStaff();
        Customer::create($this->validatedData($request));

        return to_route('customers.index')->with('status', 'Customer created.');
    }

    public function update(Request $request, Customer $customer): RedirectResponse
    {
        $this->ensureStaff();
        $customer->update($this->validatedData($request));

        return back()->with('status', 'Customer updated.');
    }

    public function uploadDocument(Request $request, Customer $customer): RedirectResponse
    {
        $this->ensureStaff();
        $data = $request->validate(['document' => ['required', 'file', 'image', 'max:5120'], 'label' => ['required', 'string', 'max:100']]);
        $path = $data['document']->store('customers/'.$customer->getKey().'/documents', 's3');
        $documents = $customer->documents ?? [];
        $documents[] = ['label' => $data['label'], 'path' => $path, 'uploaded_at' => now()->toISOString()];
        $customer->update(['documents' => $documents]);

        return back()->with('status', 'Document uploaded.');
    }

    public function merge(Request $request, Customer $customer): RedirectResponse
    {
        $this->ensureStaff();
        $data = $request->validate(['source_id' => ['required', 'integer']]);
        $source = Customer::findOrFail($data['source_id']);
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

    private function ensureStaff(): void
    {
        abort_unless(request()->user()?->is_super_admin || request()->user()?->hasAnyRole(['Tenant Owner', 'Branch Manager', 'Receptionist']), 403);
    }
}
