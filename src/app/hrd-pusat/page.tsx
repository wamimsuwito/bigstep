'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, History, Calendar as CalendarIcon, UserCheck, Eye, LogOut, ShieldX, Star, Activity, Users, Clock, FilterX, ClipboardList, Camera, X, Printer, UserSearch, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay, isWithinInterval, differenceInMinutes, isSameDay, subDays, startOfMonth, endOfMonth, getDaysInMonth, eachDayOfInterval, addMonths, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { db, collection, query, where, getDocs, Timestamp, orderBy, addDoc, limit } from '@/lib/firebase';
import type { UserData, LocationData, PenaltyEntry, RewardEntry, AttendanceRecord, ActivityLog, OvertimeRecord, ProductionData } from '@/lib/types';
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarFooter, SidebarTrigger } from '@/components/ui/sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import PenaltyPrintLayout from '@/components/penalty-print-layout';
import RewardPrintLayout from '@/components/reward-print-layout';
import AttendanceHistoryPrintLayout from '@/components/attendance-history-print-layout';
import { printElement, cn } from '@/lib/utils';
import AttendanceTable from '@/components/attendance-table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DateRange } from 'react-day-picker';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


type ActiveMenu = 'Absensi Hari Ini' | 'Riwayat Absensi' | 'Kegiatan Karyawan Hari Ini' | 'Riwayat Kegiatan Karyawan' | 'Penalti Karyawan' | 'Reward Karyawan';
type AttendanceRecordWithLateMinutes = AttendanceRecord & { lateMinutes: number };

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
    if (!date) return null;
    try {
        return format(date, formatString, { locale: localeID });
    } catch (error) {
        return null;
    }
}


//--- Helper functions for date period
const getThisPeriod = () => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    if (currentDay >= 21) {
        return {
            from: new Date(currentYear, currentMonth, 21),
            to: new Date(currentYear, currentMonth + 1, 20),
        };
    } else {
        return {
            from: new Date(currentYear, currentMonth - 1, 21),
            to: new Date(currentYear, currentMonth, 20),
        };
    }
};

const getLastPeriod = () => {
    const { from } = getThisPeriod();
    const lastPeriodStart = addMonths(from, -1);
    const lastPeriodEnd = new Date(lastPeriodStart.getFullYear(), lastPeriodStart.getMonth() + 1, 20);
    return { from: lastPeriodStart, to: lastPeriodEnd };
};

