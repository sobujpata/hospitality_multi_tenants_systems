import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Role = { id: number; name: string };
type User = {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    is_active: boolean;
    roles: Role[];
};

type Props = {
    users: User[];
    roles: Role[];
};

const emptyForm = {
    name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
    is_active: true,
};

export default function Users({ users, roles }: Props) {
    const [editing, setEditing] = useState<User | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [processing, setProcessing] = useState(false);

    const startEdit = (user: User) => {
        setEditing(user);
        setForm({
            name: user.name,
            email: user.email,
            phone: user.phone ?? '',
            password: '',
            role_id: String(user.roles[0]?.id ?? ''),
            is_active: user.is_active,
        });
    };

    const reset = () => {
        setEditing(null);
        setForm(emptyForm);
    };

    const submit = () => {
        setProcessing(true);
        const data = {
            ...form,
            role_id: form.role_id ? Number(form.role_id) : null,
        };
        const options = { onFinish: () => setProcessing(false), onSuccess: reset };

        if (editing) {
            router.put(`/users/${editing.id}`, data, options);
        } else {
            router.post('/users', data, options);
        }
    };

    const remove = (user: User) => {
        if (window.confirm(`Delete ${user.name}?`)) {
            router.delete(`/users/${user.id}`);
        }
    };

    return (
        <>
            <Head title="Users" />
            <div className="space-y-6 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">Users</h1>
                    <p className="text-muted-foreground">Manage tenant staff accounts and roles.</p>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                    <section className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left">Name</th>
                                    <th className="px-4 py-3 text-left">Email</th>
                                    <th className="px-4 py-3 text-left">Role</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id} className="border-t">
                                        <td className="px-4 py-3">{user.name}</td>
                                        <td className="px-4 py-3">{user.email}</td>
                                        <td className="px-4 py-3">{user.roles.map((role) => role.name).join(', ') || 'No role'}</td>
                                        <td className="px-4 py-3">{user.is_active ? 'Active' : 'Inactive'}</td>
                                        <td className="space-x-2 px-4 py-3 text-right">
                                            <Button variant="outline" size="sm" onClick={() => startEdit(user)}>Edit</Button>
                                            <Button variant="ghost" size="sm" onClick={() => remove(user)}>Delete</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                    <section className="rounded-xl border p-4">
                        <h2 className="mb-4 font-medium">{editing ? 'Edit user' : 'Create user'}</h2>
                        <div className="space-y-4">
                            <div className="grid gap-2"><Label htmlFor="user-name">Name</Label><Input id="user-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
                            <div className="grid gap-2"><Label htmlFor="user-email">Email</Label><Input id="user-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
                            <div className="grid gap-2"><Label htmlFor="user-phone">Phone</Label><Input id="user-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
                            <div className="grid gap-2"><Label htmlFor="user-password">Password {editing && '(leave blank to keep current)'}</Label><Input id="user-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></div>
                            <div className="grid gap-2"><Label htmlFor="user-role">Role</Label><select id="user-role" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={form.role_id} onChange={(event) => setForm({ ...form, role_id: event.target.value })}><option value="">No role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active</label>
                            <div className="flex gap-2"><Button onClick={submit} disabled={processing || !form.name || !form.email || (!editing && !form.password)}>{editing ? 'Save changes' : 'Create user'}</Button>{editing && <Button variant="outline" onClick={reset}>Cancel</Button>}</div>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

Users.layout = { breadcrumbs: [{ title: 'Users', href: '/users' }] };
