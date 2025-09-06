
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MechanicTask, Report, UserData } from '@/lib/types';
import { format, formatDistanceStrict, differenceInMinutes } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface HistoryPrintLayoutProps {
  data: MechanicTask[];
  allReports: Report[];
  users: UserData[];
  location?: string;
}

const calculateEffectiveDuration = (task: MechanicTask) => {
    if (!task.startedAt || !task.completedAt) return '-';
    const duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime() - (task.totalDelayDuration || 0);
    return formatDistanceStrict(0, Math.max(0, duration), { locale: id });
}

const calculateTotalDelay = (task: MechanicTask) => {
    if (!task.riwayatTunda || task.riwayatTunda.length === 0) return '-';
    let totalMs = 0;
    task.riwayatTunda.forEach(tunda => {
        if (tunda.waktuMulai && tunda.waktuSelesai) {
             const start = typeof tunda.waktuMulai === 'number' ? new Date(tunda.waktuMulai) : tunda.waktuMulai;
             const end = typeof tunda.waktuSelesai === 'number' ? new Date(tunda.waktuSelesai) : tunda.waktuSelesai;
             totalMs += end.getTime() - start.getTime();
        }
    });
    return formatDistanceStrict(0, totalMs, { locale: id });
};


const CompletionStatusBadgeText = ({ task }: { task: MechanicTask }) => {
    if (!task.vehicle?.targetDate || !task.vehicle?.targetTime || !task.completedAt) return 'N/A';

    const targetDateTime = new Date(`${task.vehicle.targetDate}T${task.vehicle.targetTime}`);
    const completedDateTime = new Date(task.completedAt);
    
    let totalDelayDuration = task.totalDelayDuration || 0;

    const diffMinutes = Math.round((completedDateTime.getTime() - targetDateTime.getTime() - totalDelayDuration) / (60 * 1000));
    
    const diffAbs = Math.abs(diffMinutes);
    const hours = Math.floor(diffAbs / 60);
    const minutes = Math.round(diffAbs % 60);
    
    let timeText = '';
    if (hours > 0) timeText += `${hours}j `;
    if (minutes > 0) timeText += `${minutes}m`;
    if (timeText.trim() === '') timeText = '0m';

    if (diffMinutes <= 5) {
        return `Tepat Waktu ${diffMinutes <= 0 ? `(Cepat ${timeText})` : ''}`;
    } else {
        return `Terlambat ${timeText}`;
    }
};

export default function HistoryPrintLayout({ data, allReports, users, location }: HistoryPrintLayoutProps) {
  
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
        <h2 className="text-center font-bold text-lg uppercase my-4">Laporan Riwayat Perbaikan Alat - {location || ''}</h2>
        <p className="report-date text-center text-sm mb-4">
          Tanggal Cetak: {format(new Date(), 'dd MMMM yyyy', { locale: id })}
        </p>

      <main>
        <table className="material-table w-full">
          <thead>
            <tr className="material-table">
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Kendaraan/Sopir</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs" style={{ width: '25%' }}>Deskripsi Perbaikan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Mekanik</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Waktu Pengerjaan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Total Waktu Tunda</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Waktu Efektif</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Penyelesaian</th>
            </tr>
          </thead>
          <TableBody>
            {data.map((task) => {
              const triggeringReport = allReports.find(r => r.id === task.vehicle?.triggeringReportId);
              const sopir = users.find(u => u.id === triggeringReport?.operatorId);
              return (
                <TableRow key={task.id}>
                    <TableCell className="border border-black p-1 text-left text-xs">
                        <p className="font-semibold">{task.vehicle.hullNumber} ({task.vehicle.licensePlate})</p>
                        <p className="text-xs">{sopir?.username || 'N/A'}</p>
                        <p className="text-xs">NIK: {sopir?.nik || '-'}</p>
                    </TableCell>
                    <TableCell className="border border-black p-1 text-left text-xs whitespace-pre-wrap">{task.mechanicRepairDescription || "(Belum ada deskripsi)"}</TableCell>
                    <TableCell className="border border-black p-1 text-center text-xs">{task.mechanics.map(m => m.name).join(', ')}</TableCell>
                    <TableCell className="border border-black p-1 text-center text-xs">
                        <p>Mulai: {task.startedAt ? format(new Date(task.startedAt), 'dd/MM HH:mm') : '-'}</p>
                        <p>Target: {format(new Date(task.vehicle.targetDate), 'dd/MM')} @ {task.vehicle.targetTime}</p>
                        <p>Selesai: {task.completedAt ? format(new Date(task.completedAt), 'dd/MM HH:mm') : '-'}</p>
                    </TableCell>
                    <TableCell className="border border-black p-1 text-left text-xs">
                        <p>{calculateTotalDelay(task)}</p>
                        {task.riwayatTunda && task.riwayatTunda.length > 0 && (
                            <ol className="text-xs italic list-decimal list-inside">
                                {task.riwayatTunda.map((tunda, index) => (
                                  <li key={index}>{tunda.alasan}</li>
                                ))}
                            </ol>
                          )}
                    </TableCell>
                    <TableCell className="border border-black p-1 text-center text-xs">{calculateEffectiveDuration(task)}</TableCell>
                    <TableCell className="border border-black p-1 text-center text-xs"><CompletionStatusBadgeText task={task} /></TableCell>
                </TableRow>
              )
            })}
             {data.length === 0 && (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">Tidak ada data untuk dicetak.</TableCell></TableRow>
            )}
          </TableBody>
        </table>
      </main>
      <footer className="signature-section">
          <div>
              <p>Disiapkan oleh,</p>
              <div className="signature-box"></div>
              <p>(Kepala Mekanik)</p>
          </div>
           <div>
              <p>Diketahui oleh,</p>
              <div className="signature-box"></div>
              <p>(Kepala Workshop)</p>
          </div>
      </footer>
    </div>
  );
}
