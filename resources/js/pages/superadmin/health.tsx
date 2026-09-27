import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

type FailedJob = {
    id: string;
    connection: string;
    queue: string;
    job: string;
    failed_at: string;
    exception: string;
};

type Props = {
    queue: {
        connection: string;
        driver: string;
        pending: number;
        processing: number;
    };
    failedJobs: FailedJob[];
    failedJobsCount: number;
    cache: {
        hit_rate: string;
        hits: number | null;
        misses: number | null;
        status: string;
    };
    database: {
        average_ms: number;
        samples: number;
        measurement: string;
    };
};

export default function SystemHealth({ queue, failedJobs, failedJobsCount, cache, database }: Props) {
    return (
        <>
            <Head title="System Health" />
            <div className="space-y-6 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">System Health</h1>
                    <p className="text-muted-foreground">Platform queue, cache, and database monitoring.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric title="Pending jobs" value={queue.pending} detail={`${queue.driver} · ${queue.connection}`} />
                    <Metric title="Processing jobs" value={queue.processing} detail="Currently reserved by workers" />
                    <Metric title="Failed jobs" value={failedJobsCount} detail="Review and manage failed jobs below" />
                    <Metric title="Database query time" value={`${database.average_ms} ms`} detail={database.measurement} />
                </div>

                <section className="rounded-xl border bg-card p-5">
                    <div className="mb-4 flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-medium">Redis cache performance</h2>
                            <p className="text-sm text-muted-foreground">Redis status: {cache.status}</p>
                        </div>
                        <span className="text-2xl font-semibold">{cache.hit_rate}</span>
                    </div>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                        <span>Hits: {cache.hits ?? '—'}</span>
                        <span>Misses: {cache.misses ?? '—'}</span>
                    </div>
                </section>

                <section className="overflow-x-auto rounded-xl border bg-card p-5">
                    <div className="mb-4">
                        <h2 className="text-xl font-medium">Failed queue jobs</h2>
                        <p className="text-sm text-muted-foreground">Retry jobs to requeue them or delete entries that no longer need attention.</p>
                    </div>
                    <table className="w-full min-w-[900px] text-left text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                {['Job', 'Queue', 'Connection', 'Failed at', 'Error', 'Actions'].map((heading) => (
                                    <th className="px-3 py-2 font-medium" key={heading}>{heading}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {failedJobs.map((job) => (
                                <tr className="border-t align-top" key={job.id}>
                                    <td className="max-w-64 break-all px-3 py-3">{job.job}</td>
                                    <td className="px-3 py-3">{job.queue}</td>
                                    <td className="px-3 py-3">{job.connection}</td>
                                    <td className="whitespace-nowrap px-3 py-3">{new Date(job.failed_at).toLocaleString()}</td>
                                    <td className="max-w-96 break-words px-3 py-3 text-muted-foreground">{job.exception}</td>
                                    <td className="whitespace-nowrap px-3 py-3">
                                        <Button size="sm" variant="outline" onClick={() => router.post(`/admin/health/failed-jobs/${encodeURIComponent(job.id)}/retry`)}>
                                            Retry
                                        </Button>
                                        <Button
                                            className="ml-2"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                if (window.confirm('Delete this failed job record?')) {
                                                    router.delete(`/admin/health/failed-jobs/${encodeURIComponent(job.id)}`);
                                                }
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {failedJobs.length === 0 && (
                                <tr>
                                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>No failed jobs.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </section>
            </div>
        </>
    );
}

function Metric({ title, value, detail }: { title: string; value: string | number; detail: string }) {
    return (
        <div className="rounded-xl border bg-card p-5">
            <div className="text-sm text-muted-foreground">{title}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
    );
}

SystemHealth.layout = { breadcrumbs: [{ title: 'System Health', href: '/admin/health' }] };
