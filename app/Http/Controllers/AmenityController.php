<?php

namespace App\Http\Controllers;

use App\Models\Amenity;
use App\Models\Branch;
use App\Models\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AmenityController extends Controller
{
    public function index(): Response
    {
        $this->ensureTenantOwner();

        return Inertia::render('amenities/index', [
            'amenities' => Amenity::query()
                ->with('branch:id,name')
                ->orderBy('branch_id')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get([
                    'id',
                    'branch_id',
                    'name',
                    'icon_type',
                    'icon_value',
                    'category',
                    'color',
                    'is_active',
                    'sort_order',
                ])
                ->map(fn (Amenity $amenity): array => [
                    'id' => $amenity->id,
                    'branch_id' => $amenity->branch_id,
                    'branch' => $amenity->branch
                        ? ['id' => $amenity->branch->id, 'name' => $amenity->branch->name]
                        : null,
                    'name' => $amenity->name,
                    'icon_type' => $amenity->icon_type,
                    'icon_value' => $amenity->icon_value,
                    'category' => $amenity->category,
                    'color' => $amenity->color,
                    'is_active' => (bool) $amenity->is_active,
                    'sort_order' => (int) $amenity->sort_order,
                ])
                ->values(),
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureTenantOwner();
        Amenity::create([
            ...$this->validatedData($request),
            'tenant_id' => Tenant::current()->getKey(),
        ]);

        return back()->with('status', 'Amenity created.');
    }

    public function update(Request $request): RedirectResponse
    {
        $this->ensureTenantOwner();
        $amenity = $this->amenityFromRoute($request);
        $amenity->update($this->validatedData($request, $amenity));

        return back()->with('status', 'Amenity updated.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $this->ensureTenantOwner();
        $amenity = $this->amenityFromRoute($request);
        $amenity->delete();

        return back()->with('status', 'Amenity deleted.');
    }

    private function amenityFromRoute(Request $request): Amenity
    {
        $routeAmenity = $request->route('amenity');

        if ($routeAmenity instanceof Amenity) {
            return $routeAmenity;
        }

        abort_unless(is_string($routeAmenity) || is_int($routeAmenity), 404);

        return Amenity::query()->findOrFail($routeAmenity);
    }

    /**
     * @return array{
     *     branch_id: int,
     *     name: string,
     *     icon_type: string,
     *     icon_value: string,
     *     category: string,
     *     color: string,
     *     is_active: bool,
     *     sort_order: int
     * }
     */
    private function validatedData(Request $request, ?Amenity $amenity = null): array
    {
        $tenantId = Tenant::current()->getKey();
        $data = $request->validate([
            'branch_id' => [
                'required',
                'integer',
                Rule::exists('branches', 'id')->where('tenant_id', $tenantId),
            ],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('amenities', 'name')
                    ->where('tenant_id', $tenantId)
                    ->where('branch_id', $request->input('branch_id'))
                    ->ignore($amenity?->getKey()),
            ],
            'icon_type' => ['required', 'string', 'max:255'],
            'icon_value' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:255'],
            'color' => ['required', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'is_active' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer'],
        ]);

        $data['branch_id'] = (int) $data['branch_id'];
        $data['is_active'] = (bool) $data['is_active'];
        $data['sort_order'] = (int) $data['sort_order'];

        return $data;
    }

    private function ensureTenantOwner(): void
    {
        abort_unless(request()->user()?->hasRole('Tenant Owner'), 403);
    }
}
