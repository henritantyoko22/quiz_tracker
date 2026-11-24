import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API_BASE, getAuthHeaders, parseAnswersObject, formatDuration } from '../services/api.js';
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

  // Data States (Server-Side Paginated via WHERE + LIMIT/OFFSET)
  const [submissions, setSubmissions] = useState([]);
  const [serverMeta, setServerMeta] = useState({
    totalAll: 0,
    totalFiltered: 0,
    totalPages: 1,
    gradedCount: 0,
    ungradedCount: 0,
    avgGrade: '-',
    courseCounts: { total: 0, ppk: 0, iot: 0, algo: 0 },
    classCounts: { A: 0, B: 0, C: 0, D: 0 },
  });
  const [quizList, setQuizList] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Selection state for Bulk Delete
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Cache detail JSONB per submission ID agar buka ulang modal instan (0ms)
  const detailCacheRef = useRef({});

  // Filters & Sorting State
  const [courseFilter, setCourseFilter] = useState('ALL'); // 'ALL' | 'PPK' | 'IOT' | 'ALGO'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [quizFilter, setQuizFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [violationFilter, setViolationFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState('submitted_at-desc');
  const [autoGradeLoading, setAutoGradeLoading] = useState(false);

  // Pagination State for Submissions Table (Server-Side LIMIT/OFFSET)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25); // 15, 25, 50, 100, ALL

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
    try {
      fetch(`${API_BASE}/v1/admin/logout`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      }).catch(() => {});
    } catch (_) {}
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminUser');
    setToken('');
    setRole('DOSEN');
    setUsername('');
  }, [token]);

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

  // Debounce pencarian teks 300ms agar tidak membanjiri query database saat mengetik
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch((prev) => {
        const next = searchQuery.trim();
        if (prev !== next) setCurrentPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Submissions dengan Server-Side Filtering + WHERE + LIMIT/OFFSET dari PostgreSQL
  const fetchSubmissions = useCallback(
    async (abortSignal) => {
      if (!token) return;
      setLoadingData(true);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(pageSize),
          course: courseFilter,
          quizId: quizFilter,
          kelas: classFilter,
          status: statusFilter,
          violation: violationFilter,
          search: debouncedSearch,
          sort: sortKey,
        });
        const res = await fetch(`${API_BASE}/v1/admin/submissions?${params.toString()}`, {
          headers: getAuthHeaders(token),
          signal: typeof AbortSignal !== 'undefined' && abortSignal instanceof AbortSignal ? abortSignal : undefined,
        });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const data = await res.json();
        const rows = data.data || data.submissions || [];
        if (res.ok && Array.isArray(rows)) {
          setSubmissions(rows);
          if (data.meta) {
            setServerMeta(data.meta);
          }
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      } finally {
        setLoadingData(false);
      }
    },
    [
      token,
      currentPage,
      pageSize,
      courseFilter,
      quizFilter,
      classFilter,
      statusFilter,
      violationFilter,
      debouncedSearch,
      sortKey,
      handleLogout,
    ]
  );

  // Helper ambil seluruh data terfilter khusus saat klik Export CSV / Export JSON
  const fetchAllFilteredForExport = useCallback(async () => {
    const params = new URLSearchParams({
      export: 'true',
      course: courseFilter,
      quizId: quizFilter,
      kelas: classFilter,
      status: statusFilter,
      violation: violationFilter,
      search: debouncedSearch || searchQuery.trim(),
      sort: sortKey,
    });
    const res = await fetch(`${API_BASE}/v1/admin/submissions?${params.toString()}`, {
      headers: getAuthHeaders(token),
    });
    if (res.status === 401) {
      handleLogout();
      return [];
    }
    const data = await res.json();
    return Array.isArray(data.data) ? data.data : [];
  }, [
    token,
    courseFilter,
    quizFilter,
    classFilter,
    statusFilter,
    violationFilter,
    debouncedSearch,
    searchQuery,
    sortKey,
    handleLogout,
  ]);

  // Lazy-load detail lengkap submission (question_order, question_timings, activity_log) dari PK (< 2ms)
  const loadSubmissionDetail = useCallback(
    async (subId) => {
      if (detailCacheRef.current[subId]) {
        return detailCacheRef.current[subId];
      }
      try {
        const res = await fetch(`${API_BASE}/v1/admin/submissions/${subId}`, {
          headers: getAuthHeaders(token),
        });
        const data = await res.json();
        if (res.ok && data.data) {
          detailCacheRef.current[subId] = data.data;
          return data.data;
        }
      } catch (_) {}
      return null;
    },
    [token]
  );

  const handleOpenAnswerModal = useCallback(
    async (sub, entries) => {
      const cached = detailCacheRef.current[sub.id];
      setAnswerModal({
        sub: cached ? { ...sub, ...cached } : sub,
        entries,
      });
      if (!cached) {
        const detail = await loadSubmissionDetail(sub.id);
        if (detail) {
          setAnswerModal((prev) =>
            prev && prev.sub && prev.sub.id === sub.id
              ? { ...prev, sub: { ...prev.sub, ...detail } }
              : prev
          );
        }
      }
    },
    [loadSubmissionDetail]
  );

  const handleOpenTimingModal = useCallback(
    async (s) => {
      const cached = detailCacheRef.current[s.id];
      const buildSessionView = (detailObj) => ({
        nama: s.nama,
        studentName: s.nama,
        nim: s.nim,
        quizId: s.quiz_id,
        status: s.status || 'SUBMITTED',
        questionTimings: Array.isArray(detailObj?.question_timings) ? detailObj.question_timings : [],
        activityLog: Array.isArray(detailObj?.activity_log) ? detailObj.activity_log : [],
        totalElapsedSeconds: Number(s.duration_seconds) || 0,
        remainingSeconds: 0,
        violationCount: s.violation_count || 0,
        submittedAt: s.submitted_at,
      });

      setLiveDetailModal(buildSessionView(cached || s));
      if (!cached) {
        const detail = await loadSubmissionDetail(s.id);
        if (detail) {
          setLiveDetailModal(buildSessionView(detail));
        }
      }
    },
    [loadSubmissionDetail]
  );

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
    if (role === 'SUPERADMIN' || role === 'PROCTOR') {
      fetchLiveSessions();
    }
  }, [token, role, fetchQuizList, fetchLiveSessions]);

  // Fetch terpaginasi otomatis saat halaman/filter berubah (dengan AbortController anti-race-condition)
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetchSubmissions(controller.signal);
    return () => controller.abort();
  }, [token, fetchSubmissions]);

  // Bersihkan pilihan checkbox saat berpindah halaman atau mengganti filter
  useEffect(() => {
    setSelectedIds([]);
  }, [currentPage, pageSize, courseFilter, quizFilter, classFilter, statusFilter, violationFilter, debouncedSearch, sortKey]);

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

  // Hapus 1 submission (misal pengerjaan mahasiswa yang asal-asalan)
  const handleDeleteSubmission = useCallback(
    async (sub) => {
      const confirmMsg = `Hapus submission mahasiswa berikut?\n\n• Nama: ${sub.nama || '-'}\n• NIM: ${sub.nim || '-'}\n• Quiz ID: #${sub.quiz_id}\n\nData pengerjaan ini akan dihapus permanen dari database (dan mahasiswa dapat mengerjakan ulang apabila belum ada submission lain).`;
      if (!window.confirm(confirmMsg)) return;

      try {
        const res = await fetch(`${API_BASE}/v1/admin/submissions/${sub.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(token),
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          delete detailCacheRef.current[sub.id];
          setSelectedIds((prev) => prev.filter((id) => id !== sub.id));
          showToast(`🗑️ ${data.message}`, 'success');
          await fetchSubmissions();
        } else {
          showToast(data.message || 'Gagal menghapus submission', 'error');
        }
      } catch (err) {
        showToast('Gagal menghapus submission: ' + err.message, 'error');
      }
    },
    [token, showToast, fetchSubmissions]
  );

  // Pilih / batal pilih 1 baris
  const handleToggleSelect = useCallback((subId) => {
    setSelectedIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  }, []);

  // Pilih / batal pilih seluruh baris di halaman aktif
  const handleToggleSelectAllPage = useCallback(() => {
    const pageIds = submissions.map((s) => s.id);
    setSelectedIds((prev) => {
      const allSelected = pageIds.length > 0 && pageIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !pageIds.includes(id));
      }
      return [...new Set([...prev, ...pageIds])];
    });
  }, [submissions]);

  // Hapus banyak submission sekaligus (Bulk Delete)
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0 || bulkDeleting) return;
    const confirmMsg = `Hapus ${selectedIds.length} submission mahasiswa yang dipilih sekaligus?\n\nData yang dihapus tidak dapat dikembalikan.`;
    if (!window.confirm(confirmMsg)) return;

    setBulkDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/submissions/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        selectedIds.forEach((id) => delete detailCacheRef.current[id]);
        setSelectedIds([]);
        showToast(`🗑️ ${data.message}`, 'success');
        await fetchSubmissions();
      } else {
        showToast(data.message || 'Gagal menghapus submission terpilih', 'error');
      }
    } catch (err) {
      showToast('Kesalahan jaringan: ' + err.message, 'error');
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedIds, bulkDeleting, token, showToast, fetchSubmissions]);

  // Statistik per mata kuliah & per kelas dari Server-Side Meta (tanpa memuat seluruh baris ke browser)
  const courseCounts = serverMeta.courseCounts || { ppk: 0, iot: 0, algo: 0, total: 0 };
  const classCounts = serverMeta.classCounts || { A: 0, B: 0, C: 0, D: 0 };

  // Filter daftar kuis sesuai mata kuliah yang sedang aktif
  const filteredQuizList = useMemo(() => {
    if (courseFilter === 'ALL') return quizList;
    return quizList.filter((q) => {
      const qCourse = String(q.mata_kuliah || '').toUpperCase();
      const qId = String(q.quiz_id || '').toUpperCase();
      if (courseFilter === 'IOT') return qCourse.includes('IOT') || qId.includes('IOT');
      if (courseFilter === 'PPK') return qCourse.includes('PPK') || (!qCourse.includes('IOT') && !qCourse.includes('ALGO'));
      if (courseFilter === 'ALGO') return qCourse.includes('ALGO') || qId.includes('ALGO');
      return true;
    });
  }, [quizList, courseFilter]);

  // Paginasi Server-Side (submissions hanya berisi baris halaman aktif sesuai LIMIT/OFFSET!)
  const totalItems = serverMeta.totalFiltered || 0;
  const numericPageSize = pageSize === 'ALL' ? 500 : Number(pageSize) || 25;
  const totalPages = Math.max(1, serverMeta.totalPages || Math.ceil(totalItems / numericPageSize) || 1);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedSubmissions = submissions;

  // Memoized Filtered Live Sessions (dengan pemisahan mata kuliah)
  const filteredLiveSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return liveSessions.filter((s) => {
      if (courseFilter !== 'ALL') {
        const sCourse = String(s.mataKuliah || s.mata_kuliah || '').toUpperCase();
        if (courseFilter === 'IOT' && !sCourse.includes('IOT')) return false;
        if (courseFilter === 'PPK' && !sCourse.includes('PPK') && !sCourse.includes('PERANGKAT KERAS')) return false;
        if (courseFilter === 'ALGO' && !sCourse.includes('ALGO') && !sCourse.includes('EVOLUSIONER')) return false;
      }
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
  }, [liveSessions, courseFilter, quizFilter, classFilter, searchQuery]);

  // Summary Stats (Server-Side Agregasi Cepat)
  const stats = useMemo(() => {
    const activeOnline = filteredLiveSessions.filter(
      (s) => s.status === 'ACTIVE'
    ).length;
    return {
      total: serverMeta.totalFiltered || 0,
      totalAll: serverMeta.totalAll || 0,
      gradedCount: serverMeta.gradedCount || 0,
      ungradedCount: serverMeta.ungradedCount || 0,
      avg: serverMeta.avgGrade || '-',
      activeOnline,
    };
  }, [serverMeta, filteredLiveSessions]);

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

    const ungradedTotal = serverMeta.ungradedCount || 0;
    if (ungradedTotal === 0) {
      showToast(
        `Semua mahasiswa pada filter Quiz #${quizFilter} sudah memiliki nilai.`,
        'info'
      );
      return;
    }

    const confirmMsg = `Jalankan Auto-Grading Gemini AI untuk submission yang belum dinilai pada Quiz #${quizFilter} (ditemukan ${ungradedTotal} belum dinilai, diproses maks 50 per kloter)?\nNilai dan catatan dosen akan otomatis terisi berdasarkan rubrik dosen.`;
    if (!window.confirm(confirmMsg)) return;

    setAutoGradeLoading(true);
    showToast(
      `⏳ Sedang mengevaluasi jawaban dengan Gemini AI...`,
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
  }, [quizFilter, serverMeta.ungradedCount, token, fetchSubmissions, showToast]);

  const handleExportCSV = async () => {
    if ((serverMeta.totalFiltered || 0) === 0 && submissions.length === 0) {
      showToast('Tidak ada data submission untuk diekspor', 'error');
      return;
    }

    showToast('⏳ Mempersiapkan data ekspor & definisi soal dari database...', 'info');
    const exportRows = await fetchAllFilteredForExport();
    if (exportRows.length === 0) {
      showToast('Tidak ada data submission untuk diekspor', 'error');
      return;
    }

    // 1. Ambil daftar teks pertanyaan untuk seluruh Quiz ID yang terlibat
    const uniqueQuizIds = [
      ...new Set(
        exportRows
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
    exportRows.forEach((s) => {
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
      'Mata Kuliah',
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
      'Lokasi Presensi',
      'Jarak ke FSM Undip (meter)',
      'Browser',
      'Perangkat',
      'Alamat IP',
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
    const rows = exportRows.map((s, idx) => {
      const ansObj = parseAnswersObject(s.answers);
      let qList = quizQuestionMap[String(s.quiz_id || '').trim()] || [];
      if (Array.isArray(s.question_order) && s.question_order.length > 0) {
        qList = s.question_order.map((q) => q.question_text || '');
      } else if (typeof s.question_order === 'string') {
        try {
          const parsed = JSON.parse(s.question_order);
          if (Array.isArray(parsed) && parsed.length > 0) {
            qList = parsed.map((q) => q.question_text || '');
          }
        } catch (_) {}
      }
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

      const locStatusText =
        s.location_status === 'VALID_CAMPUS'
          ? 'Di Lingkungan FSM Undip'
          : s.location_status === 'FAKE_GPS_SPOOF' || s.location_status === 'FAKE_GPS_DETECTED'
          ? '🚨 FAKE GPS TERDETEKSI'
          : s.location_status === 'OUTSIDE_CAMPUS'
          ? 'Di Luar Area Kampus'
          : s.location_status || '-';

      const mkName = s.mata_kuliah || 'PPK';

      const row = [
        idx + 1,
        escapeCsv(mkName),
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
        escapeCsv(locStatusText),
        s.location_distance_meters !== null && s.location_distance_meters !== undefined ? s.location_distance_meters : '',
        escapeCsv(s.browser_info || 'Chrome'),
        escapeCsv(s.device_info || 'Mobile'),
        escapeCsv(s.client_ip || ''),
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
    const courseStr = courseFilter !== 'ALL' ? `_${courseFilter}` : '';
    const quizName = quizFilter !== 'ALL' ? `Quiz_${quizFilter}` : 'Semua_Quiz';
    const classStr = classFilter !== 'ALL' ? `_Kelas_${classFilter}` : '';
    a.download = `Rekap_Lengkap_Jawaban${courseStr}_${quizName}${classStr}_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Berhasil mengekspor ${exportRows.length} jawaban mahasiswa!`, 'success');
  };

  const handleExportJSON = async () => {
    if ((serverMeta.totalFiltered || 0) === 0 && submissions.length === 0) {
      showToast('Tidak ada data submission untuk diekspor', 'error');
      return;
    }

    showToast('⏳ Mempersiapkan data JSON untuk AI dari database...', 'info');
    const exportRows = await fetchAllFilteredForExport();
    if (exportRows.length === 0) {
      showToast('Tidak ada data submission untuk diekspor', 'error');
      return;
    }

    // 1. Ambil seluruh data soal & kunci jawaban untuk Quiz ID yang terlibat
    const uniqueQuizIds = [
      ...new Set(
        exportRows
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
            quizQuestionMap[qId] = d.data;
          }
        } catch (_) {}
      })
    );

    // 2. Susun Payload JSON terstruktur khusus untuk AI input
    const exportPayload = {
      meta: {
        judul: 'Rekap Jawaban Ujian Mahasiswa',
        tanggal_ekspor: new Date().toISOString(),
        mata_kuliah: courseFilter,
        quiz_id: quizFilter,
        kelas_filter: classFilter,
        total_mahasiswa: exportRows.length,
      },
      daftar_soal_per_quiz: quizQuestionMap,
      submissions: exportRows.map((s, idx) => {
        const ansObj = parseAnswersObject(s.answers);
        let qList = quizQuestionMap[String(s.quiz_id || '').trim()] || [];
        if (Array.isArray(s.question_order) && s.question_order.length > 0) {
          qList = s.question_order;
        } else if (typeof s.question_order === 'string') {
          try {
            const parsed = JSON.parse(s.question_order);
            if (Array.isArray(parsed) && parsed.length > 0) qList = parsed;
          } catch (_) {}
        }

        const statusText =
          s.status === 'DISQUALIFIED'
            ? 'Diskualifikasi'
            : s.status === 'TIME_EXPIRED'
            ? 'Waktu Habis'
            : 'Selesai Mandiri';

        const detailJawaban = qList.map((qItem, qIdx) => {
          const qNum = qIdx + 1;
          const ans =
            ansObj[`soal_${qNum}`] ||
            ansObj[String(qNum)] ||
            ansObj[qNum] ||
            ansObj[`Soal ${qNum}`] ||
            ansObj[`soal${qNum}`] ||
            ansObj[Object.keys(ansObj)[qIdx]] ||
            '(Tidak dijawab)';

          return {
            nomor_soal: qNum,
            pertanyaan: qItem.question_text || '',
            kunci_jawaban_diharapkan: qItem.expected_answer || null,
            jawaban_mahasiswa: ans,
          };
        });

        return {
          no: idx + 1,
          nim: s.nim || '',
          nama: s.nama || '',
          kelas: s.kelas || '-',
          mata_kuliah: s.mata_kuliah || 'PPK',
          quiz_id: s.quiz_id || '',
          attempt: s.attempt || 1,
          status_ujian: statusText,
          nilai: s.grade !== null && s.grade !== undefined && s.grade !== '' ? Number(s.grade) : null,
          catatan_feedback_dosen: s.feedback || '',
          durasi_detik: Number(s.duration_seconds) || 0,
          durasi_terbaca: formatDuration(Number(s.duration_seconds || 0)),
          jumlah_pelanggaran: s.violation_count || 0,
          lokasi_status: s.location_status || '-',
          jarak_ke_kampus_meter: s.location_distance_meters || null,
          browser: s.browser_info || 'Chrome',
          perangkat: s.device_info || 'Mobile',
          detail_jawaban: detailJawaban,
        };
      }),
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    const courseStr = courseFilter !== 'ALL' ? `_${courseFilter}` : '';
    const quizName = quizFilter !== 'ALL' ? `Quiz_${quizFilter}` : 'Semua_Quiz';
    const classStr = classFilter !== 'ALL' ? `_Kelas_${classFilter}` : '';
    a.download = `Rekap_AI${courseStr}_${quizName}${classStr}_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Berhasil mengekspor format JSON untuk AI (${exportRows.length} data)!`, 'success');
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
            📊 Hasil & Penilaian ({stats.totalAll})
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
          {/* PEMISAHAN MATA KULIAH (PPK vs IoT vs Algoritma Evolusioner) */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>📚</span> Mata Kuliah:
            </span>
            <button
              type="button"
              className={`btn btn-xs btn-touchable ${courseFilter === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setCourseFilter('ALL'); setQuizFilter('ALL'); setCurrentPage(1); }}
              style={{ padding: '6px 12px', borderRadius: 8, fontWeight: 700 }}
            >
              🌐 Semua Mata Kuliah ({courseCounts.total})
            </button>
            <button
              type="button"
              className={`btn btn-xs btn-touchable ${courseFilter === 'PPK' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setCourseFilter('PPK'); setQuizFilter('ALL'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontWeight: 700,
                background: courseFilter === 'PPK' ? '#4f46e5' : '#ffffff',
                borderColor: courseFilter === 'PPK' ? '#4f46e5' : '#cbd5e1',
                color: courseFilter === 'PPK' ? '#ffffff' : '#334155',
              }}
            >
              ⚙️ PPK ({courseCounts.ppk})
            </button>
            <button
              type="button"
              className={`btn btn-xs btn-touchable ${courseFilter === 'IOT' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setCourseFilter('IOT'); setQuizFilter('ALL'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontWeight: 700,
                background: courseFilter === 'IOT' ? '#0284c7' : '#ffffff',
                borderColor: courseFilter === 'IOT' ? '#0284c7' : '#cbd5e1',
                color: courseFilter === 'IOT' ? '#ffffff' : '#334155',
              }}
            >
              📡 Internet of Things / IoT ({courseCounts.iot})
            </button>
            <button
              type="button"
              className={`btn btn-xs btn-touchable ${courseFilter === 'ALGO' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setCourseFilter('ALGO'); setQuizFilter('ALL'); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontWeight: 700,
                background: courseFilter === 'ALGO' ? '#7e22ce' : '#ffffff',
                borderColor: courseFilter === 'ALGO' ? '#7e22ce' : '#cbd5e1',
                color: courseFilter === 'ALGO' ? '#ffffff' : '#334155',
              }}
            >
              🧬 Algoritma Evolusioner ({courseCounts.algo})
            </button>
          </div>

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
              onChange={(e) => { setQuizFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">📚 Semua Quiz ID</option>
              {filteredQuizList.map((q) => (
                <option key={q.quiz_id} value={q.quiz_id}>
                  Quiz #{q.quiz_id} ({q.total_questions || 0} Soal - {q.mata_kuliah || 'PPK'})
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setCurrentPage(1); }}
            >
              <option value="ALL">🏫 Semua Kelas</option>
              <option value="A">Kelas A ({classCounts.A} mhs)</option>
              <option value="B">Kelas B ({classCounts.B} mhs)</option>
              <option value="C">Kelas C ({classCounts.C} mhs)</option>
              <option value="D">Kelas D ({classCounts.D} mhs)</option>
            </select>

            {activeTab === 'SUBMISSIONS' && (
              <>
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                >
                  <option value="ALL">📌 Semua Status Ujian</option>
                  <option value="COMPLETED">✅ Selesai Mandiri</option>
                  <option value="DISQUALIFIED">❌ Diskualifikasi</option>
                  <option value="TIME_EXPIRED">⏰ Waktu Habis</option>
                </select>

                <select
                  className="filter-select"
                  value={violationFilter}
                  onChange={(e) => { setViolationFilter(e.target.value); setCurrentPage(1); }}
                >
                  <option value="ALL">⚠️ Semua Pelanggaran</option>
                  <option value="CLEAN">🛡️ Bersih (0 Pelanggaran)</option>
                  <option value="HAS_VIOLATION">🚨 Ada Pelanggaran (&gt; 0)</option>
                  <option value="MAX_VIOLATION">🚫 Diskualifikasi (Maksimal)</option>
                </select>
              </>
            )}

            {(searchQuery ||
              courseFilter !== 'ALL' ||
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
                  setDebouncedSearch('');
                  setCourseFilter('ALL');
                  setQuizFilter('ALL');
                  setClassFilter('ALL');
                  setStatusFilter('ALL');
                  setViolationFilter('ALL');
                  setSortKey('submitted_at-desc');
                  setCurrentPage(1);
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
                Menampilkan <strong style={{ color: '#0f172a' }}>
                  {totalItems === 0 ? 0 : (safeCurrentPage - 1) * numericPageSize + 1} - {Math.min(safeCurrentPage * numericPageSize, totalItems)}
                </strong>{' '}
                (Hal. <strong>{safeCurrentPage}</strong> dari <strong>{totalPages}</strong>) dari total <strong style={{ color: '#0f172a' }}>{totalItems}</strong> data terfilter ({stats.totalAll} total sistem).
                <span style={{ marginLeft: 12, padding: '2px 8px', background: '#f1f5f9', borderRadius: 6, fontWeight: 700 }}>
                  Rata-rata Nilai: <strong style={{ color: '#4f46e5' }}>{stats.avg}</strong>
                </span>
              </div>
            ) : (
              <div>
                Memantau <strong style={{ color: '#0f172a' }}>{filteredLiveSessions.length}</strong> sesi live mahasiswa ({courseFilter === 'ALL' ? 'Semua Mata Kuliah' : courseFilter}).
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
                    onChange={(e) => { setSortKey(e.target.value); setCurrentPage(1); }}
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
                  {(role === 'SUPERADMIN' || role === 'DOSEN') && selectedIds.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm btn-touchable"
                      style={{ fontWeight: 800 }}
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      title="Hapus seluruh submission mahasiswa yang dicentang"
                    >
                      {bulkDeleting ? '⏳ Menghapus...' : `🗑️ Hapus Terpilih (${selectedIds.length})`}
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-touchable"
                    onClick={() => fetchSubmissions()}
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

                  <button
                    type="button"
                    className="btn btn-outline btn-sm btn-touchable"
                    style={{ borderColor: '#6366f1', color: '#4f46e5', fontWeight: 700 }}
                    onClick={handleExportJSON}
                    title="Ekspor data terstruktur beserta butir soal & kunci jawaban dalam format JSON untuk dianalisis oleh AI (Gemini / ChatGPT / Claude)"
                  >
                    🤖 Export JSON (AI)
                  </button>

                  {(role === 'SUPERADMIN' || role === 'DOSEN') && (
                    <button
                      type="button"
                      className="btn btn-warning btn-sm btn-touchable"
                      onClick={() => setImportModalOpen(true)}
                      title="Impor nilai & feedback AI dari file JSON atau CSV"
                    >
                      📤 Import Nilai (JSON/CSV)
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
                  {(role === 'SUPERADMIN' || role === 'DOSEN') && (
                    <th className="no-print" style={{ width: 38, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={
                          paginatedSubmissions.length > 0 &&
                          paginatedSubmissions.every((s) => selectedIds.includes(s.id))
                        }
                        onChange={handleToggleSelectAllPage}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#dc2626' }}
                        title="Pilih / batal pilih semua baris pada halaman ini"
                      />
                    </th>
                  )}
                  <th style={{ width: 48, textAlign: 'center' }}>No.</th>
                  <th>Mahasiswa & Quiz</th>
                  <th>Waktu Submit</th>
                  <th>Integritas / Kecurangan</th>
                  <th>Ringkasan Jawaban</th>
                  <th>Status & Nilai</th>
                  {role !== 'PROCTOR' && <th className="no-print">Penilaian & Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr>
                    <td
                      colSpan={role !== 'PROCTOR' ? 8 : 6}
                      className="empty-state"
                    >
                      ⏳ Memuat data jawaban mahasiswa...
                    </td>
                  </tr>
                ) : paginatedSubmissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={role !== 'PROCTOR' ? 8 : 6}
                      className="empty-state"
                    >
                      Tidak ada data pengerjaan yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  paginatedSubmissions.map((sub, idx) => (
                    <SubmissionRow
                      key={sub.id}
                      index={(safeCurrentPage - 1) * numericPageSize + idx}
                      sub={sub}
                      role={role}
                      isSelected={selectedIds.includes(sub.id)}
                      onToggleSelect={
                        role === 'SUPERADMIN' || role === 'DOSEN'
                          ? handleToggleSelect
                          : undefined
                      }
                      onSaveGrade={handleSaveGrade}
                      onAutoGrade={role !== 'PROCTOR' ? handleAutoGradeSingle : undefined}
                      onDelete={
                        role === 'SUPERADMIN' || role === 'DOSEN'
                          ? handleDeleteSubmission
                          : undefined
                      }
                      onOpenAnswerModal={handleOpenAnswerModal}
                      onOpenViolationModal={(s) => setViolationModal(s)}
                      onOpenTimingModal={handleOpenTimingModal}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* BAR KONTROL PAGINASI CEPAT (SUB-MILLISECOND SMOOTH) */}
          <div
            className="pagination-bar no-print"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📄 Menampilkan</span>
              <strong style={{ color: '#0f172a' }}>
                {totalItems === 0 ? 0 : (safeCurrentPage - 1) * numericPageSize + 1} - {Math.min(safeCurrentPage * numericPageSize, totalItems)}
              </strong>
              <span>dari total</span>
              <strong style={{ color: '#0f172a' }}>{totalItems}</strong>
              <span>mahasiswa ({courseFilter === 'ALL' ? 'Semua Mata Kuliah' : courseFilter})</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                title="Halaman Pertama"
                style={{ padding: '5px 9px', borderRadius: 6, fontWeight: 700 }}
              >
                ⏮
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                title="Halaman Sebelumnya"
                style={{ padding: '5px 10px', borderRadius: 6, fontWeight: 700 }}
              >
                ◀ Prev
              </button>

              {/* Tombol Nomor Halaman dengan Windowing Pintar */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const isCurrent = p === safeCurrentPage;
                  return (
                    <React.Fragment key={p}>
                      {prev && p - prev > 1 && (
                        <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: '0.8rem' }}>…</span>
                      )}
                      <button
                        type="button"
                        className={`btn btn-xs ${isCurrent ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setCurrentPage(p)}
                        style={{
                          minWidth: 32,
                          padding: '5px 8px',
                          borderRadius: 6,
                          fontWeight: isCurrent ? 800 : 600,
                          background: isCurrent ? '#4f46e5' : '#ffffff',
                          borderColor: isCurrent ? '#4f46e5' : '#cbd5e1',
                          color: isCurrent ? '#ffffff' : '#334155',
                        }}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                title="Halaman Berikutnya"
                style={{ padding: '5px 10px', borderRadius: 6, fontWeight: 700 }}
              >
                Next ▶
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                title="Halaman Terakhir"
                style={{ padding: '5px 9px', borderRadius: 6, fontWeight: 700 }}
              >
                ⏭
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#475569' }}>
              <span>Baris per halaman:</span>
              <select
                className="filter-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ padding: '4px 8px', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <option value={15}>15 baris</option>
                <option value={25}>25 baris</option>
                <option value={50}>50 baris</option>
                <option value={100}>100 baris</option>
                <option value="ALL">Maks 500 baris</option>
              </select>
            </div>
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
        onSuccess={() => fetchSubmissions()}
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
