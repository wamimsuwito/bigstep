
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Building, Loader2 } from 'lucide-react';
import type { LocationData } from '@/lib/types';

interface BpSelectionDialogProps {
  isOpen: boolean;
  onBpSelect: (bpName: string) => void;
}

const mockLocations: LocationData[] = [
    { id: '1', name: 'BP-FRP-01', details: 'JL. RIAU UJUNG' },
    { id: '2', name: 'BP-FRP-02', details: 'JL. SUDIRMAN' },
    { id: '3', name: 'BP-PKU-01', details: 'JL. GARUDA SAKTI' },
];

export default function BpSelectionDialog({
  isOpen,
  onBpSelect,
}: BpSelectionDialogProps) {
  const { toast } = useToast();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setTimeout(() => {
        setLocations(mockLocations);
        setIsLoading(false);
      }, 300);
    }
  }, [isOpen, toast]);

  return (
    <Dialog open={isOpen} modal={true}>
      <DialogContent
        className="sm:max-w-md"
        hideCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="text-primary" />
            Pilih Lokasi Batching Plant
          </DialogTitle>
          <DialogDescription>
            Pilih unit BP yang akan Anda operasikan sesi ini.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2 max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : locations.length > 0 ? (
            locations.map((loc) => (
              <Button
                key={loc.id}
                className="w-full justify-start py-6 text-base"
                variant="outline"
                onClick={() => onBpSelect(loc.name)}
              >
                <Building className="mr-4" />
                {loc.name}
              </Button>
            ))
          ) : (
            <p className="text-center text-muted-foreground">
              Tidak ada Lokasi yang terdaftar. Hubungi Admin.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
