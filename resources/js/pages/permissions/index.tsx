import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Permission = { id: number; name: string };
type Props = { permissions: Permission[] };

export default function Permissions({ permissions }: Props) {
    const [editing, setEditing] = useState<Permission | null>(null);
    const [name, setName] = useState('');

    const reset = () => {
        setEditing(null);
        setName('');
    };

    const submit = () => {
        const options = { onSuccess: reset };
        if (editing) {
            router.put(`/permissions/${editing.id}`, { name }, options);
        } else {
            router.post('/permissions', { name }, options);
        }
    };

    const remove = (permission: Permission) => {
        if (window.confirm(`Delete the ${permission.name} permission?`)) {
            router.delete(`/permissions/${permission.id}`);
        }
    };

    return (
        <>
            <Head title="Permissions" />
            <div className="space-y-6 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">Permissions</h1>
                    <p className="text-muted-foreground">Manage permissions available to tenant roles.</p>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                    <section className="rounded-xl border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50"><tr><th className="px-4 py-3 text-left">Permission</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                            <tbody>{permissions.map((permission) => <tr key={permission.id} className="border-t"><td className="px-4 py-3">{permission.name}</td><td className="space-x-2 px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => { setEditing(permission); setName(permission.name); }}>Edit</Button><Button variant="ghost" size="sm" onClick={() => remove(permission)}>Delete</Button></td></tr>)}</tbody>
                        </table>
                    </section>
                    <section className="rounded-xl border p-4">
                        <h2 className="mb-4 font-medium">{editing ? 'Edit permission' : 'Create permission'}</h2>
                        <div className="grid gap-2"><Label htmlFor="permission-name">Name</Label><Input id="permission-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. bookings.export" /></div>
                        <div className="mt-4 flex gap-2"><Button onClick={submit} disabled={!name.trim()}>{editing ? 'Save changes' : 'Create permission'}</Button>{editing && <Button variant="outline" onClick={reset}>Cancel</Button>}</div>
                    </section>
                </div>
            </div>
        </>
    );
}

Permissions.layout = { breadcrumbs: [{ title: 'Permissions', href: '/permissions' }] };
