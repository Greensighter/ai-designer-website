/* Greensighter onboarding quiz (/start).
 * One question per screen. Lead fires when the email is sent; Schedule fires once
 * when the Cal.com booking succeeds, then the visitor goes to /booked. */
(function () {
  var BOOKING_URL = 'https://cal.com/david-karapetyan/30min';
  var LEAD_ENDPOINT = /(^|\.)greensighter\.com$|\.pages\.dev$/.test(location.hostname) ? '/api/lead' : '';

  var main = document.getElementById('q-main');
  var next = document.getElementById('q-next');
  var nextLabel = document.getElementById('q-next-label');
  var back = document.getElementById('q-back');
  var foot = document.getElementById('q-foot');
  var bar = document.getElementById('q-bar');
  var count = document.getElementById('q-count');
  var ICON = {};
  document.querySelectorAll('#q-icons [data-ic]').forEach(function (t) { ICON[t.dataset.ic] = t.innerHTML; });

  var S = { name: '', role: '', pains: [], tool: '', tasks: '', email: '' };
  var check = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var nm = function () { return esc(S.name || 'there'); };
  var ev = function (n) { if (window.clarity) clarity('event', n); };

  var PAINS = [
    { id: 'hiring', t: '“We’re still hiring a designer. It’s been months.”' },
    { id: 'bottleneck', t: '“Our designer is the bottleneck. Everything waits on design.”' },
    { id: 'rebuild', t: '“Devs wait for designs, then rebuild them anyway.”' },
    { id: 'mismatch', t: '“What ships never matches the Figma file.”' },
    { id: 'cost', t: '“Design and code cost us two salaries.”' }
  ];
  var STATS = {
    hiring: { n: '2–3 months', t: 'to hire a designer, plus about a month before they ship real work.' },
    bottleneck: { n: '92% / 91%', t: 'of designers and developers say the handoff between design and code needs fixing.', s: 'Figma, State of the Designer 2025' },
    rebuild: { n: '51%', t: 'of teams say rework and wasted specialist time is the cost of designer and developer friction.', s: 'Progress Telerik, Designer Developer Collaboration' },
    mismatch: { n: '21%', t: 'of designers say their designs get implemented pixel perfect.', s: 'CollabSoft designer survey, 2025' },
    cost: { n: '$15–25k', t: 'a month for an in-house designer and frontend developer, before tools and time off.' }
  };

  /* ---------- screens ---------- */
  var SCREENS = [
    { id: 'name', cta: 'Nice to meet you', valid: function () { return S.name.trim().length > 0; },
      html: function () { return '<h1 class="q-h">Hi, I’m your <em>AI Design Engineer.</em></h1><p class="q-p">I design in Figma and ship the code. What’s your name?</p><div class="q-gap"></div><label class="sr-only" for="q-name">First name</label><input class="q-input" id="q-name" type="text" autocomplete="given-name" placeholder="Your first name" maxlength="40" value="' + esc(S.name) + '">'; },
      bind: function () { var i = document.getElementById('q-name'); i.addEventListener('input', function () { S.name = i.value.replace(/\s+/g, ' ').trimStart(); refresh(); }); i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && cur().valid()) go(1); }); setTimeout(function () { i.focus(); }, 50); } },

    { id: 'role', valid: function () { return !!S.role; },
      html: function () { return '<h1 class="q-h">Nice to meet you, ' + nm() + '. What do you do?</h1><div class="q-gap"></div>' + single('role', ['Founder / CEO', 'CTO / Engineering lead', 'Product manager', 'Design lead']); } },

    { id: 'pain', valid: function () { return S.pains.length > 0; },
      html: function () { return '<p class="q-eyebrow">Be honest</p><h1 class="q-h">What sounds like your team, ' + nm() + '?</h1><p class="q-hint">Pick any that apply.</p><div class="q-gap"></div>' + multi(); } },

    { id: 'stats', cta: 'There’s a better way',
      html: function () {
        var ids = S.pains.slice(0, 2); if (!ids.length) ids = ['bottleneck', 'mismatch'];
        if (ids.length === 1) ids.push(ids[0] === 'bottleneck' ? 'mismatch' : 'bottleneck');
        return '<h1 class="q-h">You’re not alone.</h1><div class="q-gap"></div><div class="q-stats">' + ids.map(function (k) { var x = STATS[k]; return '<div class="q-stat"><div class="q-stat__n">' + x.n + '</div><p class="q-stat__t">' + x.t + '</p>' + (x.s ? '<p class="q-stat__s">Source: ' + x.s + '</p>' : '') + '</div>'; }).join('') + '</div><p class="q-p">Every week this costs you features that don’t ship.</p>';
      } },

    { id: 'cost', cta: 'Show me how',
      html: function () { return '<p class="q-eyebrow">It’s the AI era, ' + nm() + '</p><h1 class="q-h">Still paying two full-time salaries for design and code?</h1><div class="q-gap"></div><div class="q-cost"><div class="q-cost__col"><div class="q-cost__k">In-house designer + developer</div><div class="q-cost__v">$15–25k<small style="font-size:14px;color:var(--muted)">/mo</small></div><div class="q-cost__off">Minus vacations, sick days and notice periods</div></div><div class="q-cost__col q-cost__col--us"><div class="q-cost__k">AI Design Engineer</div><div class="q-cost__v">$1,990<small style="font-size:14px">/mo</small></div><div class="q-cost__off">Never off</div></div></div><div class="q-save"><small>What you could save</small><b>$13,000–23,000 a month</b></div>'; } },

    { id: 'future', cta: 'How does it work?',
      html: function () { return '<h1 class="q-h">Imagine next Monday, ' + nm() + '.</h1><div class="q-gap"></div><div class="q-tl">'
        + '<div class="q-tl__i"><div class="q-tl__d">Monday, 9:00</div><p class="q-tl__t">You assign a ticket, like to any teammate.</p><span class="q-tl__ic">' + ICON.jira + 'Ticket assigned</span></div>'
        + '<div class="q-tl__i"><div class="q-tl__d">Tuesday</div><p class="q-tl__t">The screens are in your Figma, built with your design system and reviewed by a senior designer.</p><span class="q-tl__ic">' + ICON.figma + 'Designed in Figma</span></div>'
        + '<div class="q-tl__i"><div class="q-tl__d">Wednesday</div><p class="q-tl__t">You approve, and a pull request is waiting for your developers.</p><span class="q-tl__ic">' + ICON.github + 'Pull request opened</span></div>'
        + '</div><p class="q-p"><b>No hiring. No handoff. No waiting.</b></p>'; } },

    { id: 'how', cta: 'Show me real work',
      html: function () { return '<h1 class="q-h">I work like any teammate</h1><div class="q-gap"></div><div class="q-steps">'
        + step(1, 'Assign', 'A ticket in Jira, Linear, Asana or ClickUp.')
        + step(2, 'Get the design', 'In your Figma in 24–48 hours, with your design system.')
        + step(3, 'Approve and merge', 'I ship the code as a pull request your developers review.')
        + '</div><p class="q-hint">I’m in your Slack for questions, like anyone on your team.</p>'; } },

    { id: 'proof', cta: 'I’m interested',
      html: function () { return '<h1 class="q-h">Same brief, two results</h1><p class="q-p">Your components, your patterns. Empty, loading and error states included.</p><div class="q-gap"></div><div class="q-tabs" role="tablist"><button type="button" class="q-tab q-tab--us" role="tab" aria-selected="true" data-shot="gs">AI Design Engineer</button><button type="button" class="q-tab" role="tab" aria-selected="false" data-shot="ai">Gen AI tools</button></div><div class="q-shot"><img id="q-shot" src="assets/img/vs/gs-2.webp" width="540" height="1169" alt="Finance app screen designed by the AI Design Engineer"></div>'; },
      bind: function () { main.querySelectorAll('.q-tab').forEach(function (b) { b.addEventListener('click', function () { main.querySelectorAll('.q-tab').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); }); var us = b.dataset.shot === 'gs'; var img = document.getElementById('q-shot'); img.src = 'assets/img/vs/' + (us ? 'gs' : 'ai') + '-2.webp'; img.alt = us ? 'Finance app screen designed by the AI Design Engineer' : 'Finance app screen from a generic AI tool'; }); }); var pre = new Image(); pre.src = 'assets/img/vs/ai-2.webp'; } },

    { id: 'setup', valid: function () { return S.tool && S.tasks; },
      html: function () { return '<h1 class="q-h">Let’s see if I’m a fit, ' + nm() + '.</h1><p class="q-label">Where do you track tickets?</p>' + single('tool', ['Jira', 'Linear', 'Asana', 'ClickUp', 'Other'], true) + '<p class="q-label">Design tasks a month</p>' + single('tasks', ['1–10', '11–25', '26–50', '50+'], true); } },

    { id: 'email', cta: 'Book my call', valid: function () { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(S.email.trim()); },
      html: function () { return '<h1 class="q-h">Great fit, ' + nm() + '. Let’s start with <em>3 free tasks.</em></h1><div class="q-gap"></div><label class="sr-only" for="q-email">Work email</label><input class="q-input" id="q-email" type="email" inputmode="email" autocomplete="email" placeholder="you@company.com" value="' + esc(S.email) + '"><p class="q-err" id="q-err" role="alert"></p><p class="q-hint">No credit card required.</p>'; },
      bind: function () { var i = document.getElementById('q-email'); i.addEventListener('input', function () { S.email = i.value.trim(); document.getElementById('q-err').textContent = ''; refresh(); }); i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && cur().valid()) go(1); }); setTimeout(function () { i.focus(); }, 50); },
      leave: function () { return submitLead(); } },

    { id: 'book', foot: false,
      html: function () { return '<h1 class="q-h">Pick a time, ' + nm() + '.</h1><p class="q-p">30 minutes. We’ll look at your product, and I’ll show you real work on a ticket like yours.</p><div class="q-cal" id="q-cal"><div class="q-cal__loading"><b aria-hidden="true"></b>Loading calendar…</div></div><button type="button" class="q-back" id="q-back2" aria-label="Back" style="margin-top:14px">' + ICON.back + '</button>'; },
      bind: function () { document.getElementById('q-back2').addEventListener('click', function () { go(-1); }); embedCal(); } }
  ];

  function single(key, opts, chips) {
    return '<div class="q-opts' + (chips ? ' q-opts--chips' : '') + '" role="group">' + opts.map(function (o) { return '<button type="button" class="q-opt" data-k="' + key + '" data-v="' + esc(o) + '" aria-pressed="' + (S[key] === o) + '"><span class="q-opt__box">' + check + '</span>' + esc(o) + '</button>'; }).join('') + '</div>';
  }
  function multi() {
    return '<div class="q-opts q-opts--multi" role="group">' + PAINS.map(function (p) { return '<button type="button" class="q-opt" data-m="' + p.id + '" aria-pressed="' + (S.pains.indexOf(p.id) > -1) + '"><span class="q-opt__box">' + check + '</span>' + p.t + '</button>'; }).join('') + '</div>';
  }
  function step(n, b, t) { return '<div class="q-step"><span class="q-step__n">' + n + '</span><div><b>' + b + '</b><span>' + t + '</span></div></div>'; }

  /* ---------- engine ---------- */
  var i = 0, busy = false;
  var cur = function () { return SCREENS[i]; };
  function render() {
    var sc = cur();
    main.innerHTML = '<section class="q-screen" aria-live="polite">' + sc.html() + '</section>';
    main.querySelectorAll('[data-k]').forEach(function (b) {
      b.addEventListener('click', function () {
        S[b.dataset.k] = b.dataset.v;
        main.querySelectorAll('[data-k="' + b.dataset.k + '"]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        refresh();
        if (sc.id === 'role') setTimeout(function () { go(1); }, 250);
      });
    });
    main.querySelectorAll('[data-m]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.m, k = S.pains.indexOf(id);
        if (k > -1) S.pains.splice(k, 1); else S.pains.push(id);
        b.setAttribute('aria-pressed', k > -1 ? 'false' : 'true');
        refresh();
      });
    });
    if (sc.bind) sc.bind();
    foot.hidden = sc.foot === false;
    back.hidden = i === 0;
    nextLabel.textContent = sc.cta || 'Continue';
    count.innerHTML = '<b>' + (i + 1) + '</b>/' + SCREENS.length;
    bar.style.width = ((i + 1) / SCREENS.length * 100) + '%';
    refresh();
    window.scrollTo(0, 0);
    ev('quiz_' + sc.id);
  }
  function refresh() { var v = cur().valid; next.disabled = busy || (v ? !v() : false); }
  function go(d) {
    if (busy) return;
    if (d > 0 && cur().valid && !cur().valid()) return;
    var leave = d > 0 && cur().leave ? cur().leave() : null;
    var move = function () { i = Math.max(0, Math.min(SCREENS.length - 1, i + d)); render(); };
    if (leave && leave.then) {
      busy = true; refresh(); nextLabel.textContent = 'Saving…';
      leave.then(function () { busy = false; move(); }, function (msg) { busy = false; nextLabel.textContent = cur().cta || 'Continue'; refresh(); var e = document.getElementById('q-err'); if (e) e.textContent = msg || 'Something went wrong. Try again.'; });
    } else move();
  }
  next.addEventListener('click', function () { go(1); });
  back.addEventListener('click', function () { go(-1); });

  /* ---------- lead ---------- */
  var FREE = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|mail|yandex|ya|inbox|zoho|qq|163|126)\./i;
  var leadSent = false;
  function payload() {
    return { source: 'start-quiz', status: 'complete', first_name: S.name.trim(), email: S.email.trim().toLowerCase(), role: S.role, pains: S.pains.join(', '), pm_tool: S.tool, tasks: S.tasks, answered: 'Quiz complete' };
  }
  function submitLead() {
    var email = S.email.trim().toLowerCase();
    if (FREE.test(email)) return Promise.reject('Please use your work email, not a personal one.');
    if (leadSent) return Promise.resolve();
    var done = function () {
      leadSent = true;
      if (window.lintrk) window.lintrk('track', { conversion_id: 31735682 });
      if (window.gsTrack) gsTrack('Lead', { email: email, first_name: S.name.trim() }, { content_name: 'AI Design Engineer quiz' });
      ev('quiz_lead');
    };
    if (!LEAD_ENDPOINT) { done(); return Promise.resolve(); }
    return fetch(LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok && j.error === 'email required') throw 'That email doesn’t look right.'; done(); }); })
      .catch(function (e) { if (typeof e === 'string') throw e; done(); }); /* network hiccup: still let them book */
  }

  /* ---------- Cal.com ---------- */
  function embedCal() {
    var box = document.getElementById('q-cal');
    var fallback = function () { var u = BOOKING_URL + '?' + new URLSearchParams({ name: S.name.trim(), email: S.email.trim() }); box.outerHTML = '<a class="q-book-link" href="' + esc(u) + '" target="_blank" rel="noopener">Open the calendar</a>'; };
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; var s = d.createElement('script'); s.src = A; s.onerror = fallback; d.head.appendChild(s); cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
    if (Cal.ns && Cal.ns.quiz) { Cal.ns.quiz('inline', { elementOrSelector: '#q-cal', calLink: BOOKING_URL.replace('https://cal.com/', ''), config: { layout: 'column_view', theme: 'light', name: S.name.trim(), email: S.email.trim() } }); return; }
    Cal('init', 'quiz', { origin: 'https://cal.com' });
    Cal.ns.quiz('inline', { elementOrSelector: '#q-cal', calLink: BOOKING_URL.replace('https://cal.com/', ''), config: { layout: 'column_view', theme: 'light', name: S.name.trim(), email: S.email.trim() } });
    Cal.ns.quiz('ui', { theme: 'light', hideEventTypeDetails: true, layout: 'column_view', cssVarsPerTheme: { light: { 'cal-brand': '#6B56F0' } } });
    Cal.ns.quiz('on', { action: 'linkReady', callback: function () { var l = box.querySelector('.q-cal__loading'); if (l) l.remove(); } });
    var booked = false;
    var onBooked = function () {
      if (booked) return; booked = true;
      ev('quiz_booked');
      if (window.gsTrack) gsTrack('Schedule', { email: S.email.trim().toLowerCase(), first_name: S.name.trim() }, { content_name: 'AI Design Engineer demo call' });
      setTimeout(function () { location.href = '/booked?name=' + encodeURIComponent(S.name.trim()); }, 1200);
    };
    Cal.ns.quiz('on', { action: 'bookingSuccessfulV2', callback: onBooked });
    Cal.ns.quiz('on', { action: 'bookingSuccessful', callback: onBooked });
  }

  render();
})();
