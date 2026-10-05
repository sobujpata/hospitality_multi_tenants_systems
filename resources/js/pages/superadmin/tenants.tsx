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
    users: TenantUser[];
    branches: BranchOption[];
    roles: RoleOption[];
};

type Plan = { id: number; name: string; monthly_price: string };
type BranchOption = { id: number; name: string };
type RoleOption = { id: number; name: string };
type TenantUser = { id: number; name: string; email: string; is_active: boolean; branch_id: number | null; branch: string | null; role_id: number | null; role: string };

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

type UserForm = { name: string; email: string; password: string; branch_id: string; role_id: string; is_active: boolean };
type OwnerForm = { name: string; email: string; password: string };

const emptyUserForm: UserForm = { name: '', email: '', password: '', branch_id: '', role_id: '', is_active: true };

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
    const [ownerForm, setOwnerForm] = useState<OwnerForm>({ name: '', email: '', password: '' });
    const [planIds, setPlanIds] = useState<Record<number, string>>({});
    const [trialDates, setTrialDates] = useState<Record<number, string>>({});
    const [usersTenant, setUsersTenant] = useState<Tenant | null>(null);
    const [userDialogOpen, setUserDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
    const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);

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
        setOwnerForm({ name: '', email: '', password: '' });
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
        const data = { ...form, plan_id: form.plan_id || null, ...(!editing ? { owner: ownerForm } : {}) };

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

    const openUsers = (tenant: Tenant) => {
        setUsersTenant(tenant);
        setUserDialogOpen(true);
    };

    const startCreateUser = () => {
        setEditingUser(null);
        setUserForm(emptyUserForm);
    };

    const startEditUser = (user: TenantUser) => {
        setEditingUser(user);
        setUserForm({ name: user.name, email: user.email, password: '', branch_id: user.branch_id ? String(user.branch_id) : '', role_id: user.role_id ? String(user.role_id) : '', is_active: user.is_active });
    };

    const saveUser = () => {
        if (!usersTenant) return;
        const data = { ...userForm, branch_id: userForm.branch_id || null, role_id: userForm.role_id ? Number(userForm.role_id) : null };
        const options = { onSuccess: () => startCreateUser() };
        if (editingUser) {
            router.put(`/admin/tenants/${usersTenant.id}/users/${editingUser.id}`, data, options);
        } else {
            router.post(`/admin/tenants/${usersTenant.id}/users`, data, options);
        }
    };

    const deleteUser = (user: TenantUser) => {
        if (usersTenant && window.confirm(`Remove ${user.name} from ${usersTenant.name}?`)) {
            router.delete(`/admin/tenants/${usersTenant.id}/users/${user.id}`);
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
                                        <Button size="sm" variant="outline" onClick={() => openUsers(tenant)}>Users ({tenant.users.length})</Button>
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
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">{editing ? 'Edit tenant' : 'Create a tenant workspace'}</DialogTitle>
                        <DialogDescription>{editing ? 'Update organization details and subscription setup.' : 'Set up the organization and its first owner together. The owner can sign in as soon as the workspace is created.'}</DialogDescription>
                    </DialogHeader>
                    <div className="grid max-h-[70vh] gap-5 overflow-y-auto px-0.5 pr-1">
                        <section className="grid gap-3 rounded-xl border bg-muted/20 p-4">
                            <div>
                                <h3 className="font-semibold">Organization</h3>
                                <p className="text-sm text-muted-foreground">Basic workspace and URL details.</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {(['name', 'slug', 'domain', 'database'] as const).map((field) => (
                                    <div className="grid gap-1.5" key={field}>
                                        <Label htmlFor={`tenant-${field}`}>{field === 'slug' ? 'Subdomain slug' : field === 'name' ? 'Organization name' : field === 'domain' ? 'Domain' : 'Database name'}</Label>
                                        <Input id={`tenant-${field}`} placeholder={field === 'name' ? 'e.g. Riverside Hotel' : field === 'slug' ? 'riverside' : field === 'domain' ? 'riverside.example.com' : 'riverside'} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
                                    </div>
                                ))}
                            </div>
                        </section>
                        {!editing && (
                            <section className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                                <div>
                                    <h3 className="font-semibold">First tenant owner</h3>
                                    <p className="text-sm text-muted-foreground">This account will receive the Tenant Owner role and manage the new workspace.</p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="grid gap-1.5"><Label htmlFor="owner-name">Full name</Label><Input id="owner-name" autoComplete="name" placeholder="Owner name" value={ownerForm.name} onChange={(event) => setOwnerForm({ ...ownerForm, name: event.target.value })} /></div>
                                    <div className="grid gap-1.5"><Label htmlFor="owner-email">Email address</Label><Input id="owner-email" type="email" autoComplete="email" placeholder="owner@example.com" value={ownerForm.email} onChange={(event) => setOwnerForm({ ...ownerForm, email: event.target.value })} /></div>
                                    <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="owner-password">Temporary password</Label><Input id="owner-password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={ownerForm.password} onChange={(event) => setOwnerForm({ ...ownerForm, password: event.target.value })} /></div>
                                </div>
                            </section>
                        )}
                        <section className="grid gap-3 rounded-xl border p-4">
                            <div>
                                <h3 className="font-semibold">Plan and access</h3>
                                <p className="text-sm text-muted-foreground">Choose a plan and set trial access.</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-1.5"><Label htmlFor="tenant-plan">Plan</Label><select id="tenant-plan" className="h-10 rounded-md border bg-background px-3 text-sm" value={form.plan_id} onChange={(event) => setForm({ ...form, plan_id: event.target.value })}><option value="">No plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></div>
                                <div className="grid gap-1.5"><Label htmlFor="tenant-trial-ends-at">Trial ends</Label><Input id="tenant-trial-ends-at" type="date" value={form.trial_ends_at} onChange={(event) => setForm({ ...form, trial_ends_at: event.target.value })} /></div>
                            </div>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />Active workspace</label>
                        </section>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={submit}>{editing ? 'Save changes' : 'Create tenant & owner'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Users · {usersTenant?.name}</DialogTitle>
                        <DialogDescription>Create tenant accounts and assign their role and branch access.</DialogDescription>
                    </DialogHeader>
                    {usersTenant && (
                        <div className="grid max-h-[70vh] gap-5 overflow-y-auto">
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Role</th><th className="px-3 py-2 text-left">Branch</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
                                    <tbody>
                                        {usersTenant.users.map((user) => (
                                            <tr className="border-t" key={user.id}>
                                                <td className="px-3 py-2"><div className="font-medium">{user.name}</div><div className="text-xs text-muted-foreground">{user.email}</div></td>
                                                <td className="px-3 py-2">{user.role}</td><td className="px-3 py-2">{user.branch ?? 'All branches'}</td><td className="px-3 py-2">{user.is_active ? 'Active' : 'Inactive'}</td>
                                                <td className="space-x-1 px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => startEditUser(user)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => deleteUser(user)}>Remove</Button></td>
                                            </tr>
                                        ))}
                                        {usersTenant.users.length === 0 && <tr><td className="px-3 py-5 text-center text-muted-foreground" colSpan={5}>No tenant users yet.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                                <div className="sm:col-span-2 flex items-center justify-between"><h3 className="font-medium">{editingUser ? `Edit ${editingUser.name}` : 'Create user'}</h3>{editingUser && <Button size="sm" variant="ghost" onClick={startCreateUser}>Cancel edit</Button>}</div>
                                <div className="grid gap-1"><Label htmlFor="tenant-user-name">Name</Label><Input id="tenant-user-name" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} /></div>
                                <div className="grid gap-1"><Label htmlFor="tenant-user-email">Email</Label><Input id="tenant-user-email" type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></div>
                                <div className="grid gap-1"><Label htmlFor="tenant-user-password">{editingUser ? 'New password (optional)' : 'Password'}</Label><Input id="tenant-user-password" type="password" autoComplete="new-password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} /></div>
                                <div className="grid gap-1"><Label htmlFor="tenant-user-role">Role</Label><select id="tenant-user-role" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={userForm.role_id} onChange={(event) => setUserForm({ ...userForm, role_id: event.target.value })}><option value="">Select role</option>{usersTenant.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
                                <div className="grid gap-1"><Label htmlFor="tenant-user-branch">Branch</Label><select id="tenant-user-branch" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={userForm.branch_id} onChange={(event) => setUserForm({ ...userForm, branch_id: event.target.value })}><option value="">All branches / none</option>{usersTenant.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
                                <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={userForm.is_active} onChange={(event) => setUserForm({ ...userForm, is_active: event.target.checked })} />Active account</label>
                                <div className="sm:col-span-2"><Button onClick={saveUser}>{editingUser ? 'Save user' : 'Create user'}</Button></div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

Tenants.layout = { breadcrumbs: [{ title: 'Tenant Management', href: '/admin/tenants' }] };
