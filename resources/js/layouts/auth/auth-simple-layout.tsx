import { Link } from '@inertiajs/react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="grid min-h-svh bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
            <aside className="relative hidden overflow-hidden bg-[#111a2e] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
                <div className="absolute -top-32 -left-28 size-[34rem] rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="absolute right-[-10rem] bottom-[-13rem] size-[36rem] rounded-full bg-amber-400/10 blur-3xl" />
                <Link href={home()} className="relative flex w-fit items-center gap-3 text-sm font-semibold tracking-wide text-white">
                    <span className="grid size-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                        <AppLogoIcon className="size-7 fill-current text-white" />
                    </span>
                    HOSPITALITY
                </Link>

                <div className="relative max-w-xl pb-10">
                    <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-slate-200">
                        <Sparkles className="size-3.5 text-amber-300" aria-hidden="true" />
                        A more personal way to stay
                    </div>
                    <h2 className="text-5xl leading-[1.08] font-semibold tracking-tight xl:text-6xl">
                        Make room for <span className="text-amber-300">good days.</span>
                    </h2>
                    <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
                        Plan your next stay, keep every booking close, and enjoy thoughtful hospitality from the moment you arrive.
                    </p>
                    <div className="mt-12 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-amber-300 text-lg font-semibold text-slate-900">H</span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">Your next stay is closer</p>
                            <p className="mt-1 text-xs text-slate-300">Bookings and travel details, all in one place.</p>
                        </div>
                        <ArrowUpRight className="size-5 text-amber-300" aria-hidden="true" />
                    </div>
                </div>
                <p className="relative text-xs text-slate-400">Thoughtful stays. Memorable moments.</p>
            </aside>

            <main className="flex min-h-svh flex-col items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
                <div className="w-full max-w-md">
                    <Link href={home()} className="mb-10 flex w-fit items-center gap-2.5 text-sm font-semibold tracking-wide text-slate-800 lg:hidden">
                        <span className="grid size-9 place-items-center rounded-xl bg-slate-900 text-white"><AppLogoIcon className="size-6 fill-current" /></span>
                        HOSPITALITY
                    </Link>
                    <div className="mb-8 space-y-2">
                        <p className="text-xs font-semibold tracking-[0.18em] text-indigo-600 uppercase">Guest account</p>
                        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
                        <p className="text-sm leading-6 text-slate-500">{description}</p>
                    </div>
                    {children}
                    <p className="mt-8 text-center text-xs text-slate-400">Hospitality · Thoughtful stays, made simple.</p>
                </div>
            </main>
        </div>
    );
}
