import { Head, Link, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import AppLayoutHome from '@/layouts/app-layout-home';

type Booking = {
    id: number;
    booking_reference: string;
    check_in: string;
    check_out: string;
    status: string;
    qr_code: string;
    total_amount: string;
    adults: number;
    children: number;
    branch?: { name: string };
    unit?: { name: string; number: string };
    rooms?: { id: number; name: string; number: string }[];
};

type Props = {
    customer: { name: string };
    upcomingBookings: Booking[];
    pastBookings: Booking[];
    loyaltyPoints: number;
};

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
        <div className="mt-3 rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium">Checkout signature</p>
            <canvas
                ref={canvas}
                width={520}
                height={140}
                className="h-28 w-full touch-none rounded border bg-white"
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
            <div className="mt-2 flex gap-2">
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

function guestCounts(booking: Booking): string {
    return `${booking.adults} ${booking.adults === 1 ? 'adult' : 'adults'} · ${booking.children} ${
        booking.children === 1 ? 'child' : 'children'
    }`;
}

export default function PortalDashboard({
    customer,
    upcomingBookings,
    pastBookings,
    loyaltyPoints,
}: Props) {
    return (
        <>
            <Head title="My customer portal" />
            <div className="bg-slate-50 px-6 py-12 lg:px-8">
                <div className="mx-auto max-w-6xl space-y-8">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
                                Guest portal
                            </p>
                            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
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
                            <p className="text-sm text-slate-500">Upcoming stays</p>
                            <strong className="mt-3 block text-4xl text-slate-950">
                                {upcomingBookings.length}
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

                    <section>
                        <div className="mb-4 flex items-end justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600">
                                    Your stays
                                </p>
                                <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                                    Upcoming bookings
                                </h2>
                            </div>
                            <Link
                                href="/portal/profile"
                                className="text-sm font-medium text-slate-600 underline underline-offset-4"
                            >
                                View profile
                            </Link>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            {upcomingBookings.map((booking) => (
                                <div
                                    className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                                    key={booking.id}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <strong className="text-lg">
                                                {booking.booking_reference}
                                            </strong>
                                            <div className="mt-1 text-sm text-slate-500">
                                                {booking.branch?.name} ·{' '}
                                                {booking.unit?.name ?? booking.unit?.number}
                                            </div>
                                        </div>
                                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium capitalize text-amber-700">
                                            {booking.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm">
                                        {booking.check_in} to {booking.check_out}
                                    </div>
                                    <p className="mt-2 text-sm text-slate-600">
                                        {guestCounts(booking)}
                                    </p>
                                    <div className="mt-3 rounded-xl bg-slate-950 p-3 text-xs text-white">
                                        QR check-in code: {booking.qr_code}
                                    </div>
                                    <a
                                        className="mt-3 inline-block text-sm font-medium underline"
                                        href={`/portal/bookings/${booking.id}/invoice`}
                                    >
                                        Download PDF invoice
                                    </a>
                                    <form
                                        className="mt-4 flex gap-2"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            const request = new FormData(
                                                event.currentTarget,
                                            ).get('request');
                                            router.post(
                                                `/portal/bookings/${booking.id}/modify`,
                                                { request },
                                            );
                                        }}
                                    >
                                        <input
                                            name="request"
                                            className="h-9 min-w-0 flex-1 rounded-xl border px-3 text-sm"
                                            placeholder="Request a change"
                                        />
                                        <Button size="sm" type="submit">
                                            Send
                                        </Button>
                                    </form>
                                    <SignaturePad bookingId={booking.id} />
                                </div>
                            ))}
                        </div>
                        {!upcomingBookings.length && (
                            <div className="rounded-3xl border border-dashed p-10 text-center">
                                <p className="text-slate-500">No upcoming bookings.</p>
                                <Link
                                    href="/portal/book"
                                    className="mt-3 inline-block font-medium underline underline-offset-4"
                                >
                                    Find your next stay
                                </Link>
                            </div>
                        )}
                    </section>

                    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <h2 className="mb-4 text-xl font-semibold">Past stay history</h2>
                        {pastBookings.map((booking) => (
                            <div
                                className="border-b py-3 last:border-0"
                                key={booking.id}
                            >
                                <div className="text-sm">
                                    {booking.booking_reference} · {booking.check_in} to{' '}
                                    {booking.check_out} ·{' '}
                                    <span className="capitalize">
                                        {booking.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">
                                    {guestCounts(booking)}
                                </p>
                                {booking.status === 'completed' && (
                                    <form
                                        className="mt-2 flex gap-2"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            const data = new FormData(event.currentTarget);
                                            router.post(
                                                `/portal/bookings/${booking.id}/review`,
                                                {
                                                    rating: Number(data.get('rating')),
                                                    comment: data.get('comment'),
                                                },
                                            );
                                        }}
                                    >
                                        <select
                                            name="rating"
                                            className="h-9 rounded-xl border px-2"
                                        >
                                            <option value="5">5 stars</option>
                                            <option value="4">4 stars</option>
                                            <option value="3">3 stars</option>
                                            <option value="2">2 stars</option>
                                            <option value="1">1 star</option>
                                        </select>
                                        <input
                                            name="comment"
                                            className="h-9 min-w-0 flex-1 rounded-xl border px-3 text-sm"
                                            placeholder="Tell us about your stay"
                                        />
                                        <Button size="sm" type="submit">
                                            Submit feedback
                                        </Button>
                                    </form>
                                )}
                            </div>
                        ))}
                        {!pastBookings.length && (
                            <p className="text-sm text-slate-500">
                                Your completed stays will appear here.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}

PortalDashboard.layout = (page: React.ReactNode) => <AppLayoutHome>{page}</AppLayoutHome>;
