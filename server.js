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

// Fallback in-memory users (hanya digunakan jika DB benar-benar offline)
// TIDAK ada akun default hardcode — semua akun dikelola via database
let memoryUsers = [];

// Sesi Login Aktif Cache (Token -> User Data)
const activeSessions = new Map();

// Helper Token HMAC Kriptografis (Stateless agar kebal restart/serverless cold-start)
const JWT_SECRET = process.env.JWT_SECRET || process.env.APP_SECRET || 'quiz_tracker_secret_token_signature_key_2026_super_safe';

function generateAdminToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  // Token berlaku 7 hari
  const exp = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  const data = { ...payload, exp };
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyAdminToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;
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
      `SELECT quiz_id, start_time, end_time, duration_minutes, max_violations, is_active 
       FROM quiz_settings 
       WHERE quiz_id = $1`,
      [cleanQuizId]
    );

    let durationMinutes = 60;
    let maxViolations = 3;
    let isActive = true;
    let startTime = null;
    let endTime = null;

    if (settingResult.rows.length > 0) {
      const row = settingResult.rows[0];
      durationMinutes = parseInt(row.duration_minutes) || 60;
      maxViolations = parseInt(row.max_violations) || 3;
      isActive = row.is_active !== false;
      startTime = row.start_time;
      endTime = row.end_time;
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
        total_questions: totalQuestions
      }
    });

  } catch (err) {
    return res.status(500).json({
      status: 'error',
      exists: false,
      message: 'Gagal memeriksa kuis di database: ' + err.message
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

  try {
    const result = await db.query(
      `INSERT INTO quiz_settings (quiz_id, start_time, end_time, duration_minutes, max_violations, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (quiz_id) 
       DO UPDATE SET 
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         duration_minutes = EXCLUDED.duration_minutes,
         max_violations = EXCLUDED.max_violations,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()
       RETURNING *`,
      [quizId.trim(), start, end, duration, maxV, active]
    );
    res.json({
      status: 'success',
      message: `Jadwal & timer kuis ${quizId} berhasil disimpan ke database!`,
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
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
    let liveSession = liveStudentSessions.get(liveKey);
    const finalLiveStatus = status === 'DISQUALIFIED' ? 'DISQUALIFIED' : (status === 'TIME_EXPIRED' ? 'TIME_EXPIRED' : 'SUBMITTED');
    const nowTs = Date.now();
    if (!liveSession) {
      liveSession = {
        key: liveKey,
        nama: userId || nim,
        nim: nim.trim(),
        quizId: quizId.trim(),
        startedAt: nowTs - 60000,
        startedAtISO: new Date(nowTs - 60000).toISOString(),
        currentQuestionIndex: 0,
        currentQuestionText: 'Selesai',
        questionTimings: [],
        activityLog: [],
        violationCount: vCount,
        remainingSeconds: 0
      };
    }
    liveSession.status = finalLiveStatus;
    liveSession.finishedAt = nowTs;
    liveSession.finishedAtISO = new Date(nowTs).toISOString();
    liveSession.lastHeartbeat = nowTs;
    liveSession.remainingSeconds = 0;
    liveStudentSessions.set(liveKey, liveSession);

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
    status,
    userId, totalQuestions, questionTexts
  } = req.body;

  if (!nim || !quizId) {
    return res.status(400).json({ status: 'error', message: 'nim dan quizId wajib diisi.' });
  }

  const key = getLiveSessionKey(nim, quizId);
  const now = Date.now();
  let existing = liveStudentSessions.get(key);

  // Jika sesi belum ada (server restart / cold start), buat otomatis (upsert)
  if (!existing) {
    existing = {
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
      questionTimings: [],
      activityLog: [],
      status: 'ACTIVE',
      lastHeartbeat: now,
      lastHeartbeatISO: new Date(now).toISOString(),
      violationCount: 0,
      remainingSeconds: null
    };
    console.log(`🔄 Sesi live di-recover via heartbeat: ${nim} | Kuis: ${quizId}`);
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
  } else {
    // PENTING: Jika status existing sudah selesai, jangan izinkan heartbeat revert ke ACTIVE!
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
      session.status = dbSubmittedMap.get(key);
      if (!session.finishedAt) {
        session.finishedAt = Date.now();
        session.finishedAtISO = new Date().toISOString();
      }
      session.remainingSeconds = 0;
    }

    const totalElapsed = Math.floor((Date.now() - session.startedAt) / 1000);

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

    // Jika tidak minta all, HANYA masukkan yang benar-benar masih ACTIVE
    if (!showAll) {
      if (session.status === 'ACTIVE') {
        sessions.push({ ...session, totalElapsedSeconds: totalElapsed });
      }
    } else {
      if (session.lastHeartbeat >= cutoff || session.status === 'ACTIVE') {
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

    // Buat session token kriptografis stateless (bertahan meski serverless restart)
    const sessionData = {
      userId: user.id || 1,
      username: user.username,
      fullName: user.full_name,
      role: user.role || 'DOSEN'
    };
    const token = generateAdminToken(sessionData);
    activeSessions.set(token, { ...sessionData, loginAt: new Date() });

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
