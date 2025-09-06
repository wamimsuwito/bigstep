

export type StockValues = { [key: string]: string | number };

export interface UserData {
  id: string;
  username: string;
  password?: string;
  nik: string;
  jabatan: string;
  lokasi: string; 
  role?: string;
  unitBp?: string; // The specific batching plant unit
}

export interface LocationData {
    id: string;
    name: string;
    details: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    }
}

export interface Report {
    id: string;
    timestamp: any;
    nomorLambung: string;
    operatorName: string;
    operatorId: string;
    location: string;
    overallStatus: 'baik' | 'perlu perhatian' | 'rusak';
    description?: string;
    photo?: string | string[];
    repairedBy?: string;
}

export interface ScaleData {
  id: number;
  name: string;
  weight: number;
  unit: string;
  min: number;
  max: number;
  target?: number;
}

export type ScaleStatus = 'normal' | 'warning' | 'danger';

export interface Scale extends ScaleData {
  status?: ScaleStatus;
}

export type OperationMode = 'manual' | 'auto';

export interface ScheduleRow {
    id: string;
    'NO': string;
    'NO P.O': string;
    'GRUP'?: string;
    'NAMA': string;
    'LOKASI': string;
    'GRADE': string;
    'SLUMP (CM)': string;
    'CP/M': string;
    'VOL M³': string;
    'PENAMBAHAN VOL M³': string;
    'TOTAL M³': string;
    'TERKIRIM M³': string;
    'SISA M³': string;
    'STATUS': 'menunggu' | 'proses' | 'tunda' | 'selesai';
    'KET': string;
    'NAMA SOPIR'?: string;
    'NOMOR MOBIL'?: string;
    'NOMOR LAMBUNG'?: string;
    'unitBp'?: string;
    [key: string]: any; 
}

export interface ArchivedSchedule {
    id: string; // YYYY-MM-DD format
    date: string; // ISO String
    location: string;
    scheduleData: ScheduleRow[];
}

export interface JobMix {
    id?: string;
    mutuBeton: string;
    pasir1: number;
    pasir2: number;
    batu1: number;
    batu2: number;
    semen: number;
    air: number;
    slump?: string;
}

export type MaterialName = 'PASIR' | 'BATU' | 'SEMEN 1' | 'SEMEN 2' | 'AIR';

export type LoadingOrderSettings = {
  [key: string]: { urutan: string; detik: string };
};

export interface MixerSettings {
  opening1: number;
  opening2: number;
  opening3: number;
  tutup: number;
}

export interface MoistureSettings {
    pasir: number;
    batu: number;
    air: number;
}

export interface PrintData {
    schedule: ScheduleRow;
    jobMix: JobMix;
    targetVolume: string;
    jumlahMixing: number;
    startTime: Date;
    endTime: Date;
    nomorRitasi?: number;
    totalVolumeTerkirim?: number;
    unitBp?: string;
    selectedSilo?: string;
}

export interface ProductionData {
    id?: string;
    jobId: string;
    tanggal: any; // Can be Date object or ISO string for local
    namaPelanggan: string;
    lokasiProyek: string;
    mutuBeton: string;
    targetVolume: number;
    jumlahMixing: number;
    jamMulai: string; // ISO string
    jamSelesai: string; // ISO string
    namaSopir?: string;
    nomorMobil?: string;
    nomorLambung?: string;
    slump?: string;
    'CP/M'?: string;
    jobMix: JobMix;
    nomorRitasi?: number;
    totalVolumeTerkirim?: number;
    lokasiProduksi: string; // The BP where production happened
    unitBp?: string; // The specific unit (BP-1, BP-2)
    materialUsage?: MaterialUsage;
}

export interface MaterialUsage {
    pasir: number;
    batu: number;
    semen: number;
    air: number;
    sikaVz: number;
    sikaNn: number;
    visco: number;
}

export interface SopirBatanganData {
    id: string;
    userId: string;
    namaSopir: string;
    nik: string;
    vehicleId: string;
    nomorPolisi: string;
    nomorLambung: string;
    keterangan: string;
    lokasi: string;
    timestamp: any;
}

export interface PemasukanMaterial {
    [materialKey: string]: number;
}

