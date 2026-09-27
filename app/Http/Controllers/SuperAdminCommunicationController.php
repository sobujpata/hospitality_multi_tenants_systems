<?php

namespace App\Http\Controllers;

use App\Mail\PlatformAnnouncement;
use App\Models\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class SuperAdminCommunicationController extends Controller
{
    public function index(): Response
    {
        $owners = DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->where('roles.name', 'Tenant Owner')
            ->where('model_has_roles.model_type', 'App\\Models\\User')
            ->whereColumn('model_has_roles.team_id', 'roles.team_id')
            ->where('users.is_active', true)
            ->select('model_has_roles.team_id as tenant_id', 'users.email')
            ->distinct()
            ->get()
            ->groupBy('tenant_id')
            ->map(fn ($tenantOwners) => $tenantOwners->pluck('email')->values());

        $tenants = Tenant::query()->orderBy('name')->get(['id', 'name', 'slug']);

        return Inertia::render('superadmin/communications', [
            'tenants' => $tenants->map(fn (Tenant $tenant): array => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'owner_emails' => $owners->get($tenant->id, collect()),
            ]),
            'announcements' => DB::table('platform_communications')
                ->leftJoin('users', 'users.id', '=', 'platform_communications.created_by')
                ->where('platform_communications.type', 'announcement')
                ->orderByDesc('platform_communications.created_at')
                ->limit(100)
                ->get([
                    'platform_communications.id',
                    'platform_communications.subject',
                    'platform_communications.body',
                    'platform_communications.recipient_count',
                    'platform_communications.status',
                    'platform_communications.created_at',
                    'users.name as created_by_name',
                ]),
            'supportHistory' => DB::table('platform_communications')
                ->join('tenants', 'tenants.id', '=', 'platform_communications.tenant_id')
                ->leftJoin('users', 'users.id', '=', 'platform_communications.created_by')
                ->where('platform_communications.type', 'support')
                ->orderByDesc('platform_communications.created_at')
                ->limit(200)
                ->get([
                    'platform_communications.id',
                    'platform_communications.tenant_id',
                    'tenants.name as tenant_name',
                    'platform_communications.subject',
                    'platform_communications.body',
                    'platform_communications.created_at',
                    'users.name as created_by_name',
                ]),
        ]);
    }

    public function sendAnnouncement(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
        ]);
        $recipients = $this->tenantOwnerEmails();
        abort_if($recipients->isEmpty(), 422, 'No active tenant owners are available to receive this announcement.');

        $communicationId = DB::table('platform_communications')->insertGetId([
            'created_by' => Auth::guard('superadmin')->id(),
            'type' => 'announcement',
            'subject' => $data['subject'],
            'body' => $data['body'],
            'recipient_count' => 0,
            'status' => 'sending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $queuedCount = 0;

        try {
            foreach ($recipients as $email) {
                Mail::to($email)->queue(new PlatformAnnouncement($data['subject'], $data['body']));
                $queuedCount++;
            }
        } catch (Throwable $exception) {
            DB::table('platform_communications')->where('id', $communicationId)->update([
                'recipient_count' => $queuedCount,
                'status' => $queuedCount ? 'partially_queued' : 'failed',
                'updated_at' => now(),
            ]);

            throw $exception;
        }

        DB::table('platform_communications')->where('id', $communicationId)->update([
            'recipient_count' => $queuedCount,
            'status' => 'queued',
            'updated_at' => now(),
        ]);

        return back()->with('status', "Announcement queued for {$queuedCount} tenant owner(s).");
    }

    public function recordSupportContact(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
        ]);

        DB::table('platform_communications')->insert([
            'tenant_id' => $data['tenant_id'],
            'created_by' => Auth::guard('superadmin')->id(),
            'type' => 'support',
            'subject' => $data['subject'],
            'body' => $data['body'],
            'recipient_count' => null,
            'status' => 'recorded',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return back()->with('status', 'Support contact added to history.');
    }

    /**
     * @return Collection<int, string>
     */
    private function tenantOwnerEmails(): Collection
    {
        return DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->join('tenants', 'tenants.id', '=', 'model_has_roles.team_id')
            ->where('roles.name', 'Tenant Owner')
            ->where('model_has_roles.model_type', 'App\\Models\\User')
            ->whereColumn('model_has_roles.team_id', 'roles.team_id')
            ->where('users.is_active', true)
            ->where('tenants.is_active', true)
            ->distinct()
            ->orderBy('users.email')
            ->pluck('users.email');
    }
}
