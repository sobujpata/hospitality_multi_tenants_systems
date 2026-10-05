<?php

namespace App\Http\Controllers;

use App\Models\Amenity;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\UnitCategory;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UnitController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureManager();
        $user = $request->user();
        $canManageAllBranches = $this->canManageAllBranches($user instanceof User ? $user : null);
        $branchId = $canManageAllBranches ? null : $user?->branch_id;

        return Inertia::render('units/index', [
            'units' => Unit::query()
                ->with('category:id,name')
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->where('branch_id', $branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('floor')
                ->orderBy('number')
                ->get()
                ->map(function (Unit $unit): Unit {
                    $unit->setAttribute(
                        'image_urls',
                        collect($unit->images ?? [])
                            ->map(fn (string $image): ?string => $this->imageUrl($image))
                            ->filter()
                            ->values()
                            ->all(),
                    );

                    return $unit;
                }),
            'categories' => UnitCategory::query()->orderBy('name')->get(['id', 'name', 'unit_type']),
            'amenities' => Amenity::query()->orderBy('name')->get(['id', 'name']),
            'branches' => Branch::query()
                ->when(! $canManageAllBranches, fn ($query) => $branchId !== null
                    ? $query->whereKey($branchId)
                    : $query->whereRaw('1 = 0'))
                ->orderBy('name')
                ->get(['id', 'name']),
            'currentBranchId' => $branchId,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureManager();
        Unit::create($this->validatedData($request));

        return back()->with('status', 'Unit created.');
    }

    public function update(Request $request, string $tenant, Unit $unit): RedirectResponse
    {
        $this->ensureManager();
        $this->assertBranchAccess($unit);
        $unit->update($this->validatedData($request, $unit));

        return back()->with('status', 'Unit updated.');
    }

    public function destroy(string $tenant, Unit $unit): RedirectResponse
    {
        $this->ensureManager();
        $this->assertBranchAccess($unit);
        $unit->delete();

        return back()->with('status', 'Unit deleted.');
    }

    public function bulkStatus(Request $request): RedirectResponse
    {
        $this->ensureManager();
        $data = $request->validate([
            'unit_ids' => ['required', 'array', 'min:1'],
            'unit_ids.*' => ['integer', 'distinct'],
            'status' => ['required', Rule::in(['available', 'occupied', 'maintenance', 'reserved'])],
        ]);
        $units = Unit::query()->whereIn('id', $data['unit_ids'])->get(['id', 'branch_id']);
        abort_unless($units->count() === count($data['unit_ids']), 404);
        foreach ($units as $unit) {
            $this->assertBranchAccess($unit);
        }
        Unit::query()->whereIn('id', $data['unit_ids'])->update(['status' => $data['status']]);

        return back()->with('status', 'Unit statuses updated.');
    }

    /** @return array<string, mixed> */
    private function validatedData(Request $request, ?Unit $unit = null): array
    {
        if ($request->boolean('amenities_present') && ! $request->exists('amenities')) {
            $request->merge(['amenities' => []]);
        }

        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'unit_type' => ['required', Rule::in(['room', 'table', 'villa', 'desk'])],
            'number' => ['required', 'string', 'max:50'],
            'name' => ['required', 'string', 'max:255'],
            'floor' => ['nullable', 'string', 'max:50'],
            'capacity' => ['required', 'integer', 'min:1'],
            'child_capacity' => ['nullable', 'integer', 'min:0'],
            'base_price' => ['required', 'numeric', 'min:0'],
            'price_weekend' => ['nullable', 'numeric', 'min:0'],
            'amenities' => ['nullable', 'array'],
            'amenities.*' => [
                'required',
                'string',
                Rule::exists('amenities', 'name')
                    ->where('tenant_id', Tenant::current()->getKey()),
            ],
            'images' => ['nullable', 'array'],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'status' => ['required', Rule::in(['available', 'occupied', 'maintenance', 'reserved'])],
            'unit_category_id' => ['nullable', 'integer', 'exists:unit_categories,id'],
        ]);
        $branch = Branch::findOrFail($data['branch_id']);
        $user = request()->user();
        abort_unless(
            $this->canManageAllBranches($user instanceof User ? $user : null)
                || ($user?->branch_id !== null && (int) $user->branch_id === (int) $branch->getKey()),
            403,
        );
        if (! empty($data['unit_category_id'])) {
            UnitCategory::findOrFail($data['unit_category_id']);
        }
        $uploadedImages = collect($data['images'] ?? [])
            ->map(function (UploadedFile $image): string {
                $path = $image->store('rooms', 'public');

                if (! is_string($path) || $path === '') {
                    throw new \RuntimeException('Room image upload failed.');
                }

                return $path;
            })
            ->all();
        $data['images'] = array_values(array_merge($unit?->images ?? [], $uploadedImages));
        $data['amenities'] = $data['amenities'] ?? ($unit?->amenities ?? []);
        $data['tenant_id'] = Tenant::current()->getKey();

        return $data;
    }

    private function imageUrl(string $image): ?string
    {
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

    private function ensureManager(): void
    {
        abort_unless(
            request()->user()?->is_super_admin
                || request()->user()?->hasAnyRole(['Tenant Admin', 'Tenant Owner', 'Branch Manager', 'Receptionist', 'Housekeeping']),
            403,
        );
    }

    private function canManageAllBranches(?User $user): bool
    {
        return $user !== null
            && ($user->is_super_admin || $user->hasAnyRole(['Tenant Admin', 'Tenant Owner']));
    }

    private function assertBranchAccess(Unit $unit): void
    {
        $user = request()->user();
        abort_unless(
            $this->canManageAllBranches($user instanceof User ? $user : null)
                || ($user?->branch_id !== null && (int) $user->branch_id === (int) $unit->branch_id),
            403,
        );
    }
}
