const fs = require('fs');
const path = require('path');

const csvRaw = `NIM,Nama,Status,Semester,Kelas,Prodi,Hadir,Sakit,Izin,Alfa,Belum Absen,Kehadiran
24060124130069,MUHAMMAD FIKRI,BARU,5,A,Informatika S1,6,0,3,0,0,64.29
24060124130097,HAIKAL IMAM RIDHA,BARU,5,A,Informatika S1,6,0,0,0,3,42.86
24060124140138,MENZA ISAIAH TAMPUBOLON,BARU,5,A,Informatika S1,9,0,0,0,0,64.29
24060124130088,SYAFIRA AZKA RAMADHANI,BARU,5,A,Informatika S1,9,0,0,0,0,64.29
24060124130075,NAUFAL DWI YUSMAWAN,BARU,5,A,Informatika S1,9,0,0,0,0,64.29
24060124140148,MUHAMMAD ALFAIQ RIDO SALAFY,BARU,5,A,Informatika S1,8,0,0,0,1,57.14
24060124140158,NAYLA HUSNA,BARU,5,A,Informatika S1,7,0,1,0,1,57.14
24060124110142,MUCHAMMAD YUDA TRI ANANDA,BARU,5,A,Informatika S1,9,0,0,0,0,64.29
24060124140166,MUHAMMAD FARHAN ABDUL AZIS,BARU,5,A,Informatika S1,9,0,0,0,0,64.29
24060124130076,JOHAN REINHART CALVIN,BARU,5,A,Informatika S1,8,0,1,0,0,64.29
24060123140170,MUHAMMAD YAZID LUBIS,BARU,7,A,Informatika S1,8,0,0,0,1,57.14
24060123140184,MUHAMMAD KIEVLAN HAKIM,BARU,7,A,Informatika S1,8,0,0,0,1,57.14
24060123120016,DINA AMELIA,BARU,7,A,Informatika S1,9,0,0,0,0,64.29
24060123130051,BRILIANITA EVA SYAFITRI,BARU,7,A,Informatika S1,9,0,0,0,0,64.29
24060123130106,MUHAMMAD YOGA AMINUDIN,BARU,7,A,Informatika S1,7,0,0,0,2,50
24060123130072,NATASYA AMELIA CANDRASARI,BARU,7,A,Informatika S1,6,0,0,0,3,42.86
24060123130059,RADITYANTARI KUSUMA WARDANI,BARU,7,A,Informatika S1,8,0,0,0,1,57.14
24060123140172,CIPTA FIKRI WIRATAMA,BARU,7,A,Informatika S1,9,0,0,0,0,64.29
24060121120026,M. GHANI ARYASUTA,BARU,11,A,Informatika S1,0,0,0,0,9,0
24060123140141,FARREL NABIHA DANADYAKSA,BARU,7,A,Informatika S1,4,0,0,0,3,28.57
24060123130089,ATIKA MUTIA SABILA,BARU,7,A,Informatika S1,7,0,0,0,0,50`;

const lines = csvRaw.trim().split('\n');
const students = [];

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',');
  if (parts.length >= 6) {
    students.push({
      nim: parts[0].trim(),
      nama: parts[1].trim(),
      status: parts[2].trim(),
      semester: parseInt(parts[3].trim(), 10) || 5,
      kelas: parts[4].trim(),
      prodi: parts[5].trim(),
    });
  }
}

// 1. Simpan ke src/data/students_algo_evolusioner.json
const jsonPath = path.join(__dirname, '../src/data/students_algo_evolusioner.json');
fs.writeFileSync(jsonPath, JSON.stringify(students, null, 2));
console.log(`Saved JSON to ${jsonPath} with ${students.length} students.`);

// 2. Buat SQL Migration
let sql = `-- =============================================================\n`;
sql += `-- SQL MIGRATION: Seed Peserta Kelas Algoritma Evolusioner\n`;
sql += `-- Total: ${students.length} Mahasiswa (Kelas A)\n`;
sql += `-- Tanggal: ${new Date().toISOString().split('T')[0]}\n`;
sql += `-- =============================================================\n\n`;

sql += `INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester)\nVALUES\n`;

const rows = students.map((s) => {
  const cleanName = s.nama.replace(/'/g, "''");
  return `  ('${s.nim}', '${cleanName}', '${s.kelas}', '${s.prodi}', '${s.status}', ${s.semester})`;
});

sql += rows.join(',\n');
sql += `\nON CONFLICT (nim) DO UPDATE SET\n`;
sql += `  nama = EXCLUDED.nama,\n`;
sql += `  kelas = EXCLUDED.kelas,\n`;
sql += `  prodi = EXCLUDED.prodi,\n`;
sql += `  status = EXCLUDED.status,\n`;
sql += `  semester = EXCLUDED.semester,\n`;
sql += `  updated_at = NOW();\n`;

const sqlPath = path.join(__dirname, '../scripts/seed_students_algo_evolusioner.sql');
fs.writeFileSync(sqlPath, sql);
console.log(`Saved SQL to ${sqlPath}.`);

