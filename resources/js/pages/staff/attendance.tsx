import { Head, router, usePage } from '@inertiajs/react';
import { CalendarDays, Camera, CheckCircle2, Clock3, Copy, Download, KeyRound, QrCode, Search, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Employee = {
    id: number;
    name: string;
    department: string | null;
    branch_id: number;
};
type Branch = { id: number; name: string; timezone: string };
type AttendanceRecord = {
    employee_id: number;
    branch_id: number;
    clocked_in_at: string | null;
    clocked_out_at: string | null;
    is_late: boolean;
    employee?: { name: string };
};
type IssuedCredential = {
    employee_id: number;
    employee_name: string;
    qr_token: string;
    qr_image: string;
    pin_was_set: boolean;
} | null;
type Props = {
    date: string;
    canManageAllBranches: boolean;
    branches: Branch[];
    employees: Employee[];
    records: AttendanceRecord[];
    issuedCredential: IssuedCredential;
};
type BarcodeDetectorInstance = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

function formatTime(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }

    return value.match(/(?:T|\s)(\d{2}:\d{2})/)?.[1] ?? value.slice(0, 5);
}

export default function Attendance({ date, canManageAllBranches, branches, employees, records, issuedCredential: flashedCredential }: Props) {
    const page = usePage();
    const pageProps = page.props as typeof page.props & {
        errors?: Record<string, string>;
        flash?: { status?: string };
    };
    const errors = pageProps.errors ?? {};
    const [selectedDate, setSelectedDate] = useState(date);
    const [branchFilter, setBranchFilter] = useState(canManageAllBranches ? 'all' : String(branches[0]?.id ?? ''));
    const [clockBranchId, setClockBranchId] = useState(String(branches[0]?.id ?? ''));
    const [employeeId, setEmployeeId] = useState('');
    const [pin, setPin] = useState('');
    const [qrToken, setQrToken] = useState('');
    const [search, setSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [credentialEmployee, setCredentialEmployee] = useState<Employee | null>(null);
    const [credentialPin, setCredentialPin] = useState('');
    const [isCredentialOpen, setIsCredentialOpen] = useState(false);
    const [issuedCredential, setIssuedCredential] = useState<IssuedCredential>(flashedCredential);
    const [copyLabel, setCopyLabel] = useState('Copy QR token');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerError, setScannerError] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);

    const visibleEmployees = useMemo(() => employees.filter((employee) => (
        branchFilter === 'all' || String(employee.branch_id) === branchFilter
    )).filter((employee) => employee.name.toLowerCase().includes(search.trim().toLowerCase())), [employees, branchFilter, search]);
    const clockEmployees = useMemo(() => employees.filter((employee) => String(employee.branch_id) === clockBranchId), [employees, clockBranchId]);
    const clockBranchTimezone = branches.find((branch) => String(branch.id) === clockBranchId)?.timezone ?? 'Not configured';
    const visibleRecords = useMemo(() => records.filter((record) => (
        branchFilter === 'all' || String(record.branch_id) === branchFilter
    )), [records, branchFilter]);
    const clockedInCount = visibleRecords.filter((record) => record.clocked_in_at).length;
    const clockedOutCount = visibleRecords.filter((record) => record.clocked_out_at).length;
    const lateCount = visibleRecords.filter((record) => record.is_late).length;
    const notClockedInCount = Math.max(0, visibleEmployees.length - clockedInCount);
    const recordFor = (id: number) => records.find((record) => record.employee_id === id);

    useEffect(() => {
        setSelectedDate(date);
    }, [date]);

    useEffect(() => {
        if (!flashedCredential) {
            return;
        }

        setIssuedCredential(flashedCredential);
        setCredentialEmployee(employees.find((employee) => employee.id === flashedCredential.employee_id) ?? null);
        setIsCredentialOpen(true);
    }, [flashedCredential, employees]);

    useEffect(() => {
        if (!clockEmployees.some((employee) => String(employee.id) === employeeId)) {
            setEmployeeId(String(clockEmployees[0]?.id ?? ''));
        }
    }, [clockEmployees, employeeId]);

    useEffect(() => {
        if (!isScannerOpen) {
            return;
        }

        let active = true;
        let stream: MediaStream | null = null;
        let animationFrame = 0;
        setScannerError('');
        const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

        if (!Detector) {
            setScannerError('QR scanning is unavailable in this browser. Use a USB scanner to fill the token field instead.');
            return () => undefined;
        }
        const detector = new Detector({ formats: ['qr_code'] });

        const detectQrCode = async () => {
            const video = videoRef.current;
            if (!active || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
                if (active) {
                    animationFrame = window.requestAnimationFrame(() => void detectQrCode());
                }
                return;
            }

            try {
                const matches = await detector.detect(video);
                const token = matches[0]?.rawValue;
                if (token) {
                    setQrToken(token);
                    setIsScannerOpen(false);
                    return;
                }
            } catch {
                setScannerError('The camera could not read that QR code. Hold it steady and try again.');
            }

            if (active) {
                animationFrame = window.requestAnimationFrame(() => void detectQrCode());
            }
        };

        if (!navigator.mediaDevices?.getUserMedia) {
            setScannerError('Camera access is unavailable. Use a USB QR scanner to fill the token field instead.');
            return () => undefined;
        }

        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
            .then((cameraStream) => {
                if (!active) {
                    cameraStream.getTracks().forEach((track) => track.stop());
                    return;
                }
                stream = cameraStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = cameraStream;
                    void videoRef.current.play().then(() => void detectQrCode());
                }
            })
            .catch(() => setScannerError('Camera access was blocked. Allow camera access or use a USB QR scanner.'));

        return () => {
            active = false;
            window.cancelAnimationFrame(animationFrame);
            stream?.getTracks().forEach((track) => track.stop());
        };
    }, [isScannerOpen]);

    const changeDate = (value: string) => {
        setSelectedDate(value);
        router.get('/staff/attendance', { date: value }, { preserveState: true, preserveScroll: true });
    };

    const changeBranchFilter = (value: string) => {
        setBranchFilter(value);
        if (value !== 'all') {
            setClockBranchId(value);
        }
    };

    const submitClock = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);
        router.post('/staff/attendance/clock', {
            employee_id: Number(employeeId),
            branch_id: Number(clockBranchId),
            pin,
            qr_token: qrToken,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setPin('');
                setQrToken('');
            },
            onFinish: () => setIsSubmitting(false),
        });
    };

    const openCredentialDialog = (employee: Employee) => {
        setCredentialEmployee(employee);
        setCredentialPin('');
        setIssuedCredential(null);
        setCopyLabel('Copy QR token');
        setIsCredentialOpen(true);
    };

    const submitCredentials = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!credentialEmployee) {
            return;
        }

        router.post(`/staff/${credentialEmployee.id}/attendance-token`, {
            pin: credentialPin || null,
        }, { preserveScroll: true, onSuccess: () => setCredentialPin('') });
    };

    const copyQrToken = async () => {
        if (issuedCredential) {
            try {
                await navigator.clipboard.writeText(issuedCredential.qr_token);
                setCopyLabel('Copied');
            } catch {
                setCopyLabel('Select and copy the token');
            }
        }
    };
    const activeCredential = issuedCredential && issuedCredential.employee_id === credentialEmployee?.id
        ? issuedCredential
        : null;

    return (
        <>
            <Head title="Attendance" />
            <div className="space-y-6 p-4 sm:p-6">
                <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-6 text-white shadow-xl sm:p-8">
                    <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full border-[36px] border-white/5" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-medium text-indigo-200">
                                <Clock3 className="size-4" /> TEAM OPERATIONS
                            </div>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Attendance</h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">
                                Review daily attendance and record staff clock-ins using a PIN or QR token.
                            </p>
                        </div>
                        <label className="relative z-10 grid gap-1.5 text-sm font-medium text-indigo-50">
                            Attendance date
                            <span className="flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 backdrop-blur">
                                <CalendarDays className="size-4 text-indigo-200" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(event) => changeDate(event.target.value)}
                                    className="min-w-0 bg-transparent text-white outline-none [color-scheme:dark]"
                                />
                            </span>
                        </label>
                    </div>
                </header>

                {pageProps.flash?.status && (
                    <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {pageProps.flash.status}
                    </p>
                )}

                <Dialog open={isCredentialOpen} onOpenChange={setIsCredentialOpen}>
                    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{activeCredential ? 'Staff credentials ready' : `Set up ${credentialEmployee?.name ?? 'staff'} attendance`}</DialogTitle>
                            <DialogDescription>
                                {activeCredential
                                    ? 'Save or share this QR code with the staff member. The QR token is shown only once.'
                                    : 'Create a staff PIN and issue a new QR code. Issuing a new code replaces the previous QR token.'}
                            </DialogDescription>
                        </DialogHeader>
                        {activeCredential ? (
                            <div className="space-y-4 text-center">
                                <div className="mx-auto w-fit rounded-2xl border bg-white p-4 shadow-sm">
                                    <img src={activeCredential.qr_image} alt={`${activeCredential.employee_name} attendance QR code`} className="size-52" />
                                </div>
                                <p className="text-sm font-medium">{activeCredential.employee_name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {activeCredential.pin_was_set
                                        ? 'The PIN you entered is now active. Share it with the staff member securely.'
                                        : 'No new PIN was set; any existing PIN remains active.'}
                                </p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    <Button type="button" variant="outline" onClick={() => void copyQrToken()}><Copy className="mr-2 size-4" />{copyLabel}</Button>
                                    <Button asChild>
                                        <a href={activeCredential.qr_image} download={`${activeCredential.employee_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-attendance-qr.png`}>
                                            <Download className="mr-2 size-4" />Download QR
                                        </a>
                                    </Button>
                                </div>
                                <details className="rounded-xl bg-muted/50 p-3 text-left">
                                    <summary className="cursor-pointer text-sm font-medium">Show QR token text</summary>
                                    <code className="mt-2 block break-all text-xs text-muted-foreground">{activeCredential.qr_token}</code>
                                </details>
                            </div>
                        ) : (
                            <form onSubmit={submitCredentials} className="space-y-4">
                                <label className="grid gap-1.5 text-sm font-medium">
                                    Attendance PIN <span className="font-normal text-muted-foreground">(optional, 4–12 digits)</span>
                                    <input type="password" inputMode="numeric" pattern="[0-9]{4,12}" maxLength={12} autoComplete="new-password" className="h-10 rounded-lg border bg-background px-3 font-normal" placeholder="Set or change PIN" value={credentialPin} onChange={(event) => setCredentialPin(event.target.value)} />
                                    {errors.pin && <span role="alert" className="text-xs text-destructive">{errors.pin}</span>}
                                </label>
                                <p className="rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-900">
                                    The PIN is saved securely and cannot be viewed later. A new QR code will be generated each time.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={() => setIsCredentialOpen(false)}>Cancel</Button>
                                    <Button type="submit">Generate credentials</Button>
                                </div>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>

                <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Scan staff QR code</DialogTitle>
                            <DialogDescription>Scan the QR for the selected staff member. The token will fill the attendance form.</DialogDescription>
                        </DialogHeader>
                        {scannerError ? (
                            <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{scannerError}</p>
                        ) : (
                            <video ref={videoRef} autoPlay playsInline className="aspect-video w-full rounded-xl bg-slate-950 object-cover" />
                        )}
                    </DialogContent>
                </Dialog>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Attendance summary">
                    <SummaryCard label="Active staff" value={visibleEmployees.length} icon={<Users className="size-5" />} accent="bg-indigo-50 text-indigo-700" />
                    <SummaryCard label="Clocked in" value={clockedInCount} icon={<Clock3 className="size-5" />} accent="bg-emerald-50 text-emerald-700" />
                    <SummaryCard label="Clocked out" value={clockedOutCount} icon={<CheckCircle2 className="size-5" />} accent="bg-sky-50 text-sky-700" />
                    <SummaryCard label="Late arrivals" value={lateCount} icon={<Clock3 className="size-5" />} accent="bg-amber-50 text-amber-700" />
                </section>

                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Daily attendance</h2>
                                <p className="mt-1 text-sm text-muted-foreground">{notClockedInCount} staff not clocked in on {date}.</p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                {canManageAllBranches && (
                                    <select aria-label="Filter by branch" className="h-10 rounded-lg border bg-background px-3 text-sm" value={branchFilter} onChange={(event) => changeBranchFilter(event.target.value)}>
                                        <option value="all">All branches</option>
                                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                                    </select>
                                )}
                                <label className="flex h-10 items-center gap-2 rounded-lg border px-3 text-muted-foreground">
                                    <Search className="size-4" />
                                    <input aria-label="Search employees" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff" className="w-full bg-transparent text-sm text-foreground outline-none sm:w-36" />
                                </label>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr><th className="px-5 py-3">Staff member</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">Clock in</th><th className="px-4 py-3">Clock out</th><th className="px-4 py-3">Status</th><th className="px-5 py-3">Credentials</th></tr>
                                </thead>
                                <tbody className="divide-y">
                                    {visibleEmployees.map((employee) => {
                                        const record = recordFor(employee.id);
                                        const branch = branches.find((item) => item.id === employee.branch_id);
                                        const branchName = branch?.name ?? '—';
                                        const status = record?.is_late ? 'Late' : record?.clocked_out_at ? 'Completed' : record?.clocked_in_at ? 'On duty' : 'Not clocked in';
                                        const statusClass = record?.is_late
                                            ? 'bg-amber-100 text-amber-800'
                                            : record?.clocked_out_at
                                                ? 'bg-sky-100 text-sky-800'
                                                : record?.clocked_in_at
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-slate-100 text-slate-600';

                                        return (
                                            <tr key={employee.id} className="transition hover:bg-muted/30">
                                                <td className="px-5 py-3.5">
                                                    <div className="font-medium">{employee.name}</div>
                                                    <div className="mt-0.5 text-xs text-muted-foreground">{employee.department ?? 'Team member'}</div>
                                                </td>
                                                <td className="px-4 py-3.5"><div>{branchName}</div><div className="mt-0.5 text-xs text-muted-foreground">{branch?.timezone ?? 'Timezone not set'}</div></td>
                                                <td className="px-4 py-3.5 tabular-nums">{formatTime(record?.clocked_in_at)}</td>
                                                <td className="px-4 py-3.5 tabular-nums">{formatTime(record?.clocked_out_at)}</td>
                                                <td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>{status}</span></td>
                                                <td className="px-5 py-3.5">
                                                    <Button type="button" size="sm" variant="outline" onClick={() => openCredentialDialog(employee)}>
                                                        <KeyRound className="mr-1.5 size-3.5" /> Set up
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!visibleEmployees.length && (
                                        <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No staff match this branch or search.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="rounded-2xl border bg-card p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><QrCode className="size-5" /></span>
                            <div>
                                <h2 className="font-semibold">Record attendance</h2>
                                <p className="mt-1 text-sm leading-5 text-muted-foreground">Verify staff with their PIN or QR token. Submitted times use the selected branch timezone.</p>
                            </div>
                        </div>
                        <form className="mt-5 space-y-4" onSubmit={submitClock}>
                            {canManageAllBranches && (
                                <label className="grid gap-1.5 text-sm font-medium">
                                    Branch
                                    <select required className="h-10 rounded-lg border bg-background px-3 font-normal" value={clockBranchId} onChange={(event) => setClockBranchId(event.target.value)}>
                                        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                                    </select>
                                    {errors.branch_id && <span role="alert" className="text-xs text-destructive">{errors.branch_id}</span>}
                                </label>
                            )}
                            <p className="text-xs text-muted-foreground">Branch timezone: <span className="font-medium text-foreground">{clockBranchTimezone}</span></p>
                            <label className="grid gap-1.5 text-sm font-medium">
                                Staff member
                                <select required disabled={!clockEmployees.length} className="h-10 rounded-lg border bg-background px-3 font-normal disabled:opacity-60" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                                    {clockEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                                </select>
                                {errors.employee_id && <span role="alert" className="text-xs text-destructive">{errors.employee_id}</span>}
                                {!clockEmployees.length && <span className="text-xs text-muted-foreground">No active staff assigned to this branch.</span>}
                            </label>
                            <label className="grid gap-1.5 text-sm font-medium">
                                Attendance PIN
                                <input type="password" inputMode="numeric" autoComplete="off" className="h-10 rounded-lg border bg-background px-3 font-normal" placeholder="Enter PIN" value={pin} onChange={(event) => setPin(event.target.value)} />
                                {errors.pin && <span role="alert" className="text-xs text-destructive">{errors.pin}</span>}
                            </label>
                            <div className="flex items-center justify-between gap-3">
                                <div className="relative flex flex-1 items-center gap-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or scan QR</div>
                                <Button type="button" size="sm" variant="outline" onClick={() => setIsScannerOpen(true)} disabled={!employeeId}>
                                    <Camera className="mr-1.5 size-4" /> Use camera
                                </Button>
                            </div>
                            <label className="grid gap-1.5 text-sm font-medium">
                                QR token
                                <input autoComplete="off" className="h-10 rounded-lg border bg-background px-3 font-normal" placeholder="Paste scanned token" value={qrToken} onChange={(event) => setQrToken(event.target.value)} />
                            </label>
                            <Button type="button" variant="outline" className="w-full" onClick={() => setIsScannerOpen(true)} disabled={!employeeId}>
                                <Camera className="mr-2 size-4" /> Scan QR with camera
                            </Button>
                            {scannerError && <p role="alert" className="text-xs text-amber-700">{scannerError}</p>}
                            <Button className="w-full" type="submit" disabled={isSubmitting || !employeeId || !clockBranchId}>
                                {isSubmitting ? 'Saving attendance…' : 'Clock in / out'}
                            </Button>
                            <p className="text-xs leading-5 text-muted-foreground">The first successful entry clocks staff in. A second entry clocks them out.</p>
                        </form>
                    </section>
                </div>
            </div>
        </>
    );
}

function SummaryCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm">
            <span className={`flex size-11 items-center justify-center rounded-xl ${accent}`}>{icon}</span>
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
            </div>
        </div>
    );
}

Attendance.layout = { breadcrumbs: [{ title: 'Attendance', href: '/staff/attendance' }] };
