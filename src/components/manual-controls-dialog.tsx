
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
import { ToggleRight, CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { MaterialName } from '@/lib/types';


interface ManualControlsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onWeigh: (material: MaterialName, action: 'start' | 'stop') => void;
  onPour: (material: MaterialName, action: 'start' | 'stop') => void;
}

interface HoldButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
    onHoldStart: () => void;
    onHoldEnd: () => void;
}

const HoldButton = ({ label, onHoldStart, onHoldEnd, ...props }: HoldButtonProps) => {
    const [isHeld, setIsHeld] = useState(false);
    
    const handleMouseDown = () => {
        setIsHeld(true);
        onHoldStart();
    };

    const handleMouseUpOrLeave = () => {
        if (isHeld) {
            setIsHeld(false);
            onHoldEnd();
        }
    };
    
    return (
        <Button
            {...props}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUpOrLeave}
            className={cn(
                'w-full py-6 text-lg font-bold transition-all duration-100 touch-manipulation',
                isHeld ? 'bg-green-500 text-white scale-95 shadow-inner' : 'bg-secondary text-secondary-foreground'
            )}
        >
            {isHeld ? <CheckCircle className="mr-2" /> : <Circle className="mr-2" />}
            {label}
        </Button>
    )
}

interface ToggleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: string;
    actionKey: string;
    onToggleActive: (key: string, isStarting: boolean) => void;
    activeToggles: string[];
}

const ToggleButton = ({ label, actionKey, onToggleActive, activeToggles, ...props }: ToggleButtonProps) => {
    const isActive = activeToggles.includes(actionKey);

    const handleClick = () => {
        onToggleActive(actionKey, !isActive);
    };

    return (
        <Button
            {...props}
            onClick={handleClick}
            className={cn(
                'w-full py-6 text-lg font-bold transition-all duration-100',
                isActive ? 'bg-green-500 text-white scale-95 shadow-inner' : 'bg-secondary text-secondary-foreground'
            )}
        >
            {isActive ? <CheckCircle className="mr-2" /> : <Circle className="mr-2" />}
            {label}
        </Button>
    )
}

const simpleActions = ['Konv. Atas', 'Konv. Bawah'];

export default function ManualControlsDialog({ isOpen, onOpenChange, onWeigh, onPour }: ManualControlsDialogProps) {
    const { toast } = useToast();
    const [activeToggles, setActiveToggles] = useState<string[]>([]);
    
    const handleToggle = (key: string, isStarting: boolean) => {
        setActiveToggles(prev => 
            isStarting ? [...prev, key] : prev.filter(t => t !== key)
        );

        if (simpleActions.includes(key)) {
            toast({
                title: 'Aksi Manual',
                description: `${key} ${isStarting ? 'dijalankan' : 'dihentikan'}.`,
            });
            return;
        }

        // Assumes key is a MaterialName for pouring
        const materialKey = key.replace(' TUANG', '') as MaterialName;
        onPour(materialKey, isStarting ? 'start' : 'stop');
        
        toast({
            title: 'Aksi Manual',
            description: `${key} ${isStarting ? 'dijalankan' : 'dihentikan'}.`,
        });
    }

    const handleWeighStart = (material: MaterialName) => onWeigh(material, 'start');
    const handleWeighStop = (material: MaterialName) => onWeigh(material, 'stop');

    const handleSimpleClick = (action: string) => {
         toast({
            title: 'Aksi Manual',
            description: `${action} dijalankan.`,
        });
    }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ToggleRight className="text-primary" />
            Tombol Manual
          </DialogTitle>
          <DialogDescription>
            Gunakan tombol-tombol berikut untuk mengontrol proses secara manual. Hati-hati saat menggunakan.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
            <HoldButton label="PASIR TIMBANG" onHoldStart={() => handleWeighStart('PASIR')} onHoldEnd={() => handleWeighStop('PASIR')} />
            <HoldButton label="BATU TIMBANG" onHoldStart={() => handleWeighStart('BATU')} onHoldEnd={() => handleWeighStop('BATU')} />
            
            <ToggleButton
                label="PASIR TUANG"
                actionKey="PASIR TUANG"
                onToggleActive={handleToggle}
                activeToggles={activeToggles}
            />
            <ToggleButton
                label="BATU TUANG"
                actionKey="BATU TUANG"
                onToggleActive={handleToggle}
                activeToggles={activeToggles}
            />

            <HoldButton label="SEMEN 1 TIMBANG" onHoldStart={() => handleWeighStart('SEMEN 1')} onHoldEnd={() => handleWeighStop('SEMEN 1')} />
            <HoldButton label="SEMEN 2 TIMBANG" onHoldStart={() => handleWeighStart('SEMEN 2')} onHoldEnd={() => handleWeighStop('SEMEN 2')} />
            
            <ToggleButton
                label="SEMEN 1 TUANG"
                actionKey="SEMEN 1 TUANG"
                onToggleActive={handleToggle}
                activeToggles={activeToggles}
            />
            <ToggleButton
                label="SEMEN 2 TUANG"
                actionKey="SEMEN 2 TUANG"
                onToggleActive={handleToggle}
                activeToggles={activeToggles}
            />
            <HoldButton label="AIR TIMBANG" onHoldStart={() => handleWeighStart('AIR')} onHoldEnd={() => handleWeighStop('AIR')} />
            <ToggleButton
                label="AIR TUANG"
                actionKey="AIR TUANG"
                onToggleActive={handleToggle}
                activeToggles={activeToggles}
            />
             <ToggleButton
                label="KONV. ATAS"
                actionKey="Konv. Atas"
                onToggleActive={handleToggle}
                activeToggles={activeToggles}
            />
             <ToggleButton
                label="KONV. BAWAH"
                actionKey="Konv. Bawah"
                onToggleActive={handleToggle}
                activeToggles={activeToggles}
            />
            <HoldButton label="PINTU MIX BUKA" onHoldStart={() => handleSimpleClick('Pintu Mix Buka Start')} onHoldEnd={() => handleSimpleClick('Pintu Mix Buka Stop')} />
            <HoldButton label="PINTU MIX TUTUP" onHoldStart={() => handleSimpleClick('Pintu Mix Tutup Start')} onHoldEnd={() => handleSimpleClick('Pintu Mix Tutup Stop')} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
