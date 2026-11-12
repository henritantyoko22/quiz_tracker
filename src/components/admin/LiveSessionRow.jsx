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
          {(session.locationStatus === 'FAKE_GPS_SPOOF' || session.locationStatus === 'FAKE_GPS_DETECTED') && (
            <span
              className="badge badge-danger"
              style={{
                fontSize: '0.68rem',
                fontWeight: 900,
                background: '#dc2626',
                color: '#ffffff',
                border: '1px solid #991b1b',
                boxShadow: '0 0 8px rgba(220, 38, 38, 0.45)',
                cursor: session.locationLat ? 'pointer' : 'default',
              }}
              title="PERINGATAN INTEGRITAS: Mahasiswa terdeteksi menggunakan Fake GPS / Mock Location!"
              onClick={(e) => {
                if (session.locationLat && session.locationLng) {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps?q=${session.locationLat},${session.locationLng}`, '_blank');
                }
              }}
            >
              🚨 FAKE GPS TERDETEKSI
            </span>
          )}
          {session.locationStatus === 'VALID_CAMPUS' && (
            <span
              className="badge badge-success"
              style={{ fontSize: '0.68rem', fontWeight: 800, cursor: session.locationLat ? 'pointer' : 'default' }}
              title={`Presensi Lokasi: Terverifikasi di area FSM Undip (~${session.locationDistance || 0}m)`}
              onClick={(e) => {
                if (session.locationLat && session.locationLng) {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps?q=${session.locationLat},${session.locationLng}`, '_blank');
                }
              }}
            >
              📍 FSM Undip {session.locationDistance ? `(~${session.locationDistance}m)` : ''}
            </span>
          )}
          {session.locationStatus === 'OUTSIDE_CAMPUS' && (
            <span
              className="badge badge-danger"
              style={{ fontSize: '0.68rem', fontWeight: 800, cursor: session.locationLat ? 'pointer' : 'default' }}
              title={`Peringatan: Terdeteksi di luar area FSM Undip (~${session.locationDistance || 0}m)`}
              onClick={(e) => {
                if (session.locationLat && session.locationLng) {
                  e.stopPropagation();
                  window.open(`https://www.google.com/maps?q=${session.locationLat},${session.locationLng}`, '_blank');
                }
              }}
            >
              ⚠️ Luar FSM {session.locationDistance ? `(~${session.locationDistance >= 1000 ? (session.locationDistance/1000).toFixed(1) + 'km' : session.locationDistance + 'm'})` : ''}
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
