
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const tableHeaders = [
    'NO',
    'NAMA',
    'LOKASI',
    'GRADE',
    'VOL M³',
    'TERKIRIM M³',
    'SISA M³',
    'STATUS'
];

interface ScheduleRow {
    'NO': string;
    'NAMA': string;
    'LOKASI': string;
    'GRADE': string;
    'VOL M³': string;
    'TERKIRIM M³': string;
    'SISA M³': string;
    'STATUS': 'menunggu' | 'proses' | 'tunda' | 'selesai';
    [key: string]: any;
}

interface ScheduleTableProps {
    scheduleData: ScheduleRow[];
    isLoading: boolean;
}

export default function ScheduleTable({ scheduleData, isLoading }: ScheduleTableProps) {
  const getStatusColor = (status: ScheduleRow['STATUS']) => {
    switch (status) {
      case 'proses':
        return 'text-yellow-600 font-semibold';
      case 'selesai':
        return 'text-green-600 font-semibold';
      case 'tunda':
        return 'text-red-600 font-semibold';
      default:
        return 'text-blue-600 font-semibold';
    }
  }
  
  const schedulesToDisplay = (scheduleData || []).filter(row => row['NO'] || row['NAMA']);

  return (
    <Card className="mt-6">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-muted/50">
                {tableHeaders.map((header) => (
                  <TableHead key={header} className="text-foreground font-bold whitespace-nowrap px-4 py-3">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={tableHeaders.length} className="h-24 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : schedulesToDisplay.length > 0 ? (
                schedulesToDisplay.map((row, i) => (
                  <TableRow key={`${row['NO']}-${i}`}>
                    {tableHeaders.map((header) => (
                         <TableCell key={header} className={cn("h-12 px-4 whitespace-nowrap", header === 'STATUS' && getStatusColor(row.STATUS))}>
                            {row[header]}
                         </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                 <TableRow>
                    <TableCell colSpan={tableHeaders.length} className="h-24 text-center text-muted-foreground">
                        Tidak ada jadwal produksi yang aktif.
                    </TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
