
'use client';

import * as React from 'react';
import type { ActivityLog, UserData } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, formatDistanceStrict, isAfter } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

interface HrdActivityPrintLayoutProps {
  data: (UserData & { activities?: ActivityLog[] })[];
  title?: string;
  location?: string;
  currentUser: UserData | null;
}

const toValidDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date;
    }
    return null;
};


const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    const date = toValidDate(timestamp);
    if (!date) return '-';
    try {
        return format(date, formatString, { locale: localeID });
    } catch (error) {
        return '-';
    }
};

const calculateDuration = (start: any, end: any): string => {
    if (!start || !end) return '-';
    const startDate = toValidDate(start);
    const endDate = toValidDate(end);
    if (!startDate || !endDate) return '-';
    return formatDistanceStrict(endDate, startDate, { locale: localeID });
};

const CompletionStatus = ({ activity }: { activity: ActivityLog }) => {
    const target = toValidDate(activity.targetTimestamp);
    const completed = toValidDate(activity.timestampCompleted);

    if (!target || !completed) {
        return null;
    }

    if (isAfter(completed, target)) {
        return <p className="font-bold text-red-600">TERLAMBAT</p>;
    } else if (isAfter(target, completed)) {
        return <p className="font-bold text-green-600">LEBIH CEPAT</p>;
    } else {
        return <p className="font-bold">TEPAT WAKTU</p>;
    }
};

const PhotoCell = ({ src, timestamp }: { src?: string | null, timestamp: any }) => {
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
                <div style={{ width: '50mm', height: '50mm' }} className="flex items-center justify-center border border-dashed border-gray-400">
                    <span className="text-[9px] text-gray-500">- Foto -</span>
                </div>
            )}
        </div>
    );
};


export default function HrdActivityPrintLayout({ data, title, location, currentUser }: HrdActivityPrintLayoutProps) {
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
                .report-wrapper {
                    break-inside: avoid;
                    page-break-inside: avoid;
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
        <h2 className="text-center font-bold text-lg uppercase my-4">{title || 'Laporan Kegiatan Harian'}</h2>
        <p className="report-date text-center text-sm mb-4">
          {location ? `Lokasi: ${location} - ` : ''}Tanggal Cetak: {reportDate}
        </p>

      <main>
        <table className="material-table w-full">
          <thead>
            <tr className="material-table">
              <th className="text-black font-bold border border-black px-1 py-1 text-center text-xs w-[3%]">No</th>
              <th className="text-black font-bold border border-black px-1 py-1 text-center text-xs w-[12%]">Nama Karyawan</th>
              <th className="text-black font-bold border border-black px-1 py-1 text-center text-xs w-[25%]">Deskripsi Kegiatan</th>
              <th className="text-black font-bold border border-black px-1 py-1 text-center text-xs">Mulai</th>
              <th className="text-black font-bold border border-black px-1 py-1 text-center text-xs">Proses</th>
              <th className="text-black font-bold border border-black px-1 py-1 text-center text-xs">Selesai</th>
              <th className="text-black font-bold border border-black px-1 py-1 text-center text-xs w-[8%]">Durasi</th>
            </tr>
          </thead>
          <tbody>
            {data.flatMap((user, userIndex) =>
                (user.activities && user.activities.length > 0) ? user.activities.map((activity, activityIndex) => {
                    return (
                        <tr key={`${user.id}-${activity.id}`} className="report-wrapper">
                            <td className="border border-black p-1 text-center text-xs align-top">{activityIndex + 1}</td>
                            <td className="border border-black p-1 text-left text-xs align-top">
                                <p className="font-semibold">{activity.username}</p>
                                <p>{user.nik}</p>
                                <p>{user.jabatan}</p>
                            </td>
                            <td className="border border-black p-1 text-left text-xs align-top">
                                <p>{activity.description}</p>
                                <div className='mt-2 pt-1 border-t border-black/20 text-[9px]'>
                                    <p>Target Mulai: {safeFormatTimestamp(activity.createdAt, 'dd/MM HH:mm')}</p>
                                    <p>Realisasi Mulai: {safeFormatTimestamp(activity.createdAt, 'dd/MM HH:mm')}</p>
                                    <p>Target Selesai: {safeFormatTimestamp(activity.targetTimestamp, 'dd/MM HH:mm')}</p>
                                    <p>Realisasi Selesai: {safeFormatTimestamp(activity.timestampCompleted, 'dd/MM HH:mm')}</p>
                                </div>
                                <div className="mt-2 text-[10px]">
                                     <CompletionStatus activity={activity} />
                                </div>
                            </td>
                            <td className="border border-black p-1 text-center text-xs"><PhotoCell src={activity.photoInitial} timestamp={activity.createdAt} /></td>
                            <td className="border border-black p-1 text-center text-xs"><PhotoCell src={activity.photoInProgress} timestamp={activity.timestampInProgress} /></td>
                            <td className="border border-black p-1 text-center text-xs"><PhotoCell src={activity.photoCompleted} timestamp={activity.timestampCompleted} /></td>
                            <td className="border border-black p-1 text-center text-xs align-top">{calculateDuration(activity.createdAt, activity.timestampCompleted)}</td>
                        </tr>
                    );
                }) : []
            )}
            {data.length === 0 && (
                <tr><td colSpan={7} className="h-24 text-center">Tidak ada data untuk dicetak.</td></tr>
            )}
          </tbody>
        </table>
      </main>
      <footer className="signature-section mt-16" style={{ pageBreakInside: 'avoid', pageBreakBefore: 'auto' }}>
          <div className="text-center">
              <p>Dibuat oleh,</p>
              <div className="signature-box h-20"></div>
              <p className='font-bold underline'>({currentUser?.username || '.........................'})</p>
              <p>{currentUser?.jabatan || '.........................'}</p>
          </div>
      </footer>
    </div>
  );
}
