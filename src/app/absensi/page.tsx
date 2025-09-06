
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, MapPin, Camera, Loader2, Building, CheckCircle, XCircle, Briefcase, LocateFixed, AlertTriangle, Clock, Activity, FileText } from 'lucide-react';
import { db, collection, addDoc, Timestamp, doc, updateDoc, getDocs, query, where, limit, orderBy } from '@/lib/firebase';
import type { UserData, LocationData, AttendanceRecord, OvertimeRecord } from '@/lib/types';
import { getDistance, resizeImage, cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, differenceInMinutes, startOfDay, isSameDay, subDays, endOfDay } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';

type AttendanceMode = 'Di Lokasi' | 'Dinas Luar';
const MAX_DISTANCE_ONSITE_METERS = 20;
const CHECK_IN_DEADLINE = { hours: 7, minutes: 30 };


const StatCard = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-muted/50 p-2 rounded-md text-center">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-lg font-bold font-mono">{value}</p>
    </div>
);

// --- Component untuk Absensi Reguler ---
function RegularAttendanceTab({ userInfo }: { userInfo: UserData }) {
    const { toast } = useToast();
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
    const [attendanceMode, setAttendanceMode] = useState<AttendanceMode>('Di Lokasi');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null | undefined>(undefined); // undefined to indicate loading
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    const getLocation = useCallback(() => {
        setLocationError(null);
        if (!navigator.geolocation) {
            setLocationError("Geolocation tidak didukung oleh browser Anda.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserCoords({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            () => {
                setLocationError("Gagal mendapatkan lokasi. Pastikan izin lokasi diberikan.");
            }
        );
    }, []);
    
    useEffect(() => {
        if (!userInfo) return;

        const fetchInitialData = async () => {
             // Fetch locations once
            try {
                const locationsSnap = await getDocs(collection(db, 'locations'));
                const locsData = locationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LocationData));
                setLocations(locsData);
                if (userInfo.lokasi) {
                    const userLocation = locsData.find(l => l.name === userInfo.lokasi);
                    if (userLocation) setSelectedLocation(userLocation);
                }
            } catch (error) {
                 console.error("Failed to load locations:", error);
                 toast({ title: "Gagal memuat daftar lokasi.", variant: 'destructive' });
            }

            // Fetch today's record by getting all records for the user and filtering client-side
            try {
                const q = query(collection(db, 'absensi'), where('userId', '==', userInfo.id));
                const userRecordsSnapshot = await getDocs(q);
                
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const foundRecord = userRecordsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord))
                    .find(rec => rec.checkInTime && format(rec.checkInTime.toDate(), 'yyyy-MM-dd') === todayStr);

                setTodayRecord(foundRecord || null);

            } catch (error) {
                console.error("Failed to load today's attendance data:", error);
                setTodayRecord(null); // Set to null on error to allow check-in
                toast({ title: "Gagal memuat data absensi hari ini.", description: 'Silakan coba muat ulang halaman.', variant: 'destructive' });
            }
        };

        fetchInitialData();
    }, [userInfo, toast]);
    
    useEffect(() => {
        if (selectedLocation) {
            getLocation();
        }
    }, [selectedLocation, getLocation]);

    useEffect(() => {
        if (!selectedLocation || !userCoords) { setDistance(null); return; }
        if (attendanceMode === 'Dinas Luar') {
            setDistance(0); // Set a dummy distance for Dinas Luar to pass validation
            return;
        }
        if (!selectedLocation.coordinates?.latitude || !selectedLocation.coordinates?.longitude) {
            setLocationError('Lokasi BP tidak memiliki data koordinat.');
            setDistance(null);
            return;
        }
        const dist = getDistance(userCoords.latitude, userCoords.longitude, selectedLocation.coordinates.latitude, selectedLocation.coordinates.longitude);
        setDistance(dist);
    }, [selectedLocation, userCoords, attendanceMode]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
          try {
            const compressedImage = await resizeImage(file);
            setPhoto(compressedImage);
          } catch (err) {
            console.error(err);
            toast({
              variant: "destructive",
              title: "Gagal memproses gambar",
              description: "Silakan coba unggah gambar lain.",
            });
          }
        }
    };

    const getAbsenStatus = (): 'masuk' | 'pulang' | 'selesai' | 'loading' => {
        if (todayRecord === undefined) return 'loading'; // Data is still loading
        if (!todayRecord) return 'masuk'; // No record today, can check in
        if (todayRecord.checkInTime && !todayRecord.checkOutTime) return 'pulang'; // Checked in, can check out
        if (todayRecord.checkInTime && todayRecord.checkOutTime) return 'selesai'; // All done for today
        return 'masuk'; // Default case
    };
    
    const absenStatus = getAbsenStatus();
    const canCheckIn = useMemo(() => absenStatus === 'masuk' && currentTime.getHours() >= 6, [currentTime, absenStatus]);

    const isValidationOk = useMemo(() => {
        if (distance === null) return false;
        if (attendanceMode === 'Dinas Luar') return true;
        return distance <= MAX_DISTANCE_ONSITE_METERS;
    }, [distance, attendanceMode]);

    const isAbsenAllowed = useMemo(() => {
        if (!photo || distance === null || absenStatus === 'selesai' || absenStatus === 'loading') return false;
        if (absenStatus === 'masuk' && !canCheckIn) return false;
        return isValidationOk;
    }, [photo, distance, absenStatus, canCheckIn, isValidationOk]);


    const handleAbsen = async () => {
        if (!isAbsenAllowed || !userInfo || !selectedLocation) return;
        setIsSubmitting(true);
        const now = Timestamp.now();
        
        try {
            if (absenStatus === 'masuk') {
                const newRecord = {
                    userId: userInfo.id,
                    username: userInfo.username,
                    checkInTime: now,
                    checkInLocationId: selectedLocation.id,
                    checkInLocationName: selectedLocation.name,
                    checkInPhoto: photo,
                    checkInDistance: distance,
                    checkInMode: attendanceMode,
                    checkOutTime: null,
                };
                const docRef = await addDoc(collection(db, 'absensi'), newRecord);
                setTodayRecord({ ...newRecord, id: docRef.id });
                toast({ title: 'Absen Masuk Berhasil', description: `Selamat bekerja, ${userInfo.username}!` });
            } else if (absenStatus === 'pulang' && todayRecord) {
                const recordRef = doc(db, 'absensi', todayRecord.id);
                const updateData = {
                    checkOutTime: now,
                    checkOutLocationId: selectedLocation.id,
                    checkOutLocationName: selectedLocation.name,
                    checkOutPhoto: photo,
                    checkOutDistance: distance,
                    checkOutMode: attendanceMode,
                };
                await updateDoc(recordRef, updateData);
                setTodayRecord({ ...todayRecord, ...updateData });
                toast({ title: 'Absen Pulang Berhasil', description: 'Selamat beristirahat!' });
            }
        } catch(error) {
             toast({ title: 'Gagal melakukan absensi', variant: 'destructive', description: "Terjadi kesalahan saat menyimpan data." });
        } finally {
            setIsSubmitting(false);
            setPhoto(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const checkInTime = todayRecord?.checkInTime?.toDate ? todayRecord.checkInTime.toDate() : null;
    const checkOutTime = todayRecord?.checkOutTime?.toDate ? todayRecord.checkOutTime.toDate() : null;
    
    const lateMinutes = useMemo(() => {
        if (!checkInTime) return 0;
        const deadline = new Date(checkInTime);
        deadline.setHours(CHECK_IN_DEADLINE.hours, CHECK_IN_DEADLINE.minutes, 0, 0);
        return Math.max(0, differenceInMinutes(checkInTime, deadline));
    }, [checkInTime]);
    
    if (absenStatus === 'loading') {
        return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
    }

    return (
        <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-3 gap-2">
                <StatCard label="Absen Masuk" value={checkInTime ? format(checkInTime, 'HH:mm') : '--:--'} />
                <StatCard label="Absen Pulang" value={checkOutTime ? format(checkOutTime, 'HH:mm') : '--:--'} />
                <StatCard label="Terlambat" value={lateMinutes > 0 ? `${lateMinutes} mnt` : '0 mnt'} />
            </div>
            
            <Select value={selectedLocation?.id || ''} onValueChange={(val) => setSelectedLocation(locations.find(l => l.id === val) || null)} disabled={absenStatus === 'selesai'}>
                <SelectTrigger><SelectValue placeholder="Pilih Lokasi BP..." /></SelectTrigger>
                <SelectContent>{locations.map(loc => <SelectItem key={loc.id} value={loc.id}><Building size={14} className="inline-block mr-2"/>{loc.name}</SelectItem>)}</SelectContent>
            </Select>
            
            <div className="flex items-center justify-between pt-2">
                <Label htmlFor="attendance-mode" className="flex items-center gap-2"><Briefcase size={16}/> Mode Absensi</Label>
                <div className="flex items-center space-x-2">
                    <Label htmlFor="attendance-mode" className="text-sm">Di Lokasi</Label>
                    <Switch id="attendance-mode" checked={attendanceMode === 'Dinas Luar'} onCheckedChange={(checked) => setAttendanceMode(checked ? 'Dinas Luar' : 'Di Lokasi')} disabled={absenStatus === 'selesai'} />
                    <Label htmlFor="attendance-mode" className="text-sm">Dinas Luar</Label>
                </div>
            </div>
             {attendanceMode === 'Dinas Luar' && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Perhatian!</AlertTitle><AlertDescription>Pastikan Anda mempunyai SPK untuk dinas luar. Akan ada sanksi jika Anda tidak memenuhi kriteria dinas luar namun tetap menggunakan fitur ini.</AlertDescription></Alert>}
            
            <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={getLocation} disabled={!selectedLocation || absenStatus === 'selesai'}><LocateFixed className="mr-2"/>Dapatkan Posisi Saya</Button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />
                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={absenStatus === 'selesai'}><Camera className="mr-2"/>Ambil Foto Selfie</Button>
                {photo && <div className="p-2 border rounded-md"><img src={photo} alt="Pratinjau" className="rounded-md w-full" data-ai-hint="selfie employee"/></div>}
            </div>

            <div className="p-3 bg-muted rounded-lg text-center space-y-1">
                <p className="text-sm font-semibold">Validasi Jarak</p>
                {distance !== null ? <div className={cn("text-lg font-bold", isValidationOk ? 'text-green-500' : 'text-red-500')}>{isValidationOk ? <CheckCircle className="inline-block mr-2"/> : <XCircle className="inline-block mr-2"/>}{attendanceMode === 'Di Lokasi' ? (distance < 1000 ? `${distance.toFixed(0)} meter` : `${(distance/1000).toFixed(2)} km`) : 'OK'}</div> : <p className="text-sm text-muted-foreground">{locationError || "Klik 'Dapatkan Posisi Saya'"}</p>}
                <p className="text-xs text-muted-foreground">{attendanceMode === 'Di Lokasi' ? `(Maksimal ${MAX_DISTANCE_ONSITE_METERS} meter)` : `(Mode Dinas Luar)`}</p>
            </div>

            <Button onClick={handleAbsen} className="w-full text-lg py-6" disabled={!isAbsenAllowed || isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 animate-spin"/> : <Send className="mr-2"/>}
                {absenStatus === 'masuk' ? 'Absen Masuk' : absenStatus === 'pulang' ? 'Absen Pulang' : 'Selesai'}
            </Button>
            {absenStatus === 'selesai' && <Alert className="text-center bg-green-500/10 border-green-500/20 text-green-700"><CheckCircle className="h-4 w-4" /><AlertTitle>Selesai</AlertTitle><AlertDescription>Anda sudah melakukan absensi hari ini, silakan kembali lagi besok.</AlertDescription></Alert>}
            {!canCheckIn && absenStatus === 'masuk' && <Alert variant="default" className="text-center"><Clock className="h-4 w-4 inline-block mr-2" />Absen masuk dapat dilakukan mulai jam 06:00.</Alert>}
        </CardContent>
    );
}

// --- Component untuk Absensi Lembur ---
function OvertimeAttendanceTab({ userInfo }: { userInfo: UserData }) {
    const { toast } = useToast();
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [todayRecord, setTodayRecord] = useState<OvertimeRecord | null | undefined>(undefined);
    const [description, setDescription] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const canCheckInOvertime = useMemo(() => {
        const currentHour = currentTime.getHours();
        return currentHour >= 21 || currentHour < 4;
    }, [currentTime]);

    const getLocation = useCallback(() => {
        setLocationError(null);
        if (!navigator.geolocation) {
            setLocationError("Geolocation tidak didukung oleh browser Anda.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserCoords({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            () => {
                setLocationError("Gagal mendapatkan lokasi. Pastikan izin lokasi diberikan.");
            }
        );
    }, []);

    useEffect(() => {
        if (!userInfo) return;
        const fetchPrerequisites = async () => {
             try {
                const locationsSnap = await getDocs(collection(db, 'locations'));
                const locsData = locationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as LocationData));
                setLocations(locsData);
                if (userInfo.lokasi) setSelectedLocation(locsData.find(l => l.name === userInfo.lokasi) || null);
            } catch (error) {
                 console.error("Failed to load locations for overtime:", error);
                 toast({ title: "Gagal memuat daftar lokasi.", variant: 'destructive' });
            }
            
            try {
                const q = query(collection(db, 'overtime_absensi'), where('userId', '==', userInfo.id));
                const userRecordsSnapshot = await getDocs(q);
                
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const foundRecord = userRecordsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as OvertimeRecord))
                    .find(rec => rec.checkInTime && format(rec.checkInTime.toDate(), 'yyyy-MM-dd') === todayStr);

                setTodayRecord(foundRecord || null);

            } catch (error) { 
                console.error("Failed to load overtime data:", error);
                setTodayRecord(null);
                toast({ title: "Gagal memuat data lembur.", variant: 'destructive' }); 
            }
        };
        fetchPrerequisites();
    }, [userInfo, toast]);
    
    useEffect(() => {
        if (selectedLocation) {
            getLocation();
        }
    }, [selectedLocation, getLocation]);

    useEffect(() => {
        if (!selectedLocation || !userCoords) { setDistance(null); return; }
        if (!selectedLocation.coordinates?.latitude || !selectedLocation.coordinates?.longitude) {
            setLocationError('Lokasi BP tidak memiliki data koordinat.');
            setDistance(null);
            return;
        }
        const dist = getDistance(userCoords.latitude, userCoords.longitude, selectedLocation.coordinates.latitude, selectedLocation.coordinates.longitude);
        setDistance(dist);
    }, [selectedLocation, userCoords]);
    

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
          try {
            const compressedImage = await resizeImage(file);
            setPhoto(compressedImage);
          } catch (err) {
            console.error(err);
            toast({
              variant: "destructive",
              title: "Gagal memproses gambar",
              description: "Silakan coba unggah gambar lain.",
            });
          }
        }
    };

    const getStatus = (): 'masuk' | 'pulang' | 'selesai' | 'loading' => {
        if (todayRecord === undefined) return 'loading';
        if (!todayRecord) return 'masuk';
        if (todayRecord.checkInTime && !todayRecord.checkOutTime) return 'pulang';
        return 'selesai';
    };
    const status = getStatus();

    const isValidationOk = useMemo(() => {
        if (distance === null) return false;
        return distance <= MAX_DISTANCE_ONSITE_METERS;
    }, [distance]);

    const isActionAllowed = useMemo(() => {
        if (status === 'selesai' || status === 'loading') return false;
        if (status === 'masuk' && (!canCheckInOvertime || !description || !photo || !selectedLocation)) return false;
        if (status === 'pulang' && (!photo || !selectedLocation)) return false;
        return isValidationOk;
    }, [status, canCheckInOvertime, description, photo, selectedLocation, isValidationOk]);
    
    const handleOvertimeAbsen = async () => {
        if (!isActionAllowed || !userInfo || !selectedLocation) return;
        setIsSubmitting(true);
        const now = Timestamp.now();
        
        try {
            if (status === 'masuk') {
                const newRecord = {
                    userId: userInfo.id,
                    username: userInfo.username,
                    description,
                    overtimeDate: now,
                    checkInTime: now,
                    checkInLocationId: selectedLocation.id,
                    checkInLocationName: selectedLocation.name,
                    checkInPhoto: photo,
                    checkInDistance: distance,
                    checkOutTime: null,
                };
                const docRef = await addDoc(collection(db, 'overtime_absensi'), newRecord);
                setTodayRecord({ ...newRecord, id: docRef.id });
                toast({ title: 'Absen Masuk Lembur Berhasil' });
            } else if (status === 'pulang' && todayRecord) {
                const recordRef = doc(db, 'overtime_absensi', todayRecord.id);
                const updateData = {
                    checkOutTime: now,
                    checkOutLocationId: selectedLocation.id,
                    checkOutLocationName: selectedLocation.name,
                    checkOutPhoto: photo,
                    checkOutDistance: distance,
                };
                await updateDoc(recordRef, updateData);
                setTodayRecord({ ...todayRecord, ...updateData });
                toast({ title: 'Absen Pulang Lembur Berhasil' });
            }
        } catch(error) {
             toast({ title: 'Gagal melakukan absensi lembur', variant: 'destructive', description: "Terjadi kesalahan saat menyimpan data." });
        } finally {
            setIsSubmitting(false);
            setPhoto(null);
        }
    };
    
    if (status === 'loading') {
        return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>;
    }

    return (
        <CardContent className="space-y-4 pt-6">
            <Textarea placeholder="Tuliskan detail kegiatan lembur Anda di sini..." value={description} onChange={e => setDescription(e.target.value)} disabled={status !== 'masuk'}/>
            <Select value={selectedLocation?.id || ''} onValueChange={(val) => setSelectedLocation(locations.find(l => l.id === val) || null)} disabled={status === 'selesai'}>
                <SelectTrigger><SelectValue placeholder="Pilih Lokasi BP..." /></SelectTrigger>
                <SelectContent>{locations.map(loc => <SelectItem key={loc.id} value={loc.id}><Building size={14} className="inline-block mr-2"/>{loc.name}</SelectItem>)}</SelectContent>
            </Select>
             <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={getLocation} disabled={status === 'selesai'}><LocateFixed className="mr-2"/>Dapatkan Posisi Saya</Button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" capture="environment" />
                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={status === 'selesai'}><Camera className="mr-2"/>Ambil Foto Selfie</Button>
                {photo && <div className="p-2 border rounded-md"><img src={photo} alt="Pratinjau" className="rounded-md w-full" data-ai-hint="selfie employee"/></div>}
            </div>
            <div className="p-3 bg-muted rounded-lg text-center space-y-1">
                <p className="text-sm font-semibold">Validasi Jarak</p>
                {distance !== null ? <div className={cn("text-lg font-bold", isValidationOk ? 'text-green-500' : 'text-red-500')}>{isValidationOk ? <CheckCircle className="inline-block mr-2"/> : <XCircle className="inline-block mr-2"/>}{distance < 1000 ? `${distance.toFixed(0)} meter` : `${(distance/1000).toFixed(2)} km`}</div> : <p className="text-sm text-muted-foreground">{locationError || "Klik 'Dapatkan Posisi Saya'"}</p>}
            </div>
            <Button onClick={handleOvertimeAbsen} className="w-full text-lg py-6" disabled={!isActionAllowed || isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 animate-spin"/> : <Send className="mr-2"/>}
                {status === 'masuk' ? 'Absen Masuk Lembur' : 'Absen Pulang Lembur'}
            </Button>
            {status === 'selesai' && <Alert className="text-center bg-green-500/10 border-green-500/20 text-green-700"><CheckCircle className="h-4 w-4" /><AlertTitle>Selesai</AlertTitle><AlertDescription>Anda sudah menyelesaikan absensi lembur hari ini.</AlertDescription></Alert>}
            {!canCheckInOvertime && status === 'masuk' && <Alert variant="default" className="text-center"><Clock className="h-4 w-4 inline-block mr-2" />Absen lembur dapat dilakukan mulai jam 21:00 hingga 04:00.</Alert>}
        </CardContent>
    );
}

