import { Head, router, usePage } from '@inertiajs/react';
import { ClipboardList, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type Branch = { id: number; name: string };
type Unit = { id: number; number: string; branch_id: number };
type Employee = { id: number; name: string; branch_id: number };
type Task = {
    id: number;
    assigned_to: number | null;
    branch_id: number;
    title: string;
    description: string | null;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'pending' | 'in_progress' | 'done' | 'skipped';
    due_at: string | null;
    unit?: { number: string } | null;
    employee?: { name: string } | null;
    branch?: { name: string } | null;
};
type Props = {
    tasks: Task[];
    branches: Branch[];
    units: Unit[];
    employees: Employee[];
    canManageAllBranches: boolean;
    canManageTasks: boolean;
    currentUserId: number;
};

const priorities: Task['priority'][] = ['low', 'medium', 'high', 'urgent'];
const statuses: Task['status'][] = ['pending', 'in_progress', 'done', 'skipped'];

export default function Tasks({ tasks, branches, units, employees, canManageAllBranches, canManageTasks, currentUserId }: Props) {
    const page = usePage();
    const pageProps = page.props as typeof page.props & {
        errors?: Record<string, string>;
        flash?: { status?: string };
    };
    const errors = pageProps.errors ?? {};
    const [branchFilter, setBranchFilter] = useState(canManageAllBranches ? 'all' : String(branches[0]?.id ?? ''));
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({
        branch_id: String(branches[0]?.id ?? ''),
        assigned_to: '',
        unit_id: '',
        title: '',
        description: '',
        priority: 'medium',
        due_at: '',
    });
    const branchUnits = useMemo(() => units.filter((unit) => String(unit.branch_id) === form.branch_id), [units, form.branch_id]);
    const branchEmployees = useMemo(() => employees.filter((employee) => String(employee.branch_id) === form.branch_id), [employees, form.branch_id]);
    const visibleTasks = useMemo(() => tasks.filter((task) => (
        branchFilter === 'all' || String(task.branch_id) === branchFilter
    )).filter((task) => task.title.toLowerCase().includes(search.trim().toLowerCase())), [tasks, branchFilter, search]);

    const changeFormBranch = (branchId: string) => {
        setForm((current) => ({ ...current, branch_id: branchId, assigned_to: '', unit_id: '' }));
    };

    const createTask = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.post('/tasks', form, {
            preserveScroll: true,
            onSuccess: () => setForm((current) => ({
                ...current,
                assigned_to: '',
                unit_id: '',
                title: '',
                description: '',
                due_at: '',
                priority: 'medium',
            })),
        });
    };

    const updateTask = (task: Task, changes: { status?: Task['status']; priority?: Task['priority'] }) => {
        router.put(`/tasks/${task.id}`, changes, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Task management" />
            <main className="space-y-6 p-4 sm:p-6">
                <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><ClipboardList className="size-5" /></span>
                        <div>
                            <h1 className="text-2xl font-semibold">Task management</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                {canManageAllBranches ? 'Create and manage operational tasks across all branches.' : canManageTasks ? 'Create and manage tasks for your assigned branch.' : 'Your assigned tasks and unassigned tasks in your branch.'}
                            </p>
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}</div>
                </header>

                {pageProps.flash?.status && (
                    <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{pageProps.flash.status}</p>
                )}

                {canManageTasks && <section className="rounded-2xl border bg-card p-5 shadow-sm">
                    <div className="mb-4">
                        <h2 className="font-semibold">Create a task</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Assign an operational task to a branch, unit, and staff member.</p>
                    </div>
                    <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={createTask}>
                        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                            Task title
                            <input required maxLength={255} className="h-10 rounded-lg border bg-background px-3 font-normal" placeholder="e.g. Prepare conference room" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                            {errors.title && <span role="alert" className="text-xs text-destructive">{errors.title}</span>}
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                            Branch
                            <select required className="h-10 rounded-lg border bg-background px-3 font-normal" value={form.branch_id} onChange={(event) => changeFormBranch(event.target.value)}>
                                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                            </select>
                            {errors.branch_id && <span role="alert" className="text-xs text-destructive">{errors.branch_id}</span>}
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                            Priority
                            <select className="h-10 rounded-lg border bg-background px-3 font-normal" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                            </select>
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                            Assign to
                            <select className="h-10 rounded-lg border bg-background px-3 font-normal" value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}>
                                <option value="">Unassigned</option>
                                {branchEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                            </select>
                            {errors.assigned_to && <span role="alert" className="text-xs text-destructive">{errors.assigned_to}</span>}
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                            Unit <span className="font-normal text-muted-foreground">(optional)</span>
                            <select className="h-10 rounded-lg border bg-background px-3 font-normal" value={form.unit_id} onChange={(event) => setForm({ ...form, unit_id: event.target.value })}>
                                <option value="">No unit</option>
                                {branchUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.number}</option>)}
                            </select>
                            {errors.unit_id && <span role="alert" className="text-xs text-destructive">{errors.unit_id}</span>}
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium">
                            Due date <span className="font-normal text-muted-foreground">(optional)</span>
                            <input type="datetime-local" className="h-10 rounded-lg border bg-background px-3 font-normal" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
                            {errors.due_at && <span role="alert" className="text-xs text-destructive">{errors.due_at}</span>}
                        </label>
                        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2 xl:col-span-3">
                            Description <span className="font-normal text-muted-foreground">(optional)</span>
                            <textarea maxLength={2000} className="min-h-10 rounded-lg border bg-background px-3 py-2 font-normal" placeholder="Add instructions or context" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                            {errors.description && <span role="alert" className="text-xs text-destructive">{errors.description}</span>}
                        </label>
                        <div className="flex items-end justify-end">
                            <Button type="submit" disabled={!branches.length}>Create task</Button>
                        </div>
                    </form>
                    {!branches.length && <p className="mt-3 text-sm text-muted-foreground">No branch is assigned to your account.</p>}
                </section>}

                <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-semibold">Operational tasks</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Update priority and status as work progresses.</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {canManageAllBranches && (
                                <select aria-label="Filter tasks by branch" className="h-10 rounded-lg border bg-background px-3 text-sm" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
                                    <option value="all">All branches</option>
                                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                                </select>
                            )}
                            <label className="flex h-10 items-center gap-2 rounded-lg border px-3 text-muted-foreground">
                                <Search className="size-4" />
                                <input aria-label="Search tasks" className="w-full bg-transparent text-sm text-foreground outline-none sm:w-40" placeholder="Search tasks" value={search} onChange={(event) => setSearch(event.target.value)} />
                            </label>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                <tr><th className="px-5 py-3">Task</th><th className="px-4 py-3">Branch / unit</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Priority</th><th className="px-5 py-3">Status</th></tr>
                            </thead>
                            <tbody className="divide-y">
                                {visibleTasks.map((task) => (
                                    <tr className="transition hover:bg-muted/30" key={task.id}>
                                        <td className="max-w-md px-5 py-4">
                                            <div className="font-medium">{task.title}</div>
                                            {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
                                            {task.due_at && <p className="mt-1 text-xs text-muted-foreground">Due {new Date(task.due_at).toLocaleString()}</p>}
                                        </td>
                                        <td className="px-4 py-4"><div>{task.branch?.name ?? branches.find((branch) => branch.id === task.branch_id)?.name ?? '—'}</div><div className="mt-0.5 text-xs text-muted-foreground">{task.unit?.number ?? 'No unit'}</div></td>
                                        <td className="px-4 py-4 text-muted-foreground">{task.employee?.name ?? 'Unassigned'}</td>
                                        <td className="px-4 py-4">
                                            {canManageTasks ? (
                                            <select aria-label={`Priority for ${task.title}`} className="h-9 rounded-lg border bg-background px-2 capitalize" value={task.priority} onChange={(event) => updateTask(task, { priority: event.target.value as Task['priority'] })}>
                                                {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                                            </select>
                                            ) : <span className="capitalize">{task.priority}</span>}
                                        </td>
                                        <td className="px-5 py-4">
                                            {canManageTasks || task.assigned_to === currentUserId ? (
                                                <select aria-label={`Status for ${task.title}`} className="h-9 rounded-lg border bg-background px-2" value={task.status} onChange={(event) => updateTask(task, { status: event.target.value as Task['status'] })}>
                                                    {statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                                                </select>
                                            ) : <span className="capitalize">{task.status.replace('_', ' ')}</span>}
                                        </td>
                                    </tr>
                                ))}
                                {!visibleTasks.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">No tasks found for this branch.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </>
    );
}

Tasks.layout = { breadcrumbs: [{ title: 'Task management', href: '/tasks' }] };
