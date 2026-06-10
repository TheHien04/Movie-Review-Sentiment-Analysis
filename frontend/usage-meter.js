/**
 * Free-tier usage meter — client-side with optional server sync via /api/usage
 */
(function () {
  var FREE_DAILY = 50;
  var TIER = 'free';
  var STORAGE_KEY = 'cinesentiment_usage';

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : {};
      if (data.date !== todayKey()) {
        return { date: todayKey(), count: 0 };
      }
      return data;
    } catch (e) {
      return { date: todayKey(), count: 0 };
    }
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* private browsing */ }
  }

  function render() {
    var el = document.getElementById('usage-meter');
    if (!el) return;
    var data = load();
    var left = Math.max(0, FREE_DAILY - data.count);
    var tierLabel = TIER === 'free' ? 'Free plan' : TIER + ' API';
    el.innerHTML =
      '<span class="usage-meter__label">' + tierLabel + '</span> ' +
      '<strong>' +
      data.count +
      '</strong> / ' +
      FREE_DAILY +
      ' analyses today' +
      (left === 0
        ? ' · <a href="/developer.html">Get API key</a>'
        : ' · ' + left + ' remaining');
    el.classList.toggle('usage-meter--limit', data.count >= FREE_DAILY);
  }

  function record(n) {
    n = n || 1;
    var data = load();
    data.count = Math.min(FREE_DAILY + 1000, data.count + n);
    data.date = todayKey();
    save(data);
    render();
    return data.count <= FREE_DAILY;
  }

  function canUse(n) {
    n = n || 1;
    return load().count + n <= FREE_DAILY;
  }

  window.usageMeter = {
    record: record,
    canUse: canUse,
    render: render,
    limit: FREE_DAILY,
    getCount: function () {
      return load().count;
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

  var usageUrl = typeof window.apiUrl === 'function' ? window.apiUrl('/api/usage') : '/api/usage';
  fetch(usageUrl)
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (d) {
      if (!d || d.daily_limit == null) return;
      FREE_DAILY = d.daily_limit;
      TIER = d.tier || 'free';
      window.usageMeter.limit = FREE_DAILY;
      window.usageMeter.tier = TIER;
      render();
    })
    .catch(function () { /* offline ok */ });
})();
