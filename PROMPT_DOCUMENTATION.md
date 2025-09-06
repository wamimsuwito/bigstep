
# Prompt Rekreasi Aplikasi PT. Farika Riau Perkasa

Berikut adalah deskripsi teknis dan fungsional yang sangat detail untuk setiap halaman utama dalam aplikasi manajemen operasional ini. Tujuannya adalah untuk memungkinkan AI lain mereplikasi aplikasi ini dengan presisi setinggi mungkin.

**Teknologi Utama:** Next.js dengan App Router, React, TypeScript, Tailwind CSS, ShadCN/UI untuk komponen, Lucide React untuk ikon, dan Firebase (Firestore) sebagai backend database.

---

## Halaman 1: Dasbor Operator Batching Plant (`/src/app/page.tsx`)

**Tujuan:** Halaman ini adalah pusat kendali utama bagi Operator Batching Plant (BP). Fungsinya untuk memonitor timbangan material secara *real-time*, mengelola jadwal produksi beton, dan mengontrol proses pencampuran (mixing) baik secara otomatis maupun manual.

**Tata Letak:**
- **Sidebar Kiri:** Berisi menu navigasi untuk mengakses berbagai fitur pengaturan seperti:
    - Atur Pintu Mixer (`MixerSettingsDialog`)
    - Urutan Loading (`LoadingOrderDialog`)
    - Tombol Manual (`ManualControlsDialog`)
    - Job Mix Formula (Link ke `/job-mix-formula`)
    - Database Produksi (Link ke `/database-produksi`)
    - Stok Material (Link ke `/stok-material`)
    - Moisture Control (`MoistureControlDialog`)
- **Header Atas:** Menampilkan logo perusahaan, nama pengguna, lokasi BP, dan unit BP yang sedang aktif, serta tombol Logout.
- **Konten Utama:**
    1.  **Indikator Timbangan (Atas):** Lima kartu (`WeightIndicator`) yang menampilkan berat *real-time* untuk BATU, PASIR, SEMEN 1, SEMEN 2, dan AIR. Setiap kartu menampilkan berat, unit (kg), progress bar menuju target, dan target berat.
    2.  **Panel Kontrol (Tengah):** Sebuah area dengan tiga kolom utama (`OperationControls`) untuk memasukkan detail pekerjaan sebelum memulai produksi.
    3.  **Status Mixing (Tengah Kanan):** Satu kartu (`MixingStatus`) yang menampilkan timer hitung mundur proses mixing dan log aktivitas terbaru.
    4.  **Tabel Jadwal (Bawah):** Tabel (`ScheduleTable`) yang menampilkan daftar jadwal produksi beton untuk hari itu dari Firestore.

**Fungsionalitas & Logika:**
- **Inisialisasi & Otentikasi:**
    - Saat halaman dimuat, sebuah objek `dummyUser` disiapkan untuk mensimulasikan operator yang sedang login. Ini menentukan lokasi dan unit BP yang aktif.
    - Jika lokasi atau unit belum ditentukan, dialog (`BpSelectionDialog` atau `UnitSelectionDialog`) akan muncul untuk memaksa pengguna memilih.
- **Manajemen Jadwal & Job Mix:**
    - Mengambil data jadwal (`ScheduleRow`) dari koleksi Firestore `schedules_today` secara *real-time* menggunakan `onSnapshot`.
    - Mengambil semua formula `JobMix` dari koleksi Firestore `jobmixes`.
    - Pengguna memasukkan "REQ NO" untuk mencari dan memuat detail jadwal dari tabel. Jika ditemukan, data jadwal dan `JobMix` yang sesuai akan dimuat ke dalam *state*.
- **Kontrol Produksi (`OperationControls`):**
    - Pengguna memasukkan **Nama Sopir** dan **Nomor Mobil** (dipilih dari daftar sopir yang sudah dipasangkan dengan kendaraan atau "batangan").
    - Pengguna memasukkan **Target Volume** (dalam M³).
    - **Jumlah Mixing** dihitung otomatis berdasarkan Target Volume dibagi kapasitas mixer (3.5 M³), dibulatkan ke atas.
    - Pengguna memilih **Silo Semen** yang akan digunakan (1-6).
    - **Tombol START:** Memulai proses produksi.
        - Jika mode "AUTO", fungsi `startAutoWeighing` dipanggil.
        - Fungsi ini menjalankan simulasi penimbangan dan penuangan material sesuai `JobMix` dan `LoadingOrderSettings`.
        - Proses meliputi: menimbang, menuang, mixing (sesuai timer), dan membuka/menutup pintu mixer.
    - **Tombol STOP:** Menghentikan proses yang sedang berjalan dan memanggil fungsi `handleStop`.
