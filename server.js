require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const path = require('path');

// Rute untuk menyajikan halaman dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/quiz', (req, res) => {
  res.sendFile(path.join(__dirname, 'quiz.html'));
});

// 1. Endpoint Simpan Log Pelanggaran dari Chrome Extension
app.post('/v1/violations', async (req, res) => {
  const { userId, quizId, type, detail, timestamp, url } = req.body;

  if (!type || !url) {
    return res.status(400).json({ status: 'error', message: 'Payload tidak lengkap' });
  }

  const queryText = `
    INSERT INTO quiz_violations (user_id, quiz_id, violation_type, detail, page_url, occurred_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `;

  const formattedTimestamp = timestamp ? new Date(timestamp) : new Date();

  const values = [
    userId || 'ANONYMOUS',
    quizId || 'UNKNOWN_QUIZ',
    type,
    detail || '',
    url,
    formattedTimestamp
  ];

  try {
    const result = await db.query(queryText, values);
    return res.status(201).json({
      status: 'success',
      message: 'Log berhasil disimpan',
      logId: result.rows[0].id
    });
  } catch (err) {
    console.error('Gagal menyimpan log:', err);
    return res.status(500).json({ status: 'error', message: 'Gagal menyisipkan data' });
  }
});

// 2. Endpoint Analitik per Siswa
app.get('/v1/analytics/students', async (req, res) => {
  const queryText = `
    SELECT 
      user_id AS id_siswa,
      COUNT(*) AS total_pelanggaran,
      COUNT(CASE WHEN violation_type = 'PINDAH_TAB' THEN 1 END) AS total_pindah_tab,
      COUNT(CASE WHEN violation_type = 'PINDAH_APLIKASI' THEN 1 END) AS total_pindah_aplikasi,
      COUNT(CASE WHEN violation_type LIKE '%COPY%' OR violation_type LIKE '%PASTE%' THEN 1 END) AS total_copy_paste,
      COUNT(CASE WHEN violation_type = 'STANDBY_IDLE' THEN 1 END) AS total_idle,
      MAX(occurred_at) AS pelanggaran_terakhir
    FROM quiz_violations
    GROUP BY user_id
    ORDER BY total_pelanggaran DESC;
  `;

  try {
    const { rows } = await db.query(queryText);
    return res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data' });
  }
});

// 3. Endpoint Ringkasan Jenis Pelanggaran
app.get('/v1/analytics/types-summary', async (req, res) => {
  const queryText = `
    SELECT 
      violation_type AS jenis_pelanggaran,
      COUNT(*) AS frekuensi,
      ROUND((COUNT(*)::DECIMAL / NULLIF((SELECT COUNT(*) FROM quiz_violations), 0)) * 100, 2) AS persentase
    FROM quiz_violations
    GROUP BY violation_type
    ORDER BY frekuensi DESC;
  `;

  try {
    const { rows } = await db.query(queryText);
    return res.status(200).json({ status: 'success', data: rows });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data' });
  }
});

// Rute untuk Menyimpan Jawaban Kuis (User Submit)
app.post('/v1/quiz/submit', async (req, res) => {
  const { userId, nim, quizId, answers, status } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [userId, nim, quizId, JSON.stringify(answers), status]
    );
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Rute Admin untuk Impor Soal
app.post('/v1/admin/questions/import', async (req, res) => {
  const { quizId, questions } = req.body; // Array of questions
  try {
    // Simpan data soal ke database atau memory/file JSON
    res.json({ status: 'success', message: `${questions.length} soal berhasil diimpor!` });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// =============================================================
// 1. ENDPOINT: MENGAMBIL SOAL KUIS DARI DATABASE
// =============================================================
app.get('/v1/quiz/questions/:quizId', async (req, res) => {
  const { quizId } = req.params;

  try {
    const result = await db.query(
      `SELECT id, question_text, question_type 
       FROM quiz_questions 
       WHERE quiz_id = $1 
       ORDER BY created_at ASC`,
      [quizId]
    );

    res.json({
      status: 'success',
      quizId: quizId,
      totalQuestions: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// =============================================================
// 2. ENDPOINT: MENYIMPAN JAWABAN PESERTA KUIS
// =============================================================
app.post('/v1/quiz/submit', async (req, res) => {
  const { userId, nim, quizId, answers, status } = req.body;

  if (!userId || !nim || !quizId || !answers) {
    return res.status(400).json({
      status: 'error',
      message: 'Parameter userId, nim, quizId, dan answers wajib diisi!'
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [userId, nim, quizId, JSON.stringify(answers), status || 'COMPLETED']
    );

    res.json({
      status: 'success',
      message: 'Jawaban kuis berhasil disimpan!',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error submitting quiz answers:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// =============================================================
// 3. ENDPOINT: IMPOR SOAL BARU KE BANK SOAL (ADMIN)
// =============================================================
app.post('/v1/admin/questions/import', async (req, res) => {
  const { quizId, questions } = req.body;

  if (!quizId || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Format data tidak valid! Sertakan quizId dan array questions.'
    });
  }

  try {
    for (const q of questions) {
      await db.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, question_type)
         VALUES ($1, $2, $3)`,
        [quizId, q.question_text || q.question, q.question_type || 'ESSAY']
      );
    }

    res.json({
      status: 'success',
      message: `${questions.length} soal berhasil diimpor ke kuis ${quizId}!`
    });
  } catch (err) {
    console.error('Error importing questions:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 1. Endpoint Login Admin (Sederhana)
app.post('/v1/admin/login', (req, res) => {
  const { username, password } = req.body;
  // Ganti username dan password admin sesuai kebutuhanmu
  if (username === 'admin' && password === 'admin123') {
    res.json({ status: 'success', token: 'secret-admin-token' });
  } else {
    res.status(401).json({ status: 'error', message: 'Username atau password salah!' });
  }
});

// 2. Endpoint Mengambil Daftar Jawaban Mahasiswa
app.get('/v1/admin/submissions', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, user_id AS nama, nim, quiz_id, answers, status, submitted_at 
       FROM quiz_submissions 
       ORDER BY submitted_at DESC`
    );
    res.json({ status: 'success', data: result.rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`Server API berjalan di port ${PORT}`);
});