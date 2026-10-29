// ==========================================
// API & HELPER UTILITIES
// ==========================================

export const API_BASE = window.location.origin;

export function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || localStorage.getItem('adminToken') || ''}`,
  };
}

export function formatDuration(sec) {
  const s = Math.max(0, Number(sec) || 0);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}m ${String(rem).padStart(2, '0')}s`;
}

export function formatCountdown(totalSec) {
  const sec = Math.max(0, Number(totalSec) || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function toLocalISOString(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function parseAnswersObject(answers) {
  if (!answers) return {};
  if (typeof answers === 'string') {
    try {
      return JSON.parse(answers);
    } catch (_) {
      return {};
    }
  }
  return typeof answers === 'object' ? answers : {};
}

