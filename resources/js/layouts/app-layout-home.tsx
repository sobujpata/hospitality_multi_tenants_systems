import Navbar from '@/partials/navbar';
import Footer from '@/partials/footer';

export default function AppLayoutHome({ children }: { children: React.ReactNode }) {
    return <div className="min-h-screen bg-slate-50 text-slate-900"><Navbar /><main>{children}</main><Footer /></div>;
}