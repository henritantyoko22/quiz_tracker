import React, { memo } from 'react';
import { formatDuration } from '../../services/api.js';

export const LiveSessionRow = memo(function LiveSessionRow({ index, session, onViewDetail }) {
  const isStale = Date.now() - (session.lastHeartbeat || 0) > 20000;
  const isOnline = session.status === 'ACTIVE' && !isStale;

  const statusClass =
    session.status === 'DISQUALIFIED'
      ? 'badge-danger'
      : session.status === 'SUBMITTED' || session.status === 'COMPLETED'
      ? 'badge-info'
      : session.status === 'TIME_EXPIRED'
      ? 'badge-warn'
      : isOnline
      ? 'badge-success'
      : 'badge-warn';

  const statusLabel =
    session.status === 'DISQUALIFIED'
      ? 'DISKUALIFIKASI'
      : session.status === 'SUBMITTED' || session.status === 'COMPLETED'
      ? 'SELESAI SUBMIT'
      : session.status === 'TIME_EXPIRED'
      ? 'WAKTU HABIS'
      : isOnline
      ? 'ONLINE MENGERJAKAN'
      : 'IDLE / OFFLINE';

  const currentQNum = (Number(session.currentQuestionIndex) || 0) + 1;

  return (
    <tr onClick={() => onViewDetail(session)} style={{ cursor: 'pointer' }}>
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
        <div style={{ fontWeight: 700, color: '#0f172a' }}>
          {session.nama || session.studentName || '-'}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>NIM: {session.nim}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {session.kelas && session.kelas !== '-' && (
            <span
              className="badge badge-success"
              style={{ fontSize: '0.68rem', fontWeight: 800 }}
            >
              Kelas {session.kelas}
            </span>
          )}
          {session.attempt && Number(session.attempt) > 1 && (
            <span
              className="badge badge-warning"
              style={{ fontSize: '0.68rem', fontWeight: 800 }}
            >
              🔁 Retake {session.attempt}
            </span>
          )}
        </div>
      </td>
      <td>
        <span className="badge badge-info">Quiz #{session.quizId}</span>
      </td>
      <td>
        <span className={`badge ${statusClass}`}>
          <span
            className={`live-dot ${isOnline ? 'online' : 'offline'}`}
            style={{ marginRight: 5 }}
          />
          {statusLabel}
        </span>
      </td>
      <td>
        <span className="badge badge-neutral">
          Soal #{currentQNum} / {session.totalQuestions || '?'}
        </span>
      </td>
      <td>
        <div style={{ fontWeight: 700, color: '#0f172a' }}>
          ⏱️ {formatDuration(session.totalElapsedSeconds || 0)}
        </div>
        <div
          style={{
            fontSize: '0.74rem',
            fontWeight: 600,
            color:
              session.remainingSeconds !== null && session.remainingSeconds <= 60
                ? '#dc2626'
                : '#4f46e5',
          }}
        >
          ⏳ Sisa:{' '}
          {session.remainingSeconds !== null && session.remainingSeconds !== undefined
            ? formatDuration(session.remainingSeconds)
            : '-'}
        </div>
      </td>
      <td>
        <span
          className={`badge ${
            (session.violationCount || 0) > 2
              ? 'badge-danger'
              : (session.violationCount || 0) > 0
              ? 'badge-warn'
              : 'badge-success'
          }`}
        >
          ⚠️ {session.violationCount || 0}x
        </span>
      </td>
      <td>
        <button
          type="button"
          className="btn btn-outline btn-xs"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetail(session);
          }}
        >
          🔍 Detail Log
        </button>
      </td>
    </tr>
  );
});
