<?php

use App\Models\Booking;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\FolioItem;
use App\Models\FolioPayment;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

test('a receptionist can register a walk-in guest, room booking, and payment for their branch', function () {
    Notification::fake();

    $tenant = Tenant::create([
        'name' => 'Front Desk Test',
        'slug' => 'frontdesk',
        'domain' => 'frontdesk.localhost',
        'database' => 'frontdesk_test',
        'is_active' => true,
    ]);
    $tenant->makeCurrent();
    app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->id);

    $branch = Branch::create([
        'tenant_id' => $tenant->id,
        'name' => 'Downtown Hotel',
        'type' => 'hotel',
        'currency' => 'USD',
        'is_active' => true,
    ]);
    $unit = Unit::create([
        'tenant_id' => $tenant->id,
        'branch_id' => $branch->id,
        'unit_type' => 'room',
        'number' => '101',
        'name' => 'Deluxe room',
        'capacity' => 2,
        'child_capacity' => 1,
        'base_price' => 100,
        'status' => 'available',
    ]);
    $user = User::factory()->create([
        'tenant_id' => $tenant->id,
        'branch_id' => $branch->id,
    ]);
    $user->assignRole(Role::create([
        'name' => 'Receptionist',
        'guard_name' => 'web',
        'team_id' => $tenant->id,
    ]));

    $this->actingAs($user)
        ->withServerVariables(['HTTP_HOST' => 'frontdesk.localhost'])
        ->post('/customers/walk-in-booking', [
            'name' => 'Alex Guest',
            'email' => 'alex@example.com',
            'phone' => '+1 555 0199',
            'nationality' => 'Canadian',
            'date_of_birth' => now()->subYears(25)->toDateString(),
            'gender' => 'other',
            'id_type' => 'passport',
            'id_number' => 'P-90821',
            'arrived_from' => 'Toronto',
            'occupation' => 'Designer',
            'organization' => 'North Studio',
            'purpose_of_visit' => 'business',
            'address_line' => '12 King Street',
            'branch_id' => $branch->id,
            'unit_id' => $unit->id,
            'check_in' => now()->toDateString(),
            'check_out' => now()->addDay()->toDateString(),
            'adults' => 2,
            'children' => 1,
            'status' => 'checked_in',
            'payment_amount' => 40,
            'payment_method' => 'cash',
        ])
        ->assertRedirect();

    $customer = Customer::query()->where('tenant_id', $tenant->id)->where('email', 'alex@example.com')->firstOrFail();
    $booking = Booking::query()->where('customer_id', $customer->id)->firstOrFail();

    expect($customer->source)->toBe('walk-in')
        ->and($customer->nationality)->toBe('Canadian')
        ->and($customer->gender)->toBe('other')
        ->and($customer->id_type)->toBe('passport')
        ->and($customer->id_number)->toBe('P-90821')
        ->and($customer->arrived_from)->toBe('Toronto')
        ->and($customer->occupation)->toBe('Designer')
        ->and($customer->organization)->toBe('North Studio')
        ->and($customer->purpose_of_visit)->toBe('business')
        ->and($customer->address['line1'])->toBe('12 King Street')
        ->and($booking->branch_id)->toBe($branch->id)
        ->and($booking->unit_id)->toBe($unit->id)
        ->and($booking->status)->toBe('checked_in')
        ->and((float) $booking->total_amount)->toBe(100.0)
        ->and($unit->fresh()->status)->toBe('occupied')
        ->and(FolioItem::query()->where('booking_id', $booking->id)->where('item_type', 'room_charge')->exists())->toBeTrue()
        ->and((float) FolioPayment::query()->where('booking_id', $booking->id)->value('amount'))->toBe(40.0);
});
