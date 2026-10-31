import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, getAuthHeaders, toLocalISOString } from '../../services/api.js';

export function UnifiedQuizManager({ token, quizList, onRefreshQuizList, showToast }) {
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [newQuizInput, setNewQuizInput] = useState('');

  // Timer & Schedule state
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [maxViolations, setMaxViolations] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Gemini AI Auto-Grading state
  const [gradingRubric, setGradingRubric] = useState('');
  const [autoGrade, setAutoGrade] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [showApiKey, setShowApiKey] = useState(false);

  // Questions state
  const [questions, setQuestions] = useState([]);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [editorMode, setEditorMode] = useState('VISUAL'); // VISUAL | JSON
  const [jsonText, setJsonText] = useState('');

  useEffect(() => {
    if (!selectedQuizId && quizList.length > 0) {
      setSelectedQuizId(String(quizList[0].quiz_id));
    }
  }, [quizList, selectedQuizId]);

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
          fetch(`${API_BASE}/v1/quiz/questions/${encodeURIComponent(qId)}`),
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
          setGradingRubric(s.grading_rubric || '');
          setAutoGrade(Boolean(s.auto_grade));
          setGeminiApiKey(s.gemini_api_key || '');
          setGeminiModel(s.gemini_model || 'gemini-1.5-flash');
        } else {
          setDurationMinutes(30);
          setMaxViolations(3);
          setIsActive(true);
          setStartTime('');
          setEndTime('');
          setGradingRubric('');
          setAutoGrade(false);
        }

        const rawQuestions = Array.isArray(qData.data) ? qData.data : [];
        const loadedQuestions = rawQuestions.map((q) => ({
          id: q.id,
          questionText: q.question_text || '',
          questionType: q.question_type || 'ESSAY',
        }));

        setQuestions(
          loadedQuestions.length > 0
            ? loadedQuestions
            : [{ questionText: '', questionType: 'ESSAY' }]
        );
        setJsonText(
          JSON.stringify(
            loadedQuestions.map((q) => ({
              question_text: q.questionText,
              question_type: q.questionType,
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
    [quizList, showToast]
  );

  useEffect(() => {
    if (selectedQuizId) {
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
    setQuestions([{ questionText: '', questionType: 'ESSAY' }]);
    setJsonText('[\n  {\n    "question_text": "Tuliskan pertanyaan soal 1..."\n  }\n]');
  };

  const handleQuestionChange = (index, value) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], questionText: value };
      return copy;
    });
  };

  const handleAddQuestionRow = () => {
    setQuestions((prev) => [...prev, { questionText: '', questionType: 'ESSAY' }]);
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
      return next.length > 0 ? next : [{ questionText: '', questionType: 'ESSAY' }];
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
          durationMinutes: Number(durationMinutes) || 30,
          maxViolations: Number(maxViolations) || 3,
          isActive: Boolean(isActive),
          startTime: startTime ? new Date(startTime).toISOString() : null,
          endTime: endTime ? new Date(endTime).toISOString() : null,
          gradingRubric,
          autoGrade: Boolean(autoGrade),
          geminiApiKey,
          geminiModel,
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
          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
            📚 Daftar Quiz ID ({quizList.length})
          </div>
          <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: 2 }}>
            Klik ID Quiz di bawah untuk edit soal & timer
          </div>
          <form
            onSubmit={handleCreateNewQuizId}
            style={{ display: 'flex', gap: 6, marginTop: 10 }}
          >
            <input
              type="text"
              placeholder="Buat ID Quiz baru (mis: 102)..."
              value={newQuizInput}
              onChange={(e) => setNewQuizInput(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 7,
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
              }}
            />
            <button type="submit" className="btn btn-primary btn-xs">
              + Buat
            </button>
          </form>
        </div>

        <div className="quiz-sidebar-list">
          {quizList.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: 'center',
                fontSize: '0.8rem',
                color: '#94a3b8',
              }}
            >
              Belum ada Quiz ID. Buat baru di atas.
            </div>
          ) : (
            quizList.map((item) => {
              const isSelected = String(item.quiz_id) === String(selectedQuizId);
              return (
                <div
                  key={item.quiz_id}
                  className={`quiz-list-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedQuizId(String(item.quiz_id))}
                >
                  <div>
                    <div className="title">Quiz #{item.quiz_id}</div>
                    <div className="meta">
                      {item.total_questions || 0} Soal •{' '}
                      {item.duration_minutes || 60} Menit
                    </div>
                  </div>
                  <span
                    className={`badge ${
                      item.is_active === false ? 'badge-danger' : 'badge-success'
                    }`}
                  >
                    {item.is_active === false ? 'TUTUP' : 'AKTIF'}
                  </span>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, marginBottom: 12 }}>
              <div className="field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Gemini API Key (Google AI Studio)</label>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                  >
                    {showApiKey ? '🙈 Sembunyikan' : '👁️ Tampilkan'}
                  </button>
                </div>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="AIzaSy... (Opsional jika sudah diset di server GEMINI_API_KEY)"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  style={{ background: '#ffffff' }}
                />
              </div>

              <div className="field-group">
                <label>Pilihan Model AI</label>
                <select
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  style={{ background: '#ffffff' }}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Rekomendasi - Cepat & Cerdas)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash Latest</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (Penalaran Mendalam)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
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
              <div>
                {questions.map((q, idx) => (
                  <div key={q.id || idx} className="question-item-row">
                    <div className="q-num">{idx + 1}</div>
                    <textarea
                      placeholder={`Tuliskan pertanyaan soal nomor ${idx + 1}...`}
                      value={q.questionText}
                      onChange={(e) => handleQuestionChange(idx, e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-xs"
                      onClick={() => handleRemoveQuestionRow(idx)}
                      title="Hapus soal ini"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleAddQuestionRow}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
                >
                  + Tambah Baris Soal Baru
                </button>
              </div>
            ) : (
              <div className="field-group">
                <label>
                  Format JSON Array (Contoh:{' '}
                  <code>[{`{"question_text": "Jelaskan konsep OOP..."}`}]</code>)
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
