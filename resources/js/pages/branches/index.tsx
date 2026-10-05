import { Head, router, usePage } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Branch = {
    id: number;
    name: string;
    type: string;
    address: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    timezone: string;
    currency: string;
    star_rating: number | null;
    cover_image: string | null;
    latitude: string | null;
    longitude: string | null;
    google_place_id: string | null;
    map_zoom_level: number;
    map_marker_color: string | null;
    amenities: string[] | null;
    is_active: boolean;
    settings: Record<string, string> | null;
};

type BranchForm = {
    name: string;
    type: string;
    address: string;
    city: string;
    country: string;
    phone: string;
    email: string;
    timezone: string;
    currency: string;
    star_rating: string;
    amenities: string;
    latitude: string;
    longitude: string;
    google_place_id: string;
    map_zoom_level: string;
    map_marker_color: string;
    is_active: boolean;
    cover_image: File | null;
};

type Props = {
    branches: { data: Branch[]; links: { url: string | null; label: string; active: boolean }[] };
    currentBranchId?: number | null;
    settingsBranch?: Branch | null;
};

const blank = {
    name: '',
    type: 'hotel',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    timezone: 'UTC',
    currency: 'USD',
    star_rating: '',
    amenities: '',
    latitude: '',
    longitude: '',
    google_place_id: '',
    map_zoom_level: '15',
    map_marker_color: '#E74C3C',
    is_active: true,
    cover_image: null,
};

