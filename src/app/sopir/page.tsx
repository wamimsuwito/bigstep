
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardCheck,
  FileText,
  Power,
  User,
  Anchor,
  AlertTriangle,
  Truck,
  History,
  ShieldX,
  Star,
  Fingerprint,
  Briefcase,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserData, SopirBatanganData } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { db, collection, query, where, getDocs } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


const MenuItem = ({
  icon: Icon,
  label,
  href,
  disabled = false
}: {
  icon: React.ElementType;
  label: string;
  href?: string;
  disabled?: boolean;
}) => {
  const content = (
    <div className={cn("flex flex-col items-center gap-2 group", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      <div className={cn("w-16 h-16 bg-card rounded-full flex items-center justify-center border", !disabled && "group-hover:bg-accent transition-colors")}>
        <div className={cn("w-14 h-14 bg-card rounded-full flex items-center justify-center text-primary shadow-md", !disabled && "group-hover:bg-accent transition-colors")}>
          <Icon className="w-7 h-7" />
        </div>
      </div>
      <p className="text-sm font-medium text-center text-foreground">{label}</p>
    </div>
  );

  if (href && !disabled) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
};

export default function SopirPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePairing, setActivePairing] = useState<SopirBatanganData | null>(null);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.push('/login');
      return;
    }
    const userData = JSON.parse(userString);
    if (!userData.jabatan?.toUpperCase().includes('SOPIR')) {
        toast({
            variant: 'destructive',
            title: 'Akses Ditolak',
            description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
        });
        router.push('/login');
        return;
    }
    setUserInfo(userData);

    const fetchPairing = async () => {
        if (!userData.id) return;
        setIsLoading(true);
        try {
            const q = query(collection(db, "sopir_batangan"), where("userId", "==", userData.id));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const pairingDoc = querySnapshot.docs[0];
                setActivePairing({ id: pairingDoc.id, ...pairingDoc.data() } as SopirBatanganData);
            } else {
                setActivePairing(null);
            }
        } catch (error) {
            console.error("Failed to fetch pairing:", error);
            toast({ variant: 'destructive', title: 'Gagal Memuat Data', description: 'Tidak dapat mengambil data pasangan kendaraan dari server.' });
        } finally {
            setIsLoading(false);
        }
    };

    fetchPairing();
  }, [router, toast]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };
  
  const getMenuItems = () => {
    const isPaired = !!activePairing;
    const baseItems = [
      { icon: ClipboardCheck, label: 'Absensi', href: '/absensi' },
      { icon: ClipboardCheck, label: 'Checklis Alat', href: '/checklist-alat', disabled: !isPaired },
      { icon: FileText, label: 'Kegiatan', href: '/kegiatan' },
      { icon: History, label: 'Riwayat Kegiatan', href: '/riwayat-kegiatan' },
      { icon: ShieldX, label: 'Riwayat Penalti', href: '/riwayat-saya?type=penalty' },
      { icon: Star, label: 'Riwayat Reward', href: '/riwayat-saya?type=reward' },
    ];
  
    if (userInfo?.jabatan.toUpperCase() === 'SOPIR DT') {
      return [...baseItems, { icon: Anchor, label: 'Rit Bongkar Material', href: '/catat-rit-bongkar', disabled: !isPaired }];
    }
    
    return baseItems;
  };

  if (isLoading || !userInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }
  
  const menuItems = getMenuItems();

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-background text-foreground p-4">
      <header className="flex justify-between items-center py-4">
        <h1 className="text-lg font-bold text-foreground">PT. FARIKA RIAU PERKASA</h1>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <Power className="h-6 w-6 text-muted-foreground" />
        </Button>
      </header>

      <main className="flex-1 flex flex-col">
        <div className="bg-card border rounded-lg p-4 flex items-center justify-between shadow-lg mb-8">
          <div>
              <p className="text-xl font-bold">{userInfo.username}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1.5"><Fingerprint size={12}/>{userInfo.nik}</span>
                  <span className="flex items-center gap-1.5"><Briefcase size={12}/>{userInfo.jabatan}</span>
              </div>
          </div>
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
               <User className="w-8 h-8 text-primary" />
          </div>
        </div>

        {activePairing ? (
          <Card className="mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-3">
                <Truck className="text-primary"/>
                Kendaraan Anda Hari Ini
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center bg-muted/50 p-3 rounded-md">
                <div>
                  <p className="font-bold text-lg">{activePairing.nomorLambung}</p>
                  <p className="text-sm text-muted-foreground">{activePairing.nomorPolisi}</p>
                </div>
                <Badge>Aktif</Badge>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert variant="destructive" className="mb-8">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Tidak Ada Kendaraan (Batangan)</AlertTitle>
            <AlertDescription>
              Anda belum dipasangkan dengan kendaraan. Harap hubungi Kepala Workshop untuk dapat memulai aktivitas.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-3 gap-y-6 gap-x-4">
          {menuItems.map((item, index) => (
              <MenuItem key={index} icon={item.icon} label={item.label} href={item.href} disabled={item.disabled} />
          ))}
        </div>
      </main>
    </div>
  );
}
