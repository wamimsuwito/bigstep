
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
import { ListOrdered } from 'lucide-react';
import type { LoadingOrderSettings } from '@/lib/types';


interface LoadingOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialSettings: LoadingOrderSettings;
  onSave: (settings: LoadingOrderSettings) => void;
}

const materials = ['Pasir', 'Batu', 'Semen', 'Air'];

export default function LoadingOrderDialog({ isOpen, onOpenChange, initialSettings, onSave }: LoadingOrderDialogProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<LoadingOrderSettings>(initialSettings);
  
  useEffect(() => {
    if(isOpen) {
        setSettings(initialSettings);
    }
  }, [isOpen, initialSettings])


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, dataset } = e.target;
    const { type } = dataset;
    if (name && type) {
        setSettings(prev => ({
            ...prev,
            [name]: {
                ...prev[name],
                [type]: value,
            },
        }));
    }
  };

  const handleSaveClick = () => {
    onSave(settings);
    toast({
      title: 'Pengaturan Disimpan',
      description: 'Urutan loading material telah berhasil diperbarui.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="text-primary" />
            Atur Urutan Loading
          </DialogTitle>
          <DialogDescription>
            Pasir adalah acuan. Urutan 1: tuang bersamaan dengan pasir. Urutan 2: tuang setelah pasir selesai.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4 px-1">
                <Label className="col-span-2 text-left">Material</Label>
                <Label className="text-center">Urutan</Label>
                <Label className="text-center">Jeda (detik)</Label>
            </div>
          {materials.map((material) => (
            <div key={material} className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor={material.toLowerCase()} className="col-span-2 text-left">
                {material}
              </Label>
              <Input
                id={`${material.toLowerCase()}-urutan`}
                name={material}
                data-type="urutan"
                type="number"
                value={settings[material as keyof typeof settings]?.urutan || ''}
                onChange={handleInputChange}
                className="text-center"
                placeholder="1"
                disabled={material === 'Pasir'}
                min="1"
                max="2"
              />
               <Input
                id={`${material.toLowerCase()}-detik`}
                name={material}
                data-type="detik"
                type="number"
                value={settings[material as keyof typeof settings]?.detik || ''}
                onChange={handleInputChange}
                className="text-center"
                placeholder="0"
                min="0"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" onClick={handleSaveClick}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
