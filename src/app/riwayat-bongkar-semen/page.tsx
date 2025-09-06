
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, History, Ship } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceStrict } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import type { RencanaPemasukan, CementActivity } from '@/lib/types';
import { db, collection, getDocs, query, where, orderBy } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export default function RiwayatBongkarSemenPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [history, setHistory] = useState<RencanaPemasukan[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                // Query only by status to avoid composite index error
                const q = query(
                    collection(db, "rencana_pemasukan"),
                    where('status', '==', 'Selesai Bongkar')
                );
                const querySnapshot = await getDocs(q);
                const historyData = querySnapshot.docs.map(d => ({...d.data(), id: d.id}) as RencanaPemasukan);
                
                // Sort data on the client-side
                const sortedHistory = historyData.sort((a, b) => {
                    const dateA = a.bongkarSelesaiAt ? new Date(a.bongkarSelesaiAt).getTime() : 0;
                    const dateB = b.bongkarSelesaiAt ? new Date(b.bongkarSelesaiAt).getTime() : 0;
                    return dateB - dateA;
                });

                setHistory(sortedHistory);
            } catch (error) {
                console.error("Failed to fetch history:", error);
                toast({ title: 'Gagal Memuat Riwayat', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [toast]);

    const calculateTotalDuration = (activities: CementActivity[] = []): string => {
        if (activities.length === 0) return '0j 0m';

        const firstStart = new Date(activities.reduce((earliest, act) => 
            new Date(act.startTime) < new Date(earliest) ? act.startTime : earliest, activities[0].startTime));
        
        const lastEnd = new Date(activities.reduce((latest, act) => 
            act.endTime && new Date(act.endTime) > new Date(latest) ? act.endTime : latest, activities[0].endTime || activities[0].startTime));

        return formatDistanceStrict(lastEnd, firstStart, { locale: localeID });
    }

    const safeFormatDate = (dateInput: any, formatString: string) => {
        if (!dateInput) return '-';
        try {
            const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
            if (isNaN(date.getTime())) return '-';
            return format(date, formatString, { locale: localeID });
        } catch (error) {
            return '-';
        }
    };

    return (
        <div className="min-h-screen w-full max-w-4xl mx-auto flex flex-col bg-background text-foreground p-4">
            <header className="flex items-center gap-4 py-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
                <div className="flex items-center gap-3">
                    <History className="text-primary"/>
                    <h1 className="text-xl font-bold">Riwayat Aktivitas Bongkar Semen</h1>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Pekerjaan Selesai</CardTitle>
                        <CardDescription>Menampilkan semua pekerjaan bongkar semen yang telah diarsipkan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
                        ) : history.length > 0 ? (
                             <Accordion type="single" collapsible className="w-full">
                                {history.map(job => (
                                    <AccordionItem value={job.id} key={job.id}>
                                        <AccordionTrigger>
                                            <div className='flex items-center gap-4 text-left'>
                                                <Ship className="h-5 w-5 text-muted-foreground"/>
                                                <div>
                                                    <p className="font-semibold">{job.namaKapal}</p>
                                                    <p className="text-xs text-muted-foreground">{safeFormatDate(job.bongkarSelesaiAt, 'dd MMMM yyyy, HH:mm')}</p>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className='p-2'>
                                            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                    <div><p className="text-muted-foreground text-xs">Kapten/Sopir</p><p>{job.namaSopir}</p></div>
                                                    <div><p className="text-muted-foreground text-xs">Total Muatan</p><p>{(Object.values(job.tankLoads || {}).reduce((s,a)=> s+a, 0)).toLocaleString('id-ID')} KG</p></div>
                                                    <div><p className="text-muted-foreground text-xs">Jam Mulai</p><p>{safeFormatDate(job.completedActivities?.[0]?.startTime, 'HH:mm:ss')}</p></div>
                                                    <div><p className="text-muted-foreground text-xs">Jam Selesai</p><p>{safeFormatDate(job.bongkarSelesaiAt, 'HH:mm:ss')}</p></div>
                                                    <div className='col-span-full md:col-span-2'><p className="text-muted-foreground text-xs">Total Waktu Bongkar</p><p>{calculateTotalDuration(job.completedActivities)}</p></div>
                                                </div>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Dari</TableHead>
                                                            <TableHead>Ke</TableHead>
                                                            <TableHead>Waktu Kerja</TableHead>
                                                            <TableHead>Total Jeda</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                    {(job.completedActivities || []).map(act => (
                                                        <TableRow key={act.id}>
                                                            <TableCell>{act.sourceTankId.replace('-',' ').toUpperCase()}</TableCell>
                                                            <TableCell>{(act.destinationUnit ? `${act.destinationUnit}: ` : '') + act.destinationId.replace('-',' ').toUpperCase()}</TableCell>
                                                            <TableCell>{act.endTime ? formatDistanceStrict(new Date(act.endTime), new Date(act.startTime), { locale: localeID }) : 'N/A'}</TableCell>
                                                            <TableCell>{act.totalPauseDuration ? formatDistanceStrict(0, act.totalPauseDuration, { locale: localeID }) : '0m'}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <p className="text-muted-foreground text-center py-10">Belum ada riwayat bongkar yang tersimpan.</p>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
