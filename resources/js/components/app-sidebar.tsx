import { Link, usePage } from '@inertiajs/react';
import {
    CalendarRange,
    CalendarDays,
    RadioTower,
    Clock3,
    CalendarClock,
    ClipboardList,
    Wrench,
    KeyRound,
    LayoutGrid,
    ShieldCheck,
    GitBranch,
    Grid3X3,
    UserRoundSearch,
    Users,
    FileBarChart,
    CreditCard,
    Bell,
    Settings2,
    UserIcon,
    MessageSquare,
    ScrollText,
    GitGraph,
    Sparkles,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
    },
    {
        title: 'Tenant Management',
        href: '/admin/tenants',
        icon: Users,
    },
    {
        title: 'System Health Panel',
        href: '/admin/health',
        icon: ShieldCheck,
    },
    {
        title: 'Communications',
        href: '/admin/communications',
        icon: MessageSquare,
    },
    {
        title: 'Audit Log',
        href: '/admin/audit-logs',
        icon: ScrollText,
    },
    {
        title: 'Role Manager',
        href: '/roles',
        icon: ShieldCheck,
    },
    {
        title: 'Users',
        href: '/users',
        icon: Users,
    },
    {
        title: 'Permissions',
        href: '/permissions',
        icon: KeyRound,
    },
    {
        title: 'Branches',
        href: '/branches',
        icon: GitBranch,
    },
    {
        title: 'Units & Floor Plan',
        href: '/units',
        icon: Grid3X3,
    },
    {
        title: 'Room Category',
        href: '/room-category',
        icon: GitGraph,
    },
    {
        title: 'Amenities',
        href: '/amenities',
        icon: Sparkles,
    },
    {
        title: 'Booking Timeline',
        href: '/bookings/timeline',
        icon: CalendarRange,
    },
    {
        title: 'Availability Calendar',
        href: '/bookings/availability',
        icon: CalendarDays,
    },
    {
        title: 'Channel Manager',
        href: '/channels',
        icon: RadioTower,
    },
    {
        title: 'Staff Scheduling',
        href: '/staff/scheduling',
        icon: CalendarClock,
    },
    {
        title: 'Attendance',
        href: '/staff/attendance',
        icon: Clock3,
    },
    {
        title: 'Task Management',
        href: '/tasks',
        icon: ClipboardList,
    },
    {
        title: 'Housekeeping',
        href: '/housekeeping',
        icon: ClipboardList,
    },
    {
        title: 'Maintenance',
        href: '/maintenance',
        icon: Wrench,
    },
    {
        title: 'Customers',
        href: '/customers',
        icon: UserRoundSearch,
    },
    {
        title: 'Inbox',
        href: '/inbox',
        icon: MessageSquare,
    },
    {
        title: 'Reports',
        href: '/reports',
        icon: FileBarChart,
    },
    {
        title: 'Billing',
        href: '/billing',
        icon: CreditCard,
    },
    {
        title: 'Notifications',
        href: '/settings/notifications',
        icon: Bell,
    },
    {
        title: 'Tenant Settings',
        href: '/settings/tenant',
        icon: Settings2,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Inbox',
        href: '/inbox',
        icon: MessageSquare,
    },
];

const roleNavAccess: Record<string, string[]> = {
    'Tenant Management': [],
    'System Health Panel': [],
    'Communications': [],
    'Audit Log': [],
    'Role Manager': ['Tenant Owner'],
    'Users': ['Tenant Admin', 'Tenant Owner', 'Branch Manager'],
    'Permissions': ['Tenant Owner'],
    'Branches': ['Tenant Owner'],
    'Units & Floor Plan': [
        'Tenant Owner',
        'Branch Manager',
        'Receptionist',
        'Housekeeping',
    ],
    'Booking Timeline': ['Tenant Owner', 'Branch Manager', 'Receptionist'],
    'Availability Calendar': ['Tenant Owner', 'Branch Manager', 'Receptionist'],
    'Channel Manager': ['Tenant Owner', 'Branch Manager'],
    'Staff Scheduling': ['Tenant Owner', 'Branch Manager'],
    'Attendance': ['Tenant Owner', 'Branch Manager'],
    'Task Management': ['Tenant Owner', 'Branch Manager', 'Housekeeping'],
    'Housekeeping': ['Tenant Owner', 'Branch Manager', 'Housekeeping'],
    'Maintenance': ['Tenant Owner', 'Branch Manager', 'Housekeeping'],
    'Customers': ['Tenant Owner', 'Branch Manager', 'Receptionist'],
    'Inbox': ['Tenant Admin', 'Tenant Owner', 'Branch Manager', 'Receptionist'],
    'Reports': ['Tenant Owner', 'Branch Manager', 'Accountant'],
    'Billing': ['Tenant Owner', 'Branch Manager', 'Accountant'],
    'Tenant Settings': ['Tenant Owner'],
    'Room Category': ['Tenant Owner'],
    'Amenities': ['Tenant Owner'],
};

export function AppSidebar() {
    const page = usePage();
    const { auth } = page.props;
    const featureFlags = (
        page.props as typeof page.props & { featureFlags?: Record<string, boolean> }
    ).featureFlags ?? {};
    const isSuperAdmin = Boolean(auth.user?.is_super_admin);
    const userRoles = auth.roles ?? [];
    // console.log('User Roles:', userRoles);
    const visibleMainNavItems = isSuperAdmin
        ? mainNavItems
              .filter((item) =>
                  ['Dashboard', 'Tenant Management', 'System Health Panel', 'Communications', 'Audit Log'].includes(item.title),
              )
              .map((item) =>
                  item.title === 'Dashboard'
                      ? { ...item, href: '/admin/dashboard' }
                      : item,
              )
        : mainNavItems.filter((item) => {
              const allowedRoles = roleNavAccess[item.title];
              const featureKey =
                  item.title === 'Channel Manager'
                      ? 'beta_channel_manager'
                      : item.title === 'Reports'
                        ? 'advanced_reports'
                        : null;

              return (
                  !allowedRoles ||
                  (allowedRoles.some((role) => userRoles.includes(role)) &&
                      (!featureKey || featureFlags?.[featureKey]))
              );
          });

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link
                                href={isSuperAdmin ? '/admin/dashboard' : '/dashboard'}
                                prefetch
                            >
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={visibleMainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
