import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Customer = { id: number; name: string; email: string | null; phone: string | null; vip_level: string; loyalty_points: number; blacklisted: boolean };
type Props = { customers: { data: Customer[]; links: { url: string | null; label: string; active: boolean }[] }; search: string };
export default function Customers({ customers, search }: Props) {
    const [query, setQuery] = useState(search);
    const [form, setForm] = useState({ name: '', email: '', phone: '', vip_level: 'standard', source: 'walk-in' });
    const submitSearch = (event: React.FormEvent) => { event.preventDefault(); router.get('/customers', { search: query }); };
    const create = () => router.post('/customers', form, { onSuccess: () => setForm({ name: '', email: '', phone: '', vip_level: 'standard', source: 'walk-in' }) });
    return <><Head title="Customers" /><div className="space-y-6 p-4">
        <div><h1 className="text-2xl font-semibold">Customers</h1><p className="text-muted-foreground">Search guests, review loyalty, and manage profiles.</p></div>
        <form onSubmit={submitSearch} className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, or phone" /><Button type="submit">Search</Button></form>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]"><section className="overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Contact</th><th className="px-4 py-3 text-left">VIP</th><th className="px-4 py-3 text-left">Points</th></tr></thead><tbody>{customers.data.map((customer) => <tr key={customer.id} className="border-t"><td className="px-4 py-3"><Link className="font-medium hover:underline" href={`/customers/${customer.id}`}>{customer.name}</Link>{customer.blacklisted && <span className="ml-2 text-xs text-red-600">Blacklisted</span>}</td><td className="px-4 py-3">{customer.email ?? customer.phone ?? '-'}</td><td className="px-4 py-3 capitalize">{customer.vip_level}</td><td className="px-4 py-3">{customer.loyalty_points}</td></tr>)}</tbody></table></section>
            <section className="space-y-3 rounded-xl border p-4"><h2 className="font-medium">Add customer</h2>{(['name', 'email', 'phone'] as const).map((key) => <div key={key}><Label>{key}</Label><Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>)}<Button onClick={create} disabled={!form.name}>Create customer</Button></section>
        </div><div className="flex gap-2">{customers.links.map((link) => <button key={link.label} disabled={!link.url} className="rounded border px-3 py-1 text-sm" onClick={() => link.url && router.get(link.url)} dangerouslySetInnerHTML={{ __html: link.label }} />)}</div>
    </div></>;
}
Customers.layout = { breadcrumbs: [{ title: 'Customers', href: '/customers' }] };
