

'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
    LayoutDashboard,
    ClipboardList,
    History,
    Users,
    ShieldAlert,
    LogOut,
    Wrench,
    Loader2,
    Calendar as CalendarIcon,
    Plus,
    Copy,
    CheckCircle,
    XCircle,
    AlertTriangle,
    WrenchIcon,
    UserX,
    Pencil,
    Trash2,
    Save,
    ArrowRightLeft,
    PlusCircle,
    Camera,
    ActivitySquare,
    Check,
    Printer,
    FilterX,
    MessageSquareWarning,
    Lightbulb,
    Mail,
    Truck,
    Fingerprint,
    Briefcase,
    ShieldX,
    Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserData, Report, LocationData, SopirBatanganData, AlatData, MechanicTask } from '@/lib/types';
import { cn, printElement } from '@/lib/utils';
import { format, startOfToday, isSameDay, isBefore, subDays, startOfDay, endOfDay, isAfter, formatDistanceStrict, differenceInMinutes, differenceInMilliseconds, formatRelative } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRange } from 'react-day-picker';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { db, collection, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, addDoc, query, where, Timestamp } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset, SidebarTrigger, SidebarSeparator } from '@/components/ui/sidebar';
import HistoryPrintLayout from '@/components/history-print-layout';


const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Work order saya (WO)', icon: ClipboardList },
    { name: 'Work order aktif', icon: ActivitySquare },
    { name: 'Sopir & Batangan', icon: Users },
    { name: 'Histori Perbaikan Alat', icon: History },
    { name: 'Alat Rusak Berat/Karantina', icon: ShieldAlert },
    { name: 'Anggota Mekanik', icon: Users },
];

type ActiveMenu = 
  | 'Dashboard' 
  | 'Work order saya (WO)'
  | 'Work order aktif'
  | 'Sopir & Batangan' 
  | 'Histori Perbaikan Alat' 
  | 'Alat Rusak Berat/Karantina' 
  | 'Anggota Mekanik';


