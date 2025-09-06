
'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { RencanaPemasukan, UserData, LocationData, Job, AlatData, TripLog, ArchivedJob, PemasukanLogEntry } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Loader2, X, FileClock, ListOrdered, Edit, Anchor, Archive, History, Package, PackagePlus, Truck, ActivitySquare, Ship, User, Fingerprint, Briefcase, ChevronDown, LogOut, Calendar as CalendarIconLucide, Search, FilterX, ArrowRightLeft, ShieldAlert, Play, Pause, Check, Printer, Info, Trash2, Eraser } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sidebar, SidebarProvider, SidebarInset, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarTrigger } from '@/components/ui/sidebar';
import { db, collection, getDocs, setDoc, doc, addDoc, updateDoc, onSnapshot, query, where, Timestamp, getDoc, deleteDoc, orderBy, increment } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay, isWithinInterval, formatDistanceStrict, isAfter, subDays, isSameDay } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn, printElement } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogDescription as AlertDialogDescriptionComponent } from '@/components/ui/alert-dialog';
import LaporanPemasukanPrintLayout from '@/components/laporan-pemasukan-print-layout';
import { DateRange } from 'react-day-picker';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const materialConfig = [
    { key: 'semen', name: 'SEMEN' },
    { key: 'pasir', name: 'PASIR' },
    { key: 'batu', name: 'BATU' },
];
const SHIP_TANK_COUNT = 6;
const MUATAN_PER_RIT_ESTIMASI_PASIR = 18;
const MUATAN_PER_RIT_ESTIMASI_BATU = 20;


const safeFormatDate = (dateInput: any, formatString: string) => {
    if (!dateInput) return '-';
    try {
        const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
        if (isNaN(date.getTime())) return '-';
        return format(date, formatString, { locale: localeID });
    } catch (error) {
        return '-';
    }
};

