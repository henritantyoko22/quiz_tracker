-- =============================================================
-- SQL MIGRATION: Seed Peserta Kelas Algoritma Evolusioner
-- Total: 21 Mahasiswa (Kelas A)
-- Tanggal: 2026-11-05
-- =============================================================

INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester)
VALUES
  ('24060124130069', 'MUHAMMAD FIKRI', 'A', 'Informatika S1', 'BARU', 5),
  ('24060124130097', 'HAIKAL IMAM RIDHA', 'A', 'Informatika S1', 'BARU', 5),
  ('24060124140138', 'MENZA ISAIAH TAMPUBOLON', 'A', 'Informatika S1', 'BARU', 5),
  ('24060124130088', 'SYAFIRA AZKA RAMADHANI', 'A', 'Informatika S1', 'BARU', 5),
  ('24060124130075', 'NAUFAL DWI YUSMAWAN', 'A', 'Informatika S1', 'BARU', 5),
  ('24060124140148', 'MUHAMMAD ALFAIQ RIDO SALAFY', 'A', 'Informatika S1', 'BARU', 5),
  ('24060124140158', 'NAYLA HUSNA', 'A', 'Informatika S1', 'BARU', 5),
  ('24060124110142', 'MUCHAMMAD YUDA TRI ANANDA', 'A', 'Informatika S1', 'BARU', 5),
  ('24060124140166', 'MUHAMMAD FARHAN ABDUL AZIS', 'A', 'Informatika S1', 'BARU', 5),
  ('24060124130076', 'JOHAN REINHART CALVIN', 'A', 'Informatika S1', 'BARU', 5),
  ('24060123140170', 'MUHAMMAD YAZID LUBIS', 'A', 'Informatika S1', 'BARU', 7),
  ('24060123140184', 'MUHAMMAD KIEVLAN HAKIM', 'A', 'Informatika S1', 'BARU', 7),
  ('24060123120016', 'DINA AMELIA', 'A', 'Informatika S1', 'BARU', 7),
  ('24060123130051', 'BRILIANITA EVA SYAFITRI', 'A', 'Informatika S1', 'BARU', 7),
  ('24060123130106', 'MUHAMMAD YOGA AMINUDIN', 'A', 'Informatika S1', 'BARU', 7),
  ('24060123130072', 'NATASYA AMELIA CANDRASARI', 'A', 'Informatika S1', 'BARU', 7),
  ('24060123130059', 'RADITYANTARI KUSUMA WARDANI', 'A', 'Informatika S1', 'BARU', 7),
  ('24060123140172', 'CIPTA FIKRI WIRATAMA', 'A', 'Informatika S1', 'BARU', 7),
  ('24060121120026', 'M. GHANI ARYASUTA', 'A', 'Informatika S1', 'BARU', 11),
  ('24060123140141', 'FARREL NABIHA DANADYAKSA', 'A', 'Informatika S1', 'BARU', 7),
  ('24060123130089', 'ATIKA MUTIA SABILA', 'A', 'Informatika S1', 'BARU', 7)
ON CONFLICT (nim) DO UPDATE SET
  nama = EXCLUDED.nama,
  kelas = EXCLUDED.kelas,
  prodi = EXCLUDED.prodi,
  status = EXCLUDED.status,
  semester = EXCLUDED.semester,
  updated_at = NOW();
