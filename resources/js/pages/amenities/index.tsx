import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Branch = {
    id: number;
    name: string;
};

type Amenity = {
    id: number;
    branch_id: number;
    branch: Branch | null;
    name: string;
    icon_type: string;
    icon_value: string;
    category: string;
    color: string;
    is_active: boolean;
    sort_order: number;
};

type AmenityForm = {
    branch_id: string;
    name: string;
    icon_type: string;
    icon_value: string;
    category: string;
    color: string;
    is_active: boolean;
    sort_order: string;
};

type Props = {
    amenities: Amenity[];
    branches: Branch[];
};

const blank: AmenityForm = {
    branch_id: '',
    name: '',
    icon_type: 'heroicon',
    icon_value: '',
    category: 'general',
    color: '#6B7280',
    is_active: true,
    sort_order: '0',
};

export default function Amenities({ amenities, branches }: Props) {
    const page = usePage();
    const errors = (
        page.props as typeof page.props & { errors?: Record<string, string> }
    ).errors ?? {};
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAmenity, setEditingAmenity] = useState<Amenity | null>(null);
    const [form, setForm] = useState<AmenityForm>(blank);

    const openCreateDialog = () => {
        setEditingAmenity(null);
        setForm({ ...blank, branch_id: String(branches[0]?.id ?? '') });
        setIsDialogOpen(true);
    };

    const openEditDialog = (amenity: Amenity) => {
        setEditingAmenity(amenity);
        setForm({
            branch_id: String(amenity.branch_id),
            name: amenity.name,
            icon_type: amenity.icon_type,
            icon_value: amenity.icon_value,
            category: amenity.category,
            color: amenity.color,
            is_active: amenity.is_active,
            sort_order: String(amenity.sort_order),
        });
        setIsDialogOpen(true);
    };

    const saveAmenity = () => {
        const options = {
            preserveScroll: true,
            onSuccess: () => setIsDialogOpen(false),
        };

        if (editingAmenity) {
            router.put(`/amenities/${editingAmenity.id}`, form, options);
            return;
        }

        router.post('/amenities', form, options);
    };

    const deleteAmenity = (amenity: Amenity) => {
        if (window.confirm(`Delete the "${amenity.name}" amenity?`)) {
            router.delete(`/amenities/${amenity.id}`, { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title="Amenities" />
            <div className="space-y-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold">Amenities</h1>
                        <p className="text-muted-foreground">
                            Manage the amenity options available when creating units.
                        </p>
                    </div>
                    <Button onClick={openCreateDialog} disabled={branches.length === 0}>
                        Add amenity
                    </Button>
                </div>

                {branches.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                        Create a branch before adding amenities.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left">Branch</th>
                                    <th className="px-4 py-3 text-left">Name</th>
                                    <th className="px-4 py-3 text-left">Icon</th>
                                    <th className="px-4 py-3 text-left">Category</th>
                                    <th className="px-4 py-3 text-left">Color</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-left">Sort order</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {amenities.map((amenity) => (
                                    <tr key={amenity.id} className="border-t">
                                        <td className="px-4 py-3">{amenity.branch?.name ?? '—'}</td>
                                        <td className="px-4 py-3 font-medium">{amenity.name}</td>
                                        <td className="px-4 py-3">
                                            <span className="capitalize">{amenity.icon_type}</span>
                                            {': '}
                                            {amenity.icon_value}
                                        </td>
                                        <td className="px-4 py-3 capitalize">{amenity.category}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-2">
                                                <span
                                                    aria-hidden="true"
                                                    className="size-4 rounded-full border"
                                                    style={{ backgroundColor: amenity.color }}
                                                />
                                                {amenity.color}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {amenity.is_active ? 'Active' : 'Inactive'}
                                        </td>
                                        <td className="px-4 py-3">{amenity.sort_order}</td>
                                        <td className="space-x-2 px-4 py-3 text-right">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openEditDialog(amenity)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => deleteAmenity(amenity)}
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {amenities.length === 0 && branches.length > 0 && (
                    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                        No amenities yet. Add one to use it on units.
                    </div>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingAmenity ? 'Edit amenity' : 'Create amenity'}
                        </DialogTitle>
                        <DialogDescription>
                            Set the branch and amenity details used by unit managers.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <div className="grid gap-1">
                            <Label htmlFor="amenity-branch">Branch</Label>
                            <select
                                id="amenity-branch"
                                className="h-9 rounded-md border bg-transparent px-3 text-sm"
                                value={form.branch_id}
                                onChange={(event) =>
                                    setForm({ ...form, branch_id: event.target.value })
                                }
                            >
                                <option value="">Select a branch</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name}
                                    </option>
                                ))}
                            </select>
                            {errors.branch_id && (
                                <p role="alert" className="text-sm text-destructive">
                                    {errors.branch_id}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-1">
                            <Label htmlFor="amenity-name">Name</Label>
                            <Input
                                id="amenity-name"
                                value={form.name}
                                onChange={(event) =>
                                    setForm({ ...form, name: event.target.value })
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        saveAmenity();
                                    }
                                }}
                                autoFocus
                            />
                            {errors.name && (
                                <p role="alert" className="text-sm text-destructive">
                                    {errors.name}
                                </p>
                            )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-1">
                                <Label htmlFor="amenity-icon-type">Icon type</Label>
                                <Input
                                    id="amenity-icon-type"
                                    value={form.icon_type}
                                    onChange={(event) =>
                                        setForm({ ...form, icon_type: event.target.value })
                                    }
                                    placeholder="heroicon, svg, image"
                                />
                                {errors.icon_type && (
                                    <p role="alert" className="text-sm text-destructive">
                                        {errors.icon_type}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="amenity-icon-value">Icon value</Label>
                                <Input
                                    id="amenity-icon-value"
                                    value={form.icon_value}
                                    onChange={(event) =>
                                        setForm({ ...form, icon_value: event.target.value })
                                    }
                                    placeholder="Wifi"
                                />
                                {errors.icon_value && (
                                    <p role="alert" className="text-sm text-destructive">
                                        {errors.icon_value}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="amenity-category">Category</Label>
                                <Input
                                    id="amenity-category"
                                    value={form.category}
                                    onChange={(event) =>
                                        setForm({ ...form, category: event.target.value })
                                    }
                                    placeholder="general"
                                />
                                {errors.category && (
                                    <p role="alert" className="text-sm text-destructive">
                                        {errors.category}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="amenity-color">Color</Label>
                                <Input
                                    id="amenity-color"
                                    type="color"
                                    value={form.color}
                                    onChange={(event) =>
                                        setForm({ ...form, color: event.target.value })
                                    }
                                />
                                {errors.color && (
                                    <p role="alert" className="text-sm text-destructive">
                                        {errors.color}
                                    </p>
                                )}
                            </div>
                            <div className="grid gap-1">
                                <Label htmlFor="amenity-sort-order">Sort order</Label>
                                <Input
                                    id="amenity-sort-order"
                                    type="number"
                                    value={form.sort_order}
                                    onChange={(event) =>
                                        setForm({ ...form, sort_order: event.target.value })
                                    }
                                />
                                {errors.sort_order && (
                                    <p role="alert" className="text-sm text-destructive">
                                        {errors.sort_order}
                                    </p>
                                )}
                            </div>
                            <label className="flex items-center gap-2 self-end pb-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(event) =>
                                        setForm({ ...form, is_active: event.target.checked })
                                    }
                                />
                                Active
                            </label>
                            {errors.is_active && (
                                <p role="alert" className="text-sm text-destructive">
                                    {errors.is_active}
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveAmenity}>
                            {editingAmenity ? 'Save changes' : 'Create amenity'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

Amenities.layout = { breadcrumbs: [{ title: 'Amenities', href: '/amenities' }] };
