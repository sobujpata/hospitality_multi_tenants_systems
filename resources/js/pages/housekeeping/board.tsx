import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Task = { id: number; title: string; priority: string; status: string; stage: string; unit?: { number: string; name: string }; employee?: { name: string } };
type Props = { tasks: Task[] };
const stages = [{ key: 'to_clean', label: 'To Clean' }, { key: 'cleaning', label: 'Cleaning' }, { key: 'inspection', label: 'Inspection' }, { key: 'clean', label: 'Clean' }];

export default function HousekeepingBoard({ tasks }: Props) {
    const [dragged, setDragged] = useState<Task | null>(null);
    return <><Head title="Housekeeping board" /><div className="space-y-5 p-4 sm:p-6"><div><h1 className="text-2xl font-semibold">Housekeeping board</h1><p className="text-sm text-muted-foreground">Update room progress from any phone. Checked-out rooms are added automatically.</p></div><div className="grid gap-3 md:grid-cols-4">{stages.map((stage) => <section key={stage.key} onDragOver={(event) => event.preventDefault()} onDrop={() => dragged && router.put(`/tasks/${dragged.id}`, { stage: stage.key, status: stage.key === 'clean' ? 'done' : 'in_progress' }, { preserveScroll: true })} className="min-h-72 rounded-xl bg-muted/40 p-3"><h2 className="mb-3 font-medium">{stage.label}</h2><div className="space-y-2">{tasks.filter((task) => task.stage === stage.key).map((task) => <article key={task.id} draggable onDragStart={() => setDragged(task)} className="cursor-grab rounded-lg bg-background p-3 shadow-sm ring-1 ring-border"><div className="font-medium">{task.unit?.number} · {task.title}</div><div className="mt-1 text-xs capitalize text-muted-foreground">{task.priority} priority{task.employee ? ` · ${task.employee.name}` : ''}</div><div className="mt-2 flex gap-1">{stages.map((next) => <Button key={next.key} size="sm" variant={next.key === task.stage ? 'default' : 'outline'} className="h-7 px-2 text-[10px]" onClick={() => router.put(`/tasks/${task.id}`, { stage: next.key, status: next.key === 'clean' ? 'done' : 'in_progress' }, { preserveScroll: true })}>{next.label}</Button>)}</div></article>)}</div></section>)}</div></div></>;
}
HousekeepingBoard.layout = { breadcrumbs: [{ title: 'Housekeeping board', href: '/housekeeping' }] };
