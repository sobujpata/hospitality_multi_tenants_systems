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

type Unit = { id: number; number: string; name: string; bookings: Booking[] };

type Props = { start: string; end: string; units: Unit[] };

const day = 24 * 60 * 60 * 1000;

function dateValue(value: string): number {
    return new Date(`${value}T00:00:00`).getTime();
}

export default function Timeline({ start, end, units }: Props) {
    const [resizing, setResizing] = useState<{ booking: Booking; startX: number } | null>(null);
    const days = useMemo(() => {
        const values: string[] = [];
        for (let value = dateValue(start); value < dateValue(end); value += day) {
            values.push(new Date(value).toISOString().slice(0, 10));
        }
        return values;
    }, [start, end]);

    const updateEndDate = (booking: Booking, delta: number) => {
        const checkOut = new Date(dateValue(booking.check_out) + delta * day).toISOString().slice(0, 10);
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
                                {days.map((date) => <div key={date} className="border-l p-3 text-center">{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>)}
                            </div>
                        </div>
                        {units.map((unit) => (
                            <div key={unit.id} className="grid min-h-20 grid-cols-[220px_1fr] border-b last:border-b-0">
                                <div className="p-3"><div className="font-medium">{unit.number}</div><div className="text-xs text-muted-foreground">{unit.name}</div></div>
                                <div className="relative grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(70px, 1fr))` }}>
                                    {days.map((date) => <div key={date} className="border-l border-dashed" />)}
                                    {unit.bookings.map((booking) => {
                                        const left = Math.max(0, Math.round((dateValue(booking.check_in) - dateValue(start)) / day));
                                        const width = Math.max(1, Math.round((dateValue(booking.check_out) - dateValue(booking.check_in)) / day));
                                        return (
                                            <div
                                                key={booking.id}
                                                className="absolute inset-y-2 rounded-lg bg-amber-400 px-3 py-2 text-xs text-slate-950 shadow-sm"
                                                style={{ left: `${(left / days.length) * 100}%`, width: `${(width / days.length) * 100}%` }}
                                            >
                                                <div className="truncate font-semibold">{booking.booking_ref}</div>
                                                <div className="truncate">{booking.customer?.name ?? 'Guest'}</div>
                                                <button
                                                    type="button"
                                                    className="absolute right-0 top-0 h-full w-3 cursor-ew-resize"
                                                    aria-label="Extend booking"
                                                    onPointerDown={(event) => {
                                                        event.currentTarget.setPointerCapture(event.pointerId);
                                                        setResizing({ booking, startX: event.clientX });
                                                    }}
                                                    onPointerUp={(event) => {
                                                        if (resizing?.booking.id === booking.id) {
                                                            updateEndDate(booking, Math.round((event.clientX - resizing.startX) / 70));
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