export default function Branches({ branches, currentBranchId, settingsBranch }: Props) {
    const page = usePage();
    const shared = page.props as typeof page.props & { branchOptions?: { id: number; name: string }[] };
    const errors = (
        page.props as typeof page.props & { errors?: Record<string, string> }
    ).errors ?? {};
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Branch | null>(null);
    const [form, setForm] = useState<BranchForm>(blank);
    const [settings, setSettings] = useState<Record<string, string>>(settingsBranch?.settings ?? {});

    const edit = (branch: Branch) => {
        setEditing(branch);
        setForm({
            ...blank,
            ...branch,
            address: branch.address ?? '',
            city: branch.city ?? '',
            country: branch.country ?? '',
            phone: branch.phone ?? '',
            email: branch.email ?? '',
            star_rating: branch.star_rating ? String(branch.star_rating) : '',
            amenities: (branch.amenities ?? []).join(', '),
            latitude: branch.latitude ?? '',
            longitude: branch.longitude ?? '',
            google_place_id: branch.google_place_id ?? '',
            map_zoom_level: String(branch.map_zoom_level ?? 15),
            map_marker_color: branch.map_marker_color ?? '#E74C3C',
            cover_image: null,
        });
        setOpen(true);
    };

    const mapQuery = form.latitude && form.longitude
        ? `${form.latitude},${form.longitude}`
        : [form.address, form.city, form.country].filter(Boolean).join(', ');
    const mapPreviewUrl = mapQuery
        ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${encodeURIComponent(form.map_zoom_level || '15')}&output=embed`
        : null;

    const submit = () => {
        const data = new FormData();
        Object.entries(form).forEach(([key, value]) => {
            if (key === 'amenities') {
                const amenities = String(value)
                    .split(',')
                    .map((amenity) => amenity.trim())
                    .filter(Boolean);

                if (amenities.length > 0) {
                    amenities.forEach((amenity) => data.append('amenities[]', amenity));
                } else {
                    data.append('amenities[]', '');
                }
            } else if (value instanceof File) {
                data.append(key, value);
            } else if (value !== null && value !== undefined) {
                data.append(key, String(value));
            }
        });
        const options = { forceFormData: true, onSuccess: () => { setOpen(false); setEditing(null); } };
        if (editing) {
            data.append('_method', 'put');
            router.post(`/branches/${editing.id}`, data, options);
        } else {
            router.post('/branches', data, options);
        }
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
                    <table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Location</th><th className="px-4 py-3 text-left">Time zone</th><th className="px-4 py-3 text-left">Map</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                        <tbody>{branches.data.map((branch) => {
                            const branchMapQuery = branch.latitude && branch.longitude
                                ? `${branch.latitude},${branch.longitude}`
                                : [branch.address, branch.city, branch.country].filter(Boolean).join(', ');

                            return (
                                <tr key={branch.id} className="border-t">
                                    <td className="px-4 py-3">{branch.name}</td>
                                    <td className="px-4 py-3 capitalize">{branch.type}</td>
                                    <td className="px-4 py-3">{[branch.city, branch.country].filter(Boolean).join(', ')}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{branch.timezone}</td>
                                    <td className="px-4 py-3">
                                        {branchMapQuery ? (
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branchMapQuery)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <MapPin className="size-4" />
                                                Open map
                                            </a>
                                        ) : (
                                            <span className="text-muted-foreground">Not set</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">{branch.is_active ? 'Active' : 'Inactive'}</td>
                                    <td className="space-x-2 px-4 py-3 text-right">
                                        <Button size="sm" variant="outline" onClick={() => edit(branch)}>Edit</Button>
                                        <Button size="sm" variant="outline" onClick={() => router.get('/branches', { settings_branch_id: branch.id })}>Settings</Button>
                                        <Button size="sm" variant="ghost" onClick={() => router.delete(`/branches/${branch.id}`)}>Delete</Button>
                                    </td>
                                </tr>
                            );
                        })}</tbody>
                    </table>
                </div>
                <div className="flex gap-2">{branches.links.map((link) => <button key={link.label} className={`rounded border px-3 py-1 text-sm ${link.active ? 'bg-primary text-primary-foreground' : ''}`} disabled={!link.url} onClick={() => link.url && router.get(link.url)} dangerouslySetInnerHTML={{ __html: link.label }} />)}</div>
                {settingsBranch && <section className="rounded-xl border p-4"><h2 className="mb-4 font-medium">Settings: {settingsBranch.name}</h2><div className="flex gap-2"><Input placeholder="Setting key" id="setting-key" /><Input placeholder="Value" id="setting-value" /><Button onClick={() => { const key = (document.getElementById('setting-key') as HTMLInputElement).value; const value = (document.getElementById('setting-value') as HTMLInputElement).value; router.put(`/branches/${settingsBranch.id}/settings`, { settings: { ...settings, [key]: value } }); }}>Save setting</Button></div></section>}
            </div>
            <Dialog open={open} onOpenChange={setOpen}><DialogContent className="h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto sm:max-w-none">
                <DialogHeader><DialogTitle>{editing ? 'Edit branch' : 'Create branch'}</DialogTitle><DialogDescription>Configure the branch details and cover image.</DialogDescription></DialogHeader>
                <div className="grid min-h-0 gap-6 overflow-y-auto pr-1 lg:grid-cols-2">
                    <div className="grid content-start gap-3 sm:grid-cols-2">
                        {(['name', 'address', 'city', 'country', 'phone', 'email', 'timezone', 'currency', 'star_rating'] as const).map((field) => <div key={field} className="grid gap-1"><Label htmlFor={`branch-${field}`}>{field.replace('_', ' ')}</Label><Input id={`branch-${field}`} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} /></div>)}
                        <div className="grid gap-1"><Label htmlFor="branch-type">Type</Label><select id="branch-type" className="h-9 rounded-md border bg-transparent px-3 text-sm" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{['hotel', 'restaurant', 'resort', 'hostel'].map((type) => <option key={type}>{type}</option>)}</select></div>
                        <div className="grid gap-1"><Label htmlFor="branch-cover">Cover image</Label><Input id="branch-cover" type="file" accept="image/*" onChange={(event) => setForm({ ...form, cover_image: event.target.files?.[0] ?? null })} /></div>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active</label>
                        <div className="grid gap-1 sm:col-span-2">
                            <Label htmlFor="branch-amenities">Amenities</Label>
                            <Input id="branch-amenities" value={form.amenities} onChange={(event) => setForm({ ...form, amenities: event.target.value })} placeholder="WiFi, Restaurant, Parking" />
                            <p className="text-xs text-muted-foreground">Separate amenities with commas.</p>
                        </div>
                    </div>
                    <section className="space-y-4 rounded-xl border p-4">
                        <div>
                            <h3 className="font-semibold">Google Maps location</h3>
                            <p className="text-sm text-muted-foreground">Enter coordinates to save a precise map pin. The preview updates as you edit the address or coordinates.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-1">
                                <Label htmlFor="branch-latitude">Latitude</Label>
                                <Input id="branch-latitude" type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} />
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="branch-longitude">Longitude</Label>
                                <Input id="branch-longitude" type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} />
                            </div>
                            <div className="grid gap-1 sm:col-span-2">
                                <Label htmlFor="branch-google-place-id">Google Place ID (optional)</Label>
                                <Input id="branch-google-place-id" value={form.google_place_id} onChange={(event) => setForm({ ...form, google_place_id: event.target.value })} />
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="branch-map-zoom">Map zoom (1–20)</Label>
                                <Input id="branch-map-zoom" type="number" min="1" max="20" value={form.map_zoom_level} onChange={(event) => setForm({ ...form, map_zoom_level: event.target.value })} />
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="branch-map-marker-color">Marker color</Label>
                                <Input id="branch-map-marker-color" type="color" value={form.map_marker_color} onChange={(event) => setForm({ ...form, map_marker_color: event.target.value })} />
                            </div>
                        </div>
                        {(errors.latitude || errors.longitude || errors.google_place_id || errors.map_zoom_level || errors.map_marker_color) && (
                            <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                                {[
                                    errors.latitude,
                                    errors.longitude,
                                    errors.google_place_id,
                                    errors.map_zoom_level,
                                    errors.map_marker_color,
                                ].filter(Boolean).join(' ')}
                            </div>
                        )}
                        {mapPreviewUrl ? (
                            <iframe
                                title="Branch location map preview"
                                src={mapPreviewUrl}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="h-80 w-full rounded-lg border"
                            />
                        ) : (
                            <div className="grid h-80 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
                                Enter an address or coordinates to preview this location on Google Maps.
                            </div>
                        )}
                    </section>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit}>{editing ? 'Save changes' : 'Create branch'}</Button></DialogFooter>
            </DialogContent></Dialog>
        </>
    );
}

Branches.layout = { breadcrumbs: [{ title: 'Branches', href: '/branches' }] };
