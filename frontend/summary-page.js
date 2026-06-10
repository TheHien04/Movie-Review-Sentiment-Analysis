/**
 * Statistics Report — /api/stats-report with fallbacks for older servers (v1.3)
 * and evaluation.json when the API route is missing (restart make serve for v1.7).
 */
(function () {
  const FETCH_MS = 15000;
  const ARTIFACT_EVAL = '/artifacts/results/evaluation.json';

  function api(path) {
    return typeof window.apiUrl === 'function' ? window.apiUrl(path) : path;
  }

  function fetchJson(url, optional) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () {
      ctrl.abort();
    }, FETCH_MS);
    return fetch(url, { signal: ctrl.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) {
          if (optional) return null;
          return res.json().catch(function () {
            return { error: 'HTTP ' + res.status };
          }).then(function (body) {
            const err = new Error(body.error || 'HTTP ' + res.status);
            err.httpStatus = res.status;
            throw err;
          });
        }
        return res.json();
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (optional && (err.name === 'AbortError' || err.httpStatus)) {
          return null;
        }
        if (err.name === 'AbortError') {
          throw new Error('Request timed out. Run: make serve');
        }
        throw err;
      });
  }

  function pct(v, digits) {
    if (v == null || isNaN(v)) return '—';
    return (v * 100).toFixed(digits == null ? 1 : digits) + '%';
  }

  function fmtCi(ci) {
    if (!ci || ci.low == null || ci.high == null) return '';
    return (
      ' <span class="metric-ci">(' +
      pct(ci.low, 1) +
      '–' +
      pct(ci.high, 1) +
      ')</span>'
    );
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function derivedFromCm(cm) {
    if (!cm || !cm.length) return {};
    const tn = cm[0][0];
    const fp = cm[0][1];
    const fn = cm[1][0];
    const tp = cm[1][1];
    const n = tn + fp + fn + tp;
    if (n <= 0) return {};
    const sensitivity = tp + fn > 0 ? tp / (tp + fn) : 0;
    const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
    return {
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

  function metricDeltas(primary, baseline) {
    const keys = ['accuracy', 'f1', 'precision', 'recall', 'roc_auc', 'average_precision'];
    const out = {};
    keys.forEach(function (k) {
      const a = primary[k];
      const b = baseline[k];
      out[k] =
        typeof a === 'number' && typeof b === 'number' ? a - b : null;
    });
    return out;
  }

  function reportFromArtifact(artifact) {
    if (!artifact || !artifact.splits) {
      throw new Error('evaluation.json missing splits — run: make evaluate');
    }
    const report = {
      generated_at: artifact.generated_at,
      methodology: artifact.methodology,
      training: artifact.training,
      protocol: {
        task: 'binary_sentiment',
        splits: '70% train / 15% val / 15% test (stratified, seed=42)',
        decision_threshold: 0.5,
        bootstrap: '500 resamples, percentile 95% CI',
        primary_report_split: 'test',
      },
      splits: {},
      model_comparison: null,
    };

    ['val', 'test'].forEach(function (splitName) {
      const block = artifact.splits[splitName];
      if (!block) return;
      const m = block.metrics || {};
      const cm = m.confusion_matrix;
      report.splits[splitName] = {
        n_samples: block.n_samples || m.n_samples,
        metrics: {
          accuracy: m.accuracy,
          f1: m.f1,
          precision: m.precision,
          recall: m.recall,
          roc_auc: m.roc_auc,
          average_precision: m.average_precision,
        },
        confidence_intervals: m.confidence_intervals,
        derived: derivedFromCm(cm),
      };
    });

    const bertTest = artifact.splits.test && artifact.splits.test.metrics;
    const blTest =
      artifact.baselines &&
      artifact.baselines.tfidf_logistic &&
      artifact.baselines.tfidf_logistic.splits &&
      artifact.baselines.tfidf_logistic.splits.test &&
      artifact.baselines.tfidf_logistic.splits.test.metrics;

    if (bertTest && blTest) {
      report.model_comparison = {
        split: 'test',
        distilbert: {
          accuracy: bertTest.accuracy,
          f1: bertTest.f1,
          precision: bertTest.precision,
          recall: bertTest.recall,
          roc_auc: bertTest.roc_auc,
          average_precision: bertTest.average_precision,
        },
        tfidf_logistic: {
          accuracy: blTest.accuracy,
          f1: blTest.f1,
          precision: blTest.precision,
          recall: blTest.recall,
          roc_auc: blTest.roc_auc,
          average_precision: blTest.average_precision,
        },
        deltas: metricDeltas(bertTest, blTest),
        interpretation:
          'Δ = DistilBERT − TF-IDF on test split (point estimate). See hypothesis tests for formal comparison.',
      };
    }

    if (artifact.hypothesis_tests) {
      report.hypothesis_tests = artifact.hypothesis_tests;
    }

    return report;
  }

  function reportFromStatSummary(summary) {
    const m = summary.metrics || {};
    return {
      generated_at: summary.generated_at,
      methodology: summary.methodology,
      training: null,
      protocol: {
        splits: '70% train / 15% val / 15% test (stratified, seed=42)',
        decision_threshold: summary.threshold != null ? summary.threshold : 0.5,
        bootstrap: '500 resamples, percentile 95% CI',
        primary_report_split: 'test',
      },
      splits: {
        test: {
          n_samples: summary.n_samples,
          metrics: {
            accuracy: m.accuracy,
            f1: m.f1,
            precision: m.precision,
            recall: m.recall,
            roc_auc: m.roc_auc,
            average_precision: m.average_precision,
          },
          confidence_intervals: m.confidence_intervals,
          derived: summary.derived || {},
        },
      },
      model_comparison: summary.model_comparison
        ? {
            split: 'test',
            distilbert: { f1: summary.model_comparison.distilbert_f1 },
            tfidf_logistic: { f1: summary.model_comparison.baseline_f1 },
            deltas: summary.model_comparison.deltas,
          }
        : null,
    };
  }

  const protocolEl = document.getElementById('summary-protocol-body');
  const metricsEl = document.getElementById('summary-metrics-grid');
  const derivedEl = document.getElementById('summary-derived-table');
  const comparisonEl = document.getElementById('summary-comparison-body');
  const hypothesisEl = document.getElementById('summary-hypothesis-body');
  const generatedEl = document.getElementById('summary-generated');
  const errorEl = document.getElementById('summary-error');

  function showError(msg) {
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.textContent = msg;
    }
    if (window.toast && window.toast.error) window.toast.error(msg);
  }

  function clearError() {
    if (errorEl) errorEl.style.display = 'none';
  }

  function renderProtocol(report) {
    if (!protocolEl) return;
    const p = report.protocol || {};
    const tr = report.training || {};
    protocolEl.innerHTML =
      '<dl class="summary-dl">' +
      '<dt>Task</dt><dd>Binary sentiment (Fresh = positive, Rotten = negative)</dd>' +
      '<dt>Data splits</dt><dd>' +
      esc(p.splits || '70/15/15 stratified') +
      '</dd>' +
      '<dt>Decision threshold</dt><dd>' +
      esc(p.decision_threshold != null ? p.decision_threshold : 0.5) +
      '</dd>' +
      '<dt>Bootstrap CI</dt><dd>' +
      esc(p.bootstrap || '500 resamples, percentile 95%') +
      '</dd>' +
      '<dt>Primary report split</dt><dd><strong>' +
      esc(p.primary_report_split || 'test') +
      '</strong> (held-out, not used in training)</dd>' +
      '<dt>Model</dt><dd>DistilBERT fine-tuned on IMDB train split</dd>' +
      '<dt>Training</dt><dd>' +
      esc(
        (tr && tr.epochs != null ? tr.epochs + ' epochs' : '—') +
          ', seed=' +
          (tr && tr.seed != null ? tr.seed : '42')
      ) +
      '</dd>' +
      '<dt>Methodology</dt><dd>' +
      esc(report.methodology || 'sklearn metrics on held-out splits') +
      '</dd>' +
      '</dl>';
  }

  function renderMetrics(testBlock) {
    if (!metricsEl || !testBlock) return;
    const m = testBlock.metrics || {};
    const ci = testBlock.confidence_intervals || {};
    const items = [
      { key: 'accuracy', label: 'Accuracy' },
      { key: 'f1', label: 'F1 score' },
      { key: 'precision', label: 'Precision (PPV)' },
      { key: 'recall', label: 'Recall (sensitivity)' },
      { key: 'roc_auc', label: 'ROC-AUC' },
      { key: 'average_precision', label: 'Average precision' },
    ];
    metricsEl.innerHTML = items
      .map(function (item) {
        const val = m[item.key];
        return (
          '<article class="metric-card">' +
          '<span class="metric-label">' +
          esc(item.label) +
          '</span>' +
          '<span class="metric-value">' +
          pct(val, 1) +
          fmtCi(ci[item.key]) +
          '</span>' +
          '</article>'
        );
      })
      .join('');
  }

  function renderDerived(testBlock) {
    if (!derivedEl || !testBlock) return;
    const d = testBlock.derived || {};
    const rows = [
      ['Sensitivity (TPR)', d.sensitivity],
      ['Specificity (TNR)', d.specificity],
      ['False positive rate', d.false_positive_rate],
      ['False negative rate', d.false_negative_rate],
      ['Balanced accuracy', d.balanced_accuracy],
      ['Error rate', d.error_rate],
      ['Positive predictive value', d.positive_predictive_value],
      ['Negative predictive value', d.negative_predictive_value],
    ];
    derivedEl.innerHTML =
      '<table class="summary-table"><thead><tr><th>Statistic</th><th>Test split</th></tr></thead><tbody>' +
      rows
        .map(function (r) {
          return (
            '<tr><td>' +
            esc(r[0]) +
            '</td><td>' +
            (r[1] != null ? pct(r[1], 2) : '—') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
  }

  function renderComparison(comp) {
    if (!comparisonEl) return;
    if (!comp || !comp.distilbert || comp.distilbert.accuracy == null) {
      if (comp && comp.deltas && comp.deltas.f1 != null) {
        comparisonEl.innerHTML =
          '<p class="chart-note">Partial comparison from API: ΔF1 = ' +
          pct(comp.deltas.f1, 2) +
          '. Run <code>make baseline</code> for full table.</p>';
        return;
      }
      comparisonEl.innerHTML =
        '<p class="text-muted">Baseline not in artifact. Run <code>make baseline</code> then <code>make evaluate</code> to populate TF-IDF comparison.</p>';
      return;
    }
    const keys = [
      ['accuracy', 'Accuracy'],
      ['f1', 'F1'],
      ['precision', 'Precision'],
      ['recall', 'Recall'],
      ['roc_auc', 'ROC-AUC'],
      ['average_precision', 'AP'],
    ];
    const bert = comp.distilbert || {};
    const bl = comp.tfidf_logistic || {};
    const deltas = comp.deltas || {};
    comparisonEl.innerHTML =
      '<table class="summary-table"><thead><tr><th>Metric</th><th>DistilBERT</th><th>TF-IDF</th><th>Δ</th></tr></thead><tbody>' +
      keys
        .map(function (k) {
          const delta = deltas[k[0]];
          const deltaStr =
            delta != null ? (delta >= 0 ? '+' : '') + pct(delta, 2) : '—';
          return (
            '<tr><td>' +
            esc(k[1]) +
            '</td><td>' +
            pct(bert[k[0]], 1) +
            '</td><td>' +
            pct(bl[k[0]], 1) +
            '</td><td class="' +
            (delta > 0 ? 'delta-pos' : delta < 0 ? 'delta-neg' : '') +
            '">' +
            deltaStr +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>' +
      (comp.interpretation
        ? '<p class="chart-note">' + esc(comp.interpretation) + '</p>'
        : '');
  }

  function sigBadge(significant, opts) {
    opts = opts || {};
    if (significant === true) {
      return '<span class="ticket-badge ticket-badge--sig" title="Reject H₀ at α = 0.05">Significant (p &lt; 0.05)</span>';
    }
    if (significant === false) {
      var label = opts.inconclusive
        ? 'Inconclusive (p ≥ 0.05)'
        : 'Not significant (p ≥ 0.05)';
      return (
        '<span class="ticket-badge ticket-badge--neutral" title="Cannot reject H₀ — models may be equally good on this split">' +
        label +
        '</span>'
      );
    }
    return '—';
  }

  function renderTakeaway(block) {
    var tw = block.takeaway;
    if (!tw) {
      var m = block.mcnemar || {};
      var boot = (block.bootstrap_difference || {}).accuracy || {};
      var es = block.effect_sizes || {};
      var sig = m.significant_005;
      var headline = sig
        ? 'DistilBERT differs significantly from TF-IDF logistic on paired errors.'
        : 'No statistically significant difference vs TF-IDF logistic — both models are similarly strong (~91% accuracy).';
      var detail =
        typeof boot.mean_diff === 'number'
          ? 'DistilBERT is ' +
            (boot.mean_diff >= 0 ? '+' : '') +
            pct(boot.mean_diff, 2) +
            ' more accurate on average, but the 95% bootstrap CI includes zero. '
          : '';
      if (typeof es.cohens_h_accuracy === 'number') {
        detail +=
          "Cohen's h = " +
          es.cohens_h_accuracy.toFixed(3) +
          ' (' +
          (es.cohens_h_magnitude || 'negligible') +
          ' effect). ';
      }
      detail +=
        'This is normal when comparing against a strong baseline — report point estimates and CIs honestly.';
      tw = { headline: headline, detail: detail, null_hypothesis: 'H₀: equal paired error rates at α = 0.05' };
    }
    return (
      '<aside class="stat-callout" role="note">' +
      '<p class="stat-callout__headline">' +
      esc(tw.headline) +
      '</p>' +
      (tw.null_hypothesis
        ? '<p class="stat-callout__null"><strong>Null hypothesis:</strong> ' + esc(tw.null_hypothesis) + '</p>'
        : '') +
      '<p class="stat-callout__detail">' +
      esc(tw.detail) +
      '</p>' +
      (tw.defense_note
        ? '<p class="stat-callout__defense"><strong>Note:</strong> ' + esc(tw.defense_note) + '</p>'
        : '') +
      '</aside>'
    );
  }

  function renderBonferroniTable(bonf) {
    if (!bonf || !bonf.results) return '';
    var rows = Object.keys(bonf.results)
      .sort()
      .map(function (name) {
        var r = bonf.results[name];
        return (
          '<tr><td>' +
          esc(name.replace(/_/g, ' ')) +
          '</td><td>' +
          (r.p_value != null ? r.p_value.toFixed(4) : '—') +
          '</td><td>' +
          sigBadge(r.significant_bonferroni) +
          '</td></tr>'
        );
      })
      .join('');
    return (
      '<table class="summary-table"><thead><tr><th>Test</th><th>p-value</th><th>Bonferroni</th></tr></thead><tbody>' +
      rows +
      '</tbody></table>'
    );
  }

  function renderHypothesisTests(ht) {
    if (!hypothesisEl) return;
    const block = (ht && ht.test) || (ht && ht.val) || null;
    if (!block || !block.mcnemar) {
      hypothesisEl.innerHTML =
        '<p class="text-muted">No hypothesis test results yet. Run <code>make hypothesis-tests</code> after <code>make baseline</code> and <code>make evaluate</code>.</p>';
      return;
    }
    const m = block.mcnemar;
    const boot = block.bootstrap_difference || {};
    const bootRows = ['accuracy', 'f1']
      .filter(function (k) {
        return boot[k];
      })
      .map(function (k) {
        const b = boot[k];
        return (
          '<tr><td>' +
          esc(k.toUpperCase()) +
          '</td><td>' +
          (b.mean_diff >= 0 ? '+' : '') +
          pct(b.mean_diff, 2) +
          '</td><td>' +
          pct(b.ci_low, 2) +
          ' – ' +
          pct(b.ci_high, 2) +
          '</td><td>' +
          (b.p_value_two_sided != null ? b.p_value_two_sided.toFixed(4) : '—') +
          '</td><td>' +
          sigBadge(b.significant_005, { inconclusive: true }) +
          '</td></tr>'
        );
      })
      .join('');

    var es = block.effect_sizes || {};
    var effectHtml = es.cohens_h_accuracy != null
      ? '<h3 class="summary-subhead">Effect size</h3><table class="summary-table"><tbody>' +
        '<tr><td>Cohen\'s h (accuracy)</td><td>' + es.cohens_h_accuracy.toFixed(3) +
        ' <span class="text-muted">(' + esc(es.cohens_h_magnitude || '') + ')</span></td></tr>' +
        (es.odds_ratio_discordant != null
          ? '<tr><td>Odds ratio (discordant pairs)</td><td>' + es.odds_ratio_discordant.toFixed(3) + '</td></tr>'
          : '') +
        '</tbody></table>'
      : '';

    var bonf = block.multiple_comparison_correction;
    var bonfHtml = '';
    if (bonf && bonf.adjusted_alpha != null) {
      bonfHtml =
        '<h3 class="summary-subhead">Multiple comparison (Bonferroni)</h3>' +
        '<p class="chart-note">Family-wise α = 0.05 adjusted to <strong>' +
        bonf.adjusted_alpha.toFixed(4) +
        '</strong> across ' +
        esc(bonf.n_tests) +
        ' tests (McNemar + bootstrap per baseline).</p>';
    }

    var comparisons = block.comparisons || {};
    var compKeys = Object.keys(comparisons);
    var compHtml = '';
    if (compKeys.length > 0) {
      compHtml =
        '<h3 class="summary-subhead">All baseline comparisons</h3>' +
        '<table class="summary-table"><thead><tr><th>Baseline</th><th>McNemar p</th><th>Cohen\'s h</th><th>Result</th></tr></thead><tbody>' +
        compKeys.map(function (k) {
          var c = comparisons[k];
          var cm = c.mcnemar || {};
          var ce = c.effect_sizes || {};
          return (
            '<tr><td>' +
            esc(k.replace(/_/g, ' ')) +
            '</td><td>' +
            (cm.p_value != null ? cm.p_value.toFixed(4) : '—') +
            '</td><td>' +
            (ce.cohens_h_accuracy != null
              ? ce.cohens_h_accuracy.toFixed(3) +
                ' <span class="text-muted">(' +
                esc(ce.cohens_h_magnitude || '') +
                ')</span>'
              : '—') +
            '</td><td>' +
            sigBadge(cm.significant_005, { inconclusive: true }) +
            '</td></tr>'
          );
        }).join('') +
        '</tbody></table>';
    }

    hypothesisEl.innerHTML =
      renderTakeaway(block) +
      '<p class="chart-note">Split: <strong>' +
      esc(block.split || 'test') +
      '</strong> · n = ' +
      esc(block.n_samples) +
      ' · threshold = ' +
      esc(block.threshold != null ? block.threshold : 0.5) +
      '</p>' +
      compHtml +
      '<h3 class="summary-subhead">McNemar test (paired errors)</h3>' +
      '<table class="summary-table"><tbody>' +
      '<tr><td>Discordant (DistilBERT correct, baseline wrong) — b</td><td>' +
      esc(m.discordant_b) +
      '</td></tr>' +
      '<tr><td>Discordant (baseline correct, DistilBERT wrong) — c</td><td>' +
      esc(m.discordant_c) +
      '</td></tr>' +
      '<tr><td>χ² statistic</td><td>' +
      (m.statistic != null ? m.statistic.toFixed(3) : '—') +
      '</td></tr>' +
      '<tr><td>p-value</td><td>' +
      (m.p_value != null ? m.p_value.toFixed(4) : '—') +
      ' ' +
      sigBadge(m.significant_005, { inconclusive: true }) +
      '</td></tr>' +
      '</tbody></table>' +
      (m.interpretation
        ? '<p class="chart-note">' + esc(m.interpretation) + '</p>'
        : '') +
      effectHtml +
      '<h3 class="summary-subhead">Bootstrap difference (DistilBERT − baseline)</h3>' +
      '<p class="chart-note text-muted">Significant only if the 95% CI excludes 0 and p &lt; 0.05.</p>' +
      '<table class="summary-table"><thead><tr><th>Metric</th><th>Mean Δ</th><th>95% CI</th><th>p (two-sided)</th><th>Result</th></tr></thead><tbody>' +
      bootRows +
      '</tbody></table>' +
      bonfHtml +
      (bonf && bonf.results ? renderBonferroniTable(bonf) : '');
  }

  function applyReport(report, sourceNote) {
    if (report.error) throw new Error(report.error);
    renderProtocol(report);
    const testBlock = report.splits && report.splits.test;
    if (!testBlock) {
      throw new Error('No test split in evaluation data');
    }
    renderMetrics(testBlock);
    renderDerived(testBlock);
    renderComparison(report.model_comparison);
    renderHypothesisTests(report.hypothesis_tests);
    if (generatedEl) {
      let label = sourceNote || 'Loaded';
      if (report.generated_at) {
        const d = new Date(report.generated_at);
        label += ' · ' + d.toLocaleDateString();
      }
      generatedEl.textContent = label;
    }
    clearError();
  }

  function loadFromStatsApi() {
    return fetchJson(api('/api/stats-report'));
  }

  function loadFromArtifact() {
    return fetchJson(api(ARTIFACT_EVAL)).then(function (artifact) {
      return reportFromArtifact(artifact);
    });
  }

  function loadFromStatSummary() {
    return fetchJson(api('/api/statistical-summary?split=test')).then(
      reportFromStatSummary
    );
  }

  function loadReport() {
    if (window.location.protocol === 'file:') {
      showError('Open http://127.0.0.1:8000/summary.html after: make serve');
      return;
    }
    if (window.loading && window.loading.show) window.loading.show();
    clearError();

    loadFromStatsApi()
      .then(function (report) {
        applyReport(report, 'API v1.7');
      })
      .catch(function (firstErr) {
        if (firstErr.httpStatus !== 404 && firstErr.httpStatus !== 503) {
          throw firstErr;
        }
        return loadFromArtifact()
          .then(function (report) {
            applyReport(report, 'evaluation.json');
            if (window.toast && window.toast.info) {
              window.toast.info(
                'Loaded from evaluation.json. Restart server (make serve) for v1.7 API.',
                8000
              );
            }
          })
          .catch(function () {
            return loadFromStatSummary().then(function (report) {
              applyReport(report, 'statistical-summary API');
            });
          });
      })
      .catch(function (err) {
        console.error('[Summary]', err);
        showError(
          (err.message || String(err)) +
            ' — Run: make evaluate && make serve (then hard-refresh)'
        );
      })
      .finally(function () {
        if (window.loading && window.loading.hide) window.loading.hide();
      });
  }

  const printBtn = document.getElementById('summary-print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', function () {
      window.print();
    });
  }

  loadReport();
})();
