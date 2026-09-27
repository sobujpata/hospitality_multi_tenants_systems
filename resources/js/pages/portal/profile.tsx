import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AppLayoutHome from '@/layouts/app-layout-home';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Customer = {
    name: string;
    email: string;
    phone: string | null;
    nationality: string | null;
    date_of_birth: string | null;
    gender: string | null;
    address: { line1?: string; city?: string; country?: string; postal_code?: string } | null;
};

export default function Profile({ customer }: { customer: Customer }) {
    const [profile, setProfile] = useState({
        name: customer.name,
        email: customer.email,
        phone: customer.phone ?? '',
        nationality: customer.nationality ?? '',
        date_of_birth: customer.date_of_birth ?? '',
        gender: customer.gender ?? '',
        address: {
            line1: customer.address?.line1 ?? '',
            city: customer.address?.city ?? '',
            country: customer.address?.country ?? '',
            postal_code: customer.address?.postal_code ?? '',
        },
    });
    const [password, setPassword] = useState({ current_password: '', password: '', password_confirmation: '' });
    const update = (key: string, value: string) => setProfile((current) => ({ ...current, [key]: value }));
    const updateAddress = (key: string, value: string) => setProfile((current) => ({ ...current, address: { ...current.address, [key]: value } }));

    return <><Head title="My profile" /><div className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <div><Link href="/portal" className="text-sm text-slate-500 underline">Back to customer panel</Link><h1 className="mt-3 text-4xl font-semibold tracking-tight">Your profile</h1><p className="mt-2 text-slate-500">Keep your contact details and account security up to date.</p></div>
        <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"><h2 className="mb-5 text-xl font-semibold">Personal information</h2><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); router.put('/portal/profile', profile); }}>
            {(['name', 'email', 'phone', 'nationality', 'date_of_birth', 'gender'] as const).map((key) => <label key={key} className="grid gap-1 text-sm font-medium">{key.replaceAll('_', ' ')}<Input type={key === 'email' ? 'email' : key === 'date_of_birth' ? 'date' : 'text'} value={profile[key]} onChange={(event) => update(key, event.target.value)} /></label>)}
            <div className="mt-2 grid gap-4 border-t pt-4 sm:col-span-2 sm:grid-cols-2">
                <h3 className="sm:col-span-2 text-base font-semibold">Address</h3>
                {(['line1', 'city', 'country', 'postal_code'] as const).map((key) => <label key={key} className="grid gap-1 text-sm font-medium">{key.replace('_', ' ')}<Input value={profile.address[key] ?? ''} onChange={(event) => updateAddress(key, event.target.value)} /></label>)}
            </div>
            <div className="sm:col-span-2"><Button type="submit">Save profile</Button></div>
        </form></section>
        <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"><h2 className="mb-2 text-xl font-semibold">Change password</h2><p className="mb-5 text-sm text-slate-500">Leave this section unused if you signed up through a social provider.</p><form className="grid gap-4 sm:max-w-md" onSubmit={(event) => { event.preventDefault(); router.put('/portal/password', password, { onSuccess: () => setPassword({ current_password: '', password: '', password_confirmation: '' }) }); }}>
            <label className="grid gap-1 text-sm font-medium">Current password<Input type="password" value={password.current_password} onChange={(event) => setPassword({ ...password, current_password: event.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">New password<Input type="password" value={password.password} onChange={(event) => setPassword({ ...password, password: event.target.value })} /></label>
            <label className="grid gap-1 text-sm font-medium">Confirm new password<Input type="password" value={password.password_confirmation} onChange={(event) => setPassword({ ...password, password_confirmation: event.target.value })} /></label>
            <Button type="submit">Change password</Button>
        </form></section>
    </div></>;
}

Profile.layout = (page: React.ReactNode) => <AppLayoutHome>{page}</AppLayoutHome>;
