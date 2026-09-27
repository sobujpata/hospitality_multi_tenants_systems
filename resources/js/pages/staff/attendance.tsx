import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Employee = { id: number; name: string; department: string | null; attendance_qr_token: string | null };
type Branch = { id: number; name: string };
type Record = { employee_id: number; clocked_in_at: string | null; clocked_out_at: string | null; is_late: boolean; employee?: { name: string } };
type Props = { date: string; branches: Branch[]; employees: Employee[]; records: Record[] };

export default function Attendance({ date, branches, employees, records }: Props) {
    const [employeeId, setEmployeeId] = useState(String(employees[0]?.id ?? ''));
    const [branchId, setBranchId] = useState(String(branches[0]?.id ?? ''));
    const [pin, setPin] = useState('');
    const [qrToken, setQrToken] = useState('');
    const recordFor = (id: number) => records.find((record) => record.employee_id === id);
    return <><Head title="Attendance tracker" /><div className="space-y-5 p-6"><div><h1 className="text-2xl font-semibold">Attendance tracker</h1><p className="text-sm text-muted-foreground">Daily summary for {date}. Staff can clock in or out with a PIN or QR token.</p></div><form className="flex flex-wrap gap-2 rounded-xl border p-4" onSubmit={(event) => { event.preventDefault(); router.post('/staff/attendance/clock', { employee_id: Number(employeeId), branch_id: Number(branchId), pin, qr_token: qrToken }); }}><select className="h-9 rounded border px-2" value={branchId} onChange={(event) => setBranchId(event.target.value)}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><select className="h-9 rounded border px-2" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><input className="h-9 rounded border px-2" type="password" placeholder="Attendance PIN" value={pin} onChange={(event) => setPin(event.target.value)} /><input className="h-9 rounded border px-2" placeholder="Scanned QR token" value={qrToken} onChange={(event) => setQrToken(event.target.value)} /><Button type="submit">Clock in / out</Button></form><div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs uppercase"><tr><th className="p-3">Employee</th><th className="p-3">Clock in</th><th className="p-3">Clock out</th><th className="p-3">Status</th></tr></thead><tbody>{employees.map((employee) => { const record = recordFor(employee.id); return <tr className="border-t" key={employee.id}><td className="p-3 font-medium">{employee.name}</td><td className="p-3">{record?.clocked_in_at ?? '—'}</td><td className="p-3">{record?.clocked_out_at ?? '—'}</td><td className="p-3">{record?.is_late ? <span className="text-red-600">Late arrival</span> : record ? 'On time' : 'Not clocked in'}</td></tr>; })}</tbody></table></div></div></>;
}
Attendance.layout = { breadcrumbs: [{ title: 'Attendance tracker', href: '/staff/attendance' }] };
