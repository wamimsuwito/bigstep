
'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, History, ShieldX, Star, Eye } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import type { UserData, PenaltyEntry, RewardEntry } from '@/lib/types';
import { db, collection, getDocs, query, where, orderBy } from '@/lib/firebase';
import PenaltyPrintLayout from '@/components/penalty-print-layout';
import RewardPrintLayout from '@/components/reward-print-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { printElement } from '@/lib/utils';
import { X } from 'lucide-react';

type PageType = 'penalty' | 'reward';

const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatString, { locale: localeID });
};

function RiwayatSayaComponent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [userInfo, setUserInfo] = useState<UserData | null>(null);
    const [penalties, setPenalties] = useState<PenaltyEntry[]>([]);
    const [rewards, setRewards] = useState<RewardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
    const [itemToPrint, setItemToPrint] = useState<Partial<PenaltyEntry> | Partial<RewardEntry> | null>(null);

    const pageType: PageType = searchParams.get('type') === 'reward' ? 'reward' : 'penalty';

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (userString) {
            setUserInfo(JSON.parse(userString));
        } else {
            router.push('/login');
        }
    }, [router]);

    useEffect(() => {
        if (!userInfo || !userInfo.id) return;

        const fetchHistory = async () => {
            setIsLoading(true);
            try {
                const collectionName = pageType === 'penalty' ? 'penalties' : 'rewards';
                const q = query(
                    collection(db, collectionName),
                    where('userId', '==', userInfo.id)
                );
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id }));
                
                const sortedData = data.sort((a: any, b: any) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                    return dateB.getTime() - dateA.getTime();
                });

                if (pageType === 'penalty') {
                    setPenalties(sortedData as PenaltyEntry[]);
                } else {
                    setRewards(sortedData as RewardEntry[]);
                }
            } catch (error) {
                console.error(`Failed to fetch ${pageType} history:`, error);
                toast({ title: 'Gagal Memuat Riwayat', variant: 'destructive', description: "Silakan coba lagi nanti." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [userInfo, pageType, toast]);
    
    const handlePrintPreview = (item: PenaltyEntry | RewardEntry) => {
        setItemToPrint(item);
        setIsPrintPreviewOpen(true);
    };

    const pageConfig = {
        penalty: {
            title: "Riwayat Penalti Saya",
            icon: ShieldX,
            description: "Daftar semua sanksi atau poin penalti yang pernah Anda terima.",
            data: penalties,
            headers: ["Tanggal", "Penyebab", "Poin", "Nilai (Rp)", "Detail"],
            rowRenderer: (item: PenaltyEntry) => (
                <TableRow key={item.id}>
                    <TableCell>{safeFormatTimestamp(item.createdAt, 'dd MMM yyyy')}</TableCell>
                    <TableCell>{item.penyebab}</TableCell>
                    <TableCell className="text-right font-bold text-red-500">{item.poin}</TableCell>
                    <TableCell className="text-right">{Number(item.nilai || 0).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handlePrintPreview(item)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                    </TableCell>
                </TableRow>
            )
        },
        reward: {
            title: "Riwayat Reward Saya",
            icon: Star,
            description: "Daftar semua apresiasi atau poin reward yang pernah Anda terima.",
            data: rewards,
            headers: ["Tanggal", "Deskripsi", "Poin", "Nilai (Rp)", "Detail"],
            rowRenderer: (item: RewardEntry) => (
                <TableRow key={item.id}>
                    <TableCell>{safeFormatTimestamp(item.createdAt, 'dd MMM yyyy')}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.deskripsi}</TableCell>
                    <TableCell className="text-right font-bold text-green-500">{item.poin}</TableCell>
                    <TableCell className="text-right">{Number(item.nilai || 0).toLocaleString('id-ID')}</TableCell>
                     <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handlePrintPreview(item)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                    </TableCell>
                </TableRow>
            )
        }
    };

    const currentConfig = pageConfig[pageType];
    const printableId = pageType === 'penalty' ? 'printable-penalty' : 'printable-reward';

    return (
        <>
        <Dialog open={isPrintPreviewOpen} onOpenChange={setIsPrintPreviewOpen}>
            <DialogContent className="max-w-4xl p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>Pratinjau Surat</DialogTitle>
                    <DialogClose asChild><Button variant="ghost" size="icon" className="absolute top-3 right-4"><X className="h-4 w-4"/></Button></DialogClose>
                </DialogHeader>
                <div className="p-6 max-h-[80vh] overflow-y-auto" id={printableId}>
                    {pageType === 'penalty' ? (
                        <PenaltyPrintLayout penaltyData={itemToPrint as PenaltyEntry} />
                    ) : (
                        <RewardPrintLayout rewardData={itemToPrint as RewardEntry} />
                    )}
                </div>
                <DialogFooter className="p-4 border-t bg-muted">
                    <Button variant="outline" onClick={() => setIsPrintPreviewOpen(false)}>Tutup</Button>
                    <Button onClick={() => printElement(printableId)}>Cetak</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <div className="min-h-screen w-full max-w-4xl mx-auto flex flex-col bg-background text-foreground p-4">
            <header className="flex items-center gap-4 py-4 mb-6">
                <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
                <div className="flex items-center gap-3">
                    <currentConfig.icon className="text-primary"/>
                    <h1 className="text-xl font-bold">{currentConfig.title}</h1>
                </div>
            </header>

            <main className="flex-1 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>{currentConfig.title}</CardTitle>
                        <CardDescription>{currentConfig.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {currentConfig.headers.map(header => (
                                            <TableHead key={header} className={header.includes('(Rp)') || header === 'Poin' || header === 'Detail' ? 'text-right' : ''}>{header}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={currentConfig.headers.length} className="h-40 text-center">
                                                <Loader2 className="animate-spin h-8 w-8 mx-auto text-primary" />
                                            </TableCell>
                                        </TableRow>
                                    ) : currentConfig.data.length > 0 ? (
                                        currentConfig.data.map(item => currentConfig.rowRenderer(item as any))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={currentConfig.headers.length} className="text-center h-24 text-muted-foreground">
                                                Tidak ada riwayat {pageType} yang tercatat.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
        </>
    );
}

export default function RiwayatSayaPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>}>
            <RiwayatSayaComponent />
        </Suspense>
    )
}
