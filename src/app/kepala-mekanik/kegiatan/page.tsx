
'use client';

import * as React from 'react';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Calendar as CalendarIcon, Clock, Loader2, PlusCircle, Camera } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { db, collection, addDoc, Timestamp, doc, updateDoc, getDoc, query, where, getDocs, limit, orderBy } from '@/lib/firebase';
import type { UserData, ActivityLog } from '@/lib/types';
import { resizeImage } from '@/lib/utils';

type PageStep = 'create' | 'capture_in_progress' | 'capture_completed' | 'loading';

const PhotoCaptureStep = ({ title, description, onCapture, isLoading }: { title: string, description: string, onCapture: (photo: string) => void, isLoading: boolean }) => {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photo, setPhoto] = useState<string | null>(null);

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

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                />
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full">
                    <Camera className="mr-2" />
                    Ambil Foto
                </Button>
                {photo && (
                    <div className="p-2 border rounded-md">
                        <img src={photo} alt="Pratinjau" className="rounded-md w-full" data-ai-hint="activity evidence" />
                    </div>
                )}
                <Button onClick={() => photo && onCapture(photo)} disabled={!photo || isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Kirim Foto
                </Button>
            </CardContent>
        </Card>
    );
};


function KegiatanClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState<Date | undefined>(new Date());
  const [targetTime, setTargetTime] = useState('');
  const [initialPhoto, setInitialPhoto] = useState<string | null>(null);

  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pageStep, setPageStep] = useState<PageStep>('loading');
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
   useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const userData = JSON.parse(userString);
      setUserInfo(userData);
      checkForOngoingActivity(userData.id);
    } else {
      router.push('/login');
    }
    setTargetTime(format(new Date(), 'HH:mm'));
  }, [router]);

  const checkForOngoingActivity = async (userId: string) => {
    const q = query(
      collection(db, 'kegiatan_harian'),
      where('userId', '==', userId),
      where('status', 'in', ['pending', 'in_progress']),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const ongoingActivity = querySnapshot.docs[0];
      const activityData = ongoingActivity.data() as ActivityLog;
      setCurrentActivityId(ongoingActivity.id);

      if (activityData.status === 'pending') {
        setPageStep('capture_in_progress');
      } else if (activityData.status === 'in_progress') {
        setPageStep('capture_completed');
      }
    } else {
      setPageStep('create');
    }
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const compressedImage = await resizeImage(file);
        setInitialPhoto(compressedImage);
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

  const handleInitialSubmit = async () => {
    if (!description) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Deskripsi kegiatan tidak boleh kosong.' });
        return;
    }
    if (!initialPhoto) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Foto awal kegiatan wajib disertakan.' });
        return;
    }
     if (!userInfo || !userInfo.id) {
        toast({ variant: 'destructive', title: 'Gagal', description: 'Data pengguna tidak ditemukan.' });
        return;
    }
    
    setIsSubmitting(true);
    
    const { hours, minutes } = targetTime ? 
        { hours: parseInt(targetTime.split(':')[0]), minutes: parseInt(targetTime.split(':')[1]) } :
        { hours: 0, minutes: 0 };
    
    const targetDateTime = targetDate ? new Date(targetDate) : new Date();
    targetDateTime.setHours(hours, minutes);

    const activityData: Omit<ActivityLog, 'id'> = {
        userId: userInfo.id,
        username: userInfo.username,
        description: description,
        targetTimestamp: Timestamp.fromDate(targetDateTime),
        createdAt: Timestamp.now(),
        status: 'pending',
        photoInitial: initialPhoto,
        timestampInProgress: null,
        timestampCompleted: null,
    };

    try {
        const docRef = await addDoc(collection(db, 'kegiatan_harian'), activityData);
        toast({
          title: 'Laporan Awal Terkirim',
          description: `Silakan lanjutkan dengan mengambil foto proses kegiatan.`,
        });
        setCurrentActivityId(docRef.id);
        setPageStep('capture_in_progress');
    } catch (error) {
        console.error("Error saving activity:", error);
        toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: 'Gagal menyimpan laporan awal.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handlePhotoSubmit = async (photo: string) => {
    if (!currentActivityId) return;
    setIsSubmitting(true);

    const docRef = doc(db, 'kegiatan_harian', currentActivityId);
    let updateData: Partial<ActivityLog> = {};
    let nextStep: PageStep | null = null;
    let successMessage = '';

    if (pageStep === 'capture_in_progress') {
        updateData.photoInProgress = photo;
        updateData.status = 'in_progress';
        updateData.timestampInProgress = Timestamp.now();
        nextStep = 'capture_completed';
        successMessage = 'Foto proses kegiatan berhasil dikirim.';
    } else if (pageStep === 'capture_completed') {
        updateData.photoCompleted = photo;
        updateData.status = 'completed';
        updateData.timestampCompleted = Timestamp.now();
        successMessage = 'Laporan kegiatan selesai!';
    }
    
    try {
        await updateDoc(docRef, updateData);
        toast({ title: 'Berhasil', description: successMessage });
        if (nextStep) {
            setPageStep(nextStep);
        } else {
            router.push('/sopir'); // Or back to history
        }
    } catch (error) {
        console.error("Error updating photo:", error);
        toast({ variant: 'destructive', title: 'Gagal Menyimpan Foto' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
    const handleBack = () => {
        if (pageStep === 'create') {
            router.back();
        } else {
            setPageStep('create');
            setCurrentActivityId(null);
            checkForOngoingActivity(userInfo!.id); // Re-check state
        }
    };


  if (pageStep === 'loading') {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin" />
        </div>
    );
  }


  if (pageStep === 'capture_in_progress') {
    return (
        <div className="min-h-screen w-full max-w-md mx-auto flex flex-col p-4 justify-center">
            <PhotoCaptureStep
                title="Langkah 2: Foto Proses Kegiatan"
                description="Ambil foto saat kegiatan sedang berlangsung sebagai bukti."
                onCapture={handlePhotoSubmit}
                isLoading={isSubmitting}
            />
        </div>
    );
  }

  if (pageStep === 'capture_completed') {
    return (
        <div className="min-h-screen w-full max-w-md mx-auto flex flex-col p-4 justify-center">
            <PhotoCaptureStep
                title="Langkah 3: Foto Kegiatan Selesai"
                description="Ambil foto setelah kegiatan selesai untuk menyelesaikan laporan."
                onCapture={handlePhotoSubmit}
                isLoading={isSubmitting}
            />
        </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-background text-foreground p-4">
      <header className="flex items-center gap-4 py-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-bold">Laporan Kegiatan Harian</h1>
      </header>

      <main className="flex-1 overflow-y-auto space-y-4 pb-4">
          <Card>
            <CardHeader>
                <CardTitle className='flex items-center gap-3'>
                    Langkah 1: Buat Laporan Awal
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Jelaskan kegiatan Anda di sini..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
              />
              <div>
                <Label className="font-semibold">Target Waktu Selesai</Label>
                <div className="flex gap-2 mt-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {targetDate ? format(targetDate, 'PPP', { locale: localeID }) : <span>Pilih tanggal</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={targetDate}
                        onSelect={setTargetDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                   <div className="relative flex-none">
                     <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input
                        type="time"
                        value={targetTime}
                        onChange={(e) => setTargetTime(e.target.value)}
                        className="pl-9"
                     />
                   </div>
                </div>
              </div>
              <div>
                <Label>Foto Awal (Wajib)</Label>
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                />
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full mt-2">
                    <Camera className="mr-2" />
                    Ambil Foto
                </Button>
                {initialPhoto && (
                    <div className="mt-2 p-2 border rounded-md">
                        <img src={initialPhoto} alt="Pratinjau Foto Awal" className="rounded-md w-full" data-ai-hint="activity evidence" />
                    </div>
                )}
              </div>
              <Button onClick={handleInitialSubmit} className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Kirim & Lanjutkan
              </Button>
            </CardContent>
          </Card>
      </main>
    </div>
  );
}

export default function KegiatanPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>}>
      <KegiatanClient />
    </Suspense>
  )
}