const taskFormSchema = z.object({
  mechanics: z.array(z.object({ id: z.string(), name: z.string() })).min(1, "Pilih minimal satu mekanik."),
  targetDate: z.date({ required_error: "Tanggal target harus diisi." }),
  targetTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format waktu tidak valid (HH:MM)."),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

const StatCard = ({ title, value, description, icon: Icon, color, onClick }: { title: string, value: string, description: string, icon: React.ElementType, color: string, onClick?: () => void }) => (
    <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={onClick}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">{title}</CardTitle>
            <Icon className={cn("h-6 w-6", color)} />
        </CardHeader>
        <CardContent>
            <div className="text-5xl font-bold">{value}</div>
            <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

const CreateWorkOrderDialog = ({ vehicle, report, mechanics, onTaskCreated }: { vehicle: AlatData, report: Report, mechanics: UserData[], onTaskCreated: () => void }) => {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<TaskFormData>({
        resolver: zodResolver(taskFormSchema),
        defaultValues: {
            mechanics: [],
            targetTime: "17:00",
            targetDate: new Date(),
        },
    });

    const onSubmit = async (data: TaskFormData) => {
        setIsSubmitting(true);
        const targetTimestamp = new Date(data.targetDate);
        const [hours, minutes] = data.targetTime.split(':').map(Number);
        targetTimestamp.setHours(hours, minutes);

        const newTask: Omit<MechanicTask, 'id'> = {
            status: 'PENDING',
            vehicle: {
                hullNumber: vehicle.nomorLambung,
                licensePlate: vehicle.nomorPolisi,
                repairDescription: report.description || 'Tidak ada deskripsi kerusakan.',
                targetDate: format(data.targetDate, 'yyyy-MM-dd'),
                targetTime: data.targetTime,
                triggeringReportId: report.id,
            },
            mechanics: data.mechanics,
            createdAt: new Date().getTime(),
            riwayatTunda: [],
            totalDelayDuration: 0,
        };

        try {
            await addDoc(collection(db, 'mechanic_tasks'), newTask);
            toast({ title: "Work Order Berhasil Dibuat" });
            form.reset();
            onTaskCreated();
            setIsOpen(false);
        } catch (error) {
            console.error("Error creating task:", error);
            toast({ title: "Gagal Membuat WO", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Wrench className="mr-2" /> Buat Work Order
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Buat Work Order untuk {vehicle.nomorLambung}</DialogTitle>
                    <DialogDescription>
                        Pilih mekanik dan tentukan target penyelesaian perbaikan.
                    </DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                     <FormField
                      control={form.control}
                      name="mechanics"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pilih Mekanik</FormLabel>
                           <Popover>
                              <PopoverTrigger asChild>
                                 <Button variant="outline" className="w-full justify-start">
                                    <PlusCircle className="mr-2"/>
                                    {field.value.length > 0 ? field.value.map(m => m.name).join(', ') : "Pilih mekanik"}
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                  <Command>
                                    <CommandInput placeholder="Cari mekanik..." />
                                    <CommandList>
                                        <CommandEmpty>Tidak ada mekanik.</CommandEmpty>
                                        <CommandGroup>
                                            {mechanics.map((mechanic) => {
                                                const isSelected = field.value.some(m => m.id === mechanic.id);
                                                return (
                                                    <CommandItem
                                                        key={mechanic.id}
                                                        onSelect={() => {
                                                            const currentMechanics = field.value;
                                                            if (isSelected) {
                                                                form.setValue("mechanics", currentMechanics.filter(m => m.id !== mechanic.id));
                                                            } else {
                                                                form.setValue("mechanics", [...currentMechanics, { id: mechanic.id, name: mechanic.username }]);
                                                            }
                                                        }}
                                                    >
                                                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                                            <Check className="h-4 w-4" />
                                                        </div>
                                                        <span>{mechanic.username}</span>
                                                    </CommandItem>
                                                )
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                  </Command>
                              </PopoverContent>
                           </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="targetDate"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Target Selesai</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP", { locale: localeID }) : <span>Pilih tanggal</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="targetTime"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Waktu Target</FormLabel>
                                <Input type="time" {...field} />
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2" />}
                             Buat Work Order
                        </Button>
                    </DialogFooter>
                  </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const CompletionStatusBadge = ({ task }: { task: MechanicTask }) => {
    if (!task.vehicle?.targetDate || !task.vehicle?.targetTime || !task.completedAt) return <Badge variant="secondary">N/A</Badge>;

    const targetDateTime = new Date(`${task.vehicle.targetDate}T${task.vehicle.targetTime}`);
    const completedDateTime = new Date(task.completedAt);
    
    let totalDelayDuration = task.totalDelayDuration || 0;

    const diffMinutes = differenceInMinutes(completedDateTime, targetDateTime) - (totalDelayDuration / 60000);
    const diffAbs = Math.abs(diffMinutes);
    const hours = Math.floor(diffAbs / 60);
    const minutes = Math.round(diffAbs % 60);
    
    let timeText = '';
    if (hours > 0) timeText += `${hours}j `;
    if (minutes > 0) timeText += `${minutes}m`;
    if (timeText.trim() === '') timeText = '0m';

    if (diffMinutes <= 5) {
        return <Badge className="bg-green-100 text-green-800">Tepat Waktu {diffMinutes <= 0 ? `(Lebih Cepat ${timeText})` : ''}</Badge>;
    } else {
        return <Badge variant="destructive">Terlambat ${timeText}</Badge>;
    }
};

const HistoryComponent = ({ user, allTasks, allUsers, allAlat, allReports }: { user: UserData | null; allTasks: MechanicTask[]; allUsers: UserData[]; allAlat: AlatData[], allReports: Report[] }) => {
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>("all");
    const [searchNoPol, setSearchNoPol] = useState('');
    const [date, setDate] = useState<DateRange | undefined>({
      from: subDays(new Date(), 29),
      to: new Date(),
    });

    const sopirOptions = useMemo(() => {
        return allUsers.filter(u => u.jabatan?.toUpperCase().includes('SOPIR') || u.jabatan?.toUpperCase().includes('OPRATOR'))
            .filter(u => user?.lokasi ? u.lokasi === user.lokasi : true)
            .sort((a,b) => a.username.localeCompare(b.username));
    }, [allUsers, user]);
  
    const filteredTasks = useMemo(() => {
      const fromDate = date?.from ? startOfDay(date.from) : null;
      const toDate = date?.to ? endOfDay(date.to) : null;
  
      return allTasks
        .filter((task) => {
          if (task.status !== 'COMPLETED' || !task.completedAt) return false;
          
          if (user?.lokasi) {
            const taskLocation = allAlat.find(v => v.nomorLambung === task.vehicle?.hullNumber)?.lokasi;
            if (taskLocation !== user.lokasi) return false;
          }
  
          if (fromDate && toDate) {
            const completedDate = new Date(task.completedAt);
            if (isBefore(completedDate, fromDate) || isAfter(completedDate, toDate)) {
              return false;
            }
          }
          
          if (selectedOperatorId !== "all") {
              const reportForTask = allReports.find(r => r.id === task.vehicle?.triggeringReportId);
              if (!reportForTask || reportForTask.operatorId !== selectedOperatorId) {
                  return false;
              }
          }

          if (searchNoPol && task.vehicle?.licensePlate) {
              if (!task.vehicle.licensePlate.toUpperCase().includes(searchNoPol.toUpperCase())) {
                  return false;
              }
          }
          
          return true;
        })
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
    }, [allTasks, date, selectedOperatorId, user, allAlat, allReports, searchNoPol]);

    return (
        <>
            <div className='hidden'>
                <div id="history-print-area">
                    <HistoryPrintLayout data={filteredTasks} allReports={allReports} users={allUsers} location={user?.lokasi} />
                </div>
            </div>
            <Card>
                <CardHeader>
                <CardTitle>Histori Perbaikan Alat</CardTitle>
                <CardDescription>
                    Tinjau riwayat pekerjaan perbaikan yang telah diselesaikan.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <Input
                        placeholder="Cari No. Polisi..."
                        value={searchNoPol}
                        onChange={e => setSearchNoPol(e.target.value)}
                        className="w-full sm:w-auto sm:flex-1"
                    />
                    <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
                    <SelectTrigger className="w-full sm:w-auto sm:flex-1">
                        <SelectValue placeholder="Pilih Operator/Sopir" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Operator/Sopir</SelectItem>
                        {sopirOptions.map((sopir) => (
                        <SelectItem key={sopir.id} value={sopir.id}>
                            {sopir.username}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button id="date" variant={"outline"} className={cn("w-full sm:w-auto sm:flex-1 justify-start text-left font-normal", !date && "text-muted-foreground" )}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? ( date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/>
                    </PopoverContent>
                    </Popover>
                    <Button variant="ghost" onClick={() => { setSearchNoPol(''); setSelectedOperatorId('all'); setDate({ from: subDays(new Date(), 29), to: new Date() }); }}><FilterX className="mr-2 h-4 w-4"/>Reset</Button>
                    <Button variant="outline" className="ml-auto" onClick={() => printElement('history-print-area')}><Printer className="mr-2 h-4 w-4"/>Cetak</Button>
                </div>
                <div className="border rounded-md overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kendaraan/Sopir</TableHead>
                            <TableHead>Deskripsi Perbaikan</TableHead>
                            <TableHead>Mekanik</TableHead>
                            <TableHead>Waktu Pengerjaan</TableHead>
                            <TableHead>Total Waktu Tunda</TableHead>
                            <TableHead>Waktu Efektif</TableHead>
                            <TableHead>Penyelesaian</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => {
                            const triggeringReport = allReports.find(r => r.id === task.vehicle?.triggeringReportId);
                            const sopir = allUsers.find(u => u.id === triggeringReport?.operatorId);
                            const calculateEffectiveDuration = (task: MechanicTask) => {
                                if (!task.startedAt || !task.completedAt) return '-';
                                const duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime() - (task.totalDelayDuration || 0);
                                return formatDistanceStrict(0, Math.max(0, duration), { locale: localeID });
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
                                return formatDistanceStrict(0, totalMs, { locale: localeID });
                            };

                            return (
                            <TableRow key={task.id}>
                                <TableCell>
                                    <p className="font-semibold">{task.vehicle.hullNumber} ({task.vehicle.licensePlate})</p>
                                    <p className="text-xs text-muted-foreground">{sopir?.username || 'N/A'}</p>
                                    <p className="text-xs text-muted-foreground">NIK: {sopir?.nik || '-'}</p>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">{task.mechanicRepairDescription || "(Belum ada deskripsi)"}</TableCell>
                                <TableCell>{task.mechanics.map(m => m.name).join(', ')}</TableCell>
                                <TableCell>
                                    <div className="text-xs space-y-1">
                                        <p><span className="font-semibold">Mulai:</span> {task.startedAt ? format(new Date(task.startedAt), 'dd/MM HH:mm') : '-'}</p>
                                        <p><span className="font-semibold">Target:</span> {format(new Date(task.vehicle.targetDate), 'dd/MM')} @ {task.vehicle.targetTime}</p>
                                        <p><span className="font-semibold">Selesai:</span> {task.completedAt ? format(new Date(task.completedAt), 'dd/MM HH:mm') : '-'}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{calculateTotalDelay(task)}</span>
                                        {task.riwayatTunda && task.riwayatTunda.length > 0 && (
                                            <ol className="text-xs text-orange-500 mt-1 italic list-decimal list-inside">
                                                {task.riwayatTunda.map((tunda, index) => (
                                                  <li key={index}>{tunda.alasan}</li>
                                                ))}
                                            </ol>
                                          )}
                                    </div>
                                </TableCell>
                                <TableCell>{calculateEffectiveDuration(task)}</TableCell>
                                <TableCell><CompletionStatusBadge task={task} /></TableCell>
                            </TableRow>
                            )
                        })
                        ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                            Tidak ada riwayat perbaikan ditemukan untuk filter yang dipilih.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </div>
                </CardContent>
            </Card>
        </>
    );
};


export default function KepalaMekanikPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('Dashboard');
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [alat, setAlat] = useState<AlatData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [mechanicTasks, setMechanicTasks] = useState<MechanicTask[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  
  const [isQuarantineConfirmOpen, setIsQuarantineConfirmOpen] = useState(false);
  const [quarantineTarget, setQuarantineTarget] = useState<AlatData | null>(null);


  // State for Sopir & Batangan
  const [pairings, setPairings] = useState<SopirBatanganData[]>([]);
  const [isFetchingPairings, setIsFetchingPairings] = useState(true);
  
  // Detail List Dialog state
  const [detailListTitle, setDetailListTitle] = useState('');
  const [detailListData, setDetailListData] = useState<any[]>([]);
  const [isDetailListOpen, setIsDetailListOpen] = useState(false);
  
  // Notification state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [seenDamagedReports, setSeenDamagedReports] = useState<Set<string>>(new Set());
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const isInitialLoad = useRef(true);



  const getStatusBadge = (status: Report['overallStatus'] | 'Belum Checklist' | 'Tanpa Operator' | 'Karantina') => {
    switch (status) {
      case 'baik':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">Baik</Badge>;
      case 'perlu perhatian':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">Perlu Perhatian</Badge>;
      case 'rusak':
        return <Badge variant="destructive">Rusak</Badge>;
       case 'Karantina':
        return <Badge variant="destructive">Karantina</Badge>;
      case 'Tanpa Operator':
          return <Badge variant="secondary">Tanpa Operator</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.replace('/login');
      return;
    }
    const userData = JSON.parse(userString);
     if (userData.jabatan.toUpperCase() !== 'KEPALA MEKANIK') {
      toast({
        variant: 'destructive',
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
      });
      router.replace('/login');
      return;
    }
    setUserInfo(userData);
    setIsLoading(false);
  }, [router, toast]);
  
    const dataTransformer = useCallback((docData: any): any => {
        const transformedData = { ...docData };
        const timestampFields = ['timestamp', 'createdAt', 'startedAt', 'completedAt'];

        for (const field of timestampFields) {
            if (transformedData[field] && typeof transformedData[field].toDate === 'function') {
                transformedData[field] = transformedData[field].toDate();
            }
        }

        if (transformedData.riwayatTunda && Array.isArray(transformedData.riwayatTunda)) {
            transformedData.riwayatTunda = transformedData.riwayatTunda.map((tundaItem: any) => {
                const newTundaItem = { ...tundaItem };
                if (newTundaItem.waktuMulai && typeof newTundaItem.waktuMulai.toDate === 'function') {
                    newTundaItem.waktuMulai = newTundaItem.waktuMulai.toDate();
                }
                if (newTundaItem.waktuSelesai && typeof newTundaItem.waktuSelesai.toDate === 'function') {
                    newTundaItem.waktuSelesai = newTundaItem.waktuSelesai.toDate();
                }
                return newTundaItem;
            });
        }
        
        return transformedData;
    }, []);

    const setupListener = useCallback((collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        const q = query(collection(db, collectionName));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => dataTransformer({ id: d.id, ...d.data() }));
            setter(data);
        }, (error) => {
            console.error(`Error fetching ${collectionName}:`, error);
            toast({ variant: 'destructive', title: `Gagal Memuat ${collectionName}` });
        });
    }, [dataTransformer, toast]);

    useEffect(() => {
        if (!userInfo) return;
    
        setIsFetchingData(true);
        isInitialLoad.current = true;
    
        const unsubscribers = [
            setupListener('users', setUsers),
            setupListener('alat', setAlat),
            setupListener('locations', setLocations),
            setupListener('mechanic_tasks', setMechanicTasks),
        ];
        
        const pairingUnsub = onSnapshot(query(collection(db, "sopir_batangan")), (snapshot) => {
            const data = snapshot.docs.map(d => dataTransformer({ id: d.id, ...d.data() }));
            setPairings(data);
            setIsFetchingPairings(false);
        }, (error) => {
            console.error(`Error fetching sopir_batangan:`, error);
            toast({ variant: 'destructive', title: `Gagal Memuat sopir_batangan` });
            setIsFetchingPairings(false);
        });
        unsubscribers.push(pairingUnsub);
        
        const reportsUnsub = onSnapshot(query(collection(db, 'checklist_reports')), (snapshot) => {
            const data = snapshot.docs.map(d => dataTransformer({ id: d.id, ...d.data() })) as Report[];
            
            if (isInitialLoad.current) {
                const initialDamaged = new Set(data.filter(r => r.overallStatus === 'rusak').map(r => r.id));
                setSeenDamagedReports(initialDamaged);
            } else {
                const newDamagedReports = data.filter(r => r.overallStatus === 'rusak' && !seenDamagedReports.has(r.id));
                if (newDamagedReports.length > 0) {
                    audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
                    setHasNewMessage(true);
                    setSeenDamagedReports(prev => new Set([...Array.from(prev), ...newDamagedReports.map(r => r.id)]));
                }
            }
            setReports(data);
        });
        unsubscribers.push(reportsUnsub);
        
        const timer = setTimeout(() => {
            setIsFetchingData(false);
            isInitialLoad.current = false;
        }, 2000);
        unsubscribers.push(() => clearTimeout(timer));
    
        return () => unsubscribers.forEach(unsub => unsub());
    }, [userInfo, setupListener, dataTransformer, toast]);

  
  const usersInLocation = useMemo(() => {
    if (!userInfo?.lokasi) return users;
    return users.filter(user => user.lokasi === userInfo.lokasi);
  }, [users, userInfo?.lokasi]);
  
  const getLatestReport = (nomorLambung: string, allReports: Report[]): Report | undefined => {
    if (!Array.isArray(allReports)) return undefined;
    return allReports
      .filter(r => r.nomorLambung === nomorLambung)
      .sort((a, b) => {
         const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
         const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
         return dateB - dateA;
      })[0];
  };

  const statsData = useMemo(() => {
    const defaultStats = { count: '0', list: [] };
    if (isFetchingData || !userInfo?.lokasi) {
        return { totalAlat: defaultStats, sudahChecklist: defaultStats, belumChecklist: defaultStats, alatBaik: defaultStats, perluPerhatian: defaultStats, alatRusak: defaultStats, alatRusakBerat: defaultStats, alatTdkAdaOperator: defaultStats };
    }
    const alatInLocation = alat.filter(a => a.lokasi === userInfo.lokasi);
    const existingAlatIds = new Set(alatInLocation.map(a => a.nomorLambung));

    const validReports = reports.filter(r => r.nomorLambung && existingAlatIds.has(r.nomorLambung));

    const reportsToday = validReports.filter(r => r.timestamp && isSameDay(new Date(r.timestamp), new Date()));
    const checkedVehicleIdsToday = new Set(reportsToday.map(r => r.nomorLambung));
    
    const pairedAlatInLocation = alatInLocation.filter(a => pairings.some(p => p.nomorLambung === a.nomorLambung));
    const alatBelumChecklistList = pairedAlatInLocation.filter(a => !checkedVehicleIdsToday.has(a.nomorLambung));

    const getLatestReportForAlat = (nomorLambung: string) => getLatestReport(nomorLambung, validReports);
    
    const alatBaikList = alatInLocation.filter(a => getLatestReportForAlat(a.nomorLambung)?.overallStatus === 'baik');
    const perluPerhatianList = alatInLocation.filter(a => getLatestReportForAlat(a.nomorLambung)?.overallStatus === 'perlu perhatian');
    const alatRusakList = alatInLocation.filter(a => getLatestReportForAlat(a.nomorLambung)?.overallStatus === 'rusak');

    const alatRusakBeratList = alat.filter(a => a.statusKarantina === true);
    const alatTdkAdaOperatorList = alatInLocation.filter(a => !pairings.some(p => p.nomorLambung === a.nomorLambung) && !a.statusKarantina);


    const mapToDetailFormat = (items: AlatData[], statusSource: 'latest' | 'belum' | 'karantina' | 'unpaired') => {
      return items.map(item => {
        let status: Report['overallStatus'] | 'Belum Checklist' | 'Karantina' | 'Tanpa Operator' = 'Belum Checklist';
        
        if (statusSource === 'latest') {
          const report = getLatestReportForAlat(item.nomorLambung);
          status = report?.overallStatus || 'Belum Checklist';
        } else if (statusSource === 'karantina') {
          status = 'Karantina';
        } else if (statusSource === 'unpaired') {
          status = 'Tanpa Operator';
        }

        const pairing = pairings.find(p => p.nomorLambung === item.nomorLambung);
        return { id: item.id, nomorPolisi: item.nomorPolisi || 'N/A', nomorLambung: item.nomorLambung, operatorPelapor: pairing?.namaSopir || 'Belum Ada Sopir', status: status };
      });
    };

    return {
      totalAlat: { count: String(alatInLocation.length), list: mapToDetailFormat(alatInLocation, 'latest') },
      sudahChecklist: { count: String(checkedVehicleIdsToday.size), list: mapToDetailFormat(alatInLocation.filter(a => checkedVehicleIdsToday.has(a.nomorLambung)), 'latest') },
      belumChecklist: { count: String(alatBelumChecklistList.length), list: mapToDetailFormat(alatBelumChecklistList, 'belum') },
      alatBaik: { count: String(alatBaikList.length), list: mapToDetailFormat(alatBaikList, 'latest') },
      perluPerhatian: { count: String(perluPerhatianList.length), list: mapToDetailFormat(perluPerhatianList, 'latest') },
      alatRusak: { count: String(alatRusakList.length), list: mapToDetailFormat(alatRusakList, 'latest') },
      alatRusakBerat: { count: String(alatRusakBeratList.length), list: mapToDetailFormat(alatRusakBeratList, 'karantina') },
      alatTdkAdaOperator: { count: String(alatTdkAdaOperatorList.length), list: mapToDetailFormat(alatTdkAdaOperatorList, 'unpaired') },
    };
}, [alat, userInfo?.lokasi, reports, pairings, isFetchingData]);
  
  const statCards = useMemo(() => {
    return [
      { title: 'Total Alat', value: statsData.totalAlat.count, description: 'Total alat di lokasi Anda', icon: Copy, color: 'text-blue-400' },
      { title: 'Alat Sudah Checklist', value: statsData.sudahChecklist.count, description: 'Alat yang sudah dicek hari ini', icon: CheckCircle, color: 'text-green-400' },
      { title: 'Alat Belum Checklist', value: statsData.belumChecklist.count, description: 'Alat (dengan sopir) yang belum dicek', icon: AlertTriangle, color: 'text-yellow-400' },
      { title: 'Alat Baik', value: statsData.alatBaik.count, description: 'Status terakhir "Baik"', icon: CheckCircle, color: 'text-green-400' },
      { title: 'Perlu Perhatian', value: statsData.perluPerhatian.count, description: 'Status terakhir "Perlu Perhatian"', icon: AlertTriangle, color: 'text-yellow-400' },
      { title: 'Alat Rusak', value: statsData.alatRusak.count, description: 'Status terakhir "Rusak"', icon: WrenchIcon, color: 'text-red-400' },
      { title: 'Alat Rusak Berat', value: statsData.alatRusakBerat.count, description: 'Alat yang dikarantina', icon: ShieldAlert, color: 'text-destructive' },
      { title: 'Alat Tdk Ada Operator', value: statsData.alatTdkAdaOperator.count, description: 'Alat tanpa sopir/operator', icon: UserX, color: 'text-orange-400' },
    ];
  }, [statsData]);

  const handleStatCardClick = (title: string) => {
    if (isFetchingData || !userInfo?.lokasi) return;

    setDetailListTitle(title);
    
    switch (title) {
        case 'Total Alat': setDetailListData(statsData.totalAlat.list); break;
        case 'Alat Sudah Checklist': setDetailListData(statsData.sudahChecklist.list); break;
        case 'Alat Belum Checklist': setDetailListData(statsData.belumChecklist.list); break;
        case 'Alat Baik': setDetailListData(statsData.alatBaik.list); break;
        case 'Perlu Perhatian': setDetailListData(statsData.perluPerhatian.list); break;
        case 'Alat Rusak': setDetailListData(statsData.alatRusak.list); break;
        case 'Alat Rusak Berat': setDetailListData(statsData.alatRusakBerat.list); break;
        case 'Alat Tdk Ada Operator': setDetailListData(statsData.alatTdkAdaOperator.list); break;
        default: toast({ title: `Detail untuk: ${title}`, description: 'Fungsionalitas detail belum tersedia.' }); return;
    }
    
    setIsDetailListOpen(true);
  }

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };
  
  const woList = useMemo(() => {
    const existingTaskReportIds = new Set(mechanicTasks.map(task => task.vehicle?.triggeringReportId));
    return reports
      .filter(report => 
        (report.overallStatus === 'rusak' || report.overallStatus === 'perlu perhatian') && 
        !existingTaskReportIds.has(report.id)
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [reports, mechanicTasks]);

  const mechanicsInLocation = useMemo(() => 
      users.filter(u => u.jabatan?.toUpperCase().includes('MEKANIK') && u.lokasi === userInfo?.lokasi), 
  [users, userInfo?.lokasi]);

  const activeTasks = useMemo(() => {
    return mechanicTasks.filter(task => task.status !== 'COMPLETED');
  }, [mechanicTasks]);
  
  const handleTaskStatusChange = async (task: MechanicTask, newStatus: MechanicTask['status']) => {
    const taskDocRef = doc(db, 'mechanic_tasks', task.id);
    const updateData: Partial<MechanicTask> = { status: newStatus };

    if (newStatus === 'DELAYED') {
      const reason = prompt("Masukkan alasan menunda pekerjaan:");
      if (reason) {
        updateData.delayReason = reason;
        updateData.delayStartedAt = new Date().getTime();
        updateData.riwayatTunda = [...(task.riwayatTunda || []), { alasan: reason, waktuMulai: Timestamp.now(), waktuSelesai: null! }];
      } else {
        return; // User cancelled
      }
    }

    if (newStatus === 'IN_PROGRESS' && task.status === 'PENDING' && !task.startedAt) {
      updateData.startedAt = new Date().getTime();
    } else if (newStatus === 'IN_PROGRESS' && task.status === 'DELAYED') {
      const lastDelay = task.riwayatTunda?.[task.riwayatTunda.length - 1];
      if (lastDelay && !lastDelay.waktuSelesai) {
          lastDelay.waktuSelesai = Timestamp.now();
          const delayDuration = lastDelay.waktuSelesai.toMillis() - lastDelay.waktuMulai.toMillis();
          updateData.totalDelayDuration = (task.totalDelayDuration || 0) + delayDuration;
          updateData.riwayatTunda = task.riwayatTunda;
      }
    }
    
    if (newStatus === 'COMPLETED') {
        const repairDescription = prompt("Masukkan deskripsi perbaikan yang telah dilakukan:");
        if (repairDescription) {
            updateData.completedAt = new Date().getTime();
            updateData.mechanicRepairDescription = repairDescription;
        } else {
            toast({ title: "Aksi Dibatalkan", description: "Deskripsi perbaikan wajib diisi untuk menyelesaikan WO.", variant: "destructive" });
            return;
        }
    }


    try {
      await updateDoc(taskDocRef, updateData as any);
      toast({ title: `Status WO Diperbarui`, description: `Status untuk ${task.vehicle.hullNumber} diubah menjadi ${newStatus}.` });
    } catch (error) {
      console.error("Error updating task status:", error);
      toast({ title: "Gagal Memperbarui Status", variant: "destructive" });
    }
  };

  const getTaskStatusBadge = (status: MechanicTask['status']) => {
    switch (status) {
      case 'PENDING': return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">Menunggu</Badge>;
      case 'IN_PROGRESS': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300 animate-pulse">Dikerjakan</Badge>;
      case 'DELAYED': return <Badge variant="destructive">Tunda</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

    const handleQuarantineRequest = (item: AlatData) => {
      setQuarantineTarget(item);
      setIsQuarantineConfirmOpen(true);
  }

  const handleConfirmQuarantine = async () => {
    if (!quarantineTarget) return;
    setIsSubmitting(true);
    const newStatus = !quarantineTarget.statusKarantina;
    
    try {
        const alatDocRef = doc(db, 'alat', quarantineTarget.id);
        await updateDoc(alatDocRef, { statusKarantina: newStatus });
        
        if (newStatus) { // if the vehicle is being quarantined
            const q = query(collection(db, "sopir_batangan"), where("nomorLambung", "==", quarantineTarget.nomorLambung));
            const pairingSnapshot = await getDocs(q);
            if (!pairingSnapshot.empty) {
                const pairingDoc = pairingSnapshot.docs[0];
                await deleteDoc(doc(db, "sopir_batangan", pairingDoc.id));
                toast({ title: 'Sopir Dilepaskan', description: `Sopir untuk ${quarantineTarget.nomorLambung} telah dilepaskan.` });
            }
             toast({
                title: `Alat Dikarantina`,
                description: `${quarantineTarget.nomorLambung} telah dimasukkan ke karantina.`
            });
        } else { // if the vehicle is being RELEASED from quarantine
            const dummyReport: Omit<Report, 'id' | 'timestamp'> & { timestamp: any } = {
                timestamp: Timestamp.now(),
                nomorLambung: quarantineTarget.nomorLambung,
                operatorName: 'SISTEM',
                operatorId: 'SISTEM',
                location: quarantineTarget.lokasi,
                overallStatus: 'rusak',
                description: 'Alat ini baru dilepas dari karantina dan membutuhkan pengecekan serta perbaikan menyeluruh.',
                photo: '',
            };
            await addDoc(collection(db, 'checklist_reports'), dummyReport);
            toast({
                title: `Alat Dilepas dari Karantina`,
                description: `${quarantineTarget.nomorLambung} telah dilepas dan WO baru telah dibuat otomatis.`
            });
        }
    } catch (error) {
        console.error("Error toggling quarantine status:", error);
        toast({ title: 'Gagal Memperbarui Status', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
        setIsQuarantineConfirmOpen(false);
        setQuarantineTarget(null);
    }
  };

  const renderContent = () => {
    switch (activeMenu) {
        case 'Dashboard':
            return (
              <main>
                 <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-6 mb-8">
                   {isFetchingData ? (
                       Array.from({ length: 8 }).map((_, i) => (
                          <Card key={i}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><Skeleton className="h-5 w-2/4" /><Skeleton className="h-6 w-6 rounded-full" /></CardHeader><CardContent><Skeleton className="h-12 w-1/4 mt-2" /><Skeleton className="h-4 w-3/4 mt-2" /></CardContent></Card>
                       ))
                   ) : statCards.map(card => (<StatCard key={card.title} {...card} onClick={() => handleStatCardClick(card.title)}/>))}
                </div>
              </main>
            );
        case 'Work order saya (WO)':
            return (
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Laporan Kerusakan (Work Order)</CardTitle>
                        <CardDescription>Daftar kendaraan yang dilaporkan rusak dan membutuhkan perbaikan segera.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="overflow-x-auto border rounded-lg">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Waktu Pelaporan</TableHead>
                                       <TableHead>Sopir/Operator</TableHead>
                                       <TableHead>Nomor Kendaraan</TableHead>
                                       <TableHead>Deskripsi Kerusakan</TableHead>
                                       <TableHead className='text-right'>Aksi</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {isFetchingData ? (
                                     <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                   ) : woList.length > 0 ? (
                                     woList.map(report => {
                                       const vehicle = alat.find(a => a.nomorLambung === report.nomorLambung);
                                       const operator = users.find(u => u.id === report.operatorId);
                                       if (!vehicle) return null;
                                       return (
                                         <TableRow key={report.id}>
                                             <TableCell>{format(new Date(report.timestamp), 'dd MMM, HH:mm', { locale: localeID })}</TableCell>
                                             <TableCell>
                                                 <p>{operator?.username || 'N/A'}</p>
                                                 <p className="text-xs text-muted-foreground">NIK: {operator?.nik || '-'}</p>
                                             </TableCell>
                                             <TableCell>
                                                 <p className="font-semibold">{vehicle.nomorLambung}</p>
                                                 <p className="text-xs text-muted-foreground">{vehicle.nomorPolisi} ({vehicle.jenisKendaraan})</p>
                                             </TableCell>
                                             <TableCell className="max-w-xs truncate">{report.description}</TableCell>
                                             <TableCell className="text-right">
                                                 <CreateWorkOrderDialog vehicle={vehicle} report={report} mechanics={mechanicsInLocation} onTaskCreated={() => {}} />
                                             </TableCell>
                                         </TableRow>
                                       );
                                     })
                                   ) : (
                                       <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada laporan kerusakan baru.</TableCell></TableRow>
                                   )}
                               </TableBody>
                           </Table>
                       </div>
                    </CardContent>
                </Card>
            );
        case 'Work order aktif':
            return (
                <Card>
                  <CardHeader>
                    <CardTitle>Work Order Aktif</CardTitle>
                    <CardDescription>
                      Daftar semua pekerjaan perbaikan yang sedang menunggu atau dalam proses.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Kendaraan</TableHead>
                            <TableHead>Pelapor</TableHead>
                            <TableHead>Deskripsi</TableHead>
                            <TableHead>Foto</TableHead>
                            <TableHead>Mekanik Bertugas</TableHead>
                            <TableHead>Target Selesai</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isFetchingData ? (
                            <TableRow>
                              <TableCell colSpan={7} className="h-24 text-center">
                                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                              </TableCell>
                            </TableRow>
                          ) : activeTasks.length > 0 ? (
                            activeTasks.map((task) => {
                              const triggeringReport = reports.find(
                                (r) => r.id === task.vehicle?.triggeringReportId
                              );
                              const sopir = users.find(
                                (u) => u.id === triggeringReport?.operatorId
                              );
                              return (
                                <TableRow key={task.id}>
                                  <TableCell>
                                    <p className="font-semibold">
                                      {task.vehicle.hullNumber}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {task.vehicle.licensePlate}
                                    </p>
                                  </TableCell>
                                  <TableCell>
                                    <p>{sopir?.username || 'N/A'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatRelative(new Date(task.createdAt), new Date(), { locale: localeID })}
                                    </p>
                                  </TableCell>
                                  <TableCell className="max-w-[200px] truncate">
                                    {triggeringReport?.description || 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {triggeringReport?.photo && (
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <Eye className="h-5 w-5" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-3xl">
                                                <DialogHeader>
                                                    <DialogTitle>Foto Laporan Kerusakan</DialogTitle>
                                                </DialogHeader>
                                                <img src={Array.isArray(triggeringReport.photo) ? triggeringReport.photo[0] : triggeringReport.photo} alt="Foto Kerusakan" className="rounded-lg w-full h-auto" data-ai-hint="mechanic report broken" />
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {task.mechanics.map((m) => m.name).join(', ')}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(task.vehicle.targetDate), 'dd MMM yyyy')}
                                    {' @ '}{task.vehicle.targetTime}
                                  </TableCell>
                                  <TableCell>
                                    <Select value={task.status} onValueChange={(newStatus) => handleTaskStatusChange(task, newStatus as MechanicTask['status'])}>
                                      <SelectTrigger className="w-36">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="PENDING">Menunggu</SelectItem>
                                        <SelectItem value="IN_PROGRESS">Dikerjakan</SelectItem>
                                        <SelectItem value="DELAYED">Tunda</SelectItem>
                                        <SelectItem value="COMPLETED">Selesai</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                Tidak ada work order yang sedang aktif.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
        case 'Alat Rusak Berat/Karantina':
            return (
                <Card>
                    <CardHeader>
                        <CardTitle>Alat Rusak Berat / Karantina</CardTitle>
                        <CardDescription>Daftar alat yang ditandai sebagai rusak berat atau sedang dalam masa karantina.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="overflow-x-auto border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nomor Lambung</TableHead>
                                        <TableHead>Nomor Polisi</TableHead>
                                        <TableHead>Jenis Kendaraan</TableHead>
                                        <TableHead>Laporan Terakhir</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className='text-right'>Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isFetchingData ? (<TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>) : statsData.alatRusakBerat.list.length > 0 ? (statsData.alatRusakBerat.list.map((item:any) => {
                                        const latestReport = getLatestReport(item.nomorLambung, reports);
                                        return (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.nomorLambung}</TableCell>
                                            <TableCell>{item.nomorPolisi}</TableCell>
                                            <TableCell>{alat.find(a => a.id === item.id)?.jenisKendaraan}</TableCell>
                                            <TableCell>
                                                <p>{latestReport?.description || 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {latestReport?.timestamp ? format(new Date(latestReport.timestamp), 'dd MMM yyyy', {locale: localeID}) : 'N/A'}
                                                </p>
                                            </TableCell>
                                            <TableCell>{getStatusBadge('Karantina')}</TableCell>
                                            <TableCell className='text-right'>
                                                <div className="flex flex-col items-end gap-2">
                                                    <div className="space-y-1">
                                                         <h4 className="font-semibold text-xs text-right">Karantina</h4>
                                                         <Button size="sm" variant="outline" onClick={() => handleQuarantineRequest(alat.find(a => a.id === item.id)!)}>
                                                            Lepas Karantina
                                                        </Button>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )})) : (<TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Tidak ada alat yang dikarantina.</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                         </div>
                    </CardContent>
                </Card>
            );
        case 'Histori Perbaikan Alat':
             return <HistoryComponent user={userInfo} allTasks={mechanicTasks} allUsers={users} allAlat={alat} allReports={reports} />;
        default:
            return <Card><CardContent className="p-10 text-center"><h2 className="text-xl font-semibold text-muted-foreground">Fitur Dalam Pengembangan</h2><p>Halaman untuk {activeMenu} akan segera tersedia.</p></CardContent></Card>
    }
  }

  if (isLoading || !userInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
     <audio ref={audioRef} src="/sounds/notification.mp3" preload="auto" />
      <Dialog open={isDetailListOpen} onOpenChange={setIsDetailListOpen}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Detail: {detailListTitle}</DialogTitle>
                    <DialogDescription>
                        Berikut adalah daftar alat yang termasuk dalam kategori ini di lokasi Anda.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto mt-4 pr-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>No. Polisi</TableHead>
                                <TableHead>No. Lambung</TableHead>
                                <TableHead>Sopir (Batangan)</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detailListData.length > 0 ? (
                                detailListData.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.nomorPolisi}</TableCell>
                                        <TableCell>{item.nomorLambung}</TableCell>
                                        <TableCell>{item.operatorPelapor}</TableCell>
                                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                        Tidak ada alat dalam kategori ini.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter className="mt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Tutup</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
      </Dialog>
      
       <AlertDialog open={isQuarantineConfirmOpen} onOpenChange={setIsQuarantineConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Status Karantina</AlertDialogTitle>
                <AlertDialogDescription>
                   Anda yakin ingin {quarantineTarget?.statusKarantina ? 'mengeluarkan' : 'memasukkan'} kendaraan <strong>{quarantineTarget?.nomorLambung}</strong> {quarantineTarget?.statusKarantina ? 'dari' : 'ke dalam'} karantina?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmQuarantine}>
                    Ya, Konfirmasi
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>


    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar>
          <SidebarContent className="flex flex-col">
            <SidebarHeader>
              <h2 className="text-lg font-semibold text-primary px-2">Dasbor Mekanik</h2>
            </SidebarHeader>
            <SidebarMenu className="flex-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                        isActive={activeMenu === item.name}
                        onClick={() => setActiveMenu(item.name as ActiveMenu)}
                        className="h-9 relative"
                    >
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.name}</span>
                         {item.name === 'Pesan Masuk' && hasNewMessage && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
                         )}
                    </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarFooter className="p-2 space-y-2">
                 <div className="text-center p-4 border rounded-lg">
                     <p className='font-bold'>{userInfo.username}</p>
                     <p className='text-xs text-muted-foreground'>{userInfo.nik} - {userInfo.jabatan}</p>
                 </div>
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-muted-foreground">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </SidebarFooter>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="flex-1 p-6 lg:p-10">
            <header className="flex justify-between items-start mb-8">
                <div>
                     <h1 className="text-3xl font-bold text-foreground">
                        {activeMenu}
                     </h1>
                     <p className="text-sm text-muted-foreground flex items-center gap-4">
                         <span>{userInfo.username}</span>
                         <span className='flex items-center gap-1.5'><Fingerprint size={12}/>{userInfo.nik}</span>
                         <span className='flex items-center gap-1.5'><Briefcase size={12}/>{userInfo.jabatan}</span>
                         <span>Lokasi: {userInfo.lokasi}</span>
                     </p>
                </div>
            </header>
            
            {renderContent()}

          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
    </>
  );
}
