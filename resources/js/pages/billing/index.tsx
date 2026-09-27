import { Head, router } from '@inertiajs/react';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';

type Plan = { id: number; name: string; monthly_price: string; branch_limit: number | null; staff_limit: number | null; room_limit: number | null; white_label: boolean; api_access: boolean };
type Props = { tenant: { name: string; trial_ends_at: string | null; on_trial: boolean; subscription_active: boolean; read_only: boolean; payment_method: string | null }; currentPlan: Plan | null; plans: Plan[]; usage: Record<string, { used: number; limit: number | null }>; invoices: { id: string; date: string; total: string; paid: boolean }[]; setupIntent: string | null; stripeKey: string | null };

function PaymentForm({ setupIntent, onPaymentMethod }: { setupIntent: string | null; onPaymentMethod: (id: string) => void }) {
    const stripe = useStripe();
    const elements = useElements();
    const [busy, setBusy] = useState(false);
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements || !setupIntent) return;
        setBusy(true);
        const result = await stripe.confirmCardSetup(setupIntent, { payment_method: { card: elements.getElement(CardElement)! } });
        setBusy(false);
        if (!result.error && typeof result.setupIntent.payment_method === 'string') onPaymentMethod(result.setupIntent.payment_method);
    };
    return <form className="grid gap-3" onSubmit={submit}><div className="rounded border p-3"><CardElement /></div><Button disabled={busy || !setupIntent}>{busy ? 'Saving…' : 'Save payment method'}</Button></form>;
}

export default function Billing({ tenant, currentPlan, plans, usage, invoices, setupIntent, stripeKey }: Props) {
    const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
    const subscribe = (planId: number) => router.post('/billing/subscribe', { plan_id: planId, payment_method: paymentMethod });
    const updatePayment = (id: string) => router.post('/billing/payment-method', { payment_method: id });
    const stripePromise = stripeKey ? loadStripe(stripeKey) : null;
    return <><Head title="Billing" /><div className="flex flex-1 flex-col gap-5 p-4"><div><h1 className="text-2xl font-semibold">Billing</h1><p className="text-sm text-muted-foreground">Manage your subscription, usage, payment method, and invoices.</p></div>{tenant.read_only && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Your subscription has lapsed. The workspace is read-only until billing is restored.</div>}{tenant.on_trial && tenant.trial_ends_at && <div className="rounded-lg border bg-card p-4 text-sm">Free trial ends on <strong>{new Date(tenant.trial_ends_at).toLocaleDateString()}</strong>. Choose a plan before then to continue without interruption.</div>}<div className="grid gap-4 md:grid-cols-3">{plans.map((plan) => <div className={`rounded-xl border p-5 ${currentPlan?.id === plan.id ? 'border-primary ring-1 ring-primary' : ''}`} key={plan.id}><h2 className="text-lg font-semibold">{plan.name}</h2><div className="my-2 text-2xl font-bold">${plan.monthly_price}<span className="text-sm font-normal">/mo</span></div><ul className="mb-4 space-y-1 text-sm"><li>{plan.branch_limit ?? 'Unlimited'} branches</li><li>{plan.staff_limit ?? 'Unlimited'} staff</li><li>{plan.room_limit ?? 'Unlimited'} rooms</li>{plan.white_label && <li>White label</li>}{plan.api_access && <li>API access</li>}</ul><Button className="w-full" variant={currentPlan?.id === plan.id ? 'secondary' : 'default'} onClick={() => subscribe(plan.id)}>{currentPlan?.id === plan.id ? 'Current plan' : 'Switch plan'}</Button></div>)}</div><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-medium">Usage</h2>{Object.entries(usage).map(([key, meter]) => <div className="mb-4" key={key}><div className="mb-1 flex justify-between text-sm"><span className="capitalize">{key}</span><span>{meter.used} / {meter.limit ?? '∞'}</span></div><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: meter.limit ? `${Math.min(100, meter.used / meter.limit * 100)}%` : '8%' }} /></div></div>)}</section><section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-medium">Payment method</h2>{tenant.payment_method && <p className="mb-3 text-sm">{tenant.payment_method}</p>}{stripePromise && <Elements stripe={stripePromise}><PaymentForm setupIntent={setupIntent} onPaymentMethod={(id) => { setPaymentMethod(id); updatePayment(id); }} /></Elements>}{!stripePromise && <p className="text-sm text-muted-foreground">Stripe payment setup is not configured.</p>}</section></div><section className="rounded-xl border p-5"><h2 className="mb-3 text-lg font-medium">SaaS invoices</h2>{invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices available.</p> : invoices.map((invoice) => <div className="flex justify-between border-b py-2 text-sm" key={invoice.id}><span>{invoice.date} · {invoice.paid ? 'Paid' : 'Pending'}</span><span>{invoice.total} <a className="ml-3 underline" href={`/billing/invoices/${invoice.id}`}>Download</a></span></div>)}</section></div></>;
}
