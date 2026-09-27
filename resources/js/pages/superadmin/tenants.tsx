import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Tenant = {
    id: number;
    name: string;
    slug: string;
    domain: string;
    database: string;
    plan_id: number | null;
    plan: string;
    mrr: number;
    trial_ends_at: string | null;
    trial_active: boolean;
    is_active: boolean;
    last_activity: string | null;
    subscriptions_count: number;
};

type Plan = { id: number; name: string; monthly_price: string };

type Props = { tenants: Tenant[]; plans: Plan[] };

type TenantForm = {
    name: string;
    slug: string;
    domain: string;
    database: string;
    plan_id: string;
    trial_ends_at: string;
    is_active: boolean;
};

const emptyForm: TenantForm = {
    name: '',
    slug: '',
    domain: '',
    database: '',
    plan_id: '',
    trial_ends_at: '',
    is_active: true,
};

export default function Tenants({ tenants, plans }: Props) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Tenant | null>(null);
    const [form, setForm] = useState<TenantForm>(emptyForm);
    const [planIds, setPlanIds] = useState<Record<number, string>>({});
    const [trialDates, setTrialDates] = useState<Record<number, string>>({});

    const saveBilling = (tenant: Tenant) => {
        router.put(`/admin/tenants/${tenant.id}/billing`, {
            plan_id: planIds[tenant.id] || tenant.plan_id,
            trial_ends_at: trialDates[tenant.id] || tenant.trial_ends_at,
        });
    };

    const toggleTenantStatus = (tenant: Tenant) => {
        router.patch(`/admin/tenants/${tenant.id}/status`, {
            is_active: !tenant.is_active,
        });
    };

    const impersonate = (tenant: Tenant) => {
        router.post(`/admin/tenants/${tenant.id}/impersonate`);
    };

    const startCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setOpen(true);
    };

    const startEdit = (tenant: Tenant) => {
        setEditing(tenant);
        setForm({
            name: tenant.name,
            slug: tenant.slug,
            domain: tenant.domain,
            database: tenant.database,
            plan_id: tenant.plan_id ? String(tenant.plan_id) : '',
            trial_ends_at: tenant.trial_ends_at ?? '',
            is_active: tenant.is_active,
        });
        setOpen(true);
    };

    const submit = () => {
        const options = { onSuccess: () => setOpen(false) };
        const data = { ...form, plan_id: form.plan_id || null };

        if (editing) {
            router.put(`/admin/tenants/${editing.id}`, data, options);
        } else {
            router.post('/admin/tenants', data, options);
        }
    };

    const remove = (tenant: Tenant) => {
        if (window.confirm(`Delete ${tenant.name}? Associated tenant data may also be deleted.`)) {
            router.delete(`/admin/tenants/${tenant.id}`);
        }
    };

    return (
        <>
            <Head title="Tenant Management" />
            <div className="space-y-6 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Tenant Management</h1>
                        <p className="text-muted-foreground">Create and manage customer organizations.</p>
                    </div>
                    <Button onClick={startCreate}>Add tenant</Button>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[1450px] text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                {['Tenant', 'Domain', 'Plan type', 'MRR', 'Trial status', 'Last activity', 'Plan / trial override', 'Account', 'Actions'].map((heading) => (
                                    <th className="px-4 py-3 text-left" key={heading}>{heading}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map((tenant) => (
                                <tr key={tenant.id} className="border-t">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{tenant.name}</div>
                                        <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                                    </td>
                                    <td className="px-4 py-3">{tenant.domain}</td>
                                    <td className="px-4 py-3">{tenant.plan}</td>
                                    <td className="px-4 py-3">${tenant.mrr.toFixed(2)}</td>
                                    <td className="px-4 py-3">
                                        {tenant.trial_active ? (
                                            <span className="text-amber-700">Trial until {tenant.trial_ends_at ?? '—'}</span>
                                        ) : (
                                            tenant.trial_ends_at ? `Ended ${tenant.trial_ends_at}` : 'No active trial'
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {tenant.last_activity ? new Date(tenant.last_activity).toLocaleString() : 'Never'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <select
                                                aria-label={`Plan override for ${tenant.name}`}
                                                className="h-9 rounded border bg-transparent px-2"
                                                value={planIds[tenant.id] ?? String(tenant.plan_id ?? '')}
                                                onChange={(event) => setPlanIds({ ...planIds, [tenant.id]: event.target.value })}
                                            >
                                                <option value="">No plan</option>
                                                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                                            </select>
                                            <Input
                                                aria-label={`Trial end date for ${tenant.name}`}
                                                className="w-40"
                                                type="date"
                                                value={trialDates[tenant.id] ?? tenant.trial_ends_at ?? ''}
                                                onChange={(event) => setTrialDates({ ...trialDates, [tenant.id]: event.target.value })}
                                            />
                                            <Button size="sm" onClick={() => saveBilling(tenant)}>Save</Button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Button
                                            size="sm"
                                            variant={tenant.is_active ? 'outline' : 'default'}
                                            onClick={() => toggleTenantStatus(tenant)}
                                        >
                                            {tenant.is_active ? 'Suspend' : 'Reactivate'}
                                        </Button>
                                    </td>
                                    <td className="space-x-2 px-4 py-3 text-right">
                                        <Button size="sm" variant="outline" onClick={() => impersonate(tenant)}>Impersonate owner</Button>
                                        <Button size="sm" variant="outline" onClick={() => startEdit(tenant)}>Edit</Button>
                                        <Button size="sm" variant="ghost" onClick={() => remove(tenant)}>Delete</Button>
                                    </td>
                                </tr>
                            ))}
                            {tenants.length === 0 && (
                                <tr>
                                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={9}>No tenants yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit tenant' : 'Create tenant'}</DialogTitle>
                        <DialogDescription>Configure the tenant organization and access details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1">
                        {(['name', 'slug', 'domain', 'database'] as const).map((field) => (
                            <div className="grid gap-1" key={field}>
                                <Label htmlFor={`tenant-${field}`}>{field === 'slug' ? 'Subdomain slug' : field}</Label>
                                <Input
                                    id={`tenant-${field}`}
                                    value={form[field]}
                                    onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                                />
                            </div>
                        ))}
                        <div className="grid gap-1">
                            <Label htmlFor="tenant-plan">Plan</Label>
                            <select id="tenant-plan" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={form.plan_id} onChange={(event) => setForm({ ...form, plan_id: event.target.value })}>
                                <option value="">No plan</option>
                                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                            </select>
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="tenant-trial-ends-at">Trial ends</Label>
                            <Input id="tenant-trial-ends-at" type="date" value={form.trial_ends_at} onChange={(event) => setForm({ ...form, trial_ends_at: event.target.value })} />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
                            Active
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={submit}>{editing ? 'Save changes' : 'Create tenant'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

Tenants.layout = { breadcrumbs: [{ title: 'Tenant Management', href: '/admin/tenants' }] };
