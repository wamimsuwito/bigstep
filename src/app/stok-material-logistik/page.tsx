

'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { UserData, LocationData, CementSiloStock, ResetHistoryEntry, SiloData } from '@/lib/types';
import { ArrowLeft, Package, Warehouse, Loader2, History, Save, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { db, collection, getDocs, doc, setDoc, addDoc, onSnapshot } from '@/lib/firebase';

const materialConfig = [
    { key: 'pasir', name: 'PASIR', unit: 'M³' },
    { key: 'batu', name: 'BATU', unit: 'M³' },
    { key: 'air', name: 'AIR', unit: 'KG' },
    { key: 'sikaVz', name: 'SIKA VZ', unit: 'LT' },
    { key: 'sikaNn', 'name': 'SIKA NN', 'unit': 'LT' },
    { key: 'visco', name: 'VISCO', 'unit': 'LT' },
];

const unitBPs = ['BP-1', 'BP-2', 'BP-3'];
const BUFFER_SILO_COUNT = 12;
const BUFFER_TANK_COUNT = 30;

const DEFAULT_CAPACITY = {
    'BP-1': 90000,
    'BP-2': 90000,
    'BP-3': 120000,
    'Buffer Silo': 120000,
    'Buffer Tangki': 35000,
} as const;

type StockValues = { [key: string]: string | number };
type CementStockInput = { [key: string]: { [siloId: string]: SiloData } };

const initialStockValues: StockValues = materialConfig.reduce((acc, mat) => {
    acc[mat.key] = '0';
    return acc;
}, {} as StockValues);


const initialCementStockInput: CementStockInput = {
    ...unitBPs.reduce((acc, unit) => ({ ...acc, [unit]: {} }), {}),
    'Buffer Silo': {},
    'Buffer Tangki': {},
}

const formatNumberDisplay = (numStr: string | number | undefined, fractionDigits = 2) => {
    if (numStr === undefined || numStr === null) return "0";
    const num = Number(numStr);
    if (isNaN(num)) return "0";
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
};

export default function StokMaterialLogistikPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [userInfo, setUserInfo] = useState<UserData | null>(null);
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>('');

    // Stocks State
    const [aggregateStock, setAggregateStock] = useState<StockValues>(initialStockValues);
    const [bpUnitStocks, setBpUnitStocks] = useState<Record<string, CementSiloStock>>({});
    const [bufferSiloStock, setBufferSiloStock] = useState<CementSiloStock | null>(null);
    const [bufferTankStock, setBufferTankStock] = useState<CementSiloStock | null>(null);
    
    // Opname State
    const [opnameInputs, setOpnameInputs] = useState<StockValues>(initialStockValues);
    const [cementOpnameInputs, setCementOpnameInputs] = useState<CementStockInput>(initialCementStockInput);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [resetHistory, setResetHistory] = useState<ResetHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    const totalCementStock = useMemo(() => {
        let total = 0;
        const allStocks = [
            ...Object.values(bpUnitStocks),
            bufferSiloStock,
            bufferTankStock
        ];

        allStocks.forEach(stockGroup => {
            if (stockGroup?.silos) {
                total += Object.values(stockGroup.silos).reduce((sum, silo) => sum + (silo.stock || 0), 0);
            }
            if (stockGroup?.tanks) {
                 total += Object.values(stockGroup.tanks).reduce((sum, silo) => sum + (silo.stock || 0), 0);
            }
        });
        return total;
    }, [bpUnitStocks, bufferSiloStock, bufferTankStock]);


    const fetchInitialOpnameData = useCallback(async (location: string) => {
        try {
            const aggStockDoc = await getDocs(collection(db, `locations/${location}/stock`));
            let aggData: StockValues = {};
            if (!aggStockDoc.empty) {
                aggData = aggStockDoc.docs[0].data() as StockValues;
            }
            setOpnameInputs({ ...initialStockValues, ...aggData });

            const cementInputs: CementStockInput = JSON.parse(JSON.stringify(initialCementStockInput));
            for (const unit of unitBPs) {
                const stockDoc = await getDocs(collection(db, `locations/${location}/stock_cement_silo_${unit}`));
                cementInputs[unit] = stockDoc.empty ? {} : (stockDoc.docs[0].data() as CementSiloStock).silos || {};
            }
            const bufSiloDoc = await getDocs(collection(db, `locations/${location}/stock_buffer_silo`));
            cementInputs['Buffer Silo'] = bufSiloDoc.empty ? {} : (bufSiloDoc.docs[0].data() as CementSiloStock).silos || {};
            
            const bufTankDoc = await getDocs(collection(db, `locations/${location}/stock_buffer_tank`));
            cementInputs['Buffer Tangki'] = bufTankDoc.empty ? {} : (bufTankDoc.docs[0].data() as any).tanks || {};
            
            setCementOpnameInputs(cementInputs);
        } catch (e) {
            console.error("Failed to fetch opname data:", e);
        }
    }, []);

    useEffect(() => {
        const dummyUser: UserData = JSON.parse(localStorage.getItem('user') || '{}');
        setUserInfo(dummyUser);
        
        const fetchLocations = async () => {
            const locsSnap = await getDocs(collection(db, 'locations'));
            const locsData = locsSnap.docs.map(d => ({id: d.id, ...d.data()}) as LocationData);
            setLocations(locsData);

            const locationToUse = dummyUser.lokasi || locsData[0]?.name;
            if (locationToUse) {
                setSelectedLocation(locationToUse);
            } else {
                setIsFetching(false);
            }
        };

        fetchLocations();

    }, [router]);
    
    useEffect(() => {
        if (!selectedLocation) return;
    
        setIsFetching(true);
        
        // Fetch initial data for opname form once
        fetchInitialOpnameData(selectedLocation);

        const setupListener = (path: string, setter: React.Dispatch<React.SetStateAction<any>>, failureMsg: string) => {
            const docRef = doc(db, path);
            const unsub = onSnapshot(docRef, 
                (docSnap) => {
                    setter(docSnap.exists() ? docSnap.data() : null);
                }, 
                (error) => {
                    console.error(`Error fetching ${path}:`, error);
                    toast({ title: failureMsg, variant: "destructive" });
                }
            );
            return unsub;
        };

        const historyUnsub = onSnapshot(collection(db, `locations/${selectedLocation}/reset_history`), (snap) => {
             setResetHistory(snap.docs.map(d => ({...d.data(), id: d.id}) as ResetHistoryEntry).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        });

        const aggregateUnsub = setupListener(
            `locations/${selectedLocation}/stock/aggregates`,
            (data) => setAggregateStock({ ...initialStockValues, ...(data || {}) }),
            "Gagal memuat stok agregat"
        );

        const bpUnitUnsubs = unitBPs.map(unit => 
            setupListener(
                `locations/${selectedLocation}/stock_cement_silo_${unit}/main`,
                (data) => setBpUnitStocks(prev => ({ ...prev, [unit]: (data || { silos: {} }) })),
                `Gagal memuat stok semen ${unit}`
            )
        );

        const bufferSiloUnsub = setupListener(
             `locations/${selectedLocation}/stock_buffer_silo/main`,
             (data) => setBufferSiloStock(data),
            "Gagal memuat stok buffer silo"
        );

        const bufferTankUnsub = setupListener(
             `locations/${selectedLocation}/stock_buffer_tank/main`,
             (data) => setBufferTankStock(data),
            "Gagal memuat stok buffer tank"
        );
        
        // Combine all unsubscribe functions
        const allUnsubs = [historyUnsub, aggregateUnsub, ...bpUnitUnsubs, bufferSiloUnsub, bufferTankUnsub];
        
        const timer = setTimeout(() => setIsFetching(false), 1500);

        return () => {
            clearTimeout(timer);
            allUnsubs.forEach(unsub => unsub());
        };
    
    }, [selectedLocation, toast, fetchInitialOpnameData]);


    const handleOpnameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setOpnameInputs(prev => ({ ...prev, [name]: value }));
    };

    const handleCementOpnameInputChange = (group: string, siloId: string, field: 'stock' | 'capacity', value: string) => {
        const amount = parseInt(value, 10) || 0;
        setCementOpnameInputs(prev => ({
            ...prev,
            [group]: {
                ...prev[group],
                [siloId]: {
                    ...prev[group]?.[siloId],
                    status: prev[group]?.[siloId]?.status || 'aktif', // Preserve status
                    [field]: amount,
                },
            }
        }));
    };

    const handleResetSemuaStok = async () => {
        if (!selectedLocation || !userInfo) return;
        setIsLoading(true);
        const historyCollectionRef = collection(db, `locations/${selectedLocation}/reset_history`);

        try {
            // Aggregate & Additives
            const aggregateDataToSave: Record<string, number> = {};
            for (const key in opnameInputs) {
                if(materialConfig.some(m => m.key === key)) {
                     aggregateDataToSave[key] = Number(opnameInputs[key]) || 0;
                }
            }
            await setDoc(doc(db, `locations/${selectedLocation}/stock`, 'aggregates'), aggregateDataToSave, { merge: true });
            
            const historyEntry: Omit<ResetHistoryEntry, 'id'> = {
                timestamp: new Date().toISOString(),
                item: 'Agregat & Aditif',
                location: selectedLocation,
                stokSebelum: aggregateStock,
                stokSesudah: aggregateDataToSave,
                updatedBy: userInfo.username
            };
            await addDoc(historyCollectionRef, historyEntry);

            // Cement
            for (const group of Object.keys(cementOpnameInputs)) {
                let stockRefPath: string;
                let dataToSet: { silos?: { [key: string]: SiloData }, tanks?: { [key: string]: SiloData } };

                if (unitBPs.includes(group)) {
                    stockRefPath = `locations/${selectedLocation}/stock_cement_silo_${group}/main`;
                    dataToSet = { silos: cementOpnameInputs[group] };
                } else if (group === 'Buffer Silo') {
                    stockRefPath = `locations/${selectedLocation}/stock_buffer_silo/main`;
                    dataToSet = { silos: cementOpnameInputs[group] };
                } else if (group === 'Buffer Tangki') {
                    stockRefPath = `locations/${selectedLocation}/stock_buffer_tank/main`;
                    dataToSet = { tanks: cementOpnameInputs[group] };
                } else {
                    continue;
                }
                await setDoc(doc(db, stockRefPath), dataToSet, { merge: true });
            }
             const cementHistoryEntry: Omit<ResetHistoryEntry, 'id'> = {
                timestamp: new Date().toISOString(),
                item: 'Semen (Semua Silo)',
                location: selectedLocation,
                stokSebelum: { total: totalCementStock },
                stokSesudah: { total: Object.values(cementOpnameInputs).flatMap(Object.values).reduce((a,b) => a + (b.stock || 0), 0) },
                updatedBy: userInfo.username
            };
            await addDoc(historyCollectionRef, cementHistoryEntry);

            toast({ title: 'Semua Stok Direset', description: 'Stok semua material telah berhasil diperbarui.' });
        } catch(e) {
            console.error(e);
            toast({ title: 'Gagal mereset stok', variant: 'destructive'});
        } finally {
            setIsResetDialogOpen(false);
            setIsLoading(false);
        }
    };
    
    const getSiloCountForOpname = useCallback((groupKey: keyof typeof DEFAULT_CAPACITY) => {
      if (selectedLocation.toUpperCase().includes('BAUNG') && groupKey === 'BP-1') {
          return 4;
      }
      if (unitBPs.includes(groupKey)) return 6; // MAIN_SILO_COUNT
      if (groupKey === 'Buffer Silo') return BUFFER_SILO_COUNT;
      if (groupKey === 'Buffer Tangki') return BUFFER_TANK_COUNT;
      return 0;
    }, [selectedLocation]);

    const renderOpnameTable = (title: string, groupKey: keyof typeof DEFAULT_CAPACITY, siloPrefix: string) => {
        const siloCount = getSiloCountForOpname(groupKey);
        if (siloCount === 0) return null;

        return (
            <div>
                <h4 className="font-medium mb-2">{title}</h4>
                <div className="space-y-3">
                     <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground"><Label className="col-span-1">Item</Label><Label className="text-right">Stok Aktual (kg)</Label><Label className="text-right">Kapasitas (kg)</Label></div>
                    {Array.from({ length: siloCount }).map((_, i) => {
                        const siloDisplayNumber = i + 1;
                        const siloId = `${siloPrefix.toLowerCase()}-${siloDisplayNumber}`;
                        const siloData = cementOpnameInputs[groupKey]?.[siloId];
                        const defaultCap = DEFAULT_CAPACITY[groupKey] || 120000;
                        return (
                             <div key={siloId} className="grid grid-cols-3 items-center gap-2">
                                <Label className="w-full capitalize font-normal">{`${siloPrefix} ${siloDisplayNumber}`}</Label>
                                <Input
                                    type="number"
                                    value={siloData?.stock || ''}
                                    onChange={(e) => handleCementOpnameInputChange(groupKey, siloId, 'stock', e.target.value)}
                                    placeholder="0"
                                    className="text-right"
                                />
                                 <Input
                                    type="number"
                                    value={siloData?.capacity || ''}
                                    onChange={(e) => handleCementOpnameInputChange(groupKey, siloId, 'capacity', e.target.value)}
                                    placeholder={String(defaultCap)}
                                    className="text-right"
                                />
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    }
    
    const getSiloCountForStockTable = useCallback((unit: string) => {
        if (selectedLocation.toUpperCase().includes('BAUNG') && unit === 'BP-1') {
            return 4;
        }
        return 6; // MAIN_SILO_COUNT
    }, [selectedLocation]);

    const renderStockTable = (title: string, stockData: CementSiloStock | null, count: number, prefix: string) => {
        const stockItems = stockData ? (prefix === 'tank' ? stockData.tanks : stockData.silos) : {};
        const allItems = Array.from({ length: count }, (_, i) => {
            const itemId = `${prefix}-${i + 1}`;
            return { id: itemId, data: stockItems?.[itemId] || { stock: 0, status: 'aktif' } };
        });

        const total = allItems.reduce((a, b) => a + (b.data?.stock || 0), 0);
        
        return (
            <Card>
                <CardHeader className='pb-2'><CardTitle className='text-base'>{title}</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableBody>
                            {allItems.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className='font-medium capitalize'>{item.id.replace('-', ' ')}</TableCell>
                                    <TableCell className='text-right'>{formatNumberDisplay(item.data.stock)} KG</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableRow className='bg-muted/50 font-bold'>
                            <TableCell>Total</TableCell>
                            <TableCell className='text-right'>{formatNumberDisplay(total)} KG</TableCell>
                        </TableRow>
                    </Table>
                </CardContent>
            </Card>
        );
    }
    
    if (isFetching || !userInfo) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    return (
        <div className="min-h-screen p-4 sm:p-6 md:p-8">
            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Konfirmasi Reset Semua Stok</AlertDialogTitle><AlertDialogDescription>Tindakan ini akan mengatur ulang jumlah stok **SEMUA MATERIAL** (Agregat, Aditif, dan Semen) sesuai dengan input opname Anda dan akan dicatat dalam riwayat.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Tidak</AlertDialogCancel><AlertDialogAction onClick={handleResetSemuaStok} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Yakin, Reset Semua Stok'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <header className="flex items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4"><Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft /></Button><div><h1 className="text-2xl font-bold tracking-wider flex items-center gap-3"><Package />Stok Material</h1><p className="text-muted-foreground">Lokasi: {selectedLocation}</p></div></div>
            </header>
            <main className='space-y-8'>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card className='lg:col-span-1'><CardHeader><CardTitle>Stok Agregat & Aditif</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                {materialConfig.map(mat => (
                                    <TableRow key={mat.key}>
                                        <TableCell className="font-medium">{mat.name}</TableCell>
                                        <TableCell className='text-right font-mono'>{formatNumberDisplay(aggregateStock[mat.key] || 0)} {mat.unit}</TableCell>
                                    </TableRow>
                                ))}
                                <TableRow className="font-bold border-t-2">
                                    <TableCell>SEMEN (TOTAL)</TableCell>
                                    <TableCell className="text-right font-mono">{formatNumberDisplay(totalCementStock)} KG</TableCell>
                                </TableRow>
                            </Table>
                        </CardContent>
                    </Card>
                    <Card className='lg:col-span-2'><CardHeader><CardTitle>Stok Semen (KG)</CardTitle><CardDescription>Total Stok Semen di Lokasi: <span className='font-bold text-primary'>{formatNumberDisplay(totalCementStock)} KG</span></CardDescription></CardHeader>
                      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {unitBPs.map(unit => renderStockTable(`Stok Unit ${unit}`, bpUnitStocks[unit], getSiloCountForStockTable(unit), 'silo'))}
                      </CardContent>
                    </Card>
                </div>
                 <Card>
                    <CardHeader><CardTitle>Stok Semen Buffer (KG)</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {renderStockTable('Buffer Silo', bufferSiloStock, BUFFER_SILO_COUNT, 'silo')}
                        {renderStockTable('Buffer Tangki', bufferTankStock, BUFFER_TANK_COUNT, 'tank')}
                    </CardContent>
                 </Card>
                
                 <Card>
                    <CardHeader><CardTitle>Reset Stok / Opname Material</CardTitle><CardDescription>Masukkan jumlah stok aktual dan kapasitas per silo berdasarkan hasil opname. Semua nilai akan diatur ulang.</CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                             <h4 className="font-semibold mb-2 text-muted-foreground">AGREGAT & ADITIF</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">{materialConfig.map(material => (<div key={`opname-${material.name}`} className='space-y-1.5'><Label htmlFor={`opname-${material.key}`}>{material.name} ({material.unit})</Label><Input id={`opname-${material.key}`} type="number" name={material.key} value={opnameInputs[material.key] || ''} onChange={handleOpnameInputChange} placeholder="0" className="text-right tabular-nums" /></div>))}</div>
                        </div>
                        <div className="pt-4 border-t">
                            <h4 className="font-semibold mb-2 text-muted-foreground">SEMEN PER SILO (KG)</h4>
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {unitBPs.map((unit) => renderOpnameTable(`Unit ${unit}`, unit as keyof typeof DEFAULT_CAPACITY, 'Silo'))}
                                {renderOpnameTable('Buffer Silo', 'Buffer Silo', 'Silo')}
                                {renderOpnameTable('Buffer Tangki', 'Buffer Tangki', 'Tangki')}
                            </div>
                        </div>
                        <div className="flex justify-end pt-6 mt-6 border-t">
                            <Button variant="destructive" onClick={() => setIsResetDialogOpen(true)} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Reset Semua Stok Sesuai Opname
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                 {resetHistory.length > 0 && (<Card><CardHeader><CardTitle className='flex items-center gap-3'><History/>Riwayat Reset Stok</CardTitle></CardHeader><CardContent><div className="overflow-x-auto border rounded-lg max-h-96"><Table><TableHeader><TableRow><TableHead className='w-48'>Waktu Reset</TableHead><TableHead>Oleh</TableHead><TableHead>Item</TableHead><TableHead>Lokasi</TableHead><TableHead className="text-right">Stok Sebelum</TableHead><TableHead className="text-right">Stok Sesudah</TableHead></TableRow></TableHeader><TableBody>{resetHistory.map(entry => (<TableRow key={entry.id}><TableCell className="font-medium">{format(new Date(entry.timestamp), 'dd MMM yyyy, HH:mm', { locale: localeID })}</TableCell><TableCell>{entry.updatedBy}</TableCell><TableCell>{entry.item}</TableCell><TableCell>{entry.location}</TableCell><TableCell className="text-right">{formatNumberDisplay(entry.stokSebelum.total || 0)}</TableCell><TableCell className="text-right">{formatNumberDisplay(entry.stokSesudah.total || 0)}</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>)}
            </main>
        </div>
    );
}
