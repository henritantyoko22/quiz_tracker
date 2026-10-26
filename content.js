// Konfigurasi Default Extension
const API_URL = 'https://quiz-tracker-seven.vercel.app/v1/violations';
const USER_ID = (typeof localStorage !== 'undefined' && localStorage.getItem('user_id')) || 'MHS_' + Math.floor(1000 + Math.random() * 9000);
const QUIZ_ID = (typeof localStorage !== 'undefined' && localStorage.getItem('quiz_id')) || 'QUIZ_GENERAL';

// Tambahkan fungsi penyimpanan lokal di dalam content.js
function saveLocalViolation(violation) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ violations: [] }, (result) => {
      const updatedList = [violation, ...result.violations].slice(0, 50); // Simpan maksimal 50 log terbaru
      chrome.storage.local.set({ violations: updatedList });
    });
  }
}

// Sesuaikan fungsi sendViolationLog
async function sendViolationLog(violationType, detailText = '') {
  const payload = {
    userId: USER_ID,
    quizId: QUIZ_ID,
    type: violationType,
    detail: detailText,
    timestamp: new Date().toISOString(),
    url: window.location.href
  };

  // Simpan ke storage lokal browser
  saveLocalViolation(payload);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    console.log(`[Quiz Tracker] Log dikirim (${violationType}):`, result);
  } catch (error) {
    console.error('[Quiz Tracker] Gagal mengirim log ke server:', error);
  }
}