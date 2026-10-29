import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE, getAuthHeaders } from '../services/api.js';
import { SubmissionRow } from '../components/admin/SubmissionRow.jsx';
import { LiveSessionRow } from '../components/admin/LiveSessionRow.jsx';
import { UnifiedQuizManager } from '../components/admin/UnifiedQuizManager.jsx';
import { UserManager } from '../components/admin/UserManager.jsx';
import {
  AnswerReaderModal,
  ViolationLogModal,
  LiveDetailModal,
} from '../components/admin/AdminModals.jsx';

export function AdminDashboardPage() {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '');
  const [role, setRole] = useState(
    () => (localStorage.getItem('adminRole') || 'DOSEN').toUpperCase()
  );
  const [username, setUsername] = useState(
    () => localStorage.getItem('adminUser') || ''
  );

  // Login form state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Active Tab: SUBMISSIONS | LIVE | QUIZZES | USERS
  const [activeTab, setActiveTab] = useState('SUBMISSIONS');

  // Data States
  const [submissions, setSubmissions] = useState([]);
  const [quizList, setQuizList] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Simplified Single-Row Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [quizFilter, setQuizFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Toasts
  const [answerModal, setAnswerModal] = useState(null);
  const [violationModal, setViolationModal] = useState(null);
  const [liveDetailModal, setLiveDetailModal] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminUser');
    setToken('');
    setRole('');
    setUsername('');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        const userRole = ((data.user && data.user.role) || data.role || 'DOSEN').toUpperCase();
        const userName =
          (data.user && (data.user.fullName || data.user.username)) ||
          data.username ||
          loginUser;
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminRole', userRole);
        localStorage.setItem('adminUser', userName);
        setToken(data.token);
        setRole(userRole);
        setUsername(userName);
      } else {
        setLoginError(data.message || 'Username atau password salah');
      }
    } catch (err) {
      setLoginError('Gagal terhubung ke server: ' + err.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const fetchQuizList = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/quiz/list`);
      const data = await res.json();
      const rows = data.data || data.quizzes || [];
      if (res.ok && Array.isArray(rows)) {
        setQuizList(rows);
      }
    } catch (_) {}
  }, []);

  const fetchSubmissions = useCallback(async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/submissions`, {
        headers: getAuthHeaders(token),
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      const rows = data.data || data.submissions || [];
      if (res.ok && Array.isArray(rows)) {
        setSubmissions(rows);
      }
    } catch (_) {
    } finally {
      setLoadingData(false);
    }
  }, [token, handleLogout]);

  const fetchLiveSessions = useCallback(async () => {
    if (!token || (role !== 'SUPERADMIN' && role !== 'PROCTOR')) return;
    try {
      const res = await fetch(`${API_BASE}/v1/admin/live/sessions`, {
        headers: getAuthHeaders(token),
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      const rows = data.data || data.sessions || [];
      if (res.ok && Array.isArray(rows)) {
        setLiveSessions(rows);
      }
    } catch (_) {}
  }, [token, role, handleLogout]);

  useEffect(() => {
    if (!token) return;
    fetchQuizList();
    fetchSubmissions();
    fetchLiveSessions();
  }, [token, fetchQuizList, fetchSubmissions, fetchLiveSessions]);

  // Memory-efficient polling for Live Sessions
  useEffect(() => {
    if (!token || (role !== 'SUPERADMIN' && role !== 'PROCTOR')) return;
    const intervalMs = activeTab === 'LIVE' ? 3000 : 10000;
    const timer = setInterval(fetchLiveSessions, intervalMs);
    return () => clearInterval(timer);
  }, [token, role, activeTab, fetchLiveSessions]);

  const handleSaveGrade = useCallback(
    async (submissionId, grade, feedback) => {
      try {
        const res = await fetch(`${API_BASE}/v1/admin/submissions/grade`, {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify({
            submissionId,
            grade: grade === '' ? null : Number(grade),
            feedback,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          showToast('Nilai berhasil disimpan!', 'success');
          setSubmissions((prev) =>
            prev.map((item) =>
              item.id === submissionId
                ? {
                    ...item,
                    grade: grade === '' ? null : Number(grade),
                    feedback,
                  }
                : item
            )
          );
        } else {
          showToast(data.message || 'Gagal menyimpan nilai', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
    [token, showToast]
  );

  // Memoized Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (quizFilter !== 'ALL' && String(sub.quiz_id) !== String(quizFilter)) {
        return false;
      }
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'GRADED' && (sub.grade === null || sub.grade === undefined)) {
          return false;
        }
        if (statusFilter === 'UNGRADED' && sub.grade !== null && sub.grade !== undefined) {
          return false;
        }
        if (statusFilter === 'DISQUALIFIED' && sub.status !== 'DISQUALIFIED') {
          return false;
        }
        if (statusFilter === 'VIOLATION' && (Number(sub.violation_count) || 0) === 0) {
          return false;
        }
      }
      if (q) {
        const matchName = (sub.nama || '').toLowerCase().includes(q);
        const matchNim = (sub.nim || '').toLowerCase().includes(q);
        if (!matchName && !matchNim) return false;
      }
      return true;
    });
  }, [submissions, quizFilter, statusFilter, searchQuery]);

  // Memoized Filtered Live Sessions
  const filteredLiveSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return liveSessions.filter((s) => {
      if (quizFilter !== 'ALL' && String(s.quizId) !== String(quizFilter)) {
        return false;
      }
      if (q) {
        const matchName = (s.nama || s.studentName || '').toLowerCase().includes(q);
        const matchNim = (s.nim || '').toLowerCase().includes(q);
        if (!matchName && !matchNim) return false;
      }
      return true;
    });
  }, [liveSessions, quizFilter, searchQuery]);

  // Summary Stats
  const stats = useMemo(() => {
    const total = filteredSubmissions.length;
    const graded = filteredSubmissions.filter(
      (s) => s.grade !== null && s.grade !== undefined
    );
    const avg =
      graded.length > 0
        ? (
            graded.reduce((acc, cur) => acc + Number(cur.grade || 0), 0) /
            graded.length
          ).toFixed(1)
        : '-';
    // Hanya hitung mahasiswa yang statusnya ACTIVE dan belum diskualifikasi/selesai
    const activeOnline = liveSessions.filter(
      (s) => s.status === 'ACTIVE'
    ).length;
    return { total, gradedCount: graded.length, avg, activeOnline };
  }, [filteredSubmissions, liveSessions]);

  const handleExportCSV = () => {
    if (filteredSubmissions.length === 0) {
      showToast('Tidak ada data untuk diekspor', 'error');
      return;
    }
    const headers = [
      'NIM',
      'Nama Mahasiswa',
      'Quiz ID',
      'Pelanggaran',
      'Status',
      'Nilai',
      'Catatan Dosen',
      'Waktu Submit',
    ];
    const rows = filteredSubmissions.map((s) => [
      `"${s.nim || ''}"`,
      `"${(s.nama || '').replace(/"/g, '""')}"`,
      `"${s.quiz_id || ''}"`,
      s.violation_count || 0,
      `"${s.status || 'COMPLETED'}"`,
      s.grade ?? '',
      `"${(s.feedback || '').replace(/"/g, '""')}"`,
      `"${s.submitted_at ? new Date(s.submitted_at).toLocaleString('id-ID') : ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Nilai_Quiz_${quizFilter}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!token) {
    return (
      <div className="login-overlay">
        <div className="login-card">
          <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🛡️</div>
          <h2>Portal Dosen & Superadmin</h2>
          <p>Masuk untuk mengelola soal, timer ujian, dan pantau mahasiswa secara live</p>
          {loginError && (
            <div
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              ⚠️ {loginError}
            </div>
          )}
          <form
            onSubmit={handleLogin}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              textAlign: 'left',
            }}
          >
            <div className="field-group">
              <label>Username</label>
              <input
                type="text"
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="Masukkan username..."
              />
            </div>
            <div className="field-group">
              <label>Password</label>
              <input
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="Masukkan password..."
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loggingIn}
              style={{ justifyContent: 'center', padding: '11px', marginTop: 6 }}
            >
              {loggingIn ? '⏳ Memverifikasi...' : 'Masuk ke Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* COMPACT TOPBAR */}
      <div className="topbar-card no-print">
        <div className="brand-group">
          <div className="brand-icon">🎓</div>
          <div className="brand-title">
            <h1>QuizGuard React Admin</h1>
            <p>
              Login sebagai <strong>{username}</strong> ({role})
            </p>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="nav-tabs">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'SUBMISSIONS' ? 'active' : ''}`}
            onClick={() => setActiveTab('SUBMISSIONS')}
          >
            📊 Hasil & Penilaian ({submissions.length})
          </button>
          {(role === 'SUPERADMIN' || role === 'PROCTOR') && (
            <button
              type="button"
              className={`nav-tab ${activeTab === 'LIVE' ? 'active' : ''}`}
              onClick={() => setActiveTab('LIVE')}
            >
              <span className="live-dot online" /> Live Monitoring ({stats.activeOnline})
            </button>
          )}
          {(role === 'SUPERADMIN' || role === 'DOSEN') && (
            <button
              type="button"
              className={`nav-tab ${activeTab === 'QUIZZES' ? 'active' : ''}`}
              onClick={() => setActiveTab('QUIZZES')}
            >
              ⚙️ Kelola Soal & Timer ({quizList.length} Quiz)
            </button>
          )}
          {role === 'SUPERADMIN' && (
            <button
              type="button"
              className={`nav-tab ${activeTab === 'USERS' ? 'active' : ''}`}
              onClick={() => setActiveTab('USERS')}
            >
              👥 Kelola Akun
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href="/quiz"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline btn-sm"
            style={{ textDecoration: 'none' }}
          >
            🔗 Buka Portal Mahasiswa
          </a>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleLogout}
          >
            Keluar
          </button>
        </div>
      </div>

      {/* TAB 1 & 2 SHARED COMPACT FILTER BAR */}
      {(activeTab === 'SUBMISSIONS' || activeTab === 'LIVE') && (
        <div className="compact-filter-bar no-print">
          <input
            type="text"
            className="filter-input"
            placeholder="🔍 Cari nama mahasiswa atau NIM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="filter-select"
            value={quizFilter}
            onChange={(e) => setQuizFilter(e.target.value)}
          >
            <option value="ALL">📚 Semua Quiz ID</option>
            {quizList.map((q) => (
              <option key={q.quiz_id} value={q.quiz_id}>
                Quiz #{q.quiz_id} ({q.total_questions || 0} Soal)
              </option>
            ))}
          </select>

          {activeTab === 'SUBMISSIONS' && (
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">📌 Semua Status</option>
              <option value="UNGRADED">Belum Dinilai</option>
              <option value="GRADED">Sudah Dinilai</option>
              <option value="DISQUALIFIED">Diskualifikasi</option>
              <option value="VIOLATION">Ada Pelanggaran (&gt;0)</option>
            </select>
          )}

          {(searchQuery || quizFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearchQuery('');
                setQuizFilter('ALL');
                setStatusFilter('ALL');
              }}
            >
              ✕ Reset
            </button>
          )}

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: '0.78rem',
                color: '#64748b',
                fontWeight: 600,
              }}
            >
              Rata-rata Nilai:{' '}
              <strong style={{ color: '#0f172a' }}>{stats.avg}</strong>
            </span>
            {activeTab === 'SUBMISSIONS' && (
              <>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={fetchSubmissions}
                >
                  🔄 Refresh
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={handleExportCSV}
                >
                  📥 Export CSV
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => window.print()}
                >
                  🖨️ Cetak
                </button>
              </>
            )}
            {activeTab === 'LIVE' && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={fetchLiveSessions}
              >
                🔄 Sync Sekarang
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT */}
      {activeTab === 'SUBMISSIONS' && (
        <div className="workspace-panel">
          <div className="table-scroll-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mahasiswa & Quiz</th>
                  <th>Waktu Submit</th>
                  <th>Integritas / Kecurangan</th>
                  <th>Ringkasan Jawaban</th>
                  <th>Status & Nilai</th>
                  {role !== 'PROCTOR' && <th className="no-print">Penilaian Cepat</th>}
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      ⏳ Memuat data jawaban mahasiswa...
                    </td>
                  </tr>
                ) : filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      Tidak ada data pengerjaan yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => (
                    <SubmissionRow
                      key={sub.id}
                      sub={sub}
                      role={role}
                      onSaveGrade={handleSaveGrade}
                      onOpenAnswerModal={(s, entries) =>
                        setAnswerModal({ sub: s, entries })
                      }
                      onOpenViolationModal={(s) => setViolationModal(s)}
                      onOpenTimingModal={(s) =>
                        setLiveDetailModal({
                          nama: s.nama,
                          studentName: s.nama,
                          nim: s.nim,
                          quizId: s.quiz_id,
                          status: s.status || 'SUBMITTED',
                          questionTimings: s.question_timings || [],
                          activityLog: s.activity_log || [],
                          totalElapsedSeconds: s.duration_seconds || 0,
                          remainingSeconds: 0,
                          violationCount: s.violation_count || 0,
                        })
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'LIVE' && (
        <div className="workspace-panel">
          <div className="table-scroll-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mahasiswa</th>
                  <th>Quiz ID</th>
                  <th>Status Real-Time</th>
                  <th>Posisi Soal</th>
                  <th>Total Waktu / Sisa Waktu</th>
                  <th>Pelanggaran</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredLiveSessions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      Belum ada mahasiswa yang sedang aktif mengerjakan ujian pada filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredLiveSessions.map((session) => (
                    <LiveSessionRow
                      key={`${session.nim}_${session.quizId}`}
                      session={session}
                      onViewDetail={(s) => setLiveDetailModal(s)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'QUIZZES' && (
        <UnifiedQuizManager
          token={token}
          quizList={quizList}
          onRefreshQuizList={fetchQuizList}
          showToast={showToast}
        />
      )}

      {activeTab === 'USERS' && role === 'SUPERADMIN' && (
        <UserManager token={token} showToast={showToast} />
      )}

      {/* MODALS */}
      <AnswerReaderModal
        modalData={answerModal}
        onClose={() => setAnswerModal(null)}
      />
      <ViolationLogModal
        sub={violationModal}
        token={token}
        onClose={() => setViolationModal(null)}
      />
      <LiveDetailModal
        targetSession={liveDetailModal}
        token={token}
        onClose={() => setLiveDetailModal(null)}
      />

      {/* TOAST STACK */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-item"
            style={{
              borderLeft: `4px solid ${
                t.type === 'error'
                  ? '#ef4444'
                  : t.type === 'success'
                  ? '#22c55e'
                  : '#6366f1'
              }`,
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
