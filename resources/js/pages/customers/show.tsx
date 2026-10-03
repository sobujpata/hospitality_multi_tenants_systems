import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeftIcon,
    BuildingOffice2Icon,
    CalendarDaysIcon,
    CheckCircleIcon,
    ClockIcon,
    CreditCardIcon,
    IdentificationIcon,
    MapPinIcon,
    PaperClipIcon,
    UserCircleIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Customer = {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    nationality: string | null;
    gender: string | null;
    date_of_birth: string | null;
    arrived_from: string | null;
    occupation: string | null;
    organization: string | null;
    purpose_of_visit: string | null;
    id_type: string | null;
    id_number: string | null;
    address: Record<string, string> | null;
    vip_level: string;
    loyalty_points: number;
    notes: string | null;
    tags: string[] | null;
    blacklisted: boolean;
    blacklist_reason: string | null;
    documents: { label: string; path: string; uploaded_at?: string }[] | null;
    created_at: string;
};
type BookingRoom = {
    id: number;
    number: string;
    name: string;
    floor: string | null;
    pivot?: { room_amount: string; guest_names: string | string[] | null };
};
type Booking = {
    id: number;
    booking_ref: string | null;
    booking_reference: string;
    type: string;
    check_in: string;
    check_out: string;
    adults: number;
    children: number;
    total_amount: string | number;
    currency: string;
    status: string;
    source: string | null;
    special_requests: string | null;
    created_at: string;
    branch: { id: number; name: string; currency: string } | null;
    unit: { id: number; number: string; name: string; floor: string | null } | null;
    rooms: BookingRoom[];
    folio_items: { id: number; description: string; quantity: string | number; unit_price: string | number; tax_rate: string | number; discount: string | number; item_type: string }[];
    payments: { id: number; amount: string | number; method: string; reference: string | null; paid_at: string | null }[];
    assigned_staff: { id: number; name: string } | null;
    creator: { id: number; name: string } | null;
};
type Props = {
    customer: Customer;
    bookings: Booking[];
    totalSpent: number;
    duplicates: { id: number; name: string; email: string | null; phone: string | null }[];
};

function displayDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function nightCount(checkIn: string, checkOut: string): number {
    const start = new Date(`${checkIn.slice(0, 10)}T00:00:00`);
    const end = new Date(`${checkOut.slice(0, 10)}T00:00:00`);
    const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);

    return Number.isFinite(nights) ? Math.max(1, nights) : 1;
}

function money(value: string | number, currency: string): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

