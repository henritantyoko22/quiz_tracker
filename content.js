// URL API Backend Vercel
const API_URL = 'https://quiz-tracker-seven.vercel.app/v1/violations';

// Identitas Siswa & Kuis (Dinamis dari localStorage atau fallback default)
const USER_ID = localStorage.getItem('user_id') || 'MHS_' + Math.floor(1000 + Math.random() * 9000);
const QUIZ_ID = localStorage.getItem('quiz_id') || 'QUIZ_GENERAL';

// -------------------------------------------------------------
// FITUR NOTIFIKASI ALERT DI HALAMAN WEB
// -------------------------------------------------------------
function showViolationAlert(type, detail) {
  // Hapus alert lama jika masih ada
  const existingAlert = document.getElementById('quiz-violation-alert-toast');
  if (existingAlert) existingAlert.remove();

  // Buat elemen alert toast
  const alertBox = document.createElement('div');
  alertBox.id = 'quiz-violation-alert-toast';
  
  // Styling CSS langsung via JavaScript
  Object.assign(alertBox.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    backgroundColor: '#dc3545',
    color: '#ffffff',
    padding: '14px 20px',
    borderRadius: '8px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    zIndex: '999999',
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px',
    lineHeight: '1.4',
    maxWidth: '320px',
    borderLeft: '6px solid #842029',
    animation: 'fadeInSlide 0.3s ease-out'
  });

  // Isi teks peringatan
  alertBox.innerHTML = `
    <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
      ⚠️ PERINGATAN PELANGGARAN!
    </div>
    <div>Tindakan <u style="text-transform: uppercase;">${type.replace('_', ' ')}</u> terdeteksi.</div>
    <div style="font-size: 11px; opacity: 0.9; margin-top: 4px;">${detail}</div>
  `;

  // Tambahkan animasi fade-in via CSS style tag
  if (!document.getElementById('quiz-alert-style')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'quiz-alert-style';
    styleTag.textContent = `
      @keyframes fadeInSlide {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(styleTag);
  }

  document.body.appendChild(alertBox);

  // Otomatis hilangkan notifikasi setelah 4 detik
  setTimeout(() => {
    if (alertBox.parentNode) {
      alertBox.style.opacity = '0';
      alertBox.style.transition = 'opacity 0.5s ease';
      setTimeout(() => alertBox.remove(), 500);
    }
  }, 4000);
}

// -------------------------------------------------------------
// PENYIMPANAN LOCAL STORAGE & PENGIRIMAN API
// -------------------------------------------------------------
function saveLocalViolation(violation) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ violations: [] }, (result) => {
      const updatedList = [violation, ...result.violations].slice(0, 50);
      chrome.storage.local.set({ violations: updatedList });
    });
  }
}

async function sendViolationLog(violationType, detailText = '') {
  const payload = {
    userId: USER_ID,
    quizId: QUIZ_ID,
    type: violationType,
    detail: detailText,
    timestamp: new Date().toISOString(),
    url: window.location.href
  };

  // 1. Tampilkan notifikasi peringatan langsung di layar
  showViolationAlert(violationType, detailText);

  // 2. Simpan ke storage lokal
  saveLocalViolation(payload);

  // 3. Kirim ke API Vercel
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    console.log(