import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';

type Stats = {
    range: { start: string; end: string };
    occupancy: {
        today: number;
        range: number;
        occupied: number;
        total: number;
    };
    revenue: { daily: number; monthly: number; ytd: number; range: number };
    revpar: number;
    adr: number;
    occupancyTrend:
        | { date: string; occupancy: number }[]
        | Record<string, { date: string; occupancy: number }>;
    revenueByBranch:
        | { branch: string; revenue: number }[]
        | Record<string, { branch: string; revenue: number }>;
    bookingSources:
        | { source: string; bookings: number }[]
        | Record<string, { source: string; bookings: number }>;
    monthlyComparison:
        | { month: string; revenue: number }[]
        | Record<string, { month: string; revenue: number }>;
    arrivals:
        | {
              id: number;
              booking_ref: string;
              check_in: string;
              branch?: { name: string };
              unit?: { number: string };
          }[]
        | Record<
              string,
              {
                  id: number;
                  booking_ref: string;
                  check_in: string;
                  branch?: { name: string };
                  unit?: { number: string };
              }
          >;
    departures:
        | {
              id: number;
              booking_ref: string;
              check_out: string;
              branch?: { name: string };
              unit?: { number: string };
          }[]
        | Record<
              string,
              {
                  id: number;
                  booking_ref: string;
                  check_out: string;
                  branch?: { name: string };
                  unit?: { number: string };
              }
          >;
    topCustomers:
        | { name: string; email: string | null; spent: number }[]
        | Record<string, { name: string; email: string | null; spent: number }>;
};
type Props = {
    stats: Stats;
    recentReviews?: {
        id: number;
        rating: number;
        comment: string | null;
        customer?: { name: string };
    }[];
};
const colors = ['#d97706', '#0f766e', '#2563eb', '#9333ea', '#dc2626'];
const money = (value: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);
const asArray = <T,>(value: T[] | Record<string, T>): T[] =>
    Array.isArray(value) ? value : Object.values(value);

