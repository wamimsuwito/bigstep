
'use client';

import { useMemo } from 'react';
import type { PrintData } from '@/lib/types';


export default function PrintTicketLayout({ data }: { data: PrintData }) {
    if (!data || !data.startTime || !data.endTime) return null;
    
  const {
    schedule,
    jobMix,
    targetVolume,
    startTime,
    endTime,
    nomorRitasi,
    totalVolumeTerkirim,
    unitBp,
  } = data;

  const namaSopir = schedule['NAMA SOPIR'] || '___________________';
  const nomorMobil = schedule['NOMOR MOBIL'] || '___________________';
  const nomorLambung = schedule['NOMOR LAMBUNG'] || '___________________';

  const formatNumber = (num?: number | string) => {
    const number = Number(num);
    if (num === undefined || isNaN(number)) return '';
    if (number % 1 === 0) {
      return number.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return number.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calculateRandomRealisasi = (target: number, materialName: string) => {
    const maxDeviation = 0.02; // 2%
    const deviation = (Math.random() * 2 - 1) * maxDeviation;
    let realisasi = target * (1 + deviation);
    
    if (materialName === 'Pasir' || materialName === 'Batu') {
      realisasi = Math.round(realisasi / 5) * 5;
    } else if (materialName === 'Semen' || materialName === 'Air') {
      realisasi = Math.round(realisasi);
    }

    return realisasi;
  };
  
  const materials = useMemo(() => {
    const materialDefinitions = [
      { name: 'Pasir', target: (jobMix.pasir1 + jobMix.pasir2) * parseFloat(targetVolume) },
      { name: 'Batu', target: (jobMix.batu1 + jobMix.batu2) * parseFloat(targetVolume) },
      { name: 'Semen', target: jobMix.semen * parseFloat(targetVolume) },
      { name: 'Air', target: jobMix.air * parseFloat(targetVolume) },
    ];

    return materialDefinitions.map(mat => {
        const realisasi = calculateRandomRealisasi(mat.target, mat.name);
        const deviasi = realisasi - mat.target;
        return { ...mat, realisasi, deviasi };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);


  return (
    <div className="bg-white text-black font-mono printable-area" style={{ pageBreakAfter: 'always' }}>
        <div className="watermark">PT FARIKA RIAU PERKASA</div>
        <header className="print-header flex items-start justify-start gap-2 mb-1">
            <img src="https://i.imgur.com/CxaNLPj.png" alt="Logo" className="print-logo h-16 w-auto" data-ai-hint="logo company"/>
            <div className="text-left text-[8px] leading-tight mt-0">
                <h1 className="text-lg font-bold text-red-600">PT. FARIKA RIAU PERKASA</h1>
                <p className="font-semibold text-blue-600 italic">one stop concrete solution</p>
                <p className="font-semibold text-blue-600">READYMIX & PRECAST CONCRETE</p>
                <p className="mt-1">Jl. Soekarno Hatta Komp. SKA No. 62 E Pekanbaru Telp. (0761) 7090228 - 571662</p>
            </div>
        </header>
        <hr className='border-t-2 border-black my-1' />

      <main className="my-1">
         <div className="flex justify-center items-baseline mb-1">
            <h2 className="text-base font-bold uppercase">BUKTI TIMBANG</h2>
            {unitBp && <span className="text-sm font-semibold ml-2">({unitBp})</span>}
         </div>
         <div className="grid grid-cols-2 text-left text-[9px] mb-1">
            <div>
              <p><span className="font-bold inline-block w-20">Job Order</span>: {schedule.NO}</p>
              <p><span className="font-bold inline-block w-20">Nomor PO</span>: {schedule['NO P.O'] || '-'}</p>
              <p><span className="font-bold inline-block w-20">Tanggal</span>: {new Date(startTime).toLocaleDateString('id-ID')}</p>
            </div>
            <div className="text-right">
              <p><span className="font-bold">Jam Mulai</span>: {new Date(startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
              <p><span className="font-bold">Jam Selesai</span>: {new Date(endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-0 text-[10px] mb-1">
            <div>
                <div><span className="font-semibold inline-block w-28">Nama Pelanggan</span>: {schedule.NAMA}</div>
                <div><span className="font-semibold inline-block w-28">Lokasi Proyek</span>: {schedule.LOKASI}</div>
                <div><span className="font-semibold inline-block w-28">Mutu Beton</span>: {schedule.GRADE}</div>
                <div><span className="font-semibold inline-block w-28">Slump</span>: {schedule['SLUMP (CM)']} cm</div>
                <div><span className="font-semibold inline-block w-28">Volume</span>: {targetVolume} M³</div>
            </div>
            <div>
                <div><span className="font-semibold inline-block w-28">Nama Sopir</span>: {namaSopir}</div>
                <div><span className="font-semibold inline-block w-28">Nomor Mobil</span>: {nomorMobil}</div>
                <div><span className="font-semibold inline-block w-28">Nomor Lambung</span>: {nomorLambung}</div>
                <div><span className="font-semibold inline-block w-28">Nomor Ritasi</span>: {nomorRitasi ?? '___________________'}</div>
                <div><span className="font-semibold inline-block w-28">Total Volume</span>: {formatNumber(totalVolumeTerkirim)} M³</div>
            </div>
        </div>

        <div className="mt-1">
            <h3 className="text-[10px] font-bold text-center py-0.5 mb-0.5">Aktual penimbangan (Kg)</h3>
            <div className="border-y border-black/50">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-black">
                    <th className="font-bold text-left h-4 px-1 border-r border-black">Material</th>
                    <th className="font-bold text-right h-4 px-1 border-r border-black">Target</th>
                    <th className="font-bold text-right h-4 px-1 border-r border-black">Realisasi</th>
                    <th className="font-bold text-right h-4 px-1">Deviasi</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(mat => (
                    <tr key={mat.name}>
                        <td className="py-0 px-1 border-r border-black">{mat.name}</td>
                        <td className="text-right py-0 px-1 border-r border-black">{formatNumber(mat.target)}</td>
                        <td className="text-right py-0 px-1 border-r border-black">{formatNumber(mat.realisasi)}</td>
                        <td className="text-right py-0 px-1">{formatNumber(mat.deviasi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      </main>

      <footer className="pt-2 text-center text-[10px]">
        <div className="flex justify-around">
            <div>
                <p>Penerima,</p>
                <p className="mt-10">(_________________________)</p>
            </div>
             <div>
                <p>Operator,</p>
                 <p className="mt-10">(_________________________)</p>
            </div>
             <div>
                <p>Quality Control,</p>
                 <p className="mt-10">(_________________________)</p>
            </div>
        </div>
        <p className="mt-2 text-gray-500 text-[8px]">Dokumen ini dibuat secara otomatis oleh sistem.</p>
        <p className="text-gray-500 text-[8px]">Waktu Cetak: {new Date().toLocaleString('id-ID')}</p>
      </footer>
    </div>
  );
}
