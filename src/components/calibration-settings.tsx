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
import type { ScaleData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface CalibrationSettingsProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  scales: ScaleData[];
  onSave: (updatedScales: ScaleData[]) => void;
}

export default function CalibrationSettings({
  isOpen,
  onOpenChange,
  scales,
  onSave,
}: CalibrationSettingsProps) {
  const [localScales, setLocalScales] = useState<ScaleData[]>(scales);
  const { toast } = useToast();

  useEffect(() => {
    setLocalScales(scales);
  }, [scales, isOpen]);

  const handleInputChange = (id: number, field: 'min' | 'max', value: string) => {
    const numericValue = value === '' ? 0 : parseFloat(value);
    setLocalScales(currentScales =>
      currentScales.map(scale =>
        scale.id === id ? { ...scale, [field]: numericValue } : scale
      )
    );
  };

  const handleSaveClick = () => {
    for (const scale of localScales) {
        if (scale.min >= scale.max) {
            toast({
                variant: 'destructive',
                title: 'Invalid Range',
                description: `For ${scale.name}, the minimum weight must be less than the maximum weight.`,
            });
            return;
        }
    }
    onSave(localScales);
    toast({
      title: 'Calibration Saved',
      description: 'The new weight thresholds have been applied.',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Calibration Settings</DialogTitle>
          <DialogDescription>
            Set the minimum and maximum weight thresholds for each scale to trigger alerts.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
          {localScales.map(scale => (
            <div key={scale.id} className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor={`name-${scale.id}`} className="text-right">
                {scale.name}
              </Label>
              <Input
                id={`min-${scale.id}`}
                type="number"
                value={scale.min}
                onChange={(e) => handleInputChange(scale.id, 'min', e.target.value)}
                className="col-span-1"
                placeholder="Min Weight"
              />
              <Input
                id={`max-${scale.id}`}
                type="number"
                value={scale.max}
                onChange={(e) => handleInputChange(scale.id, 'max', e.target.value)}
                className="col-span-1"
                placeholder="Max Weight"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSaveClick}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
