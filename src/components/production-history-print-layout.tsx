
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProductionData } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface ProductionHistoryPrintLayoutProps {
  data: ProductionData[];
  dateRange?: DateRange;
}

export default function ProductionHistoryPrintLayout({ data, dateRange }: ProductionHistoryPrintLayoutProps) {
  let dateTitle = 'Semua Waktu';
  if (dateRange?.from) {
    if(dateRange.to) {
        dateTitle = `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`;
    } else {
        dateTitle = format(dateRange.from, 'dd MMMM yyyy');
    }
  }

  const totalVolume = data.reduce((acc, item) => acc + item.targetVolume, 0);

  const summaryByProject = data.reduce((acc, item) => {
    const key = `${item.namaPelanggan} (${item.mutuBeton})`;
    if (!acc[key]) {
      acc[key] = 0;
    }
    acc[key] += item.targetVolume;
    return acc;
  }, {} as Record<string, number>);

  const summaryByGrade = data.reduce((acc, item) => {
    const key = item.mutuBeton;
    if (!acc[key]) {
      acc[key] = 0;
    }
    acc[key] += item.targetVolume;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white text-black p-4 font-sans printable-area">
        <div className="watermark">PT FARIKA RIAU PERKASA</div>
      <header className="print-header text-center mb-8">
            <img src="https://i.imgur.com/CxaNLPj.png" alt="Logo" className="print-logo h-24 w-auto" data-ai-hint="logo company" style={{ float: 'left', marginRight: '20px' }}/>
            <div className="text-left" style={{ marginLeft: '110px' }}>
                <h1 className="text-xl font-bold text-red-600">PT. FARIKA RIAU PERKASA</h1>
                <p className="text-sm font-semibold text-blue-600 italic">one stop concrete solution</p>
                <p className="text-sm font-semibold text-blue-600">READYMIX & PRECAST CONCRETE</p>
                <p className="text-xs mt-1">Jl. Soekarno Hatta Komp. SKA No. 62 E Pekanbaru Telp. (0761) 7090228 - 571662</p>
            </div>
            <div style={{ clear: 'both' }}></div>
        </header>
        <hr className="border-t-2 border-black my-2" />
        <h2 className="text-center font-bold text-lg uppercase my-4">BUKU HARIAN PRODUKSI</h2>
        <p className="report-date text-center text-sm mb-4">
          Periode: {dateTitle}
        </p>

      <main>
        <table className="material-table w-full">
          <thead>
            <tr className="material-table">
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Tanggal</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Pelanggan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Lokasi Proyek</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Mutu</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Volume (M³)</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Sopir</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">No. Mobil</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Jam Kirim</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, index) => (
              <tr key={entry.id || index} className="material-table">
                <td className="border border-black p-1 text-center text-xs">{format(new Date(entry.tanggal), 'dd/MM/yy')}</td>
                <td className="border border-black p-1 text-left text-xs">{entry.namaPelanggan}</td>
                <td className="border border-black p-1 text-left text-xs">{entry.lokasiProyek}</td>
                <td className="border border-black p-1 text-center text-xs">{entry.mutuBeton}</td>
                <td className="border border-black p-1 text-right text-xs">{entry.targetVolume.toFixed(2)}</td>
                <td className="border border-black p-1 text-center text-xs">{entry.namaSopir}</td>
                <td className="border border-black p-1 text-center text-xs">{entry.nomorMobil}</td>
                <td className="border border-black p-1 text-center text-xs">{format(new Date(entry.jamSelesai), 'HH:mm')}</td>
              </tr>
            ))}
             <tr className="font-bold material-table">
                <td colSpan={4} className="border border-black p-1 text-center text-xs">TOTAL VOLUME</td>
                <td className="border border-black p-1 text-right text-xs">{totalVolume.toFixed(2)}</td>
                <td colSpan={3} className="border border-black p-1 text-center text-xs"></td>
            </tr>
          </tbody>
        </table>
        
        <div className="mt-6 text-xs" style={{ pageBreakInside: 'avoid' }}>
            <h3 className="text-sm font-bold text-center border-y border-black/50 py-1 mb-2">TOTAL PRODUKSI</h3>
            
            <div className="grid grid-cols-2 gap-x-8">
                <div>
                    <h4 className="font-bold mb-1 underline">Ringkasan per Proyek & Mutu:</h4>
                    {Object.entries(summaryByProject).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                            <span>{key}</span>
                            <span>{value.toFixed(2)} M³</span>
                        </div>
                    ))}
                </div>
                 <div>
                    <h4 className="font-bold mb-1 underline">Ringkasan per Mutu Beton:</h4>
                    {Object.entries(summaryByGrade).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                            <span>TOTAL {key}</span>
                            <span>{value.toFixed(2)} M³</span>
                        </div>
                    ))}
                     <div className="flex justify-between font-bold border-t border-black mt-2 pt-1">
                        <span>TOTAL PENGECORAN</span>
                        <span>{totalVolume.toFixed(2)} M³</span>
                    </div>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
}
