/**
 * Rottenmeter — cinema-style confidence gauge (Rotten Tomatoes inspired).
 */
(function (global) {
  'use strict';

  function pct(probability) {
    return Math.round(Math.max(0, Math.min(1, probability)) * 100);
  }

  function render(container, label, confidence, probability) {
    if (!container) return;
    const isFresh = label === 1 || label === 'positive';
    const score = pct(typeof confidence === 'number' ? confidence : probability);
    const verdict = isFresh ? 'Fresh' : 'Rotten';
    const color = isFresh ? 'var(--fresh, #3dd68c)' : 'var(--rotten, #e50914)';
    const icon = isFresh ? '★' : '✕';

    container.innerHTML =
      '<div class="rottenmeter" role="meter" aria-valuenow="' + score + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + verdict + ' ' + score + ' percent">' +
        '<div class="rottenmeter__ring" style="--meter-pct:' + score + '%;--meter-color:' + color + '">' +
          '<div class="rottenmeter__inner">' +
            '<span class="rottenmeter__icon" aria-hidden="true">' + icon + '</span>' +
            '<span class="rottenmeter__score">' + score + '%</span>' +
            '<span class="rottenmeter__label">' + verdict + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  global.Rottenmeter = { render: render, pct: pct };
})(typeof window !== 'undefined' ? window : this);
