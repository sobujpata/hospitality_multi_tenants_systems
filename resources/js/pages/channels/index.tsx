import { Head } from '@inertiajs/react';

type Connection = { id: number; channel: string; name: string; status: string; webhook_token: string; last_synced_at: string | null; branch?: { name: string } };

export default function Channels({ connections }: { connections: Connection[] }) {
    return (
        <>
            <Head title="Channel manager" />
            <div className="space-y-4 p-6">
                <div><h1 className="text-2xl font-semibold">Channel manager</h1><p className="text-sm text-muted-foreground">OTA connections are ready for future Booking.com and Airbnb integrations.</p></div>
                <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs uppercase"><tr><th className="p-3">Channel</th><th className="p-3">Branch</th><th className="p-3">Status</th><th className="p-3">Webhook endpoint</th><th className="p-3">Last synced</th></tr></thead><tbody>{connections.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No OTA connections configured.</td></tr> : connections.map((connection) => <tr key={connection.id} className="border-t"><td className="p-3 font-medium">{connection.name} <span className="text-xs text-muted-foreground">({connection.channel})</span></td><td className="p-3">{connection.branch?.name ?? 'All branches'}</td><td className="p-3 capitalize">{connection.status.replace('_', ' ')}</td><td className="p-3 font-mono text-xs">POST /channels/webhooks/{connection.webhook_token}</td><td className="p-3">{connection.last_synced_at ?? 'Never'}</td></tr>)}</tbody></table></div>
            </div>
        </>
    );
}

Channels.layout = { breadcrumbs: [{ title: 'Channel manager', href: '/channels' }] };
