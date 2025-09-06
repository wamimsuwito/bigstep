
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
import { SlidersHorizontal } from 'lucide-react';
import type { MixerSettings } from '@/lib/types';


interface MixerSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialSettings: MixerSettings;
  onSave: (settings: MixerSettings) => void;
}

export default function MixerSettingsDialog({ isOpen, onOpenChange, initialSettings, onSave }: MixerSettingsDialogProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    if (isOpen) {
        setSettings(initialSettings);
    }
  }, [isOpen, initialSettings]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: Number(value) }));
  };

  const handleSave = () => {
    onSave(settings);
    toast({
      title: 'Pengaturan Disimpan',
      description: 'Pengaturan pintu mixer telah berhasil diperbarui.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="text-primary" />
            Atur Pintu Mixer
          </DialogTitle>
          <DialogDescription>
            Atur durasi bukaan dan tutupan pintu mixer dalam satuan detik.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="opening1" className="text-right">
              Buka ke 1
            </Label>
            <Input
              id="opening1"
              name="opening1"
              type="number"
              value={settings.opening1}
              onChange={handleInputChange}
              className="col-span-2"
              placeholder="Detik"
              min="0"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="opening2" className="text-right">
              Buka ke 2
            </Label>
            <Input
              id="opening2"
              name="opening2"
              type="number"
              value={settings.opening2}
              onChange={handleInputChange}
              className="col-span-2"
              placeholder="Detik"
              min="0"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="opening3" className="text-right">
              Buka ke 3
            </Label>
            <Input
              id="opening3"
              name="opening3"
              type="number"
              value={settings.opening3}
              onChange={handleInputChange}
              className="col-span-2"
              placeholder="Detik"
              min="0"
            />
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="tutup" className="text-right">
              Tutup
            </Label>
            <Input
              id="tutup"
              name="tutup"
              type="number"
              value={settings.tutup}
              onChange={handleInputChange}
              className="col-span-2"
              placeholder="Detik"
              min="0"
            />
          </div>
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
