
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, User, Building, Truck, Fingerprint, Briefcase } from 'lucide-react';
import type { UserData } from '@/lib/types';
import { SidebarTrigger } from '@/components/ui/sidebar';


interface AppHeaderProps {
  userInfo: UserData | null;
}

export default function AppHeader({ userInfo }: AppHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/logout');
    router.push('/login');
    router.refresh();
  };
  
  if (!userInfo) {
    return (
        <header className="flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 text-card-foreground shadow-sm">
             <div className="flex items-center gap-4">
                 <SidebarTrigger />
             </div>
        </header>
    )
  }

  return (
    <>
      <header className="flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 text-card-foreground shadow-sm">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className='relative h-12 w-16'>
              <Image src="https://i.imgur.com/CxaNLPj.png" alt="Logo" fill style={{objectFit: 'contain'}} sizes="10vw" data-ai-hint="logo company"/>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <div className='text-right'>
                <p className='font-bold flex items-center gap-2 justify-end'><User size={16} className="text-primary"/> {userInfo.username.toUpperCase()}</p>
                <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                    <p className='flex items-center gap-1.5'><Fingerprint size={14}/> {userInfo.nik}</p>
                    <p className='flex items-center gap-1.5'><Briefcase size={14}/> {userInfo.jabatan}</p>
                    <p className='flex items-center gap-1.5'><Building size={14}/> {userInfo.lokasi?.toUpperCase()}</p>
                    {userInfo.unitBp && <p className='flex items-center gap-1.5'><Truck size={14}/> Unit {userInfo.unitBp}</p>}
                </div>
            </div>
          
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Keluar
            </Button>
        </div>
      </header>
    </>
  );
}
