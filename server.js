require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db'); // Konfigurasi koneksi PostgreSQL Neon.tech

const app = express();
app.disable('x-powered-by');

app.use(cors());
app.use(express.json());
app.use('/src', express.static(path.join(__dirname, 'src')));

// -------------------------------------------------------------
// HELPER ERROR & KEAMANAN SISTEM
// -------------------------------------------------------------
function sendServerError(res, err, publicMessage = 'Terjadi kesalahan internal pada server.') {
  console.error(`[SERVER_ERROR] ${publicMessage}:`, err && (err.stack || err.message || err));
  return res.status(500).json({
    status: 'error',
    message: publicMessage
  });
}

// -------------------------------------------------------------
// HELPER PASSWORD HASHING (PBKDF2 + TIMING-SAFE EQUAL)
// -------------------------------------------------------------
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
  if (!password || !storedHash || !salt) return false;
  try {
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const hashBuf = Buffer.from(hash, 'utf8');
    const storedBuf = Buffer.from(storedHash, 'utf8');
    if (hashBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, storedBuf);
  } catch (_) {
    return false;
  }
}

// Fallback in-memory users (hanya digunakan jika DB benar-benar offline)
// TIDAK ada akun default hardcode — semua akun dikelola via database
let memoryUsers = [];

// Sesi Login Aktif Cache (Token -> User Data)
const activeSessions = new Map();

// Helper Token HMAC Kriptografis (Stateless agar kebal restart/serverless cold-start)
// Mendukung kunci utama dari JWT_SECRET/APP_SECRET serta kandidat turunan DATABASE_URL
// agar tidak pernah drop session saat perpindahan atau cold-start instance serverless
function getSecretCandidates() {
  const candidates = new Set();
  const envSecret = (process.env.JWT_SECRET || process.env.APP_SECRET || '').trim();
  if (envSecret) candidates.add(envSecret);
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (dbUrl) {
    candidates.add(crypto.createHmac('sha256', 'quiz-protect-v2-hmac-salt').update(dbUrl).digest('hex'));
  }
  candidates.add(crypto.createHmac('sha256', 'quiz-protect-v2-hmac-salt').update('quiz-tracker-proctoring-salt-2026-secret-seed-jwt-token').digest('hex'));
  candidates.add('quiz-tracker-proctoring-salt-2026-secret-seed-jwt-token');
  return Array.from(candidates);
}

function getPrimarySecret() {
  return getSecretCandidates()[0];
}

function generateAdminToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  // Token berlaku 7 hari
  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  const data = { ...payload, exp };
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', getPrimarySecret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyAdminToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const sigBuf = Buffer.from(signature, 'utf8');

    let isValid = false;
    for (const secret of getSecretCandidates()) {
      const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
      const expectedBuf = Buffer.from(expectedSig, 'utf8');
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        isValid = true;
        break;
      }
    }
    if (!isValid) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------
// EXAM SESSION TOKEN HELPER (Mencegah Pemalsuan & Fitnah Pelanggaran)
// ---------------------------------------------------------------
function generateExamToken(nim, quizId) {
  const cleanNim = String(nim || '').trim();
  const cleanQuizId = String(quizId || '').trim();
  const exp = Math.floor(Date.now() / 1000) + (8 * 60 * 60); // 8 jam masa berlaku
  const payloadStr = `${cleanNim}:${cleanQuizId}:${exp}`;
  const b64 = Buffer.from(payloadStr).toString('base64url');
  const sig = crypto.createHmac('sha256', getPrimarySecret()).update(payloadStr).digest('base64url');
  return `${b64}.${sig}`;
}

function verifyExamToken(token, expectedNim, expectedQuizId) {
  try {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [b64, sig] = parts;
    const payloadStr = Buffer.from(b64, 'base64url').toString('utf8');
    const sigBuf = Buffer.from(sig, 'utf8');

    let isValid = false;
    for (const secret of getSecretCandidates()) {
      const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
      const expectedBuf = Buffer.from(expectedSig, 'utf8');
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        isValid = true;
        break;
      }
    }
    if (!isValid) return false;

    const [tokenNim, tokenQuizId, expStr] = payloadStr.split(':');
    if (Math.floor(Date.now() / 1000) > parseInt(expStr)) return false;
    if (expectedNim && tokenNim !== String(expectedNim).trim()) return false;
    if (expectedQuizId && tokenQuizId !== String(expectedQuizId).trim()) return false;
    return true;
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------
// LIVE STUDENT SESSIONS STORE (IN-MEMORY DENGAN BATAS KAPASITAS LRU)
// ---------------------------------------------------------------
// Key: `${nim}_${quizId}`, Value: liveData object
const liveStudentSessions = new Map();
const MAX_LIVE_SESSIONS = 1000;

function getLiveSessionKey(nim, quizId) {
  return `${(nim || '').trim()}_${(quizId || '').trim()}`;
}

// Mitigasi DoS / OOM: Batasi kapasitas map in-memory
function enforceLiveSessionsLimit() {
  if (liveStudentSessions.size < MAX_LIVE_SESSIONS) return;
  const entries = Array.from(liveStudentSessions.entries())
    .sort((a, b) => (a[1].lastHeartbeat || 0) - (b[1].lastHeartbeat || 0));
  const removeCount = Math.max(1, Math.ceil(MAX_LIVE_SESSIONS * 0.1));
  for (let i = 0; i < removeCount && i < entries.length; i++) {
    liveStudentSessions.delete(entries[i][0]);
  }
}

// Auto-cleanup sesi lama setiap 30 menit (hapus yang > 6 jam tidak aktif)
setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [key, session] of liveStudentSessions.entries()) {
    if ((session.lastHeartbeat || 0) < cutoff) {
      liveStudentSessions.delete(key);
    }
  }
}, 30 * 60 * 1000);

