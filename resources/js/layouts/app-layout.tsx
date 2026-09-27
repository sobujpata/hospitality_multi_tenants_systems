import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import type { BreadcrumbItem } from '@/types';

type BrandingProps = {
    tenantBranding?: {
        primaryColor?: string;
        secondaryColor?: string;
    };
};

export default function AppLayout({
    breadcrumbs = [],
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
}) {
    const { tenantBranding } = usePage().props as BrandingProps;

    useEffect(() => {
        document.documentElement.style.setProperty('--primary', tenantBranding?.primaryColor ?? '#0f766e');
        document.documentElement.style.setProperty('--secondary', tenantBranding?.secondaryColor ?? '#d97706');
    }, [tenantBranding]);

    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs}>
            {children}
        </AppLayoutTemplate>
    );
}
