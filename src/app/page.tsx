

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Scale, JobMix, MaterialName, LoadingOrderSettings, MixerSettings, MoistureSettings, ScheduleRow, PrintData, ProductionData, OperationMode, UserData, CementSiloStock, MaterialUsage, BpUnitStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Loader2, X, SlidersHorizontal, ListOrdered, ToggleRight, FileText, Database, Package, Droplets, CalendarCheck, KeyRound } from 'lucide-react';
import AppHeader from '@/components/app-header';
import WeightIndicator from '@/components/weight-indicator';
import MixingStatus from '@/components/mixing-status';
import OperationControls from '@/components/operation-controls';
import ManualControlsDialog from '@/components/manual-controls-dialog';
import { useToast } from '@/hooks/use-toast';
import PrintTicketLayout from '@/components/print-ticket-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { printElement } from '@/lib/utils';
import ScheduleTable from '@/components/schedule-table';
import BpSelectionDialog from '@/components/location-selection-dialog';
import UnitSelectionDialog from '@/components/unit-selection-dialog';
import { db, collection, getDocs, setDoc, doc, addDoc, updateDoc, onSnapshot, runTransaction, query, where, Timestamp, getDoc, FieldValue, increment } from '@/lib/firebase';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset } from '@/components/ui/sidebar';
import LoadingOrderDialog from '@/components/loading-order-dialog';
import MixerSettingsDialog from '@/components/mixer-settings-dialog';
import MoistureControlDialog from '@/components/moisture-control-dialog';

const initialScales: Scale[] = [
  { id: 1, name: 'BATU', weight: 0, unit: 'kg', min: 0, max: 4000, target: 0 },
  { id: 2, name: 'PASIR', weight: 0, unit: 'kg', min: 0, max: 4000, target: 0 },
  { id: 3, name: 'SEMEN 1', weight: 0, unit: 'kg', min: 0, max: 2000, target: 0 },
  { id: 4, name: 'SEMEN 2', weight: 0, unit: 'kg', min: 0, max: 2000, target: 0 },
  { id: 5, name: 'AIR', weight: 0, unit: 'kg', min: 0, max: 500, target: 0 },
];

const SIMULATION_INTERVAL = 50; // ms
const WEIGH_SPEED = 100; // kg per second
const POUR_SPEED = 150; // kg per second

const initialLoadingOrder: LoadingOrderSettings = {
    'Pasir': { urutan: '1', detik: '0' },
    'Batu': { urutan: '2', detik: '0' },
    'Semen': { urutan: '1', detik: '0' },
    'Air': { urutan: '1', detik: '0' },
};

const initialMixerSettings: MixerSettings = {
    opening1: 3,
    opening2: 3,
    opening3: 3,
    tutup: 3,
};