// Middleware Autentikasi & Verifikasi Token (Mendukung Header Bearer, x-admin-token, & HttpOnly Cookie)
function authenticate(req, res, next) {
  // Cegah browser / proxy menyimpan response endpoint admin di cache disk
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  let token = null;
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
  if (authHeader) {
    token = authHeader.replace(/^Bearer\s+/i, '').trim();
  } else if (req.headers['cookie']) {
    const match = req.headers['cookie'].match(/(?:^|;\s*)admin_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Akses ditolak: Token autentikasi tidak ditemukan.' });
  }

  // 1. Cek dari memory cache
  let session = activeSessions.get(token);

  // 2. Jika tidak ada di memory (akibat serverless restart / cold-start), pulihkan via verifikasi kriptografis!
  if (!session) {
    const verified = verifyAdminToken(token);
    if (verified) {
      session = {
        userId: verified.userId || 1,
        username: verified.username,
        fullName: verified.fullName || verified.full_name || verified.username,
        role: verified.role || 'DOSEN'
      };
      // Simpan kembali ke memory cache instance ini
      activeSessions.set(token, session);
    }
  }

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

    // Tidak ada seed akun default — akun dibuat manual via fitur Manajemen User
    // agar tidak ada password hardcode yang bisa ditebak

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
    await db.query(`
      ALTER TABLE quiz_settings 
      ADD COLUMN IF NOT EXISTS grading_rubric TEXT;
    `);
    await db.query(`
      ALTER TABLE quiz_settings 
      ADD COLUMN IF NOT EXISTS auto_grade BOOLEAN DEFAULT FALSE;
    `);
    await db.query(`
      ALTER TABLE quiz_settings 
      ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
    `);
    await db.query(`
      ALTER TABLE quiz_settings 
      ADD COLUMN IF NOT EXISTS gemini_model VARCHAR(50) DEFAULT 'gemini-1.5-flash';
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
    await db.query(`
      ALTER TABLE quiz_submissions 
      ADD COLUMN IF NOT EXISTS question_timings JSONB;
    `);
    await db.query(`
      ALTER TABLE quiz_submissions 
      ADD COLUMN IF NOT EXISTS activity_log JSONB;
    `);
    await db.query(`
      ALTER TABLE quiz_submissions 
      ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 0;
    `);
    await db.query(`
      ALTER TABLE quiz_submissions 
      ADD COLUMN IF NOT EXISTS attempt INT DEFAULT 1;
    `);
    await db.query(`
      ALTER TABLE quiz_submissions 
      ADD COLUMN IF NOT EXISTS kelas VARCHAR(10);
    `);

    // 4. Buat tabel master data mahasiswa peserta PPK
    await db.query(`
      CREATE TABLE IF NOT EXISTS quiz_students (
        nim VARCHAR(30) PRIMARY KEY,
        nama VARCHAR(150) NOT NULL,
        kelas VARCHAR(10) NOT NULL,
        prodi VARCHAR(100) DEFAULT 'Informatika S1',
        status VARCHAR(30) DEFAULT 'BARU',
        semester INT DEFAULT 5,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. Auto-sync 197 data mahasiswa PPK jika tabel belum terisi lengkap
    try {
      const studentsPpk = require('./src/data/students_ppk.json');
      const countRes = await db.query('SELECT COUNT(*) AS count FROM quiz_students');
      if (parseInt(countRes.rows[0].count) < studentsPpk.length) {
        for (const s of studentsPpk) {
          await db.query(
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
        }
        console.log(`✅ Berhasil menyelaraskan ${studentsPpk.length} data peserta PPK ke database.`);
      }
    } catch (seedErr) {
      console.warn('ℹ️ Seed mahasiswa DB:', seedErr.message);
    }

    console.log('✅ Struktur database terverifikasi lengkap.');
  } catch (err) {
    console.warn('ℹ️ Inisialisasi tabel/kolom DB:', err.message);
  }
}
initDbTables();

// -------------------------------------------------------------
// 1. ENDPOINT KUIS (SOAL, SUBMIT, PENGATURAN & JADWAL TIMER)
// -------------------------------------------------------------

// Mengambil daftar quizId yang tersedia beserta jumlah soal & pengaturan timernya
app.get('/v1/quiz/list', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
         COALESCE(q.quiz_id, s.quiz_id) AS quiz_id,
         COALESCE(q.total_questions, 0)::int AS total_questions,
         COALESCE(s.duration_minutes, 60)::int AS duration_minutes,
         COALESCE(s.max_violations, 3)::int AS max_violations,
         COALESCE(s.is_active, TRUE) AS is_active,
         s.start_time,
         s.end_time,
         s.updated_at
       FROM (
         SELECT quiz_id, COUNT(*) AS total_questions
         FROM quiz_questions
         GROUP BY quiz_id
       ) q
       FULL OUTER JOIN quiz_settings s ON s.quiz_id = q.quiz_id
       ORDER BY COALESCE(q.quiz_id, s.quiz_id) ASC`
    );
    res.json({ status: 'success', data: result.rows });
  } catch (err) {
    try {
      const fallback = await db.query(
        `SELECT DISTINCT quiz_id, COUNT(*) AS total_questions 
         FROM quiz_questions 
         GROUP BY quiz_id 
         ORDER BY quiz_id ASC`
      );
      res.json({ status: 'success', data: fallback.rows });
    } catch (fallbackErr) {
      sendServerError(res, fallbackErr, 'Gagal memuat daftar kuis.');
    }
  }
});

// Mengambil pengaturan jadwal, jam buka-tutup, dan durasi timer kuis dari DATABASE
// Jika soal kosong di database, kuis dinyatakan TIDAK VALID
app.get('/v1/quiz/settings/:quizId', async (req, res) => {
  const { quizId } = req.params;
  const cleanQuizId = (quizId || '').trim();

  if (!cleanQuizId) {
    return res.status(400).json({ status: 'error', exists: false, message: 'ID Kuis wajib diisi.' });
  }

  try {
    // 1. Cek jumlah soal di tabel quiz_questions database
    const qResult = await db.query(
      `SELECT COUNT(*) AS total FROM quiz_questions WHERE quiz_id = $1`,
      [cleanQuizId]
    );
    const totalQuestions = parseInt(qResult.rows[0]?.total || 0);

    // JIKA TIDAK ADA SOAL DI DATABASE (KOSONG / 0 BUTIR) -> ID KUIS TIDAK VALID!
    if (totalQuestions === 0) {
      return res.status(404).json({
        status: 'error',
        exists: false,
        has_questions: false,
        total_questions: 0,
        message: `ID Kuis "${cleanQuizId}" tidak valid atau belum memiliki butir soal di database.`
      });
    }

    // 2. Kuis valid: Ambil pengaturan jadwal & durasi dari tabel quiz_settings
    const settingResult = await db.query(
      `SELECT quiz_id, start_time, end_time, duration_minutes, max_violations, is_active,
              grading_rubric, auto_grade, gemini_api_key, gemini_model
       FROM quiz_settings 
       WHERE quiz_id = $1`,
      [cleanQuizId]
    );

    let durationMinutes = 60;
    let maxViolations = 3;
    let isActive = true;
    let startTime = null;
    let endTime = null;
    let gradingRubric = '';
    let autoGrade = false;
    let geminiApiKey = '';
    let geminiModel = 'gemini-3.8-flash';

    if (settingResult.rows.length > 0) {
      const row = settingResult.rows[0];
      durationMinutes = parseInt(row.duration_minutes) || 60;
      maxViolations = parseInt(row.max_violations) || 3;
      isActive = row.is_active !== false;
      startTime = row.start_time;
      endTime = row.end_time;
      gradingRubric = row.grading_rubric || '';
      autoGrade = Boolean(row.auto_grade);
      geminiApiKey = row.gemini_api_key || '';
      // geminiModel = row.gemini_model && row.gemini_model !== 'gemini-1.5-flash' ? row.gemini_model : 'gemini-2.5-flash';
      // Ganti fallback default jika ada:
      geminiModel = row.gemini_model || 'gemini-3.8-flash';

    }

    return res.json({
      status: 'success',
      exists: true,
      has_questions: true,
      data: {
        quiz_id: cleanQuizId,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        max_violations: maxViolations,
        is_active: isActive,
        grading_rubric: gradingRubric,
        auto_grade: autoGrade,
        gemini_api_key: geminiApiKey,
        gemini_model: geminiModel,
        total_questions: totalQuestions
      }
    });

  } catch (err) {
    sendServerError(res, err, 'Gagal memeriksa kuis di database.');
  }
});

// Menyimpan/memperbarui pengaturan jadwal & timer (Hanya SUPERADMIN & DOSEN)
app.post('/v1/admin/quiz/settings', authenticate, requireRole('SUPERADMIN', 'DOSEN'), async (req, res) => {
  const { quizId, startTime, endTime, durationMinutes, maxViolations, isActive, gradingRubric, autoGrade, geminiApiKey, geminiModel } = req.body;

  if (!quizId) {
    return res.status(400).json({ status: 'error', message: 'quizId wajib diisi!' });
  }

  const duration = parseInt(durationMinutes) || 60;
  const maxV = parseInt(maxViolations) || 3;
  const active = isActive !== false;
  const start = startTime ? new Date(startTime).toISOString() : null;
  const end = endTime ? new Date(endTime).toISOString() : null;
  const rubric = typeof gradingRubric === 'string' ? gradingRubric.trim() : '';
  const isAuto = Boolean(autoGrade);
  const key = typeof geminiApiKey === 'string' ? geminiApiKey.trim() : '';
  const model = typeof geminiModel === 'string' && geminiModel.trim() && geminiModel.trim() !== 'gemini-1.5-flash'
    ? geminiModel.trim()
    : 'gemini-2.5-flash';

  try {
    const result = await db.query(
      `INSERT INTO quiz_settings (quiz_id, start_time, end_time, duration_minutes, max_violations, is_active, grading_rubric, auto_grade, gemini_api_key, gemini_model, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (quiz_id) 
       DO UPDATE SET 
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         duration_minutes = EXCLUDED.duration_minutes,
         max_violations = EXCLUDED.max_violations,
         is_active = EXCLUDED.is_active,
         grading_rubric = EXCLUDED.grading_rubric,
         auto_grade = EXCLUDED.auto_grade,
         gemini_api_key = EXCLUDED.gemini_api_key,
         gemini_model = EXCLUDED.gemini_model,
         updated_at = NOW()
       RETURNING *`,
      [quizId.trim(), start, end, duration, maxV, active, rubric, isAuto, key, model]
    );
    res.json({
      status: 'success',
      message: `Jadwal & timer kuis ${quizId} berhasil disimpan ke database!`,
      data: result.rows[0]
    });
  } catch (err) {
    sendServerError(res, err, 'Gagal menyimpan pengaturan kuis.');
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

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        quizId: cleanQuizId,
        data: [],
        message: `ID Kuis "${cleanQuizId}" tidak valid atau belum memiliki butir soal di database.`
      });
    }

    res.json({ status: 'success', quizId: cleanQuizId, data: result.rows });
  } catch (err) {
    sendServerError(res, err, 'Gagal mengambil daftar pertanyaan kuis.');
  }
});

// Mengambil quiz yang sedang aktif / default untuk portal mahasiswa
app.get('/v1/quiz/active', async (req, res) => {
  try {
    const actRes = await db.query(
      `SELECT COALESCE(q.quiz_id, s.quiz_id) AS quiz_id,
              COALESCE(s.duration_minutes, 60)::int AS duration_minutes,
              COALESCE(s.max_violations, 3)::int AS max_violations,
              COALESCE(s.is_active, TRUE) AS is_active,
              s.start_time,
              s.end_time,
              COALESCE(q.total_questions, 0)::int AS total_questions
       FROM quiz_settings s
       FULL OUTER JOIN (
         SELECT quiz_id, COUNT(*) AS total_questions
         FROM quiz_questions
         GROUP BY quiz_id
       ) q ON q.quiz_id = s.quiz_id
       WHERE COALESCE(s.is_active, TRUE) = TRUE
       ORDER BY s.updated_at DESC NULLS LAST, COALESCE(q.quiz_id, s.quiz_id) DESC
       LIMIT 1`
    );
    if (actRes.rows.length > 0 && actRes.rows[0].quiz_id) {
      return res.json({ status: 'success', data: actRes.rows[0] });
    }
    const qq = await db.query(`SELECT DISTINCT quiz_id FROM quiz_questions ORDER BY quiz_id ASC LIMIT 1`);
    const qId = (qq.rows.length > 0 && qq.rows[0].quiz_id) || '101';
    return res.json({ status: 'success', data: { quiz_id: qId, duration_minutes: 60, max_violations: 3, is_active: true } });
  } catch (err) {
    return res.json({ status: 'success', data: { quiz_id: '101', duration_minutes: 60, max_violations: 3, is_active: true } });
  }
});

// Verifikasi peserta kuis PPK, cegah duplikat sesi aktif, dan periksa jatah kesempatan (Max 2x, retake jika didiskualifikasi)
app.get('/v1/quiz/check-student', async (req, res) => {
  const cleanNim = (req.query.nim || '').trim();
  const cleanQuizId = (req.query.quizId || '').trim();

  if (!cleanNim) {
    return res.status(400).json({ status: 'error', message: 'NIM wajib diisi!' });
  }

  try {
    let student = null;
    try {
      const stuRes = await db.query(
        'SELECT nim, nama, kelas, prodi, status, semester FROM quiz_students WHERE nim = $1',
        [cleanNim]
      );
      if (stuRes.rows.length > 0) {
        student = stuRes.rows[0];
      }
    } catch (_) {}

    // Fallback dari memory file jika DB offline
    if (!student) {
      try {
        const studentsPpk = require('./src/data/students_ppk.json');
        student = studentsPpk.find(s => s.nim === cleanNim);
      } catch (_) {}
    }

    if (!student) {
      return res.status(404).json({
        status: 'error',
        registered: false,
        message: 'NIM tidak terdaftar sebagai peserta mata kuliah.'
      });
    }

    const safeStudent = {
      nim: student.nim,
      nama: student.nama
    };

    // Jika quizId belum dimasukkan, cukup kembalikan identitas valid mahasiswa
    if (!cleanQuizId) {
      return res.json({
        status: 'success',
        registered: true,
        student: safeStudent,
        quizId: null,
        canStart: false,
        message: 'NIM terdaftar. Silakan masukkan Kode Kuis.'
      });
    }

    // 1. Cek sesi duplikat yang sedang aktif berjalan
    const liveKey = getLiveSessionKey(cleanNim, cleanQuizId);
    const activeSession = liveStudentSessions.get(liveKey);
    if (
      activeSession &&
      activeSession.status === 'ACTIVE' &&
      Date.now() - (activeSession.lastHeartbeat || 0) < 45000
    ) {
      return res.status(409).json({
        status: 'error',
        registered: true,
        isDuplicateActive: true,
        student: safeStudent,
        quizId: cleanQuizId,
        canStart: false,
        message: `Sesi kuis #${cleanQuizId} sedang aktif di perangkat/tab lain.`
      });
    }

    // 2. Cek histori pengerjaan pada kuis ini (Aturan 2 Kesempatan: boleh retake jika didiskualifikasi)
    let submissions = [];
    try {
      const subRes = await db.query(
        `SELECT id, status, submitted_at, violation_count, attempt 
         FROM quiz_submissions 
         WHERE nim = $1 AND quiz_id = $2 
         ORDER BY submitted_at ASC`,
        [cleanNim, cleanQuizId]
      );
      submissions = subRes.rows;
    } catch (_) {}

    const attemptsCount = submissions.length;
    let canStart = true;
    let attemptNumber = attemptsCount + 1;
    let isRetake = false;
    let warningMessage = null;

    if (attemptsCount === 0) {
      canStart = true;
      attemptNumber = 1;
      isRetake = false;
    } else if (attemptsCount === 1) {
      const firstSub = submissions[0];
      if (firstSub.status === 'DISQUALIFIED') {
        canStart = true;
        attemptNumber = 2;
        isRetake = true;
        warningMessage = '⚠️ Anda sebelumnya terdiskualifikasi. Diberikan 1 kesempatan terakhir (Retake) untuk mengerjakan kuis ini.';
      } else {
        canStart = false;
        attemptNumber = 1;
        isRetake = false;
        warningMessage = `Anda sudah pernah menyelesaikan dan mengumpulkan kuis #${cleanQuizId}. Tidak dapat mengulang ujian.`;
      }
    } else {
      canStart = false;
      attemptNumber = attemptsCount;
      warningMessage = `Batas maksimal pengerjaan (2 kesempatan) telah habis untuk kuis #${cleanQuizId}.`;
    }

    res.json({
      status: 'success',
      registered: true,
      quizId: cleanQuizId,
      student: safeStudent,
      canStart,
      attemptNumber,
      maxAttempts: 2,
      isRetake,
      previousAttempts: attemptsCount,
      warningMessage
    });
  } catch (err) {
    sendServerError(res, err, 'Gagal memverifikasi status mahasiswa.');
  }
});

