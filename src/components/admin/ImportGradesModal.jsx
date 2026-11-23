import React, { useState, useRef } from 'react';
import { API_BASE, getAuthHeaders } from '../../services/api.js';

/**
 * Universal JSON parser untuk format nilai submission AI:
 * - Mendukung format file ekspor (obj.submissions)
 * - Mendukung format array [ { nim, nilai, feedback, quiz_id }, ... ]
 * - Mendukung wrapper object { grades: [...], data: [...], hasil_penilaian: [...] }
 * - Mendukung format dictionary key-value { "NIM": { nilai, feedback } }
 */
export function parseJSONToGrades(jsonInput) {
  if (!jsonInput) return [];

  let data;
  if (typeof jsonInput === 'string') {
    let cleaned = jsonInput.replace(/^\uFEFF/, '').trim();
    if (!cleaned) return [];

    // Jika user meng-copy deretan objek yang berakhiran koma tanpa tanda kurung siku [ ... ]
    // Contoh: { ... },\n{ ... }
    if (!cleaned.startsWith('[') && cleaned.startsWith('{') && (cleaned.endsWith('}') || cleaned.endsWith(','))) {
      const trimmedEnd = cleaned.replace(/,\s*$/, '');
      try {
        data = JSON.parse('[' + trimmedEnd + ']');
      } catch (_) {}
    }

    if (!data) {
      try {
        data = JSON.parse(cleaned);
      } catch (err) {
        // Coba bersihkan trailing comma sebelum bracket/brace penutup
        try {
          const withoutTrailing = cleaned.replace(/,\s*([\]}])/g, '$1').replace(/,\s*$/, '');
          data = JSON.parse(withoutTrailing);
        } catch (_) {
          throw new Error('Format JSON tidak valid: ' + err.message);
        }
      }
    }
  } else {
    data = jsonInput;
  }

  let itemsArray = [];
  let defaultQuizId = '';

  if (Array.isArray(data)) {
    itemsArray = data;
  } else if (data && typeof data === 'object') {
    // 1. Cek apakah ini satu objek mahasiswa tunggal: { nim: '...', nilai: 96 }
    if (data.nim || data.NIM || data.userId || data.user_id) {
      itemsArray = [data];
    } else {
      if (data.meta && data.meta.quiz_id) {
        defaultQuizId = String(data.meta.quiz_id);
      }

      if (Array.isArray(data.submissions)) {
        itemsArray = data.submissions;
      } else if (Array.isArray(data.grades)) {
        itemsArray = data.grades;
      } else if (Array.isArray(data.data)) {
        itemsArray = data.data;
      } else if (Array.isArray(data.hasil_penilaian)) {
        itemsArray = data.hasil_penilaian;
      } else if (Array.isArray(data.students)) {
        itemsArray = data.students;
      } else if (Array.isArray(data.mahasiswa)) {
        itemsArray = data.mahasiswa;
      } else {
        // Cek apakah berupa dictionary dengan key NIM: { "240601...": { nilai: 85, feedback: "..." } }
        const keys = Object.keys(data);
        if (keys.length > 0 && keys.some((k) => /^\d{8,}/.test(k) || k.toLowerCase().includes('nim'))) {
          itemsArray = keys.map((key) => {
            const val = data[key];
            if (typeof val === 'object' && val !== null) {
              return { nim: key, ...val };
            }
            return { nim: key, nilai: val };
          });
        }
      }
    }
  }

  if (itemsArray.length === 0) {
    throw new Error(
      'Tidak ditemukan data mahasiswa/nilai pada JSON. Pastikan berupa Array atau Object dengan properti "submissions" atau "grades".'
    );
  }

  const parsedItems = [];

  itemsArray.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;

    const rawNim = String(
      item.nim || item.NIM || item.userId || item.user_id || item.student_id || ''
    ).trim();

    const rawName = String(
      item.nama || item.name || item.studentName || item.student_name || '-'
    ).trim();

    const rawQuizId = String(
      item.quiz_id || item.quizId || item.quiz || defaultQuizId || ''
    ).trim();

    const rawAttempt = item.attempt ? parseInt(item.attempt, 10) || 1 : 1;

    // Nilai (grade / nilai / score / skor)
    const rawGrade =
      item.nilai !== undefined && item.nilai !== null
        ? item.nilai
        : item.grade !== undefined && item.grade !== null
        ? item.grade
        : item.score !== undefined && item.score !== null
        ? item.score
        : item.skor;

    // Feedback (catatan / feedback)
    const rawFeedback = String(
      item.catatan_feedback_dosen ||
        item.feedback ||
        item.catatan ||
        item.catatan_dosen ||
        item.komentar ||
        item.evaluasi ||
        ''
    ).trim();

    let status = 'VALID';
    let errorMessage = '';

    if (!rawNim) {
      status = 'ERROR';
      errorMessage = 'NIM tidak ditemukan pada baris data ini.';
    } else if (rawGrade === undefined || rawGrade === null || rawGrade === '') {
      status = 'EMPTY';
      errorMessage = 'Nilai belum diisi.';
    } else {
      const numGrade = parseFloat(rawGrade);
      if (isNaN(numGrade) || numGrade < 0 || numGrade > 100) {
        status = 'ERROR';
        errorMessage = `Nilai '${rawGrade}' tidak valid (harus 0 - 100).`;
      }
    }

    parsedItems.push({
      nim: rawNim,
      nama: rawName,
      quizId: rawQuizId,
      attempt: rawAttempt,
      grade:
        rawGrade !== undefined &&
        rawGrade !== null &&
        rawGrade !== '' &&
        !isNaN(parseFloat(rawGrade))
          ? Math.round(parseFloat(rawGrade))
          : null,
      feedback: rawFeedback,
      status,
      errorMessage,
      rawRowIndex: idx + 1,
    });
  });

  return parsedItems;
}