- **Penyimpanan Data & Pencetakan:**
    - Setelah proses selesai (atau dihentikan), `handleStop` akan:
        - Memperbarui status jadwal di Firestore (mengupdate `TERKIRIM M³`, `SISA M³`, dan `STATUS`).
        - Membuat entri baru di koleksi `productions` Firestore yang berisi semua detail produksi (waktu, volume, `JobMix`, data sopir, dll.).
        - Menghitung `MaterialUsage` berdasarkan `JobMix` dan volume produksi.
        - Menyiapkan data untuk dicetak (`PrintData`) dan menampilkan `PrintTicketLayout` dalam sebuah dialog pratinjau.
- **Dialog & Pengaturan:**
    - Terdapat dialog terpisah untuk mengatur:
        - **Urutan Loading (`LoadingOrderDialog`):** Mengatur kapan material (Batu, Semen, Air) dituang relatif terhadap Pasir.
        - **Pintu Mixer (`MixerSettingsDialog`):** Mengatur durasi (detik) untuk setiap tahap pembukaan dan penutupan pintu mixer.
        - **Kelembapan (`MoistureControlDialog`):** Mengatur persentase kadar air untuk Pasir dan Batu, serta penyesuaian volume Air (aditif).
        - **Kontrol Manual (`ManualControlsDialog`):** Menyediakan tombol untuk menjalankan setiap motor/proses (timbang, tuang, konveyor) secara manual.

---

## Halaman 2: Admin Super (`/src/app/admin/page.tsx`)

**Tujuan:** Halaman ini adalah pusat administrasi tertinggi untuk "SUPER ADMIN". Fungsinya untuk mengelola data master: Pengguna (karyawan), Alat (kendaraan), dan Lokasi (Batching Plant).

**Tata Letak:**
- **Sidebar Kiri:** Navigasi utama untuk berpindah antar menu:
    - Manajemen Pengguna
    - Manajemen Alat
    - Manajemen Lokasi
    - Sinkronisasi Data
- **Konten Utama:** Konten berubah sesuai menu yang aktif di sidebar. Umumnya menggunakan layout grid dengan 1/3 untuk form input dan 2/3 untuk tabel data.

**Fungsionalitas & Logika:**
- **Otentikasi:** Menggunakan `dummyUser` untuk mensimulasikan login "SUPER ADMIN".
- **Pengambilan Data (Read):**
    - Saat halaman dimuat, data diambil dari 3 koleksi Firestore: `users`, `alat`, dan `locations` menggunakan `getDocs`.
    - Data ditampilkan dalam `Table` ShadCN.
- **Manajemen Pengguna (CRUD):**
    - **Create:** Form di sebelah kiri untuk menambah pengguna baru. Inputnya meliputi: Nama Pengguna, Sandi, NIK, Jabatan (Dropdown), dan Lokasi (Dropdown dari data lokasi).
    - **Update:** Tombol "Edit" (ikon pensil) di setiap baris tabel akan membuka `Dialog` berisi form untuk mengedit data pengguna. Sandi bersifat opsional untuk diubah.
    - **Delete:** Tombol "Hapus" (ikon tong sampah) akan membuka `AlertDialog` untuk konfirmasi sebelum menghapus dokumen pengguna dari Firestore. Pengguna "SUPERADMIN" tidak bisa dihapus.
- **Manajemen Alat (CRUD):**
    - **Create:** Form untuk menambah alat baru dengan input: Nomor Lambung, Nomor Polisi, Jenis Kendaraan, dan Lokasi awal.
    - **Update:** Tombol "Edit" membuka dialog untuk mengubah detail alat.
    - **Delete:** Tombol "Hapus" dengan dialog konfirmasi.
- **Manajemen Lokasi (CRUD):**
    - **Create:** Form untuk menambah lokasi baru dengan input: Nama Lokasi dan Detail Lokasi.
    - **Update:** Tombol "Edit" membuka dialog untuk mengubah detail lokasi.
    - **Delete:** Tombol "Hapus" dengan dialog konfirmasi.
