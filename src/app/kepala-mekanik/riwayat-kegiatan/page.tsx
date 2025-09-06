
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, History, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { db, collection, query, where, getDocs, Timestamp } from '@/lib/firebase';
import type { UserData, ActivityLog } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { FilterX } from 'lucide-react';

export default function RiwayatKegiatanPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [history, setHistory] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userInfo, setUserInfo] = useState<UserData | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (userString) {
            setUserInfo(JSON.parse(userString));
        } else {
            router.push('/login');
        }
    }, [router]);

    useEffect(() => {
        if (!userInfo) return;

        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                let q;
                const canViewAll = userInfo.jabatan?.toUpperCase() === 'KEPALA MEKANIK' || userInfo.jabatan?.toUpperCase() === 'HRD PUSAT';

                if (canViewAll) {
                    q = query(collection(db, "kegiatan_harian"));
                } else if (userInfo.id) {
                    q = query(collection(db, "kegiatan_harian"), where('userId', '==', userInfo.id));
                } else {
                    setHistory([]);
                    setIsLoading(false);
                    return;
                }
                
                const querySnapshot = await getDocs(q);
                const userHistory = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id }) as ActivityLog);
                
                const sortedHistory = userHistory.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                    return dateB.getTime() - dateA.getTime();
                });

                setHistory(sortedHistory);

            } catch (error) {
                console.error("Failed to fetch activity history:", error);
                toast({ title: 'Gagal Memuat Riwayat', variant: 'destructive', description: 'Terjadi kesalahan saat mengambil data dari server.' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [userInfo, toast]);
    
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-100 text-green-800">Selesai</Badge>;
            case 'in_progress':
                return <Badge className="bg-blue-100 text-blue-800">Proses</Badge>;
            case 'pending':
                return <Badge className="bg-yellow-100 text-yellow-800">Menunggu</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };
    
    const safeFormatTimestamp = (timestamp: any, formatString: string) => {
        if (!timestamp || typeof timestamp.toDate !== 'function') return null;
        try {
            return format(timestamp.toDate(), formatString, { locale: localeID });
        } catch (error) {
            return null;
        }
    }

    const PhotoWithTimestamp = ({ photo, timestamp, label, formatStr = 'dd MMM, HH:mm' }: { photo?: string | null, timestamp?: any, label: string, formatStr?: string }) => {
        if (!photo) return null;
        const formattedTime = timestamp ? safeFormatTimestamp(timestamp, formatStr) : null;
        return (
            <div>
                <p className="text-xs font-semibold mb-1">{label}</p>
                <img src={photo} className="rounded" alt={`Foto ${label}`} data-ai-hint="activity evidence"/>
                {formattedTime && <p className="text-[10px] text-muted-foreground text-center mt-1">{formattedTime}</p>}
            </div>
        );
    }
    
    const filteredHistory = useMemo(() => {
        if (!selectedDate) {
            return history;
        }
        return history.filter(activity => {
            const activityDate = activity.createdAt?.toDate ? activity.createdAt.toDate() : null;
            return activityDate && isSameDay(activityDate, selectedDate);
        });
    }, [history, selectedDate]);

    return (
        <div className="min-h-screen w-full max-w-lg mx-auto flex flex-col bg-background text-foreground p-4">
            <header className="flex items-center gap-4 py-4 mb-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
                <div className="flex items-center gap-3">
                    <History className="text-primary"/>
                    <h1 className="text-xl font-bold">Riwayat Kegiatan</h1>
                </div>
            </header>

            <div className="flex items-center gap-2 mb-4">
                <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground" )}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP', { locale: localeID }) : <span>Pilih tanggal</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                      />
                    </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDate(undefined)} disabled={!selectedDate}>
                    <FilterX className="h-4 w-4"/>
                </Button>
            </div>

            <main className="flex-1 overflow-y-auto space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
                ) : filteredHistory.length > 0 ? (
                     <Accordion type="single" collapsible className="w-full">
                        {filteredHistory.map(activity => (
                             <AccordionItem value={activity.id} key={activity.id}>
                                <AccordionTrigger>
                                     <div className='flex items-center justify-between w-full'>
                                        <div className="text-left">
                                            <p className="font-semibold text-sm">TARGET: {safeFormatTimestamp(activity.targetTimestamp, 'dd MMM, HH:mm')}</p>
                                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{activity.description}</p>
                                            <p className="text-xs text-muted-foreground font-bold mt-1">{activity.username}</p>
                                        </div>
                                        {getStatusBadge(activity.status)}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-3 p-2 bg-muted/50 rounded-md">
                                        <p className="text-sm border-b pb-2">{activity.description}</p>
                                        <div className="text-xs text-muted-foreground space-y-1">
                                            <p className="flex items-center gap-2"><CalendarIcon size={14}/>Dilaporkan: {safeFormatTimestamp(activity.createdAt, 'dd MMM yyyy, HH:mm')}</p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 pt-2">
                                            <PhotoWithTimestamp photo={activity.photoInitial} timestamp={activity.createdAt} label="Awal" />
                                            <PhotoWithTimestamp photo={activity.photoInProgress} timestamp={activity.timestampInProgress} label="Proses" />
                                            <PhotoWithTimestamp photo={activity.photoCompleted} timestamp={activity.timestampCompleted} label="Selesai" />
                                        </div>
                                    </div>
                                </AccordionContent>
                             </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <div className="text-center py-20 text-muted-foreground">
                        <p>{selectedDate ? 'Tidak ada riwayat kegiatan pada tanggal yang dipilih.' : 'Belum ada riwayat kegiatan yang tercatat.'}</p>
                    </div>
                )}
            </main>
        </div>
    );
}