export interface SiloData {
    stock: number;
    status: 'aktif' | 'non-aktif' | 'perbaikan';
    capacity?: number;
}


export interface CementSiloStock {
    silos: { [siloName: string]: SiloData };
    tanks?: { [tankName: string]: SiloData };
}

export interface PemasukanLogEntry {
  id: string;
  timestamp: string | any;
  material: string;
  noSpb: string;
  namaKapal: string;
  namaSopir: string;
  jumlah: number;
  unit: string;
  keterangan?: string;
  distribution?: { [siloName: string]: number };
  lokasi?: string;
}

export interface PengirimanEntry {
    id: string;
    timestamp: string;
    lokasiTujuan: string;
    nomorKendaraan: string;
    namaSopir: string;
    jenisBarang: string;
    volume: number;
    unit: string;
    jamPengiriman: string;
    keterangan: string;
}


export interface BufferSiloStock {
    silos: { [siloName: string]: number };
}

export interface BufferTankStock {
    tanks: { [tankName: string]: number };
}

export interface TransferLogEntry {
    id: string;
    timestamp: string;
    sourceType: 'Buffer Silo' | 'Buffer Tangki';
    sourceName: string;
    destinationUnit: string;
    destinationSilo: string;
    amount: number;
}

export interface RencanaPemasukan {
    id: string;
    namaKapal: string;
    namaSuplier?: string;
    jenisMaterial: string;
    estimasiMuatan: number;
    eta: any;
    namaSopir?: string;
    keterangan: string;
    status?: 'Dalam Perjalanan' | 'Telah Tiba' | 'Menunggu Inspeksi QC' | 'Sedang Dilakukan Inspeksi QC' | 'Memenuhi Syarat' | 'Ditolak' | 'Siap Untuk Dibongkar' | 'Selesai Bongkar' | 'Dibatalkan';
    noSpb: string;
    spbPerTank?: Record<string, string>;
    realisasiMuatan?: number;
    tankLoads?: Record<string, number>;
    arrivalConfirmedAt: string | null;
    inspection?: QCInspectionData;
    completedActivities?: CementActivity[];
    bongkarSelesaiAt?: string;
    createdAt?: any;
}

export interface QCInspectionData {
    inspectedBy: string;
    inspectionDate: string;
    description: string;
    materialPhoto?: string;
    mudContent?: number;
    mudContentPhoto?: string;
    sandZone?: number;
    sandZonePhoto?: string;
}

export interface DailyQCInspection {
    id: string;
    createdAt: any; // Firestore Timestamp
    inspectedBy: string;
    location: string;
    items: Record<string, { value: string; photo?: string | null }>;
}


export interface ResetHistoryEntry {
    id?: string;
    timestamp: string;
    item: string;
    location: string;
    stokSebelum: StockValues | { total: number };
    stokSesudah: StockValues | { total: number };
    updatedBy: string;
}

export interface Job {
  id: string;
  namaKapal: string;
  material: 'Batu' | 'Pasir';
  totalVolume: number; // Volume awal dari Admin
  volumeTerbongkar: number; // Dihitung dari total ritasi
  sisaVolume: number; // Dihitung dari totalVolume - volumeTerbongkar
  bbmPerRit: number;
  status: 'Menunggu' | 'Proses' | 'Tunda' | 'Selesai';
  jamMulai?: string; // ISO string, diisi saat status menjadi 'Proses'
  jamSelesai?: string; // ISO string, diisi saat status menjadi 'Selesai'
  totalWaktuTunda: number; // Akumulasi dalam milidetik
  riwayatTunda: {
    alasan: string;
    waktuMulai: string; // ISO string
    waktuSelesai?: string; // ISO string
  }[];
  rencanaId?: string; // To link back to the RencanaPemasukan
}

export interface TripLog {
  id?: string;
  jobId: string;
  tripNumber: number;
  material: 'Batu' | 'Pasir';
  destination: string;
  sopirId?: string; // Add sopirId to link the trip to a user
  sopirName?: string;
  vehicleNumber?: string;
  departFromBp?: string;
  arriveAtDestination?: string;
  startLoading?: string;
  finishLoading?: string;
  departFromDestination?: string;
  arriveAtBp?: string;
}

