
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, History, Printer, Eye, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { db, collection, getDocs, query, orderBy } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import TestReportPrintLayout from '@/components/test-report-print-layout';
import { printElement } from '@/lib/utils';

export default function RiwayatUjiTekanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(db, 'test_sessions'), orderBy('testDate', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedData = querySnapshot.docs.map(d => ({id: d.id, ...d.data()}));
        setSessions(fetchedData);
      } catch (error) {
        console.error("Error fetching test sessions: ", error);
        toast({ title: 'Gagal Memuat Riwayat', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [toast]);

  const handlePrint = () => {
    printElement('printable-test-report');
  };

  const handleViewDetails = (session: any) => {
    setSelectedSession(session);
    setIsPreviewing(true);
  };
  
  return (
    <>
      <Dialog open={isPreviewing} onOpenChange={setIsPreviewing}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="p-4 border-b no-print">
            <DialogTitle>Pratinjau Laporan Uji Tekan</DialogTitle>
            <DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-4 top-3"><X className="h-4 w-4"/></Button></DialogClose>
          </DialogHeader>
          <div id="printable-test-report" className="overflow-y-auto max-h-[80vh] p-6">
             <TestReportPrintLayout sessionData={selectedSession} />
          </div>
          <DialogFooter className="p-4 border-t bg-muted no-print">
            <Button variant="outline" onClick={() => setIsPreviewing(false)}>Tutup</Button>
            <Button onClick={handlePrint}><Printer className="mr-2"/>Cetak Laporan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="min-h-screen p-4 sm:p-6 md:p-8">
        <header className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-wider flex items-center gap-3"><History />Arsip Sesi Uji Tekan</h1>
            <p className="text-muted-foreground">Tinjau seluruh riwayat sesi pengujian yang tersimpan.</p>
          </div>
        </header>

        <main>
          <Card>
            <CardHeader>
              <CardTitle>Daftar Sesi Pengujian</CardTitle>
              <CardDescription>Setiap baris mewakili satu sesi penyimpanan hasil uji.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="p-3">Tanggal Uji</th>
                      <th className="p-3">Penguji</th>
                      <th className="p-3 text-center">Jumlah Sampel Diuji</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan={4} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></td></tr>
                    ) : sessions.length > 0 ? (
                      sessions.map(session => (
                        <tr key={session.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{format(session.testDate.toDate(), 'dd MMMM yyyy, HH:mm', { locale: localeID })}</td>
                          <td className="p-3">{session.testerName}</td>
                          <td className="p-3 text-center">{session.results?.length || 0}</td>
                          <td className="p-3 text-right">
                            <Button variant="outline" size="sm" onClick={() => handleViewDetails(session)}><Eye className="mr-2"/>Lihat Laporan</Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="h-24 text-center text-muted-foreground">Tidak ada riwayat sesi uji yang ditemukan.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
