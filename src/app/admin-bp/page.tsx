
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Database, Package, GitCompareArrows, LogOut, User, ChevronDown, Loader2, Printer, XCircle, AlertTriangle, Fingerprint, Briefcase, Warehouse, ToggleRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import SchedulePrintLayout from '@/components/schedule-print-layout';
import { format, addDays } from 'date-fns';
import { id } from 'date-fns/locale';
import type { UserData, ScheduleRow, LocationData, JobMix, CementSiloStock } from '@/lib/types';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarInset, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { db, collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, updateDoc } from '@/lib/firebase';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ALL_UNITS = ['BP-1', 'BP-2', 'BP-3'];
const MAIN_SILO_COUNT = 6;

const menuItems = [
  { name: 'Schedule Cor', icon: CalendarDays },
  { name: 'Database', icon: Database },
  { name: 'Material', icon: Package },
  { name: 'Status Silo', icon: Warehouse },
  { name: 'Sinkronisasi', icon: GitCompareArrows },
];

const tableHeaders = [
    'NO', 'NO P.O', 'NAMA', 'LOKASI', 'GRADE', 'SLUMP (CM)', 
    'CP/M', 'VOL M³', 'PENAMBAHAN VOL M³', 'TOTAL M³', 'TERKIRIM M³', 'SISA M³', 
    'STATUS', 'KET'
];

const statusOptions = ["menunggu", "proses", "tunda", "selesai"];

const isRowEmpty = (row: ScheduleRow) => {
    const fieldsToCheck: (keyof ScheduleRow)[] = [ 'NO', 'NO P.O', 'NAMA', 'LOKASI', 'GRADE' ];
    return fieldsToCheck.every((field) => !row[field] || String(row[field]).trim() === '');
};

const createNewEmptyRow = (id: string): ScheduleRow => ({
    id, 'NO': '', 'NO P.O': '', 'NAMA': '', 'LOKASI': '', 'GRADE': '', 'SLUMP (CM)': '', 
    'CP/M': '', 'VOL M³': '0', 'TERKIRIM M³': '0', 'SISA M³': '0', 
    'PENAMBAHAN VOL M³': '0', 'TOTAL M³': '0', 'STATUS': 'menunggu', 'KET': ''
});

const ScheduleTableComponent = ({
    title, date, data, onInputChange, onKeyDown, onSave, onTutupJalur, isLoading, scheduleType, jobMixOptions
}: {
    title: string, date: string, data: ScheduleRow[],
    onInputChange: (rowIndex: number, header: string, value: string, scheduleType: 'today' | 'tomorrow') => void,
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>, rowIndex: number, colIndex: number, scheduleType: 'today' | 'tomorrow') => void,
    onSave: () => void, onTutupJalur?: () => void, isLoading: boolean,
    scheduleType: 'today' | 'tomorrow', jobMixOptions: string[]
}) => {
    const hasScheduleData = useMemo(() => data.some(row => !isRowEmpty(row)), [data]);

    return (
        <Card className="bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6">
                <header className="flex justify-between items-center mb-6 no-print">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3"><CalendarDays className="h-7 w-7 text-primary" />{title}</h1>
                        <p className="text-muted-foreground">Tanggal: {date}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {onTutupJalur && <Button onClick={onTutupJalur} variant="destructive" disabled={!hasScheduleData}> <AlertTriangle className="mr-2 h-4 w-4" /> Tutup Jalur </Button>}
                        <Button onClick={() => window.print()} variant="outline" disabled={!hasScheduleData}><Printer className="mr-2 h-4 w-4" /> Cetak / Pratinjau </Button>
                        <Button onClick={onSave} className="bg-green-600 hover:bg-green-700 text-white" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Simpan</Button>
                    </div>
                </header>
                <div className="overflow-x-auto border rounded-lg">
                   <div className="hidden print:block">
                       <SchedulePrintLayout
                         data={data.filter(row => !isRowEmpty(row))}
                         headers={tableHeaders}
                       />
                   </div>
                    <Table className='no-print'>
                        <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">{tableHeaders.map((header) => (<TableHead key={header} className={`text-muted-foreground font-bold border px-2 py-3 text-center ${header === 'LOKASI' ? 'w-[250px]' : ''}`}>{header}</TableHead>))}</TableRow></TableHeader>
                        <TableBody>
                            {data.map((row, rowIndex) => { const isRowLocked = row.STATUS === 'selesai'; const showSelects = !isRowEmpty(row); return (
                            <TableRow key={`${scheduleType}-${row.id || rowIndex}`} className={`even:bg-card/50 odd:bg-muted/20 hover:bg-accent/20 ${isRowLocked ? 'bg-muted/30 text-muted-foreground' : ''}`}>{tableHeaders.map((header, colIndex) => (
                                <TableCell key={header} className="border p-0 h-10">
                                    {header === 'STATUS' ? (showSelects && (<Select value={row.STATUS || 'menunggu'} onValueChange={(value) => onInputChange(rowIndex, 'STATUS', value, scheduleType)} disabled={isRowLocked}><SelectTrigger className="w-full h-full p-2 border-0 rounded-none bg-transparent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 text-center" data-schedule-type={scheduleType} data-row-index={rowIndex} data-header={header} onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex, scheduleType)}><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map(option => <SelectItem key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</SelectItem>)}</SelectContent></Select>)) : 
                                    header === 'GRADE' ? (showSelects && (<Select value={row.GRADE || ''} onValueChange={(value) => onInputChange(rowIndex, 'GRADE', value, scheduleType)} disabled={isRowLocked}><SelectTrigger className="w-full h-full p-2 border-0 rounded-none bg-transparent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 text-center" data-schedule-type={scheduleType} data-row-index={rowIndex} data-header={header} onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex, scheduleType)}><SelectValue /></SelectTrigger><SelectContent>{jobMixOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>)) : 
                                    (<Input data-schedule-type={scheduleType} data-row-index={rowIndex} data-header={header} type="text" value={row[header as keyof typeof row] as string} onChange={(e) => onInputChange(rowIndex, header, e.target.value, scheduleType)} onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex, scheduleType)} className="w-full h-full p-2 border-0 rounded-none bg-transparent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 text-center" style={{ textTransform: 'uppercase' }} disabled={isRowLocked || header === 'TERKIRIM M³' || header === 'SISA M³' || header === 'TOTAL M³'}/>)}
                                </TableCell>
                            ))}</TableRow>);})}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};


