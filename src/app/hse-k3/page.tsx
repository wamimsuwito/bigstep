

'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, User, LogOut, Fingerprint, Briefcase, LayoutDashboard, Users, Database, History, ClipboardList, AlertTriangle, Printer, Eye, Camera, UserPlus, MapPin, Save, Calendar as CalendarIcon, FilterX, Clock } from 'lucide-react';
import type { UserData, AttendanceRecord, ActivityLog, OvertimeRecord, ProductionData, Report } from '@/lib/types';
import { db, collection, query, where, getDocs, onSnapshot, doc, updateDoc, Timestamp, setDoc, getDoc, orderBy } from '@/lib/firebase';
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarFooter, SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, startOfToday, formatDistanceStrict, isAfter, subDays, startOfDay, endOfDay, isWithinInterval, parseISO, isDate, differenceInMinutes, differenceInDays, subHours } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { printElement, cn } from '@/lib/utils';
import HseAttendancePrintLayout from '@/components/hse-attendance-print-layout';
import HseActivityPrintLayout from '@/components/hse-activity-print-layout';
import AttendanceHistoryPrintLayout from '@/components/attendance-history-print-layout';
import AttendanceTable from '@/components/attendance-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";


type ActiveMenu = 'Absensi Harian' | 'Database Absensi' | 'Kegiatan Harian' | 'Database Kegiatan' | 'Jumlah Karyawan Hari Ini';

const menuItems: { name: ActiveMenu; icon: React.ElementType }[] = [
    { name: 'Absensi Harian', icon: Users },
    { name: 'Database Absensi', icon: Database },
    { name: 'Kegiatan Harian', icon: ClipboardList },
    { name: 'Database Kegiatan', icon: History },
    { name: 'Jumlah Karyawan Hari Ini', icon: UserPlus },
];

const CHECK_IN_DEADLINE = { hours: 7, minutes: 30 };

const toValidDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date;
    }
    return null;
};


const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    const date = toValidDate(timestamp);
    if (!date) return '-';
    try {
        return format(date, formatString, { locale: localeID });
    } catch (error) {
        return '-';
    }
};


const DailyAttendanceComponent = ({ users, location }: { users: (UserData & { attendance?: AttendanceRecord; overtime?: OvertimeRecord; productions?: ProductionData[] })[]; location: string }) => {
    
    const calculateLateMinutes = (checkInTime: any): number => {
        if (!checkInTime) return 0;
        const date = toValidDate(checkInTime);
        if (!date) return 0;
        const deadline = new Date(date).setHours(CHECK_IN_DEADLINE.hours, CHECK_IN_DEADLINE.minutes, 0, 0);
        const late = differenceInMinutes(date, deadline);
        return late > 0 ? late : 0;
    };
    
    const dataToDisplay = useMemo(() => {
        return users.map(user => ({
            ...user,
            id: user.id, // For key
            username: user.username,
            nik: user.nik,
            jabatan: user.jabatan,
            checkInTime: user.attendance?.checkInTime,
            checkOutTime: user.attendance?.checkOutTime,
            checkInPhoto: user.attendance?.checkInPhoto,
            checkOutPhoto: user.attendance?.checkOutPhoto,
            checkInLocationName: user.attendance?.checkInLocationName || user.overtime?.checkInLocationName,
            lateMinutes: calculateLateMinutes(user.attendance?.checkInTime),
            overtimeData: user.overtime,
            ritPertama: user.productions?.[0] ? safeFormatTimestamp(user.productions[0].jamMulai, 'HH:mm') : '-',
            ritTerakhir: user.productions?.[user.productions.length - 1] ? safeFormatTimestamp(user.productions[user.productions.length - 1].jamSelesai, 'HH:mm') : '-'
        }));
    }, [users]);
    
    return (
        <>
            <div className="hidden">
              <div id="hse-print-area">
                <HseAttendancePrintLayout data={users} location={location} />
              </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className='flex justify-between items-center'>
                        <span>Daftar Absensi &amp; Kegiatan Harian</span>
                        <div className="flex items-center gap-4">
                            <Badge variant="outline">{format(new Date(), "EEEE, dd MMMM yyyy", { locale: localeID })}</Badge>
                            <Button variant="outline" onClick={() => printElement('hse-print-area')}>
                                <Printer className="mr-2 h-4 w-4" />
                                Cetak
                            </Button>
                        </div>
                    </CardTitle>
                    <CardDescription>Memantau kehadiran dan aktivitas karyawan di lokasi {location} hari ini.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AttendanceTable records={dataToDisplay} />
                </CardContent>
            </Card>
        </>
    );
};

