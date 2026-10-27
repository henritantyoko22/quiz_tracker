require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./db'); // Konfigurasi koneksi PostgreSQL Neon.tech

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// -------------------------------------------------------------
// HELPER PASSWORD HASHING (PBKDF2 + SALT)
// -------------------------------------------------------------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
  if (!password || !storedHash || !salt) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === storedHash;
}

// Akun bawaan (Seeded Default Users)
const defaultSalt = 'salt_quiz_tracker_2026';
const initialUsers = [
  {
    username: 'admin',
    password_hash: crypto.pbkdf2Sync('admin123', defaultSalt, 10000, 64, 'sha512').toString('hex'),
    salt: defaultSalt,
    full_name: 'Super Administrator',
    role: 'SUPERADMIN'
  },
  {
    username: 'dosen',
    password_hash: crypto.pbkdf2Sync('dosen123', defaultSalt, 10000, 64, 'sha512').toString('hex'),
    salt: defaultSalt,
    full_name: 'Dr. Dosen Pengampu',
    role: 'DOSEN'
  },
  {
    username: 'pengawas',
    password_hash: crypto.pbkdf2Sync('pengawas123', defaultSalt, 10000, 64, 'sha512').toString('hex'),
    salt: defaultSalt,
    full_name: 'Pengawas Ujian (Proctor)',
    role: 'PROCTOR'
  }
];

// Fallback in-memory jika database PostgreSQL offline
let memoryUsers = [...initialUsers];

// Penyimpanan cadangan (in-memory) untuk Pengaturan Jadwal & Timer Kuis
const memoryQuizSettings = {
  '101': {
    quiz_id: '101',
    start_time: null,
    end_time: null,
    duration_minutes: 60,
    max_violations: 3,
    is_active: true
  },
  '1': {
    quiz_id: '1',
    start_time: null,
    end_time: null,
    duration_minutes: 45,
    max_violations: 3,
    is_active: true
  },
  'ESSAY_WEB_DEV': {
    quiz_id: 'ESSAY_WEB_DEV',
    start_time: null,
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

// Bank Soal Bawaan di Memory Server (untuk kuis terdaftar)
const memoryQuizQuestions = {
  '101': [
    { id: 1, question_text: 'Jelaskan arsitektur middleware pada Express.js dan bagaimana urutan eksekusinya mempengaruhi aliran data request-response!', question_type: 'ESSAY' },
    { id: 2, question_text: 'Mengapa proteksi kuis berbasis website (seperti Fullscreen API & visibilitychange) lebih efektif dibandingkan Chrome Extension?', question_type: 'ESSAY' },
    { id: 3, question_text: 'Jelaskan bagaimana konsep CORS (Cross-Origin Resource Sharing) bekerja dan cara menanganinya di backend Node.js!', question_type: 'ESSAY' }
  ],
  '1': [
    { id: 1, question_text: 'Jelaskan konsep dasar Event Loop pada Node.js beserta tahapan phases-nya!', question_type: 'ESSAY' },
    { id: 2, question_text: 'Apa perbedaan antara Synchronous vs Asynchronous programming pada JavaScript modern?', question_type: 'ESSAY' },
    { id: 3, question_text: 'Jelaskan kegunaan Connection Pool pada database PostgreSQL dan mengapa penting untuk performa aplikasi!', question_type: 'ESSAY' }
  ],
  'ESSAY_WEB_DEV': [
    { id: 1, question_text: 'Jelaskan arsitektur middleware pada Express.js dan bagaimana urutan eksekusinya mempengaruhi aliran data request-response!', question_type: 'ESSAY' },
    { id: 2, question_text: 'Mengapa proteksi kuis berbasis website (seperti Fullscreen API & visibilitychange) lebih efektif dibandingkan Chrome Extension?', question_type: 'ESSAY' },
    { id: 3, question_text: 'Jelaskan bagaimana konsep CORS (Cross-Origin Resource Sharing) bekerja dan cara menanganinya di backend Node.js!', question_type: 'ESSAY' }
  ],
  'ESSAY_PEMROGRAMAN': [
    { id: 1, question_text: 'Jelaskan konsep dasar Event Loop pada Node.js beserta tahapan phases-nya!', question_type: 'ESSAY' },
    { id: 2, question_text: 'Apa perbedaan antara Synchronous vs Asynchronous programming pada JavaScript modern?', question_type: 'ESSAY' },
    { id: 3, question_text: 'Jelaskan kegunaan Connection Pool pada database PostgreSQL dan mengapa penting untuk performa aplikasi!', question_type: 'ESSAY' }
  ]
};

// Sesi Login Aktif (Token -> User Data)
const activeSessions = new Map();

// ---------------------------------------------------------------
// LIVE STUDENT SESSIONS STORE (IN-MEMORY, AUTO-CLEANUP 24H)
// ---------------------------------------------------------------
// Key: `${nim}_${quizId}`, Value: liveData object
const liveStudentSessions = new Map();

function getLiveSessionKey(nim, quizId) {
  return `${(nim || '').trim()}_${(quizId || '').trim()}`;
}

// Auto-cleanup sesi lama setiap jam (hapus yang > 24 jam tidak aktif)
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, session] of liveStudentSessions.entries()) {
    if (session.lastHeartbeat < cutoff) {
      liveStudentSessions.delete(key);
    }
  }
}, 60 * 60 * 1000);

