-- =========================================================================
-- SEED DATA MAHASISWA PESERTA MATA KULIAH INTERNET OF THINGS (IoT)
-- Mata Kuliah: [UUW1624006] Internet of Things (IoT) - K2024 - Informatika S1
-- Total: 215 Mahasiswa (Kelas A: 55, Kelas B: 55, Kelas C: 50, Kelas D: 55)
-- Tanggal Rekap: 20 November 2026
-- =========================================================================

-- 1. Pastikan kolom mata_kuliah ada pada tabel quiz_students
ALTER TABLE quiz_students ADD COLUMN IF NOT EXISTS mata_kuliah VARCHAR(100) DEFAULT 'PPK';

-- 2. Buat tabel enrollment untuk mencatat mahasiswa yang mengambil lebih dari 1 mata kuliah
CREATE TABLE IF NOT EXISTS quiz_student_enrollments (
  nim VARCHAR(30) NOT NULL,
  mata_kuliah VARCHAR(100) NOT NULL,
  kelas VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (nim, mata_kuliah)
);

-- 3. Insert / Update Data Mahasiswa IoT ke quiz_students & quiz_student_enrollments

-- Data Mahasiswa Master (quiz_students)
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120028', 'RANDRADINATA FAIQ PRAYOGO', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120009', 'FARREL ATHAYA FIRDAUS', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120006', 'ADDIA FA''ADIHILAH MAHENDRA NUGRAHA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140130', 'FRANS RANJU CHRISTIAN PARDEDE', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130055', 'RASYID AHMAD RIZKI AL GHOZALI', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130063', 'NAFISA NUR FAUZIYYAH', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140132', 'RIFA SAFIYA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140162', 'NAYLA ADZANI PUTRI WIDYANTORO', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140166', 'NATHANAEL TONYUS WILBERT SIANIPAR', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130064', 'CHAYARA ALIMA RAMADHANI', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120047', 'INTAN ZAHRA AMARTIN', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130104', 'AL MA''LUFI', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120002', 'MUHAMMAD SIRRUL IRSYAD', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140234', 'HAKEEMADA PHILADALA AR', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130069', 'VITO ALIFFIANO ROYYANDINOVA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140204', 'KEVIN LIEF SITORUS', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120014', 'BINTANG KRISNA YUDHA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120001', 'MASIROTUZZAMAN FATWA GEMINTANG', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120044', 'JIHAN ALMAS SYAKILA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120003', 'FIRSTLY GISHA JANATUKA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140143', 'IKHSAN SYARIEF', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120005', 'HANDIKA PUTRA DEWA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130113', 'GAMMA ABDILLAH MUQORROBIN', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140226', 'RASHIN HANIF', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130081', 'HAYFA DANENDRA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140145', 'JOSEPH MARCO TANUWIDJAJA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140192', 'AZZAHRA ANGIE AULIA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130074', 'VINCENT BRAM PALMA GEOFFREY', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140125', 'SATRIO HANIF IBRAHIM', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140172', 'NAILIS SAFITRI', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130112', 'RICKO FERDIAN DEBRYANO', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130103', 'PRADHIPA ADITYA PRATAMA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140211', 'MIKHAEL EGA NATHA MARDI PRATAMA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140146', 'NAZLA FAIRUZA ASNURA ICHDA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120029', 'SHAFIRA JOAN ATHAYA ALIFYA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140147', 'FARIZ HIDAYATULLOH', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140177', 'MARIA NOVIDITASARI WUWUR', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130085', 'JOHANSEN BELTSAZAR SIAHAAN', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140151', 'MUHAMMAD NAWFAL PASHA IMANDRIKA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140222', 'NAYLA DWI AFRILIA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120007', 'AUFAADHANI AGISTA RAIHAANA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130116', 'ALFIAN HELMY', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140148', 'ROYYAN AZTA BIMA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140169', 'ALIF MUSTAFA RAMADHAN', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140221', 'MUHAMMAD AKBAR SURYAWAN', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140237', 'NAUFAL AMAR AZRIANSYAH', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140229', 'BAGUS JATMIKO', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140210', 'GADIS CITRA AULIA PUTRI', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130067', 'NABIL ZIDAN AFKARI', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140203', 'UMMU DIANA MAGHFIROH', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130111', 'ARYASENA HARIS WICAKSONO', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140126', 'AMELIA DINI HANMARIZQI', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120036', 'SAHDA PUTRI SALSABILA', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120019', 'ADJIE AKBAR PAIZAL', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140185', 'HASTANING UTARI', 'B', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140149', 'NAJJELA ANNAURA ALDIANA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140139', 'NASYA AURYN BUNGA INDARYAN', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130089', 'MACKENZIE RADO SIPANGKAR', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140131', 'SYAFFA RACHMA AULIA AZ-ZAHRA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120037', 'PUTU SWASTY CHANDRADEWATI DEVI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124130107', 'MUHAMMAD FIRDAUS ARGIFARI', 'A', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130087', 'ANIS LUTHFI ABDUL AZIZ', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130078', 'GAVRIEL ARDIAN', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130117', 'FATIMAH AZ''ZAHRA JANNATUL MURSID', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130092', 'DANISH ADAM KAYSAN', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140241', 'RAJENDRA ZIVEN ABISEKA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140186', 'AHMAD BILAL MURTADHO', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140202', 'MATAHARI PUTRA SOEGORO', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140238', 'BENING RAIHAN JATI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140076', 'KEYSHA AMANDA MAHARANI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140242', 'EUGENE NADYA SERAFHINA PURBA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140236', 'ADELIA RAFALINA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140184', 'LIDIA MAULIDA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140181', 'CHINTYA NUR RAHMAWATI PUTRI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130070', 'RACHEL KEYLA NAFTALI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140233', 'M. NAUFAL SYUJA KURNIAWAN', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140199', 'ILHAMI RIZQY ROMADZONI ASTIKO', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120039', 'ARYA FATHDILLAH ADI SAPUTRA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120017', 'DAVIN IHZA PRAMUDYA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140129', 'CAHYAWAN NOUDY AL GIFFARI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120043', 'MUHAMMAD FIRDAUS SUBHAN', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130107', 'MUHAMAD DIAR MADONNY', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130115', 'PUTRI PERMATA SARI BUDIANTO', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120049', 'CINDY CLAUDIA SIHOTANG', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120023', 'VISCO ARGATHA TAWA TAWA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140173', 'KHALIFA IKHWANURRAYYAN', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130101', 'JUSTIN CHRISTIAN LUMBANTOBING', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140127', 'FRISKA AMALIA PUTRI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130110', 'FRANSISKA NINDITA ISWARI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140225', 'HAFIZH ARRASYID', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140167', 'FACHRILLAH FAUZANUDDIN', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140206', 'MUHAMMAD ZAIDAN ILMI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140212', 'AGITHA SELY JEFAYONA BANGUN', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140215', 'LAILI ANGGITA NASOKA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140200', 'JOHN VITO GRACIELO TALAKSORU', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130079', 'NADIA ARIELLA KALANI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140154', 'SHELMA CANTIKA PUTRI DOLENT MARBUN', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130102', 'JOSE HARIN YOGATAMA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140182', 'NABILA ZONA ISLAMI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130056', 'FATHIN ARVA ALFAUSTA MARSETYO', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130095', 'NABIL AL GAZASKA WARNO PUTRA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120020', 'PUSPARANU FACHRI AULIA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140228', 'MUHAMAD ISMAIL', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140198', 'BINTANG ANGGARAKSA LINCAH NUGRAHA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140174', 'MUHAMMAD LUTHFI RADITHYA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130098', 'FADHLUR RAHMAN ALFARISHY SALEH', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130094', 'TIMOTHY GRACE ARIEL PUTRANDA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140122', 'RAJENDRA NABIL HUTOMO', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120012', 'RATULOSA KAREN KHEISSYA MULYADIE REPUTRI', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130073', 'ARKANO AQILLA TRISTANOZA', 'A', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140140', 'AMIRUL WIRA MUSHTHOFA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140143', 'BINAR RIDHA WIRITANAYA', 'D', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124120014', 'ASWALILA ADHA PUTRI TELAUMBANUA', 'D', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140155', 'REVALINA SALWA ALIYA WICAKSONO PRABOWO', 'D', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124120024', 'RUTH SEPTRIANA SIPANGKAR', 'D', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124130110', 'ANNIS FAKHIROH AKBAR', 'D', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140153', 'IZA YUNUS ANDHIKA', 'D', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140217', 'MUHAMMAD NUR FAUZAN', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130059', 'AMARA REVI KHAYLA KARUNIA MULYA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130054', 'NAZYHA ZAHARA AL-MUMTAZA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120004', 'NADIA AYU PRATIWI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120033', 'FARRELINO ARVIA ATMAJAYA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130061', 'RIZKY MAHANDIKA PERMANA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120048', 'JOSHUA BRILIANT SURYANA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120041', 'MIKAEL JOENATHAN PUTRA SANTOSO', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130057', 'ATHA FAJAR SATYATAMA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120030', 'MUHAMMAD HAMAM NURUL FIKRI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120025', 'KAYLILA HAJAR CENDEKIA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140174', 'NOVELYA CHERINA', 'D', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140164', 'MUHAMMAD HAFIDH ZUFAR DEWANTARA', 'D', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140190', 'RAFFADIAN NURAHMAN PRATAMA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120038', 'HANA FATIN NAIRA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130086', 'NAILA AYU FARRAS HANUN', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140163', 'RAJWA ARLIN CLARESTA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120013', 'ARNEHAYATUSSALBIYA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120032', 'TASSYA AULIA MAULIDA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120011', 'NADIA LAILATUN', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120008', 'FADILAH INTAN MAHARANI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130062', 'SALSABIL NABILAH KHOIRUNNISA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130108', 'LANDO SUSILO WIBOWO', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130096', 'DARELL MALIK NUGRAHA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130088', 'DAFFA DHIYA ISLAMI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120042', 'IBRAHIM NAUFALTSAQIF HANDOKO', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140208', 'DIVITRIO ATA MAHDAVIKIA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140230', 'SAVA AMELIA AL GANI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140227', 'RIFKY BINTANG BENVITO', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130100', 'REIHAN REMIGIA RIHI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140209', 'ZHAFARI RASYID', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140164', 'MUHAMMAD DAFFA AZMI DZIKRAKA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120046', 'TALITA ELVINA PUTRI KUSUMA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130082', 'ALIFA NAUFALYN FIKRIA RABBANI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120010', 'FATIMAH AZZAKIYAH', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130052', 'ISA ABDURROHIM HANIFA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140153', 'MUHAMMAD SYAHDIRA RAFSYANJANI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130109', 'KHALILA RAMADHANI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120034', 'ADZKIA HAFIDZ HUZEINI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140219', 'MUHAMMAD FADHIL AL FARUQ', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140213', 'MUHAMMAD RAVILINO PRASETYO', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120016', 'SYIFAURROHMAN', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140150', 'CITRA TAMANA AUDI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140157', 'RIFKI AMIRUL MAJID', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140127', 'AXEL ANGGIAN HAMONANGAN PURBA', 'D', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140075', 'ABIMANYU WIJOYO WIDYATMOKO', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120050', 'AHLA WARDA ANGGREINI', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140158', 'SARAH ALYA ZAHRA', 'D', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140168', 'CHRISTIANNA OLIVIA JUNIARTI MANULLANG', 'C', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140170', 'FATHAN MUBINA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130051', 'MUHAMMAD REZA ALFIANSYAH', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120021', 'RADITYA ARGANTA ANANTIO', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130099', 'M. FAIRUZ AUFA NADHIR', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140134', 'MUHAMMAD HILBRAM MAULANA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130077', 'JOVAN AMADEO HUTAGALUNG', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140216', 'GRACE YOLANDA SIMATUPANG', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120031', 'RAFA AKBAR SIDIARSYA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140161', 'MOCHAMAD FARREL ABYANTARA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140235', 'DIMAS ANGGA SAPUTRA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130066', 'HANIFA NUR AKHILAH', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140160', 'AZKA HAMDA ABIDA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120027', 'WENDI ADI ARDIANSAH', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130083', 'MUHAMMAD HANIF', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140135', 'CALVIN EZRA JONATHAN PASARIBU', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140224', 'HAFIZ FATHULLAH RAMADHAN', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130105', 'SHEREN GRACIA IBRENA KETAREN', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130097', 'FARIZ MUHAMMAD ARDIANDAPUTRA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130065', 'FALLAH IQBAL KURNIANTO', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140193', 'MARGARETH GABE DEBORA SINAGA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140171', 'RIZQI RAMADHAN', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120022', 'IBNU FARREL ATHAILLAH FIRDAUS', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130119', 'HILMI LAUDZA AT HALLAH', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120040', 'AZQYA SADIDATUN NISA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140196', 'TORIBIO DESMOND DONOVAN', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120045', 'GRACE RIKA GLORIA PANJAITAN', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120024', 'FATHA SHAUMU MUHAMMAD ALIFTHA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125130091', 'ALBARTAR MAURAN SRIWIJAYA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140214', 'FERJA ARNANDA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140137', 'MUHAMMAD KENZIE PRADIPTA AINURRAHIM', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140152', 'ABYASA ARKABELVA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140133', 'LIONEL IVANNE SISWANTO', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140232', 'RAFLY IHSAN NURKHOLIS', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140191', 'ARYO BIMO BAGASKORO', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125120015', 'MUHAMMAD RAFA ARKAZORA HIDAYAT', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124130089', 'ARYA NAUFAL AKMAL', 'C', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140201', 'MOHAMMAD RIZQI AKBAR', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140240', 'ARDEN RAFA GANI', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140244', 'M. RAIHAN NAJMUDDIN FAWWAZ', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140121', 'MUHAMMAD YUNUS KHAIRULLAH', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140142', 'MUHAMMAD ROBITH HAMMADA', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140218', 'MULHAM RAHMATULLAH', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124120033', 'SHALOM KURNIAWAN', 'C', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124130054', 'RAFFIE ADITYA AKBAR', 'C', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140157', 'REYNALDI BERTINUS HUTAGAOL', 'C', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124120046', 'ROMUALDUS YOAS WICAKSONO', 'C', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140185', 'FARHAN MUHTARAM', 'C', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060124140191', 'ARGA YURA DANENDRA', 'C', 'Informatika S1', 'BARU', 5, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester, mata_kuliah)
VALUES ('24060125140168', 'ADAM ARDHINATA PAMUNGKAS', 'C', 'Informatika S1', 'BARU', 3, 'IoT')
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();

