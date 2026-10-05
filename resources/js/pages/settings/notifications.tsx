import { Head, Link, router } from '@inertiajs/react';
import {
    BellAlertIcon,
    BellIcon,
    BuildingOffice2Icon,
    CalendarDaysIcon,
    CheckCircleIcon,
    ChevronRightIcon,
    ClipboardDocumentCheckIcon,
    CreditCardIcon,
    ExclamationTriangleIcon,
    WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type Channel = 'database' | 'mail' | 'broadcast';
type NotificationEvent = {
    id: string;
    data: { title?: string; message?: string; [key: string]: unknown };
    read_at: string | null;
    created_at: string;
};
type Props = {
    events: Record<string, string>;
    preferences: Record<string, Channel[]>;
    notifications: NotificationEvent[];
    canManagePreferences: boolean;
};

const channels: { id: Channel; title: string; description: string }[] = [
    { id: 'database', title: 'In-app', description: 'Notification center' },
    { id: 'mail', title: 'Email', description: 'Send to your inbox' },
    { id: 'broadcast', title: 'Live', description: 'Instant browser updates' },
];

const eventIcons: Record<string, typeof BellIcon> = {
    new_booking: CalendarDaysIcon,
    booking_cancelled: ExclamationTriangleIcon,
    checkin_reminder: BellAlertIcon,
    payment_received: CreditCardIcon,
    maintenance_completed: WrenchScrewdriverIcon,
    task_assigned: ClipboardDocumentCheckIcon,
    task_available: ClipboardDocumentCheckIcon,
    trial_expiring: ExclamationTriangleIcon,
    low_availability: BuildingOffice2Icon,
};

export default function Notifications({ events, preferences: initial, notifications, canManagePreferences }: Props) {
    const notificationEvents = {
        ...events,
        task_assigned: events.task_assigned ?? 'Task assigned to you',
        task_available: events.task_available ?? 'Unassigned task available in your branch',
    };
    const [activity, setActivity] = useState(notifications);
    const [markingReadIds, setMarkingReadIds] = useState<string[]>([]);
    const [preferences, setPreferences] = useState<Record<string, Channel[]>>(() =>
        Object.fromEntries(
            Object.keys(notificationEvents).map((event) => [event, initial[event] ?? channels.map((channel) => channel.id)]),
        ),
    );
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    useEffect(() => {
        setActivity(notifications);
    }, [notifications]);

    const unreadCount = useMemo(
        () => activity.filter((notification) => !notification.read_at).length,
        [activity],
    );
    const visibleNotifications = showUnreadOnly
        ? activity.filter((notification) => !notification.read_at)
        : activity;

    useEffect(() => {
        const handleNotification = (event: Event) => {
            const payload = (event as CustomEvent<Record<string, unknown>>).detail;
            if (!payload) return;
            const data = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as NotificationEvent['data'];
            const id = typeof payload.id === 'string' ? payload.id : undefined;
            if (!id) return;
            setActivity((current) => current.some((notification) => notification.id === id)
                ? current
                : [{ id, data, read_at: null, created_at: typeof payload.created_at === 'string' ? payload.created_at : new Date().toISOString() }, ...current].slice(0, 30));
        };
        window.addEventListener('notifications-updated', handleNotification);
        return () => window.removeEventListener('notifications-updated', handleNotification);
    }, []);

    const toggleChannel = (event: string, channel: Channel) => {
        setSaved(false);
        setPreferences((current) => {
            const selected = current[event] ?? [];
            return {
                ...current,
                [event]: selected.includes(channel)
                    ? selected.filter((item) => item !== channel)
                    : [...selected, channel],
            };
        });
    };

    const savePreferences = () => {
        setIsSaving(true);
        setSaved(false);
        router.put('/settings/notifications', { preferences }, {
            preserveScroll: true,
            onSuccess: () => setSaved(true),
            onFinish: () => setIsSaving(false),
        });
    };

    const markAsRead = (id: string) => {
        if (markingReadIds.includes(id)) return;
        setMarkingReadIds((current) => [...current, id]);
        router.post(`/notifications/${encodeURIComponent(id)}/read`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                setActivity((current) => current.map((notification) => notification.id === id
                    ? { ...notification, read_at: new Date().toISOString() }
                    : notification));
                window.dispatchEvent(new CustomEvent('notification-read', { detail: { id } }));
            },
            onFinish: () => setMarkingReadIds((current) => current.filter((notificationId) => notificationId !== id)),
        });
    };

    return (
        <>
            <Head title="Notification settings" />
            <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
                <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 p-6 text-white shadow-lg shadow-violet-950/10 sm:p-8">
                    <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full border-[36px] border-white/5" />
                    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-2xl">
                            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                                <BellAlertIcon className="size-6" />
                            </div>
                            <p className="text-sm font-medium text-violet-100">YOUR WORKSPACE</p>
                            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Notifications</h1>
                            <p className="mt-2 text-sm leading-6 text-violet-100 sm:text-base">
                                Choose which updates reach you and how you want to receive them.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                                <BellIcon className="size-5" />
                            </span>
                            <div>
                                <p className="text-2xl font-semibold leading-none">{unreadCount}</p>
                                <p className="mt-1 text-xs text-violet-100">unread updates</p>
                            </div>
                        </div>
                    </div>
                </header>

                {canManagePreferences && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Delivery preferences</h2>
                            <p className="mt-1 text-sm text-slate-500">Pick a delivery method for each kind of update.</p>
                        </div>
                        <div className="hidden gap-2 sm:flex">
                            {channels.map((channel) => (
                                <span key={channel.id} className="min-w-20 text-center text-xs font-medium text-slate-500">
                                    {channel.title}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {Object.entries(notificationEvents).map(([event, label]) => {
                            const Icon = eventIcons[event] ?? BellIcon;
                            const selected = preferences[event] ?? [];
                            return (
                                <div key={event} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,5rem)] sm:gap-2 sm:px-6">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                                            <Icon className="size-5" />
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-800">{label}</p>
                                            <p className="mt-0.5 text-xs text-slate-500 sm:hidden">Choose delivery</p>
                                        </div>
                                    </div>
                                    <div className="col-span-2 flex items-center justify-end gap-5 sm:col-span-1 sm:justify-center sm:gap-0">
                                        {channels.map((channel) => (
                                            <label key={channel.id} className="group flex cursor-pointer flex-col items-center gap-1.5 sm:w-20" title={`${channel.title}: ${channel.description}`}>
                                                <input
                                                    type="checkbox"
                                                    aria-label={`${label}: ${channel.title}`}
                                                    checked={selected.includes(channel.id)}
                                                    onChange={() => toggleChannel(event, channel.id)}
                                                    className="size-4 cursor-pointer rounded border-slate-300 text-violet-600 accent-violet-600 focus:ring-violet-500"
                                                />
                                                <span className="text-[10px] text-slate-500 sm:hidden">{channel.title}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <p className="text-xs text-slate-500">You can change these settings at any time.</p>
                        <div className="flex items-center gap-3">
                            {saved && <span role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircleIcon className="size-4" />Preferences saved</span>}
                            <Button onClick={savePreferences} disabled={isSaving} className="bg-violet-700 text-white hover:bg-violet-800">
                                {isSaving ? 'Saving…' : 'Save preferences'}
                            </Button>
                        </div>
                    </footer>
                </section>}

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
                                {unreadCount > 0 && <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">{unreadCount} new</span>}
                            </div>
                            <p className="mt-1 text-sm text-slate-500">Your latest booking, payment, task, and operations updates.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowUnreadOnly((value) => !value)}
                            aria-pressed={showUnreadOnly}
                            className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-sm font-medium transition sm:self-auto ${showUnreadOnly ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            {showUnreadOnly ? 'Show all' : 'Unread only'}
                            <ChevronRightIcon className={`size-4 transition-transform ${showUnreadOnly ? 'rotate-90' : ''}`} />
                        </button>
                    </div>

                    {visibleNotifications.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-14 text-center">
                            <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                                {showUnreadOnly ? <CheckCircleIcon className="size-7" /> : <ClipboardDocumentCheckIcon className="size-7" />}
                            </span>
                            <h3 className="mt-4 text-sm font-semibold text-slate-800">
                                {showUnreadOnly ? 'You’re all caught up' : 'Nothing to see yet'}
                            </h3>
                            <p className="mt-1 max-w-sm text-sm text-slate-500">
                                {showUnreadOnly ? 'New updates will appear here when they arrive.' : 'When your workspace has an update, it will show up here.'}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {visibleNotifications.map((notification) => (
                                <article key={notification.id} className={`flex gap-4 px-5 py-4 transition-colors sm:px-6 ${notification.read_at ? '' : 'bg-violet-50/40'}`}>
                                    <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl ${notification.read_at ? 'bg-slate-100 text-slate-500' : 'bg-violet-100 text-violet-700'}`}>
                                        <BellIcon className="size-5" />
                                    </span>
                                        <div className="min-w-0 flex-1">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="min-w-0">
                                                <h3 className={`text-sm ${notification.read_at ? 'font-medium text-slate-800' : 'font-semibold text-slate-900'}`}>
                                                    {notification.data.title ?? 'Notification'}
                                                </h3>
                                                {notification.data.message && <p className="mt-1 text-sm leading-5 text-slate-600">{notification.data.message}</p>}
                                            </div>
                                            <time dateTime={notification.created_at} className="shrink-0 text-xs text-slate-400">
                                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                            </time>
                                        </div>
                                        {(typeof notification.data.task_id === 'number' || typeof notification.data.task_id === 'string') && (
                                            <Link href={typeof notification.data.url === 'string' ? notification.data.url : '/tasks'} className="mt-2 inline-flex text-xs font-semibold text-violet-700 hover:text-violet-900">
                                                View task
                                            </Link>
                                        )}
                                        {!notification.read_at && (
                                            <button type="button" disabled={markingReadIds.includes(notification.id)} onClick={() => markAsRead(notification.id)} className="mt-2 text-xs font-semibold text-violet-700 hover:text-violet-900 disabled:opacity-50">
                                                {markingReadIds.includes(notification.id) ? 'Saving…' : 'Mark as read'}
                                            </button>
                                        )}
                                    </div>
                                    {!notification.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-violet-600" aria-label="Unread" />}
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}
