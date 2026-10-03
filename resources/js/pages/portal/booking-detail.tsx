import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeftIcon,
    ArrowTopRightOnSquareIcon,
    BuildingOfficeIcon,
    CalendarDaysIcon,
    CheckCircleIcon,
    ClockIcon,
    DocumentArrowDownIcon,
    EnvelopeIcon,
    ExclamationTriangleIcon,
    FireIcon,
    GlobeAltIcon,
    HomeIcon,
    InformationCircleIcon,
    MapPinIcon,
    PhoneIcon,
    QrCodeIcon,
    ShareIcon,
    SparklesIcon,
    StarIcon,
    UserGroupIcon,
    WifiIcon,
} from '@heroicons/react/24/outline';
import Barcode from 'react-barcode';
import { format, parseISO } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import BookingStatusBadge from '@/components/BookingStatusBadge';
import MessengerBubble from '@/components/MessengerBubble';
import { Button } from '@/components/ui/button';
import AppLayoutHome from '@/layouts/app-layout-home';

type Amenity = { name: string; icon: string; color: string };
type FolioItem = {
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    item_type: 'room_charge' | 'extra' | 'food' | 'service' | string;
};
type Payment = {
    amount: number;
    method: string;
    status: string;
    created_at: string | null;
};
type Booking = {
    id: number;
    branch_id: number;
    booking_ref: string;
    status: string;
    check_in: string;
    check_out: string;
    nights: number;
    adults: number;
    children: number;
    total_amount: number;
    currency: string;
    created_at: string | null;
    qr_code: string;
    qr_code_url: string | null;
    barcode_value: string;
    invoice_url: string;
    cancellation_policy: string;
    branch: {
        id: number | null;
        name: string;
        type: string;
        city: string;
        address_line1: string | null;
        address_line2: string | null;
        cover_image: string | null;
        star_rating: number;
        phone: string | null;
        email: string | null;
        website: string | null;
        google_maps_url: string | null;
        latitude: string | number | null;
        longitude: string | number | null;
        google_embed_url: string | null;
        amenities: Amenity[];
    };
    unit: {
        name: string;
        number: string;
        unit_type: string;
        floor: number | null;
        capacity: number;
        child_capacity: number;
        images: string[];
        amenities: Amenity[];
    };
    unit_category: { name: string };
    extras: { name: string; price: number }[];
    folio_items: FolioItem[];
    payments: Payment[];
};
type Props = {
    booking: Booking;
    customerId: number;
    customerName: string;
    hasExistingReview: boolean;
};
type AmenityIcon = ComponentType<SVGProps<SVGSVGElement>>;

const paymentMethodStyles: Record<string, string> = {
    cash: 'bg-slate-100 text-slate-700',
    card: 'bg-blue-50 text-blue-700',
    bank: 'bg-emerald-50 text-emerald-700',
    online: 'bg-purple-50 text-purple-700',
};

const amenityIcons: Record<string, AmenityIcon> = {
    fire: FireIcon,
    building: BuildingOfficeIcon,
    wifi: WifiIcon,
    sparkles: SparklesIcon,
};

const amenityColorStyles: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-800',
    blue: 'bg-blue-50 text-blue-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    green: 'bg-emerald-50 text-emerald-800',
    purple: 'bg-purple-50 text-purple-800',
    rose: 'bg-rose-50 text-rose-800',
    teal: 'bg-teal-50 text-teal-800',
};

function formatMoney(amount: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}

function formattedDate(date: string | null, pattern: string): string {
    return date ? format(parseISO(date), pattern) : 'Date unavailable';
}

function isGoogleEmbedUrl(url: string | null): url is string {
    if (!url) {
        return false;
    }

    try {
        const parsed = new URL(url);
        return (
            parsed.protocol === 'https:' &&
            (parsed.hostname === 'maps.google.com' ||
                parsed.hostname === 'www.google.com') &&
            parsed.pathname.startsWith('/maps')
        );
    } catch {
        return false;
    }
}

