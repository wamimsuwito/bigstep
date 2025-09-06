
'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import type { DailyQCInspection } from '@/lib/types';

interface DailyInspectionPrintLayoutProps {
  data: DailyQCInspection[];
  location: string;
  title: string;
}

const inspectionItems = [
    { id: 'phAir', label: 'PH Air' },
    { id: 'suhuAir', label: 'Suhu Air' },
    { id: 'tdsAir', label: 'TDS Air' },
    { id: 'kadarLumpurPasir', label: 'Kadar Lumpur Pasir' },
    { id: 'kadarLumpurBatu', label: 'Kadar Lumpur Batu' },
    { id: 'zonaPasir', label: 'Zona Pasir' },
];

export default function DailyInspectionPrintLayout({ data, location, title }: DailyInspectionPrintLayoutProps) {
  const reportDate = format(new Date(), 'EEEE, dd MMMM yyyy', { locale: localeID });

  const allPhotos = data.flatMap(report => 
    Object.entries(report.items)
      .filter(([_, itemData]) => itemData.photo)
      .map(([key, itemData]) => ({
        src: itemData.photo,
        label: inspectionItems.find(i => i.id === key)?.label || key,
        timestamp: report.createdAt.toDate(),
      }))
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
          Lokasi: {location} - Tanggal Cetak: {reportDate}
        </p>

      <main>
        <table className="material-table w-full">
          <thead>
            <tr className="material-table">
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[20%]">Tanggal Laporan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Penguji</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Item Uji</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Hasil</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.map((report) => 
                Object.entries(report.items).map(([key, itemData], itemIndex) => (
                    <tr key={`${report.id}-${key}`}>
                         {itemIndex === 0 && (
                            <td rowSpan={Object.keys(report.items).length} className="border border-black p-1 text-center text-xs align-top">
                                {format(report.createdAt.toDate(), 'dd MMM yyyy, HH:mm')}
                            </td>
                         )}
                         {itemIndex === 0 && (
                             <td rowSpan={Object.keys(report.items).length} className="border border-black p-1 text-center text-xs align-top">
                                {report.inspectedBy}
                            </td>
                         )}
                        <td className="border border-black p-1 text-left text-xs">{inspectionItems.find(i => i.id === key)?.label || key}</td>
                        <td className="border border-black p-1 text-center text-xs">{itemData.value}</td>
                    </tr>
                ))
            ) : (
                <tr><td colSpan={4} className="h-24 text-center">Tidak ada data untuk dicetak.</td></tr>
            )}
          </tbody>
        </table>

        {allPhotos.length > 0 && (
          <div className="mt-8" style={{ pageBreakInside: 'avoid' }}>
            <h3 className="font-bold text-center border-t-2 border-black pt-2 mb-4">LAMPIRAN FOTO</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {allPhotos.map((photo, index) => (
                <div key={index} className="text-center" style={{ breakInside: 'avoid' }}>
                  <img src={photo.src || ''} alt={photo.label} className="border border-black w-full" data-ai-hint="material inspection" />
                  <p className="text-xs mt-1">
                    <strong>{photo.label}</strong>
                    <br />
                    <span>{format(photo.timestamp, 'dd MMM, HH:mm')}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
