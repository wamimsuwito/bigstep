
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Anchor } from 'lucide-react';
import { RencanaPemasukan } from '@/lib/types';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';

const SHIP_TANK_COUNT = 6;

interface ArrivalConfirmationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  rencana: RencanaPemasukan;
  onConfirm: (rencana: RencanaPemasukan) => void;
}

export default function ArrivalConfirmationDialog({ isOpen, onOpenChange, rencana, onConfirm }: ArrivalConfirmationDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [noSpb, setNoSpb] = useState('');
  const [namaSopir, setNamaSopir] = useState('');
  const [tankLoads, setTankLoads] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && rencana) {
      setNamaSopir(rencana.namaSopir || '');
      
      if (rencana.jenisMaterial === 'SEMEN') {
        const initialTanks = Object.fromEntries(Array.from({ length: SHIP_TANK_COUNT }, (_, i) => [`tank-${i + 1}`, 0]));
        setTankLoads(initialTanks);
      }
    }
  }, [isOpen, rencana]);

  const totalTankLoad = useMemo(() => {
    return Object.values(tankLoads).reduce((sum, amount) => sum + amount, 0);
  }, [tankLoads]);

  const handleTankAmountChange = (tankId: string, value: string) => {
    const amount = parseInt(value, 10) || 0;
    setTankLoads(prev => ({ ...prev, [tankId]: amount }));
  };

  const handleConfirmClick = () => {
    if (rencana.jenisMaterial === 'SEMEN' && totalTankLoad <= 0) {
      toast({ title: "Data Tidak Lengkap", description: "Harap isi muatan minimal satu tangki.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    
    const updatedRencana: RencanaPemasukan = { 
        ...rencana, 
        namaSopir,
        status: 'Siap Untuk Dibongkar',
        realisasiMuatan: totalTankLoad,
        arrivalConfirmedAt: new Date().toISOString(),
        tankLoads,
    };

    setTimeout(() => {
        onConfirm(updatedRencana);
        onOpenChange(false);
        setIsLoading(false);
    }, 500);
  };
  
  const materialUnit = rencana.jenisMaterial === 'SEMEN' ? 'KG' : 'M3';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Konfirmasi Kedatangan & Rincian Muatan: {rencana.namaKapal}</DialogTitle>
          <DialogDescription>
            Material: {rencana.jenisMaterial} | Estimasi Tiba: {format(new Date(rencana.eta), 'dd MMM yyyy, HH:mm')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="namaSopir">Nama Kapten / Sopir <span className="text-red-500">*</span></Label>
                <Input id="namaSopir" value={namaSopir} onChange={(e) => setNamaSopir(e.target.value.toUpperCase())} placeholder="Wajib diisi..." />
            </div>
          </div>
         
          {rencana.jenisMaterial === 'SEMEN' && (
            <Card>
                <CardContent className="pt-6 space-y-4">
                     <p className="text-sm font-semibold">Rincian Muatan per Tangki Kapal (KG)</p>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.keys(tankLoads).map(tankId => (
                            <div key={tankId} className="space-y-1.5">
                            <Label htmlFor={tankId} className="flex items-center gap-2 text-xs"><Anchor size={14} />{tankId.replace('-', ' ')}</Label>
                            <Input
                                id={tankId} type="number"
                                value={tankLoads[tankId] === 0 ? '' : tankLoads[tankId]}
                                onChange={(e) => handleTankAmountChange(tankId, e.target.value)}
                                placeholder="0"
                            />
                            </div>
                        ))}
                    </div>
                    <div className="text-right font-bold bg-muted p-2 rounded-md">
                        Total Muatan: {totalTankLoad.toLocaleString('id-ID')} KG
                    </div>
                </CardContent>
            </Card>
          )}

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleConfirmClick} disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
            Konfirmasi & Siapkan untuk Bongkar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