// Menyimpan jawaban kuis peserta (disertai verifikasi integritas & server-enforced proctoring)
app.post('/v1/quiz/submit', async (req, res) => {
  const { userId, nim, quizId, answers, status, violationCount, questionTimings, activityLog, durationSeconds, attempt, kelas } = req.body;

  const cleanNim = String(nim || '').trim();
  const cleanQuizId = String(quizId || '').trim();

  if (!userId || !cleanNim || !cleanQuizId || userId === '-' || cleanNim === '-') {
    return res.status(400).json({
      status: 'error',
      message: 'Submit ditolak: Nama Mahasiswa, NIM, dan ID Quiz wajib diisi!'
    });
  }

  try {
    // 1. Validasi keabsahan mahasiswa & kuis dari database
    const [stuRes, setRes] = await Promise.all([
      db.query('SELECT nim, nama, kelas FROM quiz_students WHERE nim = $1', [cleanNim]),
      db.query('SELECT quiz_id, max_violations, duration_minutes, auto_grade FROM quiz_settings WHERE quiz_id = $1', [cleanQuizId])
    ]);

    if (stuRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Submit ditolak: Mahasiswa tidak terdaftar.' });
    }
    if (setRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Submit ditolak: Kuis tidak ditemukan.' });
    }

    const studentRecord = stuRes.rows[0];
    const settingsRecord = setRes.rows[0];
    const studentKelas = kelas || studentRecord.kelas || '-';

    // 2. Otoritatif: Ambil batas pelanggaran dari database, BUKAN dari req.body client
    const serverMaxViolations = Number(settingsRecord.max_violations) || 3;

    // 3. Otoritatif: Hitung pelanggaran riil yang tersimpan di database quiz_violations
    const vDbRes = await db.query(
      `SELECT COUNT(*)::int AS count FROM quiz_violations WHERE (user_id = $1 OR user_id = $2) AND quiz_id = $3`,
      [cleanNim, studentRecord.nama, cleanQuizId]
    );
    const dbViolationCount = vDbRes.rows[0]?.count || 0;
    const clientVCount = parseInt(violationCount) >= 0 ? parseInt(violationCount) : 0;
    
    // Server-enforced: Ambil nilai terbesar antara catatan database dan client
    const finalViolationCount = Math.max(dbViolationCount, clientVCount);

    // 4. Server-enforced: Cegah manipulasi status oleh mahasiswa!
    // Jika pelanggaran >= batas toleransi server, paksa status DISQUALIFIED!
    let finalStatus = status || 'COMPLETED';
    if (finalViolationCount >= serverMaxViolations) {
      finalStatus = 'DISQUALIFIED';
    }

    const durSec = parseInt(durationSeconds) >= 0 ? parseInt(durationSeconds) : 0;
    const safeQTimings = Array.isArray(questionTimings) ? questionTimings.slice(0, 50) : null;
    const safeActLog = Array.isArray(activityLog) ? activityLog.slice(-100) : null;
    const qTimingsJson = safeQTimings ? JSON.stringify(safeQTimings) : null;
    const actLogJson = safeActLog ? JSON.stringify(safeActLog) : null;
    const attemptNum = parseInt(attempt) > 0 ? parseInt(attempt) : 1;

    let insertedId = null;
    try {
      const insRes = await db.query(
        `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, violation_count, max_violations, question_timings, activity_log, duration_seconds, attempt, kelas, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         RETURNING id`,
        [userId, cleanNim, cleanQuizId, JSON.stringify(answers || {}), finalStatus, finalViolationCount, serverMaxViolations, qTimingsJson, actLogJson, durSec, attemptNum, studentKelas]
      );
      insertedId = insRes.rows[0]?.id;
    } catch (insertColErr) {
      const insRes = await db.query(
        `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, violation_count, max_violations, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING id`,
        [userId, cleanNim, cleanQuizId, JSON.stringify(answers || {}), finalStatus, finalViolationCount, serverMaxViolations]
      );
      insertedId = insRes.rows[0]?.id;
    }

    // Jika fitur auto-grade aktif untuk kuis ini, jalankan penilaian Gemini AI di background
    if (insertedId && settingsRecord.auto_grade && finalStatus !== 'DISQUALIFIED') {
      evaluateSubmissionWithGemini(insertedId).catch((aiErr) => {
        console.warn('ℹ️ Background Auto-Grading Gemini AI:', aiErr.message);
      });
    }

    // Update live session status
    const liveKey = getLiveSessionKey(cleanNim, cleanQuizId);
    let liveSession = liveStudentSessions.get(liveKey);
    const nowTs = Date.now();
    if (liveSession) {
      liveSession.status = finalStatus;
      liveSession.finishedAt = nowTs;
      liveSession.finishedAtISO = new Date(nowTs).toISOString();
      liveSession.lastHeartbeat = nowTs;
      liveSession.remainingSeconds = 0;
      liveSession.violationCount = finalViolationCount;
      if (safeQTimings) liveSession.questionTimings = safeQTimings;
      if (safeActLog) liveSession.activityLog = safeActLog;
    }

    res.json({ status: 'success', message: 'Jawaban ujian berhasil disimpan.' });
  } catch (err) {
    sendServerError(res, err, 'Gagal menyimpan jawaban ujian.');
  }
});