const PhotoViewer = ({ photoUrl, timestamp }: { photoUrl?: string | null, timestamp?: any }) => {
    if (!photoUrl) return <span>-</span>;
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6"><Eye className="h-4 w-4" /></Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Foto Kegiatan</DialogTitle>
                    <DialogDescription>{safeFormatTimestamp(timestamp, 'dd MMM yyyy, HH:mm:ss')}</DialogDescription>
                    <DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-4 top-3"><X className="h-4 w-4"/></Button></DialogClose>
                </DialogHeader>
                <img src={photoUrl} alt="Foto Kegiatan" className="rounded-lg w-full h-auto mt-4" data-ai-hint="activity evidence"/>
            </DialogContent>
        </Dialog>
    );
};

const AttendanceHistoryComponent = ({ users, allAttendance, allOvertime }: { users: UserData[], allAttendance: AttendanceRecord[], allOvertime: OvertimeRecord[] }) => {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 7), to: new Date() });
    const [userFilter, setUserFilter] = useState('');
    
    const calculateLateMinutes = useCallback((checkInTime: any): number => {
        if (!checkInTime) return 0;
        const date = toValidDate(checkInTime);
        if(!date) return 0;
        const deadline = new Date(date).setHours(CHECK_IN_DEADLINE.hours, CHECK_IN_DEADLINE.minutes, 0, 0);
        const late = differenceInMinutes(date, deadline);
        return late > 0 ? late : 0;
    }, []);

    const filteredRecords = useMemo(() => {
        let results = allAttendance;
        if (dateRange?.from) {
            const fromDate = startOfDay(dateRange.from);
            const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            results = results.filter(item => {
                const itemDate = toValidDate(item.checkInTime);
                return itemDate && isWithinInterval(itemDate, { start: fromDate, end: toDate });
            });
        }
        
        if (userFilter) {
             results = results.filter(item => 
                item.username.toLowerCase().includes(userFilter.toLowerCase()) || (users.find(u => u.id === item.userId)?.nik.toLowerCase().includes(userFilter.toLowerCase()))
             );
        }
        
        const combined = results.map(att => {
            const user = users.find(u => u.id === att.userId);
            const overtime = allOvertime.find(ovt => ovt.userId === att.userId && toValidDate(ovt.checkInTime) && toValidDate(att.checkInTime) && isSameDay(toValidDate(ovt.checkInTime)!, toValidDate(att.checkInTime)!));
            return {
                ...user,
                ...att,
                id: `${att.id}-${user?.id || ''}`,
                lateMinutes: calculateLateMinutes(att.checkInTime),
                overtimeData: overtime,
            }
        });

        return combined.sort((a,b) => toValidDate(b.checkInTime)!.getTime() - toValidDate(a.checkInTime)!.getTime());
    }, [allAttendance, allOvertime, users, dateRange, userFilter, calculateLateMinutes]);
    
    const summary = useMemo(() => {
        const uniqueDays = new Set(filteredRecords.map(r => format(toValidDate(r.checkInTime)!, 'yyyy-MM-dd')));
        const totalWorkDays = uniqueDays.size;

        return {
            totalHariKerja: totalWorkDays,
            totalJamLembur: filteredRecords.reduce((sum, rec) => {
                const overtime = rec.overtimeData;
                if(overtime?.checkInTime && overtime?.checkOutTime) {
                    const diff = differenceInMinutes(toValidDate(overtime.checkOutTime)!, toValidDate(overtime.checkInTime)!);
                    return sum + Math.floor((diff > 0 ? diff : 0) / 60);
                }
                return sum;
            }, 0),
            totalMenitTerlambat: filteredRecords.reduce((sum, rec) => sum + (rec.lateMinutes || 0), 0),
            totalHariAbsen: userFilter ? (dateRange?.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) + 1 - totalWorkDays : 0) : 0, // Only for single user
        }
    }, [filteredRecords, userFilter, dateRange]);

    return (
        <>
        <div className="hidden">
            <div id="history-print-area">
                <AttendanceHistoryPrintLayout records={filteredRecords as any} period={dateRange} summary={summary} />
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Database Absensi</CardTitle>
                <CardDescription>Cari dan lihat riwayat absensi seluruh karyawan di lokasi Anda.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2 items-center mb-4">
                    <Input 
                        placeholder="Cari nama karyawan atau NIK..."
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        className="w-full sm:w-auto"
                    />
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button id="date" variant={"outline"} className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !dateRange && "text-muted-foreground" )}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                    <Button variant="ghost" onClick={() => {setDateRange(undefined); setUserFilter('')}} disabled={!dateRange && !userFilter}><FilterX className="mr-2 h-4 w-4"/>Reset</Button>
                    <Button variant="outline" className="ml-auto" onClick={() => printElement('history-print-area')} disabled={filteredRecords.length === 0}><Printer className="mr-2 h-4 w-4"/>Cetak Hasil</Button>
                </div>
                <AttendanceTable records={filteredRecords}/>
            </CardContent>
        </Card>
        </>
    );
};


