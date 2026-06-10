/**
 * Shared product UI copy — user-facing errors (no Makefile in primary messages).
 */
window.UI_MESSAGES = {
  loadingDataset: 'Loading dataset statistics…',
  loadingMetrics: 'Loading model metrics…',
  errorMetricsTitle: 'Metrics temporarily unavailable',
  errorMetricsHint:
    'We could not load accuracy data. <button type="button" class="ui-retry-btn" data-retry>Try again</button>',
  errorDatasetTitle: 'Dataset unavailable',
  errorDatasetHint:
    'Please check your connection and refresh. <button type="button" class="ui-retry-btn" data-retry>Retry</button>',
  errorOfflineTitle: 'You appear to be offline',
  errorOfflineHint: 'Check your network, then refresh the page.',
  errorGeneric: 'Something went wrong. Please try again.',
  errorAnalysisTitle: 'Analysis failed',
  errorAnalysisHint:
    'The service may be busy. Wait a moment and try again. <button type="button" class="ui-retry-btn" data-retry>Retry</button>',
  devHintAccordion:
    '<details class="ui-dev-hint"><summary>For developers</summary><p>Run <code>make serve</code> locally and open <code>http://127.0.0.1:8000</code>.</p></details>',
};

window.uiErrorAlert = function (title, message, hint, showDev) {
  return (
    '<div class="ui-alert ui-alert-error" role="alert">' +
    '<strong>' +
    title +
    '</strong><p class="mb-1">' +
    message +
    '</p>' +
    (hint ? '<p class="ui-alert-hint mb-0">' + hint + '</p>' : '') +
    (showDev ? window.UI_MESSAGES.devHintAccordion : '') +
    '</div>'
  );
};

document.addEventListener('click', function (e) {
  if (e.target && e.target.matches && e.target.matches('[data-retry]')) {
    window.location.reload();
  }
});
