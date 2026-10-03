<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class ReviewController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $customer = $request->user();
        abort_unless($customer instanceof Customer, 403);

        $data = $request->validate([
            'booking_id' => ['required', 'integer', 'exists:bookings,id'],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'cleanliness' => ['nullable', 'integer', 'min:1', 'max:5'],
            'service' => ['nullable', 'integer', 'min:1', 'max:5'],
            'location' => ['nullable', 'integer', 'min:1', 'max:5'],
            'value' => ['nullable', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:100'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $booking = Booking::query()->findOrFail($data['booking_id']);

        abort_unless((int) $booking->customer_id === (int) $customer->id, 403);
        abort_unless(in_array($booking->status, ['checked_out', 'completed'], true), 422, 'Can only review after check-out.');

        $branch = Branch::query()->findOrFail($data['branch_id']);
        abort_unless(
            (int) $booking->branch_id === (int) $branch->id
                && (int) $booking->tenant_id === (int) $branch->tenant_id,
            422,
            'The branch must match the booking.',
        );

        $review = Review::query()->updateOrCreate(
            [
                'booking_id' => $booking->id,
                'customer_id' => $customer->id,
            ],
            [
                ...Arr::only($data, [
                    'rating',
                    'cleanliness',
                    'service',
                    'location',
                    'value',
                    'title',
                    'comment',
                ]),
                'branch_id' => $branch->id,
                'tenant_id' => $booking->tenant_id,
                'reviewed_at' => now(),
                'status' => 'pending',
            ],
        );

        return response()->json($review, 201);
    }
}
