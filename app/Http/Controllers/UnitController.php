<?php

namespace App\Http\Controllers;

use App\Models\Amenity;
use App\Models\Branch;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\UnitCategory;
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
        $branchId = $request->integer('branch_id') ?: session('branch_id');

        return Inertia::render('units/index', [
            'units' => Unit::query()
                ->with('category:id,name')
                ->when($branchId, fn ($query) => $query->where('branch_id', $branchId))
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
            'branches' => Branch::query()->orderBy('name')->get(['id', 'name']),
            'currentBranchId' => $branchId,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureManager();
        Unit::create($this->validatedData($request));

        return back()->with('status', 'Unit created.');
    }

    public function update(Request $request, Unit $unit): RedirectResponse
    {
        $this->ensureManager();
        $unit->update($this->validatedData($request));

        return back()->with('status', 'Unit updated.');
    }

    public function destroy(Unit $unit): RedirectResponse
    {
        $this->ensureManager();
        $unit->delete();

        return back()->with('status', 'Unit deleted.');
    }

    public function bulkStatus(Request $request): RedirectResponse
    {
        $this->ensureManager();
        $data = $request->validate([
            'unit_ids' => ['required', 'array', 'min:1'],
            'unit_ids.*' => ['integer'],
            'status' => ['required', Rule::in(['available', 'occupied', 'maintenance', 'reserved'])],
        ]);
        Unit::query()->whereIn('id', $data['unit_ids'])->update(['status' => $data['status']]);

        return back()->with('status', 'Unit statuses updated.');
    }

    /** @return array<string, mixed> */
    private function validatedData(Request $request): array
    {
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
        abort_unless(
            request()->user()?->branch_id === null
                || (int) request()->user()->branch_id === $branch->getKey(),
            403,
        );
        if (! empty($data['unit_category_id'])) {
            UnitCategory::findOrFail($data['unit_category_id']);
        }
        $data['images'] = collect($data['images'] ?? [])
            ->map(function (UploadedFile $image): string {
                $path = $image->store('rooms', 'public');

                if (! is_string($path) || $path === '') {
                    throw new \RuntimeException('Room image upload failed.');
                }

                return $path;
            })
            ->all();
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
                || request()->user()?->hasAnyRole(['Tenant Owner', 'Branch Manager', 'Receptionist', 'Housekeeping']),
            403,
        );
    }
}
