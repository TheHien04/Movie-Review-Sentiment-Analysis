/**
 * Home page: service status from /health (single source of truth).
 */
(function () {
  const el = document.getElementById('home-system-status');
  if (!el) return;

  const healthUrl = typeof window.apiUrl === 'function' ? window.apiUrl('/health') : '/health';
  var retries = 0;
  var maxRetries = 4;

  function renderStatus(data) {
    const version = data.version || '2.0.0';
    el.classList.remove('home-status--ok', 'home-status--warn', 'home-status--err');

    if (data.inference_ready) {
      const src =
        data.model_is_finetuned
          ? 'IMDB fine-tuned'
          : data.model_source === 'hub_fallback'
            ? 'demo classifier'
            : data.model_source || 'ready';
      el.innerHTML =
        '<span class="home-status__dot" aria-hidden="true"></span>' +
        'All systems operational · v' +
        version +
        ' · ' +
        src;
      el.classList.add('home-status--ok');
      return;
    }

    if (data.model_loaded) {
      el.innerHTML =
        '<span class="home-status__dot" aria-hidden="true"></span>' +
        (data.inference_message || 'Inference not available yet');
      el.classList.add('home-status--warn');
      if (retries < maxRetries) {
        retries += 1;
        setTimeout(poll, 2000 * retries);
      }
      return;
    }

    el.innerHTML =
      '<span class="home-status__dot" aria-hidden="true"></span>Starting service…';
    el.classList.add('home-status--warn');
    if (retries < maxRetries) {
      retries += 1;
      setTimeout(poll, 1500 * retries);
    }
  }

  function poll() {
    fetch(healthUrl)
      .then(function (r) {
        return r.ok ? r.json() : Promise.reject(new Error('health'));
      })
      .then(renderStatus)
      .catch(function () {
        el.classList.remove('home-status--ok', 'home-status--warn');
        el.classList.add('home-status--err');
        el.innerHTML =
          '<span class="home-status__dot" aria-hidden="true"></span>Service unavailable — please try again shortly';
        if (retries < maxRetries) {
          retries += 1;
          setTimeout(poll, 3000 * retries);
        }
      });
  }

  poll();
})();
