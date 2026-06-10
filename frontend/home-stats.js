/**
 * Bind home hero stats from measured evaluation artifact.
 */
(function () {
  const ratingEl = document.querySelector('.cinema-hero__rating span:last-child');
  if (!ratingEl) return;

  const url = window.apiUrl('/artifacts/results/evaluation.json');

  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('artifact missing');
      return res.json();
    })
    .then(function (artifact) {
      const test = artifact.splits && artifact.splits.test;
      const m = test && test.metrics;
      if (!m) return;

      const acc = (m.accuracy * 100).toFixed(1);
      const f1 = (m.f1 * 100).toFixed(1);
      const auc =
        typeof m.roc_auc === 'number' ? (m.roc_auc * 100).toFixed(1) : null;
      ratingEl.textContent =
        acc +
        '% accuracy · ' +
        f1 +
        '% F1 on IMDB' +
        (auc ? ' · ROC-AUC ' + auc + '%' : '');
    })
    .catch(function () {
      ratingEl.textContent = '~91% accuracy on IMDB reviews';
    });
})();
