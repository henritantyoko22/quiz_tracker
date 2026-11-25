import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE, getAuthHeaders, toLocalISOString } from '../../services/api.js';

export function UnifiedQuizManager({ token, quizList, onRefreshQuizList, showToast }) {
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [newQuizInput, setNewQuizInput] = useState('');
  const [quizSearch, setQuizSearch] = useState('');

  // Timer & Schedule state
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [maxViolations, setMaxViolations] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [mataKuliah, setMataKuliah] = useState('PPK');
  const [requireLocation, setRequireLocation] = useState(true);
  const [targetRadiusMeters, setTargetRadiusMeters] = useState(450);
  const [questionCount, setQuestionCount] = useState(0);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);

  // Gemini AI Auto-Grading state
  const [gradingRubric, setGradingRubric] = useState('');
  const [autoGrade, setAutoGrade] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [availableModelList, setAvailableModelList] = useState([]);
  const [keyTestStatus, setKeyTestStatus] = useState(null);

  const handleTestApiKey = async () => {
    const key = (geminiApiKey || '').trim();
    if (!key) {
      showToast('Masukkan Gemini API Key terlebih dahulu untuk ditest.', 'error');
      return;
    }
    setTestingKey(true);
    setKeyTestStatus(null);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/gemini/test`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(data.message, 'success');
        setKeyTestStatus({ ok: true, msg: data.message });
        if (Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModelList(data.models);
          // Jika model yang sekarang tidak ada di daftar model aktif akun, otomatis pilih yang pertama
          if (!data.models.some((m) => m.id === geminiModel)) {
            setGeminiModel(data.models[0].id);
          }
        }
      } else {
        const errMsg = data.message || 'Gagal memverifikasi API Key.';
        showToast(errMsg, 'error');
        setKeyTestStatus({ ok: false, msg: errMsg, hint: data.hint });
      }
    } catch (err) {
      showToast('Koneksi gagal: ' + err.message, 'error');
      setKeyTestStatus({ ok: false, msg: err.message });
    } finally {
      setTestingKey(false);
    }
  };

  // Questions state
  const [questions, setQuestions] = useState([]);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [editorMode, setEditorMode] = useState('VISUAL'); // VISUAL | JSON
  const [jsonText, setJsonText] = useState('');
  const prevLoadedQuizIdRef = useRef('');

  // Urutkan daftar kuis dari yang terbaru ke terlama berdasarkan updated_at / start_time
  const sortedQuizList = useMemo(() => {
    const list = [...(quizList || [])];
    list.sort((a, b) => {
      const aTime = a.updated_at
        ? new Date(a.updated_at).getTime()
        : a.start_time
        ? new Date(a.start_time).getTime()
        : 0;
      const bTime = b.updated_at
        ? new Date(b.updated_at).getTime()
        : b.start_time
        ? new Date(b.start_time).getTime()
        : 0;
      if (bTime !== aTime) return bTime - aTime;
      return String(b.quiz_id).localeCompare(String(a.quiz_id));
    });
    return list;
  }, [quizList]);

  // Filter pencarian kuis di sidebar
  const filteredSidebarQuizzes = useMemo(() => {
    const q = quizSearch.trim().toLowerCase();
    if (!q) return sortedQuizList;
    return sortedQuizList.filter(
      (item) =>
        String(item.quiz_id).toLowerCase().includes(q) ||
        String(item.mata_kuliah || '').toLowerCase().includes(q)
    );
  }, [sortedQuizList, quizSearch]);

  useEffect(() => {
    if (!selectedQuizId && sortedQuizList.length > 0) {
      setSelectedQuizId(String(sortedQuizList[0].quiz_id));
    }
  }, [sortedQuizList, selectedQuizId]);

  const loadQuizDetails = useCallback(
    async (qId) => {
      if (!qId) return;
      setLoadingQuiz(true);
      try {
        // Check metadata from quizList first as fallback
        const listMeta = quizList.find(
          (item) => String(item.quiz_id) === String(qId)
        );

        const [setRes, qRes] = await Promise.all([
          fetch(`${API_BASE}/v1/quiz/settings/${encodeURIComponent(qId)}`),
          fetch(`${API_BASE}/v1/quiz/questions/${encodeURIComponent(qId)}?all=true`),
        ]);
        const setData = await setRes.json();
        const qData = await qRes.json();

        const s = (setData && setData.data) || listMeta || null;
        if (s) {
          setDurationMinutes(s.duration_minutes ?? 30);
          setMaxViolations(s.max_violations ?? 3);
          setIsActive(s.is_active !== false);
          setStartTime(toLocalISOString(s.start_time));
          setEndTime(toLocalISOString(s.end_time));
          setMataKuliah(s.mata_kuliah || 'PPK');
          setGradingRubric(s.grading_rubric || '');
          setAutoGrade(Boolean(s.auto_grade));
          setGeminiApiKey(s.gemini_api_key || '');
          setGeminiModel(
            s.gemini_model && s.gemini_model !== 'gemini-1.5-flash'
              ? s.gemini_model
              : 'gemini-2.5-flash'
          );
          setRequireLocation(s.require_location !== false);
          setTargetRadiusMeters(s.target_radius_meters ?? 450);
          setQuestionCount(s.question_count || 0);
          setShuffleQuestions(Boolean(s.shuffle_questions));
        } else {
          setDurationMinutes(30);
          setMaxViolations(3);
          setIsActive(true);
          setStartTime('');
          setEndTime('');
          setMataKuliah('PPK');
          setGradingRubric('');
          setAutoGrade(false);
          setRequireLocation(true);
          setTargetRadiusMeters(450);
          setQuestionCount(0);
          setShuffleQuestions(false);
        }

        const rawQuestions = Array.isArray(qData.data) ? qData.data : [];
        const loadedQuestions = rawQuestions.map((q) => ({
          id: q.id,
          questionText: q.question_text || '',
          questionType: q.question_type || 'ESSAY',
          expectedAnswer: q.expected_answer || '',
        }));

        setQuestions(
          loadedQuestions.length > 0
            ? loadedQuestions
            : [{ questionText: '', questionType: 'ESSAY', expectedAnswer: '' }]
        );
        setJsonText(
          JSON.stringify(
            loadedQuestions.map((q) => ({
              question_text: q.questionText,
              question_type: q.questionType,
              expected_answer: q.expectedAnswer,
            })),
            null,
            2
          )
        );
      } catch (_) {
        showToast('Gagal memuat detail Quiz ID ' + qId, 'error');
      } finally {
        setLoadingQuiz(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (selectedQuizId && selectedQuizId !== prevLoadedQuizIdRef.current) {
      prevLoadedQuizIdRef.current = selectedQuizId;
      loadQuizDetails(selectedQuizId);
    }
  }, [selectedQuizId, loadQuizDetails]);

  const handleCreateNewQuizId = (e) => {
    e.preventDefault();
    const trimmed = newQuizInput.trim();
    if (!trimmed) return;
    setSelectedQuizId(trimmed);
    setNewQuizInput('');
    setDurationMinutes(30);
    setMaxViolations(3);
    setIsActive(true);
    setStartTime('');
    setEndTime('');
    setGradingRubric('');
    setAutoGrade(false);
    setQuestions([{ questionText: '', questionType: 'ESSAY', expectedAnswer: '' }]);
    setJsonText('[\n  {\n    "question_text": "Tuliskan pertanyaan soal 1...",\n    "expected_answer": "Kunci jawaban atau poin konsep yang diharapkan..."\n  }\n]');
  };

  const handleQuestionChange = (index, value) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], questionText: value };
      return copy;
    });
  };

  const handleExpectedAnswerChange = (index, value) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], expectedAnswer: value };
      return copy;
    });
  };

  const handleAddQuestionRow = () => {
    setQuestions((prev) => [...prev, { questionText: '', questionType: 'ESSAY', expectedAnswer: '' }]);
  };

  const handleRemoveQuestionRow = async (index) => {
    const target = questions[index];
    if (target && target.id) {
      try {
        await fetch(`${API_BASE}/v1/admin/questions/${target.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(token),
        });
      } catch (_) {}
    }
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ questionText: '', questionType: 'ESSAY', expectedAnswer: '' }];
    });
  };

  const handleSaveTimerAndQuestions = async () => {
    if (!selectedQuizId) {
      showToast('Pilih atau buat Quiz ID terlebih dahulu!', 'error');
      return;
    }

    let finalQuestions = [];
    if (editorMode === 'JSON') {
      try {
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) throw new Error('Format JSON harus berupa Array');
        finalQuestions = parsed
          .map((item) => ({
            question_text: String(
              item.question_text || item.questionText || item.question || ''
            ).trim(),
            question_type: item.question_type || item.questionType || 'ESSAY',
            expected_answer: String(
              item.expected_answer || item.expectedAnswer || item.kunci_jawaban || ''
            ).trim(),
          }))
          .filter((q) => q.question_text.length > 0);
      } catch (err) {
        showToast('Format JSON tidak valid: ' + err.message, 'error');
        return;
      }
    } else {
      finalQuestions = questions
        .map((q) => ({
          question_text: String(q.questionText || '').trim(),
          question_type: q.questionType || 'ESSAY',
          expected_answer: String(q.expectedAnswer || '').trim(),
        }))
        .filter((q) => q.question_text.length > 0);
    }

    setSavingAll(true);
    try {
      // 1. Save Timer & Schedule Settings
      const settingsRes = await fetch(`${API_BASE}/v1/admin/quiz/settings`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          quizId: selectedQuizId,
          mataKuliah: mataKuliah || 'PPK',
          durationMinutes: Number(durationMinutes) || 30,
          maxViolations: Number(maxViolations) || 3,
          isActive: Boolean(isActive),
          startTime: startTime ? new Date(startTime).toISOString() : null,
          endTime: endTime ? new Date(endTime).toISOString() : null,
          gradingRubric,
          autoGrade: Boolean(autoGrade),
          geminiApiKey,
          geminiModel,
          requireLocation: Boolean(requireLocation),
          targetLat: -7.050500,
          targetLng: 110.443800,
          targetRadiusMeters: Number(targetRadiusMeters) || 450,
          targetLocationName: 'Fakultas Sains dan Matematika (FSM) Undip',
          questionCount: Number(questionCount) || 0,
          shuffleQuestions: Boolean(shuffleQuestions),
        }),
      });
      const settingsData = await settingsRes.json();
      if (!settingsRes.ok) {
        throw new Error(settingsData.message || 'Gagal menyimpan pengaturan timer');
      }

      // 2. Save Questions
      if (finalQuestions.length > 0) {
        const qRes = await fetch(`${API_BASE}/v1/admin/questions/import`, {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify({
            quizId: selectedQuizId,
            questions: finalQuestions,
            replaceExisting: true,
          }),
        });
        const qData = await qRes.json();
        if (!qRes.ok) {
          throw new Error(qData.message || 'Gagal menyimpan daftar soal');
        }
      }

      showToast(
        `Berhasil menyimpan Pengaturan Timer & ${finalQuestions.length} Soal untuk Quiz #${selectedQuizId}!`,
        'success'
      );
      await onRefreshQuizList();
      await loadQuizDetails(selectedQuizId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="quiz-manager-grid">
      {/* LEFT SIDEBAR: LIST OF CREATED QUIZ IDs */}
      <div className="quiz-sidebar">
        <div className="quiz-sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
              📚 Daftar Quiz ID ({sortedQuizList.length})
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6366f1', background: '#e0e7ff', padding: '1px 6px', borderRadius: 4 }}>
              Terbaru di atas
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
            Pilih ID Quiz di bawah untuk edit soal & timer
          </div>

          {/* Quick Search Quiz ID */}
          <div style={{ position: 'relative', marginTop: 10, marginBottom: 8 }}>
            <input
              type="text"
              placeholder="🔍 Cari Quiz ID / Matkul..."
              value={quizSearch}
              onChange={(e) => setQuizSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 7,
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                background: '#ffffff',
                boxSizing: 'border-box',
              }}
            />
            {quizSearch && (
              <button
                type="button"
                onClick={() => setQuizSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  padding: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Form Buat ID Quiz Baru */}
          <form
            onSubmit={handleCreateNewQuizId}
            style={{ display: 'flex', gap: 6 }}
          >
            <input
              type="text"
              placeholder="+ Buat ID Quiz baru..."
              value={newQuizInput}
              onChange={(e) => setNewQuizInput(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 7,
                border: '1px solid #cbd5e1',
                fontSize: '0.78rem',
                boxSizing: 'border-box',
              }}
            />
            <button type="submit" className="btn btn-primary btn-xs" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
              + Buat
            </button>
          </form>
        </div>

        <div className="quiz-sidebar-list">
          {filteredSidebarQuizzes.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                fontSize: '0.8rem',
                color: '#94a3b8',
              }}
            >
              {quizSearch ? 'Tidak ada Quiz ID yang cocok.' : 'Belum ada Quiz ID. Buat baru di atas.'}
            </div>
          ) : (
            filteredSidebarQuizzes.map((item, idx) => {
              const isSelected = String(item.quiz_id) === String(selectedQuizId);
              const isLatest = idx === 0 && !quizSearch;
              const courseName = String(item.mata_kuliah || 'PPK').toUpperCase();
              const isIot = courseName.includes('IOT');
              const isAlgo = courseName.includes('ALGO');

              return (
                <div
                  key={item.quiz_id}
                  className={`quiz-list-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedQuizId(String(item.quiz_id))}
                  style={{
                    position: 'relative',
                    padding: '11px 13px',
                    borderRadius: 10,
                    marginBottom: 7,
                    cursor: 'pointer',
                    transition: 'all 0.16s ease',
                    background: isSelected ? '#eef2ff' : '#ffffff',
                    border: isSelected ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                    boxShadow: isSelected ? '0 2px 8px rgba(79, 70, 229, 0.14)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: isSelected ? '#4338ca' : '#0f172a' }}>
                        Quiz #{item.quiz_id}
                      </span>
                      {isLatest && (
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            background: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            padding: '1px 5px',
                          }}
                        >
                          ⚡ TERBARU
                        </span>
                      )}
                    </div>
                    <span
                      className={`badge ${item.is_active === false ? 'badge-danger' : 'badge-success'}`}
                      style={{ fontSize: '0.68rem', fontWeight: 800 }}
                    >
                      {item.is_active === false ? 'TUTUP' : 'AKTIF'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <span
                      style={{
                        fontSize: '0.73rem',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>📝 {item.total_questions || 0} Soal</span>
                      <span>•</span>
                      <span>⏱️ {item.duration_minutes || 60}m</span>
                    </span>

                    <span
                      className="badge"
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        background: isIot ? '#e0f2fe' : isAlgo ? '#f3e8ff' : '#e0e7ff',
                        color: isIot ? '#0369a1' : isAlgo ? '#7e22ce' : '#4338ca',
                        border: `1px solid ${isIot ? '#bae6fd' : isAlgo ? '#e9d5ff' : '#c7d2fe'}`,
                        padding: '1px 6px',
                      }}
                    >
                      {isIot ? '📡 IoT' : isAlgo ? '🧬 Algo' : '📚 PPK'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT CONTENT: UNIFIED TIMER + QUESTION EDITOR */}
      <div className="quiz-editor-panel">
        <div className="quiz-editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
              ⚙️ Kelola Quiz #{selectedQuizId || '-'}
            </span>
            {loadingQuiz && (
              <span className="badge badge-info">Memuat data...</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveTimerAndQuestions}
              disabled={savingAll || !selectedQuizId}
            >
              {savingAll ? '⏳ Menyimpan...' : '💾 Simpan Timer & Daftar Soal'}
            </button>
          </div>
        </div>

        <div className="quiz-editor-body">
          {/* SECTION 1: TIMER & JADWAL UJIAN */}
          <div className="form-section-card">
            <div className="form-section-title">
              <span>⏱️ Pengaturan Timer, Jadwal & Batas Pelanggaran</span>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Status Ujian Dibuka (Aktif)
              </label>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span>📚</span> Mata Kuliah Kuis Ini:
              </label>
              <select
                className="filter-select"
                style={{ width: '100%', maxWidth: 380, padding: '8px 12px', fontSize: '0.86rem', fontWeight: 700 }}
                value={mataKuliah}
                onChange={(e) => setMataKuliah(e.target.value)}
              >
                <option value="PPK">⚙️ Pengembangan Perangkat Keras (PPK)</option>
                <option value="IoT">📡 Internet of Things (IoT)</option>
                <option value="Algoritma Evolusioner">🧬 Algoritma Evolusioner</option>
              </select>
            </div>

            <div className="form-grid-4">
              <div className="field-group">
                <label>Durasi Ujian (Menit)</label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Batas Maks Pelanggaran</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxViolations}
                  onChange={(e) => setMaxViolations(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Waktu Buka (Opsional)</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Waktu Tutup / Hard Cutoff (Opsional)</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>

              {/* Geofencing FSM Undip Setting */}
              <div
                style={{
                  gridColumn: 'span 2',
                  background: requireLocation ? '#f0fdf4' : '#f8fafc',
                  border: `1.5px solid ${requireLocation ? '#86efac' : '#cbd5e1'}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 6,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '0.86rem',
                      color: requireLocation ? '#15803d' : '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>📍</span> Wajib Lokasi Fisik di FSM Undip (Geofencing)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 3 }}>
                    Hanya mahasiswa yang berada di lingkungan FSM Undip yang diizinkan memulai ujian. Dilengkapi proteksi Anti-Fake GPS (deteksi Mock Location OS dan validasi silang IP jaringan).
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155' }}>
                      Radius:
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="5000"
                      value={targetRadiusMeters}
                      onChange={(e) => setTargetRadiusMeters(e.target.value)}
                      disabled={!requireLocation}
                      style={{
                        width: 72,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                      }}
                    />
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>meter</span>
                  </div>
                  <label className="toggle-switch" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={requireLocation}
                      onChange={(e) => setRequireLocation(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#16a34a' }}
                    />
                  </label>
                </div>
              </div>

              {/* Bank Soal & Random Shuffle per Mahasiswa Setting */}
              <div
                style={{
                  gridColumn: 'span 2',
                  background:
                    (Number(questionCount) > 0 && Number(questionCount) < questions.length) || shuffleQuestions
                      ? '#eff6ff'
                      : '#f8fafc',
                  border: `1.5px solid ${
                    (Number(questionCount) > 0 && Number(questionCount) < questions.length) || shuffleQuestions
                      ? '#93c5fd'
                      : '#cbd5e1'
                  }`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 6,
                }}
              >
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: '0.86rem',
                      color:
                        (Number(questionCount) > 0 && Number(questionCount) < questions.length) || shuffleQuestions
                          ? '#1d4ed8'
                          : '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>🎲</span> Bank Soal & Acak Soal per Mahasiswa (Shuffle)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 3 }}>
                    Tentukan berapa butir soal yang dikerjakan mahasiswa dari total bank soal ({questions.length} butir). Pengacakan terkunci deterministik berbasis NIM (anti-error saat refresh).
                  </div>
                  {Number(questionCount) > 0 && Number(questionCount) < questions.length && (
                    <div style={{ marginTop: 6, fontSize: '0.74rem', fontWeight: 800, color: '#2563eb' }}>
                      ⚡ Mode Aktif: Mahasiswa akan mengerjakan {questionCount} soal acak dari total {questions.length} butir bank soal.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155' }}>
                      Soal Dikerjakan:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={Math.max(questions.length, 100)}
                      value={questionCount || ''}
                      placeholder={questions.length ? `Semua (${questions.length})` : '0 (Semua)'}
                      onChange={(e) => setQuestionCount(e.target.value)}
                      style={{
                        width: 82,
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textAlign: 'center',
                      }}
                      title="Tentukan berapa butir soal yang dikerjakan mahasiswa dari bank soal ini. Kosongkan atau isi 0 jika seluruh butir dikerjakan."
                    />
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>butir</span>
                  </div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#1e293b',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                    />
                    <span>🔀 Acak Soal (Shuffle)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: KONFIGURASI GEMINI AI AUTO-GRADING */}
          <div className="form-section-card" style={{ background: '#f5f3ff', border: '1.5px solid #c4b5fd' }}>
            <div className="form-section-title">
              <span style={{ color: '#5b21b6', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
                <span>🤖</span> Auto-Grading AI (Google Gemini Pro / Flash)
              </span>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#6d28d9',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoGrade}
                  onChange={(e) => setAutoGrade(e.target.checked)}
                />
                ⚡ Aktifkan Penilaian Otomatis saat Mahasiswa Submit
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12, marginBottom: 12 }}>
              <div className="field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Gemini API Key (Google AI Studio)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                    >
                      {showApiKey ? '🙈 Sembunyikan' : '👁️ Tampilkan'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      disabled={testingKey || !geminiApiKey.trim()}
                      onClick={handleTestApiKey}
                      title="Tes keabsahan API Key dan ambil daftar model yang aktif"
                    >
                      {testingKey ? '⏳ Menguji...' : '🔍 Tes API Key'}
                    </button>
                  </div>
                </div>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="AIzaSy... (Ambil dari https://aistudio.google.com/app/apikey)"
                  value={geminiApiKey}
                  onChange={(e) => {
                    setGeminiApiKey(e.target.value);
                    setKeyTestStatus(null);
                  }}
                  style={{ background: '#ffffff' }}
                />
                {keyTestStatus && (
                  <div
                    style={{
                      fontSize: '0.76rem',
                      marginTop: 4,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: keyTestStatus.ok ? '#dcfce7' : '#fee2e2',
                      color: keyTestStatus.ok ? '#166534' : '#991b1b',
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>{keyTestStatus.ok ? '✅ ' : '⛔ '}</strong>
                    {keyTestStatus.msg}
                    {keyTestStatus.hint && (
                      <div style={{ marginTop: 2, fontSize: '0.72rem', opacity: 0.9 }}>
                        💡 {keyTestStatus.hint}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="field-group">
                <label>Pilihan Model AI</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  style={{ background: '#ffffff' }}
                >
                  {availableModelList.length > 0 ? (
                    availableModelList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id} ({m.id})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Rekomendasi - Cepat & Cerdas)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                      <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash Latest</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Penalaran Mendalam)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="field-group">
              <label>
                📋 Panduan / Rubrik Penilaian & Kunci Jawaban Dosen
              </label>
              <textarea
                rows={4}
                placeholder="Definisikan rubrik penilaian, kunci jawaban, dan bobot nilai per butir soal...&#10;Contoh:&#10;- Soal 1 (Bobot 35): Mahasiswa harus menjelaskan konsep dasar X secara runtut dan memberikan contoh nyata.&#10;- Soal 2 (Bobot 35): Menyebutkan minimal 3 fungsi utama komponen Y.&#10;- Soal 3 (Bobot 30): Analisis studi kasus harus logis dan sesuai materi kuliah.&#10;Berikan nilai total (0-100) serta feedback edukatif yang konstruktif untuk mahasiswa."
                value={gradingRubric}
                onChange={(e) => setGradingRubric(e.target.value)}
                style={{ fontSize: '0.84rem', lineHeight: 1.45, background: '#ffffff', minHeight: 90 }}
              />
              <div style={{ fontSize: '0.74rem', color: '#6d28d9', marginTop: 4 }}>
                💡 <strong>Tips:</strong> AI akan membaca panduan rubrik ini bersama setiap butir soal kuis untuk mengevaluasi jawaban essay mahasiswa secara objektif dan memberikan catatan dosen langsung.
              </div>
            </div>
          </div>

          {/* SECTION 3: DAFTAR SOAL ESSAY */}
          <div className="form-section-card" style={{ background: '#ffffff' }}>
            <div className="form-section-title">
              <span>📝 Daftar Pertanyaan Soal ({questions.length} Soal)</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={`btn btn-xs ${
                    editorMode === 'VISUAL' ? 'btn-primary' : 'btn-outline'
                  }`}
                  onClick={() => setEditorMode('VISUAL')}
                >
                  📋 Form Visual
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${
                    editorMode === 'JSON' ? 'btn-primary' : 'btn-outline'
                  }`}
                  onClick={() => {
                    setJsonText(
                      JSON.stringify(
                        questions.map((q) => ({
                          question_text: q.questionText,
                          expected_answer: q.expectedAnswer || '',
                          question_type: q.questionType || 'ESSAY',
                        })),
                        null,
                        2
                      )
                    );
                    setEditorMode('JSON');
                  }}
                >
                  {'{ }'} Mode JSON
                </button>
              </div>
            </div>

            {editorMode === 'VISUAL' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '12px 14px',
                      background: '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ background: '#4f46e5', color: '#ffffff', padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 800 }}>
                        SOAL #{idx + 1}
                      </span>
                      <button
                        type="button"
                        className="btn btn-danger btn-xs"
                        onClick={() => handleRemoveQuestionRow(idx)}
                        title="Hapus butir soal ini"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                      >
                        🗑️ Hapus Soal
                      </button>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                        Pertanyaan Soal:
                      </label>
                      <textarea
                        rows={2}
                        placeholder={`Tuliskan butir pertanyaan nomor ${idx + 1}...`}
                        value={q.questionText}
                        onChange={(e) => handleQuestionChange(idx, e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <span>🔑</span> Kunci Jawaban / Jawaban yang Diharapkan (Opsional - Panduan AI & Dosen):
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Tuliskan poin kunci jawaban, kata kunci konsep, atau jawaban ideal untuk mempermudah penilaian AI..."
                        value={q.expectedAnswer || ''}
                        onChange={(e) => handleExpectedAnswerChange(idx, e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid #a7f3d0', background: '#f0fdf4', fontSize: '0.84rem' }}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleAddQuestionRow}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                >
                  + Tambah Butir Soal Baru
                </button>
              </div>
            ) : (
              <div className="field-group">
                <label>
                  Format JSON Array (Contoh:{' '}
                  <code>[{`{"question_text": "...", "expected_answer": "..."}`}]</code>)
                </label>
                <textarea
                  rows={10}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
