<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $events = [
            'new_booking' => 'New booking received',
            'booking_cancelled' => 'Booking cancelled',
            'checkin_reminder' => 'Check-in reminder',
            'payment_received' => 'Payment received',
            'maintenance_completed' => 'Maintenance completed',
            'trial_expiring' => 'Trial expiring',
            'low_availability' => 'Low room availability',
        ];

        return Inertia::render('settings/notifications', [
            'notifications' => $user->notifications()->latest()->limit(30)->get(),
            'preferences' => $user->notification_preferences ?? [],
            'events' => $events,
        ]);
    }

    public function read(Request $request, string $notification): RedirectResponse
    {
        $request->user()->notifications()->whereKey($notification)->update(['read_at' => now()]);

        return back();
    }

    public function update(Request $request): RedirectResponse
    {
        $events = ['new_booking', 'booking_cancelled', 'checkin_reminder', 'payment_received', 'maintenance_completed', 'trial_expiring', 'low_availability'];
        $data = $request->validate(['preferences' => ['required', 'array']]);
        $preferences = [];
        foreach ($events as $event) {
            $preferences[$event] = array_values(array_intersect($data['preferences'][$event] ?? [], ['database', 'mail', 'broadcast']));
        }
        $request->user()->update(['notification_preferences' => $preferences]);

        return back()->with('status', 'Notification preferences saved.');
    }
}
