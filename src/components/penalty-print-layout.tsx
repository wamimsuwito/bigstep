
'use client';

import type { PenaltyEntry } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface PenaltyPrintLayoutProps {
  penaltyData: Partial<PenaltyEntry> | null;
}

export default function PenaltyPrintLayout({ penaltyData }: PenaltyPrintLayoutProps) {
  if (!penaltyData) {
    return (
        <div className="bg-white text-black p-4 font-serif printable-area text-center">
            Data penalti tidak ditemukan.
        </div>
    );
  }

  const { username, nik, jabatan, poin, penyebab, deskripsi, createdAt } = penaltyData;

  const getPenaltyDate = () => {
    if (!createdAt) return '-';
    // Firestore Timestamps have a toDate() method.
    // Regular JS Dates created from the form do not.
    if (typeof (createdAt as any).toDate === 'function') {
      return format((createdAt as any).toDate(), 'dd MMMM yyyy', { locale: id });
    }
    // Handle regular JS Date object
    return format(new Date(createdAt), 'dd MMMM yyyy', { locale: id });
  };
  
  const penaltyDate = getPenaltyDate();

  return (
    <div className="bg-white text-black p-8 font-serif printable-area" id="penalty-letter">
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
        <main className="text-justify text-base leading-relaxed">
            <p className="mb-4">
                Kepada Yth.
                <br />
                Sdr/i <span className="font-bold">{username || '(Nama Karyawan)'}</span>
                <br />
                NIK: {nik || '(NIK)'}
                <br />
                Jabatan: {jabatan || '(Jabatan)'}
                <br />
                di tempat
            </p>

            <p className="mb-4">
                Terkait pelanggaran dan ketidakdisiplinan yang Saudara lakukan dan setelah kami review secara cermat, 
                kami memberikan sanksi kepada Saudara dengan poin penalti sejumlah <span className="font-bold">{poin || '...'}</span> poin.
            </p>
            
            <p className="mb-4">
                Penyebab penalti adalah: <span className="font-bold">{penyebab || '(Penyebab Penalti)'}</span>.
            </p>
            
            <p className="mb-4">
                Berikut adalah review kami terkait pelanggaran dan ketidakdisiplinan yang Saudara lakukan berupa:
            </p>
            <p className="mb-4 pl-4 border-l-2 border-gray-300 italic">
                {deskripsi || '(Deskripsi lengkap pelanggaran)'}
            </p>
            
            <p className="mb-6">
                Kami harap Saudara tidak mengulangi lagi kejadian yang sama dan dapat bekerja secara disiplin serta mengikuti semua peraturan perusahaan yang berlaku.
            </p>

            <p>Demikian surat ini kami sampaikan untuk dapat menjadi perhatian.</p>
        </main>
        <footer className="mt-16 text-base">
            <div className="flex justify-end">
                <div className="text-center">
                    <p>Pekanbaru, {penaltyDate}</p>
                    <p>Hormat kami,</p>
                    <div className="h-24"></div>
                    <p className="font-bold underline">(HRD Pusat)</p>
                </div>
            </div>
        </footer>
    </div>
  );
}