// Middleware Autentikasi & Verifikasi Token
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token autentikasi tidak ditemukan.' });
  }

  // Khusus fallback token kompatibilitas lama jika dibutuhkan
  if (token === 'secret-admin-token-2026') {
    req.adminUser = {
      userId: 1,
      username: 'admin',
      fullName: 'Super Administrator',
      role: 'SUPERADMIN'
    };
    return next();
  }

  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({ status: 'error', message: 'Sesi login telah berakhir atau tidak valid. Silakan login kembali.' });
  }

  req.adminUser = session;
  next();
}

// Middleware Pembatasan Hak Akses Berdasarkan Role
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({ status: 'error', message: 'Autentikasi diperlukan.' });
    }
    // SUPERADMIN selalu memiliki akses ke seluruh fitur
    if (req.adminUser.role === 'SUPERADMIN' || allowedRoles.includes(req.adminUser.role)) {
      return next();
    }
    return res.status(403).json({
      status: 'error',
      message: `Akses ditolak! Fitur ini membutuhkan role: [${allowedRoles.join(', ')}]. Role Anda saat ini: ${req.adminUser.role}`
    });
  };
}

// Inisialisasi otomatis tabel & kolom baru di database jika belum ada
async function initDbTables() {
  try {
    // 1. Tabel admin_users (Manajemen Role & Kredensial Hashed)
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'DOSEN',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed akun bawaan jika tabel masih kosong
    try {
      const userCheck = await db.query('SELECT COUNT(*) AS count FROM admin_users');
      if (parseInt(userCheck.rows[0].count) === 0) {
        for (const u of initialUsers) {
          await db.query(
            `INSERT INTO admin_users (username, password_hash, salt, full_name, role)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (username) DO NOTHING`,
            [u.username, u.password_hash, u.salt, u.full_name, u.role]
          );
        }
        console.log('✅ Seed akun admin awal (admin, dosen, pengawas) berhasil dibuat di PostgreSQL.');
      }
    } catch (e) {
      console.warn('ℹ️ Seed akun DB:', e.message);
    }

    // 2. Buat tabel quiz_settings untuk timer & jam buka/tutup
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

    // 3. Tambahkan kolom violation_count & max_violations di quiz_submissions
    await db.query(`
      ALTER TABLE quiz_submissions 
      ADD COLUMN IF NOT EXISTS violation_count INT DEFAULT 0;
    `);
    await db.query(`
      ALTER TABLE quiz_submissions 
      ADD COLUMN IF NOT EXISTS max_violations INT DEFAULT 3;
    `);
    console.log('✅ Struktur database terverifikasi lengkap.');
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

// Mengambil pengaturan jadwal, jam buka-tutup, dan durasi timer kuis dari DATABASE
app.get('/v1/quiz/settings/:quizId', async (req, res) => {
  const { quizId } = req.params;
  const cleanQuizId = (quizId || '').trim();

  if (!cleanQuizId) {
    return res.status(400).json({ status: 'error', exists: false, message: 'ID Kuis wajib diisi.' });
  }

  try {
    let dbSetting = null;
    let totalQuestions = 0;

    // 1. Cek tabel quiz_settings dan quiz_questions di database
    try {
      const settingResult = await db.query(
        `SELECT quiz_id, start_time, end_time, duration_minutes, max_violations, is_active 
         FROM quiz_settings 
         WHERE quiz_id = $1`,
        [cleanQuizId]
      );
      if (settingResult.rows.length > 0) {
        dbSetting = settingResult.rows[0];
      }

      // Cek jumlah soal riil di database
      const qResult = await db.query(
        `SELECT COUNT(*) AS total FROM quiz_questions WHERE quiz_id = $1`,
        [cleanQuizId]
      );
      totalQuestions = parseInt(qResult.rows[0]?.total || 0);
    } catch (dbErr) {
      console.warn('DB query error on quiz settings:', dbErr.message);
    }

    // Jika DB offline atau belum ada soal di DB, periksa memory bank soal resmi
    if (totalQuestions === 0 && memoryQuizQuestions[cleanQuizId]) {
      totalQuestions = memoryQuizQuestions[cleanQuizId].length;
    }

    // JIKA TIDAK DITEMUKAN DI MANAPUN (tidak ada setting dan tidak ada soal sama sekali)
    if (!dbSetting && totalQuestions === 0 && !memoryQuizSettings[cleanQuizId]) {
      return res.status(404).json({
        status: 'error',
        exists: false,
        has_questions: false,
        total_questions: 0,
        message: `ID Kuis "${cleanQuizId}" tidak ditemukan di database. Pastikan nomor kuis benar.`
      });
    }

    // JIKA KUIS ADA TAPI TIDAK MEMILIKI BUTIR SOAL DI DATABASE (KOSONG)
    if (totalQuestions === 0) {
      return res.status(400).json({
        status: 'error',
        exists: true,
        has_questions: false,
        total_questions: 0,
        message: `Kuis #${cleanQuizId} terdaftar, tetapi belum memiliki butir soal di database. Ujian tidak dapat dimulai karena soal kosong.`
      });
    }

    // Ambil data setting kuis
    const settingData = dbSetting || memoryQuizSettings[cleanQuizId] || {
      quiz_id: cleanQuizId,
      start_time: null,
      end_time: null,
      duration_minutes: 60,
      max_violations: 3,
      is_active: true
    };

    return res.json({
      status: 'success',
      exists: true,
      has_questions: true,
      data: {
        quiz_id: settingData.quiz_id,
        start_time: settingData.start_time,
        end_time: settingData.end_time,
        duration_minutes: parseInt(settingData.duration_minutes), // Durasi asli dari DB
        max_violations: parseInt(settingData.max_violations) || 3,
        is_active: settingData.is_active !== false,
        total_questions: totalQuestions
      }
    });

  } catch (err) {
    if (memoryQuizSettings[cleanQuizId] && memoryQuizQuestions[cleanQuizId]) {
      const mem = memoryQuizSettings[cleanQuizId];
      return res.json({
        status: 'success',
        exists: true,
        has_questions: true,
        data: {
          ...mem,
          total_questions: memoryQuizQuestions[cleanQuizId].length
        }
      });
    }

    return res.status(404).json({
      status: 'error',
      exists: false,
      has_questions: false,
      total_questions: 0,
      message: `ID Kuis "${cleanQuizId}" tidak ditemukan di database.`
    });
  }
});

// Menyimpan/memperbarui pengaturan jadwal & timer (Hanya SUPERADMIN & DOSEN)
app.post('/v1/admin/quiz/settings', authenticate, requireRole('SUPERADMIN', 'DOSEN'), async (req, res) => {
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
  const cleanQuizId = (quizId || '').trim();

  try {
    const result = await db.query(
      `SELECT id, question_text, question_type 
       FROM quiz_questions 
       WHERE quiz_id = $1 
       ORDER BY id ASC`,
      [cleanQuizId]
    );

    if (result.rows.length > 0) {
      return res.json({ status: 'success', quizId: cleanQuizId, data: result.rows });
    }

    // Jika DB kosong/offline, periksa memory bank soal resmi
    if (memoryQuizQuestions[cleanQuizId]) {
      return res.json({ status: 'success', quizId: cleanQuizId, data: memoryQuizQuestions[cleanQuizId] });
    }

    // Jika tidak ada soal sama sekali: kembalikan error
    return res.status(404).json({
      status: 'error',
      quizId: cleanQuizId,
      data: [],
      message: `Tidak ada butir soal yang ditemukan untuk Kuis #${cleanQuizId}.`
    });
  } catch (err) {
    if (memoryQuizQuestions[cleanQuizId]) {
      return res.json({ status: 'success', quizId: cleanQuizId, data: memoryQuizQuestions[cleanQuizId] });
    }
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
      result = await db.query(
        `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, submitted_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [userId, nim, quizId, JSON.stringify(answers), status || 'COMPLETED']
      );
    }

    // Update live session status ke SUBMITTED atau DISQUALIFIED
    const liveKey = getLiveSessionKey(nim, quizId);
    const liveSession = liveStudentSessions.get(liveKey);
    if (liveSession) {
      liveSession.status = status === 'DISQUALIFIED' ? 'DISQUALIFIED' : (status === 'TIME_EXPIRED' ? 'TIME_EXPIRED' : 'SUBMITTED');
      liveSession.finishedAt = Date.now();
      liveSession.finishedAtISO = new Date().toISOString();
      liveSession.lastHeartbeat = Date.now();
      liveStudentSessions.set(liveKey, liveSession);
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
// 1b. ENDPOINT LIVE MONITORING SESI PESERTA
// -------------------------------------------------------------

// Daftarkan sesi live peserta saat mulai mengerjakan (public, tidak perlu auth)
app.post('/v1/quiz/live/session', (req, res) => {
  const { userId, nim, quizId, totalQuestions, questionTexts } = req.body;
  if (!nim || !quizId) {
    return res.status(400).json({ status: 'error', message: 'nim dan quizId wajib diisi.' });
  }

  const key = getLiveSessionKey(nim, quizId);
  const now = Date.now();

  liveStudentSessions.set(key, {
    key,
    nama: userId || nim,
    nim: nim.trim(),
    quizId: quizId.trim(),
    totalQuestions: totalQuestions || 0,
    questionTexts: questionTexts || [],
    startedAt: now,
    startedAtISO: new Date(now).toISOString(),
    currentQuestionIndex: 0,
    currentQuestionText: (questionTexts && questionTexts[0]) || 'Soal 1',
    questionTimings: [],       // [{ qNum, qText, totalSeconds, switchCount }]
    activityLog: [],           // [{ type, questionNum, questionText, elapsedSeconds, timestamp, timestampISO }]
    status: 'ACTIVE',
    lastHeartbeat: now,
    lastHeartbeatISO: new Date(now).toISOString(),
    violationCount: 0,
    remainingSeconds: null
  });

  console.log(`🟢 Sesi live dimulai: ${nim} | Kuis: ${quizId}`);
  res.json({ status: 'success', message: 'Sesi live terdaftar.', key });
});

// Update heartbeat / data real-time dari peserta
app.post('/v1/quiz/live/heartbeat', (req, res) => {
  const {
    nim, quizId,
    currentQuestionIndex, currentQuestionText,
    questionTimings, activityLog,
    remainingSeconds, violationCount,
    status
  } = req.body;

  if (!nim || !quizId) {
    return res.status(400).json({ status: 'error', message: 'nim dan quizId wajib diisi.' });
  }

  const key = getLiveSessionKey(nim, quizId);
  const now = Date.now();
  const existing = liveStudentSessions.get(key);

  if (!existing) {
    return res.status(404).json({ status: 'error', message: 'Sesi tidak ditemukan. Daftarkan sesi terlebih dahulu.' });
  }

  // Update data sesi dengan data terbaru dari client
  existing.currentQuestionIndex = currentQuestionIndex !== undefined ? currentQuestionIndex : existing.currentQuestionIndex;
  existing.currentQuestionText = currentQuestionText || existing.currentQuestionText;
  existing.questionTimings = questionTimings || existing.questionTimings;
  existing.activityLog = activityLog || existing.activityLog;
  existing.remainingSeconds = remainingSeconds !== undefined ? remainingSeconds : existing.remainingSeconds;
  existing.violationCount = violationCount !== undefined ? violationCount : existing.violationCount;
  existing.lastHeartbeat = now;
  existing.lastHeartbeatISO = new Date(now).toISOString();

  // Update status (ACTIVE, SUBMITTED, DISQUALIFIED, TIME_EXPIRED)
  if (status && status !== 'ACTIVE') {
    existing.status = status;
    existing.finishedAt = now;
    existing.finishedAtISO = new Date(now).toISOString();
  }

  liveStudentSessions.set(key, existing);
  res.json({ status: 'success' });
});

// Ambil semua sesi live (SUPERADMIN & PROCTOR)
// Secara default hanya mengembalikan yang statusnya 'ACTIVE' (sedang mengerjakan)
app.get('/v1/admin/live/sessions', authenticate, requireRole('SUPERADMIN', 'PROCTOR'), (req, res) => {
  const showAll = req.query.all === 'true'; // opsional jika ingin melihat riwayat yang baru selesai
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const sessions = [];

  for (const [, session] of liveStudentSessions.entries()) {
    // Jika tidak minta all, HANYA masukkan yang masih ACTIVE
    if (!showAll) {
      if (session.status === 'ACTIVE') {
        const totalElapsed = Math.floor((Date.now() - session.startedAt) / 1000);
        sessions.push({ ...session, totalElapsedSeconds: totalElapsed });
      }
    } else {
      if (session.lastHeartbeat >= cutoff || session.status === 'ACTIVE') {
        const totalElapsed = Math.floor((Date.now() - session.startedAt) / 1000);
        sessions.push({ ...session, totalElapsedSeconds: totalElapsed });
      }
    }
  }

  // Urutkan berdasarkan startedAt terbaru
  sessions.sort((a, b) => b.startedAt - a.startedAt);

  res.json({ status: 'success', data: sessions, total: sessions.length });
});

// Ambil detail satu sesi live mahasiswa
app.get('/v1/admin/live/sessions/:nim/:quizId', authenticate, requireRole('SUPERADMIN', 'PROCTOR'), (req, res) => {
  const key = getLiveSessionKey(req.params.nim, req.params.quizId);
  const session = liveStudentSessions.get(key);

  if (!session) {
    return res.status(404).json({ status: 'error', message: 'Sesi tidak ditemukan atau sudah kedaluwarsa.' });
  }

  const totalElapsed = Math.floor((Date.now() - session.startedAt) / 1000);
  res.json({ status: 'success', data: { ...session, totalElapsedSeconds: totalElapsed } });
});

// Bersihkan sesi lama secara manual (SUPERADMIN)
app.delete('/v1/admin/live/sessions/cleanup', authenticate, requireRole('SUPERADMIN'), (req, res) => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [key, session] of liveStudentSessions.entries()) {
    if (session.lastHeartbeat < cutoff) {
      liveStudentSessions.delete(key);
      removed++;
    }
  }
  res.json({ status: 'success', message: `${removed} sesi kedaluwarsa berhasil dibersihkan.`, remaining: liveStudentSessions.size });
});

// -------------------------------------------------------------
// 2. ENDPOINT AUTENTIKASI & MANAJEMEN ROLE PENGGUNA
// -------------------------------------------------------------

// Login Admin dengan Verifikasi Password Hash Dinamis (Bukan Hardcoded)
app.post('/v1/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'Username dan password wajib diisi!' });
  }

  const cleanUser = username.trim().toLowerCase();

  try {
    let user = null;

    // 1. Cek di tabel PostgreSQL admin_users
    try {
      const result = await db.query(
        'SELECT id, username, password_hash, salt, full_name, role FROM admin_users WHERE LOWER(username) = $1',
        [cleanUser]
      );
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    } catch (dbErr) {
      console.warn('DB login query error, checking memory:', dbErr.message);
    }

    // 2. Cek memori fallback jika DB tidak mengembalikan hasil
    if (!user) {
      user = memoryUsers.find(u => u.username.toLowerCase() === cleanUser);
    }

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Username atau password salah!' });
    }

    // Verifikasi Password Hash
    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ status: 'error', message: 'Username atau password salah!' });
    }

    // Buat session token acak & aman
    const token = crypto.randomBytes(32).toString('hex');
    const sessionData = {
      userId: user.id || 1,
      username: user.username,
      fullName: user.full_name,
      role: user.role || 'DOSEN',
      loginAt: new Date()
    };
    activeSessions.set(token, sessionData);

    res.json({
      status: 'success',
      token,
      user: {
        username: user.username,
        fullName: user.full_name,
        role: user.role || 'DOSEN'
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan server: ' + err.message });
  }
});

// Cek profil login saat ini
app.get('/v1/admin/me', authenticate, (req, res) => {
  res.json({ status: 'success', user: req.adminUser });
});

// Daftar akun admin/dosen (Hanya untuk SUPERADMIN)
app.get('/v1/admin/users', authenticate, requireRole('SUPERADMIN'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, full_name, role, created_at FROM admin_users ORDER BY id ASC'
    );
    res.json({ status: 'success', data: result.rows });
  } catch (err) {
    const safeUsers = memoryUsers.map((u, i) => ({
      id: u.id || i + 1,
      username: u.username,
      full_name: u.full_name,
      role: u.role,
      created_at: new Date()
    }));
    res.json({ status: 'success', data: safeUsers });
  }
});

// Tambah akun admin/dosen baru (Hanya untuk SUPERADMIN)
app.post('/v1/admin/users', authenticate, requireRole('SUPERADMIN'), async (req, res) => {
  const { username, password, fullName, role } = req.body;
  if (!username || !password || !fullName) {
    return res.status(400).json({ status: 'error', message: 'Username, password, dan nama lengkap wajib diisi!' });
  }

  const cleanUser = username.trim().toLowerCase();
  const validRoles = ['SUPERADMIN', 'DOSEN', 'PROCTOR'];
  const userRole = validRoles.includes(role) ? role : 'DOSEN';
  const { hash, salt } = hashPassword(password);

  try {
    const result = await db.query(
      `INSERT INTO admin_users (username, password_hash, salt, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, full_name, role, created_at`,
      [cleanUser, hash, salt, fullName.trim(), userRole]
    );

    memoryUsers.push({
      id: result.rows[0].id,
      username: cleanUser,
      password_hash: hash,
      salt: salt,
      full_name: fullName.trim(),
      role: userRole
    });

    res.json({ status: 'success', message: `Pengguna "${cleanUser}" berhasil ditambahkan!`, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ status: 'error', message: `Username "${username}" sudah digunakan!` });
    }
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Hapus akun admin (Hanya untuk SUPERADMIN, tidak bisa menghapus diri sendiri)
app.delete('/v1/admin/users/:id', authenticate, requireRole('SUPERADMIN'), async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.adminUser.userId === targetId) {
    return res.status(400).json({ status: 'error', message: 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif!' });
  }

  try {
    await db.query('DELETE FROM admin_users WHERE id = $1', [targetId]);
    memoryUsers = memoryUsers.filter(u => u.id !== targetId);
    res.json({ status: 'success', message: 'Akun berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// -------------------------------------------------------------
// 3. ENDPOINT REKAPITULASI, PENILAIAN & IMPOR SOAL
// -------------------------------------------------------------

// Rekap jawaban mahasiswa lengkap dengan laporan pelanggaran
app.get('/v1/admin/submissions', authenticate, async (req, res) => {
  try {
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
app.get('/v1/admin/violations/detail', authenticate, async (req, res) => {
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

// Penilaian (Grading) - Hanya SUPERADMIN & DOSEN (PROCTOR tidak boleh menilai)
app.post('/v1/admin/submissions/grade', authenticate, requireRole('SUPERADMIN', 'DOSEN'), async (req, res) => {
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

// Impor Soal Baru - Hanya SUPERADMIN & DOSEN
app.post('/v1/admin/questions/import', authenticate, requireRole('SUPERADMIN', 'DOSEN'), async (req, res) => {
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
app.listen(PORT, () => console.log(`Server API berjalan di port ${PORT}`));