export default function HrdPusatPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [activeMenu, setActiveMenu] = useState<ActiveMenu>('Absensi Hari Ini');
    
    // --- Data States ---
    const [allUsers, setAllUsers] = useState<UserData[]>([]);
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [penalties, setPenalties] = useState<PenaltyEntry[]>([]);
    const [rewards, setRewards] = useState<RewardEntry[]>([]);
    const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
    const [allOvertime, setAllOvertime] = useState<OvertimeRecord[]>([]);
    const [allActivities, setAllActivities] = useState<ActivityLog[]>([]);
    const [allProductions, setAllProductions] = useState<ProductionData[]>([]);


    const [isLoading, setIsLoading] = useState(true);
    const [userInfo, setUserInfo] = useState<UserData | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<string>('all');
    
    // Penalty Form State
    const [isSubmittingPenalty, setIsSubmittingPenalty] = useState(false);
    const [selectedPenaltyUser, setSelectedPenaltyUser] = useState<UserData | null>(null);
    const [penaltyPoin, setPenaltyPoin] = useState('');
    const [penaltyValue, setPenaltyValue] = useState('');
    const [penaltyCause, setPenaltyCause] = useState('');
    const [penaltyDescription, setPenaltyDescription] = useState('');
    
    // Reward Form State
    const [isSubmittingReward, setIsSubmittingReward] = useState(false);
    const [selectedRewardUser, setSelectedRewardUser] = useState<UserData | null>(null);
    const [rewardPoin, setRewardPoin] = useState('');
    const [rewardValue, setRewardValue] = useState('');
    const [rewardDescription, setRewardDescription] = useState('');
    
    // Print States
    const [isPenaltyPrintPreviewOpen, setIsPenaltyPrintPreviewOpen] = useState(false);
    const [penaltyToPrint, setPenaltyToPrint] = useState<Partial<PenaltyEntry> | null>(null);
    const [isRewardPrintPreviewOpen, setIsRewardPrintPreviewOpen] = useState(false);
    const [rewardToPrint, setRewardToPrint] = useState<Partial<RewardEntry> | null>(null);

    // Activity Filter States
    const [activityDateRange, setActivityDateRange] = useState<DateRange | undefined>();

    // Attendance History Filter States
    const [historyDateRange, setHistoryDateRange] = useState<DateRange | undefined>(getThisPeriod());
    const [historySelectedUser, setHistorySelectedUser] = useState<UserData | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const isPenaltyPrintButtonDisabled = !selectedPenaltyUser || !penaltyPoin || !penaltyCause || !penaltyDescription;
    const isRewardPrintButtonDisabled = !selectedRewardUser || !rewardPoin || !rewardDescription;

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (!userString) { router.push('/login'); return; }
        const userData = JSON.parse(userString);
        if (userData.jabatan !== 'HRD PUSAT') {
            toast({ variant: 'destructive', title: 'Akses Ditolak' });
            router.push('/login');
            return;
        }
        setUserInfo(userData);
    }, [router, toast]);
    
    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const usersSnap = await getDocs(collection(db, "users"));
            const allUsersData = usersSnap.docs.map(d => ({ ...d.data(), id: d.id }) as UserData);
            const excludedJabatan = ['SUPER ADMIN', 'OWNER', 'HRD PUSAT'];
            setAllUsers(allUsersData.filter(u => u.jabatan && !excludedJabatan.includes(u.jabatan.toUpperCase())));

            const locationsSnap = await getDocs(collection(db, 'locations'));
            const locationsData = locationsSnap.docs.map(d => ({ ...d.data(), id: d.id }) as LocationData);
            setLocations(locationsData);
            if(locationsData.length > 0 && selectedLocation === 'all') {
                setSelectedLocation(locationsData[0].name);
            }

            const [penaltiesSnap, rewardsSnap, attendanceSnap, overtimeSnap, activitiesSnap, productionsSnap] = await Promise.all([
                getDocs(collection(db, "penalties")),
                getDocs(collection(db, "rewards")),
                getDocs(collection(db, "absensi")),
                getDocs(collection(db, "overtime_absensi")),
                getDocs(query(collection(db, "kegiatan_harian"), orderBy('createdAt', 'desc'), limit(100))),
                getDocs(collection(db, "productions"))
            ]);

            setPenalties(penaltiesSnap.docs.map(d => ({ ...d.data(), id: d.id }) as PenaltyEntry).sort((a,b) => (toValidDate(b.createdAt)?.getTime() || 0) - (toValidDate(a.createdAt)?.getTime() || 0)));
            setRewards(rewardsSnap.docs.map(d => ({ ...d.data(), id: d.id }) as RewardEntry).sort((a,b) => (toValidDate(b.createdAt)?.getTime() || 0) - (toValidDate(a.createdAt)?.getTime() || 0)));
            setAllAttendance(attendanceSnap.docs.map(d => ({...d.data(), id: d.id}) as AttendanceRecord));
            setAllOvertime(overtimeSnap.docs.map(d => ({...d.data(), id: d.id}) as OvertimeRecord));
            setAllActivities(activitiesSnap.docs.map(d => ({ ...d.data(), id: d.id }) as ActivityLog));
            setAllProductions(productionsSnap.docs.map(d => ({ ...d.data(), id: d.id }) as ProductionData));

        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            toast({ title: 'Gagal Memuat Data', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast, selectedLocation]);


    useEffect(() => {
        if (userInfo) { fetchAllData(); }
    }, [userInfo, fetchAllData]);

    const { todayAttendance } = useMemo(() => {
        const selectedDayStart = startOfDay(selectedDate);
        
        const attendance = allAttendance
            .filter(rec => {
                const checkInDate = toValidDate(rec.checkInTime);
                return checkInDate && isSameDay(checkInDate, selectedDayStart);
            })
            .map(rec => {
                const checkInTime = toValidDate(rec.checkInTime)!;
                const deadline = new Date(checkInTime).setHours(CHECK_IN_DEADLINE.hours, CHECK_IN_DEADLINE.minutes, 0, 0);
                const lateMinutes = differenceInMinutes(checkInTime, deadline);
                return { ...rec, lateMinutes: lateMinutes > 0 ? lateMinutes : 0 };
            });

        const overtime = allOvertime.filter(rec => {
            const checkInDate = toValidDate(rec.checkInTime);
            return checkInDate && isSameDay(checkInDate, selectedDayStart)
        });

        const productionsToday = allProductions.filter(prod => {
            const prodDate = toValidDate(prod.tanggal);
            return prodDate && isSameDay(prodDate, selectedDayStart);
        });

        const combinedWithRit = allUsers.map(user => {
            const userAttendance = attendance.find(a => a.userId === user.id);
            const userOvertime = overtime.find(o => o.userId === user.id);
            const userProductions = productionsToday.filter(p => p.namaSopir && p.namaSopir.toUpperCase() === user.username.toUpperCase());

            let ritPertama: string | null = null;
            let ritTerakhir: string | null = null;
            if (userProductions.length > 0) {
                const sortedProductions = userProductions.sort((a,b) => parseISO(a.jamMulai).getTime() - parseISO(b.jamMulai).getTime());
                ritPertama = format(parseISO(sortedProductions[0].jamMulai), 'HH:mm');
                ritTerakhir = format(parseISO(sortedProductions[sortedProductions.length - 1].jamSelesai), 'HH:mm');
            }

            if(userAttendance || userOvertime) {
                return {
                    ...user,
                    ...(userAttendance || {}),
                    overtimeData: userOvertime,
                    ritPertama,
                    ritTerakhir
                };
            }
            return null;
        }).filter(Boolean);

        return {
            todayAttendance: combinedWithRit.filter(rec => rec),
        };
    }, [allAttendance, allOvertime, allProductions, selectedDate, allUsers]);
    
    const filteredAttendance = useMemo(() => {
        if (selectedLocation === 'all') { return todayAttendance; }
        return todayAttendance.filter(rec => rec && rec.checkInLocationName === selectedLocation);
    }, [todayAttendance, selectedLocation]);
    
    const groupedActivities = useMemo(() => {
        let dataToGroup = allActivities;
        const dateRange = activeMenu === 'Kegiatan Karyawan Hari Ini' ? { from: startOfDay(new Date()), to: endOfDay(new Date()) } : activityDateRange;
        
        if (dateRange?.from) {
             const fromDate = startOfDay(dateRange.from);
             const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
             dataToGroup = allActivities.filter(activity => {
                 const activityDate = toValidDate(activity.createdAt);
                 return activityDate && isWithinInterval(activityDate, { start: fromDate, end: toDate });
             });
        }
        
        return dataToGroup.reduce((acc, activity) => {
            const key = activity.username;
            if (!acc[key]) { acc[key] = []; }
            acc[key].push(activity);
            return acc;
        }, {} as Record<string, ActivityLog[]>);
    }, [allActivities, activityDateRange, activeMenu]);

    const { filteredHistoryRecords, historySummary } = useMemo(() => {
        if (!historyDateRange?.from) {
          return { 
            filteredHistoryRecords: [], 
            historySummary: { totalHariKerja: 0, totalJamLembur: 0, totalMenitTerlambat: 0, totalHariAbsen: 0 } 
          };
        }
    
        const { from, to } = historyDateRange;
        const interval = { start: startOfDay(from), end: endOfDay(to || from) };
        const daysInInterval = eachDayOfInterval(interval);
    
        const userList = historySelectedUser ? allUsers.filter(u => u.id === historySelectedUser.id) : allUsers;
    
        const dailyRecords: any[] = [];
        let summary = { totalHariKerja: 0, totalJamLembur: 0, totalMenitTerlambat: 0, totalHariAbsen: 0 };
    
        userList.forEach(user => {
          let userHariKerja = 0;
          let userJamLembur = 0;
          let userMenitTerlambat = 0;
    
          daysInInterval.forEach(day => {
            const attendance = allAttendance.find(rec =>
              rec.userId === user.id && toValidDate(rec.checkInTime) && isSameDay(toValidDate(rec.checkInTime)!, day)
            );
            const overtime = allOvertime.find(rec =>
              rec.userId === user.id && toValidDate(rec.checkInTime) && isSameDay(toValidDate(rec.checkInTime)!, day)
            );
    
            if (attendance) {
              userHariKerja += 1;
              const checkInTime = toValidDate(attendance.checkInTime)!;
              const deadline = new Date(checkInTime).setHours(CHECK_IN_DEADLINE.hours, CHECK_IN_DEADLINE.minutes, 0, 0);
              const late = differenceInMinutes(checkInTime, deadline);
              if (late > 0) {
                userMenitTerlambat += late;
              }
            }
            if (overtime && overtime.checkOutTime) {
                const checkIn = toValidDate(overtime.checkInTime);
                const checkOut = toValidDate(overtime.checkOutTime);
                if (checkIn && checkOut) {
                    userJamLembur += differenceInMinutes(checkOut, checkIn);
                }
            }
    
            if (attendance || overtime) {
              dailyRecords.push({
                ...user,
                id: `${user.id}-${format(day, 'yyyy-MM-dd')}`,
                checkInTime: attendance?.checkInTime,
                checkOutTime: attendance?.checkOutTime,
                checkInPhoto: attendance?.checkInPhoto,
                checkOutPhoto: attendance?.checkOutPhoto,
                checkInLocationName: attendance?.checkInLocationName,
                lateMinutes: attendance ? (differenceInMinutes(toValidDate(attendance.checkInTime)!, new Date(toValidDate(attendance.checkInTime)!).setHours(CHECK_IN_DEADLINE.hours, CHECK_IN_DEADLINE.minutes, 0, 0)) > 0 ? differenceInMinutes(toValidDate(attendance.checkInTime)!, new Date(toValidDate(attendance.checkInTime)!).setHours(CHECK_IN_DEADLINE.hours, CHECK_IN_DEADLINE.minutes, 0, 0)) : 0) : 0,
                overtimeData: overtime,
              });
            }
          });
    
          summary.totalHariKerja += userHariKerja;
          summary.totalJamLembur += Math.floor(userJamLembur / 60);
          summary.totalMenitTerlambat += userMenitTerlambat;
          summary.totalHariAbsen += (daysInInterval.length - userHariKerja);
        });
    
        return { filteredHistoryRecords: dailyRecords, historySummary: summary };
    }, [historyDateRange, historySelectedUser, allUsers, allAttendance, allOvertime]);


    const handleSavePenalty = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isPenaltyPrintButtonDisabled) { toast({ title: 'Data Tidak Lengkap', variant: 'destructive' }); return; }
        setIsSubmittingPenalty(true);
        const newPenalty: Omit<PenaltyEntry, 'id'> = {
            userId: selectedPenaltyUser!.id, username: selectedPenaltyUser!.username, nik: selectedPenaltyUser!.nik, jabatan: selectedPenaltyUser!.jabatan, poin: Number(penaltyPoin),
            nilai: Number(penaltyValue) || 0, penyebab: penaltyCause, deskripsi: penaltyDescription, createdAt: Timestamp.now(), createdBy: userInfo?.username || 'HRD Pusat'
        };

        try {
            const docRef = await addDoc(collection(db, 'penalties'), newPenalty);
            setPenalties(prev => [{ id: docRef.id, ...newPenalty } as PenaltyEntry, ...prev]);
            toast({ title: 'Penalti Disimpan' });
            setSelectedPenaltyUser(null); setPenaltyPoin(''); setPenaltyValue(''); setPenaltyCause(''); setPenaltyDescription('');
        } catch (error) { toast({ title: 'Gagal Menyimpan', variant: 'destructive' }); } finally { setIsSubmittingPenalty(false); }
    };

    const handleSaveReward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isRewardPrintButtonDisabled) { toast({ title: 'Data Tidak Lengkap', variant: 'destructive' }); return; }
        setIsSubmittingReward(true);
        const newReward: Omit<RewardEntry, 'id'> = {
            userId: selectedRewardUser!.id, username: selectedRewardUser!.username, nik: selectedRewardUser!.nik, jabatan: selectedRewardUser!.jabatan, poin: Number(rewardPoin),
            nilai: Number(rewardValue) || 0, deskripsi: rewardDescription, createdAt: Timestamp.now(), createdBy: userInfo?.username || 'HRD Pusat'
        };

        try {
            const docRef = await addDoc(collection(db, 'rewards'), newReward);
            setRewards(prev => [{ id: docRef.id, ...newReward } as RewardEntry, ...prev]);
            toast({ title: 'Reward Disimpan' });
            setSelectedRewardUser(null); setRewardPoin(''); setRewardValue(''); setRewardDescription('');
        } catch (error) { toast({ title: 'Gagal Menyimpan', variant: 'destructive' }); } finally { setIsSubmittingReward(false); }
    };
    
    const handlePrintPenalty = (penaltyData?: Partial<PenaltyEntry>) => {
        const dataToPrint = penaltyData ?? (isPenaltyPrintButtonDisabled ? null : {
            username: selectedPenaltyUser?.username, nik: selectedPenaltyUser?.nik, jabatan: selectedPenaltyUser?.jabatan,
            poin: Number(penaltyPoin), penyebab: penaltyCause, deskripsi: penaltyDescription, createdAt: new Date()
        });
        if (!dataToPrint) { toast({ title: 'Data Tidak Lengkap', variant: 'destructive' }); return; }
        setPenaltyToPrint(dataToPrint); setIsPenaltyPrintPreviewOpen(true);
    };

    const handlePrintReward = (rewardData?: Partial<RewardEntry>) => {
        const dataToPrint = rewardData ?? (isRewardPrintButtonDisabled ? null : {
            username: selectedRewardUser?.username, nik: selectedRewardUser?.nik, jabatan: selectedRewardUser?.jabatan,
            poin: Number(rewardPoin), deskripsi: rewardDescription, createdAt: new Date()
        });
        if (!dataToPrint) { toast({ title: 'Data Tidak Lengkap', variant: 'destructive' }); return; }
        setRewardToPrint(dataToPrint); setIsRewardPrintPreviewOpen(true);
    };
    
    if (!userInfo) { return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>; }

    const renderTodayDashboard = () => (
         <Card className='no-print'>
            <CardHeader className='flex-row items-center justify-between'>
                <div>
                    <CardTitle>Laporan Absensi</CardTitle>
                    <CardDescription>Menampilkan semua absensi yang tercatat pada <span className="font-semibold text-primary">{format(selectedDate, "dd MMMM yyyy", { locale: localeID })}</span></CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn("w-[240px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground" )}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "PPP", { locale: localeID }) : <span>Pilih tanggal</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus/>
                      </PopoverContent>
                    </Popover>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}><SelectTrigger className="w-[220px]"><SelectValue placeholder="Pilih Lokasi" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Semua Lokasi</SelectItem>{locations.map(loc => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? <div className="flex justify-center items-center h-60"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div> 
                : <AttendanceTable 
                    records={filteredAttendance}
                  />
                }
            </CardContent>
        </Card>
    );

    const PhotoWithTimestamp = ({ photo, timestamp, label, formatStr = 'dd MMM, HH:mm' }: { photo?: string | null, timestamp?: any, label: string, formatStr?: string }) => {
        if (!photo) return null;
        const formattedTime = timestamp ? safeFormatTimestamp(timestamp, formatStr) : null;
        return (<Dialog><DialogTrigger asChild><div className="cursor-pointer"><p className="text-xs font-semibold mb-1">{label}</p><img src={photo} className="rounded" alt={`Foto ${label}`} data-ai-hint="activity evidence"/><p className="text-[10px] text-muted-foreground text-center mt-1">{formattedTime || 'Waktu tidak tersedia'}</p></div></DialogTrigger><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Foto Kegiatan: {label}</DialogTitle></DialogHeader><img src={photo} className="rounded-lg w-full h-auto" alt={`Foto ${label}`} /></DialogContent></Dialog>);
    }
    
    const getStatusBadge = (status: string) => {
        switch (status) { case 'completed': return <Badge className="bg-green-100 text-green-800">Selesai</Badge>; case 'in_progress': return <Badge className="bg-blue-100 text-blue-800">Proses</Badge>; case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Menunggu</Badge>; default: return <Badge>{status}</Badge>; }
    };
    
    const renderActivityContent = (title: string, data: Record<string, ActivityLog[]>) => {
        const getGroupStatusSummary = (activities: ActivityLog[]) => {
            const summary = activities.reduce((acc, act) => { const statusKey = act.status || 'unknown'; acc[statusKey] = (acc[statusKey] || 0) + 1; return acc; }, {} as Record<string, number>);
            return (<div className="flex gap-2 text-xs">{summary.completed > 0 && <Badge variant="secondary" className="bg-green-100 text-green-800">{summary.completed} Selesai</Badge>}{summary.in_progress > 0 && <Badge variant="secondary" className="bg-blue-100 text-blue-800">{summary.in_progress} Proses</Badge>}{summary.pending > 0 && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{summary.pending} Menunggu</Badge>}</div>)
        };
        return (<Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{title === 'Riwayat Kegiatan Karyawan' ? 'Lihat semua aktivitas yang pernah dilaporkan.' : 'Aktivitas yang dilaporkan hari ini, dikelompokkan per karyawan.'}</CardDescription></CardHeader>
                <CardContent>
                    {title === 'Riwayat Kegiatan Karyawan' && (
                        <div className="flex items-center gap-2 mb-4">
                            <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !activityDateRange && "text-muted-foreground" )}><CalendarIcon className="mr-2 h-4 w-4" />{activityDateRange?.from ? ( activityDateRange.to ? (<>{format(activityDateRange.from, "LLL dd, y")} - {format(activityDateRange.to, "LLL dd, y")}</>) : (format(activityDateRange.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="range" selected={activityDateRange} onSelect={setActivityDateRange} numberOfMonths={2}/></PopoverContent></Popover>
                             <Button variant="ghost" size="icon" onClick={() => setActivityDateRange(undefined)} disabled={!activityDateRange}><FilterX className="h-4 w-4"/></Button>
                        </div>
                    )}
                    {isLoading ? <div className="flex justify-center items-center h-60"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div> 
                               : <Accordion type="single" collapsible className="w-full">{Object.entries(data).length > 0 ? Object.entries(data).map(([username, activities]) => (
                                         <AccordionItem value={username} key={username}><AccordionTrigger><div className='flex items-center justify-between w-full'><div className="flex items-center gap-3 text-left"><Avatar className="h-9 w-9"><AvatarFallback>{username.charAt(0)}</AvatarFallback></Avatar><div><p className="font-semibold text-sm">{username}</p><p className="text-xs text-muted-foreground">{activities.length} Laporan</p></div></div><div className="hidden sm:block">{getGroupStatusSummary(activities)}</div></div></AccordionTrigger>
                                            <AccordionContent className="pl-4"><div className="space-y-3 p-2 bg-muted/30 rounded-md">{activities.map(activity => (<div key={activity.id} className="p-3 border rounded-md bg-background"><div className="flex justify-between items-start"><div><p className="text-sm text-muted-foreground">{activity.description}</p><div className="text-xs text-muted-foreground space-y-1 mt-1"><p className="flex items-center gap-2"><Clock size={14}/>Target: {safeFormatTimestamp(activity.targetTimestamp, 'dd MMM, HH:mm')}</p></div></div>{getStatusBadge(activity.status)}</div><div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t"><PhotoWithTimestamp photo={activity.photoInitial} timestamp={activity.createdAt} label="Awal" /><PhotoWithTimestamp photo={activity.photoInProgress} timestamp={activity.timestampInProgress} label="Proses" /><PhotoWithTimestamp photo={activity.photoCompleted} timestamp={activity.timestampCompleted} label="Selesai" /></div></div>))}</div></AccordionContent>
                                         </AccordionItem>
                                    )) : <div className="text-center py-10 text-muted-foreground">Tidak ada aktivitas pada periode ini.</div>}</Accordion>}
                </CardContent>
            </Card>
        );
    }
    
    const renderHistoryContent = () => (
        <Card className="no-print">
            <CardHeader>
                <CardTitle>Riwayat Absensi Karyawan</CardTitle>
                <CardDescription>Analisis dan cetak riwayat kehadiran karyawan berdasarkan periode.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex flex-col md:flex-row gap-2">
                    <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full md:w-auto justify-start text-left font-normal"><UserSearch className="mr-2 h-4 w-4"/>{historySelectedUser ? historySelectedUser.username : 'Semua Karyawan'}</Button></PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                            <Command><CommandInput placeholder="Cari karyawan..."/><CommandList><CommandEmpty>Tidak ada karyawan ditemukan.</CommandEmpty><CommandGroup>
                                    <CommandItem onSelect={() => setHistorySelectedUser(null)} className="cursor-pointer">Semua Karyawan</CommandItem>
                                    {allUsers.map(user => <CommandItem key={user.id} value={user.username} onSelect={() => setHistorySelectedUser(user)} className="cursor-pointer">{user.username}</CommandItem>)}
                            </CommandGroup></CommandList></Command>
                        </PopoverContent>
                    </Popover>
                    <Select onValueChange={(value) => { if(value === 'this') setHistoryDateRange(getThisPeriod()); if(value === 'last') setHistoryDateRange(getLastPeriod()); }}>
                        <SelectTrigger className="w-full md:w-[250px]"><SelectValue placeholder="Pilih Periode..." /></SelectTrigger>
                        <SelectContent><SelectItem value="this">Periode Ini (21-20)</SelectItem><SelectItem value="last">Periode Bulan Lalu</SelectItem></SelectContent>
                    </Select>
                    <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full md:w-[280px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4"/>{historyDateRange?.from ? format(historyDateRange.from, "d MMM") + (historyDateRange.to ? " - " + format(historyDateRange.to, "d MMM yyyy") : "") : "Pilih Rentang"}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={historyDateRange} onSelect={setHistoryDateRange} numberOfMonths={2}/></PopoverContent>
                    </Popover>
                    <Button onClick={() => window.print()} disabled={isLoading || filteredHistoryRecords.length === 0}><Printer className="mr-2 h-4 w-4"/>Cetak</Button>
                </div>
                 {isLoading ? (
                    <div className="flex justify-center items-center h-60"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
                 ) : (
                    <AttendanceTable records={filteredHistoryRecords} />
                 )}
            </CardContent>
        </Card>
    );

    const renderPenaltyContent = () => (
        <div className="space-y-6">
            <Card><CardHeader><CardTitle>Input Penalti Karyawan</CardTitle><CardDescription>Catat penalti untuk karyawan yang melakukan pelanggaran.</CardDescription></CardHeader>
                <CardContent>
                    <form onSubmit={handleSavePenalty} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="space-y-1"><Label>Nama Karyawan</Label><Select onValueChange={value => setSelectedPenaltyUser(allUsers.find(u => u.id === value) || null)} value={selectedPenaltyUser?.id || ''}><SelectTrigger><SelectValue placeholder="Pilih Karyawan..." /></SelectTrigger><SelectContent>{allUsers.map(user => (<SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1"><Label>NIK</Label><Input value={selectedPenaltyUser?.nik || ''} disabled /></div><div className="space-y-1"><Label>Jabatan</Label><Input value={selectedPenaltyUser?.jabatan || ''} disabled /></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="space-y-1"><Label htmlFor="penaltyPoin">Poin Penalti</Label><Input id="penaltyPoin" type="number" value={penaltyPoin} onChange={e => setPenaltyPoin(e.target.value)} required /></div><div className="space-y-1"><Label htmlFor="penaltyValue">Nilai (Rp)</Label><Input id="penaltyValue" type="number" value={penaltyValue} onChange={e => setPenaltyValue(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="penaltyCause">Penyebab</Label><Input id="penaltyCause" value={penaltyCause} onChange={e => setPenaltyCause(e.target.value)} required /></div></div>
                        <div className="space-y-1"><Label htmlFor="penaltyDescription">Deskripsi Lengkap</Label><Textarea id="penaltyDescription" value={penaltyDescription} onChange={e => setPenaltyDescription(e.target.value)} required /></div>
                        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => handlePrintPenalty()} disabled={isPenaltyPrintButtonDisabled}>Cetak</Button><Button type="submit" disabled={isSubmittingPenalty}>{isSubmittingPenalty && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Simpan</Button></div>
                    </form>
                </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Riwayat Penalti</CardTitle></CardHeader>
                <CardContent><div className="border rounded-md max-h-[500px] overflow-y-auto"><table className="w-full text-sm"><thead><tr className='text-left'><th className='p-2'>Tanggal</th><th className='p-2'>Nama</th><th className='p-2'>Penyebab</th><th className='p-2'>Poin</th><th className='p-2'>Nilai (Rp)</th><th className='p-2'>Detail</th></tr></thead><tbody>{penalties.map(p => (<tr key={p.id} className='border-t'><td className='p-2'>{safeFormatTimestamp(p.createdAt, 'dd MMM yyyy')}</td><td className='p-2'>{p.username}</td><td className='p-2'>{p.penyebab}</td><td className='p-2'>{p.poin}</td><td className='p-2'>{Number(p.nilai || 0).toLocaleString('id-ID')}</td><td className='p-2'><Button variant="ghost" size="icon" onClick={() => handlePrintPenalty(p)}><Eye className="h-4 w-4" /></Button></td></tr>))}</tbody></table></div></CardContent>
            </Card>
        </div>
    );
    
    const renderRewardContent = () => (
        <div className="space-y-6">
            <Card><CardHeader><CardTitle>Input Reward Karyawan</CardTitle><CardDescription>Berikan apresiasi kepada karyawan berprestasi.</CardDescription></CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveReward} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="space-y-1"><Label>Nama Karyawan</Label><Select onValueChange={value => setSelectedRewardUser(allUsers.find(u => u.id === value) || null)} value={selectedRewardUser?.id || ''}><SelectTrigger><SelectValue placeholder="Pilih Karyawan..." /></SelectTrigger><SelectContent>{allUsers.map(user => (<SelectItem key={user.id} value={user.id}>{user.username}</SelectItem>))}</SelectContent></Select></div><div className="space-y-1"><Label>NIK</Label><Input value={selectedRewardUser?.nik || ''} disabled /></div><div className="space-y-1"><Label>Jabatan</Label><Input value={selectedRewardUser?.jabatan || ''} disabled /></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-1"><Label htmlFor="rewardPoin">Poin Reward</Label><Input id="rewardPoin" type="number" value={rewardPoin} onChange={e => setRewardPoin(e.target.value)} required /></div><div className="space-y-1"><Label htmlFor="rewardValue">Nilai Reward (Rp)</Label><Input id="rewardValue" type="number" value={rewardValue} onChange={e => setRewardValue(e.target.value)} /></div></div>
                        <div className="space-y-1"><Label htmlFor="rewardDescription">Deskripsi Lengkap</Label><Textarea id="rewardDescription" value={rewardDescription} onChange={e => setRewardDescription(e.target.value)} required /></div>
                        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => handlePrintReward()} disabled={isRewardPrintButtonDisabled}>Cetak</Button><Button type="submit" disabled={isSubmittingReward}>{isSubmittingReward && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Simpan</Button></div>
                    </form>
                </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Riwayat Reward</CardTitle></CardHeader>
                <CardContent><div className="border rounded-md max-h-[500px] overflow-y-auto"><table className="w-full text-sm"><thead><tr className='text-left'><th className='p-2'>Tanggal</th><th className='p-2'>Nama</th><th className='p-2'>Deskripsi</th><th className='p-2'>Poin</th><th className='p-2'>Nilai (Rp)</th><th className='p-2'>Detail</th></tr></thead><tbody>{rewards.map(r => (<tr key={r.id} className='border-t'><td className='p-2'>{safeFormatTimestamp(r.createdAt, 'dd MMM yyyy')}</td><td className='p-2'>{r.username}</td><td className='p-2'>{r.deskripsi}</td><td className='p-2'>{r.poin}</td><td className='p-2'>{Number(r.nilai || 0).toLocaleString('id-ID')}</td><td className='p-2'><Button variant="ghost" size="icon" onClick={() => handlePrintReward(r)}><Eye className="h-4 w-4" /></Button></td></tr>))}</tbody></table></div></CardContent>
            </Card>
        </div>
    );

    const renderContent = () => {
        switch(activeMenu) { case 'Absensi Hari Ini': return renderTodayDashboard(); case 'Riwayat Absensi': return renderHistoryContent(); case 'Kegiatan Karyawan Hari Ini': return renderActivityContent('Kegiatan Karyawan Hari Ini', groupedActivities); case 'Riwayat Kegiatan Karyawan': return renderActivityContent('Riwayat Kegiatan Karyawan', groupedActivities); case 'Penalti Karyawan': return renderPenaltyContent(); case 'Reward Karyawan': return renderRewardContent(); default: return <p>Halaman ini dalam pengembangan.</p> }
    }

    return (
        <>
            <Dialog open={isPenaltyPrintPreviewOpen} onOpenChange={setIsPenaltyPrintPreviewOpen}><DialogContent className="max-w-4xl p-0"><DialogHeader className="p-4 border-b no-print"><DialogTitle>Pratinjau Surat Penalti</DialogTitle><DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-4 top-3"><X className="h-4 w-4"/></Button></DialogClose></DialogHeader><div className="p-6 max-h-[80vh] overflow-y-auto" id="printable-penalty"><PenaltyPrintLayout penaltyData={penaltyToPrint} /></div><DialogFooter className="p-4 border-t bg-muted no-print"><Button variant="outline" onClick={() => setIsPenaltyPrintPreviewOpen(false)}>Tutup</Button><Button onClick={() => printElement('printable-penalty')}>Cetak</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={isRewardPrintPreviewOpen} onOpenChange={setIsRewardPrintPreviewOpen}><DialogContent className="max-w-4xl p-0"><DialogHeader className="p-4 border-b no-print"><DialogTitle>Pratinjau Surat Reward</DialogTitle><DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-4 top-3"><X className="h-4 w-4"/></Button></DialogClose></DialogHeader><div className="p-6 max-h-[80vh] overflow-y-auto" id="printable-reward"><RewardPrintLayout rewardData={rewardToPrint} /></div><DialogFooter className="p-4 border-t bg-muted no-print"><Button variant="outline" onClick={() => setIsRewardPrintPreviewOpen(false)}>Tutup</Button><Button onClick={() => printElement('printable-reward')}>Cetak</Button></DialogFooter></DialogContent></Dialog>
            
            <div className="print-only">
                {historyDateRange?.from && <AttendanceHistoryPrintLayout records={filteredHistoryRecords} period={historyDateRange} summary={historySummary} />}
            </div>

            <SidebarProvider>
                <div className="flex min-h-screen bg-background text-foreground no-print">
                    <Sidebar><SidebarContent><SidebarHeader><h2 className="text-xl font-semibold text-primary">HRD Pusat</h2></SidebarHeader>
                        <SidebarMenu>
                            <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'Absensi Hari Ini'} onClick={() => setActiveMenu('Absensi Hari Ini')}><UserCheck />Absensi Hari Ini</SidebarMenuButton></SidebarMenuItem>
                            <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'Riwayat Absensi'} onClick={() => setActiveMenu('Riwayat Absensi')}><History />Riwayat Absensi</SidebarMenuButton></SidebarMenuItem>
                            <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'Kegiatan Karyawan Hari Ini'} onClick={() => { setActiveMenu('Kegiatan Karyawan Hari Ini'); setActivityDateRange(undefined); }}><ClipboardList />Kegiatan Karyawan Hari Ini</SidebarMenuButton></SidebarMenuItem>
                            <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'Riwayat Kegiatan Karyawan'} onClick={() => { setActiveMenu('Riwayat Kegiatan Karyawan'); setActivityDateRange({ from: subDays(new Date(), 7), to: new Date() }); }}><History />Riwayat Kegiatan Karyawan</SidebarMenuButton></SidebarMenuItem>
                            <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'Penalti Karyawan'} onClick={() => setActiveMenu('Penalti Karyawan')}><ShieldX />Penalti Karyawan</SidebarMenuButton></SidebarMenuItem>
                            <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'Reward Karyawan'} onClick={() => setActiveMenu('Reward Karyawan')}><Star />Reward Karyawan</SidebarMenuButton></SidebarMenuItem>
                        </SidebarMenu>
                        <SidebarFooter><Button variant="ghost" onClick={() => router.push('/login')} className="w-full justify-start"><LogOut className="mr-2 h-4 w-4" /> Keluar</Button></SidebarFooter>
                    </SidebarContent></Sidebar>
                    <SidebarInset><main className="p-4 sm:p-6 md:p-8">
                        <header className="flex items-start sm:items-center justify-between gap-4 mb-8"><div className='flex items-center gap-4'><SidebarTrigger /><div><h1 className="text-2xl font-bold tracking-wider">{activeMenu}</h1><p className="text-muted-foreground">Selamat datang, {userInfo.username}</p></div></div></header>
                        {renderContent()}
                    </main></SidebarInset>
                </div>
            </SidebarProvider>
        </>
    );
}