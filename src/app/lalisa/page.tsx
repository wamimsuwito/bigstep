
'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, LightbulbOff, Power, Bluetooth, BluetoothConnected, BluetoothSearching } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// UUID untuk Service dan Characteristic pada ESP32
// PASTIKAN UUID INI SAMA DENGAN YANG ADA DI KODE ESP32 ANDA
const LIGHT_CONTROL_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const LIGHT_CONTROL_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

type LightName = 'Ruang Tamu' | 'Kamar Mandi' | 'Ruang Dapur' | 'Lampu Teras';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface Light {
  id: number;
  name: LightName;
  isOn: boolean;
}

const initialLights: Light[] = [
  { id: 1, name: 'Ruang Tamu', isOn: false },
  { id: 2, name: 'Kamar Mandi', isOn: false },
  { id: 3, name: 'Ruang Dapur', isOn: false },
  { id: 4, name: 'Lampu Teras', isOn: false },
];

export default function LalisaPage() {
  const [lights, setLights] = useState<Light[]>(initialLights);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [bleCharacteristic, setBleCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const { toast } = useToast();

  const handleConnect = useCallback(async () => {
    setConnectionStatus('connecting');
    toast({ title: 'Mencari perangkat ESP32...' });

    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API tidak didukung di browser ini.');
      }

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [LIGHT_CONTROL_SERVICE_UUID] }],
        optionalServices: [LIGHT_CONTROL_SERVICE_UUID]
      });

      if (!device.gatt) {
        throw new Error('GATT Server tidak ditemukan di perangkat.');
      }

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(LIGHT_CONTROL_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(LIGHT_CONTROL_CHARACTERISTIC_UUID);

      setBleCharacteristic(characteristic);
      setConnectionStatus('connected');
      toast({ title: 'Berhasil Terhubung!', description: `Terhubung ke perangkat ${device.name || 'ESP32'}.` });

      device.addEventListener('gattserverdisconnected', () => {
        setConnectionStatus('disconnected');
        setBleCharacteristic(null);
        toast({ variant: 'destructive', title: 'Koneksi Terputus' });
      });

    } catch (error) {
      console.error('Koneksi BLE Gagal:', error);
      let errorMessage = 'Gagal terhubung. Pastikan Bluetooth aktif dan perangkat berada dalam jangkauan.';
      if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
           errorMessage = 'Tidak ada perangkat ditemukan. Pastikan ESP32 Anda aktif dan menyiarkan service yang benar.';
        } else {
           errorMessage = error.message;
        }
      }
      toast({ variant: 'destructive', title: 'Koneksi Gagal', description: errorMessage });
      setConnectionStatus('error');
      setTimeout(() => setConnectionStatus('disconnected'), 3000);
    }
  }, [toast]);

  const handleDisconnect = () => {
    if (bleCharacteristic?.service?.device?.gatt?.connected) {
      bleCharacteristic.service.device.gatt.disconnect();
    } else {
      setConnectionStatus('disconnected');
      setBleCharacteristic(null);
    }
  };

  const toggleLight = async (lightId: number) => {
    if (!bleCharacteristic) {
      toast({ variant: 'destructive', title: 'Tidak Terhubung', description: 'Hubungkan ke ESP32 terlebih dahulu.' });
      return;
    }

    try {
      // Mengirim byte tunggal yang merepresentasikan ID lampu
      const command = new Uint8Array([lightId]);
      await bleCharacteristic.writeValue(command);

      setLights(prevLights =>
        prevLights.map(light =>
          light.id === lightId ? { ...light, isOn: !light.isOn } : light
        )
      );
    } catch (error) {
      console.error('Gagal mengirim perintah:', error);
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal mengirim perintah ke ESP32.' });
    }
  };
  
  const ConnectionButtonIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <BluetoothConnected className="mr-2" />;
      case 'connecting': return <BluetoothSearching className="mr-2 animate-pulse" />;
      default: return <Bluetooth className="mr-2" />;
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 sm:p-8 bg-background">
      <Card className="w-full max-w-lg border-primary/20 shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary tracking-wider">Lisa Home Control</CardTitle>
          <CardDescription>Kontrol Lampu Rumah via Bluetooth</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            <div className="flex flex-col md:flex-row justify-center items-center gap-4 p-4 rounded-lg bg-muted/50">
              {connectionStatus === 'connected' ? (
                 <Button onClick={handleDisconnect} variant="destructive" className="w-full md:w-auto">
                    <Power className="mr-2" /> Putuskan Koneksi
                </Button>
              ) : (
                <Button onClick={handleConnect} disabled={connectionStatus === 'connecting'} className="w-full md:w-auto">
                  <ConnectionButtonIcon />
                  {connectionStatus === 'connecting' ? 'Menghubungkan...' : 'Hubungkan ke ESP32'}
                </Button>
              )}
               <div className={cn("text-sm font-semibold flex items-center gap-2", {
                   'text-green-500': connectionStatus === 'connected',
                   'text-yellow-500': connectionStatus === 'connecting',
                   'text-red-500': connectionStatus === 'disconnected' || connectionStatus === 'error',
               })}>
                   Status: <span className="capitalize">{connectionStatus}</span>
               </div>
            </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {lights.map(light => (
              <Card
                key={light.id}
                onClick={() => toggleLight(light.id)}
                className={cn(
                  "cursor-pointer select-none transition-all duration-300 transform hover:scale-105 hover:shadow-primary/20",
                  light.isOn ? 'bg-primary/90 text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                <CardContent className="flex flex-col items-center justify-center p-4 gap-2">
                  {light.isOn ? (
                    <Lightbulb className="w-12 h-12 text-yellow-300 drop-shadow-lg" />
                  ) : (
                    <LightbulbOff className="w-12 h-12 text-muted-foreground" />
                  )}
                  <div className="text-center">
                    <p className="font-bold text-base">{light.name}</p>
                    <p className={cn("text-xs font-semibold uppercase tracking-widest", light.isOn ? 'text-yellow-300' : 'text-muted-foreground')}>
                      {light.isOn ? 'NYALA' : 'MATI'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
