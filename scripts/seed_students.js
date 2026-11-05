require('dotenv').config();
const { Pool } = require('pg');
const studentsAlgo = require('../src/data/students_algo_evolusioner.json');

async function seedStudents() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL tidak ditemukan di environment atau file .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log(`📡 Menghubungkan ke database Neon...`);
    console.log(`⏳ Memasukkan ${studentsAlgo.length} peserta kelas Algoritma Evolusioner...`);

    let successCount = 0;
    for (const s of studentsAlgo) {
      await pool.query(
        `INSERT INTO quiz_students (nim, nama, kelas, prodi, status, semester)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (nim) DO UPDATE SET
           nama = EXCLUDED.nama,
           kelas = EXCLUDED.kelas,
           prodi = EXCLUDED.prodi,
           status = EXCLUDED.status,
           semester = EXCLUDED.semester,
           updated_at = NOW()`,
        [s.nim, s.nama, s.kelas, s.prodi, s.status, s.semester]
      );
      successCount++;
    }

    console.log(`✅ Sukses! ${successCount} mahasiswa berhasil dimasukkan/diperbarui ke tabel quiz_students.`);
  } catch (err) {
    console.error('❌ Gagal menjalankan seed:', err.message);
  } finally {
    await pool.end();
  }
}

seedStudents();