-- Data Enrollment (quiz_student_enrollments)
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120028', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120009', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120006', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140130', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130055', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130063', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140132', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140162', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140166', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130064', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120047', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130104', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120002', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140234', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130069', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140204', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120014', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120001', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120044', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120003', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140143', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120005', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130113', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140226', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130081', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140145', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140192', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130074', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140125', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140172', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130112', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130103', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140211', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140146', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120029', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140147', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140177', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130085', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140151', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140222', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120007', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130116', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140148', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140169', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140221', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140237', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140229', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140210', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130067', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140203', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130111', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140126', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120036', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120019', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140185', 'IoT', 'B')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140149', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140139', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130089', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140131', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120037', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124130107', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130087', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130078', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130117', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130092', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140241', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140186', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140202', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140238', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140076', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140242', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140236', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140184', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140181', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130070', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140233', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140199', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120039', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120017', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140129', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120043', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130107', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130115', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120049', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120023', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140173', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130101', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140127', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130110', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140225', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140167', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140206', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140212', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140215', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140200', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130079', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140154', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130102', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140182', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130056', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130095', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120020', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140228', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140198', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140174', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130098', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130094', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140122', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120012', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130073', 'IoT', 'A')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140140', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140143', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124120014', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140155', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124120024', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124130110', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140153', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140217', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130059', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130054', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120004', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120033', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130061', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120048', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120041', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130057', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120030', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120025', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140174', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140164', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140190', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120038', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130086', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140163', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120013', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120032', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120011', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120008', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130062', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130108', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130096', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130088', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120042', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140208', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140230', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140227', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130100', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140209', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140164', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120046', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130082', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120010', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130052', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140153', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130109', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120034', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140219', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140213', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120016', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140150', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140157', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140127', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140075', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120050', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140158', 'IoT', 'D')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140168', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140170', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130051', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120021', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130099', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140134', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130077', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140216', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120031', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140161', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140235', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130066', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140160', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120027', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130083', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140135', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140224', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130105', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130097', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130065', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140193', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140171', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120022', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130119', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120040', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140196', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120045', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120024', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125130091', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140214', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140137', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140152', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140133', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140232', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140191', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125120015', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124130089', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140201', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140240', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140244', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140121', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140142', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140218', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124120033', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124130054', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140157', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124120046', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140185', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060124140191', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
INSERT INTO quiz_student_enrollments (nim, mata_kuliah, kelas)
VALUES ('24060125140168', 'IoT', 'C')
ON CONFLICT (nim, mata_kuliah) DO UPDATE SET
  kelas = EXCLUDED.kelas;
