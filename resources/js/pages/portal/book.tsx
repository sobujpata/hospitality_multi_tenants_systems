import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AirVent,
    ArrowLeft,
    ArrowRight,
    BellRing,
    CarFront,
    Check,
    ChevronDown,
    Coffee,
    Croissant,
    Dumbbell,
    Droplets,
    GlassWater,
    Headset,
    MapPin,
    Minus,
    Phone,
    Plus,
    ShowerHead,
    Sparkles,
    Tv,
    Utensils,
    Wifi,
    Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayoutHome from '@/layouts/app-layout-home';

type Branch = {
    id: number;
    name: string;
    type: string;
    city: string | null;
    country: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    cover_image: string | null;
    star_rating: number | null;
    currency: string;
    amenities: string[];
    available_rooms: number;
    lowest_price: string | null;
};

type Unit = {
    id: number;
    branch_id: number;
    number: string;
    name: string;
    base_price: string;
    price_weekend: string | null;
    capacity: number;
    amenities: string[];
    images: string[];
    category: string | null;
};

type Props = {
    branches: Branch[];
    units: Unit[];
    checkIn: string;
    checkOut: string;
    location: string;
    selectedBranchId: number | null;
    selectedUnitId: number | null;
    selectedUnitIds?: number[];
    selectedRoomGuestNames?: Record<number, string[]>;
    selectedExtras: string[];
    adults: number;
    children: number;
    specialRequests: string;
    isAuthenticated: boolean;
};

const today = new Date().toISOString().slice(0, 10);
const roomPhotoFallbacks = [
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=85',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=85',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=85',
];
const facilityItems = [
    { name: 'Free WiFi', icon: Wifi },
    { name: 'Restaurant', icon: Utensils },
    { name: 'Gym', icon: Dumbbell },
    { name: 'Room Service', icon: BellRing },
    { name: 'Tea & Coffee', icon: Coffee },
    { name: 'Free toiletries', icon: Sparkles },
    { name: '24/hr Support', icon: Headset },
    { name: 'Hot water', icon: ShowerHead },
    { name: 'Air Condition', icon: AirVent },
    { name: 'Intercom', icon: Phone },
    { name: 'Complimentary Breakfast', icon: Croissant },
    { name: 'Mineral water', icon: GlassWater },
    { name: 'Television', icon: Tv },
    { name: 'Car Parking', icon: CarFront },
];

function categoryAnchor(name: string): string {
    return `room-category-${name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`;
}

function nightsBetween(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) {
        return 0;
    }

    return Math.max(
        0,
        Math.round(
            (new Date(`${checkOut}T00:00:00`).getTime() -
                new Date(`${checkIn}T00:00:00`).getTime()) /
                86400000,
        ),
    );
}

function formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}

