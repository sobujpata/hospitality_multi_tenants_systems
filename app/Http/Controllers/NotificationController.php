<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $canManagePreferences = $user->hasAnyRole(['Tenant Owner', 'Branch Manager']);
        $events = [
            'new_booking' => 'New booking received',
            'booking_cancelled' => 'Booking cancelled',
            'checkin_reminder' => 'Check-in reminder',
            'payment_received' => 'Payment received',
            'maintenance_completed' => 'Maintenance completed',
            'task_assigned' => 'Task assigned to you',
            'task_available' => 'Unassigned task available in your branch',
            'trial_expiring' => 'Trial expiring',
            'low_availability' => 'Low room availability',
        ];

        return Inertia::render('settings/notifications', [
            'notifications' => $user->notifications()->latest()->limit(30)->get(),
            'preferences' => $user->notification_preferences ?? [],
            'events' => $events,
            'canManagePreferences' => $canManagePreferences,
        ]);
    }

    public function read(Request $request, string $notification): RedirectResponse
    {
        $user = $request->user();
        DB::table('notifications')
            ->where('id', $notification)
            ->where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->getKey())
            ->update(['read_at' => now(), 'updated_at' => now()]);

        return back();
    }

    public function update(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->hasAnyRole(['Tenant Owner', 'Branch Manager']), 403);
        $events = ['new_booking', 'booking_cancelled', 'checkin_reminder', 'payment_received', 'maintenance_completed', 'task_assigned', 'task_available', 'trial_expiring', 'low_availability'];
        $data = $request->validate(['preferences' => ['required', 'array']]);
        $preferences = [];
        foreach ($events as $event) {
            $preferences[$event] = array_values(array_intersect($data['preferences'][$event] ?? [], ['database', 'mail', 'broadcast']));
        }
        $request->user()->update(['notification_preferences' => $preferences]);

        return back()->with('status', 'Notification preferences saved.');
    }
}
