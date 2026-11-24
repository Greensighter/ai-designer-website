/* Greensighter onboarding quiz (/quiz).
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

  var S = { name: '', role: '', pains: [], tool: '', devs: '', email: '' };
  var check = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var first = function () { return (S.name.trim().split(/\s+/)[0] || ''); };
  var nm = function () { return esc(first() || 'there'); };
  var BUYERS = ['Founder / CEO', 'CTO / Engineering lead', 'Product manager', 'Design lead'];
  var ev = function (n) { if (window.clarity) clarity('event', n); };

  /* Anonymous step analytics for /quiz-stats: screen views, completed steps, chosen answers. */
  var SID = (function () { try { var k = sessionStorage.getItem('q_sid'); if (!k) { k = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); sessionStorage.setItem('q_sid', k); } return k; } catch (e) { return Math.random().toString(36).slice(2, 12) + Date.now().toString(36); } })();
  var UTM = (function () { var q = new URLSearchParams(location.search), o = {}; ['utm_source', 'utm_campaign', 'utm_content'].forEach(function (k) { o[k] = q.get(k) || ''; }); try { if (o.utm_source || o.utm_content) sessionStorage.setItem('q_utm', JSON.stringify(o)); else o = JSON.parse(sessionStorage.getItem('q_utm') || 'null') || o; } catch (e) {} return o; })();
  function track(type, step, value) {
    if (!LEAD_ENDPOINT) return;
    var body = JSON.stringify({ sid: SID, type: type, step: step, value: value || '', utm_source: UTM.utm_source, utm_campaign: UTM.utm_campaign, utm_content: UTM.utm_content });
    try { if (navigator.sendBeacon && navigator.sendBeacon('/api/qe', new Blob([body], { type: 'application/json' }))) return; } catch (e) {}
    fetch('/api/qe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
  }
  function answerOf(id) { return id === 'role' ? S.role : id === 'pain' ? S.pains.join(',') : id === 'setup' ? S.tool : id === 'devs' ? S.devs : ''; }

  var PAINS = [
    { id: 'hiring', t: 'We’re still hiring a designer. It’s been months.' },
    { id: 'cost', t: 'Design and code cost us two salaries.' },
    { id: 'bottleneck', t: 'Our designer is the bottleneck. Everything waits on design.' },
    { id: 'rebuild', t: 'Handoff from design to code takes days of back-and-forth.' },
    { id: 'mismatch', t: 'What ships never matches the Figma file.' }
  ];
  var STATS = {
    hiring: { n: '3+ months', t: 'from job post to a designer shipping real work. I start in 2–3 days.' },
    bottleneck: { n: '92%', t: 'of designers say the handoff between design and code needs fixing. 91% of developers agree.', s: 'Figma, State of the Designer 2025' },
    rebuild: { n: '51%', t: 'of teams say rework and wasted specialist time is the cost of designer and developer friction.', s: 'Progress Telerik, Designer Developer Collaboration' },
    mismatch: { n: '21%', t: 'of designers say their designs get implemented pixel perfect.', s: 'CollabSoft designer survey, 2025' },
    cost: { n: '$15–25k', t: 'a month for an in-house designer and frontend developer, before tools and time off.' }
  };
  function dots(n, label) {
    var h = ''; for (var d = 0; d < 100; d++) h += '<i' + (d < n ? ' class="on" style="animation-delay:' + (d * 10) + 'ms"' : '') + '></i>';
    return '<div class="q-dots" aria-hidden="true">' + h + '</div><div class="q-dots__legend"><span><i class="on"></i>' + n + ' of 100</span></div>';
  }
  function donut(p, label) {
    var c = 2 * Math.PI * 52;
    return '<div class="q-ring"><svg class="q-donut" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--track)" stroke-width="12"/><circle class="q-donut__arc" cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" style="--off:' + (c * (1 - p / 100)).toFixed(1) + ';--full:' + c.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg><div class="q-ring__n">' + label + '</div></div>';
  }
  function bars(label, rows) {
    return '<div class="q-bars" aria-hidden="true">' + rows.map(function (r) { return '<div class="q-bars__r' + (r.us ? ' is-us' : '') + '"><span class="q-bars__t"><i style="--w:' + r.w + '%"></i></span><span class="q-bars__k">' + r.k + '</span><span class="q-bars__v">' + r.v + '</span></div>'; }).join('') + '</div>';
  }
  var VIS = {
    bottleneck: function (n) { return dots(92, n); },
    mismatch: function (n) { return dots(21, n); },
    rebuild: function (n) { return donut(51, n); },
    hiring: function (n) { return bars(n, [{ k: 'Hiring a designer', w: 100, v: '3+ months' }, { k: 'Vlad AI', w: 3, v: '2–3 days', us: 1 }]); },
    cost: function (n) { return bars(n, [{ k: 'In-house designer + developer', w: 100, v: '$15–25k/mo' }, { k: 'Vlad AI', w: 10, v: '$1,990/mo', us: 1 }]); }
  };


  /* ---------- screens ---------- */
  var SCREENS = [
    { id: 'name', cta: 'Nice to meet you', valid: function () { return S.name.trim().length > 0; },
      html: function () { return '<h1 class="q-h">Hi, I’m Vlad, your <em>AI Design Engineer.</em></h1><p class="q-p">What should I call you?</p><div class="q-gap"></div><label class="sr-only" for="q-name">First name</label><input class="q-input" id="q-name" type="text" autocomplete="given-name" placeholder="Your first name" maxlength="40" value="' + esc(S.name) + '">'; },
      bind: function () { var i = document.getElementById('q-name'); i.addEventListener('input', function () { S.name = i.value.replace(/\s+/g, ' ').trimStart(); refresh(); }); i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && cur().valid()) go(1); }); setTimeout(function () { i.focus(); }, 50); } },

    { id: 'role', valid: function () { return !!S.role; },
      html: function () { return '<h1 class="q-h">Nice to meet you, ' + nm() + '. What do you do?</h1><div class="q-gap"></div>' + single('role', ['Founder / CEO', 'CTO / Engineering lead', 'Product manager', 'Design lead', 'Designer / freelancer', 'Other']); } },

    { id: 'nofit', foot: false, skip: function () { return S.role !== 'Designer / freelancer'; },
      html: function () { return '<h1 class="q-h">I’m built for <em>product teams.</em></h1><p class="q-p">Founders, CTOs and product managers assign me tickets, and I deliver reviewed design and code as a pull request. If a team you work with could use that, send them my way.</p>'; } },

    { id: 'pain', valid: function () { return S.pains.length > 0; },
      html: function () { return '<h1 class="q-h">What sounds like your team, ' + nm() + '?</h1><p class="q-hint">Pick any that apply.</p><div class="q-gap"></div>' + multi(); } },

    { id: 'stats', skip: function () { return !S.pains.some(function (k) { return k !== 'cost'; }); },
      html: function () {
        var k = S.pains.filter(function (p) { return p !== 'cost'; })[0] || 'bottleneck', x = STATS[k];
        var src = x.s ? '<p class="q-stat__s">Source: ' + x.s + '</p>' : '';
        if (k === 'rebuild') return '<h1 class="q-h">You’re not alone.</h1><div class="q-info q-info--ring">' + VIS[k](x.n) + '<p class="q-info__t">' + x.t + '</p>' + src + '</div>';
        return '<h1 class="q-h">You’re not alone.</h1><div class="q-info"><div class="q-big">' + x.n + '</div><p class="q-info__t">' + x.t + '</p>' + VIS[k](x.n) + src + '</div>';
      } },

    { id: 'cost',
      html: function () { return '<p class="q-eyebrow">It’s the AI era, ' + nm() + '</p><h1 class="q-h">Still paying two full-time salaries for design and code?</h1>'
        + '<div class="q-vbars" aria-hidden="true"><div class="q-vbar"><span class="q-vbar__col"><span class="q-vbar__v">$15–25k</span><i style="--h:100%"></i></span><span class="q-vbar__k">In-house designer + developer</span><span class="q-vbar__s">Minus time off</span></div>'
        + '<div class="q-vbar is-us"><span class="q-vbar__col"><span class="q-vbar__v">$1,990</span><i style="--h:10%"></i></span><span class="q-vbar__k">Vlad AI</span><span class="q-vbar__s">Never off</span></div></div>'
        + '<p class="sr-only">In-house designer and developer cost $15,000 to $25,000 a month. Vlad AI costs $1,990 a month.</p>'; } },

    { id: 'future',
      html: function () { return '<h1 class="q-h">Here’s how it works, ' + nm() + '.</h1><div class="q-gap"></div><div class="q-tl">'
        + '<div class="q-tl__i"><div class="q-tl__d">Assign</div><p class="q-tl__t">You assign a ticket, like to any teammate.</p><span class="q-tl__ic">' + ICON.jira + 'Ticket assigned</span></div>'
        + '<div class="q-tl__i"><div class="q-tl__d">Design</div><p class="q-tl__t">I design it in your Figma with your design system. A senior designer reviews every screen.</p><span class="q-tl__ic">' + ICON.figma + 'Designed in Figma</span></div>'
        + '<div class="q-tl__i"><div class="q-tl__d">Code</div><p class="q-tl__t">You approve, and I open a pull request for your developers to review and merge.</p><span class="q-tl__ic">' + ICON.github + 'Pull request opened</span></div>'
        + '</div>'; } },

    { id: 'setup', valid: function () { return !!S.tool; },
      html: function () { return '<h1 class="q-h">Let’s see if I’m a fit, ' + nm() + '.</h1><p class="q-p">Where does your team track tickets?</p><div class="q-gap"></div>' + single('tool', ['Jira', 'Linear', 'Asana', 'ClickUp', 'Monday', 'Trello', 'Notion', 'GitHub', 'Azure DevOps', 'Other'], true, true); } },

    { id: 'devs', valid: function () { return !!S.devs; },
      html: function () { return '<h1 class="q-h">Do you have developers on your team, ' + nm() + '?</h1><p class="q-p">I open pull requests for your developers to review and merge.</p><div class="q-gap"></div>' + single('devs', ['1–4 developers', '5–10 developers', '11–50 developers', 'No developers yet']); } },

    { id: 'nodevs', foot: false, skip: function () { return S.devs !== 'No developers yet'; },
      html: function () { return '<h1 class="q-h">I work best with <em>teams that have developers.</em></h1><p class="q-p">I deliver design and code as a pull request for your developers to review and merge. Once you have a developer on the team, come back and I’ll start with 3 free tickets.</p>'; } },

    { id: 'email', cta: 'Book my call', valid: function () { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(S.email.trim()); },
      html: function () { return '<h1 class="q-h">Great fit, ' + nm() + '. Let’s start with <em>3 free tickets.</em></h1><div class="q-gap"></div><label class="sr-only" for="q-email">Work email</label><input class="q-input" id="q-email" type="email" inputmode="email" autocomplete="email" placeholder="you@company.com" value="' + esc(S.email) + '"><p class="q-hint q-hint--tight">Please use your work email. We’ll only use it for your booking. No spam, ever.</p><p class="q-err" id="q-err" role="alert"></p>'; },
      bind: function () { var i = document.getElementById('q-email'); i.addEventListener('input', function () { S.email = i.value.trim(); document.getElementById('q-err').textContent = ''; refresh(); }); i.addEventListener('keydown', function (e) { if (e.key === 'Enter' && cur().valid()) go(1); }); setTimeout(function () { i.focus(); }, 50); },
      leave: function () { return submitLead(); } },

    { id: 'book', foot: false, full: true,
      html: function () { return '<h1 class="sr-only">Pick a time for your call</h1><div class="q-cal" id="q-cal"><div class="q-cal__loading"><b aria-hidden="true"></b>Loading calendar…</div></div>'; },
      bind: function () { embedCal(); } }
  ];

  function single(key, opts, chips, logos) {
    return '<div class="q-opts' + (chips ? ' q-opts--chips' : '') + (logos ? ' q-opts--logos' : '') + '" role="group">' + opts.map(function (o) { var ic = logos ? '<span class="q-opt__logo">' + (ICON['t-' + o.toLowerCase().replace(/\s+/g, '')] || '') + '</span>' : ''; return '<button type="button" class="q-opt" data-k="' + key + '" data-v="' + esc(o) + '" aria-pressed="' + (S[key] === o) + '"><span class="q-opt__box">' + check + '</span>' + ic + esc(o) + '</button>'; }).join('') + '</div>';
  }
  function multi() {
    return '<div class="q-opts q-opts--multi" role="group">' + PAINS.map(function (p) { return '<button type="button" class="q-opt" data-m="' + p.id + '" aria-pressed="' + (S.pains.indexOf(p.id) > -1) + '"><span class="q-opt__box">' + check + '</span>' + p.t + '</button>'; }).join('') + '</div>';
  }
  function step(n, b, t) { return '<div class="q-step"><span class="q-step__n">' + n + '</span><div><b>' + b + '</b><span>' + t + '</span></div></div>'; }

  /* ---------- engine ---------- */
  var i = 0, busy = false;
  var ENDS = ['nofit', 'nodevs']; /* polite endings, not counted as steps */
  var isEnd = function (id) { return ENDS.indexOf(id) > -1; };
  var cur = function () { return SCREENS[i]; };
  function render() {
    var sc = cur();
    main.innerHTML = '<section class="q-screen" aria-live="polite">' + sc.html() + '</section>';
    main.querySelectorAll('[data-k]').forEach(function (b) {
      b.addEventListener('click', function () {
        S[b.dataset.k] = b.dataset.v;
        main.querySelectorAll('[data-k="' + b.dataset.k + '"]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        refresh();
        if (sc.id === 'role' || sc.id === 'devs') setTimeout(function () { go(1); }, 250);
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
    document.body.classList.toggle('is-full', !!sc.full);
    back.hidden = i === 0;
    nextLabel.textContent = 'Continue';
    var total = SCREENS.filter(function (x) { return !isEnd(x.id); }).length, pos = SCREENS.slice(0, i + 1).filter(function (x) { return !isEnd(x.id); }).length;
    count.innerHTML = isEnd(sc.id) ? '' : '<b>' + pos + '</b>/' + total;
    bar.style.width = (isEnd(sc.id) ? 100 : pos / total * 100) + '%';
    refresh();
    window.scrollTo(0, 0);
    ev('quiz_' + sc.id);
    track('view', sc.id);
  }
  function refresh() { var v = cur().valid; next.disabled = busy || (v ? !v() : false); }
  function go(d) {
    if (busy) return;
    if (d > 0 && cur().valid && !cur().valid()) return;
    var leave = d > 0 && cur().leave ? cur().leave() : null;
    var from = cur().id;
    var move = function () { if (d > 0) track('complete', from, answerOf(from)); else track('back', from); var n = i + d; while (n > 0 && n < SCREENS.length - 1 && SCREENS[n].skip && SCREENS[n].skip()) n += d; i = Math.max(0, Math.min(SCREENS.length - 1, n)); render(); };
    if (leave && leave.then) {
      busy = true; refresh(); nextLabel.textContent = 'Saving…';
      leave.then(function () { busy = false; move(); }, function (msg) { busy = false; nextLabel.textContent = 'Continue'; refresh(); var e = document.getElementById('q-err'); if (e) e.textContent = msg || 'Something went wrong. Try again.'; });
    } else move();
  }
  next.addEventListener('click', function () { go(1); });
  back.addEventListener('click', function () { go(-1); });

  /* ---------- lead ---------- */
  var FREE = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|mail|yandex|ya|inbox|zoho|qq|163|126)\./i;
  var leadSent = false;
  function payload() {
    return { source: 'start-quiz', status: 'complete', first_name: first(), last_name: S.name.trim().split(/\s+/).slice(1).join(' '), email: S.email.trim().toLowerCase(), role: S.role, pains: S.pains.join(', '), pm_tool: S.tool, developers: S.devs, answered: 'Quiz complete' };
  }
  function submitLead() {
    var email = S.email.trim().toLowerCase();
    if (FREE.test(email)) return Promise.reject('Please use your work email, not a personal one.');
    if (leadSent) return Promise.resolve();
    var done = function () {
      leadSent = true;
      if (window.lintrk) window.lintrk('track', { conversion_id: 31735682 });
      /* Meta learns from this event, so only buyer roles count as a Lead. */
      if (window.gsTrack && BUYERS.indexOf(S.role) > -1) gsTrack('Lead', { email: email, first_name: first(), last_name: S.name.trim().split(/\s+/).slice(1).join(' ') }, { content_name: 'AI Design Engineer quiz' });
      ev('quiz_lead');
      track('lead', 'email');
    };
    if (!LEAD_ENDPOINT) { done(); return Promise.resolve(); }
    return fetch(LEAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok && j.error === 'email required') throw 'That email doesn’t look right.'; done(); }); })
      .catch(function (e) { if (typeof e === 'string') throw e; done(); }); /* network hiccup: still let them book */
  }

  /* ---------- Cal.com ---------- */
  function embedCal() {
    var box = document.getElementById('q-cal');
    var fallback = function () {
      var u = BOOKING_URL + '?' + new URLSearchParams({ name: S.name.trim(), email: S.email.trim() });
      if (!LEAD_ENDPOINT) { box.innerHTML = '<div class="q-cal__loading" style="flex-direction:column;text-align:center;padding:24px">The Cal.com calendar is embedded here on the live site.<br>Previews block outside scripts, so it can’t load in this preview.</div>'; return; }
      box.outerHTML = '<a class="q-book-link" href="' + esc(u) + '" target="_blank" rel="noopener">Open the calendar</a>';
    };
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; var s = d.createElement('script'); s.src = A; s.onerror = fallback; d.head.appendChild(s); cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
    if (Cal.ns && Cal.ns.quiz) { Cal.ns.quiz('inline', { elementOrSelector: '#q-cal', calLink: BOOKING_URL.replace('https://cal.com/', ''), config: { layout: 'column_view', theme: 'light', name: S.name.trim(), email: S.email.trim() } }); return; }
    Cal('init', 'quiz', { origin: 'https://cal.com' });
    Cal.ns.quiz('inline', { elementOrSelector: '#q-cal', calLink: BOOKING_URL.replace('https://cal.com/', ''), config: { layout: 'column_view', theme: 'light', name: S.name.trim(), email: S.email.trim() } });
    Cal.ns.quiz('ui', { theme: 'light', hideEventTypeDetails: true, layout: 'column_view', cssVarsPerTheme: { light: { 'cal-brand': '#6B56F0' } } });
    Cal.ns.quiz('on', { action: 'linkReady', callback: function () { var l = box.querySelector('.q-cal__loading'); if (l) l.remove(); } });
    setTimeout(function () { if (box.querySelector('.q-cal__loading b')) fallback(); }, 8000);
    var booked = false;
    var onBooked = function () {
      if (booked) return; booked = true;
      ev('quiz_booked');
      track('booked', 'book');
      if (window.gsTrack) gsTrack('Schedule', { email: S.email.trim().toLowerCase(), first_name: first(), last_name: S.name.trim().split(/\s+/).slice(1).join(' ') }, { content_name: 'AI Design Engineer demo call' });
      setTimeout(function () { location.href = '/booked?name=' + encodeURIComponent(first()); }, 1200);
    };
    Cal.ns.quiz('on', { action: 'bookingSuccessfulV2', callback: onBooked });
    Cal.ns.quiz('on', { action: 'bookingSuccessful', callback: onBooked });
  }

  render();
})();
