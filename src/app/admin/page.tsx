
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, LogOut, User, Lock, Briefcase, Fingerprint, MapPin, Trash2, Users, Construction, Pencil, X, Loader2, GitCompareArrows, LocateFixed, Save } from 'lucide-react';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarInset, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import type { UserData as AppUserData, LocationData as AppLocationData } from '@/lib/types';
import { db, collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from '@/lib/firebase';

interface UserData extends AppUserData {
  id: string;
}

interface AlatData {
    id: string;
    nomorLambung: string;
    nomorPolisi: string;
    jenisKendaraan: string;
    lokasi: string;
}

interface LocationData extends AppLocationData {
    id: string;
}

type ActiveMenu = 'pengguna' | 'alat' | 'lokasi' | 'sinkronisasi' | 'koordinat';

const jabatanOptions = [
    'OPRATOR BP', 'OPRATOR CP', 'OPRATOR LOADER', 'PEKERJA BONGKAR SEMEN', 'SOPIR', 'SOPIR DT', 'ADMIN BP', 'ADMIN LOGISTIK SPARE PART',
    'ADMIN LOGISTIK MATERIAL', 'SUPER ADMIN', 'QC', 'MARKETING', 'KEPALA MEKANIK', 'KEPALA WORKSHOP', 'OWNER', 'HRD PUSAT', 'HSE K3'
];

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [alat, setAlat] = useState<AlatData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('pengguna');
  const [selectedJabatan, setSelectedJabatan] = useState<string>('');
  const [selectedLokasi, setSelectedLokasi] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editingAlat, setEditingAlat] = useState<AlatData | null>(null);
  const [editingLocation, setEditingLocation] = useState<LocationData | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: 'user' | 'alat' | 'lokasi' } | null>(null);

  const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.push('/login');
      return;
    }
    const userData = JSON.parse(userString);
    if (userData.jabatan !== 'SUPER ADMIN') {
        toast({
            variant: 'destructive',
            title: 'Akses Ditolak',
            description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
        });
        router.push('/login');
        return;
    }
    setCurrentUser(userData);
  }, [router, toast]);
  
  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
        setIsFetching(true);
        try {
            const usersQuery = getDocs(collection(db, 'users'));
            const alatQuery = getDocs(collection(db, 'alat'));
            const locationsQuery = getDocs(collection(db, 'locations'));

            const [usersSnapshot, alatSnapshot, locationsSnapshot] = await Promise.all([usersQuery, alatQuery, locationsQuery]);

            setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserData[]);
            setAlat(alatSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AlatData[]);
            setLocations(locationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LocationData[]);

        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            toast({ variant: "destructive", title: "Gagal memuat data", description: "Tidak dapat mengambil data dari Firestore." });
        }
        setIsFetching(false);
    };
    fetchData();

  }, [currentUser, toast]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setCurrentUser(null);
    router.push('/login');
  };

  const handleAddUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    const newUser: Omit<UserData, 'id'> = {
      username: (formData.get('username') as string).toUpperCase(),
      password: formData.get('password') as string,
      nik: (formData.get('nik') as string).toUpperCase(),
      jabatan: selectedJabatan,
      lokasi: selectedLokasi,
      role: (formData.get('username') as string).toLowerCase() === 'admin' ? 'admin' : 'user',
    };
    
    try {
        const docRef = await addDoc(collection(db, 'users'), newUser);
        setUsers(prev => [...prev, { ...newUser, id: docRef.id }]);
        toast({ title: 'Pengguna Ditambahkan', description: `Pengguna ${newUser.username} berhasil dibuat.` });
        form.reset();
        setSelectedJabatan('');
        setSelectedLokasi('');
    } catch (error) {
        console.error("Error adding user:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menambahkan pengguna baru.' });
    }
    setIsLoading(false);
  };
  
  const handleEditUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;
    setIsLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    
    const updatedUserData: Partial<UserData> = {
      username: (formData.get('editUsername') as string).toUpperCase(),
      nik: (formData.get('editNik') as string).toUpperCase(),
      jabatan: formData.get('editJabatan') as string,
      lokasi: formData.get('editLokasi') as string,
    };
    const newPassword = formData.get('editPassword') as string;
    if (newPassword) {
      updatedUserData.password = newPassword;
    }
    
    try {
        const userDocRef = doc(db, 'users', editingUser.id);
        await updateDoc(userDocRef, updatedUserData);
        setUsers(prev => prev.map(user => user.id === editingUser.id ? { ...user, ...updatedUserData } : user));
        toast({ title: 'Pengguna Diperbarui', description: `Data untuk ${updatedUserData.username} berhasil diperbarui.` });
        setEditingUser(null);
    } catch (error) {
        console.error("Error updating user:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui data pengguna.' });
    }
    setIsLoading(false);
  }

  const handleDeleteRequest = (id: string, name: string, type: 'user' | 'alat' | 'lokasi') => {
    setItemToDelete({ id, name, type });
    setIsDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, type, name } = itemToDelete;

    try {
        if (type === 'alat') {
            await deleteDoc(doc(db, 'alat', id));
            setAlat(prev => prev.filter(item => item.id !== id));
        } else if (type === 'user') {
            await deleteDoc(doc(db, 'users', id));
            setUsers(prev => prev.filter(user => user.id !== id));
        } else if (type === 'lokasi') {
            await deleteDoc(doc(db, 'locations', id));
            setLocations(prev => prev.filter(item => item.id !== id));
        }
        toast({ title: 'Item Dihapus', description: `${type.charAt(0).toUpperCase() + type.slice(1)} ${name} telah dihapus.` });
    } catch (error) {
        console.error("Error deleting item:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menghapus item.' });
    }

    setIsDeleteDialogOpen(false);
    setItemToDelete(null);
  };
  
  const handleAddAlat = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const newAlatData = {
      nomorLambung: (formData.get('nomorLambung') as string).toUpperCase(),
      nomorPolisi: (formData.get('nomorPolisi') as string).toUpperCase(),
      jenisKendaraan: (formData.get('jenisKendaraan') as string).toUpperCase(),
      lokasi: (formData.get('lokasiAlat') as string),
    };
    
    try {
        const docRef = await addDoc(collection(db, 'alat'), newAlatData);
        setAlat(prev => [...prev, { ...newAlatData, id: docRef.id }]);
        toast({ title: 'Alat Ditambahkan', description: `Alat ${newAlatData.nomorLambung} berhasil dibuat.` });
        form.reset();
    } catch (error) {
        console.error("Error adding alat:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menambahkan alat.' });
    }
    setIsLoading(false);
  }

  const handleEditAlat = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAlat) return;
    setIsLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    
    const updatedAlatData = {
      nomorLambung: (formData.get('editNomorLambung') as string).toUpperCase(),
      nomorPolisi: (formData.get('editNomorPolisi') as string).toUpperCase(),
      jenisKendaraan: (formData.get('editJenisKendaraan') as string).toUpperCase(),
      lokasi: (formData.get('editLokasiAlat') as string),
    };

    try {
        const alatDocRef = doc(db, 'alat', editingAlat.id);
        await updateDoc(alatDocRef, updatedAlatData);
        setAlat(prev => prev.map(item => item.id === editingAlat.id ? { ...item, ...updatedAlatData } : item));
        toast({ title: 'Alat Diperbarui', description: `Data untuk ${updatedAlatData.nomorLambung} berhasil diperbarui.` });
        setEditingAlat(null);
    } catch (error) {
        console.error("Error updating alat:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui data alat.' });
    }
    setIsLoading(false);
  }
  
   const handleAddLocation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const newLocationData: Partial<LocationData> = {
      name: (formData.get('locationName') as string).toUpperCase(),
      details: (formData.get('locationDetails') as string).toUpperCase(),
      coordinates: { latitude: 0, longitude: 0 },
    };
    
    try {
        const docRef = await addDoc(collection(db, 'locations'), newLocationData);
        setLocations(prev => [...prev, { ...newLocationData, id: docRef.id } as LocationData]);
        toast({ title: 'Lokasi Ditambahkan', description: `Lokasi ${newLocationData.name} berhasil dibuat.` });
        form.reset();
    } catch (error) {
        console.error("Error adding location:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menambahkan lokasi.' });
    }
    setIsLoading(false);
  }
  
  const handleEditLocation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingLocation) return;
    setIsLoading(true);
    
    const form = event.currentTarget;
    const formData = new FormData(form);

    const updatedLocationData = {
        name: (formData.get('editLocationName') as string).toUpperCase(),
        details: (formData.get('editLocationDetails') as string).toUpperCase(),
    }

    try {
        const locationDocRef = doc(db, 'locations', editingLocation.id);
        await updateDoc(locationDocRef, updatedLocationData);
        setLocations(prev => prev.map(item => item.id === editingLocation.id ? { ...item, ...updatedLocationData } : item));
        toast({ title: 'Lokasi Diperbarui', description: `Data untuk ${updatedLocationData.name} berhasil diperbarui.` });
        setEditingLocation(null);
    } catch (error) {
        console.error("Error updating location:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui data lokasi.' });
    }
    setIsLoading(false);
  }

  const handleCoordinateChange = (locationId: string, field: 'latitude' | 'longitude', value: string) => {
    setLocations(prev => prev.map(loc => {
        if (loc.id === locationId) {
            return {
                ...loc,
                coordinates: {
                    latitude: field === 'latitude' ? parseFloat(value) || 0 : loc.coordinates?.latitude || 0,
                    longitude: field === 'longitude' ? parseFloat(value) || 0 : loc.coordinates?.longitude || 0,
                }
            };
        }
        return loc;
    }))
  };

  const handleSaveCoordinate = async (location: LocationData) => {
    const { id, coordinates } = location;
    if (!coordinates || typeof coordinates.latitude !== 'number' || typeof coordinates.longitude !== 'number') {
        toast({ variant: 'destructive', title: 'Data tidak valid', description: 'Pastikan latitude dan longitude adalah angka.' });
        return;
    }
    
    setIsLoading(true);
    try {
        const locationDocRef = doc(db, 'locations', id);
        await updateDoc(locationDocRef, { coordinates });
        toast({ title: 'Koordinat Disimpan', description: `Koordinat untuk ${location.name} telah diperbarui.` });
    } catch (error) {
        console.error('Error saving coordinates:', error);
        toast({ variant: 'destructive', title: 'Gagal menyimpan koordinat.' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleCleanup = async () => {
    setIsCleaning(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({
        title: 'Pembersihan Selesai (Simulasi)',
        description: `0 data riwayat dari kendaraan yang tidak terdaftar telah dihapus.`
    });
    setIsCleaning(false);
    setIsCleanupConfirmOpen(false);
  };

  const getPageTitle = () => {
    switch (activeMenu) {
        case 'pengguna': return 'Manajemen Pengguna';
        case 'alat': return 'Manajemen Alat';
        case 'lokasi': return 'Manajemen Lokasi';
        case 'sinkronisasi': return 'Sinkronisasi Data';
        case 'koordinat': return 'Titik Koordinat Absen';
        default: return 'Dasbor Admin';
    }
  }
  
    if (!currentUser) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

  return (
    <>
     <SidebarProvider>
      <Sidebar>
        <SidebarContent>
            <SidebarHeader>
                <h2 className="text-xl font-semibold text-primary">Dasbor Admin</h2>
            </SidebarHeader>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeMenu === 'pengguna'} onClick={() => setActiveMenu('pengguna')}>
                        <Users />
                        Manajemen Pengguna
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeMenu === 'alat'} onClick={() => setActiveMenu('alat')}>
                        <Construction />
                        Manajemen Alat
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeMenu === 'lokasi'} onClick={() => setActiveMenu('lokasi')}>
                        <MapPin />
                        Manajemen Lokasi
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeMenu === 'koordinat'} onClick={() => setActiveMenu('koordinat')}>
                        <LocateFixed />
                        Titik Koordinat Absen
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton isActive={activeMenu === 'sinkronisasi'} onClick={() => setActiveMenu('sinkronisasi')}>
                        <GitCompareArrows />
                        Sinkronisasi Data
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
         <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <SidebarTrigger/>
                    <div>
                        <h1 className="text-2xl font-bold tracking-wider">{getPageTitle()}</h1>
                        <p className="text-muted-foreground">
                            Selamat datang, <span className="font-semibold text-primary">{currentUser?.username || 'Admin'}</span> ({currentUser?.jabatan})
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
                </Button>
            </header>

            {isFetching ? (
                 <div className="flex min-h-[50vh] items-center justify-center bg-background">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </div>
            ) : (
             <>
                {activeMenu === 'pengguna' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                        <Card>
                            <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-xl">
                                <UserPlus />
                                Tambah Pengguna Baru
                            </CardTitle>
                            <CardDescription>Buat akun baru untuk karyawan.</CardDescription>
                            </CardHeader>
                            <CardContent>
                            <form onSubmit={handleAddUser} className="space-y-6">
                                <div className="space-y-2">
                                <Label htmlFor="username" className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Nama Pengguna
                                </Label>
                                <Input id="username" name="username" placeholder="cth: operator_baru" required style={{ textTransform: 'uppercase' }} />
                                </div>
                                <div className="space-y-2">
                                <Label htmlFor="password" className="flex items-center gap-2">
                                    <Lock className="h-4 w-4" />
                                    Sandi
                                </Label>
                                <Input id="password" name="password" type="password" placeholder="••••••••" required />
                                </div>
                                <div className="space-y-2">
                                <Label htmlFor="nik" className="flex items-center gap-2">
                                    <Fingerprint className="h-4 w-4" />
                                    NIK
                                </Label>
                                <Input id="nik" name="nik" placeholder="cth: 1234567890" required style={{ textTransform: 'uppercase' }} />
                                </div>
                                <div className="space-y-2">
                                <Label htmlFor="jabatan" className="flex items-center gap-2">
                                    <Briefcase className="h-4 w-4" />
                                    Jabatan
                                </Label>
                                <Select name="jabatan" onValueChange={setSelectedJabatan} value={selectedJabatan}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih jabatan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {jabatanOptions.map(jabatan => (
                                            <SelectItem key={jabatan} value={jabatan}>
                                                {jabatan}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lokasi" className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        Lokasi
                                    </Label>
                                    <Select name="lokasi" onValueChange={setSelectedLokasi} value={selectedLokasi}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih lokasi" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {locations.map(loc => (
                                                <SelectItem key={loc.id} value={loc.name}>
                                                    {loc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button type="submit" className="w-full font-semibold tracking-wide" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Tambah Pengguna'}
                                </Button>
                            </form>
                            </CardContent>
                        </Card>
                        </div>
                        <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                            <CardTitle>Daftar Pengguna</CardTitle>
                            <CardDescription>Daftar semua akun pengguna yang terdaftar di sistem.</CardDescription>
                            </CardHeader>
                            <CardContent>
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>Nama Pengguna</TableHead>
                                    <TableHead>NIK</TableHead>
                                    <TableHead>Jabatan</TableHead>
                                    <TableHead>Lokasi</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {users.map(user => (
                                    <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.username}</TableCell>
                                    <TableCell>{user.nik}</TableCell>
                                    <TableCell>{user.jabatan}</TableCell>
                                    <TableCell>{user.lokasi}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => setEditingUser(user)}>
                                            <Pencil className="h-4 w-4 text-amber-500"/>
                                            <span className="sr-only">Edit</span>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRequest(user.id, user.username, 'user')} disabled={user.username.toLowerCase() === 'super admin'}>
                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                            <span className="sr-only">Hapus</span>
                                        </Button>
                                    </TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                            </CardContent>
                        </Card>
                        </div>
                    </div>
                )}
                
                {activeMenu === 'alat' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3 text-xl">
                                        <Construction />
                                        Tambah Alat Baru
                                    </CardTitle>
                                    <CardDescription>Tambahkan kendaraan atau alat baru ke sistem.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleAddAlat} className="space-y-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="nomorLambung">Nomor Lambung</Label>
                                            <Input id="nomorLambung" name="nomorLambung" placeholder="cth: TM-001" required style={{ textTransform: 'uppercase' }} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="nomorPolisi">Nomor Polisi</Label>
                                            <Input id="nomorPolisi" name="nomorPolisi" placeholder="cth: BM 1234 ABC" required style={{ textTransform: 'uppercase' }} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="jenisKendaraan">Jenis Kendaraan</Label>
                                            <Input id="jenisKendaraan" name="jenisKendaraan" placeholder="cth: TRUCK MIXER" required style={{ textTransform: 'uppercase' }} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lokasiAlat">Lokasi</Label>
                                            <Select name="lokasiAlat" required>
                                                <SelectTrigger><SelectValue placeholder="Pilih lokasi awal..."/></SelectTrigger>
                                                <SelectContent>
                                                    {locations.map(loc => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button type="submit" className="w-full font-semibold tracking-wide" disabled={isLoading}>
                                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Tambah Alat'}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Daftar Alat</CardTitle>
                                    <CardDescription>Daftar semua alat yang terdaftar di sistem.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nomor Lambung</TableHead>
                                                <TableHead>Nomor Polisi</TableHead>
                                                <TableHead>Jenis Kendaraan</TableHead>
                                                <TableHead>Lokasi</TableHead>
                                                <TableHead className="text-right">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {alat.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium">{item.nomorLambung}</TableCell>
                                                    <TableCell>{item.nomorPolisi}</TableCell>
                                                    <TableCell>{item.jenisKendaraan}</TableCell>
                                                    <TableCell>{item.lokasi}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => setEditingAlat(item)}>
                                                            <Pencil className="h-4 w-4 text-amber-500"/>
                                                            <span className="sr-only">Edit</span>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRequest(item.id, item.nomorLambung, 'alat')}>
                                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                                            <span className="sr-only">Hapus</span>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {activeMenu === 'lokasi' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3 text-xl">
                                        <MapPin />
                                        Tambah Lokasi Baru
                                    </CardTitle>
                                    <CardDescription>Tambahkan lokasi batching plant baru.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form onSubmit={handleAddLocation} className="space-y-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="locationName">Nama Lokasi</Label>
                                            <Input id="locationName" name="locationName" placeholder="cth: BP-FRP-02" required style={{ textTransform: 'uppercase' }} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="locationDetails">Detail Lokasi</Label>
                                            <Input id="locationDetails" name="locationDetails" placeholder="cth: JL. GARUDA SAKTI KM 3" required style={{ textTransform: 'uppercase' }} />
                                        </div>
                                        <Button type="submit" className="w-full font-semibold tracking-wide" disabled={isLoading}>
                                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Tambah Lokasi'}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Daftar Lokasi</CardTitle>
                                    <CardDescription>Daftar semua lokasi yang terdaftar di sistem.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nama Lokasi</TableHead>
                                                <TableHead>Detail Lokasi</TableHead>
                                                <TableHead className="text-right">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {locations.map(item => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium">{item.name}</TableCell>
                                                    <TableCell>{item.details}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => setEditingLocation(item)}>
                                                            <Pencil className="h-4 w-4 text-amber-500"/>
                                                            <span className="sr-only">Edit</span>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRequest(item.id, item.name, 'lokasi')}>
                                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                                            <span className="sr-only">Hapus</span>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
                
                {activeMenu === 'koordinat' && (
                     <Card>
                        <CardHeader>
                            <CardTitle>Pengaturan Titik Koordinat Absensi</CardTitle>
                            <CardDescription>Atur latitude dan longitude untuk setiap lokasi sebagai titik acuan absensi. Dapatkan koordinat dari Google Maps.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30%]">Nama Lokasi</TableHead>
                                            <TableHead>Latitude</TableHead>
                                            <TableHead>Longitude</TableHead>
                                            <TableHead className="text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {locations.map((loc) => (
                                            <TableRow key={loc.id}>
                                                <TableCell className="font-semibold">{loc.name}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        step="any"
                                                        value={loc.coordinates?.latitude || ''}
                                                        onChange={(e) => handleCoordinateChange(loc.id, 'latitude', e.target.value)}
                                                        placeholder="e.g., 0.5071"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        step="any"
                                                        value={loc.coordinates?.longitude || ''}
                                                        onChange={(e) => handleCoordinateChange(loc.id, 'longitude', e.target.value)}
                                                        placeholder="e.g., 101.4478"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button onClick={() => handleSaveCoordinate(loc)} disabled={isLoading}>
                                                        <Save className="mr-2 h-4 w-4" />
                                                        Simpan
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeMenu === 'sinkronisasi' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><GitCompareArrows />Alat Sinkronisasi & Pembersihan</CardTitle>
                            <CardDescription>Gunakan alat ini untuk membersihkan data lama dan menjaga konsistensi database.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="p-6 border rounded-lg bg-muted/20">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold text-lg">Bersihkan Riwayat Alat Lama</h3>
                                        <p className="text-muted-foreground text-sm max-w-prose">
                                            Tindakan ini akan menghapus semua riwayat data (laporan checklist, tugas mekanik, pasangan sopir) yang terkait dengan kendaraan yang sudah tidak ada lagi di "Manajemen Alat".
                                            Gunakan ini untuk menjaga kebersihan data.
                                        </p>
                                    </div>
                                    <Button 
                                        variant="destructive" 
                                        className="mt-4 md:mt-0"
                                        onClick={() => setIsCleanupConfirmOpen(true)}
                                        disabled={isCleaning}
                                    >
                                        {isCleaning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Jalankan Pembersihan
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </>
            )}
         </div>
      </SidebarInset>
    </SidebarProvider>

    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Apakah Anda Yakin?</AlertDialogTitle>
                <AlertDialogDescription>
                    Tindakan ini tidak dapat diurungkan. Anda akan menghapus {itemToDelete?.type} dengan nama <strong>{itemToDelete?.name}</strong>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={isCleanupConfirmOpen} onOpenChange={setIsCleanupConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Pembersihan Data</AlertDialogTitle>
                <AlertDialogDescription>
                    Apakah Anda yakin ingin menghapus semua data riwayat dari kendaraan yang sudah tidak terdaftar? Tindakan ini tidak dapat diurungkan.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsCleanupConfirmOpen(false)}>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleCleanup} disabled={isCleaning} className="bg-destructive hover:bg-destructive/90">
                    {isCleaning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Ya, Bersihkan Data
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <Dialog open={!!editingUser} onOpenChange={(isOpen) => !isOpen && setEditingUser(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Pengguna</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditUser} className="space-y-4">
                <div>
                    <Label htmlFor="editUsername">Nama Pengguna</Label>
                    <Input id="editUsername" name="editUsername" defaultValue={editingUser?.username} required style={{ textTransform: 'uppercase' }} />
                </div>
                <div>
                    <Label htmlFor="editPassword">Sandi Baru (opsional)</Label>
                    <Input id="editPassword" name="editPassword" type="password" placeholder="Kosongkan jika tidak ingin diubah" />
                </div>
                <div>
                    <Label htmlFor="editNik">NIK</Label>
                    <Input id="editNik" name="editNik" defaultValue={editingUser?.nik} required style={{ textTransform: 'uppercase' }} />
                </div>
                <div>
                    <Label htmlFor="editJabatan">Jabatan</Label>
                    <Select name="editJabatan" defaultValue={editingUser?.jabatan}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {jabatanOptions.map(jabatan => <SelectItem key={jabatan} value={jabatan}>{jabatan}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="editLokasi">Lokasi</Label>
                    <Select name="editLokasi" defaultValue={editingUser?.lokasi}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {locations.map(loc => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Batal</Button>
                    <Button type="submit" disabled={isLoading}>
                         {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>

    <Dialog open={!!editingAlat} onOpenChange={(isOpen) => !isOpen && setEditingAlat(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Alat</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditAlat} className="space-y-4">
                <div>
                    <Label htmlFor="editNomorLambung">Nomor Lambung</Label>
                    <Input id="editNomorLambung" name="editNomorLambung" defaultValue={editingAlat?.nomorLambung} required style={{ textTransform: 'uppercase' }} />
                </div>
                <div>
                    <Label htmlFor="editNomorPolisi">Nomor Polisi</Label>
                    <Input id="editNomorPolisi" name="editNomorPolisi" defaultValue={editingAlat?.nomorPolisi} required style={{ textTransform: 'uppercase' }} />
                </div>
                 <div>
                    <Label htmlFor="editJenisKendaraan">Jenis Kendaraan</Label>
                    <Input id="editJenisKendaraan" name="editJenisKendaraan" defaultValue={editingAlat?.jenisKendaraan} required style={{ textTransform: 'uppercase' }} />
                </div>
                 <div>
                    <Label htmlFor="editLokasiAlat">Lokasi</Label>
                    <Select name="editLokasiAlat" defaultValue={editingAlat?.lokasi}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {locations.map(loc => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditingAlat(null)}>Batal</Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>

    <Dialog open={!!editingLocation} onOpenChange={(isOpen) => !isOpen && setEditingLocation(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Lokasi</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditLocation} className="space-y-4">
                <div>
                    <Label htmlFor="editLocationName">Nama Lokasi</Label>
                    <Input id="editLocationName" name="editLocationName" defaultValue={editingLocation?.name} required style={{ textTransform: 'uppercase' }} />
                </div>
                <div>
                    <Label htmlFor="editLocationDetails">Detail Lokasi</Label>
                    <Input id="editLocationDetails" name="editLocationDetails" defaultValue={editingLocation?.details} required style={{ textTransform: 'uppercase' }} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditingLocation(null)}>Batal</Button>
                    <Button type="submit" disabled={isLoading}>
                         {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    </>
  );
}
