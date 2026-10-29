import React, { useState, useEffect } from 'react';
import { API_BASE, getAuthHeaders, formatDuration } from '../../services/api.js';

export function AnswerReaderModal({ modalData, onClose }) {
  if (!modalData) return null;
  const { sub, entries } = modalData;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>
              📖 Jawaban Mahasiswa: {sub.nama} ({sub.nim})
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Quiz ID: #{sub.quiz_id} • Disubmit:{' '}
              {sub.submitted_at
                ? new Date(sub.submitted_at).toLocaleString('id-ID')
                : '-'}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm btn-touchable"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ✕ Tutup
          </button>
        </div>
        <div
          className="modal-body"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {entries.map(([qKey, ans], idx) => (
            <div
              key={qKey}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  color: '#4f46e5',
                  marginBottom: 6,
                }}
              >
                Soal #{idx + 1} ({qKey})
              </div>
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.9rem',
                  color: '#1e293b',
                  lineHeight: 1.55,
                }}
              >
                {String(ans || '-')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ViolationLogModal({ sub, token, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sub) return;
    let active = true;
    setLoading(true);
    fetch(
      `${API_BASE}/v1/admin/violations/detail?userId=${encodeURIComponent(
        sub.nama || ''
      )}&nim=${encodeURIComponent(sub.nim || '')}&quizId=${encodeURIComponent(
        sub.quiz_id || ''
      )}`,
      { headers: getAuthHeaders(token) }
    )
      .then((r) => r.json())
      .then((res) => {
        if (active && res.status === 'success' && Array.isArray(res.data)) {
          setLogs(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sub, token]);

  if (!sub) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>
              ⚠️ Log Pelanggaran: {sub.nama} ({sub.nim})
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Total Pelanggaran: {sub.violation_count || 0} / {sub.max_violations || 3}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm btn-touchable"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ✕ Tutup
          </button>
        </div>
        <div
          className="modal-body"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {loading ? (
            <div className="empty-state">⏳ Memuat rincian pelanggaran...</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">Tidak ada rincian log di tabel pelanggaran.</div>
          ) : (
            logs.map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#991b1b' }}>
                  #{idx + 1} • {item.violation_type || 'VIOLATION'}
                </div>
                <div style={{ color: '#7f1d1d' }}>{item.detail || '-'}</div>
                <div style={{ fontSize: '0.72rem', color: '#991b1b', marginTop: 2 }}>
                  {item.occurred_at
                    ? new Date(item.occurred_at).toLocaleString('id-ID')
                    : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function LiveDetailModal({ targetSession, token, onClose }) {
  const [detail, setDetail] = useState(targetSession);

  // Close on Escape key
  useEffect(() => {
    if (!targetSession) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetSession, onClose]);

  useEffect(() => {
    if (!targetSession) {
      setDetail(null);
      return;
    }
    setDetail(targetSession);

    let active = true;
    const pollDetail = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/v1/admin/live/sessions/${encodeURIComponent(
            targetSession.nim
          )}/${encodeURIComponent(targetSession.quizId)}`,
          { headers: getAuthHeaders(token) }
        );
        const data = await res.json();
        if (active && res.ok && data.data) {
          setDetail(data.data);
        }
      } catch (_) {}
    };

    pollDetail();
    const interval = setInterval(pollDetail, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [targetSession, token]);

  if (!targetSession || !detail) return null;

  const parseArray = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  };

  const timingsArr = parseArray(detail.questionTimings);
  const maxQSec = Math.max(
    1,
    ...timingsArr.map((t) => Number(t.totalSeconds) || 0)
  );

  const rawEvents = parseArray(detail.activityLog);
  // Tampilkan timeline kronologis terbalik (terbaru di atas)
  const events = [...rawEvents].reverse();
  const currentQNum = (Number(detail.currentQuestionIndex) || 0) + 1;

  const getBadgeInfo = (type) => {
    switch (type) {
      case 'SESSION_START':
      case 'START':
        return { label: '🟢 Mulai Ujian', bg: '#dcfce7', color: '#166534' };
      case 'QUESTION_FOCUS':
        return { label: '🔵 Buka Soal', bg: '#e0e7ff', color: '#3730a3' };
      case 'QUESTION_LEAVE':
        return { label: '⚪ Tinggalkan Soal', bg: '#f1f5f9', color: '#475569' };
      case 'QUESTION_SWITCH':
        return { label: '🔄 Pindah Soal', bg: '#fef3c7', color: '#92400e' };
      case 'VIOLATION':
        return { label: '🚨 Pelanggaran', bg: '#fee2e2', color: '#991b1b' };
      case 'DISQUALIFIED':
        return { label: '❌ Diskualifikasi', bg: '#fef2f2', color: '#b91c1c' };
      case 'SUBMIT':
      case 'SUBMITTED':
        return { label: '🏁 Selesai Submit', bg: '#dbeafe', color: '#1e40af' };
      default:
        return { label: type || 'EVENT', bg: '#f1f5f9', color: '#334155' };
    }
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDetail(null);
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 9999 }}
      onClick={handleClose}
    >
      <div
        className="modal-card"
        style={{ maxWidth: 840 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>
              📡 Live Telemetry: {detail.nama || detail.studentName || detail.nim} ({detail.nim})
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Quiz #{detail.quizId} • Auto-sync aktif (2.5s)
            </div>
          </div>
          <button
            type="button"
            id="btn-close-live-detail"
            className="btn btn-outline btn-sm btn-touchable"
            style={{ cursor: 'pointer', zIndex: 10, fontWeight: 700 }}
            onClick={handleClose}
          >
            ✕ Tutup
          </button>
        </div>
        <div className="modal-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div className="stat-pill">
              <div>
                <div className="label">Status Sesi</div>
                <div className="val" style={{ fontSize: '0.88rem' }}>
                  <span
                    className={`badge ${
                      detail.status === 'ACTIVE'
                        ? 'badge-success'
                        : detail.status === 'DISQUALIFIED'
                        ? 'badge-danger'
                        : 'badge-info'
                    }`}
                  >
                    {detail.status || 'SUBMITTED'}
                  </span>
                </div>
              </div>
            </div>
            <div className="stat-pill">
              <div>
                <div className="label">Soal / Progres</div>
                <div className="val" style={{ fontSize: '0.92rem' }}>
                  {detail.status === 'ACTIVE'
                    ? `#${currentQNum} / ${detail.totalQuestions || '?'}`
                    : `Selesai (${detail.totalQuestions || timingsArr.length || '?'} Soal)`}
                </div>
              </div>
            </div>
            <div className="stat-pill">
              <div>
                <div className="label">Total Waktu | Sisa Waktu</div>
                <div className="val" style={{ fontSize: '0.88rem', color: '#4f46e5' }}>
                  {formatDuration(detail.totalElapsedSeconds || 0)} |{' '}
                  {detail.status === 'ACTIVE' &&
                  detail.remainingSeconds !== null &&
                  detail.remainingSeconds !== undefined
                    ? formatDuration(detail.remainingSeconds)
                    : '0m 00s'}
                </div>
              </div>
            </div>
            <div className="stat-pill">
              <div>
                <div className="label">Pelanggaran</div>
                <div
                  className="val"
                  style={{
                    fontSize: '0.92rem',
                    color: (detail.violationCount || 0) > 0 ? '#dc2626' : '#16a34a',
                  }}
                >
                  {detail.violationCount || 0}x
                </div>
              </div>
            </div>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 16 }}
          >
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 14,
                background: '#f8fafc',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: 10 }}>
                ⏱️ Durasi Pengerjaan per Nomor Soal
              </div>
              {timingsArr.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Belum ada data durasi per soal.
                </div>
              ) : (
                timingsArr.map((t, idx) => {
                  const sec = Number(t.totalSeconds) || 0;
                  const pct = Math.min(100, Math.round((sec / maxQSec) * 100));
                  return (
                    <div key={t.qNum || idx} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          marginBottom: 3,
                        }}
                      >
                        <span style={{ color: '#1e293b' }}>
                          Soal #{t.qNum || idx + 1}
                          <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 4 }}>
                            ({t.switchCount || 1}x dibuka)
                          </span>
                        </span>
                        <span style={{ color: '#4f46e5', fontWeight: 700 }}>
                          {formatDuration(sec)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 7,
                          background: '#e2e8f0',
                          borderRadius: 99,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: '#4f46e5',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      {t.qText && (
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: '#64748b',
                            marginTop: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={t.qText}
                        >
                          {t.qText}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 14,
                background: '#f8fafc',
                maxHeight: 340,
                overflowY: 'auto',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: 10 }}>
                📜 Timeline Aktivitas Mahasiswa ({events.length})
              </div>
              {events.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Belum ada log aktivitas.
                </div>
              ) : (
                events.map((ev, idx) => {
                  const b = getBadgeInfo(ev.type);
                  const jamRiil = ev.timestampISO
                    ? new Date(ev.timestampISO).toLocaleTimeString('id-ID')
                    : ev.timestamp
                    ? new Date(ev.timestamp).toLocaleTimeString('id-ID')
                    : '';
                  const elapsedText = `Detik ke-${ev.elapsedSeconds || 0} (${formatDuration(
                    ev.elapsedSeconds || 0
                  )})`;

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 10px',
                        borderBottom: '1px solid #e2e8f0',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: b.bg,
                            color: b.color,
                          }}
                        >
                          {b.label}
                        </span>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          <span style={{ fontWeight: 600, color: '#4f46e5', marginRight: 6 }}>
                            {elapsedText}
                          </span>
                          <span>{jamRiil}</span>
                        </div>
                      </div>
                      <div
                        style={{
                          color: '#1e293b',
                          fontSize: '0.78rem',
                          lineHeight: 1.4,
                          marginTop: 3,
                        }}
                      >
                        {ev.questionText || ev.detail || (ev.questionNum ? `Soal #${ev.questionNum}` : '-')}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
