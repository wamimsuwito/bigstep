
'use client';

import { useState, useEffect } from 'react';
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
import { Droplets, Plus, Minus } from 'lucide-react';
import type { MoistureSettings } from '@/lib/types';


interface MoistureControlDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialSettings: MoistureSettings;
  onSave: (settings: MoistureSettings) => void;
}

const CustomNumberInput = ({ label, name, value, onChange, unit, step = 0.1 }: { label: string, name: keyof MoistureSettings, value: number, onChange: (name: keyof MoistureSettings, value: number) => void, unit: string, step?: number }) => {
    
    const handleValueChange = (amount: number) => {
        const newValue = parseFloat((value + amount).toFixed(2));
        onChange(name, newValue);
    }
    
    return (
        <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor={name} className="text-right">
              {label} ({unit})
            </Label>
            <div className="col-span-2 flex items-center gap-2">
                 <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleValueChange(-step)}>
                    <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id={name}
                  name={name}
                  type="number"
                  value={value}
                  onChange={(e) => onChange(name, parseFloat(e.target.value) || 0)}
                  className="text-center text-base"
                  placeholder="0.0"
                  step={step}
                />
                 <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleValueChange(step)}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}


export default function MoistureControlDialog({ isOpen, onOpenChange, initialSettings, onSave }: MoistureControlDialogProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    if (isOpen) {
        setSettings(initialSettings);
    }
  }, [isOpen, initialSettings]);


  const handleInputChange = (name: keyof MoistureSettings, value: number) => {
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(settings);
    toast({
      title: 'Pengaturan Disimpan',
      description: 'Pengaturan kelembapan material telah berhasil diperbarui.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="text-primary" />
            Kontrol Kelembapan & Aditif
          </DialogTitle>
          <DialogDescription>
            Masukkan persentase kadar air untuk agregat dan penyesuaian volume air.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <CustomNumberInput 
                label="K.A Pasir"
                name="pasir"
                value={settings.pasir}
                onChange={handleInputChange}
                unit="%"
                step={0.1}
            />
            <CustomNumberInput 
                label="K.A Batu"
                name="batu"
                value={settings.batu}
                onChange={handleInputChange}
                unit="%"
                step={0.1}
            />
             <CustomNumberInput 
                label="Air (Aditif)"
                name="air"
                value={settings.air}
                onChange={handleInputChange}
                unit="kg"
                step={1}
            />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" onClick={handleSave}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
