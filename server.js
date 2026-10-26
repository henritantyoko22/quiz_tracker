require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); // Konfigurasi koneksi PostgreSQL Neon.tech

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Penyimpanan cadangan (in-memory) untuk Pengaturan Jadwal & Timer Kuis
const memoryQuizSettings = {
  'ESSAY_WEB_DEV': {
    quiz_id: 'ESSAY_WEB_DEV',
    start_time: null, // null = bisa diakses kapan saja
    end_time: null,
    duration_minutes: 60,
    max_violations: 3,
    is_active: true
  },
  'ESSAY_PEMROGRAMAN': {
    quiz_id: 'ESSAY_PEMROGRAMAN',
    start_time: null,
    end_time: null,
    duration_minutes: 45,
    max_violations: 3,
    is_active: true
  }
};

// Inisialisasi otomatis tabel & kolom baru di database jika belum ada
async function initDbTables() {
  try {
    // 1. Buat tabel quiz_settings untuk timer & jam buka/tutup
    await db.query(`
      CREATE TABLE IF NOT EXISTS quiz_settings (
        quiz_id VARCHAR(100) PRIMARY KEY,
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        duration_minutes INT DEFAULT 60,
        max_violations INT DEFAULT 3,
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Tambahkan kolom violation_count & max_violations di quiz_submissions
    await db.query(`
      ALTER TABLE quiz_submissions 
      ADD COLUMN IF NOT EXISTS violation_count INT DEFAULT 0;
    `);
    await db.query(`
      ALTER TABLE quiz_submissions 
      ADD COLUMN IF NOT EXISTS max_violations INT DEFAULT 3;
    `);
    console.log('✅ Inisialisasi struktur database PostgreSQL sukses.');
  } catch (err) {
    console.warn('ℹ️ Inisialisasi tabel/kolom DB:', err.message);
  }
}
initDbTables();

// -------------------------------------------------------------
// 1. ENDPOINT KUIS (SOAL, SUBMIT, PENGATURAN & JADWAL TIMER)
// -------------------------------------------------------------

// Mengambil daftar quizId yang tersedia
app.get('/v1/quiz/list', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT quiz_id, COUNT(*) AS total_questions 
       FROM quiz_questions 
       GROUP BY quiz_id 
       ORDER BY quiz_id ASC`
    );
    res.json({ status: 'success', data: result.rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Mengambil pengaturan jadwal, jam buka-tutup, dan durasi timer kuis
app.get('/v1/quiz/settings/:quizId', async (req, res) => {
  const { quizId } = req.params;
  try {
    const result = await db.query(
      `SELECT quiz_id, start_time, end_time, duration_minutes, max_violations, is_active 
       FROM quiz_settings 
       WHERE quiz_id = $1`,
      [quizId]
    );

    if (result.rows.length > 0) {
      return res.json({ status: 'success', data: result.rows[0] });
    }

    const fallback = memoryQuizSettings[quizId] || {
      quiz_id: quizId,
      start_time: null,
      end_time: null,
      duration_minutes: 60,
      max_violations: 3,
      is_active: true
    };
    res.json({ status: 'success', data: fallback });
  } catch (err) {
    const fallback = memoryQuizSettings[quizId] || {
      quiz_id: quizId,
      start_time: null,
      end_time: null,
      duration_minutes: 60,
      max_violations: 3,
      is_active: true
    };
    res.json({ status: 'success', data: fallback });
  }
});

// Menyimpan/memperbarui pengaturan jadwal & timer (Admin)
app.post('/v1/admin/quiz/settings', async (req, res) => {
  const { quizId, startTime, endTime, durationMinutes, maxViolations, isActive } = req.body;

  if (!quizId) {
    return res.status(400).json({ status: 'error', message: 'quizId wajib diisi!' });
  }

  const duration = parseInt(durationMinutes) || 60;
  const maxV = parseInt(maxViolations) || 3;
  const active = isActive !== false;
  const start = startTime ? new Date(startTime).toISOString() : null;
  const end = endTime ? new Date(endTime).toISOString() : null;

  // Update memori cache server
  memoryQuizSettings[quizId] = {
    quiz_id: quizId,
    start_time: start,
    end_time: end,
    duration_minutes: duration,
    max_violations: maxV,
    is_active: active
  };

  try {
    await db.query(
      `INSERT INTO quiz_settings (quiz_id, start_time, end_time, duration_minutes, max_violations, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (quiz_id) 
       DO UPDATE SET 
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         duration_minutes = EXCLUDED.duration_minutes,
         max_violations = EXCLUDED.max_violations,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      [quizId, start, end, duration, maxV, active]
    );
    res.json({
      status: 'success',
      message: `Jadwal & timer kuis ${quizId} berhasil disimpan!`,
      data: memoryQuizSettings[quizId]
    });
  } catch (err) {
    res.json({
      status: 'success',
      message: `Jadwal & timer tersimpan di memori server. (Peringatan DB: ${err.message})`,
      data: memoryQuizSettings[quizId]
    });
  }
});

// Mengambil daftar soal essay kuis
app.get('/v1/quiz/questions/:quizId', async (req, res) => {
  const { quizId } = req.params;
  try {
    const result = await db.query(
      `SELECT id, question_text, question_type 
       FROM quiz_questions 
       WHERE quiz_id = $1 
       ORDER BY id ASC`,
      [quizId]
    );
    res.json({ status: 'success', quizId, data: result.rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Menyimpan jawaban kuis peserta (disertai laporan jumlah pelanggaran)
app.post('/v1/quiz/submit', async (req, res) => {
  const { userId, nim, quizId, answers, status, violationCount, maxViolations } = req.body;

  if (!userId || !nim || userId.trim() === '' || nim.trim() === '' || userId === '-' || nim === '-') {
    return res.status(400).json({
      status: 'error',
      message: 'Submit ditolak: Nama Mahasiswa dan NIM wajib diisi!'
    });
  }

  const vCount = parseInt(violationCount) >= 0 ? parseInt(violationCount) : 0;
  const maxV = parseInt(maxViolations) > 0 ? parseInt(maxViolations) : 3;

  try {
    let result;
    try {
      result = await db.query(
        `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, violation_count, max_violations, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [userId, nim, quizId, JSON.stringify(answers), status || 'COMPLETED', vCount, maxV]
      );
    } catch (insertColErr) {
      // Jika kolom violation_count belum ada di PostgreSQL, fallback ke query lama
      result = await db.query(
        `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, submitted_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [userId, nim, quizId, JSON.stringify(answers), status || 'COMPLETED']
      );
    }

    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Catat log pelanggaran proctoring
app.post('/v1/violations', async (req, res) => {
  const { userId, quizId, type, detail, url } = req.body;
  try {
    await db.query(
      `INSERT INTO quiz_violations (user_id, quiz_id, violation_type, detail, page_url, occurred_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId || 'ANONYMOUS', quizId || 'UNKNOWN', type, detail, url || '']
    );
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// -------------------------------------------------------------
// 2. ENDPOINT ADMIN (LOGIN, SUBMISSIONS, DETAIL PELANGGARAN, GRADING)
// -------------------------------------------------------------

app.post('/v1/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ status: 'success', token: 'secret-admin-token-2026' });
  } else {
    res.status(401).json({ status: 'error', message: 'Username atau password salah!' });
  }
});

// Rekap jawaban mahasiswa lengkap dengan laporan pelanggaran (berapa dari berapa)
app.get('/v1/admin/submissions', async (req, res) => {
  try {
    // Gabungkan data submission dengan hitungan pelanggaran nyata dari quiz_violations
    const query = `
      SELECT 
        s.id, 
        s.user_id AS nama, 
        s.nim, 
        s.quiz_id, 
        s.answers, 
        s.status, 
        s.grade, 
        s.feedback, 
        s.submitted_at,
        GREATEST(COALESCE(s.violation_count, 0), COALESCE(v.total_violations, 0)) AS violation_count,
        COALESCE(s.max_violations, 3) AS max_violations,
        COALESCE(v.violation_breakdown, '-') AS violation_summary
      FROM quiz_submissions s
      LEFT JOIN (
        SELECT 
          user_id,
          quiz_id,
          COUNT(*) AS total_violations,
          STRING_AGG(DISTINCT violation_type, ', ') AS violation_breakdown
        FROM quiz_violations
        GROUP BY user_id, quiz_id
      ) v ON (v.user_id = s.user_id OR v.user_id = s.nim) AND v.quiz_id = s.quiz_id
      ORDER BY s.submitted_at DESC
    `;

    const result = await db.query(query);
    res.json({ status: 'success', data: result.rows });
  } catch (err) {
    // Fallback jika database belum mendukung subquery string_agg
    try {
      const fallback = await db.query(
        `SELECT id, user_id AS nama, nim, quiz_id, answers, status, grade, feedback, submitted_at,
                0 AS violation_count, 3 AS max_violations, '-' AS violation_summary 
         FROM quiz_submissions 
         ORDER BY submitted_at DESC`
      );
      res.json({ status: 'success', data: fallback.rows });
    } catch (fallbackErr) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  }
});

// Detail audit log pelanggaran per mahasiswa
app.get('/v1/admin/violations/detail', async (req, res) => {
  const { userId, nim, quizId } = req.query;
  try {
    const result = await db.query(
      `SELECT id, user_id, quiz_id, violation_type, detail, page_url, occurred_at
       FROM quiz_violations
       WHERE (user_id = $1 OR user_id = $2)
       ORDER BY occurred_at ASC`,
      [userId || '', nim || '']
    );
    res.json({ status: 'success', data: result.rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/v1/admin/submissions/grade', async (req, res) => {
  const { submissionId, grade, feedback } = req.body;
  try {
    const result = await db.query(
      `UPDATE quiz_submissions 
       SET grade = $1, feedback = $2 
       WHERE id = $3 
       RETURNING *`,
      [parseInt(grade), feedback || '', submissionId]
    );
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/v1/admin/questions/import', async (req, res) => {
  const { quizId, questions } = req.body;
  try {
    for (const q of questions) {
      await db.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, question_type)
         VALUES ($1, $2, $3)`,
        [quizId, q.question_text || q.question, q.question_type || 'ESSAY']
      );
    }
    res.json({ status: 'success', message: `${questions.length} soal berhasil diimpor!` });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Routing Halaman Static
app.get('/quiz', (req, res) => res.sendFile(path.join(__dirname, 'quiz.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin-dashboard.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));