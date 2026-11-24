import React, { useState, useEffect, memo } from 'react';
import { parseAnswersObject, formatDuration } from '../../services/api.js';

export const SubmissionRow = memo(function SubmissionRow({
  index,
  sub,
  role,
  isSelected,
  onToggleSelect,
  onSaveGrade,
  onAutoGrade,
  onDelete,
  onOpenAnswerModal,
  onOpenViolationModal,
  onOpenTimingModal,
}) {
  const [grade, setGrade] = useState(
    sub.grade !== null && sub.grade !== undefined ? sub.grade : ''
  );
  const [feedback, setFeedback] = useState(sub.feedback || '');
  const [saving, setSaving] = useState(false);
  const [autoGrading, setAutoGrading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setGrade(sub.grade !== null && sub.grade !== undefined ? sub.grade : '');
    setFeedback(sub.feedback || '');
  }, [sub.grade, sub.feedback]);

  const ansObj = parseAnswersObject(sub.answers);
  const entries = Object.entries(ansObj);
  const vCount = Number(sub.violation_count) || 0;
  const maxV = Number(sub.max_violations) || 3;

  const handleSave = async () => {
    setSaving(true);
    await onSaveGrade(sub.id, grade, feedback);
    setSaving(false);
  };

  const handleAutoGrade = async () => {
    if (!onAutoGrade) return;
    setAutoGrading(true);
    await onAutoGrade(sub.id);
    setAutoGrading(false);
  };

  const handleDelete = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete(sub);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <tr style={isSelected ? { background: '#fef2f2' } : undefined}>
      {onToggleSelect && (
        <td className="no-print" style={{ width: 38, textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={Boolean(isSelected)}
            onChange={() => onToggleSelect(sub.id)}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#dc2626' }}
            title="Pilih baris ini untuk hapus massal"
          />
        </td>
      )}
      <td
        style={{
          width: 48,
          textAlign: 'center',
          fontWeight: 700,
          color: '#64748b',
          fontSize: '0.84rem',
        }}
      >
        {typeof index === 'number' ? index + 1 : '-'}
      </td>
      <td>
        <div style={{ fontWeight: 700, color: '#0f172a' }}>{sub.nama || '-'}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>NIM: {sub.nim || '-'}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          {sub.mata_kuliah && (
            <span
              className="badge"
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                background: String(sub.mata_kuliah).toUpperCase().includes('IOT')
                  ? '#e0f2fe'
                  : String(sub.mata_kuliah).toUpperCase().includes('ALGO')
                  ? '#f3e8ff'
                  : '#e0e7ff',
                color: String(sub.mata_kuliah).toUpperCase().includes('IOT')
                  ? '#0369a1'
                  : String(sub.mata_kuliah).toUpperCase().includes('ALGO')
                  ? '#7e22ce'
                  : '#4338ca',
                border: `1px solid ${
                  String(sub.mata_kuliah).toUpperCase().includes('IOT')
                    ? '#bae6fd'
                    : String(sub.mata_kuliah).toUpperCase().includes('ALGO')
                    ? '#e9d5ff'
                    : '#c7d2fe'
                }`,
              }}
            >
              {String(sub.mata_kuliah).toUpperCase().includes('IOT')
                ? '📡 IoT'
                : String(sub.mata_kuliah).toUpperCase().includes('ALGO')
                ? '🧬 Algo'
                : '⚙️ PPK'}
            </span>
          )}
          {sub.kelas && sub.kelas !== '-' && (
            <span
              className="badge badge-success"
              style={{ fontSize: '0.7rem', fontWeight: 800 }}
            >
              Kelas {sub.kelas}
            </span>
          )}
          {sub.attempt && Number(sub.attempt) > 1 && (
            <span
              className="badge badge-warning"
              style={{ fontSize: '0.7rem', fontWeight: 800 }}
            >
              🔁 Retake (Ke-{sub.attempt})
            </span>
          )}
          {sub.browser_info && (
            <span
              className="badge"
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                background: String(sub.browser_info).includes('Safari') ? '#fdf4ff' : '#eff6ff',
                color: String(sub.browser_info).includes('Safari') ? '#a21caf' : '#1d4ed8',
                border: `1px solid ${String(sub.browser_info).includes('Safari') ? '#f0abfc' : '#bfdbfe'}`,
              }}
              title={`Browser: ${sub.browser_info} (${sub.device_info || 'Device'})`}
            >
              {String(sub.browser_info).includes('Safari') ? '🧭 ' : '🌐 '}
              {sub.browser_info}
            </span>
          )}
          <span
            className="badge badge-info"
            style={{ fontSize: '0.7rem' }}
          >
            Quiz #{sub.quiz_id}
          </span>
          {(sub.location_status === 'FAKE_GPS_SPOOF' || sub.location_status === 'FAKE_GPS_DETECTED') && (
            <span
              className="badge badge-danger"
              style={{
                fontSize: '0.7rem',
                fontWeight: 900,
                background: '#dc2626',
                color: '#ffffff',
                border: '1px solid #991b1b',
                boxShadow: '0 0 8px rgba(220, 38, 38, 0.45)',
                cursor: sub.location_lat ? 'pointer' : 'default',
              }}
              title="PERINGATAN INTEGRITAS: Mahasiswa terdeteksi menggunakan Fake GPS / manipulasi lokasi!"
              onClick={(e) => {
                if (sub.location_lat && sub.location_lng) {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps?q=${sub.location_lat},${sub.location_lng}`, '_blank');
                }
              }}
            >
              🚨 FAKE GPS TERDETEKSI
            </span>
          )}
          {sub.location_status === 'VALID_CAMPUS' && (
            <span
              className="badge badge-success"
              style={{ fontSize: '0.7rem', fontWeight: 800, cursor: sub.location_lat ? 'pointer' : 'default' }}
              title={`Presensi Lokasi: Terverifikasi di area FSM Undip (~${sub.location_distance_meters || 0}m)`}
              onClick={(e) => {
                if (sub.location_lat && sub.location_lng) {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps?q=${sub.location_lat},${sub.location_lng}`, '_blank');
                }
              }}
            >
              📍 FSM Undip {sub.location_distance_meters ? `(~${sub.location_distance_meters}m)` : ''}
            </span>
          )}
          {sub.location_status === 'OUTSIDE_CAMPUS' && (
            <span
              className="badge badge-danger"
              style={{ fontSize: '0.7rem', fontWeight: 800, cursor: sub.location_lat ? 'pointer' : 'default' }}
              title={`Peringatan: Di luar area FSM Undip (~${sub.location_distance_meters || 0}m)`}
              onClick={(e) => {
                if (sub.location_lat && sub.location_lng) {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps?q=${sub.location_lat},${sub.location_lng}`, '_blank');
                }
              }}
            >
              ⚠️ Luar FSM {sub.location_distance_meters ? `(~${sub.location_distance_meters >= 1000 ? (sub.location_distance_meters/1000).toFixed(1) + 'km' : sub.location_distance_meters + 'm'})` : ''}
            </span>
          )}
        </div>
      </td>
      <td>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>
          {sub.submitted_at
            ? new Date(sub.submitted_at).toLocaleString('id-ID')
            : '-'}
        </div>
        {Number(sub.duration_seconds) > 0 && (
          <div
            style={{
              fontSize: '0.72rem',
              color: Number(sub.duration_seconds) < 60 ? '#dc2626' : '#64748b',
              fontWeight: Number(sub.duration_seconds) < 60 ? 800 : 500,
              marginTop: 2,
            }}
            title={
              Number(sub.duration_seconds) < 60
                ? 'Durasi pengerjaan sangat singkat (< 1 menit)'
                : 'Total durasi pengerjaan mahasiswa'
            }
          >
            ⏱️ {formatDuration(Number(sub.duration_seconds))}
          </div>
        )}
      </td>
      <td>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'flex-start',
          }}
        >
          <span
            className={`badge ${
              vCount >= maxV
                ? 'badge-danger'
                : vCount > 0
                ? 'badge-warn'
                : 'badge-success'
            }`}
          >
            ⚠️ {vCount} / {maxV} Pelanggaran
          </span>
          {sub.violation_summary && sub.violation_summary !== '-' && (
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {sub.violation_summary}
            </span>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {vCount > 0 && (
              <button
                type="button"
                className="btn btn-outline btn-xs btn-touchable"
                onClick={() => onOpenViolationModal(sub)}
              >
                🚨 Log Pelanggaran
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-xs btn-touchable"
              onClick={() => onOpenTimingModal(sub)}
            >
              📜 Log Report
            </button>
          </div>
        </div>
      </td>
      <td style={{ width: 280, maxWidth: 320 }}>
        {entries.length === 0 ? (
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Tidak ada jawaban
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              className="answer-preview-box"
              title="Klik untuk membuka baca jawaban lengkap"
              onClick={() => onOpenAnswerModal(sub, entries)}
            >
              {entries.slice(0, 2).map(([q, a], idx) => (
                <div key={q} className="answer-preview-line">
                  <strong style={{ color: '#0f172a' }}>Soal #{idx + 1}:</strong>{' '}
                  {String(a || '').replace(/[\r\n]+/g, ' ')}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-xs btn-touchable"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.74rem' }}
              onClick={() => onOpenAnswerModal(sub, entries)}
            >
              📖 Baca Lengkap ({entries.length} Soal)
            </button>
          </div>
        )}
      </td>
      <td>
        <span
          className={`badge ${
            sub.status === 'DISQUALIFIED'
              ? 'badge-danger'
              : sub.status === 'TIME_EXPIRED'
              ? 'badge-warn'
              : 'badge-success'
          }`}
          style={{ fontSize: '0.76rem', fontWeight: 700 }}
        >
          {sub.status === 'DISQUALIFIED'
            ? '❌ Diskualifikasi'
            : sub.status === 'TIME_EXPIRED'
            ? '⏰ Waktu Habis'
            : '✅ Selesai Mandiri'}
        </span>
        {sub.grade !== null && sub.grade !== undefined && (
          <div
            style={{
              marginTop: 4,
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#15803d',
            }}
          >
            Nilai: {sub.grade}
          </div>
        )}
      </td>
      {role !== 'PROCTOR' && (
        <td className="no-print" style={{ minWidth: 235 }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0-100"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={{
                width: 66,
                padding: '5px 7px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            />
            <button
              type="button"
              className="btn btn-success btn-xs"
              onClick={handleSave}
              disabled={saving || autoGrading || deleting}
            >
              {saving ? '...' : '💾 Simpan'}
            </button>
            {onAutoGrade && (
              <button
                type="button"
                className="btn btn-xs"
                style={{ background: '#7c3aed', color: '#ffffff' }}
                onClick={handleAutoGrade}
                disabled={saving || autoGrading || deleting}
                title="Evaluasi otomatis jawaban ini menggunakan Gemini AI"
              >
                {autoGrading ? '⏳ AI...' : '⚡ AI'}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="btn btn-danger btn-xs"
                onClick={handleDelete}
                disabled={saving || autoGrading || deleting}
                title="Hapus submission mahasiswa ini (misal mengerjakan asal-asalan)"
                style={{ padding: '5px 8px' }}
              >
                {deleting ? '⏳' : '🗑️'}
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Catatan dosen..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            style={{
              width: '100%',
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: '0.76rem',
            }}
          />
        </td>
      )}
    </tr>
  );
});
