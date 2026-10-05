import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    ChevronDown,
    Info,
    MapPin,
    Minus,
    Phone,
    Plus,
    Users,
} from 'lucide-react';
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import AppLayoutHome from '@/layouts/app-layout-home';
import MessageBubble, { formatMessageDate, groupMessagesByDate, type MessageBubbleData } from '@/components/MessageBubble';

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
    latitude: string | null;
    longitude: string | null;
    google_embed_url: string | null;
    map_zoom_level: number;
    currency: string;
    available_rooms: number;
    lowest_price: string | null;
};

type Unit = {
    id: number;
    branch_id: number;
    unit_type: string;
    number: string;
    name: string;
    floor: string | null;
    base_price: string;
    price_weekend: string | null;
    capacity: number;
    child_capacity: number | null;
    amenities: string[];
    images: string[];
    category: string | null;
    status: string;
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
    adults: number;
    children: number;
    step: string;
    customerDetails: CustomerDetails;
    isAuthenticated: boolean;
};

type CustomerDetails = {
    name: string;
    email: string;
    phone: string;
    date_of_birth: string;
    gender: string;
    arrived_from: string;
    nationality: string;
    nid: string;
    occupation: string;
    organization: string;
    mailing_address: string;
    purpose_of_visit: string;
};

type BookingStep = 'selection' | 'details' | 'preview';

const today = new Date().toISOString().slice(0, 10);

function addOneDay(date: string): string {
    if (!date) return '';

    const [year, month, day] = date.split('-').map(Number);
    const nextDay = new Date(year, month - 1, day + 1);

    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
}

