// main.js - Handle frontend logic for all main pages

document.addEventListener('DOMContentLoaded', function () {
  // -------- Sentiment Analysis (batch.html) --------
  const analyzeBtn = document.getElementById('analyze-btn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async function () {
      const ta = document.getElementById('single-review');
      const review = (ta?.value || '').trim();
      if (!review) return alert('Please enter a review!');
      showLoading('single-result');
      try {
        const res = await fetch('http://localhost:8000/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: review })
        });
        const data = await res.json();
        renderSingleResult(data, 'single-result');
      } catch {
        document.getElementById('single-result').textContent = 'Error. Try again.';
      }
    });
    // render history if any
    renderHistory();
  }

  // Batch review analysis + upload progress
  const batchBtn = document.getElementById('batch-analyze-btn');
  if (batchBtn) {
    batchBtn.addEventListener('click', function () {
      const fileInput = document.getElementById('file-input');
      const uploadMsg = document.getElementById('upload-message');
      if (uploadMsg) uploadMsg.style.display = 'none';
      if (!fileInput?.files?.length) return alert('Please select a CSV file!');
      showLoading('result-section');

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'http://localhost:8000/api/predict', true);
      const bar = document.getElementById('upload-bar');
      const wrap = document.getElementById('upload-progress');
      if (wrap && bar) { wrap.style.display = 'block'; bar.style.width = '0%'; }

      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable && bar) {
          const pct = Math.round((e.loaded / e.total) * 100);
          bar.style.width = pct + '%';
        }
      };
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          // handle response here if needed
        }
      };
    });
  }

  // Di chuyển hàm setupThresholdSlider ra ngoài, không lồng vào event handler
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
    // Kích hoạt Bootstrap tooltip cho các nút
    const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
      new bootstrap.Tooltip(tooltipTriggerEl);
    });

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

    // -------- Evaluation (evaluation.html) --------
    if (document.getElementById('metrics-cards')) {
      console.log('[DEBUG] Starting metrics fetch...');
      const loading = document.getElementById('eval-loading');
      const errorDiv = document.getElementById('eval-error');
      let evalData = null;
      let currentThreshold = 0.5;
      function fetchAndRenderEvaluation(threshold) {
        if (loading) loading.style.display = 'block';
        if (errorDiv) { errorDiv.style.display = 'none'; errorDiv.textContent = ''; }
        
        console.log('[DEBUG] Fetching metrics with threshold:', threshold);
        fetch(`http://localhost:8000/api/metrics?threshold=${threshold}`)
          .then(r => { 
            console.log('[DEBUG] Metrics response:', r.status, r.statusText);
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`); 
            return r.json(); 
          })
          .then(data => {
            console.log('✓ Metrics loaded:', data);
            if (loading) loading.style.display = 'none';
            evalData = data;
            renderConfusionMatrix(data.confusion_matrix);
            renderMetrics(data);
            renderLabelChart(data.label_distribution);
            renderSummary(data);
          })
          .catch((err) => {
            if (loading) loading.style.display = 'none';
            console.error('✗ Metrics error:', err);
            if (errorDiv) {
              errorDiv.style.display = 'block';
              errorDiv.innerHTML = `
                <div style="color: #ff6b6b; padding: 15px; background: rgba(255,107,107,0.1); border-radius: 8px; text-align: left;">
                  <strong>❌ Không thể tải metrics</strong><br><br>
                  <strong>Lỗi:</strong> ${err.message}<br><br>
                  <strong>Hướng dẫn fix:</strong><br>
                  1. Kiểm tra Backend có chạy không (port 8000)<br>
                  2. Mở tab mới, truy cập: <a href="http://localhost:8000/api/metrics" target="_blank" style="color:#7b5cff;">http://localhost:8000/api/metrics</a><br>
                  3. Hard refresh trang này: <kbd>Cmd+Shift+R</kbd> (Mac) hoặc <kbd>Ctrl+Shift+R</kbd> (Windows)
                </div>
              `;
            }
          });
      }
      // Initial fetch
      fetchAndRenderEvaluation(currentThreshold);
      // Setup threshold slider
      const slider = document.getElementById('threshold-slider');
      const valueSpan = document.getElementById('threshold-value');
      if (slider && valueSpan) {
        slider.value = currentThreshold;
        valueSpan.textContent = `${Math.round(slider.value * 100)}%`;
        slider.addEventListener('input', function () {
          valueSpan.textContent = `${Math.round(slider.value * 100)}%`;
        });
        slider.addEventListener('change', function () {
          currentThreshold = parseFloat(slider.value);
          fetchAndRenderEvaluation(currentThreshold);
        });
      }
      // Modal logic for details
      function showDetailModal(title, html) {
        let modal = document.getElementById('detail-modal');
        let modalBody = document.getElementById('detail-modal-body');
        let modalTitle = document.getElementById('detailModalLabel');
        if (!modal || !modalBody || !modalTitle) return;
        modalTitle.textContent = title;
        modalBody.innerHTML = html;
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
      }
      // View Metrics Details
      const metricsBtn = document.getElementById('metrics-detail-btn');
      if (metricsBtn) {
        metricsBtn.onclick = function () {
          if (!evalData) return;
          let html = '<ul style="padding-left:18px">';
          const tips = {
            'Accuracy': '(TP + TN) / total',
            'F1 Score': '2·(Precision·Recall)/(Precision+Recall)',
            'Precision': 'TP / (TP + FP)',
            'Recall': 'TP / (TP + FN)',
            'Specificity': 'TN / (TN + FP)'
          };
          ['accuracy','f1','precision','recall','specificity'].forEach(k => {
            if (evalData[k] != null) {
              html += `<li><strong>${k.charAt(0).toUpperCase()+k.slice(1)}:</strong> ${(evalData[k]*100).toFixed(2)}% <span style='color:#888'>${tips[k.charAt(0).toUpperCase()+k.slice(1)]||''}</span></li>`;
            }
          });
          html += '</ul>';
          showDetailModal('Metrics Details', html);
        };
      }
      // View Confusion Matrix Details
      const cmBtn = document.getElementById('cm-detail-btn');
      if (cmBtn) {
        cmBtn.onclick = function () {
          if (!evalData) return;
          let html = '<table class="cm-table"><thead><tr><th></th><th>Pred 0</th><th>Pred 1</th></tr></thead><tbody>';
          const cm = evalData.confusion_matrix;
          html += `<tr><th>True 0</th><td>${cm[0][0]}</td><td>${cm[0][1]}</td></tr>`;
          html += `<tr><th>True 1</th><td>${cm[1][0]}</td><td>${cm[1][1]}</td></tr>`;
          html += '</tbody></table>';
          showDetailModal('Confusion Matrix Details', html);
        };
      }
      // View Label Distribution Details
      const labelBtn = document.getElementById('label-detail-btn');
      if (labelBtn) {
        labelBtn.onclick = function () {
          if (!evalData) return;
          const ld = evalData.label_distribution;
          let neg = Array.isArray(ld) ? (ld[0]||0) : (ld.negative||0);
          let pos = Array.isArray(ld) ? (ld[1]||0) : (ld.positive||0);
          let html = `<div><strong>Negative:</strong> ${neg}</div><div><strong>Positive:</strong> ${pos}</div>`;
          showDetailModal('Label Distribution Details', html);
        };
      }
    }

    // -------- Dataset (dataset.html) --------
    if (document.getElementById('dataset-stats')) {
      console.log('[DEBUG] Starting dataset fetch...');
      document.getElementById('dataset-stats').innerHTML = '<span style="color:#aaa;">⏳ Đang tải dữ liệu...</span>';
      
      fetch('http://localhost:8000/api/dataset-info')
        .then(r => {
          console.log('[DEBUG] Response status:', r.status, r.statusText);
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
          return r.json();
        })
        .then(data => {
          console.log('✓ Dataset loaded:', data);
          if (!data || !data.stats) {
            throw new Error('API trả về dữ liệu không hợp lệ');
          }
          renderDatasetStats(data.stats);
          renderSampleTable(data.samples);
          initSampleTableEnhance();
          // Pie chart for label distribution
          if (data.stats && typeof data.stats.Negative !== 'undefined' && typeof data.stats.Positive !== 'undefined') {
            renderDatasetLabelChart(data.stats.Negative, data.stats.Positive);
          }
        })
        .catch(err => {
          console.error('✗ Dataset error:', err);
          document.getElementById('dataset-stats').innerHTML = `
            <div style="color: #ff6b6b; padding: 15px; background: rgba(255,107,107,0.1); border-radius: 8px;">
              <strong>❌ Không thể tải dữ liệu</strong><br><br>
              <strong>Lỗi:</strong> ${err.message}<br><br>
              <strong>Hướng dẫn fix:</strong><br>
              1. Kiểm tra Backend có chạy không (port 8000)<br>
              2. Mở tab mới, truy cập: <a href="http://localhost:8000/api/dataset-info" target="_blank" style="color:#7b5cff;">http://localhost:8000/api/dataset-info</a><br>
              3. Hard refresh trang này: <kbd>Cmd+Shift+R</kbd> (Mac) hoặc <kbd>Ctrl+Shift+R</kbd> (Windows)<br>
              4. Mở Console (F12) để xem chi tiết lỗi
            </div>
          `;
        });
      // Pie chart rendering function
      let pieChartInstance = null;
      function renderDatasetLabelChart(neg, pos) {
        const canvas = document.getElementById('label-chart');
        if (!canvas) return;
        // Set fixed size via attributes
        canvas.width = 340;
        canvas.height = 220;
        if (pieChartInstance) {
          pieChartInstance.destroy();
          pieChartInstance = null;
        }
        const ctx = canvas.getContext('2d');
        pieChartInstance = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: ['Negative', 'Positive'],
            datasets: [{ data: [neg, pos], backgroundColor: ['#eebbc3', '#7b5cff'] }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: { animateRotate: true, duration: 600 },
            plugins: {
              legend: { position: 'bottom' },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const total = neg + pos || 1;
                    const v = ctx.raw;
                    const p = (v * 100 / total).toFixed(1);
                    return `${ctx.label}: ${v} (${p}%)`;
                  }
                }
              }
            }
          }
        });
      }
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
    const isPos = data.label === 1;
    const icon = isPos ? '😃' : '😞';
    const confidence = data.probability;
    
    // Create unique ID for gradient container
    const gradientId = `confidence-gradient-${Date.now()}`;
    
    el.innerHTML = `
      <div class="result-card" style="animation:pop .18s ease;">
        <h3>Prediction Result</h3>
        <p><strong>Sentiment:</strong> <span class="${isPos ? 'pos' : 'neg'}">${icon} ${isPos ? 'Positive' : 'Negative'}</span></p>
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
    } catch {}
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
                    <strong style="color: var(--purple-primary);">${stats.positive}</strong><br><small>Positive</small>
                  </div>
                </div>
                <div class="col-md-3 text-center">
                  <div class="p-2 rounded" style="background: var(--bg-secondary);">
                    <strong style="color: var(--error-color);">${stats.negative}</strong><br><small>Negative</small>
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
    // Save batch data for download/filter
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
        <td class="${row.label === 1 ? 'pos' : 'neg'}" style="width:20%;">${row.label === 1 ? 'Positive' : 'Negative'}</td>
        <td style="width:25%;">${(row.probability * 100).toFixed(2)}%</td>
      </tr>
    `).join('');
    document.getElementById(sectionId).innerHTML = `
      <h3>Batch Prediction Results</h3>
      <table>
        <thead>
          <tr>
            <th style="width:55%;">Review</th>
            <th style="width:20%;">Sentiment</th>
            <th style="width:25%;">Probability</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
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
        csv += '"' + r.text.replace(/"/g,'""') + '",' + (r.label === 1 ? 'Positive' : 'Negative') + ',' + ((r.probability*100).toFixed(2)) + '%\n';
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

  // Lưu lịch sử upload batch
  function saveBatchHistory(batchData) {
    try {
      const arr = JSON.parse(localStorage.getItem('batchHistory') || '[]');
      arr.unshift({ time: Date.now(), data: batchData });
      if (arr.length > 5) arr.pop();
      localStorage.setItem('batchHistory', JSON.stringify(arr));
    } catch {}
  }

  /* ---------- Evaluation ---------- */
  let __lastCM;
  function renderConfusionMatrix(cm) {
    if (!cm) return;
    __lastCM = cm;
    const max = Math.max(cm[0][0], cm[0][1], cm[1][0], cm[1][1], 1);
    const cell = (v) => {
      const a = 0.15 + 0.35 * (v / max); // alpha 0.15–0.50
      return `<td style="background:rgba(232,187,195,${a});">${v}</td>`;
    };
    const html =
      '<div class="cm-table-wrap"><table class="cm-table">' +
        '<thead><tr><th></th><th>Pred 0</th><th>Pred 1</th></tr></thead>' +
        `<tbody>
          <tr><th>True 0</th>${cell(cm[0][0])}${cell(cm[0][1])}</tr>
          <tr><th>True 1</th>${cell(cm[1][0])}${cell(cm[1][1])}</tr>
        </tbody>` +
      '</table></div>';
    const section = document.querySelector('.confusion-section');
    if (section) {
      while (section.children.length > 1) section.removeChild(section.lastChild);
      section.insertAdjacentHTML('beforeend', html);
    }
  }

  function renderMetrics(data) {
    const tips = {
      'Accuracy': '(TP + TN) / total',
      'F1 Score': '2·(Precision·Recall)/(Precision+Recall)',
      'Precision': 'TP / (TP + FP)',
      'Recall': 'TP / (TP + FN)',
      'Specificity': 'TN / (TN + FP)'
    };
    // optional Specificity derived from CM if available
    let spec;
    if (__lastCM) {
      const tn = __lastCM[0][0], fp = __lastCM[1][0];
      spec = tn / ((tn + fp) || 1);
    }
    const metrics = [
      { name: 'Accuracy', value: data.accuracy },
      { name: 'F1 Score', value: data.f1 },
      { name: 'Precision', value: data.precision },
      { name: 'Recall', value: data.recall },
      ...(spec != null ? [{ name: 'Specificity', value: spec }] : [])
    ];
    document.getElementById('metrics-cards').innerHTML = metrics.map(m => `
      <div class="metric-card">
        <div>${m.name}<span class="info-badge" data-tip="${tips[m.name] || ''}">i</span></div>
        <div><strong>${(m.value * 100).toFixed(2)}%</strong></div>
      </div>
    `).join('');
  }

  // Tooltip cho các chỉ số
  if (document.querySelectorAll('.info-badge')) {
    document.querySelectorAll('.info-badge').forEach(function(el) {
      new bootstrap.Tooltip(el, {
        title: el.getAttribute('data-tip') || 'Giải thích chỉ số',
        placement: 'top',
        trigger: 'hover',
      });
    });
  }

  // Export PDF cho toàn bộ evaluation
  if (document.getElementById('export-pdf-btn')) {
    document.getElementById('export-pdf-btn').addEventListener('click', function() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.setFont('Montserrat', 'bold');
      doc.setFontSize(20);
      doc.text('Model Evaluation', 40, 50);
      doc.setFontSize(13);
      // Metrics
      doc.text('Evaluation Metrics:', 40, 90);
      let y = 110;
      document.querySelectorAll('.metric-card').forEach(card => {
        doc.text(card.textContent.trim(), 60, y);
        y += 22;
      });
      // Confusion Matrix
      doc.text('Confusion Matrix:', 40, y+10);
      y += 30;
      const cmTable = document.querySelector('.cm-table');
      if (cmTable) {
        let cmText = '';
        cmTable.querySelectorAll('tr').forEach(tr => {
          cmText += Array.from(tr.children).map(td => td.textContent.trim()).join(' | ') + '\n';
        });
        doc.setFontSize(11);
        doc.text(cmText, 60, y);
        y += 60;
      }
      // Summary
      doc.setFontSize(13);
      doc.text('Summary:', 40, y);
      y += 20;
      const summary = document.getElementById('summary-box');
      if (summary) {
        doc.setFontSize(11);
        doc.text(summary.textContent.trim(), 60, y);
        y += 60;
      }
      // Pie chart (label distribution)
      const chartCanvas = document.getElementById('label-chart');
      if (chartCanvas) {
        const imgData = chartCanvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 320, 90, 180, 140);
      }
      doc.save('evaluation_report.pdf');
    });
  }

  /* ---------- Label Distribution (Pie Chart) ---------- */
  let __labelChart;
  let __labelDistRaw;
  function renderLabelChart(labelDist, filter = 'all') {
    if (!labelDist) return;
    __labelDistRaw = labelDist;
    const canvas = document.getElementById('label-chart');
    if (!canvas) return;

    let neg = Array.isArray(labelDist) ? (labelDist[0] ?? 0) : (labelDist.negative ?? 0);
    let pos = Array.isArray(labelDist) ? (labelDist[1] ?? 0) : (labelDist.positive ?? 0);
    let labels = ['Negative', 'Positive'];
    let data = [neg, pos];
    let bg = ['#eebbc3', '#232946'];
    if (filter === 'negative') { labels = ['Negative']; data = [neg]; bg = ['#eebbc3']; }
    if (filter === 'positive') { labels = ['Positive']; data = [pos]; bg = ['#232946']; }

    if (window.__labelChart) window.__labelChart.destroy();

    const ctx = canvas.getContext('2d');
    window.__labelChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: bg }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { animateRotate: true, duration: 600 },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = data.reduce((a,b)=>a+b,0) || 1;
                const v = ctx.raw;
                const p = (v * 100 / total).toFixed(1);
                return `${ctx.label}: ${v} (${p}%)`;
              }
            }
          }
        }
      }
    });
  }

  if (document.getElementById('label-filter')) {
    document.getElementById('label-filter').addEventListener('change', function() {
      const filter = this.value;
      renderLabelChart(__labelDistRaw, filter);
    });
  }

  function renderDatasetStats(stats) {
    const el = document.getElementById('dataset-stats');
    if (!el) return;
    const html = Object.keys(stats || {}).map(k => {
      const label = k.replace(/_/g, ' ');
      return `<div style="font-size:1.05rem; margin-bottom:6px;"><strong>${label}:</strong> ${typeof stats[k] === 'number' ? stats[k].toLocaleString() : stats[k]}</div>`;
    }).join('');
    el.innerHTML = html || '<span style="color:#999;">No data available</span>';
  }

  function renderSampleTable(samples) {
    const tbody = document.querySelector('#sample-table tbody');
    if (!tbody) return;
    tbody.innerHTML = (samples || []).map(row =>
      `<tr><td>${row.text}</td><td>${row.label === 1 ? 'Positive' : 'Negative'}</td></tr>`
    ).join('');
  }

  /* dataset filter + pagination */
  function initSampleTableEnhance(){
    const rows   = [...document.querySelectorAll('#sample-table tbody tr')];
    const search = document.getElementById('sample-search');
    const info   = document.getElementById('page-info');
    const count  = document.getElementById('sample-count');
    const prev   = document.getElementById('prev-page');
    const next   = document.getElementById('next-page');
    const perSel = document.getElementById('per-page');

    if (!rows.length || !info || !prev || !next) return;

    // helper: đảm bảo dropdown có option cụ thể
    const ensureOption = (sel, val) => {
      if (!sel) return;
      const has = [...sel.options].some(o => o.value === String(val));
      if (!has) {
        const opt = document.createElement('option');
        opt.value = String(val);
        opt.textContent = String(val);
        sel.appendChild(opt);
      }
    };

    let per = parseInt(perSel?.value || '10', 10);
    // Nếu chỉ có 1 trang, tự giảm per xuống ~nửa số dòng (ít nhất 1)
    if (rows.length > 1 && per >= rows.length) {
      per = Math.max(1, Math.ceil(rows.length / 2));
      ensureOption(perSel, per);
      if (perSel) perSel.value = String(per);
    }

    let page = 1;
    let view = rows;

    const totalPages = () => Math.max(1, Math.ceil(view.length / per));
    const updateButtons = () => {
      prev.disabled = page <= 1;
      next.disabled = page >= totalPages();
    };

    function apply(){
      per = parseInt(perSel?.value || per, 10);
      const t = totalPages();
      page = Math.min(page, t);
      rows.forEach(r => r.style.display = 'none');
      view.slice((page-1)*per, page*per).forEach(r => r.style.display = 'table-row');
      info.textContent = `${page}/${t}`;
      if (count) count.textContent = `${view.length} items`;
      updateButtons();
    }

    search?.addEventListener('input', e=>{
      const q = e.target.value.toLowerCase();
      view = rows.filter(r => r.textContent.toLowerCase().includes(q));
      page = 1;
      // nếu sau khi lọc lại chỉ còn 1 trang, tự chỉnh per cho hợp lý
      if (view.length > 1 && per >= view.length) {
        per = Math.max(1, Math.ceil(view.length / 2));
        ensureOption(perSel, per);
        if (perSel) perSel.value = String(per);
      }
      apply();
    });
    perSel?.addEventListener('change', ()=>{ page = 1; apply(); });
    prev?.addEventListener('click', ()=>{ if (page > 1) { page--; apply(); } });
    next?.addEventListener('click', ()=>{ if (page < totalPages()) { page++; apply(); } });

    apply();
  }

  function renderSummary(data){
    const box = document.getElementById('summary-box');
    if (!box) return;

    // Test size n from confusion matrix (fallback to label distribution)
    let n = 0;
    if (data?.confusion_matrix){
      const cm = data.confusion_matrix;
      n = (cm[0][0]||0)+(cm[0][1]||0)+(cm[1][0]||0)+(cm[1][1]||0);
    } else if (data?.label_distribution){
      const ld = data.label_distribution;
      n = Array.isArray(ld) ? (ld[0]||0)+(ld[1]||0) : (ld.negative||0)+(ld.positive||0);
    }
    // Class balance
    let neg = 0, pos = 0;
    if (data?.label_distribution){
      const ld = data.label_distribution;
      neg = Array.isArray(ld) ? (ld[0]||0) : (ld.negative||0);
      pos = Array.isArray(ld) ? (ld[1]||0) : (ld.positive||0);
    }
    const total = Math.max(1, neg + pos);
    const negPct = ((neg*100)/total).toFixed(1);
    const posPct = ((pos*100)/total).toFixed(1);
    // Threshold (default 0.5 if API not provided)
    const thr = (typeof data?.threshold === 'number') ? data.threshold : 0.5;

    box.innerHTML = `
      <div class="summary-stat">
        <div class="label">Test set size</div>
        <div class="value">n = <span class="summary-value">${n}</span></div>
      </div>
      <div class="summary-stat">
        <div class="label">Decision threshold</div>
        <div class="value"><span class="summary-value">${(thr*100).toFixed(0)}%</span></div>
      </div>
      <div class="summary-stat">
        <div class="label">Class balance • Negative</div>
        <div class="value"><span class="summary-value">${neg}</span> (${negPct}%)</div>
      </div>
      <div class="summary-stat">
        <div class="label">Class balance • Positive</div>
        <div class="value"><span class="summary-value">${pos}</span> (${posPct}%)</div>
      </div>
      <div class="summary-actions">
        <a class="btn-soft" href="/api/predictions.csv" download>Download predictions.csv</a>
        <a class="btn-soft" href="/api/confusion_matrix.csv" download>Download confusion_matrix.csv</a>
      </div>
    `;
  }
