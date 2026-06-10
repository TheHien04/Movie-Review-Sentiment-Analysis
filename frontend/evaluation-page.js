/**
 * Evaluation dashboard data loading (metrics + dataset overview)
 */
(function () {
  const FETCH_MS = 15000;
  const FETCH_MS_COMPUTE = 120000;

  function fetchJson(url, options) {
    options = options || {};
    const timeoutMs = options.timeout != null ? options.timeout : FETCH_MS;
    const optional = !!options.optional;
    const fetchOpts = { signal: null, cache: options.cache || 'no-store' };
    const ctrl = new AbortController();
    fetchOpts.signal = ctrl.signal;
    const timer = setTimeout(function () {
      ctrl.abort();
    }, timeoutMs);
    return fetch(url, fetchOpts)
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) {
          if (optional) return null;
          return res.json().catch(function () {
            return { error: 'HTTP ' + res.status };
          }).then(function (body) {
            throw new Error(body.error || 'HTTP ' + res.status);
          });
        }
        return res.json();
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (optional) return null;
        if (err.name === 'AbortError') {
          throw new Error(
            timeoutMs >= FETCH_MS_COMPUTE
              ? 'Computation timed out (>2 min). Try a smaller split or use saved metrics.'
              : 'Request timed out. Is the server running? Try: make serve'
          );
        }
        throw err;
      });
  }

  function requireCinemaChart() {
    if (!window.CinemaChart) {
      throw new Error('Chart theme failed to load. Hard-refresh the page (Cmd+Shift+R).');
    }
    return window.CinemaChart;
  }

  function normalizeMetrics(data) {
    if (!data || data.error) return null;
    const m =
      data.metrics && typeof data.metrics.accuracy === 'number' ? data.metrics : data;
    if (typeof m.accuracy !== 'number') return null;
    return {
      accuracy: m.accuracy,
      f1: m.f1,
      precision: m.precision,
      recall: m.recall,
      roc_auc: m.roc_auc,
      average_precision: m.average_precision,
      confusion_matrix: m.confusion_matrix || data.confusion_matrix,
      label_distribution: m.label_distribution || data.label_distribution,
      confidence_intervals: m.confidence_intervals || data.confidence_intervals || null,
      data_source: data.data_source || m.data_source || 'computed',
      n_samples: data.n_samples || m.n_samples,
      threshold_note: data.threshold_note,
    };
  }

  function metricsFromArtifactFile(artifact, split) {
    if (!artifact || !artifact.splits || !artifact.splits[split]) return null;
    const splitData = artifact.splits[split];
    const m = splitData.metrics || {};
    return normalizeMetrics(
      Object.assign({}, m, splitData, { data_source: 'evaluation_artifact' })
    );
  }

  function derivedFromCm(cm) {
    if (!cm || !cm.length) return null;
    const tn = cm[0][0];
    const fp = cm[0][1];
    const fn = cm[1][0];
    const tp = cm[1][1];
    const n = tn + fp + fn + tp;
    if (n <= 0) return null;
    const sensitivity = tp + fn > 0 ? tp / (tp + fn) : 0;
    const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
    return {
      n_samples: n,
      sensitivity: sensitivity,
      specificity: specificity,
      error_rate: (fp + fn) / n,
      false_positive_rate: fp + tn > 0 ? fp / (fp + tn) : 0,
      false_negative_rate: fn + tp > 0 ? fn / (fn + tp) : 0,
      balanced_accuracy: (sensitivity + specificity) / 2,
      positive_predictive_value: tp + fp > 0 ? tp / (tp + fp) : 0,
      negative_predictive_value: tn + fn > 0 ? tn / (tn + fn) : 0,
    };
  }

  function loadArtifactMetrics(split) {
    return fetchJson(ARTIFACT_URL, { timeout: 8000, optional: true }).then(function (artifact) {
      return metricsFromArtifactFile(artifact, split);
    });
  }

  const API_METRICS = window.apiUrl('/api/metrics');
  const API_DATASET = window.apiUrl('/api/dataset-info');
  const ARTIFACT_URL = window.apiUrl('/artifacts/results/evaluation.json');

  const metricsCardsEl = document.getElementById('metrics-cards');
  const confusionSection = document.querySelector('.confusion-section');
  const summaryBox = document.getElementById('summary-box');
  const labelCanvas = document.getElementById('label-chart');
  const datasetSplitCanvas = document.getElementById('dataset-split-chart');
  const metricsComparisonCanvas = document.getElementById('metrics-comparison-chart');
  const loadingEl = document.getElementById('eval-loading');
  const errorEl = document.getElementById('eval-error');

  let labelChart = null;
  let datasetSplitChart = null;
  let metricsComparisonChart = null;
  let currentThreshold = 0.5;
  let currentSplit = 'val';
  let comparisonSplit = 'test';

  function showMetricsSkeleton(show) {
    const sk = document.getElementById('metrics-skeleton');
    if (sk) sk.style.display = show ? 'grid' : 'none';
  }

  function showError(title, message, hint) {
    if (errorEl) {
      errorEl.style.display = 'block';
      if (window.uiErrorAlert) {
        errorEl.innerHTML = window.uiErrorAlert(title, message, hint);
      } else {
        errorEl.innerHTML =
          '<p><strong>' + title + '</strong> ' + message + '</p>';
      }
    }
  }

  function setSampleText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function loadDatasetInfo() {
    return fetchJson(API_DATASET)
      .then(function (data) {
        const stats = data.statistics || {};
        setSampleText('total-samples', (stats.total_samples || 0).toLocaleString());
        setSampleText('train-samples', (stats.train_samples || 0).toLocaleString());
        setSampleText('val-samples', (stats.val_samples || 0).toLocaleString());
        setSampleText('test-samples', (stats.test_samples || 0).toLocaleString());

        if (datasetSplitCanvas && typeof Chart !== 'undefined' && window.CinemaChart) {
          const CC = window.CinemaChart;
          if (datasetSplitChart) datasetSplitChart.destroy();
          datasetSplitChart = new Chart(datasetSplitCanvas, {
            type: 'bar',
            data: CC.splitBarDataset(
              stats.train_samples || 0,
              stats.val_samples || 0,
              stats.test_samples || 0
            ),
            options: CC.baseOptions('bar', {
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: CC.colors.grid },
                  ticks: {
                    color: CC.colors.tick,
                    callback: function (v) {
                      return Number(v).toLocaleString();
                    },
                  },
                },
                x: { grid: { display: false }, ticks: { color: CC.colors.tick } },
              },
            }),
          });
        }
      })
      .catch(function (err) {
        console.error('[Eval] dataset-info:', err);
        setSampleText('total-samples', '—');
        setSampleText('train-samples', '—');
        setSampleText('val-samples', '—');
        setSampleText('test-samples', '—');
        showError(
          'Dataset info unavailable',
          err.message,
          'Start the API with: make serve'
        );
      });
  }

  function renderMetrics(metrics, threshold) {
    let CC;
    try {
      CC = requireCinemaChart();
    } catch (chartErr) {
      console.warn('[Eval] charts skipped:', chartErr);
    }

    const badge = document.getElementById('metrics-source-badge');
    if (badge) {
      let html =
        '<span class="data-source-badge">' +
        (metrics.data_source || 'computed') +
        '</span>';
      if (metrics.n_samples) {
        html +=
          ' <span class="section-desc" style="display:inline;margin:0;">n=' +
          metrics.n_samples +
          '</span>';
      }
      if (metrics.confidence_intervals) {
        html +=
          ' <span class="section-desc" style="display:inline;margin:0;">· 95% bootstrap CI</span>';
      }
      if (metrics.threshold_note) {
        html +=
          '<p class="chart-note" style="margin-top:0.5rem;">' +
          metrics.threshold_note +
          '</p>';
      }
      badge.innerHTML = html;
    }

    if (metricsCardsEl) {
      const cis = metrics.confidence_intervals;
      const items = [
        { name: 'Accuracy', key: 'accuracy', value: metrics.accuracy, tip: '(TP + TN) / total' },
        { name: 'F1', key: 'f1', value: metrics.f1, tip: '2·(P·R)/(P+R)' },
        { name: 'Precision', key: 'precision', value: metrics.precision, tip: 'TP / (TP + FP)' },
        { name: 'Recall', key: 'recall', value: metrics.recall, tip: 'TP / (TP + FN)' },
      ];
      if (typeof metrics.roc_auc === 'number') {
        items.push({ name: 'ROC-AUC', key: null, value: metrics.roc_auc, tip: 'Area under ROC' });
      }
      if (typeof metrics.average_precision === 'number') {
        items.push({
          name: 'AP',
          key: null,
          value: metrics.average_precision,
          tip: 'Area under PR curve (average precision)',
        });
      }
      metricsCardsEl.innerHTML = items
        .map(function (m) {
          return (
            '<div class="metric-card"><div>' +
            m.name +
            ' <span class="info-badge" title="' +
            m.tip +
            '">i</span></div><div><strong>' +
            ((m.value || 0) * 100).toFixed(2) +
            '%</strong>' +
            (m.key ? metricCiHtml(m.key, cis) : '') +
            '</div></div>'
          );
        })
        .join('');
    }

    if (CC && metricsComparisonCanvas && typeof Chart !== 'undefined') {
      if (metricsComparisonChart) metricsComparisonChart.destroy();
      const rocPct =
        typeof metrics.roc_auc === 'number' ? metrics.roc_auc * 100 : null;
      const barData = CC.metricsBarDataset(
        metrics.accuracy * 100,
        metrics.f1 * 100,
        metrics.precision * 100,
        metrics.recall * 100,
        rocPct
      );
      const barOpts = CC.baseOptions('bar', {
        maintainAspectRatio: false,
        layout: { padding: { top: 8, bottom: 28, left: 8, right: 8 } },
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: CC.colors.grid },
            ticks: {
              color: CC.colors.tick,
              callback: function (v) {
                return v + '%';
              },
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              color: CC.colors.tick,
              autoSkip: false,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 11 },
              padding: 6,
            },
          },
        },
      });
      (window.requestAnimationFrame || setTimeout)(function () {
        metricsComparisonChart = new Chart(metricsComparisonCanvas, {
          type: 'bar',
          data: barData,
          options: barOpts,
        });
      }, 0);
    }

    if (confusionSection && metrics.confusion_matrix) {
      const cm = metrics.confusion_matrix;
      const max = Math.max(cm[0][0], cm[0][1], cm[1][0], cm[1][1], 1);
      const cell = function (v) {
        const style = CC ? CC.confusionCellStyle(v, max) : '';
        return (
          '<td style="' +
          style +
          '">' +
          v +
          '</td>'
        );
      };
      const old = confusionSection.querySelector('.cm-table-wrap');
      if (old) old.remove();
      confusionSection.insertAdjacentHTML(
        'beforeend',
        '<div class="cm-table-wrap"><table class="cm-table">' +
          '<thead><tr><th></th><th>Pred 0 (Rotten)</th><th>Pred 1 (Fresh)</th></tr></thead>' +
          '<tbody>' +
          '<tr><th>True 0</th>' +
          cell(cm[0][0]) +
          cell(cm[0][1]) +
          '</tr>' +
          '<tr><th>True 1</th>' +
          cell(cm[1][0]) +
          cell(cm[1][1]) +
          '</tr>' +
          '</tbody></table></div>'
      );
    }

    if (CC && labelCanvas && metrics.label_distribution && typeof Chart !== 'undefined') {
      const ld = metrics.label_distribution;
      const neg = Array.isArray(ld) ? ld[0] : ld.negative || 0;
      const pos = Array.isArray(ld) ? ld[1] : ld.positive || 0;
      if (labelChart) labelChart.destroy();
      const pieOpts = CC.baseOptions('pie', {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: CC.colors.legend, padding: 10, boxWidth: 14, font: { size: 11 } },
          },
        },
        layout: { padding: { top: 8, bottom: 16, left: 8, right: 8 } },
      });
      (window.requestAnimationFrame || setTimeout)(function () {
        labelChart = new Chart(labelCanvas, {
          type: 'doughnut',
          data: CC.labelDataset([neg, pos]),
          options: pieOpts,
        });
      }, 0);
    }

    if (summaryBox && metrics.confusion_matrix) {
      const cm = metrics.confusion_matrix;
      const n = cm[0][0] + cm[0][1] + cm[1][0] + cm[1][1];
      const ld = metrics.label_distribution || [0, 0];
      const neg = Array.isArray(ld) ? ld[0] : ld.negative || 0;
      const pos = Array.isArray(ld) ? ld[1] : ld.positive || 0;
      const total = neg + pos || 1;
      summaryBox.innerHTML =
        '<div class="summary-stat"><div class="label">Eval set size</div><div class="value">n = <span class="summary-value">' +
        n +
        '</span></div></div>' +
        '<div class="summary-stat"><div class="label">Decision threshold</div><div class="value"><span class="summary-value">' +
        Math.round(threshold * 100) +
        '%</span></div></div>' +
        '<div class="summary-stat"><div class="label">Rotten</div><div class="value"><span class="summary-value">' +
        neg +
        '</span> (' +
        ((neg / total) * 100).toFixed(1) +
        '%)</div></div>' +
        '<div class="summary-stat"><div class="label">Fresh</div><div class="value"><span class="summary-value">' +
        pos +
        '</span> (' +
        ((pos / total) * 100).toFixed(1) +
        '%)</div></div>';
    }
  }

  function updateMetricsSplitDesc(split) {
    const desc = document.getElementById('metrics-split-desc');
    if (desc) {
      const label = split === 'test' ? 'test' : 'validation';
      desc.innerHTML =
        'Key metrics on the <strong>' +
        label +
        '</strong> split (sklearn). Point estimates include <strong>95% bootstrap CI</strong> when available. Adjust threshold below to explore precision–recall trade-off.';
    }
  }

  function loadStatisticalSummary(split) {
    const useSplit = split || currentSplit;
    return loadArtifactMetrics(useSplit)
      .then(function (metrics) {
        if (metrics && metrics.confusion_matrix) {
          renderDerivedStats(derivedFromCm(metrics.confusion_matrix), null);
          return;
        }
        throw new Error('no artifact');
      })
      .catch(function () {
        const url =
          window.apiUrl('/api/statistical-summary?split=' + encodeURIComponent(useSplit));
        return fetchJson(url, { timeout: 10000, optional: true })
          .then(function (data) {
            if (data && data.derived) {
              renderDerivedStats(data.derived, data.optimal_threshold);
            }
          })
          .catch(function (err) {
            console.warn('[Eval] statistical summary:', err);
          });
      });
  }

  let lastMetricsSnapshot = null;
  let lastMetricsSplit = 'val';
  let lastMetricsThreshold = 0.5;

  function finishMetricsRender(metrics, threshold, useSplit) {
    if (loadingEl) loadingEl.style.display = 'none';
    showMetricsSkeleton(false);
    if (errorEl) errorEl.style.display = 'none';
    lastMetricsSnapshot = metrics;
    lastMetricsSplit = useSplit;
    lastMetricsThreshold = threshold;
    renderMetrics(metrics, threshold);
    loadStatisticalSummary(useSplit);
  }

  function exportEvaluationPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      if (window.toast) window.toast.error('PDF library not loaded');
      return;
    }
    const m = lastMetricsSnapshot;
    if (!m) {
      if (window.toast) window.toast.warn('Load metrics first');
      return;
    }
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFontSize(18);
    doc.text('CineSentiment — Model Evaluation', 40, 48);
    doc.setFontSize(11);
    doc.text('Split: ' + lastMetricsSplit + ' · Threshold: ' + Math.round(lastMetricsThreshold * 100) + '%', 40, 72);
    let y = 96;
    const lines = [
      'Accuracy: ' + pct(m.accuracy),
      'F1: ' + pct(m.f1),
      'Precision: ' + pct(m.precision),
      'Recall: ' + pct(m.recall),
      'ROC-AUC: ' + (typeof m.roc_auc === 'number' ? m.roc_auc.toFixed(4) : '—'),
    ];
    lines.forEach(function (line) {
      doc.text(line, 40, y);
      y += 16;
    });
    const cmCanvas = document.getElementById('confusion-matrix-chart');
    const cmpCanvas = document.getElementById('metrics-comparison-chart');
    if (cmCanvas && cmCanvas.width) {
      try {
        doc.addImage(cmCanvas.toDataURL('image/png'), 'PNG', 40, y, 220, 140);
        y += 155;
      } catch (_) { /* skip */ }
    }
    if (cmpCanvas && cmpCanvas.width) {
      try {
        doc.addImage(cmpCanvas.toDataURL('image/png'), 'PNG', 40, y, 220, 120);
      } catch (_) { /* skip */ }
    }
    doc.save('cinesentiment-evaluation-' + lastMetricsSplit + '.pdf');
    if (window.toast && window.toast.success) {
      window.toast.success('Evaluation PDF saved');
    }
  }

  function loadMetricsFromApi(threshold, recompute, useSplit) {
    const url =
      API_METRICS +
      '?split=' +
      encodeURIComponent(useSplit) +
      '&threshold=' +
      threshold +
      '&recompute=' +
      (recompute ? 'true' : 'false') +
      (recompute ? '&max_rows=1500' : '');

    return fetchJson(url, {
      timeout: recompute ? FETCH_MS_COMPUTE : FETCH_MS,
    })
      .then(function (data) {
        const metrics = normalizeMetrics(data);
        if (!metrics) throw new Error(data.error || 'Invalid metrics response');
        finishMetricsRender(metrics, threshold, useSplit);
        return metrics;
      });
  }

  function loadMetrics(threshold, recompute, split) {
    const useSplit = split || currentSplit;
    currentSplit = useSplit;
    currentThreshold = threshold;
    updateMetricsSplitDesc(useSplit);
    if (errorEl) errorEl.style.display = 'none';

    if (recompute) {
      if (loadingEl) {
        loadingEl.style.display = 'block';
        const p = loadingEl.querySelector('p');
        if (p) {
          p.textContent =
            'Recomputing ' + useSplit + ' metrics at new threshold (may take 1–2 min on CPU)…';
        }
      }
      showMetricsSkeleton(true);
      return loadMetricsFromApi(threshold, true, useSplit).catch(function (err) {
        console.error('[Eval] metrics recompute:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        showMetricsSkeleton(false);
        return loadArtifactMetrics(useSplit).then(function (metrics) {
          if (metrics) {
            finishMetricsRender(metrics, threshold, useSplit);
            if (window.toast) {
              window.toast.warning(
                'Using saved metrics',
                'Recompute failed: ' + err.message
              );
            }
          } else {
            showError(
              window.UI_MESSAGES?.errorMetricsTitle || 'Metrics unavailable',
              err.message,
              'Run: make evaluate && make serve'
            );
          }
        });
      });
    }

    showMetricsSkeleton(true);
    return loadArtifactMetrics(useSplit)
      .then(function (metrics) {
        if (metrics) {
          finishMetricsRender(metrics, threshold, useSplit);
          return metrics;
        }
        throw new Error('No evaluation artifact');
      })
      .catch(function (artifactErr) {
        console.warn('[Eval] artifact metrics:', artifactErr);
        return loadMetricsFromApi(threshold, false, useSplit).catch(function (err) {
          console.error('[Eval] metrics:', err);
          if (loadingEl) loadingEl.style.display = 'none';
          showMetricsSkeleton(false);
          showError(
            window.UI_MESSAGES?.errorMetricsTitle || 'Unable to load metrics',
            err.message,
            'Run: make evaluate && make serve — then hard-refresh (Cmd+Shift+R).'
          );
        });
      });
  }

  function pct(v) {
    return typeof v === 'number' ? (v * 100).toFixed(2) + '%' : '—';
  }

  function renderDerivedStats(derived, optimal) {
    const grid = document.getElementById('statistical-summary-grid');
    const optBox = document.getElementById('optimal-threshold-box');
    if (!grid) return;

    if (!derived || !derived.n_samples) {
      grid.innerHTML =
        '<p class="chart-note">No confusion matrix available for derived stats.</p>';
      if (optBox) optBox.innerHTML = '';
      return;
    }

    const items = [
      { label: 'Sensitivity (TPR)', value: derived.sensitivity, tip: 'TP / (TP + FN)' },
      { label: 'Specificity (TNR)', value: derived.specificity, tip: 'TN / (TN + FP)' },
      { label: 'Error rate', value: derived.error_rate, tip: '(FP + FN) / N' },
      { label: 'Balanced accuracy', value: derived.balanced_accuracy, tip: '(Sens + Spec) / 2' },
      { label: 'FPR', value: derived.false_positive_rate, tip: 'FP / (FP + TN)' },
      { label: 'FNR', value: derived.false_negative_rate, tip: 'FN / (FN + TP)' },
      { label: 'PPV (precision)', value: derived.positive_predictive_value, tip: 'TP / (TP + FP)' },
      { label: 'NPV', value: derived.negative_predictive_value, tip: 'TN / (TN + FN)' },
    ];

    grid.innerHTML = items
      .map(function (item) {
        return (
          '<div class="derived-stat">' +
          '<div class="derived-stat__label">' +
          item.label +
          ' <span class="info-badge" title="' +
          item.tip +
          '">i</span></div>' +
          '<div class="derived-stat__value">' +
          pct(item.value) +
          '</div></div>'
        );
      })
      .join('');

    if (optBox) {
      if (optimal && typeof optimal.threshold === 'number') {
        optBox.innerHTML =
          '<p class="insights-stat">F1-optimal threshold: <strong>' +
          Math.round(optimal.threshold * 100) +
          '%</strong> · F1 ' +
          pct(optimal.f1) +
          ' · P ' +
          pct(optimal.precision) +
          ' · R ' +
          pct(optimal.recall) +
          '</p>';
      } else {
        optBox.innerHTML =
          '<p class="chart-note">Run <code>make insights-curves</code> for F1-optimal threshold from saved sweep.</p>';
      }
    }
  }

  function pctDelta(v) {
    if (typeof v !== 'number') return '—';
    const sign = v >= 0 ? '+' : '';
    return sign + (v * 100).toFixed(2) + ' pp';
  }

  function cellWithCi(value, key, cis) {
    let html = pct(value);
    if (cis && cis[key]) {
      const c = cis[key];
      html +=
        '<br><span class="metric-ci">95% CI: ' +
        (c.low * 100).toFixed(1) +
        '–' +
        (c.high * 100).toFixed(1) +
        '%</span>';
    }
    return html;
  }

  function renderModelComparisonTable(data) {
    const el = document.getElementById('model-comparison-table');
    const deltasEl = document.getElementById('model-comparison-deltas');
    if (!el || !data || !data.models || !data.models.length) return;

    let html =
      '<table class="cm-table"><thead><tr><th>Model</th><th>Accuracy</th><th>F1</th><th>Precision</th><th>Recall</th><th>ROC-AUC</th><th>Avg prec</th></tr></thead><tbody>';
    data.models.forEach(function (row) {
      const cis = row.confidence_intervals || null;
      html +=
        '<tr><th>' +
        escapeHtml(row.model) +
        '</th><td>' +
        cellWithCi(row.accuracy, 'accuracy', cis) +
        '</td><td>' +
        cellWithCi(row.f1, 'f1', cis) +
        '</td><td>' +
        cellWithCi(row.precision, 'precision', cis) +
        '</td><td>' +
        cellWithCi(row.recall, 'recall', cis) +
        '</td><td>' +
        cellWithCi(row.roc_auc, 'roc_auc', cis) +
        '</td><td>' +
        pct(row.average_precision) +
        '</td></tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;

    if (deltasEl && data.deltas) {
      const d = data.deltas;
      deltasEl.innerHTML =
        '<p class="chart-note"><strong>Δ (DistilBERT − TF-IDF):</strong> ' +
        'Acc ' +
        pctDelta(d.accuracy) +
        ' · F1 ' +
        pctDelta(d.f1) +
        ' · P ' +
        pctDelta(d.precision) +
        ' · R ' +
        pctDelta(d.recall) +
        ' · AUC ' +
        pctDelta(d.roc_auc) +
        (data.delta_note ? ' — <span title="' + escapeHtml(data.delta_note) + '">ℹ</span>' : '') +
        '</p>';
    } else if (deltasEl) {
      deltasEl.innerHTML = '';
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function metricCiHtml(key, cis) {
    if (!cis || !cis[key]) return '';
    const c = cis[key];
    return (
      '<span class="metric-ci" title="95% bootstrap CI (500 resamples, percentile method)">' +
      '95% CI: ' +
      (c.low * 100).toFixed(1) +
      '–' +
      (c.high * 100).toFixed(1) +
      '%</span>'
    );
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(cur);
        cur = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        if (ch === '\r') i++;
        row.push(cur);
        cur = '';
        if (row.some(function (c) { return c.length; })) rows.push(row);
        row = [];
      } else if (ch !== '\r') {
        cur += ch;
      }
    }
    if (cur.length || row.length) {
      row.push(cur);
      if (row.some(function (c) { return c.length; })) rows.push(row);
    }
    if (!rows.length) return [];
    const headers = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).map(function (cols) {
      const o = {};
      headers.forEach(function (h, idx) {
        o[h] = (cols[idx] || '').trim();
      });
      return o;
    });
  }

  let errorAnalysisRows = [];
  let errorAnalysisSummary = null;

  function labelName(code) {
    return String(code) === '1' ? 'Fresh' : 'Rotten';
  }

  function truncateText(text, maxLen) {
    const s = String(text || '').trim();
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen).trim() + '…';
  }

  function renderErrorAnalysisList(filter) {
    const listEl = document.getElementById('error-analysis-list');
    const countEl = document.getElementById('error-analysis-count');
    const emptyEl = document.getElementById('error-analysis-empty');
    if (!listEl) return;

    const filtered = errorAnalysisRows.filter(function (row) {
      return filter === 'all' || row.error_type === filter;
    });

    if (countEl) {
      const fp = errorAnalysisSummary ? errorAnalysisSummary.false_positive : null;
      const fn = errorAnalysisSummary ? errorAnalysisSummary.false_negative : null;
      let msg = filtered.length + ' shown';
      if (fp != null && fn != null) {
        msg += ' · FP ' + fp + ' · FN ' + fn;
      }
      countEl.textContent = msg;
    }

    if (!filtered.length) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = errorAnalysisRows.length ? 'none' : 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = filtered
      .map(function (row) {
        const isFp = row.error_type === 'false_positive';
        const badgeClass = isFp ? 'error-badge error-badge--fp' : 'error-badge error-badge--fn';
        const badgeLabel = isFp ? 'FP' : 'FN';
        const trueName = labelName(row.true_label);
        const predName = labelName(row.predicted_label);
        const prob = (parseFloat(row.prob_positive) * 100).toFixed(0);
        return (
          '<article class="error-card error-card--compact" role="listitem">' +
          '<div class="error-card__head">' +
          '<span class="' +
          badgeClass +
          '" title="' +
          (isFp ? 'Predicted Fresh, actually Rotten' : 'Predicted Rotten, actually Fresh') +
          '">' +
          badgeLabel +
          '</span>' +
          '<span class="error-card__route">' +
          trueName +
          ' → ' +
          predName +
          ' · ' +
          prob +
          '%</span>' +
          '</div>' +
          '<p class="error-card__text">' +
          escapeHtml(truncateText(row.text_preview, 140)) +
          '</p>' +
          '</article>'
        );
      })
      .join('');
  }

  function loadErrorAnalysis() {
    const apiUrl = window.apiUrl('/api/error-analysis?limit=30');
    const csvUrl = window.apiUrl('/artifacts/results/error_analysis_test.csv');
    const errEl = document.getElementById('error-analysis-error');
    const filterEl = document.getElementById('error-type-filter');

    return fetchJson(apiUrl)
      .then(function (data) {
        errorAnalysisRows = data.rows || [];
        errorAnalysisSummary = data.counts || data.summary || null;
        if (errEl) errEl.style.display = 'none';
        renderErrorAnalysisList(filterEl ? filterEl.value : 'all');
      })
      .catch(function () {
        return fetch(csvUrl)
          .then(function (res) {
            if (!res.ok) throw new Error('Error analysis not found. Run: make error-analysis');
            return res.text();
          })
          .then(function (text) {
            const allRows = parseCsv(text);
            errorAnalysisSummary = {
              false_positive: allRows.filter(function (r) {
                return r.error_type === 'false_positive';
              }).length,
              false_negative: allRows.filter(function (r) {
                return r.error_type === 'false_negative';
              }).length,
              total_exported: allRows.length,
            };
            errorAnalysisRows = allRows.slice(0, 30);
            if (errEl) errEl.style.display = 'none';
            renderErrorAnalysisList(filterEl ? filterEl.value : 'all');
          });
      })
      .catch(function (err) {
        console.warn('[Eval] error analysis:', err);
        errorAnalysisRows = [];
        errorAnalysisSummary = null;
        renderErrorAnalysisList('all');
        if (errEl) {
          errEl.style.display = 'block';
          errEl.textContent = err.message;
        }
      });
  }

  function loadModelComparison(split) {
    const useSplit = split || comparisonSplit;
    comparisonSplit = useSplit;
    const url = window.apiUrl('/api/model-comparison?split=' + encodeURIComponent(useSplit));
    return fetchJson(url)
      .then(renderModelComparisonTable)
      .catch(function (err) {
        console.warn('[Eval] model comparison:', err);
        const el = document.getElementById('model-comparison-table');
        const deltasEl = document.getElementById('model-comparison-deltas');
        if (el) {
          el.innerHTML =
            '<p class="chart-note">Run <code>make baseline</code> then refresh.</p>';
        }
        if (deltasEl) deltasEl.innerHTML = '';
      });
  }

  function init() {
    const slider = document.getElementById('threshold-slider');
    const valueSpan = document.getElementById('threshold-value');
    if (slider && valueSpan) {
      slider.addEventListener('input', function () {
        valueSpan.textContent = Math.round(this.value * 100) + '%';
      });
      slider.addEventListener('change', function () {
        loadMetrics(parseFloat(this.value), true);
      });
    }

    const errorFilter = document.getElementById('error-type-filter');
    if (errorFilter) {
      errorFilter.addEventListener('change', function () {
        renderErrorAnalysisList(this.value);
      });
    }

    const metricsSplit = document.getElementById('metrics-split');
    if (metricsSplit) {
      metricsSplit.addEventListener('change', function () {
        loadMetrics(currentThreshold, false, this.value);
      });
    }

    const comparisonSplitEl = document.getElementById('comparison-split');
    if (comparisonSplitEl) {
      comparisonSplitEl.addEventListener('change', function () {
        loadModelComparison(this.value);
      });
    }

    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', exportEvaluationPdf);
    }

    Promise.all([
      loadDatasetInfo(),
      loadMetrics(currentThreshold, false),
      loadModelComparison(),
      loadErrorAnalysis(),
    ]).catch(
      function () {
        /* errors handled per-section */
      }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
