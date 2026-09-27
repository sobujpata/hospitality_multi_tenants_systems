import { Head, router } from '@inertiajs/react';

type AuditLog = {
    id: number;
    actor_id: number | null;
    actor_name: string | null;
    action: string;
    method: string;
    path: string;
    target_type: string | null;
    target_id: string | null;
    subject_type: string | null;
    subject_id: string | null;
    changes: Record<string, unknown>;
    response_status: number | null;
    ip_address: string | null;
    created_at: string;
};

type Props = {
    logs: {
        data: AuditLog[];
        links: { url: string | null; label: string; active: boolean }[];
    };
};

export default function AuditLogs({ logs }: Props) {
    return (
        <>
            <Head title="Super Admin Audit Log" />
            <div className="space-y-6 p-4">
                <header>
                    <h1 className="text-2xl font-semibold">Super Admin Audit Log</h1>
                    <p className="text-muted-foreground">Authenticated superadmin requests, including tenant support actions, with sensitive values redacted.</p>
                </header>
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                {['When', 'Super Admin', 'Action', 'Target', 'Changes', 'Result', 'IP address'].map((heading) => (
                                    <th className="px-3 py-2 font-medium" key={heading}>{heading}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {logs.data.map((log) => (
                                <tr className="border-t align-top" key={log.id}>
                                    <td className="whitespace-nowrap px-3 py-3">{new Date(log.created_at).toLocaleString()}</td>
                                    <td className="px-3 py-3">{log.actor_name ?? `User ${log.actor_id ?? 'removed'}`}</td>
                                    <td className="px-3 py-3">
                                        <div className="font-medium">{log.action}</div>
                                        <div className="text-xs text-muted-foreground">{log.method} {log.path}</div>
                                    </td>
                                    <td className="px-3 py-3">
                                        {log.target_type ? `${log.target_type} #${log.target_id ?? '—'}` : '—'}
                                        {log.subject_type && <div className="mt-1 text-xs text-muted-foreground">Impersonated: {log.subject_type} #{log.subject_id}</div>}
                                    </td>
                                    <td className="max-w-96 whitespace-pre-wrap break-words px-3 py-3 font-mono text-xs">{JSON.stringify(log.changes, null, 2)}</td>
                                    <td className="px-3 py-3">{log.response_status ?? '—'}</td>
                                    <td className="px-3 py-3">{log.ip_address ?? '—'}</td>
                                </tr>
                            ))}
                            {logs.data.length === 0 && (
                                <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={7}>No audit records available.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <nav className="flex flex-wrap gap-2" aria-label="Audit log pages">
                    {logs.links.map((link) => (
                        <button
                            className={`rounded border px-3 py-1 text-sm ${link.active ? 'bg-primary text-primary-foreground' : ''}`}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                            disabled={!link.url}
                            key={link.label}
                            onClick={() => link.url && router.get(link.url)}
                        />
                    ))}
                </nav>
            </div>
        </>
    );
}

AuditLogs.layout = { breadcrumbs: [{ title: 'Audit Log', href: '/admin/audit-logs' }] };
