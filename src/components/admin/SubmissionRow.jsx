import React, { useState, useEffect, memo } from 'react';
import { parseAnswersObject } from '../../services/api.js';

export const SubmissionRow = memo(function SubmissionRow({
  index,
  sub,
  role,
  onSaveGrade,
  onOpenAnswerModal,
  onOpenViolationModal,
  onOpenTimingModal,
}) {
  const [grade, setGrade] = useState(
    sub.grade !== null && sub.grade !== undefined ? sub.grade : ''
  );
  const [feedback, setFeedback] = useState(sub.feedback || '');
  const [saving, setSaving] = useState(false);

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

  return (
    <tr>
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
          <span
            className="badge badge-info"
            style={{ fontSize: '0.7rem' }}
          >
            Quiz #{sub.quiz_id}
          </span>
        </div>
      </td>
      <td>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>
          {sub.submitted_at
            ? new Date(sub.submitted_at).toLocaleString('id-ID')
            : '-'}
        </div>
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
              ⏱️ Log Waktu Soal
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
        <td className="no-print" style={{ minWidth: 220 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0-100"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={{
                width: 72,
                padding: '5px 8px',
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
              disabled={saving}
            >
              {saving ? '...' : '💾 Simpan'}
            </button>
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
