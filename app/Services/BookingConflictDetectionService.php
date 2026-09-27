<?php

namespace App\Services;

use App\Models\Booking;
use Illuminate\Validation\ValidationException;

class BookingConflictDetectionService
{
    public function hasConflict(
        int $unitId,
        string $checkIn,
        string $checkOut,
        ?int $ignoreBookingId = null,
    ): bool {
        return Booking::query()
            ->where(function ($query) use ($unitId): void {
                $query->where('unit_id', $unitId)
                    ->orWhereHas('rooms', fn ($rooms) => $rooms->where('units.id', $unitId));
            })
            ->whereIn('status', ['pending', 'confirmed', 'checked_in'])
            ->when($ignoreBookingId, fn ($query) => $query->whereKey($ignoreBookingId, '!='))
            ->where('check_in', '<', $checkOut)
            ->where('check_out', '>', $checkIn)
            ->exists();
    }

    public function assertAvailable(
        int $unitId,
        string $checkIn,
        string $checkOut,
        ?int $ignoreBookingId = null,
    ): void {
        if ($this->hasConflict($unitId, $checkIn, $checkOut, $ignoreBookingId)) {
            throw ValidationException::withMessages([
                'unit_id' => 'This unit is already booked for the selected dates.',
            ]);
        }
    }
}
