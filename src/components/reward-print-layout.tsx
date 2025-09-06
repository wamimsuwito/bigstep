
'use client';

import type { RewardEntry } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface RewardPrintLayoutProps {
  rewardData: Partial<RewardEntry> | null;
}

export default function RewardPrintLayout({ rewardData }: RewardPrintLayoutProps) {
  if (!rewardData) {
    return (
        <div className="bg-white text-black p-4 font-serif printable-area text-center">
            Data reward tidak ditemukan.
        </div>
    );
  }

  const { username, nik, jabatan, poin, deskripsi, createdAt } = rewardData;

  const getRewardDate = () => {
    if (!createdAt) return '-';
    // Firestore Timestamps have a toDate() method.
    // Regular JS Dates created from the form do not.
    if (typeof (createdAt as any).toDate === 'function') {
      return format((createdAt as any).toDate(), 'dd MMMM yyyy', { locale: id });
    }
    // Handle regular JS Date object
    return format(new Date(createdAt), 'dd MMMM yyyy', { locale: id });
  };
  
  const rewardDate = getRewardDate();

  return (
    <div className="bg-white text-black p-8 font-serif printable-area" id="reward-letter">
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
                Sehubungan dengan kinerja dan dedikasi luar biasa yang telah Saudara tunjukkan,
                manajemen PT Farika Riau Perkasa dengan bangga memberikan penghargaan kepada Saudara.
            </p>
            
            <p className="mb-4">
                Penghargaan ini diberikan atas dasar:
            </p>
            <p className="mb-4 pl-4 border-l-2 border-gray-300 italic">
                {deskripsi || '(Deskripsi pencapaian/reward)'}
            </p>

             <p className="mb-4">
                Atas prestasi tersebut, perusahaan memberikan apresiasi berupa <span className="font-bold">{poin || '...'}</span> poin kinerja.
            </p>
            
            <p className="mb-6">
                Kami sangat menghargai kontribusi positif Saudara dan berharap Saudara dapat terus mempertahankan dan meningkatkan kinerja yang sudah sangat baik ini. Semoga penghargaan ini dapat menjadi motivasi bagi Saudara dan juga rekan-rekan lainnya.
            </p>

            <p>Demikian surat ini kami sampaikan. Atas perhatian dan kerja keras Saudara, kami ucapkan terima kasih.</p>
        </main>
        <footer className="mt-16 text-base">
            <div className="flex justify-end">
                <div className="text-center">
                    <p>Pekanbaru, {rewardDate}</p>
                    <p>Hormat kami,</p>
                    <div className="h-24"></div>
                    <p className="font-bold underline">(HRD Pusat)</p>
                </div>
            </div>
        </footer>
    </div>
  );
}
