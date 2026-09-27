import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Tenant = {
    id: number;
    name: string;
    slug: string;
    owner_emails: string[];
};

type Announcement = {
    id: number;
    subject: string;
    body: string;
    recipient_count: number | null;
    status: string;
    created_at: string;
    created_by_name: string | null;
};

type SupportEntry = {
    id: number;
    tenant_id: number;
    tenant_name: string;
    subject: string;
    body: string;
    created_at: string;
    created_by_name: string | null;
};

type Props = {
    tenants: Tenant[];
    announcements: Announcement[];
    supportHistory: SupportEntry[];
};

export default function Communications({ tenants, announcements, supportHistory }: Props) {
    const [announcement, setAnnouncement] = useState({ subject: '', body: '' });
    const [support, setSupport] = useState({ tenant_id: '', subject: '', body: '' });
    const selectedTenant = tenants.find((tenant) => String(tenant.id) === support.tenant_id);

    const sendAnnouncement = () => {
        router.post('/admin/communications/announcements', announcement, {
            onSuccess: () => setAnnouncement({ subject: '', body: '' }),
        });
    };

    const recordContact = () => {
        router.post('/admin/communications/support', support, {
            onSuccess: () => setSupport({ tenant_id: '', subject: '', body: '' }),
        });
    };

    return (
        <>
            <Head title="Platform Communications" />
            <div className="space-y-6 p-4">
                <header>
                    <h1 className="text-2xl font-semibold">Platform Communications</h1>
                    <p className="text-muted-foreground">Send announcements to tenant owners and keep a record of support contacts.</p>
                </header>

                <section className="space-y-4 rounded-xl border bg-card p-5">
                    <div>
                        <h2 className="text-xl font-medium">Platform-wide announcement</h2>
                        <p className="text-sm text-muted-foreground">
                            Queues one email for each active tenant owner. {tenants.reduce((total, tenant) => total + tenant.owner_emails.length, 0)} owner recipients are currently available.
                        </p>
                    </div>
                    <div className="grid gap-3">
                        <div className="grid gap-1">
                            <Label htmlFor="announcement-subject">Subject</Label>
                            <Input id="announcement-subject" maxLength={255} value={announcement.subject} onChange={(event) => setAnnouncement({ ...announcement, subject: event.target.value })} />
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="announcement-body">Message</Label>
                            <textarea id="announcement-body" className="min-h-36 rounded-md border bg-transparent px-3 py-2 text-sm" maxLength={20000} value={announcement.body} onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })} />
                        </div>
                        <div><Button disabled={!announcement.subject.trim() || !announcement.body.trim()} onClick={sendAnnouncement}>Queue email announcement</Button></div>
                    </div>
                </section>

                <section className="space-y-4 rounded-xl border bg-card p-5">
                    <div>
                        <h2 className="text-xl font-medium">Record a support contact</h2>
                        <p className="text-sm text-muted-foreground">Log calls, emails, and other support interactions against a tenant.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-1">
                            <Label htmlFor="support-tenant">Tenant</Label>
                            <select id="support-tenant" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={support.tenant_id} onChange={(event) => setSupport({ ...support, tenant_id: event.target.value })}>
                                <option value="">Select a tenant</option>
                                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.slug})</option>)}
                            </select>
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="support-subject">Subject</Label>
                            <Input id="support-subject" maxLength={255} value={support.subject} onChange={(event) => setSupport({ ...support, subject: event.target.value })} />
                        </div>
                    </div>
                    {selectedTenant && (
                        <p className="text-sm text-muted-foreground">
                            Tenant owner contacts: {selectedTenant.owner_emails.length ? selectedTenant.owner_emails.join(', ') : 'No owner email found'}
                        </p>
                    )}
                    <div className="grid gap-1">
                        <Label htmlFor="support-body">Contact notes</Label>
                        <textarea id="support-body" className="min-h-28 rounded-md border bg-transparent px-3 py-2 text-sm" maxLength={20000} value={support.body} onChange={(event) => setSupport({ ...support, body: event.target.value })} />
                    </div>
                    <Button disabled={!support.tenant_id || !support.subject.trim() || !support.body.trim()} onClick={recordContact}>Save contact record</Button>
                </section>

                <section className="space-y-3 rounded-xl border bg-card p-5">
                    <div>
                        <h2 className="text-xl font-medium">Tenant support/contact history</h2>
                        <p className="text-sm text-muted-foreground">Most recent 200 recorded support interactions.</p>
                    </div>
                    {supportHistory.length ? supportHistory.map((entry) => (
                        <article className="rounded-lg border p-4" key={entry.id}>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="font-medium">{entry.tenant_name} — {entry.subject}</h3>
                                <time className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()} · {entry.created_by_name ?? 'Former admin'}</time>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{entry.body}</p>
                        </article>
                    )) : <p className="py-4 text-center text-sm text-muted-foreground">No support contacts recorded yet.</p>}
                </section>

                <section className="space-y-3 rounded-xl border bg-card p-5">
                    <div>
                        <h2 className="text-xl font-medium">Announcement history</h2>
                        <p className="text-sm text-muted-foreground">Recent platform-wide email announcement queue records.</p>
                    </div>
                    {announcements.length ? announcements.map((entry) => (
                        <article className="rounded-lg border p-4" key={entry.id}>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="font-medium">{entry.subject}</h3>
                                <time className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()} · {entry.created_by_name ?? 'Former admin'}</time>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{entry.body}</p>
                            <p className="mt-2 text-xs text-muted-foreground">Status: {entry.status} · Recipients queued: {entry.recipient_count ?? 0}</p>
                        </article>
                    )) : <p className="py-4 text-center text-sm text-muted-foreground">No announcements sent yet.</p>}
                </section>
            </div>
        </>
    );
}

Communications.layout = { breadcrumbs: [{ title: 'Communications', href: '/admin/communications' }] };
