
'use client';

import { useEffect, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SchedulePrintLayoutProps {
    data: any[];
    headers: string[];
    isForPrinting?: boolean;
    totals?: {
        totalJadwal: number;
        totalRealisasi: number;
        totalDeviasi: number;
    }
}

const formatNumberDisplay = (numStr: string | number | undefined, fractionDigits = 2) => {
    if (numStr === undefined || numStr === null) return "0";
    const num = Number(numStr);
    if (isNaN(num)) return "0";
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
};

export default function SchedulePrintLayout({ data, headers, isForPrinting = false, totals }: SchedulePrintLayoutProps) {
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isForPrinting) {
            const timer = setTimeout(() => {
                window.print();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isForPrinting]);


    return (
        <div ref={printRef} className="printable-area">
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
            <hr className='border-t-2 border-black my-2' />
            <h2 className="text-center font-bold text-lg uppercase my-4">JADWAL PENGECORAN HARI INI</h2>
            <p className="report-date text-center text-sm mb-4">Tanggal: {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

            <main>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {headers.map((header) => (
                                <TableHead key={header} className="text-black font-bold border border-black px-2 py-1 text-center text-xs">{header}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                                {headers.map((header) => (
                                    <TableCell key={header} className="border border-black p-1 text-center text-xs">
                                        {row[header]}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {totals && (
                    <div className='flex justify-end mt-4'>
                        <div className="w-1/3">
                            <Table>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-bold border border-black">Total Jadwal (M³)</TableCell>
                                        <TableCell className="text-right border border-black">{formatNumberDisplay(totals.totalJadwal)}</TableCell>
                                    </TableRow>
                                     <TableRow>
                                        <TableCell className="font-bold border border-black">Total Realisasi (M³)</TableCell>
                                        <TableCell className="text-right border border-black">{formatNumberDisplay(totals.totalRealisasi)}</TableCell>
                                    </TableRow>
                                     <TableRow>
                                        <TableCell className="font-bold border border-black">Total Deviasi (M³)</TableCell>
                                        <TableCell className="text-right border border-black">{formatNumberDisplay(totals.totalDeviasi)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
