import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';

type Plan = { id: number; name: string; monthly_price: string };
type Tenant = {
    id: number;
    name: string;
    slug: string;
    plan: string;
    mrr: number;
    trial_ends_at: string | null;
    trial_active: boolean;
    active: boolean;
    last_activity: string | null;
    flags: Record<string, boolean>;
};
type Props = {
    tenants: Tenant[];
    plans: Plan[];
    featureFlags: Record<string, string>;
    stats: {
        total_tenants: number;
        active_tenants: number;
        mrr: number;
        churn_rate: number;
        active_bookings_today: number;
        signup_trend: { month: string; signups: number }[];
    };
    health: {
        queue_jobs: number;
        failed_jobs: number;
        cache_hit_rate: string | number;
        db_query_time_ms: number;
    };
};

const money = (value: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);

export default function SuperAdminDashboard({
    tenants,
    plans,
    featureFlags,
    stats,
    health,
}: Props) {
    const [trialDates, setTrialDates] = useState<Record<number, string>>({});
    const [planIds, setPlanIds] = useState<Record<number, string>>({});
    const override = (tenant: Tenant) =>
        router.put(`/admin/tenants/${tenant.id}/billing`, {
            plan_id:
                planIds[tenant.id] ??
                plans.find((plan) => plan.name === tenant.plan)?.id,
            trial_ends_at: trialDates[tenant.id] || tenant.trial_ends_at,
        });
    const toggle = (tenant: Tenant, key: string, enabled: boolean) =>
        router.put(`/admin/tenants/${tenant.id}/feature-flags`, {
            key,
            enabled,
        });

    return (
        <>
            <Head title="Super Admin Dashboard" />
            <div className="min-h-screen bg-muted/20 p-6">
                <div className="mx-auto max-w-7xl space-y-6">
                    <div>
                        <h1 className="text-3xl font-semibold">
                            Platform control center
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Tenant health, subscriptions, operations, and
                            controlled feature rollout.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            ['Active tenants', stats.active_tenants],
                            ['MRR', money(stats.mrr)],
                            ['Churn rate', `${stats.churn_rate}%`],
                            [
                                'Active bookings today',
                                stats.active_bookings_today,
                            ],
                        ].map(([label, value]) => (
                            <div
                                className="rounded-xl border bg-card p-5"
                                key={String(label)}
                            >
                                <div className="text-sm text-muted-foreground">
                                    {label}
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>
                    <section className="rounded-xl border bg-card p-5">
                        <div className="mb-4">
                            <h2 className="text-xl font-medium">New tenant signups</h2>
                            <p className="text-sm text-muted-foreground">Monthly signups over the last six months.</p>
                        </div>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.signup_trend} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="signups" name="New tenants" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>
                    <section className="rounded-xl border bg-card p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-medium">
                                    System health
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Platform-wide runtime signals.
                                </p>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">
                                Operational
                            </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                                ['Queued jobs', health.queue_jobs],
                                ['Failed jobs', health.failed_jobs],
                                [
                                    'Cache hit rate',
                                    typeof health.cache_hit_rate === 'number'
                                        ? `${health.cache_hit_rate}%`
                                        : health.cache_hit_rate,
                                ],
                                [
                                    'DB query time',
                                    `${health.db_query_time_ms} ms`,
                                ],
                            ].map(([label, value]) => (
                                <div
                                    className="rounded-lg bg-muted/40 p-3"
                                    key={String(label)}
                                >
                                    <div className="text-xs text-muted-foreground">
                                        {label}
                                    </div>
                                    <div className="mt-1 font-semibold">
                                        {value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="overflow-x-auto rounded-xl border bg-card p-5">
                        <h2 className="mb-4 text-xl font-medium">Tenants</h2>
                        <table className="w-full min-w-[1050px] text-left text-sm">
                            <thead>
                                <tr className="border-b">
                                    {[
                                        'Tenant',
                                        'Plan',
                                        'MRR',
                                        'Trial',
                                        'Last activity',
                                        'Billing override',
                                        'Actions',
                                    ].map((heading) => (
                                        <th
                                            className="p-3 font-medium"
                                            key={heading}
                                        >
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.map((tenant) => (
                                    <tr
                                        className="border-b align-top"
                                        key={tenant.id}
                                    >
                                        <td className="p-3">
                                            <strong>{tenant.name}</strong>
                                            <div className="text-xs text-muted-foreground">
                                                {tenant.slug}.localhost
                                            </div>
                                        </td>
                                        <td className="p-3">{tenant.plan}</td>
                                        <td className="p-3">
                                            {money(tenant.mrr)}
                                        </td>
                                        <td className="p-3">
                                            {tenant.trial_active ? (
                                                <span className="text-amber-700">
                                                    Active until{' '}
                                                    {tenant.trial_ends_at}
                                                </span>
                                            ) : (
                                                (tenant.trial_ends_at ?? '—')
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {tenant.last_activity
                                                ? new Date(
                                                      tenant.last_activity,
                                                  ).toLocaleString()
                                                : 'Never'}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <select
                                                    className="h-9 rounded border px-2"
                                                    value={
                                                        planIds[tenant.id] ?? ''
                                                    }
                                                    onChange={(event) =>
                                                        setPlanIds({
                                                            ...planIds,
                                                            [tenant.id]:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                >
                                                    <option value="">
                                                        Keep plan
                                                    </option>
                                                    {plans.map((plan) => (
                                                        <option
                                                            value={plan.id}
                                                            key={plan.id}
                                                        >
                                                            {plan.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <input
                                                    className="h-9 rounded border px-2"
                                                    type="date"
                                                    value={
                                                        trialDates[tenant.id] ??
                                                        tenant.trial_ends_at ??
                                                        ''
                                                    }
                                                    onChange={(event) =>
                                                        setTrialDates({
                                                            ...trialDates,
                                                            [tenant.id]:
                                                                event.target
                                                                    .value,
                                                        })
                                                    }
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        override(tenant)
                                                    }
                                                >
                                                    Save
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        router.post(
                                                            `/admin/tenants/${tenant.id}/impersonate`,
                                                        )
                                                    }
                                                >
                                                    Impersonate
                                                </Button>
                                            </div>
                                            <div className="mt-3 space-y-2">
                                                {Object.entries(
                                                    featureFlags,
                                                ).map(([key, label]) => (
                                                    <label
                                                        className="flex items-center gap-2 text-xs"
                                                        key={key}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={Boolean(
                                                                tenant.flags[
                                                                    key
                                                                ],
                                                            )}
                                                            onChange={(event) =>
                                                                toggle(
                                                                    tenant,
                                                                    key,
                                                                    event.target
                                                                        .checked,
                                                                )
                                                            }
                                                        />
                                                        {label}
                                                    </label>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                </div>
            </div>
        </>
    );
}
