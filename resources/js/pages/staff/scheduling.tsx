import { Head, router, usePage } from '@inertiajs/react';
import { CalendarDays, Clock3, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type Employee = {
    id: number;
    name: string;
    department: string | null;
    designation: string | null;
    branch_id: number;
};
type Branch = { id: number; name: string };
type Shift = {
    id: number;
    employee_id: number;
    branch_id: number;
    shift_date: string;
    starts_at: string;
    ends_at: string;
    break_minutes: number;
    employee?: { name: string };
    branch?: { name: string };
};
type Props = {
    week: string;
    branches: Branch[];
    employees: Employee[];
    shifts: Shift[];
};

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hours = (shift: Shift) => Math.max(
    0,
    (new Date(`2000-01-01T${shift.ends_at}`).getTime() - new Date(`2000-01-01T${shift.starts_at}`).getTime()) / 3600000 - shift.break_minutes / 60,
);

export default function Scheduling({ week, branches, employees, shifts }: Props) {
    const page = usePage();
    const pageProps = page.props as typeof page.props & {
        errors?: Record<string, string>;
        flash?: { status?: string };
    };
    const errors = pageProps.errors ?? {};
    const [dragged, setDragged] = useState<Shift | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({
        branch_id: String(branches[0]?.id ?? ''),
        employee_id: String(employees[0]?.id ?? ''),
        shift_date: week,
        starts_at: '09:00',
        ends_at: '17:00',
        break_minutes: '0',
        notes: '',
    });
    const branchEmployees = useMemo(
        () => employees.filter((employee) => String(employee.branch_id) === form.branch_id),
        [employees, form.branch_id],
    );
    const totals = useMemo(
        () => shifts.reduce<Record<number, number>>((result, shift) => {
            result[shift.employee_id] = (result[shift.employee_id] ?? 0) + hours(shift);
            return result;
        }, {}),
        [shifts],
    );

    useEffect(() => {
        if (!branchEmployees.some((employee) => String(employee.id) === form.employee_id)) {
            setForm((current) => ({ ...current, employee_id: String(branchEmployees[0]?.id ?? '') }));
        }
    }, [branchEmployees, form.employee_id]);

    const dateFor = (index: number) => new Date(
        Date.parse(`${week}T00:00:00Z`) + index * 86400000,
    ).toISOString().slice(0, 10);
    const moveShift = (shift: Shift, index: number) => {
        router.put(`/staff/shifts/${shift.id}`, {
            branch_id: shift.branch_id,
            shift_date: dateFor(index),
            starts_at: shift.starts_at.slice(0, 5),
            ends_at: shift.ends_at.slice(0, 5),
        }, { preserveScroll: true });
    };
    const submitSchedule = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        router.post('/staff/shifts', form, {
            preserveScroll: true,
            onSuccess: () => setIsCreateOpen(false),
            onFinish: () => setIsSubmitting(false),
        });
    };

    return (
        <>
            <Head title="Staff scheduling" />
            <div className="space-y-5 p-4 sm:p-6">
                <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                            <CalendarDays className="size-4" /> Weekly planner
                        </div>
                        <h1 className="mt-1 text-2xl font-semibold">Staff scheduling</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Plan shifts, track weekly hours, and move a shift to another day by dragging it.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <a href={`/staff/shifts/report?week=${week}`}>
                            <Button type="button" variant="outline">Export report</Button>
                        </a>
                        <Button
                            type="button"
                            onClick={() => setIsCreateOpen(true)}
                            disabled={!branches.length || !employees.length}
                        >
                            <Plus className="mr-2 size-4" /> Add schedule
                        </Button>
                    </div>
                </header>

                {pageProps.flash?.status && (
                    <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {pageProps.flash.status}
                    </p>
                )}

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Add a staff schedule</DialogTitle>
                            <DialogDescription>
                                Choose a branch and an active staff member, then set their shift hours.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitSchedule} className="grid gap-4 sm:grid-cols-2">
                            <label className="grid gap-1.5 text-sm font-medium">
                                Branch
                                <select
                                    required
                                    className="h-10 rounded-lg border bg-background px-3 font-normal"
                                    value={form.branch_id}
                                    onChange={(event) => setForm((current) => ({
                                        ...current,
                                        branch_id: event.target.value,
                                        employee_id: String(employees.find((employee) => String(employee.branch_id) === event.target.value)?.id ?? ''),
                                    }))}
                                >
                                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                                </select>
                                {errors.branch_id && <span role="alert" className="text-xs text-destructive">{errors.branch_id}</span>}
                            </label>
                            <label className="grid gap-1.5 text-sm font-medium">
                                Staff member
                                <select
                                    required
                                    className="h-10 rounded-lg border bg-background px-3 font-normal"
                                    value={form.employee_id}
                                    onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))}
                                    disabled={!branchEmployees.length}
                                >
                                    {branchEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                                </select>
                                {errors.employee_id && <span role="alert" className="text-xs text-destructive">{errors.employee_id}</span>}
                            </label>
                            <label className="grid gap-1.5 text-sm font-medium">
                                Shift date
                                <input type="date" required className="h-10 rounded-lg border bg-background px-3 font-normal" value={form.shift_date} onChange={(event) => setForm((current) => ({ ...current, shift_date: event.target.value }))} />
                                {errors.shift_date && <span role="alert" className="text-xs text-destructive">{errors.shift_date}</span>}
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="grid gap-1.5 text-sm font-medium">
                                    Starts
                                    <input type="time" required className="h-10 rounded-lg border bg-background px-3 font-normal" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} />
                                    {errors.starts_at && <span role="alert" className="text-xs text-destructive">{errors.starts_at}</span>}
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium">
                                    Ends
                                    <input type="time" required className="h-10 rounded-lg border bg-background px-3 font-normal" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} />
                                    {errors.ends_at && <span role="alert" className="text-xs text-destructive">{errors.ends_at}</span>}
                                </label>
                            </div>
                            <label className="grid gap-1.5 text-sm font-medium">
                                Break (minutes)
                                <input type="number" min="0" className="h-10 rounded-lg border bg-background px-3 font-normal" value={form.break_minutes} onChange={(event) => setForm((current) => ({ ...current, break_minutes: event.target.value }))} />
                                {errors.break_minutes && <span role="alert" className="text-xs text-destructive">{errors.break_minutes}</span>}
                            </label>
                            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                                Notes <span className="font-normal text-muted-foreground">(optional)</span>
                                <textarea className="min-h-20 rounded-lg border bg-background px-3 py-2 font-normal" maxLength={1000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                                {errors.notes && <span role="alert" className="text-xs text-destructive">{errors.notes}</span>}
                            </label>
                            {!branchEmployees.length && (
                                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground sm:col-span-2">
                                    No active staff are assigned to this branch. Assign staff to the branch before scheduling.
                                </p>
                            )}
                            <div className="flex justify-end gap-2 sm:col-span-2">
                                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting || !branchEmployees.length}>
                                    <Clock3 className="mr-2 size-4" />
                                    {isSubmitting ? 'Saving schedule…' : 'Save schedule'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <div className="grid gap-4 md:grid-cols-2">
                    {employees.map((employee) => {
                        const employeeHours = totals[employee.id] ?? 0;

                        return (
                            <section key={employee.id} className="rounded-2xl border bg-card p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="font-semibold">{employee.name}</h2>
                                        <p className="text-xs text-muted-foreground">{employee.designation ?? employee.department ?? 'Staff'}</p>
                                    </div>
                                    <span className={employeeHours > 40 ? 'rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700' : 'rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground'}>
                                        {employeeHours.toFixed(1)}h{employeeHours > 40 ? ' · Overtime' : ''}
                                    </span>
                                </div>
                                <div className="mt-3 grid grid-cols-7 gap-1">
                                    {days.map((label, index) => {
                                        const date = dateFor(index);
                                        const dayShifts = shifts.filter((shift) => shift.employee_id === employee.id && shift.shift_date.slice(0, 10) === date);

                                        return (
                                            <div key={date} onDragOver={(event) => event.preventDefault()} onDrop={() => dragged && moveShift(dragged, index)} className="min-h-24 rounded-lg bg-muted/50 p-1">
                                                <div className="mb-1 text-center text-[10px] font-medium text-muted-foreground">{label}<br />{date.slice(8)}</div>
                                                {dayShifts.map((shift) => (
                                                    <div key={shift.id} draggable onDragStart={() => setDragged(shift)} onDragEnd={() => setDragged(null)} className="mb-1 cursor-grab rounded-md bg-amber-200 p-1.5 text-[10px] text-amber-950 shadow-sm active:cursor-grabbing">
                                                        <div className="font-semibold">{shift.starts_at.slice(0, 5)}–{shift.ends_at.slice(0, 5)}</div>
                                                        <div className="truncate">{shift.branch?.name}</div>
                                                        {dayShifts.length > 1 && <div className="font-bold text-red-700">Conflict</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
                {!employees.length && (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                        <h2 className="font-semibold">No active staff available</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Add or activate staff and assign them to this branch to create a schedule.</p>
                    </div>
                )}
            </div>
        </>
    );
}

Scheduling.layout = { breadcrumbs: [{ title: 'Staff scheduling', href: '/staff/scheduling' }] };
