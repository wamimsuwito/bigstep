
'use client';

import * as React from 'react';
import type { UserData, AttendanceRecord, ActivityLog, OvertimeRecord } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, differenceInMinutes } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

interface HseAttendancePrintLayoutProps {
  data: (UserData & { attendance?: AttendanceRecord; overtime?: OvertimeRecord; activities?: ActivityLog[] })[];
  location: string;
}

const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatString, { locale: localeID });
};

const CHECK_IN_DEADLINE = { hours: 7, minutes: 30 };

const calculateLateMinutes = (checkInTime: any): number => {
    if (!checkInTime) return 0;
    const date = checkInTime.toDate();
    const deadline = new Date(date).setHours(CHECK_IN_DEADLINE.hours, CHECK_IN_DEADLINE.minutes, 0, 0);
    const late = differenceInMinutes(date, deadline);
    return late > 0 ? late : 0;
};

const calculateTotalOvertime = (overtime: OvertimeRecord | undefined): string => {
    if (!overtime || !overtime.checkInTime || !overtime.checkOutTime) return '-';
    const start = overtime.checkInTime.toDate();
    const end = overtime.checkOutTime.toDate();
    const diff = differenceInMinutes(end, start);
    if (diff <= 0) return '-';
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}j ${minutes}m`;
};

export default function HseAttendancePrintLayout({ data, location }: HseAttendancePrintLayoutProps) {
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
        <h2 className="text-center font-bold text-lg uppercase my-4">LAPORAN KEHADIRAN & KEGIATAN HARIAN</h2>
        <p className="report-date text-center text-sm mb-4">
          Lokasi: {location} - Tanggal: {reportDate}
        </p>

      <main>
        <table className="material-table w-full">
          <thead>
            <tr className="material-table">
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[15%]">Nama/NIK</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[10%]">Jabatan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Absen</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Terlambat</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[25%]">Deskripsi Kegiatan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Lembur</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[20%]">Deskripsi Lembur</th>
            </tr>
          </thead>
          <tbody>
            {data.map((user) => (
              <tr key={user.id}>
                <td className="border border-black p-1 text-left text-xs">
                  <p className="font-semibold">{user.username}</p>
                  <p>{user.nik}</p>
                </td>
                <td className="border border-black p-1 text-center text-xs">{user.jabatan}</td>
                <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(user.attendance?.checkInTime, 'HH:mm')} - {safeFormatTimestamp(user.attendance?.checkOutTime, 'HH:mm')}</td>
                <td className="border border-black p-1 text-center text-xs">{calculateLateMinutes(user.attendance?.checkInTime) > 0 ? `${calculateLateMinutes(user.attendance?.checkInTime)} mnt` : '-'}</td>
                <td className="border border-black p-1 text-left text-xs whitespace-pre-wrap">
                  {(user.activities || []).map(act => act.description).join('\n---\n')}
                </td>
                <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(user.overtime?.checkInTime, 'HH:mm')} - {safeFormatTimestamp(user.overtime?.checkOutTime, 'HH:mm')}</td>
                <td className="border border-black p-1 text-left text-xs whitespace-pre-wrap">{user.overtime?.description || '-'}</td>
              </tr>
            ))}
            {data.length === 0 && (
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
              <p>(HSE K3)</p>
          </div>
      </footer>
    </div>
  );
}
