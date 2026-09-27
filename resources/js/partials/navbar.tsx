import { Link, router, usePage } from '@inertiajs/react';

type SharedProps = { auth: { user?: { name: string } | null; customer?: { name: string } | null }; tenantBranding?: { name?: string; logo?: string | null } };

export default function Navbar() {
    const { auth, tenantBranding } = usePage().props as unknown as SharedProps;
    const customer = auth.customer;

    return (
        <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 text-white backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                    {tenantBranding?.logo ? <img className="size-9 rounded-xl object-cover" src={tenantBranding.logo} alt="" /> : <span className="flex size-9 items-center justify-center rounded-xl bg-amber-400 text-slate-950">H</span>}
                    {tenantBranding?.name ?? 'Hospitality'}
                </Link>
                <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
                    <a href="http://localhost:8000/" className="hover:text-white">Home</a>
                    <a href="http://localhost:8000/#stays" className="hover:text-white">Our stays</a>
                    <a href="http://localhost:8000/#experience" className="hover:text-white">Experience</a>
                    <a href="http://localhost:8000/#destinations" className="hover:text-white">Destinations</a>
                    {customer && <Link href="/portal" className="hover:text-white">My bookings</Link>}
                </nav>
                <div className="flex items-center gap-3 text-sm">
                    {customer ? (
                        <>
                            <div className="group relative">
                                <button type="button" className="flex items-center gap-2 rounded-full border border-white/15 p-1 pr-3 hover:border-amber-300" aria-label="Open customer menu">
                                    <span className="flex size-9 items-center justify-center rounded-full bg-amber-400 text-sm font-semibold text-slate-950">
                                        {customer.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                                    </span>
                                    <span className="hidden max-w-28 truncate text-slate-200 sm:inline">{customer.name}</span>
                                </button>
                                <div className="invisible absolute right-0 top-full z-20 w-48 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                                    <div className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-xl">
                                        <Link href="/portal/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">Profile</Link>
                                        <Link href="/portal" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">Bookings</Link>
                                        <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => router.post('/portal/logout')}>Log out</button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="text-slate-200 hover:text-white">Log in</Link>
                            <Link href="/register" className="rounded-full bg-amber-400 px-4 py-2 font-medium text-slate-950 hover:bg-amber-300">Register</Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
