import { Head, router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Building2, Check, CircleUserRound, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Role = { id: number; name: string };
type Branch = { id: number; name: string };
type User = {
    id: number;
    branch_id: number | null;
    name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    roles: Role[];
    branch: Branch | null;
};

type Props = {
    users: User[];
    roles: Role[];
    branches: Branch[];
    branchRestricted: boolean;
};

type UserForm = {
    name: string;
    email: string;
    phone: string;
    password: string;
    role_id: string;
    branch_id: string;
    is_active: boolean;
};

const emptyForm: UserForm = {
    name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
    branch_id: '',
    is_active: true,
};

export default function Users({ users, roles, branches, branchRestricted }: Props) {
    const page = usePage();
    const errors = (page.props as typeof page.props & { errors?: Record<string, string> }).errors ?? {};
    const status = (page.props as typeof page.props & { flash?: { status?: string } }).flash?.status;
    const [editing, setEditing] = useState<User | null>(null);
    const [form, setForm] = useState<UserForm>({
        ...emptyForm,
        branch_id: branchRestricted ? String(branches[0]?.id ?? '') : '',
    });
    const [processing, setProcessing] = useState(false);
    const [search, setSearch] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return users;
        return users.filter((user) =>
            `${user.name} ${user.email} ${user.branch?.name ?? ''} ${user.roles.map((role) => role.name).join(' ')}`
                .toLowerCase()
                .includes(query),
        );
    }, [search, users]);

    const activeCount = users.filter((user) => user.is_active).length;
    const startEdit = (user: User) => {
        setEditing(user);
        setForm({
            name: user.name,
            email: user.email,
            phone: user.phone ?? '',
            password: '',
            role_id: String(user.roles[0]?.id ?? ''),
            branch_id: String(user.branch_id ?? ''),
            is_active: user.is_active,
        });
        setIsDialogOpen(true);
    };

    const reset = () => {
        setEditing(null);
        setForm({
            ...emptyForm,
            branch_id: branchRestricted ? String(branches[0]?.id ?? '') : '',
        });
        setIsDialogOpen(false);
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setProcessing(true);
        const data = {
            ...form,
            role_id: Number(form.role_id),
            branch_id: form.branch_id ? Number(form.branch_id) : null,
        };
        const options = { onFinish: () => setProcessing(false), onSuccess: reset };

        if (editing) {
            router.put(`/users/${editing.id}`, data, options);
        } else {
            router.post('/users', data, options);
        }
    };

    const remove = (user: User) => {
        if (window.confirm(`Remove ${user.name} from staff?`)) {
            router.delete(`/users/${user.id}`);
        }
    };

    const selectedRole = roles.find((role) => String(role.id) === form.role_id);
    const branchIsRequired = selectedRole?.name !== 'Tenant Admin';

    return (
        <>
            <Head title="Staff management" />
            <div className="min-h-full bg-slate-50/70 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl space-y-7">
                    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                        <div>
                            <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">People & access</p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Staff management</h1>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Create staff accounts, assign roles, and keep access organized by branch.</p>
                        </div>
                        <Button type="button" onClick={() => { reset(); setIsDialogOpen(true); }} className="h-11 rounded-xl bg-slate-900 px-5 font-semibold shadow-sm hover:bg-emerald-700">
                            <Plus className="mr-2 size-4" aria-hidden="true" /> Add staff member
                        </Button>
                    </header>

                    {status && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{status}</div>}

                    <div className="grid gap-4 sm:grid-cols-3">
                        <StatCard icon={UsersRound} label="Staff accounts" value={users.length} detail="In your workspace" />
                        <StatCard icon={ShieldCheck} label="Active accounts" value={activeCount} detail={`${users.length - activeCount} inactive`} />
                        <StatCard icon={Building2} label="Branches" value={branches.length} detail={branchRestricted ? 'Your assigned branch' : 'Available for assignment'} />
                    </div>

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900">Team directory</h2>
                                    <p className="mt-1 text-sm text-slate-500">{users.length} {users.length === 1 ? 'member' : 'members'} across your branches</p>
                                </div>
                                <label className="relative block sm:w-72">
                                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff…" aria-label="Search staff" className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 focus-visible:bg-white" />
                                </label>
                            </div>
                            {filteredUsers.length === 0 ? (
                                <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                                    <span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><UsersRound className="size-6" aria-hidden="true" /></span>
                                    <h3 className="mt-4 font-semibold text-slate-800">{search ? 'No staff found' : 'Your team starts here'}</h3>
                                    <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">{search ? 'Try another name, email, role, or branch.' : 'Create a staff account and assign it to a branch to get started.'}</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-left text-sm">
                                        <thead className="bg-slate-50/80 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                            <tr><th className="px-5 py-3.5">Staff member</th><th className="px-4 py-3.5">Branch</th><th className="px-4 py-3.5">Role</th><th className="px-4 py-3.5">Status</th><th className="px-5 py-3.5 text-right">Actions</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredUsers.map((user) => (
                                                <tr key={user.id} className="transition-colors hover:bg-slate-50/70">
                                                    <td className="px-5 py-4">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-sm font-semibold text-emerald-800">{user.name.trim().charAt(0).toUpperCase()}</span>
                                                            <span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{user.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{user.email}</span></span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 text-slate-600"><Building2 className="size-3.5 text-slate-400" aria-hidden="true" />{user.branch?.name ?? 'All branches'}</span></td>
                                                    <td className="px-4 py-4"><span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{user.roles.map((role) => role.name).join(', ') || 'No role'}</span></td>
                                                    <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.is_active ? 'text-emerald-700' : 'text-slate-400'}`}><span className={`size-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />{user.is_active ? 'Active' : 'Inactive'}</span></td>
                                                    <td className="px-5 py-4"><div className="flex justify-end gap-1.5"><Button type="button" variant="ghost" size="sm" onClick={() => startEdit(user)} className="rounded-lg text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"><Pencil className="mr-1.5 size-3.5" aria-hidden="true" />Edit</Button><Button type="button" variant="ghost" size="sm" onClick={() => remove(user)} className="rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Delete ${user.name}`}><Trash2 className="size-4" aria-hidden="true" /></Button></div></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                    </section>

                    <Dialog open={isDialogOpen} onOpenChange={(open) => { if (open) { setIsDialogOpen(true); } else { reset(); } }}>
                        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl border-slate-200 p-0 sm:max-w-xl">
                            <DialogHeader className="border-b border-slate-100 bg-gradient-to-r from-white to-emerald-50/60 px-6 py-5 pr-14">
                                <div className="flex items-center gap-3">
                                    <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800">{editing ? <Pencil className="size-4" aria-hidden="true" /> : <CircleUserRound className="size-5" aria-hidden="true" />}</span>
                                    <div><DialogTitle className="text-base font-semibold text-slate-900">{editing ? 'Edit staff member' : 'Add to your team'}</DialogTitle><DialogDescription className="mt-1 text-xs text-slate-500">{editing ? 'Update staff details and access.' : 'Create a staff account and assign a branch and role.'}</DialogDescription></div>
                                </div>
                            </DialogHeader>
                            <form onSubmit={submit} className="space-y-4 px-6 py-5">
                                <Field label="Full name" id="user-name" error={errors.name}><Input id="user-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" placeholder="e.g. Alex Morgan" className="h-10 rounded-xl border-slate-200" /></Field>
                                <Field label="Email address" id="user-email" error={errors.email}><Input id="user-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" placeholder="alex@example.com" className="h-10 rounded-xl border-slate-200" /></Field>
                                <Field label="Phone number" id="user-phone" error={errors.phone}><Input id="user-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} autoComplete="tel" placeholder="Optional" className="h-10 rounded-xl border-slate-200" /></Field>
                                <Field label="Branch" id="user-branch" error={errors.branch_id}>
                                    <select id="user-branch" required={branchIsRequired} disabled={branchRestricted} value={form.branch_id} onChange={(event) => setForm({ ...form, branch_id: event.target.value })} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:bg-slate-50 disabled:text-slate-500">
                                        {!branchIsRequired && <option value="">Tenant-wide access</option>}
                                        {branchIsRequired && <option value="" disabled>Select a branch</option>}
                                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Staff role" id="user-role" error={errors.role_id}>
                                    <select id="user-role" required value={form.role_id} onChange={(event) => setForm({ ...form, role_id: event.target.value, branch_id: roles.find((role) => String(role.id) === event.target.value)?.name === 'Tenant Admin' ? '' : (form.branch_id || (branchRestricted ? String(branches[0]?.id ?? '') : '')) })} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10">
                                        <option value="" disabled>Select a role</option>
                                        {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                                    </select>
                                </Field>
                                <Field label={editing ? 'New password (optional)' : 'Temporary password'} id="user-password" error={errors.password}>
                                    <div className="relative"><KeyRound className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><Input id="user-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" placeholder={editing ? 'Leave blank to keep current' : 'At least 8 characters'} required={!editing} className="h-10 rounded-xl border-slate-200 pl-9" /></div>
                                </Field>
                                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                                    <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="size-4 rounded border-slate-300 accent-emerald-600" />
                                    <span className="flex-1"><span className="block text-sm font-medium text-slate-800">Account active</span><span className="mt-0.5 block text-xs text-slate-500">This staff member can sign in</span></span>
                                    {form.is_active && <Check className="size-4 text-emerald-600" aria-hidden="true" />}
                                </label>
                                <div className="flex gap-2 pt-1">
                                    <Button type="submit" disabled={processing || !form.name || !form.email || !form.role_id || (!editing && !form.password)} className="h-11 flex-1 rounded-xl bg-slate-900 font-semibold hover:bg-emerald-700 disabled:opacity-50">{processing ? 'Saving…' : editing ? 'Save changes' : 'Create staff account'}</Button>
                                    {editing && <Button type="button" variant="outline" onClick={reset} className="h-11 rounded-xl border-slate-200">Cancel</Button>}
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </>
    );
}

function StatCard({ icon: Icon, label, value, detail }: { icon: typeof UsersRound; label: string; value: number; detail: string }) {
    return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="size-5" aria-hidden="true" /></span><span className="min-w-0"><span className="block text-2xl font-semibold tracking-tight text-slate-900">{value}</span><span className="mt-0.5 block text-xs font-medium text-slate-600">{label}</span><span className="mt-1 block truncate text-[11px] text-slate-400">{detail}</span></span></div>;
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
    return <div className="grid gap-1.5"><Label htmlFor={id} className="text-xs font-semibold text-slate-700">{label}</Label>{children}{error && <p role="alert" className="text-xs text-rose-600">{error}</p>}</div>;
}

Users.layout = { breadcrumbs: [{ title: 'Users', href: '/users' }] };
