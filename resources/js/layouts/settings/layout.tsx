import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';

export default function SettingsLayout({ children }: PropsWithChildren) {
    return (
        <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
                <Heading
                    title="Settings"
                    description="Manage your profile and account settings"
                />
                <section className="w-full">
                    {children}
                </section>
            </div>
        </div>
    );
}
