
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Play, Flag, Truck, Wind, CircleDot, History, Loader2, Anchor, Star, ClipboardList, CheckCircle, Fuel } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceStrict } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Job, TripLog, UserData } from '@/lib/types';
import { db, collection, getDocs, doc, updateDoc, addDoc, onSnapshot, query, where, setDoc, getDoc } from '@/lib/firebase';

const getStepDetails = (step: 'idle' | 'departed_from_bp' | 'arrived_at_destination' | 'loading_started' | 'loading_finished' | 'departed_from_destination', destination: string) => {
    switch (step) {
        case 'idle': return { title: 'Siap Berangkat', buttonText: 'Mulai Ritase' };
        case 'departed_from_bp': return { title: `Menuju ${destination}`, buttonText: 'Konfirmasi Tiba' };
        case 'arrived_at_destination': return { title: 'Tiba, Menunggu Antrian Muat', buttonText: 'Mulai Muat' };
        case 'loading_started': return { title: 'Proses Pemuatan', buttonText: 'Selesai Muat' };
        case 'loading_finished': return { title: `Selesai Muat, Menuju BP`, buttonText: 'Konfirmasi Tiba di BP' };
        case 'departed_from_destination': return { title: `Perjalanan Pulang ke BP`, buttonText: 'Konfirmasi Tiba di BP' };
        default: return { title: '', buttonText: '' };
    }
}

