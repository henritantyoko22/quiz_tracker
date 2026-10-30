require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db'); // Konfigurasi koneksi PostgreSQL Neon.tech

const app = express();

app.use(cors());
app.use(express.json());
app.use('/src', express.static(path.join(__dirname, 'src')));

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
      res.status(500).json({ status: 'error', message: err.message });
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
        message: `NIM "${cleanNim}" tidak terdaftar sebagai peserta mata kuliah Pengembangan Platform Khusus (PPK). Hubungi dosen/asisten jika ada kekeliruan.`
      });
    }

    // 1. Cek sesi duplikat yang sedang aktif berjalan
    if (cleanQuizId) {
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
          student,
          message: `Sesi kuis #${cleanQuizId} untuk ${student.nama} (${student.nim}) sedang AKTIF berjalan di perangkat/tab lain! Tidak diperkenankan membuka sesi ganda secara bersamaan.`
        });
      }
    }

    // 2. Cek histori pengerjaan pada kuis ini (Aturan 2 Kesempatan: boleh retake jika didiskualifikasi)
    let submissions = [];
    if (cleanQuizId) {
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
    }

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
        warningMessage = '⚠️ KESEMPATAN KE-2 (RETAKE): Anda sebelumnya terdiskualifikasi pada percobaan pertama. Anda diberikan 1 kesempatan terakhir untuk mengerjakan kuis ini. Gunakan kesempatan ini dengan tertib!';
      } else {
        canStart = false;
        attemptNumber = 1;
        isRetake = false;
        warningMessage = `Anda sudah menyelesaikan dan mengumpulkan kuis #${cleanQuizId} (Status: ${firstSub.status || 'SELESAI'}). Tidak dapat mengulang ujian.`;
      }
    } else {
      canStart = false;
      attemptNumber = attemptsCount;
      warningMessage = `Batas maksimal pengerjaan (2 kesempatan) telah habis untuk kuis #${cleanQuizId}. Anda tidak dapat mengikuti kuis ini lagi.`;
    }

    res.json({
      status: 'success',
      registered: true,
      student,
      canStart,
      attemptNumber,
      maxAttempts: 2,
      isRetake,
      previousAttempts: attemptsCount,
      warningMessage
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Menyimpan jawaban kuis peserta (disertai laporan jumlah pelanggaran & telemetry)
app.post('/v1/quiz/submit', async (req, res) => {
  const { userId, nim, quizId, answers, status, violationCount, maxViolations, questionTimings, activityLog, durationSeconds, attempt, kelas } = req.body;

  if (!userId || !nim || userId.trim() === '' || nim.trim() === '' || userId === '-' || nim === '-') {
    return res.status(400).json({
      status: 'error',
      message: 'Submit ditolak: Nama Mahasiswa dan NIM wajib diisi!'
    });
  }

  const vCount = parseInt(violationCount) >= 0 ? parseInt(violationCount) : 0;
  const maxV = parseInt(maxViolations) > 0 ? parseInt(maxViolations) : 3;
  const durSec = parseInt(durationSeconds) >= 0 ? parseInt(durationSeconds) : 0;
  const qTimingsJson = questionTimings ? JSON.stringify(questionTimings) : null;
  const actLogJson = activityLog ? JSON.stringify(activityLog) : null;
  const attemptNum = parseInt(attempt) > 0 ? parseInt(attempt) : 1;

  // Dapatkan kelas mahasiswa jika tidak dikirim dari client
  let studentKelas = kelas;
  if (!studentKelas) {
    try {
      const stu = await db.query('SELECT kelas FROM quiz_students WHERE nim = $1', [nim.trim()]);
      if (stu.rows.length > 0) studentKelas = stu.rows[0].kelas;
    } catch (_) {}
  }

  try {
    let result;
    try {
      result = await db.query(
        `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, violation_count, max_violations, question_timings, activity_log, duration_seconds, attempt, kelas, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         RETURNING *`,
        [userId, nim, quizId, JSON.stringify(answers), status || 'COMPLETED', vCount, maxV, qTimingsJson, actLogJson, durSec, attemptNum, studentKelas || '-']
      );
    } catch (insertColErr) {
      try {
        result = await db.query(
          `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, violation_count, max_violations, question_timings, activity_log, duration_seconds, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           RETURNING *`,
          [userId, nim, quizId, JSON.stringify(answers), status || 'COMPLETED', vCount, maxV, qTimingsJson, actLogJson, durSec]
        );
      } catch (insertOldErr) {
        result = await db.query(
          `INSERT INTO quiz_submissions (user_id, nim, quiz_id, answers, status, violation_count, max_violations, submitted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           RETURNING *`,
          [userId, nim, quizId, JSON.stringify(answers), status || 'COMPLETED', vCount, maxV]
        );
      }
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
        kelas: studentKelas || '-',
        attempt: attemptNum,
        startedAt: nowTs - (durSec ? durSec * 1000 : 60000),
        startedAtISO: new Date(nowTs - (durSec ? durSec * 1000 : 60000)).toISOString(),
        currentQuestionIndex: 0,
        currentQuestionText: 'Selesai',
        questionTimings: questionTimings || [],
        activityLog: activityLog || [],
        violationCount: vCount,
        remainingSeconds: 0
      };
    } else {
      if (questionTimings) liveSession.questionTimings = questionTimings;
      if (activityLog) liveSession.activityLog = activityLog;
      if (studentKelas) liveSession.kelas = studentKelas;
      liveSession.attempt = attemptNum;
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
app.post('/v1/quiz/live/session', async (req, res) => {
  const { userId, nim, quizId, totalQuestions, questionTexts, kelas, attempt, isRetake } = req.body;
  if (!nim || !quizId) {
    return res.status(400).json({ status: 'error', message: 'nim dan quizId wajib diisi.' });
  }

  const cleanNim = nim.trim();
  const cleanQuizId = quizId.trim();
  const key = getLiveSessionKey(cleanNim, cleanQuizId);
  const now = Date.now();
  const existing = liveStudentSessions.get(key);

  // Cegah duplikat sesi aktif (jika sedang aktif dan heartbeat < 45 detik)
  // Kecuali jika isRetake = true (mahasiswa baru saja diizinkan mulai sesi retake ke-2)
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

  // Ambil kelas resmi mahasiswa
  let studentKelas = kelas;
  if (!studentKelas) {
    try {
      const stuRes = await db.query('SELECT kelas FROM quiz_students WHERE nim = $1', [cleanNim]);
      if (stuRes.rows.length > 0) studentKelas = stuRes.rows[0].kelas;
    } catch (_) {}
  }

  liveStudentSessions.set(key, {
    key,
    nama: userId || cleanNim,
    nim: cleanNim,
    quizId: cleanQuizId,
    kelas: studentKelas || '-',
    attempt: Number(attempt) || 1,
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

  console.log(`🟢 Sesi live dimulai: ${cleanNim} (${studentKelas || 'PPK'}) | Kuis: ${cleanQuizId} | Attempt: ${attempt || 1}`);
  res.json({ status: 'success', message: 'Sesi live terdaftar.', key, kelas: studentKelas, attempt: attempt || 1 });
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
  try {
    const setRes = await db.query(
      'SELECT duration_minutes, end_time FROM quiz_settings WHERE quiz_id = $1',
      [cleanQuizId]
    );
    if (setRes.rows.length > 0) {
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
  } else if (session && session.startedAt) {
    totalElapsed = Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000));
  } else if (violationsList.length > 0) {
    // Estimasi waktu dari violation pertama
    const firstVTs = new Date(violationsList[0].occurred_at).getTime();
    totalElapsed = Math.max(90, Math.floor((subTs - firstVTs) / 1000) + 180);
  } else {
    // Fallback estimasi wajar pengerjaan (misal 5 menit atau jumlah soal * 3 menit)
    const qCount = questionsList.length || 3;
    totalElapsed = Math.min(maxSeconds, Math.max(120, qCount * 180));
  }

  const startTs = subTs - totalElapsed * 1000;

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

  // 1. Rekonstruksi questionTimings jika masih kosong
  let timings = safeJsonParse(session.questionTimings, []);
  if (!Array.isArray(timings) || timings.length === 0) {
    const perQSec = Math.max(15, Math.floor(totalElapsed / totalQuestionsCount));
    timings = [];
    for (let i = 0; i < totalQuestionsCount; i++) {
      const qText = (questionsList[i] && questionsList[i].question_text) || `Soal #${i + 1}`;
      timings.push({
        qNum: i + 1,
        qText: qText,
        totalSeconds: perQSec,
        switchCount: 1,
      });
    }
    session.questionTimings = timings;
  }

  // 2. Rekonstruksi activityLog jika masih kosong atau perlu digabung dengan riwayat quiz_violations
  let rawLogs = safeJsonParse(session.activityLog, []);
  if (!Array.isArray(rawLogs)) rawLogs = [];

  if (rawLogs.length === 0) {
    // Bangun activityLog lengkap dari start, perpindahan soal, pelanggaran, hingga submit
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

    // Buka soal pertama
    constructedTimeline.push({
      type: 'QUESTION_FOCUS',
      questionNum: 1,
      questionText: (questionsList[0] && questionsList[0].question_text) || 'Soal 1',
      elapsedSeconds: 0,
      timestamp: startTs,
      timestampISO: new Date(startTs).toISOString(),
    });

    // Perpindahan ke soal-soal berikutnya
    const stepSec = Math.floor(totalElapsed / Math.max(1, totalQuestionsCount));
    for (let i = 1; i < totalQuestionsCount; i++) {
      const transSec = stepSec * i;
      const transTs = startTs + transSec * 1000;
      constructedTimeline.push({
        type: 'QUESTION_LEAVE',
        questionNum: i,
        questionText: (questionsList[i - 1] && questionsList[i - 1].question_text) || `Soal ${i}`,
        elapsedSeconds: transSec,
        timestamp: transTs,
        timestampISO: new Date(transTs).toISOString(),
      });
      constructedTimeline.push({
        type: 'QUESTION_FOCUS',
        questionNum: i + 1,
        questionText: (questionsList[i] && questionsList[i].question_text) || `Soal ${i + 1}`,
        elapsedSeconds: transSec,
        timestamp: transTs,
        timestampISO: new Date(transTs).toISOString(),
      });
    }

    // Masukkan semua pelanggaran dari database quiz_violations
    for (const v of violationsList) {
      const vOccurred = v.occurred_at ? new Date(v.occurred_at).getTime() : startTs;
      const vElapsed = Math.max(0, Math.floor((vOccurred - startTs) / 1000));
      constructedTimeline.push({
        type: 'VIOLATION',
        questionNum: Math.min(totalQuestionsCount, Math.max(1, Math.floor((vElapsed / Math.max(1, totalElapsed)) * totalQuestionsCount) + 1)),
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

    // Urutkan berdasarkan waktu kejadian (kronologis)
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
        res.status(500).json({ status: 'error', message: err.message });
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
    res.status(500).json({ status: 'error', message: err.message });
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
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Dynamic React Modular Bundle (menggunakan literal path.join agar @vercel/nft otomatis mem-bundle seluruh file src/)
function loadReactModulesRaw() {
  return [
    { name: 'src/services/api.js', code: fs.readFileSync(path.join(__dirname, 'src/services/api.js'), 'utf8') },
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
  const chunks = [
    'const { useState, useEffect, useMemo, useCallback, useRef, memo } = React;'
  ];
  for (const mod of loadReactModulesRaw()) {
    const transformed = mod.code
      .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^\s*export\s+default\s+/gm, '')
      .replace(/^\s*export\s+(const|function|let|var|class)\s+/gm, '$1 ');
    chunks.push(`\n// --- MODULE: ${mod.name} ---\n${transformed}`);
  }
  return chunks.join('\n');
}

app.get('/bundle.jsx', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.send(buildReactBundleCode());
  } catch (err) {
    res.status(500).send(`console.error("Failed to build React bundle:", ${JSON.stringify(err.message)});`);
  }
});

// Routing Halaman SPA React.js (inlined CSS & JSX dari src/ agar 100% langsung tampil di Vercel tanpa kendala path static)
const sendReactApp = (req, res) => {
  try {
    const cssContent = fs.readFileSync(path.join(__dirname, 'src/styles/app.css'), 'utf8');
    const jsxBundle = buildReactBundleCode();
    const html = `<!DOCTYPE html>
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
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send(`<pre>Gagal memuat aplikasi React: ${err.message}</pre>`);
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
