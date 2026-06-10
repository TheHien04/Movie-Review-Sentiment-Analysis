/**
 * Shared cinema nav + footer (set data-page on <body>)
 * v1.1: mobile menu, navbar theme toggle, back-to-top
 */
(function applyEarlyTheme() {
  try {
    var t = localStorage.getItem('theme');
    if (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      t = 'light';
    }
    if (!t) t = 'dark';
    document.documentElement.setAttribute('data-theme', t);
    if (document.body) document.body.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

(function () {
  const page = document.body.dataset.page || '';
  const links = [
    { href: '/index.html', id: 'home', label: 'Home' },
    { href: '/batch.html', id: 'analyze', label: 'Analyze' },
    { href: '/compare.html', id: 'compare', label: 'Compare' },
    { href: '/evaluation.html', id: 'evaluation', label: 'Metrics' },
    { href: '/index.html#pricing', id: 'pricing', label: 'Pricing' },
  ];

  const linksHtml = links
    .map(function (l) {
      const active = l.id === page ? ' class="active"' : '';
      return '<li><a href="' + l.href + '"' + active + '>' + l.label + '</a></li>';
    })
    .join('');

  const navHtml =
    '<a href="/index.html" class="brand" aria-label="CineSentiment home">' +
    '<img src="/assets/logo.svg" alt="" width="40" height="40" decoding="async" />' +
    '<span class="brand-text"><span class="brand-name">CineSentiment</span>' +
    '<span class="brand-tag">Movie Review AI</span></span></a>' +
    '<div class="nav-actions">' +
    '<button type="button" class="nav-theme-btn" data-theme-toggle aria-label="Toggle light or dark theme">' +
    '<span class="nav-theme-btn__icon" aria-hidden="true">☀️</span></button>' +
    '<button type="button" class="nav-menu-btn" aria-expanded="false" aria-controls="cinema-nav-panel" aria-label="Open navigation menu">' +
    '<span class="nav-menu-btn__bar" aria-hidden="true"></span>' +
    '<span class="nav-menu-btn__bar" aria-hidden="true"></span>' +
    '<span class="nav-menu-btn__bar" aria-hidden="true"></span>' +
    '</button></div>' +
    '<div id="cinema-nav-panel" class="nav-panel">' +
    '<ul class="nav-links" role="list">' +
    linksHtml +
    '</ul></div>';

  const footerHtml =
    '<div class="site-footer__inner">' +
    '<p class="footer-links">' +
    '<a href="/summary.html">Statistics</a> &middot; ' +
    '<a href="/insights.html">Insights</a> &middot; ' +
    '<a href="/dataset.html">Dataset</a> &middot; ' +
    '<a href="/developer.html">Developer</a> &middot; ' +
    '<a href="/modern/" title="React + TypeScript UI">Modern UI</a> &middot; ' +
    '<a href="/index.html#pricing">Pricing</a>' +
    '</p>' +
    '<small>&copy; 2026 CineSentiment &middot; <span id="footer-app-version">v2.0.0</span> &middot; ' +
    '<button type="button" class="footer-shortcuts-btn" id="footer-shortcuts-btn" title="Keyboard shortcuts (press ?)">Keyboard shortcuts</button> &middot; ' +
    '<a class="footer-dev-link" href="/api/docs" title="OpenAPI reference">API</a> &middot; ' +
    '<a class="footer-dev-link" href="/checklist.html" title="System health">Ops</a></small>' +
    '</div>';

  function updateThemeButtons(theme) {
    document.querySelectorAll('[data-theme-toggle] .nav-theme-btn__icon').forEach(function (el) {
      el.textContent = theme === 'light' ? '🌙' : '☀️';
    });
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute(
        'aria-label',
        theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
      );
    });
  }

  function initThemeToggle() {
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    updateThemeButtons(theme);

    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') || 'dark';
        var next = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        try {
          localStorage.setItem('theme', next);
        } catch (_) { /* localStorage may be unavailable in private browsing */ }
        updateThemeButtons(next);
        if (window.themeManager && typeof window.themeManager.updateToggleButton === 'function') {
          window.themeManager.currentTheme = next;
          window.themeManager.updateToggleButton();
        }
      });
    });
  }

  function closeMobileNav() {
    document.querySelectorAll('.nav-panel').forEach(function (panel) {
      panel.classList.remove('is-open');
    });
    document.querySelectorAll('.nav-menu-btn').forEach(function (btn) {
      btn.setAttribute('aria-expanded', 'false');
    });
    document.body.classList.remove('nav-open');
  }

  function initMobileNav() {
    document.querySelectorAll('.nav-menu-btn').forEach(function (btn) {
      if (btn.dataset.menuBound) return;
      btn.dataset.menuBound = '1';
      btn.addEventListener('click', function () {
        var panel = document.getElementById('cinema-nav-panel');
        if (!panel) return;
        var open = !panel.classList.contains('is-open');
        panel.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('nav-open', open);
      });
    });

    document.querySelectorAll('.nav-panel .nav-links a').forEach(function (a) {
      a.addEventListener('click', closeMobileNav);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMobileNav();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) closeMobileNav();
    });
  }

  function initFooterVersion() {
    var el = document.getElementById('footer-app-version');
    if (!el || el.dataset.versionBound) return;
    el.dataset.versionBound = '1';
    var url = typeof window.apiUrl === 'function' ? window.apiUrl('/health') : '/health';
    fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.version) el.textContent = 'v' + d.version;
      })
      .catch(function () { /* offline / file:// */ });
  }

  function initFooterShortcuts() {
    var btn = document.getElementById('footer-shortcuts-btn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';

    function openHelp() {
      if (window.CineShortcuts && typeof window.CineShortcuts.showHelp === 'function') {
        window.CineShortcuts.showHelp();
      }
    }

    btn.addEventListener('click', openHelp);

    if (!window.__cineShortcutsInit && !document.querySelector('script[src*="keyboard-shortcuts"]')) {
      var s = document.createElement('script');
      s.src = '/keyboard-shortcuts.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }

  function initBackToTop() {
    if (document.getElementById('back-to-top')) return;
    var btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);

    window.addEventListener(
      'scroll',
      function () {
        btn.classList.toggle('is-visible', window.scrollY > 420);
      },
      { passive: true }
    );
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function mountLayout() {
    document.querySelectorAll('[data-cinema-nav]').forEach(function (el) {
      el.className = 'navbar-cinema';
      el.setAttribute('role', 'navigation');
      el.setAttribute('aria-label', 'Main navigation');
      el.innerHTML = navHtml;
    });

    document.querySelectorAll('[data-cinema-footer]').forEach(function (el) {
      el.className = 'site-footer py-3 text-center mt-4';
      el.innerHTML = footerHtml;
    });

    initThemeToggle();
    initMobileNav();
    initFooterVersion();
    initFooterShortcuts();
    initBackToTop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountLayout);
  } else {
    mountLayout();
  }
})();

/** Reset stuck loading overlay when returning via back button */
window.addEventListener('pageshow', function () {
  document.body.style.overflow = '';
  if (window.loading && typeof window.loading.hide === 'function') {
    window.loading.hide();
  }
});
