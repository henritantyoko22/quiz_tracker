import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, formatDuration } from '../services/api.js';
import { StickyExamHeader } from '../components/quiz/StickyExamHeader.jsx';
import { QuestionCard } from '../components/quiz/QuestionCard.jsx';

export function StudentQuizPage() {
  // Stages: LOGIN | EXAM | FINISHED
  const [stage, setStage] = useState('LOGIN');

  // Student Identity & Quiz Config
  const [studentName, setStudentName] = useState('');
  const [nim, setNim] = useState('');
  const [quizId, setQuizId] = useState('');

  // Schedule & Validation Info
  const [scheduleState, setScheduleState] = useState({
    loading: false,
    valid: false,
    message: '',
    type: 'neutral',
    settings: null,
    questions: [],
  });

  // Exam State
  const [answers, setAnswers] = useState({});
  const [remainingSec, setRemainingSec] = useState(1800);
  const [violationCount, setViolationCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState('Tersimpan lokal');
  const [submitting, setSubmitting] = useState(false);
  const [finishSummary, setFinishSummary] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Sembunyikan console logging di browser agar tidak disalahgunakan di DevTools
  useEffect(() => {
    try {
      const noop = () => {};
      window.console.log = noop;
      window.console.debug = noop;
      window.console.info = noop;
      window.console.warn = noop;
    } catch (_) {}
  }, []);

  // Verification & Retake Eligibility State (PPK Participant Validation)
  const [studentCheck, setStudentCheck] = useState({
    loading: false,
    verified: false,
    student: null,
    canStart: true,
    attemptNumber: 1,
    isRetake: false,
    warningMessage: null,
    error: '',
  });

  // Mutable Refs for Memory-Efficient Timers & Heartbeat
  const sessionStartMsRef = useRef(0);
  const hardDeadlineMsRef = useRef(0);
  const questionTimingsRef = useRef([]);
  const activeQuestionIndexRef = useRef(0);
  const activityLogRef = useRef([]);
  const isSubmittingRef = useRef(false);
  const isExamActiveRef = useRef(false);
  const answersRef = useRef({});
  const countsRef = useRef({ tab: 0, copy: 0, total: 0, max: 3 });
  const identityRef = useRef({
    name: '',
    nim: '',
    quizId: '',
    totalQ: 0,
    questionTexts: [],
  });

  const addToast = useCallback((text, type = 'warn') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // Debounced Quiz ID & Schedule Checker
  useEffect(() => {
    if (stage !== 'LOGIN') return;
    const trimmed = quizId.trim();
    if (!trimmed) {
      setScheduleState({
        loading: false,
        valid: false,
        message: 'Masukkan Nomor / ID Quiz untuk mengecek ketersediaan soal.',
        type: 'neutral',
        settings: null,
        questions: [],
      });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setScheduleState((prev) => ({
        ...prev,
        loading: true,
        message: 'Mengecek jadwal & soal ujian di database...',
        type: 'neutral',
      }));

      try {
        const [setRes, qRes] = await Promise.all([
          fetch(`${API_BASE}/v1/quiz/settings/${encodeURIComponent(trimmed)}`, {
            signal: controller.signal,
          }),
          fetch(`${API_BASE}/v1/quiz/questions/${encodeURIComponent(trimmed)}`, {
            signal: controller.signal,
          }),
        ]);
        const setData = await setRes.json();
        const qData = await qRes.json();

        const questions = Array.isArray(qData.data) ? qData.data : [];
        const settings = setData.data || {
          duration_minutes: 60,
          max_violations: 3,
          is_active: true,
        };

        if (!setRes.ok || !qRes.ok || questions.length === 0) {
          setScheduleState({
            loading: false,
            valid: false,
            message: `❌ ID Quiz "${trimmed}" tidak valid atau belum memiliki daftar soal di database.`,
            type: 'error',
            settings: null,
            questions: [],
          });
          return;
        }

        if (settings.is_active === false) {
          setScheduleState({
            loading: false,
            valid: false,
            message: '⛔ Ujian ini sedang ditutup oleh Dosen.',
            type: 'error',
            settings,
            questions,
          });
          return;
        }

        const now = new Date();
        if (settings.start_time && now < new Date(settings.start_time)) {
          setScheduleState({
            loading: false,
            valid: false,
            message: `⏳ Ujian baru akan dibuka pada ${new Date(
              settings.start_time
            ).toLocaleString('id-ID')}.`,
            type: 'warn',
            settings,
            questions,
          });
          return;
        }

        if (settings.end_time && now > new Date(settings.end_time)) {
          setScheduleState({
            loading: false,
            valid: false,
            message: `⛔ Waktu ujian telah berakhir pada ${new Date(
              settings.end_time
            ).toLocaleString('id-ID')}.`,
            type: 'error',
            settings,
            questions,
          });
          return;
        }

        setScheduleState({
          loading: false,
          valid: true,
          message: `✅ Siap Dikerjakan! Tersedia ${questions.length} Soal Essay • Durasi ${
            settings.duration_minutes || 60
          } Menit (Maks ${settings.max_violations || 3}x Pelanggaran).`,
          type: 'ok',
          settings,
          questions,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setScheduleState({
            loading: false,
            valid: false,
            message:
              '⚠️ Gagal memeriksa jadwal ujian. Periksa koneksi internet Anda.',
            type: 'error',
            settings: null,
            questions: [],
          });
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [quizId, stage]);

  // Verifikasi peserta kuis PPK, status attempt sesi kuis, dan cegah duplikat sesi
  useEffect(() => {
    if (stage !== 'LOGIN') return;
    const cleanNim = nim.trim();
    const cleanQuizId = quizId.trim();

    if (!cleanNim || cleanNim.length < 5) {
      setStudentCheck({
        loading: false,
        verified: false,
        student: null,
        canStart: false,
        attemptNumber: 1,
        isRetake: false,
        warningMessage: null,
        error: '',
      });
      setStudentName('');
      return;
    }

    const timer = setTimeout(async () => {
      setStudentCheck((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const url = `${API_BASE}/v1/quiz/check-student?nim=${encodeURIComponent(cleanNim)}${
          cleanQuizId ? `&quizId=${encodeURIComponent(cleanQuizId)}` : ''
        }`;
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok && data.status === 'success' && data.student) {
          setStudentCheck({
            loading: false,
            verified: true,
            student: data.student,
            canStart: cleanQuizId ? Boolean(data.canStart) : false,
            attemptNumber: data.attemptNumber || 1,
            isRetake: Boolean(data.isRetake),
            warningMessage: data.warningMessage || null,
            error: cleanQuizId && !data.canStart ? (data.warningMessage || 'Tidak dapat mengikuti kuis ini.') : '',
            previousAttempts: data.previousAttempts || 0,
          });
          setStudentName(data.student.nama);
        } else {
          setStudentCheck({
            loading: false,
            verified: false,
            student: null,
            canStart: false,
            attemptNumber: 1,
            isRetake: false,
            warningMessage: null,
            error:
              (data && data.message) ||
              'NIM tidak terdaftar sebagai peserta mata kuliah PPK.',
          });
          setStudentName('');
        }
      } catch (err) {
        setStudentCheck((prev) => ({
          ...prev,
          loading: false,
          error: 'Gagal memverifikasi NIM: ' + err.message,
        }));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [nim, quizId, stage]);

  // Live Heartbeat Sender matching server.js contract
  const sendHeartbeat = useCallback(async (statusOverride = 'ACTIVE', extraEvent = null) => {
    if (!identityRef.current.nim || !identityRef.current.quizId) return;

    const elapsedSec = Math.max(
      0,
      Math.round((Date.now() - sessionStartMsRef.current) / 1000)
    );
    const remSec = Math.max(
      0,
      Math.ceil((hardDeadlineMsRef.current - Date.now()) / 1000)
    );

    if (extraEvent) {
      activityLogRef.current = [
        ...activityLogRef.current.slice(-59),
        {
          ...extraEvent,
          elapsedSeconds: elapsedSec,
          timestamp: Date.now(),
          timestampISO: new Date().toISOString(),
        },
      ];
    }

    const qIdx = activeQuestionIndexRef.current || 0;
    const qTexts = identityRef.current.questionTexts || [];

    try {
      await fetch(`${API_BASE}/v1/quiz/live/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: identityRef.current.name,
          nim: identityRef.current.nim,
          quizId: identityRef.current.quizId,
          status: statusOverride,
          currentQuestionIndex: qIdx,
          currentQuestionText: qTexts[qIdx] || `Soal ${qIdx + 1}`,
          totalQuestions: identityRef.current.totalQ,
          questionTexts: qTexts,
          questionTimings: questionTimingsRef.current,
          activityLog: activityLogRef.current,
          remainingSeconds: remSec,
          violationCount: countsRef.current.total,
        }),
      });
    } catch (_) {}
  }, []);

  // Reliable Submit Engine with 5x Auto-Retry & Offline Queue
  const executeSubmitQuiz = useCallback(
    async (finalStatus = 'COMPLETED', reasonLabel = 'Selesai Mengerjakan') => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      isExamActiveRef.current = false;
      setSubmitting(true);

      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - sessionStartMsRef.current) / 1000)
      );

      const formattedAnswers = {};
      const totalQ = identityRef.current.totalQ;
      for (let i = 1; i <= totalQ; i++) {
        formattedAnswers[`soal_${i}`] =
          answersRef.current[i] && answersRef.current[i].trim() !== ''
            ? answersRef.current[i].trim()
            : '(Tidak dijawab)';
      }

      const payload = {
        userId: identityRef.current.name,
        nim: identityRef.current.nim,
        quizId: identityRef.current.quizId,
        kelas: identityRef.current.kelas || '-',
        attempt: identityRef.current.attempt || 1,
        answers: formattedAnswers,
        status: finalStatus,
        violationCount: countsRef.current.total,
        maxViolations: countsRef.current.max,
        questionTimings: questionTimingsRef.current,
        activityLog: activityLogRef.current,
        durationSeconds,
      };

      // Also notify live session immediately
      await sendHeartbeat(
        finalStatus === 'DISQUALIFIED'
          ? 'DISQUALIFIED'
          : finalStatus === 'TIME_EXPIRED'
          ? 'TIME_EXPIRED'
          : 'SUBMITTED',
        {
          type: 'SUBMITTED',
          questionNum: (activeQuestionIndexRef.current || 0) + 1,
          questionText: reasonLabel,
        }
      );

      const draftKey = `quiz_draft_${identityRef.current.nim}_${identityRef.current.quizId}`;
      const pendingKey = `quiz_pending_submit_${identityRef.current.nim}_${identityRef.current.quizId}`;

      let sentSuccess = false;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(`${API_BASE}/v1/quiz/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(tId);
          if (res.ok) {
            sentSuccess = true;
            break;
          }
        } catch (_) {
          await new Promise((r) => setTimeout(r, 1200 * attempt));
        }
      }

      if (sentSuccess) {
        localStorage.removeItem(draftKey);
        localStorage.removeItem(pendingKey);
      } else {
        localStorage.setItem(pendingKey, JSON.stringify(payload));
      }

      setSubmitting(false);
      setFinishSummary({
        sentSuccess,
        finalStatus,
        reasonLabel,
        durationSeconds,
        violations: countsRef.current.total,
        payload,
        pendingKey,
      });
      setStage('FINISHED');
    },
    [sendHeartbeat]
  );

  // Record Violation Helper
  const recordViolation = useCallback(
    (type, detail) => {
      if (!isExamActiveRef.current || isSubmittingRef.current) return;

      if (type === 'TAB_SWITCH') {
        countsRef.current.tab += 1;
      } else {
        countsRef.current.copy += 1;
      }
      countsRef.current.total = countsRef.current.tab + countsRef.current.copy;
      setViolationCount(countsRef.current.total);

      addToast(
        `⚠️ Pelanggaran (${countsRef.current.total}/${countsRef.current.max}): ${detail}`,
        'danger'
      );

      // Log to /v1/violations in background
      fetch(`${API_BASE}/v1/violations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: identityRef.current.name,
          quizId: identityRef.current.quizId,
          type,
          detail,
          url: window.location.href,
        }),
      }).catch(() => {});

      sendHeartbeat('ACTIVE', {
        type: 'VIOLATION',
        questionNum: (activeQuestionIndexRef.current || 0) + 1,
        questionText: `${type}: ${detail}`,
      });

      if (countsRef.current.total >= countsRef.current.max) {
        executeSubmitQuiz(
          'DISQUALIFIED',
          `Diskualifikasi otomatis (${countsRef.current.total}x pelanggaran)`
        );
      }
    },
    [addToast, sendHeartbeat, executeSubmitQuiz]
  );

  // Start Exam Handler
  const handleStartExam = async (e) => {
    e.preventDefault();
    if (!scheduleState.valid) return;

    if (!studentCheck.canStart || studentCheck.error) {
      addToast(studentCheck.error || 'Anda tidak diizinkan memulai ujian pada sesi ini.', 'danger');
      return;
    }

    const cleanName = studentName.trim();
    const cleanNim = nim.trim();
    const cleanQuizId = quizId.trim();
    if (!cleanName || !cleanNim || !cleanQuizId) return;

    const settings = scheduleState.settings || {};
    const questions = scheduleState.questions || [];
    const durationMs = (Number(settings.duration_minutes) || 60) * 60 * 1000;

    const draftKey = `quiz_draft_${cleanNim}_${cleanQuizId}`;
    let restoredAnswers = {};
    let startMs = Date.now();

    // Jika ini adalah retake (attempt ke-2 setelah didiskualifikasi), buang draft lama agar fresh
    if (studentCheck.isRetake) {
      localStorage.removeItem(draftKey);
    } else {
      try {
        const savedRaw = localStorage.getItem(draftKey);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw);
          if (parsed && parsed.answers) {
            restoredAnswers = parsed.answers;
          }
          if (
            parsed &&
            parsed.sessionStartMs &&
            Date.now() - parsed.sessionStartMs < durationMs * 2
          ) {
            startMs = parsed.sessionStartMs;
          }
        }
      } catch (_) {}
    }

    const qTexts = questions.map((q) => q.question_text || '');
    const studentKelas = (studentCheck.student && studentCheck.student.kelas) || '-';
    const attemptNum = studentCheck.attemptNumber || 1;

    // Daftarkan sesi live ke server terlebih dahulu dan periksa apakah ada duplikat sesi aktif
    try {
      const liveRes = await fetch(`${API_BASE}/v1/quiz/live/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: cleanName,
          nim: cleanNim,
          quizId: cleanQuizId,
          kelas: studentKelas,
          attempt: attemptNum,
          isRetake: !!studentCheck.isRetake,
          totalQuestions: questions.length,
          questionTexts: qTexts,
        }),
      });
      const liveData = await liveRes.json();
      if (!liveRes.ok || liveData.status === 'error') {
        addToast(liveData.message || 'Gagal memulai sesi kuis.', 'danger');
        return;
      }
    } catch (err) {
      console.warn('Gagal koneksi live session, tetap melanjutkan:', err);
    }

    let deadlineMs = startMs + durationMs;
    if (settings.end_time) {
      const schedEndMs = new Date(settings.end_time).getTime();
      if (!isNaN(schedEndMs)) {
        deadlineMs = Math.min(deadlineMs, schedEndMs);
      }
    }

    sessionStartMsRef.current = startMs;
    hardDeadlineMsRef.current = deadlineMs;
    answersRef.current = restoredAnswers;
    countsRef.current = {
      tab: 0,
      copy: 0,
      total: 0,
      max: Number(settings.max_violations) || 3,
    };
    identityRef.current = {
      name: cleanName,
      nim: cleanNim,
      quizId: cleanQuizId,
      kelas: studentKelas,
      attempt: attemptNum,
      totalQ: questions.length,
      questionTexts: qTexts,
    };
    questionTimingsRef.current = questions.map((q, idx) => ({
      qNum: idx + 1,
      qText: q.question_text || `Soal ${idx + 1}`,
      totalSeconds: 0,
      switchCount: idx === 0 ? 1 : 0,
    }));
    activeQuestionIndexRef.current = 0;
    activityLogRef.current = [
      {
        type: 'START',
        questionNum: 1,
        questionText: studentCheck.isRetake
          ? 'Memulai sesi RETAKE kuis (Kesempatan ke-2)'
          : 'Memulai sesi ujian',
        elapsedSeconds: 0,
        timestamp: Date.now(),
        timestampISO: new Date().toISOString(),
      },
    ];
    isSubmittingRef.current = false;
    isExamActiveRef.current = true;

    setAnswers(restoredAnswers);
    setRemainingSec(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
    setStage('EXAM');
  };

  // Exam Countdown, Per-Question Timing & Heartbeat Loop
  useEffect(() => {
    if (stage !== 'EXAM') return;

    sendHeartbeat('ACTIVE');

    const oneSecTimer = setInterval(() => {
      if (!isExamActiveRef.current || isSubmittingRef.current) return;

      const curIdx = activeQuestionIndexRef.current || 0;
      if (questionTimingsRef.current[curIdx]) {
        questionTimingsRef.current[curIdx].totalSeconds += 1;
      }

      const rem = Math.max(
        0,
        Math.ceil((hardDeadlineMsRef.current - Date.now()) / 1000)
      );
      setRemainingSec(rem);

      if (rem <= 0) {
        executeSubmitQuiz(
          'TIME_EXPIRED',
          'Waktu ujian habis (Auto-Submit TIME_EXPIRED)'
        );
      }
    }, 1000);

    const hbTimer = setInterval(() => {
      if (isExamActiveRef.current && !isSubmittingRef.current) {
        sendHeartbeat('ACTIVE');
      }
    }, 4000);

    return () => {
      clearInterval(oneSecTimer);
      clearInterval(hbTimer);
    };
  }, [stage, sendHeartbeat, executeSubmitQuiz]);

  // Anti-Cheat Visibility & Blur Listeners
  useEffect(() => {
    if (stage !== 'EXAM') return;
    let lastSwitchMs = 0;

    const onVisChange = () => {
      if (document.hidden && Date.now() - lastSwitchMs > 1200) {
        lastSwitchMs = Date.now();
        recordViolation('TAB_SWITCH', 'Berpindah tab browser atau minimize jendela');
      }
    };

    const onWindowBlur = () => {
      if (Date.now() - lastSwitchMs > 1200) {
        lastSwitchMs = Date.now();
        recordViolation('WINDOW_BLUR', 'Keluar dari fokus jendela ujian');
      }
    };

    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [stage, recordViolation]);

  // Question Change & Auto-Save to localStorage
  const handleAnswerChange = useCallback((qNum, text) => {
    setAnswers((prev) => {
      const next = { ...prev, [qNum]: text };
      answersRef.current = next;
      try {
        const draftKey = `quiz_draft_${identityRef.current.nim}_${identityRef.current.quizId}`;
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            sessionStartMs: sessionStartMsRef.current,
            answers: next,
            updatedAt: Date.now(),
          })
        );
        setSaveStatus(
          `Tersimpan ${new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}`
        );
      } catch (_) {}
      return next;
    });
  }, []);

  const handleFocusQuestion = useCallback(
    (qNum) => {
      const idx = qNum - 1;
      if (activeQuestionIndexRef.current !== idx) {
        activeQuestionIndexRef.current = idx;
        if (questionTimingsRef.current[idx]) {
          questionTimingsRef.current[idx].switchCount =
            (questionTimingsRef.current[idx].switchCount || 0) + 1;
        }
        sendHeartbeat('ACTIVE', {
          type: 'QUESTION_SWITCH',
          questionNum: qNum,
          questionText: `Pindah mengerjakan Soal #${qNum}`,
        });
      }
    },
    [sendHeartbeat]
  );

  const handleBlockClipboard = useCallback(
    (e, label) => {
      e.preventDefault();
      recordViolation('COPY_PASTE', label);
    },
    [recordViolation]
  );

  return (
    <div>
      {stage === 'LOGIN' && (
        <div className="login-wrapper">
          <div className="login-card">
            <div className="brand-header">
              <div className="brand-logo">🎓</div>
              <div>
                <h1>Portal Ujian Mahasiswa</h1>
                <p>Sistem Ujian Essay Terproteksi Anti-Kecurangan</p>
              </div>
            </div>

            <form onSubmit={handleStartExam}>
              {/* ======================================================== */}
              {/* MASUKKAN NOMOR INDUK MAHASISWA (NIM)                     */}
              {/* ======================================================== */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b', marginBottom: 6, display: 'block' }}>
                  🎓 Masukkan Nomor Induk Mahasiswa (NIM)
                </label>
                <div style={{ width: '100%', position: 'relative' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    className="form-input"
                    required
                    placeholder="Ketik NIM Anda"
                    value={nim}
                    onChange={(e) => setNim(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '1rem',
                      fontWeight: 600,
                      padding: '11px 14px',
                      borderColor: studentCheck.verified ? '#22c55e' : studentCheck.error ? '#ef4444' : '#cbd5e1',
                      background: studentCheck.verified ? '#f0fdf4' : '#ffffff',
                    }}
                  />
                  {nim && (
                    <button
                      type="button"
                      onClick={() => {
                        setNim('');
                        setStudentName('');
                        setStudentCheck({
                          loading: false,
                          verified: false,
                          student: null,
                          canStart: false,
                          attemptNumber: 1,
                          isRetake: false,
                          warningMessage: null,
                          error: '',
                        });
                      }}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: '#e2e8f0',
                        border: 'none',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        cursor: 'pointer',
                        color: '#475569',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Hapus NIM"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 4 }}>
                  {studentCheck.loading ? (
                    <span style={{ color: '#2563eb' }}>⏳ Memeriksa NIM di database...</span>
                  ) : studentCheck.verified ? null : (
                    <span>Ketik NIM Anda terlebih dahulu untuk validasi data mahasiswa.</span>
                  )}
                </div>
              </div>

              {/* Status Error Jika NIM Tidak Ditemukan di Database */}
              {studentCheck.error && !studentCheck.verified && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #fca5a5',
                    color: '#991b1b',
                    borderRadius: 10,
                    padding: '12px 14px',
                    fontSize: '0.84rem',
                    marginBottom: 16,
                    lineHeight: 1.45,
                  }}
                >
                  <strong>⛔ NIM Tidak Ditemukan:</strong>
                  <div style={{ marginTop: 4 }}>{studentCheck.error}</div>
                </div>
              )}

              {/* Card Mahasiswa Terverifikasi dari Database (Tanpa Informasi Kelas) */}
              {studentCheck.verified && studentCheck.student && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    border: '1.5px solid #4ade80',
                    borderRadius: 12,
                    padding: '12px 16px',
                    marginBottom: 16,
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.08)',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#15803d', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>✅</span> MAHASISWA TERVERIFIKASI
                  </div>
                  <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>
                    {studentCheck.student.nama}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                    NIM: <strong>{studentCheck.student.nim}</strong>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* MASUKKAN ID QUIZ / KODE SESI UJIAN                      */}
              {/* ======================================================== */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label
                    style={{
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      color: studentCheck.verified ? '#1e293b' : '#94a3b8',
                    }}
                  >
                    🔑 Masukkan ID Quiz / Kode Ujian
                  </label>
                  {quizId.trim() && scheduleState.valid && (
                    <span className="badge badge-info" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                      Quiz #{quizId}
                    </span>
                  )}
                </div>
                <div style={{ width: '100%', position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    required
                    disabled={!studentCheck.verified}
                    placeholder={studentCheck.verified ? 'Ketik ID Quiz' : 'Masukkan NIM terlebih dahulu'}
                    value={quizId}
                    onChange={(e) => setQuizId(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '1rem',
                      fontWeight: 600,
                      padding: '11px 14px',
                      borderColor:
                        !studentCheck.verified
                          ? '#e2e8f0'
                          : scheduleState.valid
                          ? '#22c55e'
                          : quizId.trim() && !scheduleState.loading
                          ? '#ef4444'
                          : '#cbd5e1',
                      background: !studentCheck.verified ? '#f8fafc' : '#ffffff',
                      cursor: !studentCheck.verified ? 'not-allowed' : 'text',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 4 }}>
                  {!studentCheck.verified ? (
                    <span>Langkah ini akan aktif setelah NIM Anda berhasil terverifikasi.</span>
                  ) : scheduleState.loading ? (
                    <span style={{ color: '#2563eb' }}>⏳ Mengecek ketersediaan ID Quiz di database...</span>
                  ) : quizId.trim() && !scheduleState.valid ? (
                    <span style={{ color: '#dc2626' }}>❌ ID Quiz tidak ditemukan di database atau belum memiliki soal.</span>
                  ) : quizId.trim() && scheduleState.valid ? (
                    <span style={{ color: '#16a34a' }}>
                      ✅ ID Quiz valid ({scheduleState.questions.length} Soal • {scheduleState.settings?.duration_minutes || 60} Menit).
                    </span>
                  ) : (
                    <span>Ketik kode kuis yang diberikan oleh Dosen pengampu.</span>
                  )}
                </div>
              </div>

              {/* Status Validasi ID Quiz & Cek Attempt Sesi Mahasiswa */}
              {studentCheck.verified && quizId.trim() && scheduleState.valid && (
                <div>
                  {/* Kondisi 1: Mahasiswa Diizinkan Mulai (Attempt 1 atau Retake ke-2) */}
                  {studentCheck.canStart && (
                    <div
                      style={{
                        background: studentCheck.isRetake
                          ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)'
                          : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        border: `1.5px solid ${studentCheck.isRetake ? '#f59e0b' : '#4ade80'}`,
                        borderRadius: 12,
                        padding: '12px 16px',
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            color: studentCheck.isRetake ? '#b45309' : '#15803d',
                          }}
                        >
                          {studentCheck.isRetake ? '⚠️ ACC RETAKE KUIS (KE-2)' : '✅ SIAP DIKERJAKAN'}
                        </span>
                        <span
                          className={studentCheck.isRetake ? 'badge badge-warning' : 'badge badge-success'}
                          style={{ fontSize: '0.76rem', fontWeight: 800 }}
                        >
                          {studentCheck.isRetake ? 'Percobaan 2 / 2' : 'Percobaan 1 / 2'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.84rem', color: '#1e293b' }}>
                        Tersedia <strong>{scheduleState.questions.length} Soal Essay</strong> • Durasi <strong>{scheduleState.settings?.duration_minutes || 60} Menit</strong>
                      </div>
                      {studentCheck.isRetake && (
                        <div
                          style={{
                            fontSize: '0.76rem',
                            color: '#b45309',
                            marginTop: 6,
                            background: '#ffffff',
                            border: '1px solid #fde68a',
                            padding: '6px 10px',
                            borderRadius: 6,
                          }}
                        >
                          ⚠️ Anda terdeteksi pernah didiskualifikasi pada percobaan pertama kuis #{quizId}. Ini adalah <strong>kesempatan terakhir</strong> Anda!
                        </div>
                      )}
                    </div>
                  )}

                  {/* Kondisi 2: Mahasiswa Ditolak Karena Sudah Pernah Attempt atau Sesi Duplikat Aktif */}
                  {!studentCheck.canStart && (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1.5px solid #f87171',
                        borderRadius: 12,
                        padding: '14px 16px',
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#991b1b' }}>
                          ⛔ AKSES DITOLAK UNTUK KUIS #{quizId}
                        </span>
                        <span className="badge badge-danger" style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                          Attempt Dibatasi
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#b91c1c', lineHeight: 1.45 }}>
                        {studentCheck.warningMessage || studentCheck.error || `Mahasiswa sudah pernah mengerjakan kuis #${quizId}. Tidak diizinkan mengulang.`}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status Error jika ID Quiz Tidak Ada di Database */}
              {studentCheck.verified && quizId.trim() && !scheduleState.loading && !scheduleState.valid && scheduleState.message && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #fca5a5',
                    color: '#991b1b',
                    borderRadius: 10,
                    padding: '12px 14px',
                    fontSize: '0.84rem',
                    marginBottom: 16,
                    lineHeight: 1.45,
                  }}
                >
                  <strong>⛔ Kuis Tidak Tersedia:</strong>
                  <div style={{ marginTop: 4 }}>{scheduleState.message}</div>
                </div>
              )}

              {/* ======================================================== */}
              {/* LANGKAH 3: TOMBOL MULAI UJIAN                             */}
              {/* ======================================================== */}
              <button
                type="submit"
                className="btn btn-touchable btn-primary"
                disabled={
                  !studentCheck.verified ||
                  !quizId.trim() ||
                  !scheduleState.valid ||
                  scheduleState.loading ||
                  !studentCheck.canStart ||
                  studentCheck.loading
                }
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '14px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  opacity:
                    !studentCheck.verified ||
                    !quizId.trim() ||
                    !scheduleState.valid ||
                    scheduleState.loading ||
                    !studentCheck.canStart ||
                    studentCheck.loading
                      ? 0.6
                      : 1,
                  cursor:
                    !studentCheck.verified ||
                    !quizId.trim() ||
                    !scheduleState.valid ||
                    scheduleState.loading ||
                    !studentCheck.canStart ||
                    studentCheck.loading
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {studentCheck.loading || scheduleState.loading
                  ? '⏳ Memeriksa Data & Sesi...'
                  : !nim.trim()
                  ? 'Masukkan NIM Terlebih Dahulu'
                  : !studentCheck.verified
                  ? 'NIM Tidak Terdaftar di Database'
                  : !quizId.trim()
                  ? 'Masukkan ID Quiz'
                  : !scheduleState.valid
                  ? 'ID Quiz Tidak Ditemukan di Database'
                  : !studentCheck.canStart
                  ? 'Sudah Pernah Mengerjakan Kuis Ini'
                  : studentCheck.isRetake
                  ? 'Mulai Kerjakan Retake Ujian (Ke-2)'
                  : 'Mulai Kerjakan Ujian Sekarang'}
              </button>
            </form>
          </div>
        </div>
      )}

      {stage === 'EXAM' && (
        <div>
          <StickyExamHeader
            studentName={studentName}
            nim={nim}
            quizId={quizId}
            saveStatus={saveStatus}
            remainingSec={remainingSec}
            violationCount={violationCount}
            maxViolations={countsRef.current.max}
          />

          <div className="exam-container">
            {scheduleState.questions.map((q, idx) => (
              <QuestionCard
                key={q.id || idx}
                index={idx}
                question={q}
                value={answers[idx + 1] || ''}
                onChange={handleAnswerChange}
                onFocusQuestion={handleFocusQuestion}
                onBlockClipboard={handleBlockClipboard}
              />
            ))}

            <div className="submit-footer-card">
              <div className="submit-info">
                Pastikan seluruh jawaban telah terisi. Klik tombol di samping untuk
                mengirim jawaban langsung ke server tanpa popup konfirmasi.
              </div>
              <button
                type="button"
                className="btn-touchable"
                style={{ width: 'auto', minWidth: 220 }}
                disabled={submitting}
                onClick={() =>
                  executeSubmitQuiz('COMPLETED', 'Dikirim langsung oleh mahasiswa')
                }
              >
                {submitting ? 'Mengirim Jawaban...' : 'Kirim Jawaban Ujian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'FINISHED' && finishSummary && (
        <div className="login-wrapper">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 10 }}>
              {finishSummary.finalStatus === 'DISQUALIFIED'
                ? '⛔'
                : finishSummary.sentSuccess
                ? '✅'
                : '⚠️'}
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 6 }}>
              {finishSummary.finalStatus === 'DISQUALIFIED'
                ? 'Sesi Ujian Didiskualifikasi'
                : finishSummary.sentSuccess
                ? 'Jawaban Berhasil Terkirim!'
                : 'Jawaban Disimpan di Antrean Offline'}
            </h2>
            <p style={{ fontSize: '0.86rem', color: '#64748b', marginBottom: 18 }}>
              {finishSummary.reasonLabel}
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16,
                textAlign: 'left',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 18,
              }}
            >
              <div>
                <strong>Nama / NIM:</strong> {studentName} ({nim})
              </div>
              <div>
                <strong>Quiz ID:</strong> #{quizId}
              </div>
              <div>
                <strong>Total Durasi:</strong>{' '}
                {formatDuration(finishSummary.durationSeconds)}
              </div>
              <div>
                <strong>Total Pelanggaran:</strong> {finishSummary.violations}x
              </div>
            </div>

            {!finishSummary.sentSuccess && (
              <button
                type="button"
                className="btn-touchable"
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const res = await fetch(`${API_BASE}/v1/quiz/submit`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(finishSummary.payload),
                    });
                    if (res.ok) {
                      localStorage.removeItem(finishSummary.pendingKey);
                      setFinishSummary((prev) => ({ ...prev, sentSuccess: true }));
                    }
                  } catch (_) {}
                  setSubmitting(false);
                }}
                disabled={submitting}
              >
                {submitting ? 'Mencoba Kirim Ulang...' : 'Kirim Ulang Jawaban Sekarang'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* NON-BLOCKING TOASTS */}
      <div className="toast-stack-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast-alert">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