const DailyActivitiesComponent = ({ location }: { location: string }) => {
    const [combinedData, setCombinedData] = useState<(UserData & { activities?: ActivityLog[] })[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

     useEffect(() => {
        if (!location) return;
        setIsDataLoading(true);

        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5, 30, 0); // 5:30 AM today
        const dataStartTime = isAfter(now, cutoff) ? cutoff : subHours(cutoff, 24);

        const usersQuery = query(collection(db, 'users'), where('lokasi', '==', location));
        
        const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
            const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserData);
            const userIds = usersData.map(u => u.id);

            if (userIds.length === 0) {
                setCombinedData([]);
                setIsDataLoading(false);
                return;
            }

            const activitiesQuery = query(collection(db, 'kegiatan_harian'), where('userId', 'in', userIds));
            const unsubActivities = onSnapshot(activitiesQuery, (actSnapshot) => {
                const activitiesData = actSnapshot.docs
                    .map(d => d.data() as ActivityLog)
                    .filter(r => r.createdAt && isAfter(toValidDate(r.createdAt)!, dataStartTime));

                const finalData = usersData.map(user => ({
                    ...user,
                    activities: activitiesData.filter(a => a.userId === user.id).sort((a,b) => toValidDate(a.createdAt)!.getTime() - toValidDate(b.createdAt)!.getTime())
                })).filter(u => u.activities && u.activities.length > 0);

                setCombinedData(finalData);
                setIsDataLoading(false);
            });
            return () => unsubActivities();
        });

        return () => unsubUsers();

    }, [location]);

    const filteredCombinedData = useMemo(() => {
        if (!searchTerm) {
            return combinedData;
        }
        const lowercasedFilter = searchTerm.toLowerCase();
        return combinedData.filter(user =>
            user.username.toLowerCase().includes(lowercasedFilter) ||
            user.nik.toLowerCase().includes(lowercasedFilter)
        );
    }, [combinedData, searchTerm]);


    const calculateDuration = (start: any, end: any): string => {
        if (!start || !end) return '-';
        const startDate = toValidDate(start);
        const endDate = toValidDate(end);
        if (!startDate || !endDate) return '-';
        return formatDistanceStrict(endDate, startDate, { locale: localeID });
    };

    return (
        <>
            <div className="hidden">
                <div id="hse-activity-print-area">
                    <HseActivityPrintLayout data={filteredCombinedData} location={location} />
                </div>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle className='flex justify-between items-center'>
                        <span>Laporan Kegiatan Harian</span>
                        <div className="flex items-center gap-4">
                             <Input
                                placeholder="Cari Nama / NIK..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-[200px]"
                            />
                            <Badge variant="outline">{format(new Date(), "EEEE, dd MMMM yyyy", { locale: localeID })}</Badge>
                            <Button variant="outline" onClick={() => printElement('hse-activity-print-area')}>
                                <Printer className="mr-2 h-4 w-4" />
                                Cetak
                            </Button>
                        </div>
                    </CardTitle>
                    <CardDescription>Rincian aktivitas yang dilaporkan oleh karyawan di lokasi {location} hari ini.</CardDescription>
                </CardHeader>
                 <CardContent>
                    {isDataLoading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                    ) : (
                    <div className="overflow-x-auto border rounded-lg">
                        <Table>
                            <TableHeader><TableRow><TableHead>No</TableHead><TableHead>Nama/NIK</TableHead><TableHead>Jabatan</TableHead><TableHead className='w-[30%]'>Deskripsi Kegiatan</TableHead><TableHead className='text-center'>Sebelum</TableHead><TableHead className='text-center'>Proses</TableHead><TableHead className='text-center'>Sesudah</TableHead><TableHead className='text-center'>Durasi</TableHead></TableRow></TableHeader>
                            <TableBody>
                            {filteredCombinedData.length > 0 ? filteredCombinedData.flatMap((user, userIndex) => 
                                (user.activities && user.activities.length > 0) ? user.activities.map((activity, activityIndex) => (
                                    <TableRow key={`${user.id}-${activity.id}`}>
                                        {activityIndex === 0 && <TableCell rowSpan={user.activities?.length}>{userIndex + 1}</TableCell>}
                                        {activityIndex === 0 && <TableCell rowSpan={user.activities?.length} className="align-top"><p className='font-semibold'>{user.username}</p><p className='text-xs text-muted-foreground'>{user.nik}</p></TableCell>}
                                        {activityIndex === 0 && <TableCell rowSpan={user.activities?.length} className="align-top">{user.jabatan}</TableCell>}
                                        <TableCell className="align-top text-xs">{activity.description}</TableCell>
                                        <TableCell className='text-center align-top'><PhotoViewer photoUrl={activity.photoInitial} timestamp={activity.createdAt} /></TableCell>
                                        <TableCell className='text-center align-top'><PhotoViewer photoUrl={activity.photoInProgress} timestamp={activity.timestampInProgress} /></TableCell>
                                        <TableCell className='text-center align-top'><PhotoViewer photoUrl={activity.photoCompleted} timestamp={activity.timestampCompleted} /></TableCell>
                                        <TableCell className='text-center align-top text-xs font-semibold'>{calculateDuration(activity.createdAt, activity.timestampCompleted)}</TableCell>
                                    </TableRow>
                                )) : null
                            ) : (
                                <TableRow><TableCell colSpan={8} className="h-48 text-center text-muted-foreground">Tidak ada laporan kegiatan untuk hari ini.</TableCell></TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>
                    )}
                 </CardContent>
            </Card>
        </>
    )
}