// Catat log pelanggaran proctoring (dengan proteksi spoofing & validasi sesi)
app.post('/v1/violations', async (req, res) => {
  const { userId, nim, quizId, type, detail, url, examToken } = req.body;
  const token = req.headers['x-exam-token'] || examToken;

  const cleanNim = String(nim || userId || '').trim();
  const cleanQuizId = String(quizId || '').trim();

  if (!cleanNim || !cleanQuizId) {
    return res.status(400).json({ status: 'error', message: 'NIM dan ID Quiz wajib diisi.' });
  }

  // Verifikasi examToken atau kecocokan sesi aktif untuk mencegah fitnah / spoofing antar peserta
  const key = getLiveSessionKey(cleanNim, cleanQuizId);
  const activeSession = liveStudentSessions.get(key);
  const isTokenValid = token ? verifyExamToken(token, cleanNim, cleanQuizId) : false;

  if (!isTokenValid && (!activeSession || activeSession.status !== 'ACTIVE')) {
    return res.status(403).json({
      status: 'error',
      message: 'Akses ditolak: Hanya sesi ujian aktif yang berhak mengirim laporan pelanggaran.'
    });
  }

  // Whitelist jenis pelanggaran
  const allowedTypes = ['TAB_SWITCH', 'WINDOW_BLUR', 'COPY_PASTE', 'DEVTOOLS_OPEN', 'FULLSCREEN_EXIT', 'SUSPICIOUS_KEY'];
  const safeType = allowedTypes.includes(type) ? type : 'VIOLATION';
  const safeDetail = String(detail || 'Pelanggaran integritas proctoring').substring(0, 500);

  try {
    await db.query(
      `INSERT INTO quiz_violations (user_id, quiz_id, violation_type, detail, page_url, occurred_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [cleanNim, cleanQuizId, safeType, safeDetail, String(url || '').substring(0, 255)]
    );

    // Update counter di live session jika ada
    if (activeSession) {
      activeSession.violationCount = (activeSession.violationCount || 0) + 1;
      activeSession.lastHeartbeat = Date.now();
    }

    res.json({ status: 'success' });
  } catch (err) {
    sendServerError(res, err, 'Gagal mencatat log pelanggaran proctoring.');
  }
});

// -------------------------------------------------------------
// 1b. ENDPOINT LIVE MONITORING SESI PESERTA
// -------------------------------------------------------------

// Daftarkan sesi live peserta saat mulai mengerjakan (dengan validasi DB & token sesi)
app.post('/v1/quiz/live/session', async (req, res) => {
  const { userId, nim, quizId, totalQuestions, questionTexts, kelas, attempt, isRetake } = req.body;
  if (!nim || !quizId) {
    return res.status(400).json({ status: 'error', message: 'nim dan quizId wajib diisi.' });
  }

  const cleanNim = String(nim).trim();
  const cleanQuizId = String(quizId).trim();

  try {
    // Validasi bahwa mahasiswa dan kuis benar-benar ada di DB untuk mencegah pembanjiran data fiktif
    const [stuRes, setRes] = await Promise.all([
      db.query('SELECT nim, nama, kelas FROM quiz_students WHERE nim = $1', [cleanNim]),
      db.query('SELECT quiz_id FROM quiz_settings WHERE quiz_id = $1', [cleanQuizId])
    ]);

    if (stuRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'NIM tidak terdaftar sebagai peserta mata kuliah.' });
    }
    if (setRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'ID Quiz tidak ditemukan.' });
    }

    const studentRecord = stuRes.rows[0];
    const key = getLiveSessionKey(cleanNim, cleanQuizId);
    const now = Date.now();
    const existing = liveStudentSessions.get(key);

    // Cegah duplikat sesi aktif (jika sedang aktif dan heartbeat < 45 detik)
    if (
      !isRetake &&
      existing &&
      existing.status === 'ACTIVE' &&
      now - (existing.lastHeartbeat || 0) < 45000
    ) {
      return res.status(409).json({
        status: 'error',
        message: 'Sesi kuis sedang berjalan aktif di perangkat/tab lain! Tidak diperbolehkan membuka sesi ganda secara bersamaan.'
      });
    }

    // Terapkan batas kapasitas map in-memory (mencegah DoS / OOM)
    enforceLiveSessionsLimit();

    const studentKelas = kelas || studentRecord.kelas || '-';
    const safeQTexts = Array.isArray(questionTexts) ? questionTexts.slice(0, 50) : [];

    liveStudentSessions.set(key, {
      key,
      nama: studentRecord.nama || userId || cleanNim,
      nim: cleanNim,
      quizId: cleanQuizId,
      kelas: studentKelas,
      attempt: Number(attempt) || 1,
      totalQuestions: totalQuestions || safeQTexts.length || 0,
      questionTexts: safeQTexts,
      startedAt: now,
      startedAtISO: new Date(now).toISOString(),
      currentQuestionIndex: 0,
      currentQuestionText: safeQTexts[0] || 'Soal 1',
      questionTimings: [],
      activityLog: [],
      status: 'ACTIVE',
      lastHeartbeat: now,
      lastHeartbeatISO: new Date(now).toISOString(),
      violationCount: 0,
      remainingSeconds: null
    });

    const token = generateExamToken(cleanNim, cleanQuizId);
    res.json({ status: 'success', token });
  } catch (err) {
    sendServerError(res, err, 'Gagal mendaftarkan sesi kuis.');
  }
});

// Update heartbeat / data real-time dari peserta (dengan pembatasan ukuran payload)
app.post('/v1/quiz/live/heartbeat', (req, res) => {
  const {
    nim, quizId,
    currentQuestionIndex, currentQuestionText,
    questionTimings, activityLog,
    remainingSeconds, violationCount,
    status,
    userId, totalQuestions, questionTexts,
    examToken
  } = req.body;

  if (!nim || !quizId) {
    return res.status(400).json({ status: 'error', message: 'nim dan quizId wajib diisi.' });
  }

  const cleanNim = String(nim).trim();
  const cleanQuizId = String(quizId).trim();
  const token = req.headers['x-exam-token'] || examToken;

  if (token && !verifyExamToken(token, cleanNim, cleanQuizId)) {
    return res.status(403).json({ status: 'error', message: 'Token sesi ujian tidak valid.' });
  }

  const key = getLiveSessionKey(cleanNim, cleanQuizId);
  const now = Date.now();
  let existing = liveStudentSessions.get(key);

  if (!existing) {
    enforceLiveSessionsLimit();
    const safeQTexts = Array.isArray(questionTexts) ? questionTexts.slice(0, 50) : [];
    existing = {
      key,
      nama: userId || cleanNim,
      nim: cleanNim,
      quizId: cleanQuizId,
      totalQuestions: totalQuestions || 0,
      questionTexts: safeQTexts,
      startedAt: now,
      startedAtISO: new Date(now).toISOString(),
      currentQuestionIndex: 0,
      currentQuestionText: safeQTexts[0] || 'Soal 1',
      questionTimings: [],
      activityLog: [],
      status: 'ACTIVE',
      lastHeartbeat: now,
      lastHeartbeatISO: new Date(now).toISOString(),
      violationCount: 0,
      remainingSeconds: null
    };
  }

  // Update data dengan pembatasan array (mencegah memory explosion)
  existing.currentQuestionIndex = currentQuestionIndex !== undefined ? currentQuestionIndex : existing.currentQuestionIndex;
  existing.currentQuestionText = currentQuestionText ? String(currentQuestionText).substring(0, 300) : existing.currentQuestionText;
  existing.questionTimings = Array.isArray(questionTimings) ? questionTimings.slice(0, 50) : existing.questionTimings;
  existing.activityLog = Array.isArray(activityLog) ? activityLog.slice(-100) : existing.activityLog;
  existing.remainingSeconds = remainingSeconds !== undefined ? remainingSeconds : existing.remainingSeconds;
  existing.violationCount = violationCount !== undefined ? violationCount : existing.violationCount;
  existing.lastHeartbeat = now;
  existing.lastHeartbeatISO = new Date(now).toISOString();

  // Update status (ACTIVE, SUBMITTED, DISQUALIFIED, TIME_EXPIRED)
  if (status && status !== 'ACTIVE') {
    existing.status = status;
    existing.finishedAt = now;
    existing.finishedAtISO = new Date(now).toISOString();
  } else {
    const isAlreadyFinished = ['SUBMITTED', 'SUBMITTED_MANUALLY', 'DISQUALIFIED', 'TIME_EXPIRED'].includes(existing.status);
    if (!isAlreadyFinished) {
      existing.status = 'ACTIVE';
    }
  }

  liveStudentSessions.set(key, existing);
  res.json({ status: 'success' });
});

// Ambil semua sesi live (SUPERADMIN & PROCTOR)
// Secara default hanya mengembalikan yang statusnya 'ACTIVE' (sedang mengerjakan)
app.get('/v1/admin/live/sessions', authenticate, requireRole('SUPERADMIN', 'PROCTOR'), async (req, res) => {
  const showAll = req.query.all === 'true'; // opsional jika ingin melihat riwayat yang baru selesai
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const sessions = [];

  // 1. Cek dari database apakah ada mahasiswa yang sudah resmi submit
  const dbSubmittedMap = new Map();
  try {
    const subResult = await db.query('SELECT nim, quiz_id, status FROM quiz_submissions');
    for (const row of subResult.rows) {
      dbSubmittedMap.set(getLiveSessionKey(row.nim, row.quiz_id), row.status || 'SUBMITTED');
    }
  } catch (dbErr) {
    // Abaikan jika DB offline
  }

  // 2. Ambil quiz_settings untuk mengecek batas waktu maksimal (duration_minutes & end_time)
  const quizSettingsMap = new Map();
  try {
    const setRes = await db.query('SELECT quiz_id, duration_minutes, end_time FROM quiz_settings');
    for (const r of setRes.rows) {
      quizSettingsMap.set(String(r.quiz_id).trim(), {
        durationMinutes: parseInt(r.duration_minutes) || 60,
        endTime: r.end_time ? new Date(r.end_time).getTime() : null
      });
    }
  } catch (e) {}

  for (const [, session] of liveStudentSessions.entries()) {
    const key = session.key || getLiveSessionKey(session.nim, session.quizId);

    // Jika di database sudah ada record submit, paksa status sesi live jadi SUBMITTED!
    if (dbSubmittedMap.has(key)) {
      const dbStatus = dbSubmittedMap.get(key);
      session.status = dbStatus || 'SUBMITTED';
      if (!session.finishedAt) {
        session.finishedAt = Date.now();
        session.finishedAtISO = new Date().toISOString();
      }
      session.remainingSeconds = 0;
    }

    // Hitung total waktu pengerjaan:
    // Jika sudah selesai: waktu antara startedAt sampai finishedAt
    // Jika masih aktif: waktu antara startedAt sampai sekarang (Date.now())
    let totalElapsed = 0;
    if (session.finishedAt) {
      totalElapsed = Math.max(0, Math.floor((session.finishedAt - session.startedAt) / 1000));
    } else {
      totalElapsed = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
    }

    // Cek batas waktu durasi kuis:
    // Jika waktu pengerjaan sudah melebihi durasi kuis (misal 15 menit + 30 detik toleransi) atau melewati end_time,
    // dan status masih ACTIVE, maka waktu pengerjaan otomatis HABIS (TIME_EXPIRED)!
    const setting = quizSettingsMap.get(String(session.quizId).trim());
    const maxSeconds = setting ? setting.durationMinutes * 60 : 3600;
    const isEndTimePassed = setting && setting.endTime && (Date.now() > setting.endTime);

    if (session.status === 'ACTIVE' && (totalElapsed >= (maxSeconds + 30) || isEndTimePassed)) {
      session.status = 'TIME_EXPIRED';
      session.finishedAt = Date.now();
      session.finishedAtISO = new Date().toISOString();
      session.remainingSeconds = 0;
    }

    // Hitung sisa waktu real-time
    let remainingSeconds = session.remainingSeconds;
    if (session.status === 'ACTIVE') {
      const calculatedRemaining = Math.max(0, maxSeconds - totalElapsed);
      remainingSeconds = (remainingSeconds !== null && remainingSeconds !== undefined)
        ? Math.min(remainingSeconds, calculatedRemaining)
        : calculatedRemaining;
    } else {
      remainingSeconds = 0;
    }

    const payload = {
      ...session,
      totalElapsedSeconds: totalElapsed,
      remainingSeconds: remainingSeconds
    };

    // Jika tidak minta all, HANYA masukkan yang benar-benar masih ACTIVE
    if (!showAll) {
      if (session.status === 'ACTIVE') {
        sessions.push(payload);
      }
    } else {
      if (session.lastHeartbeat >= cutoff || session.status === 'ACTIVE') {
        sessions.push(payload);
      }
    }
  }

  // Urutkan berdasarkan startedAt terbaru
  sessions.sort((a, b) => b.startedAt - a.startedAt);

  res.json({ status: 'success', data: sessions, total: sessions.length });
});

// Ambil detail satu sesi live mahasiswa (atau fallback dari database jika sesi memori sudah selesai/restart)
app.get('/v1/admin/live/sessions/:nim/:quizId', authenticate, requireRole('SUPERADMIN', 'PROCTOR'), async (req, res) => {
  const cleanNim = (req.params.nim || '').trim();
  const cleanQuizId = (req.params.quizId || '').trim();
  const key = getLiveSessionKey(cleanNim, cleanQuizId);
  let session = liveStudentSessions.get(key);

  const safeJsonParse = (val, fallback = []) => {
    if (!val) return fallback;
    if (Array.isArray(val) || typeof val === 'object') return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return parsed || fallback;
      } catch (_) {
        return fallback;
      }
    }
    return fallback;
  };

  // Ambil record dari quiz_submissions database
  let dbRow = null;
  try {
    const subRes = await db.query(
      `SELECT id, user_id, nim, quiz_id, status, submitted_at, answers, question_timings, activity_log, duration_seconds, violation_count 
       FROM quiz_submissions 
       WHERE (nim = $1 OR user_id = $1) AND quiz_id = $2 
       ORDER BY submitted_at DESC LIMIT 1`,
      [cleanNim, cleanQuizId]
    );
    if (subRes.rows.length > 0) {
      dbRow = subRes.rows[0];
    }
  } catch (e) {}

  // Ambil daftar pelanggaran riil dari quiz_violations
  let violationsList = [];
  try {
    const vRes = await db.query(
      `SELECT id, user_id, violation_type, detail, occurred_at 
       FROM quiz_violations 
       WHERE (user_id = $1 OR user_id = $2) AND quiz_id = $3 
       ORDER BY occurred_at ASC`,
      [cleanNim, (dbRow && dbRow.user_id) || cleanNim, cleanQuizId]
    );
    violationsList = vRes.rows || [];
  } catch (ve) {}

  // Ambil daftar pertanyaan kuis dari quiz_questions
  let questionsList = [];
  try {
    const qRes = await db.query(
      `SELECT id, question_text 
       FROM quiz_questions 
       WHERE quiz_id = $1 
       ORDER BY id ASC`,
      [cleanQuizId]
    );
    questionsList = qRes.rows || [];
  } catch (qe) {}

  // Ambil durasi kuis dari quiz_settings
  let maxSeconds = 3600;
  let quizStartTime = null;
  let quizEndTime = null;
  try {
    const setRes = await db.query(
      'SELECT start_time, end_time, duration_minutes FROM quiz_settings WHERE quiz_id = $1',
      [cleanQuizId]
    );
    if (setRes.rows.length > 0) {
      quizStartTime = setRes.rows[0].start_time;
      quizEndTime = setRes.rows[0].end_time;
      maxSeconds = (parseInt(setRes.rows[0].duration_minutes) || 60) * 60;
    }
  } catch (e) {}

  if (!session && !dbRow) {
    return res.status(404).json({ status: 'error', message: 'Sesi tidak ditemukan atau sudah kedaluwarsa.' });
  }

  // Tentukan waktu submit dan durasi
  let subTs = Date.now();
  if (dbRow && dbRow.submitted_at) {
    subTs = new Date(dbRow.submitted_at).getTime();
  } else if (session && session.finishedAt) {
    subTs = session.finishedAt;
  }

  let totalElapsed = 0;
  if (dbRow && Number(dbRow.duration_seconds) > 0) {
    totalElapsed = Number(dbRow.duration_seconds);
  } else if (session && session.finishedAt && session.startedAt) {
    totalElapsed = Math.max(0, Math.floor((session.finishedAt - session.startedAt) / 1000));
  } else if (session && session.startedAt && session.status === 'ACTIVE') {
    totalElapsed = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
  } else if (session && session.activityLog && Array.isArray(session.activityLog) && session.activityLog.length > 0) {
    const maxElapsed = Math.max(0, ...session.activityLog.map(l => l.elapsedSeconds || 0));
    if (maxElapsed > 0) totalElapsed = maxElapsed;
  } else if (violationsList.length > 0 && dbRow && dbRow.submitted_at) {
    const firstVTs = new Date(violationsList[0].occurred_at).getTime();
    totalElapsed = Math.max(10, Math.floor((subTs - firstVTs) / 1000));
  } else {
    totalElapsed = 0;
  }

  let startTs = subTs;
  if (totalElapsed > 0) {
    startTs = subTs - totalElapsed * 1000;
  } else if (session && session.startedAt) {
    startTs = session.startedAt;
  } else if (quizStartTime) {
    startTs = new Date(quizStartTime).getTime();
  }

  // Jika sesi in-memory hilang (misal serverless restart), recover dari dbRow
  if (!session && dbRow) {
    session = {
      key,
      nama: dbRow.user_id || dbRow.nim,
      nim: dbRow.nim,
      quizId: dbRow.quiz_id,
      startedAt: startTs,
      startedAtISO: new Date(startTs).toISOString(),
      finishedAt: subTs,
      finishedAtISO: new Date(subTs).toISOString(),
      currentQuestionIndex: 0,
      currentQuestionText: 'Selesai',
      questionTimings: safeJsonParse(dbRow.question_timings, []),
      activityLog: safeJsonParse(dbRow.activity_log, []),
      violationCount: Math.max(Number(dbRow.violation_count) || 0, violationsList.length),
      remainingSeconds: 0,
      status: dbRow.status || 'SUBMITTED',
      totalElapsedSeconds: totalElapsed,
    };
  } else if (session && dbRow) {
    session.status = dbRow.status || session.status || 'SUBMITTED';
    if (!session.finishedAt) {
      session.finishedAt = subTs;
      session.finishedAtISO = new Date(subTs).toISOString();
    }
    session.remainingSeconds = 0;
    session.violationCount = Math.max(Number(session.violationCount) || 0, Number(dbRow.violation_count) || 0, violationsList.length);
    if ((!session.questionTimings || session.questionTimings.length === 0) && dbRow.question_timings) {
      session.questionTimings = safeJsonParse(dbRow.question_timings, []);
    }
    if ((!session.activityLog || session.activityLog.length === 0) && dbRow.activity_log) {
      session.activityLog = safeJsonParse(dbRow.activity_log, []);
    }
  }

  // Pastikan totalQuestions terisi
  const totalQuestionsCount = questionsList.length > 0 
    ? questionsList.length 
    : (session.questionTimings && session.questionTimings.length > 0 
        ? session.questionTimings.length 
        : 3);
  session.totalQuestions = totalQuestionsCount;

  // 1. Tangani questionTimings (HANYA gunakan data riil, jangan pernah buat data fiktif 3 menit!)
  let timings = safeJsonParse(session.questionTimings, []);
  const hasRealTimings = Array.isArray(timings) && timings.some(t => Number(t.totalSeconds) > 0);

  if (!hasRealTimings && Array.isArray(session.activityLog) && session.activityLog.length > 0) {
    const qEvents = session.activityLog.filter(e => e.type === 'QUESTION_SWITCH' || e.type === 'QUESTION_FOCUS');
    if (qEvents.length > 0) {
      const qMap = {};
      for (let i = 1; i <= totalQuestionsCount; i++) qMap[i] = 0;

      const sortedEvents = [...session.activityLog].sort((a, b) => (a.elapsedSeconds || 0) - (b.elapsedSeconds || 0));
      let curQ = 1;
      let lastSec = 0;
      for (const ev of sortedEvents) {
        const evSec = ev.elapsedSeconds || 0;
        const delta = Math.max(0, evSec - lastSec);
        if (curQ && qMap[curQ] !== undefined) qMap[curQ] += delta;
        if (ev.type === 'QUESTION_SWITCH' || ev.type === 'QUESTION_FOCUS') {
          curQ = Number(ev.questionNum) || curQ;
        }
        lastSec = evSec;
      }
      if (totalElapsed > lastSec && curQ && qMap[curQ] !== undefined) {
        qMap[curQ] += (totalElapsed - lastSec);
      }

      timings = Object.keys(qMap).map((k) => {
        const qNum = Number(k);
        const qText = (questionsList[qNum - 1] && questionsList[qNum - 1].question_text) || `Soal #${qNum}`;
        return {
          qNum,
          qText,
          totalSeconds: qMap[qNum] || 0,
          switchCount: sortedEvents.filter(e => (e.type === 'QUESTION_SWITCH' || e.type === 'QUESTION_FOCUS') && Number(e.questionNum) === qNum).length || 1
        };
      });
      session.questionTimings = timings;
    } else {
      session.questionTimings = [];
    }
  } else if (!hasRealTimings) {
    session.questionTimings = [];
  }

  // 2. Tangani activityLog (HANYA event riil dari proctoring & submit)
  let rawLogs = safeJsonParse(session.activityLog, []);
  if (!Array.isArray(rawLogs)) rawLogs = [];

  if (rawLogs.length === 0) {
    const constructedTimeline = [];

    // Mulai Ujian
    constructedTimeline.push({
      type: 'SESSION_START',
      questionNum: 1,
      questionText: `Mahasiswa memulai pengerjaan kuis #${cleanQuizId}`,
      elapsedSeconds: 0,
      timestamp: startTs,
      timestampISO: new Date(startTs).toISOString(),
    });

    // Masukkan semua pelanggaran dari database quiz_violations
    for (const v of violationsList) {
      const vOccurred = v.occurred_at ? new Date(v.occurred_at).getTime() : startTs;
      const vElapsed = Math.max(0, Math.floor((vOccurred - startTs) / 1000));
      constructedTimeline.push({
        type: 'VIOLATION',
        questionNum: 1,
        questionText: `⚠️ ${v.violation_type || 'VIOLATION'}: ${v.detail || 'Pelanggaran integritas proctoring'}`,
        elapsedSeconds: vElapsed,
        timestamp: vOccurred,
        timestampISO: new Date(vOccurred).toISOString(),
        detail: v.detail || v.violation_type
      });
    }

    // Submit Ujian
    if (session.status !== 'ACTIVE') {
      constructedTimeline.push({
        type: session.status === 'DISQUALIFIED' ? 'DISQUALIFIED' : 'SUBMIT',
        questionNum: totalQuestionsCount,
        questionText: `Mahasiswa mengakhiri ujian (Status: ${session.status || 'SUBMITTED'})`,
        elapsedSeconds: totalElapsed,
        timestamp: subTs,
        timestampISO: new Date(subTs).toISOString(),
        detail: `Status akhir: ${session.status || 'SUBMITTED'}`
      });
    }

    constructedTimeline.sort((a, b) => a.timestamp - b.timestamp);
    session.activityLog = constructedTimeline;
  } else {
    // Jika activityLog sudah ada, pastikan setiap record dari quiz_violations terdaftar
    const existingTimes = new Set(rawLogs.map(l => l.timestampISO));
    for (const v of violationsList) {
      const vIso = v.occurred_at ? new Date(v.occurred_at).toISOString() : null;
      if (vIso && !existingTimes.has(vIso)) {
        const vOccurred = new Date(v.occurred_at).getTime();
        const vElapsed = Math.max(0, Math.floor((vOccurred - startTs) / 1000));
        rawLogs.push({
          type: 'VIOLATION',
          questionNum: 1,
          questionText: `⚠️ ${v.violation_type || 'VIOLATION'}: ${v.detail || 'Pelanggaran integritas'}`,
          elapsedSeconds: vElapsed,
          timestamp: vOccurred,
          timestampISO: vIso,
          detail: v.detail || v.violation_type
        });
      }
    }
    rawLogs.sort((a, b) => a.timestamp - b.timestamp);
    session.activityLog = rawLogs;
  }

  let remainingSeconds = session.remainingSeconds;
  if (session.status === 'ACTIVE') {
    const calculatedRemaining = Math.max(0, maxSeconds - totalElapsed);
    remainingSeconds = (remainingSeconds !== null && remainingSeconds !== undefined)
      ? Math.min(remainingSeconds, calculatedRemaining)
      : calculatedRemaining;
  } else {
    remainingSeconds = 0;
  }

  res.json({
    status: 'success',
    data: {
      ...session,
      quizId: cleanQuizId,
      quizStartTime,
      quizEndTime,
      submittedAt: dbRow ? dbRow.submitted_at : session.finishedAtISO,
      totalElapsedSeconds: totalElapsed,
      remainingSeconds: remainingSeconds
    }
  });
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

    // Buat session token kriptografis stateless (bertahan meski serverless restart)
    const sessionData = {
      userId: user.id || 1,
      username: user.username,
      fullName: user.full_name,
      role: user.role || 'DOSEN'
    };
    const token = generateAdminToken(sessionData);
    activeSessions.set(token, { ...sessionData, loginAt: new Date() });

    // Set HttpOnly Secure Cookie (Mencegah pencurian token via XSS DevTools)
    res.setHeader('Set-Cookie', `admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

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
    sendServerError(res, err, 'Gagal memproses autentikasi login.');
  }
});

// Endpoint Logout (Membersihkan cookie HttpOnly & token di session)
app.post('/v1/admin/logout', (req, res) => {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
  if (token) activeSessions.delete(token);
  res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json({ status: 'success', message: 'Sesi berhasil diakhiri.' });
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
    sendServerError(res, err, 'Gagal menambahkan akun pengguna.');
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
    sendServerError(res, err, 'Gagal menghapus akun pengguna.');
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
        s.question_timings,
        s.activity_log,
        COALESCE(s.duration_seconds, 0) AS duration_seconds,
        COALESCE(s.attempt, 1) AS attempt,
        COALESCE(s.kelas, stu.kelas, '-') AS kelas,
        stu.prodi,
        GREATEST(COALESCE(s.violation_count, 0), COALESCE(v.total_violations, 0)) AS violation_count,
        COALESCE(s.max_violations, 3) AS max_violations,
        COALESCE(v.violation_breakdown, '-') AS violation_summary
      FROM quiz_submissions s
      LEFT JOIN quiz_students stu ON stu.nim = s.nim
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
    const safeRows = (result.rows || []).map(r => {
      let qTimings = r.question_timings;
      if (typeof qTimings === 'string') {
        try { qTimings = JSON.parse(qTimings); } catch (_) { qTimings = []; }
      }
      let actLog = r.activity_log;
      if (typeof actLog === 'string') {
        try { actLog = JSON.parse(actLog); } catch (_) { actLog = []; }
      }
      return {
        ...r,
        question_timings: Array.isArray(qTimings) ? qTimings : [],
        activity_log: Array.isArray(actLog) ? actLog : []
      };
    });
    res.json({ status: 'success', data: safeRows });
  } catch (err) {
    try {
      const fallback = await db.query(
        `SELECT id, user_id AS nama, nim, quiz_id, answers, status, grade, feedback, submitted_at,
                question_timings, activity_log, COALESCE(duration_seconds, 0) AS duration_seconds,
                0 AS violation_count, 3 AS max_violations, '-' AS violation_summary 
         FROM quiz_submissions 
         ORDER BY submitted_at DESC`
      );
      res.json({ status: 'success', data: fallback.rows });
    } catch (fallbackErr) {
      try {
        const minimal = await db.query(
          `SELECT id, user_id AS nama, nim, quiz_id, answers, status, grade, feedback, submitted_at,
                  0 AS violation_count, 3 AS max_violations, '-' AS violation_summary 
           FROM quiz_submissions 
           ORDER BY submitted_at DESC`
        );
        res.json({ status: 'success', data: minimal.rows });
      } catch (minErr) {
        sendServerError(res, minErr, 'Gagal memuat rekap jawaban ujian.');
      }
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
    sendServerError(res, err, 'Gagal memverifikasi status mahasiswa.');
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
    res.json({ status: 'success', message: 'Jawaban ujian berhasil disimpan.' });
  } catch (err) {
    sendServerError(res, err, 'Gagal menyimpan penilaian.');
  }
});

// Batch Impor Nilai (Grading Import AI / CSV) - Hanya SUPERADMIN & DOSEN
app.post('/v1/admin/submissions/import-grades', authenticate, requireRole('SUPERADMIN', 'DOSEN'), async (req, res) => {
  const { grades } = req.body;
  if (!Array.isArray(grades) || grades.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Daftar nilai (grades) tidak boleh kosong.' });
  }

  let updatedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const item of grades) {
    const rawNim = item.nim ? String(item.nim).trim() : '';
    const rawQuizId = item.quizId || item.quiz_id ? String(item.quizId || item.quiz_id).trim() : '';
    const submissionId = item.submissionId || item.submission_id || item.id;
    const rawGrade = item.grade ?? item.nilai;
    const feedback = item.feedback !== undefined && item.feedback !== null ? String(item.feedback) : (item.catatan || item.catatan_dosen || '');

    if (rawGrade === undefined || rawGrade === null || rawGrade === '') {
      skippedCount++;
      continue;
    }

    const gradeNum = parseInt(rawGrade, 10);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
      errors.push({ nim: rawNim, quizId: rawQuizId, message: `Nilai '${rawGrade}' tidak valid (harus 0-100)` });
      skippedCount++;
      continue;
    }

    try {
      let result;
      if (submissionId) {
        result = await db.query(
          `UPDATE quiz_submissions 
           SET grade = $1, feedback = $2 
           WHERE id = $3 
           RETURNING id`,
          [gradeNum, feedback, submissionId]
        );
      } else if (rawNim && rawQuizId) {
        if (item.attempt) {
          result = await db.query(
            `UPDATE quiz_submissions 
             SET grade = $1, feedback = $2 
             WHERE (LOWER(TRIM(nim)) = LOWER($3) OR LOWER(TRIM(user_id)) = LOWER($3)) 
               AND quiz_id = $4 
               AND attempt = $5
             RETURNING id`,
            [gradeNum, feedback, rawNim, rawQuizId, parseInt(item.attempt, 10) || 1]
          );
        } else {
          result = await db.query(
            `UPDATE quiz_submissions 
             SET grade = $1, feedback = $2 
             WHERE id = (
               SELECT id FROM quiz_submissions 
               WHERE (LOWER(TRIM(nim)) = LOWER($3) OR LOWER(TRIM(user_id)) = LOWER($3)) 
                 AND quiz_id = $4 
               ORDER BY attempt DESC, submitted_at DESC 
               LIMIT 1
             )
             RETURNING id`,
            [gradeNum, feedback, rawNim, rawQuizId]
          );
        }
      } else if (rawNim) {
        result = await db.query(
          `UPDATE quiz_submissions 
           SET grade = $1, feedback = $2 
           WHERE id = (
             SELECT id FROM quiz_submissions 
             WHERE LOWER(TRIM(nim)) = LOWER($3) OR LOWER(TRIM(user_id)) = LOWER($3)
             ORDER BY submitted_at DESC 
             LIMIT 1
           )
           RETURNING id`,
          [gradeNum, feedback, rawNim]
        );
      }

      if (result && result.rowCount > 0) {
        updatedCount += result.rowCount;
      } else {
        skippedCount++;
        errors.push({ nim: rawNim, quizId: rawQuizId, message: 'Data submission tidak ditemukan di database' });
      }
    } catch (dbErr) {
      skippedCount++;
      errors.push({ nim: rawNim, quizId: rawQuizId, message: 'Kesalahan saat menyimpan nilai' });
    }
  }

  res.json({
    status: 'success',
    message: `Berhasil mengimpor ${updatedCount} nilai mahasiswa (${skippedCount} dilewati).`,
    updatedCount,
    skippedCount,
    errors: errors.slice(0, 10),
  });
});

// Helper Pemanggilan Gemini API dengan Penanganan Model & Error Transparan
async function callGeminiWithFallback(rawApiKey, requestedModel, promptText) {
  const apiKey = String(rawApiKey || '').replace(/^['"]+|['"]+$/g, '').trim();
  if (!apiKey) {
    throw new Error('Gemini API Key kosong atau belum dikonfigurasi.');
  }

  let cleanReq = String(requestedModel || '').replace(/^models\//, '').trim() || 'gemini-2.5-flash';
  if (cleanReq === 'gemini-1.5-flash') cleanReq = 'gemini-2.5-flash';

  // 1. Coba panggil model yang diminta dosen (pada v1beta dan v1)
  let requestedModelError = null;
  for (const apiVer of ['v1beta', 'v1']) {
    const geminiUrl = `https://generativelanguage.googleapis.com/${apiVer}/models/${encodeURIComponent(cleanReq)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      });

      if (response.ok) {
        const geminiData = await response.json();
        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawText) {
          return { rawText, activeModel: cleanReq };
        }
      }

      const errBody = await response.text();
      let parsedErrMsg = '';
      try {
        const parsedErr = JSON.parse(errBody);
        parsedErrMsg = parsedErr?.error?.message || errBody;
      } catch (_) {
        parsedErrMsg = errBody.slice(0, 150);
      }
      requestedModelError = new Error(`Google Gemini API Error (${response.status}) [${cleanReq}]: ${parsedErrMsg}`);

      // Jika bukan 404 (misal 400 Bad Request, 403 Forbidden, 429 Quota Exceeded), langsung lempar error
      if (response.status !== 404) {
        throw requestedModelError;
      }
    } catch (reqErr) {
      requestedModelError = reqErr;
      if (reqErr.message && !reqErr.message.includes('404')) {
        throw reqErr;
      }
    }
  }

  // 2. Jika model yang diminta 404 (tidak ditemukan), tanyakan ke ListModels untuk cek model yang aktif di akun ini
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (listRes.ok) {
      const listData = await listRes.json();
      const availableModels = (listData.models || [])
        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      if (availableModels.length > 0) {
        // Pilih model alternatif terdekat yang aktif
        const fallbackModel =
          availableModels.find(m => m.includes('1.5-flash')) ||
          availableModels.find(m => m.includes('2.5-flash')) ||
          availableModels.find(m => m.includes('2.0-flash')) ||
          availableModels.find(m => m.includes('flash')) ||
          availableModels[0];

        const dynamicUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(fallbackModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const dynamicRes = await fetch(dynamicUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          })
        });

        if (dynamicRes.ok) {
          const dynamicData = await dynamicRes.json();
          const rawText = dynamicData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText) return { rawText, activeModel: fallbackModel };
        }
      }
    }
  } catch (_) {}

  // Selalu tampilkan error yang konsisten dengan model yang dipilih dosen
  if (requestedModelError) {
    throw new Error(`${requestedModelError.message}\nPetunjuk: Periksa apakah API Key dibuat di Google AI Studio (aistudio.google.com) dan 'Generative Language API' aktif tanpa restriksi.`);
  }

  throw new Error(`Model '${cleanReq}' tidak tersedia pada API Key Anda.`);
}

