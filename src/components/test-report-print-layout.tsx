
'use client';

import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

interface TestReportPrintLayoutProps {
  sessionData: any;
}

export default function TestReportPrintLayout({ sessionData }: TestReportPrintLayoutProps) {
  if (!sessionData || !sessionData.results || sessionData.results.length === 0) {
    return <div className="p-4">Data tidak lengkap untuk dicetak.</div>;
  }
  
  const { testerName, testDate, results } = sessionData;
  
  const getDate = (timestamp: any): Date => {
      if (!timestamp) return new Date();
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      return new Date(timestamp);
  }

  const groupedResults = results.reduce((acc: Record<string, any[]>, item: any) => {
    const key = `${item.pelanggan}|${item.lokasi}|${item.mutu}|${item.umurUji}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  const specimenType = results[0]?.jenisBendaUji || 'Tidak diketahui';
  const resultUnit = results[0]?.unit || (specimenType === 'kubus' ? 'kg/cm²' : 'MPa');

  return (
    <div className="printable-area bg-white text-black p-4 font-sans">
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
        <hr className="header-divider border-t-2 border-black my-2" />
        <h2 className="report-title text-center font-bold text-lg uppercase my-4">LAPORAN HASIL UJI KUAT TEKAN BETON</h2>
        
        <main>
          <table className="info-table w-full mb-4 text-sm border-collapse">
              <tbody>
                  <tr>
                      <td className="label font-semibold w-32 p-1">Tanggal Pengujian</td>
                      <td>: {format(getDate(testDate), 'dd MMMM yyyy, HH:mm', { locale: localeID })}</td>
                  </tr>
                   <tr>
                      <td className="label font-semibold w-32 p-1">Jenis Benda Uji</td>
                      <td className="capitalize">: {specimenType}</td>
                  </tr>
                  <tr>
                      <td className="label font-semibold w-32 p-1">Diuji Oleh</td>
                      <td>: {testerName}</td>
                  </tr>
              </tbody>
          </table>

          <div className="mb-6">
            <table className="print-table w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-black p-1">No</th>
                  <th className="border border-black p-1">Pelanggan</th>
                  <th className="border border-black p-1">Lokasi Proyek</th>
                  <th className="border border-black p-1">Mutu</th>
                  <th className="border border-black p-1">Umur</th>
                  <th className="border border-black p-1">Tgl Prod</th>
                  <th className="border border-black p-1">Slump</th>
                  <th className="border border-black p-1">Berat (kg)</th>
                  <th className="border border-black p-1">KN</th>
                  <th className="border border-black p-1">Hasil Uji ({resultUnit})</th>
                  <th className="border border-black p-1">Prediksi 28 Hari ({resultUnit})</th>
                  <th className="border border-black p-1">Target thd Mutu (%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedResults).flatMap((key, groupIndex) => {
                  const group = groupedResults[key];
                  const totalStrength = group.reduce((sum: number, item: any) => sum + (item.actualStrength || 0), 0);
                  const averageStrength = group.length > 0 ? totalStrength / group.length : 0;

                  const groupRows = group.map((item: any, index: number) => (
                    <tr key={`${key}-${index}`}>
                      <td className="border border-black p-1 text-center">{index + 1}</td>
                      <td className="border border-black p-1 text-left">{item.pelanggan}</td>
                      <td className="border border-black p-1 text-left">{item.lokasi}</td>
                      <td className="border border-black p-1 text-center">{item.mutu}</td>
                      <td className="border border-black p-1 text-center">{item.umurUji}</td>
                      <td className="border border-black p-1 text-center">{format(getDate(item.tanggalPembuatan), 'dd/MM/yy')}</td>
                      <td className="border border-black p-1 text-center">{item.slump}</td>
                      <td className="border border-black p-1 text-right">{typeof item.beratBendaUji === 'number' ? item.beratBendaUji.toFixed(2) : '0.00'}</td>
                      <td className="border border-black p-1 text-right">{typeof item.kn === 'number' ? item.kn.toFixed(2) : '0.00'}</td>
                      <td className="border border-black p-1 text-right">{typeof item.actualStrength === 'number' ? item.actualStrength.toFixed(2) : '0.00'}</td>
                      <td className="border border-black p-1 text-right">{typeof item.predictedStrength === 'number' ? item.predictedStrength.toFixed(2) : '0.00'}</td>
                      <td className="border border-black p-1 text-right">{typeof item.targetAchievement === 'number' ? item.targetAchievement.toFixed(2) : '0.00'}</td>
                    </tr>
                  ));

                  const summaryRow = (
                    <tr key={`summary-${key}`} className="bg-gray-100 font-bold">
                      <td colSpan={9} className="border border-black p-1 text-center">Kuat Tekan Rata-rata</td>
                      <td className="border border-black p-1 text-right">{averageStrength.toFixed(2)}</td>
                      <td colSpan={2} className="border border-black"></td>
                    </tr>
                  );

                  return [...groupRows, summaryRow];
                })}
              </tbody>
            </table>
          </div>
        </main>
        <footer className="signature-section-new mt-16 text-sm" style={{ pageBreakInside: 'avoid' }}>
          <div className="flex justify-between w-full">
            <div className="text-left w-1/2 pr-8">
              <p>Prepared By,</p>
              <p className="font-bold">PT FARIKA RIAU PERKASA</p>
              <div className="mt-20 flex justify-between">
                <div className="w-2/5 text-center">
                    <div className="border-b border-black mb-1"></div>
                    <p className="text-xs">Admin QC</p>
                </div>
                <div className="w-2/5 text-center">
                    <div className="border-b border-black mb-1"></div>
                    <p className="text-xs">Quality Control</p>
                </div>
              </div>
            </div>

            <div className="text-left w-1/2 pl-8">
              <p>Witnessed By,</p>
              <p className="font-bold">PT OKI PULP AND PAPER MILLS</p>
              <div className="mt-20 flex justify-between">
                 <div className="w-2/5 text-center">
                    <div className="border-b border-black mb-1"></div>
                    <p className="text-xs">PIC OKI</p>
                </div>
                <div className="w-2/5 text-center">
                    <div className="border-b border-black mb-1"></div>
                    <p className="text-xs">QC OKI</p>
                </div>
              </div>
            </div>
          </div>
        </footer>
    </div>
  );
}
