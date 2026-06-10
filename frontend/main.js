// main.js - Handle frontend logic for all main pages

document.addEventListener('DOMContentLoaded', function () {
  // -------- Sentiment Analysis (batch.html) --------
  const analyzeBtn = document.getElementById('analyze-btn');
  // integrate-utils.js owns analyze on batch.html (loads after historyManager)
  if (analyzeBtn && !window.historyManager) {
    analyzeBtn.addEventListener('click', async function () {
      const ta = document.getElementById('single-review');
      const review = (ta?.value || '').trim();
      if (!review) { window.toast?.warn('Please enter a review'); return; }
      showLoading('single-result');
      try {
        const res = await fetch(window.apiUrl('/api/predict'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: review })
        });
        const data = await res.json();
        renderSingleResult(data, 'single-result');
      } catch (err) {
        document.getElementById('single-result').textContent = 'Error. Try again.';
        window.toast?.error(err.message || 'Analysis failed');
      }
    });
    // render history if any
    renderHistory();
  }

  // Threshold slider setup (standalone, not nested inside event handler)
  function setupThresholdSlider(onChange) {
    const slider = document.getElementById('threshold-slider');
    const valueSpan = document.getElementById('threshold-value');
    if (!slider || !valueSpan) return;
    slider.value = 0.5;
    valueSpan.textContent = `${Math.round(slider.value * 100)}%`;
    slider.addEventListener('input', function () {
      valueSpan.textContent = `${Math.round(slider.value * 100)}%`;
    });
    slider.addEventListener('change', function () {
      const newThr = parseFloat(slider.value);
      if (typeof onChange === 'function') onChange(newThr);
    });
  }
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        new bootstrap.Tooltip(tooltipTriggerEl);
      });
    }

    // Register keyboard shortcuts for sentiment analysis page
    if (window.keyboardShortcuts && analyzeBtn) {
      keyboardShortcuts.register('analyze', () => {
        document.getElementById('analyze-btn')?.click();
      });
      
      keyboardShortcuts.register('clear', () => {
        const ta = document.getElementById('single-review');
        if (ta) {
          ta.value = '';
          ta.focus();
        }
      });
      
      keyboardShortcuts.register('export', () => {
        document.getElementById('download-csv-btn')?.click();
      });
      
      keyboardShortcuts.register('history', () => {
        showHistoryModal();
      });
      
      keyboardShortcuts.register('close', () => {
        // Close any open modals
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
          const bsModal = bootstrap.Modal.getInstance(modal);
          if (bsModal) bsModal.hide();
        });
      });
    }

  });

  // --------- Render Helpers ---------
  function showLoading(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) el.innerHTML = '<p>Loading...</p>';
  }

  function renderSingleResult(data, sectionId) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.classList.remove('result-empty-hint');
    const isPos = data.label === 1 || data.sentiment === 'positive';
    const icon = isPos ? '★' : '✕';
    const confidence = data.probability;
    
    // Create unique ID for gradient container
    const gradientId = `confidence-gradient-${Date.now()}`;
    
    el.innerHTML = `
      <div class="result-card" style="animation:pop .18s ease;">
        <h3>Verdict</h3>
        <p><strong>Rating:</strong> <span class="${isPos ? 'pos sentiment-positive' : 'neg sentiment-negative'}">${icon} ${isPos ? 'Fresh' : 'Rotten'}</span></p>
        <p><strong>Confidence:</strong> ${confidenceVisualizer ? confidenceVisualizer.formatConfidence(confidence, data.label) : (confidence * 100).toFixed(2) + '%'}</p>
        <div id="${gradientId}" class="mt-3"></div>
      </div>
    `;
    
    // Add confidence gradient visualization
    if (window.confidenceVisualizer) {
      setTimeout(() => {
        confidenceVisualizer.createGradient(gradientId, confidence, data.label);
      }, 100);
    }
    
    // Save to persistent history (localStorage via SentimentHistory)
    try {
      const ta = document.getElementById('single-review');
      const text = ta?.value || '';
      if (window.sentimentHistory && text) {
        sentimentHistory.add(text, data.label, confidence);
      }
      
      // Keep legacy sessionStorage for backward compatibility
      const item = { text: text.slice(0, 120), label: isPos ? 'Positive' : 'Negative', p: (confidence * 100).toFixed(1) };
      const arr = JSON.parse(sessionStorage.getItem('history') || '[]');
      arr.unshift(item); if (arr.length > 5) arr.pop();
      sessionStorage.setItem('history', JSON.stringify(arr));
      renderHistory();
    } catch (e) { console.warn('History save failed:', e); }
  }
  function renderHistory() {
    const box = document.getElementById('history-box');
    const list = document.getElementById('history-list');
    if (!box || !list) return;
    const arr = JSON.parse(sessionStorage.getItem('history') || '[]');
    if (!arr.length) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    list.innerHTML = arr.map(i => `
      <div class="history-item">
        <span>${i.text}</span>
        <span class="badge">${i.label} • ${i.p}%</span>
      </div>`).join('');
  }

  function showHistoryModal() {
    if (!window.sentimentHistory) return;
    
    const history = sentimentHistory.getAll();
    const stats = sentimentHistory.getStats();
    
    let modal = document.getElementById('history-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'history-modal';
      modal.className = 'modal fade';
      modal.tabIndex = -1;
      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content" style="background: var(--bg-card); color: var(--text-primary);">
            <div class="modal-header" style="border-color: var(--border-color);">
              <h5 class="modal-title">📜 Sentiment Analysis History</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row mb-3">
                <div class="col-md-3 text-center">
                  <div class="p-2 rounded" style="background: var(--bg-secondary);">
                    <strong>${stats.total}</strong><br><small>Total</small>
                  </div>
                </div>
                <div class="col-md-3 text-center">
                  <div class="p-2 rounded" style="background: var(--bg-secondary);">
                    <strong style="color: #3dd68c;">${stats.positive}</strong><br><small>Fresh</small>
                  </div>
                </div>
                <div class="col-md-3 text-center">
                  <div class="p-2 rounded" style="background: var(--bg-secondary);">
                    <strong style="color: #ff6b6b;">${stats.negative}</strong><br><small>Rotten</small>
                  </div>
                </div>
                <div class="col-md-3 text-center">
                  <div class="p-2 rounded" style="background: var(--bg-secondary);">
                    <strong>${(stats.avgConfidence * 100).toFixed(1)}%</strong><br><small>Avg Conf.</small>
                  </div>
                </div>
              </div>
              <div id="history-list-full" style="max-height: 400px; overflow-y: auto;"></div>
              <div class="text-center mt-3">
                <button class="btn btn-sm btn-soft" onclick="sentimentHistory.exportCSV()">📥 Export CSV</button>
                <button class="btn btn-sm btn-soft ms-2" onclick="if(confirm('Clear all history?')) { sentimentHistory.clear(); location.reload(); }">🗑️ Clear All</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    // Render history items
    const listEl = document.getElementById('history-list-full');
    if (listEl) {
      if (history.length === 0) {
        listEl.innerHTML = '<p class="text-center text-muted">No history yet. Analyze some reviews!</p>';
      } else {
        listEl.innerHTML = history.map(item => `
          <div class="card mb-2" style="background: var(--bg-secondary); border-color: var(--border-color);">
            <div class="card-body p-2">
              <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                  <small class="text-muted">${new Date(item.timestamp).toLocaleString()}</small>
                  <p class="mb-1 mt-1">${item.text}</p>
                </div>
                <div class="ms-2 text-end">
                  <span class="badge ${item.sentiment === 1 ? 'bg-success' : 'bg-danger'}">${item.sentiment === 1 ? 'Positive' : 'Negative'}</span>
                  <br><small>${(item.confidence * 100).toFixed(1)}%</small>
                  <br><button class="btn btn-sm btn-link text-danger p-0 mt-1" onclick="sentimentHistory.delete(${item.id}); location.reload();">🗑️</button>
                </div>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }
  // cute pop keyframes
  (() => {
    const style = document.createElement('style');
    style.textContent = '@keyframes pop{from{transform:scale(.98);opacity:.0}to{transform:scale(1);opacity:1}}';
    document.head.appendChild(style);
  })();

  function renderBatchResult(data, sectionId) {
    const wrap = document.getElementById('batch-table-wrap');
    if (wrap) wrap.classList.remove('result-empty-hint');
    window.__batchResults = data?.results || [];
    // Show controls (always visible after analyze)
    const controls = document.getElementById('batch-controls');
    if (controls) controls.style.display = 'flex';
    // Render table with pagination
    window.__batchPage = 1;
    window.__batchPerPage = 5;
    renderBatchTable(window.__batchResults, 'batch-table-wrap');
    renderBatchPagination();
    saveBatchHistory(window.__batchResults);
  }

  function renderBatchTable(rowsData, sectionId) {
    // Pagination
    const page = window.__batchPage || 1;
    const perPage = window.__batchPerPage || 5;
    const start = (page-1)*perPage;
    const end = start+perPage;
    const pagedRows = rowsData.slice(start, end);
    const rows = (pagedRows || []).map((row, idx) => `
      <tr>
        <td style="width:55%; word-break:break-word; cursor:pointer;" class="review-cell" data-idx="${start+idx}">${row.text.length > 80 ? row.text.slice(0,80)+'...' : row.text}</td>
        <td class="${row.label === 1 ? 'pos' : 'neg'}" style="width:20%;">${row.label === 1 ? '★ Fresh' : '✕ Rotten'}</td>
        <td style="width:25%;">${(row.probability * 100).toFixed(2)}%</td>
      </tr>
    `).join('');
    document.getElementById(sectionId).innerHTML = `
      <h3>Batch results</h3>
      <div class="table-wrap batch-table-wrap">
      <table class="batch-results-table">
        <thead>
          <tr>
            <th style="width:55%;">Review</th>
            <th style="width:20%;">Verdict</th>
            <th style="width:25%;">Confidence</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
      <div id="batch-pagination" class="d-flex justify-content-center mt-2"></div>`;
    // Add click event for review detail
    document.querySelectorAll('.review-cell').forEach(cell => {
      cell.onclick = function() {
        const idx = this.getAttribute('data-idx');
        const fullText = window.__batchResults[idx]?.text || '';
        showReviewModal(fullText);
      };
    });
  }

  function renderBatchPagination() {
    const total = window.__batchResults?.length || 0;
    const perPage = window.__batchPerPage || 5;
    const page = window.__batchPage || 1;
    const totalPages = Math.ceil(total/perPage);
    const pagDiv = document.getElementById('batch-pagination');
    if (!pagDiv) return;
    let html = '';
    if (totalPages > 1) {
      html += `<button class="btn btn-sm btn-outline-secondary me-2" ${page<=1?'disabled':''} id="batch-prev">Prev</button>`;
      html += `<span class="align-middle">Page ${page} / ${totalPages}</span>`;
      html += `<button class="btn btn-sm btn-outline-secondary ms-2" ${page>=totalPages?'disabled':''} id="batch-next">Next</button>`;
    }
    pagDiv.innerHTML = html;
    if (document.getElementById('batch-prev')) {
      document.getElementById('batch-prev').onclick = function() {
        window.__batchPage = Math.max(1, page-1);
        renderBatchTable(getFilteredBatch(), 'batch-table-wrap');
        renderBatchPagination();
      };
    }
    if (document.getElementById('batch-next')) {
      document.getElementById('batch-next').onclick = function() {
        window.__batchPage = Math.min(totalPages, page+1);
        renderBatchTable(getFilteredBatch(), 'batch-table-wrap');
        renderBatchPagination();
      };
    }
  }

  function getFilteredBatch() {
    const val = document.getElementById('sentiment-filter')?.value || 'all';
    let filtered = window.__batchResults || [];
    if (val === 'positive') filtered = filtered.filter(r => r.label === 1);
    if (val === 'negative') filtered = filtered.filter(r => r.label === 0);
    return filtered;
  }

  if (document.getElementById('sentiment-filter')) {
    document.getElementById('sentiment-filter').addEventListener('change', function() {
      window.__batchPage = 1;
      renderBatchTable(getFilteredBatch(), 'batch-table-wrap');
      renderBatchPagination();
    });
  }

  if (document.getElementById('download-csv-btn')) {
    document.getElementById('download-csv-btn').addEventListener('click', function() {
      const rows = getFilteredBatch();
      let csv = 'Review,Sentiment,Probability\n';
      rows.forEach(r => {
        csv += '"' + r.text.replace(/"/g,'""') + '",' + (r.label === 1 ? 'Fresh' : 'Rotten') + ',' + ((r.probability*100).toFixed(2)) + '%\n';
      });
      const blob = new Blob([csv], {type: 'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'batch_results.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function showReviewModal(text) {
    let modal = document.getElementById('review-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'review-modal';
      modal.className = 'modal fade';
      modal.tabIndex = -1;
      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Review Detail</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body"><pre id="modal-review-text" style="white-space:pre-wrap;"></pre></div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    document.getElementById('modal-review-text').textContent = text;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  window.renderBatchResult = renderBatchResult;
  window.renderSingleResult = renderSingleResult;
  window.showHistoryModal = showHistoryModal;

  // Save batch upload history
  function saveBatchHistory(batchData) {
    try {
      const arr = JSON.parse(localStorage.getItem('batchHistory') || '[]');
      arr.unshift({ time: Date.now(), data: batchData });
      if (arr.length > 5) arr.pop();
      localStorage.setItem('batchHistory', JSON.stringify(arr));
    } catch (e) { console.warn('Batch history save failed:', e); }
  }