function AbsensiComponent() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      setUserInfo(JSON.parse(userString));
    } else {
      router.push('/login');
    }
    setIsLoading(false);
  }, [router]);
  
  if (isLoading || !userInfo) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-background text-foreground p-4">
      <header className="flex items-center gap-4 py-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
        <h1 className="text-xl font-bold">Absensi Kehadiran</h1>
      </header>

        <main className="flex-1 overflow-y-auto space-y-6 pb-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{userInfo?.username}</CardTitle>
                    <CardDescription>{userInfo?.nik} - {userInfo?.jabatan}</CardDescription>
                </CardHeader>
            </Card>

            <Tabs defaultValue="reguler" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="reguler"><Clock className="mr-2"/>Reguler</TabsTrigger>
                    <TabsTrigger value="lembur"><Activity className="mr-2"/>Lembur</TabsTrigger>
                </TabsList>
                <TabsContent value="reguler">
                    <Card><RegularAttendanceTab userInfo={userInfo} /></Card>
                </TabsContent>
                <TabsContent value="lembur">
                    <Card><OvertimeAttendanceTab userInfo={userInfo} /></Card>
                </TabsContent>
            </Tabs>
        </main>
    </div>
  );
}

export default function AbsensiPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>}>
            <AbsensiComponent />
        </Suspense>
    )
}
