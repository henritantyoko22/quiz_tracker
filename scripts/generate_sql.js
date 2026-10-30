const fs = require('fs');
const path = require('path');
const students = require('../src/data/students_ppk.json');

let sql = `-- =============================================================\n`;
sql += `-- SQL MIGRATION: Tabel Peserta Mahasiswa & Seed Kelas PPK\n`;
sql += `-- Total: ${students.length} Mahasiswa (Kelas A, B, C, D)\n`;
sql += `-- =============================================================\n\n`;

sql += `CREATE TABLE IF NOT EXISTS quiz_students (\n`;
sql += `  nim VARCHAR(30) PRIMARY KEY,\n`;
sql += `  nama VARCHAR(150) NOT NULL,\n`;
sql += `  kelas VARCHAR(10) NOT NULL,\n`;
sql += `  prodi VARCHAR(100) DEFAULT 'Informatika S1',\n`;
sql += `  status VARCHAR(30) DEFAULT 'BARU',\n`;
sql += `  semester INT DEFAULT 5,\n`;
sql += `  created_at TIMESTAMPTZ DEFAULT NOW(),\n`;
sql += `  updated_at TIMESTAMPTZ DEFAULT NOW()\n`;
sql += `);\n\n`;

sql += `ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS attempt INT DEFAULT 1;\n`;
sql += `ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS kelas VARCHAR(10);\n\n`;

sql += `INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester)\nVALUES\n`;

const rows = students.map(s => {
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

const targetDir = path.join(__dirname);
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(path.join(targetDir, 'seed_students_ppk.sql'), sql);
console.log('Generated scripts/seed_students_ppk.sql successfully with length:', sql.length);

