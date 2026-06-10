/**
 * Live typing preview — debounced sentiment hint while drafting a review.
 */
(function () {
  'use strict';

  const MIN_CHARS = 18;
  const DEBOUNCE_MS = 750;

  function init() {
    const ta = document.getElementById('single-review');
    const panel = document.getElementById('live-preview-panel');
    if (!ta || !panel) return;

    let timer = null;
    let lastText = '';
    let inFlight = false;

    function hide() {
      panel.classList.remove('is-active');
      panel.setAttribute('aria-hidden', 'true');
    }

    function showLoading() {
      panel.classList.add('is-active');
      panel.setAttribute('aria-hidden', 'false');
      panel.innerHTML =
        '<div class="live-preview live-preview--loading">' +
          '<span class="live-preview__dot" aria-hidden="true"></span> Draft sentiment…' +
        '</div>';
    }

    function showResult(data) {
      const label = data.label === 1 ? 1 : 0;
      const conf = data.confidence ?? data.probability ?? 0;
      const verdict = label === 1 ? 'Fresh' : 'Rotten';
      const icon = label === 1 ? '★' : '✕';
      const cls = label === 1 ? 'live-preview--fresh' : 'live-preview--rotten';
      const pct = Math.round(conf * 100);

      panel.classList.add('is-active');
      panel.setAttribute('aria-hidden', 'false');
      panel.innerHTML =
        '<div class="live-preview ' + cls + '" role="status">' +
          '<span class="live-preview__label">Live draft</span>' +
          '<span class="live-preview__verdict">' + icon + ' ' + verdict + '</span>' +
          '<span class="live-preview__conf">' + pct + '%</span>' +
          '<span class="live-preview__hint">Press Rate for full XAI + arc</span>' +
        '</div>';

      if (window.Rottenmeter) {
        const meter = document.createElement('div');
        meter.className = 'live-preview__meter';
        panel.querySelector('.live-preview').appendChild(meter);
        window.Rottenmeter.render(meter, label, conf, data.probability);
        meter.querySelector('.rottenmeter')?.classList.add('rottenmeter--sm');
      }
    }

    async function runPreview(text) {
      if (inFlight || text === lastText) return;
      lastText = text;
      inFlight = true;
      showLoading();
      try {
        const res = await fetch(window.apiUrl('/api/predict'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'preview failed');
        if (ta.value.trim() === text) showResult(data);
      } catch {
        hide();
      } finally {
        inFlight = false;
      }
    }

    ta.addEventListener('input', function () {
      clearTimeout(timer);
      const text = ta.value.trim();
      if (text.length < MIN_CHARS) {
        lastText = '';
        hide();
        return;
      }
      timer = setTimeout(function () {
        runPreview(text);
      }, DEBOUNCE_MS);
    });

    ta.addEventListener('blur', function () {
      if (!ta.value.trim()) hide();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
