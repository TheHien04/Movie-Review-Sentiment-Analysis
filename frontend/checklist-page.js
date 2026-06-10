/**
 * Defense / capstone readiness — /api/capstone-status with artifact fallbacks.
 */
(function () {
  const FETCH_MS = 15000;
  const ARTIFACT_EVAL = '/artifacts/results/evaluation.json';
  const ARTIFACT_INSIGHTS = '/artifacts/results/insights_curves.json';
  const RING_CIRC = 326.7;

  const mainEl = document.querySelector('.checklist-page');
  const ringEl = document.getElementById('checklist-ring');
  const ringProgress = document.getElementById('checklist-ring-progress');
  const scoreEl = document.getElementById('checklist-score');
  const badgeEl = document.getElementById('checklist-badge');
  const summaryEl = document.getElementById('checklist-summary');
  const metricsEl = document.getElementById('checklist-metrics');
  const pipelineEl = document.getElementById('checklist-pipeline');
  const listRequiredEl = document.getElementById('checklist-items-required');
  const listOptionalEl = document.getElementById('checklist-items-optional');
  const errorEl = document.getElementById('checklist-error');
  const refreshBtn = document.getElementById('checklist-refresh-btn');

  function api(path) {
    return typeof window.apiUrl === 'function' ? window.apiUrl(path) : path;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function parseJsonText(text) {
    try {
      return JSON.parse(text);
    } catch (e1) {
      const fixed = text
        .replace(/\b-Infinity\b/g, 'null')
        .replace(/\bInfinity\b/g, 'null')
        .replace(/\bNaN\b/g, 'null');
      return JSON.parse(fixed);
    }
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
          const err = new Error('HTTP ' + res.status);
          err.httpStatus = res.status;
          throw err;
        }
        return res.text().then(parseJsonText);
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (optional) return null;
        throw err;
      });
  }

  function setLoading(on) {
    if (mainEl) mainEl.classList.toggle('is-loading', on);
  }

  function showError(msg) {
    if (badgeEl) {
      badgeEl.textContent = 'Error';
      badgeEl.className = 'checklist-badge checklist-badge--error';
    }
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.textContent = msg;
    }
  }

  function clearError() {
    if (errorEl) errorEl.style.display = 'none';
  }

  function setRingProgress(passed, total) {
    if (!ringProgress || total <= 0) return;
    const pct = passed / total;
    ringProgress.style.strokeDashoffset = String(RING_CIRC * (1 - pct));
  }

  function item(id, label, ok, hint, required) {
    return {
      id: id,
      label: label,
      ok: !!ok,
      hint: hint || '',
      required: required !== false,
    };
  }

  function finalizeStatus(items, extra) {
    const required = items.filter(function (i) {
      return i.required !== false;
    });
    const passed = required.filter(function (i) {
      return i.ok;
    }).length;
    const total = required.length;
    const status = {
      ready: passed === total,
      passed: passed,
      total: total,
      score_label: passed + '/' + total,
      items: items,
      pipeline: 'make capstone',
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        status[k] = extra[k];
      });
    }
    return status;
  }

  function buildFromArtifact(artifact, health, insights, hasCalibrationJs) {
    const test = (artifact && artifact.splits && artifact.splits.test) || {};
    const testMetrics = test.metrics || {};
    const baselines = (artifact && artifact.baselines) || {};
    const hypothesis = (artifact && artifact.hypothesis_tests && artifact.hypothesis_tests.test) || {};
    let insightsOk = false;
    if (insights && insights.splits && insights.splits.test) {
      insightsOk = !!insights.splits.test.calibration_curve;
    }

    const items = [
      item('model_weights', 'Fine-tuned model weights', health && health.model_is_finetuned, 'make train'),
      item('evaluation_json', 'Evaluation artifact', !!artifact, 'make evaluate'),
      item('test_metrics', 'Test split metrics', testMetrics.accuracy != null, 'make evaluate'),
      item(
        'bootstrap_ci',
        'Bootstrap 95% CI',
        !!(testMetrics.confidence_intervals && testMetrics.confidence_intervals.f1),
        'make evaluate'
      ),
      item('tfidf_baseline', 'TF-IDF baseline', !!baselines.tfidf_logistic, 'make baseline'),
      item(
        'hypothesis_tests',
        'Hypothesis tests (McNemar + bootstrap)',
        !!(hypothesis && hypothesis.mcnemar),
        'make hypothesis-tests'
      ),
      item('error_csv', 'Error analysis (FP/FN)', !!(artifact && artifact.error_analysis), 'make error-analysis'),
      item('insights_curves', 'ROC / PR / calibration curves', insightsOk, 'make insights-curves'),
      item('calibration_bundle', 'Calibration UI bundle', hasCalibrationJs, 'make insights-curves'),
      item('eda_notebook', 'EDA notebook', true, '', false),
      item('methodology_doc', 'Methodology doc', true, '', false),
      item('demo_script', 'Demo script', true, '', false),
    ];

    const extra = { _source: 'artifact_fallback' };
    if (testMetrics.accuracy != null && testMetrics.f1 != null) {
      extra.test_summary =
        'Test accuracy ' +
        (testMetrics.accuracy * 100).toFixed(2) +
        '% · F1 ' +
        (testMetrics.f1 * 100).toFixed(2) + '%';
    }
    if (hypothesis.mcnemar && hypothesis.mcnemar.interpretation) {
      extra.hypothesis_summary = hypothesis.mcnemar.interpretation;
    }
    return finalizeStatus(items, extra);
  }

  function render(data) {
    clearError();
    setLoading(false);

    const ready = data.ready;
    const passed = data.passed != null ? data.passed : 0;
    const total = data.total != null ? data.total : 0;

    if (ringEl) ringEl.setAttribute('data-ready', ready ? 'true' : 'false');
    setRingProgress(passed, total);

    if (scoreEl) scoreEl.textContent = data.score_label || passed + '/' + total;
    if (badgeEl) {
      badgeEl.className = 'checklist-badge ' + (ready ? 'checklist-badge--ready' : 'checklist-badge--pending');
      badgeEl.textContent = ready ? 'Ready for defense' : 'Action required';
    }
    if (summaryEl) {
      summaryEl.textContent = ready
        ? 'All required artifacts are in place. Review the playbook below before presenting.'
        : 'Complete the items marked below, then refresh. Run the full pipeline if unsure.';
      if (data._source === 'artifact_fallback') {
        summaryEl.textContent +=
          ' (Loaded from files — restart with make serve for live API v2.0.)';
      }
    }
    if (metricsEl) {
      metricsEl.textContent = data.test_summary || '';
      if (data.hypothesis_summary) {
        metricsEl.textContent += (metricsEl.textContent ? ' · ' : '') + data.hypothesis_summary;
      }
    }
    if (pipelineEl) {
      pipelineEl.innerHTML =
        'Pipeline: <code>' + esc(data.pipeline || 'make capstone') + '</code>';
    }

    if (data.items) {
      const required = data.items.filter(function (it) {
        return it.required !== false;
      });
      const optional = data.items.filter(function (it) {
        return it.required === false;
      });

      if (listRequiredEl) {
        listRequiredEl.innerHTML = required
          .map(function (it) {
            return renderRow(it);
          })
          .join('');
      }
      if (listOptionalEl) {
        listOptionalEl.innerHTML = optional
          .map(function (it) {
            const cls =
              'checklist-opt-chip ' +
              (it.ok ? 'checklist-opt-chip--ok' : 'checklist-opt-chip--pending');
            return (
              '<span class="' +
              cls +
              '" role="listitem">' +
              (it.ok ? '✓' : '○') +
              ' ' +
              esc(it.label) +
              '</span>'
            );
          })
          .join('');
      }
    }
  }

  function renderRow(it) {
    const ok = it.ok;
    const cls = 'checklist-row ' + (ok ? 'checklist-row--ok' : 'checklist-row--pending');
    const cmd =
      !ok && it.hint
        ? '<p class="checklist-row__cmd">Run: <code>' + esc(it.hint) + '</code></p>'
        : '';
    return (
      '<div class="' +
      cls +
      '" role="listitem">' +
      '<span class="checklist-row__mark" aria-hidden="true">' +
      (ok ? '✓' : '!') +
      '</span>' +
      '<span class="checklist-row__label">' +
      esc(it.label) +
      '</span>' +
      '<span class="checklist-row__status">' +
      (ok ? 'Ready' : 'Missing') +
      '</span>' +
      cmd +
      '</div>'
    );
  }

  function loadFromApi() {
    return fetchJson(api('/api/capstone-status'));
  }

  function loadFromArtifact() {
    const calCheck = fetch(api('/data/calibration-data.js'), { method: 'HEAD' })
      .then(function (r) {
        return r.ok;
      })
      .catch(function () {
        return false;
      });

    return Promise.all([
      fetchJson(api(ARTIFACT_EVAL)),
      fetchJson(api('/health'), true),
      fetchJson(api(ARTIFACT_INSIGHTS), true),
      calCheck,
    ]).then(function (results) {
      const artifact = results[0];
      if (!artifact || !artifact.splits) {
        throw new Error('evaluation.json missing — run: make evaluate');
      }
      return buildFromArtifact(artifact, results[1], results[2], results[3]);
    });
  }

  function load() {
    if (window.location.protocol === 'file:') {
      showError('Open http://127.0.0.1:8000/checklist.html after: make serve');
      return;
    }

    setLoading(true);
    if (badgeEl) {
      badgeEl.className = 'checklist-badge checklist-badge--loading';
      badgeEl.textContent = 'Checking…';
    }

    loadFromApi()
      .then(function (data) {
        render(data);
        if (window.toast && window.toast.success && data.ready) {
          window.toast.success('Capstone ready — ' + data.score_label, 4000);
        }
      })
      .catch(function (firstErr) {
        if (firstErr.httpStatus === 404) {
          return loadFromArtifact()
            .then(function (data) {
              render(data);
              if (window.toast && window.toast.info) {
                window.toast.info('Restart server: make serve (v2.0)', 8000);
              }
            })
            .catch(function (err2) {
              setLoading(false);
              showError(
                (err2.message || String(err2)) + ' — Run: make capstone && make serve'
              );
            });
        }
        setLoading(false);
        showError((firstErr.message || String(firstErr)) + ' — Run: make serve');
      });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', load);
  }

  load();
})();
