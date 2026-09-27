<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SuperAdminAuditController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('superadmin/audit-logs', [
            'logs' => DB::table('superadmin_audit_logs')
                ->leftJoin('users', 'users.id', '=', 'superadmin_audit_logs.actor_id')
                ->orderByDesc('superadmin_audit_logs.created_at')
                ->paginate(50, [
                    'superadmin_audit_logs.id',
                    'superadmin_audit_logs.actor_id',
                    'users.name as actor_name',
                    'superadmin_audit_logs.action',
                    'superadmin_audit_logs.method',
                    'superadmin_audit_logs.path',
                    'superadmin_audit_logs.target_type',
                    'superadmin_audit_logs.target_id',
                    'superadmin_audit_logs.subject_type',
                    'superadmin_audit_logs.subject_id',
                    'superadmin_audit_logs.changes',
                    'superadmin_audit_logs.response_status',
                    'superadmin_audit_logs.ip_address',
                    'superadmin_audit_logs.created_at',
                ])
                ->through(fn (object $log): array => [
                    ...(array) $log,
                    'changes' => json_decode($log->changes ?? '{}', true) ?: [],
                ]),
        ]);
    }
}
