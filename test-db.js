require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    console.log('Testing koneksi ke Neon.tech...');
    const res = await pool.query('SELECT NOW()');
    console.log('✅ KONEKSI BERHASIL! Waktu server:', res.rows[0].now);
  } catch (err) {
    console.error('❌ KONEKSI GAGAL:', err.message);
  } finally {
    await pool.end();
  }
}

testConnection();