const roomPhotoFallbacks = [
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=85',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=85',
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=85',
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
    adults: initialAdults,
    children: initialChildren,
    step: initialStep,
    customerDetails: initialCustomerDetails,
    isAuthenticated,
}: Props) {
    const page = usePage();
    const customer = (page.props as typeof page.props & {
        auth?: { customer?: { id: number; name: string } | null };
    }).auth?.customer;
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
    const [expandedCategoryDetails, setExpandedCategoryDetails] = useState<
        Record<string, boolean>
    >({});
    const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
    const [selectedRoomCategory, setSelectedRoomCategory] = useState<string | null>(
        null,
    );
    const [adults, setAdults] = useState(Math.max(1, initialAdults));
    const [children, setChildren] = useState(Math.max(0, initialChildren));
    const [detailsUnit, setDetailsUnit] = useState<Unit | null>(null);
    const [bookingStep, setBookingStep] = useState<BookingStep>(
        initialStep === 'details' && isAuthenticated ? 'details' : 'selection',
    );
    const [customerDetails, setCustomerDetails] =
        useState<CustomerDetails>(initialCustomerDetails);

    const branch = branches.find((item) => item.id === branchId);
    const branchUnits = units.filter((unit) => unit.branch_id === branchId);
    const branchMapQuery = branch?.latitude && branch.longitude
        ? `${branch.latitude},${branch.longitude}`
        : [branch?.address, branch?.city, branch?.country].filter(Boolean).join(', ');
    const branchMapEmbedUrl = branch?.google_embed_url
        || (branchMapQuery
            ? `https://maps.google.com/maps?q=${encodeURIComponent(branchMapQuery)}&z=${branch?.map_zoom_level ?? 15}&output=embed`
            : null);
    const branchMapLinkUrl = branchMapQuery
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branchMapQuery)}`
        : null;
    const nights = nightsBetween(checkIn, checkOut);
    const totalGuests = adults + children;
    const selectedUnits = selectedUnitIds
        .map((unitId) => branchUnits.find((unit) => unit.id === unitId))
        .filter((unit): unit is Unit => Boolean(unit));
    const adultCapacity = selectedUnits.reduce((total, unit) => total + unit.capacity, 0);
    const childCapacity = selectedUnits.reduce(
        (total, unit) => total + (unit.child_capacity ?? 0),
        0,
    );
    const hasCapacityForGuests = adults <= adultCapacity && children <= childCapacity;
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
    const availableCategories = useMemo(() => {
        const categoryMap = new Map<
            string,
            {
                name: string;
                units: Unit[];
                lowestPrice: number;
                capacity: number;
                child_capacity: number;
            }
        >();

        for (const unit of branchUnits) {
            const name = unit.category ?? 'Guest room';
            const category = categoryMap.get(name) ?? {
                name,
                units: [],
                lowestPrice: Number.POSITIVE_INFINITY,
                capacity: 0,
                child_capacity: 0,
            };
            category.units.push(unit);
            category.lowestPrice = Math.min(category.lowestPrice, Number(unit.base_price));
            category.capacity = Math.max(category.capacity, unit.capacity);
            category.child_capacity = Math.max(
                category.child_capacity,
                unit.child_capacity ?? 0,
            );
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
        step: 'details',
    });
    selectedUnitIds.forEach((unitId) => loginParams.append('unit_ids[]', String(unitId)));
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

    const proceedToBook = () => {
        if (!isAuthenticated) {
            window.location.assign(new URL(loginUrl, window.location.origin).toString());
            return;
        }

        router.get(
            '/portal/book',
            {
                check_in: checkIn,
                check_out: checkOut,
                location,
                branch_id: branchId,
                unit_ids: selectedUnitIds,
                adults,
                children,
                step: 'details',
            },
            {
                preserveState: true,
                onSuccess: () => setBookingStep('details'),
            },
        );
    };

    const returnToRoomSelection = () => {
        router.get(
            '/portal/book',
            {
                check_in: checkIn,
                check_out: checkOut,
                location,
                branch_id: branchId,
                unit_ids: selectedUnitIds,
                adults,
                children,
            },
            {
                preserveState: true,
                onSuccess: () => setBookingStep('selection'),
            },
        );
    };

    const updateCustomerDetails = (field: keyof CustomerDetails, value: string) => {
        setCustomerDetails((current) => ({ ...current, [field]: value }));
    };

    const confirmBooking = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!branch || selectedUnits.length === 0 || !checkIn || !checkOut) {
            return;
        }
        if (adults > adultCapacity || children > childCapacity) {
            return;
        }

        if (!isAuthenticated) {
            window.location.assign(new URL(loginUrl, window.location.origin).toString());
            return;
        }

        router.post('/portal/book', {
            branch_id: branch.id,
            unit_ids: selectedUnits.map((unit) => unit.id),
            check_in: checkIn,
            check_out: checkOut,
            adults,
            children,
            customer_details: customerDetails,
        }, {
            onError: () => setBookingStep('details'),
        });
    };

    if (bookingStep === 'details' || bookingStep === 'preview') {
        const customerFields: {
            field: keyof CustomerDetails;
            label: string;
            required?: boolean;
            type?: string;
        }[] = [
            { field: 'name', label: 'Full name', required: true },
            { field: 'email', label: 'Email address', required: true, type: 'email' },
            { field: 'phone', label: 'Contact number', required: true, type: 'tel' },
            { field: 'arrived_from', label: 'Arrived from', required: true },
            { field: 'nationality', label: 'Nationality', required: true },
            { field: 'nid', label: 'NID' },
            { field: 'occupation', label: 'Occupation / Profession' },
            { field: 'organization', label: 'Name of organization' },
            { field: 'date_of_birth', label: 'Date of birth', type: 'date' },
        ];

        const bookingSummary = (
            <section className="rounded-xl border border-slate-200 bg-white">
                <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-medium">
                    Booking summary
                </h2>
                <div className="space-y-3 p-4 text-sm">
                    <p className="font-semibold">{branch?.name}</p>
                    <p className="text-slate-600">
                        {[branch?.address, branch?.city, branch?.country].filter(Boolean).join(', ')}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-indigo-100 p-3">
                            <p className="text-xs text-slate-600">Check-in</p>
                            <p className="font-semibold">{checkIn || '—'}</p>
                        </div>
                        <div className="rounded-lg bg-indigo-100 p-3">
                            <p className="text-xs text-slate-600">Check-out</p>
                            <p className="font-semibold">{checkOut || '—'}</p>
                        </div>
                    </div>
                    <p>
                        {selectedUnits.length} {selectedUnits.length === 1 ? 'room' : 'rooms'} ·{' '}
                        {adults} {adults === 1 ? 'adult' : 'adults'} · {children}{' '}
                        {children === 1 ? 'child' : 'children'} · {nights}{' '}
                        {nights === 1 ? 'night' : 'nights'}
                    </p>
                </div>
            </section>
        );

        return (
            <>
                <Head title={bookingStep === 'details' ? 'Customer details' : 'Review booking'} />
                <main className="min-h-screen bg-[#f7f7f4] px-4 py-8 text-slate-900 sm:px-6">
                    <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                        <section className="min-w-0">
                            <div className="mb-5 bg-slate-200 px-5 py-3">
                                <h1 className="text-xl font-bold">
                                    {bookingStep === 'details' ? 'Enter Your Details' : 'Booking Preview'}
                                </h1>
                            </div>
                            {bookingStep === 'details' ? (
                                <>
                                    <p className="mb-5 inline-block bg-rose-50 px-3 py-1 text-sm text-slate-600">
                                        Please fill in all fields marked with *.
                                    </p>
                                    <form
                                        className="grid gap-5 rounded-xl bg-white p-5 shadow-sm sm:grid-cols-2"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            setBookingStep('preview');
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                    >
                                        {(errors.adults || errors.children || errors.unit_ids) && (
                                            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">
                                                {errors.adults || errors.children || errors.unit_ids}
                                            </p>
                                        )}
                                        {customerFields.map(({ field, label, required, type }) => (
                                            <label key={field} className="grid content-start gap-1.5 text-sm">
                                                <span>
                                                    {required && <span className="text-rose-600">*</span>}{' '}
                                                    {label}
                                                </span>
                                                <Input
                                                    required={required}
                                                    type={type ?? 'text'}
                                                    value={customerDetails[field]}
                                                    onChange={(event) =>
                                                        updateCustomerDetails(field, event.target.value)
                                                    }
                                                />
                                                {errors[`customer_details.${field}`] && (
                                                    <span role="alert" className="text-rose-700">
                                                        {errors[`customer_details.${field}`]}
                                                    </span>
                                                )}
                                            </label>
                                        ))}
                                        <label className="grid content-start gap-1.5 text-sm">
                                            Gender
                                            <select
                                                className="h-10 rounded-md border border-input bg-background px-3"
                                                value={customerDetails.gender}
                                                onChange={(event) =>
                                                    updateCustomerDetails('gender', event.target.value)
                                                }
                                            >
                                                <option value="">Select gender</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </label>
                                        <label className="grid content-start gap-1.5 text-sm">
                                            Number of persons
                                            <Input readOnly value={totalGuests} />
                                        </label>
                                        <label className="grid gap-1.5 text-sm sm:col-span-2">
                                            <span><span className="text-rose-600">*</span> Mailing address</span>
                                            <textarea
                                                required
                                                maxLength={2000}
                                                className="min-h-24 rounded-md border border-input bg-background px-3 py-2"
                                                value={customerDetails.mailing_address}
                                                onChange={(event) =>
                                                    updateCustomerDetails('mailing_address', event.target.value)
                                                }
                                            />
                                            {errors['customer_details.mailing_address'] && (
                                                <span role="alert" className="text-rose-700">
                                                    {errors['customer_details.mailing_address']}
                                                </span>
                                            )}
                                        </label>
                                        <fieldset className="sm:col-span-2">
                                            <legend className="mb-2 text-sm">Purpose of visit</legend>
                                            <div className="flex flex-wrap gap-4 text-sm">
                                                {(['tourist', 'business', 'official', 'others'] as const).map(
                                                    (purpose) => (
                                                        <label key={purpose} className="flex items-center gap-2">
                                                            <input
                                                                type="radio"
                                                                name="purpose_of_visit"
                                                                value={purpose}
                                                                checked={customerDetails.purpose_of_visit === purpose}
                                                                onChange={(event) =>
                                                                    updateCustomerDetails(
                                                                        'purpose_of_visit',
                                                                        event.target.value,
                                                                    )
                                                                }
                                                            />
                                                            {purpose[0].toUpperCase() + purpose.slice(1)}
                                                        </label>
                                                    ),
                                                )}
                                            </div>
                                        </fieldset>
                                        <div className="flex justify-between gap-3 sm:col-span-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={returnToRoomSelection}
                                            >
                                                Back
                                            </Button>
                                            <Button type="submit">Next</Button>
                                        </div>
                                    </form>
                                </>
                            ) : (
                                <div className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
                                    <section>
                                        <h2 className="mb-3 text-lg font-semibold">Customer details</h2>
                                        <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                            {customerFields.map(({ field, label }) => (
                                                <div key={field}>
                                                    <dt className="text-slate-500">{label}</dt>
                                                    <dd className="font-medium">{customerDetails[field] || '—'}</dd>
                                                </div>
                                            ))}
                                            <div>
                                                <dt className="text-slate-500">Gender</dt>
                                                <dd className="font-medium">{customerDetails.gender || '—'}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-slate-500">Number of persons</dt>
                                                <dd className="font-medium">{totalGuests}</dd>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <dt className="text-slate-500">Mailing address</dt>
                                                <dd className="font-medium">{customerDetails.mailing_address}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-slate-500">Purpose of visit</dt>
                                                <dd className="font-medium">{customerDetails.purpose_of_visit || '—'}</dd>
                                            </div>
                                        </dl>
                                    </section>
                                    <section className="border-t border-slate-200 pt-4">
                                        <h2 className="mb-3 text-lg font-semibold">Price summary</h2>
                                        {selectedUnits.map((unit) => (
                                            <div key={unit.id} className="flex justify-between gap-3 py-1 text-sm">
                                                <span>{unit.name} · {nights} {nights === 1 ? 'night' : 'nights'}</span>
                                                <span>{formatPrice(roomPrice(unit), currency)}</span>
                                            </div>
                                        ))}
                                        <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-semibold">
                                            <span>Estimated total</span>
                                            <span>{formatPrice(roomTotal, currency)}</span>
                                        </div>
                                    </section>
                                    <form
                                        className="flex justify-between gap-3"
                                        onSubmit={confirmBooking}
                                    >
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setBookingStep('details')}
                                        >
                                            Back
                                        </Button>
                                        <Button type="submit">Confirm booking</Button>
                                    </form>
                                </div>
                            )}
                        </section>
                        <aside className="space-y-5">
                            {bookingSummary}
                            <section className="rounded-xl border border-slate-200 bg-white">
                                <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-medium">
                                    Price summary
                                </h2>
                                <div className="flex justify-between gap-3 p-4 text-sm">
                                    <span>Total amount</span>
                                    <span>{formatPrice(roomTotal, currency)}</span>
                                </div>
                                <div className="flex justify-between gap-3 bg-indigo-100 p-4 font-semibold">
                                    <span>Estimated booking amount</span>
                                    <span>{formatPrice(roomTotal, currency)}</span>
                                </div>
                            </section>
                        </aside>
                    </div>
                </main>
                {branch && customer && (
                    <BranchMessengerBubble key={branch.id} branchId={branch.id} branchName={branch.name} customerId={customer.id} customerName={customer.name} />
                )}
            </>
        );
    }

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
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setCheckIn(value);
                                        setCheckOut(addOneDay(value));
                                    }}
                                />
                            </label>
                            <label className="grid gap-1.5 text-sm font-medium">
                                Check-out
                                <Input
                                    required
                                    min={addOneDay(checkIn || today)}
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
                                ['Location', 'location'],
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

                <main className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
                    <div className="contents lg:col-start-1 lg:block lg:space-y-8">
                        {!branchId ? (
                            <section className="order-1 lg:order-none">
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
                                {/* branch details and booking form */}
                                <div className="order-1 flex flex-wrap items-start justify-between gap-3 lg:order-none">
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
                                        <span>Adults: {adults} · Children: {children}</span>
                                        <span className="text-slate-400">·</span>
                                        {nights} {nights === 1 ? 'night' : 'nights'}
                                    </div>
                                </div>

                                <section id="rooms" className="order-2 scroll-mt-20 space-y-4 lg:order-none">
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
                                                        <span>
                                                            Adults: {category.capacity} · Children:{' '}
                                                            {category.child_capacity} per room
                                                        </span>
                                                        {/* break */}
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
                                                                    aria-label={`View details for ${unit.name}, room ${unit.number}`}
                                                                    title={`View details for room ${unit.number}`}
                                                                    onClick={() => setDetailsUnit(unit)}
                                                                    className="absolute left-2 top-2 grid size-9 place-items-center rounded-full bg-white/95 text-slate-900 shadow-md transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                                                                >
                                                                    <Info className="size-5" />
                                                                </button>
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
                                    {errors.children && (
                                        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                                            {errors.children}
                                        </p>
                                    )}
                                </section>

                                <section
                                    id="gallery"
                                    className="order-7 scroll-mt-20 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:order-none"
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
                                    className="order-8 scroll-mt-20 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:order-none"
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
                                    className="order-9 scroll-mt-20 rounded-2xl bg-slate-950 p-6 text-white lg:order-none"
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

                    <aside className="contents lg:col-start-2 lg:row-start-1 lg:block lg:sticky lg:top-6 lg:self-start">
                        <div className="contents lg:block lg:space-y-5">
                            <section className="order-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:order-none">
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

                            <section className="order-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:order-none">
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
                                {selectedUnits.length > 0 && adults > adultCapacity && (
                                    <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                                        Your {adults} adults exceed the selected rooms’ adult capacity of {adultCapacity}. Add another room or reduce the adult count.
                                    </p>
                                )}
                                {selectedUnits.length > 0 && children > childCapacity && (
                                    <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                                        Your {children} children exceed the selected rooms’ child capacity of {childCapacity}. Add another room or reduce the child count.
                                    </p>
                                )}
                                {selectedUnits.length > 0 &&
                                    checkIn &&
                                    checkOut &&
                                    hasCapacityForGuests && (
                                    <Button
                                        className="mt-5 w-full bg-slate-950 hover:bg-slate-800"
                                        type="button"
                                        onClick={proceedToBook}
                                    >
                                        Proceed to Book
                                    </Button>
                                )}
                                {!isAuthenticated && selectedUnits.length > 0 && (
                                    <p className="mt-3 text-center text-xs text-slate-500">
                                        Sign in to continue to customer details.
                                    </p>
                                )}
                                {selectedUnits.length === 0 && (
                                    <p className="mt-4 text-sm text-slate-500">
                                        Select one or more rooms to see your calculated stay total.
                                    </p>
                                )}
                            </section>

                            {branch && (
                                <section className="order-10 rounded-2xl bg-slate-950 p-6 text-white lg:order-none">
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

                            {branch && branchMapEmbedUrl && (
                                <section id='location' className="order-11 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 lg:order-none">
                                    <div className="flex items-center justify-between gap-3 p-5">
                                        <div>
                                            <h2 className="font-semibold">Find {branch.name}</h2>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {[branch.address, branch.city, branch.country]
                                                    .filter(Boolean)
                                                    .join(', ')}
                                            </p>
                                        </div>
                                        {branchMapLinkUrl && (
                                            <a
                                                href={branchMapLinkUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
                                            >
                                                <MapPin className="size-4" />
                                                Open map
                                            </a>
                                        )}
                                    </div>
                                    <iframe
                                        title={`${branch.name} location map`}
                                        src={branchMapEmbedUrl}
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        className="h-64 w-full border-t border-slate-100"
                                    />
                                </section>
                            )}

                            <Link
                                href="/portal"
                                className="order-12 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 lg:order-none"
                            >
                                <ArrowLeft className="size-4" />
                                My guest account
                            </Link>
                        </div>
                    </aside>
                </main>
            </div>
            <Dialog
                open={detailsUnit !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDetailsUnit(null);
                    }
                }}
            >
                {detailsUnit && (
                    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{detailsUnit.name}</DialogTitle>
                            <DialogDescription>
                                Room {detailsUnit.number}
                                {detailsUnit.category ? ` · ${detailsUnit.category}` : ''}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Unit type</p>
                                    <p className="mt-1 font-medium">{detailsUnit.unit_type}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Floor</p>
                                    <p className="mt-1 font-medium">{detailsUnit.floor || 'Not specified'}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Capacity</p>
                                    <p className="mt-1 font-medium">
                                        {detailsUnit.capacity}{' '}
                                        {detailsUnit.capacity === 1 ? 'guest' : 'guests'}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Status</p>
                                    <p className="mt-1 font-medium">{detailsUnit.status}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500">Price per night</p>
                                    <p className="mt-1 font-medium">
                                        {formatPrice(Number(detailsUnit.base_price), currency)}
                                    </p>
                                </div>
                                {detailsUnit.price_weekend && (
                                    <div className="rounded-lg bg-slate-50 p-3">
                                        <p className="text-xs text-slate-500">Weekend price per night</p>
                                        <p className="mt-1 font-medium">
                                            {formatPrice(Number(detailsUnit.price_weekend), currency)}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <section>
                                <h3 className="font-semibold">Amenities</h3>
                                {detailsUnit.amenities.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {detailsUnit.amenities.map((amenity) => (
                                            <span
                                                key={amenity}
                                                className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                                            >
                                                {amenity}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-slate-500">
                                        No amenities listed.
                                    </p>
                                )}
                            </section>
                            <section>
                                <h3 className="font-semibold">Photos</h3>
                                {detailsUnit.images.length > 0 ? (
                                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {detailsUnit.images.map((image, index) => (
                                            <img
                                                key={image}
                                                src={image}
                                                alt={`${detailsUnit.name}, room ${detailsUnit.number}, photo ${index + 1}`}
                                                loading="lazy"
                                                className="aspect-[4/3] w-full rounded-lg object-cover"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-slate-500">
                                        No photos available for this unit.
                                    </p>
                                )}
                            </section>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
            {branch && customer && (
                <BranchMessengerBubble key={branch.id} branchId={branch.id} branchName={branch.name} customerId={customer.id} customerName={customer.name} />
            )}
        </>
    );
}

Book.layout = (page: React.ReactNode) => <AppLayoutHome>{page}</AppLayoutHome>;

function BranchMessengerBubble({ branchId, branchName, customerId, customerName }: {
    branchId: number;
    branchName: string;
    customerId: number;
    customerName: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [messages, setMessages] = useState<MessageBubbleData[]>([]);
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isSendingRef = useRef(false);
    const conversationIdRef = useRef<number | null>(null);
    const echoRef = useRef<Echo<'reverb'> | null>(null);
    const activeChannelRef = useRef<number | null>(null);
    const messageEndRef = useRef<HTMLDivElement>(null);
    const groupedMessages = groupMessagesByDate(messages);

    useEffect(() => {
        if (messages.length > 0 && isOpen) {
            messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const readResponse = useCallback(async <T,>(response: Response): Promise<T> => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
            const details = payload !== null && typeof payload === 'object'
                ? payload as { message?: string; errors?: Record<string, string[]> }
                : {};
            const validationError = details.errors
                ? Object.values(details.errors).flat()[0]
                : undefined;
            throw new Error(validationError ?? details.message ?? `Request failed (${response.status}).`);
        }
        return payload as T;
    }, []);

    const requestHeaders = useCallback(() => {
        const headers = new Headers({ Accept: 'application/json' });
        const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
        const xsrfCookie = document.cookie
            .split('; ')
            .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
            ?.split('=')
            .slice(1)
            .join('=');
        if (token) {
            headers.set('X-CSRF-TOKEN', token);
        } else if (xsrfCookie) {
            headers.set('X-XSRF-TOKEN', decodeURIComponent(xsrfCookie));
        }
        return headers;
    }, []);

    const requestHeadersWithSocket = useCallback(() => {
        const headers = requestHeaders();
        const socketId = echoRef.current?.socketId();
        if (socketId) {
            headers.set('X-Socket-ID', socketId);
        }
        return headers;
    }, [requestHeaders]);

    useEffect(() => {
        const key = import.meta.env.VITE_REVERB_APP_KEY;
        if (!key) return;

        (window as typeof window & { Pusher: typeof Pusher }).Pusher = Pusher;
        echoRef.current = new Echo({
            broadcaster: 'reverb',
            key,
            wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
            wsPort: Number(import.meta.env.VITE_REVERB_PORT || 80),
            wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
            enabledTransports: ['ws', 'wss'],
        });

        return () => {
            if (activeChannelRef.current !== null) {
                echoRef.current?.leave(`conversation.${activeChannelRef.current}`);
            }
            echoRef.current?.disconnect();
        };
    }, []);

    useEffect(() => {
        if (!echoRef.current || conversationId === null || activeChannelRef.current === conversationId) {
            return;
        }
        if (activeChannelRef.current !== null) {
            echoRef.current.leave(`conversation.${activeChannelRef.current}`);
        }
        activeChannelRef.current = conversationId;
        echoRef.current.private(`conversation.${conversationId}`)
            .listen('.message.sent', (incoming: MessageBubbleData) => {
                setMessages((current) => current.some((item) => item.id === incoming.id)
                    ? current
                    : [...current, incoming]);
            });
    }, [conversationId]);

    const openMessenger = async () => {
        const opening = !isOpen;
        setIsOpen(opening);
        if (!opening || conversationId !== null) return;

        setIsLoading(true);
        setError(null);
        try {
            const existingResponse = await fetch(`/api/branches/${branchId}/conversation`, {
                headers: requestHeaders(),
                credentials: 'same-origin',
            });
            const existing = await readResponse<unknown>(existingResponse);
            const validId = getConversationId(existing);
            if (validId !== null) {
                conversationIdRef.current = validId;
                setConversationId(validId);
                const historyResponse = await fetch(`/api/conversations/${validId}/messages`, {
                    headers: requestHeaders(),
                    credentials: 'same-origin',
                });
                const history = await readResponse<MessageBubbleData[]>(historyResponse);
                setMessages((current) => {
                    const combined = new Map(history.map((item) => [item.id, item]));
                    current.forEach((item) => combined.set(item.id, item));
                    return Array.from(combined.values()).sort((first, second) =>
                        first.created_at.localeCompare(second.created_at),
                    );
                });
            } else if (existing !== null && existing !== undefined && existing !== false) {
                throw new Error('The conversation response did not include a valid ID.');
            }
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load this conversation.');
        } finally {
            setIsLoading(false);
        }
    };

    const sendMessage = async (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        const body = message.trim();
        if (!body || isSendingRef.current) return;

        isSendingRef.current = true;
        setIsSending(true);
        setError(null);
        const formData = new FormData();
        formData.append('branch_id', String(branchId));
        formData.append('body', body);
        formData.append('type', 'text');
        try {
            const activeConversationId = conversationIdRef.current ?? conversationId;
            if (activeConversationId === null) {
                const response = await fetch('/api/conversations', {
                    method: 'POST', headers: requestHeadersWithSocket(), body: formData, credentials: 'same-origin',
                });
                const result = await readResponse<{
                    conversation?: unknown;
                    message?: MessageBubbleData;
                }>(response);
                const validId = getConversationId(result.conversation);
                if (validId === null || !result.message) {
                    throw new Error('The server response was missing the conversation or message.');
                }
                conversationIdRef.current = validId;
                setConversationId(validId);
                setMessages((current) => current.some((item) => item.id === result.message!.id)
                    ? current
                    : [...current, result.message!]);
            } else {
                const validId = normalizeConversationId(activeConversationId);
                if (validId === null) {
                    throw new Error('The conversation ID is invalid. Please close and reopen the chat.');
                }
                const response = await fetch(`/api/conversations/${validId}/messages`, {
                    method: 'POST', headers: requestHeadersWithSocket(), body: formData, credentials: 'same-origin',
                });
                const result = await readResponse<MessageBubbleData>(response);
                setMessages((current) => current.some((item) => item.id === result.id)
                    ? current
                    : [...current, result]);
            }
            setMessage('');
        } catch (sendError) {
            setError(sendError instanceof Error ? sendError.message : 'Unable to send your message.');
        } finally {
            isSendingRef.current = false;
            setIsSending(false);
        }
    };

    return (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
            {isOpen && (
                <section className="flex h-[min(36rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200" aria-label={`Message ${branchName}`}>
                    <header className="flex items-center gap-3 bg-blue-600 px-4 py-3 text-white">
                        <div className="flex size-9 items-center justify-center rounded-full bg-blue-400 font-semibold">{branchName.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{branchName}</p><p className="text-xs text-blue-100">Message the branch team</p></div>
                        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chat" className="rounded-full p-2 transition hover:bg-blue-500"><XMarkIcon className="size-5" /></button>
                    </header>
                    <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
                        {isLoading ? (
                            <div className="space-y-3 py-3" aria-label="Loading messages">{[0, 1, 2].map((item) => <div key={item} className={`h-10 w-2/3 animate-pulse rounded-2xl bg-slate-200 ${item % 2 === 0 ? '' : 'ml-auto'}`} />)}</div>
                        ) : messages.length === 0 ? (
                            <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-5 text-center">
                                <div className="text-4xl" aria-hidden="true">👋</div>
                                <p className="text-sm font-medium">Hi {customerName}!</p>
                                <p className="text-xs text-slate-500">Send a message to the {branchName} team. We typically reply within minutes.</p>
                            </div>
                        ) : Object.entries(groupedMessages).map(([date, dayMessages]) => (
                            <div key={date}>
                                <div className="my-3 flex items-center gap-2 text-[10px] text-slate-400"><span className="h-px flex-1 bg-slate-200" />{formatMessageDate(date)}<span className="h-px flex-1 bg-slate-200" /></div>
                                {dayMessages.map((item, index) => {
                                    const isMine = item.sender.type === 'customer';
                                    const previous = dayMessages[index - 1];
                                    return <MessageBubble key={item.id} message={item} isMine={isMine} showSender={!isMine && (!previous || previous.sender.id !== item.sender.id)} variant="pink" />;
                                })}
                            </div>
                        ))}
                        <div ref={messageEndRef} />
                    </div>
                    <form onSubmit={sendMessage} className="border-t border-slate-100 bg-white px-3 py-2">
                        {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
                        <div className="flex items-end gap-2">
                            <textarea aria-label="Message" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} maxLength={5000} placeholder="Type a message…" className="max-h-24 min-h-10 flex-1 resize-y overflow-y-auto rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none" />
                            <button type="submit" disabled={isSending || !message.trim()} aria-label="Send message" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"><PaperAirplaneIcon className="size-4" /></button>
                        </div>
                    </form>
                </section>
            )}
            <button type="button" onClick={() => void openMessenger()} aria-label={isOpen ? 'Close messaging' : 'Message branch'} aria-expanded={isOpen} className="flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700">
                {isOpen ? <XMarkIcon className="size-6" /> : <ChatBubbleLeftRightIcon className="size-6" />}
            </button>
        </div>
    );
}

function getConversationId(payload: unknown): number | null {
    if (payload === null || typeof payload !== 'object') {
        return null;
    }

    const conversation = payload as {
        id?: unknown;
        conversation_id?: unknown;
        conversation?: unknown;
        data?: unknown;
    };
    const directId = normalizeConversationId(conversation.id ?? conversation.conversation_id);
    if (directId !== null) {
        return directId;
    }

    return getConversationId(conversation.conversation)
        ?? getConversationId(conversation.data);
}

function normalizeConversationId(id: unknown): number | null {
    const normalized = typeof id === 'number'
        ? id
        : typeof id === 'string' && /^\d+$/.test(id)
            ? Number(id)
            : Number.NaN;
    return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : null;
}
