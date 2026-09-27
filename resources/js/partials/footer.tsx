import { Link } from '@inertiajs/react';

export default function Footer() {
    return (
        <footer className="bg-slate-950 px-6 py-12 text-slate-300 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
                <div><div className="mb-3 text-lg font-semibold text-white">Hospitality</div><p className="max-w-sm text-sm leading-6">Thoughtful stays, warm service, and memorable moments across every destination.</p></div>
                <div><h3 className="mb-3 text-sm font-semibold text-white">Explore</h3><div className="space-y-2 text-sm"><a href="#stays" className="block hover:text-white">Our stays</a><a href="#experience" className="block hover:text-white">Experience</a></div></div>
                <div><h3 className="mb-3 text-sm font-semibold text-white">Guest</h3><div className="space-y-2 text-sm"><Link href="/login" className="block hover:text-white">Customer login</Link><Link href="/register" className="block hover:text-white">Create an account</Link><Link href="/portal/book" className="block hover:text-white">Book a room</Link></div></div>
                <div><h3 className="mb-3 text-sm font-semibold text-white">Contact</h3><p className="text-sm leading-6">hello@hospitality.test<br />Available 24/7 for your stay.</p></div>
            </div>
            <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6 text-xs text-slate-500">© {new Date().getFullYear()} Hospitality. All rights reserved.</div>
        </footer>
    );
}
