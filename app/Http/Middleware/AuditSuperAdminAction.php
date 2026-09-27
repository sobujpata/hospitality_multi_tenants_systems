<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AuditSuperAdminAction
{
    public function handle(Request $request, Closure $next): Response
    {
        $status = 500;

        try {
            $response = $next($request);
            $status = $response->getStatusCode();

            return $response;
        } finally {
            $this->record($request, $status);
        }
    }

    private function record(Request $request, int $status): void
    {
        $route = $request->route();
        $routeName = $route?->getName() ?? $request->method().' '.$request->path();
        $parameters = $route?->parameters() ?? [];
        $target = collect($parameters)->first(
            fn (mixed $parameter): bool => is_object($parameter) && method_exists($parameter, 'getKey'),
        );

        if ($target === null && isset($parameters['tenant'])) {
            $target = $parameters['tenant'];
        }

        $subject = null;
        $subjectType = null;
        if ($routeName === 'superadmin.tenants.impersonate' && is_object($target)) {
            $subject = DB::table('model_has_roles')
                ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
                ->where('model_has_roles.team_id', $target->getKey())
                ->where('roles.name', 'Tenant Owner')
                ->value('model_has_roles.model_id');
            $subjectType = 'App\\Models\\User';
        }

        DB::table('superadmin_audit_logs')->insert([
            'actor_id' => $request->user('superadmin')?->getAuthIdentifier(),
            'action' => $routeName,
            'method' => $request->method(),
            'path' => $request->path(),
            'target_type' => is_object($target) ? $target::class : (is_string($target) ? 'route_parameter' : null),
            'target_id' => is_object($target) && method_exists($target, 'getKey')
                ? (string) $target->getKey()
                : (is_scalar($target) ? (string) $target : null),
            'subject_type' => $subjectType,
            'subject_id' => $subject === null ? null : (string) $subject,
            'changes' => json_encode($this->sanitize($request->except(['_token', '_method']))),
            'response_status' => $status,
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 2000),
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function sanitize(array $values): array
    {
        $sanitized = [];

        foreach ($values as $key => $value) {
            if (preg_match('/password|secret|token|api.?key|authorization|cookie|recovery/i', (string) $key)) {
                $sanitized[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $sanitized[$key] = $this->sanitize($value);
            } elseif (is_scalar($value) || $value === null) {
                $sanitized[$key] = $value;
            } else {
                $sanitized[$key] = '[UNSERIALIZABLE]';
            }
        }

        return $sanitized;
    }
}