// Helper Evaluasi Jawaban Mahasiswa Menggunakan Google Gemini AI
async function evaluateSubmissionWithGemini(submissionId, customApiKey, customModel, customRubric) {
  const subRes = await db.query(
    `SELECT s.id, s.user_id, s.nim, s.quiz_id, s.answers, s.status, s.grade,
            set.grading_rubric, set.gemini_api_key, set.gemini_model, set.auto_grade
     FROM quiz_submissions s
     LEFT JOIN quiz_settings set ON set.quiz_id = s.quiz_id
     WHERE s.id = $1`,
    [submissionId]
  );
  if (subRes.rows.length === 0) throw new Error('Submission #' + submissionId + ' tidak ditemukan di database.');
  const sub = subRes.rows[0];

  const apiKey = (customApiKey || sub.gemini_api_key || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Gemini API Key belum dikonfigurasi. Masukkan API Key pada menu Kelola Soal & Timer atau set env GEMINI_API_KEY.');
  }

  let model = customModel || sub.gemini_model || 'gemini-2.5-flash';
  if (model === 'gemini-1.5-flash') model = 'gemini-2.5-flash';
  const rubric = (customRubric || sub.grading_rubric || '').trim() ||
    'Nilai ketepatan, kejelasan logika, dan kelengkapan konsep pada setiap jawaban essay mahasiswa. Berikan total nilai dalam skala 0 - 100 dan feedback singkat yang edukatif.';

  // Ambil butir pertanyaan kuis
  const qRes = await db.query(
    `SELECT id, question_text, question_type 
     FROM quiz_questions 
     WHERE quiz_id = $1 
     ORDER BY id ASC`,
    [sub.quiz_id]
  );
  const questions = qRes.rows || [];

  let answersObj = {};
  try {
    answersObj = typeof sub.answers === 'string' ? JSON.parse(sub.answers) : (sub.answers || {});
  } catch (_) {
    answersObj = {};
  }

  let qaText = '';
  questions.forEach((q, idx) => {
    const qNum = idx + 1;
    const ans =
      answersObj[`soal_${qNum}`] ||
      answersObj[String(qNum)] ||
      answersObj[qNum] ||
      answersObj[`Soal ${qNum}`] ||
      answersObj[Object.keys(answersObj)[idx]] ||
      '(Tidak dijawab)';
    qaText += `\n--- SOAL #${qNum} ---\nPertanyaan: ${q.question_text}\nJawaban Mahasiswa: ${ans}\n`;
  });

  const promptText = `Anda adalah Dosen Penguji / Asisten Ahli Penilai Ujian Essay untuk mahasiswa Informatika.
Tugas Anda adalah menilai jawaban mahasiswa secara objektif, adil, dan akurat berdasarkan pertanyaan dan panduan rubrik penilaian dosen berikut.

PANDUAN / RUBRIK PENILAIAN DARI DOSEN:
${rubric}

BERKAS UJIAN MAHASISWA:
Mahasiswa: ${sub.user_id} (${sub.nim})
Quiz ID: #${sub.quiz_id}
Daftar Pertanyaan dan Jawaban Mahasiswa:
${qaText}

PETUNJUK PENILAIAN:
1. Evaluasi setiap jawaban mahasiswa terhadap pertanyaan dan rubrik yang telah ditetapkan oleh dosen.
2. Hitung total nilai akhir dalam rentang angka bulat 0 sampai 100.
3. Buat Catatan/Feedback Dosen yang edukatif, konstruktif, dan sopan dalam bahasa Indonesia. Sebutkan poin-poin yang sudah baik dan poin yang perlu diperbaiki bila ada.
4. Jawab HANYA dalam format JSON valid persis seperti berikut tanpa teks pembuka/penutup tambahan di luar JSON:
{
  "grade": 85,
  "feedback": "Jawaban nomor 1 sangat baik dan tepat. Pada nomor 2 konsep dasar sudah benar namun kurang menyertakan contoh implementasi.",
  "breakdown": [
    { "soal": 1, "skor": 45, "maks": 50, "catatan": "Konsep tepat." },
    { "soal": 2, "skor": 40, "maks": 50, "catatan": "Kurang contoh." }
  ]
}`;

  const { rawText, activeModel } = await callGeminiWithFallback(apiKey, model, promptText);

  let parsedOutput;
  try {
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    parsedOutput = JSON.parse(cleanJson);
  } catch (pe) {
    throw new Error('Gagal memproses format JSON hasil penilaian Gemini: ' + pe.message);
  }

  let finalGrade = parseInt(parsedOutput.grade, 10);
  if (isNaN(finalGrade)) finalGrade = 0;
  finalGrade = Math.max(0, Math.min(100, finalGrade));

  const finalFeedback = (parsedOutput.feedback || '').trim() || 'Telah dinilai secara otomatis oleh Gemini AI.';

  await db.query(
    `UPDATE quiz_submissions 
     SET grade = $1, feedback = $2 
     WHERE id = $3`,
    [finalGrade, finalFeedback, submissionId]
  );

  return {
    submissionId,
    grade: finalGrade,
    feedback: finalFeedback,
    breakdown: parsedOutput.breakdown || []
  };
}

