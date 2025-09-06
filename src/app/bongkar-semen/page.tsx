
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Ship,
  History,
  Power,
  User,
  ClipboardCheck,
  ShieldX,
  Star,
  Fingerprint,
  Briefcase,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserData } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MenuItem = ({
  icon: Icon,
  label,
  href
}: {
  icon: React.ElementType;
  label: string;
  href?: string;
}) => {
  const content = (
    <div className="flex flex-col items-center gap-2 cursor-pointer group">
      <div className={cn("w-16 h-16 bg-card rounded-full flex items-center justify-center group-hover:bg-accent transition-colors border")}>
        <div className={cn("w-14 h-14 bg-card rounded-full flex items-center justify-center text-primary shadow-md group-hover:bg-accent transition-colors")}>
          <Icon className="w-7 h-7" />
        </div>
      </div>
      <p className="text-sm font-medium text-center text-foreground">{label}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
};

export default function BongkarSemenPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
        router.push('/login');
        return;
    }
    const userData = JSON.parse(userString);
    if (!userData.jabatan?.toUpperCase().includes('PEKERJA BONGKAR SEMEN')) {
        toast({
            variant: 'destructive',
            title: 'Akses Ditolak',
            description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
        });
        router.push('/login');
        return;
    }
    setUserInfo(userData);
    setIsLoading(false);
  }, [router, toast]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (isLoading || !userInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  const menuItems = [
    { icon: ClipboardCheck, label: 'Absensi', href: '/absensi' },
    { icon: Ship, label: 'Pencatatan Waktu Bongkar', href: '/catat-aktivitas-bongkar' },
    { icon: History, label: 'Riwayat Aktivitas', href: '/riwayat-bongkar-semen' },
    { icon: ShieldX, label: 'Riwayat Penalti', href: '/riwayat-saya?type=penalty' },
    { icon: Star, label: 'Riwayat Reward', href: '/riwayat-saya?type=reward' },
  ];

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

        <div className="grid grid-cols-3 gap-y-6 gap-x-4">
          {menuItems.map((item, index) => (
              <MenuItem key={index} icon={item.icon} label={item.label} href={item.href} />
          ))}
        </div>
      </main>
    </div>
  );
}
