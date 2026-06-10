/**
 * Review Arc — sentence-level sentiment timeline (tone shift visualization).
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render(containerId, arc, summary) {
    const el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!el) return;
    if (!arc || !arc.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }

    el.style.display = 'block';
    const shiftNote =
      summary && summary.tone_shift
        ? '<p class="review-arc__shift">Tone shift detected — opening vs closing sentences disagree.</p>'
        : '';

    const bars = arc
      .map(function (seg, i) {
        const fresh = seg.label === 1;
        const conf = Math.round((seg.confidence ?? seg.probability ?? 0.5) * 100);
        const cls = fresh ? 'review-arc__seg--fresh' : 'review-arc__seg--rotten';
        const short = seg.text.length > 72 ? seg.text.slice(0, 72) + '…' : seg.text;
        return (
          '<div class="review-arc__seg ' + cls + '" style="--seg-h:' + Math.max(28, conf) + '%" title="' + escapeHtml(seg.text) + '">' +
            '<span class="review-arc__idx">' + (i + 1) + '</span>' +
            '<span class="review-arc__pct">' + conf + '%</span>' +
          '</div>'
        );
      })
      .join('');

    const captions = arc
      .map(function (seg, i) {
        const fresh = seg.label === 1;
        const short = seg.text.length > 90 ? seg.text.slice(0, 90) + '…' : seg.text;
        return (
          '<li class="review-arc__caption ' + (fresh ? 'review-arc__caption--fresh' : 'review-arc__caption--rotten') + '">' +
            '<span class="review-arc__cap-n">§' + (i + 1) + '</span> ' + escapeHtml(short) +
          '</li>'
        );
      })
      .join('');

    el.innerHTML =
      '<section class="review-arc" aria-labelledby="review-arc-heading">' +
        '<h4 id="review-arc-heading" class="review-arc__title">Review tone arc</h4>' +
        '<p class="review-arc__desc">Per-sentence Fresh / Rotten — useful for mixed reviews and critic spoilers.</p>' +
        shiftNote +
        '<div class="review-arc__chart" role="img" aria-label="Sentence sentiment timeline">' + bars + '</div>' +
        '<ol class="review-arc__captions">' + captions + '</ol>' +
      '</section>';
  }

  global.ReviewArc = { render: render };
})(typeof window !== 'undefined' ? window : this);
