import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type Booking = {
    id: number;
    booking_ref: string;
    check_in: string;
    check_out: string;
    status: string;
    customer?: { name: string };
};

type Unit = { id: number; number: string; name: string; branch?: { id: number; name: string } | null; bookings: Booking[] };

type Props = { start: string; end: string; units: Unit[] };
type ResizingBooking = { booking: Booking; startX: number; columnWidth: number };

const day = 24 * 60 * 60 * 1000;

function dateValue(value: string): number {
    return Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
}

function dateFromValue(value: number): string {
    return new Date(value).toISOString().slice(0, 10);
}

export default function Timeline({ start, end, units }: Props) {
    const [resizing, setResizing] = useState<ResizingBooking | null>(null);
    const days = useMemo(() => {
        const values: string[] = [];
        for (let value = dateValue(start); value < dateValue(end); value += day) {
            values.push(dateFromValue(value));
        }
        return values;
    }, [start, end]);

    const updateEndDate = (booking: Booking, delta: number) => {
        const checkOut = dateFromValue(dateValue(booking.check_out) + delta * day);
        if (dateValue(checkOut) <= dateValue(booking.check_in)) {
            return;
        }
        router.put(`/bookings/${booking.id}/dates`, { check_in: booking.check_in, check_out: checkOut }, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Booking timeline" />
            <div className="space-y-4 p-6">
                <div>
                    <h1 className="text-2xl font-semibold">Booking timeline</h1>
                    <p className="text-sm text-muted-foreground">Drag the right edge of a booking to extend or shorten its stay.</p>
                </div>
                <div className="overflow-x-auto rounded-xl border bg-background">
                    <div className="min-w-[900px]">
                        <div className="grid grid-cols-[220px_1fr] border-b bg-muted/40 text-xs font-medium">
                            <div className="p-3">Unit</div>
                            <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(70px, 1fr))` }}>
                                {days.map((date) => <div key={date} className="border-l px-1 py-2 text-center"><div className="text-[10px] font-normal text-muted-foreground">{new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}</div><div>{new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</div></div>)}
                            </div>
                        </div>
                        {units.map((unit) => (
                            <div key={unit.id} className="grid min-h-20 grid-cols-[220px_1fr] border-b last:border-b-0">
                                <div className="p-3"><div className="truncate text-[10px] font-semibold uppercase tracking-wide text-indigo-600">{unit.branch?.name ?? 'Branch'}</div><div className="font-medium">{unit.number}</div><div className="text-xs text-muted-foreground">{unit.name}</div></div>
                                <div data-timeline-grid className="relative grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(70px, 1fr))` }}>
                                    {days.map((date) => <div key={date} className="border-l border-dashed" />)}
                                    {unit.bookings.map((booking) => {
                                        const bookingStart = (dateValue(booking.check_in) - dateValue(start)) / day;
                                        const bookingEnd = (dateValue(booking.check_out) - dateValue(start)) / day;
                                        const left = Math.max(0, bookingStart);
                                        const right = Math.min(days.length, bookingEnd);
                                        if (right <= left) return null;
                                        return (
                                            <div
                                                key={booking.id}
                                                className="absolute inset-y-2 rounded-lg bg-amber-400 px-3 py-2 text-xs text-slate-950 shadow-sm"
                                                style={{ left: `${(left / days.length) * 100}%`, width: `${((right - left) / days.length) * 100}%` }}
                                            >
                                                <div className="truncate font-semibold">{booking.booking_ref}</div>
                                                <div className="truncate">{booking.customer?.name ?? 'Guest'}</div>
                                                <button
                                                    type="button"
                                                    className="absolute right-0 top-0 h-full w-3 cursor-ew-resize"
                                                    aria-label="Extend booking"
                                                    onPointerDown={(event) => {
                                                        event.currentTarget.setPointerCapture(event.pointerId);
                                                        const grid = event.currentTarget.closest('[data-timeline-grid]');
                                                        const gridWidth = grid?.getBoundingClientRect().width ?? 0;
                                                        setResizing({ booking, startX: event.clientX, columnWidth: gridWidth / days.length || 70 });
                                                    }}
                                                    onPointerUp={(event) => {
                                                        if (resizing?.booking.id === booking.id) {
                                                            updateEndDate(booking, Math.round((event.clientX - resizing.startX) / resizing.columnWidth));
                                                        }
                                                        setResizing(null);
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

Timeline.layout = { breadcrumbs: [{ title: 'Booking timeline', href: '/bookings/timeline' }] };
