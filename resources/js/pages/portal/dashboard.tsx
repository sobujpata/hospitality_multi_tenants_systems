import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRightIcon,
    BuildingOffice2Icon,
    CalendarDaysIcon,
    FaceSmileIcon,
    HomeIcon,
    MapPinIcon,
    MoonIcon,
    StarIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as SolidStarIcon } from '@heroicons/react/24/solid';
import { format, parseISO } from 'date-fns';
import BookingStatusBadge from '@/components/BookingStatusBadge';
import { Button } from '@/components/ui/button';
import AppLayoutHome from '@/layouts/app-layout-home';

type Booking = {
    id: number;
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
    branch: {
        name: string;
        type: string;
        city: string;
        address_line1: string | null;
        address_line2: string | null;
        cover_image: string | null;
        star_rating: number;
    };
    unit: {
        name: string;
        number: string;
        unit_type: string;
        floor: number | null;
    };
    unit_category: { name: string };
    extras: { name: string; price: number }[];
};

type PaginationLink = { url: string | null; label: string; active: boolean };
type BookingPage = {
    data: Booking[];
    links: PaginationLink[];
    from: number | null;
    to: number | null;
    total: number;
};
type Props = {
    customer: { name: string };
    bookings: BookingPage;
    loyaltyPoints: number;
};

