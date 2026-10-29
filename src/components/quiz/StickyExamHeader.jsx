import React, { memo } from 'react';
import { formatCountdown } from '../../services/api.js';

export const StickyExamHeader = memo(function StickyExamHeader({
  studentName,
  nim,
  quizId,
  saveStatus,
  remainingSec,
  violationCount,
  maxViolations,
}) {
  const timerStateClass =
    remainingSec <= 60 ? 'danger' : remainingSec <= 300 ? 'warning' : '';

  return (
    <div className="sticky-exam-header">
      <div className="student-badge-info">
        <h2>
          {studentName} ({nim})
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 2,
          }}
        >
          <span>Quiz ID: #{quizId}</span>
          <span className="autosave-pill">✓ {saveStatus}</span>
        </div>
      </div>

      <div className="floating-timer-group">
        <div className={`floating-timer-box ${timerStateClass}`}>
          <div>
            <div className="timer-label">Sisa Waktu</div>
            <div className="timer-digits">{formatCountdown(remainingSec)}</div>
          </div>
        </div>

        <div className="violation-pill">
          ⚠️ Pelanggaran: {violationCount} / {maxViolations}
        </div>
      </div>
    </div>
  );
});