// Endpoint Pengetesan Gemini API Key & Pengambilan Model Aktif - Hanya SUPERADMIN & DOSEN
app.post('/v1/admin/gemini/test', authenticate, requireRole('SUPERADMIN', 'DOSEN'), async (req, res) => {
  const { apiKey } = req.body;
  const cleanKey = String(apiKey || process.env.GEMINI_API_KEY || '').replace(/^['"]+|['"]+$/g, '').trim();
  if (!cleanKey) {
    return res.status(400).json({ status: 'error', message: 'API Key wajib diisi untuk melakukan pengetesan.' });
  }

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`);
    const listBody = await listRes.text();
    let listData;
    try {
      listData = JSON.parse(listBody);
    } catch (_) {
      return res.status(502).json({ status: 'error', message: `Respon Google API invalid: ${listBody.slice(0, 150)}` });
    }

    if (!listRes.ok) {
      return res.status(listRes.status).json({
        status: 'error',
        message: `Google API Error (${listRes.status}): ${listData?.error?.message || listBody.slice(0, 150)}`,
        hint: 'Pastikan API Key dibuat dari Google AI Studio (https://aistudio.google.com/app/apikey) dan layanan Generative Language API aktif tanpa restriksi IP/Referrer.'
      });
    }

    const availableModels = (listData.models || [])
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => ({
        id: m.name.replace(/^models\//, ''),
        name: m.displayName || m.name.replace(/^models\//, ''),
        description: m.description || ''
      }));

    if (availableModels.length === 0) {
      return res.json({
        status: 'warn',
        message: 'API Key valid, namun tidak ditemukan model yang mendukung generateContent.',
        models: []
      });
    }

    return res.json({
      status: 'success',
      message: `API Key valid! Ditemukan ${availableModels.length} model aktif dari akun Google Anda.`,
      models: availableModels
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: `Gagal menghubungi Google API: ${err.message}` });
  }
});

// Endpoint Auto-Grading Gemini AI - Hanya SUPERADMIN & DOSEN
app.post('/v1/admin/submissions/auto-grade', authenticate, requireRole('SUPERADMIN', 'DOSEN'), async (req, res) => {
  const { submissionId, quizId, ungradeOnly, apiKey, model, rubric } = req.body;
  try {
    if (submissionId) {
      const result = await evaluateSubmissionWithGemini(submissionId, apiKey, model, rubric);
      return res.json({
        status: 'success',
        message: `Berhasil menilai jawaban dengan nilai ${result.grade}!`,
        data: result
      });
    }

    if (!quizId) {
      return res.status(400).json({ status: 'error', message: 'submissionId atau quizId wajib diisi.' });
    }

    let query = `SELECT id FROM quiz_submissions WHERE quiz_id = $1`;
    if (ungradeOnly !== false) {
      query += ` AND (grade IS NULL OR grade = '')`;
    }
    query += ` ORDER BY id ASC LIMIT 50`;

    const subList = await db.query(query, [String(quizId).trim()]);
    if (subList.rows.length === 0) {
      return res.json({
        status: 'success',
        message: 'Seluruh submission pada kuis #' + quizId + ' sudah memiliki nilai.',
        gradedCount: 0
      });
    }

    let gradedCount = 0;
    const errors = [];
    for (const r of subList.rows) {
      try {
        await evaluateSubmissionWithGemini(r.id, apiKey, model, rubric);
        gradedCount++;
        // Jeda 250ms untuk menghindari rate limit API
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (err) {
        errors.push({ id: r.id, message: err.message });
      }
    }

    res.json({
      status: 'success',
      message: `Selesai: ${gradedCount} jawaban berhasil dinilai otomatis oleh Gemini AI (${errors.length} gagal/dilewati).`,
      gradedCount,
      errors: errors.slice(0, 5)
    });
  } catch (err) {
    sendServerError(res, err, 'Gagal menjalankan Auto-Grading Gemini AI: ' + err.message);
  }
});

// Impor / Simpan Soal - Hanya SUPERADMIN & DOSEN
app.post('/v1/admin/questions/import', authenticate, requireRole('SUPERADMIN', 'DOSEN'), async (req, res) => {
  const { quizId, questions, replaceExisting } = req.body;
  if (!quizId || !Array.isArray(questions)) {
    return res.status(400).json({ status: 'error', message: 'quizId dan array questions wajib diisi!' });
  }
  const cleanQuizId = String(quizId).trim();
  try {
    if (replaceExisting) {
      await db.query('DELETE FROM quiz_questions WHERE quiz_id = $1', [cleanQuizId]);
    }
    for (const q of questions) {
      const text = (q.question_text || q.question || '').trim();
      if (!text) continue;
      await db.query(
        `INSERT INTO quiz_questions (quiz_id, question_text, question_type)
         VALUES ($1, $2, $3)`,
        [cleanQuizId, text, q.question_type || 'ESSAY']
      );
    }
    res.json({ status: 'success', message: `${questions.length} soal untuk Kuis #${cleanQuizId} berhasil disimpan!` });
  } catch (err) {
    sendServerError(res, err, 'Gagal memverifikasi status mahasiswa.');
  }
});

// Hapus satu butir soal berdasarkan ID - Hanya SUPERADMIN & DOSEN
app.delete('/v1/admin/questions/:id', authenticate, requireRole('SUPERADMIN', 'DOSEN'), async (req, res) => {
  const questionId = parseInt(req.params.id);
  if (!questionId) {
    return res.status(400).json({ status: 'error', message: 'ID soal tidak valid.' });
  }
  try {
    await db.query('DELETE FROM quiz_questions WHERE id = $1', [questionId]);
    res.json({ status: 'success', message: 'Butir soal berhasil dihapus.' });
  } catch (err) {
    sendServerError(res, err, 'Gagal memverifikasi status mahasiswa.');
  }
});

// Dynamic React Modular Bundle dengan In-Memory Caching (Mencegah Event Loop Blocking)
let cachedBundleCode = null;
let cachedHtml = null;

function loadReactModulesRaw() {
  return [
    { name: 'src/services/api.js', code: fs.readFileSync(path.join(__dirname, 'src/services/api.js'), 'utf8') },
    { name: 'src/components/admin/ImportGradesModal.jsx', code: fs.readFileSync(path.join(__dirname, 'src/components/admin/ImportGradesModal.jsx'), 'utf8') },
    { name: 'src/components/admin/SubmissionRow.jsx', code: fs.readFileSync(path.join(__dirname, 'src/components/admin/SubmissionRow.jsx'), 'utf8') },
    { name: 'src/components/admin/LiveSessionRow.jsx', code: fs.readFileSync(path.join(__dirname, 'src/components/admin/LiveSessionRow.jsx'), 'utf8') },
    { name: 'src/components/admin/AdminModals.jsx', code: fs.readFileSync(path.join(__dirname, 'src/components/admin/AdminModals.jsx'), 'utf8') },
    { name: 'src/components/admin/UnifiedQuizManager.jsx', code: fs.readFileSync(path.join(__dirname, 'src/components/admin/UnifiedQuizManager.jsx'), 'utf8') },
    { name: 'src/components/admin/UserManager.jsx', code: fs.readFileSync(path.join(__dirname, 'src/components/admin/UserManager.jsx'), 'utf8') },
    { name: 'src/components/quiz/StickyExamHeader.jsx', code: fs.readFileSync(path.join(__dirname, 'src/components/quiz/StickyExamHeader.jsx'), 'utf8') },
    { name: 'src/components/quiz/QuestionCard.jsx', code: fs.readFileSync(path.join(__dirname, 'src/components/quiz/QuestionCard.jsx'), 'utf8') },
    { name: 'src/pages/AdminDashboardPage.jsx', code: fs.readFileSync(path.join(__dirname, 'src/pages/AdminDashboardPage.jsx'), 'utf8') },
    { name: 'src/pages/StudentQuizPage.jsx', code: fs.readFileSync(path.join(__dirname, 'src/pages/StudentQuizPage.jsx'), 'utf8') },
    { name: 'src/App.jsx', code: fs.readFileSync(path.join(__dirname, 'src/App.jsx'), 'utf8') },
    { name: 'src/main.jsx', code: fs.readFileSync(path.join(__dirname, 'src/main.jsx'), 'utf8') }
  ];
}

function buildReactBundleCode() {
  if (cachedBundleCode) return cachedBundleCode;
  const chunks = [
    'const { useState, useEffect, useMemo, useCallback, useRef, memo } = React;'
  ];
  for (const mod of loadReactModulesRaw()) {
    const transformed = mod.code
      .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*export\s*\{[\s\S]*?\}(?:\s*from\s+['"][^'"]+['"])?;?\s*$/gm, '')
      .replace(/^\s*export\s+default\s+/gm, '')
      .replace(/^\s*export\s+(const|function|let|var|class|async\s+function)\s+/gm, '$1 ');
    chunks.push(`\n// --- MODULE: ${mod.name} ---\n${transformed}`);
  }
  cachedBundleCode = chunks.join('\n');
  return cachedBundleCode;
}

