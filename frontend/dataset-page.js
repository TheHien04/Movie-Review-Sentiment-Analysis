/**
 * Dataset explorer page — stats, label chart, sample table, export
 */
(function () {
  const FETCH_MS = 20000;
  const API_DATASET = '/api/dataset-info';
  const ARTIFACT_DATASET = '/artifacts/results/dataset_info.json';

  let cachedPayload = null;
  let labelChart = null;

  function resolveApiUrl(path) {
    if (typeof window.apiUrl === 'function') {
      return window.apiUrl(path);
    }
    const p = path.startsWith('/') ? path : '/' + path;
    if (window.location.protocol === 'file:') {
      return p;
    }
    return (window.location.origin || '') + p;
  }

  function fetchJson(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () {
      ctrl.abort();
    }, FETCH_MS);
    return fetch(url, { signal: ctrl.signal })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) {
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
        if (err.name === 'AbortError') {
          throw new Error('Request timed out. Start the server: make serve');
        }
        throw err;
      });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function labelCounts(data) {
    if (data.label_counts) {
      return {
        neg: data.label_counts.negative || 0,
        pos: data.label_counts.positive || 0,
      };
    }
    const stats = data.stats || {};
    return {
      neg:
        stats['Rotten (train only)'] ??
        stats.Negative ??
        stats.negative ??
        0,
      pos:
        stats['Fresh (train only)'] ??
        stats.Positive ??
        stats.positive ??
        0,
    };
  }

  const STAT_ORDER = [
    'Total samples (all splits)',
    'Training split',
    'Validation split',
    'Test split',
    'Fresh (train only)',
    'Rotten (train only)',
    'Avg. review length (chars, train)',
  ];

  const STAT_LABELS = {
    'Total samples (all splits)': 'Total samples',
    'Training split': 'Training',
    'Validation split': 'Validation',
    'Test split': 'Test',
    'Fresh (train only)': 'Fresh (train)',
    'Rotten (train only)': 'Rotten (train)',
    'Avg. review length (chars, train)': 'Avg. length (chars)',
  };

  function renderStats(stats) {
    const el = document.getElementById('dataset-stats');
    if (!el) return;
    if (!stats || typeof stats !== 'object') {
      el.innerHTML = '<p class="text-muted-app">No statistics in response.</p>';
      return;
    }

    let html = '<div class="metrics-cards dataset-stats-cards">';
    STAT_ORDER.forEach(function (key) {
      if (stats[key] === undefined || stats[key] === null) return;
      const value = stats[key];
      const formatted =
        typeof value === 'number' ? value.toLocaleString() : escapeHtml(value);
      const label = STAT_LABELS[key] || key;
      html +=
        '<div class="metric-card">' +
        '<div>' +
        escapeHtml(label) +
        '</div>' +
        '<div><strong>' +
        formatted +
        '</strong></div>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  function buildPieData(neg, pos) {
    if (window.CinemaChart && window.CinemaChart.labelDataset) {
      return window.CinemaChart.labelDataset([neg, pos]);
    }
    return {
      labels: ['Rotten (negative)', 'Fresh (positive)'],
      datasets: [
        {
          data: [neg, pos],
          backgroundColor: ['#c0392b', '#2d8a5e'],
          borderColor: 'rgba(245, 240, 230, 0.9)',
          borderWidth: 2,
        },
      ],
    };
  }

  function renderLabelChart(neg, pos) {
    const canvas = document.getElementById('label-chart');
    const hint = document.getElementById('label-chart-hint');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
      if (hint) {
        hint.textContent = 'Chart.js failed to load. Check your network and refresh.';
      }
      return;
    }

    if (!neg && !pos) {
      if (hint) hint.textContent = 'No label counts in API response.';
      return;
    }

    try {
      if (labelChart) {
        labelChart.destroy();
        labelChart = null;
      }

      const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#b8b4a8',
              font: { size: 13, weight: '600' },
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const total = neg + pos || 1;
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return (
                  ctx.label +
                  ': ' +
                  Number(ctx.raw).toLocaleString() +
                  ' (' +
                  pct +
                  '%)'
                );
              },
            },
          },
        },
      };

      const CC = window.CinemaChart;
      if (CC && CC.baseOptions) {
        const themed = CC.baseOptions('pie', { maintainAspectRatio: false });
        if (themed && themed.plugins) {
          pieOptions.plugins = Object.assign({}, pieOptions.plugins, themed.plugins);
        }
        if (themed.layout) pieOptions.layout = themed.layout;
      }

      labelChart = new Chart(canvas, {
        type: 'doughnut',
        data: buildPieData(neg, pos),
        options: pieOptions,
      });

      if (hint) {
        hint.textContent =
          'Rotten: ' +
          neg.toLocaleString() +
          ' · Fresh: ' +
          pos.toLocaleString() +
          ' (training split)';
      }
    } catch (chartErr) {
      console.error('[Dataset] chart:', chartErr);
      if (hint) {
        hint.textContent =
          'Chart error: ' + chartErr.message + ' — counts: Rotten ' + neg + ', Fresh ' + pos;
      }
    }
  }

  function renderSampleRows(samples) {
    const tbody = document.querySelector('#sample-table tbody');
    const countEl = document.getElementById('sample-count');
    if (!tbody) return;

    const rows = (samples || []).map(function (row) {
      const fresh = row.label === 1;
      const labelClass = fresh ? 'label-fresh' : 'label-rotten';
      const labelText = fresh ? 'Fresh' : 'Rotten';
      const text = String(row.text || '');
      const preview =
        text.length > 200 ? text.substring(0, 200) + '…' : text;
      return (
        '<tr><td>' +
        escapeHtml(preview) +
        '</td><td class="' +
        labelClass +
        '">' +
        labelText +
        '</td></tr>'
      );
    });

    tbody.innerHTML =
      rows.length > 0
        ? rows.join('')
        : '<tr><td colspan="2" class="text-muted-app">No sample rows. Start server: make serve</td></tr>';
    if (countEl) {
      countEl.textContent = rows.length + ' preview rows';
    }
    initSamplePager();
  }

  function initSamplePager() {
    const rows = Array.prototype.slice.call(
      document.querySelectorAll('#sample-table tbody tr')
    );
    const search = document.getElementById('sample-search');
    const info = document.getElementById('page-info');
    const prev = document.getElementById('prev-page');
    const next = document.getElementById('next-page');
    const perSel = document.getElementById('per-page');

    if (!rows.length || !info || !prev || !next) return;

    let page = 1;
    let perPage = parseInt(perSel && perSel.value, 10) || 5;
    let filtered = rows.slice();

    function applyFilter() {
      const q = (search && search.value ? search.value : '').trim().toLowerCase();
      filtered = rows.filter(function (tr) {
        return !q || tr.textContent.toLowerCase().indexOf(q) >= 0;
      });
      page = 1;
      renderPage();
    }

    function renderPage() {
      const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
      if (page > totalPages) page = totalPages;
      rows.forEach(function (tr) {
        tr.style.display = 'none';
      });
      const start = (page - 1) * perPage;
      filtered.slice(start, start + perPage).forEach(function (tr) {
        tr.style.display = '';
      });
      info.textContent = page + '/' + totalPages;
      prev.disabled = page <= 1;
      next.disabled = page >= totalPages;
    }

    if (search) search.addEventListener('input', applyFilter);
    if (perSel) {
      perSel.addEventListener('change', function () {
        perPage = parseInt(this.value, 10) || 5;
        page = 1;
        renderPage();
      });
    }
    prev.addEventListener('click', function () {
      if (page > 1) {
        page--;
        renderPage();
      }
    });
    next.addEventListener('click', function () {
      const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
      if (page < totalPages) {
        page++;
        renderPage();
      }
    });

    applyFilter();
  }

  function applyPayload(data, sourceNote) {
    cachedPayload = data;
    renderStats(data.stats);
    renderSampleRows(data.samples);
    const lc = labelCounts(data);
    renderLabelChart(lc.neg, lc.pos);
    if (sourceNote) {
      const el = document.getElementById('dataset-stats');
      if (el && el.querySelector('.dataset-stats-cards')) {
        const note = document.createElement('p');
        note.className = 'chart-note';
        note.textContent = sourceNote;
        el.appendChild(note);
      }
    }
  }

  function showDatasetError(err) {
    const statsEl = document.getElementById('dataset-stats');
    const msg = err.message || String(err);
    const hint =
      window.location.protocol === 'file:'
        ? 'Open via the Flask app: make serve → http://127.0.0.1:8000/dataset.html'
        : window.UI_MESSAGES?.errorDatasetHint || 'Run: make serve — then refresh';

    if (statsEl) {
      statsEl.innerHTML = window.uiErrorAlert
        ? window.uiErrorAlert(
            window.UI_MESSAGES?.errorDatasetTitle || 'Unable to load dataset',
            msg,
            hint
          )
        : '<p><strong>Error</strong> ' + escapeHtml(msg) + '<br><small>' + escapeHtml(hint) + '</small></p>';
    }

    const hintEl = document.getElementById('label-chart-hint');
    if (hintEl) hintEl.textContent = 'Load the app with make serve to see the chart.';
    renderSampleRows([]);
  }

  function loadDataset() {
    const statsEl = document.getElementById('dataset-stats');
    if (statsEl) {
      statsEl.innerHTML =
        '<span class="text-muted-app">' +
        (window.UI_MESSAGES?.loadingDataset || 'Loading dataset…') +
        '</span>';
    }

    if (window.location.protocol === 'file:') {
      showDatasetError(new Error('Page opened as a local file (file://)'));
      return Promise.resolve();
    }

    const apiUrl = resolveApiUrl(API_DATASET);
    const artifactUrl = resolveApiUrl(ARTIFACT_DATASET);

    return fetchJson(apiUrl)
      .then(function (data) {
        applyPayload(data);
      })
      .catch(function (err) {
        console.warn('[Dataset] API failed, trying artifact:', err);
        return fetchJson(artifactUrl)
          .then(function (data) {
            applyPayload(data, 'Loaded from offline snapshot (API unavailable).');
          })
          .catch(function () {
            showDatasetError(err);
          });
      });
  }

  function downloadBlob(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.exportDatasetJSON = function () {
    if (!cachedPayload) {
      window.toast ? window.toast.warn('Dataset not loaded yet. Refresh after running: make serve') : null;
      return;
    }
    downloadBlob(
      'dataset_info.json',
      'application/json',
      JSON.stringify(cachedPayload, null, 2)
    );
  };

  window.exportDatasetCSV = function () {
    if (!cachedPayload || !cachedPayload.samples) {
      window.toast ? window.toast.warn('No sample rows to export.') : null;
      return;
    }
    let csv = 'text,label\n';
    cachedPayload.samples.forEach(function (row) {
      const text = String(row.text || '').replace(/"/g, '""');
      csv += '"' + text + '",' + row.label + '\n';
    });
    downloadBlob('dataset_samples.csv', 'text/csv', csv);
  };

  function boot() {
    loadDataset().catch(function (err) {
      console.error('[Dataset] boot:', err);
      showDatasetError(err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
