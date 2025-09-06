

'use client';

import type { AttendanceRecord, OvertimeRecord, UserData } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface AttendanceHistoryPrintLayoutProps {
  records: any[];
  period: DateRange | undefined;
  summary: {
    totalHariKerja: number;
    totalJamLembur: number;
    totalMenitTerlambat: number;
    totalHariAbsen: number;
  };
}

const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp) return '-';
    if(timestamp.toDate) timestamp = timestamp.toDate();
    if(typeof timestamp === 'string') timestamp = new Date(timestamp);
    if (!(timestamp instanceof Date)) return '-';
    try {
        return format(timestamp, formatString, { locale: localeID });
    } catch (error) {
        return '-';
    }
}

const formatTotalOvertime = (checkIn: any, checkOut: any): string => {
    const checkInDate = checkIn?.toDate ? checkIn.toDate() : new Date(checkIn);
    const checkOutDate = checkOut?.toDate ? checkOut.toDate() : new Date(checkOut);
    if (!checkInDate || !checkOutDate || isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) return '-';

    const diffMins = differenceInMinutes(checkOutDate, checkInDate);
    if (diffMins < 0) return '-';

    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;

    return `${hours}j ${minutes}m`;
}


export default function AttendanceHistoryPrintLayout({ records, period, summary }: AttendanceHistoryPrintLayoutProps) {
    
  const periodTitle = period?.from 
    ? format(period.from, "d MMMM yyyy", { locale: localeID }) + (period.to ? " - " + format(period.to, "d MMMM yyyy", { locale: localeID }) : "") 
    : "Semua Waktu";

  const isSingleUser = new Set(records.map(r => r.userId)).size === 1;
  const singleUserData = isSingleUser && records.length > 0 ? records[0] : null;

  return (
    <div className="bg-white text-black p-4 font-sans printable-area">
        <header className="print-header text-center mb-8">
            <img src="https://i.imgur.com/CxaNLPj.png" alt="Logo" className="print-logo h-24 w-auto" data-ai-hint="logo company" style={{ float: 'left', marginRight: '20px' }}/>
            <div className="text-left" style={{ marginLeft: '110px' }}>
                <h1 className="text-xl font-bold text-red-600">PT. FARIKA RIAU PERKASA</h1>
                <p className="text-sm font-semibold text-blue-600 italic">one stop concrete solution</p>
                <p className="text-sm font-semibold text-blue-600">READYMIX & PRECAST CONCRETE</p>
                <p className="text-xs mt-1">Jl. Soekarno Hatta Komp. SKA No. 62 E Pekanbaru Telp. (0761) 7090228 - 571662</p>
            </div>
            <div style={{ clear: 'both' }}></div>
            <div className="watermark">PT FARIKA RIAU PERKASA</div>
        </header>
         <hr className="border-t-2 border-black my-2" />
        <h2 className="text-center font-bold text-lg uppercase my-4">LAPORAN DETAIL KEHADIRAN</h2>

      <main>
        <table className="info-table text-sm mb-4">
          <tbody>
            <tr>
              <td className='label font-semibold pr-2'>PERIODE</td>
              <td>: {periodTitle}</td>
            </tr>
            {isSingleUser && (
              <>
                <tr><td className='label font-semibold'>NAMA</td><td>: {singleUserData?.username}</td></tr>
                <tr><td className='label font-semibold'>NIK</td><td>: {singleUserData?.nik}</td></tr>
                <tr><td className='label font-semibold'>JABATAN</td><td>: {singleUserData?.jabatan}</td></tr>
                <tr><td className='label font-semibold'>LOKASI</td><td>: {singleUserData?.checkInLocationName}</td></tr>
              </>
            )}
          </tbody>
        </table>

        <table className='material-table w-full'>
          <thead>
            <tr className="material-table">
                <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Tanggal</th>
                {!isSingleUser && <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Nama</th>}
                <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Jam Masuk</th>
                <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Jam Pulang</th>
                <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Terlambat</th>
                <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Masuk Lembur</th>
                <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Pulang Lembur</th>
                <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Total Lembur</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec) => {
                const overtime = rec.overtimeData;
                return (
                  <tr key={rec.id} className="material-table">
                    <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(rec.checkInTime, 'dd/MM/yy')}</td>
                    {!isSingleUser && <td className="border border-black p-1 text-left text-xs">{rec.username}</td>}
                    <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(rec.checkInTime, 'HH:mm')}</td>
                    <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(rec.checkOutTime, 'HH:mm')}</td>
                    <td className="border border-black p-1 text-center text-xs">{(rec.lateMinutes ?? 0) > 0 ? `${rec.lateMinutes} mnt` : '-'}</td>
                    <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(overtime?.checkInTime, 'HH:mm')}</td>
                    <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(overtime?.checkOutTime, 'HH:mm')}</td>
                    <td className="border border-black p-1 text-center text-xs">{formatTotalOvertime(overtime?.checkInTime, overtime?.checkOutTime)}</td>
                  </tr>
                )
              })
            }
            {records.length === 0 && (
                <tr><td colSpan={isSingleUser ? 7 : 8} className="h-24 text-center">Tidak ada data absensi pada periode ini.</td></tr>
            )}
          </tbody>
        </table>

        {summary && (
            <div className="mt-4 text-xs" style={{ pageBreakInside: 'avoid' }}>
                <h3 className="font-bold mb-2">Ringkasan Periode</h3>
                <table className='material-table w-1/2'>
                    <tbody>
                        <tr className='material-table'>
                            <td className='border border-black p-1 font-semibold'>Total Hari Kerja</td>
                            <td className='border border-black p-1 text-right'>{summary.totalHariKerja} Hari</td>
                        </tr>
                        <tr className='material-table'>
                            <td className='border border-black p-1 font-semibold'>Total Hari Absen</td>
                            <td className='border border-black p-1 text-right'>{summary.totalHariAbsen} Hari</td>
                        </tr>
                        <tr className='material-table'>
                            <td className='border border-black p-1 font-semibold'>Total Menit Terlambat</td>
                            <td className='border border-black p-1 text-right'>{summary.totalMenitTerlambat} Menit</td>
                        </tr>
                         <tr className='material-table'>
                            <td className='border border-black p-1 font-semibold'>Total Jam Lembur</td>
                            <td className='border border-black p-1 text-right'>{summary.totalJamLembur} Jam</td>
                        </tr>
                    </tbody>
                </table>
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
              <p>(HSE K3)</p>
          </div>
      </footer>
    </div>
  );
}