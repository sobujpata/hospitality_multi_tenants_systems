<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BranchController extends Controller
{
    public function index(): Response
    {
        $this->ensureManager();

        $user = request()->user();
        $branches = Branch::query()
            ->when($user?->branch_id, fn ($query, $branchId) => $query->whereKey($branchId))
            ->latest()
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('branches/index', [
            'branches' => $branches,
            'currentBranchId' => session('branch_id'),
            'settingsBranch' => request()->integer('settings_branch_id')
                ? Branch::find(request()->integer('settings_branch_id'))
                : null,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->ensureManager();

        $user = $request->user();

        $tenantId = Tenant::current()?->getKey();

        if (! $tenantId) {
            abort(403, 'No active tenant found.');
        }
        // dd($request->all());
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:hotel,restaurant,resort,hostel',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'timezone' => 'required|string',
            'currency' => 'required|string|size:3',
            'star_rating' => 'nullable|integer|min:1|max:5',
            'amenities' => 'nullable|array',
            'is_active' => ['nullable', 'in:true,false'],
            'cover_image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        // dd($validated);
        $coverImagePath = null;

        if ($request->hasFile('cover_image')) {
            $coverImagePath = $request->file('cover_image')->store(
                'branches',
                'public'
            );
        }

        // dd($validated, $coverImagePath);

        Branch::create([
            'tenant_id' => $tenantId,

            'name' => $validated['name'],
            'type' => $validated['type'],

            'address' => $validated['address'] ?? null,
            'city' => $validated['city'] ?? null,
            'country' => $validated['country'] ?? null,

            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,

            'timezone' => $validated['timezone'],
            'currency' => strtoupper($validated['currency']),

            'star_rating' => $validated['star_rating'] ?? null,

            'amenities' => $validated['amenities'] ?? [],

            'is_active' => filter_var(
                $validated['is_active'] ?? false,
                FILTER_VALIDATE_BOOLEAN
            ) ? 1 : 0,

            'cover_image' => $coverImagePath,
        ]);

        return back()->with('status', 'Branch created successfully.');
    }

    public function update(Request $request, Branch $branch): RedirectResponse
    {
        $this->ensureManager();
        $this->ensureTenantBranch($branch);
        $branch->update($this->validatedData($request, $branch));

        return back()->with('status', 'Branch updated.');
    }

    public function destroy(Branch $branch): RedirectResponse
    {
        $this->ensureManager();
        $this->ensureTenantBranch($branch);
        $branch->delete();

        return back()->with('status', 'Branch deleted.');
    }

    public function switch(Request $request): RedirectResponse
    {
        $branchId = $request->validate(['branch_id' => ['nullable', 'integer']])['branch_id'] ?? null;
        $user = $request->user();

        if ($branchId !== null) {
            $branch = Branch::withoutGlobalScopes()
                ->where('tenant_id', Tenant::current()->getKey())
                ->findOrFail($branchId);
            abort_unless($user?->branch_id === null || (int) $user->branch_id === $branch->getKey(), 403);
        }

        $request->session()->put('branch_id', $branchId);

        return back();
    }

    public function settings(Request $request, Branch $branch): RedirectResponse
    {
        $this->ensureManager();
        $this->ensureTenantBranch($branch);
        $data = $request->validate([
            'settings' => ['required', 'array'],
        ]);
        $branch->update(['settings' => $data['settings']]);

        return back()->with('status', 'Branch settings updated.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedData(Request $request, ?Branch $branch = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['hotel', 'restaurant', 'resort', 'hostel'])],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'timezone' => ['required', 'timezone'],
            'currency' => ['required', 'string', 'size:3'],
            'star_rating' => ['nullable', 'integer', 'between:1,5'],
            'amenities' => ['nullable', 'array'],
            'is_active' => ['boolean'],
            'cover_image' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($request->hasFile('cover_image')) {
            if ($branch?->cover_image) {
                Storage::disk('s3')->delete($branch->cover_image);
            }
            $data['cover_image'] = $request->file('cover_image')->store('branches', 's3');
        }

        $data['tenant_id'] = Tenant::current()->getKey();
        $data['is_active'] = (bool) ($data['is_active'] ?? true);

        return $data;
    }

    private function ensureManager(): void
    {
        abort_unless(
            request()->user()?->is_super_admin
                || request()->user()?->hasAnyRole(['Tenant Owner', 'Branch Manager']),
            403,
        );
    }

    private function ensureTenantBranch(Branch $branch): void
    {
        abort_unless((int) $branch->tenant_id === (int) Tenant::current()->getKey(), 404);
    }
}
