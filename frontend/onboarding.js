/**
 * First-run product tour (3 steps) — dismissible, stored in localStorage
 */
(function () {
  var KEY = 'cinesentiment_onboarded';

  function done() {
    try {
      localStorage.setItem(KEY, '1');
    } catch (e) { /* ignore */ }
    var el = document.getElementById('onboarding-overlay');
    if (el) el.remove();
  }

  function show() {
    if (document.getElementById('onboarding-overlay')) return;
    try {
      if (localStorage.getItem(KEY)) return;
    } catch (e) {
      return;
    }

    var steps = [
      {
        title: 'Paste a movie review',
        body: 'Type or use voice input on the Analyze page. Get a Fresh or Rotten verdict in seconds.',
        cta: 'Try it now',
        href: '/batch.html',
      },
      {
        title: 'Upload hundreds at once',
        body: 'Drop a CSV with a text column — export results for your team or reports.',
        cta: 'Batch analyze',
        href: '/batch.html#batch-heading',
      },
      {
        title: 'Compare two takes',
        body: 'A/B test critic copy, trailers, or social posts side by side.',
        cta: 'Open compare',
        href: '/compare.html',
      },
    ];

    var idx = 0;
    var overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.className = 'onboarding-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'onboarding-title');

    function paint() {
      var s = steps[idx];
      overlay.innerHTML =
        '<div class="onboarding-card">' +
        '<p class="onboarding-card__step">Step ' +
        (idx + 1) +
        ' of ' +
        steps.length +
        '</p>' +
        '<h2 id="onboarding-title">' +
        s.title +
        '</h2>' +
        '<p>' +
        s.body +
        '</p>' +
        '<div class="onboarding-card__actions">' +
        '<button type="button" class="btn btn-soft btn-sm" id="onboarding-skip">Skip tour</button>' +
        (idx < steps.length - 1
          ? '<button type="button" class="btn btn-primary-app btn-sm" id="onboarding-next">Next</button>'
          : '<a class="btn btn-primary-app btn-sm" href="' +
            s.href +
            '" id="onboarding-finish">' +
            s.cta +
            '</a>') +
        '</div></div>';
    }

    paint();
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) done();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target.id === 'onboarding-skip') done();
      if (e.target.id === 'onboarding-next') {
        idx += 1;
        paint();
      }
      if (e.target.id === 'onboarding-finish') done();
    });
  }

  if (document.body && document.body.dataset.page === 'home') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(show, 600);
      });
    } else {
      setTimeout(show, 600);
    }
  }
})();
