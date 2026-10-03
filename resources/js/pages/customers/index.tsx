import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    CalendarDaysIcon,
    CheckCircleIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    UserPlusIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Customer = {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    vip_level: string;
    loyalty_points: number;
    blacklisted: boolean;
    created_at: string;
    latest_booking: { check_in: string; branch_name: string | null } | null;
};
type Branch = { id: number; name: string; currency: string };
type Unit = {
    id: number;
    branch_id: number;
    number: string;
    name: string | null;
    capacity: number;
    child_capacity: number;
    base_price: string;
    price_weekend: string | null;
};
type Props = {
    customers: {
        data: Customer[];
        total: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    search: string;
    branches: Branch[];
    units: Unit[];
    branchRestricted: boolean;
};
type WalkInForm = {
    name: string;
    email: string;
    phone: string;
    nationality: string;
    date_of_birth: string;
    gender: string;
    id_type: string;
    id_number: string;
    arrived_from: string;
    occupation: string;
    organization: string;
    purpose_of_visit: string;
    address_line: string;
    branch_id: string;
    unit_id: string;
    check_in: string;
    check_out: string;
    adults: string;
    children: string;
    status: 'confirmed' | 'checked_in';
    payment_amount: string;
    payment_method: 'cash' | 'card' | 'bank_transfer' | 'mobile_money';
    payment_reference: string;
    special_requests: string;
};

function localDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDaysToDate(value: string, days: number): string {
    if (!value) return '';
    const date = new Date(`${value.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + days);
    return localDate(date);
}

function defaultForm(branchId: number | undefined, unitId?: number): WalkInForm {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
        name: '',
        email: '',
        phone: '',
        nationality: '',
        date_of_birth: '',
        gender: '',
        id_type: '',
        id_number: '',
        arrived_from: '',
        occupation: '',
        organization: '',
        purpose_of_visit: '',
        address_line: '',
        branch_id: branchId ? String(branchId) : '',
        unit_id: unitId ? String(unitId) : '',
        check_in: localDate(today),
        check_out: localDate(tomorrow),
        adults: '1',
        children: '0',
        status: 'confirmed',
        payment_amount: '0',
        payment_method: 'cash',
        payment_reference: '',
        special_requests: '',
    };
}

export default function Customers({ customers, search, branches, units, branchRestricted }: Props) {
    const page = usePage();
    const status = (page.props as typeof page.props & { flash?: { status?: string } }).flash?.status;
    const [query, setQuery] = useState(search);
    const [isPosOpen, setIsPosOpen] = useState(false);
    const initialBranchId = branches[0]?.id;
    const makeEmptyForm = () => defaultForm(initialBranchId, units.find((unit) => unit.branch_id === initialBranchId)?.id);
    const bookingForm = useForm<WalkInForm>(makeEmptyForm());
    const selectedBranchUnits = useMemo(
        () => units.filter((unit) => String(unit.branch_id) === bookingForm.data.branch_id),
        [units, bookingForm.data.branch_id],
    );
    const selectedUnit = selectedBranchUnits.find((unit) => String(unit.id) === bookingForm.data.unit_id);
    const isPaymentEntered = Number(bookingForm.data.payment_amount) > 0;

    const searchCustomers = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.get('/customers', { search: query }, { preserveState: true, preserveScroll: true });
    };

    const openPos = () => {
        const start = makeEmptyForm();
        bookingForm.setData(start);
        bookingForm.clearErrors();
        setIsPosOpen(true);
    };

    const submitWalkIn = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        bookingForm.post('/customers/walk-in-booking', {
            preserveScroll: true,
            onSuccess: () => {
                setIsPosOpen(false);
                const reset = makeEmptyForm();
                bookingForm.setData(reset);
                bookingForm.clearErrors();
            },
        });
    };

    const updateField = <K extends keyof WalkInForm>(key: K, value: WalkInForm[K]) => {
        bookingForm.setData((current) => ({ ...current, [key]: value }));
    };

    const updateCheckIn = (checkIn: string) => {
        bookingForm.setData((current) => ({
            ...current,
            check_in: checkIn,
            check_out: addDaysToDate(checkIn, 1),
        }));
    };

    return (
        <>
            <Head title="Customers" />
            <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
                <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg sm:p-8">
                    <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full border-[38px] border-white/5" />
                    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                                <UsersIcon className="size-6" />
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Guest relations</p>
                            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Customers</h1>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Guest profiles and stays for your workspace{branchRestricted && branches[0] ? ` · ${branches[0].name}` : ''}.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
                                <p className="text-2xl font-semibold">{customers.total}</p>
                                <p className="text-xs text-slate-300">matching guests</p>
                            </div>
                            <Button onClick={openPos} disabled={branches.length === 0 || units.length === 0} className="h-12 rounded-xl bg-white px-5 text-slate-900 shadow-sm hover:bg-indigo-50">
                                <PlusIcon className="mr-2 size-5" />New walk-in booking
                            </Button>
                        </div>
                    </div>
                </header>

                {status && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircleIcon className="size-5 shrink-0" />{status}</div>}

                {branches.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No branch is assigned to your account yet. Ask your tenant administrator to assign one before creating walk-in bookings.</div>}
                {branches.length > 0 && units.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">There are no available rooms in this branch. Update room availability before taking a walk-in booking.</div>}

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Guest directory</h2>
                            <p className="mt-1 text-sm text-slate-500">Newest guest profiles appear first.</p>
                        </div>
                        <form onSubmit={searchCustomers} className="flex w-full gap-2 sm:max-w-md">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or phone" className="h-10 rounded-xl border-slate-200 pl-9" />
                            </div>
                            <Button type="submit" variant="outline" className="rounded-xl">Search</Button>
                        </form>
                    </div>

                    {customers.data.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-16 text-center">
                            <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><UserPlusIcon className="size-7" /></span>
                            <h3 className="mt-4 text-sm font-semibold text-slate-900">{search ? 'No guests match your search' : 'No guests yet'}</h3>
                            <p className="mt-1 max-w-sm text-sm text-slate-500">{search ? 'Try a different name, email, or phone number.' : 'Create a walk-in booking to add your first guest to this branch.'}</p>
                            {!search && branches.length > 0 && units.length > 0 && <Button onClick={openPos} className="mt-5 rounded-xl bg-indigo-700 hover:bg-indigo-800"><PlusIcon className="mr-2 size-4" />Create walk-in booking</Button>}
                        </div>
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                        <tr><th className="px-6 py-3 font-semibold">Guest</th><th className="px-6 py-3 font-semibold">Contact</th><th className="px-6 py-3 font-semibold">Latest stay</th><th className="px-6 py-3 text-right font-semibold">Loyalty</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {customers.data.map((customer) => (
                                            <tr key={customer.id} className="transition-colors hover:bg-slate-50/70">
                                                <td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">{customer.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><Link className="font-semibold text-slate-900 hover:text-indigo-700 hover:underline" href={`/customers/${customer.id}`}>{customer.name}</Link><div className="mt-0.5 flex items-center gap-2"><span className="text-xs capitalize text-slate-500">{customer.vip_level} guest</span>{customer.blacklisted && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Restricted</span>}</div></div></div></td>
                                                <td className="px-6 py-4 text-slate-600">{customer.email && <div>{customer.email}</div>}{customer.phone && <div className="mt-0.5 text-xs text-slate-500">{customer.phone}</div>}{!customer.email && !customer.phone && '—'}</td>
                                                <td className="px-6 py-4">{customer.latest_booking ? <><div className="font-medium text-slate-700">{customer.latest_booking.branch_name ?? 'Branch stay'}</div><div className="mt-0.5 text-xs text-slate-500">Check-in {new Date(`${customer.latest_booking.check_in}T00:00:00`).toLocaleDateString()}</div></> : <span className="text-slate-400">No booking yet</span>}</td>
                                                <td className="px-6 py-4 text-right"><span className="font-semibold text-slate-800">{customer.loyalty_points.toLocaleString()}</span><span className="ml-1 text-xs text-slate-400">pts</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="divide-y divide-slate-100 md:hidden">
                                {customers.data.map((customer) => <Link key={customer.id} href={`/customers/${customer.id}`} className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-800">{customer.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{customer.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{customer.phone ?? customer.email ?? 'No contact details'}</span><span className="mt-1 block text-xs text-slate-400">{customer.latest_booking?.branch_name ?? 'No booking yet'}</span></span><ChevronRightIcon className="size-4 shrink-0 text-slate-400" /></Link>)}
                            </div>
                        </>
                    )}

                    {customers.links.length > 3 && <nav aria-label="Customer pages" className="flex items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-6"><p className="text-xs text-slate-500">Page navigation</p><div className="flex gap-2">{customers.links.map((link, index) => <button key={`${link.label}-${index}`} type="button" disabled={!link.url} aria-current={link.active ? 'page' : undefined} className={`inline-flex size-9 items-center justify-center rounded-lg border text-sm disabled:opacity-40 ${link.active ? 'border-indigo-700 bg-indigo-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`} onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })} aria-label={index === 0 ? 'Previous page' : index === customers.links.length - 1 ? 'Next page' : `Page ${link.label}`}>
                                    {index === 0 ? <ChevronLeftIcon className="size-4" /> : index === customers.links.length - 1 ? <ChevronRightIcon className="size-4" /> : <span dangerouslySetInnerHTML={{ __html: link.label }} />}
                                </button>)}</div></nav>}
                </section>
            </main>

            <Dialog open={isPosOpen} onOpenChange={setIsPosOpen}>
                <DialogContent className="max-h-[94dvh] overflow-y-auto rounded-2xl border-slate-200 p-0 sm:max-w-3xl">
                    <DialogHeader className="border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/70 px-6 py-5 pr-12">
                        <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><CalendarDaysIcon className="size-5" /></div>
                        <DialogTitle className="text-xl">New walk-in booking</DialogTitle>
                        <DialogDescription>Register the guest, assign a room, and take a payment at the front desk.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={submitWalkIn} className="space-y-6 px-6 py-5">
                        {Object.keys(bookingForm.errors).length > 0 && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Please review the highlighted fields and try again.</div>}

                        <section className="space-y-4">
                            <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">01 · Guest</p><h3 className="mt-1 font-semibold text-slate-900">Who is checking in?</h3></div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Full name" error={bookingForm.errors.name}><Input required autoFocus value={bookingForm.data.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Guest name" /></Field>
                                <Field label="Phone number" error={bookingForm.errors.phone}><Input required type="tel" value={bookingForm.data.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="+1 555 123 4567" /></Field>
                                <Field label="Email address" error={bookingForm.errors.email}><Input type="email" value={bookingForm.data.email} onChange={(event) => updateField('email', event.target.value)} placeholder="guest@example.com" /></Field>
                                <Field label="Nationality" error={bookingForm.errors.nationality}><Input value={bookingForm.data.nationality} onChange={(event) => updateField('nationality', event.target.value)} placeholder="Optional" /></Field>
                            </div>
                            <details className="group rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                <summary className="cursor-pointer text-sm font-semibold text-slate-700 marker:text-indigo-600">Additional guest details <span className="font-normal text-slate-400">(optional)</span></summary>
                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                    <Field label="Date of birth" error={bookingForm.errors.date_of_birth}><Input type="date" max={localDate(new Date())} value={bookingForm.data.date_of_birth} onChange={(event) => updateField('date_of_birth', event.target.value)} /></Field>
                                    <Field label="Gender" error={bookingForm.errors.gender}><select value={bookingForm.data.gender} onChange={(event) => updateField('gender', event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
                                    <Field label="Identification type" error={bookingForm.errors.id_type}><select value={bookingForm.data.id_type} onChange={(event) => updateField('id_type', event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select ID type</option><option value="passport">Passport</option><option value="nid">National ID</option><option value="driving_license">Driving licence</option></select></Field>
                                    <Field label="Identification number" error={bookingForm.errors.id_number}><Input value={bookingForm.data.id_number} onChange={(event) => updateField('id_number', event.target.value)} placeholder="Optional" /></Field>
                                    <Field label="Arrived from" error={bookingForm.errors.arrived_from}><Input value={bookingForm.data.arrived_from} onChange={(event) => updateField('arrived_from', event.target.value)} placeholder="City or country" /></Field>
                                    <Field label="Occupation" error={bookingForm.errors.occupation}><Input value={bookingForm.data.occupation} onChange={(event) => updateField('occupation', event.target.value)} placeholder="Optional" /></Field>
                                    <Field label="Organization" error={bookingForm.errors.organization}><Input value={bookingForm.data.organization} onChange={(event) => updateField('organization', event.target.value)} placeholder="Company or organization" /></Field>
                                    <Field label="Purpose of visit" error={bookingForm.errors.purpose_of_visit}><select value={bookingForm.data.purpose_of_visit} onChange={(event) => updateField('purpose_of_visit', event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select purpose</option><option value="tourist">Tourism</option><option value="business">Business</option><option value="official">Official</option><option value="others">Other</option></select></Field>
                                    <Field label="Address" error={bookingForm.errors.address_line}><textarea value={bookingForm.data.address_line} onChange={(event) => updateField('address_line', event.target.value)} rows={2} maxLength={2000} placeholder="Guest mailing address" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2" /></Field>
                                </div>
                            </details>
                        </section>

                        <section className="space-y-4 border-t border-slate-100 pt-5">
                            <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">02 · Stay</p><h3 className="mt-1 font-semibold text-slate-900">Room and dates</h3></div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Branch" error={bookingForm.errors.branch_id}>
                                    <select required value={bookingForm.data.branch_id} disabled={branchRestricted || branches.length === 1} onChange={(event) => { const branchId = event.target.value; updateField('branch_id', branchId); updateField('unit_id', String(units.find((unit) => String(unit.branch_id) === branchId)?.id ?? '')); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70">
                                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Room" error={bookingForm.errors.unit_id}>
                                    <select required value={bookingForm.data.unit_id} onChange={(event) => updateField('unit_id', event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                                        <option value="">Select an available room</option>
                                        {selectedBranchUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name || `Room ${unit.number}`} · {unit.capacity} adults · {Number(unit.base_price).toFixed(2)} / night</option>)}
                                    </select>
                                    {selectedUnit && <p className="mt-1 text-xs text-slate-500">Capacity: {selectedUnit.capacity} adults · {selectedUnit.child_capacity} children</p>}
                                </Field>
                                <Field label="Check-in" error={bookingForm.errors.check_in}><Input type="date" required min={localDate(new Date())} value={bookingForm.data.check_in} onChange={(event) => updateCheckIn(event.target.value)} /></Field>
                                <Field label="Check-out" error={bookingForm.errors.check_out}><Input type="date" required min={addDaysToDate(bookingForm.data.check_in, 1)} value={bookingForm.data.check_out} onChange={(event) => updateField('check_out', event.target.value)} /></Field>
                                <Field label="Adults" error={bookingForm.errors.adults}><Input type="number" required min="1" max={selectedUnit?.capacity ?? undefined} value={bookingForm.data.adults} onChange={(event) => updateField('adults', event.target.value)} /></Field>
                                <Field label="Children" error={bookingForm.errors.children}><Input type="number" min="0" max={selectedUnit?.child_capacity ?? undefined} value={bookingForm.data.children} onChange={(event) => updateField('children', event.target.value)} /></Field>
                            </div>
                            <Field label="Front desk note" error={bookingForm.errors.special_requests}><textarea value={bookingForm.data.special_requests} onChange={(event) => updateField('special_requests', event.target.value)} rows={2} maxLength={2000} placeholder="Arrival notes or guest requests" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></Field>
                            {selectedUnit && <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="inline-flex items-center gap-2 text-slate-600"><ClockIcon className="size-4" />Estimated room rate</span><span className="font-semibold text-slate-900">{selectedUnit.base_price} {branches.find((branch) => String(branch.id) === bookingForm.data.branch_id)?.currency ?? ''} / night</span></div>}
                        </section>

                        <section className="space-y-4 border-t border-slate-100 pt-5">
                            <div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">03 · Checkout</p><h3 className="mt-1 font-semibold text-slate-900">Confirm stay and payment</h3></div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Booking status" error={bookingForm.errors.status}><select value={bookingForm.data.status} onChange={(event) => updateField('status', event.target.value as WalkInForm['status'])} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="confirmed">Confirmed · arriving later</option><option value="checked_in">Checked in · arriving today</option></select></Field>
                                <Field label="Payment received" error={bookingForm.errors.payment_amount}><Input type="number" min="0" step="0.01" value={bookingForm.data.payment_amount} onChange={(event) => updateField('payment_amount', event.target.value)} placeholder="0.00" /></Field>
                                {isPaymentEntered && <><Field label="Payment method" error={bookingForm.errors.payment_method}><select value={bookingForm.data.payment_method} onChange={(event) => updateField('payment_method', event.target.value as WalkInForm['payment_method'])} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="mobile_money">Mobile money</option></select></Field><Field label="Payment reference" error={bookingForm.errors.payment_reference}><Input value={bookingForm.data.payment_reference} onChange={(event) => updateField('payment_reference', event.target.value)} placeholder="Optional receipt / transaction ID" /></Field></>}
                            </div>
                        </section>

                        <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                            <Button type="button" variant="outline" onClick={() => setIsPosOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={bookingForm.processing || !selectedUnit} className="rounded-xl bg-indigo-700 px-5 hover:bg-indigo-800">{bookingForm.processing ? 'Creating booking…' : 'Create booking'}</Button>
                        </footer>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return <div className="space-y-1.5"><Label className="text-xs font-medium text-slate-600">{label}</Label>{children}{error && <p role="alert" className="text-xs text-red-600">{error}</p>}</div>;
}

Customers.layout = { breadcrumbs: [{ title: 'Customers', href: '/customers' }] };
