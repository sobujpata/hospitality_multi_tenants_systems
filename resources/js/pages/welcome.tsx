import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import AppLayoutHome from '@/layouts/app-layout-home';
import { Input } from '@/components/ui/input';

type Branch = { id: number; name: string; type: string; city: string | null; country: string | null; cover_image: string | null; star_rating: number | null };

function addOneDay(date: string): string {
    if (!date) return '';

    const [year, month, day] = date.split('-').map(Number);
    const nextDay = new Date(year, month - 1, day + 1);

    return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
}

export default function Welcome({ branches }: { branches: Branch[] }) {
    const bannerImages = [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2200&q=85',
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2200&q=85',
        'https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=2200&q=85',
    ];
    const [activeBanner, setActiveBanner] = useState(0);
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [location, setLocation] = useState('');
    const locations = useMemo(() => Array.from(new Set(branches.flatMap((branch) => [branch.city, branch.country].filter((value): value is string => Boolean(value))))).sort(), [branches]);
    const submitAvailability = (event: React.FormEvent) => {
        event.preventDefault();
        router.get('/portal/book', { check_in: checkIn, check_out: checkOut, location }, { preserveState: false });
    };

    useEffect(() => {
        const interval = window.setInterval(() => {
            setActiveBanner((current) => (current + 1) % bannerImages.length);
        }, 5000);

        return () => window.clearInterval(interval);
    }, [bannerImages.length]);

    return (
        <>
            <Head title="Stay beautifully" />
            {/* Banner section */}
            <section className="relative mb-28 min-h-[90vh] overflow-visible bg-slate-950 text-white lg:mb-24">
                <div className="absolute inset-0 overflow-hidden">
                    {bannerImages.map((image, index) => (
                        <img
                            key={image}
                            src={image}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover object-center transition-[opacity,transform] duration-[1500ms] ease-in-out"
                            style={{
                                opacity: index === activeBanner ? 1 : 0,
                                transform: `scale(${index === activeBanner ? 1.1 : 1.03})`,
                            }}
                        />
                    ))}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(245,158,11,0.28),transparent_32%),linear-gradient(110deg,#020617_25%,rgba(15,23,42,0.72))]" />
                </div>
                <div className="relative mx-auto grid min-h-[90vh] max-w-7xl items-center px-6 pb-48 pt-20 lg:grid-cols-2 lg:px-8">
                    <div className="max-w-xl"><p className="mb-5 text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">Stay curious. Stay comfortable.</p><h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">Your next story starts here.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">From quiet mornings to unforgettable nights, discover welcoming stays designed around the way you travel.</p><div className="mt-9 flex flex-wrap gap-3"><Link href="/portal/book" className="rounded-full bg-amber-400 px-6 py-3 font-medium text-slate-950 hover:bg-amber-300">Find your stay</Link><a href="#experience" className="rounded-full border border-white/30 px-6 py-3 font-medium hover:bg-white/10">Explore Hospitality</a></div></div>
                    <div className="hidden justify-end lg:flex"><div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md"><div className="text-sm text-amber-200">Guest promise</div><div className="mt-3 max-w-xs text-2xl font-medium">Every detail considered. Every welcome personal.</div></div></div>
                </div>
                <div className="absolute inset-x-6 bottom-0 z-10 translate-y-1/2 lg:inset-x-8">
                    <form onSubmit={submitAvailability} className="grid gap-4 rounded-3xl bg-white p-5 text-slate-900 shadow-2xl ring-1 ring-slate-200 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end">
                        <label className="grid gap-2 text-sm font-medium">Check in<Input type="date" value={checkIn} onChange={(event) => { const value = event.target.value; setCheckIn(value); setCheckOut(addOneDay(value)); }} required /></label>
                        <label className="grid gap-2 text-sm font-medium">Check out<Input type="date" min={addOneDay(checkIn)} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} required /></label>
                        <label className="grid gap-2 text-sm font-medium">Location<select className="h-9 rounded-md border bg-white px-3 text-sm" value={location} onChange={(event) => setLocation(event.target.value)}><option value="">All locations</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                        <button type="submit" className="h-9 rounded-full bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800">Check availability</button>
                    </form>
                </div>
            </section>
            <section id="stays" className="mx-auto max-w-7xl px-6 py-24 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Made for your pace</p><h2 className="mt-3 text-4xl font-semibold tracking-tight">A better way to stay.</h2><p className="mt-4 text-lg leading-8 text-slate-600">Choose a place that feels like yours, whether you are here for business, celebration, or a well-earned escape.</p></div><div className="mt-12 grid gap-6 md:grid-cols-3">{[['01','Rest easy','Rooms with natural light, considered comforts, and space to breathe.'],['02','Gather well','Thoughtful dining and spaces made for good conversation.'],['03','Go further','Local knowledge to help you discover more of every destination.']].map(([number,title,text]) => <article key={number} className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200"><span className="text-sm font-semibold text-amber-600">{number}</span><h3 className="mt-12 text-2xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></article>)}</div></section>
            <section id="experience" className="bg-amber-50 px-6 py-24 lg:px-8"><div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2"><div className="overflow-hidden rounded-[2rem]"><img src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=85" alt="Elegant hotel interior" className="h-[420px] w-full object-cover" /></div><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">The Hospitality difference</p><h2 className="mt-3 text-4xl font-semibold tracking-tight">Warmth you can feel.</h2><p className="mt-5 text-lg leading-8 text-slate-700">Our people know that the best stays are made from small moments: a room ready early, a recommendation that feels just right, and a welcome you remember.</p><Link href="/login" className="mt-8 inline-block rounded-full bg-slate-950 px-6 py-3 font-medium text-white hover:bg-slate-800">Plan your stay</Link></div></div></section>
            <section id="destinations" className="mx-auto max-w-7xl px-6 py-24 text-center lg:px-8"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">Where next?</p><h2 className="mt-3 text-4xl font-semibold tracking-tight">Find your kind of place.</h2><p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Hotel, resort, hostel, or a table worth travelling for — your next experience is waiting.</p></section>
        </>
    );
}

Welcome.layout = (page: React.ReactNode) => <AppLayoutHome>{page}</AppLayoutHome>;
