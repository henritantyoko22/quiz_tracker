import React, { memo } from 'react';

export const QuestionCard = memo(function QuestionCard({
  index,
  question,
  value,
  onChange,
  onFocusQuestion,
  onBlockClipboard,
}) {
  const qNum = index + 1;

  return (
    <div className="question-card">
      <div className="q-header">
        <span className="q-badge">SOAL #{qNum}</span>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {(value || '').length} Karakter
        </span>
      </div>
      <div className="q-text">{question.question_text}</div>
      <textarea
        className="essay-textarea"
        placeholder={`Ketik jawaban Anda untuk soal nomor ${qNum} di sini...`}
        value={value || ''}
        onFocus={() => onFocusQuestion(qNum)}
        onChange={(e) => onChange(qNum, e.target.value)}
        onCopy={(e) => onBlockClipboard(e, 'Copy teks jawaban')}
        onPaste={(e) => onBlockClipboard(e, 'Paste teks ke kolom jawaban')}
        onCut={(e) => onBlockClipboard(e, 'Cut teks jawaban')}
      />
    </div>
  );
});

