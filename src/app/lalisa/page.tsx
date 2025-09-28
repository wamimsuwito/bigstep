
'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, update } from 'firebase/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lightbulb, LightbulbOff, AirVent, Fan, DoorOpen, DoorClosed, Camera, Sun, Moon, Run } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserData } from '@/lib/types';
import { useRouter } from 'next/navigation';


interface Device {
  id: string;
  name: string;
  pin: number;
  type: 'light' | 'ac' | 'door';
  state: boolean;
}

interface Sensor {
  id: string;
  name: string;
  pin: number;
  state: boolean;
  last_triggered: string | null;
}

const initialDevices: Omit<Device, 'state'>[] = [
  { id: 'lampu_teras', name: 'Lampu Teras', pin: 2, type: 'light' },
  { id: 'lampu_taman', name: 'Lampu Taman', pin: 4, type: 'light' },
  { id: 'lampu_ruang_tamu', name: 'Lampu Ruang Tamu', pin: 5, type: 'light' },
  { id: 'lampu_dapur', name: 'Lampu Dapur', pin: 18, type: 'light' },
  { id: 'lampu_kamar_utama', name: 'Lampu Kamar Utama', pin: 19, type: 'light' },
  { id: 'lampu_kamar_anak', name: 'Lampu Kamar Anak', pin: 21, type: 'light' },
  { id: 'lampu_ruang_keluarga', name: 'Lampu Ruang Keluarga', pin: 22, type: 'light' },
  { id: 'lampu_ruang_makan', name: 'Lampu Ruang Makan', pin: 23, type: 'light' },
  { id: 'ac_kamar_utama', name: 'AC Kamar Utama', pin: 25, type: 'ac' },
  { id: 'ac_kamar_anak', name: 'AC Kamar Anak', pin: 26, type: 'ac' },
  { id: 'pintu_garasi', name: 'Pintu Garasi', pin: 27, type: 'door' },
];

const initialSensors: Omit<Sensor, 'state' | 'last_triggered'>[] = [
  { id: 'sensor_gerak', name: 'Sensor Gerak', pin: 13 },
  { id: 'sensor_cahaya', name: 'Sensor Cahaya', pin: 12 },
];

const DeviceCard = ({ device, onToggle, isUpdating }: { device: Device, onToggle: (id: string, currentState: boolean) => void, isUpdating: boolean }) => {
  const { name, type, state } = device;
  
  const icons = {
    light: { on: Lightbulb, off: LightbulbOff },
    ac: { on: AirVent, off: Fan },
    door: { on: DoorOpen, off: DoorClosed },
  };

  const Icon = state ? icons[type].on : icons[type].off;

  return (
    <Card
      onClick={() => onToggle(device.id, device.state)}
      className={cn(
        "cursor-pointer select-none transition-all duration-300 transform hover:scale-105",
        state ? 'bg-primary/90 text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
      )}
    >
      <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
        {isUpdating ? <Loader2 className="w-10 h-10 animate-spin"/> : <Icon className={cn("w-10 h-10", state ? 'text-yellow-300 drop-shadow-lg' : 'text-muted-foreground')} />}
        <div className="text-center">
          <p className="font-bold text-sm">{name}</p>
          <p className={cn("text-xs font-semibold uppercase tracking-widest", state ? 'text-yellow-300' : 'text-muted-foreground')}>
            {state ? (type === 'door' ? 'Terbuka' : 'Nyala') : (type === 'door' ? 'Tertutup' : 'Mati')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const SensorCard = ({ sensor }: { sensor: Sensor }) => {
  const { name, state } = sensor;
  let Icon, label, colorClass;

  if (name === 'Sensor Gerak') {
    Icon = Run;
    label = state ? 'Gerakan Terdeteksi' : 'Aman';
    colorClass = state ? 'text-destructive' : 'text-green-500';
  } else { // Sensor Cahaya
    Icon = state ? Sun : Moon;
    label = state ? 'Terang' : 'Gelap';
    colorClass = state ? 'text-yellow-400' : 'text-blue-400';
  }
  
  return (
    <Card className="bg-card/50">
        <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
           <Icon className={cn("w-10 h-10", colorClass, state && 'animate-pulse')} />
           <div className="text-center">
               <p className="font-bold text-sm">{name}</p>
               <p className={cn("text-xs font-semibold uppercase", colorClass)}>{label}</p>
           </div>
        </CardContent>
    </Card>
  );
};

export default function LalisaPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingDevices, setUpdatingDevices] = useState<string[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const devicesRef = ref(db, 'devices/');
    const unsubscribeDevices = onValue(devicesRef, (snapshot) => {
      const data = snapshot.val();
      const mergedDevices = initialDevices.map(d => ({
          ...d,
          state: data?.[d.id]?.state ?? false
      }));
      setDevices(mergedDevices);
      setLoading(false);
    });

    const sensorsRef = ref(db, 'sensors/');
    const unsubscribeSensors = onValue(sensorsRef, (snapshot) => {
        const data = snapshot.val();
        const mergedSensors = initialSensors.map(s => ({
            ...s,
            state: data?.[s.id]?.state ?? false,
            last_triggered: data?.[s.id]?.last_triggered ?? null,
        }));
        setSensors(mergedSensors);
    });

    return () => {
      unsubscribeDevices();
      unsubscribeSensors();
    };
  }, []);

  const handleToggleDevice = async (id: string, currentState: boolean) => {
    setUpdatingDevices(prev => [...prev, id]);
    try {
        const deviceRef = ref(db, 'devices/' + id);
        await set(deviceRef, { state: !currentState });
    } catch (error: any) {
        toast({ title: 'Gagal Mengubah Status', description: error.message, variant: 'destructive' });
    } finally {
        setTimeout(() => {
            setUpdatingDevices(prev => prev.filter(dId => dId !== id));
        }, 500);
    }
  };
  
  const cctvAddress = "#"; 

  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary"/></div>;
  }
  
  const userInfo: UserData | null = JSON.parse(localStorage.getItem('user') || 'null');

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-background text-foreground p-4 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Lisa Home Control</h1>
          <p className="text-sm text-muted-foreground">Selamat datang, {userInfo?.username || 'Pengguna'}</p>
        </div>
        <Button onClick={() => window.open(cctvAddress, '_blank')} variant="outline" size="sm">
            <Camera className="mr-2"/> CCTV
        </Button>
      </header>

      <main className="flex-1 space-y-6">
        <div>
            <h2 className="text-lg font-semibold mb-2">Sensor</h2>
            <div className="grid grid-cols-2 gap-4">
                {sensors.map(sensor => <SensorCard key={sensor.id} sensor={sensor} />)}
            </div>
        </div>
        <div>
            <h2 className="text-lg font-semibold mb-2">Kontrol Perangkat</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {devices.map(device => (
                    <DeviceCard 
                        key={device.id} 
                        device={device} 
                        onToggle={handleToggleDevice}
                        isUpdating={updatingDevices.includes(device.id)}
                    />
                ))}
            </div>
        </div>
      </main>
    </div>
  );
}
