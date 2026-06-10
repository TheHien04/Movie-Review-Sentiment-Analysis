(function () {
  'use strict';

  var resultA = null;
  var resultB = null;
  var sentimentChart = null;
  var confidenceChart = null;

  async function analyzeReview(reviewId, resultId) {
    var textarea = document.getElementById(reviewId);
    var resultDiv = document.getElementById(resultId);
    var review = textarea.value.trim();

    if (!review) {
      window.toast ? window.toast.warn('Please enter a review first') : null;
      return null;
    }

    resultDiv.innerHTML = '<p class="text-muted">Analyzing...</p>';

    try {
      var response = await fetch(window.apiUrl('/api/predict'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: review }),
      });

      var data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'HTTP ' + response.status);
      }
      displayResult(data, resultDiv);
      var xaiId = resultId === 'result-a' ? 'compare-xai-a' : 'compare-xai-b';
      renderCompareXai(review, xaiId);
      return data;
    } catch (err) {
      resultDiv.innerHTML = '<p class="text-danger">Error analyzing review</p>';
      window.toast ? window.toast.error('Analysis failed — is the server running?') : null;
      return null;
    }
  }

  function confPct(result) {
    var c = typeof result.confidence === 'number' ? result.confidence : result.probability;
    return Math.round(c * 1000) / 10;
  }

  function displayResult(data, container) {
    var isPositive = data.label === 1;
    var confidence = confPct(data).toFixed(1);
    var CC = window.CinemaChart;
    var color = isPositive ? CC.colors.fresh : CC.colors.rotten;
    var verdict = isPositive ? 'Fresh' : 'Rotten';

    container.innerHTML =
      '<div class="p-3 rounded" style="background: rgba(18, 18, 26, 0.92); border-left: 4px solid ' + color + ';">' +
        '<h5 style="color: ' + color + ';">' + (isPositive ? '★' : '✕') + ' ' + verdict + '</h5>' +
        '<p class="mb-1"><strong>Confidence:</strong> ' + confidence + '%</p>' +
        '<div class="progress" style="height: 8px;">' +
          '<div class="progress-bar" role="progressbar" style="width: ' + confidence + '%; background: ' + color + ';" ' +
               'aria-valuenow="' + confidence + '" aria-valuemin="0" aria-valuemax="100"></div>' +
        '</div>' +
      '</div>';
  }

  async function renderCompareXai(reviewText, xaiContainerId) {
    var box = document.getElementById(xaiContainerId);
    if (!box || !reviewText) return;
    box.style.display = 'block';
    box.innerHTML = '<p class="text-muted mb-1">Loading word highlights…</p>';
    try {
      var res = await fetch(window.apiUrl('/api/explain'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reviewText }),
      });
      var data = await res.json();
      if (!res.ok || !data.tokens) {
        box.style.display = 'none';
        return;
      }
      var html = '<p class="mb-1"><strong>Top drivers</strong> (input × gradient)</p><div class="compare-xai__tokens">';
      data.tokens.slice(0, 24).forEach(function (t) {
        var a = Math.min(Math.abs(t.score) * 0.7 + 0.15, 0.85);
        var bg = t.score > 0
          ? 'rgba(61,214,140,' + a + ')'
          : 'rgba(229,9,20,' + a + ')';
        html += '<span class="compare-xai__tok" style="background:' + bg + '">' + t.token + '</span>';
      });
      html += '</div>';
      box.innerHTML = html;
    } catch (_) {
      box.style.display = 'none';
    }
  }

  function updateComparison() {
    if (!resultA || !resultB) return;

    document.getElementById('comparison-section').style.display = 'block';

    function drawCharts() {
      var CC = window.CinemaChart;
      if (!CC) return;

      var sentimentCanvas = document.getElementById('sentiment-comparison-chart');
      var confidenceCanvas = document.getElementById('confidence-comparison-chart');
      if (!sentimentCanvas || !confidenceCanvas) return;

      if (sentimentChart) { sentimentChart.destroy(); sentimentChart = null; }
      if (confidenceChart) { confidenceChart.destroy(); confidenceChart = null; }

      var barOpts = CC.baseOptions('bar', {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true, max: 100,
            grid: { color: CC.colors.grid },
            ticks: { color: CC.colors.tick, callback: function (v) { return v + '%'; } },
          },
          x: { grid: { display: false }, ticks: { color: CC.colors.tick } },
        },
      });

      sentimentChart = new Chart(sentimentCanvas, {
        type: 'bar',
        data: {
          labels: ['Review A', 'Review B'],
          datasets: [{
            label: 'Model confidence (%)',
            data: [confPct(resultA), confPct(resultB)],
            backgroundColor: [
              resultA.label === 1 ? CC.colors.fresh : CC.colors.rotten,
              resultB.label === 1 ? CC.colors.fresh : CC.colors.rotten,
            ],
            borderColor: CC.colors.labelBorder,
            borderWidth: 2, borderRadius: 4,
          }],
        },
        options: barOpts,
      });

      var doughnutOpts = CC.baseOptions('doughnut', { maintainAspectRatio: false, cutout: '62%' });
      confidenceChart = new Chart(confidenceCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Review A', 'Review B'],
          datasets: [{
            data: [confPct(resultA), confPct(resultB)],
            backgroundColor: CC.colors.compareDoughnut,
            borderColor: CC.colors.labelBorder, borderWidth: 2,
          }],
        },
        options: doughnutOpts,
      });

      var winnerText = document.getElementById('winner-text');
      var sentA = resultA.label === 1 ? 'Fresh' : 'Rotten';
      var sentB = resultB.label === 1 ? 'Fresh' : 'Rotten';

      if (resultA.label === resultB.label) {
        var stronger = confPct(resultA) > confPct(resultB) ? 'A' : 'B';
        winnerText.innerHTML =
          'Both reviews are <strong>' + sentA + '</strong>, but Review <strong>' +
          stronger + '</strong> shows stronger confidence.';
      } else {
        winnerText.innerHTML =
          'Reviews have <strong>opposite sentiments</strong>: Review A is <strong>' +
          sentA + '</strong> while Review B is <strong>' + sentB + '</strong>.';
      }
    }

    if (window.requestAnimationFrame) {
      requestAnimationFrame(drawCharts);
    } else {
      setTimeout(drawCharts, 0);
    }
  }

  document.getElementById('analyze-a-btn').addEventListener('click', async function () {
    resultA = await analyzeReview('review-a', 'result-a');
    if (resultA && resultB) updateComparison();
  });

  document.getElementById('analyze-b-btn').addEventListener('click', async function () {
    resultB = await analyzeReview('review-b', 'result-b');
    if (resultA && resultB) updateComparison();
  });

  document.getElementById('analyze-both-btn').addEventListener('click', async function () {
    resultA = await analyzeReview('review-a', 'result-a');
    resultB = await analyzeReview('review-b', 'result-b');
    if (resultA && resultB) setTimeout(updateComparison, 300);
  });

  document.getElementById('clear-all-btn').addEventListener('click', function () {
    document.getElementById('review-a').value = '';
    document.getElementById('review-b').value = '';
    document.getElementById('result-a').innerHTML = '';
    document.getElementById('result-b').innerHTML = '';
    ['compare-xai-a', 'compare-xai-b'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.innerHTML = ''; el.style.display = 'none'; }
    });
    document.getElementById('comparison-section').style.display = 'none';
    resultA = null;
    resultB = null;
  });

  document.getElementById('swap-btn').addEventListener('click', function () {
    var tempText = document.getElementById('review-a').value;
    document.getElementById('review-a').value = document.getElementById('review-b').value;
    document.getElementById('review-b').value = tempText;

    var tempResult = resultA;
    resultA = resultB;
    resultB = tempResult;

    if (resultA) displayResult(resultA, document.getElementById('result-a'));
    else document.getElementById('result-a').innerHTML = '';

    if (resultB) displayResult(resultB, document.getElementById('result-b'));
    else document.getElementById('result-b').innerHTML = '';

    if (resultA && resultB) updateComparison();
  });

  document.querySelectorAll('[data-demo-review][data-target]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var ta = document.getElementById(btn.getAttribute('data-target'));
      if (ta) { ta.value = btn.getAttribute('data-demo-review') || ''; ta.focus(); }
    });
  });

  document.querySelectorAll('[data-demo-a][data-demo-b]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.getElementById('review-a').value = btn.getAttribute('data-demo-a') || '';
      document.getElementById('review-b').value = btn.getAttribute('data-demo-b') || '';
    });
  });

  if (window.keyboardShortcuts) {
    keyboardShortcuts.register('analyze', function () {
      document.getElementById('analyze-both-btn').click();
    });
    keyboardShortcuts.register('clear', function () {
      document.getElementById('clear-all-btn').click();
    });
  }
})();