/**
 * Robust CSV parser yang mendukung RFC 4180
 */
export function parseCSVToGrades(csvText) {
  if (!csvText) return [];

  let text = csvText.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const rawHeaders = rows[0].map((h) => h.toLowerCase().trim());

  const findIndex = (patterns) => {
    return rawHeaders.findIndex((h) =>
      patterns.some((p) => (typeof p === 'string' ? h === p : p.test(h)))
    );
  };

  const nimIdx = findIndex(['nim', 'no. induk', 'nomor induk', 'user_id', 'id mahasiswa']);
  const nameIdx = findIndex(['nama', 'nama mahasiswa', 'student name', 'student']);
  const quizIdIdx = findIndex(['quiz id', 'quiz_id', 'id quiz', 'kode quiz']);
  const attemptIdx = findIndex(['attempt', 'percobaan']);
  const gradeIdx = findIndex([
    'nilai (0-100)',
    'nilai',
    'grade',
    'score',
    'skor',
    /nilai/i,
    /grade/i,
  ]);
  const feedbackIdx = findIndex([
    'catatan / feedback dosen',
    'catatan dosen',
    'catatan',
    'feedback',
    'feedback dosen',
    'komentar',
    /feedback/i,
    /catatan/i,
  ]);

  const parsedItems = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawNim = nimIdx !== -1 && row[nimIdx] ? row[nimIdx].replace(/["']/g, '').trim() : '';
    const rawName = nameIdx !== -1 && row[nameIdx] ? row[nameIdx].replace(/["']/g, '').trim() : '';
    const rawQuizId = quizIdIdx !== -1 && row[quizIdIdx] ? row[quizIdIdx].replace(/["']/g, '').trim() : '';
    const rawAttempt = attemptIdx !== -1 && row[attemptIdx] ? parseInt(row[attemptIdx], 10) || 1 : 1;
    const rawGrade = gradeIdx !== -1 && row[gradeIdx] !== undefined ? row[gradeIdx].replace(/["']/g, '').trim() : '';
    const rawFeedback = feedbackIdx !== -1 && row[feedbackIdx] !== undefined ? row[feedbackIdx].trim() : '';

    if (!rawNim && !rawName) continue;

    let status = 'VALID';
    let errorMessage = '';

    if (!rawNim) {
      status = 'ERROR';
      errorMessage = 'NIM tidak ditemukan pada baris ini.';
    } else if (rawGrade === '') {
      status = 'EMPTY';
      errorMessage = 'Nilai belum diisi.';
    } else {
      const numGrade = parseFloat(rawGrade);
      if (isNaN(numGrade) || numGrade < 0 || numGrade > 100) {
        status = 'ERROR';
        errorMessage = `Nilai '${rawGrade}' tidak valid (harus 0 - 100).`;
      }
    }

    parsedItems.push({
      nim: rawNim,
      nama: rawName || '-',
      quizId: rawQuizId,
      attempt: rawAttempt,
      grade: rawGrade !== '' && !isNaN(parseFloat(rawGrade)) ? Math.round(parseFloat(rawGrade)) : null,
      feedback: rawFeedback,
      status,
      errorMessage,
      rawRowIndex: r + 1,
    });
  }

  return parsedItems;
}

export function ImportGradesModal({ isOpen, onClose, token, onSuccess, showToast }) {
  const [inputMode, setInputMode] = useState('FILE'); // 'FILE' | 'PASTE'
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'VALID' | 'WARNING'
  const [showExample, setShowExample] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const detectAndParse = (text, fileName = '') => {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      throw new Error('Data teks atau file kosong.');
    }

    // Jika file berakhiran .json atau diawali kurung kurawal/siku, parse sebagai JSON
    const isJson =
      fileName.toLowerCase().endsWith('.json') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('[');

    if (isJson) {
      return parseJSONToGrades(trimmed);
    }
    return parseCSVToGrades(trimmed);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processFile(selected);
  };

  const processFile = (selectedFile) => {
    setFile(selectedFile);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result || '';
        const rows = detectAndParse(text, selectedFile.name);
        setParsedRows(rows);
        if (rows.length === 0) {
          showToast('Data tidak memiliki baris nilai yang sesuai format.', 'error');
        } else {
          showToast(`Berhasil membaca ${rows.length} baris data dari ${selectedFile.name}`, 'info');
        }
      } catch (err) {
        showToast('Gagal memproses file: ' + err.message, 'error');
        setParsedRows([]);
      } finally {
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      showToast('Gagal membaca file yang dipilih.', 'error');
      setIsParsing(false);
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  const processPastedText = () => {
    if (!pasteText.trim()) {
      showToast('Masukkan atau paste teks JSON / CSV terlebih dahulu!', 'error');
      return;
    }
    setIsParsing(true);
    try {
      const rows = detectAndParse(pasteText);
      setParsedRows(rows);
      if (rows.length === 0) {
        showToast('Tidak ditemukan data nilai mahasiswa dari teks yang dimasukkan.', 'error');
      } else {
        showToast(`Berhasil membaca ${rows.length} data mahasiswa dari teks!`, 'info');
      }
    } catch (err) {
      showToast('Gagal membaca teks: ' + err.message, 'error');
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const validRows = parsedRows.filter((r) => r.status === 'VALID');
  const warningRows = parsedRows.filter((r) => r.status !== 'VALID');

  const displayedRows =
    filterTab === 'VALID'
      ? validRows
      : filterTab === 'WARNING'
      ? warningRows
      : parsedRows;

  const handleReset = () => {
    setFile(null);
    setPasteText('');
    setParsedRows([]);
    setFilterTab('ALL');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportSubmit = async () => {
    if (validRows.length === 0) {
      showToast('Tidak ada data nilai valid yang dapat disimpan.', 'error');
      return;
    }

    setIsSubmitting(true);
    setImportProgress('Memulai penyimpanan nilai...');

    const CHUNK_SIZE = 25; // Potong 25 mahasiswa per batch agar ukuran request selalu kecil (<50KB) dan terhindar dari Payload Too Large
    const total = validRows.length;
    let totalUpdated = 0;
    let anyError = null;

    try {
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + CHUNK_SIZE);
        const currentEnd = Math.min(i + CHUNK_SIZE, total);
        setImportProgress(`Menyimpan ${i + 1} - ${currentEnd} dari ${total} nilai...`);

        const payload = {
          grades: chunk.map((r) => ({
            nim: r.nim,
            quizId: r.quizId,
            attempt: r.attempt,
            grade: r.grade,
            feedback: r.feedback,
          })),
        };

        const res = await fetch(`${API_BASE}/v1/admin/submissions/import-grades`, {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok && data.status === 'success') {
          totalUpdated += data.updatedCount || 0;
        } else {
          anyError = data.message || 'Gagal menyimpan sebagian nilai mahasiswa.';
        }
      }

      if (totalUpdated > 0) {
        showToast(
          `✅ Sukses! ${totalUpdated} dari ${total} nilai mahasiswa berhasil disimpan ke database.`,
          'success'
        );
        if (onSuccess) onSuccess();
        onClose();
      } else if (anyError) {
        showToast(anyError, 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
      setImportProgress('');
    }
  };

  const exampleJSON = `[
  {
    "nim": "24060122130001",
    "quiz_id": "iot-01",
    "nilai": 88,
    "feedback": "Penjelasan konsep sensor analog vs digital sangat jelas dan tepat."
  },
  {
    "nim": "24060122130002",
    "quiz_id": "iot-01",
    "nilai": 75,
    "feedback": "Konsep dasar sudah baik, perlu diperbaiki contoh penerapannya."
  }
]`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 940, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📥</span> Impor Nilai & Feedback AI (JSON / CSV)
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Masukkan hasil penilaian & feedback dari AI (Gemini / ChatGPT / Claude) untuk otomatis memperbarui database.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm btn-touchable"
            onClick={onClose}
            disabled={isSubmitting}
          >
            ✕ Tutup
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: 18 }}>
          {/* Instruksi Singkat Alur AI */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: '0.82rem',
              color: '#166534',
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>💡 Alur Penilaian Nilai Berbasis AI (JSON & CSV):</strong>
              <button
                type="button"
                onClick={() => setShowExample(!showExample)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#15803d',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {showExample ? 'Sembunyikan Contoh Format' : 'Lihat Contoh Format JSON'}
              </button>
            </div>
            <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>
                Ekspor data jawaban dengan tombol <strong>🤖 Export JSON (AI)</strong> atau <strong>📥 Export CSV</strong>.
              </li>
              <li>
                Minta AI (ChatGPT/Gemini) mengevaluasi jawaban dan menghasilkan nilai <code>nilai</code> (0-100) serta <code>feedback</code>.
              </li>
              <li>
                Unggah file hasil AI tersebut atau langsung <em>paste</em> teks JSON jawabannya di bawah ini.
              </li>
            </ol>

            {showExample && (
              <div style={{ marginTop: 10, background: '#ffffff', borderRadius: 8, padding: 12, border: '1px solid #86efac' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#166534' }}>
                    Contoh Format JSON Sederhana:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(exampleJSON);
                      showToast('Contoh format JSON berhasil disalin!', 'success');
                    }}
                    style={{
                      background: '#dcfce7',
                      border: '1px solid #86efac',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#15803d',
                      cursor: 'pointer',
                    }}
                  >
                    📋 Salin Contoh
                  </button>
                </div>
                <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', color: '#1e293b' }}>
                  {exampleJSON}
                </pre>
                <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: 6 }}>
                  *File JSON hasil ekspor lengkap (dengan metadata & pertanyaan) juga langsung didukung secara otomatis.
                </div>
              </div>
            )}
          </div>

          {/* Tab Selector: Upload File vs Paste Text */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              type="button"
              className={`btn btn-sm ${inputMode === 'FILE' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setInputMode('FILE')}
              style={{ fontWeight: 700, fontSize: '0.82rem' }}
            >
              📁 Unggah File (.json / .csv)
            </button>
            <button
              type="button"
              className={`btn btn-sm ${inputMode === 'PASTE' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setInputMode('PASTE')}
              style={{ fontWeight: 700, fontSize: '0.82rem' }}
            >
              📋 Paste Teks JSON / CSV
            </button>
          </div>

          {/* Area Input Sesuai Mode */}
          {inputMode === 'FILE' ? (
            !file ? (
              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: 12,
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,.csv"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📥</div>
                <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#1e293b', marginBottom: 4 }}>
                  Klik atau Tarik File JSON / CSV ke Sini
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Mendukung format file <strong>.json</strong> (Rekap AI) atau <strong>.csv</strong>.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f1f5f9',
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 14,
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                    📄 {file.name}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: 8 }}>
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm btn-touchable"
                  onClick={handleReset}
                  disabled={isSubmitting}
                  style={{ fontSize: '0.78rem' }}
                >
                  Ganti File
                </button>
              </div>
            )
          ) : (
            <div style={{ marginBottom: 14 }}>
              <textarea
                rows={6}
                placeholder="Paste teks JSON atau CSV hasil penilaian AI di sini..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                  fontSize: '0.82rem',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                {pasteText && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setPasteText('');
                      setParsedRows([]);
                    }}
                    style={{ fontSize: '0.78rem' }}
                  >
                    Bersihkan Teks
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm btn-touchable"
                  onClick={processPastedText}
                  disabled={!pasteText.trim() || isParsing}
                  style={{ fontWeight: 700 }}
                >
                  {isParsing ? '⏳ Memproses...' : '⚡ Proses & Pratinjau Nilai'}
                </button>
              </div>
            </div>
          )}

          {/* Area Preview Data jika sudah diparsing */}
          {parsedRows.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {/* Status Ringkasan Bar */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className={`btn btn-sm ${filterTab === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFilterTab('ALL')}
                  style={{ fontSize: '0.8rem' }}
                >
                  Semua ({parsedRows.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${filterTab === 'VALID' ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => setFilterTab('VALID')}
                  style={{ fontSize: '0.8rem' }}
                >
                  ✅ Siap Diimpor ({validRows.length})
                </button>
                {warningRows.length > 0 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${filterTab === 'WARNING' ? 'btn-danger' : 'btn-outline'}`}
                    onClick={() => setFilterTab('WARNING')}
                    style={{ fontSize: '0.8rem' }}
                  >
                    ⚠️ Perlu Diperhatikan ({warningRows.length})
                  </button>
                )}
              </div>

              {/* Tabel Preview */}
              <div
                style={{
                  maxHeight: 320,
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#ffffff',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>No</th>
                      <th style={{ padding: '8px 10px' }}>NIM</th>
                      <th style={{ padding: '8px 10px' }}>Nama</th>
                      <th style={{ padding: '8px 10px' }}>Quiz ID</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Nilai (0-100)</th>
                      <th style={{ padding: '8px 10px' }}>Catatan / Feedback</th>
                      <th style={{ padding: '8px 10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>
                          Tidak ada data dalam kategori ini.
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((r, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background:
                              r.status === 'ERROR'
                                ? '#fef2f2'
                                : r.status === 'EMPTY'
                                ? '#fffbeb'
                                : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{r.nim}</td>
                          <td style={{ padding: '8px 10px' }}>{r.nama}</td>
                          <td style={{ padding: '8px 10px', color: '#475569' }}>
                            {r.quizId ? `#${r.quizId}` : '-'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {r.grade !== null ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  fontWeight: 800,
                                  background: r.grade >= 75 ? '#dcfce7' : r.grade >= 60 ? '#fef3c7' : '#fee2e2',
                                  color: r.grade >= 75 ? '#15803d' : r.grade >= 60 ? '#b45309' : '#b91c1c',
                                }}
                              >
                                {r.grade}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>-</span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: '8px 10px',
                              maxWidth: 240,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: '#334155',
                            }}
                            title={r.feedback}
                          >
                            {r.feedback || '-'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {r.status === 'VALID' ? (
                              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                                ✅ Siap Simpan
                              </span>
                            ) : r.status === 'EMPTY' ? (
                              <span className="badge badge-warning" style={{ fontSize: '0.72rem' }} title={r.errorMessage}>
                                ⚠️ Kosong
                              </span>
                            ) : (
                              <span className="badge badge-danger" style={{ fontSize: '0.72rem' }} title={r.errorMessage}>
                                ⛔ {r.errorMessage}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            borderTop: '1px solid #e2e8f0',
            background: '#fafafa',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {parsedRows.length > 0 && (
              <span>
                Total <strong>{validRows.length}</strong> nilai valid dari {parsedRows.length} baris data.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline btn-touchable"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary btn-touchable"
              onClick={handleImportSubmit}
              disabled={validRows.length === 0 || isSubmitting || isParsing}
              style={{ fontWeight: 700 }}
            >
              {isSubmitting
                ? importProgress ? `⏳ ${importProgress}` : '⏳ Menyimpan Nilai...'
                : `🚀 Simpan & Terapkan (${validRows.length} Nilai)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
