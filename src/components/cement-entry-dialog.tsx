
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Ship, Anchor, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RencanaPemasukan } from '@/lib/types';

const SHIP_TANK_COUNT = 6;

interface TankDetail {
  spb: string;
  amount: number;
}

const initialTankDetails: Record<string, TankDetail> = Object.fromEntries(
  Array.from({ length: SHIP_TANK_COUNT }, (_, i) => [`tank-${i + 1}`, { spb: '', amount: 0 }])
);

interface CementEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: { headerData: any; tankDetails: Record<string, TankDetail>, destination: string }) => void;
  destination: string;
}

export default function CementEntryDialog({ isOpen, onOpenChange, onSave, destination }: CementEntryDialogProps) {
  const [step, setStep] = useState(1);
  const [headerData, setHeaderData] = useState({ namaKapal: '', namaSopir: '' });
  const [tankDetails, setTankDetails] = useState<Record<string, TankDetail>>(initialTankDetails);
  
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
        setHeaderData({ namaKapal: '', namaSopir: '' });
        setTankDetails(initialTankDetails);
    }
  }, [isOpen]);

  const totalAmount = useMemo(() => {
    return Object.values(tankDetails).reduce((sum, detail) => sum + detail.amount, 0);
  }, [tankDetails]);

  const filledTankCount = useMemo(() => {
    return Object.values(tankDetails).filter(d => d.amount > 0 && d.spb).length;
  }, [tankDetails]);

  const handleHeaderChange = (field: keyof typeof headerData, value: string) => {
    setHeaderData(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };

  const handleDetailChange = (tankId: string, field: keyof TankDetail, value: string) => {
    const isAmount = field === 'amount';
    const processedValue = isAmount ? parseInt(value, 10) || 0 : value.toUpperCase();
    setTankDetails(prev => ({
      ...prev,
      [tankId]: { ...prev[tankId], [field]: processedValue }
    }));
  };

  const goToStep2 = () => {
    if (!headerData.namaKapal || !headerData.namaSopir) {
      toast({ title: "Data Tidak Lengkap", description: "Harap isi Nama Kapal dan Nama Kapten.", variant: "destructive" });
      return;
    }
    setStep(2);
  };
  
  const resetState = () => {
    setStep(1);
    setHeaderData({ namaKapal: '', namaSopir: '' });
    setTankDetails(initialTankDetails);
    setIsLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  const handleSave = () => {
    const filledTanks = Object.values(tankDetails).filter(d => d.amount > 0 && d.spb);
    
    if (filledTanks.length !== SHIP_TANK_COUNT) {
      toast({ 
        title: "Data Tidak Lengkap", 
        description: `Harap isi SPB dan Jumlah untuk semua ${SHIP_TANK_COUNT} tangki. Baru terisi ${filledTanks.length}.`, 
        variant: "destructive" 
      });
      return;
    }
    
    const spbNumbers = filledTanks.map(d => d.spb);
    const uniqueSpbNumbers = new Set(spbNumbers);
    if (spbNumbers.length !== uniqueSpbNumbers.size) {
        toast({
            title: "Nomor SPB Duplikat",
            description: "Setiap tangki harus memiliki Nomor SPB yang unik.",
            variant: "destructive",
        });
        return;
    }

    setIsLoading(true);
    
    onSave({ headerData, tankDetails, destination });
    
    setTimeout(() => {
        setIsLoading(false);
        handleClose(false);
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Ship size={24} className="text-primary" />
            Catat Pemasukan Semen ke {destination}
          </DialogTitle>
          <DialogDescription>
            Langkah {step} dari 2: {step === 1 ? 'Informasi Kapal' : 'Rincian Muatan & SPB per Tangki'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6 py-4">
            <Card>
                <CardHeader><CardTitle className="text-base">Informasi Umum Pengiriman</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="namaKapal">Nama Kapal / Truk</Label>
                        <Input id="namaKapal" value={headerData.namaKapal} onChange={(e) => handleHeaderChange('namaKapal', e.target.value)} placeholder="cth: KM. JAYA ABADI 7" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="namaKapten">Nama Kapten / Sopir</Label>
                        <Input id="namaKapten" value={headerData.namaSopir} onChange={(e) => handleHeaderChange('namaSopir', e.target.value)} placeholder="cth: BUDI SANTOSO" />
                    </div>
                </CardContent>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Rincian per Tangki Kapal</CardTitle>
                    <CardDescription>Masukkan Nomor Surat Jalan (SPB) dan Jumlah (KG) untuk setiap tangki. Terisi: {filledTankCount}/{SHIP_TANK_COUNT}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Tangki</TableHead>
                                <TableHead>Nomor Surat Jalan (SPB)</TableHead>
                                <TableHead className="w-[200px]">Jumlah (KG)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.keys(tankDetails).map(tankId => (
                                <TableRow key={tankId}>
                                    <TableCell className="font-semibold flex items-center gap-2"><Anchor size={14}/>{tankId.replace('-', ' ')}</TableCell>
                                    <TableCell>
                                        <Input
                                            value={tankDetails[tankId].spb}
                                            onChange={(e) => handleDetailChange(tankId, 'spb', e.target.value)}
                                            placeholder={`SPB untuk ${tankId}`}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={tankDetails[tankId].amount || ''}
                                            onChange={(e) => handleDetailChange(tankId, 'amount', e.target.value)}
                                            placeholder="0"
                                            className="text-right"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                 <DialogFooter className="bg-muted/50 p-3 mt-4">
                    <div className="font-bold text-lg">
                        Total Muatan: {totalAmount.toLocaleString('id-ID')} KG
                    </div>
                </DialogFooter>
            </Card>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <Button onClick={goToStep2}>
              Lanjut ke Rincian Tangki <ArrowRight className="ml-2" size={16} />
            </Button>
          ) : (
            <div className="w-full flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin mr-2"/> : null}
                Simpan Pemasukan
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