const ActivityHistoryComponent = ({ allActivities, users, location }: { allActivities: ActivityLog[], users: UserData[], location: string }) => {
    const { toast } = useToast();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 7), to: new Date() });
    
    const calculateDuration = (start: any, end: any): string => {
        if (!start || !end) return '-';
        const startDate = toValidDate(start);
        const endDate = toValidDate(end);
        if (!startDate || !endDate) return '-';
        return formatDistanceStrict(endDate, startDate, { locale: localeID });
    };

    const getStatusBadge = (status: string) => {
        switch (status) { case 'completed': return <Badge className="bg-green-100 text-green-800">Selesai</Badge>; case 'in_progress': return <Badge className="bg-blue-100 text-blue-800">Proses</Badge>; case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Menunggu</Badge>; default: return <Badge>{status}</Badge>; }
    };
    
    const filteredActivities = useMemo(() => {
        let results = allActivities.filter(act => users.some(u => u.id === act.userId));

        if (dateRange?.from) {
            const fromDate = startOfDay(dateRange.from);
            const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            results = results.filter(item => {
                const itemDate = toValidDate(item.createdAt);
                return itemDate && isWithinInterval(itemDate, { start: fromDate, end: toDate });
            });
        }
        return results;
    }, [allActivities, users, dateRange]);
    
     const groupedActivities = useMemo(() => {
        return filteredActivities.reduce((acc, activity) => {
            const key = activity.username;
            if (!acc[key]) { acc[key] = []; }
            acc[key].push(activity);
            return acc;
        }, {} as Record<string, ActivityLog[]>);
    }, [filteredActivities]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Database Kegiatan</CardTitle>
                <CardDescription>Cari dan lihat riwayat kegiatan seluruh karyawan di lokasi Anda.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2 mb-4">
                    <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent></Popover>
                    <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)} disabled={!dateRange}><FilterX /></Button>
                    <Button variant="outline" className="ml-auto" onClick={() => {/* TODO: Print logic */}} disabled={filteredActivities.length === 0}><Printer className="mr-2 h-4 w-4"/>Cetak Hasil</Button>
                </div>
                <Accordion type="single" collapsible className="w-full">{Object.keys(groupedActivities).length > 0 ? Object.entries(groupedActivities).map(([username, activities]) => (
                    <AccordionItem value={username} key={username}><AccordionTrigger><div className='flex items-center justify-between w-full'><div className="flex items-center gap-3 text-left"><p className="font-semibold text-sm">{username}</p></div></div></AccordionTrigger>
                        <AccordionContent className="pl-4"><div className="space-y-3 p-2 bg-muted/30 rounded-md">{activities.map(activity => (<div key={activity.id} className="p-3 border rounded-md bg-background"><div className="flex justify-between items-start"><div><p className="text-sm text-muted-foreground">{activity.description}</p><div className="text-xs text-muted-foreground space-y-1 mt-1"><p className="flex items-center gap-2"><Clock size={14}/>Target: {safeFormatTimestamp(activity.targetTimestamp, 'dd MMM, HH:mm')}</p></div></div>{getStatusBadge(activity.status)}</div><div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t"><PhotoViewer photoUrl={activity.photoInitial} timestamp={activity.createdAt} /><PhotoViewer photoUrl={activity.photoInProgress} timestamp={activity.timestampInProgress} /><PhotoViewer photoUrl={activity.photoCompleted} timestamp={activity.timestampCompleted} /></div></div>))}</div></AccordionContent>
                    </AccordionItem>
                )) : <div className="text-center py-10 text-muted-foreground">Tidak ada aktivitas pada periode ini.</div>}</Accordion>
            </CardContent>
        </Card>
    );
}

const EmployeeSummaryComponent = ({ usersInLocation }: { usersInLocation: UserData[] }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTodaySummarySaved, setIsTodaySummarySaved] = useState(false);
    const [counts, setCounts] = useState({ total: '', masuk: '', ijin: '', alpha: '', sakit: '', cuti: '', jadwalOff: '' });

    const userInfo: UserData | null = useMemo(() => JSON.parse(localStorage.getItem('user') || 'null'), []);
    const todayId = useMemo(() => `${userInfo?.lokasi}_${format(new Date(), 'yyyy-MM-dd')}`, [userInfo?.lokasi]);

    useEffect(() => {
        const checkExistingSummary = async () => {
            if (!userInfo?.lokasi) return;
            const summaryDocRef = doc(db, 'hse_daily_summaries', todayId);
            const summaryDoc = await getDoc(summaryDocRef);
            if (summaryDoc.exists()) {
                const data = summaryDoc.data();
                setCounts({
                    total: String(data.total || ''),
                    masuk: String(data.masuk || ''),
                    ijin: String(data.ijin || ''),
                    alpha: String(data.alpha || ''),
                    sakit: String(data.sakit || ''),
                    cuti: String(data.cuti || ''),
                    jadwalOff: String(data.jadwalOff || ''),
                });
                setIsTodaySummarySaved(true);
            } else {
                 setCounts({ total: String(usersInLocation.length), masuk: '', ijin: '', alpha: '', sakit: '', cuti: '', jadwalOff: '' });
                 setIsTodaySummarySaved(false);
            }
        };
        checkExistingSummary();
    }, [todayId, userInfo?.lokasi, usersInLocation]);

    const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCounts(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSaveSummary = async () => {
        if (!userInfo?.lokasi) return;
        setIsSubmitting(true);
        const dataToSave = {
            id: todayId,
            location: userInfo.lokasi,
            date: format(new Date(), 'yyyy-MM-dd'),
            createdAt: Timestamp.now(),
            total: Number(counts.total) || 0,
            masuk: Number(counts.masuk) || 0,
            ijin: Number(counts.ijin) || 0,
            alpha: Number(counts.alpha) || 0,
            sakit: Number(counts.sakit) || 0,
            cuti: Number(counts.cuti) || 0,
            jadwalOff: Number(counts.jadwalOff) || 0,
        };

        try {
            const summaryDocRef = doc(db, 'hse_daily_summaries', todayId);
            await setDoc(summaryDocRef, dataToSave);
            toast({ title: 'Laporan Disimpan', description: 'Ringkasan jumlah karyawan hari ini telah disimpan.' });
            setIsTodaySummarySaved(true);
        } catch (error) {
            console.error("Error saving summary:", error);
            toast({ title: 'Gagal Menyimpan', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Jumlah Karyawan Hari Ini</CardTitle>
                <CardDescription>Ringkasan status kehadiran karyawan di lokasi {userInfo?.lokasi} pada tanggal {format(new Date(), 'dd MMMM yyyy', { locale: localeID })}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                        <Label htmlFor="total">Total Karyawan</Label>
                        <Input id="total" name="total" type="number" placeholder="0" value={counts.total} onChange={handleCountChange} disabled={isTodaySummarySaved} className="font-bold text-lg h-12" />
                    </div>
                    <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                        <Label htmlFor="masuk">Karyawan Masuk Hari Ini</Label>
                        <Input id="masuk" name="masuk" type="number" placeholder="0" value={counts.masuk} onChange={handleCountChange} disabled={isTodaySummarySaved} className="font-bold text-lg h-12" />
                    </div>
                     <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                        <Label htmlFor="ijin">Ijin</Label>
                        <Input id="ijin" name="ijin" type="number" placeholder="0" value={counts.ijin} onChange={handleCountChange} disabled={isTodaySummarySaved} className="text-lg h-12"/>
                    </div>
                     <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                        <Label htmlFor="alpha">Alpha</Label>
                        <Input id="alpha" name="alpha" type="number" placeholder="0" value={counts.alpha} onChange={handleCountChange} disabled={isTodaySummarySaved} className="text-lg h-12"/>
                    </div>
                     <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                        <Label htmlFor="sakit">Sakit</Label>
                        <Input id="sakit" name="sakit" type="number" placeholder="0" value={counts.sakit} onChange={handleCountChange} disabled={isTodaySummarySaved} className="text-lg h-12"/>
                    </div>
                     <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                        <Label htmlFor="cuti">Cuti</Label>
                        <Input id="cuti" name="cuti" type="number" placeholder="0" value={counts.cuti} onChange={handleCountChange} disabled={isTodaySummarySaved} className="text-lg h-12"/>
                    </div>
                     <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                        <Label htmlFor="jadwalOff">Jadwal Off</Label>
                        <Input id="jadwalOff" name="jadwalOff" type="number" placeholder="0" value={counts.jadwalOff} onChange={handleCountChange} disabled={isTodaySummarySaved} className="text-lg h-12"/>
                    </div>
                </div>
                 <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveSummary} disabled={isSubmitting || isTodaySummarySaved}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        {isTodaySummarySaved ? 'Laporan Hari Ini Sudah Disimpan' : 'Simpan Laporan Harian'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};


export default function HseK3Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('Absensi Harian');

  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [allOvertime, setAllOvertime] = useState<OvertimeRecord[]>([]);
  const [allProductions, setAllProductions] = useState<ProductionData[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const userData = JSON.parse(userString);
      if (userData.jabatan?.toUpperCase() !== 'HSE K3') {
        toast({
          variant: 'destructive',
          title: 'Akses Ditolak',
          description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
        });
        router.push('/login');
      } else {
        setUserInfo(userData);
      }
    } else {
      router.push('/login');
    }
    setIsLoading(false);
  }, [router, toast]);
  
  const usersInLocation = useMemo(() => {
      if (!userInfo?.lokasi) return [];
      return allUsers.filter(u => u.lokasi === userInfo.lokasi);
  }, [allUsers, userInfo?.lokasi]);

   const combinedDataToday = useMemo(() => {
        if (!userInfo?.lokasi) return [];
        const todayStart = startOfToday();
        
        return usersInLocation.map(user => {
            const attendance = allAttendance.find(rec => rec.userId === user.id && toValidDate(rec.checkInTime) && isSameDay(toValidDate(rec.checkInTime)!, todayStart));
            const overtime = allOvertime.find(rec => rec.userId === user.id && toValidDate(rec.checkInTime) && isSameDay(toValidDate(rec.checkInTime)!, todayStart));
            const productions = allProductions.filter(p => p.namaSopir?.toUpperCase() === user.username.toUpperCase() && toValidDate(p.tanggal) && isSameDay(toValidDate(p.tanggal)!, todayStart))
                .sort((a,b) => toValidDate(a.jamMulai)!.getTime() - toValidDate(b.jamMulai)!.getTime());

            return {
                ...user,
                attendance,
                overtime,
                productions,
            }
        }).filter(u => u.attendance || u.overtime);
    }, [usersInLocation, allAttendance, allOvertime, allProductions, userInfo?.lokasi]);


  useEffect(() => {
    if (!userInfo) return;

    const unsubscribers: (()=>void)[] = [];
    
    unsubscribers.push(onSnapshot(collection(db, 'users'), (snap) => setAllUsers(snap.docs.map(d => ({id: d.id, ...d.data()}) as UserData))));
    unsubscribers.push(onSnapshot(collection(db, 'absensi'), (snap) => setAllAttendance(snap.docs.map(d => ({id: d.id, ...d.data()}) as AttendanceRecord))));
    unsubscribers.push(onSnapshot(collection(db, 'overtime_absensi'), (snap) => setAllOvertime(snap.docs.map(d => ({id: d.id, ...d.data()}) as OvertimeRecord))));
    unsubscribers.push(onSnapshot(collection(db, 'productions'), (snap) => setAllProductions(snap.docs.map(d => ({id: d.id, ...d.data()}) as ProductionData))));
    unsubscribers.push(onSnapshot(query(collection(db, 'kegiatan_harian'), orderBy('createdAt', 'desc')), (snap) => setAllActivities(snap.docs.map(d => ({id: d.id, ...d.data()}) as ActivityLog))));

    return () => unsubscribers.forEach(unsub => unsub());
  }, [userInfo]);


  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (isLoading || !userInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }
  
  const renderContent = () => {
    switch (activeMenu) {
        case 'Absensi Harian':
            return <DailyAttendanceComponent users={combinedDataToday} location={userInfo.lokasi || ''} />;
        case 'Database Absensi':
            return <AttendanceHistoryComponent users={usersInLocation} allAttendance={allAttendance} allOvertime={allOvertime} />;
        case 'Kegiatan Harian':
            return <DailyActivitiesComponent location={userInfo.lokasi || ''} />;
        case 'Database Kegiatan':
             return <ActivityHistoryComponent allActivities={allActivities} users={usersInLocation} location={userInfo.lokasi || ''} />;
        case 'Jumlah Karyawan Hari Ini':
            return <EmployeeSummaryComponent usersInLocation={usersInLocation} />;
        default:
            return <p>Pilih menu untuk memulai.</p>;
    }
  }

  return (
    <SidebarProvider>
        <div className="flex min-h-screen bg-background text-foreground">
            <Sidebar>
                <SidebarContent>
                    <SidebarHeader>
                        <h2 className="text-xl font-semibold text-primary">Dasbor HSE K3</h2>
                    </SidebarHeader>
                    <SidebarMenu>
                       {menuItems.map(item => (
                         <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton 
                                isActive={activeMenu === item.name}
                                onClick={() => setActiveMenu(item.name)}
                            >
                                <item.icon/>
                                {item.name}
                            </SidebarMenuButton>
                         </SidebarMenuItem>
                       ))}
                    </SidebarMenu>
                    <SidebarFooter>
                        <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-muted-foreground">
                            <LogOut className="mr-2 h-4 w-4" />
                            Keluar
                        </Button>
                    </SidebarFooter>
                </SidebarContent>
            </Sidebar>
            <SidebarInset>
                 <main className="flex-1 p-6 lg:p-10">
                    <header className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <SidebarTrigger/>
                             <div className="flex items-center gap-3">
                              <div>
                                  <p className="text-xl font-bold">{userInfo.username}</p>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                      <span className="flex items-center gap-1.5"><Fingerprint size={14}/>{userInfo.nik}</span>
                                      <span className="flex items-center gap-1.5"><Briefcase size={14}/>{userInfo.jabatan}</span>
                                      <span className="flex items-center gap-1.5"><MapPin size={14}/>{userInfo.lokasi}</span>
                                  </div>
                              </div>
                            </div>
                        </div>
                    </header>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    ) : (
                        renderContent()
                    )}
                </main>
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}
