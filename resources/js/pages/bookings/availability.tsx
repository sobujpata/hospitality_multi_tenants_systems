import { Head } from '@inertiajs/react';
import { useMemo } from 'react';

type Booking = { check_in: string; check_out: string; status: string };
type Block = { starts_on: string; ends_on: string; reason: string | null };
type Unit = { id: number; number: string; name: string; status: string; branch?: { id: number; name: string } | null; bookings: Booking[]; blocks: Block[] };
type Props = { start: string; end: string; units: Unit[] };

const day = 86400000;
const toTime = (value: string) => new Date(`${value}T00:00:00`).getTime();

export default function Availability({ start, end, units }: Props) {
    const dates = useMemo(() => {
        const result: string[] = [];
        for (let value = toTime(start); value < toTime(end); value += day) result.push(new Date(value).toISOString().slice(0, 10));
        return result;
    }, [start, end]);
    const state = (unit: Unit, date: string) => {
        if (unit.status === 'maintenance') return 'blocked';
        if (unit.blocks.some((block) => date >= block.starts_on && date < block.ends_on)) return 'blocked';
        if (unit.bookings.some((booking) => date >= booking.check_in && date < booking.check_out)) return 'booked';
        return 'available';
    };

    return (
        <>
            <Head title="Availability calendar" />
            <div className="space-y-4 p-6">
                <div><h1 className="text-2xl font-semibold">Availability calendar</h1><p className="text-sm text-muted-foreground">Review availability by unit across the selected period.</p></div>
                <div className="flex gap-4 text-xs"><span><i className="mr-1 inline-block size-3 rounded bg-emerald-200" />Available</span><span><i className="mr-1 inline-block size-3 rounded bg-amber-300" />Booked</span><span><i className="mr-1 inline-block size-3 rounded bg-slate-300" />Blocked</span></div>
                <div className="overflow-x-auto rounded-xl border">
                    <div className="min-w-[1100px]">
                        <div className="grid grid-cols-[190px_1fr] border-b bg-muted/40 text-xs font-medium"><div className="p-3">Unit</div><div className="grid" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(34px, 1fr))` }}>{dates.map((date) => <div key={date} className="border-l p-2 text-center">{new Date(`${date}T00:00:00`).getDate()}</div>)}</div></div>
                        {units.map((unit) => <div key={unit.id} className="grid grid-cols-[190px_1fr] border-b last:border-0"><div className="p-3 text-sm"><div className="truncate text-[10px] font-semibold uppercase tracking-wide text-indigo-600">{unit.branch?.name ?? 'Branch'}</div><div className="font-medium">{unit.number}</div><div className="text-xs text-muted-foreground">{unit.name}</div></div><div className="grid" style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(34px, 1fr))` }}>{dates.map((date) => <div key={date} title={`${date}: ${state(unit, date)}`} className={`min-h-14 border-l border-dashed ${state(unit, date) === 'booked' ? 'bg-amber-300' : state(unit, date) === 'blocked' ? 'bg-slate-300' : 'bg-emerald-100'}`} />)}</div></div>)}
                    </div>
                </div>
            </div>
        </>
    );
}

Availability.layout = { breadcrumbs: [{ title: 'Availability calendar', href: '/bookings/availability' }] };
