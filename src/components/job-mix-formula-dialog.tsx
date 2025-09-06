
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileText } from 'lucide-react';

interface JobMixFormulaDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (targets: { [key: string]: number }) => void;
}

const materials = ['PASIR', 'BATU', 'SEMEN', 'AIR'];

export default function JobMixFormulaDialog({ isOpen, onOpenChange, onSave }: JobMixFormulaDialogProps) {
  const { toast } = useToast();
  const [targets, setTargets] = useState<{ [key: string]: string }>({
    PASIR: '',
    BATU: '',
    SEMEN: '',
    AIR: '',
  });

  const handleInputChange = (material: string, value: string) => {
    setTargets(prev => ({ ...prev, [material]: value }));
  };

  const handleSaveClick = () => {
    const newTargets: { [key: string]: number } = {};
    let hasError = false;

    for (const material of materials) {
        const value = parseFloat(targets[material]);
        if (isNaN(value) || value <= 0) {
            toast({
                variant: 'destructive',
                title: 'Input Tidak Valid',
                description: `Harap masukkan nilai numerik yang valid untuk ${material}.`,
            });
            hasError = true;
            break;
        }
        newTargets[material] = value;
    }

    if (!hasError) {
      onSave(newTargets);
      toast({
        title: 'Formula Disimpan',
        description: 'Target Job Mix Formula telah berhasil diperbarui.',
      });
      onOpenChange(false);
    }
  };
  
  const handleClose = () => {
    setTargets({ PASIR: '', BATU: '', SEMEN: '', AIR: '' });
    onOpenChange(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-cyan-500/50 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="text-cyan-400" />
            Buat Job Mix Formula
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Masukkan nilai target berat untuk setiap material dalam satuan kg.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {materials.map((material) => (
            <div key={material} className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor={material} className="text-right text-muted-foreground">
                {material}
              </Label>
              <Input
                id={material}
                type="number"
                value={targets[material]}
                onChange={(e) => handleInputChange(material, e.target.value)}
                className="col-span-2 bg-background/80"
                placeholder={`Target ${material} (kg)`}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Batal
          </Button>
          <Button type="button" onClick={handleSaveClick}>
            Simpan Formula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
