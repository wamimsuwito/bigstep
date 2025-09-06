
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PemasukanLogEntry } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface LaporanPemasukanPrintLayoutProps {
  data: PemasukanLogEntry[];
  location: string;
  period: DateRange | undefined;
}


const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatString, { locale: id });
};

export default function LaporanPemasukanPrintLayout({ data, location, period }: LaporanPemasukanPrintLayoutProps) {
  
  const periodTitle = period?.from 
    ? format(period.from, "d MMMM yyyy", { locale: id }) + (period.to ? " - " + format(period.to, "d MMMM yyyy", { locale: id }) : "") 
    : "Semua Waktu";
    
  const summary = data.reduce((acc, item) => {
    const materialKey = item.material.toUpperCase();
    if (!acc[materialKey]) {
        acc[materialKey] = { total: 0, unit: item.unit };
    }
    acc[materialKey].total += item.jumlah;
    return acc;
  }, {} as Record<string, { total: number; unit: string }>);


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
        <h2 className="text-center font-bold text-lg uppercase my-4">LAPORAN PEMASUKAN MATERIAL</h2>
        <p className="report-date text-center text-sm mb-4">
          Lokasi: {location} - Periode: {periodTitle}
        </p>

      <main>
        <table className="material-table w-full">
          <thead>
            <tr className="material-table">
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Waktu</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Material</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">No. SPB</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Kapal/Truk</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Sopir/Kapten</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Jumlah</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, index) => (
              <tr key={entry.id || index}>
                <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(entry.timestamp, 'dd/MM/yy HH:mm')}</td>
                <td className="border border-black p-1 text-center text-xs">{entry.material}</td>
                <td className="border border-black p-1 text-center text-xs">{entry.noSpb}</td>
                <td className="border border-black p-1 text-center text-xs">{entry.namaKapal}</td>
                <td className="border border-black p-1 text-center text-xs">{entry.namaSopir}</td>
                <td className="border border-black p-1 text-right text-xs">{entry.jumlah.toLocaleString('id-ID')} {entry.unit}</td>
                <td className="border border-black p-1 text-center text-xs">{entry.keterangan || '-'}</td>
              </tr>
            ))}
             {data.length === 0 && (
                <tr><td colSpan={7} className="h-24 text-center">Tidak ada data untuk dicetak.</td></tr>
            )}
          </tbody>
        </table>
        
        <div className="mt-4 flex justify-end">
            <div className="w-1/2">
                <h3 className="font-bold text-sm mb-1">Ringkasan Total Pemasukan:</h3>
                <table className="w-full material-table text-xs">
                    <tbody>
                        {Object.entries(summary).map(([material, { total, unit }]) => (
                            <tr key={material}>
                                <td className="font-semibold border border-black p-1">Total {material}</td>
                                <td className="text-right border border-black p-1">{total.toLocaleString('id-ID')} {unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </main>
    </div>
  );
}
