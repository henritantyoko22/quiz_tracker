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
    const fetchDetail = async () => {
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

    fetchDetail();
    return () => {
      active = false;
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

  // Format Tanggal Pelaksanaan Ujian
  const rawDate = detail.submittedAt || detail.startedAtISO || detail.quizStartTime;
  const tanggalUjian = rawDate
    ? new Date(rawDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '-';

  // Format Jam Dibukanya Kuis
  const rawOpenTime = detail.startedAtISO || detail.quizStartTime;
  const jamDibuka = rawOpenTime
    ? new Date(rawOpenTime).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB'
    : '-';

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
        style={{ maxWidth: 960, width: '95vw', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>
              📜 Log Report: {detail.nama || detail.studentName || detail.nim} ({detail.nim})
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 3 }}>
              <strong>Quiz #{detail.quizId}</strong> • Tanggal: <strong>{tanggalUjian}</strong> • Dibuka: <strong>{jamDibuka}</strong>
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
                  {Number(detail.totalElapsedSeconds) > 0 ? formatDuration(detail.totalElapsedSeconds) : '-'} |{' '}
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

          {/* SECTION 1: BREAKDOWN DURASI PER SOAL (GRID CARDS) */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: 10 }}>
              📊 Durasi Pengerjaan per Nomor Soal
            </div>
            {timingsArr.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#64748b', padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                ℹ️ Rincian durasi per nomor soal tidak terekam pada sesi ini (sesi lama hanya mencatat log pelanggaran dan waktu submit).
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                }}
              >
                {timingsArr.map((t, idx) => {
                  const sec = Number(t.totalSeconds) || 0;
                  const pct = Math.min(100, Math.round((sec / maxQSec) * 100));
                  const isCurrentActive =
                    idx === Number(detail.currentQuestionIndex) && detail.status === 'ACTIVE';

                  return (
                    <div
                      key={t.qNum || idx}
                      style={{
                        background: isCurrentActive ? '#fef2f2' : '#f8fafc',
                        border: `1px solid ${isCurrentActive ? '#fca5a5' : '#e2e8f0'}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                        boxShadow: isCurrentActive ? '0 2px 8px rgba(220, 38, 38, 0.12)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 6,
                        }}
                      >
                        <span
                          className={`badge ${isCurrentActive ? 'badge-danger' : 'badge-info'}`}
                          style={{ fontSize: '0.74rem' }}
                        >
                          Soal #{t.qNum || idx + 1} {isCurrentActive ? '● Sedang Dikerjakan' : ''}
                        </span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            color: isCurrentActive ? '#dc2626' : '#4f46e5',
                          }}
                        >
                          {formatDuration(sec)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 7,
                          background: '#e2e8f0',
                          borderRadius: 99,
                          overflow: 'hidden',
                          margin: '8px 0',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: isCurrentActive ? '#dc2626' : '#4f46e5',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#475569',
                          lineHeight: 1.4,
                          marginBottom: 6,
                          wordBreak: 'break-word',
                        }}
                      >
                        {t.qText || `Soal nomor ${t.qNum || idx + 1}`}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        🔄 Ditinjau / dibuka: <b>{t.switchCount || 1}x</b>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: TIMELINE LOG DETIK DEMI DETIK (TABLE SEPERTI HALAMAN SEBELUMNYA) */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                📜 Timeline Log Detik & Perpindahan Soal ({events.length})
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Mencatat kapan mulai, berapa detik di tiap soal, pelanggaran, dan waktu submit
              </div>
            </div>

            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    background: '#212529',
                    color: '#ffffff',
                  }}
                >
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: 44 }}>#</th>
                    <th style={{ padding: '8px 10px', width: 140 }}>Waktu Ujian</th>
                    <th style={{ padding: '8px 10px', width: 100 }}>Jam Riil</th>
                    <th style={{ padding: '8px 10px', width: 150 }}>Jenis Aktivitas</th>
                    <th style={{ padding: '8px 10px' }}>Detail Aktivitas</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                        Belum ada riwayat aktivitas yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    events.map((ev, idx) => {
                      const b = getBadgeInfo(ev.type);
                      const jamRiil = ev.timestampISO
                        ? new Date(ev.timestampISO).toLocaleTimeString('id-ID')
                        : ev.timestamp
                        ? new Date(ev.timestamp).toLocaleTimeString('id-ID')
                        : '-';
                      const elapsedText = `Detik ke-${ev.elapsedSeconds || 0} (${formatDuration(
                        ev.elapsedSeconds || 0
                      )})`;

                      let detailMsg = '';
                      if (ev.type === 'SESSION_START' || ev.type === 'START') {
                        detailMsg = `Mahasiswa resmi memulai ujian untuk kuis #${detail.quizId}.`;
                      } else if (ev.type === 'QUESTION_FOCUS') {
                        detailMsg = `Membuka dan mulai mengerjakan Soal #${ev.questionNum}: ${ev.questionText || ''}`;
                      } else if (ev.type === 'QUESTION_LEAVE') {
                        detailMsg = `Selesai sementara di Soal #${ev.questionNum}, berpindah fokus ke soal lain.`;
                      } else if (ev.type === 'QUESTION_SWITCH') {
                        detailMsg = `Berpindah fokus ke Soal #${ev.questionNum}: ${ev.questionText || ''}`;
                      } else if (ev.type === 'VIOLATION') {
                        detailMsg = ev.questionText || ev.detail || 'Terjadi pelanggaran proctoring!';
                      } else if (ev.type === 'SUBMIT' || ev.type === 'SUBMITTED') {
                        detailMsg = `Mahasiswa menyelesaikan ujian dan mengirim seluruh berkas jawaban (${detail.status || 'SUBMITTED'}).`;
                      } else if (ev.type === 'DISQUALIFIED') {
                        detailMsg = `Mahasiswa terkena diskualifikasi otomatis karena melebihi toleransi pelanggaran.`;
                      } else {
                        detailMsg = ev.questionText || ev.detail || '-';
                      }

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                          }}
                        >
                          <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                            {idx + 1}
                          </td>
                          <td style={{ color: '#4f46e5', fontWeight: 700 }}>{elapsedText}</td>
                          <td style={{ color: '#64748b' }}>{jamRiil}</td>
                          <td>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 4,
                                background: b.bg,
                                color: b.color,
                                display: 'inline-block',
                              }}
                            >
                              {b.label}
                            </span>
                          </td>
                          <td
                            style={{
                              color: ev.type === 'VIOLATION' || ev.type === 'DISQUALIFIED' ? '#dc2626' : '#1e293b',
                              fontWeight: ev.type === 'VIOLATION' ? 700 : 400,
                              lineHeight: 1.45,
                              wordBreak: 'break-word',
                            }}
                          >
                            {detailMsg}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

