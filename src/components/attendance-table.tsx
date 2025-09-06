'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceRecord, OvertimeRecord, UserData } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface AttendanceTableProps {
  records: any[];
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
}

const PhotoCell = ({ photoUrl }: { photoUrl?: string | null | undefined }) => {
    if (!photoUrl) return null;
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-2">
                    <Camera className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Foto Absensi</DialogTitle>
                     <DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-4 top-3"><X className="h-4 w-4"/></Button></DialogClose>
                </DialogHeader>
                <img src={photoUrl} alt="Foto Absensi" className="rounded-md w-full h-auto mt-4" data-ai-hint="employee selfie"/>
            </DialogContent>
        </Dialog>
    );
};

const TimeAndPhotoCell = ({ timestamp, photoUrl }: { timestamp: any, photoUrl?: string | null }) => {
    const timeString = safeFormatTimestamp(timestamp, 'HH:mm:ss');
    if (!timeString || timeString === '-') return <TableCell className="text-center">-</TableCell>;

    return (
        <TableCell className="text-center">
            <div className="flex items-center justify-center">
                <span>{timeString}</span>
                <PhotoCell photoUrl={photoUrl} />
            </div>
        </TableCell>
    )
}

const formatTotalOvertime = (checkIn: any, checkOut: any): string => {
    const checkInDate = toValidDate(checkIn);
    const checkOutDate = toValidDate(checkOut);
    if (!checkInDate || !checkOutDate) return '-';

    const diffMins = differenceInMinutes(checkOutDate, checkInDate);
    if (diffMins < 0) return '-';

    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;

    return `${hours}j ${minutes}m`;
}

export default function AttendanceTable({ records }: AttendanceTableProps) {
    return (
        <div className="border rounded-md overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Lokasi Absen</TableHead>
                        <TableHead className="text-center">Jam Masuk</TableHead>
                        <TableHead className="text-center">Jam Pulang</TableHead>
                        <TableHead className="text-center">Terlambat (mnt)</TableHead>
                        <TableHead className="text-center">Rit Pertama</TableHead>
                        <TableHead className="text-center">Rit Terakhir</TableHead>
                        <TableHead className="text-center">Jam Masuk Lembur</TableHead>
                        <TableHead className="text-center">Jam Pulang Lembur</TableHead>
                        <TableHead className="text-center">Total Lembur</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.length > 0 ? (
                        records.map(rec => {
                            const lateMinutes = rec.lateMinutes ?? 0;
                            const overtime = rec.overtimeData;
                            return (
                                <TableRow key={rec.id || rec.userId}>
                                    <TableCell>
                                        <div className="font-medium">{rec.username}</div>
                                        <div className="text-xs text-muted-foreground">{rec.nik}</div>
                                    </TableCell>
                                    <TableCell>{rec.jabatan}</TableCell>
                                    <TableCell>{rec.checkInLocationName || overtime?.checkInLocationName}</TableCell>
                                    <TimeAndPhotoCell timestamp={rec.checkInTime} photoUrl={rec.checkInPhoto} />
                                    <TimeAndPhotoCell timestamp={rec.checkOutTime} photoUrl={rec.checkOutPhoto} />
                                    <TableCell className={`text-center ${lateMinutes > 0 ? 'text-destructive font-bold' : ''}`}>{lateMinutes}</TableCell>
                                    <TableCell className="text-center">{rec.ritPertama || '-'}</TableCell>
                                    <TableCell className="text-center">{rec.ritTerakhir || '-'}</TableCell>
                                    <TimeAndPhotoCell timestamp={overtime?.checkInTime} photoUrl={overtime?.checkInPhoto} />
                                    <TimeAndPhotoCell timestamp={overtime?.checkOutTime} photoUrl={overtime?.checkOutPhoto} />
                                    <TableCell className="text-center">{formatTotalOvertime(overtime?.checkInTime, overtime?.checkOutTime)}</TableCell>
                                </TableRow>
                            )
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={11} className="text-center h-24">
                                Tidak ada data absensi untuk ditampilkan.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}