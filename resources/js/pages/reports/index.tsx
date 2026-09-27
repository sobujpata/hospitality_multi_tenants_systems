import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Report = { title: string; columns: string[]; rows: (string | number)[][]; summary: Record<string, unknown> };
type Schedule = { id: number; report_type: string; recipient_email: string; format: string; cadence: string; run_at: string };
type Props = { reportTypes: Record<string, string>; selectedReport: string; start: string; end: string; report: Report; schedules: Schedule[] };

export default function Reports({ reportTypes, selectedReport, start: initialStart, end: initialEnd, report, schedules }: Props) {
    const [reportType, setReportType] = useState(selectedReport);
    const [start, setStart] = useState(initialStart);
    const [end, setEnd] = useState(initialEnd);
    const [schedule, setSchedule] = useState({ recipient_email: '', format: 'pdf', cadence: 'daily', run_at: '08:00' });
    const loadReport = (event: FormEvent) => {
        event.preventDefault();
        router.get('/reports', { report: reportType, start, end }, { preserveState: true, replace: true });
    };
    const createSchedule = (event: FormEvent) => {
        event.preventDefault();
        router.post('/report-schedules', { report_type: reportType, ...schedule });
    };
    const exportUrl = (format: string) => `/reports/export?report=${reportType}&start=${start}&end=${end}&format=${format}`;

    return (
        <>
            <Head title="Reports" />
            <div className="flex flex-1 flex-col gap-5 overflow-x-auto p-4">
                <div><h1 className="text-2xl font-semibold">Reports</h1><p className="text-sm text-muted-foreground">Review, export, and schedule operational reports.</p></div>
                <form className="flex flex-wrap items-end gap-3 rounded-xl border p-4" onSubmit={loadReport}>
                    <label className="grid gap-1 text-sm">Report<select className="h-9 rounded border px-2" value={reportType} onChange={(event) => setReportType(event.target.value)}>{Object.entries(reportTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                    <label className="grid gap-1 text-sm">From<input className="h-9 rounded border px-2" type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
                    <label className="grid gap-1 text-sm">To<input className="h-9 rounded border px-2" type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
                    <Button type="submit">Run report</Button>
                    <a className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm" href={exportUrl('pdf')}><Download size={15} /> PDF</a>
                    <a className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm" href={exportUrl('xlsx')}><Download size={15} /> Excel</a>
                </form>
                <section className="rounded-xl border p-4"><h2 className="mb-3 text-lg font-medium">{report.title}</h2><div className="mb-4 grid gap-3 sm:grid-cols-3">{Object.entries(report.summary).map(([key, value]) => <div className="rounded-lg bg-muted/40 p-3 text-sm" key={key}><div className="text-muted-foreground">{key.replaceAll('_', ' ')}</div><strong>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</strong></div>)}</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b">{report.columns.map((column) => <th className="p-2 font-medium" key={column}>{column}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr className="border-b" key={index}>{row.map((value, cell) => <td className="p-2" key={cell}>{String(value)}</td>)}</tr>)}</tbody></table>{report.rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No records found for this period.</p>}</div></section>
                <div className="grid gap-5 lg:grid-cols-2">
                    <section className="rounded-xl border p-4"><h2 className="mb-3 text-lg font-medium">Schedule a report</h2><form className="grid gap-3" onSubmit={createSchedule}><input className="h-9 rounded border px-2 text-sm" type="email" required placeholder="Recipient email" value={schedule.recipient_email} onChange={(event) => setSchedule({ ...schedule, recipient_email: event.target.value })} /><div className="grid grid-cols-3 gap-2"><select className="h-9 rounded border px-2 text-sm" value={schedule.format} onChange={(event) => setSchedule({ ...schedule, format: event.target.value })}><option value="pdf">PDF</option><option value="xlsx">Excel</option></select><select className="h-9 rounded border px-2 text-sm" value={schedule.cadence} onChange={(event) => setSchedule({ ...schedule, cadence: event.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select><input className="h-9 rounded border px-2 text-sm" type="time" value={schedule.run_at} onChange={(event) => setSchedule({ ...schedule, run_at: event.target.value })} /></div><Button type="submit">Create schedule</Button></form></section>
                    <section className="rounded-xl border p-4"><h2 className="mb-3 text-lg font-medium">Active schedules</h2>{schedules.length === 0 ? <p className="text-sm text-muted-foreground">No scheduled reports.</p> : schedules.map((item) => <div className="flex items-center justify-between border-b py-2 text-sm" key={item.id}><span>{reportTypes[item.report_type]} · {item.cadence} · {item.format}<br /><span className="text-xs text-muted-foreground">{item.recipient_email} at {item.run_at}</span></span><button aria-label="Delete schedule" onClick={() => router.delete(`/report-schedules/${item.id}`)}><Trash2 size={16} /></button></div>)}</section>
                </div>
            </div>
        </>
    );
}