const initialMoistureSettings: MoistureSettings = {
    pasir: 0,
    batu: 0,
    air: 0,
};

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [scales, setScales] = useState<Scale[]>(initialScales);
  const [isManualControlsOpen, setManualControlsOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleRow[]>([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [loadingOrder, setLoadingOrder] = useState<LoadingOrderSettings>(initialLoadingOrder);
  const [mixerSettings, setMixerSettings] = useState<MixerSettings>(initialMixerSettings);
  const [moistureSettings, setMoistureSettings] = useState<MoistureSettings>(initialMoistureSettings);
  const [countdownTime, setCountdownTime] = useState(15);
  const [initialCountdownTime, setInitialCountdownTime] = useState(15);
  const [isMixing, setIsMixing] = useState(false);
  const [isDoorOperating, setIsDoorOperating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<ScheduleRow | null>(null);
  const [activeJobMix, setActiveJobMix] = useState<JobMix | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [productionDataForPrint, setProductionDataForPrint] = useState<PrintData | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [pouringMaterials, setPouringMaterials] = useState<MaterialName[]>([]);
  const [isBpModalOpen, setIsBpModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  
  const [namaSopir, setNamaSopir] = useState('');
  const [nomorMobil, setNomorMobil] = useState('');
  const [nomorLambung, setNomorLambung] = useState('');

  const [reqNo, setReqNo] = useState('');
  const [targetVolume, setTargetVolume] = useState('');
  const [jumlahMixing, setJumlahMixing] = useState(1);
  const [selectedSilo, setSelectedSilo] = useState('');

  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const processAbortedRef = useRef(false);

  const [isMixerSettingsOpen, setMixerSettingsOpen] = useState(false);
  const [isLoadingOrderOpen, setIsLoadingOrderOpen] = useState(false);
  const [isMoistureControlOpen, setMoistureControlOpen] = useState(false);

   const addActivityLog = useCallback((message: string) => {
    setActivityLog(prevLog => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prevLog].slice(0, 10));
  }, []);

  const updateBpStatus = async () => {
    const userString = localStorage.getItem('user');
    if (!userString) return;
    const currentUserInfo: UserData = JSON.parse(userString);
    
    if (!currentUserInfo?.lokasi || !currentUserInfo?.unitBp) return;
    
    const statusDocId = `${currentUserInfo.lokasi}_${currentUserInfo.unitBp}`;
    const statusDocRef = doc(db, 'bp_unit_status', statusDocId);
    try {
        await setDoc(statusDocRef, {
            lastActivity: Timestamp.now(),
            unit: currentUserInfo.unitBp,
            location: currentUserInfo.lokasi,
        }, { merge: true });
    } catch (error) {
        console.error("Failed to update BP status:", error);
    }
  };

  useEffect(() => {
    // Cleanup intervals on unmount
    return () => {
        intervalsRef.current.forEach(intervalId => clearInterval(intervalId));
    };
  }, []);
  
    useEffect(() => {
    if (isPreviewing) {
      document.body.classList.add('print-active');
    } else {
      document.body.classList.remove('print-active');
    }
    // Cleanup on component unmount
    return () => {
      document.body.classList.remove('print-active');
    };
  }, [isPreviewing]);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.push('/login');
      return;
    }
    const userData = JSON.parse(userString);
    if (userData.jabatan !== 'OPRATOR BP') {
        toast({
            variant: 'destructive',
            title: 'Akses Ditolak',
            description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
        });
        router.push('/login');
        return;
    }
    setUserInfo(userData);

    const savedSilo = localStorage.getItem('selectedSilo');
    if (savedSilo) {
        setSelectedSilo(savedSilo);
    }

    if (!userData.lokasi) {
        setIsBpModalOpen(true);
    } else if (userData.jabatan === 'OPRATOR BP' && !userData.unitBp) {
        setIsUnitModalOpen(true);
    }
  }, [router, toast]);
  
  useEffect(() => {
    const statusInterval = setInterval(() => {
        if (!isProcessing) {
            updateBpStatus();
        }
    }, 300000); // 5 menit

    return () => {
        clearInterval(statusInterval);
    };
  }, [isProcessing]);
  
  useEffect(() => {
    if (isProcessing) {
      updateBpStatus();
    }
  }, [isProcessing]);
  
  useEffect(() => {
    if (selectedSilo) {
        localStorage.setItem('selectedSilo', selectedSilo);
    }
  }, [selectedSilo]);


  useEffect(() => {
    if (isMixing) {
        if (intervalsRef.current.has('mixing')) {
            clearInterval(intervalsRef.current.get('mixing')!);
        }
        const mixingInterval = setInterval(() => {
            if (processAbortedRef.current) {
                clearInterval(mixingInterval);
                return;
            }
            setCountdownTime(prev => {
                if (prev <= 1) {
                    clearInterval(mixingInterval);
                    intervalsRef.current.delete('mixing');
                    setIsMixing(false);
                    return 0;
                }
                const newTime = prev - 1;
                addActivityLog(`Proses mixing berjalan... Sisa waktu: ${newTime}s`);
                return newTime;
            });
        }, 1000);
        intervalsRef.current.set('mixing', mixingInterval);
    }
  }, [isMixing, addActivityLog]);

  useEffect(() => {
    if (isDoorOperating) {
        if (intervalsRef.current.has('door')) {
            clearInterval(intervalsRef.current.get('door')!);
        }
        const doorInterval = setInterval(() => {
            if (processAbortedRef.current) {
                clearInterval(doorInterval);
                return;
            }
            setCountdownTime(prev => {
                if (prev <= 1) {
                    clearInterval(doorInterval);
                    intervalsRef.current.delete('door');
                    setIsDoorOperating(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        intervalsRef.current.set('door', doorInterval);
    }
  }, [isDoorOperating]);
  
  useEffect(() => {
    if (!userInfo?.lokasi) return;

    setIsScheduleLoading(true);
    const scheduleCollectionRef = collection(db, "schedules_today");

    const unsubscribe = onSnapshot(scheduleCollectionRef, (snapshot) => {
        if (!snapshot.empty) {
            const scheduleList = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as ScheduleRow);
            const sortedData = scheduleList.sort((a, b) => parseInt(a.NO) - parseInt(b.NO));
            setScheduleData(sortedData);
        } else {
            setScheduleData([]);
        }
        setIsScheduleLoading(false);
    }, (error) => {
        console.error("Error fetching real-time schedule: ", error);
        toast({
            title: 'Error Real-time',
            description: 'Gagal mendengarkan perubahan data jadwal.',
            variant: 'destructive',
        });
        setIsScheduleLoading(false);
    });

    return () => unsubscribe(); // Cleanup the listener on component unmount

  }, [userInfo, toast]);
  
    useEffect(() => {
    if (activeSchedule) {
      setActiveSchedule(prev => {
        if (!prev) return null;
        return {
          ...prev,
          'NAMA SOPIR': namaSopir,
          'NOMOR MOBIL': nomorMobil,
          'NOMOR LAMBUNG': nomorLambung,
        };
      });
    }
  }, [namaSopir, nomorMobil, nomorLambung, activeSchedule !== null]);


  const simulateProcess = (material: MaterialName, direction: 'weigh' | 'pour'): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (direction === 'pour') {
            setPouringMaterials(prev => [...prev, material]);
        }
        const speed = direction === 'weigh' ? WEIGH_SPEED : -POUR_SPEED;
        
        if (intervalsRef.current.has(material)) {
            clearInterval(intervalsRef.current.get(material)!);
        }

        const intervalId = setInterval(() => {
            if (processAbortedRef.current) {
                clearInterval(intervalId);
                intervalsRef.current.delete(material);
                reject(new Error('Process aborted by user'));
                return;
            }

            setScales(prevScales => {
                let isProcessFinished = false;
                const newScales = prevScales.map(s => {
                    if (s.name === material) {
                        const newWeight = s.weight + (speed * (SIMULATION_INTERVAL / 1000));
                        
                        if (direction === 'weigh' && newWeight >= (s.target || s.max)) {
                           isProcessFinished = true;
                           return { ...s, weight: s.target || s.max };
                        }
                        if (direction === 'pour' && newWeight <= 0) {
                           isProcessFinished = true;
                           return { ...s, weight: 0 };
                        }
                        return { ...s, weight: newWeight };
                    }
                    return s;
                });

                if (isProcessFinished) {
                    clearInterval(intervalId);
                    intervalsRef.current.delete(material);
                    if (direction === 'pour') {
                        setPouringMaterials(prev => prev.filter(m => m !== material));
                    }
                    resolve();
                }
                return newScales;
            });
        }, SIMULATION_INTERVAL);
        intervalsRef.current.set(material, intervalId);
    });
};


  const startAutoWeighing = async (jobMix: JobMix, targetVolume: number, jumlahMixing: number, selectedSilo: string, mixingTime: number) => {
    if (!selectedSilo) {
        toast({
            variant: 'destructive',
            title: 'Aksi Gagal',
            description: 'Harap pilih silo terlebih dahulu untuk mode auto.',
        });
        return;
    }
    
    setIsProcessing(true);
    processAbortedRef.current = false;
    const processStartTime = new Date();
    setStartTime(processStartTime);
    
    const volumePerMix = targetVolume / jumlahMixing;

    try {
        for (let mixCount = 1; mixCount <= jumlahMixing; mixCount++) {
            if (processAbortedRef.current) throw new Error('Process aborted');
            
            addActivityLog(`Memulai mixing ke-${mixCount} dari ${jumlahMixing}...`);
            setCountdownTime(mixingTime);
            setInitialCountdownTime(mixingTime);

            const siloNum = parseInt(selectedSilo, 10);
            
            const pasirBasah = (jobMix.pasir1 + jobMix.pasir2) * volumePerMix;
            const batuBasah = (jobMix.batu1 + jobMix.batu2) * volumePerMix;

            const airDiPasir = pasirBasah * (moistureSettings.pasir / 100);
            const airDiBatu = batuBasah * (moistureSettings.batu / 100);

            const pasirKering = pasirBasah - airDiPasir;
            const batuKering = batuBasah - airDiBatu;

            const totalAirDariAgregat = airDiPasir + airDiBatu;
            const airDariJobMix = jobMix.air * volumePerMix;
            const airDitimbang = Math.max(0, airDariJobMix - totalAirDariAgregat + moistureSettings.air);

            const semenTarget = jobMix.semen * volumePerMix;
            let semen1Target = 0;
            let semen2Target = 0;

            if (siloNum >= 1 && siloNum <= 3) {
                semen1Target = semenTarget;
            } else if (siloNum >= 4 && siloNum <= 6) {
                semen2Target = semenTarget;
            }
            
            const newTargets = {
                'SEMEN 1': semen1Target,
                'SEMEN 2': semen2Target,
                'PASIR': pasirKering + airDiPasir,
                'BATU': batuKering + airDiBatu,
                'AIR': airDitimbang,
            };
            
            setScales(prevScales => prevScales.map(scale => ({
                ...scale,
                target: newTargets[scale.name as keyof typeof newTargets] ?? scale.target,
                weight: 0 
            })));
            
            addActivityLog('Konveyor atas hidup...');
            await new Promise(res => setTimeout(res, 1000)); 

            addActivityLog('Konveyor bawah hidup...');
            await new Promise(res => setTimeout(res, 1000));
            
            addActivityLog('Menimbang semua material...');
            const materialsToWeigh: MaterialName[] = ['PASIR', 'BATU', 'AIR'];
            if (semen1Target > 0) materialsToWeigh.push('SEMEN 1');
            if (semen2Target > 0) materialsToWeigh.push('SEMEN 2');
            
            await Promise.all(materialsToWeigh.map(mat => simulateProcess(mat, 'weigh')));
            
            addActivityLog('Penimbangan selesai. Memulai penuangan...');

            const pourPromises: Promise<void>[] = [];
            
            addActivityLog('Menuang PASIR...');
            const sandPourPromise = simulateProcess('PASIR', 'pour');
            pourPromises.push(sandPourPromise);

            const delayedPour = (name: string, delay: number) => new Promise<void>(resolve => {
                setTimeout(() => {
                    if (processAbortedRef.current) return resolve();
                    addActivityLog(`Menuang ${name}...`);
                    if (name === 'SEMEN') {
                        if (semen1Target > 0) pourPromises.push(simulateProcess('SEMEN 1', 'pour'));
                        if (semen2Target > 0) pourPromises.push(simulateProcess('SEMEN 2', 'pour'));
                    } else {
                        pourPromises.push(simulateProcess(name as MaterialName, 'pour'));
                    }
                    resolve();
                }, delay * 1000);
            });

            if (loadingOrder.Air.urutan === '1') await delayedPour('AIR', parseInt(loadingOrder.Air.detik));
            if (loadingOrder.Semen.urutan === '1') await delayedPour('SEMEN', parseInt(loadingOrder.Semen.detik));

            await sandPourPromise;
            addActivityLog('Penuangan pasir selesai.');

            if (loadingOrder.Batu.urutan !== '1') await delayedPour('BATU', parseInt(loadingOrder.Batu.detik));
            if (loadingOrder.Air.urutan !== '1') await delayedPour('AIR', parseInt(loadingOrder.Air.detik));
            if (loadingOrder.Semen.urutan !== '1') await delayedPour('SEMEN', parseInt(loadingOrder.Semen.detik));

            await Promise.all(pourPromises);
            addActivityLog('Semua material telah dituang. Memulai mixing.');
            
            setIsMixing(true);

            await new Promise<void>(resolve => {
                const checkMixing = setInterval(() => {
                    if (!intervalsRef.current.has('mixing') || processAbortedRef.current) {
                        clearInterval(checkMixing);
                        resolve();
                    }
                }, 100);
            });
            if (processAbortedRef.current) throw new Error('Process aborted');

            addActivityLog('Mixing selesai. Membuka pintu mixer...');
            const totalDoorTime = mixerSettings.opening1 + mixerSettings.opening2 + mixerSettings.opening3 + mixerSettings.tutup;
            setInitialCountdownTime(totalDoorTime);
            setCountdownTime(totalDoorTime);
            setIsDoorOperating(true);

            if (mixerSettings.opening1 > 0) {
                addActivityLog(`Membuka pintu ke 1... (${mixerSettings.opening1}s)`);
                await new Promise(res => setTimeout(res, mixerSettings.opening1 * 1000));
            }
            if (mixerSettings.opening2 > 0) {
                addActivityLog(`Membuka pintu ke 2... (${mixerSettings.opening2}s)`);
                await new Promise(res => setTimeout(res, mixerSettings.opening2 * 1000));
            }
            if (mixerSettings.opening3 > 0) {
                addActivityLog(`Membuka pintu ke 3... (${mixerSettings.opening3}s)`);
                await new Promise(res => setTimeout(res, mixerSettings.opening3 * 1000));
            }

            addActivityLog('Pintu mixer terbuka. Menutup pintu mixer...');
            if (mixerSettings.tutup > 0) {
                addActivityLog(`Menutup Pintu Mixer... (${mixerSettings.tutup}s)`);
                await new Promise(res => setTimeout(res, mixerSettings.tutup * 1000));
            }
            
            await new Promise<void>(resolve => {
                const checkDoor = setInterval(() => {
                    if (!intervalsRef.current.has('door') || processAbortedRef.current) {
                        clearInterval(checkDoor);
                        resolve();
                    }
                }, 100);
            });
            if (processAbortedRef.current) throw new Error('Process aborted');

            if (mixCount < jumlahMixing) {
                addActivityLog(`Mixing ke-${mixCount} selesai. Lanjut ke mixing berikutnya.`);
                await new Promise(res => setTimeout(res, 2000));
            }
        }

        addActivityLog('Klakson berbunyi...');
        await new Promise(res => setTimeout(res, 1000));
        addActivityLog('Siklus otomatis selesai.');
        
        await handleStop({
            schedule: activeSchedule!,
            jobMix: activeJobMix!,
            targetVolume: String(targetVolume),
            jumlahMixing: jumlahMixing,
            startTime: processStartTime,
            endTime: new Date(),
            selectedSilo: selectedSilo,
            unitBp: userInfo?.unitBp,
        }, { isAborted: false, mode: 'auto' });
    } catch (error: any) {
        if (error.message.includes('Process aborted')) {
            addActivityLog('PROSES DIHENTIKAN OLEH PENGGUNA');
        } else {
            console.error("Auto weighing error:", error);
            addActivityLog('Terjadi kesalahan pada proses otomatis.');
        }
        await handleStop(undefined, { isAborted: true, mode: 'auto' });
    }
  };
  
    const stopSimulation = (material: MaterialName) => {
        if (intervalsRef.current.has(material)) {
            clearInterval(intervalsRef.current.get(material)!);
            intervalsRef.current.delete(material);
        }
    };

    const handleManualWeigh = (material: MaterialName, action: 'start' | 'stop') => {
        if (action === 'start') {
            setIsProcessing(true); // Memulai proses
            stopSimulation(material); 

            const intervalId = setInterval(() => {
                setScales(prevScales => {
                    return prevScales.map(s => {
                        if (s.name === material) {
                            const newWeight = s.weight + (WEIGH_SPEED * (SIMULATION_INTERVAL / 1000));
                            if (newWeight >= (s.target || s.max)) {
                                stopSimulation(material);
                                return { ...s, weight: s.target || s.max };
                            }
                            return { ...s, weight: newWeight };
                        }
                        return s;
                    });
                });
            }, SIMULATION_INTERVAL);
            intervalsRef.current.set(material, intervalId);
        } else { 
            stopSimulation(material);
        }
    };
    
    const handleManualPour = (material: MaterialName, action: 'start' | 'stop') => {
          if (action === 'start') {
            setIsProcessing(true); // Memulai proses
            stopSimulation(material); 
            if (action === 'start') {
                setPouringMaterials(prev => [...prev, material]);
            }

            const intervalId = setInterval(() => {
                setScales(prevScales => {
                    return prevScales.map(s => {
                        if (s.name === material) {
                            const newWeight = s.weight - (POUR_SPEED * (SIMULATION_INTERVAL / 1000));
                            if (newWeight <= 0) {
                                stopSimulation(material);
                                if (action === 'start') {
                                    setPouringMaterials(prev => prev.filter(m => m !== material));
                                }
                                return { ...s, weight: 0 };
                            }
                            return { ...s, weight: newWeight };
                        }
                        return s;
                    });
                });
            }, SIMULATION_INTERVAL);
            intervalsRef.current.set(material, intervalId);
        } else { 
            stopSimulation(material);
            setPouringMaterials(prev => prev.filter(m => m !== material));
        }
    };
    
  const resetAllFields = () => {
    setReqNo('');
    setTargetVolume('');
    setJumlahMixing(1);
    setNamaSopir('');
    setNomorMobil('');
    setNomorLambung('');
    setSelectedSilo('');
    setActiveSchedule(null);
    setActiveJobMix(null);
  }

  const handleStop = async (data?: PrintData, options: { isAborted?: boolean, mode: OperationMode } = { isAborted: true, mode: 'auto' }) => {
    if (options.isAborted) {
        processAbortedRef.current = true;
        intervalsRef.current.forEach(intervalId => {
            clearInterval(intervalId);
        });
        intervalsRef.current.clear();
        setPouringMaterials([]);
        setIsMixing(false);
        setIsDoorOperating(false);
    }
    
    setIsProcessing(false);
    setStartTime(null);

    await updateBpStatus();

    if (options.isAborted) {
        if(options.mode === 'auto') {
            toast({ title: "Proses dihentikan.", variant: "destructive" });
        }
        return;
    }
    
    if (data && activeSchedule && activeJobMix && userInfo?.lokasi && userInfo?.unitBp) {
      try {
        const currentVolume = parseFloat(data.targetVolume);
        if (isNaN(currentVolume) || currentVolume <= 0) {
            toast({ title: "Error Data", description: "Volume produksi tidak valid.", variant: "destructive" });
            return;
        }

        const usageKg: MaterialUsage = {
            pasir: (activeJobMix.pasir1 + activeJobMix.pasir2) * currentVolume,
            batu: (activeJobMix.batu1 + activeJobMix.batu2) * currentVolume,
            semen: activeJobMix.semen * currentVolume,
            air: activeJobMix.air * currentVolume,
            sikaVz: 0, sikaNn: 0, visco: 0,
        };

        const usageM3 = {
            pasir: usageKg.pasir / 1225, // Konversi pasir dari kg ke m3
            batu: usageKg.batu / 1400,   // Konversi batu dari kg ke m3
        };
        
        const scheduleDocRef = doc(db, 'schedules_today', activeSchedule.id as string);
        const aggregateStockRef = doc(db, `locations/${userInfo.lokasi}/stock`, 'aggregates');
        const cementStockRef = doc(db, `locations/${userInfo.lokasi}/stock_cement_silo_${userInfo.unitBp}`, 'main');
        
        const productionsQuery = query(collection(db, 'productions'), 
            where('jobId', '==', activeSchedule.NO),
            where('lokasiProyek', '==', activeSchedule.LOKASI),
            where('mutuBeton', '==', activeSchedule.GRADE),
            where('namaPelanggan', '==', activeSchedule.NAMA)
        );
        const productionsSnapshot = await getDocs(productionsQuery);
        const finalNomorRitasi = productionsSnapshot.docs.length + 1;

        await runTransaction(db, async (transaction) => {
            const scheduleDoc = await transaction.get(scheduleDocRef);
            if (!scheduleDoc.exists()) throw "Jadwal tidak ditemukan!";

            const aggregateStockDoc = await transaction.get(aggregateStockRef);
            const cementStockDoc = await transaction.get(cementStockRef);
            
            const scheduleData = scheduleDoc.data() as ScheduleRow;
            const terkirimSebelumnya = parseFloat(scheduleData['TERKIRIM M³'] || '0');
            const totalTerkirim = terkirimSebelumnya + currentVolume;
            const totalVol = parseFloat(scheduleData['TOTAL M³'] || '0');
            const sisaBaru = totalVol - totalTerkirim;
            const newStatus = (sisaBaru <= 0 ? 'selesai' : 'proses') as ScheduleRow['STATUS'];
            
            transaction.update(scheduleDocRef, {
                'TERKIRIM M³': String(totalTerkirim),
                'SISA M³': String(sisaBaru),
                STATUS: newStatus,
            });

            if (aggregateStockDoc.exists()) {
                transaction.update(aggregateStockRef, {
                    pasir: increment(-usageM3.pasir),
                    batu: increment(-usageM3.batu)
                });
            }
            
            if (cementStockDoc.exists() && data.selectedSilo) {
                const siloKey = `silos.silo-${data.selectedSilo}.stock`;
                transaction.update(cementStockRef, {
                    [siloKey]: increment(-usageKg.semen)
                });
            }
        });

        const updatedScheduleDoc = await getDoc(scheduleDocRef);
        const updatedScheduleData = updatedScheduleDoc.data() as ScheduleRow;

        const productionEntry: ProductionData = {
            id: `${activeSchedule.NO}-${new Date().getTime()}`,
            jobId: activeSchedule.NO,
            tanggal: Timestamp.fromDate(data.startTime),
            namaPelanggan: activeSchedule.NAMA,
            lokasiProyek: activeSchedule.LOKASI,
            mutuBeton: activeSchedule.GRADE,
            'CP/M': activeSchedule['CP/M'],
            slump: activeSchedule['SLUMP (CM)'],
            targetVolume: currentVolume,
            jumlahMixing: data.jumlahMixing,
            jamMulai: data.startTime.toISOString(),
            jamSelesai: data.endTime.toISOString(),
            namaSopir: namaSopir,
            nomorMobil: nomorMobil,
            nomorLambung: nomorLambung,
            jobMix: activeJobMix,
            nomorRitasi: finalNomorRitasi,
            totalVolumeTerkirim: parseFloat(updatedScheduleData['TERKIRIM M³']),
            lokasiProduksi: userInfo.lokasi,
            unitBp: userInfo.unitBp,
            materialUsage: usageKg,
        };
        await addDoc(collection(db, 'productions'), productionEntry);
        
        const dataForPrint: PrintData = { 
            ...data, 
            schedule: {
                ...activeSchedule,
                ...updatedScheduleData,
                'NAMA SOPIR': namaSopir,
                'NOMOR MOBIL': nomorMobil,
                'NOMOR LAMBUNG': nomorLambung,
            },
            nomorRitasi: finalNomorRitasi,
            totalVolumeTerkirim: parseFloat(updatedScheduleData['TERKIRIM M³']),
            unitBp: userInfo.unitBp
        };
        setProductionDataForPrint(dataForPrint);
        setIsPreviewing(true);
        
        toast({
            title: "Proses Selesai",
            description: "Data produksi, jadwal, dan stok telah berhasil diperbarui.",
        });
        
        resetAllFields();

      } catch (error) {
        console.error("Error stopping process:", error);
        toast({
          title: "Gagal Menyimpan Data",
          description: `Terjadi kesalahan saat menyimpan: ${error}`,
          variant: "destructive"
        });
      }
    }
  };


  if (!userInfo) {
    return (
       <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </main>
    )
  }

  const handlePrint = () => {
    printElement('printable-ticket');
  };

  const handleBpSelect = (namaBp: string) => {
    const newUserInfo = { ...userInfo, lokasi: namaBp };
    localStorage.setItem('user', JSON.stringify(newUserInfo));
    setUserInfo(newUserInfo);
    setIsBpModalOpen(false);
      if (userInfo.jabatan === 'OPRATOR BP') {
        setIsUnitModalOpen(true);
    }
  }

  const handleUnitSelect = (unit: string) => {
    const newUserInfo = { ...userInfo, unitBp: unit };
    localStorage.setItem('user', JSON.stringify(newUserInfo));
    setUserInfo(newUserInfo);
    setIsUnitModalOpen(false);
  }

  const menuNavItems = [
    { label: 'Atur Pintu Mixer', icon: SlidersHorizontal, action: () => setMixerSettingsOpen(true) },
    { label: 'Urutan Loading', icon: ListOrdered, action: () => setIsLoadingOrderOpen(true) },
    { label: 'Tombol Manual', icon: ToggleRight, action: () => setManualControlsOpen(true) },
    { label: 'Job Mix Formula', icon: FileText, action: () => router.push('/job-mix-formula') },
    { label: 'Database Produksi', icon: Database, action: () => router.push('/database-produksi') },
    { label: 'Stok Material', icon: Package, action: () => router.push('/stok-material') },
    { label: 'Moisture Control', icon: Droplets, action: () => setMoistureControlOpen(true) },
    { label: 'Absensi & Kegiatan', icon: CalendarCheck, action: () => router.push('/absensi')},
    { label: 'Ubah Password', icon: KeyRound, action: () => router.push('/ubah-password') },
  ];

  return (
    <>
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
      </div>
      <BpSelectionDialog 
        isOpen={isBpModalOpen}
        onBpSelect={handleBpSelect}
      />
       <UnitSelectionDialog 
        isOpen={isUnitModalOpen}
        onUnitSelect={handleUnitSelect}
      />
      <Dialog open={isPreviewing} onOpenChange={setIsPreviewing}>
        <DialogContent className="max-w-3xl p-0" id="printable-ticket">
          <DialogHeader className="p-4 border-b no-print">
            <DialogTitle>Pratinjau Cetak</DialogTitle>
             <DialogClose asChild>
                <Button variant="ghost" size="icon" className="absolute right-4 top-3">
                  <X className="h-4 w-4" />
                </Button>
            </DialogClose>
          </DialogHeader>
          <div className="p-6 max-h-[50vh] overflow-y-auto print:max-h-none print:overflow-visible">
            {productionDataForPrint && <PrintTicketLayout data={productionDataForPrint} />}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t bg-muted/50 no-print">
             <Button variant="outline" onClick={() => setIsPreviewing(false)}>Tutup</Button>
             <Button onClick={handlePrint}>Cetak</Button>
          </div>
        </DialogContent>
      </Dialog>

      <SidebarProvider>
        <Sidebar>
            <SidebarContent>
                <SidebarHeader>
                    <h2 className="text-lg font-semibold text-primary px-2">Operator Menu</h2>
                </SidebarHeader>
                 <SidebarMenu>
                    {menuNavItems.map((item, index) => (
                      <SidebarMenuItem key={index}>
                          <SidebarMenuButton onClick={item.action}>
                              <item.icon />
                              {item.label}
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                 </SidebarMenu>
            </SidebarContent>
        </Sidebar>
        <SidebarInset>
            <div className="flex flex-col h-screen bg-transparent text-foreground no-print">
                <AppHeader 
                userInfo={userInfo}
                />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {scales.map(scale => (
                    <WeightIndicator 
                        key={scale.id} 
                        scale={scale} 
                        isPouring={pouringMaterials.includes(scale.name as MaterialName)}
                    />
                    ))}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                    <div className="lg:col-span-3">
                        <OperationControls 
                            scheduleData={scheduleData} 
                            onStartAuto={startAutoWeighing}
                            mixingTime={initialCountdownTime}
                            isProcessing={isProcessing}
                            onSetIsProcessing={setIsProcessing}
                            onStop={(data, opts) => handleStop(data ? {...data, selectedSilo} : undefined, opts)}
                            onSetActiveSchedule={setActiveSchedule}
                            onSetActiveJobMix={setActiveJobMix}
                            activeSchedule={activeSchedule}
                            activeJobMix={activeJobMix}
                            startTime={startTime}
                            onSetStartTime={setStartTime}
                            namaSopir={namaSopir}
                            setNamaSopir={setNamaSopir}
                            nomorMobil={nomorMobil}
                            setNomorMobil={setNomorMobil}
                            nomorLambung={nomorLambung}
                            setNomorLambung={setNomorLambung}
                            reqNo={reqNo}
                            setReqNo={setReqNo}
                            targetVolume={targetVolume}
                            setTargetVolume={setTargetVolume}
                            jumlahMixing={jumlahMixing}
                            setJumlahMixing={setJumlahMixing}
                            selectedSilo={selectedSilo}
                            setSelectedSilo={setSelectedSilo}
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <MixingStatus 
                            activityLog={activityLog}
                            countdownTime={countdownTime}
                            onMixingTimeChange={setCountdownTime}
                            initialCountdownTime={initialCountdownTime}
                            onInitialMixingTimeChange={setInitialCountdownTime}
                            isProcessing={isMixing || isDoorOperating}
                        />
                    </div>
                </div>

                <ScheduleTable scheduleData={scheduleData} isLoading={isScheduleLoading}/>
                </main>
                
                <ManualControlsDialog
                isOpen={isManualControlsOpen}
                onOpenChange={setManualControlsOpen}
                onWeigh={handleManualWeigh}
                onPour={handleManualPour}
                />
                 <MixerSettingsDialog 
                    isOpen={isMixerSettingsOpen} 
                    onOpenChange={setMixerSettingsOpen}
                    initialSettings={mixerSettings}
                    onSave={setMixerSettings}
                />
                <LoadingOrderDialog 
                    isOpen={isLoadingOrderOpen} 
                    onOpenChange={setIsLoadingOrderOpen}
                    initialSettings={loadingOrder}
                    onSave={setLoadingOrder}
                />
                <MoistureControlDialog
                    isOpen={isMoistureControlOpen}
                    onOpenChange={setMoistureControlOpen}
                    initialSettings={moistureSettings}
                    onSave={setMoistureSettings}
                />
            </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