function getAmenityIcon(icon: string): AmenityIcon {
    return amenityIcons[icon.toLowerCase()] ?? SparklesIcon;
}

function SignaturePad({ bookingId }: { bookingId: number }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [hasSignature, setHasSignature] = useState(false);

    const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const element = canvas.current;
        const context = element?.getContext('2d');
        if (!element || !context) {
            return;
        }

        const bounds = element.getBoundingClientRect();
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.lineTo(event.clientX - bounds.left, event.clientY - bounds.top);
        context.stroke();
        setHasSignature(true);
    };

    return (
        <div className="mt-4 rounded-xl border p-4">
            <h3 className="font-medium">Checkout signature</h3>
            <canvas
                ref={canvas}
                width={520}
                height={140}
                className="mt-3 h-28 w-full touch-none rounded border bg-white"
                onPointerDown={(event) => {
                    drawing.current = true;
                    canvas.current?.getContext('2d')?.beginPath();
                    draw(event);
                }}
                onPointerMove={(event) => {
                    if (drawing.current) {
                        draw(event);
                    }
                }}
                onPointerUp={() => {
                    drawing.current = false;
                }}
                onPointerLeave={() => {
                    drawing.current = false;
                }}
            />
            <div className="mt-3 flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        canvas.current?.getContext('2d')?.clearRect(0, 0, 520, 140);
                        setHasSignature(false);
                    }}
                >
                    Clear
                </Button>
                <Button
                    size="sm"
                    disabled={!hasSignature}
                    onClick={() =>
                        router.post(`/portal/bookings/${bookingId}/checkout`, {
                            signature: canvas.current?.toDataURL('image/png'),
                        })
                    }
                >
                    Complete checkout
                </Button>
            </div>
        </div>
    );
}