function formatAmount(amount: number): string {
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function PortalDashboard({ customer, bookings, loyaltyPoints }: Props) {
    return (
        <>
            <Head title="My customer portal" />
            <div className="bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl space-y-8">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
                                Guest portal
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                                Welcome, {customer.name}
                            </h1>
                            <p className="mt-2 text-slate-500">
                                Manage stays across every Hospitality destination.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Link href="/portal/book">
                                <Button className="rounded-full bg-slate-950 px-5 hover:bg-slate-800">
                                    Book a room
                                </Button>
                            </Link>
                            <Button
                                variant="outline"
                                className="rounded-full"
                                onClick={() => router.post('/portal/logout')}
                            >
                                Log out
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
                            <p className="text-sm text-slate-300">Loyalty balance</p>
                            <strong className="mt-3 block text-4xl">{loyaltyPoints}</strong>
                            <span className="text-sm text-amber-300">
                                points to enjoy on your next stay
                            </span>
                        </div>
                        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                            <p className="text-sm text-slate-500">All bookings</p>
                            <strong className="mt-3 block text-4xl text-slate-950">
                                {bookings.total}
                            </strong>
                            <span className="text-sm text-slate-500">
                                across all destinations
                            </span>
                        </div>
                        <div className="rounded-3xl bg-amber-50 p-6 ring-1 ring-amber-100">
                            <p className="text-sm text-amber-700">Need something new?</p>
                            <Link
                                href="/portal/book"
                                className="mt-4 inline-block text-xl font-semibold text-slate-950 underline underline-offset-4"
                            >
                                Find your next stay
                            </Link>
                        </div>
                    </div>

                    <section className="mx-auto max-w-[720px]">
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600">
                                    Your stays
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                                    All bookings
                                </h2>
                            </div>
                            <Link
                                href="/portal/profile"
                                className="text-sm font-medium text-slate-600 underline underline-offset-4"
                            >
                                View profile
                            </Link>
                        </div>
                        <p className="mb-3 text-sm text-muted-foreground">
                            Showing {bookings.from ?? 0}–{bookings.to ?? 0} of {bookings.total}{' '}
                            {bookings.total === 1 ? 'booking' : 'bookings'}
                        </p>

                        {bookings.data.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {bookings.data.map((booking) => (
                                    <BookingCard key={booking.id} booking={booking} />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-3xl border border-dashed bg-white px-6 py-12 text-center">
                                <div className="text-6xl" aria-hidden="true">
                                    📅
                                </div>
                                <h3 className="mt-4 text-xl font-semibold text-slate-950">
                                    No bookings yet
                                </h3>
                                <p className="mt-2 text-sm text-slate-500">
                                    Your reservations will appear here
                                </p>
                                <Link
                                    href="/search"
                                    className="mt-5 inline-flex items-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                                >
                                    Explore Properties
                                </Link>
                            </div>
                        )}

                        {bookings.links.length > 3 && (
                            <nav
                                aria-label="Booking pages"
                                className="mt-5 flex flex-wrap justify-center gap-2"
                            >
                                {bookings.links.map((link) =>
                                    link.url ? (
                                        <Link
                                            key={`${link.label}-${link.url}`}
                                            href={link.url}
                                            aria-current={link.active ? 'page' : undefined}
                                            className={`rounded-lg border px-3 py-2 text-sm ${
                                                link.active
                                                    ? 'border-slate-950 bg-slate-950 text-white'
                                                    : 'bg-white text-slate-700 hover:bg-slate-100'
                                            }`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span
                                            key={`${link.label}-disabled`}
                                            aria-disabled="true"
                                            className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-400"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ),
                                )}
                            </nav>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}

function BookingCard({ booking }: { booking: Booking }) {
    const rating = Math.max(0, Math.min(5, booking.branch.star_rating));
    const address = [
        booking.branch.address_line1,
        booking.branch.address_line2,
        booking.branch.city,
    ]
        .filter(Boolean)
        .join(', ');
    return (
        <Link
            href={`/bookings/${booking.id}`}
            className="group grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-500 hover:shadow-md sm:grid-cols-[100px_minmax(0,1fr)_auto] sm:gap-5"
        >
            <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-start">
                {booking.branch.cover_image ? (
                    <img
                        src={booking.branch.cover_image}
                        alt={`${booking.branch.name} cover`}
                        className="size-[100px] shrink-0 rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.05]"
                    />
                ) : (
                    <div className="flex size-[100px] shrink-0 items-center justify-center rounded-xl bg-amber-100 text-4xl font-semibold text-amber-800 transition-transform duration-200 group-hover:scale-[1.05]">
                        {booking.branch.name.charAt(0).toUpperCase() || '?'}
                    </div>
                )}
                <div
                    className="flex items-center gap-0.5"
                    aria-label={`${rating} out of 5 stars`}
                >
                    {Array.from({ length: rating }, (_, index) => (
                        <SolidStarIcon
                            key={index}
                            className="size-4 text-amber-400"
                            aria-hidden="true"
                        />
                    ))}
                    {Array.from({ length: 5 - rating }, (_, index) => (
                        <StarIcon
                            key={`empty-${index}`}
                            className="size-4 text-amber-400"
                            aria-hidden="true"
                        />
                    ))}
                </div>
            </div>

            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950">
                        {booking.branch.name}
                    </h3>
                    <BookingStatusBadge status={booking.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-slate-600">
                        {booking.branch.type}
                    </span>
                    <span className="rounded-full border px-2 py-0.5 text-xs text-slate-600">
                        {booking.branch.city}
                    </span>
                </div>
                <p className="mt-2 flex items-start gap-1 text-sm text-muted-foreground">
                    <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{address || 'Address unavailable'}</span>
                </p>
                <div className="my-3 border-t" />
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                        <UserIcon className="size-4" aria-hidden="true" />
                        {booking.adults} Adults
                    </span>
                    {booking.children > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                            <FaceSmileIcon className="size-4" aria-hidden="true" />
                            {booking.children} Children
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                        <HomeIcon className="size-4" aria-hidden="true" />
                        {booking.unit.name} · Room {booking.unit.number}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <BuildingOffice2Icon className="size-4" aria-hidden="true" />
                        Floor {booking.unit.floor ?? '—'}
                    </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarDaysIcon className="size-4 text-slate-500" aria-hidden="true" />
                        {format(parseISO(booking.check_in), 'EEE, dd MMM yyyy')}
                    </span>
                    <ArrowRightIcon className="size-4 text-slate-400" aria-hidden="true" />
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarDaysIcon className="size-4 text-slate-500" aria-hidden="true" />
                        {format(parseISO(booking.check_out), 'EEE, dd MMM yyyy')}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        <MoonIcon className="size-3.5" aria-hidden="true" />
                        {booking.nights} nights
                    </span>
                </div>
                {booking.extras.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {booking.extras.slice(0, 3).map((extra, index) => (
                            <span
                                key={`${extra.name}-${index}`}
                                className="rounded-full bg-teal-50 px-2.5 py-1 text-xs text-teal-800"
                            >
                                {extra.name}
                            </span>
                        ))}
                        {booking.extras.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                                +{booking.extras.length - 3} more
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-end justify-between gap-4 border-t pt-3 sm:flex-col sm:items-end sm:justify-start sm:border-0 sm:pt-0">
                <div className="sm:text-right">
                    <p className="text-xl font-bold text-amber-700">
                        {formatAmount(booking.total_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{booking.currency}</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                        {booking.booking_ref}
                    </p>
                </div>
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 transition-colors group-hover:border-amber-500 group-hover:text-amber-700">
                    View Details <ArrowRightIcon className="size-4" aria-hidden="true" />
                </span>
            </div>
        </Link>
    );
}

PortalDashboard.layout = (page: React.ReactNode) => <AppLayoutHome>{page}</AppLayoutHome>;
