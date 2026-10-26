const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); // Konfigurasi koneksi PostgreSQL Neon.tech

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// -------------------------------------------------------------
// 1. ENDPOINT KUIS (QUESTIONS & SUBMIT)
// -------------------------------------------------------------

// mengambil daftar soal essay
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
    res.json({ status: 'success', quizId, data: result.rows });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Menyimpan jawaban kuis (Validasi Nama & NIM wajib terisi)
app.post('/v1/quiz/submit', async (req, res) => {
  const { userId, nim, quizId, answers, status } = req.body;

  if (!userId || !nim || userId.trim() === '' || nim.trim() === '' || userId === '-' || nim === '-') {
    return res.status(400).json({
      status: 'error',
      message: 'Submit ditolak: Nama Mahasiswa dan NIM wajib diisi!'
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, submitted_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [userId, nim, quizId, JSON.stringify(answers), status || 'COMPLETED']
    );
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
// 2. ENDPOINT ADMIN (LOGIN, SUBMISSIONS, GRADING, IMPORT)
// -------------------------------------------------------------

app.post('/v1/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ status: 'success', token: 'secret-admin-token-2026' });
  } else {
    res.status(401).json({ status: 'error', message: 'Username atau password salah!' });
  }
});

app.get('/v1/admin/submissions', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, user_id AS nama, nim, quiz_id, answers, status, grade, feedback, submitted_at 
       FROM quiz_submissions 
       ORDER BY submitted_at DESC`
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
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin-dashboard.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));