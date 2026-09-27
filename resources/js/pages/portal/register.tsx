import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayoutHome from '@/layouts/app-layout-home';

export default function PortalRegister() {
    const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
    return <><Head title="Create customer account" /><div className="flex min-h-[620px] items-center justify-center px-6 py-16"><div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200"><div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Join Hospitality</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your guest account</h1><p className="mt-2 text-sm text-slate-500">Save your stays, earn rewards, and book faster.</p></div><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); router.post('/register', form); }}><div><label className="mb-1 block text-sm font-medium">Full name</label><Input autoComplete="name" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div><label className="mb-1 block text-sm font-medium">Email address</label><Input type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div><div><label className="mb-1 block text-sm font-medium">Password</label><Input type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div><div><label className="mb-1 block text-sm font-medium">Confirm password</label><Input type="password" autoComplete="new-password" placeholder="Repeat your password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} /></div><Button className="w-full" type="submit">Create account</Button></form><p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link className="font-medium text-slate-900 underline underline-offset-4" href="/login">Log in</Link></p></div></div></>;
}

PortalRegister.layout = (page: React.ReactNode) => <AppLayoutHome>{page}</AppLayoutHome>;
