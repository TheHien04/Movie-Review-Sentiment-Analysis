(function () {
  'use strict';

  var STORAGE_KEY = 'cinesentiment_api_key';
  var DEMO_KEY = 'csk_demo_cinesentiment_local';
  var serverVersion = null;
  var v2Ready = false;

  function getKey() {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEMO_KEY;
    } catch (_) {
      return DEMO_KEY;
    }
  }

  function saveKey(val) {
    try {
      localStorage.setItem(STORAGE_KEY, val);
    } catch (_) { /* ignore */ }
  }

  function headers(json) {
    var h = { 'X-API-Key': getKey() };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  function parseVersion(v) {
    return String(v || '0').split('.').map(function (n) {
      return parseInt(n, 10) || 0;
    });
  }

  function versionLt(a, b) {
    var pa = parseVersion(a);
    var pb = parseVersion(b);
    for (var i = 0; i < 3; i++) {
      var x = pa[i] || 0;
      var y = pb[i] || 0;
      if (x < y) return true;
      if (x > y) return false;
    }
    return false;
  }

  function showBanner(kind, html) {
    var el = document.getElementById('dev-server-banner');
    if (!el) return;
    el.hidden = false;
    el.className = 'dev-server-banner container dev-server-banner--' + kind;
    el.innerHTML = html;
  }

  function hideBanner() {
    var el = document.getElementById('dev-server-banner');
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  }

  function setV2Controls(enabled) {
    var ids = [
      'api-key-validate',
      'checkout-btn',
      'webhook-save',
      'webhook-test',
      'dev-analyze-btn',
      'dev-aspects-btn',
    ];
    ids.forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.disabled = !enabled;
    });
  }

  function showJson(data) {
    var pre = document.getElementById('dev-response');
    if (pre) pre.textContent = JSON.stringify(data, null, 2);
  }

  function formatApiError(res, data) {
    if (res.status === 404 && data && data.error === 'API endpoint not found') {
      return (
        'Server v' + (serverVersion || '?') + ' thiếu route v2.0. ' +
        'Trong terminal: Ctrl+C → make serve → reload trang (Cmd+Shift+R).'
      );
    }
    if (res.status === 0) {
      return 'Không kết nối được API — chạy make serve (port 8000), không mở file HTML trực tiếp.';
    }
    return (data && data.error) || 'Request failed (HTTP ' + res.status + ')';
  }

  async function checkServer() {
    try {
      var health = await fetch(window.apiUrl('/health'));
      if (!health.ok) {
        v2Ready = false;
        setV2Controls(false);
        showBanner(
          'error',
          'API chưa sẵn sàng. Mở terminal trong project, chạy <code>make serve</code>, rồi mở <code>http://127.0.0.1:8000/developer.html</code>.'
        );
        return { ok: false };
      }

      var hres = await health.json();
      serverVersion = hres.version || null;

      if (versionLt(serverVersion, '2.0.0')) {
        v2Ready = false;
        setV2Controls(false);
        showBanner(
          'warn',
          '<strong>Không phải lỗi UI</strong> — backend đang chạy <strong>v' + serverVersion + '</strong> (cũ). ' +
            'Trang Developer cần <strong>v2.0</strong>. Trong terminal: <kbd>Ctrl+C</kbd> dừng server → <code>make serve</code> → reload <kbd>Cmd+Shift+R</kbd>.'
        );
        return { ok: true, v2: false, version: serverVersion };
      }

      v2Ready = true;
      setV2Controls(true);
      showBanner(
        'ok',
        'Server v' + serverVersion + ' · Developer API sẵn sàng. Demo key: <code>' + DEMO_KEY + '</code>'
      );
      return { ok: true, v2: true, version: serverVersion };
    } catch (_) {
      v2Ready = false;
      setV2Controls(false);
      showBanner(
        'error',
        'Không kết nối được API. Chạy <code>make serve</code> — đừng mở file HTML bằng file://.'
      );
      return { ok: false };
    }
  }

  async function validateKey() {
    var status = document.getElementById('api-key-status');
    status.textContent = 'Checking…';

    var srv = await checkServer();
    if (!srv.ok) {
      status.textContent = 'Chưa kết nối API — chạy make serve';
      return;
    }
    if (!srv.v2) {
      status.textContent = 'Cần restart server lên v2.0 (make serve) trước khi validate key.';
      return;
    }

    try {
      var res = await fetch(window.apiUrl('/api/developer/me'), { headers: headers() });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(formatApiError(res, data));
      status.innerHTML =
        '<strong>' + data.tier + '</strong> · ' +
        data.usage.remaining + '/' + data.usage.daily_limit + ' left · ' +
        (data.webhook_configured ? 'Webhook ✓' : 'No webhook') +
        ' · key ' + data.key_mask +
        (serverVersion ? ' · server v' + serverVersion : '');
      if (window.toast) window.toast.success('API key valid');
    } catch (e) {
      var msg = e.message || 'Could not validate key';
      if (msg === 'Failed to fetch') {
        msg = 'Không kết nối được API — chạy: make serve';
      }
      status.textContent = msg;
    }
  }

  async function runAnalyze() {
    if (!v2Ready) {
      showJson({ error: 'Restart server với make serve để dùng /api/analyze' });
      return;
    }
    var text = (document.getElementById('dev-review') || {}).value || '';
    showJson({ loading: true });
    var res = await fetch(window.apiUrl('/api/analyze'), {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ text: text, explain: false, arc: true, aspects: true }),
    });
    var data = await res.json().catch(function () {
      return { error: 'Invalid JSON response' };
    });
    if (!res.ok) {
      showJson({ error: formatApiError(res, data), details: data });
      return;
    }
    showJson(data);
  }

  async function runAspects() {
    if (!v2Ready) {
      showJson({ error: 'Restart server với make serve để dùng /api/aspects' });
      return;
    }
    var text = (document.getElementById('dev-review') || {}).value || '';
    showJson({ loading: true });
    var res = await fetch(window.apiUrl('/api/aspects'), {
      method: 'POST',
      headers: headers(true),
      body: JSON.stringify({ text: text }),
    });
    var data = await res.json().catch(function () {
      return { error: 'Invalid JSON response' };
    });
    if (!res.ok) {
      showJson({ error: formatApiError(res, data), details: data });
      return;
    }
    showJson(data);
  }

  async function checkout() {
    if (!v2Ready) {
      var out = document.getElementById('checkout-result');
      if (out) out.textContent = 'Cần server v2.0 — make serve rồi thử lại.';
      return;
    }
    var email = (document.getElementById('checkout-email') || {}).value || '';
    var out = document.getElementById('checkout-result');
    out.textContent = 'Processing…';
    var res = await fetch(window.apiUrl('/api/billing/checkout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    });
    var data = await res.json();
    if (data.checkout_url) {
      out.innerHTML = 'Redirecting to Stripe… <a href="' + data.checkout_url + '">Open checkout</a>';
      window.location.href = data.checkout_url;
      return;
    }
    if (data.api_key) {
      saveKey(data.api_key);
      var input = document.getElementById('api-key-input');
      if (input) input.value = data.api_key;
      out.innerHTML = '<strong>Pro key issued:</strong> <code>' + data.api_key + '</code> — saved locally.';
      if (window.toast) window.toast.success('Pro API key saved');
      validateKey();
      return;
    }
    out.textContent = data.error || data.message || JSON.stringify(data);
  }

  async function saveWebhook() {
    if (!v2Ready) {
      var st = document.getElementById('webhook-status');
      if (st) st.textContent = 'Cần server v2.0 — make serve rồi thử lại.';
      return;
    }
    var url = (document.getElementById('webhook-url') || {}).value || '';
    var secret = (document.getElementById('webhook-secret') || {}).value || '';
    var st = document.getElementById('webhook-status');
    var res = await fetch(window.apiUrl('/api/developer/webhook'), {
      method: 'PUT',
      headers: headers(true),
      body: JSON.stringify({ webhook_url: url, webhook_secret: secret || undefined }),
    });
    var data = await res.json();
    st.textContent = res.ok ? 'Webhook saved.' : (data.error || 'Failed');
    if (res.ok && window.toast) window.toast.success('Webhook configured');
    validateKey();
  }

  async function testWebhook() {
    if (!v2Ready) {
      var st = document.getElementById('webhook-status');
      if (st) st.textContent = 'Cần server v2.0 — make serve rồi thử lại.';
      return;
    }
    var st = document.getElementById('webhook-status');
    st.textContent = 'Sending test…';
    var res = await fetch(window.apiUrl('/api/webhooks/test'), {
      method: 'POST',
      headers: headers(true),
    });
    var data = await res.json();
    st.textContent = res.ok ? 'Test delivered (HTTP ' + (data.status_code || 'ok') + ')' : (data.error || 'Failed');
  }

  function init() {
    var input = document.getElementById('api-key-input');
    if (input) input.value = getKey();

    var params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success' && window.toast) {
      window.toast.success('Checkout complete — check email for API key or use billing webhook.');
    }

    document.getElementById('api-key-save')?.addEventListener('click', function () {
      if (input) saveKey(input.value.trim());
      if (window.toast) window.toast.success('Saved locally');
      if (v2Ready) validateKey();
    });
    document.getElementById('api-key-validate')?.addEventListener('click', validateKey);
    document.getElementById('dev-analyze-btn')?.addEventListener('click', runAnalyze);
    document.getElementById('dev-aspects-btn')?.addEventListener('click', runAspects);
    document.getElementById('checkout-btn')?.addEventListener('click', checkout);
    document.getElementById('webhook-save')?.addEventListener('click', saveWebhook);
    document.getElementById('webhook-test')?.addEventListener('click', testWebhook);

    validateKey();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
