<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BillingController extends Controller
{
    public function index(): Response
    {
        $tenant = Tenant::current()->load('planRelation');
        $setupIntent = null;
        if (config('cashier.key')) {
            $tenant->createOrGetStripeCustomer();
            $setupIntent = $tenant->createSetupIntent()->client_secret;
        }

        return Inertia::render('billing/index', [
            'tenant' => [
                'name' => $tenant->name,
                'trial_ends_at' => $tenant->trial_ends_at?->toIso8601String(),
                'on_trial' => $tenant->onGenericTrial(),
                'subscription_active' => $tenant->subscribed('default'),
                'read_only' => ! $tenant->hasBillingAccess(),
                'payment_method' => $tenant->pm_last_four ? "{$tenant->pm_type} ending {$tenant->pm_last_four}" : null,
            ],
            'currentPlan' => $tenant->planRelation,
            'plans' => Plan::query()->where('is_active', true)->orderBy('monthly_price')->get(),
            'usage' => [
                'branches' => ['used' => Branch::count(), 'limit' => $tenant->planRelation?->branch_limit],
                'staff' => ['used' => User::count(), 'limit' => $tenant->planRelation?->staff_limit],
                'rooms' => ['used' => Unit::where('unit_type', 'room')->count(), 'limit' => $tenant->planRelation?->room_limit],
            ],
            'invoices' => $tenant->hasStripeId() ? $tenant->invoicesIncludingPending()->map(fn ($invoice): array => ['id' => $invoice->id, 'date' => $invoice->date()->toDateString(), 'total' => $invoice->total(), 'paid' => $invoice->isPaid()]) : [],
            'setupIntent' => $setupIntent,
            'stripeKey' => config('cashier.key'),
        ]);
    }

    public function subscribe(Request $request): RedirectResponse
    {
        $data = $request->validate(['plan_id' => ['required', 'exists:plans,id'], 'payment_method' => ['nullable', 'string']]);
        $tenant = Tenant::current();
        $plan = Plan::query()->findOrFail($data['plan_id']);
        abort_unless($plan->stripe_price_id, 422, 'This plan is not configured with a Stripe price.');
        $tenant->createOrGetStripeCustomer();
        if ($data['payment_method'] ?? null) {
            $tenant->updateDefaultPaymentMethod($data['payment_method']);
        }

        if ($tenant->subscribed('default')) {
            $tenant->subscription('default')->swapAndInvoice($plan->stripe_price_id);
        } else {
            $builder = $tenant->newSubscription('default', $plan->stripe_price_id);
            if ($tenant->onGenericTrial()) {
                $builder->trialUntil($tenant->trial_ends_at);
            }
            $builder->create($data['payment_method'] ?? null);
        }
        $tenant->update(['plan_id' => $plan->id, 'is_active' => true]);

        return back()->with('status', "Switched to {$plan->name}.");
    }

    public function paymentMethod(Request $request): RedirectResponse
    {
        $data = $request->validate(['payment_method' => ['required', 'string']]);
        $tenant = Tenant::current();
        $tenant->createOrGetStripeCustomer();
        $tenant->updateDefaultPaymentMethod($data['payment_method']);

        return back()->with('status', 'Payment method updated.');
    }

    public function invoice(string $invoice): mixed
    {
        return Tenant::current()->downloadInvoice($invoice);
    }
}
