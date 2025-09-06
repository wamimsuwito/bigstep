
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Lock, User, Loader2, ArrowLeft } from 'lucide-react';
import type { UserData } from '@/lib/types';
import { db, doc, getDoc, updateDoc } from '@/lib/firebase';


export default function ChangePasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.push('/login');
      return;
    }
    const userData = JSON.parse(userString);
    setUserInfo(userData);
  }, [router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: 'Kata sandi baru dan konfirmasi kata sandi tidak cocok.',
      });
      return;
    }
    if (newPassword.length < 6) {
         toast({
            variant: 'destructive',
            title: 'Gagal',
            description: 'Kata sandi baru minimal harus 6 karakter.',
        });
        return;
    }

    setIsLoading(true);

    if (!userInfo || !userInfo.id) {
        toast({ variant: 'destructive', title: 'Error', description: 'Informasi pengguna tidak ditemukan.' });
        setIsLoading(false);
        return;
    }
    
    try {
        const userDocRef = doc(db, 'users', userInfo.id);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Pengguna tidak ditemukan di database.' });
            setIsLoading(false);
            return;
        }
        
        const userFromDb = userDocSnap.data() as UserData;

        if (userFromDb.password !== oldPassword) {
            toast({ variant: 'destructive', title: 'Gagal', description: 'Kata sandi lama yang Anda masukkan salah.' });
            setIsLoading(false);
            return;
        }

        await updateDoc(userDocRef, { password: newPassword });

        toast({
            title: 'Berhasil',
            description: 'Kata sandi Anda telah berhasil diperbarui.',
        });
        
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        router.back();

    } catch (error) {
        console.error("Error changing password:", error);
        toast({ variant: 'destructive', title: 'Gagal', description: 'Terjadi kesalahan saat memperbarui kata sandi.' });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <div>
            <h1 className="text-2xl font-bold tracking-wider text-primary flex items-center gap-3"><KeyRound/>Ubah Kata Sandi</h1>
            <p className="text-muted-foreground">Perbarui kata sandi Anda secara berkala untuk menjaga keamanan akun.</p>
        </div>
      </header>
      
      <main className="flex justify-center">
        <Card className="w-full max-w-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <User /> {userInfo?.username || 'Memuat...'}
                </CardTitle>
                <CardDescription>
                    Masukkan kata sandi lama dan kata sandi baru Anda di bawah ini.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="oldPassword">Kata Sandi Lama</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input 
                                id="oldPassword" 
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                required
                                className="pl-10"
                                placeholder="Masukkan kata sandi saat ini"
                                disabled={!userInfo}
                            />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="newPassword">Kata Sandi Baru</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input 
                                id="newPassword" 
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                className="pl-10"
                                placeholder="Minimal 6 karakter"
                                disabled={!userInfo}
                            />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Konfirmasi Kata Sandi Baru</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input 
                                id="confirmPassword" 
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="pl-10"
                                placeholder="Ulangi kata sandi baru"
                                disabled={!userInfo}
                            />
                        </div>
                    </div>
                    <Button type="submit" className="w-full font-semibold" disabled={isLoading || !userInfo}>
                         {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Perbarui Kata Sandi'}
                    </Button>
                </form>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
