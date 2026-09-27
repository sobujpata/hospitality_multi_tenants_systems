<?php

namespace App\Http\Controllers;

use App\Models\Amenity;
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
            'amenities' => Amenity::query()->orderBy('name')->get(['id', 'name']),
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

    public function update(Request $request, Amenity $amenity): RedirectResponse
    {
        $this->ensureTenantOwner();
        $amenity->update($this->validatedData($request, $amenity));

        return back()->with('status', 'Amenity updated.');
    }

    public function destroy(Amenity $amenity): RedirectResponse
    {
        $this->ensureTenantOwner();
        $amenity->delete();

        return back()->with('status', 'Amenity deleted.');
    }

    /** @return array{name: string} */
    private function validatedData(Request $request, ?Amenity $amenity = null): array
    {
        return $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('amenities', 'name')
                    ->where('tenant_id', Tenant::current()->getKey())
                    ->ignore($amenity?->getKey()),
            ],
        ]);
    }

    private function ensureTenantOwner(): void
    {
        abort_unless(request()->user()?->hasRole('Tenant Owner'), 403);
    }
}