export interface ArchivedJob extends Job {
  archivedAt: string; // ISO string
  tripLogs: TripLog[];
}

export interface AlatData {
    id: string;
    nomorLambung: string;
    nomorPolisi: string;
    jenisKendaraan: string;
    lokasi: string;
    statusKarantina?: boolean;
}

export interface MechanicTask {
    id: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
    vehicle: {
        hullNumber: string;
        licensePlate: string;
        repairDescription: string;
        targetDate: string;
        targetTime: string;
        triggeringReportId?: string | null;
    };
    mechanics: { id: string; name: string }[];
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    delayReason?: string;
    delayStartedAt?: number;
    totalDelayDuration?: number; // Total delay in milliseconds
    riwayatTunda?: {
        alasan: string;
        waktuMulai: any;
        waktuSelesai: any;
    }[];
    mechanicRepairDescription?: string;
}


export interface CementActivity {
    id: string; // Composite ID e.g., 'tank-1-to-silo-2'
    sourceTankId: string;
    destinationType: 'silo' | 'buffer-silo' | 'buffer-tank';
    destinationId: string;
    destinationUnit?: string; // e.g., 'BP-1'
    status: 'berjalan' | 'jeda' | 'selesai';
    startTime: string; // ISO string for persistence
    endTime: string | null; // ISO string
    pauseHistory: { start: string; end: string | null; reason: string }[];
    totalPauseDuration: number; // in ms
}

export interface CementBongkarState {
    activities: CementActivity[];
    completedActivities: CementActivity[];
}

export interface BpUnitStatus {
    id: string; // e.g., 'BP-FRP-01_BP-1'
    lastActivity: any; // Firestore Timestamp
    unit: string;
    location: string;
}

export interface ActivityLog {
    id: string;
    userId: string;
    username: string;
    description: string;
    targetTimestamp: any;
    createdAt: any;
    status: 'pending' | 'in_progress' | 'completed';
    photoInitial?: string;
    photoInProgress?: string;
    photoCompleted?: string;
    timestampInProgress?: any;
    timestampCompleted?: any;
}

export interface PenaltyEntry {
    id: string;
    userId: string;
    username: string;
    nik: string;
    jabatan: string;
    poin: number;
    nilai?: number;
    penyebab: string;
    deskripsi: string;
    createdAt: any; // Firestore Timestamp
    createdBy: string;
}

export interface RewardEntry {
    id: string;
    userId: string;
    username: string;
    nik: string;
    jabatan: string;
    poin: number;
    nilai?: number;
    deskripsi: string;
    createdAt: any; // Firestore Timestamp
    createdBy: string;
}

export interface AttendanceRecord {
    id: string;
    userId: string;
    username: string;
    checkInTime: any; // Firestore Timestamp
    checkInLocationId: string;
    checkInLocationName: string;
    checkInPhoto: string | null;
    checkInDistance: number | null;
    checkInMode: 'Di Lokasi' | 'Dinas Luar';
    checkOutTime: any | null; // Firestore Timestamp
    checkOutLocationId?: string;
    checkOutLocationName?: string;
    checkOutPhoto?: string | null;
    checkOutDistance?: number | null;
    checkOutMode?: 'Di Lokasi' | 'Dinas Luar';
    keterangan?: string;
    lateMinutes?: number;
}

export interface OvertimeRecord {
    id: string;
    userId: string;
    username: string;
    overtimeDate: any; // Firestore Timestamp for the date
    description: string;
    checkInTime: any; // Firestore Timestamp
    checkInLocationId: string;
    checkInLocationName: string;
    checkInPhoto: string | null;
    checkInDistance: number | null;
    checkOutTime: any | null; // Firestore Timestamp
    checkOutLocationId?: string;
    checkOutLocationName?: string;
    checkOutPhoto?: string | null;
    checkOutDistance?: number | null;
}

export interface BendaUji {
    id?: string;
    productionId: string;
    scheduleId: string;
    qcId: string;
    qcName: string;
    jumlahSample: number;
    createdAt: any; // Firestore Timestamp
    lokasi: string;
    mutuBeton: string;
}
