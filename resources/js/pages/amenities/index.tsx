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

type Amenity = {
    id: number;
    name: string;
};

type Props = {
    amenities: Amenity[];
};

export default function Amenities({ amenities }: Props) {
    const page = usePage();
    const errors = (
        page.props as typeof page.props & { errors?: Record<string, string> }
    ).errors ?? {};
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAmenity, setEditingAmenity] = useState<Amenity | null>(null);
    const [name, setName] = useState('');

    const openCreateDialog = () => {
        setEditingAmenity(null);
        setName('');
        setIsDialogOpen(true);
    };

    const openEditDialog = (amenity: Amenity) => {
        setEditingAmenity(amenity);
        setName(amenity.name);
        setIsDialogOpen(true);
    };

    const saveAmenity = () => {
        const options = {
            preserveScroll: true,
            onSuccess: () => setIsDialogOpen(false),
        };

        if (editingAmenity) {
            router.put(`/amenities/${editingAmenity.id}`, { name }, options);
            return;
        }

        router.post('/amenities', { name }, options);
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
                    <Button onClick={openCreateDialog}>Add amenity</Button>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left">Name</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {amenities.map((amenity) => (
                                <tr key={amenity.id} className="border-t">
                                    <td className="px-4 py-3 font-medium">{amenity.name}</td>
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

                {amenities.length === 0 && (
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
                            Add a name that unit managers can select on the unit form.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                        <Label htmlFor="amenity-name">Name</Label>
                        <Input
                            id="amenity-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
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
                    <DialogFooter>
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