- **Sinkronisasi Data:**
    - Menyediakan tombol "Jalankan Pembersihan".
    - Fungsi ini (saat ini hanya simulasi) dirancang untuk menghapus data riwayat (laporan, tugas, dll.) yang terkait dengan kendaraan yang sudah tidak terdaftar lagi di koleksi `alat` untuk menjaga kebersihan database.

---

## Halaman 3: Admin Logistik Material (`/src/app/admin-logistik-material/page.tsx`)

**Tujuan:** Halaman ini digunakan oleh Admin Logistik Material untuk mengelola seluruh siklus pemasukan material, mulai dari perencanaan, konfirmasi kedatangan, hingga monitoring proses bongkar.

**Tata Letak:**
- **Sidebar Kiri:** Menu utama untuk navigasi:
    - Status Bongkaran Hari Ini
    - Rencana Pemasukan Material
    - Bongkar Batu & Pasir Hari Ini (WO-Sopir DT)
    - Riwayat Bongkar
    - Pemasukan Material (Sudah tidak digunakan, logika dipindah ke setelah bongkar)
    - Riwayat Pemasukan
    - Stok Material (Link ke halaman stok)
- **Konten Utama:** Tergantung pada menu yang aktif.

**Fungsionalitas & Logika:**
1.  **Rencana Pemasukan (Create & Read):**
    - **Create:** Terdapat form untuk membuat "Rencana Pemasukan" baru (`RencanaPemasukan`).
        - Input Umum: Nama Kapal/Truk, Jenis Material, Nama Sopir, Estimasi Tiba (dengan pemilih tanggal & waktu).
        - Input Spesifik Semen: Form terpisah untuk memasukkan **Nomor SPB** dan **Muatan (KG)** untuk masing-masing dari 6 tangki kapal. Validasi memastikan semua 6 tangki diisi dan SPB unik.
        - Input Spesifik Agregat: Form untuk memasukkan **Volume Estimasi (M³)** dan satu **Nomor SPB**.
    - **Read:** Menampilkan daftar semua `RencanaPemasukan` dari Firestore dalam sebuah tabel, dengan status yang diberi `Badge` berwarna.
2.  **Siklus Hidup Pemasukan:**
    - **Konfirmasi Tiba:** Tombol "Konfirmasi Tiba" pada rencana yang berstatus "Dalam Perjalanan". Ini akan mengubah status rencana menjadi "Telah Tiba" dan mencatat `arrivalConfirmedAt`.
    - **Persetujuan QC:** (Di halaman QC) Rencana yang "Telah Tiba" akan diperiksa oleh QC. Hasilnya akan mengubah status menjadi "Memenuhi Syarat" atau "Ditolak".
    - **Terbitkan Perintah Bongkar (WO):** Untuk rencana (Batu/Pasir) yang sudah "Memenuhi Syarat", Admin Logistik dapat menekan tombol "Terbitkan WO". Ini akan:
        - Membuka dialog untuk mengonfirmasi detail pekerjaan.
        - Membuat dokumen baru di koleksi `available_jobs` Firestore.
        - Mengubah status `RencanaPemasukan` menjadi "Siap Untuk Dibongkar".
3.  **Monitoring Bongkar (Read):**
    - **Menu "Status Bongkaran Hari Ini"**: Menampilkan kartu-kartu ringkasan untuk pekerjaan yang sedang aktif (status "Proses" atau "Siap Untuk Dibongkar"), baik untuk semen maupun agregat. Data ini diambil dari koleksi `rencana_pemasukan` dan `available_jobs`.
    - **Menu "Bongkar Batu & Pasir Hari Ini"**: Menampilkan tabel detail dari semua `available_jobs`. Admin dapat mengubah status pekerjaan (misalnya menjadi "Tunda", yang akan membuka dialog untuk memasukkan alasan).
4.  **Riwayat & Laporan:**
    - **Riwayat Bongkar:** Menampilkan daftar pekerjaan yang sudah diarsipkan (`archived_jobs` dan `archived_cement_jobs`). Terdapat filter berdasarkan rentang tanggal.
    - **Riwayat Pemasukan:** Menampilkan log pemasukan dari koleksi `arsip_pemasukan_material_semua` dengan filter tanggal.
    - **Cetak Laporan:** Tombol untuk mencetak laporan pemasukan (harian atau berdasarkan filter riwayat) menggunakan komponen `LaporanPemasukanPrintLayout`.

