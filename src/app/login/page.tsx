
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Lock } from 'lucide-react';
import { db, collection, query, where, getDocs } from '@/lib/firebase';
import type { UserData } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const form = e.currentTarget as HTMLFormElement;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    if (!username || !password) {
        toast({
            variant: 'destructive',
            title: 'Gagal Login',
            description: 'Username dan password harus diisi.',
        });
        setIsLoading(false);
        return;
    }
    
    try {
        const q = query(collection(db, "users"), where("username", "==", username.toUpperCase()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({
                variant: 'destructive',
                title: 'Gagal Login',
                description: 'Username tidak ditemukan.',
            });
            setIsLoading(false);
            return;
        }

        const userDoc = querySnapshot.docs[0];
        const userData = { id: userDoc.id, ...userDoc.data() } as UserData;

        if (userData.password !== password) {
            toast({
                variant: 'destructive',
                title: 'Gagal Login',
                description: 'Password yang Anda masukkan salah.',
            });
            setIsLoading(false);
            return;
        }
        
        localStorage.setItem('user', JSON.stringify(userData));

        toast({
            title: `Selamat Datang, ${userData.username}!`,
            description: 'Anda berhasil login.',
        });

        // Redirect based on role/jabatan
        const jabatan = userData.jabatan.toUpperCase();
        if (jabatan === 'SUPER ADMIN') {
            router.push('/admin');
        } else if (jabatan === 'OWNER') {
            router.push('/owner');
        } else if (jabatan.includes('OPRATOR BP')) {
            router.push('/');
        } else if (jabatan.includes('SOPIR')) {
            router.push('/sopir');
        } else if (jabatan.includes('KEPALA MEKANIK')) {
            router.push('/kepala-mekanik');
        } else if (jabatan.includes('KEPALA WORKSHOP')) {
            router.push('/workshop');
        } else if (jabatan.includes('ADMIN BP')) {
            router.push('/admin-bp');
        } else if (jabatan.includes('ADMIN LOGISTIK MATERIAL')) {
            router.push('/admin-logistik-material');
        } else if (jabatan.includes('QC')) {
            router.push('/qc');
        } else if (jabatan.includes('PEKERJA BONGKAR SEMEN')) {
            router.push('/bongkar-semen');
        } else if (jabatan.includes('HRD PUSAT')) {
            router.push('/hrd-pusat');
        } else if (jabatan.includes('HSE K3')) {
            router.push('/hse-k3');
        } else {
            // Fallback for any other roles, maybe to a generic dashboard or just show a toast
            toast({
                variant: 'destructive',
                title: 'Akses Ditolak',
                description: 'Anda tidak memiliki halaman yang ditetapkan untuk jabatan Anda.',
            });
            localStorage.removeItem('user');
            setIsLoading(false);
            return;
        }

    } catch (error) {
        console.error("Login Error:", error);
        toast({ variant: 'destructive', title: 'Terjadi Kesalahan', description: 'Tidak dapat terhubung ke server untuk otentikasi.' });
        setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className='relative h-16 w-full mx-auto mb-4'>
                <Image src="https://i.imgur.com/CxaNLPj.png" alt="Logo" fill style={{objectFit: 'contain'}} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" priority data-ai-hint="logo company"/>
            </div>
            <CardTitle className="text-xl font-bold tracking-wider whitespace-nowrap">PT FARIKA RIAU PERKASA</CardTitle>
            <CardDescription className="text-muted-foreground pt-1">Silakan masuk untuk melanjutkan</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="username"
                name="username"
                placeholder="Username"
                required
                className="pl-10"
                style={{textTransform: 'uppercase'}}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                required
                className="pl-10"
              />
            </div>
            <Button type="submit" className="w-full font-semibold tracking-wide" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Masuk
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
