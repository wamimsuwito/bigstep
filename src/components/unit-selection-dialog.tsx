
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Truck } from 'lucide-react';

interface UnitSelectionDialogProps {
  isOpen: boolean;
  onUnitSelect: (unit: string) => void;
}

const availableUnits = ['BP-1', 'BP-2', 'BP-3'];

export default function UnitSelectionDialog({
  isOpen,
  onUnitSelect,
}: UnitSelectionDialogProps) {
  const router = useRouter();

  return (
    <Dialog open={isOpen} modal={true}>
      <DialogContent
        className="sm:max-w-md"
        hideCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="text-primary" />
            Pilih Unit Batching Plant
          </DialogTitle>
          <DialogDescription>
            Pilih unit BP yang akan Anda operasikan untuk sesi ini.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2">
          {availableUnits.map((unit) => (
              <Button
                key={unit}
                className="w-full justify-start py-6 text-base"
                variant="outline"
                onClick={() => onUnitSelect(unit)}
              >
                <Truck className="mr-4" />
                {unit}
              </Button>
            ))}
        </div>
        <DialogFooter className="pt-4 border-t">
            <Button variant="ghost" onClick={() => router.back()} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
