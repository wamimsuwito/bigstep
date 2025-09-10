
'use client';

import * as React from 'react';
import type { ActivityLog } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceStrict } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

interface HrdActivityPrintLayoutProps {
  data: ActivityLog[];
  title: string;
}

const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatString, { locale: localeID });
};

const calculateDuration = (start: any, end: any): string => {
    if (!start || !end) return '-';
    const startDate = start.toDate ? start.toDate() : new Date(start);
    const endDate = end.toDate ? end.toDate() : new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '-';
    return formatDistanceStrict(endDate, startDate, { locale: localeID });
};

const PhotoCell = ({ src, timestamp }: { src?: string, timestamp: any }) => {
    return (
        <div className="flex flex-col items-center justify-center p-1">
            {src ? (
                <>
                    <img 
                        src={src} 
                        alt="Foto Kegiatan" 
                        className="photo-evidence"
                        style={{ width: '50mm', height: '50mm', objectFit: 'cover', border: '1px solid black' }}
                        data-ai-hint="activity evidence"
                    />
                    <span className="text-[8px] mt-1">{safeFormatTimestamp(timestamp, 'HH:mm:ss')}</span>
                </>
            ) : (
                <span>-</span>
            )}
        </div>
    );
};


export default function HrdActivityPrintLayout({ data, title }: HrdActivityPrintLayoutProps) {
  const reportDate = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: localeID });
  
  return (
    <div className="bg-white text-black p-4 font-sans printable-area">
        <style jsx global>{`
            @media print {
                .photo-evidence {
                    width: 50mm !important;
                    height: 50mm !important;
                    object-fit: cover !important;
                }
            }
        `}</style>
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
        <h2 className="text-center font-bold text-lg uppercase my-4">{title}</h2>
        <p className="report-date text-center text-sm mb-4">
          Tanggal Cetak: {reportDate}
        </p>

      <main>
        <table className="material-table w-full">
          <thead>
            <tr className="material-table">
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[5%]">No</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[15%]">Nama Karyawan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[30%]">Deskripsi Kegiatan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Mulai</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Proses</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Selesai</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Durasi</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.map((activity, index) => (
                    <tr key={activity.id}>
                        <td className="border border-black p-1 text-center text-xs align-top">{index + 1}</td>
                        <td className="border border-black p-1 text-left text-xs align-top">
                            <p className="font-semibold">{activity.username}</p>
                        </td>
                        <td className="border border-black p-1 text-left text-xs">{activity.description}</td>
                        <td className="border border-black p-1 text-center text-xs"><PhotoCell src={activity.photoInitial} timestamp={activity.createdAt} /></td>
                        <td className="border border-black p-1 text-center text-xs"><PhotoCell src={activity.photoInProgress} timestamp={activity.timestampInProgress} /></td>
                        <td className="border border-black p-1 text-center text-xs"><PhotoCell src={activity.photoCompleted} timestamp={activity.timestampCompleted} /></td>
                        <td className="border border-black p-1 text-center text-xs align-top">{calculateDuration(activity.createdAt, activity.timestampCompleted)}</td>
                    </tr>
                ))
             : (
                <tr><td colSpan={7} className="h-24 text-center">Tidak ada data untuk dicetak.</td></tr>
            )}
          </tbody>
        </table>
      </main>
      <footer className="signature-section mt-16">
          <div>
              <p>Mengetahui,</p>
              <div className="signature-box"></div>
              <p>(Pimpinan)</p>
          </div>
          <div>
              <p>Disiapkan oleh,</p>
              <div className="signature-box"></div>
              <p>(HRD Pusat)</p>
          </div>
      </footer>
    </div>
  );
}