export default function Book({
    branches,
    units,
    checkIn: initialCheckIn,
    checkOut: initialCheckOut,
    location: initialLocation,
    selectedBranchId,
    selectedUnitId,
    selectedUnitIds: initialSelectedUnitIds = [],
    selectedRoomGuestNames: initialSelectedRoomGuestNames = {},
    selectedExtras,
    adults: initialAdults,
    children: initialChildren,
    specialRequests: initialSpecialRequests,
    isAuthenticated,
}: Props) {
    const page = usePage();
    const errors = (
        page.props as typeof page.props & { errors?: Record<string, string> }
    ).errors ?? {};
    const [checkIn, setCheckIn] = useState(initialCheckIn);
    const [checkOut, setCheckOut] = useState(initialCheckOut);
    const [location, setLocation] = useState(initialLocation);
    const [branchId, setBranchId] = useState(selectedBranchId ?? 0);
    const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>(
        initialSelectedUnitIds.length > 0
            ? initialSelectedUnitIds
            : selectedUnitId
              ? [selectedUnitId]
              : [],
    );
    const [roomGuestNames, setRoomGuestNames] = useState<Record<number, string>>(
        Object.fromEntries(
            Object.entries(initialSelectedRoomGuestNames).map(([unitId, names]) => [
                Number(unitId),
                names.join('\n'),
            ]),
        ),
    );
    const [expandedCategoryDetails, setExpandedCategoryDetails] = useState<
        Record<string, boolean>
    >({});
    const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
    const [selectedRoomCategory, setSelectedRoomCategory] = useState<string | null>(
        null,
    );
    const [extras, setExtras] = useState<string[]>(selectedExtras);
    const [adults, setAdults] = useState(Math.max(1, initialAdults));
    const [children, setChildren] = useState(Math.max(0, initialChildren));
    const [specialRequests, setSpecialRequests] = useState(initialSpecialRequests);

    const branch = branches.find((item) => item.id === branchId);
    const branchUnits = units.filter((unit) => unit.branch_id === branchId);
    const nights = nightsBetween(checkIn, checkOut);
    const totalGuests = adults + children;
    const selectedUnits = selectedUnitIds
        .map((unitId) => branchUnits.find((unit) => unit.id === unitId))
        .filter((unit): unit is Unit => Boolean(unit));
    const capacity = selectedUnits.reduce((total, unit) => total + unit.capacity, 0);
    const currency = branch?.currency ?? 'USD';
    const roomPrice = (unit: Unit): number => {
        let total = 0;
        const firstNight = new Date(`${checkIn}T00:00:00`);
        for (let offset = 0; offset < nights; offset += 1) {
            const night = new Date(firstNight);
            night.setDate(firstNight.getDate() + offset);
            const isWeekend = night.getDay() === 0 || night.getDay() === 6;
            total += Number(
                isWeekend && unit.price_weekend
                    ? unit.price_weekend
                    : unit.base_price,
            );
        }
        return total;
    };
    const roomTotal = selectedUnits.reduce(
        (total, unit) => total + roomPrice(unit),
        0,
    );
    const additionalGuestCount = selectedUnits
        .flatMap((unit) => (roomGuestNames[unit.id] ?? '').split(/[\n,]+/))
        .filter((name) => name.trim()).length;
    const availableCategories = useMemo(() => {
        const categoryMap = new Map<
            string,
            { name: string; units: Unit[]; lowestPrice: number; capacity: number }
        >();

        for (const unit of branchUnits) {
            const name = unit.category ?? 'Guest room';
            const category = categoryMap.get(name) ?? {
                name,
                units: [],
                lowestPrice: Number.POSITIVE_INFINITY,
                capacity: 0,
            };
            category.units.push(unit);
            category.lowestPrice = Math.min(category.lowestPrice, Number(unit.base_price));
            category.capacity = Math.max(category.capacity, unit.capacity);
            categoryMap.set(name, category);
        }

        return Array.from(categoryMap.values()).sort((first, second) =>
            first.name.localeCompare(second.name),
        );
    }, [branchUnits]);
    const visibleCategories = selectedRoomCategory
        ? availableCategories.filter(
              (category) => category.name === selectedRoomCategory,
          )
        : availableCategories;
    const locations = useMemo(
        () =>
            Array.from(
                new Set(
                    branches.flatMap((item) =>
                        [item.city, item.country].filter(
                            (value): value is string => Boolean(value),
                        ),
                    ),
                ),
            ).sort(),
        [branches],
    );

    const loginParams = new URLSearchParams({
        check_in: checkIn,
        check_out: checkOut,
        location,
        branch_id: String(branchId),
        adults: String(adults),
        children: String(children),
        special_requests: specialRequests,
    });
    selectedUnitIds.forEach((unitId) => loginParams.append('unit_ids[]', String(unitId)));
    for (const [unitId, names] of Object.entries(roomGuestNames)) {
        if (selectedUnitIds.includes(Number(unitId))) {
            names.split(/[\n,]+/).map((name) => name.trim()).filter(Boolean).forEach((name) => {
                loginParams.append(`room_guest_names[${unitId}][]`, name);
            });
        }
    }
    const loginUrl = `/login?redirect=${encodeURIComponent(`/portal/book?${loginParams.toString()}`)}`;

    const search = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.get(
            '/portal/book',
            { check_in: checkIn, check_out: checkOut, location, adults, children },
            { preserveState: false },
        );
    };

    const toggleUnit = (unitId: number) => {
        setSelectedUnitIds((current) =>
            current.includes(unitId)
                ? current.filter((id) => id !== unitId)
                : [...current, unitId],
        );
    };

    const updateGuests = (type: 'adults' | 'children', change: number) => {
        if (type === 'adults') {
            setAdults((current) => Math.max(1, current + change));
        } else {
            setChildren((current) => Math.max(0, current + change));
        }
    };

    const confirmBooking = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!branch || selectedUnits.length === 0 || !checkIn || !checkOut) {
            return;
        }
        if (totalGuests > capacity) {
            return;
        }

        const loginUrlWithSelection = new URL(loginUrl, window.location.origin);
        if (!isAuthenticated) {
            window.location.assign(loginUrlWithSelection.toString());
            return;
        }

        router.post('/portal/book', {
            branch_id: branch.id,
            unit_ids: selectedUnits.map((unit) => unit.id),
            room_guest_names: Object.fromEntries(
                selectedUnits.map((unit) => [
                    unit.id,
                    (roomGuestNames[unit.id] ?? '')
                        .split(/[\n,]+/)
                        .map((name) => name.trim())
                        .filter(Boolean),
                ]),
            ),
            check_in: checkIn,
            check_out: checkOut,
            adults,
            children,
            extras,
            special_requests: specialRequests,
        });
    };

    return (
        <>
            <Head title="Choose your rooms" />
            <div className="min-h-screen bg-[#f7f7f4] text-slate-900">
                <section className="relative isolate overflow-hidden px-6 py-14 text-white lg:px-8">
                    <img
                        src={
                            branch?.cover_image ??
                            'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2200&q=85'
                        }
                        alt={branch ? `${branch.name} property` : ''}
                        aria-hidden={!branch}
                        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
                    />
                    <div className="absolute inset-0 -z-10 bg-slate-950/65" />
                    <div className="mx-auto max-w-7xl">
                        <p className="text-sm font-semibold tracking-[0.24em] text-amber-300 uppercase">
                            {branch ? 'Welcome to' : 'Find your stay'}
                        </p>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                            {branch ? branch.name : 'Choose a place, make it yours.'}
                        </h1>
                        {branch && (
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
                                <span className="capitalize">{branch.type}</span>
                                <span>
                                    {[branch.city, branch.country].filter(Boolean).join(', ')}
                                </span>
                                {branch.star_rating ? (
                                    <span className="text-amber-300">
                                        {'★'.repeat(branch.star_rating)}
                                    </span>
                                ) : null}
                            </div>
                        )}
                        <form
                            onSubmit={search}
                            className="mt-8 grid gap-3 rounded-2xl bg-white p-4 text-slate-900 shadow-xl md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end"
                        >
                            <label className="grid gap-1.5 text-sm font-medium">
                                Check-in
                                <Input
                                    required
                                    min={today}
                                    type="date"
                                    value={checkIn}
                                    onChange={(event) => setCheckIn(event.target.value)}
                                />
                            </label>
                            <label className="grid gap-1.5 text-sm font-medium">
                                Check-out
                                <Input
                                    required
                                    min={checkIn || today}
                                    type="date"
                                    value={checkOut}
                                    onChange={(event) => setCheckOut(event.target.value)}
                                />
                            </label>
                            <label className="grid gap-1.5 text-sm font-medium">
                                Location
                                <select
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    value={location}
                                    onChange={(event) => setLocation(event.target.value)}
                                >
                                    <option value="">All locations</option>
                                    {locations.map((item) => (
                                        <option key={item} value={item}>
                                            {item}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <Button className="bg-slate-950 hover:bg-slate-800" type="submit">
                                Check availability
                            </Button>
                        </form>
                        {checkIn && checkOut && (
                            <p className="mt-3 text-sm text-slate-200">
                                {nights} {nights === 1 ? 'night' : 'nights'} · {checkIn} to{' '}
                                {checkOut}
                            </p>
                        )}
                        {branch && (
                            <p className="mt-2 text-sm text-white/80">
                                {branch.available_rooms}{' '}
                                {branch.available_rooms === 1 ? 'room' : 'rooms'} available for
                                your stay
                            </p>
                        )}
                    </div>
                </section>

                {branch && (
                    <nav
                        aria-label="Property navigation"
                        className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur"
                    >
                        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 px-6 py-2 lg:px-8">
                            <div className="relative shrink-0">
                                <button
                                    type="button"
                                    aria-expanded={isRoomMenuOpen}
                                    aria-controls="property-room-menu"
                                    onClick={() => setIsRoomMenuOpen((open) => !open)}
                                    className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium hover:bg-slate-100"
                                >
                                    Rooms
                                    <ChevronDown
                                        className={`size-4 transition-transform ${isRoomMenuOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {isRoomMenuOpen && (
                                    <div
                                        id="property-room-menu"
                                        className="absolute left-0 top-full z-40 mt-2 max-h-72 min-w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                                    >
                                        <button
                                            type="button"
                                            aria-pressed={selectedRoomCategory === null}
                                            onClick={() => {
                                                setSelectedRoomCategory(null);
                                                setIsRoomMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-100"
                                        >
                                            All categories
                                            {selectedRoomCategory === null && (
                                                <Check className="size-4 text-amber-700" />
                                            )}
                                        </button>
                                        {availableCategories.map((category) => (
                                            <button
                                                type="button"
                                                key={category.name}
                                                aria-pressed={
                                                    selectedRoomCategory === category.name
                                                }
                                                onClick={() => {
                                                    setSelectedRoomCategory(category.name);
                                                    setIsRoomMenuOpen(false);
                                                }}
                                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
                                            >
                                                {category.name}
                                                {selectedRoomCategory === category.name && (
                                                    <Check className="size-4 text-amber-700" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {[
                                ['Facilities', 'facilities'],
                                ['Gallery', 'gallery'],
                                ['About', 'about'],
                                ['Contact', 'contact'],
                            ].map(([label, target]) => (
                                <a
                                    key={target}
                                    href={`#${target}`}
                                    className="shrink-0 rounded-full px-4 py-2 text-sm font-medium hover:bg-slate-100"
                                >
                                    {label}
                                </a>
                            ))}
                        </div>
                    </nav>
                )}

                <main className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
                    <div className="space-y-8">
                        {!branchId ? (
                            <section>
                                <div className="mb-4">
                                    <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
                                        Available properties
                                    </p>
                                    <h2 className="mt-1 text-2xl font-semibold">
                                        {branches.length
                                            ? `${branches.length} ${branches.length === 1 ? 'property' : 'properties'} to explore`
                                            : 'No stays found'}
                                    </h2>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {branches.map((item) => (
                                        <button
                                            type="button"
                                            key={item.id}
                                            onClick={() => {
                                                setBranchId(item.id);
                                                setSelectedUnitIds([]);
                                                setExtras([]);
                                                setSelectedRoomCategory(null);
                                            }}
                                            className="overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-amber-500"
                                        >
                                            <div
                                                className="h-40 bg-slate-200 bg-cover bg-center"
                                                style={
                                                    item.cover_image
                                                        ? { backgroundImage: `url("${item.cover_image}")` }
                                                        : undefined
                                                }
                                            />
                                            <div className="p-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="font-semibold">{item.name}</h3>
                                                    <span className="whitespace-nowrap text-amber-600">
                                                        {'★'.repeat(item.star_rating ?? 0)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                                                    <MapPin className="size-4" />
                                                    {[item.city, item.country]
                                                        .filter(Boolean)
                                                        .join(', ')}
                                                </p>
                                                <div className="mt-4 flex items-end justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            {item.available_rooms}{' '}
                                                            {item.available_rooms === 1
                                                                ? 'room'
                                                                : 'rooms'}{' '}
                                                            available
                                                        </p>
                                                        {item.lowest_price && (
                                                            <p className="mt-1 text-sm text-slate-500">
                                                                From{' '}
                                                                <strong className="text-slate-900">
                                                                    {formatPrice(
                                                                        Number(item.lowest_price),
                                                                        item.currency,
                                                                    )}
                                                                </strong>{' '}
                                                                / night
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="grid size-10 place-items-center rounded-full bg-slate-950 text-white">
                                                        <ArrowRight className="size-5" />
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ) : branch ? (
                            <>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <button
                                            type="button"
                                            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
                                            onClick={() => {
                                                setBranchId(0);
                                                setSelectedUnitIds([]);
                                                setSelectedRoomCategory(null);
                                            }}
                                        >
                                            <ArrowLeft className="size-4" />
                                            All properties
                                        </button>
                                        <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
                                            {branch.name}
                                        </p>
                                        <h2 className="mt-1 text-2xl font-semibold">
                                            Unit categories
                                        </h2>
                                        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                                            <MapPin className="size-4" />
                                            {[branch.city, branch.country].filter(Boolean).join(', ')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200">
                                        <Users className="size-4 text-amber-700" />
                                        {totalGuests} {totalGuests === 1 ? 'guest' : 'guests'}
                                        <span className="text-slate-400">·</span>
                                        {nights} {nights === 1 ? 'night' : 'nights'}
                                    </div>
                                </div>

                                <section id="rooms" className="scroll-mt-20 space-y-4">
                                    {visibleCategories.map((category) => (
                                        <div
                                            key={category.name}
                                            id={categoryAnchor(category.name)}
                                            className="scroll-mt-20 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="text-lg font-semibold">
                                                        {category.name}
                                                    </h3>
                                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                                                        {category.units.length}{' '}
                                                        {category.units.length === 1
                                                            ? 'available room'
                                                            : 'available rooms'}
                                                        <span aria-hidden="true">·</span>
                                                        <span>Up to {category.capacity} guests per room</span>
                                                        <span aria-hidden="true">·</span>
                                                        <span>{checkIn || 'Select check-in'} – {checkOut || 'Select check-out'}</span>
                                                    </div>
                                                </div>
                                                <p className="shrink-0 text-right">
                                                    <strong className="text-lg">
                                                        {formatPrice(category.lowestPrice, currency)}
                                                    </strong>
                                                    <span className="block text-xs text-slate-500">
                                                        per room / night
                                                    </span>
                                                </p>
                                            </div>
                                            <div className="p-4">
                                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                                    {category.units.map((unit, index) => {
                                                        const selected = selectedUnitIds.includes(unit.id);
                                                        const fallbackPhoto =
                                                            roomPhotoFallbacks[
                                                                index % roomPhotoFallbacks.length
                                                            ];

                                                        return (
                                                            <div
                                                                key={unit.id}
                                                                className={`relative aspect-square min-w-0 overflow-hidden rounded-xl bg-slate-100 ring-1 transition ${
                                                                    selected
                                                                        ? 'ring-2 ring-amber-500'
                                                                        : 'ring-slate-200 hover:ring-amber-400'
                                                                }`}
                                                            >
                                                                <img
                                                                    src={unit.images[0] ?? fallbackPhoto}
                                                                    alt={`${unit.name}, room ${unit.number}`}
                                                                    loading="lazy"
                                                                    onError={(event) => {
                                                                        if (
                                                                            event.currentTarget.src !==
                                                                            fallbackPhoto
                                                                        ) {
                                                                            event.currentTarget.src =
                                                                                fallbackPhoto;
                                                                        }
                                                                    }}
                                                                    className="absolute inset-0 size-full object-cover"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    aria-label={`${selected ? 'Remove' : 'Select'} ${unit.name}, room ${unit.number}`}
                                                                    aria-pressed={selected}
                                                                    title={`${selected ? 'Remove' : 'Select'} room ${unit.number}`}
                                                                    onClick={() => toggleUnit(unit.id)}
                                                                    className={`absolute right-2 top-2 grid size-9 place-items-center rounded-full shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ${
                                                                        selected
                                                                            ? 'bg-amber-500 text-white'
                                                                            : 'bg-white/95 text-slate-900 hover:bg-amber-50'
                                                                    }`}
                                                                >
                                                                    {selected ? (
                                                                        <Check className="size-5" />
                                                                    ) : (
                                                                        <Plus className="size-5" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <button
                                                    type="button"
                                                    aria-expanded={Boolean(
                                                        expandedCategoryDetails[category.name],
                                                    )}
                                                    onClick={() =>
                                                        setExpandedCategoryDetails((current) => ({
                                                            ...current,
                                                            [category.name]: !current[category.name],
                                                        }))
                                                    }
                                                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-950"
                                                >
                                                    {expandedCategoryDetails[category.name]
                                                        ? 'Hide room details'
                                                        : 'Room details'}
                                                    <ChevronDown
                                                        className={`size-4 transition-transform ${
                                                            expandedCategoryDetails[category.name]
                                                                ? 'rotate-180'
                                                                : ''
                                                        }`}
                                                    />
                                                </button>
                                                {expandedCategoryDetails[category.name] && (
                                                    <div className="mt-3 border-t border-slate-100 pt-4">
                                                        <div className="rounded-xl bg-slate-50 p-4">
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div>
                                                                    <h4 className="font-semibold">
                                                                        {category.name}
                                                                    </h4>
                                                                    <p className="mt-1 text-sm text-slate-500">
                                                                        {category.units.length}{' '}
                                                                        {category.units.length === 1
                                                                            ? 'room'
                                                                            : 'rooms'}{' '}
                                                                        in this category · Up to{' '}
                                                                        {category.capacity}{' '}
                                                                        {category.capacity === 1
                                                                            ? 'guest'
                                                                            : 'guests'}{' '}
                                                                        per room
                                                                    </p>
                                                                </div>
                                                                <p className="text-sm font-semibold">
                                                                    From{' '}
                                                                    {formatPrice(
                                                                        category.lowestPrice,
                                                                        currency,
                                                                    )}{' '}
                                                                    <span className="font-normal text-slate-500">
                                                                        per night
                                                                    </span>
                                                                </p>
                                                            </div>
                                                            {Array.from(
                                                                new Set(
                                                                    category.units.flatMap(
                                                                        (unit) => unit.amenities,
                                                                    ),
                                                                ),
                                                            ).length > 0 && (
                                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                                    {Array.from(
                                                                        new Set(
                                                                            category.units.flatMap(
                                                                                (unit) =>
                                                                                    unit.amenities,
                                                                            ),
                                                                        ),
                                                                    ).map((amenity) => (
                                                                        <span
                                                                            key={amenity}
                                                                            className="max-w-full break-words rounded-full bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200"
                                                                        >
                                                                            {amenity}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {visibleCategories.length === 0 && (
                                        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">
                                            No rooms are available for these dates. Try changing your dates or location.
                                        </div>
                                    )}
                                    {errors.unit_ids && (
                                        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                                            {errors.unit_ids}
                                        </p>
                                    )}
                                    {errors.adults && (
                                        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                                            {errors.adults}
                                        </p>
                                    )}
                                    {errors.room_guest_names && (
                                        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                                            {errors.room_guest_names}
                                        </p>
                                    )}
                                </section>

                                {selectedUnits.length > 0 && (
                                    <form
                                        id="booking-confirm-form"
                                        onSubmit={confirmBooking}
                                        className="space-y-6"
                                    >
                                        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                                            <h2 className="text-xl font-semibold">
                                                Names of other guests
                                            </h2>
                                            <p className="mt-1 text-sm text-slate-500">
                                                Add the names of guests staying in each selected room. Your account name is the lead guest.
                                            </p>
                                            <div className="mt-4 space-y-4">
                                                {selectedUnits.map((unit) => (
                                                    <label
                                                        key={unit.id}
                                                        className="grid gap-1.5 text-sm font-medium"
                                                    >
                                                        {unit.name} · Room {unit.number}
                                                        <textarea
                                                            className="min-h-20 rounded-xl border border-slate-200 p-3 text-sm font-normal"
                                                            placeholder="One name per line (optional)"
                                                            value={roomGuestNames[unit.id] ?? ''}
                                                            onChange={(event) =>
                                                                setRoomGuestNames({
                                                                    ...roomGuestNames,
                                                                    [unit.id]: event.target.value,
                                                                })
                                                            }
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                        </section>

                                        {branch.amenities.length > 0 && (
                                            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                                                <h2 className="text-xl font-semibold">
                                                    Property facilities
                                                </h2>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    Select facilities you may want to use during your stay.
                                                </p>
                                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                    {branch.amenities.map((amenity) => (
                                                        <label
                                                            key={amenity}
                                                            className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={extras.includes(amenity)}
                                                                onChange={() =>
                                                                    setExtras((current) =>
                                                                        current.includes(amenity)
                                                                            ? current.filter((item) => item !== amenity)
                                                                            : [...current, amenity],
                                                                    )
                                                                }
                                                                className="size-4 accent-amber-500"
                                                            />
                                                            {amenity}
                                                            <span className="ml-auto text-xs text-slate-500">
                                                                Included
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        <label className="grid gap-1.5 text-sm font-medium">
                                            Special requests
                                            <textarea
                                                maxLength={2000}
                                                className="min-h-24 rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal"
                                                placeholder="Anything that would make your stay more comfortable?"
                                                value={specialRequests}
                                                onChange={(event) =>
                                                    setSpecialRequests(event.target.value)
                                                }
                                            />
                                        </label>
                                    </form>
                                )}

                                <section
                                    id="facilities"
                                    className="scroll-mt-20 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                                >
                                    <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
                                        Property facilities
                                    </p>
                                    <h2 className="mt-1 text-xl font-semibold">
                                        Facilities & services
                                    </h2>
                                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                                        {facilityItems.map(({ name, icon: Icon }) => (
                                            <div
                                                key={name}
                                                className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                                            >
                                                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800">
                                                    <Icon className="size-5" aria-hidden="true" />
                                                </span>
                                                <span className="break-words text-sm font-medium">
                                                    {name}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section
                                    id="gallery"
                                    className="scroll-mt-20 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                                >
                                    <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
                                        Gallery
                                    </p>
                                    <h2 className="mt-1 text-xl font-semibold">
                                        A look around {branch.name}
                                    </h2>
                                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {Array.from(
                                            new Map(
                                                branchUnits
                                                    .flatMap((unit) => unit.images)
                                                    .map((image) => [image, image]),
                                            ).values(),
                                        )
                                            .slice(0, 9)
                                            .map((image, index) => (
                                                <img
                                                    key={image}
                                                    src={image}
                                                    alt={`${branch.name} gallery ${index + 1}`}
                                                    loading="lazy"
                                                    className="aspect-[4/3] w-full rounded-xl object-cover"
                                                />
                                            ))}
                                        {branchUnits.every((unit) => unit.images.length === 0) && (
                                            <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">
                                                Property photos will appear here when available.
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section
                                    id="about"
                                    className="scroll-mt-20 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                                >
                                    <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
                                        About
                                    </p>
                                    <h2 className="mt-1 text-xl font-semibold">{branch.name}</h2>
                                    <p className="mt-3 text-sm leading-6 text-slate-600">
                                        {branch.name} is a {branch.type} property
                                        {branch.address
                                            ? ` located at ${branch.address}`
                                            : branch.city || branch.country
                                              ? ` in ${[branch.city, branch.country].filter(Boolean).join(', ')}`
                                            : ''}
                                        . Explore the available room categories and choose the rooms
                                        that best suit your stay.
                                    </p>
                                </section>

                                <section
                                    id="contact"
                                    className="scroll-mt-20 rounded-2xl bg-slate-950 p-6 text-white"
                                >
                                    <p className="text-sm font-semibold tracking-[0.18em] text-amber-300 uppercase">
                                        Contact
                                    </p>
                                    <h2 className="mt-1 text-xl font-semibold">
                                        Contact {branch.name}
                                    </h2>
                                    <p className="mt-2 text-sm text-slate-300">
                                        Get in touch with the property for questions about your stay.
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                                        {branch.phone && (
                                            <a
                                                href={`tel:${branch.phone}`}
                                                className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200"
                                            >
                                                <Phone className="size-4" />
                                                {branch.phone}
                                            </a>
                                        )}
                                        {branch.email && (
                                            <a
                                                href={`mailto:${branch.email}`}
                                                className="text-amber-300 hover:text-amber-200"
                                            >
                                                {branch.email}
                                            </a>
                                        )}
                                        {!branch.phone && !branch.email && (
                                            <span className="text-slate-300">
                                                Contact details are not available yet.
                                            </span>
                                        )}
                                    </div>
                                </section>
                            </>
                        ) : null}
                    </div>

                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <div className="space-y-5">
                            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                                <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
                                    Guests
                                </p>
                                <h2 className="mt-1 text-xl font-semibold">Who is travelling?</h2>
                                <div className="mt-4 space-y-4">
                                    {(['adults', 'children'] as const).map((type) => {
                                        const value = type === 'adults' ? adults : children;
                                        const minimum = type === 'adults' ? 1 : 0;

                                        return (
                                            <div
                                                key={type}
                                                className="flex items-center justify-between"
                                            >
                                                <div>
                                                    <p className="font-medium capitalize">{type}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {type === 'adults' ? 'Ages 13 or above' : 'Ages 0–12'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        aria-label={`Remove one ${type}`}
                                                        className="grid size-8 place-items-center rounded-full border disabled:opacity-40"
                                                        disabled={value <= minimum}
                                                        onClick={() => updateGuests(type, -1)}
                                                    >
                                                        <Minus className="size-4" />
                                                    </button>
                                                    <span className="w-5 text-center">{value}</span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Add one ${type}`}
                                                        className="grid size-8 place-items-center rounded-full border"
                                                        onClick={() => updateGuests(type, 1)}
                                                    >
                                                        <Plus className="size-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                                <p className="text-sm font-semibold tracking-[0.18em] text-amber-700 uppercase">
                                    Booking summary
                                </p>
                                <h2 className="mt-1 text-xl font-semibold">Your stay</h2>
                                <div className="mt-5 space-y-3 border-b border-slate-200 pb-5 text-sm">
                                    <div className="flex justify-between gap-3">
                                        <span className="text-slate-500">Dates</span>
                                        <span className="text-right">
                                            {checkIn || '—'} — {checkOut || '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-slate-500">Length</span>
                                        <span>
                                            {nights} {nights === 1 ? 'night' : 'nights'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-slate-500">Property</span>
                                        <span className="text-right">{branch?.name ?? 'Choose a property'}</span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-slate-500">Rooms</span>
                                        <span>
                                            {selectedUnits.length}{' '}
                                            {selectedUnits.length === 1 ? 'room' : 'rooms'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-slate-500">Guests</span>
                                        <span>
                                            {totalGuests} {totalGuests === 1 ? 'guest' : 'guests'}
                                        </span>
                                    </div>
                                </div>
                                {selectedUnits.length > 0 && (
                                    <div className="space-y-2 border-b border-slate-200 py-4 text-sm">
                                        {selectedUnits.map((unit) => (
                                            <div key={unit.id} className="flex justify-between gap-3">
                                                <span className="text-slate-500">
                                                    {unit.name} × {nights}
                                                </span>
                                                <span>
                                                    {formatPrice(roomPrice(unit), currency)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex justify-between gap-3 pt-4">
                                    <span className="font-semibold">Estimated total</span>
                                    <strong className="text-lg">
                                        {formatPrice(roomTotal, currency)}
                                    </strong>
                                </div>
                                <p className="mt-1 text-right text-xs text-slate-500">
                                    Taxes and final rates are confirmed by the property.
                                </p>
                                {selectedUnits.length > 0 && totalGuests > capacity && (
                                    <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                                        Your {totalGuests} guests exceed the selected rooms’ capacity of {capacity}. Add another room or reduce the guest count.
                                    </p>
                                )}
                                {selectedUnits.length > 0 && additionalGuestCount > totalGuests - 1 && (
                                    <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                                        Enter no more than {totalGuests - 1} additional guest names.
                                    </p>
                                )}
                                {selectedUnits.length > 0 && (
                                    <Button
                                        className="mt-5 w-full bg-slate-950 hover:bg-slate-800"
                                        type="submit"
                                        form="booking-confirm-form"
                                        disabled={
                                            totalGuests > capacity ||
                                            additionalGuestCount > totalGuests - 1
                                        }
                                    >
                                        {isAuthenticated ? 'Confirm booking' : 'Log in to continue'}
                                    </Button>
                                )}
                                {!isAuthenticated && selectedUnits.length > 0 && (
                                    <p className="mt-3 text-center text-xs text-slate-500">
                                        You’ll be asked to sign in before the booking is submitted.
                                    </p>
                                )}
                                {selectedUnits.length === 0 && (
                                    <p className="mt-4 text-sm text-slate-500">
                                        Select one or more rooms to see your calculated stay total.
                                    </p>
                                )}
                            </section>

                            {branch && (
                                <section className="rounded-2xl bg-slate-950 p-6 text-white">
                                    <h2 className="font-semibold">Need a hand?</h2>
                                    <p className="mt-2 text-sm text-slate-300">
                                        Contact {branch.name} with questions about your stay.
                                    </p>
                                    {branch.phone && (
                                        <a
                                            className="mt-3 block text-sm text-amber-300"
                                            href={`tel:${branch.phone}`}
                                        >
                                            {branch.phone}
                                        </a>
                                    )}
                                </section>
                            )}

                            <Link
                                href="/portal"
                                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
                            >
                                <ArrowLeft className="size-4" />
                                My guest account
                            </Link>
                        </div>
                    </aside>
                </main>
            </div>
        </>
    );
}

Book.layout = (page: React.ReactNode) => <AppLayoutHome>{page}</AppLayoutHome>;