function statusClass(status: string): string {
    if (['checked_in', 'completed', 'confirmed'].includes(status)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    if (['cancelled', 'no_show'].includes(status)) return 'bg-rose-50 text-rose-700 ring-rose-200';
    return 'bg-amber-50 text-amber-800 ring-amber-200';
}

function titleCase(value: string | null | undefined): string {
    return value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—';
}

export default function CustomerProfile({ customer, bookings, totalSpent, duplicates }: Props) {
    const [label, setLabel] = useState('ID document');
    const [document, setDocument] = useState<File | null>(null);
    const [sourceId, setSourceId] = useState('');
    const page = usePage();
    const status = (page.props as typeof page.props & { flash?: { status?: string } }).flash?.status;

    const upload = () => {
        if (document) {
            router.post(`/customers/${customer.id}/documents`, { document, label }, {
                forceFormData: true,
                onSuccess: () => setDocument(null),
            });
        }
    };
    const merge = () => {
        if (sourceId && window.confirm('Merge this duplicate into the current customer?')) {
            router.post(`/customers/${customer.id}/merge`, { source_id: Number(sourceId) });
        }
    };

    const address = customer.address ?? {};
    const addressText = [address.line1, address.line2, address.city, address.state, address.postal_code, address.country].filter(Boolean).join(', ');

    return (
        <>
            <Head title={`${customer.name} · Customer`} />
            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
                <Link href="/customers" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-indigo-700">
                    <ArrowLeftIcon className="size-4" />Back to customers
                </Link>

                {status && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircleIcon className="size-5 shrink-0" />{status}</div>}

                <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg sm:p-8">
                    <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full border-[38px] border-white/5" />
                    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl font-semibold ring-1 ring-white/15">{customer.name.slice(0, 1).toUpperCase()}</span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{customer.name}</h1>
                                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium capitalize text-indigo-100">{customer.vip_level} guest</span>
                                    {customer.blacklisted && <span className="rounded-full bg-rose-400/20 px-2.5 py-1 text-xs font-semibold text-rose-100">Restricted</span>}
                                </div>
                                <p className="mt-1 text-sm text-slate-300">{customer.email ?? 'No email'}{customer.phone ? ` · ${customer.phone}` : ''}</p>
                                <p className="mt-1 text-xs text-slate-400">Guest since {displayDate(customer.created_at)}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/10 ring-1 ring-white/10">
                            <Summary value={String(bookings.length)} label="Stays" />
                            <Summary value={customer.loyalty_points.toLocaleString()} label="Points" />
                            <Summary value={money(totalSpent, bookings[0]?.currency ?? 'USD')} label="Paid" />
                        </div>
                    </div>
                </header>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><UserCircleIcon className="size-5" /></span>
                        <div><h2 className="font-semibold text-slate-900">Guest details</h2><p className="text-xs text-slate-500">Contact, identity, and travel information</p></div>
                    </div>
                    <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                        <Detail label="Email" value={customer.email} />
                        <Detail label="Phone" value={customer.phone} />
                        <Detail label="Nationality" value={customer.nationality} />
                        <Detail label="Date of birth" value={displayDate(customer.date_of_birth)} />
                        <Detail label="Gender" value={titleCase(customer.gender)} />
                        <Detail label="Identification" value={[titleCase(customer.id_type), customer.id_number].filter((value) => value !== '—').join(' · ') || '—'} icon={<IdentificationIcon className="size-4" />} />
                        <Detail label="Arrived from" value={customer.arrived_from} />
                        <Detail label="Occupation" value={customer.occupation} />
                        <Detail label="Organization" value={customer.organization} />
                        <Detail label="Purpose of visit" value={titleCase(customer.purpose_of_visit)} />
                        <Detail label="Address" value={addressText || '—'} icon={<MapPinIcon className="size-4" />} />
                    </div>
                    {customer.blacklisted && customer.blacklist_reason && <div className="border-t border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-800 sm:px-6"><strong>Restriction note:</strong> {customer.blacklist_reason}</div>}
                </section>

                <section className="space-y-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div><h2 className="text-xl font-semibold text-slate-900">Booking history</h2><p className="mt-1 text-sm text-slate-500">All stays visible to your current tenant and branch access.</p></div>
                        <span className="text-sm font-medium text-slate-500">{bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}</span>
                    </div>
                    {bookings.length === 0 ? (
                        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                            <span className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><CalendarDaysIcon className="size-6" /></span>
                            <h3 className="mt-3 text-sm font-semibold text-slate-800">No bookings recorded</h3>
                            <p className="mt-1 text-sm text-slate-500">This guest does not have any bookings in the current branch view.</p>
                        </div>
                    ) : bookings.map((booking) => (
                        <article key={booking.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                <div className="flex items-start gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><CalendarDaysIcon className="size-5" /></span>
                                    <div><p className="font-semibold text-slate-900">{booking.booking_ref ?? booking.booking_reference}</p><p className="mt-0.5 text-xs text-slate-500">Created {displayDate(booking.created_at)} · {titleCase(booking.type)}{booking.source ? ` · ${titleCase(booking.source)}` : ''}</p></div>
                                </div>
                                <div className="flex items-center gap-3 sm:justify-end">
                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusClass(booking.status)}`}>{titleCase(booking.status)}</span>
                                    <span className="text-lg font-semibold text-slate-900">{money(booking.total_amount, booking.currency)}</span>
                                </div>
                            </div>

                            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
                                <BookingDetail icon={<BuildingOffice2Icon className="size-4" />} label="Property" value={booking.branch?.name ?? '—'} />
                                <BookingDetail icon={<MapPinIcon className="size-4" />} label="Room" value={booking.rooms.length ? booking.rooms.map((room) => `${room.name || `Room ${room.number}`}${room.floor ? ` · Floor ${room.floor}` : ''}`).join(', ') : booking.unit ? `${booking.unit.name || `Room ${booking.unit.number}`}${booking.unit.floor ? ` · Floor ${booking.unit.floor}` : ''}` : '—'} />
                                <BookingDetail icon={<CalendarDaysIcon className="size-4" />} label="Check-in" value={displayDate(booking.check_in)} />
                                <BookingDetail icon={<CalendarDaysIcon className="size-4" />} label="Check-out" value={displayDate(booking.check_out)} />
                                <BookingDetail icon={<UsersIcon className="size-4" />} label="Guests" value={`${booking.adults} adults${booking.children ? ` · ${booking.children} children` : ''}`} />
                                <BookingDetail icon={<UserCircleIcon className="size-4" />} label="Handled by" value={booking.assigned_staff?.name ?? booking.creator?.name ?? '—'} />
                                <BookingDetail icon={<CreditCardIcon className="size-4" />} label="Paid" value={money(booking.payments.reduce((sum, payment) => sum + Number(payment.amount), 0), booking.currency)} />
                                <BookingDetail icon={<ClockIcon className="size-4" />} label="Nights" value={String(nightCount(booking.check_in, booking.check_out))} />
                            </div>

                            {(booking.folio_items.length > 0 || booking.payments.length > 0 || booking.special_requests) && <div className="grid gap-5 border-t border-slate-100 bg-white px-5 py-5 sm:grid-cols-2 sm:px-6">
                                {booking.folio_items.length > 0 && <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Charges</h3><div className="space-y-2">{booking.folio_items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{item.description}{Number(item.quantity) > 1 ? ` × ${item.quantity}` : ''}</span><span className="shrink-0 font-medium text-slate-800">{money(Number(item.quantity) * Number(item.unit_price) - Number(item.discount), booking.currency)}</span></div>)}</div></div>}
                                {booking.payments.length > 0 && <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payments</h3><div className="space-y-2">{booking.payments.map((payment) => <div key={payment.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"><span className="text-slate-600">{titleCase(payment.method)}{payment.reference ? ` · ${payment.reference}` : ''}<span className="ml-2 text-xs text-slate-400">{displayDate(payment.paid_at)}</span></span><span className="font-medium text-emerald-700">{money(payment.amount, booking.currency)}</span></div>)}</div></div>}
                                {booking.special_requests && <div className="sm:col-span-2"><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Stay notes</h3><p className="whitespace-pre-wrap text-sm text-slate-700">{booking.special_requests}</p></div>}
                            </div>}
                        </article>
                    ))}
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div><h2 className="font-semibold text-slate-900">Notes and tags</h2><p className="mt-1 text-sm text-slate-500">Internal guest preferences and service notes</p></div>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{customer.notes || 'No notes have been added.'}</p>
                        <div className="flex flex-wrap gap-2">{(customer.tags ?? []).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{tag}</span>)}</div>
                    </section>
                    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div><h2 className="font-semibold text-slate-900">ID documents</h2><p className="mt-1 text-sm text-slate-500">Documents are stored privately with this customer record.</p></div>
                        {(customer.documents ?? []).length === 0 ? <p className="text-sm text-slate-500">No documents uploaded.</p> : <div className="space-y-2">{(customer.documents ?? []).map((doc) => <div key={doc.path} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><PaperClipIcon className="size-4 shrink-0 text-slate-400" /><span className="min-w-0 flex-1 truncate font-medium text-slate-700">{doc.label}</span><span className="text-xs text-slate-400">{doc.uploaded_at ? displayDate(doc.uploaded_at) : doc.path}</span></div>)}</div>}
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <Input value={label} onChange={(event) => setLabel(event.target.value)} aria-label="Document label" placeholder="Document label" />
                            <Input type="file" accept="image/*" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} aria-label="Choose ID document" />
                            <Button onClick={upload} disabled={!document} className="bg-indigo-700 hover:bg-indigo-800">Upload</Button>
                        </div>
                    </section>
                </div>

                {duplicates.length > 0 && <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-5"><div><h2 className="font-semibold text-slate-900">Possible duplicate records</h2><p className="mt-1 text-sm text-slate-600">Review matching profiles before merging guest history.</p></div><div className="flex flex-col gap-2 sm:flex-row"><select className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Select a duplicate</option>{duplicates.map((duplicate) => <option key={duplicate.id} value={duplicate.id}>{duplicate.name} · {duplicate.email ?? duplicate.phone}</option>)}</select><Button variant="outline" onClick={merge} disabled={!sourceId}>Merge into this profile</Button></div></section>}
            </main>
        </>
    );
}

function Summary({ value, label }: { value: string; label: string }) {
    return <div className="min-w-0 px-4 py-3 text-center sm:px-5"><p className="truncate text-lg font-semibold">{value}</p><p className="mt-1 text-[11px] text-slate-300">{label}</p></div>;
}

function Detail({ label, value, icon }: { label: string; value: string | null; icon?: React.ReactNode }) {
    return <div className="min-w-0"><p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">{icon}{label}</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{value || '—'}</p></div>;
}

function BookingDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return <div className="min-w-0"><p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">{icon}{label}</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{value}</p></div>;
}

CustomerProfile.layout = { breadcrumbs: [{ title: 'Customers', href: '/customers' }, { title: 'Profile', href: '#' }] };
