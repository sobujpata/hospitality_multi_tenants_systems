import { Link, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { Bell, ChevronsUpDown, MessageSquare } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { UserInfo } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { useIsMobile } from '@/hooks/use-mobile';

export function NavUser({ inboxUnreadCount = 0 }: { inboxUnreadCount?: number }) {
    const page = usePage();
    const { auth } = page.props;
    const unreadNotifications = (page.props as { unreadNotifications?: { id: string }[] }).unreadNotifications ?? [];
    const initialUnreadCount = (page.props as { unreadNotificationCount?: number }).unreadNotificationCount ?? unreadNotifications.length;
    const authRoles = (page.props as { auth?: { roles?: string[] } }).auth?.roles ?? [];
    const canAccessInbox = authRoles.some((role) => ['Tenant Owner', 'Branch Manager', 'Receptionist'].includes(role));
    const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
    const knownUnreadIds = useRef(new Set(unreadNotifications.map((notification) => notification.id)));
    const readNotificationIds = useRef(new Set<string>());

    useEffect(() => {
        setUnreadCount(initialUnreadCount);
        knownUnreadIds.current = new Set(unreadNotifications.map((notification) => notification.id));
    }, [initialUnreadCount, unreadNotifications]);

    useEffect(() => {
        const handleNotification = (event: Event) => {
            const notification = (event as CustomEvent<{ id?: string }>).detail;
            if (notification?.id && knownUnreadIds.current.has(notification.id)) return;
            if (notification?.id) knownUnreadIds.current.add(notification.id);
            setUnreadCount((count) => count + 1);
        };
        const handleRead = (event: Event) => {
            const { id } = (event as CustomEvent<{ id?: string }>).detail ?? {};
            if (!id || readNotificationIds.current.has(id)) return;
            readNotificationIds.current.add(id);
            knownUnreadIds.current.delete(id);
            setUnreadCount((count) => Math.max(0, count - 1));
        };
        window.addEventListener('notifications-updated', handleNotification);
        window.addEventListener('notification-read', handleRead);
        return () => {
            window.removeEventListener('notifications-updated', handleNotification);
            window.removeEventListener('notification-read', handleRead);
        };
    }, []);

    useEffect(() => {
        if (!auth.user || !import.meta.env.VITE_REVERB_APP_KEY) {
            return;
        }

        const authUser = auth.user as typeof auth.user & { tenant_id?: number; branch_id?: number | null };

        (window as typeof window & { Pusher: typeof Pusher }).Pusher = Pusher;
        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
            wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 80),
            wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
            enabledTransports: ['ws', 'wss'],
        });

        const channel = echo.private(`App.Models.User.${auth.user.id}`);
        channel.notification((payload: Record<string, unknown>) => {
            window.dispatchEvent(new CustomEvent('notifications-updated', { detail: payload }));
        });
        channel.listen('.task.assigned', (payload: Record<string, unknown>) => {
            window.dispatchEvent(new CustomEvent('notifications-updated', { detail: payload }));
        });

        const canViewAllInboxBranches = authRoles.some((role) => ['Tenant Owner', 'Branch Manager'].includes(role));
        const inboxChannel = canViewAllInboxBranches && authUser.tenant_id
            ? `tenant.${authUser.tenant_id}.inbox`
            : authUser.branch_id
                ? `branch.${authUser.branch_id}.inbox`
                : null;
        if (inboxChannel) {
            echo.private(inboxChannel)
                .listen('.message.sent', (payload: Record<string, unknown>) => {
                    window.dispatchEvent(new CustomEvent('inbox-message-received', { detail: payload }));
                })
                .listen('.message.read', (payload: Record<string, unknown>) => {
                    window.dispatchEvent(new CustomEvent('inbox-conversation-read', { detail: payload }));
                });
        }

        return () => echo.disconnect();
    }, [auth.user, authRoles]);
    const { state } = useSidebar();
    const isMobile = useIsMobile();

    if (!auth.user) {
        return null;
    }

    return (
        <SidebarMenu>
            {canAccessInbox && (
                [<SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Inbox">
                        <Link href="/inbox">
                            <MessageSquare className="size-4" />
                            <span>Inbox</span>
                            {inboxUnreadCount > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}</span>}
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>,
        
                <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Notifications">
                        <Link href="/settings/notifications">
                            <Bell className="size-4" />
                            <span>Notifications</span>
                            {unreadCount > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unreadCount}</span>}
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>]
            )}
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="group text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent"
                            data-test="sidebar-menu-button"
                        >
                            <UserInfo user={auth.user} />
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        align="end"
                        side={
                            isMobile
                                ? 'bottom'
                                : state === 'collapsed'
                                  ? 'left'
                                  : 'bottom'
                        }
                    >
                        <UserMenuContent user={auth.user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
