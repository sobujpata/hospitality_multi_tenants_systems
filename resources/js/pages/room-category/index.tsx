import { Head, router } from '@inertiajs/react';
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

type UnitCategory = {
    id: number;
    name: string;
    unit_type: 'room' | 'table' | 'villa' | 'desk';
    description: string | null;
};

type Props = {
    categories: UnitCategory[];
};

type CategoryForm = {
    name: string;
    unit_type: UnitCategory['unit_type'];
    description: string;
};

const emptyForm: CategoryForm = {
    name: '',
    unit_type: 'room',
    description: '',
};

const unitTypes: UnitCategory['unit_type'][] = ['room', 'table', 'villa', 'desk'];

export default function RoomCategories({ categories }: Props) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<UnitCategory | null>(null);
    const [form, setForm] = useState<CategoryForm>(emptyForm);

    const openCreateDialog = () => {
        setEditingCategory(null);
        setForm(emptyForm);
        setIsDialogOpen(true);
    };

    const openEditDialog = (category: UnitCategory) => {
        setEditingCategory(category);
        setForm({
            name: category.name,
            unit_type: category.unit_type,
            description: category.description ?? '',
        });
        setIsDialogOpen(true);
    };

    const saveCategory = () => {
        const options = {
            preserveScroll: true,
            onSuccess: () => setIsDialogOpen(false),
        };

        if (editingCategory) {
            router.put(`/unit-categories/${editingCategory.id}`, form, options);
            return;
        }

        router.post('/unit-categories', form, options);
    };

    const deleteCategory = (category: UnitCategory) => {
        if (window.confirm(`Delete the "${category.name}" category?`)) {
            router.delete(`/unit-categories/${category.id}`, { preserveScroll: true });
        }
    };

    return (
        <>
            <Head title="Room Categories" />
            <div className="space-y-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold">Room Categories</h1>
                        <p className="text-muted-foreground">
                            Organize rooms and other units into categories.
                        </p>
                    </div>
                    <Button onClick={openCreateDialog}>Add category</Button>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left">Name</th>
                                <th className="px-4 py-3 text-left">Unit type</th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((category) => (
                                <tr key={category.id} className="border-t">
                                    <td className="px-4 py-3 font-medium">{category.name}</td>
                                    <td className="px-4 py-3 capitalize">{category.unit_type}</td>
                                    <td className="px-4 py-3">{category.description || '—'}</td>
                                    <td className="space-x-2 px-4 py-3 text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openEditDialog(category)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => deleteCategory(category)}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {categories.length === 0 && (
                    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                        No room categories yet. Add a category to get started.
                    </div>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory ? 'Edit category' : 'Create category'}
                        </DialogTitle>
                        <DialogDescription>
                            Set the category name, unit type, and optional description.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="category-name">Name</Label>
                            <Input
                                id="category-name"
                                value={form.name}
                                onChange={(event) =>
                                    setForm({ ...form, name: event.target.value })
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="category-unit-type">Unit type</Label>
                            <select
                                id="category-unit-type"
                                className="h-9 rounded-md border bg-transparent px-3 text-sm"
                                value={form.unit_type}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        unit_type: event.target.value as CategoryForm['unit_type'],
                                    })
                                }
                            >
                                {unitTypes.map((unitType) => (
                                    <option key={unitType} value={unitType}>
                                        {unitType}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="category-description">Description</Label>
                            <textarea
                                id="category-description"
                                className="min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm"
                                value={form.description}
                                onChange={(event) =>
                                    setForm({ ...form, description: event.target.value })
                                }
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveCategory}>
                            {editingCategory ? 'Save changes' : 'Create category'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

RoomCategories.layout = {
    breadcrumbs: [{ title: 'Room Categories', href: '/room-category' }],
};
