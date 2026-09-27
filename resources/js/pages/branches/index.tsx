import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Branch = {
    id: number;
    name: string;
    type: string;
    city: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    timezone: string;
    currency: string;
    star_rating: number | null;
    cover_image: string | null;
    is_active: boolean;
    settings: Record<string, string> | null;
};

type Props = {
    branches: { data: Branch[]; links: { url: string | null; label: string; active: boolean }[] };
    currentBranchId?: number | null;
    settingsBranch?: Branch | null;
};

const blank = {
    name: '', type: 'hotel', address: '', city: '', country: '', phone: '',
    email: '', timezone: 'UTC', currency: 'USD', star_rating: '', amenities: '',
    is_active: true, cover_image: null as File | null,
};

export default function Branches({ branches, currentBranchId, settingsBranch }: Props) {
    const page = usePage();
    const shared = page.props as typeof page.props & { branchOptions?: { id: number; name: string }[] };
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Branch | null>(null);
    const [form, setForm] = useState(blank);
    const [settings, setSettings] = useState<Record<string, string>>(settingsBranch?.settings ?? {});

    const edit = (branch: Branch) => {
        setEditing(branch);
        setForm({
            ...blank,
            ...branch,
            address: '',
            city: branch.city ?? '',
            country: branch.country ?? '',
            phone: branch.phone ?? '',
            email: branch.email ?? '',
            star_rating: branch.star_rating ? String(branch.star_rating) : '',
            amenities: '',
            cover_image: null,
        });
        setOpen(true);
    };

    const submit = () => {
        const data = new FormData();
        Object.entries(form).forEach(([key, value]) => {
            if (value instanceof File) data.append(key, value);
            else if (value !== null && value !== undefined) data.append(key, String(value));
        });
        const options = { forceFormData: true, onSuccess: () => { setOpen(false); setEditing(null); } };
        editing ? router.post(`/branches/${editing.id}`, { ...Object.fromEntries(data), _method: 'put' }, options) : router.post('/branches', data, options);
    };

    const switchBranch = (branchId: string) => {
        router.post('/branch/switch', { branch_id: branchId ? Number(branchId) : null });
    };

    return (
        <>
            <Head title="Branches" />
            <div className="space-y-6 p-4">
                <div className="flex items-center justify-between">
                    <div><h1 className="text-2xl font-semibold">Branches</h1><p className="text-muted-foreground">Manage locations and branch settings.</p></div>
                    <Button onClick={() => { setEditing(null); setForm(blank); setOpen(true); }}>Add branch</Button>
                </div>
                <div className="rounded-xl border p-4">
                    <Label htmlFor="branch-switcher">Current branch</Label>
                    <select id="branch-switcher" className="mt-2 h-9 rounded-md border bg-transparent px-3 text-sm" value={currentBranchId ?? ''} onChange={(event) => switchBranch(event.target.value)}>
                        <option value="">All branches</option>
                        {(shared.branchOptions ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                </div>
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Location</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                        <tbody>{branches.data.map((branch) => <tr key={branch.id} className="border-t"><td className="px-4 py-3">{branch.name}</td><td className="px-4 py-3 capitalize">{branch.type}</td><td className="px-4 py-3">{[branch.city, branch.country].filter(Boolean).join(', ')}</td><td className="px-4 py-3">{branch.is_active ? 'Active' : 'Inactive'}</td><td className="space-x-2 px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => edit(branch)}>Edit</Button><Button size="sm" variant="outline" onClick={() => router.get('/branches', { settings_branch_id: branch.id })}>Settings</Button><Button size="sm" variant="ghost" onClick={() => router.delete(`/branches/${branch.id}`)}>Delete</Button></td></tr>)}</tbody>
                    </table>
                </div>
                <div className="flex gap-2">{branches.links.map((link) => <button key={link.label} className={`rounded border px-3 py-1 text-sm ${link.active ? 'bg-primary text-primary-foreground' : ''}`} disabled={!link.url} onClick={() => link.url && router.get(link.url)} dangerouslySetInnerHTML={{ __html: link.label }} />)}</div>
                {settingsBranch && <section className="rounded-xl border p-4"><h2 className="mb-4 font-medium">Settings: {settingsBranch.name}</h2><div className="flex gap-2"><Input placeholder="Setting key" id="setting-key" /><Input placeholder="Value" id="setting-value" /><Button onClick={() => { const key = (document.getElementById('setting-key') as HTMLInputElement).value; const value = (document.getElementById('setting-value') as HTMLInputElement).value; router.put(`/branches/${settingsBranch.id}/settings`, { settings: { ...settings, [key]: value } }); }}>Save setting</Button></div></section>}
            </div>
            <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Edit branch' : 'Create branch'}</DialogTitle><DialogDescription>Configure the branch details and cover image.</DialogDescription></DialogHeader>
                <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1">
                    {(['name', 'address', 'city', 'country', 'phone', 'email', 'timezone', 'currency', 'star_rating'] as const).map((field) => <div key={field} className="grid gap-1"><Label htmlFor={`branch-${field}`}>{field.replace('_', ' ')}</Label><Input id={`branch-${field}`} value={form[field] as string} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></div>)}
                    <div className="grid gap-1"><Label htmlFor="branch-type">Type</Label><select id="branch-type" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{['hotel', 'restaurant', 'resort', 'hostel'].map((type) => <option key={type}>{type}</option>)}</select></div>
                    <div className="grid gap-1"><Label htmlFor="branch-cover">Cover image</Label><Input id="branch-cover" type="file" accept="image/*" onChange={(event) => setForm({ ...form, cover_image: event.target.files?.[0] ?? null })} /></div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active</label>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>{editing ? 'Save changes' : 'Create branch'}</Button></DialogFooter>
            </DialogContent></Dialog>
        </>
    );
}

Branches.layout = { breadcrumbs: [{ title: 'Branches', href: '/branches' }] };