export default function AdminLogistikPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState('status');

  const [rencanaPemasukan, setRencanaPemasukan] = useState<RencanaPemasukan[]>([]);
  const [newRencana, setNewRencana] = useState<Partial<RencanaPemasukan>>({ jenisMaterial: 'SEMEN', tankLoads: {}, spbPerTank: {} });
  const [isSubmittingRencana, setIsSubmittingRencana] = useState(false);
  const [isConfirmArrivalOpen, setIsConfirmArrivalOpen] = useState(false);
  const [selectedRencana, setSelectedRencana] = useState<RencanaPemasukan | null>(null);
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allTripHistories, setAllTripHistories] = useState<Record<string, TripLog[]>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isCreateJobDialogOpen, setIsCreateJobDialogOpen] = useState(false);
  const [selectedRencanaForJob, setSelectedRencanaForJob] = useState<RencanaPemasukan | null>(null);
  const [jobCreationData, setJobCreationData] = useState({ bbmPerRit: 5, totalVolume: 0 });
  const [cementUnloadingStates, setCementUnloadingStates] = useState<Record<string, any>>({});
  const [archivedJobs, setArchivedJobs] = useState<ArchivedJob[]>([]);
  const [archivedCementJobs, setArchivedCementJobs] = useState<RencanaPemasukan[]>([]);
  const [isFetchingArchive, setIsFetchingArchive] = useState(false);
  const [archiveDateRange, setArchiveDateRange] = useState<DateRange | undefined>();
  const [filteredArchivedJobs, setFilteredArchivedJobs] = useState<ArchivedJob[]>([]);
  const [isArchiveDetailOpen, setIsArchiveDetailOpen] = useState(false);
  const [selectedArchivedJob, setSelectedArchivedJob] = useState<ArchivedJob | null>(null);

  const [alat, setAlat] = useState<AlatData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isMutasiDialogOpen, setIsMutasiDialogOpen] = useState(false);
  const [mutasiTarget, setMutasiTarget] = useState<AlatData | null>(null);
  const [newLocationForMutasi, setNewLocationForMutasi] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [isQuarantineConfirmOpen, setIsQuarantineConfirmOpen] = useState(false);
  const [quarantineTarget, setQuarantineTarget] = useState<AlatData | null>(null);
  const [dailyLog, setDailyLog] = useState<PemasukanLogEntry[]>([]);
  const [allPemasukan, setAllPemasukan] = useState<PemasukanLogEntry[]>([]);
  const [filteredPemasukan, setFilteredPemasukan] = useState<PemasukanLogEntry[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

   useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      setUserInfo(JSON.parse(userString));
    } else {
      router.push('/login');
    }
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update time every minute
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!userInfo) return;

    const unsubscribers: (() => void)[] = [];

    // Listener for Rencana Pemasukan
    const qRencana = query(collection(db, "rencana_pemasukan"), where('status', '!=', 'Selesai Bongkar'));
    unsubscribers.push(onSnapshot(qRencana, (snapshot) => {
        const data = snapshot.docs.map(d => ({...d.data(), id: d.id}) as RencanaPemasukan);
        setRencanaPemasukan(data.sort((a,b) => new Date(b.eta).getTime() - new Date(a.eta).getTime()));
    }));
    
    // Listener for Jobs
    const qJobs = query(collection(db, "available_jobs"));
    unsubscribers.push(onSnapshot(qJobs, (snapshot) => {
        const jobsData = snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Job);
        setJobs(jobsData);
    }));

     // Listener for Trip Histories
    const qTrips = query(collection(db, "all_trip_histories"));
    unsubscribers.push(onSnapshot(qTrips, (snapshot) => {
        const trips = snapshot.docs.map(d => d.data() as TripLog);
        const groupedByJob = trips.reduce((acc, trip) => {
            if (!acc[trip.jobId]) acc[trip.jobId] = [];
            acc[trip.jobId].push(trip);
            return acc;
        }, {} as Record<string, TripLog[]>);
        setAllTripHistories(groupedByJob);
    }));
    
     // Listener for Cement Unloading State
    const qCementState = query(collection(db, "bongkar_state"));
    unsubscribers.push(onSnapshot(qCementState, (snapshot) => {
        const states = snapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = doc.data();
            return acc;
        }, {} as Record<string, any>);
        setCementUnloadingStates(states);
    }));
    
    // Listener for all material income history
    const qPemasukan = query(collection(db, 'arsip_pemasukan_material_semua'), orderBy('timestamp', 'desc'));
    unsubscribers.push(onSnapshot(qPemasukan, (snapshot) => {
        const historyData = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as PemasukanLogEntry);
        setAllPemasukan(historyData);
        
        // Populate daily log from the fetched history
        const todayStart = startOfDay(new Date());
        const todaysLog = historyData.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return isSameDay(entryDate, todayStart);
        });
        setDailyLog(todaysLog);

        // Update filtered history if no date range is selected
        if (!dateRange) {
          setFilteredPemasukan(historyData);
        }
    }));


    // Fetch static data once
    const fetchStaticAndHistory = async () => {
        const alatSnap = await getDocs(collection(db, 'alat'));
        setAlat(alatSnap.docs.map(d => ({...d.data(), id: d.id} as AlatData)));

        const locsSnap = await getDocs(collection(db, 'locations'));
        setLocations(locsSnap.docs.map(d => ({...d.data(), id: d.id} as LocationData)));
        
        const archiveSnap = await getDocs(query(collection(db, 'archived_jobs')));
        const archivedData = archiveSnap.docs.map(d => ({...d.data(), id: d.id} as ArchivedJob));
        setArchivedJobs(archivedData);
        setFilteredArchivedJobs(archivedData);

        const cementArchiveSnap = await getDocs(query(collection(db, 'rencana_pemasukan'), where('status', '==', 'Selesai Bongkar')));
        setArchivedCementJobs(cementArchiveSnap.docs.map(d => ({ ...d.data(), id: d.id }) as RencanaPemasukan));
    };

    fetchStaticAndHistory();

    return () => unsubscribers.forEach(unsub => unsub());

  }, [userInfo, dateRange]);

  const activeJobs = useMemo(() => jobs.filter(job => job.status === 'Proses' || job.status === 'Menunggu'), [jobs]);

  const handleNewRencanaChange = (field: keyof RencanaPemasukan, value: any) => {
    setNewRencana(prev => ({ ...prev, [field]: value }));
  };

  const handleRencanaSpbChange = (tankId: string, value: string) => {
    setNewRencana(prev => ({ ...prev, spbPerTank: { ...prev.spbPerTank, [tankId]: value.toUpperCase() } }));
  };

  const handleRencanaMuatanChange = (tankId: string, value: string) => {
    const amount = parseInt(value) || 0;
    setNewRencana(prev => ({ ...prev, tankLoads: { ...prev.tankLoads, [tankId]: amount } }));
  };

  const handleRencanaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const { row, col } = e.currentTarget.dataset;
      if (row && col) {
        const nextRow = parseInt(row, 10);
        const nextCol = parseInt(col, 10);
        const nextInput = document.querySelector(`[data-row="${nextCol === 1 ? nextRow + 1 : nextRow}"][data-col="${nextCol === 1 ? 0 : 1}"]`) as HTMLElement;
        nextInput?.focus();
      }
    }
  };
  
   const handleSaveRencana = async () => {
    if (!newRencana.namaKapal || !newRencana.jenisMaterial || !newRencana.eta) {
      toast({ title: "Data Tidak Lengkap", variant: "destructive" });
      return;
    }
    
    if (newRencana.jenisMaterial === 'SEMEN') {
      const filledTanks = Object.values(newRencana.tankLoads || {}).filter(v => v > 0);
      const filledSpb = Object.values(newRencana.spbPerTank || {}).filter(v => v);
      if (filledTanks.length !== SHIP_TANK_COUNT || filledSpb.length !== SHIP_TANK_COUNT) {
         toast({ title: "Detail Tangki Tidak Lengkap", description: `Harap isi semua ${SHIP_TANK_COUNT} tangki.`, variant: "destructive" });
         return;
      }
       const uniqueSpb = new Set(Object.values(newRencana.spbPerTank || {}));
        if (uniqueSpb.size !== SHIP_TANK_COUNT) {
          toast({ title: "SPB Duplikat", description: "Setiap tangki harus punya nomor SPB unik.", variant: "destructive" });
          return;
        }
    } else {
        if (!newRencana.estimasiMuatan || !newRencana.noSpb) {
            toast({ title: "Data Tidak Lengkap", description: "Harap isi volume estimasi dan nomor SPB.", variant: "destructive" });
            return;
        }
    }


    setIsSubmittingRencana(true);
    const dataToSave: Partial<RencanaPemasukan> = { ...newRencana, namaSuplier: newRencana.namaSuplier || '', status: 'Dalam Perjalanan', createdAt: Timestamp.now() };

    try {
      await addDoc(collection(db, "rencana_pemasukan"), dataToSave);
      toast({ title: "Rencana Tersimpan" });
      setNewRencana({ jenisMaterial: 'SEMEN', tankLoads: {}, spbPerTank: {} });
    } catch (error) {
      toast({ title: "Gagal Menyimpan", variant: "destructive" });
    } finally {
      setIsSubmittingRencana(false);
    }
  };

  const handleConfirmArrival = async (rencana: RencanaPemasukan) => {
    const docRef = doc(db, 'rencana_pemasukan', rencana.id);
    const newStatus = rencana.jenisMaterial === 'SEMEN' ? 'Siap Untuk Dibongkar' : 'Menunggu Inspeksi QC';
    try {
        await updateDoc(docRef, {
            status: newStatus,
            arrivalConfirmedAt: new Date().toISOString()
        });
        toast({ title: "Kedatangan Dikonfirmasi" });
        setIsConfirmArrivalOpen(false);
        setSelectedRencana(null);
    } catch(e) {
        toast({ title: 'Gagal Konfirmasi', variant: 'destructive' });
    }
  }
  
   const handleManualQCPass = async (rencana: RencanaPemasukan) => {
    const docRef = doc(db, 'rencana_pemasukan', rencana.id);
    await updateDoc(docRef, { status: 'Memenuhi Syarat' });
    toast({ title: `QC untuk ${rencana.namaKapal} diluluskan.` });
  };
  
  const handleCreateJobFromRencana = async () => {
    if (!selectedRencanaForJob) return;

    const jobData: Omit<Job, 'id'> = {
        namaKapal: selectedRencanaForJob.namaKapal,
        material: selectedRencanaForJob.jenisMaterial as 'Batu' | 'Pasir',
        totalVolume: jobCreationData.totalVolume,
        volumeTerbongkar: 0,
        sisaVolume: jobCreationData.totalVolume,
        bbmPerRit: jobCreationData.bbmPerRit,
        status: 'Proses',
        jamMulai: new Date().toISOString(),
        totalWaktuTunda: 0,
        riwayatTunda: [],
        rencanaId: selectedRencanaForJob.id,
    };

    try {
        await addDoc(collection(db, "available_jobs"), jobData);
        await updateDoc(doc(db, "rencana_pemasukan", selectedRencanaForJob.id), { status: 'Siap Untuk Dibongkar' });
        toast({ title: "Perintah Bongkar Diterbitkan" });
        setIsCreateJobDialogOpen(false);
        setSelectedRencanaForJob(null);
    } catch (e) {
        toast({ title: 'Gagal Terbitkan WO', variant: 'destructive' });
    }
  };
  
  const handleJobStatusChange = async (jobId: string, newStatus: Job['status']) => {
    const jobRef = doc(db, 'available_jobs', jobId);
    const jobData = jobs.find(j => j.id === jobId);
    if (!jobData) return;
  
    let updateData: Partial<Job> = { status: newStatus };
  
    if (newStatus === 'Proses' && !jobData.jamMulai) {
      updateData.jamMulai = new Date().toISOString();
    } else if (newStatus === 'Selesai' && !jobData.jamSelesai) {
      updateData.jamSelesai = new Date().toISOString();
  
      // Log to history
      if (jobData.rencanaId) {
        const rencanaDocRef = doc(db, 'rencana_pemasukan', jobData.rencanaId);
        const rencanaDocSnap = await getDoc(rencanaDocRef);
        if (rencanaDocSnap.exists()) {
          const rencanaData = rencanaDocSnap.data() as RencanaPemasukan;
          const logEntry: Omit<PemasukanLogEntry, 'id'> = {
            timestamp: new Date().toISOString(),
            material: jobData.material,
            noSpb: rencanaData.noSpb,
            namaKapal: jobData.namaKapal,
            namaSopir: rencanaData.namaSopir || '',
            jumlah: jobData.totalVolume,
            unit: 'M³',
            keterangan: `Selesai bongkar otomatis dari WO.`,
            lokasi: userInfo?.lokasi,
          };
          await addDoc(collection(db, 'arsip_pemasukan_material_semua'), logEntry);
          await updateDoc(rencanaDocRef, { status: 'Selesai Bongkar' });
          toast({ title: "Pemasukan Material Dicatat", description: `${jobData.totalVolume} M³ ${jobData.material} telah dicatat.` });
        }
      }
    } else if (newStatus === 'Tunda') {
      const reason = prompt("Masukkan alasan menunda pekerjaan:");
      if (reason) {
        updateData.riwayatTunda = [...(jobData.riwayatTunda || []), { alasan: reason, waktuMulai: new Date().toISOString() }];
      } else {
        return; // User cancelled
      }
    } else if (newStatus === 'Proses' && jobData.status === 'Tunda') {
      const lastTunda = jobData.riwayatTunda?.[jobData.riwayatTunda.length - 1];
      if (lastTunda && !lastTunda.waktuSelesai) {
        lastTunda.waktuSelesai = new Date().toISOString();
        const tundaDuration = new Date(lastTunda.waktuSelesai).getTime() - new Date(lastTunda.waktuMulai).getTime();
        updateData.totalWaktuTunda = (jobData.totalWaktuTunda || 0) + tundaDuration;
        updateData.riwayatTunda = jobData.riwayatTunda;
      }
    }
    
    await updateDoc(jobRef, updateData);
    
    if (newStatus === 'Selesai') {
        await addDoc(collection(db, 'archived_jobs'), {
            ...jobData,
            ...updateData,
            tripLogs: allTripHistories[jobId] || [],
            archivedAt: new Date().toISOString()
        });
        await deleteDoc(jobRef); // Delete from active jobs
    }
  };
    
    const calculateEffectiveTime = (job: any) => {
        const start = job.jamMulai ? new Date(job.jamMulai) : (job.arrivalConfirmedAt ? new Date(job.arrivalConfirmedAt) : null);
        const end = job.jamSelesai ? new Date(job.jamSelesai) : (job.bongkarSelesaiAt ? new Date(job.bongkarSelesaiAt) : null);

        if (!start || !end) return '-';
        const totalDuration = end.getTime() - start.getTime();
        const effectiveDuration = totalDuration - (job.totalWaktuTunda || 0);

        return effectiveDuration > 0 ? formatDistanceStrict(0, effectiveDuration, { locale: localeID }) : '0 menit';
    };
    
     const handleSearchArchive = async () => {
        if (!archiveDateRange?.from) {
            setFilteredArchivedJobs(archivedJobs);
            return;
        }
        setIsFetchingArchive(true);
        const fromDate = startOfDay(archiveDateRange.from);
        const toDate = archiveDateRange.to ? endOfDay(archiveDateRange.to) : endOfDay(fromDate);

        const filtered = archivedJobs.filter(job => {
            const jobDate = new Date(job.jamSelesai || job.archivedAt);
            return isWithinInterval(jobDate, { start: fromDate, end: toDate });
        });
        
        setFilteredArchivedJobs(filtered);
        setIsFetchingArchive(false);
    };

    const handleMutasiRequest = (item: AlatData) => {
        setMutasiTarget(item);
        setIsMutasiDialogOpen(true);
    };

    const handleConfirmMutasi = async () => {
        if (!mutasiTarget || !newLocationForMutasi) {
            toast({ title: "Lokasi Tujuan harus dipilih", variant: "destructive" });
            return;
        }
        setIsMutating(true);
        const alatRef = doc(db, 'alat', mutasiTarget.id);
        try {
            await updateDoc(alatRef, { lokasi: newLocationForMutasi });
            toast({ title: "Mutasi Alat Berhasil", description: `${mutasiTarget.nomorLambung} telah dipindahkan ke ${newLocationForMutasi}` });
        } catch(e) {
            toast({ title: "Gagal Mutasi", variant: "destructive" });
        } finally {
            setIsMutating(false);
            setIsMutasiDialogOpen(false);
        }
    };
    
    const handleQuarantineRequest = (item: AlatData) => {
        setQuarantineTarget(item);
        setIsQuarantineConfirmOpen(true);
    };
    
    const handleConfirmQuarantine = async () => {
        if (!quarantineTarget) return;
        const alatRef = doc(db, 'alat', quarantineTarget.id);
        try {
            await updateDoc(alatRef, { statusKarantina: true });
            toast({ title: "Alat Dikarantina", description: `${quarantineTarget.nomorLambung} telah masuk karantina.` });
            setIsQuarantineConfirmOpen(false);
        } catch(e) {
            toast({ title: "Gagal Karantina", variant: "destructive" });
        }
    };
    
    const handleLogout = () => {
        localStorage.removeItem('user');
        router.push('/login');
    };
    
    const getRencanaStatusBadge = (status: RencanaPemasukan['status']) => {
        const statusMap: Record<NonNullable<RencanaPemasukan['status']>, { text: string; className: string }> = {
            'Dalam Perjalanan': { text: 'Perjalanan', className: 'bg-blue-100 text-blue-800' },
            'Telah Tiba': { text: 'Tiba', className: 'bg-purple-100 text-purple-800' },
            'Menunggu Inspeksi QC': { text: 'Tunggu QC', className: 'bg-cyan-100 text-cyan-800' },
            'Sedang Dilakukan Inspeksi QC': { text: 'Inspeksi', className: 'bg-yellow-100 text-yellow-800 animate-pulse' },
            'Memenuhi Syarat': { text: 'Lulus QC', className: 'bg-green-100 text-green-800' },
            'Ditolak': { text: 'Ditolak', className: 'bg-red-200 text-red-900' },
            'Siap Untuk Dibongkar': { text: 'Siap Bongkar', className: 'bg-teal-100 text-teal-800' },
            'Selesai Bongkar': { text: 'Selesai', className: 'bg-gray-100 text-gray-800' },
            'Dibatalkan': { text: 'Batal', className: 'bg-red-200 text-red-900' },
        };
        const statusInfo = status ? statusMap[status] : { text: 'Unknown', className: 'bg-gray-200' };
        return <Badge className={statusInfo.className}>{statusInfo.text}</Badge>;
    };

  const clearHistoryFilter = () => {
    setDateRange(undefined);
    setFilteredPemasukan(allPemasukan);
  }
  
  const handleSearchHistory = () => {
        if (!dateRange?.from) {
            setFilteredPemasukan(allPemasukan);
            return;
        };

        setIsFetchingHistory(true);
        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(fromDate);
        
        const filtered = allPemasukan.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return isWithinInterval(entryDate, { start: fromDate, end: toDate });
        });

        setFilteredPemasukan(filtered);
        setIsFetchingHistory(false);
    };

    if (isLoading || !userInfo) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin" />
            </div>
        );
    }
  
  return (
    <>
      <div className="hidden">
        <div id="pemasukan-harian-print-area">
          <LaporanPemasukanPrintLayout
            data={dailyLog}
            location={userInfo.lokasi || ''}
            period={undefined}
          />
        </div>
        <div id="riwayat-pemasukan-print-area">
          <LaporanPemasukanPrintLayout
            data={filteredPemasukan}
            location={userInfo.lokasi || ''}
            period={dateRange}
          />
        </div>
      </div>
      <AlertDialog open={isConfirmArrivalOpen} onOpenChange={setIsConfirmArrivalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Konfirmasi Kedatangan: {selectedRencana?.namaKapal}</AlertDialogTitle><AlertDialogDescriptionComponent>Pastikan kendaraan sudah tiba di lokasi sebelum melanjutkan.</AlertDialogDescriptionComponent></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => selectedRencana && handleConfirmArrival(selectedRencana)}>Ya, Sudah Tiba</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={isArchiveDetailOpen} onOpenChange={setIsArchiveDetailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detail Riwayat Bongkar: {selectedArchivedJob?.namaKapal}</DialogTitle>
            <DialogDescription>
              Diarsipkan pada {selectedArchivedJob && selectedArchivedJob.archivedAt ? format(new Date(selectedArchivedJob.archivedAt), "dd MMMM yyyy, HH:mm", { locale: localeID }) : '-'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
            {selectedArchivedJob && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Ringkasan Pekerjaan</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Material</p><p className="font-semibold">{selectedArchivedJob.material}</p></div>
                    <div><p className="text-muted-foreground">Volume Dibongkar</p><p className="font-semibold">{selectedArchivedJob.volumeTerbongkar} M³</p></div>
                    <div><p className="text-muted-foreground">Waktu Efektif</p><p className="font-semibold">{calculateEffectiveTime(selectedArchivedJob)}</p></div>
                    <div><p className="text-muted-foreground">Total Tunda</p><p className="font-semibold">{selectedArchivedJob.totalWaktuTunda ? formatDistanceStrict(0, selectedArchivedJob.totalWaktuTunda, { locale: localeID }) : '-'}</p></div>
                  </CardContent>
                </Card>

                {selectedArchivedJob.tripLogs && selectedArchivedJob.tripLogs.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Rincian Ritase Bongkar</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rit</TableHead>
                            <TableHead>Sopir</TableHead>
                            <TableHead>Durasi Siklus</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedArchivedJob.tripLogs.map(trip => (
                            <TableRow key={trip.tripNumber}>
                              <TableCell>{trip.tripNumber}</TableCell>
                              <TableCell>{trip.sopirName}</TableCell>
                              <TableCell>{trip.departFromBp && trip.arriveAtBp ? formatDistanceStrict(new Date(trip.arriveAtBp), new Date(trip.departFromBp), { locale: localeID }) : '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsArchiveDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isCreateJobDialogOpen} onOpenChange={setIsCreateJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terbitkan Perintah Bongkar untuk {selectedRencanaForJob?.namaKapal}</DialogTitle>
            <DialogDescription>Konfirmasi detail untuk pekerjaan bongkar. Data ini akan menjadi acuan volume aktual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Nama Kapal / Truk</Label>
              <Input value={selectedRencanaForJob?.namaKapal} disabled />
            </div>
            <div className="space-y-1">
              <Label>Material</Label>
              <Input value={selectedRencanaForJob?.jenisMaterial} disabled />
            </div>
            <div className="space-y-1">
              <Label htmlFor="totalVolume">Volume Muatan (Aktual M³)</Label>
              <Input id="totalVolume" name="totalVolume" type="number" value={jobCreationData.totalVolume} onChange={e => setJobCreationData(d => ({ ...d, totalVolume: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bbmPerRit">BBM / Rit (Liter)</Label>
              <Input id="bbmPerRit" name="bbmPerRit" type="number" value={jobCreationData.bbmPerRit} onChange={e => setJobCreationData(d => ({ ...d, bbmPerRit: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateJobDialogOpen(false)}>Batal</Button>
            <Button onClick={handleCreateJobFromRencana}>Ya, Terbitkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isMutasiDialogOpen} onOpenChange={setIsMutasiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <AlertDialogTitle>Konfirmasi Mutasi Alat: {mutasiTarget?.nomorLambung}</AlertDialogTitle>
            <AlertDialogDescriptionComponent>
              Pindahkan alat dari lokasi <strong>{mutasiTarget?.lokasi}</strong> ke lokasi baru. Pastikan Anda yakin sebelum melanjutkan.
            </AlertDialogDescriptionComponent>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="mutasi-location">Pilih Lokasi Tujuan</Label>
            <Select value={newLocationForMutasi} onValueChange={setNewLocationForMutasi}>
              <SelectTrigger id="mutasi-location"><SelectValue placeholder="Pilih lokasi..." /></SelectTrigger>
              <SelectContent>
                {locations.filter(l => l.name !== mutasiTarget?.lokasi).map(loc => (
                  <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMutasiDialogOpen(false)}>Batal</Button>
            <Button onClick={handleConfirmMutasi} disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Konfirmasi & Pindahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isQuarantineConfirmOpen} onOpenChange={setIsQuarantineConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Karantina</AlertDialogTitle>
            <AlertDialogDescriptionComponent>
              Anda yakin ingin memindahkan kendaraan <strong>{quarantineTarget?.nomorLambung}</strong> ke daftar "Alat Rusak Berat" (Karantina)?
            </AlertDialogDescriptionComponent>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmQuarantine} className="bg-destructive hover:bg-destructive/90">
              Ya, Karantina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarHeader><h2 className="text-xl font-semibold text-foreground">Admin Logistik</h2></SidebarHeader>
            <SidebarMenu className="flex-1">
              <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'status'} onClick={() => setActiveMenu('status')}><ActivitySquare />Status Bongkaran Hari Ini</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'rencana'} onClick={() => setActiveMenu('rencana')}><FileClock />Rencana Pemasukan Material</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'bongkar'} onClick={() => setActiveMenu('bongkar')}><Anchor />Bongkar Batu &amp; Pasir Hari Ini (WO-Sopir DT)</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'riwayat-bongkar'} onClick={() => setActiveMenu('riwayat-bongkar')}><Archive />Riwayat Bongkar</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'pemasukan'} onClick={() => setActiveMenu('pemasukan')}><PackagePlus />Pemasukan Material</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'riwayat'} onClick={() => setActiveMenu('riwayat')}><History />Riwayat Pemasukan</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'daftar-kendaraan'} onClick={() => setActiveMenu('daftar-kendaraan')}><Truck />Daftar Kendaraan</SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'stok'} onClick={() => router.push('/stok-material-logistik')}><Package />Stok Material</SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu>
            <SidebarFooter>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
                    <User className="h-8 w-8" />
                    <div className='text-left'>
                      <p className='text-sm font-semibold'>{userInfo.username}</p>
                      <p className='text-xs text-muted-foreground flex items-center gap-1.5'><Fingerprint size={12} />{userInfo.nik}</p>
                      <p className='text-xs text-muted-foreground flex items-center gap-1.5'><Briefcase size={12} />{userInfo.jabatan}</p>
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
          <main className="flex-1 p-6 lg:p-10 no-print">
            <header className="flex items-center justify-between gap-4 mb-8"><div className='flex items-center gap-4'><SidebarTrigger /><div><h1 className="text-2xl font-bold tracking-wider">{activeMenu === 'pemasukan' ? 'Pemasukan Material' : activeMenu === 'riwayat' ? 'Riwayat Pemasukan Material' : activeMenu === 'rencana' ? 'Rencana Pemasukan Material' : activeMenu === 'riwayat-bongkar' ? 'Riwayat Bongkar Material' : activeMenu === 'status' ? 'Status Bongkaran Hari Ini' : activeMenu === 'daftar-kendaraan' ? 'Daftar Kendaraan Aktif' : 'Bongkar Batu & Pasir Hari Ini (WO-Sopir DT)'}</h1><p className="text-muted-foreground">Lokasi: <span className='font-semibold text-primary'>{userInfo.lokasi}</span></p></div></div>{activeMenu === 'pemasukan' && (<Button variant="outline" onClick={() => printElement('pemasukan-harian-print-area')}><Printer className="mr-2 h-4 w-4" /> Cetak Laporan Hari Ini</Button>)}</header>

            {activeMenu === 'status' && (<div className='space-y-6'>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Ship className="text-primary" />Bongkaran Semen Sedang Berjalan
                  </CardTitle>
                </CardHeader>
                <CardContent className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {rencanaPemasukan.filter(r => r.status === 'Siap Untuk Dibongkar' && r.jenisMaterial === 'SEMEN').length > 0 ? rencanaPemasukan.filter(r => r.status === 'Siap Untuk Dibongkar' && r.jenisMaterial === 'SEMEN').map(job => {
                    const state = cementUnloadingStates[job.id] || { activities: [], completedActivities: [] };
                    const activeTransfers = state.activities.length;
                    const completedTransfers = state.completedActivities.length;
                    const totalTanks = Object.values(job.tankLoads || {}).filter(v => v > 0).length;
                    const duration = calculateEffectiveTime(job);

                    return (
                      <Card key={job.id} className="bg-card/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="truncate">{job.namaKapal}</CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-2 text-sm'>
                          <p><strong>Transfer Aktif:</strong> {activeTransfers} tangki</p>
                          <p><strong>Selesai:</strong> {completedTransfers} / {totalTanks} tangki</p>
                          <p><strong>Durasi Total:</strong> {duration}</p>
                        </CardContent>
                      </Card>
                    )
                  }) : <p className='text-muted-foreground col-span-full text-center py-4'>Tidak ada aktivitas bongkar semen saat ini.</p>}
                </CardContent>
              </Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-3"><Anchor className="text-primary" />Bongkaran Batu/Pasir Sedang Berjalan</CardTitle></CardHeader><CardContent className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {jobs.filter(j => j.status === 'Proses').length > 0 ? jobs.filter(j => j.status === 'Proses').map(job => {
                  const trips = allTripHistories[job.id] || []; const ritasi = trips.length;
                  const muatanPerRit = job.material === 'Pasir' ? MUATAN_PER_RIT_ESTIMASI_PASIR : MUATAN_PER_RIT_ESTIMASI_BATU;
                  const volumeTerbongkar = ritasi * muatanPerRit;
                  const activeSopir = new Set(trips.map(t => t.sopirId)).size;
                  const duration = job.jamMulai ? formatDistanceStrict(currentTime, new Date(job.jamMulai), { locale: localeID }) : '0 menit';
                  return (<Card key={job.id} className="bg-card/50"><CardHeader className="pb-2"><CardTitle className="truncate">{job.namaKapal} ({job.material})</CardTitle></CardHeader><CardContent className='space-y-2 text-sm'><p><strong>Estimasi Volume:</strong> {volumeTerbongkar.toLocaleString()} / {job.totalVolume.toLocaleString()} M³</p><p><strong>Ritasi:</strong> {ritasi} Rit</p><p><strong>Jumlah DT:</strong> {activeSopir} Kendaraan</p><p><strong>Waktu Berjalan:</strong> {duration}</p></CardContent></Card>)
                }) : <p className='text-muted-foreground col-span-full text-center py-4'>Tidak ada aktivitas bongkar batu/pasir saat ini.</p>}
              </CardContent></Card>
            </div>
            )}

            {activeMenu === 'daftar-kendaraan' && (
              <Card>
                <CardHeader>
                  <CardTitle>Daftar Kendaraan di {userInfo.lokasi}</CardTitle>
                  <CardDescription>Menampilkan semua kendaraan jenis DT yang terdaftar di lokasi ini, kecuali yang sedang dikarantina.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Lambung</TableHead>
                          <TableHead>No. Polisi</TableHead>
                          <TableHead>Jenis Kendaraan</TableHead>
                          <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {alat.filter(a => a.lokasi === userInfo.lokasi && !a.statusKarantina && a.jenisKendaraan.toUpperCase() === 'DT').length > 0 ?
                          alat.filter(a => a.lokasi === userInfo.lokasi && !a.statusKarantina && a.jenisKendaraan.toUpperCase() === 'DT').map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="font-semibold">{item.nomorLambung}</TableCell>
                              <TableCell>{item.nomorPolisi}</TableCell>
                              <TableCell>{item.jenisKendaraan}</TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button size="sm" variant="outline" onClick={() => handleMutasiRequest(item)}><ArrowRightLeft className="mr-2 h-4 w-4" /> Mutasi</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleQuarantineRequest(item)}><ShieldAlert className="mr-2 h-4 w-4" /> Karantina</Button>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center h-24">Tidak ada kendaraan jenis DT di lokasi ini.</TableCell>
                            </TableRow>
                          )
                        }
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}


            {activeMenu === 'rencana' && (<div className="space-y-8">
              <Card><CardHeader><CardTitle className="flex items-center gap-3"><Edit />Input Rencana Pemasukan Material</CardTitle></CardHeader><CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1"><Label>Nama Kapal / Truk</Label><Input value={newRencana.namaKapal || ''} onChange={e => handleNewRencanaChange('namaKapal', e.target.value.toUpperCase())} placeholder="KM. MAKMUR" /></div>
                  <div className="space-y-1"><Label>Nama Suplier</Label><Input value={newRencana.namaSuplier || ''} onChange={e => handleNewRencanaChange('namaSuplier', e.target.value.toUpperCase())} placeholder="PT. ABC" /></div>
                  <div className="space-y-1"><Label>Jenis Material</Label><Select value={newRencana.jenisMaterial} onValueChange={val => handleNewRencanaChange('jenisMaterial', val)}><SelectTrigger><SelectValue placeholder="Pilih material..." /></SelectTrigger><SelectContent>{materialConfig.map(m => <SelectItem key={m.key} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select></div>

                  {newRencana.jenisMaterial !== 'SEMEN' && (
                    <>
                      <div className="space-y-1"><Label>Volume Muatan (Aktual M³)</Label><Input type="number" value={newRencana.estimasiMuatan || ''} onChange={e => handleNewRencanaChange('estimasiMuatan', Number(e.target.value))} placeholder="0" /></div>
                      <div className="space-y-1"><Label>Nomor SPB</Label><Input value={newRencana.noSpb || ''} onChange={e => handleNewRencanaChange('noSpb', e.target.value.toUpperCase())} placeholder="Nomor Surat Jalan" /></div>
                    </>
                  )}

                  <div className="space-y-1"><Label>Nama Kapten / Sopir</Label><Input value={newRencana.namaSopir || ''} onChange={e => handleNewRencanaChange('namaSopir', e.target.value.toUpperCase())} placeholder="Joko" /></div>
                  <div className="lg:col-span-2 space-y-1"><Label>Estimasi Tiba</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIconLucide className="mr-2 h-4 w-4" />{newRencana.eta ? format(newRencana.eta, "PPP HH:mm") : <span>Pilih tanggal & waktu</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newRencana.eta} onSelect={date => handleNewRencanaChange('eta', date || new Date())} /><div className="p-2 border-t"><Input type="time" value={newRencana.eta ? format(newRencana.eta, "HH:mm") : "00:00"} onChange={e => { const [h, m] = e.target.value.split(':'); const newDate = new Date(newRencana.eta || new Date()); newDate.setHours(Number(h)); newDate.setMinutes(Number(m)); handleNewRencanaChange('eta', newDate) }} /></div></PopoverContent></Popover></div>
                </div>
                {newRencana.jenisMaterial === 'SEMEN' && <div className="pt-4 mt-4 border-t"><Label className="font-semibold">Rincian Muatan & SPB per Tangki Kapal</Label><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">{Array.from({ length: SHIP_TANK_COUNT }).map((_, i) => { const tankId = `tank-${i + 1}`; return (<div key={tankId} className="space-y-2 p-3 border rounded-md bg-muted/30"><Label htmlFor={tankId} className="flex items-center gap-2 text-xs"><Anchor size={14} />{tankId.replace('-', ' ')}</Label><Input data-row={i} data-col={0} onKeyDown={handleRencanaKeyDown} id={`${tankId}-spb`} value={newRencana.spbPerTank?.[tankId] || ''} onChange={(e) => handleRencanaSpbChange(tankId, e.target.value)} placeholder="Nomor SPB..." /><Input data-row={i} data-col={1} onKeyDown={handleRencanaKeyDown} id={`${tankId}-muatan`} type="number" value={newRencana.tankLoads?.[tankId] || ''} onChange={(e) => handleRencanaMuatanChange(tankId, e.target.value)} placeholder="Jumlah (KG)..." /></div>) })}</div></div>}
                <div className="flex justify-end pt-4"><Button onClick={handleSaveRencana} disabled={isSubmittingRencana}>{isSubmittingRencana ? <Loader2 className="animate-spin" /> : 'Simpan Rencana'}</Button></div>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-3"><ListOrdered />List Rencana Pemasukan Material</CardTitle></CardHeader><CardContent><div className="border rounded-md overflow-auto"><Table><TableHeader><TableRow><TableHead>ETA</TableHead><TableHead>Kapal/Truk</TableHead><TableHead>Suplier</TableHead><TableHead>Material</TableHead><TableHead>SPB</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{rencanaPemasukan.length > 0 ? rencanaPemasukan.map(r => (<TableRow key={r.id}><TableCell>{safeFormatDate(r.eta, "dd MMM, HH:mm")}</TableCell><TableCell>{r.namaKapal}</TableCell><TableCell>{r.namaSuplier || '-'}</TableCell><TableCell>{r.jenisMaterial}</TableCell><TableCell>{r.noSpb || 'Lihat Rincian'}</TableCell><TableCell>{getRencanaStatusBadge(r.status as any)}</TableCell><TableCell className="text-right">{r.status === 'Dalam Perjalanan' && (<Button variant="outline" size="sm" onClick={() => { setSelectedRencana(r); setIsConfirmArrivalOpen(true); }}>Konfirmasi Tiba</Button>)}{r.status === 'Memenuhi Syarat' && (<Button size="sm" onClick={() => { setSelectedRencanaForJob(r); setJobCreationData({ bbmPerRit: 5, totalVolume: r.estimasiMuatan || 0 }); setIsCreateJobDialogOpen(true); }}>Terbitkan WO</Button>)}{r.jenisMaterial === 'SEMEN' && r.status === 'Menunggu Inspeksi QC' && <Button variant="secondary" size="sm" onClick={() => handleManualQCPass(r)}>Luluskan QC Manual</Button>}{r.status === 'Menunggu Inspeksi QC' && r.jenisMaterial !== 'SEMEN' && <span className='text-xs text-muted-foreground'>Menunggu QC...</span>}{r.status === 'Siap Untuk Dibongkar' && r.jenisMaterial !== 'SEMEN' && <span className='text-xs text-muted-foreground'>Menunggu Sopir...</span>}{r.status === 'Siap Untuk Dibongkar' && r.jenisMaterial === 'SEMEN' && <span className='text-xs text-muted-foreground'>Menunggu Pekerja...</span>}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">Tidak ada rencana pemasukan.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
            </div>
            )}

            {activeMenu === 'bongkar' && (<div className="space-y-8">
              <Card>
                <CardHeader><CardTitle>Daftar Perintah Bongkar Aktif</CardTitle><CardDescription>Monitor dan ubah status pekerjaan bongkar yang sedang berjalan.</CardDescription></CardHeader>
                <CardContent><div className="border rounded-md overflow-auto"><Table><TableHeader><TableRow><TableHead>Kapal/Truk</TableHead><TableHead>Status</TableHead><TableHead>Rit</TableHead><TableHead>Vol. Aktual</TableHead><TableHead>Estimasi Vol. Terbongkar</TableHead><TableHead>Estimasi Sisa Volume</TableHead><TableHead>Jam Mulai</TableHead><TableHead>Jam Selesai</TableHead><TableHead>Waktu Tunda</TableHead><TableHead>Waktu Efektif</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{activeJobs.length > 0 ? activeJobs.map(job => {
                  const ritasiBerjalan = (allTripHistories[job.id] || []).length;
                  const muatanPerRit = job.material === 'Pasir' ? MUATAN_PER_RIT_ESTIMASI_PASIR : MUATAN_PER_RIT_ESTIMASI_BATU;
                  const volumeTerbongkar = ritasiBerjalan * muatanPerRit;
                  const sisaVolume = Math.max(0, job.totalVolume - volumeTerbongkar);

                  return (<TableRow key={job.id}><TableCell className="font-semibold">{job.namaKapal} <span className="text-muted-foreground">({job.material})</span>{job.riwayatTunda && job.riwayatTunda.length > 0 && (<ol className="text-xs text-orange-500 list-decimal list-inside mt-1 italic">{job.riwayatTunda.map((tunda, index) => <li key={index}>{tunda.alasan}</li>)}</ol>)}</TableCell><TableCell><Select value={job.status} onValueChange={(newStatus) => handleJobStatusChange(job.id, newStatus as Job['status'])} disabled={job.status === 'Selesai'}><SelectTrigger className='w-32'><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Menunggu"><Play className="inline-block mr-2 h-4 w-4 text-gray-500" />Menunggu</SelectItem><SelectItem value="Proses"><Play className="inline-block mr-2 h-4 w-4 text-blue-500" />Proses</SelectItem><SelectItem value="Tunda"><Pause className="inline-block mr-2 h-4 w-4 text-yellow-500" />Tunda</SelectItem><SelectItem value="Selesai"><Check className="inline-block mr-2 h-4 w-4 text-green-500" />Selesai</SelectItem></SelectContent></Select></TableCell><TableCell>{ritasiBerjalan}</TableCell><TableCell>{job.totalVolume} M³</TableCell><TableCell>{volumeTerbongkar} M³</TableCell><TableCell>{sisaVolume} M³</TableCell><TableCell>{safeFormatDate(job.jamMulai, 'dd MMM, HH:mm')}</TableCell><TableCell>{safeFormatDate(job.jamSelesai, 'dd MMM, HH:mm')}</TableCell><TableCell>{job.totalWaktuTunda ? formatDistanceStrict(0, job.totalWaktuTunda, { locale: localeID }) : '-'}</TableCell><TableCell>{calculateEffectiveTime(job)}</TableCell><TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteDoc(doc(db, 'available_jobs', job.id))}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </TableCell></TableRow>)
                }) : <TableRow><TableCell colSpan={11} className="text-center h-24 text-muted-foreground">Belum ada perintah bongkar yang diterbitkan.</TableCell></TableRow>}</TableBody></Table></div></CardContent>
              </Card>
            </div>
            )}

            {activeMenu === 'riwayat-bongkar' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>Riwayat Bongkar Batu & Pasir</CardTitle><CardDescription>Cari dan lihat detail pekerjaan bongkar agregat yang telah selesai.</CardDescription></CardHeader>
                  <CardContent className="space-y-4"><div className="flex flex-col md:flex-row gap-2 items-start md:items-center"><Popover><PopoverTrigger asChild><Button id="archiveDate" variant={"outline"} className={cn("w-full md:w-[300px] justify-start text-left font-normal", !archiveDateRange && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4" />{archiveDateRange?.from ? (archiveDateRange.to ? (<>{format(archiveDateRange.from, "LLL dd, y")} - {format(archiveDateRange.to, "LLL dd, y")}</>) : (format(archiveDateRange.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={archiveDateRange?.from} selected={archiveDateRange} onSelect={setArchiveDateRange} numberOfMonths={2} /></PopoverContent></Popover><Button onClick={handleSearchArchive} disabled={isFetchingArchive}>{isFetchingArchive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Cari Riwayat</Button><Button variant="ghost" onClick={() => { setFilteredArchivedJobs(archivedJobs); setArchiveDateRange(undefined); }}><FilterX className="mr-2 h-4 w-4" />Reset</Button></div><div className="border rounded-md overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Kapal/Truk</TableHead><TableHead>Material</TableHead><TableHead>Volume Total</TableHead><TableHead>Tgl Selesai</TableHead><TableHead>Waktu Efektif</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{isFetchingArchive ? (<TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></TableCell></TableRow>) : filteredArchivedJobs.length > 0 ? (filteredArchivedJobs.map(job => (<TableRow key={job.id}><TableCell>{job.namaKapal}</TableCell><TableCell>{job.material}</TableCell><TableCell>{job.totalVolume} M³</TableCell><TableCell>{safeFormatDate(job.jamSelesai, 'dd MMM yyyy')}</TableCell><TableCell>{calculateEffectiveTime(job)}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => { setSelectedArchivedJob(job); setIsArchiveDetailOpen(true); }}>Lihat Detail</Button></TableCell></TableRow>))) : (<TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground">Tidak ada arsip bongkar untuk filter yang dipilih.</TableCell></TableRow>)}</TableBody></Table></div></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Riwayat Bongkar Semen</CardTitle></CardHeader>
                  <CardContent>
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Kapal</TableHead><TableHead>Tgl Tiba</TableHead><TableHead>Total Muatan (KG)</TableHead><TableHead>Waktu Bongkar Efektif</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {archivedCementJobs.length > 0 ? archivedCementJobs.map(job => (
                            <TableRow key={job.id}>
                              <TableCell>{job.namaKapal}</TableCell>
                              <TableCell>{safeFormatDate(job.arrivalConfirmedAt, 'dd MMM yyyy, HH:mm')}</TableCell>
                              <TableCell>{(Object.values(job.tankLoads || {}).reduce((s, a) => s + a, 0)).toLocaleString('id-ID')}</TableCell>
                              <TableCell>{calculateEffectiveTime(job)}</TableCell>
                            </TableRow>
                          )) : (<TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Belum ada riwayat bongkar semen.</TableCell></TableRow>)}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeMenu === 'pemasukan' && (<div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3"><PackagePlus />Pencatatan Pemasukan Material</CardTitle>
                  <CardDescription>
                    <p className='text-sm text-muted-foreground flex items-center gap-2'><Info size={14} />Pencatatan pemasukan material kini dilakukan secara otomatis setelah proses bongkar selesai. Menu ini hanya untuk melihat log harian.</p>
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-3"><ListOrdered /> Log Pemasukan Hari Ini</CardTitle><CardDescription>Daftar semua material yang dicatat masuk pada hari ini.</CardDescription></CardHeader><CardContent><div className="border rounded-md max-h-96 overflow-auto"><Table><TableHeader className="sticky top-0 bg-muted"><TableRow><TableHead>Waktu</TableHead><TableHead>Material</TableHead><TableHead>No. SPB</TableHead><TableHead>Kapal/Truk</TableHead><TableHead>Jumlah</TableHead><TableHead>Keterangan</TableHead></TableRow></TableHeader><TableBody>{dailyLog.length > 0 ? (dailyLog.map(entry => (<TableRow key={entry.id}><TableCell>{safeFormatDate(entry.timestamp, 'HH:mm:ss')}</TableCell><TableCell>{entry.material}</TableCell><TableCell>{entry.noSpb}</TableCell><TableCell>{entry.namaKapal}</TableCell><TableCell>{entry.jumlah.toLocaleString('id-ID')} {entry.unit}</TableCell><TableCell>{entry.keterangan || '-'}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Belum ada pemasukan material hari ini.</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></div>
            )}

            {activeMenu === 'riwayat' && (<Card><CardHeader><CardTitle>Filter Riwayat Pemasukan</CardTitle><CardDescription>Cari data pemasukan material berdasarkan rentang tanggal.</CardDescription></CardHeader><CardContent className="flex flex-col md:flex-row items-center gap-4"><Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} /></PopoverContent></Popover><Button onClick={handleSearchHistory} disabled={isFetchingHistory}>{isFetchingHistory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Cari Riwayat</Button><Button variant="ghost" onClick={clearHistoryFilter}><FilterX className="mr-2 h-4 w-4" />Reset</Button></CardContent><CardContent><CardHeader className="px-0 flex-row items-center justify-between"><div><CardTitle>Hasil Pencarian</CardTitle><CardDescription>Menampilkan {filteredPemasukan.length} dari {allPemasukan.length} total data riwayat.</CardDescription></div><Button variant="outline" onClick={() => printElement('riwayat-pemasukan-print-area')} disabled={filteredPemasukan.length === 0}><Printer className="mr-2 h-4 w-4" />Cetak Hasil</Button></CardHeader><div className="border rounded-md max-h-96 overflow-auto"><Table><TableHeader className="sticky top-0 bg-muted"><TableRow><TableHead>Waktu</TableHead><TableHead>Material</TableHead><TableHead>No. SPB</TableHead><TableHead>Kapal/Truk</TableHead><TableHead>Jumlah</TableHead><TableHead>Keterangan</TableHead></TableRow></TableHeader><TableBody>{isFetchingHistory ? (<TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></TableCell></TableRow>) : filteredPemasukan.length > 0 ? (filteredPemasukan.map(entry => (<TableRow key={entry.id}><TableCell>{safeFormatDate(entry.timestamp, 'dd/MM/yy HH:mm')}</TableCell><TableCell>{entry.material}</TableCell><TableCell>{entry.noSpb}</TableCell><TableCell>{entry.namaKapal}</TableCell><TableCell>{entry.jumlah.toLocaleString('id-ID')} {entry.unit}</TableCell><TableCell>{entry.keterangan || '-'}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground">Tidak ada data untuk filter yang dipilih.</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