---

## Halaman 4: Dasbor Sopir (`/src/app/sopir/page.tsx`)

**Tujuan:** Portal sederhana bagi sopir atau operator alat berat untuk mengakses fungsi-fungsi yang relevan dengan tugas harian mereka.

**Tata Letak:**
- Tampilan berpusat pada perangkat mobile/tablet.
- **Header:** Menampilkan nama perusahaan dan tombol Logout.
- **Kartu Profil:** Menampilkan NIK, nama lengkap, dan jabatan pengguna.
- **Menu Utama:** Grid berisi ikon-ikon besar untuk navigasi.

**Fungsionalitas & Logika:**
- **Pengecekan Pasangan (Batangan):**
    - Saat halaman dimuat, sistem memeriksa koleksi `sopir_batangan` di Firestore untuk melihat apakah `userId` pengguna saat ini terhubung dengan kendaraan.
    - Jika tidak ada pasangan ditemukan, sebuah `Alert` destruktif akan ditampilkan yang memberitahu pengguna untuk menghubungi Kepala Workshop.
- **Menu Dinamis:**
    - Menu "Checklis Alat" dan "Rit Bongkar Material" dinonaktifkan (`disabled`) jika pengguna belum memiliki pasangan kendaraan.
    - Menu "Rit Bongkar Material" hanya muncul jika jabatan pengguna adalah "SOPIR DT".
- **Navigasi:** Setiap item menu adalah `Link` Next.js yang mengarahkan pengguna ke halaman fungsionalitas yang sesuai (misalnya, `/checklist-alat`).

---

## Halaman 5: Checklist Alat (`/src/app/checklist-alat/page.tsx`)

**Tujuan:** Halaman bagi sopir untuk melakukan dan mengirimkan laporan checklist harian kondisi kendaraan yang mereka operasikan.

**Tata Letak:**
- Tampilan mobile-first.
- **Header:** Tombol kembali dan judul halaman.
- **Kartu Alat:** Menampilkan nomor lambung dan nomor polisi kendaraan yang ditugaskan kepada sopir.
- **Kartu Status:** `RadioGroup` dengan tiga pilihan untuk kondisi umum: "Baik", "Rusak", "Perlu Perhatian".
- **Kartu Detail:**
    - `Textarea` untuk deskripsi kerusakan atau catatan perbaikan.
    - Tombol "Ambil Foto" yang memicu `input type="file"` tersembunyi untuk mengunggah gambar.
    - Pratinjau gambar akan ditampilkan jika foto sudah dipilih.
- **Footer:** Tombol "Kirim Checklist" yang besar dan mudah dijangkau.

**Fungsionalitas & Logika:**
- **Pengambilan Data Awal:**
    - Mengambil data pasangan (`SopirBatanganData`) dari Firestore berdasarkan `userId` sopir.
    - Jika ada, mengambil juga laporan checklist **terakhir** untuk kendaraan tersebut untuk logika perbandingan status.
- **Pengiriman Laporan:**
    - **Logika Konfirmasi Perbaikan:** Jika status laporan terakhir adalah "rusak" atau "perlu perhatian", dan sopir mengirim laporan baru dengan status "baik", sebuah `AlertDialog` akan muncul untuk konfirmasi.
        - Jika sopir mengonfirmasi perbaikan, dialog kedua muncul menanyakan siapa yang melakukan perbaikan ("Mekanik" atau "Sendiri"). Jawaban ini akan disimpan di laporan.
    - **Proses Submit:**
        - Membuat objek `Report` baru dengan `Timestamp.now()`.
        - Menyimpan data laporan ke koleksi `checklist_reports` di Firestore.
        - Setelah berhasil, pengguna diarahkan kembali ke halaman sebelumnya.

---
Ini adalah deskripsi mendalam dari fungsionalitas inti aplikasi Anda. Prompt ini seharusnya memberikan konteks yang cukup bagi AI lain untuk memulai proses rekreasi dengan pemahaman yang kuat tentang arsitektur, alur data, dan interaksi pengguna di setiap halaman.
