<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            ['name' => 'Starter', 'slug' => 'starter', 'stripe_price_id' => env('STRIPE_STARTER_PRICE_ID'), 'monthly_price' => 49, 'branch_limit' => 1, 'staff_limit' => 5, 'room_limit' => 50, 'white_label' => false, 'api_access' => false],
            ['name' => 'Professional', 'slug' => 'professional', 'stripe_price_id' => env('STRIPE_PROFESSIONAL_PRICE_ID'), 'monthly_price' => 149, 'branch_limit' => 5, 'staff_limit' => null, 'room_limit' => 500, 'white_label' => false, 'api_access' => false],
            ['name' => 'Enterprise', 'slug' => 'enterprise', 'stripe_price_id' => env('STRIPE_ENTERPRISE_PRICE_ID'), 'monthly_price' => 399, 'branch_limit' => null, 'staff_limit' => null, 'room_limit' => null, 'white_label' => true, 'api_access' => true],
        ] as $plan) {
            Plan::updateOrCreate(['slug' => $plan['slug']], $plan);
        }
    }
}
