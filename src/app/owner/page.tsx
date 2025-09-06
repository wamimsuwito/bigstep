

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut, Building, Calendar, BarChart, Package, Ship, Users, ShieldCheck, ClipboardList, Thermometer, TestTube, Droplets, HardHat, UserCheck, UserX, Star, Radio, Watch } from 'lucide-react';
import { db, collection, getDocs, onSnapshot, query, where, Timestamp, orderBy, limit, doc } from '@/lib/firebase';
import type { UserData, LocationData, ScheduleRow, RencanaPemasukan, Job, Report, BpUnitStatus, AlatData, DailyQCInspection, BendaUji, SopirBatanganData, ProductionData } from '@/lib/types';
import { format, isAfter, subMinutes, differenceInMinutes, differenceInHours, differenceInDays, startOfToday } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const StatCard = ({ title, value, unit, icon: Icon, description }: { title: string, value: string | number, unit?: string, icon: React.ElementType, description?: string }) => (
    <Card className="bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">
                {typeof value === 'number' ? value.toLocaleString('id-ID', {maximumFractionDigits: 2}) : value}
                {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const SectionTitle = ({ title, icon: Icon }: { title: string, icon: React.ElementType }) => (
    <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-3 col-span-full">
        <Icon className="h-6 w-6 text-primary" />
        {title}
    </h2>
);

const ALL_BP_UNITS = ['BP-1', 'BP-2', 'BP-3'];

interface SummaryData {
    requestMasuk: number;
    requestCount: number;
    volumeCor: number;
    lokasiCp: number;
    lokasiTerkirimCount: number;
    materialSudahBongkar: { semen: number; pasir: number; batu: number };
    materialMenungguBongkar: { semen: number; pasir: number; batu: number };
    manPower: { total: number; masuk: number; ijin: number; alpha: number; sakit: number; cuti: number; jadwalOff: number };
    armada: { total: number; rusak: { [key: string]: number }; baik: { [key: string]: number } };
    materialSedangBongkar: any[];
    qc: {
        phAir: string;
        suhuAir: string;
        kadarLumpurPasir: string;
        kadarLumpurBatu: string;
        tdsAir: string;
        kadarOrganik: string;
        zona: string;
        bendaUji: number;
    };
}


export default function OwnerPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [userInfo, setUserInfo] = useState<UserData | null>(null);
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [bpStatuses, setBpStatuses] = useState<BpUnitStatus[]>([]);
    const [summary, setSummary] = useState<SummaryData>({
        requestMasuk: 0,
        requestCount: 0,
        volumeCor: 0,
        lokasiCp: 0,
        lokasiTerkirimCount: 0,
        materialSudahBongkar: { semen: 0, pasir: 0, batu: 0 },
        materialMenungguBongkar: { semen: 0, pasir: 0, batu: 0 },
        manPower: { total: 0, masuk: 0, ijin: 0, alpha: 0, sakit: 0, cuti: 0, jadwalOff: 0 },
        armada: { total: 0, rusak: {}, baik: {} },
        materialSedangBongkar: [],
        qc: { phAir: 'N/A', suhuAir: 'N/A', kadarLumpurPasir: 'N/A', kadarLumpurBatu: 'N/A', tdsAir: 'N/A', kadarOrganik: 'N/A', zona: 'N/A', bendaUji: 0 },
    });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (!userString) {
            router.push('/login');
            return;
        }
        const userData = JSON.parse(userString);
        if (userData.jabatan !== 'OWNER') {
            toast({ variant: 'destructive', title: 'Akses Ditolak' });
            router.push('/login');
            return;
        }
        setUserInfo(userData);
    }, [router, toast]);

    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const locsSnap = await getDocs(collection(db, 'locations'));
                const locsData = locsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as LocationData);
                setLocations(locsData);
                if (locsData.length > 0 && !selectedLocation) {
                    setSelectedLocation(locsData[0].name);
                } else if (locsData.length === 0) {
                    setIsLoading(false);
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Gagal Memuat Lokasi' });
                setIsLoading(false);
            }
        };
        fetchLocations();
    }, [toast, selectedLocation]);
    
    const resetSummary = useCallback(() => {
         setSummary({
            requestMasuk: 0,
            requestCount: 0,
            volumeCor: 0,
            lokasiCp: 0,
            lokasiTerkirimCount: 0,
            materialSudahBongkar: { semen: 0, pasir: 0, batu: 0 },
            materialMenungguBongkar: { semen: 0, pasir: 0, batu: 0 },
            manPower: { total: 0, masuk: 0, ijin: 0, alpha: 0, sakit: 0, cuti: 0, jadwalOff: 0 },
            armada: { total: 0, rusak: {}, baik: {} },
            materialSedangBongkar: [],
            qc: { phAir: 'N/A', suhuAir: 'N/A', kadarLumpurPasir: 'N/A', kadarLumpurBatu: 'N/A', tdsAir: 'N/A', kadarOrganik: 'N/A', zona: 'N/A', bendaUji: 0 },
        });
    }, []);

    useEffect(() => {
        if (!selectedLocation) return;
        setIsLoading(true);
        resetSummary();

        const unsubscribers: (() => void)[] = [];
        const todayStart = startOfToday();
        const todayId = `${selectedLocation}_${format(new Date(), 'yyyy-MM-dd')}`;

        // Listener for HSE Summary
        const hseSummaryDocRef = doc(db, 'hse_daily_summaries', todayId);
        unsubscribers.push(onSnapshot(hseSummaryDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSummary((prev: SummaryData) => ({ 
                    ...prev, 
                    manPower: {
                        total: data.total || 0,
                        masuk: data.masuk || 0,
                        ijin: data.ijin || 0,
                        alpha: data.alpha || 0,
                        sakit: data.sakit || 0,
                        cuti: data.cuti || 0,
                        jadwalOff: data.jadwalOff || 0
                    }
                }));
            } else {
                 setSummary((prev: SummaryData) => ({ ...prev, manPower: { total: 0, masuk: 0, ijin: 0, alpha: 0, sakit: 0, cuti: 0, jadwalOff: 0 } }));
            }
        }, (error) => console.error("Error fetching HSE summary:", error)));


        // Listener for BP Status (REAL-TIME)
        const statusQuery = query(collection(db, 'bp_unit_status'), where('location', '==', selectedLocation));
        unsubscribers.push(onSnapshot(statusQuery, (snapshot) => {
            const statuses = snapshot.docs.map(doc => doc.data() as BpUnitStatus);
            setBpStatuses(statuses);
        }, (error) => console.error("Error fetching BP status:", error)));
        
        // Listener for Schedules from Production Data
        const productionQuery = query(collection(db, 'productions'), where('lokasiProduksi', '==', selectedLocation), where('tanggal', '>=', Timestamp.fromDate(todayStart)));
        unsubscribers.push(onSnapshot(productionQuery, (snapshot) => {
            const productionsToday = snapshot.docs.map(doc => doc.data() as ProductionData);
            
            // Re-aggregate schedule-like data from productions
            const schedules = productionsToday.reduce((acc, prod) => {
                const key = `${prod.jobId}|${prod.lokasiProyek}|${prod.mutuBeton}`;
                if (!acc[key]) {
                    acc[key] = {
                        'TOTAL M³': '0',
                        'TERKIRIM M³': '0',
                        'LOKASI': prod.lokasiProyek,
                        'CP/M': prod['CP/M'],
                    };
                }
                acc[key]['TERKIRIM M³'] = String((parseFloat(acc[key]['TERKIRIM M³']) || 0) + prod.targetVolume);
                return acc;
            }, {} as Record<string, any>);
            
            // Fetch the original schedule to get total volume
            getDocs(query(collection(db, 'schedules_today'))).then(scheduleSnapshot => {
                const originalSchedules = scheduleSnapshot.docs.map(doc => doc.data() as ScheduleRow);
                
                originalSchedules.forEach(origSched => {
                    const key = `${origSched.NO}|${origSched.LOKASI}|${origSched.GRADE}`;
                    if(schedules[key]) {
                        const vol = parseFloat(origSched['VOL M³'] || '0');
                        const tambahVol = parseFloat(origSched['PENAMBAHAN VOL M³'] || '0');
                        schedules[key]['TOTAL M³'] = String(vol + tambahVol);
                    }
                });

                const finalSchedules = Object.values(schedules);
                const totalJadwal = finalSchedules.reduce((sum: number, s) => sum + parseFloat(s['TOTAL M³'] || '0'), 0);
                const totalTerkirim = finalSchedules.reduce((sum: number, s) => sum + parseFloat(s['TERKIRIM M³'] || '0'), 0);
                
                const cpLocations = new Set(finalSchedules.filter(s => s['CP/M']?.toUpperCase() === 'CP').map(s => s.LOKASI)).size;
                const lokasiTerkirimCount = new Set(finalSchedules.map(s => s.LOKASI)).size;

                setSummary((prev: SummaryData) => ({
                    ...prev,
                    requestMasuk: totalJadwal,
                    requestCount: finalSchedules.length,
                    volumeCor: totalTerkirim,
                    lokasiCp: cpLocations,
                    lokasiTerkirimCount: lokasiTerkirimCount,
                }));
            });

        }, (error) => console.error("Error fetching productions:", error)));
        
        const pemasukanQuery = query(collection(db, 'arsip_pemasukan_material_semua'), where('timestamp', '>=', todayStart.toISOString()));
        unsubscribers.push(onSnapshot(pemasukanQuery, (snapshot) => {
            const materialSudahBongkar = { semen: 0, pasir: 0, batu: 0 };
            snapshot.docs.forEach(doc => {
                const entry = doc.data();
                if (entry.material.toUpperCase() === 'SEMEN') materialSudahBongkar.semen += entry.jumlah;
                if (entry.material.toUpperCase() === 'PASIR') materialSudahBongkar.pasir += entry.jumlah;
                if (entry.material.toUpperCase() === 'BATU') materialSudahBongkar.batu += entry.jumlah;
            });
            setSummary((prev: SummaryData) => ({...prev, materialSudahBongkar}));
        }, (error) => console.error("Error fetching material income:", error)));
        
        const rencanaQuery = query(collection(db, 'rencana_pemasukan'), where('status', 'in', ['Memenuhi Syarat', 'Siap Untuk Dibongkar']));
        unsubscribers.push(onSnapshot(rencanaQuery, (snapshot) => {
            const materialMenungguBongkar = { semen: 0, pasir: 0, batu: 0 };
            snapshot.docs.forEach(doc => {
                const r = doc.data() as RencanaPemasukan;
                if(r.jenisMaterial.toUpperCase() === 'SEMEN') materialMenungguBongkar.semen += 1;
                if(r.jenisMaterial.toUpperCase() === 'PASIR') materialMenungguBongkar.pasir += 1;
                if(r.jenisMaterial.toUpperCase() === 'BATU') materialMenungguBongkar.batu += 1;
            });
            setSummary((prev: SummaryData) => ({ ...prev, materialMenungguBongkar }));
        }, (error) => console.error("Error fetching Rencana Pemasukan:", error)));
        
        const alatQuery = query(collection(db, 'alat'), where('lokasi', '==', selectedLocation));
        const alatUnsub = onSnapshot(alatQuery, (alatSnapshot) => {
            const alatData = alatSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as AlatData);
            
            Promise.all([
                getDocs(query(collection(db, 'checklist_reports'))),
                getDocs(query(collection(db, 'sopir_batangan'), where("lokasi", "==", selectedLocation)))
            ]).then(([reportSnapshot, pairingSnapshot]) => {
                const allReports = reportSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Report);
                const allPairings = pairingSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as SopirBatanganData);

                const rusak: { [key: string]: number } = {};
                const baik: { [key: string]: number } = {};
                
                alatData.forEach(vehicle => {
                    const isPaired = allPairings.some(p => p.nomorLambung === vehicle.nomorLambung);
                    
                    const latestReport = allReports
                        .filter(r => r.nomorLambung === vehicle.nomorLambung)
                        .sort((a, b) => (b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0) - (a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0))[0];

                    const jenis = vehicle.jenisKendaraan.toLowerCase().replace(/\s+/g, '_');
                    
                    if (!isPaired) {
                        baik[jenis] = (baik[jenis] || 0) + 1;
                    } else if (latestReport && latestReport.overallStatus === 'rusak') {
                        rusak[jenis] = (rusak[jenis] || 0) + 1;
                    } else {
                        baik[jenis] = (baik[jenis] || 0) + 1;
                    }
                });
                
                setSummary((prev: SummaryData) => ({ ...prev, armada: {...prev.armada, rusak, baik, total: alatData.length }}));
            }).catch(error => console.error("Error fetching reports or pairings:", error));
        });
        unsubscribers.push(alatUnsub);
        
        const dailyQcQuery = query(collection(db, "daily_qc_inspections"), where('location', '==', selectedLocation), orderBy('createdAt', 'desc'), limit(1));
        unsubscribers.push(onSnapshot(dailyQcQuery, (snapshot) => {
             if (!snapshot.empty) {
                const latestReport = snapshot.docs[0].data() as DailyQCInspection;
                setSummary(prev => ({
                    ...prev,
                    qc: {
                        ...prev.qc,
                        phAir: latestReport.items.phAir?.value || 'N/A',
                        suhuAir: latestReport.items.suhuAir?.value || 'N/A',
                        kadarLumpurPasir: latestReport.items.kadarLumpurPasir?.value || 'N/A',
                        kadarLumpurBatu: latestReport.items.kadarLumpurBatu?.value || 'N/A',
                        tdsAir: latestReport.items.tdsAir?.value || 'N/A',
                        zona: latestReport.items.zonaPasir?.value || 'N/A',
                    }
                }));
            }
        }));

        const bendaUjiQuery = query(collection(db, "benda_uji"), where('createdAt', '>=', Timestamp.fromDate(todayStart)));
        unsubscribers.push(onSnapshot(bendaUjiQuery, (snapshot) => {
            const totalBendaUji = snapshot.docs.reduce((sum, doc) => sum + (doc.data() as BendaUji).jumlahSample, 0);
            setSummary(prev => ({ ...prev, qc: { ...prev.qc, bendaUji: totalBendaUji } }));
        }));


        setIsLoading(false);
        return () => unsubscribers.forEach(unsub => unsub());
    }, [selectedLocation, toast, resetSummary]);

    if (!userInfo) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
    }

    const armadaJenis = ['tm', 'dt', 'loader', 'cp', 'genset', 'kt', 'inventaris', 'bp'];

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-background">
            <header className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <Star className="h-6 w-6 text-primary"/>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-wider">Owner Dashboard</h1>
                        <p className="text-muted-foreground">Ringkasan Operasional</p>
                    </div>
                </div>
                 <div className="flex items-center gap-4 w-full md:w-auto">
                    <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={locations.length === 0}>
                        <SelectTrigger className="w-full md:w-[250px]">
                             <SelectValue placeholder="Pilih Lokasi..." />
                        </SelectTrigger>
                        <SelectContent>
                            {locations.map(loc => (
                                <SelectItem key={loc.id} value={loc.name}>
                                    <Building className="inline-block mr-2 h-4 w-4"/>{loc.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Button variant="ghost" size="icon" onClick={() => router.push('/login')}><LogOut className="h-5 w-5" /></Button>
                 </div>
            </header>
            
            {isLoading ? (
                 <div className="flex justify-center items-center h-96">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                 </div>
            ) : !selectedLocation ? (
                 <div className="flex justify-center items-center h-96">
                    <p className="text-muted-foreground">Pilih lokasi untuk melihat ringkasan.</p>
                 </div>
            ) : (
            <main className="space-y-8">
                <div className="space-y-4">
                    <SectionTitle title="Ringkasan Produksi Hari Ini" icon={BarChart} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <StatCard title="Request Masuk" value={summary.requestMasuk.toLocaleString('id-ID', {maximumFractionDigits: 2})} unit="M³" icon={Calendar} description={`${summary.requestCount} List Request`} />
                        <StatCard title="Volume Cor Saat Ini" value={summary.volumeCor.toLocaleString('id-ID', { maximumFractionDigits: 2 })} unit="M³" icon={BarChart} description={`${summary.lokasiTerkirimCount} Lokasi Terlayani`}/>
                        <StatCard title="Lokasi Menggunakan CP" value={summary.lokasiCp} unit="Lokasi" icon={Building} description="Jumlah lokasi cor dengan concrete pump." />
                    </div>
                </div>

                 <div className="space-y-4">
                    <SectionTitle title="Status BP Aktif / Non Aktif" icon={Radio} />
                    <Card>
                        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {ALL_BP_UNITS.map(unit => {
                               const status = bpStatuses.find((s) => s.unit === unit);
                               const lastActivityDate = status?.lastActivity?.toDate();
                               const isActive = lastActivityDate ? isAfter(lastActivityDate, subMinutes(currentTime, 60)) : false;

                               let statusText, indicatorColor, isPulsing = false;

                               if (isActive) {
                                   statusText = `Aktif pada ${format(lastActivityDate!, 'HH:mm:ss')}`;
                                   indicatorColor = 'bg-green-500';
                                   isPulsing = true;
                               } else if (lastActivityDate) {
                                   const diffInDays = differenceInDays(currentTime, lastActivityDate);
                                   const diffInHours = differenceInHours(currentTime, lastActivityDate);
                                   
                                   if (diffInHours < 24) {
                                       statusText = `Tidak Aktif (terakhir aktif ${diffInHours} jam lalu)`;
                                   } else {
                                       statusText = `Tidak Aktif (terakhir aktif ${diffInDays} hari lalu)`;
                                   }
                                   indicatorColor = 'bg-red-500';
                               } else {
                                    statusText = 'Belum ada aktivitas';
                                    indicatorColor = 'bg-gray-500';
                               }

                               return (
                                   <div key={unit} className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
                                       <div className={`w-3 h-3 rounded-full ${indicatorColor} ${isPulsing ? 'animate-pulse' : ''}`}></div>
                                       <div>
                                           <p className="font-semibold">{unit}</p>
                                           <p className="text-xs text-muted-foreground">{statusText}</p>
                                       </div>
                                   </div>
                               );
                           })}
                        </CardContent>
                    </Card>
                </div>


                <div className="space-y-4">
                    <SectionTitle title="Ringkasan Material Hari Ini" icon={Package} />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatCard title="Semen Telah Bongkar" value={summary.materialSudahBongkar.semen} unit="KG" icon={Package} />
                        <StatCard title="Pasir Telah Bongkar" value={summary.materialSudahBongkar.pasir} unit="M³" icon={Package} />
                        <StatCard title="Batu Telah Bongkar" value={summary.materialSudahBongkar.batu} unit="M³" icon={Package} />
                        <StatCard title="Semen Sedang Bongkar" value={summary.materialMenungguBongkar.semen} unit="Kapal" icon={Ship} />
                        <StatCard title="Pasir Sedang Bongkar" value={summary.materialMenungguBongkar.pasir} unit="Kapal" icon={Ship} />
                        <StatCard title="Batu Sedang Bongkar" value={summary.materialMenungguBongkar.batu} unit="Kapal" icon={Ship} />
                    </div>
                </div>
                
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <SectionTitle title="Ringkasan Man Power" icon={Users} />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <StatCard title="Total" value={summary.manPower.total} unit="Orang" icon={UserCheck}/>
                            <StatCard title="Masuk" value={summary.manPower.masuk} unit="Orang" icon={UserCheck}/>
                            <StatCard title="Ijin" value={summary.manPower.ijin} unit="Orang" icon={HardHat}/>
                            <StatCard title="Alpha" value={summary.manPower.alpha} unit="Orang" icon={UserX}/>
                            <StatCard title="Sakit" value={summary.manPower.sakit} unit="Orang" icon={HardHat}/>
                            <StatCard title="Cuti" value={summary.manPower.cuti} unit="Orang" icon={HardHat}/>
                            <StatCard title="Jadwal Off" value={summary.manPower.jadwalOff} unit="Orang" icon={Watch}/>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <SectionTitle title="Ringkasan QC" icon={TestTube} />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <StatCard title="pH Air" value={summary.qc.phAir} icon={Droplets}/>
                            <StatCard title="Suhu Air" value={summary.qc.suhuAir} unit="°C" icon={Thermometer}/>
                            <StatCard title="TDS Air" value={summary.qc.tdsAir} unit="ppm" icon={TestTube}/>
                            <StatCard title="Kadar Lumpur Pasir" value={summary.qc.kadarLumpurPasir} unit="%" icon={TestTube}/>
                            <StatCard title="Kadar Lumpur Batu" value={summary.qc.kadarLumpurBatu} unit="%" icon={TestTube}/>
                            <StatCard title="Zona Pasir" value={summary.qc.zona} icon={TestTube}/>
                            <StatCard title="Benda Uji Hari Ini" value={summary.qc.bendaUji} unit="buah" icon={ClipboardList}/>
                        </div>
                    </div>
                 </div>

                <div className="space-y-4">
                     <SectionTitle title="Status Armada Hari Ini" icon={ShieldCheck} />
                     <div className='p-4 bg-card rounded-lg border'>
                        <h3 className='font-semibold text-muted-foreground mb-2'>Total Armada di Lokasi: {summary.armada.total} unit</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                             <div>
                                <h4 className="font-medium text-destructive mb-2">Kondisi Rusak</h4>
                                <div className="space-y-1 text-sm">
                                    {armadaJenis.map(jenis => <p key={`rusak-${jenis}`} className='flex justify-between'><span>{jenis.toUpperCase()}</span> <span className='font-semibold'>{summary.armada.rusak[jenis] || 0} unit</span></p>)}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-medium text-green-500 mb-2">Kondisi Baik</h4>
                                <div className="space-y-1 text-sm">
                                   {armadaJenis.map(jenis => <p key={`baik-${jenis}`} className='flex justify-between'><span>{jenis.toUpperCase()}</span> <span className='font-semibold'>{summary.armada.baik[jenis] || 0} unit</span></p>)}
                                </div>
                            </div>
                        </div>
                     </div>
                </div>

            </main>
            )}
        </div>
    );
}

