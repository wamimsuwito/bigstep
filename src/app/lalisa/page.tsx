
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApp, initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, Unsubscribe } from 'firebase/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lightbulb, LightbulbOff, AirVent, Fan, DoorOpen, DoorClosed, Camera, Sun, Moon, PersonStanding, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserData } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { firebaseConfig } from '@/lib/firebase';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


// --- Data Structures and Initial States ---

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

const initialDevices: Device[] = [
  { id: 'lampu_teras', name: 'Lampu Teras', pin: 2, type: 'light', state: false },
  { id: 'lampu_taman', name: 'Lampu Taman', pin: 4, type: 'light', state: false },
  { id: 'lampu_ruang_tamu', name: 'Lampu Ruang Tamu', pin: 5, type: 'light', state: false },
  { id: 'lampu_dapur', name: 'Lampu Dapur', pin: 18, type: 'light', state: false },
  { id: 'lampu_kamar_utama', name: 'Lampu Kamar Utama', pin: 19, type: 'light', state: false },
  { id: 'lampu_kamar_anak', name: 'Lampu Kamar Anak', pin: 21, type: 'light', state: false },
  { id: 'lampu_ruang_keluarga', name: 'Lampu Ruang Keluarga', pin: 22, type: 'light', state: false },
  { id: 'lampu_ruang_makan', name: 'Lampu Ruang Makan', pin: 23, type: 'light', state: false },
  { id: 'ac_kamar_utama', name: 'AC Kamar Utama', pin: 25, type: 'ac', state: false },
  { id: 'ac_kamar_anak', name: 'AC Kamar Anak', pin: 26, type: 'ac', state: false },
  { id: 'pintu_garasi', name: 'Pintu Garasi', pin: 27, type: 'door', state: false },
];

const initialSensors: Sensor[] = [
  { id: 'sensor_gerak', name: 'Sensor Gerak', pin: 13, state: false, last_triggered: null },
  { id: 'sensor_cahaya', name: 'Sensor Cahaya', pin: 12, state: false, last_triggered: null },
];

// --- Firebase Initialization (Safe Singleton) ---
let rtdbApp;
try {
  rtdbApp = getApp('rtdb');
} catch (e) {
  rtdbApp = initializeApp(firebaseConfig, 'rtdb');
}
const rtdb = getDatabase(rtdbApp);


// --- UI Components ---

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
    Icon = PersonStanding;
    label = state ? 'Gerakan Terdeteksi' : 'Aman';
    colorClass = state ? 'text-destructive' : 'text-green-500';
  } else { 
    Icon = state ? Sun : Moon;
    label = state ? 'Terang' : 'Gelap';
    colorClass = state ? 'text-yellow-400' : 'text-blue-400';
  }
  
  return (
    <Card className="bg-card/50">
        <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
           <Icon className={cn("w-10 h-10", colorClass, state && name === 'Sensor Gerak' && 'animate-pulse')} />
           <div className="text-center">
               <p className="font-bold text-sm">{name}</p>
               <p className={cn("text-xs font-semibold uppercase", colorClass)}>{label}</p>
           </div>
        </CardContent>
    </Card>
  );
};


// --- Main Page Component ---

export default function LalisaPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State Management
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [sensors, setSensors] = useState<Sensor[]>(initialSensors);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingDevices, setUpdatingDevices] = useState<string[]>([]);
  
  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      setUserInfo(JSON.parse(userString));
    } else {
      router.push('/login');
    }
  }, [router]);


  // Function to establish Firebase connection and listeners
  const connectToFirebase = useCallback(() => {
    setConnectionStatus('connecting');
    setErrorMessage(null);

    const devicesRef = ref(rtdb, 'devices/');
    const sensorsRef = ref(rtdb, 'sensors/');
    
    let devicesUnsubscribe: Unsubscribe | null = null;
    let sensorsUnsubscribe: Unsubscribe | null = null;

    const cleanup = () => {
        if (devicesUnsubscribe) devicesUnsubscribe();
        if (sensorsUnsubscribe) sensorsUnsubscribe();
    };

    devicesUnsubscribe = onValue(devicesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setDevices(prevDevices => prevDevices.map(d => ({ ...d, state: data[d.id]?.state ?? d.state })));
        }
        setConnectionStatus('connected');
    }, (error) => {
        console.error("Firebase devices listener error:", error);
        setErrorMessage("Koneksi ke data perangkat gagal. Periksa aturan keamanan Firebase RTDB Anda. Aturan harus mengizinkan pembacaan.");
        setConnectionStatus('error');
        cleanup();
    });

    sensorsUnsubscribe = onValue(sensorsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setSensors(prevSensors => prevSensors.map(s => ({ ...s, state: data[s.id]?.state ?? s.state })));
        }
    }, (error) => {
        console.error("Firebase sensors listener error:", error);
        setErrorMessage("Koneksi ke data sensor gagal.");
        setConnectionStatus('error');
        cleanup();
    });

    return cleanup;
  }, []);

  const handleToggleDevice = async (id: string, currentState: boolean) => {
    if (connectionStatus !== 'connected') {
        toast({ title: "Tidak Terhubung", description: "Hubungkan ke perangkat terlebih dahulu.", variant: "destructive" });
        return;
    }
    setUpdatingDevices(prev => [...prev, id]);
    try {
        await set(ref(rtdb, `devices/${id}`), { state: !currentState });
    } catch (error: any) {
        toast({ title: 'Gagal Mengubah Status', description: error.message, variant: 'destructive' });
    } finally {
        setTimeout(() => setUpdatingDevices(prev => prev.filter(dId => dId !== id)), 500);
    }
  };

  const cctvAddress = "#"; 

  // Render logic based on connection status
  const renderConnectionButton = () => {
    switch(connectionStatus) {
        case 'connecting':
            return <Button disabled className="w-full"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menghubungkan...</Button>;
        case 'connected':
            return <Button variant="secondary" className="w-full bg-green-600 hover:bg-green-700"><Wifi className="mr-2 h-4 w-4" />Terhubung</Button>;
        case 'error':
            return <Button variant="destructive" onClick={connectToFirebase} className="w-full"><AlertCircle className="mr-2 h-4 w-4" />Coba Lagi</Button>;
        case 'disconnected':
        default:
            return <Button onClick={connectToFirebase} className="w-full"><WifiOff className="mr-2 h-4 w-4" />Hubungkan ke Perangkat</Button>;
    }
  }

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
      
      <div className="py-2">
        {renderConnectionButton()}
        {errorMessage && (
            <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Koneksi Gagal</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
        )}
      </div>

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
