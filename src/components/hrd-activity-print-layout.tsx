
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

export default function HrdActivityPrintLayout({ data, title }: HrdActivityPrintLayoutProps) {
  const reportDate = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: localeID });
  
  const allPhotos = data.flatMap(activity => 
    [
        activity.photoInitial && { src: activity.photoInitial, label: `Awal: ${activity.description.substring(0, 30)}...`, timestamp: activity.createdAt },
        activity.photoInProgress && { src: activity.photoInProgress, label: `Proses: ${activity.description.substring(0, 30)}...`, timestamp: activity.timestampInProgress },
        activity.photoCompleted && { src: activity.photoCompleted, label: `Selesai: ${activity.description.substring(0, 30)}...`, timestamp: activity.timestampCompleted },
    ].filter((photo): photo is { src: string; label: string; timestamp: any; } => !!photo)
  );


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
                        <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(activity.createdAt, 'HH:mm')}</td>
                        <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(activity.timestampInProgress, 'HH:mm')}</td>
                        <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(activity.timestampCompleted, 'HH:mm')}</td>
                        <td className="border border-black p-1 text-center text-xs">{calculateDuration(activity.createdAt, activity.timestampCompleted)}</td>
                    </tr>
                ))
             : (
                <tr><td colSpan={7} className="h-24 text-center">Tidak ada data untuk dicetak.</td></tr>
            )}
          </tbody>
        </table>

         {allPhotos.length > 0 && (
          <div className="mt-8" style={{ pageBreakInside: 'avoid' }}>
            <h3 className="font-bold text-center border-t-2 border-black pt-2 mb-4">LAMPIRAN FOTO KEGIATAN</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {allPhotos.map((photo, index) => (
                <div key={index} className="text-center" style={{ breakInside: 'avoid' }}>
                  <img src={photo?.src || ''} alt={photo?.label} className="border border-black w-full" data-ai-hint="activity evidence" />
                  <p className="text-xs mt-1">
                    <strong>{photo?.label}</strong>
                    <br />
                    <span>{safeFormatTimestamp(photo?.timestamp, 'dd MMM, HH:mm')}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
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
