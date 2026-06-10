/**
 * Evaluation "View details" buttons — standalone (works even if evaluation-page.js is cached).
 */
(function (global) {
  'use strict';

  var metricsCache = null;

  function url(path) {
    if (typeof global.apiUrl === 'function') return global.apiUrl(path);
    return path.startsWith('/') ? path : '/' + path;
  }

  function currentSplit() {
    var el = document.getElementById('metrics-split');
    return el && el.value ? el.value : 'val';
  }

  function currentThreshold() {
    var el = document.getElementById('threshold-slider');
    return el ? parseFloat(el.value) || 0.5 : 0.5;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function pct(v) {
    return typeof v === 'number' && !isNaN(v) ? (v * 100).toFixed(2) + '%' : '—';
  }

  function normalizeFromArtifact(artifact, split) {
    var splitData = artifact && artifact.splits && artifact.splits[split];
    if (!splitData || !splitData.metrics) return null;
    var m = splitData.metrics;
    return {
      accuracy: m.accuracy,
      f1: m.f1,
      precision: m.precision,
      recall: m.recall,
      roc_auc: m.roc_auc,
      average_precision: m.average_precision,
      confusion_matrix: m.confusion_matrix || splitData.confusion_matrix,
      label_distribution: m.label_distribution || splitData.label_distribution,
      confidence_intervals: m.confidence_intervals,
      n_samples: splitData.n_samples || m.n_samples,
      data_source: 'evaluation_artifact',
    };
  }

  function normalizeFromApi(data) {
    if (!data || data.error) return null;
    var m = data.metrics && typeof data.metrics.accuracy === 'number' ? data.metrics : data;
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
      confidence_intervals: m.confidence_intervals || data.confidence_intervals,
      n_samples: data.n_samples || m.n_samples,
      data_source: data.data_source || 'api',
    };
  }

  function fetchMetrics(force) {
    if (!force && metricsCache) return Promise.resolve(metricsCache);
    var split = currentSplit();
    var threshold = currentThreshold();
    return fetch(url('/artifacts/results/evaluation.json'), { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('artifact missing');
        return res.json();
      })
      .then(function (artifact) {
        var m = normalizeFromArtifact(artifact, split);
        if (!m) throw new Error('no split data');
        metricsCache = m;
        return m;
      })
      .catch(function () {
        return fetch(
          url(
            '/api/metrics?split=' +
              encodeURIComponent(split) +
              '&threshold=' +
              threshold +
              '&recompute=false'
          ),
          { cache: 'no-store' }
        ).then(function (res) {
          if (!res.ok) throw new Error('API metrics failed');
          return res.json();
        }).then(function (data) {
          var m = normalizeFromApi(data);
          if (!m) throw new Error('invalid metrics');
          metricsCache = m;
          return m;
        });
      });
  }

  function derivedFromCm(cm) {
    if (!cm || !cm.length) return null;
    var tn = cm[0][0], fp = cm[0][1], fn = cm[1][0], tp = cm[1][1];
    var n = tn + fp + fn + tp;
    if (n <= 0) return null;
    var sensitivity = tp + fn > 0 ? tp / (tp + fn) : 0;
    var specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
    return {
      n: n,
      sensitivity: sensitivity,
      specificity: specificity,
      error_rate: (fp + fn) / n,
      balanced_accuracy: (sensitivity + specificity) / 2,
    };
  }

  function buildMetricsHtml(m) {
    var cis = m.confidence_intervals;
    var rows = [
      ['Accuracy', 'accuracy', m.accuracy],
      ['F1 score', 'f1', m.f1],
      ['Precision', 'precision', m.precision],
      ['Recall', 'recall', m.recall],
    ];
    if (typeof m.roc_auc === 'number') rows.push(['ROC-AUC', 'roc_auc', m.roc_auc]);
    var html =
      '<p class="chart-note">Split: <strong>' +
      escapeHtml(currentSplit()) +
      '</strong> · Threshold: <strong>' +
      Math.round(currentThreshold() * 100) +
      '%</strong></p><table class="cm-table"><thead><tr><th>Metric</th><th>Value</th><th>95% CI</th></tr></thead><tbody>';
    rows.forEach(function (row) {
      var ci = '—';
      if (cis && cis[row[1]]) {
        ci = (cis[row[1]].low * 100).toFixed(1) + '–' + (cis[row[1]].high * 100).toFixed(1) + '%';
      }
      html +=
        '<tr><th>' +
        row[0] +
        '</th><td><strong>' +
        pct(row[2]) +
        '</strong></td><td>' +
        ci +
        '</td></tr>';
    });
    return html + '</tbody></table>';
  }

  function buildCmHtml(m) {
    var cm = m.confusion_matrix;
    if (!cm) return '<p class="chart-note">No confusion matrix.</p>';
    var d = derivedFromCm(cm);
    var html =
      '<table class="cm-table"><thead><tr><th></th><th>Pred Rotten</th><th>Pred Fresh</th></tr></thead><tbody>' +
      '<tr><th>True Rotten</th><td>' +
      cm[0][0] +
      '</td><td>' +
      cm[0][1] +
      ' (FP)</td></tr>' +
      '<tr><th>True Fresh</th><td>' +
      cm[1][0] +
      ' (FN)</td><td>' +
      cm[1][1] +
      '</td></tr></tbody></table>';
    if (d) {
      html +=
        '<p class="chart-note">n = ' +
        d.n +
        '</p><table class="cm-table"><tbody>' +
        '<tr><th>Sensitivity</th><td>' +
        pct(d.sensitivity) +
        '</td></tr>' +
        '<tr><th>Specificity</th><td>' +
        pct(d.specificity) +
        '</td></tr>' +
        '<tr><th>Balanced accuracy</th><td>' +
        pct(d.balanced_accuracy) +
        '</td></tr></tbody></table>';
    }
    return html;
  }

  function buildLabelHtml(m) {
    var ld = m.label_distribution || [0, 0];
    var neg = Array.isArray(ld) ? ld[0] : ld.negative || 0;
    var pos = Array.isArray(ld) ? ld[1] : ld.positive || 0;
    var total = neg + pos || 1;
    return (
      '<table class="cm-table"><thead><tr><th>Label</th><th>Count</th><th>Share</th></tr></thead><tbody>' +
      '<tr><th>Rotten (0)</th><td>' +
      neg.toLocaleString() +
      '</td><td>' +
      ((neg / total) * 100).toFixed(1) +
      '%</td></tr>' +
      '<tr><th>Fresh (1)</th><td>' +
      pos.toLocaleString() +
      '</td><td>' +
      ((pos / total) * 100).toFixed(1) +
      '%</td></tr></tbody></table>'
    );
  }

  function closeModal() {
    var el = document.getElementById('cine-eval-detail-modal');
    if (el) el.remove();
    document.body.classList.remove('cine-detail-open');
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  function showModal(title, bodyHtml) {
    closeModal();
    var overlay = document.createElement('div');
    overlay.id = 'cine-eval-detail-modal';
    overlay.className = 'cine-detail-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="cine-detail-modal__panel">' +
      '<div class="cine-detail-modal__head">' +
      '<h2>' +
      escapeHtml(title) +
      '</h2>' +
      '<button type="button" class="cine-detail-modal__close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="cine-detail-modal__body">' +
      bodyHtml +
      '</div></div>';
    document.body.appendChild(overlay);
    document.body.classList.add('cine-detail-open');
    overlay.querySelector('.cine-detail-modal__close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('.cine-detail-modal__panel').addEventListener('click', function (e) {
      e.stopPropagation();
    });
    document.addEventListener('keydown', onKeydown);
  }

  function scrollToSection(kind) {
    var map = {
      metrics: '.metrics-section',
      cm: '.confusion-section',
      label: '.charts-section',
    };
    var el = document.querySelector(map[kind] || '.metrics-section');
    if (!el) return;
    el.classList.add('eval-section-highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () {
      el.classList.remove('eval-section-highlight');
    }, 2200);
  }

  function open(kind) {
    metricsCache = null;
    fetchMetrics(true)
      .then(function (m) {
        if (kind === 'metrics') showModal('Metrics details', buildMetricsHtml(m));
        else if (kind === 'cm') showModal('Confusion matrix details', buildCmHtml(m));
        else showModal('Label distribution details', buildLabelHtml(m));
      })
      .catch(function (err) {
        console.error('[EvalDetails]', err);
        if (global.toast && global.toast.warning) {
          global.toast.warning('Details', 'Scrolling to chart — ' + err.message);
        }
        scrollToSection(kind);
      });
  }

  function bindButton(id, kind) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-eval-detail', kind);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      open(kind);
    });
  }

  function init() {
    bindButton('metrics-detail-btn', 'metrics');
    bindButton('cm-detail-btn', 'cm');
    bindButton('label-detail-btn', 'label');
  }

  global.CineEvalDetails = { open: open, refresh: function () { metricsCache = null; } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