function getCachedHtml() {
  if (cachedHtml) return cachedHtml;
  const cssContent = fs.readFileSync(path.join(__dirname, 'src/styles/app.css'), 'utf8');
  const jsxBundle = buildReactBundleCode();
  cachedHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quiz Tracker Proctoring System (React.js)</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" />
  <style>${cssContent}</style>
</head>
<body>
  <div id="root"></div>

  <!-- React 18 Production UMD & Babel JSX Runtime -->
  <script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js" crossorigin></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.24.7/babel.min.js" crossorigin></script>

  <!-- Shim CommonJS agar Babel in-browser tidak error "exports is not defined" -->
  <script>window.exports = {}; window.module = { exports: window.exports };</script>

  <!-- Bundled Modular React Code from /src/**/*.jsx (JSX saja, tanpa transform modul) -->
  <script type="text/babel" data-presets="react" data-type="text/javascript">
${jsxBundle}
  </script>
</body>
</html>`;
  return cachedHtml;
}

app.get('/bundle.jsx', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buildReactBundleCode());
  } catch (err) {
    sendServerError(res, err, 'Gagal membangun bundle aplikasi.');
  }
});

// Routing Halaman SPA React.js (inlined CSS & JSX dari cache memory, sub-millisecond tanpa blocking)
const sendReactApp = (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(getCachedHtml());
  } catch (err) {
    sendServerError(res, err, 'Gagal memuat aplikasi kuis.');
  }
};

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', sendReactApp);
app.get('/quiz', sendReactApp);
app.get('/quiz.html', sendReactApp);
app.get('/admin', sendReactApp);
app.get('/admin.html', sendReactApp);
app.get('/admin-dashboard', sendReactApp);
app.get('/admin-dashboard.html', sendReactApp);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server API berjalan di port ${PORT}`));
}

module.exports = app;