export default function BookingDetail({
    booking,
    customerId,
    customerName,
    hasExistingReview,
}: Props) {
    const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
    const [toastVisible, setToastVisible] = useState(false);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const branch = booking.branch;
    const address = [
        branch.address_line1,
        branch.address_line2,
        branch.city,
    ]
        .filter(Boolean)
        .join(', ');
    const cancellationAllowed =
        /free cancellation|fully refundable|cancel(?:lation)?\s+without (?:a )?charge/i.test(
            booking.cancellation_policy,
        ) &&
        !/no free cancellation|non-refundable|non refundable|not refundable/i.test(
            booking.cancellation_policy,
        );
    const taxTotal = booking.folio_items.reduce(
        (total, item) => total + item.quantity * item.unit_price * (item.tax_rate / 100),
        0,
    );
    const isUpcoming =
        ['pending', 'confirmed'].includes(booking.status) &&
        booking.check_out >= format(new Date(), 'yyyy-MM-dd');

    useEffect(
        () => () => {
            if (toastTimer.current) {
                clearTimeout(toastTimer.current);
            }
        },
        [],
    );

    const showToast = (message: string, error = false) => {
        if (toastTimer.current) {
            clearTimeout(toastTimer.current);
        }
        setToast({ message, error });
        setToastVisible(false);
        requestAnimationFrame(() => setToastVisible(true));
        toastTimer.current = setTimeout(() => {
            setToastVisible(false);
            toastTimer.current = setTimeout(() => setToast(null), 300);
        }, 2500);
    };

    const shareBooking = async () => {
        const url = window.location.href;
        const shareData = {
            title: `Booking ${booking.booking_ref}`,
            text: `Booking at ${branch.name}`,
            url,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') {
                    return;
                }
            }
        }

        try {
            await navigator.clipboard.writeText(url);
            showToast('Link copied to clipboard!');
        } catch {
            showToast('Unable to copy the booking link. Please copy it from your browser.', true);
        }
    };

    return (
        <>
            <Head title={`Booking ${booking.booking_ref}`} />
            <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
                <button
                    type="button"
                    onClick={() => router.visit('/portal')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                    <ArrowLeftIcon className="size-4" aria-hidden="true" />
                    Back
                </button>
                <span className="truncate font-mono text-sm font-semibold tracking-wide">
                    {booking.booking_ref}
                </span>
                <span className="w-12" aria-hidden="true" />
            </div>

            <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
                <main className="mx-auto max-w-7xl">
                    <Link
                        href="/portal"
                        className="mb-5 hidden items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950 lg:inline-flex"
                    >
                        <ArrowLeftIcon className="size-4" aria-hidden="true" />
                        Back to bookings
                    </Link>

                    <div className="grid items-start gap-5 lg:grid-cols-3">
                        <div className="space-y-5 lg:col-span-2">
                            <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
                                <div className="relative h-56 overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-700 to-amber-700">
                                    {branch.cover_image && (
                                        <img
                                            src={branch.cover_image}
                                            alt={`${branch.name} property`}
                                            className="absolute inset-0 size-full object-cover"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                                    <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3">
                                        <div className="min-w-0 text-white">
                                            <h1 className="truncate text-2xl font-bold">
                                                {branch.name}
                                            </h1>
                                            <span className="mt-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-medium capitalize text-white backdrop-blur">
                                                {branch.type}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-slate-950/70 px-3 py-1.5 text-sm text-amber-300 backdrop-blur">
                                        {Array.from(
                                            { length: Math.max(0, Math.min(5, branch.star_rating)) },
                                            (_, index) => (
                                                <StarIcon
                                                    key={index}
                                                    className="size-4 fill-current"
                                                    aria-hidden="true"
                                                />
                                            ),
                                        )}
                                        <span className="sr-only">
                                            {branch.star_rating} star property
                                        </span>
                                    </div>
                                </div>

                                <div className="grid gap-5 p-5 md:grid-cols-3">
                                    <div className="flex gap-3">
                                        <MapPinIcon
                                            className="mt-0.5 size-5 shrink-0 text-amber-700"
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0">
                                            <h2 className="font-semibold">Address</h2>
                                            <p className="mt-1 text-sm text-slate-600">
                                                {address || 'Address unavailable'}
                                            </p>
                                            {branch.google_maps_url && (
                                                <a
                                                    href={branch.google_maps_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
                                                >
                                                    Open in Google Maps
                                                    <ArrowTopRightOnSquareIcon
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="font-semibold">Contact</h2>
                                        {branch.phone && (
                                            <a
                                                href={`tel:${branch.phone}`}
                                                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-950"
                                            >
                                                <PhoneIcon className="size-4" aria-hidden="true" />
                                                {branch.phone}
                                            </a>
                                        )}
                                        {branch.email && (
                                            <a
                                                href={`mailto:${branch.email}`}
                                                className="flex items-center gap-2 break-all text-sm text-slate-600 hover:text-slate-950"
                                            >
                                                <EnvelopeIcon className="size-4 shrink-0" aria-hidden="true" />
                                                {branch.email}
                                            </a>
                                        )}
                                        {branch.website && (
                                            <a
                                                href={branch.website}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-2 break-all text-sm text-slate-600 hover:text-slate-950"
                                            >
                                                <GlobeAltIcon className="size-4 shrink-0" aria-hidden="true" />
                                                {branch.website}
                                            </a>
                                        )}
                                        {!branch.phone && !branch.email && !branch.website && (
                                            <p className="text-sm text-slate-500">
                                                Contact details unavailable
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="font-semibold">Property</h2>
                                        <p className="inline-flex items-center gap-2 text-sm capitalize text-slate-600">
                                            <BuildingOfficeIcon className="size-4" aria-hidden="true" />
                                            {branch.type}
                                        </p>
                                        <p className="inline-flex items-center gap-2 text-sm text-slate-600">
                                            <StarIcon className="size-4 text-amber-500" aria-hidden="true" />
                                            {branch.star_rating} Star Property
                                        </p>
                                        {cancellationAllowed && (
                                            <p className="inline-flex items-center gap-2 text-sm text-emerald-700">
                                                <CheckCircleIcon className="size-4" aria-hidden="true" />
                                                Free cancellation
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-semibold">Getting there</h2>
                                {isGoogleEmbedUrl(branch.google_embed_url) ? (
                                    <iframe
                                        src={branch.google_embed_url}
                                        title={`Map showing ${branch.name}`}
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        className="h-[220px] w-full rounded-xl border-0"
                                    />
                                ) : (
                                    <div className="flex h-[220px] items-center justify-center rounded-xl bg-slate-100 text-center text-sm text-slate-500">
                                        Map is not available for this property.
                                    </div>
                                )}
                                <p className="text-sm text-slate-500">
                                    {address || 'Address unavailable'}
                                </p>
                            </section>

                            <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                                <div>
                                    <h2 className="text-lg font-semibold">Your unit</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {booking.unit_category.name || booking.unit.unit_type}
                                    </p>
                                </div>
                                {booking.unit.images.length > 0 ? (
                                    <div className="flex snap-x gap-3 overflow-x-auto pb-1">
                                        {booking.unit.images.slice(0, 3).map((image, index) => (
                                            <img
                                                key={`${image}-${index}`}
                                                src={image}
                                                alt={`${booking.unit.name} photo ${index + 1}`}
                                                className="h-36 w-56 shrink-0 snap-start rounded-lg object-cover"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex h-36 items-center justify-center rounded-lg bg-amber-50 text-5xl">
                                        🛏️
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="mr-1 text-lg font-semibold">{booking.unit.name}</h3>
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                        Room {booking.unit.number}
                                    </span>
                                    {booking.unit.floor !== null && (
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                            Floor {booking.unit.floor}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full border px-3 py-1 text-xs capitalize text-slate-600">
                                        Up to {booking.unit.capacity} guests
                                    </span>
                                    <span className="rounded-full border px-3 py-1 text-xs capitalize text-slate-600">
                                        {booking.unit.unit_type}
                                    </span>
                                    {booking.unit_category.name && (
                                        <span className="rounded-full border px-3 py-1 text-xs text-slate-600">
                                            {booking.unit_category.name}
                                        </span>
                                    )}
                                </div>
                                {booking.unit.amenities.length > 0 && (
                                    <AmenityList amenities={booking.unit.amenities} />
                                )}
                            </section>

                            <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-semibold">Stay details</h2>
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                    <StayInfo
                                        icon={CalendarDaysIcon}
                                        label="Check-in"
                                        value={formattedDate(booking.check_in, 'EEE, dd MMM yyyy')}
                                        detail="After 2:00 PM"
                                    />
                                    <StayInfo
                                        icon={CalendarDaysIcon}
                                        label="Check-out"
                                        value={formattedDate(booking.check_out, 'EEE, dd MMM yyyy')}
                                        detail="Before 12:00 PM"
                                    />
                                    <StayInfo
                                        icon={ClockIcon}
                                        label="Duration"
                                        value={`${booking.nights} nights`}
                                    />
                                    <StayInfo
                                        icon={UserGroupIcon}
                                        label="Guests"
                                        value={`${booking.adults} Adults, ${booking.children} Children`}
                                    />
                                </div>
                            </section>

                            {booking.extras.length > 0 && (
                                <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                                    <h2 className="text-lg font-semibold">✨ Added Services</h2>
                                    <div className="divide-y">
                                        {booking.extras.map((extra, index) => (
                                            <div
                                                key={`${extra.name}-${index}`}
                                                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                                            >
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <span className="truncate text-sm font-medium">
                                                        {extra.name}
                                                    </span>
                                                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800">
                                                        Extra
                                                    </span>
                                                </div>
                                                <span className="shrink-0 text-sm font-medium">
                                                    {formatMoney(extra.price, booking.currency)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {branch.amenities.length > 0 && (
                                        <div className="border-t px-5 py-4">
                                            <h2 className="mb-3 font-semibold">
                                                Property amenities
                                            </h2>
                                            <AmenityList amenities={branch.amenities} />
                                        </div>
                                    )}
                                </section>
                            )}

                            <section className="space-y-3">
                                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                                    <ExclamationTriangleIcon
                                        className="size-5 shrink-0 text-amber-700"
                                        aria-hidden="true"
                                    />
                                    <div>
                                        <h2 className="font-semibold">Cancellation policy</h2>
                                        <p className="mt-1 whitespace-pre-line text-sm">
                                            {booking.cancellation_policy ||
                                                'Please contact the property for its cancellation policy.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                                    <InformationCircleIcon
                                        className="size-5 shrink-0 text-blue-700"
                                        aria-hidden="true"
                                    />
                                    <div>
                                        <h2 className="font-semibold">Check-in and check-out</h2>
                                        <p className="mt-1 text-sm">
                                            Check-in after 2:00 PM · Check-out before 12:00 PM.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <aside className="space-y-5 lg:sticky lg:top-4">
                            <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Booking reference
                                    </p>
                                    <p className="mt-2 break-all font-mono text-2xl font-bold tracking-widest text-slate-950">
                                        {booking.booking_ref}
                                    </p>
                                    <div className="mt-3">
                                        <BookingStatusBadge status={booking.status} />
                                    </div>
                                    <p className="mt-3 text-sm text-slate-500">
                                        Booked on {formattedDate(booking.created_at, 'EEE dd MMM yyyy')}
                                    </p>
                                </div>

                                <div className="border-t pt-4 text-center">
                                    {booking.qr_code_url ? (
                                        <img
                                            src={booking.qr_code_url}
                                            alt="Booking QR code"
                                            className="mx-auto size-[120px] object-contain"
                                        />
                                    ) : (
                                        <div className="mx-auto flex size-[120px] flex-col items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                                            <QrCodeIcon className="size-12" aria-hidden="true" />
                                            <span className="mt-1 text-[10px]">Code unavailable</span>
                                        </div>
                                    )}
                                    <p className="mt-2 text-xs text-slate-500">
                                        {booking.qr_code_url
                                            ? 'Scan for digital check-in'
                                            : 'Digital check-in code'}
                                    </p>
                                    <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                                        {booking.qr_code}
                                    </p>
                                    <div className="mt-4 overflow-hidden">
                                        <Barcode
                                            value={booking.barcode_value || booking.booking_ref}
                                            width={1.5}
                                            height={50}
                                            fontSize={11}
                                            margin={4}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500">{booking.booking_ref}</p>
                                </div>

                                <div className="border-t pt-4">
                                    <h2 className="font-semibold">Price breakdown</h2>
                                    <div className="mt-3 space-y-3">
                                        {booking.folio_items.map((item, index) => {
                                            const subtotal = item.quantity * item.unit_price;
                                            return (
                                                <div
                                                    key={`${item.description}-${index}`}
                                                    className="flex justify-between gap-3"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-sm">{item.description}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {item.quantity} ×{' '}
                                                            {formatMoney(item.unit_price, booking.currency)}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 text-sm font-medium">
                                                        {formatMoney(subtotal, booking.currency)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {booking.folio_items.length === 0 && (
                                            <p className="text-sm text-slate-500">
                                                Price details are not available.
                                            </p>
                                        )}
                                    </div>
                                    <div className="my-4 border-t" />
                                    <div className="flex justify-between gap-3 text-sm text-slate-500">
                                        <span>Tax &amp; fees</span>
                                        <span>{formatMoney(taxTotal, booking.currency)}</span>
                                    </div>
                                    <div className="my-4 border-t" />
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-lg font-bold">Total paid</span>
                                        <span className="text-lg font-bold text-amber-700">
                                            {formatMoney(booking.total_amount, booking.currency)}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <h2 className="font-semibold">Payments</h2>
                                    {booking.payments.length > 0 ? (
                                        <div className="mt-3 space-y-3">
                                            {booking.payments.map((payment, index) => (
                                                <div
                                                    key={`${payment.created_at}-${index}`}
                                                    className="flex items-center justify-between gap-3"
                                                >
                                                    <div className="min-w-0">
                                                        <span
                                                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                                                paymentMethodStyles[payment.method.toLowerCase()] ??
                                                                'bg-slate-100 text-slate-700'
                                                            }`}
                                                        >
                                                            {payment.method}
                                                        </span>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {formattedDate(payment.created_at, 'dd MMM yyyy')}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-medium">
                                                            {formatMoney(payment.amount, booking.currency)}
                                                        </p>
                                                        <span className="text-xs capitalize text-slate-500">
                                                            {payment.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-sm text-slate-500">
                                            No payments recorded yet.
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2 border-t pt-4">
                                    <a
                                        href={booking.invoice_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
                                    >
                                        <DocumentArrowDownIcon className="size-5" aria-hidden="true" />
                                        Download Invoice (PDF)
                                    </a>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full rounded-xl py-3"
                                        onClick={shareBooking}
                                    >
                                        <ShareIcon className="mr-2 size-4" aria-hidden="true" />
                                        Share Booking
                                    </Button>
                                </div>
                            </section>

                            <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                                <h2 className="text-lg font-semibold">Manage this booking</h2>
                                <form
                                    className="flex flex-wrap gap-2"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        const request = new FormData(event.currentTarget).get('request');
                                        router.post(`/portal/bookings/${booking.id}/modify`, { request });
                                    }}
                                >
                                    <input
                                        name="request"
                                        className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm"
                                        placeholder="Request a change"
                                        required
                                    />
                                    <Button type="submit">Send</Button>
                                </form>
                                {isUpcoming && <SignaturePad bookingId={booking.id} />}
                                {booking.status === 'completed' && (
                                    <form
                                        className="flex flex-wrap gap-2 border-t pt-4"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            const data = new FormData(event.currentTarget);
                                            router.post(`/portal/bookings/${booking.id}/review`, {
                                                rating: Number(data.get('rating')),
                                                comment: data.get('comment'),
                                            });
                                        }}
                                    >
                                        <select
                                            name="rating"
                                            className="h-10 rounded-lg border px-2 text-sm"
                                            defaultValue="5"
                                        >
                                            <option value="5">5 stars</option>
                                            <option value="4">4 stars</option>
                                            <option value="3">3 stars</option>
                                            <option value="2">2 stars</option>
                                            <option value="1">1 star</option>
                                        </select>
                                        <input
                                            name="comment"
                                            className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm"
                                            placeholder="Tell us about your stay"
                                        />
                                        <Button type="submit">Submit feedback</Button>
                                    </form>
                                )}
                            </section>
                        </aside>
                    </div>
                </main>
            </div>

            <MessengerBubble
                booking={booking}
                customerId={customerId}
                customerName={customerName}
                hasExistingReview={hasExistingReview}
            />

            {toast && (
                <div
                    role={toast.error ? 'alert' : 'status'}
                    className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300 ${
                        toastVisible
                            ? 'translate-y-0 opacity-100'
                            : 'translate-y-4 opacity-0'
                    } ${toast.error ? 'bg-red-600' : 'bg-emerald-600'}`}
                >
                    {toast.error ? toast.message : `✅ ${toast.message}`}
                </div>
            )}
        </>
    );
}

function AmenityList({ amenities }: { amenities: Amenity[] }) {
    return (
        <div className="flex flex-wrap gap-2">
            {amenities.map((amenity, index) => {
                const Icon = getAmenityIcon(amenity.icon);
                return (
                    <span
                        key={`${amenity.name}-${index}`}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs ${
                            amenityColorStyles[amenity.color.toLowerCase()] ??
                            amenityColorStyles.teal
                        }`}
                    >
                        <Icon className="size-4" aria-hidden="true" />
                        {amenity.name}
                    </span>
                );
            })}
        </div>
    );
}

function StayInfo({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: AmenityIcon;
    label: string;
    value: string;
    detail?: string;
}) {
    return (
        <div className="min-w-0 rounded-lg bg-slate-50 p-3">
            <Icon className="size-5 text-amber-700" aria-hidden="true" />
            <p className="mt-2 text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
            {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
        </div>
    );
}

BookingDetail.layout = (page: React.ReactNode) => <AppLayoutHome>{page}</AppLayoutHome>;
