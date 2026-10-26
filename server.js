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

app.listen(PORT, () => {
  console.log(`Server API berjalan di port ${PORT}`);
});