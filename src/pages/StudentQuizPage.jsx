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
  const [quizId, setQuizId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('quizId') || '';
  });

  // Schedule & Validation Info
  const [scheduleState, setScheduleState] = useState({
    loading: false,
    valid: false,
    message: 'Masukkan Nomor / ID Quiz untuk mengecek ketersediaan soal.',
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

  // Verifikasi peserta kuis PPK, cegah duplikat sesi & periksa jatah kesempatan (Max 2x)
  useEffect(() => {
    if (stage !== 'LOGIN') return;
    const cleanNim = nim.trim();
    const cleanQuizId = quizId.trim();

    if (!cleanNim || cleanNim.length < 5) {
      setStudentCheck({
        loading: false,
        verified: false,
        student: null,
        canStart: true,
        attemptNumber: 1,
        isRetake: false,
        warningMessage: null,
        error: '',
      });
      return;
    }

    const timer = setTimeout(async () => {
      setStudentCheck((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const res = await fetch(
          `${API_BASE}/v1/quiz/check-student?nim=${encodeURIComponent(
            cleanNim
          )}&quizId=${encodeURIComponent(cleanQuizId)}`
        );
        const data = await res.json();
        if (res.ok && data.status === 'success' && data.student) {
          setStudentCheck({
            loading: false,
            verified: true,
            student: data.student,
            canStart: data.canStart,
            attemptNumber: data.attemptNumber,
            isRetake: data.isRetake,
            warningMessage: data.warningMessage,
            error: '',
          });
          setStudentName(data.student.nama);
        } else {
          setStudentCheck({
            loading: false,
            verified: false,
            student: (data && data.student) || null,
            canStart: false,
            attemptNumber: (data && data.attemptNumber) || 1,
            isRetake: false,
            warningMessage: null,
            error:
              (data && data.message) ||
              'NIM tidak terdaftar sebagai peserta mata kuliah PPK.',
          });
        }
      } catch (err) {
        setStudentCheck((prev) => ({
          ...prev,
          loading: false,
          error: 'Gagal memverifikasi NIM: ' + err.message,
        }));
      }
    }, 350);

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
              <div className="form-group">
                <label>Nomor / ID Quiz</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Masukkan ID Quiz dari Dosen (misal: 101)"
                  value={quizId}
                  onChange={(e) => setQuizId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Nomor Induk Mahasiswa (NIM)</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Contoh: 24060124130080"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Nama Lengkap Mahasiswa</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Nama otomatis terisi setelah input NIM valid..."
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  readOnly={studentCheck.verified}
                  style={studentCheck.verified ? { background: '#f8fafc', fontWeight: 600 } : {}}
                />
              </div>

              {/* Status Verifikasi Peserta PPK & Kesempatan */}
              {studentCheck.loading && (
                <div style={{ fontSize: '0.82rem', color: '#64748b', padding: '8px 10px', background: '#f1f5f9', borderRadius: 8, marginBottom: 12 }}>
                  ⏳ Memverifikasi data peserta & izin sesi...
                </div>
              )}

              {studentCheck.verified && studentCheck.student && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#166534' }}>
                      ✅ Terdaftar di Kelas PPK
                    </span>
                    <span
                      className="badge badge-success"
                      style={{ fontSize: '0.8rem', fontWeight: 800, padding: '3px 8px' }}
                    >
                      Kelas {studentCheck.student.kelas}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#15803d', lineHeight: 1.5 }}>
                    <strong>{studentCheck.student.nama}</strong> ({studentCheck.student.nim})<br />
                    Prodi: {studentCheck.student.prodi || 'Informatika'}
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #bbf7d0' }}>
                    {studentCheck.isRetake ? (
                      <div>
                        <span className="badge badge-warning" style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                          🔁 Retake Kuis (Kesempatan ke-2 dari 2)
                        </span>
                        <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 4, lineHeight: 1.4 }}>
                          ⚠️ Anda terdeteksi pernah didiskualifikasi sebelumnya. Diberikan izin untuk mengerjakan ulang 1x lagi. Ini adalah <strong>kesempatan terakhir</strong> Anda!
                        </div>
                      </div>
                    ) : (
                      <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>
                        🎯 Percobaan Pertama (Kesempatan 1 dari 2)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {studentCheck.error && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    borderRadius: 8,
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    marginBottom: 14,
                    lineHeight: 1.4,
                  }}
                >
                  <strong>⛔ Akses Masuk Ditolak:</strong> {studentCheck.error}
                </div>
              )}

              {studentCheck.warningMessage && !studentCheck.error && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    marginBottom: 14,
                  }}
                >
                  ⚠️ {studentCheck.warningMessage}
                </div>
              )}

              <div className={`schedule-banner ${scheduleState.type}`}>
                {scheduleState.message}
              </div>

              <button
                type="submit"
                className="btn btn-touchable btn-primary"
                disabled={
                  !scheduleState.valid ||
                  scheduleState.loading ||
                  !studentCheck.canStart ||
                  !studentCheck.verified ||
                  studentCheck.loading
                }
                style={{
                  justifyContent: 'center',
                  padding: '12px',
                  marginTop: 6,
                  opacity:
                    !scheduleState.valid ||
                    scheduleState.loading ||
                    !studentCheck.canStart ||
                    !studentCheck.verified ||
                    studentCheck.loading
                      ? 0.6
                      : 1,
                  cursor:
                    !scheduleState.valid ||
                    scheduleState.loading ||
                    !studentCheck.canStart ||
                    !studentCheck.verified ||
                    studentCheck.loading
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {scheduleState.loading || studentCheck.loading
                  ? 'Memeriksa Verifikasi & Jadwal...'
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