export default function CatatRitBongkarPage() {
    const router = useRouter();
    const { toast } = useToast();
    
    const [userInfo, setUserInfo] = useState<UserData | null>(null);
    const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
    const [activeJob, setActiveJob] = useState<Job | null>(null);

    const [currentStep, setCurrentStep] = useState<'idle' | 'departed_from_bp' | 'arrived_at_destination' | 'loading_started' | 'loading_finished' | 'departed_from_destination'>('idle');
    const [currentTripLog, setCurrentTripLog] = useState<Partial<TripLog & { jobId: string }>>({});
    const [tripHistory, setTripHistory] = useState<TripLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const destination = useMemo(() => {
        if (!activeJob) return '';
        if (activeJob.material === 'Batu') return 'Jetty Oki';
        if (activeJob.material === 'Pasir') return 'Dermaga Buffer Silo';
        return '';
    }, [activeJob]);

    const MUATAN_PER_RIT_ESTIMASI_PASIR = 18;
    const MUATAN_PER_RIT_ESTIMASI_BATU = 20;

    const loadStateFromFirestore = useCallback(async (userId: string) => {
        const stateDocQuery = await getDocs(query(collection(db, 'driver_states'), where('userId', '==', userId)));
        if (!stateDocQuery.empty) {
            const state = stateDocQuery.docs[0].data();
            if (state.activeJobId) {
                const jobDoc = await getDoc(doc(db, 'available_jobs', state.activeJobId));
                if (jobDoc.exists()) {
                    const jobData = jobDoc.data() as Job;
                    const jobWithId: Job = { ...jobData, id: state.activeJobId };
                    setActiveJob(jobWithId);
                    setCurrentTripLog(state.currentTripLog || {});
                    setCurrentStep(state.currentStep || 'idle');

                    const historySnapshot = await getDocs(query(
                        collection(db, 'all_trip_histories'),
                        where('sopirId', '==', userId),
                        where('jobId', '==', state.activeJobId)
                    ));
                    const userHistoryToday = historySnapshot.docs
                        .map(d => d.data() as TripLog)
                        .sort((a, b) => a.tripNumber - b.tripNumber);
                    setTripHistory(userHistoryToday);
                }
            }
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        setIsLoading(true);
        const userString = localStorage.getItem('user');
        if (!userString) {
            router.push('/login');
            return;
        }
        const dummyUser: UserData = JSON.parse(userString);
        setUserInfo(dummyUser);
        
        if(dummyUser.id) {
            loadStateFromFirestore(dummyUser.id);
        }

    }, [router, loadStateFromFirestore]);
    
    useEffect(() => {
        const fetchAndSubscribe = async () => {
            const jobsCollection = collection(db, 'available_jobs');
            const unsubscribe = onSnapshot(jobsCollection, (snapshot) => {
                const jobsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Job[];
                setAvailableJobs(jobsData);

                if (activeJob?.id) {
                    const updatedActiveJob = jobsData.find(j => j.id === activeJob.id);
                    if (updatedActiveJob) {
                        setActiveJob(updatedActiveJob);
                    } else {
                        handleJobStop();
                    }
                }
            });
            return unsubscribe;
        };
        const unsubscribePromise = fetchAndSubscribe();
        
        return () => {
            (async () => {
                const unsub = await unsubscribePromise;
                unsub();
            })();
        };
    }, [activeJob?.id]);

    const saveStateToFirestore = useCallback(async () => {
        if (!userInfo) return;
        const stateToSave = {
            userId: userInfo.id,
            activeJobId: activeJob?.id || null,
            currentTripLog,
            currentStep,
        };
        const stateDocRef = doc(db, 'driver_states', userInfo.id);
        await setDoc(stateDocRef, stateToSave);
    }, [userInfo, activeJob, currentTripLog, currentStep]);

    useEffect(() => {
        saveStateToFirestore();
    }, [saveStateToFirestore]);

    const handleJobStart = async (job: Job) => {
        if (!userInfo) return;
        setActiveJob(job);
        
        // Fetch existing history for this job and this driver
        const historySnapshot = await getDocs(query(
            collection(db, 'all_trip_histories'),
            where('sopirId', '==', userInfo.id),
            where('jobId', '==', job.id)
        ));
        const userHistoryForJob = historySnapshot.docs
            .map(d => d.data() as TripLog)
            .sort((a,b) => a.tripNumber - b.tripNumber);
        
        setTripHistory(userHistoryForJob);
        setCurrentStep('idle');
        setCurrentTripLog({ jobId: job.id });
    };
    
    const handleJobStop = () => {
        toast({ title: 'Sesi Selesai', description: `Anda telah berhenti bekerja dari pekerjaan bongkar ${activeJob?.material}.` });
        setActiveJob(null);
        setCurrentStep('idle');
        setCurrentTripLog({});
    };
    
     const handleBack = () => {
        router.back();
    };

    const handleActionClick = async () => {
        if (!activeJob || !userInfo) return;
        
        setIsSubmitting(true);
        const now = new Date().toISOString();
        let nextStep: typeof currentStep = 'idle';
        let updatedLog = { ...currentTripLog };

        try {
            switch (currentStep) {
                case 'idle':
                    nextStep = 'departed_from_bp';
                    const newTripNumber = (tripHistory.length > 0 ? Math.max(...tripHistory.map(t => t.tripNumber)) : 0) + 1;
                    updatedLog = { 
                        jobId: activeJob.id,
                        tripNumber: newTripNumber, 
                        material: activeJob.material,
                        destination: destination,
                        sopirId: userInfo.id,
                        sopirName: userInfo.username,
                        departFromBp: now 
                    };
                    break;
                case 'departed_from_bp':
                    nextStep = 'arrived_at_destination';
                    updatedLog.arriveAtDestination = now;
                    break;
                case 'arrived_at_destination':
                    nextStep = 'loading_started';
                    updatedLog.startLoading = now;
                    break;
                case 'loading_started':
                    nextStep = 'loading_finished';
                    updatedLog.finishLoading = now;
                    break;
                case 'loading_finished':
                    nextStep = 'departed_from_destination';
                    updatedLog.departFromDestination = now;
                    break;
                case 'departed_from_destination':
                    nextStep = 'idle';
                    updatedLog.arriveAtBp = now;
                    const finalTripLog = updatedLog as TripLog;

                    const newHistory = [...tripHistory, finalTripLog];
                    setTripHistory(newHistory);
                    
                    await addDoc(collection(db, 'all_trip_histories'), finalTripLog);
                    
                    // Volume update is now just for estimation, not for stock deduction
                    // This can be simplified or removed if not needed for display
                    
                    updatedLog = { jobId: activeJob.id };
                    toast({ title: 'Siklus Selesai', description: `Rit ke-${newHistory.length} telah dicatat.`});
                    break;
            }
        
            setCurrentStep(nextStep);
            setCurrentTripLog(updatedLog);
        } catch (error) {
            console.error("Error handling action:", error);
            toast({ variant: 'destructive', title: 'Terjadi Kesalahan', description: 'Gagal memperbarui status ritase.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const ritasiSelesai = tripHistory.length;
    const muatanPerRitEstimasi = activeJob?.material === 'Pasir' ? MUATAN_PER_RIT_ESTIMASI_PASIR : MUATAN_PER_RIT_ESTIMASI_BATU;
    const estimasiVolumeTerbongkar = ritasiSelesai * muatanPerRitEstimasi;
    const estimasiSisaVolume = activeJob ? activeJob.totalVolume - estimasiVolumeTerbongkar : 0;
    const pemakaianBBM = activeJob ? ritasiSelesai * activeJob.bbmPerRit : 0;

    const { title, buttonText } = getStepDetails(currentStep, destination);

    const formatTime = (time?: string) => time ? format(new Date(time), 'HH:mm:ss') : '-';
    const formatDuration = (start?: string, end?: string) => !start || !end ? '-' : formatDistanceStrict(new Date(end), new Date(start), { locale: localeID });
    
    if (isLoading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-background text-foreground p-4">
            <header className="flex items-center gap-4 py-4">
                <Button variant="ghost" size="icon" onClick={handleBack}><ArrowLeft /></Button>
                <div className="flex items-center gap-2">
                    <Anchor />
                    <h1 className="text-xl font-bold">Rit Bongkar Material</h1>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto space-y-6 pb-4">
                {!activeJob ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ClipboardList/>Pilih Perintah Bongkar</CardTitle>
                            <CardDescription>Pilih pekerjaan yang akan dimulai dari daftar di bawah ini.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {availableJobs.filter(j => j.status === 'Proses').map(job => (
                                <Card key={job.id} className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-lg flex items-center gap-2">
                                            {job.material === 'Batu' ? <Wind/> : <CircleDot/>}
                                            Bongkar {job.material}
                                        </p>
                                        <p className="text-sm text-muted-foreground">Kapal: {job.namaKapal}</p>
                                        <p className="text-sm text-muted-foreground">Total Aktual: {job.totalVolume} M³</p>
                                    </div>
                                    <Button onClick={() => handleJobStart(job)} disabled={!!activeJob || job.status !== 'Proses'}>
                                        {job.status === 'Selesai' ? 'Selesai' : <><Play className="mr-2"/> Mulai</>}
                                    </Button>
                                </Card>
                            ))}
                             {availableJobs.filter(j => j.status === 'Proses').length === 0 && (
                                <div className="text-center text-muted-foreground py-10">Tidak ada pekerjaan bongkar yang sedang berjalan.</div>
                             )}
                        </CardContent>
                    </Card>
                ) : (
                    <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Dasbor: Bongkar {activeJob.material}</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <Card className="p-3"><CardDescription>Total Aktual</CardDescription><p className="text-2xl font-bold">{activeJob.totalVolume.toLocaleString()} M³</p></Card>
                            <Card className="p-3"><CardDescription>Ritasi Saya</CardDescription><p className="text-2xl font-bold">{ritasiSelesai}</p></Card>
                            <Card className="p-3"><CardDescription>Estimasi Sisa</CardDescription><p className="text-2xl font-bold">{estimasiSisaVolume.toLocaleString()} M³</p></Card>
                            <Card className="p-3"><CardDescription>Pakai BBM</CardDescription><p className="text-2xl font-bold">{pemakaianBBM} L</p></Card>
                        </CardContent>
                    </Card>

                    <Card className="text-center">
                        <CardHeader><CardTitle className="flex items-center justify-center gap-3 text-2xl">{currentStep !== 'idle' ? <Flag /> : <Star/>} {title}</CardTitle>
                            {currentTripLog.departFromBp && <CardDescription>Trip #{currentTripLog.tripNumber} | Mulai: {formatTime(currentTripLog.departFromBp)}</CardDescription>}
                        </CardHeader>
                        <CardContent>
                             <Button
                                className={cn(
                                    "w-full py-8 text-xl font-bold tracking-widest",
                                    currentStep === 'idle' && "bg-green-600 hover:bg-green-700"
                                )}
                                onClick={handleActionClick}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className='mr-2 h-6 w-6 animate-spin' /> : (buttonText)}
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                       <Button variant="destructive" onClick={handleJobStop}><CheckCircle className="mr-2"/>Selesai Bekerja</Button>
                    </div>

                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><History /> Riwayat Trip Hari Ini</CardTitle></CardHeader>
                        <CardContent>
                            <div className="border rounded-md overflow-x-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-muted z-10"><TableRow><TableHead className="w-12">Trip</TableHead><TableHead>Aktivitas</TableHead><TableHead className="text-right">Waktu Aktual</TableHead><TableHead className="text-right">Durasi</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {tripHistory.length > 0 ? (tripHistory.slice().reverse().map(trip => (
                                            <React.Fragment key={trip.tripNumber}>
                                                <TableRow className="bg-muted/50 hover:bg-muted/50"><TableCell className="font-bold align-top" rowSpan={6}>#{trip.tripNumber}</TableCell><TableCell colSpan={3} className='font-semibold'>{trip.material} ke {trip.destination}</TableCell></TableRow>
                                                <TableRow><TableCell>Berangkat dari BP (Kosong)</TableCell><TableCell className="text-right font-mono">{formatTime(trip.departFromBp)}</TableCell><TableCell rowSpan={1} className="text-right font-mono text-primary align-middle">{formatDuration(trip.departFromBp, trip.arriveAtDestination)}</TableCell></TableRow>
                                                <TableRow><TableCell>Tiba di {trip.destination.includes("Jetty") ? "Jetty" : "Dermaga"}</TableCell><TableCell className="text-right font-mono">{formatTime(trip.arriveAtDestination)}</TableCell><TableCell rowSpan={1} className="text-right font-mono text-destructive align-middle">{formatDuration(trip.arriveAtDestination, trip.startLoading)}</TableCell></TableRow>
                                                <TableRow><TableCell>Mulai - Selesai Muat</TableCell><TableCell className="text-right font-mono">{formatTime(trip.startLoading)} - {formatTime(trip.finishLoading)}</TableCell><TableCell className="text-right font-mono text-green-500">{formatDuration(trip.startLoading, trip.finishLoading)}</TableCell></TableRow>
                                                <TableRow><TableCell>Berangkat dari {trip.destination.includes("Jetty") ? "Jetty" : "Dermaga"} (Isi)</TableCell><TableCell className="text-right font-mono">{formatTime(trip.departFromDestination)}</TableCell><TableCell className="text-right font-mono text-primary">{formatDuration(trip.departFromDestination, trip.arriveAtBp)}</TableCell></TableRow>
                                                <TableRow className="border-b-2 border-primary/50"><TableCell>Tiba di BP (Siklus Selesai)</TableCell><TableCell className="text-right font-mono">{formatTime(trip.arriveAtBp)}</TableCell><TableCell className="text-right font-mono font-bold text-lg">{formatDuration(trip.departFromBp, trip.arriveAtBp)}</TableCell></TableRow>
                                            </React.Fragment>
                                        ))) : (<TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Belum ada trip yang diselesaikan untuk pekerjaan ini.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    </>
                )}
            </main>
        </div>
    );
}

    