export default function Dashboard({ stats, recentReviews = [] }: Props) {
    const bookingSources = Array.isArray(stats.bookingSources)
        ? stats.bookingSources
        : Object.values(stats.bookingSources ?? {});
    const occupancyTrend = asArray(stats.occupancyTrend);
    const revenueByBranch = asArray(stats.revenueByBranch);
    const monthlyComparison = asArray(stats.monthlyComparison);
    const arrivals = asArray(stats.arrivals);
    const departures = asArray(stats.departures);
    const topCustomers = asArray(stats.topCustomers);
    const [start, setStart] = useState(stats.range.start);
    const [end, setEnd] = useState(stats.range.end);
    const applyRange = (event: React.FormEvent) => {
        event.preventDefault();
        router.get(
            '/dashboard',
            { start, end },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };
    return (
        <>
            <Head title="Dashboard" />
            <div className="flex flex-1 flex-col gap-5 overflow-x-auto p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold">
                            Operations dashboard
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Live property performance and guest activity.
                        </p>
                    </div>
                    <form
                        className="flex flex-wrap items-end gap-2"
                        onSubmit={applyRange}
                    >
                        <label className="grid gap-1 text-xs">
                            From
                            <input
                                className="h-9 rounded border px-2 text-sm"
                                type="date"
                                value={start}
                                onChange={(event) =>
                                    setStart(event.target.value)
                                }
                            />
                        </label>
                        <label className="grid gap-1 text-xs">
                            To
                            <input
                                className="h-9 rounded border px-2 text-sm"
                                type="date"
                                value={end}
                                onChange={(event) => setEnd(event.target.value)}
                            />
                        </label>
                        <Button type="submit">Refresh</Button>
                    </form>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        [
                            "Today's occupancy",
                            `${stats.occupancy.today}%`,
                            `${stats.occupancy.occupied}/${stats.occupancy.total} rooms`,
                        ],
                        ['Daily revenue', money(stats.revenue.daily), 'Today'],
                        ['RevPAR', money(stats.revpar), 'Selected period'],
                        ['ADR', money(stats.adr), 'Average daily rate'],
                    ].map(([label, value, note]) => (
                        <div
                            className="rounded-xl border bg-card p-4"
                            key={label}
                        >
                            <div className="text-sm text-muted-foreground">
                                {label}
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {value}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                {note}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border p-4">
                        <div className="text-sm text-muted-foreground">
                            Monthly revenue
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                            {money(stats.revenue.monthly)}
                        </div>
                    </div>
                    <div className="rounded-xl border p-4">
                        <div className="text-sm text-muted-foreground">
                            YTD revenue
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                            {money(stats.revenue.ytd)}
                        </div>
                    </div>
                    <div className="rounded-xl border p-4">
                        <div className="text-sm text-muted-foreground">
                            Period occupancy
                        </div>
                        <div className="mt-1 text-xl font-semibold">
                            {stats.occupancy.range}%
                        </div>
                    </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border p-4">
                        <h2 className="mb-4 font-medium">Occupancy trend</h2>
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={occupancyTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis unit="%" />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="occupancy"
                                    stroke="#d97706"
                                    strokeWidth={3}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="rounded-xl border p-4">
                        <h2 className="mb-4 font-medium">Revenue by branch</h2>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={revenueByBranch}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="branch" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value) => money(Number(value))}
                                />
                                <Bar dataKey="revenue" fill="#0f766e" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="rounded-xl border p-4">
                        <h2 className="mb-4 font-medium">Booking sources</h2>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie
                                    data={bookingSources}
                                    dataKey="bookings"
                                    nameKey="source"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={85}
                                    label
                                >
                                    {bookingSources.map((entry, index) => (
                                        <Cell
                                            key={entry.source}
                                            fill={colors[index % colors.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="rounded-xl border p-4">
                        <h2 className="mb-4 font-medium">Monthly comparison</h2>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={monthlyComparison}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value) => money(Number(value))}
                                />
                                <Bar dataKey="revenue" fill="#2563eb" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                    <section className="rounded-xl border p-4">
                        <h2 className="mb-3 font-medium">
                            Arrivals & departures
                        </h2>
                        <div className="space-y-2 text-sm">
                            {arrivals.slice(0, 5).map((item) => (
                                <div
                                    className="flex justify-between border-b pb-2"
                                    key={`a-${item.id}`}
                                >
                                    <span>
                                        <strong>Arrival</strong> ·{' '}
                                        {item.booking_ref} ·{' '}
                                        {item.unit?.number ?? '—'}
                                    </span>
                                    <span>{item.check_in}</span>
                                </div>
                            ))}
                            {departures.slice(0, 5).map((item) => (
                                <div
                                    className="flex justify-between border-b pb-2"
                                    key={`d-${item.id}`}
                                >
                                    <span>
                                        <strong>Departure</strong> ·{' '}
                                        {item.booking_ref} ·{' '}
                                        {item.unit?.number ?? '—'}
                                    </span>
                                    <span>{item.check_out}</span>
                                </div>
                            ))}
                            {!arrivals.length && !departures.length && (
                                <p className="text-muted-foreground">
                                    No activity in this range.
                                </p>
                            )}
                        </div>
                    </section>
                    <section className="rounded-xl border p-4">
                        <h2 className="mb-3 font-medium">
                            Top-spending customers
                        </h2>
                        {topCustomers.map((customer, index) => (
                            <div
                                className="flex justify-between border-b py-2 text-sm"
                                key={`${customer.email}-${index}`}
                            >
                                <span>
                                    {customer.name}
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        {customer.email}
                                    </span>
                                </span>
                                <strong>{money(customer.spent)}</strong>
                            </div>
                        ))}
                    </section>
                </div>
                <section className="rounded-xl border p-4">
                    <h2 className="mb-3 font-medium">Recent guest feedback</h2>
                    {recentReviews.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No reviews yet.
                        </p>
                    ) : (
                        recentReviews.map((review) => (
                            <div
                                key={review.id}
                                className="border-t py-2 text-sm"
                            >
                                <strong>
                                    {review.customer?.name ?? 'Guest'}
                                </strong>{' '}
                                · {'★'.repeat(review.rating)}
                                <p>{review.comment}</p>
                            </div>
                        ))
                    )}
                </section>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: '/dashboard',
        },
    ],
};
