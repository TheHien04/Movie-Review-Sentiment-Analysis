/**
 * Global keyboard shortcuts — navigation + help modal
 */
(function () {
  if (window.__cineShortcutsInit) return;
  window.__cineShortcutsInit = true;

  var NAV_ROUTES = {
    h: { path: '/index.html', label: 'Home' },
    a: { path: '/batch.html', label: 'Analyze' },
    c: { path: '/compare.html', label: 'Compare' },
    m: { path: '/evaluation.html', label: 'Metrics' },
    i: { path: '/insights.html', label: 'Insights' },
    d: { path: '/dataset.html', label: 'Dataset' },
    s: { path: '/summary.html', label: 'Statistics' },
    k: { path: '/checklist.html', label: 'Ops checklist' },
  };

  var SHORTCUT_ROWS = [
    { keys: '?', desc: 'Open this shortcuts panel' },
    { keys: 'g then h', desc: 'Go to Home' },
    { keys: 'g then a', desc: 'Go to Analyze' },
    { keys: 'g then c', desc: 'Go to Compare' },
    { keys: 'g then m', desc: 'Go to Metrics' },
    { keys: 'g then i', desc: 'Go to Insights' },
    { keys: 'g then d', desc: 'Go to Dataset' },
    { keys: 'g then s', desc: 'Go to Statistics' },
    { keys: 'g then k', desc: 'Go to Ops checklist' },
    { keys: 'Esc', desc: 'Close menus / this panel' },
  ];

  var gPending = false;
  var gTimer = null;

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function closeModal() {
    var modal = document.getElementById('cine-shortcuts-modal');
    if (modal) modal.remove();
    document.body.classList.remove('cine-shortcuts-open');
  }

  function showHelp() {
    closeModal();

    var overlay = document.createElement('div');
    overlay.id = 'cine-shortcuts-modal';
    overlay.className = 'cine-shortcuts-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Keyboard shortcuts');

    var rows = SHORTCUT_ROWS.map(function (row) {
      return (
        '<tr><td class="cine-shortcuts-modal__keys"><kbd>' + row.keys + '</kbd></td>' +
        '<td>' + row.desc + '</td></tr>'
      );
    }).join('');

    overlay.innerHTML =
      '<div class="cine-shortcuts-modal__panel">' +
      '<div class="cine-shortcuts-modal__head">' +
      '<h2>Keyboard shortcuts</h2>' +
      '<button type="button" class="cine-shortcuts-modal__close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<p class="cine-shortcuts-modal__hint">Press <kbd>g</kbd> then a letter within 1.2s to jump pages.</p>' +
      '<table class="cine-shortcuts-modal__table"><tbody>' + rows + '</tbody></table>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.classList.add('cine-shortcuts-open');

    overlay.querySelector('.cine-shortcuts-modal__close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    var panel = overlay.querySelector('.cine-shortcuts-modal__panel');
    if (panel) panel.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function go(path) {
    window.location.href = path;
  }

  document.addEventListener('keydown', function (e) {
    if (document.getElementById('cine-shortcuts-modal')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
      return;
    }

    if (isTypingTarget(e.target)) return;

    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      showHelp();
      return;
    }

    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      gPending = true;
      clearTimeout(gTimer);
      gTimer = setTimeout(function () { gPending = false; }, 1200);
      return;
    }

    if (gPending && NAV_ROUTES[e.key]) {
      e.preventDefault();
      gPending = false;
      clearTimeout(gTimer);
      go(NAV_ROUTES[e.key].path);
    }
  });

  window.CineShortcuts = { showHelp: showHelp, close: closeModal };
})();
