
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Database, Loader2, Calendar as CalendarIcon, FilterX, Printer, View, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay, isDate } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { db, collection, getDocs } from '@/lib/firebase';
import type { ProductionData, PrintData, ScheduleRow } from '@/lib/types';
import { cn, printElement } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import ProductionHistoryPrintLayout from '@/components/production-history-print-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import PrintTicketLayout from '@/components/print-ticket-layout';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function DatabaseProduksiPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [productionHistory, setProductionHistory] = useState<ProductionData[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<ProductionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>();
  const [locationFilter, setLocationFilter] = useState('');

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [selectedProduction, setSelectedProduction] = useState<PrintData | null>(null);
  
  useEffect(() => {
    if (isPreviewing) {
      document.body.classList.add('print-active');
    } else {
      document.body.classList.remove('print-active');
    }
    // Cleanup on component unmount
    return () => {
      document.body.classList.remove('print-active');
    };
  }, [isPreviewing]);

  useEffect(() => {
    const fetchProductionData = async () => {
      setIsLoading(true);
      try {
        const q = collection(db, 'productions');
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => {
            const docData = doc.data();
            let tanggalAsDate: Date;

            if (docData.tanggal && typeof docData.tanggal.toDate === 'function') {
                tanggalAsDate = docData.tanggal.toDate();
            } else if (typeof docData.tanggal === 'string' && isDate(new Date(docData.tanggal))) {
                tanggalAsDate = new Date(docData.tanggal);
            } else {
                tanggalAsDate = new Date();
            }

            return {
                ...docData,
                id: doc.id,
                tanggal: tanggalAsDate,
            } as ProductionData;
        });
        
        const sortedData = data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
        setProductionHistory(sortedData);
        setFilteredHistory(sortedData);

      } catch (error) {
        console.error("Error fetching production data:", error);
        toast({
          variant: 'destructive',
          title: 'Gagal Memuat Data',
          description: 'Tidak dapat mengambil riwayat produksi dari server.',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchProductionData();
  }, [toast]);

  const handleSearch = () => {
    let results = productionHistory;

    if (date?.from) {
      const fromDate = startOfDay(date.from);
      const toDate = date.to ? endOfDay(date.to) : endOfDay(date.from);

      results = results.filter(item => {
          const itemDate = new Date(item.tanggal);
          return itemDate >= fromDate && itemDate <= toDate;
      });
    }

    if (locationFilter) {
      results = results.filter(item => 
        item.lokasiProyek.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }
    
    setFilteredHistory(results);
  };

  const clearFilter = () => {
    setDate(undefined);
    setLocationFilter('');
    setFilteredHistory(productionHistory);
  };

  const handleViewDetails = (item: ProductionData) => {
    const schedule: ScheduleRow = {
      id: item.jobId,
      'NO': item.jobId,
      'NAMA': item.namaPelanggan,
      'LOKASI': item.lokasiProyek,
      'GRADE': item.mutuBeton,
      'SLUMP (CM)': item.slump || '-',
      'VOL M³': item.targetVolume.toFixed(2),
      'NAMA SOPIR': item.namaSopir,
      'NOMOR MOBIL': item.nomorMobil,
      'NOMOR LAMBUNG': item.nomorLambung,
      'NO P.O': '',
      'CP/M': item['CP/M'] || '',
      'PENAMBAHAN VOL M³': '0',
      'TOTAL M³': String(item.totalVolumeTerkirim),
      'TERKIRIM M³': String(item.totalVolumeTerkirim),
      'SISA M³': '0',
      'STATUS': 'selesai',
      'KET': '',
    };
  
    const printData: PrintData = {
      schedule: schedule,
      jobMix: item.jobMix,
      targetVolume: String(item.targetVolume),
      jumlahMixing: item.jumlahMixing,
      startTime: new Date(item.jamMulai),
      endTime: new Date(item.jamSelesai),
      nomorRitasi: item.nomorRitasi,
      totalVolumeTerkirim: item.totalVolumeTerkirim,
      unitBp: item.unitBp,
    };
    
    setSelectedProduction(printData);
    setIsPreviewing(true);
  };

  const handlePrintTicket = () => {
    printElement('printable-detail-ticket-content');
  };

  const groupedHistory = useMemo(() => {
    return filteredHistory.reduce((acc, item) => {
      const dateKey = format(new Date(item.tanggal), 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(item);
      return acc;
    }, {} as Record<string, ProductionData[]>);
  }, [filteredHistory]);

  return (
    <>
    <div className='hidden'>
      <div id="production-history-print-area">
        <ProductionHistoryPrintLayout data={filteredHistory} dateRange={date} />
      </div>
    </div>

    <Dialog open={isPreviewing} onOpenChange={setIsPreviewing}>
        <DialogContent className="max-w-3xl p-0 printable-area" id="printable-detail-ticket">
          <div id="printable-detail-ticket-content">
            <DialogHeader className="p-4 border-b no-print">
              <DialogTitle>Detail Produksi</DialogTitle>
              <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="absolute right-4 top-3">
                    <X className="h-4 w-4" />
                  </Button>
              </DialogClose>
            </DialogHeader>
            <div className="p-6 max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible">
              {selectedProduction && <PrintTicketLayout data={selectedProduction} />}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-muted/50 no-print">
              <Button variant="outline" onClick={() => setIsPreviewing(false)}>Tutup</Button>
              <Button onClick={handlePrintTicket}>Cetak</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <header className="flex items-center gap-4 mb-8 no-print">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-wider flex items-center gap-3">
            <Database />
            Database Produksi
          </h1>
          <p className="text-muted-foreground">Tinjau seluruh riwayat produksi yang tercatat.</p>
        </div>
      </header>

      <main className='no-print'>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Riwayat Produksi</CardTitle>
            <CardDescription>Cari data produksi berdasarkan rentang tanggal dan lokasi.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row items-center gap-4">
             <Popover>
              <PopoverTrigger asChild>
                <Button id="date-range" variant={"outline"} className={cn("w-full md:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground" )}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? ( date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/>
              </PopoverContent>
            </Popover>
            <Input
              placeholder="Filter berdasarkan lokasi..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full md:w-[300px]"
            />
            <Button onClick={handleSearch}>Cari</Button>
            <Button variant="ghost" onClick={clearFilter}>
                <FilterX className="mr-2 h-4 w-4" />
                Reset Filter
            </Button>
             <Button variant="outline" className="ml-auto" onClick={() => printElement('production-history-print-area')} disabled={filteredHistory.length === 0}>
                <Printer className="mr-2 h-4 w-4" />
                Cetak Hasil Filter
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedHistory).length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {Object.entries(groupedHistory).map(([dateKey, items]) => {
              const totalVolume = items.reduce((acc, item) => acc + item.targetVolume, 0);
              return (
                <AccordionItem value={dateKey} key={dateKey}>
                  <AccordionTrigger>
                    <div className="flex justify-between w-full pr-4">
                        <span className="font-semibold">{format(new Date(dateKey), 'EEEE, dd MMMM yyyy', { locale: localeID })}</span>
                        <span className="text-muted-foreground">Total Produksi: <span className="font-bold text-primary">{totalVolume.toFixed(2)} M³</span></span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                     <div className="overflow-x-auto border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Jam Kirim</TableHead>
                                    <TableHead>Pelanggan</TableHead>
                                    <TableHead>Lokasi</TableHead>
                                    <TableHead>Mutu</TableHead>
                                    <TableHead className="text-right">Volume (M³)</TableHead>
                                    <TableHead>Sopir</TableHead>
                                    <TableHead>No. Polisi</TableHead>
                                    <TableHead className="text-right no-print">Detail</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{format(new Date(item.jamSelesai), 'HH:mm:ss', { locale: localeID })}</TableCell>
                                        <TableCell>{item.namaPelanggan}</TableCell>
                                        <TableCell>{item.lokasiProyek}</TableCell>
                                        <TableCell>{item.mutuBeton}</TableCell>
                                        <TableCell className="text-right">{item.targetVolume.toFixed(2)}</TableCell>
                                        <TableCell>{item.namaSopir}</TableCell>
                                        <TableCell>{item.nomorMobil}</TableCell>
                                        <TableCell className="text-right no-print">
                                            <Button variant="ghost" size="icon" onClick={() => handleViewDetails(item)}>
                                                <View className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                     </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : (
            <Card>
                <CardContent className="p-10 text-center">
                    <h3 className="text-lg font-semibold">Tidak Ada Data</h3>
                    <p className="text-muted-foreground">Tidak ada data produksi yang ditemukan untuk filter yang Anda pilih.</p>
                </CardContent>
            </Card>
        )}

      </main>
    </div>
    </>
  );
}
