import { Head, Link, router, usePage } from '@inertiajs/react';
import { ImagePlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Unit = {
    id: number;
    branch_id: number;
    unit_type: 'room' | 'table' | 'villa' | 'desk';
    number: string;
    name: string;
    floor: string | null;
    capacity: number;
    child_capacity: number | null;
    base_price: string;
    price_weekend: string | null;
    amenities: string[] | null;
    images: string[] | null;
    image_urls: string[];
    status: 'available' | 'occupied' | 'maintenance' | 'reserved';
    category?: { id: number; name: string } | null;
};

type UnitType = Unit['unit_type'];
type UnitStatus = Unit['status'];
type AmenityOption = { id: number; name: string };
type UnitForm = {
    branch_id: string;
    unit_type: UnitType;
    number: string;
    name: string;
    floor: string;
    capacity: string;
    child_capacity: string;
    base_price: string;
    price_weekend: string;
    status: UnitStatus;
    unit_category_id: string;
};

type Props = {
    units: Unit[];
    categories: { id: number; name: string; unit_type: string }[];
    amenities: AmenityOption[];
    branches: { id: number; name: string }[];
    currentBranchId?: number | null;
};

const statuses: UnitStatus[] = ['available', 'occupied', 'maintenance', 'reserved'];
const unitTypes: UnitType[] = ['room', 'table', 'villa', 'desk'];
const colors: Record<UnitStatus, string> = {
    available: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    occupied: 'border-rose-300 bg-rose-50 text-rose-900',
    maintenance: 'border-amber-300 bg-amber-50 text-amber-900',
    reserved: 'border-sky-300 bg-sky-50 text-sky-900',
};

function UnitImagePreview({
    file,
    onRemove,
}: {
    file: File;
    onRemove: () => void;
}) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
        <div className="relative overflow-hidden rounded-lg border">
            {previewUrl && (
                <img
                    src={previewUrl}
                    alt={file.name}
                    className="h-28 w-full object-cover"
                />
            )}
            <p className="truncate px-2 py-1 text-xs">{file.name}</p>
            <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={onRemove}
                className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-white/90 text-slate-900 shadow"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}

export default function Units({ units, categories, amenities, branches, currentBranchId }: Props) {
    const page = usePage();
    const errors = (
        page.props as typeof page.props & { errors?: Record<string, string> }
    ).errors ?? {};
    const [selected, setSelected] = useState<number[]>([]);
    const [bulkStatus, setBulkStatus] = useState<UnitStatus>('available');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const [isDraggingImages, setIsDraggingImages] = useState(false);
    const [form, setForm] = useState<UnitForm>({
        branch_id: String(currentBranchId ?? branches[0]?.id ?? ''),
        unit_type: 'room',
        number: '',
        name: '',
        floor: '',
        capacity: '2',
        child_capacity: '0',
        base_price: '0',
        price_weekend: '',
        status: 'available',
        unit_category_id: '',
    });
    const update = <K extends keyof UnitForm>(key: K, value: UnitForm[K]) => {
        setForm((previous) => ({ ...previous, [key]: value }));
    };
    const create = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData();
        data.append('branch_id', form.branch_id);
        data.append('unit_type', form.unit_type);
        data.append('number', form.number);
        data.append('name', form.name);
        data.append('floor', form.floor);
        data.append('capacity', form.capacity);
        data.append('child_capacity', form.child_capacity);
        data.append('base_price', form.base_price);
        data.append('price_weekend', form.price_weekend);
        data.append('status', form.status);
        data.append('unit_category_id', form.unit_category_id);
        selectedAmenities.forEach((amenity) =>
            data.append('amenities[]', amenity),
        );
        imageFiles.forEach((image) => data.append('images[]', image));
        router.post('/units', data, {
            forceFormData: true,
            onSuccess: () => {
                setImageFiles([]);
                setSelectedAmenities([]);
                setForm((current) => ({
                    ...current,
                    number: '',
                    name: '',
                    floor: '',
                    capacity: '2',
                    base_price: '0',
                    price_weekend: '',
                    status: 'available',
                    unit_category_id: '',
                    child_capacity: '0',
                }));
                setIsCreateDialogOpen(false);
            },
        });
    };
    const addImages = (files: FileList | File[]) => {
        setImageFiles((current) => [...current, ...Array.from(files)]);
    };
    const bulkUpdate = () => {
        if (selected.length > 0) {
            router.post('/units/bulk-status', {
                unit_ids: selected,
                status: bulkStatus,
            });
        }
    };
    const availableCategories = categories.filter(
        (category) => category.unit_type === form.unit_type,
    );

    return (
        <>
            <Head title="Units & Floor Plan" />
            <div className="space-y-6 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold">Units & Floor Plan</h1>
                        <p className="text-muted-foreground">
                            Manage rooms, tables, villas, and desks visually by status.
                        </p>
                    </div>
                    <Button type="button" onClick={() => setIsCreateDialogOpen(true)}>
                        Add unit
                    </Button>
                </div>

                <Dialog
                    open={isCreateDialogOpen}
                    onOpenChange={setIsCreateDialogOpen}
                >
                    <DialogContent className="w-[calc(100vw-2rem)] max-h-[96vh] overflow-y-auto sm:max-w-[calc(100vw-2rem)]">
                        <DialogHeader>
                            <DialogTitle>Create unit</DialogTitle>
                            <DialogDescription>
                                Enter the unit details and add as many images as needed.
                            </DialogDescription>
                        </DialogHeader>
                <form
                    onSubmit={create}
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                    <div>
                        <Label htmlFor="unit-branch">Branch</Label>
                        <select
                            id="unit-branch"
                            required
                            className="mt-1 h-9 w-full rounded-md border px-2"
                            value={form.branch_id}
                            onChange={(event) => update('branch_id', event.target.value)}
                        >
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label htmlFor="unit-type">Unit type</Label>
                        <select
                            id="unit-type"
                            className="mt-1 h-9 w-full rounded-md border px-2"
                            value={form.unit_type}
                            onChange={(event) => {
                                update('unit_type', event.target.value as UnitType);
                                update('unit_category_id', '');
                            }}
                        >
                            {unitTypes.map((unitType) => (
                                <option key={unitType} value={unitType}>
                                    {unitType}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label htmlFor="unit-number">Number</Label>
                        <Input
                            id="unit-number"
                            required
                            className="mt-1"
                            value={form.number}
                            onChange={(event) => update('number', event.target.value)}
                            placeholder="101"
                        />
                    </div>
                    <div>
                        <Label htmlFor="unit-name">Name</Label>
                        <Input
                            id="unit-name"
                            required
                            className="mt-1"
                            value={form.name}
                            onChange={(event) => update('name', event.target.value)}
                            placeholder="Standard Room"
                        />
                    </div>
                    <div>
                        <Label htmlFor="unit-floor">Floor</Label>
                        <Input
                            id="unit-floor"
                            className="mt-1"
                            value={form.floor}
                            onChange={(event) => update('floor', event.target.value)}
                            placeholder="1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="unit-capacity">Adult capacity</Label>
                        <Input
                            id="unit-capacity"
                            required
                            type="number"
                            min="1"
                            className="mt-1"
                            value={form.capacity}
                            onChange={(event) => update('capacity', event.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="unit-child-capacity">Child capacity</Label>
                        <Input
                            id="unit-child-capacity"
                            type="number"
                            min="0"
                            className="mt-1"
                            value={form.child_capacity}
                            onChange={(event) => update('child_capacity', event.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="unit-base-price">Base price</Label>
                        <Input
                            id="unit-base-price"
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            className="mt-1"
                            value={form.base_price}
                            onChange={(event) => update('base_price', event.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="unit-weekend-price">Weekend price</Label>
                        <Input
                            id="unit-weekend-price"
                            type="number"
                            min="0"
                            step="0.01"
                            className="mt-1"
                            value={form.price_weekend}
                            onChange={(event) =>
                                update('price_weekend', event.target.value)
                            }
                        />
                    </div>
                    <div>
                        <Label htmlFor="unit-category">Category</Label>
                        <select
                            id="unit-category"
                            className="mt-1 h-9 w-full rounded-md border px-2"
                            value={form.unit_category_id}
                            onChange={(event) =>
                                update('unit_category_id', event.target.value)
                            }
                        >
                            <option value="">None</option>
                            {availableCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <Label htmlFor="unit-status">Status</Label>
                        <select
                            id="unit-status"
                            className="mt-1 h-9 w-full rounded-md border px-2"
                            value={form.status}
                            onChange={(event) =>
                                update('status', event.target.value as UnitStatus)
                            }
                        >
                            {statuses.map((value) => (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="sm:col-span-1">
                        <Label htmlFor="unit-images">Room images</Label>
                        <div
                            onDragEnter={(event) => {
                                event.preventDefault();
                                setIsDraggingImages(true);
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDragLeave={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                                    setIsDraggingImages(false);
                                }
                            }}
                            onDrop={(event) => {
                                event.preventDefault();
                                setIsDraggingImages(false);
                                addImages(event.dataTransfer.files);
                            }}
                            className={`mt-1 rounded-xl border-2 border-dashed p-5 text-center transition ${
                                isDraggingImages
                                    ? 'border-primary bg-primary/5'
                                    : 'border-slate-300'
                            }`}
                        >
                            <input
                                id="unit-images"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className="sr-only"
                                onChange={(event) => {
                                    if (event.target.files) {
                                        addImages(event.target.files);
                                    }
                                    event.target.value = '';
                                }}
                            />
                            <ImagePlus className="mx-auto size-8 text-muted-foreground" />
                            <p className="mt-2 text-sm font-medium">
                                Drag and drop images here
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                or
                            </p>
                            <label
                                htmlFor="unit-images"
                                className="mt-2 inline-flex cursor-pointer rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                            >
                                Choose multiple images
                            </label>
                            <p className="mt-2 text-xs text-muted-foreground">
                                JPG, PNG, or WebP; up to 5 MB per image.
                            </p>
                        </div>
                        {errors.images && (
                            <p role="alert" className="mt-2 text-sm text-destructive">
                                {errors.images}
                            </p>
                        )}
                        {Object.entries(errors)
                            .filter(([key]) => key.startsWith('images.'))
                            .map(([key, message]) => (
                                <p
                                    key={key}
                                    role="alert"
                                    className="mt-2 text-sm text-destructive"
                                >
                                    {message}
                                </p>
                            ))}
                        {imageFiles.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {imageFiles.map((file, index) => (
                                    <UnitImagePreview
                                        key={`${file.name}-${file.size}-${index}`}
                                        file={file}
                                        onRemove={() =>
                                            setImageFiles((current) =>
                                                current.filter(
                                                    (_, fileIndex) => fileIndex !== index,
                                                ),
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="sm:col-span-1">
                        <div className="flex items-center justify-between gap-3">
                            <Label>Amenities</Label>
                            <Link
                                href="/amenities"
                                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                                Manage amenities
                            </Link>
                        </div>
                        {amenities.length > 0 ? (
                            <div className="mt-2 grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                                {amenities.map((amenity) => (
                                    <label
                                        key={amenity.id}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedAmenities.includes(amenity.name)}
                                            onChange={(event) =>
                                                setSelectedAmenities((current) =>
                                                    event.target.checked
                                                        ? [...current, amenity.name]
                                                        : current.filter(
                                                              (name) => name !== amenity.name,
                                                          ),
                                                )
                                            }
                                            className="size-4 rounded border"
                                        />
                                        {amenity.name}
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                                No amenities are configured yet. Add options using Manage
                                amenities.
                            </p>
                        )}
                        {errors.amenities && (
                            <p role="alert" className="mt-2 text-sm text-destructive">
                                {errors.amenities}
                            </p>
                        )}
                    </div>
                    
                    <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCreateDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">Create unit</Button>
                    </div>
                </form>
                    </DialogContent>
                </Dialog>

                <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                    <span className="text-sm font-medium">{selected.length} selected</span>
                    <select
                        className="h-9 rounded-md border px-2"
                        value={bulkStatus}
                        onChange={(event) =>
                            setBulkStatus(event.target.value as UnitStatus)
                        }
                    >
                        {statuses.map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                    <Button disabled={!selected.length} onClick={bulkUpdate}>
                        Update selected
                    </Button>
                    {statuses.map((value) => (
                        <span
                            key={value}
                            className={`rounded px-2 py-1 text-xs ${colors[value]}`}
                        >
                            {value}
                        </span>
                    ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {units.map((unit) => (
                        <button
                            type="button"
                            key={unit.id}
                            onClick={() =>
                                setSelected((previous) =>
                                    previous.includes(unit.id)
                                        ? previous.filter((id) => id !== unit.id)
                                        : [...previous, unit.id],
                                )
                            }
                            className={`min-w-0 rounded-xl border-2 p-4 text-left shadow-sm transition ${colors[unit.status]} ${
                                selected.includes(unit.id)
                                    ? 'ring-2 ring-primary ring-offset-2'
                                    : ''
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <strong>{unit.number}</strong>
                                <span className="text-xs uppercase">{unit.unit_type}</span>
                            </div>
                            <div className="mt-2 text-sm font-medium">{unit.name}</div>
                            <div className="mt-1 text-xs">
                                {unit.category?.name ?? 'Uncategorized'} · Floor{' '}
                                {unit.floor ?? '-'} · Capacity {unit.capacity} · Child Capacity {unit.child_capacity ?? 0}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-3 text-xs font-medium">
                                <span>Base: {unit.base_price}</span>
                                {unit.price_weekend && (
                                    <span>Weekend: {unit.price_weekend}</span>
                                )}
                            </div>
                            {(unit.amenities ?? []).length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1">
                                    {(unit.amenities ?? []).map((amenity) => (
                                        <span
                                            key={amenity}
                                            className="rounded-full bg-white/80 px-2 py-1 text-xs"
                                        >
                                            {amenity}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {unit.image_urls.length > 0 && (
                                <div className="mt-3 space-y-1 border-t border-current/10 pt-2 text-xs">
                                    <p className="font-medium">
                                        {unit.image_urls.length}{' '}
                                        {unit.image_urls.length === 1 ? 'image' : 'images'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {unit.image_urls.map((image) => (
                                            <img
                                                key={image}
                                                src={image}
                                                alt={`${unit.name} room image`}
                                                loading="lazy"
                                                className="h-24 w-full rounded-md object-cover"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="mt-3 text-xs font-semibold uppercase">
                                {unit.status}
                            </div>
                        </button>
                    ))}
                </div>
                {!units.length && (
                    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
                        No units found for this branch.
                    </div>
                )}
            </div>
        </>
    );
}

Units.layout = { breadcrumbs: [{ title: 'Units & Floor Plan', href: '/units' }] };