export default function AdminBpPage() {
    const router = useRouter();
    const { toast } = useToast();
    
    const [activeMenu, setActiveMenu] = useState('Schedule Cor');
    const [tableData, setTableData] = useState<ScheduleRow[]>(() => [createNewEmptyRow('1')]);
    const [scheduleForTomorrow, setScheduleForTomorrow] = useState<ScheduleRow[]>(() => [createNewEmptyRow('1')]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [jobMixOptions, setJobMixOptions] = useState<string[]>([]);
    const [lokasiBp, setLokasiBp] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState('');
    const [tomorrowDate, setTomorrowDate] = useState('');
    const [isTutupJalurDialogOpen, setIsTutupJalurDialogOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<UserData | null>(null);
    const [unitSiloStocks, setUnitSiloStocks] = useState<Record<string, CementSiloStock>>({});

    
    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (!userString) {
          router.push('/login');
          return;
        }
        const userData = JSON.parse(userString);
         if (userData.jabatan !== 'ADMIN BP') {
            toast({
                variant: 'destructive',
                title: 'Akses Ditolak',
                description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
            });
            router.push('/login');
            return;
        }
        setCurrentUser(userData);
        setLokasiBp(userData.lokasi || null);
        
        const today = new Date();
        const tomorrow = addDays(today, 1);
        setCurrentDate(format(today, "EEEE, dd MMMM yyyy", { locale: id }));
        setTomorrowDate(format(tomorrow, "EEEE, dd MMMM yyyy", { locale: id }));
    }, [router, toast]);
    
    useEffect(() => {
        if (!lokasiBp) return;
    
        setIsFetching(true);
        const unsubscribers: (() => void)[] = [];

        const fetchJobMixes = async () => {
             try {
                const jobmixesSnapshot = await getDocs(collection(db, 'jobmixes'));
                const jobmixesList = jobmixesSnapshot.docs.map(doc => doc.data().mutuBeton as string);
                setJobMixOptions(jobmixesList);
             } catch (error) {
                 console.error("Error fetching job mixes:", error);
                 toast({ variant: 'destructive', title: "Gagal Memuat Job Mix" });
             }
        };

        fetchJobMixes();

        const todayUnsub = onSnapshot(collection(db, 'schedules_today'), (snapshot) => {
            const todayData = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as ScheduleRow[];
            const sortedData = todayData.sort((a, b) => parseInt(a.NO) - parseInt(b.NO));
            setTableData(sortedData.length > 0 ? [...sortedData, createNewEmptyRow(String(sortedData.length + 1))] : [createNewEmptyRow('1')]);
            setIsFetching(false);
        }, (error) => {
            console.error("Error fetching today's schedule:", error);
            toast({ variant: 'destructive', title: "Gagal Memuat Jadwal Hari Ini" });
            setIsFetching(false);
        });
        unsubscribers.push(todayUnsub);
        
        const tomorrowUnsub = onSnapshot(collection(db, `schedules_${lokasiBp}_tomorrow`), (snapshot) => {
            const tomorrowData = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as ScheduleRow[];
            const sortedData = tomorrowData.sort((a, b) => parseInt(a.NO) - parseInt(b.NO));
            setScheduleForTomorrow(sortedData.length > 0 ? [...sortedData, createNewEmptyRow(String(sortedData.length + 1))] : [createNewEmptyRow('1')]);
        }, (error) => {
            console.error("Error fetching tomorrow's schedule:", error);
            toast({ variant: 'destructive', title: "Gagal Memuat Jadwal Besok" });
        });
        unsubscribers.push(tomorrowUnsub);

        ALL_UNITS.forEach(unit => {
            const stockDocRef = doc(db, `locations/${lokasiBp}/stock_cement_silo_${unit}`, 'main');
            const unsub = onSnapshot(stockDocRef, (docSnap) => {
                const stockData = (docSnap.exists() ? docSnap.data() : { silos: {} }) as CementSiloStock;
                setUnitSiloStocks(prev => ({...prev, [unit]: stockData }));
            });
            unsubscribers.push(unsub);
        });


        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    
    }, [lokasiBp, toast]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        router.push('/login');
    };
    
    const handleInputChange = (rowIndex: number, header: string, value: string, scheduleType: 'today' | 'tomorrow') => {
        const setData = scheduleType === 'today' ? setTableData : setScheduleForTomorrow;
        
        setData(prevData => {
            const newData = [...prevData];
            const updatedRow: ScheduleRow = { ...newData[rowIndex], [header]: value };
    
            if (header === 'VOL M³' || header === 'PENAMBAHAN VOL M³') {
                const vol = parseFloat(updatedRow['VOL M³'] || '0');
                const penambahanVol = parseFloat(updatedRow['PENAMBAHAN VOL M³'] || '0');
                const terkirim = parseFloat(updatedRow['TERKIRIM M³'] || '0');
                const totalVol = vol + penambahanVol;
                updatedRow['TOTAL M³'] = String(totalVol);
                updatedRow['SISA M³'] = String(totalVol - terkirim);
            }

            newData[rowIndex] = updatedRow;
            return newData;
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, rowIndex: number, colIndex: number, scheduleType: 'today' | 'tomorrow') => {
        const setData = scheduleType === 'today' ? setTableData : setScheduleForTomorrow;
        const data = scheduleType === 'today' ? tableData : scheduleForTomorrow;

        if (e.key === 'Enter') {
             e.preventDefault();
             if (rowIndex === data.length - 1 && !isRowEmpty(data[rowIndex])) {
                const nextId = String(Math.max(...data.map(r => parseInt(r.id) || 0), 0) + 1);
                setData(prev => [...prev, createNewEmptyRow(nextId)]);
                setTimeout(() => {
                    const nextInput = document.querySelector(`[data-schedule-type="${scheduleType}"][data-row-index="${rowIndex + 1}"][data-header="${tableHeaders[colIndex]}"]`) as HTMLElement;
                    nextInput?.focus();
                }, 0);
             } else {
                 const nextRow = Math.min(data.length - 1, rowIndex + 1);
                 const nextInput = document.querySelector(`[data-schedule-type="${scheduleType}"][data-row-index="${nextRow}"][data-header="${tableHeaders[colIndex]}"]`) as HTMLElement;
                 nextInput?.focus();
             }
        }
    };
    
    const handleSave = async (scheduleType: 'today' | 'tomorrow') => {
        if (!lokasiBp) {
            toast({ title: "Lokasi BP tidak ditemukan.", variant: "destructive" });
            return;
        }
        setIsLoading(true);

        const dataToSave = (scheduleType === 'today' ? tableData : scheduleForTomorrow).filter(row => !isRowEmpty(row));
        const collectionName = scheduleType === 'today' ? 'schedules_today' : `schedules_${lokasiBp}_tomorrow`;
        
        try {
            const existingDocsSnapshot = await getDocs(collection(db, collectionName));
            for (const d of existingDocsSnapshot.docs) {
                if (!dataToSave.find(row => row.id === d.id)) {
                    await deleteDoc(d.ref);
                }
            }

            for (const row of dataToSave) {
                if (row.id) {
                    await setDoc(doc(db, collectionName, row.id), row);
                }
            }
            toast({ title: `Data Tersimpan`, description: `Jadwal untuk ${scheduleType === 'today' ? 'hari ini' : 'besok'} telah disimpan.` });
        } catch (error) {
            console.error(error);
            toast({ title: 'Gagal Menyimpan', description: 'Gagal menyimpan data ke Firestore.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTutupJalur = async () => {
        if (!lokasiBp) {
            toast({ title: "Lokasi BP tidak ditemukan.", variant: "destructive" });
            return;
        }
        setIsLoading(true);

        try {
            const todaySchedule = tableData.filter(row => !isRowEmpty(row));
            if (todaySchedule.length > 0) {
                const dateId = format(new Date(), 'yyyy-MM-dd');
                const archiveDocRef = doc(db, 'archived_schedules', dateId);
                await setDoc(archiveDocRef, {
                    id: dateId,
                    date: new Date().toISOString(),
                    location: lokasiBp,
                    scheduleData: todaySchedule
                }, { merge: true });
            }

            const tomorrowScheduleKey = `schedules_${lokasiBp}_tomorrow`;
            const tomorrowSnapshot = await getDocs(collection(db, tomorrowScheduleKey));
            
            const newTodayData: ScheduleRow[] = tomorrowSnapshot.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    'NO': data['NO'] || '',
                    'NO P.O': data['NO P.O'] || '',
                    'NAMA': data['NAMA'] || '',
                    'LOKASI': data['LOKASI'] || '',
                    'GRADE': data['GRADE'] || '',
                    'SLUMP (CM)': data['SLUMP (CM)'] || '',
                    'CP/M': data['CP/M'] || '',
                    'VOL M³': data['VOL M³'] || '0',
                    'PENAMBAHAN VOL M³': data['PENAMBAHAN VOL M³'] || '0',
                    'TOTAL M³': data['TOTAL M³'] || '0',
                    'TERKIRIM M³': data['TERKIRIM M³'] || '0',
                    'SISA M³': data['SISA M³'] || '0',
                    'STATUS': data['STATUS'] || 'menunggu',
                    'KET': data['KET'] || '',
                };
            });
            
            const todayScheduleKey = `schedules_today`;
            const todaySnapshot = await getDocs(collection(db, todayScheduleKey));
            for(const d of todaySnapshot.docs) await deleteDoc(d.ref);
            
            for(const row of newTodayData) {
                 await setDoc(doc(db, todayScheduleKey, row.id), row);
            }
            for(const d of tomorrowSnapshot.docs) await deleteDoc(d.ref);

            
            toast({ title: 'Jalur Ditutup & Jadwal Diperbarui', description: `Jadwal hari ini diarsipkan, jadwal besok menjadi aktif.` });

        } catch (error) {
            console.error("Error during Tutup Jalur:", error);
            toast({ title: "Error", variant: "destructive", description: "Gagal memproses tutup jalur." });
        } finally {
            setIsTutupJalurDialogOpen(false);
            setIsLoading(false);
        }
    };
    
    const handleSiloStatusChange = async (unit: string, siloId: string, newStatus: 'aktif' | 'non-aktif') => {
        if (!lokasiBp) return;
        const stockDocRef = doc(db, `locations/${lokasiBp}/stock_cement_silo_${unit}`, 'main');
        const fieldPath = `silos.${siloId}.status`;
        
        try {
            await updateDoc(stockDocRef, { [fieldPath]: newStatus });
            toast({ title: 'Status Silo Diperbarui', description: `Status untuk ${siloId} di ${unit} telah diubah menjadi ${newStatus}.` });
        } catch (error) {
            console.error("Error updating silo status:", error);
            toast({ title: "Gagal Memperbarui Status", variant: "destructive" });
        }
    };

    const getSiloCountForUnit = useCallback((locationName: string | null | undefined, unit: string) => {
      if (locationName?.toUpperCase().includes('BAUNG') && unit === 'BP-1') {
          return 4;
      }
      return MAIN_SILO_COUNT;
    }, []);


    if (isFetching || !currentUser) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-16 w-16 animate-spin" />
            </div>
        );
    }
    
    return (
        <>
        <AlertDialog open={isTutupJalurDialogOpen} onOpenChange={setIsTutupJalurDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Konfirmasi Tutup Jalur</AlertDialogTitle>
                    <AlertDialogDescription>
                        Apakah semua schedule cor sudah selesai? Anda yakin akan tutup jalur? Tindakan ini akan mengarsipkan jadwal hari ini dan mengosongkannya.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Tidak</AlertDialogCancel>
                    <AlertDialogAction onClick={handleTutupJalur} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Yakin'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      <SidebarProvider>
         <Sidebar>
            <SidebarContent>
                <SidebarHeader>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg">
                            B
                        </div>
                        <h2 className="text-xl font-semibold text-foreground">Admin BP</h2>
                    </div>
                </SidebarHeader>
                <SidebarMenu className="flex-1">
                    {menuItems.map((item) => (
                    <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                            isActive={activeMenu === item.name}
                            onClick={() => setActiveMenu(item.name)}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    ))}
                </SidebarMenu>
                 <SidebarFooter>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
                                <User className="h-8 w-8" />
                                <div className='text-left'>
                                    <p className='text-sm font-semibold'>{currentUser.username}</p>
                                    <p className='text-xs text-muted-foreground flex items-center gap-1.5'><Fingerprint size={12}/>{currentUser.nik}</p>
                                    <p className='text-xs text-muted-foreground flex items-center gap-1.5'><Briefcase size={12}/>{currentUser.jabatan} - {currentUser.lokasi}</p>
                                </div>
                                <ChevronDown className="h-4 w-4 ml-auto" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className='w-56'>
                            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Keluar</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                 </SidebarFooter>
            </SidebarContent>
        </Sidebar>
        <SidebarInset>
            <main className="flex-1 p-6 lg:p-10">
                {activeMenu === 'Schedule Cor' && (
                  <div className="space-y-8">
                     <ScheduleTableComponent
                         title="SCHEDULE COR HARI INI"
                         date={currentDate}
                         data={tableData}
                         onInputChange={handleInputChange}
                         onKeyDown={handleKeyDown}
                         onSave={() => handleSave('today')}
                         onTutupJalur={() => setIsTutupJalurDialogOpen(true)}
                         isLoading={isLoading}
                         scheduleType="today"
                         jobMixOptions={jobMixOptions}
                     />
                      <ScheduleTableComponent
                         title="SCHEDULE COR BESOK"
                         date={tomorrowDate}
                         data={scheduleForTomorrow}
                         onInputChange={handleInputChange}
                         onKeyDown={handleKeyDown}
                         onSave={() => handleSave('tomorrow')}
                         isLoading={isLoading}
                         scheduleType="tomorrow"
                         jobMixOptions={jobMixOptions}
                     />
                  </div>
                )}
                 {activeMenu === 'Status Silo' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Manajemen Status Silo Unit</CardTitle>
                            <CardDescription>Aktifkan atau non-aktifkan silo untuk produksi. Silo yang tidak aktif tidak akan muncul di pilihan operator.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {ALL_UNITS.map(unit => (
                                <div key={unit}>
                                    <h3 className="font-semibold text-lg mb-3">{unit}</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                        {Array.from({length: getSiloCountForUnit(lokasiBp, unit)}).map((_, i) => {
                                            const siloId = `silo-${i + 1}`;
                                            const siloData = unitSiloStocks[unit]?.silos?.[siloId];
                                            const isActive = siloData?.status === 'aktif';
                                            return (
                                                <Card key={siloId} className="p-4 flex flex-col items-center justify-center">
                                                    <Label htmlFor={`${unit}-${siloId}`} className="font-medium text-muted-foreground">{`Silo ${i + 1}`}</Label>
                                                    <p className='text-xs'>({(siloData?.stock || 0).toLocaleString()} kg)</p>
                                                    <Switch
                                                        id={`${unit}-${siloId}`}
                                                        checked={isActive}
                                                        onCheckedChange={(checked) => handleSiloStatusChange(unit, siloId, checked ? 'aktif' : 'non-aktif')}
                                                        className="my-2"
                                                    />
                                                    <Badge variant={isActive ? 'default' : 'destructive'} className={cn(isActive && 'bg-green-600')}>{isActive ? 'Aktif' : 'Non-Aktif'}</Badge>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                 )}
                 {activeMenu !== 'Schedule Cor' && activeMenu !== 'Status Silo' && (
                     <Card>
                         <CardHeader>
                             <CardTitle>{activeMenu}</CardTitle>
                         </CardHeader>
                         <CardContent>
                             <p>Fitur untuk {activeMenu} sedang dalam pengembangan.</p>
                         </CardContent>
                     </Card>
                 )}
            </main>
        </SidebarInset>
        </SidebarProvider>
        </>
    );
}
