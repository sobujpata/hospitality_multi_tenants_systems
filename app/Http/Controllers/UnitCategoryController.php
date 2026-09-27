<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\UnitCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UnitCategoryController extends Controller
{
    public function index(): Response
    {
        $this->ensureTenantOwner();

        return Inertia::render('room-category/index', [
            'categories' => UnitCategory::query()->orderBy('name')->get([
                'id',
                'name',
                'unit_type',
                'description',
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureTenantOwner();
        UnitCategory::create([
            ...$this->validatedData($request),
            'tenant_id' => Tenant::current()->getKey(),
        ]);

        return back()->with('status', 'Unit category created.');
    }

    public function update(Request $request, UnitCategory $unitCategory): RedirectResponse
    {
        $this->ensureTenantOwner();
        $unitCategory->update($this->validatedData($request, $unitCategory));

        return back()->with('status', 'Unit category updated.');
    }

    public function destroy(UnitCategory $unitCategory): RedirectResponse
    {
        $this->ensureTenantOwner();
        $unitCategory->delete();

        return back()->with('status', 'Unit category deleted.');
    }

    /**
     * @return array{name: string, unit_type: string, description?: string|null}
     */
    private function validatedData(Request $request, ?UnitCategory $unitCategory = null): array
    {
        $tenantId = Tenant::current()->getKey();

        return $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('unit_categories', 'name')
                    ->where('tenant_id', $tenantId)
                    ->ignore($unitCategory?->getKey()),
            ],
            'unit_type' => ['required', Rule::in(['room', 'table', 'villa', 'desk'])],
            'description' => ['nullable', 'string'],
        ]);
    }

    private function ensureTenantOwner(): void
    {
        abort_unless(request()->user()?->hasRole('Tenant Owner'), 403);
    }
}
