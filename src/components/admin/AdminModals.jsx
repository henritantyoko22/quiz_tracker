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

  useEffect(() => {
    if (!targetSession) return;
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

  if (!detail) return null;

  const timingsArr = Array.isArray(detail.questionTimings)
    ? detail.questionTimings
    : [];
  const maxQSec = Math.max(
    1,
    ...timingsArr.map((t) => Number(t.totalSeconds) || 0)
  );
  const events = Array.isArray(detail.activityLog)
    ? [...detail.activityLog].reverse()
    : [];
  const currentQNum = (Number(detail.currentQuestionIndex) || 0) + 1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>
              📡 Live Telemetry: {detail.nama || detail.studentName} ({detail.nim})
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Quiz #{detail.quizId} • Auto-sync aktif (2.5s)
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
                <div className="val" style={{ fontSize: '0.92rem' }}>
                  {detail.status}
                </div>
              </div>
            </div>
            <div className="stat-pill">
              <div>
                <div className="label">Sedang di Soal</div>
                <div className="val" style={{ fontSize: '0.92rem' }}>
                  #{currentQNum} / {detail.totalQuestions || '?'}
                </div>
              </div>
            </div>
            <div className="stat-pill">
              <div>
                <div className="label">Total Waktu | Sisa Waktu</div>
                <div className="val" style={{ fontSize: '0.9rem', color: '#4f46e5' }}>
                  {formatDuration(detail.totalElapsedSeconds || 0)} |{' '}
                  {detail.remainingSeconds !== null &&
                  detail.remainingSeconds !== undefined
                    ? formatDuration(detail.remainingSeconds)
                    : '-'}
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
            style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}
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
                    <div key={t.qNum || idx} style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          marginBottom: 3,
                        }}
                      >
                        <span>
                          Soal #{t.qNum || idx + 1} ({t.switchCount || 1}x buka)
                        </span>
                        <span>{formatDuration(sec)}</span>
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
                          }}
                        />
                      </div>
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
                maxHeight: 280,
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
                events.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '7px 10px',
                      borderBottom: '1px solid #e2e8f0',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong
                        style={{
                          color:
                            ev.type === 'VIOLATION'
                              ? '#dc2626'
                              : ev.type === 'SUBMITTED'
                              ? '#16a34a'
                              : '#1e293b',
                        }}
                      >
                        {ev.type}
                      </strong>
                      <span style={{ color: '#64748b', fontSize: '0.72rem' }}>
                        {ev.timestampISO
                          ? new Date(ev.timestampISO).toLocaleTimeString('id-ID')
                          : ''}
                      </span>
                    </div>
                    <div style={{ color: '#475569' }}>
                      {ev.questionText ||
                        (ev.questionNum ? `Soal #${ev.questionNum}` : '-')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
