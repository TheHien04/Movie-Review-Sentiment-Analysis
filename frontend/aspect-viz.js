/**
 * Aspect sentiment radar / bars — acting, plot, visuals, pacing, sound.
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render(containerId, aspectsPayload) {
    var el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!el) return;

    var aspects = (aspectsPayload && aspectsPayload.aspects) || [];
    if (!aspects.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }

    el.style.display = 'block';
    var coverage = aspectsPayload.coverage != null ? Math.round(aspectsPayload.coverage * 100) : 0;
    var method = aspectsPayload.method ? ' · ' + aspectsPayload.method : '';
    var bars = aspects
      .map(function (a) {
        var fresh = a.label_id === 1 || a.sentiment === 'positive';
        var pct = Math.round((a.fresh_ratio != null ? a.fresh_ratio : a.probability_positive || 0.5) * 100);
        var cls = fresh ? 'aspect-bar--fresh' : 'aspect-bar--rotten';
        var icon = fresh ? '★' : '✕';
        return (
          '<div class="aspect-bar-row">' +
            '<div class="aspect-bar-row__head">' +
              '<span class="aspect-bar-row__label">' + escapeHtml(a.label || a.id) + '</span>' +
              '<span class="aspect-bar-row__verdict ' + cls + '">' + icon + ' ' + pct + '% Fresh</span>' +
            '</div>' +
            '<div class="aspect-bar-track"><div class="aspect-bar-fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
            '<p class="aspect-bar-row__sample">“' + escapeHtml(a.sample || '') + '”</p>' +
          '</div>'
        );
      })
      .join('');

    el.innerHTML =
      '<section class="aspect-panel" aria-labelledby="aspect-panel-title">' +
        '<h4 id="aspect-panel-title" class="aspect-panel__title">Aspect breakdown</h4>' +
        '<p class="aspect-panel__desc">Per-dimension scores — ' + coverage + '% areas mentioned' + method + '.</p>' +
        '<div class="aspect-bars">' + bars + '</div>' +
      '</section>';
  }

  global.AspectViz = { render: render };
})(typeof window !== 'undefined' ? window : this);
