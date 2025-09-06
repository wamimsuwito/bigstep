
'use client';

import * as React from 'react';
import type { UserData, ActivityLog } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceStrict } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

interface HseActivityPrintLayoutProps {
  data: (UserData & { activities?: ActivityLog[] })[];
  location: string;
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

export default function HseActivityPrintLayout({ data, location }: HseActivityPrintLayoutProps) {
  const reportDate = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: localeID });

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
        <h2 className="text-center font-bold text-lg uppercase my-4">LAPORAN KEGIATAN HARIAN</h2>
        <p className="report-date text-center text-sm mb-4">
          Lokasi: {location} - Tanggal: {reportDate}
        </p>

      <main>
        <table className="material-table w-full">
          <thead>
            <tr className="material-table">
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[5%]">No</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[15%]">Nama/NIK</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[10%]">Jabatan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[30%]">Deskripsi Kegiatan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Mulai</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Proses</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Selesai</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Durasi</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.flatMap((user, userIndex) => 
                (user.activities && user.activities.length > 0) ? user.activities.map((activity, activityIndex) => (
                    <tr key={`${user.id}-${activity.id}`}>
                        {activityIndex === 0 && (
                             <td rowSpan={user.activities?.length} className="border border-black p-1 text-center text-xs align-top">{userIndex + 1}</td>
                        )}
                        {activityIndex === 0 && (
                             <td rowSpan={user.activities?.length} className="border border-black p-1 text-left text-xs align-top">
                                <p className="font-semibold">{user.username}</p>
                                <p>{user.nik}</p>
                            </td>
                        )}
                         {activityIndex === 0 && (
                            <td rowSpan={user.activities?.length} className="border border-black p-1 text-center text-xs align-top">{user.jabatan}</td>
                         )}
                        <td className="border border-black p-1 text-left text-xs">{activity.description}</td>
                        <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(activity.createdAt, 'HH:mm')}</td>
                        <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(activity.timestampInProgress, 'HH:mm')}</td>
                        <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(activity.timestampCompleted, 'HH:mm')}</td>
                        <td className="border border-black p-1 text-center text-xs">{calculateDuration(activity.createdAt, activity.timestampCompleted)}</td>
                    </tr>
                )) : null
            ) : (
                <tr><td colSpan={8} className="h-24 text-center">Tidak ada data untuk dicetak.</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}
