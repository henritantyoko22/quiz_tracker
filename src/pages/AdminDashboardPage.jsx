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
  ImportGradesModal,
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

  // Filters & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [quizFilter, setQuizFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [violationFilter, setViolationFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState('submitted_at-desc');
  const [autoGradeLoading, setAutoGradeLoading] = useState(false);

  // Modals & Toasts
  const [answerModal, setAnswerModal] = useState(null);
  const [violationModal, setViolationModal] = useState(null);
  const [liveDetailModal, setLiveDetailModal] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
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
    if (role === 'SUPERADMIN' || role === 'PROCTOR') {
      fetchLiveSessions();
    }
  }, [token, role, fetchQuizList, fetchSubmissions, fetchLiveSessions]);

  // Sinkronisasi data live hanya saat berpindah ke tab LIVE (tanpa polling otomatis berulang di background)
  useEffect(() => {
    if (!token || (role !== 'SUPERADMIN' && role !== 'PROCTOR')) return;
    if (activeTab === 'LIVE') {
      fetchLiveSessions();
    }
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
    const list = submissions.filter((sub) => {
      if (quizFilter !== 'ALL' && String(sub.quiz_id) !== String(quizFilter)) {
        return false;
      }
      if (classFilter !== 'ALL') {
        const subClass = String(sub.kelas || '').trim().toUpperCase();
        if (subClass !== classFilter) return false;
      }
      if (statusFilter !== 'ALL') {
        if (
          statusFilter === 'COMPLETED' &&
          sub.status !== 'COMPLETED' &&
          sub.status !== 'SUBMITTED_MANUALLY' &&
          sub.status !== 'SUBMITTED'
        ) {
          return false;
        }
        if (statusFilter === 'DISQUALIFIED' && sub.status !== 'DISQUALIFIED') {
          return false;
        }
        if (statusFilter === 'TIME_EXPIRED' && sub.status !== 'TIME_EXPIRED') {
          return false;
        }
      }
      if (violationFilter !== 'ALL') {
        const v = Number(sub.violation_count) || 0;
        const maxV = Number(sub.max_violations) || 3;
        if (violationFilter === 'CLEAN' && v > 0) return false;
        if (violationFilter === 'HAS_VIOLATION' && v === 0) return false;
        if (
          violationFilter === 'MAX_VIOLATION' &&
          v < maxV &&
          sub.status !== 'DISQUALIFIED'
        ) {
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

    list.sort((a, b) => {
      switch (sortKey) {
        case 'submitted_at-asc':
          return new Date(a.submitted_at || 0) - new Date(b.submitted_at || 0);
        case 'submitted_at-desc':
          return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
        case 'grade-desc':
          return (Number(b.grade) || 0) - (Number(a.grade) || 0);
        case 'grade-asc':
          return (Number(a.grade) || 0) - (Number(b.grade) || 0);
        case 'nama-asc':
          return (a.nama || '').localeCompare(b.nama || '');
        case 'nama-desc':
          return (b.nama || '').localeCompare(a.nama || '');
        case 'nim-asc':
          return String(a.nim || '').localeCompare(String(b.nim || ''), undefined, {
            numeric: true,
          });
        case 'nim-desc':
          return String(b.nim || '').localeCompare(String(a.nim || ''), undefined, {
            numeric: true,
          });
        case 'violation_count-desc':
          return (Number(b.violation_count) || 0) - (Number(a.violation_count) || 0);
        case 'violation_count-asc':
          return (Number(a.violation_count) || 0) - (Number(b.violation_count) || 0);
        default:
          return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
      }
    });

    return list;
  }, [
    submissions,
    quizFilter,
    classFilter,
    statusFilter,
    violationFilter,
    searchQuery,
    sortKey,
  ]);

  // Memoized Filtered Live Sessions
  const filteredLiveSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return liveSessions.filter((s) => {
      if (quizFilter !== 'ALL' && String(s.quizId) !== String(quizFilter)) {
        return false;
      }
      if (classFilter !== 'ALL') {
        const sessClass = String(s.kelas || '').trim().toUpperCase();
        if (sessClass !== classFilter) return false;
      }
      if (q) {
        const matchName = (s.nama || s.studentName || '').toLowerCase().includes(q);
        const matchNim = (s.nim || '').toLowerCase().includes(q);
        if (!matchName && !matchNim) return false;
      }
      return true;
    });
  }, [liveSessions, quizFilter, classFilter, searchQuery]);

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

  const handleAutoGradeSingle = useCallback(
    async (submissionId) => {
      showToast('⏳ Mengevaluasi jawaban dengan Gemini AI...', 'info');
      try {
        const res = await fetch(`${API_BASE}/v1/admin/submissions/auto-grade`, {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify({ submissionId }),
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          showToast(`✅ ${data.message}`, 'success');
          setSubmissions((prev) =>
            prev.map((item) =>
              item.id === submissionId
                ? {
                    ...item,
                    grade: data.data?.grade ?? item.grade,
                    feedback: data.data?.feedback ?? item.feedback,
                  }
                : item
            )
          );
        } else {
          showToast(data.message || 'Gagal menjalankan Auto-Grading AI.', 'error');
        }
      } catch (err) {
        showToast('Kesalahan koneksi AI: ' + err.message, 'error');
      }
    },
    [token, showToast]
  );

  const handleAutoGradeBatch = useCallback(async () => {
    if (quizFilter === 'ALL') {
      showToast(
        'Pilih salah satu Quiz ID pada filter terlebih dahulu untuk Auto-Grade massal.',
        'error'
      );
      return;
    }

    const ungradeds = filteredSubmissions.filter(
      (s) => s.grade === null || s.grade === undefined || s.grade === ''
    );
    if (ungradeds.length === 0) {
      showToast(
        `Semua mahasiswa pada Quiz #${quizFilter} sudah memiliki nilai.`,
        'info'
      );
      return;
    }

    const confirmMsg = `Jalankan Auto-Grading Gemini AI untuk ${ungradeds.length} submission yang belum dinilai pada Quiz #${quizFilter}?\nNilai dan catatan dosen akan otomatis terisi berdasarkan rubrik dosen.`;
    if (!window.confirm(confirmMsg)) return;

    setAutoGradeLoading(true);
    showToast(
      `⏳ Sedang mengevaluasi ${ungradeds.length} jawaban dengan Gemini AI...`,
      'info'
    );
    try {
      const res = await fetch(`${API_BASE}/v1/admin/submissions/auto-grade`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ quizId: quizFilter, ungradeOnly: true }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(`✅ ${data.message}`, 'success');
        fetchSubmissions();
      } else {
        showToast(data.message || 'Gagal menjalankan Auto-Grading.', 'error');
      }
    } catch (err) {
      showToast('Kesalahan koneksi AI: ' + err.message, 'error');
    } finally {
      setAutoGradeLoading(false);
    }
  }, [quizFilter, filteredSubmissions, token, fetchSubmissions, showToast]);

  const handleExportCSV = async () => {
    if (filteredSubmissions.length === 0) {
      showToast('Tidak ada data submission untuk diekspor', 'error');
      return;
    }

    showToast('⏳ Mempersiapkan data ekspor & definisi soal...', 'info');

    // 1. Ambil daftar teks pertanyaan untuk seluruh Quiz ID yang terlibat
    const uniqueQuizIds = [
      ...new Set(
        filteredSubmissions
          .map((s) => String(s.quiz_id || '').trim())
          .filter(Boolean)
      ),
    ];
    const quizQuestionMap = {};

    await Promise.all(
      uniqueQuizIds.map(async (qId) => {
        try {
          const res = await fetch(
            `${API_BASE}/v1/quiz/questions/${encodeURIComponent(qId)}`
          );
          const d = await res.json();
          if (res.ok && Array.isArray(d.data)) {
            quizQuestionMap[qId] = d.data.map((q) => q.question_text || '');
          }
        } catch (_) {}
      })
    );

    // 2. Tentukan jumlah soal terbanyak dari submission yang ada
    let maxQ = 0;
    filteredSubmissions.forEach((s) => {
      const qList = quizQuestionMap[String(s.quiz_id || '').trim()] || [];
      if (qList.length > maxQ) maxQ = qList.length;

      const ansObj = parseAnswersObject(s.answers);
      const keys = Object.keys(ansObj);
      keys.forEach((k) => {
        const num = parseInt(k.replace(/\D/g, ''));
        if (!isNaN(num) && num > maxQ) maxQ = num;
      });
      if (keys.length > maxQ) maxQ = keys.length;
    });
    if (maxQ === 0) maxQ = 3;

    // 3. Susun Header Kolom Lengkap & Padat
    const headers = [
      'No',
      'NIM',
      'Nama Mahasiswa',
      'Kelas',
      'Quiz ID',
      'Attempt',
      'Status Ujian',
      'Nilai (0-100)',
      'Catatan / Feedback Dosen',
      'Durasi Pengerjaan',
      'Pelanggaran',
    ];

    for (let q = 1; q <= maxQ; q++) {
      headers.push(`Soal ${q} (Pertanyaan)`);
      headers.push(`Jawaban Mahasiswa ${q}`);
    }

    // Helper sanitasi teks untuk format CSV RFC 4180
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    // 4. Susun Baris Data Mahasiswa, Soal, & Jawaban
    const rows = filteredSubmissions.map((s, idx) => {
      const ansObj = parseAnswersObject(s.answers);
      const qList = quizQuestionMap[String(s.quiz_id || '').trim()] || [];
      const statusText =
        s.status === 'DISQUALIFIED'
          ? 'Diskualifikasi'
          : s.status === 'TIME_EXPIRED'
          ? 'Waktu Habis'
          : 'Selesai Mandiri';

      const durText =
        Number(s.duration_seconds) > 0
          ? formatDuration(Number(s.duration_seconds))
          : '-';

      const row = [
        idx + 1,
        escapeCsv(s.nim || ''),
        escapeCsv(s.nama || ''),
        escapeCsv(s.kelas || '-'),
        escapeCsv(s.quiz_id || ''),
        s.attempt || 1,
        escapeCsv(statusText),
        s.grade !== null && s.grade !== undefined && s.grade !== '' ? s.grade : '',
        escapeCsv(s.feedback || ''),
        escapeCsv(durText),
        `${s.violation_count || 0}x`,
      ];

      for (let q = 1; q <= maxQ; q++) {
        const questionText = qList[q - 1] || `Pertanyaan butir #${q}`;
        const ans =
          ansObj[`soal_${q}`] ||
          ansObj[String(q)] ||
          ansObj[q] ||
          ansObj[`Soal ${q}`] ||
          ansObj[`soal${q}`] ||
          (ansObj[Object.keys(ansObj)[q - 1]]) ||
          '-';
        row.push(escapeCsv(questionText));
        row.push(escapeCsv(ans));
      }

      return row.join(',');
    });

    // 5. Tambahkan UTF-8 Byte Order Mark (\uFEFF) agar Microsoft Excel & Google Sheets
    // otomatis membuka karakter teks bahasa Indonesia, simbol, dan enter tanpa corrupt
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    const quizName = quizFilter !== 'ALL' ? `Quiz_${quizFilter}` : 'Semua_Quiz';
    const classStr = classFilter !== 'ALL' ? `_Kelas_${classFilter}` : '';
    a.download = `Rekap_Lengkap_Jawaban_${quizName}${classStr}_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Berhasil mengekspor ${filteredSubmissions.length} jawaban mahasiswa!`, 'success');
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
            <h1>QuizProtect Admin</h1>
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
          {/* BARIS 1: SEMUA FILTER (SIMETRIS & RAPI) */}
          <div className="filter-row" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="filter-input"
              placeholder="🔍 Cari nama mahasiswa atau NIM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ minWidth: 220, flex: 1 }}
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

            <select
              className="filter-select"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="ALL">🏫 Semua Kelas</option>
              <option value="A">Kelas A (50 mhs)</option>
              <option value="B">Kelas B (49 mhs)</option>
              <option value="C">Kelas C (51 mhs)</option>
              <option value="D">Kelas D (47 mhs)</option>
            </select>

            {activeTab === 'SUBMISSIONS' && (
              <>
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">📌 Semua Status Ujian</option>
                  <option value="COMPLETED">✅ Selesai Mandiri</option>
                  <option value="DISQUALIFIED">❌ Diskualifikasi</option>
                  <option value="TIME_EXPIRED">⏰ Waktu Habis</option>
                </select>

                <select
                  className="filter-select"
                  value={violationFilter}
                  onChange={(e) => setViolationFilter(e.target.value)}
                >
                  <option value="ALL">⚠️ Semua Pelanggaran</option>
                  <option value="CLEAN">🛡️ Bersih (0 Pelanggaran)</option>
                  <option value="HAS_VIOLATION">🚨 Ada Pelanggaran (&gt; 0)</option>
                  <option value="MAX_VIOLATION">🚫 Diskualifikasi (Maksimal)</option>
                </select>
              </>
            )}

            {(searchQuery ||
              quizFilter !== 'ALL' ||
              classFilter !== 'ALL' ||
              statusFilter !== 'ALL' ||
              violationFilter !== 'ALL' ||
              sortKey !== 'submitted_at-desc') && (
              <button
                type="button"
                className="btn btn-outline btn-sm btn-touchable"
                onClick={() => {
                  setSearchQuery('');
                  setQuizFilter('ALL');
                  setClassFilter('ALL');
                  setStatusFilter('ALL');
                  setViolationFilter('ALL');
                  setSortKey('submitted_at-desc');
                }}
              >
                ↺ Reset Filter
              </button>
            )}
          </div>

          {/* BARIS 2: INFORMASI DATA, SORTING & TOMBOL AKSI */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 10,
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.8rem',
              color: '#64748b',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            {activeTab === 'SUBMISSIONS' ? (
              <div>
                Menampilkan <strong style={{ color: '#0f172a' }}>{filteredSubmissions.length}</strong>{' '}
                dari total <strong style={{ color: '#0f172a' }}>{submissions.length}</strong> data jawaban mahasiswa.
                <span style={{ marginLeft: 12, padding: '2px 8px', background: '#f1f5f9', borderRadius: 6, fontWeight: 700 }}>
                  Rata-rata Nilai: <strong style={{ color: '#4f46e5' }}>{stats.avg}</strong>
                </span>
              </div>
            ) : (
              <div>
                Memantau <strong style={{ color: '#0f172a' }}>{filteredLiveSessions.length}</strong> sesi live mahasiswa.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {activeTab === 'SUBMISSIONS' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                    Urutkan:
                  </span>
                  <select
                    className="filter-select"
                    style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value)}
                  >
                    <option value="submitted_at-desc">Waktu Submit (Terbaru)</option>
                    <option value="submitted_at-asc">Waktu Submit (Terlama)</option>
                    <option value="grade-desc">Nilai (Tertinggi ➔ Terendah)</option>
                    <option value="grade-asc">Nilai (Terendah ➔ Tertinggi)</option>
                    <option value="nama-asc">Nama Mahasiswa (A - Z)</option>
                    <option value="nama-desc">Nama Mahasiswa (Z - A)</option>
                    <option value="nim-asc">NIM (Terkecil)</option>
                    <option value="nim-desc">NIM (Terbesar)</option>
                    <option value="violation_count-desc">Pelanggaran (Terbanyak)</option>
                  </select>
                </div>
              )}

              {activeTab === 'SUBMISSIONS' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-touchable"
                    onClick={fetchSubmissions}
                  >
                    🔄 Refresh
                  </button>

                  {(role === 'SUPERADMIN' || role === 'DOSEN') && (
                    <button
                      type="button"
                      className="btn btn-sm btn-touchable"
                      style={{ background: '#7c3aed', color: '#ffffff', fontWeight: 700 }}
                      onClick={handleAutoGradeBatch}
                      disabled={autoGradeLoading}
                      title="Nilai otomatis seluruh jawaban yang belum dinilai menggunakan Gemini AI"
                    >
                      {autoGradeLoading ? '⏳ Menilai AI...' : '⚡ Auto-Grade AI'}
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-success btn-sm btn-touchable"
                    onClick={handleExportCSV}
                  >
                    📥 Export CSV
                  </button>

                  {(role === 'SUPERADMIN' || role === 'DOSEN') && (
                    <button
                      type="button"
                      className="btn btn-warning btn-sm btn-touchable"
                      onClick={() => setImportModalOpen(true)}
                      title="Impor nilai & feedback AI dari file CSV"
                    >
                      📤 Import Nilai
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-touchable"
                    onClick={() => window.print()}
                  >
                    🖨️ Cetak
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-touchable"
                  onClick={fetchLiveSessions}
                >
                  🔄 Sync Sekarang
                </button>
              )}
            </div>
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
                  <th style={{ width: 48, textAlign: 'center' }}>No.</th>
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
                    <td colSpan={role !== 'PROCTOR' ? 7 : 6} className="empty-state">
                      ⏳ Memuat data jawaban mahasiswa...
                    </td>
                  </tr>
                ) : filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={role !== 'PROCTOR' ? 7 : 6} className="empty-state">
                      Tidak ada data pengerjaan yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub, idx) => (
                    <SubmissionRow
                      key={sub.id}
                      index={idx}
                      sub={sub}
                      role={role}
                      onSaveGrade={handleSaveGrade}
                      onAutoGrade={role !== 'PROCTOR' ? handleAutoGradeSingle : undefined}
                      onOpenAnswerModal={(s, entries) =>
                        setAnswerModal({ sub: s, entries })
                      }
                      onOpenViolationModal={(s) => setViolationModal(s)}
                      onOpenTimingModal={(s) => {
                        const parseJson = (val) => {
                          if (!val) return [];
                          if (Array.isArray(val)) return val;
                          if (typeof val === 'string') {
                            try {
                              const p = JSON.parse(val);
                              return Array.isArray(p) ? p : [];
                            } catch (_) {
                              return [];
                            }
                          }
                          return [];
                        };
                        setLiveDetailModal({
                          nama: s.nama,
                          studentName: s.nama,
                          nim: s.nim,
                          quizId: s.quiz_id,
                          status: s.status || 'SUBMITTED',
                          questionTimings: parseJson(s.question_timings),
                          activityLog: parseJson(s.activity_log),
                          totalElapsedSeconds: Number(s.duration_seconds) || 0,
                          remainingSeconds: 0,
                          violationCount: s.violation_count || 0,
                          submittedAt: s.submitted_at,
                        });
                      }}
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
                  <th style={{ width: 48, textAlign: 'center' }}>No.</th>
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
                    <td colSpan="8" className="empty-state">
                      Belum ada mahasiswa yang sedang aktif mengerjakan ujian pada filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredLiveSessions.map((session, idx) => (
                    <LiveSessionRow
                      key={`${session.nim}_${session.quizId}`}
                      index={idx}
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
      <ImportGradesModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        token={token}
        onSuccess={fetchSubmissions}
        showToast={showToast}
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
