/**
 * Research insights: ROC + threshold + PR curves
 * Load order: insights_curves.json → evaluation.json → /api/insights-curves → live APIs
 */
(function () {
  const FETCH_MS = 90000;
  const ARTIFACT_INSIGHTS = '/artifacts/results/insights_curves.json';
  const ARTIFACT_EVAL = '/artifacts/results/evaluation.json';
  const ARTIFACT_CALIBRATION = '/artifacts/results/calibration.json';
  const STATIC_CALIBRATION = '/data/calibration.json';

  function resolveApiUrl(path) {
    if (typeof window.apiUrl === 'function') {
      return window.apiUrl(path);
    }
    const p = path.startsWith('/') ? path : '/' + path;
    return (window.location.origin || '') + p;
  }

  const splitEl = document.getElementById('insights-split');
  const refreshBtn = document.getElementById('insights-refresh');
  const exportPdfBtn = document.getElementById('insights-export-pdf');
  const badgeEl = document.getElementById('insights-source-badge');
  const aucEl = document.getElementById('roc-auc-label');
  const apEl = document.getElementById('pr-ap-label');
  const optimalEl = document.getElementById('optimal-threshold-label');
  const errorEl = document.getElementById('insights-error');
  const rocCanvas = document.getElementById('roc-chart');
  const thrCanvas = document.getElementById('threshold-chart');
  const prCanvas = document.getElementById('pr-chart');
  const calCanvas = document.getElementById('calibration-chart');
  const calStatsEl = document.getElementById('calibration-stats-label');

  let rocChart = null;
  let thrChart = null;
  let prChart = null;
  let calChart = null;

  function fetchJson(url, optional) {
    const ctrl = new AbortController();
    const t = setTimeout(function () {
      ctrl.abort();
    }, FETCH_MS);
    return fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      .then(function (res) {
        clearTimeout(t);
        if (!res.ok) {
          if (optional && (res.status === 404 || res.status === 503)) {
            return null;
          }
          return res.json().catch(function () {
            return { error: 'HTTP ' + res.status };
          }).then(function (b) {
            throw new Error(b.error || 'HTTP ' + res.status);
          });
        }
        return res.json();
      })
      .catch(function (err) {
        clearTimeout(t);
        if (optional) {
          return null;
        }
        if (err.name === 'AbortError') {
          throw new Error('Request timed out — scoring reviews can take up to 90s on CPU.');
        }
        throw err;
      });
  }

  function destroyCharts() {
    if (rocChart) {
      rocChart.destroy();
      rocChart = null;
    }
    if (thrChart) {
      thrChart.destroy();
      thrChart = null;
    }
    if (prChart) {
      prChart.destroy();
      prChart = null;
    }
    if (calChart) {
      calChart.destroy();
      calChart = null;
    }
  }

  function baseOpts() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: {
          display: true,
          labels: { color: '#9ca3af', usePointStyle: true, padding: 14 },
        },
      },
      scales: {
        x: {
          type: 'linear',
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(148,163,184,0.15)' },
        },
        y: {
          type: 'linear',
          ticks: { color: '#9ca3af' },
          grid: { color: 'rgba(148,163,184,0.15)' },
          min: 0,
          max: 1,
        },
      },
    };
  }

  function renderRoc(data) {
    if (!rocCanvas || typeof Chart === 'undefined') return;
    const fpr = data.fpr || [];
    const tpr = data.tpr || [];
    const auc = data.auc;
    if (aucEl) {
      aucEl.textContent =
        auc != null ? 'AUC: ' + (auc * 100).toFixed(1) + '%' : 'AUC: —';
    }
    if (!fpr.length || !tpr.length) {
      if (aucEl) aucEl.textContent = 'AUC: — (no curve data)';
      return;
    }

    const opts = baseOpts();
    opts.scales.x.title = { display: true, text: 'False positive rate', color: '#9ca3af' };
    opts.scales.y.title = { display: true, text: 'True positive rate', color: '#9ca3af' };

    if (rocChart) rocChart.destroy();
    rocChart = new Chart(rocCanvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'ROC',
            data: fpr.map(function (x, i) {
              return { x: x, y: tpr[i] };
            }),
            borderColor: '#c9a227',
            backgroundColor: 'rgba(201, 162, 39, 0.12)',
            fill: true,
            tension: 0.15,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Chance',
            data: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
            borderColor: 'rgba(148, 163, 184, 0.45)',
            borderDash: [6, 4],
            pointRadius: 0,
            borderWidth: 1,
          },
        ],
      },
      options: opts,
    });
  }

  function renderThreshold(points) {
    if (!thrCanvas || typeof Chart === 'undefined') return;
    const pts = points || [];
    if (!pts.length) {
      if (optimalEl) optimalEl.textContent = 'F1-optimal threshold: —';
      return;
    }

    if (optimalEl) {
      const best = pts.reduce(function (a, b) {
        return (b.f1 || 0) > (a.f1 || 0) ? b : a;
      }, pts[0]);
      if (best && typeof best.threshold === 'number') {
        optimalEl.textContent =
          'F1-optimal: ' +
          Math.round(best.threshold * 100) +
          '% · F1 ' +
          ((best.f1 || 0) * 100).toFixed(1) +
          '%';
      } else {
        optimalEl.textContent = 'F1-optimal threshold: —';
      }
    }

    const labels = pts.map(function (p) {
      return String(Math.round(p.threshold * 100)) + '%';
    });
    const opts = baseOpts();
    opts.scales.x = {
      type: 'category',
      ticks: { color: '#9ca3af', maxRotation: 45 },
      grid: { color: 'rgba(148,163,184,0.15)' },
      title: { display: true, text: 'Threshold', color: '#9ca3af' },
    };
    opts.scales.y.title = { display: true, text: 'Score', color: '#9ca3af' };

    if (thrChart) thrChart.destroy();
    thrChart = new Chart(thrCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'F1',
            data: pts.map(function (p) {
              return p.f1;
            }),
            borderColor: '#c9a227',
            tension: 0.2,
            pointRadius: 2,
            borderWidth: 2,
          },
          {
            label: 'Precision',
            data: pts.map(function (p) {
              return p.precision;
            }),
            borderColor: '#2d8a5e',
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Recall',
            data: pts.map(function (p) {
              return p.recall;
            }),
            borderColor: '#c0392b',
            tension: 0.2,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: opts,
    });
  }

  function renderPr(data) {
    if (!prCanvas || typeof Chart === 'undefined') return;
    const recall = data.recall || [];
    const precision = data.precision || [];
    const ap = data.average_precision;

    if (apEl) {
      apEl.textContent =
        ap != null ? 'AP: ' + (ap * 100).toFixed(1) + '%' : 'AP: —';
    }

    if (!recall.length || !precision.length) {
      if (apEl) apEl.textContent = 'AP: — (run make insights-curves for PR data)';
      return;
    }

    const opts = baseOpts();
    opts.scales.x.title = { display: true, text: 'Recall', color: '#9ca3af' };
    opts.scales.y.title = { display: true, text: 'Precision', color: '#9ca3af' };

    if (prChart) prChart.destroy();
    prChart = new Chart(prCanvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'PR curve',
            data: recall.map(function (x, i) {
              return { x: x, y: precision[i] };
            }),
            borderColor: '#2d8a5e',
            backgroundColor: 'rgba(45, 138, 94, 0.12)',
            fill: true,
            tension: 0.15,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: opts,
    });
  }

  function renderCalibration(data) {
    if (!calCanvas || typeof Chart === 'undefined') return;
    const meanPred = data.mean_predicted || [];
    const fracPos = data.fraction_positive || [];
    const brier = data.brier_score;
    const ece = data.ece;
    const hasBins = meanPred.length > 0 && fracPos.length > 0;
    const calSection = calCanvas.closest('.chart-card');

    if (calStatsEl) {
      if (hasBins) {
        const bStr = brier != null ? 'Brier: ' + brier.toFixed(4) : 'Brier: —';
        const eStr = ece != null ? 'ECE: ' + (ece * 100).toFixed(2) + '%' : 'ECE: —';
        calStatsEl.textContent = bStr + ' · ' + eStr;
      } else {
        calStatsEl.textContent = 'Loading calibration data…';
      }
    }

    if (calSection) {
      calSection.classList.toggle('chart-card--empty', !hasBins);
    }

    if (!hasBins) {
      if (calChart) {
        calChart.destroy();
        calChart = null;
      }
      return;
    }

    const opts = baseOpts();
    opts.scales.x.title = { display: true, text: 'Mean predicted probability', color: '#9ca3af' };
    opts.scales.y.title = { display: true, text: 'Fraction positive (observed)', color: '#9ca3af' };

    if (calChart) calChart.destroy();
    calChart = new Chart(calCanvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Model calibration',
            data: meanPred.map(function (x, i) {
              return { x: x, y: fracPos[i] };
            }),
            borderColor: '#c9a227',
            backgroundColor: 'rgba(201, 162, 39, 0.15)',
            fill: false,
            tension: 0.1,
            pointRadius: 4,
            borderWidth: 2,
          },
          {
            label: 'Perfect calibration',
            data: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
            borderColor: 'rgba(148,163,184,0.5)',
            borderDash: [6, 4],
            pointRadius: 0,
            borderWidth: 1,
          },
        ],
      },
      options: opts,
    });
  }

  function setBadge(text) {
    if (badgeEl) badgeEl.textContent = text;
  }

  function showError(msg) {
    setBadge('Unavailable');
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.textContent = msg;
    }
    if (window.toast && window.toast.error) window.toast.error(msg);
  }

  function calibrationMissing(cal) {
    const c = cal || {};
    return !c.mean_predicted || !c.mean_predicted.length;
  }

  function calibrationFromBlock(block, source, nSamples) {
    if (!block || !block.calibration_curve) return null;
    const cal = block.calibration_curve;
    if (!cal.mean_predicted || !cal.mean_predicted.length) return null;
    return {
      mean_predicted: cal.mean_predicted,
      fraction_positive: cal.fraction_positive || [],
      brier_score: cal.brier_score,
      ece: cal.ece,
      data_source: source,
      n_samples: nSamples != null ? nSamples : block.n_samples,
    };
  }

  function normalizeCalibration(raw, source) {
    if (!raw) return null;
    const mean = raw.mean_predicted || [];
    const frac = raw.fraction_positive || [];
    if (!mean.length || !frac.length) return null;
    return {
      mean_predicted: mean,
      fraction_positive: frac,
      brier_score: raw.brier_score != null ? raw.brier_score : null,
      ece: raw.ece != null ? raw.ece : null,
      data_source: source,
    };
  }

  function bundledCalibration(split) {
    var root = window.CINESENTIMENT_CALIBRATION;
    if (!root || !root.splits || !root.splits[split]) return null;
    return normalizeCalibration(root.splits[split], 'bundled');
  }

  function fetchCalibrationForSplit(split, existing) {
    if (!calibrationMissing(existing)) {
      return Promise.resolve(existing);
    }

    var bundled = bundledCalibration(split);
    if (bundled) {
      return Promise.resolve(bundled);
    }

    const bust = '_=' + Date.now();

    function withBust(path) {
      const sep = path.indexOf('?') >= 0 ? '&' : '?';
      return resolveApiUrl(path + sep + bust);
    }

    function tryUrl(url, pickBlock, source) {
      return fetchJson(url, true).then(function (data) {
        if (!data) return null;
        var block = pickBlock(data);
        return normalizeCalibration(block, source);
      });
    }

    return tryUrl(withBust(STATIC_CALIBRATION), function (d) {
      return d.splits && d.splits[split];
    }, 'static_calibration')
      .then(function (cal) {
        if (cal) return cal;
        return tryUrl(withBust(ARTIFACT_CALIBRATION), function (d) {
          return d.splits && d.splits[split];
        }, 'calibration_artifact');
      })
      .then(function (cal) {
        if (cal) return cal;
        return tryUrl(withBust(ARTIFACT_INSIGHTS), function (d) {
          var b = d.splits && d.splits[split];
          return b && b.calibration_curve;
        }, 'insights_artifact');
      })
      .then(function (cal) {
        if (cal) return cal;
        return tryUrl(withBust(ARTIFACT_EVAL), function (d) {
          var b = d.curves && d.curves[split];
          return b && b.calibration_curve;
        }, 'evaluation_artifact');
      })
      .then(function (cal) {
        if (cal) return cal;
        return tryUrl(
          withBust('/api/calibration-curve?split=' + encodeURIComponent(split) + '&max_rows=1500'),
          function (d) {
            return d;
          },
          'computed'
        );
      })
      .then(function (cal) {
        return cal || bundledCalibration(split) || existing || {};
      })
      .catch(function () {
        return bundledCalibration(split) || existing || {};
      });
  }

  function pairFromBlock(block, source, nSamples) {
    const roc = block.roc_curve || {};
    const pr = block.pr_curve || {};
    return {
      roc: {
        fpr: roc.fpr || [],
        tpr: roc.tpr || [],
        auc: roc.auc,
        data_source: source,
        n_samples: nSamples,
      },
      thr: {
        points: block.threshold_curve || [],
        data_source: source,
        n_samples: nSamples,
      },
      pr: {
        recall: pr.recall || [],
        precision: pr.precision || [],
        average_precision: pr.average_precision,
        data_source: source,
        n_samples: nSamples,
      },
      cal: {
        mean_predicted: (block.calibration_curve && block.calibration_curve.mean_predicted) || [],
        fraction_positive: (block.calibration_curve && block.calibration_curve.fraction_positive) || [],
        brier_score: block.calibration_curve && block.calibration_curve.brier_score,
        ece: block.calibration_curve && block.calibration_curve.ece,
        data_source: source,
        n_samples: nSamples,
      },
    };
  }

  function loadFromInsightsArtifact(split) {
    return fetchJson(resolveApiUrl(ARTIFACT_INSIGHTS), true).then(function (data) {
      if (!data) throw new Error('insights artifact missing');
      const block = data.splits && data.splits[split];
      if (!block || !block.roc_curve) {
        throw new Error('No curves in insights_curves.json');
      }
      return pairFromBlock(block, 'insights_artifact', block.n_samples);
    });
  }

  function loadFromEvaluationArtifact(split) {
    return fetchJson(resolveApiUrl(ARTIFACT_EVAL), true).then(function (art) {
      if (!art) throw new Error('evaluation artifact missing');
      const block = art.curves && art.curves[split];
      if (!block || !block.roc_curve) {
        throw new Error('No curves in evaluation.json');
      }
      const n =
        art.splits && art.splits[split] ? art.splits[split].n_samples : null;
      return pairFromBlock(block, 'evaluation_artifact', n);
    });
  }

  function loadFromInsightsApi(split, recompute) {
    const q =
      'split=' +
      encodeURIComponent(split) +
      (recompute ? '&recompute=true' : '') +
      '&max_rows=1500';
    return fetchJson(resolveApiUrl('/api/insights-curves?' + q), true).then(function (data) {
      if (!data || !data.roc_curve) {
        throw new Error('insights-curves API unavailable');
      }
      return pairFromBlock(data, data.data_source || 'computed', data.n_samples);
    });
  }

  function loadFromLiveApi(split, recompute) {
    const q =
      'split=' +
      encodeURIComponent(split) +
      (recompute ? '&recompute=true' : '') +
      '&max_rows=1500';
  return Promise.all([
      fetchJson(resolveApiUrl('/api/roc-curve?' + q)),
      fetchJson(resolveApiUrl('/api/threshold-curve?' + q)),
      fetchJson(resolveApiUrl('/api/pr-curve?' + q), true),
      fetchJson(resolveApiUrl('/api/calibration-curve?' + q), true),
    ]).then(function (parts) {
      return {
        roc: parts[0],
        thr: {
          points: (parts[1] && parts[1].points) || [],
          data_source: parts[1] && parts[1].data_source,
          n_samples: parts[1] && parts[1].n_samples,
        },
        pr: parts[2]
          ? {
              recall: parts[2].recall || [],
              precision: parts[2].precision || [],
              average_precision: parts[2].average_precision,
              data_source: parts[2].data_source,
              n_samples: parts[2].n_samples,
            }
          : { recall: [], precision: [], average_precision: null, data_source: 'unavailable' },
        cal: parts[3]
          ? {
              mean_predicted: parts[3].mean_predicted || [],
              fraction_positive: parts[3].fraction_positive || [],
              brier_score: parts[3].brier_score,
              ece: parts[3].ece,
              data_source: parts[3].data_source,
              n_samples: parts[3].n_samples,
            }
          : { mean_predicted: [], fraction_positive: [], brier_score: null, ece: null },
      };
    });
  }

  function applyPair(pair) {
    const roc = pair.roc || {};
    const thr = pair.thr || {};
    const pr = pair.pr || {};
    const source = roc.data_source || thr.data_source || pr.data_source || 'loaded';
    const n = roc.n_samples || thr.n_samples || pr.n_samples;
    const split = splitEl ? splitEl.value : 'val';
    const label =
      source === 'evaluation_artifact' || source === 'insights_artifact'
        ? 'Saved artifact'
        : source === 'computed'
          ? 'Live subsample'
          : 'Loaded';
    setBadge(label + (n ? ' · n=' + n : ''));
    if (errorEl) errorEl.style.display = 'none';
    renderRoc(roc);
    renderThreshold(thr.points || []);
    renderPr(pr);
    fetchCalibrationForSplit(split, pair.cal).then(function (cal) {
      renderCalibration(cal);
    });
  }

  let loadInFlight = false;

  function refreshFromArtifacts(split) {
    return loadFromInsightsArtifact(split).catch(function () {
      return loadFromEvaluationArtifact(split);
    });
  }

  function loadCurves(refresh) {
    if (window.location.protocol === 'file:') {
      showError('Open http://127.0.0.1:8000/insights.html after: make serve');
      return;
    }
    if (loadInFlight) return;
    loadInFlight = true;

    const split = splitEl ? splitEl.value : 'val';
    setBadge(refresh ? 'Refreshing…' : 'Loading…');
    if (errorEl) errorEl.style.display = 'none';
    if (refreshBtn) refreshBtn.disabled = true;

    function tryChain() {
      if (refresh) {
        return refreshFromArtifacts(split);
      }
      return loadFromInsightsArtifact(split)
        .catch(function () {
          return loadFromEvaluationArtifact(split);
        })
        .catch(function () {
          return loadFromInsightsApi(split, false);
        })
        .catch(function () {
          if (window.loading && window.loading.show) {
            window.loading.show('Scoring reviews', 'First load may take up to 90s on CPU…');
          }
          return loadFromLiveApi(split, false);
        });
    }

    tryChain()
      .then(applyPair)
      .catch(function (err) {
        console.error('[Insights]', err);
        showError(
          (err.message || String(err)) +
            ' — Run: make insights-curves && hard-refresh (Cmd+Shift+R).'
        );
      })
      .finally(function () {
        loadInFlight = false;
        if (refreshBtn) refreshBtn.disabled = false;
        if (window.loading && window.loading.hide) window.loading.hide();
      });
  }

  function exportInsightsPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      showError('PDF library not loaded');
      return;
    }
    const split = splitEl ? splitEl.value : 'val';
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFontSize(18);
    doc.text('CineSentiment — Research Insights', 40, 48);
    doc.setFontSize(11);
    doc.text('Split: ' + split, 40, 72);
    if (badgeEl) doc.text(badgeEl.textContent, 40, 88);
    if (aucEl) doc.text(aucEl.textContent, 40, 104);
    if (apEl) doc.text(apEl.textContent, 40, 120);
    if (optimalEl) doc.text(optimalEl.textContent, 40, 136);
    var y = 152;
    if (rocCanvas && rocCanvas.width) {
      try {
        doc.addImage(rocCanvas.toDataURL('image/png'), 'PNG', 40, y, 240, 140);
        y += 155;
      } catch (_) { /* canvas may be tainted by CORS; skip chart */ }
    }
    if (thrCanvas && thrCanvas.width) {
      try {
        doc.addImage(thrCanvas.toDataURL('image/png'), 'PNG', 40, y, 240, 140);
        y += 155;
      } catch (_) { /* canvas may be tainted by CORS; skip chart */ }
    }
    if (prCanvas && prCanvas.width) {
      try {
        doc.addImage(prCanvas.toDataURL('image/png'), 'PNG', 40, y, 240, 140);
      } catch (_) { /* canvas may be tainted by CORS; skip chart */ }
    }
    doc.save('cinesentiment-insights-' + split + '.pdf');
    if (window.toast && window.toast.success) window.toast.success('Insights PDF saved');
  }

  if (splitEl) splitEl.addEventListener('change', function () { loadCurves(false); });
  if (refreshBtn) refreshBtn.addEventListener('click', function () { loadCurves(true); });
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', exportInsightsPdf);

  window.addEventListener('beforeunload', destroyCharts);

  function boot() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        loadCurves(false);
      });
    } else {
      loadCurves(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
