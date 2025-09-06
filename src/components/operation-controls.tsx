
'use client';

import { useState, useEffect } from 'react';
import { Ban, Power, Siren, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { ScheduleRow, JobMix, OperationMode, PrintData, SopirBatanganData, UserData, AlatData, CementSiloStock } from '@/lib/types';
import { db, collection, getDocs, query, where, doc, onSnapshot } from '@/lib/firebase';

interface OperationControlsProps {
    scheduleData: ScheduleRow[];
    onStartAuto: (jobMix: JobMix, targetVolume: number, jumlahMixing: number, selectedSilo: string, mixingTime: number) => void;
    mixingTime: number;
    isProcessing: boolean;
    onSetIsProcessing: (isProcessing: boolean) => void;
    onStop: (dataForPrint: PrintData | undefined, options: { isAborted?: boolean, mode: OperationMode }) => Promise<void>;
    onSetActiveSchedule: (schedule: ScheduleRow | null) => void;
    onSetActiveJobMix: (jobmix: JobMix | null) => void;
    activeSchedule: ScheduleRow | null;
    activeJobMix: JobMix | null;
    startTime: Date | null;
    onSetStartTime: (date: Date | null) => void;
    namaSopir: string;
    setNamaSopir: (sopir: string) => void;
    nomorMobil: string;
    setNomorMobil: (mobil: string) => void;
    nomorLambung: string;
    setNomorLambung: (lambung: string) => void;
    reqNo: string;
    setReqNo: (reqNo: string) => void;
    targetVolume: string;
    setTargetVolume: (volume: string) => void;
    jumlahMixing: number;
    setJumlahMixing: (mixes: number) => void;
    selectedSilo: string;
    setSelectedSilo: (silo: string) => void;
}


export default function OperationControls({ 
    scheduleData, 
    onStartAuto, 
    mixingTime, 
    isProcessing,
    onSetIsProcessing,
    onStop, 
    onSetActiveSchedule, 
    onSetActiveJobMix, 
    activeSchedule, 
    activeJobMix,
    startTime,
    onSetStartTime,
    namaSopir,
    setNamaSopir,
    nomorMobil,
    setNomorMobil,
    nomorLambung,
    setNomorLambung,
    reqNo,
    setReqNo,
    targetVolume,
    setTargetVolume,
    jumlahMixing,
    setJumlahMixing,
    selectedSilo,
    setSelectedSilo,
}: OperationControlsProps) {
  const [mode, setMode] = useState<OperationMode>('manual');
  const [isStopping, setIsStopping] = useState(false);
  const [isHornOn, setIsHornOn] = useState(false);
  const [isPowerOn, setIsPowerOn] = useState(true);
  const { toast } = useToast();
  const mixerCapacity = 3.5;
  const [jobMixes, setJobMixes] = useState<JobMix[]>([]);
  const [pairings, setPairings] = useState<SopirBatanganData[]>([]);
  const [activeSilos, setActiveSilos] = useState<{ id: string; status: 'aktif' | 'non-aktif' | 'perbaikan' }[]>([]);

  const userInfo: UserData | null = JSON.parse(localStorage.getItem('user') || 'null');


  useEffect(() => {
    const fetchInitialData = async () => {
        const jobmixesSnapshot = await getDocs(collection(db, "jobmixes"));
        setJobMixes(jobmixesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as JobMix));

        const pairingsSnapshot = await getDocs(collection(db, "sopir_batangan"));
        setPairings(pairingsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as SopirBatanganData));
    };
    fetchInitialData();
  }, [])

    useEffect(() => {
        if (!userInfo?.lokasi || !userInfo?.unitBp) return;
        const stockDocRef = doc(db, `locations/${userInfo.lokasi}/stock_cement_silo_${userInfo.unitBp}`, 'main');

        const unsub = onSnapshot(stockDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data() as CementSiloStock;
                const availableSilos = Object.entries(data.silos)
                    .filter(([_, siloData]) => siloData.status === 'aktif')
                    .map(([id, siloData]) => ({ id: id.replace('silo-', ''), status: siloData.status }));
                setActiveSilos(availableSilos);
            }
        });
        return () => unsub();
    }, [userInfo?.lokasi, userInfo?.unitBp]);


  const resetAllFields = () => {
    setReqNo('');
    setTargetVolume('');
    setJumlahMixing(1);
    setNamaSopir('');
    setNomorMobil('');
    setNomorLambung('');
    setSelectedSilo('');
    onSetActiveSchedule(null);
    onSetActiveJobMix(null);
  }

  const handlePowerToggle = () => {
    const newPowerState = !isPowerOn;
    setIsPowerOn(newPowerState);
    if (!newPowerState) {
        setMode('manual');
        resetAllFields();
    }
  }

    useEffect(() => {
        if (reqNo && scheduleData) {
            const foundSchedule = scheduleData.find(row => row['NO'] === reqNo);
            if (foundSchedule) {
                if (foundSchedule.STATUS === 'selesai' || foundSchedule.STATUS === 'tunda') {
                    toast({
                        variant: 'destructive',
                        title: 'Jadwal Tidak Dapat Diproses',
                        description: `Jadwal untuk ${foundSchedule['NAMA']} berstatus '${foundSchedule.STATUS}'.`,
                    });
                    onSetActiveSchedule(null);
                    onSetActiveJobMix(null);
                } else {
                    onSetActiveSchedule(foundSchedule);
                    toast({
                        title: 'Jadwal Ditemukan',
                        description: `Data untuk ${foundSchedule['NAMA']} telah dimuat.`,
                    });
                }
            } else {
                onSetActiveSchedule(null);
                onSetActiveJobMix(null);
            }
        } else {
            onSetActiveSchedule(null);
            onSetActiveJobMix(null);
        }
    }, [reqNo, scheduleData, toast, onSetActiveSchedule, onSetActiveJobMix]);
    
    useEffect(() => {
        if (activeSchedule && activeSchedule.GRADE) {
            const foundJobMix = jobMixes.find(j => j.mutuBeton === activeSchedule.GRADE);
            if(foundJobMix) {
                onSetActiveJobMix(foundJobMix);
            } else {
                onSetActiveJobMix(null);
                toast({ variant: 'destructive', title: 'Job Mix Tidak Ditemukan', description: `Tidak ada formula untuk mutu: ${activeSchedule.GRADE}` });
            }
        } else {
            onSetActiveJobMix(null);
        }
    }, [activeSchedule, toast, onSetActiveJobMix, jobMixes]);


  const handleTargetVolumeChange = (value: string) => {
    setTargetVolume(value);
    const numericValue = parseFloat(value);
    if (numericValue > 0) {
        const requiredMixes = Math.ceil(numericValue / mixerCapacity);
        setJumlahMixing(requiredMixes > 0 ? requiredMixes : 1);
    } else {
        setJumlahMixing(1);
    }
  };

  const handleJumlahMixingChange = (value: string) => {
    let numericValue = parseInt(value, 10);
    if (isNaN(numericValue) || numericValue < 1) {
      numericValue = 1;
    }
    setJumlahMixing(numericValue);
  };
  
    const handleStart = () => {
        if (isProcessing) return;

        if (!selectedSilo) {
            toast({ variant: 'destructive', title: 'Aksi Gagal', description: 'Harap pilih silo terlebih dahulu.' });
            return;
        }
        if (!activeSchedule) {
            toast({ variant: 'destructive', title: 'Aksi Gagal', description: 'Harap pilih jadwal yang aktif terlebih dahulu.' });
            return;
        }
        if (!activeJobMix) {
            toast({ variant: 'destructive', title: 'Aksi Gagal', description: 'Tidak ada Job Mix yang aktif untuk memulai proses.' });
            return;
        }
         if (!targetVolume || parseFloat(targetVolume) <= 0) {
            toast({ variant: 'destructive', title: 'Aksi Gagal', description: 'Harap isi Target Volume lebih dari 0.' });
            return;
        }
        if (!namaSopir || !nomorMobil) {
             toast({ variant: 'destructive', title: 'Aksi Gagal', description: 'Harap pilih Nama Sopir dan Nomor Mobil.' });
            return;
        }

        const sisaVolume = parseFloat(activeSchedule['SISA M³'] || '0');
        const produksiVolume = parseFloat(targetVolume);

        if (mode === 'auto' && sisaVolume > 0 && produksiVolume > sisaVolume) {
            toast({
                variant: 'destructive',
                title: 'Volume Melebihi Jadwal',
                description: `Tidak dapat diproses karena volume melebihi dari jadwal cor. Sisa volume yang dapat diproses adalah ${sisaVolume.toLocaleString('id-ID')} M³.`,
            });
            return;
        }
        
        onSetStartTime(new Date());
        onSetIsProcessing(true);

        if (mode === 'auto') {
            onStartAuto(activeJobMix, produksiVolume, jumlahMixing, selectedSilo, mixingTime);
        } else { // Manual mode
            toast({ title: "Mode Manual Aktif", description: "Perekaman data material dimulai." });
        }
    };

    const handleStopClick = async () => {
        if (!isProcessing) return;
        setIsStopping(true);

        let dataForPrint: PrintData | undefined = undefined;

        if (activeSchedule && activeJobMix && startTime) {
            dataForPrint = {
                schedule: activeSchedule,
                jobMix: activeJobMix,
                targetVolume: targetVolume,
                jumlahMixing: jumlahMixing,
                startTime: startTime,
                endTime: new Date(),
            };
        }
        
        await onStop(dataForPrint, { isAborted: mode === 'auto', mode });

        if (dataForPrint?.schedule.STATUS === 'selesai' || parseFloat(dataForPrint?.schedule['SISA M³'] || '1') <= 0) {
             resetAllFields();
        }
        
        setIsStopping(false);
    };

    const handleSopirChange = (sopirName: string) => {
        const selectedPairing = pairings.find(p => p.namaSopir === sopirName);
        if (selectedPairing) {
            setNamaSopir(selectedPairing.namaSopir);
            setNomorMobil(selectedPairing.nomorPolisi);
            setNomorLambung(selectedPairing.nomorLambung);
        }
    }


  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kolom 1: Informasi Jadwal */}
        <Card className="bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 space-y-4">
            <div className={cn(
              "border rounded-lg flex flex-col items-center justify-center p-4 h-24 text-center transition-colors",
              activeSchedule ? 'bg-green-900/30 border-green-500/30 text-green-400' : 'bg-red-900/30 border-red-500/30 text-red-400'
            )}>
              {activeSchedule ? (
                  <>
                      <Search className="h-8 w-8 mb-2" />
                      <span className="font-semibold text-sm">JADWAL COR AKTIF</span>
                  </>
              ) : (
                  <>
                      <Ban className="h-8 w-8 mb-2" />
                      <span className="font-semibold text-sm">BELUM ADA JADWAL COR YANG DIPILIH</span>
                  </>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="reqNo" className="text-muted-foreground text-xs">REQ NO</Label>
              <Input 
                  id="reqNo" 
                  placeholder="MASUKKAN NOMOR REQUEST" 
                  className="h-10" 
                  disabled={!isPowerOn || isProcessing} 
                  value={reqNo}
                  onChange={(e) => setReqNo(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="namaPelanggan" className="text-muted-foreground text-xs">NAMA PELANGGAN</Label>
              <Input id="namaPelanggan" value={activeSchedule?.['NAMA'] || ''} placeholder="DATA DARI SCHEDULE" className="h-10 bg-muted/50" disabled={true} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lokasiProyek" className="text-muted-foreground text-xs">LOKASI PROYEK</Label>
              <Input id="lokasiProyek" value={activeSchedule?.['LOKASI'] || ''} placeholder="DATA DARI SCHEDULE" className="h-10 bg-muted/50" disabled={true} />
            </div>
          </CardContent>
        </Card>

        {/* Kolom 2: Detail Campuran */}
        <Card className="bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="namaSopir" className="text-muted-foreground text-xs">NAMA SOPIR</Label>
                  <Select onValueChange={handleSopirChange} value={namaSopir} disabled={!isPowerOn || isProcessing}>
                        <SelectTrigger className="w-full h-10">
                            <SelectValue placeholder="Pilih Sopir" />
                        </SelectTrigger>
                        <SelectContent>
                            {pairings.map((p) => (
                                <SelectItem key={p.id} value={p.namaSopir} className="cursor-pointer">{p.namaSopir}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nomorMobil" className="text-muted-foreground text-xs">NOMOR MOBIL</Label>
                  <Input id="nomorMobil" value={nomorMobil} placeholder="DARI PILIHAN SOPIR" className="h-10 bg-muted/50" disabled={true} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="nomorLambung" className="text-muted-foreground text-xs">NOMOR LAMBUNG</Label>
                    <Input id="nomorLambung" value={nomorLambung} placeholder="DARI PILIHAN SOPIR" className="h-10 bg-muted/50" disabled={true} />
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="mutuBeton" className="text-muted-foreground text-xs">MUTU BETON</Label>
                    <Input id="mutuBeton" value={activeSchedule?.['GRADE'] || ''} placeholder="DATA DARI SCHEDULE" className="h-10 bg-muted/50" disabled={true} />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="targetVolume" className="text-muted-foreground text-xs">TARGET VOLUME (M³)</Label>
                  <Input 
                    id="targetVolume" 
                    type="number" 
                    value={targetVolume}
                    onChange={(e) => handleTargetVolumeChange(e.target.value)}
                    placeholder="0.0"
                    className="h-10" 
                    disabled={!isPowerOn || isProcessing} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="jumlahMixing" className="text-muted-foreground text-xs">JUMLAH MIXING</Label>
                  <Input 
                    id="jumlahMixing" 
                    type="number"
                    value={jumlahMixing}
                    onChange={(e) => handleJumlahMixingChange(e.target.value)}
                    className="h-10" 
                    disabled={!isPowerOn || isProcessing}
                    min="1"
                  />
                  <p className='text-xs text-muted-foreground text-center pt-1'>Kapasitas: {mixerCapacity} M³</p>
                </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className="space-y-1">
                  <Label htmlFor="slump" className="text-muted-foreground text-xs">SLUMP (CM)</Label>
                  <Input id="slump" type="text" value={activeSchedule?.['SLUMP (CM)'] || ''} className="h-10 bg-muted/50" disabled={true} />
              </div>
              <div className="space-y-1">
                  <Label htmlFor="mediaCor" className="text-muted-foreground text-xs">MEDIA COR</Label>
                  <Input id="mediaCor" value={activeSchedule?.['CP/M'] || ''} placeholder="DATA DARI SCHEDULE" className="h-10 bg-muted/50" disabled={true} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Kolom 3: Kontrol Operasi */}
        <Card className="bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="space-y-4">
                  <div>
                      <Label className="text-muted-foreground text-center block mb-2 text-xs">MODE OPERASI</Label>
                      <div className="grid grid-cols-2 gap-2">
                          <Button 
                              onClick={() => setMode('manual')}
                              variant={mode === 'manual' ? 'default' : 'secondary'}
                              className='py-5 text-sm'
                              disabled={!isPowerOn || isProcessing}
                          >
                              MANUAL
                          </Button>
                          <Button 
                              onClick={() => setMode('auto')}
                              variant={mode === 'auto' ? 'default' : 'secondary'}
                              className='py-5 text-sm'
                              disabled={!isPowerOn || isProcessing}
                          >
                              AUTO
                          </Button>
                      </div>
                  </div>
                  <div>
                      <Label className="text-muted-foreground text-center block mb-2 text-xs">KONTROL PROSES</Label>
                      <div className="grid grid-cols-2 gap-2">
                          <Button 
                              onClick={handleStart}
                              disabled={
                                !isPowerOn || 
                                !activeSchedule || 
                                isProcessing || 
                                !selectedSilo || 
                                !namaSopir || 
                                !nomorMobil
                              }
                              className={cn('py-5 text-base transition-colors font-bold', 
                                  isProcessing 
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse' 
                                  : 'bg-green-700 hover:bg-green-800 text-white'
                              )}>
                              START
                          </Button>
                          <Button 
                              variant="destructive" 
                              onClick={handleStopClick}
                              disabled={!isPowerOn || isStopping || !isProcessing}
                              className="py-5 text-base font-bold">
                              {isStopping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              STOP
                          </Button>
                      </div>
                  </div>
                  <div>
                      <Button 
                          variant="secondary" 
                          className={cn('w-full py-5 text-sm transition-colors', isHornOn ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-secondary hover:bg-secondary/80')}
                          onMouseDown={() => setIsHornOn(true)}
                          onMouseUp={() => setIsHornOn(false)}
                          onMouseLeave={() => setIsHornOn(false)}
                          disabled={!isPowerOn}
                      >
                          <Siren className="mr-2"/>
                          KLAKSON
                      </Button>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-center block mb-2 text-xs">PILIH SILO (HANYA YANG AKTIF)</Label>
                    <Select onValueChange={setSelectedSilo} value={selectedSilo} disabled={!isPowerOn || isProcessing || activeSilos.length === 0}>
                        <SelectTrigger className="w-full h-12">
                            <SelectValue placeholder={activeSilos.length > 0 ? "Pilih Silo Aktif..." : "Tidak ada silo aktif"} />
                        </SelectTrigger>
                        <SelectContent>
                            {activeSilos.map((silo) => (
                                <SelectItem 
                                    key={silo.id} 
                                    value={silo.id}
                                    className="cursor-pointer text-base"
                                >
                                    Silo {silo.id}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
              </div>
              
              <Button 
                  className={cn(
                      'w-full py-5 text-base font-bold transition-colors mt-6',
                      isPowerOn ? 'bg-primary/80 hover:bg-primary text-primary-foreground' : 'bg-destructive/80 hover:bg-destructive'
                  )}
                  onClick={handlePowerToggle}
              >
                  <Power className="mr-2"/>
                  {isPowerOn ? 'POWER ON' : 'POWER OFF'}
              </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
