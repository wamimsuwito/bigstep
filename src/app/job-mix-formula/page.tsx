
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Trash2, PlusCircle, Loader2, ArrowLeft, Weight } from 'lucide-react';
import type { JobMix as JobMixType } from '@/lib/types';
import { db, collection, getDocs, doc, addDoc, deleteDoc } from '@/lib/firebase';

interface JobMix extends JobMixType {
  id: string;
}

const materials = [
  { id: 'mutuBeton', label: 'MUTU BETON', type: 'text' },
  { id: 'pasir1', label: 'PASIR 1', type: 'number' },
  { id: 'pasir2', label: 'PASIR 2', type: 'number' },
  { id: 'batu1', label: 'BATU 1', type: 'number' },
  { id: 'batu2', label: 'BATU 2', type: 'number' },
  { id: 'semen', label: 'SEMEN', type: 'number' },
  { id: 'air', label: 'AIR', type: 'number' },
];


export default function JobMixFormulaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [jobMixes, setJobMixes] = useState<JobMix[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [formValues, setFormValues] = useState({
    mutuBeton: '',
    pasir1: '',
    pasir2: '',
    batu1: '',
    batu2: '',
    semen: '',
    air: '',
  });
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchJobMixes = async () => {
        setIsFetching(true);
        try {
            const jobmixesSnapshot = await getDocs(collection(db, 'jobmixes'));
            const mixesData = jobmixesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as JobMix[];
            setJobMixes(mixesData);
        } catch (error) {
            console.error("Failed to fetch job mixes:", error);
            toast({ variant: 'destructive', title: 'Gagal Memuat Data', description: 'Tidak dapat mengambil formula dari server.' });
        } finally {
            setIsFetching(false);
        }
    };
    fetchJobMixes();
  }, [toast]);

  const totalBerat = useMemo(() => {
    const pasir1 = parseFloat(formValues.pasir1) || 0;
    const pasir2 = parseFloat(formValues.pasir2) || 0;
    const batu1 = parseFloat(formValues.batu1) || 0;
    const batu2 = parseFloat(formValues.batu2) || 0;
    const semen = parseFloat(formValues.semen) || 0;
    const air = parseFloat(formValues.air) || 0;
    return pasir1 + pasir2 + batu1 + batu2 + semen + air;
  }, [formValues]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const processedValue = name === 'mutuBeton' ? value.toUpperCase() : value;
    setFormValues(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleAddJobMix = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    
    const newJobMixData: Omit<JobMix, 'id'> = {
      mutuBeton: formValues.mutuBeton.toUpperCase(),
      pasir1: parseFloat(formValues.pasir1) || 0,
      pasir2: parseFloat(formValues.pasir2) || 0,
      batu1: parseFloat(formValues.batu1) || 0,
      batu2: parseFloat(formValues.batu2) || 0,
      semen: parseFloat(formValues.semen) || 0,
      air: parseFloat(formValues.air) || 0,
    };
    
    try {
        const docRef = await addDoc(collection(db, 'jobmixes'), newJobMixData);
        setJobMixes(prev => [...prev, { ...newJobMixData, id: docRef.id }]);
        toast({ title: 'Formula Disimpan', description: `Job Mix untuk ${newJobMixData.mutuBeton} berhasil ditambahkan.` });
        setFormValues({ mutuBeton: '', pasir1: '', pasir2: '', batu1: '', batu2: '', semen: '', air: '' });
    } catch (error) {
        console.error("Error adding job mix:", error);
        toast({ variant: 'destructive', title: 'Gagal Menyimpan' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteRequest = (id: string, mutuBeton: string) => {
    setItemToDelete({ id, name: mutuBeton });
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
        await deleteDoc(doc(db, "jobmixes", itemToDelete.id));
        setJobMixes(prev => prev.filter(mix => mix.id !== itemToDelete.id));
        toast({ title: 'Formula Dihapus', description: `Job Mix untuk ${itemToDelete.name} telah dihapus.` });
    } catch (error) {
        console.error("Error deleting job mix:", error);
        toast({ variant: 'destructive', title: 'Gagal Menghapus' });
    } finally {
        setIsDeleteDialogOpen(false);
        setItemToDelete(null);
    }
  };

  return (
    <>
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Apakah Anda Yakin?</AlertDialogTitle>
                <AlertDialogDescription>
                    Tindakan ini tidak dapat diurungkan. Anda akan menghapus Job Mix untuk <strong>{itemToDelete?.name}</strong>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <div>
            <h1 className="text-2xl font-bold tracking-wider flex items-center gap-3"><FileText/>Manajemen Job Mix Formula</h1>
            <p className="text-muted-foreground">Buat dan kelola resep campuran beton.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <PlusCircle />
                Tambah Job Mix Baru
              </CardTitle>
              <CardDescription>Masukkan nilai target berat untuk setiap material dalam kg.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddJobMix} className="space-y-4">
                {materials.map(material => (
                  <div key={material.id} className="space-y-2">
                    <Label htmlFor={material.id} className="text-muted-foreground">{material.label}</Label>
                    <Input
                      id={material.id}
                      name={material.id}
                      type={material.type}
                      value={formValues[material.id as keyof typeof formValues]}
                      onChange={handleInputChange}
                      placeholder={`Target ${material.label}`}
                      required={material.id === 'mutuBeton'}
                      min={material.type === 'number' ? 0 : undefined}
                      style={material.type === 'text' ? { textTransform: 'uppercase' } : {}}
                    />
                  </div>
                ))}

                <div className="space-y-2 pt-2">
                  <Label htmlFor="totalBerat" className="text-muted-foreground flex items-center gap-2">
                    <Weight className="h-4 w-4" />
                    TOTAL BERAT
                  </Label>
                  <div 
                    id="totalBerat"
                    className="flex items-center justify-end h-12 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-base"
                  >
                    {totalBerat.toLocaleString('id-ID')} kg
                  </div>
                </div>

                <Button type="submit" className="w-full font-semibold tracking-wide !mt-6" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Formula'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Job Mix Formula</CardTitle>
              <CardDescription>Daftar semua resep yang tersimpan di sistem.</CardDescription>
            </CardHeader>
            <CardContent>
               {isFetching ? (
                 <div className="flex justify-center items-center h-48">
                   <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
               ) : (
                <div className="overflow-x-auto border rounded-md">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Mutu Beton</TableHead>
                            <TableHead className="text-right">Pasir 1 (kg)</TableHead>
                            <TableHead className="text-right">Pasir 2 (kg)</TableHead>
                            <TableHead className="text-right">Batu 1 (kg)</TableHead>
                            <TableHead className="text-right">Batu 2 (kg)</TableHead>
                            <TableHead className="text-right">Semen (kg)</TableHead>
                            <TableHead className="text-right">Air (kg)</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {jobMixes.map(mix => (
                            <TableRow key={mix.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{mix.mutuBeton}</TableCell>
                            <TableCell className="text-right">{mix.pasir1}</TableCell>
                            <TableCell className="text-right">{mix.pasir2}</TableCell>
                            <TableCell className="text-right">{mix.batu1}</TableCell>
                            <TableCell className="text-right">{mix.batu2}</TableCell>
                            <TableCell className="text-right">{mix.semen}</TableCell>
                            <TableCell className="text-right">{mix.air}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteRequest(mix.id, mix.mutuBeton)}>
                                <Trash2 className="h-4 w-4 text-red-500"/>
                                <span className="sr-only">Hapus</span>
                                </Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}

    