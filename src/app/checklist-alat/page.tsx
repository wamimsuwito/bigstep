
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Camera, Loader2, Send, Truck } from 'lucide-react';
import type { UserData, SopirBatanganData, Report, MechanicTask } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { db, collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp, doc, updateDoc } from '@/lib/firebase';
import { resizeImage } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

type ChecklistStatus = 'baik' | 'perlu perhatian' | 'rusak';

export default function ChecklistAlatPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [assignedAlat, setAssignedAlat] = useState<SopirBatanganData | null>(null);
  const [lastReport, setLastReport] = useState<Report | null>(null);
  
  const [overallStatus, setOverallStatus] = useState<ChecklistStatus | null>(null);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isConfirmingGood, setIsConfirmingGood] = useState(false);
  const [isChoosingRepairer, setIsChoosingRepairer] = useState(false);
  
  const [mechanicsInLocation, setMechanicsInLocation] = useState<UserData[]>([]);
  const [isChoosingMechanic, setIsChoosingMechanic] = useState(false);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      const userString = localStorage.getItem('user');
      if (!userString) {
        toast({ variant: 'destructive', title: 'Sesi Tidak Valid', description: 'Silakan login kembali.' });
        router.push('/login');
        return;
      }
      
      const userData: UserData = JSON.parse(userString);
      setUserInfo(userData);

      if (!userData || !userData.id) {
          toast({ variant: 'destructive', title: 'Sesi Tidak Valid', description: 'ID Pengguna tidak ditemukan. Silakan login kembali.' });
          router.push('/login');
          return;
      }
      
      try {
        const pairingQuery = query(collection(db, "sopir_batangan"), where("userId", "==", userData.id), limit(1));
        const pairingSnapshot = await getDocs(pairingQuery);

        if (pairingSnapshot.empty) {
            toast({ variant: 'destructive', title: 'Kendaraan Tidak Ditemukan', description: 'Anda belum dipasangkan dengan kendaraan. Hubungi Kepala Workshop.', duration: 5000 });
            router.back();
            return;
        }
        
        const pairingDoc = pairingSnapshot.docs[0];
        const pairingData = { id: pairingDoc.id, ...pairingDoc.data() } as SopirBatanganData;
        setAssignedAlat(pairingData);
        
        // Fetch last report for the vehicle
        const reportQuery = query(
            collection(db, 'checklist_reports'), 
            where("nomorLambung", "==", pairingData.nomorLambung),
            orderBy("timestamp", "desc"),
            limit(1)
        );
        const reportSnapshot = await getDocs(reportQuery);
        if (!reportSnapshot.empty) {
            const reportDoc = reportSnapshot.docs[0];
            const data = reportDoc.data();
            const finalReport: Report = {
                id: reportDoc.id,
                ...data,
                timestamp: data.timestamp.toDate(), 
            } as Report;
            setLastReport(finalReport);
        }

        // Fetch mechanics in the same location
        if (userData.lokasi) {
          const usersQuery = query(collection(db, 'users'), where('lokasi', '==', userData.lokasi));
          const usersSnapshot = await getDocs(usersQuery);
          const allUsers = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as UserData);
          const mechanics = allUsers.filter(u => u.jabatan?.toUpperCase().includes('MEKANIK'));
          setMechanicsInLocation(mechanics);
        }

      } catch (error) {
          console.error("Error fetching initial data:", error);
          toast({ variant: 'destructive', title: 'Gagal Memuat Data', description: 'Tidak bisa mengambil data kendaraan atau laporan terakhir.' });
          router.back();
      } finally {
          setIsFetchingData(false);
      }
    };
    
    fetchInitialData();
  }, [router, toast]);

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

  const takePicture = () => {
    fileInputRef.current?.click();
  };

  const prepareSubmit = () => {
    if (!overallStatus) {
        toast({ variant: 'destructive', title: 'Kondisi Umum Belum Dipilih' });
        return;
    }
     if (!userInfo || !assignedAlat) {
        toast({ variant: 'destructive', title: 'Data Tidak Lengkap', description: 'Data pengguna atau kendaraan tidak valid. Silakan muat ulang halaman.' });
        return;
    }
    
    if (lastReport && (lastReport.overallStatus === 'rusak' || lastReport.overallStatus === 'perlu perhatian') && overallStatus === 'baik') {
        setIsConfirmingGood(true);
    } else {
        executeSubmit();
    }
  };

  const handleConfirmGood = (confirmed: boolean) => {
    setIsConfirmingGood(false);
    if (confirmed) {
        setIsChoosingRepairer(true);
    }
  };

  const handleChooseRepairer = (repairer: 'MEKANIK' | 'SENDIRI') => {
    setIsChoosingRepairer(false);
    if (repairer === 'MEKANIK') {
        setIsChoosingMechanic(true);
    } else {
        // "Dikerjakan Sendiri" flow
        handleRepairerChosen('SENDIRI');
    }
  };

  const handleMechanicSelected = () => {
    if (!selectedMechanicId) {
        toast({ variant: 'destructive', title: 'Mekanik belum dipilih.' });
        return;
    }
    const mechanic = mechanicsInLocation.find(m => m.id === selectedMechanicId);
    setIsChoosingMechanic(false);
    handleRepairerChosen(mechanic?.username || 'MEKANIK');
  }

  const handleRepairerChosen = async (repairedBy: string) => {
      if (repairedBy === 'SENDIRI') {
          await createAutomaticWorkOrder();
      }
      await executeSubmit(repairedBy);
  }

  const createAutomaticWorkOrder = async () => {
    if (!assignedAlat || !lastReport) return;
    
    const now = new Date();
    const newTaskData: Omit<MechanicTask, 'id'> = {
        status: 'COMPLETED',
        vehicle: {
            hullNumber: assignedAlat.nomorLambung,
            licensePlate: assignedAlat.nomorPolisi,
            repairDescription: lastReport.description || 'Kerusakan minor dilaporkan oleh operator.',
            targetDate: format(now, 'yyyy-MM-dd'),
            targetTime: format(now, 'HH:mm'),
            triggeringReportId: lastReport.id,
        },
        mechanics: [{ id: userInfo!.id, name: userInfo!.username }],
        createdAt: now.getTime(),
        startedAt: now.getTime(),
        completedAt: now.getTime(),
        riwayatTunda: [],
        totalDelayDuration: 0,
        mechanicRepairDescription: `Perbaikan dilakukan sendiri oleh operator: ${userInfo!.username}. Status kendaraan diubah menjadi "Baik".`,
    };

    try {
        await addDoc(collection(db, 'mechanic_tasks'), newTaskData);
        toast({
            title: 'Work Order Otomatis Dibuat',
            description: 'Pekerjaan perbaikan mandiri telah dicatat di sistem.',
        });
    } catch (error) {
        console.error('Failed to create automatic WO:', error);
        toast({ title: 'Gagal Mencatat Perbaikan', variant: 'destructive' });
    }
};


  const executeSubmit = async (repairedBy?: string) => {
    if (!assignedAlat || !userInfo || !overallStatus) {
        toast({ variant: 'destructive', title: 'Data Tidak Lengkap', description: 'Gagal mengirim karena data pengguna atau kendaraan tidak lengkap. Muat ulang halaman.' }); 
        return;
    }
    setIsSubmitting(true);

    // Check if there is an existing 'rusak' or 'perlu perhatian' report for this vehicle
    const q = query(
      collection(db, 'checklist_reports'),
      where('nomorLambung', '==', assignedAlat.nomorLambung),
      where('overallStatus', 'in', ['rusak', 'perlu perhatian']),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const existingReports = await getDocs(q);
    const activeDamageReportDoc = !existingReports.empty ? existingReports.docs[0] : null;

    if (activeDamageReportDoc && (overallStatus === 'rusak' || overallStatus === 'perlu perhatian')) {
      // --- UPDATE EXISTING REPORT ---
      const reportToUpdate = doc(db, 'checklist_reports', activeDamageReportDoc.id);
      const currentData = activeDamageReportDoc.data() as Report;
      const newDescription = description ? `${currentData.description || ''} | ${description}` : currentData.description;
      
      let newPhotos = Array.isArray(currentData.photo) ? currentData.photo : (currentData.photo ? [currentData.photo] : []);
      if(photo) newPhotos.push(photo);

      await updateDoc(reportToUpdate, {
        description: newDescription,
        photo: newPhotos,
        timestamp: Timestamp.now(), // Update timestamp to show it's recent
        operatorName: userInfo.username, // Update to the latest reporter
        operatorId: userInfo.id,
      });

      toast({ title: 'Laporan Kerusakan Diperbarui', description: 'Informasi kerusakan baru telah ditambahkan ke laporan yang sudah ada.' });
      router.back();

    } else {
      // --- CREATE NEW REPORT ---
      const reportData: Omit<Report, 'id'> = {
          timestamp: Timestamp.now(),
          nomorLambung: assignedAlat.nomorLambung,
          operatorName: userInfo.username,
          operatorId: userInfo.id,
          location: assignedAlat.lokasi,
          overallStatus: overallStatus,
          description: description || '',
          photo: photo ? [photo] : [], // Save as an array from the start
      };

      if (repairedBy) {
        reportData.repairedBy = repairedBy;
      }
      
      try {
          await addDoc(collection(db, 'checklist_reports'), reportData);
          toast({ title: 'Checklist Terkirim', description: 'Laporan checklist alat berhasil dikirim.' });
          router.back();
      } catch (error) {
          console.error("Error submitting checklist:", error);
          toast({ variant: 'destructive', title: 'Gagal Mengirim', description: 'Terjadi kesalahan saat menyimpan laporan ke database.' });
      }
    }

    setIsSubmitting(false);
  };

  const isSubmitDisabled = isFetchingData || isSubmitting || !overallStatus;

  return (
    <>
      <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-background text-foreground p-4">
        <header className="flex items-center gap-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <h1 className="text-xl font-bold">Checklist Alat</h1>
        </header>

        {isFetchingData ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary h-12 w-12" />
          </div>
        ) : (
          <>
            <main className="flex-1 overflow-y-auto space-y-6 pb-4">
              <Card>
                <CardHeader><CardTitle>Alat yang Ditugaskan</CardTitle></CardHeader>
                <CardContent>
                  {assignedAlat ? (
                    <div className="flex items-center gap-4 p-4 rounded-md bg-muted/50 border">
                      <Truck className="h-10 w-10 text-primary" />
                      <div>
                        <p className="font-bold text-lg">{assignedAlat.nomorLambung}</p>
                        <p className="text-sm text-muted-foreground">{assignedAlat.nomorPolisi}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-destructive text-center p-4">Anda belum dipasangkan dengan kendaraan.</p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader><CardTitle>Status Kendaraan</CardTitle><CardDescription>Laporkan kondisi umum kendaraan.</CardDescription></CardHeader>
                <CardContent>
                  <div className="p-3 border rounded-lg">
                    <Label className="font-semibold">Kondisi Umum</Label>
                    <RadioGroup value={overallStatus || ''} onValueChange={(value: ChecklistStatus) => setOverallStatus(value)} className="grid grid-cols-3 gap-2 mt-2">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="baik" id="umum-baik" /><Label htmlFor="umum-baik">Baik</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="rusak" id="umum-rusak" /><Label htmlFor="umum-rusak">Rusak</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="perlu perhatian" id="umum-perhatian" /><Label htmlFor="umum-perhatian" className="whitespace-nowrap">Perlu Perhatian</Label></div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Detail Kerusakan / Perbaikan</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="description">Deskripsi</Label>
                    <Textarea 
                        id="description" 
                        placeholder="Jika rusak, jelaskan kerusakannya. Jika melaporkan perbaikan, jelaskan perbaikan yang dilakukan..." 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Foto</Label>
                    <div className="mt-2 space-y-4">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*"
                        capture="environment"
                      />
                      <Button onClick={takePicture} className="w-full">
                          <Camera className="mr-2" />
                          Ambil Foto
                      </Button>
                      {photo && (
                          <div className="p-2 border rounded-md">
                              <p className="text-sm font-medium mb-2">Pratinjau Foto:</p>
                              <img src={photo} alt="Pratinjau" className="rounded-md" data-ai-hint="machine part" />
                          </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </main>

            <footer className="py-4">
              <Button onClick={prepareSubmit} className="w-full text-lg py-6" disabled={isSubmitDisabled}>
                {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                Kirim Checklist
              </Button>
            </footer>
          </>
        )}
      </div>
      
      <AlertDialog open={isConfirmingGood} onOpenChange={setIsConfirmingGood}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Konfirmasi Status Perbaikan</AlertDialogTitle>
                  <AlertDialogDescription>Status alat sebelumnya adalah <span className='font-bold'>{lastReport?.overallStatus}</span>. Apakah Anda yakin alat sudah diperbaiki dan dalam kondisi baik sekarang?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogAction onClick={() => handleConfirmGood(false)} className="bg-destructive hover:bg-destructive/90">Belum</AlertDialogAction>
                  <AlertDialogAction onClick={() => handleConfirmGood(true)}>Sudah</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isChoosingRepairer} onOpenChange={setIsChoosingRepairer}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Atribusi Perbaikan</AlertDialogTitle>
                  <AlertDialogDescription>Siapa yang mengerjakan perbaikan pada alat ini?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="sm:justify-center gap-2">
                  <Button onClick={() => handleChooseRepairer('MEKANIK')} className="w-full sm:w-auto" variant="outline">Dikerjakan Mekanik</Button>
                  <Button onClick={() => handleChooseRepairer('SENDIRI')} className="w-full sm:w-auto">Dikerjakan Sendiri</Button>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isChoosingMechanic} onOpenChange={setIsChoosingMechanic}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Pilih Mekanik</AlertDialogTitle>
                  <AlertDialogDescription>Pilih mekanik yang melakukan perbaikan.</AlertDialogDescription>
              </AlertDialogHeader>
               <div className="py-4">
                 <Select onValueChange={setSelectedMechanicId} value={selectedMechanicId}>
                    <SelectTrigger><SelectValue placeholder="Pilih nama mekanik..." /></SelectTrigger>
                    <SelectContent>
                        {mechanicsInLocation.map(m => <SelectItem key={m.id} value={m.id}>{m.username}</SelectItem>)}
                    </SelectContent>
                 </Select>
               </div>
              <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleMechanicSelected}>Konfirmasi</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
