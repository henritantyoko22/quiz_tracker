document.addEventListener('DOMContentLoaded', () => {
  const logList = document.getElementById('log-list');
  const countBadge = document.getElementById('count');
  const clearBtn = document.getElementById('clear-btn');

  function renderLogs() {
    chrome.storage.local.get({ violations: [] }, (result) => {
      const logs = result.violations;
      countBadge.textContent = logs.length;

      if (logs.length === 0) {
        logList.innerHTML = '<li class="empty">Belum ada pelanggaran terdeteksi.</li>';
        return;
      }

      logList.innerHTML = '';
      logs.forEach(log => {
        const li = document.createElement('li');
        const timeFormatted = new Date(log.timestamp).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        li.innerHTML = `
          <div class="type">${log.type}</div>
          <div>${log.detail || '-'}</div>
          <div class="time">${timeFormatted} | ${log.quizId}</div>
        `;
        logList.appendChild(li);
      });
    });
  }

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.set({ violations: [] }, () => {
      renderLogs();
    });
  });

  renderLogs();
});