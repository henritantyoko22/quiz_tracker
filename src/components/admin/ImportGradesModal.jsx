import React, { useState, useRef } from 'react';
import { API_BASE, getAuthHeaders } from '../../services/api.js';

/**
 * Robust CSV parser yang mendukung RFC 4180:
 * - Menangani kutipan ("..."), koma di dalam tanda kutip, dan baris baru di dalam tanda kutip
 * - Otomatis mendeteksi pemisah koma (,) atau titik-koma (;)
 * - Menghilangkan UTF-8 BOM
 */
export function parseCSVToGrades(csvText) {
  if (!csvText) return [];

  // Bersihkan UTF-8 BOM jika ada
  let text = csvText.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  // Deteksi pemisah (koma atau titik koma) dari baris pertama
  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  // State machine parser untuk membaca tokens dengan benar
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
        i++; // lewati quote ganda
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // lewati \n pada format CRLF
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

  // Helper pencari index kolom
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

    if (!rawNim && !rawName) continue; // Abaikan baris kosong

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
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'VALID' | 'WARNING'
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

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
        const rows = parseCSVToGrades(text);
        setParsedRows(rows);
        if (rows.length === 0) {
          showToast('File CSV tidak memiliki baris data atau format kolom NIM tidak cocok.', 'error');
        }
      } catch (err) {
        showToast('Gagal memproses file CSV: ' + err.message, 'error');
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
    try {
      const payload = {
        grades: validRows.map((r) => ({
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
        showToast(
          `✅ Sukses! ${data.updatedCount} nilai mahasiswa berhasil disimpan ke database.`,
          'success'
        );
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(data.message || 'Gagal menyimpan nilai mahasiswa.', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 900, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📥</span> Impor Nilai & Feedback AI (CSV)
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Unggah file CSV hasil analisis / penilaian jawaban essay oleh AI untuk disimpan otomatis ke database.
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
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: '0.82rem',
              color: '#1e40af',
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            <strong>💡 Alur Penilaian Berbasis AI:</strong>
            <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
              <li>
                Ekspor data jawaban mahasiswa dengan tombol <strong>📥 Export CSV</strong> di Dashboard.
              </li>
              <li>
                Beri instruksi ke AI (ChatGPT / Claude / Gemini) beserta rubrik penilaian untuk mengisi kolom{' '}
                <code>Nilai (0-100)</code> dan <code>Catatan / Feedback Dosen</code> pada file CSV tersebut.
              </li>
              <li>
                Unggah kembali file CSV hasil penilaian AI tersebut di bawah ini untuk disimpan otomatis.
              </li>
            </ol>
          </div>

          {/* Area Pilih File */}
          {!file ? (
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
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>📁</div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#1e293b', marginBottom: 4 }}>
                Klik atau Tarik File CSV ke Sini
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Mendukung format file CSV (Comma atau Semicolon delimited).
              </div>
            </div>
          ) : (
            <div>
              {/* File Info Bar */}
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

              {/* Status Ringkasan Bar */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginBottom: 14,
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
                              maxWidth: 220,
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
            {file && (
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
              disabled={!file || validRows.length === 0 || isSubmitting || isParsing}
              style={{ fontWeight: 700 }}
            >
              {isSubmitting
                ? '⏳ Menyimpan Nilai...'
                : `🚀 Simpan & Terapkan (${validRows.length} Nilai)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

