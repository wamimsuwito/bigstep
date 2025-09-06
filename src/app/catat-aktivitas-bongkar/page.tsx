
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Play, Pause, Square, Ship, Warehouse, Anchor, Clock, Loader2, Building, CheckCircle, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { differenceInMilliseconds, format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RencanaPemasukan, CementSiloStock, CementActivity, SiloData, UserData, PemasukanLogEntry } from '@/lib/types';
import { id as localeID } from 'date-fns/locale';
import UnitSelectionDialog from '@/components/unit-selection-dialog';
import { db, collection, doc, getDocs, setDoc, query, where, getDoc, updateDoc, onSnapshot, runTransaction, Timestamp, addDoc } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const BP_SILO_COUNT = 6;
const BUFFER_SILO_COUNT = 12;
const BUFFER_TANK_COUNT = 30;

const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

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

export default function CatatAktivitasBongkarPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(true);
  
  const [activeJob, setActiveJob] = useState<RencanaPemasukan | null>(null);
  const [jobList, setJobList] = useState<RencanaPemasukan[]>([]);
  const [isFetchingJobs, setIsFetchingJobs] = useState(true);
  
  const [activities, setActivities] = useState<CementActivity[]>([]);
  const [completedActivities, setCompletedActivities] = useState<CementActivity[]>([]);

  // Dialog states
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [isCapacityWarningOpen, setIsCapacityWarningOpen] = useState(false);

  const [selectedSourceTank, setSelectedSourceTank] = useState<{ id: string; amount: number } | null>(null);
  const [selectedDestination, setSelectedDestination] = useState({ type: '', id: '', unit: '' });
  const [pauseReason, setPauseReason] = useState("");
  const [activityToPause, setActivityToPause] = useState<CementActivity | null>(null);
  
  const [_, setTick] = useState(0); // Forcing re-render
  
  const [allSiloData, setAllSiloData] = useState<Record<string, SiloData>>({});
  
  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const userData = JSON.parse(userString);
      setUserInfo(userData);
      const storedUnit = sessionStorage.getItem('selectedUnloadUnit');
      if (storedUnit) {
        setSelectedUnit(storedUnit);
        setIsUnitDialogOpen(false);
      } else {
        setIsUnitDialogOpen(true);
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!userInfo?.lokasi) return;

    const unsubscribers: (() => void)[] = [];
    const allStockTypes = [
        ...['BP-1', 'BP-2', 'BP-3'].map(unit => ({ path: `locations/${userInfo.lokasi}/stock_cement_silo_${unit}/main`, keyPrefix: unit })),
        { path: `locations/${userInfo.lokasi}/stock_buffer_silo/main`, keyPrefix: 'BufferSilo' },
        { path: `locations/${userInfo.lokasi}/stock_buffer_tank/main`, keyPrefix: 'BufferTank' }
    ];

    allStockTypes.forEach(stockType => {
        const docRef = doc(db, stockType.path);
        const unsub = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const stockData = docSnap.data();
                const items = stockData.silos || stockData.tanks || {};
                setAllSiloData(prev => {
                    const updatedSilos = { ...prev };
                    Object.entries(items).forEach(([siloId, data]) => {
                        updatedSilos[`${stockType.keyPrefix}-${siloId}`] = data as SiloData;
                    });
                    return updatedSilos;
                });
            }
        });
        unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(unsub => unsub());

  }, [userInfo?.lokasi]);

  useEffect(() => {
    if (!selectedUnit) return;

    const fetchReadyJobs = async () => {
        setIsFetchingJobs(true);
        const q = query(
            collection(db, 'rencana_pemasukan'),
            where('status', '==', 'Siap Untuk Dibongkar'),
            where('jenisMaterial', '==', 'SEMEN')
        );

        try {
            const querySnapshot = await getDocs(q);
            const readyJobs = querySnapshot.docs.map(d => ({...d.data(), id: d.id}) as RencanaPemasukan);
            setJobList(readyJobs);
        } catch (error) {
            console.error("Failed to fetch ready jobs:", error);
        } finally {
            setIsFetchingJobs(false);
        }
    };
    
    fetchReadyJobs();
  }, [selectedUnit]);

  // Timer effect to update running durations
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Persist state to Firestore
  const persistState = useCallback(async (jobId: string, currentActivities: CementActivity[], currentCompleted: CementActivity[]) => {
      if (!jobId) return;
      const stateToSave = {
        activities: currentActivities,
        completedActivities: currentCompleted,
      };
      const stateDocRef = doc(db, 'bongkar_state', jobId);
      await setDoc(stateDocRef, stateToSave, { merge: true });
  }, []);
  
  const handleUnitSelect = (unit: string) => {
    setSelectedUnit(unit);
    sessionStorage.setItem('selectedUnloadUnit', unit);
    setIsUnitDialogOpen(false);
  };

  const selectActiveJob = async (job: RencanaPemasukan) => {
    setActiveJob(job);
    const stateDocRef = doc(db, 'bongkar_state', job.id);
    const stateDoc = await getDoc(stateDocRef);
    if (stateDoc.exists()) {
        const savedState = stateDoc.data() as any;
        setActivities(savedState.activities || []);
        setCompletedActivities(savedState.completedActivities || []);
    } else {
        setActivities([]);
        setCompletedActivities([]);
    }
  };
  
  const unassignedTanks = useMemo(() => {
    if (!activeJob || !activeJob.tankLoads) return [];
    const assignedTankIds = new Set([...activities, ...completedActivities].map(a => a.sourceTankId));
    return Object.entries(activeJob.tankLoads)
        .map(([id, amount]) => ({ id, amount: Number(amount) }))
        .filter(t => t.amount > 0 && !assignedTankIds.has(t.id));
  }, [activeJob, activities, completedActivities]);

  const activeDestinations = useMemo(() => {
     return activities.filter(a => a.status === 'berjalan').map(a => a.destinationId);
  }, [activities]);
  
  const handleStartRequest = (tank: { id: string, amount: number }) => {
    setSelectedSourceTank(tank);
    setSelectedDestination({ type: '', id: '', unit: '' });
    setIsConfirmDialogOpen(true);
  };

  const executeStart = async () => {
      if (!selectedSourceTank || !selectedDestination.type || !selectedDestination.id || !activeJob) return;

      const newActivity: CementActivity = {
        id: `${selectedSourceTank.id}-to-${selectedDestination.id}`,
        sourceTankId: selectedSourceTank.id,
        destinationType: selectedDestination.type as any,
        destinationId: selectedDestination.id,
        destinationUnit: selectedDestination.type === 'silo' ? selectedDestination.unit : '',
        status: 'berjalan',
        startTime: new Date().toISOString(),
        endTime: null,
        pauseHistory: [],
        totalPauseDuration: 0,
      };

      const newActivities = [...activities, newActivity];
      try {
          await persistState(activeJob.id, newActivities, completedActivities);
          setActivities(newActivities);
          setIsConfirmDialogOpen(false);
          setSelectedSourceTank(null);
      } catch (e) {
          toast({ title: "Gagal Memulai", description: "Gagal menyimpan aktivitas baru.", variant: "destructive" });
      }
  }

  const handleStartConfirm = async () => {
    if (!selectedSourceTank || !selectedDestination.type || !selectedDestination.id) return;
    
    // Check capacity before starting
    const destPrefix = selectedDestination.type === 'silo' ? selectedDestination.unit : selectedDestination.type === 'buffer-silo' ? 'BufferSilo' : 'BufferTank';
    const destKey = `${destPrefix}-${selectedDestination.id}`;
    
    const siloInfo = allSiloData[destKey];
    const currentStock = siloInfo?.stock || 0;
    const capacity = siloInfo?.capacity || 90000;
    const amountToAdd = selectedSourceTank.amount;

    if ((currentStock + amountToAdd) > capacity) {
        setIsCapacityWarningOpen(true);
    } else {
        await executeStart();
    }
  };
  
  const handlePauseRequest = (activity: CementActivity) => {
    setActivityToPause(activity);
    setPauseReason("");
    setIsPauseDialogOpen(true);
  };

  const handleConfirmPause = async () => {
    if (!activityToPause || !activeJob) return;
    
    const newActivities = activities.map(act => 
        act.id === activityToPause.id 
        ? { ...act, status: 'jeda' as const, pauseHistory: [...act.pauseHistory, { start: new Date().toISOString(), end: null, reason: pauseReason || "Tidak ada alasan" }] } 
        : act
    );

    try {
        await persistState(activeJob.id, newActivities, completedActivities);
        setActivities(newActivities);
        setIsPauseDialogOpen(false);
        setActivityToPause(null);
    } catch (e) {
        toast({ title: "Gagal Menjeda", description: "Gagal menyimpan status jeda.", variant: "destructive" });
    }
  };
  
  const handleResume = async (activityId: string) => {
    if(!activeJob) return;
    const newActivities = activities.map(act => {
      if (act.id === activityId) {
        const lastPause = act.pauseHistory[act.pauseHistory.length - 1];
        if (lastPause && !lastPause.end) {
          lastPause.end = new Date().toISOString();
        }
        return { ...act, status: 'berjalan' as const };
      }
      return act;
    });

     try {
        await persistState(activeJob.id, newActivities, completedActivities);
        setActivities(newActivities);
    } catch (e) {
        toast({ title: "Gagal Melanjutkan", description: "Gagal menyimpan status lanjut.", variant: "destructive" });
    }
  };
  
    const handleFinish = async (activityId: string) => {
        const finishedActivity = activities.find(act => act.id === activityId);
        if (!finishedActivity || !activeJob) return;

        let finalActivityState = { ...finishedActivity, status: 'selesai' as const, endTime: new Date().toISOString() };
        if (finishedActivity.status === 'jeda') {
            const lastPause = finalActivityState.pauseHistory[finalActivityState.pauseHistory.length - 1];
            if (lastPause && !lastPause.end) {
                lastPause.end = new Date().toISOString();
            }
        }
        
        finalActivityState.totalPauseDuration = finalActivityState.pauseHistory.reduce((total, p) => {
          if (p.end) {
            return total + differenceInMilliseconds(new Date(p.end), new Date(p.start));
          }
          return total;
        }, 0);

        try {
            await updateStockAfterFinish(finalActivityState);
            const newActivities = activities.filter(act => act.id !== activityId);
            const newCompletedActivities = [...completedActivities, finalActivityState];
            await persistState(activeJob.id, newActivities, newCompletedActivities);
            setActivities(newActivities);
            setCompletedActivities(newCompletedActivities);
        } catch (error: any) {
            console.error("State persistence or stock update failed:", error);
            if (error.message.includes("Kapasitas Silo Penuh")) {
                 toast({ title: "Gagal Menyelesaikan", description: error.message, variant: "destructive" });
            } else {
                 toast({ title: "Gagal Menyelesaikan", description: "Terjadi kesalahan saat menyimpan data ke server.", variant: "destructive" });
            }
        }
    };

    const updateStockAfterFinish = async (finishedActivity: CementActivity) => {
        if (!activeJob || !userInfo?.lokasi) return;
    
        let stockDocPath: string, dataKey: 'silos' | 'tanks', siloKey: string;
    
        if (finishedActivity.destinationType === 'silo' && finishedActivity.destinationUnit) {
            stockDocPath = `locations/${userInfo.lokasi}/stock_cement_silo_${finishedActivity.destinationUnit}/main`;
            dataKey = 'silos';
            siloKey = finishedActivity.destinationId;
        } else if (finishedActivity.destinationType === 'buffer-silo') {
            stockDocPath = `locations/${userInfo.lokasi}/stock_buffer_silo/main`;
            dataKey = 'silos';
            siloKey = finishedActivity.destinationId;
        } else {
            stockDocPath = `locations/${userInfo.lokasi}/stock_buffer_tank/main`;
            dataKey = 'tanks';
            siloKey = finishedActivity.destinationId;
        }
    
        const stockDocRef = doc(db, stockDocPath);
        const amountToAdd = activeJob?.tankLoads?.[finishedActivity.sourceTankId] || 0;
    
        try {
            await runTransaction(db, async (transaction) => {
                const stockDocSnap = await transaction.get(stockDocRef);
                const currentData = stockDocSnap.exists() ? stockDocSnap.data() : { [dataKey]: {} };
                
                const allItems = (currentData as any)[dataKey] || {};
                const existingItemData: SiloData | undefined = allItems[siloKey];
    
                const currentStock = existingItemData?.stock || 0;
                const capacity = existingItemData?.capacity || 90000;
                const newStock = currentStock + amountToAdd;

                if (newStock > capacity) {
                    throw new Error("Kapasitas Silo Penuh. Bongkar Muatan Tidak Bisa Dilanjutkan.");
                }

                const updatedItemData: SiloData = {
                    stock: newStock,
                    status: existingItemData?.status || 'aktif',
                    capacity: capacity,
                };
    
                transaction.set(stockDocRef, {
                    [dataKey]: { ...allItems, [siloKey]: updatedItemData }
                }, { merge: true });
            });
        } catch (error) {
            console.error("Error updating stock in transaction:", error);
            if ((error as Error).message.includes("Kapasitas Silo Penuh")) {
                throw error;
            }
            toast({ title: "Gagal Memperbarui Stok", variant: "destructive", description: "Terjadi kesalahan saat transaksi database." });
            throw new Error("Gagal Memperbarui Stok");
        }
    };


  const calculateRunningDuration = useCallback((activity: CementActivity) => {
    if (activity.status === 'selesai' || !activity.startTime) return 0;
    const now = new Date();
    const startTime = new Date(activity.startTime);
    const end = activity.status === 'jeda' ? new Date(activity.pauseHistory.find(p => !p.end)?.start || now) : now;
    let totalPause = activity.pauseHistory.reduce((total, p) => total + differenceInMilliseconds(new Date(p.end || now), new Date(p.start)), 0);
    return differenceInMilliseconds(end, startTime) - totalPause;
  }, []);

  const handleFinishJob = async () => {
      if (!activeJob || !userInfo) return;
      
      const totalAmount = Object.values(activeJob.tankLoads || {}).reduce((sum, amount) => sum + amount, 0);

      const logEntry: Omit<PemasukanLogEntry, 'id'> = {
          timestamp: new Date().toISOString(),
          material: activeJob.jenisMaterial,
          noSpb: Object.values(activeJob.spbPerTank || {}).join(', '),
          namaKapal: activeJob.namaKapal,
          namaSopir: activeJob.namaSopir || '',
          jumlah: totalAmount,
          unit: 'KG',
          keterangan: `Selesai bongkar otomatis dari ${selectedUnit}.`,
          lokasi: userInfo.lokasi,
      };

      try {
          await addDoc(collection(db, 'arsip_pemasukan_material_semua'), logEntry);
          
          const rencanaDocRef = doc(db, 'rencana_pemasukan', activeJob.id);
          await updateDoc(rencanaDocRef, { 
              status: 'Selesai Bongkar',
              completedActivities: completedActivities,
              bongkarSelesaiAt: new Date().toISOString(),
          });
          
          toast({ title: "Pekerjaan Selesai & Dicatat", description: "Pemasukan material semen telah dicatat di arsip." });

          setActiveJob(null);
          setActivities([]);
          setCompletedActivities([]);
      } catch (error) {
           console.error("Error finishing job:", error);
           toast({ title: 'Gagal Menyelesaikan Pekerjaan', variant: 'destructive'});
      }
  };

  const renderActivityCard = (activity: CementActivity) => {
    const isPaused = activity.status === 'jeda';
    const duration = calculateRunningDuration(activity);
    const destinationName = activity.destinationUnit 
        ? `${activity.destinationUnit}: ${activity.destinationId.replace('-', ' ')}`
        : activity.destinationId.replace('-', ' ');
    return (
      <Card key={activity.id} className="bg-background/50">
        <CardHeader className="p-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span><span className="font-mono">{activity.sourceTankId.replace('-', ' ').toUpperCase()}</span> ➔ <span className="font-mono">{destinationName.toUpperCase()}</span></span>
            <span className={cn("text-xs font-bold uppercase", isPaused ? "text-yellow-500" : "text-green-500 animate-pulse")}>{activity.status}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-center">
            <p className="text-4xl font-mono font-bold tracking-tighter">{formatDuration(duration)}</p>
            {isPaused && activity.pauseHistory.length > 0 && (
                 <div className="text-xs text-muted-foreground mt-2 text-left bg-muted/30 p-2 rounded-md"><p className="font-semibold mb-1">Alasan Jeda:</p><ol className="list-decimal list-inside">{activity.pauseHistory.map((p, i) => <li key={i}>{p.reason}</li>)}</ol></div>
            )}
            <div className="flex gap-2 mt-3">
              {isPaused ? (<Button size="sm" className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleResume(activity.id)}><Play className="mr-2 h-4 w-4"/>Lanjutkan</Button>) : (<Button size="sm" variant="secondary" className="w-full" onClick={() => handlePauseRequest(activity)}><Pause className="mr-2 h-4 w-4"/>Jeda</Button>)}
              <Button size="sm" variant="destructive" className="w-full" onClick={() => handleFinish(activity.id)}><Square className="mr-2 h-4 w-4"/>Selesai</Button>
            </div>
        </CardContent>
      </Card>
    );
  };
  
  const handleBack = () => {
    if (activeJob) { setActiveJob(null); setActivities([]); setCompletedActivities([]); }
    else if (selectedUnit) { sessionStorage.removeItem('selectedUnloadUnit'); setSelectedUnit(null); setIsUnitDialogOpen(true); }
    else { router.back(); }
  }
  
  const getSiloCountForUnit = useCallback((locationName: string | null | undefined, unit: string) => {
      if (locationName?.toUpperCase().includes('BAUNG') && unit === 'BP-1') {
          return 4;
      }
      return BP_SILO_COUNT;
  }, []);

  return (
    <>
    <UnitSelectionDialog isOpen={isUnitDialogOpen} onUnitSelect={handleUnitSelect}/>
    <AlertDialog open={isCapacityWarningOpen} onOpenChange={setIsCapacityWarningOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Peringatan Kapasitas</AlertDialogTitle>
                <AlertDialogDescription>Silo tidak dapat menampung isi semen dalam tangki karena kapasitas silo hampir penuh.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsCapacityWarningOpen(false)}>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                    setIsCapacityWarningOpen(false);
                    await executeStart();
                }}>
                    Tetap Bongkar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Konfirmasi Tujuan Bongkar</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4"><p>Pindahkan muatan dari <span className="font-bold">{selectedSourceTank?.id.replace('-', ' ').toUpperCase()}</span> ke:</p>
                 <Select value={selectedDestination.type} onValueChange={(v) => setSelectedDestination(p => ({...p, type: v, id: '', unit: ''}))}><SelectTrigger><SelectValue placeholder="Pilih Tipe Tujuan..." /></SelectTrigger><SelectContent><SelectItem value="silo">Silo Unit BP</SelectItem><SelectItem value="buffer-silo">Buffer Silo</SelectItem><SelectItem value="buffer-tank">Buffer Tangki</SelectItem></SelectContent></Select>
                 {selectedDestination.type === 'silo' && (
                     <Select value={selectedDestination.unit} onValueChange={(v) => setSelectedDestination(p => ({...p, unit: v, id: ''}))}>
                         <SelectTrigger><SelectValue placeholder="Pilih Unit BP..." /></SelectTrigger>
                         <SelectContent>
                             <SelectItem value="BP-1">Unit BP-1</SelectItem>
                             <SelectItem value="BP-2">Unit BP-2</SelectItem>
                             <SelectItem value="BP-3">Unit BP-3</SelectItem>
                         </SelectContent>
                     </Select>
                 )}
                 {selectedDestination.type && (
                     <Select value={selectedDestination.id} onValueChange={(v) => setSelectedDestination(p => ({...p, id: v}))} disabled={selectedDestination.type === 'silo' && !selectedDestination.unit}>
                         <SelectTrigger><SelectValue placeholder="Pilih Nomor Tujuan..." /></SelectTrigger>
                         <SelectContent>
                            {selectedDestination.type === 'silo' && selectedDestination.unit && Array.from({length: getSiloCountForUnit(userInfo?.lokasi, selectedDestination.unit)}, (_,i) => { const destId = `silo-${i+1}`; const key = `${selectedDestination.unit}-${destId}`; const siloData = allSiloData[key]; const isActive = siloData?.status === 'aktif'; return <SelectItem key={destId} value={destId} disabled={activeDestinations.includes(destId) || !isActive}>Silo {i+1}{!isActive && ' (Non-Aktif)'}</SelectItem> })}
                            {selectedDestination.type === 'buffer-silo' && Array.from({length: BUFFER_SILO_COUNT}, (_,i) => { const destId = `silo-${i+1}`; return <SelectItem key={destId} value={destId} disabled={activeDestinations.includes(destId)}>Buffer Silo {i+1}</SelectItem> })}
                            {selectedDestination.type === 'buffer-tank' && Array.from({length: BUFFER_TANK_COUNT}, (_,i) => { const destId = `tank-${i+1}`; return <SelectItem key={destId} value={destId} disabled={activeDestinations.includes(destId)}>Buffer Tangki {i+1}</SelectItem> })}
                         </SelectContent>
                     </Select>
                 )}
            </div>
            <DialogFooter><Button onClick={handleStartConfirm}>Mulai Bongkar</Button></DialogFooter>
        </DialogContent>
    </Dialog>
     <Dialog open={isPauseDialogOpen} onOpenChange={setIsPauseDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Jeda Aktivitas</DialogTitle><DialogDescription>Masukkan alasan mengapa aktivitas ini perlu dijeda.</DialogDescription></DialogHeader>
            <div className="py-4"><Textarea placeholder="Contoh: Istirahat makan siang..." value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} rows={3}/></div>
            <DialogFooter><Button variant="outline" onClick={() => setIsPauseDialogOpen(false)}>Batal</Button><Button onClick={handleConfirmPause}>Simpan & Jeda</Button></DialogFooter>
        </DialogContent>
    </Dialog>

    <div className="min-h-screen w-full max-w-5xl mx-auto flex flex-col bg-background text-foreground p-4">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={handleBack}><ArrowLeft /></Button><div className="flex items-center gap-2"><Ship/><div><h1 className="text-xl font-bold">Pencatatan Waktu dan Aktivitas Bongkar</h1>{selectedUnit && <p className="text-sm text-primary font-semibold flex items-center gap-1.5"><Building size={14}/> Unit Kerja: {selectedUnit}</p>}</div></div></div>
      </header>

      <main className="flex-1 overflow-y-auto space-y-6 pb-4">
        {!selectedUnit ? (<div className="flex items-center justify-center h-full min-h-96"><p className="text-muted-foreground">Pilih unit kerja untuk memulai...</p></div>
        ) : !activeJob ? (<Card><CardHeader><CardTitle>Pilih Surat Perintah Bongkar (SPB)</CardTitle><CardDescription>Pilih kapal/truk yang siap untuk dibongkar dari daftar di bawah ini.</CardDescription></CardHeader><CardContent className="space-y-2">
            {isFetchingJobs ? (<div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
            ) : jobList.length > 0 ? (jobList.map(job => (<Button key={job.id} variant="outline" className="w-full h-auto justify-between py-3" onClick={() => selectActiveJob(job)}>
                <div className="text-left"><p className="font-bold">{job.namaKapal}</p><p className="text-xs text-muted-foreground">SPB: {Object.values(job.spbPerTank || {}).join(', ')} | {(Object.values(job.tankLoads || {}).reduce((a,b) => a+b, 0)).toLocaleString()} KG</p></div>
                <div className="text-right"><p className="text-sm">Tiba: {safeFormatDate(job.eta, 'dd MMM, HH:mm')}</p><p className="text-xs text-muted-foreground">Kapten: {job.namaSopir}</p></div>
            </Button>))) : (<div className="text-center text-muted-foreground py-10">Tidak ada perintah bongkar yang tersedia saat ini.</div>)}
            </CardContent></Card>
        ) : (<>
          <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Dasbor Bongkar: {activeJob.namaKapal}</CardTitle><CardDescription>Total Muatan: {(Object.values(activeJob.tankLoads || {}).reduce((a,b) => a+b, 0)).toLocaleString()} KG</CardDescription></div>
            {unassignedTanks.length === 0 && activities.length === 0 && (<Button variant="default" onClick={handleFinishJob} className="bg-green-600 hover:bg-green-700"><CheckCircle className="mr-2"/>Selesaikan & Arsipkan Pekerjaan</Button>)}
          </CardHeader></Card>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4"><Card><CardHeader className="p-4"><CardTitle className="text-base">Muatan Tersedia</CardTitle></CardHeader><CardContent className="p-4 pt-0 space-y-2 max-h-96 overflow-y-auto">{unassignedTanks.length > 0 ? unassignedTanks.map(tank => (<Button key={tank.id} variant="outline" className="w-full justify-between h-12" onClick={() => handleStartRequest(tank)}><span><Anchor className="inline-block mr-2" size={16}/>{tank.id.replace('-', ' ').toUpperCase()}</span><span className="font-mono font-bold">{tank.amount.toLocaleString('id-ID')} KG</span></Button>)) : <p className="text-sm text-center text-muted-foreground py-8">Semua muatan sedang diproses atau sudah selesai.</p>}</CardContent></Card></div>
            <div className="lg:col-span-2 space-y-4"><div><h3 className="font-semibold text-muted-foreground mb-2">Aktivitas Berlangsung</h3><div className="space-y-3">{activities.length > 0 ? activities.map(renderActivityCard) : <p className="text-sm text-center text-muted-foreground pt-8">Tidak ada aktivitas yang sedang berjalan.</p>}</div></div><div><h3 className="font-semibold text-muted-foreground mb-2 mt-6">Selesai Sesi Ini</h3><div className="space-y-2">{completedActivities.length > 0 ? completedActivities.map(act => (<Card key={act.id} className="bg-muted/30"><CardContent className="p-3 flex justify-between items-center text-sm"><div><p className="font-semibold">{act.sourceTankId.replace('-',' ').toUpperCase()} ➔ {(act.destinationUnit ? `${act.destinationUnit}: ` : '') + act.destinationId.replace('-',' ').toUpperCase()}</p><div className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4"><span>Mulai: {safeFormatDate(act.startTime, 'dd/MM HH:mm:ss')}</span><span>Selesai: {act.endTime ? safeFormatDate(act.endTime, 'dd/MM HH:mm:ss') : '-'}</span><span className="col-span-2">Total Jeda: {formatDuration(act.totalPauseDuration)}</span></div></div><div className="text-right"><p className="font-bold text-primary">{act.endTime ? formatDuration(differenceInMilliseconds(new Date(act.endTime), new Date(act.startTime)) - act.totalPauseDuration) : 'N/A'}</p><p className="text-xs text-muted-foreground">Durasi Kerja</p></div></CardContent></Card>)) : <p className="text-sm text-center text-muted-foreground pt-8">Belum ada aktivitas yang selesai.</p>}</div></div></div>
          </div></>
        )}
      </main>
    </div>
    </>
  );
}
