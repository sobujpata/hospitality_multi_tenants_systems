import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayoutHome from '@/layouts/app-layout-home';

export default function PortalLogin() {
    const [form, setForm] = useState({ email: '', password: '' });
    return <><Head title="Customer portal login" /><div className="flex min-h-[620px] items-center justify-center px-6 py-16"><div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200"><div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Welcome back</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to your stays</h1><p className="mt-2 text-sm text-slate-500">Access bookings, invoices, and loyalty rewards.</p></div><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); router.post('/login', form); }}><div><label className="mb-1 block text-sm font-medium">Email address</label><Input type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div><label className="mb-1 block text-sm font-medium">Password</label><Input type="password" autoComplete="current-password" placeholder="Your password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div><Button className="w-full" type="submit">Log in</Button></form><div className="my-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or continue with<span className="h-px flex-1 bg-slate-200" /></div><div className="grid grid-cols-3 gap-2 text-center text-sm"><a className="rounded-lg border px-2 py-2 hover:bg-slate-50" href="/portal/oauth/google">Google</a><a className="rounded-lg border px-2 py-2 hover:bg-slate-50" href="/portal/oauth/facebook">Facebook</a><a className="rounded-lg border px-2 py-2 hover:bg-slate-50" href="/portal/oauth/linkedin">LinkedIn</a></div><p className="mt-6 text-center text-sm text-slate-500">New guest? <Link className="font-medium text-slate-900 underline underline-offset-4" href="/register">Create an account</Link></p></div></div></>;
}

PortalLogin.layout = (page: React.ReactNode) => <AppLayoutHome>{page}</AppLayoutHome>;
