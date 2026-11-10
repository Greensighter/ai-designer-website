/* Greensighter: chat-style demo booking.
 *
 * The onboarding agent asks the same questions as the old form, one at a time.
 * Answers are pinned to the top as pills (click to edit). After the last answer the
 * request is sent right away (no review step) and a link to book the call is shown.
 * On other hosts (local file, preview links) sending is simulated.
 */
/* Cloudflare Pages: leads go to the /api/lead function (functions/api/lead.js),
 * which emails the team and keeps a copy in KV. Elsewhere (local file, previews)
 * sending is simulated. */
var BOOKING_URL = 'https://cal.com/david-karapetyan/30min';
var WAITLIST_ENDPOINT = /(^|\.)greensighter\.com$|\.pages\.dev$/.test(location.hostname) ? '/api/lead' : '';

(function () {
  var page = document.body;
  var log = document.getElementById('ct-log');
  var composer = document.getElementById('ct-composer');
  var input = document.getElementById('ct-input');
  var progress = document.getElementById('ct-progress');
  var pillsEl = document.getElementById('ct-pills');
  var barEl = document.getElementById('ct-bar');
  var countEl = document.getElementById('ct-count');
  if (!log || !composer) return;

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  /* ---------- validation (same rules as the old form) ---------- */
  var FREE = ('gmail.com googlemail.com yahoo.com ymail.com rocketmail.com outlook.com hotmail.com live.com msn.com '
    + 'icloud.com me.com mac.com aol.com proton.me protonmail.com pm.me gmx.com gmx.net gmx.de web.de mail.com '
    + 'yandex.com yandex.ru ya.ru mail.ru inbox.ru list.ru bk.ru rambler.ru zoho.com zohomail.com tutanota.com tuta.io '
    + 'fastmail.com hey.com qq.com 163.com 126.com sina.com naver.com daum.net hanmail.net seznam.cz wp.pl o2.pl '
    + 'libero.it virgilio.it orange.fr laposte.net free.fr wanadoo.fr t-online.de freenet.de btinternet.com '
    + 'sky.com comcast.net verizon.net att.net sbcglobal.net cox.net shaw.ca rogers.com bigpond.com '
    + 'rediffmail.com mailinator.com guerrillamail.com 10minutemail.com temp-mail.org yopmail.com').split(' ');
  var SOCIAL = 'linkedin.com facebook.com instagram.com x.com twitter.com t.me github.com behance.net dribbble.com medium.com notion.site'.split(' ');
  function base(h) { return h.replace(/^www\./, ''); }
  function inList(h, list) { h = base(h); return list.some(function (d) { return h === d || h.slice(-(d.length + 1)) === '.' + d; }); }
  function isFree(h) { return inList(h, FREE) || /^(yahoo|hotmail|outlook|live|gmx|aol)\.[a-z.]{2,6}$/.test(base(h)); }
  function hostOf(v) {
    v = v.trim(); if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try { return new URL(v).hostname.toLowerCase(); } catch (e) { return ''; }
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- state + questions ---------- */
  var S = {};
  var TOOLS = ['Jira', 'Linear', 'Asana', 'ClickUp', 'Monday.com', 'Trello', 'Notion', 'GitHub Projects', 'Azure DevOps', 'Other'];

  var STEPS = [
    { key: 'email', label: 'Email', type: 'email', placeholder: 'you@company.com', icon: 'mail',
      validate: function (v) {
        v = v.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'That doesn’t look like an email address. Mind checking it?';
        if (isFree(v.split('@')[1])) return 'I’ll need your work email, not a personal one (Gmail, Yahoo…).';
        return true;
      },
      store: function (v) { S.email = v.trim().toLowerCase(); },
      show: function () { return S.email; } },
    { key: 'name', label: 'Name', type: 'text', autocomplete: 'name', icon: 'user',
      ask: function () { return 'Welcome! I’ll get your demo set up in under a minute. What’s your name?'; },
      placeholder: 'Your name',
      validate: function (v) {
        var p = v.trim().split(/\s+/).filter(Boolean);
        if (!p.length) return 'What should I call you?';
        return true;
      },
      store: function (v) { var p = v.trim().split(/\s+/); S.first_name = cap(p.shift()); S.last_name = p.map(cap).join(' '); },
      show: function () { return (S.first_name + ' ' + S.last_name).trim(); } },
    { key: 'website', label: 'Website', type: 'url', autocomplete: 'url', icon: 'globe',
      ask: function () { return 'Nice to meet you, ' + S.first_name + '. What’s your company website?'; },
      placeholder: 'yourcompany.com',
      options: function () { var d = S.email ? S.email.split('@')[1] : ''; return d ? [d] : []; },
      validate: function (v) {
        var h = hostOf(v);
        if (!h || h.indexOf('.') < 1) return 'Hmm, that doesn’t look like a website. Try something like yourcompany.com.';
        if (isFree(h) || inList(h, SOCIAL)) return 'I’ll need your company’s own website, not a social or email profile.';
        return true;
      },
      store: function (v) { S.website = 'https://' + base(hostOf(v)); },
      show: function () { return base(hostOf(S.website)); } },
    { key: 'team_size', label: 'Team', type: 'choice', icon: 'team',
      ask: function () { return 'How big is your team?'; },
      options: function () { return ['1–10', '11–50', '51–200', '200+']; },
      store: function (v) { S.team_size = v; },
      show: function () { return S.team_size + ' people'; } },
    { key: 'pm_tool', label: 'Tickets', type: 'choice', icon: 'ticket',
      ask: function () { return 'Where does your team track tickets?'; },
      options: function () { return TOOLS; },
      store: function (v) { S.pm_tool = v; },
      ack: function () { return S.pm_tool === 'Other' ? 'No problem, we’ll work with your setup.' : S.pm_tool + ' works great. Your AI designer picks up tickets right there.'; },
      show: function () { return S.pm_tool; } },
    { key: 'designers', label: 'Designers', type: 'choice', icon: 'pen',
      ask: function () { return 'Last one: how many designers do you have today?'; },
      options: function () { return ['None yet', '1', '2–5', '6–10', '11+']; },
      store: function (v) { S.designers = v; },
      show: function () { return S.designers === 'None yet' ? 'No designers yet' : S.designers + (S.designers === '1' ? ' designer' : ' designers'); } }
  ];
  function step(key) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].key === key) return STEPS[i]; }

  /* ---------- tiny icon set ---------- */
  var IC = {
    mail: '<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
    team: '<circle cx="9" cy="9" r="3.5"/><circle cx="17" cy="10" r="2.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M15 15.5c2.5 0 4.5 1.3 5.5 4"/>',
    ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/>',
    pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'
  };
  function svg(name, s) { return '<svg width="' + (s || 13) + '" height="' + (s || 13) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[name] + '</svg>'; }

  /* ---------- rendering ---------- */
  var lastAgent = null;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function scroll() { requestAnimationFrame(function () { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reduce ? 'auto' : 'smooth' }); }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }

  function agentMsg(cont) {
    var m = el('div', 'ct-msg ct-msg--agent' + (cont ? ' is-cont' : ''));
    m.appendChild(el('span', 'ct-who', 'Greensighter agent'));
    log.appendChild(m); lastAgent = m; return m;
  }
  function say(html, opts) {
    opts = opts || {};
    var cont = lastAgent && log.lastElementChild === lastAgent;
    var m = cont ? lastAgent : agentMsg(false);
    var t = el('div', 'ct-typing', '<i></i><i></i><i></i>');
    m.appendChild(t); scroll();
    return wait(opts.fast ? 350 : 650).then(function () {
      t.remove();
      var p = el('div', 'ct-text' + (opts.err ? ' ct-err' : ''), html);
      if (opts.err) m.classList.add('ct-err');
      m.appendChild(p); scroll();
      return m;
    });
  }
  function userSay(text) {
    lastAgent = null;
    var m = el('div', 'ct-msg ct-msg--user');
    m.appendChild(el('div', 'ct-bubble', esc(text)));
    m.appendChild(el('span', 'ct-meta', 'Sent · just now'));
    log.appendChild(m); scroll();
  }

  /* ---------- progress header ---------- */
  function renderProgress(done) {
    progress.hidden = false;
    var answered = STEPS.filter(function (s) { return s.show && answeredKey(s.key); });
    countEl.textContent = done ? 'All answered' : answered.length + ' of ' + STEPS.length + ' answered';
    barEl.innerHTML = STEPS.map(function (s) { return '<i class="' + (answeredKey(s.key) ? 'on' : '') + '"></i>'; }).join('');
    barEl.classList.toggle('done', !!done);
    pillsEl.innerHTML = '';
    answered.forEach(function (s) {
      var b = el('button', 'ct-pill', svg(s.icon) + '<span>' + esc(s.show()) + '</span>' + svg('edit', 11));
      b.type = 'button';
      b.setAttribute('aria-label', 'Edit ' + s.label.toLowerCase() + ': ' + s.show());
      b.disabled = locked;
      b.addEventListener('click', function () { jump(s.key); });
      pillsEl.appendChild(b);
    });
  }
  function answeredKey(k) { return k === 'name' ? !!S.first_name : !!S[k]; }

  /* ---------- input plumbing ---------- */
  var waiter = null, locked = false;
  function setComposer(st) {
    input.value = '';
    input.type = st && (st.type === 'email' || st.type === 'url') ? (st.type === 'url' ? 'url' : 'email') : 'text';
    input.setAttribute('autocomplete', (st && st.autocomplete) || (st && st.type === 'email' ? 'email' : 'off'));
    input.setAttribute('inputmode', st && st.type === 'url' ? 'url' : st && st.type === 'email' ? 'email' : 'text');
    input.placeholder = st ? (st.type === 'choice' ? 'Pick an option above, or type it' : st.placeholder || 'Type your answer') : 'Type “looks good” or pick an option';
    if (!(touch && st && st.type === 'choice')) input.focus({ preventScroll: true });
  }
  function next() { return new Promise(function (res) { waiter = res; }); }
  function give(v) { if (!waiter) return; var w = waiter; waiter = null; w(v); }
  function jump(key) { if (locked) return; give({ jump: key }); }

  composer.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (!v || !waiter) return;
    input.value = '';
    give({ text: v });
  });

  function chips(m, options, onPick, cls) {
    var wrap = el('div', 'ct-chips');
    options.forEach(function (o) {
      var label = typeof o === 'string' ? o : o.label;
      var b = el('button', 'ct-chip' + (o.primary ? ' ct-chip--primary' : '') + (cls ? ' ' + cls : ''), esc(label));
      b.type = 'button';
      b.addEventListener('click', function () { if (wrap.classList.contains('is-done')) return; onPick(typeof o === 'string' ? o : o.value, b); });
      wrap.appendChild(b);
    });
    m.appendChild(wrap); scroll();
    return wrap;
  }
  function settle(wrap, value) {
    if (!wrap) return;
    wrap.classList.add('is-done');
    Array.prototype.forEach.call(wrap.children, function (b) { b.disabled = true; if (b.textContent === value) b.classList.add('is-picked'); });
  }
  function match(v, options) {
    var t = v.toLowerCase().replace(/\s+/g, '').replace(/[-–]/g, '-');
    for (var i = 0; i < options.length; i++) {
      var o = options[i].toLowerCase().replace(/\s+/g, '').replace(/[-–]/g, '-');
      if (o === t || (t.length > 2 && o.indexOf(t) === 0)) return options[i];
    }
    var n = parseInt(v, 10);
    if (!isNaN(n) && options[0] === '1–10') return n <= 10 ? '1–10' : n <= 50 ? '11–50' : n <= 200 ? '51–200' : '200+';
    if (!isNaN(n) && options[0] === 'None yet') return n === 0 ? 'None yet' : n === 1 ? '1' : n <= 5 ? '2–5' : n <= 10 ? '6–10' : '11+';
    if (/^(no|none|zero|0)\b/i.test(v) && options[0] === 'None yet') return 'None yet';
    return null;
  }

  /* ---------- asking one question ---------- */
  function runStep(st, opts) {
    opts = opts || {};
    var prompt = opts.edit ? 'Sure, let’s update that. ' + (st.askEdit || (st.ask ? st.ask() : 'What’s your work email?')) : st.ask();
    return say(prompt).then(function (m) {
      var options = st.options ? st.options() : [];
      var wrap = null;
      var answered = false;
      if (options.length) {
        wrap = chips(m, options, function (v) { if (!answered) give({ text: v, chip: true }); });
      }
      setComposer(st);
      function loop() {
        return next().then(function (r) {
          if (r.jump) { settle(wrap, null); return r; }
          var v = r.text;
          if (st.type === 'choice') {
            var hit = match(v, options);
            userSay(v);
            if (!hit) return say('Pick one of the options above and I’ll keep going.', { err: true, fast: true }).then(loop);
            v = hit;
          } else {
            userSay(v);
            var ok = st.validate ? st.validate(v) : true;
            if (ok !== true) return say(ok, { err: true, fast: true }).then(loop);
          }
          answered = true;
          settle(wrap, v);
          st.store(v);
          renderProgress();
          return (st.ack ? say(st.ack(), { fast: true }) : Promise.resolve()).then(function () { return {}; });
        });
      }
      return loop();
    });
  }

  /* ---------- flow ---------- */
  function start(emailText) {
    page.classList.add('is-chatting');
    var st = STEPS[0];
    userSay(emailText);
    var ok = st.validate(emailText);
    if (ok !== true) {
      return say(ok, { err: true, fast: true }).then(function () {
        setComposer(st);
        return next().then(function (r) { return r.jump ? start(S.email || '') : start(r.text); });
      });
    }
    st.store(emailText);
    renderProgress();
    if (window.clarity) clarity('event', 'demo_chat_start');
    return run(1);
  }

  function run(from) {
    var i = from;
    function go() {
      if (i >= STEPS.length) return submit();
      return runStep(STEPS[i]).then(function (r) {
        if (r && r.jump) return edit(r.jump).then(go);
        i++;
        return go();
      });
    }
    return go();
  }

  function edit(key) {
    var st = step(key);
    return runStep(st, { edit: true }).then(function (r) { if (r && r.jump) return edit(r.jump); });
  }

  function review() {
    renderProgress(true);
    return say('That’s everything I need. Here’s what you told me:').then(function (m) {
      var card = el('dl', 'ct-card');
      STEPS.forEach(function (s) {
        var row = el('div', 'ct-row');
        row.appendChild(el('dt', '', s.label));
        row.appendChild(el('dd', '', esc(s.show())));
        var b = el('button', 'ct-edit', svg('edit', 15));
        b.type = 'button'; b.setAttribute('aria-label', 'Edit ' + s.label.toLowerCase());
        b.addEventListener('click', function () { jump(s.key); });
        row.appendChild(b);
        card.appendChild(row);
      });
      m.appendChild(card);
      m.appendChild(el('div', 'ct-text', 'Does this look right?'));
      var wrap = chips(m, [{ label: 'Looks good ✓', value: 'yes', primary: true }, { label: 'Make an edit', value: 'edit' }], function (v) { give({ text: v === 'yes' ? 'Looks good ✓' : 'Make an edit', choice: v }); });
      setComposer(null);
      function loop() {
        return next().then(function (r) {
          if (r.jump) { settle(wrap, null); card.classList.add('is-locked'); return edit(r.jump).then(review); }
          var v = r.choice || (/^(y|yes|yep|ok|okay|looks good|good|correct|confirm|sure|perfect|send)\b/i.test(r.text) ? 'yes' : /edit|change|fix|wrong|no\b/i.test(r.text) ? 'edit' : null);
          userSay(r.text);
          if (!v) return say('Reply “looks good” to confirm, or tap the pencil next to anything you’d like to change.', { err: true, fast: true }).then(loop);
          settle(wrap, v === 'yes' ? 'Looks good ✓' : 'Make an edit');
          card.classList.add('is-locked');
          if (v === 'edit') return pickEdit();
          return submit();
        });
      }
      return loop();
    });
  }

  function pickEdit() {
    return say('Sure. What would you like to change?', { fast: true }).then(function (m) {
      var wrap = chips(m, STEPS.map(function (s) { return { label: s.label, value: s.key }; }), function (k) { give({ jump: k, label: step(k).label }); });
      setComposer(null);
      input.placeholder = 'Pick what to change';
      return next().then(function (r) {
        var key = r.jump;
        if (!key && r.text) { var hit = STEPS.filter(function (s) { return s.label.toLowerCase() === r.text.toLowerCase(); })[0]; key = hit && hit.key; }
        if (!key) { userSay(r.text || ''); return pickEdit(); }
        settle(wrap, step(key).label);
        userSay(step(key).label);
        return edit(key).then(review);
      });
    });
  }

  /* ---------- sending + final moment ---------- */
  /* ---------- sending ---------- */
  var completed = false, partialSent = '';
  function payload(status) {
    var d = { status: status, first_name: S.first_name || '', last_name: S.last_name || '', email: S.email || '', website: S.website || '', team_size: S.team_size || '', pm_tool: S.pm_tool || '', designers: S.designers || '' };
    d.answered = STEPS.filter(function (s) { return answeredKey(s.key); }).map(function (s) { return s.label; }).join(', ');
    return d;
  }
  function onNetlify() { return /\.netlify\.app$/.test(location.hostname); }
  function formBody(data, subject) {
    var body = new URLSearchParams({ 'form-name': 'waitlist', 'subject': subject, 'bot-field': '' });
    Object.keys(data).forEach(function (k) { body.append(k, data[k]); });
    return body;
  }

  function send() {
    var data = payload('complete');
    if (WAITLIST_ENDPOINT) {
      return fetch(WAITLIST_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(Object.assign({ source: 'landing-demo-chat' }, data)) })
        .then(function (r) { if (!r.ok) throw new Error('Request failed'); });
    }
    if (onNetlify()) {
      return fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formBody(data, 'New demo request: AI Product Designer').toString() })
        .then(function (r) { if (!r.ok) throw new Error('Request failed'); });
    }
    return new Promise(function (r) { setTimeout(r, 400); });
  }

  /* Left halfway: send whatever was answered so far (email at minimum).
     Sent when the page is hidden or closed; re-sent only if new answers were added since. */
  function sendPartial() {
    if (completed || !S.email) return;
    var data = payload('partial');
    var snap = JSON.stringify(data);
    if (snap === partialSent) return;
    partialSent = snap;
    var subject = 'Unfinished demo request (' + data.answered + ')';
    if (WAITLIST_ENDPOINT) {
      var json = JSON.stringify(Object.assign({ source: 'landing-demo-chat' }, data));
      if (!(navigator.sendBeacon && navigator.sendBeacon(WAITLIST_ENDPOINT, new Blob([json], { type: 'application/json' }))))
        fetch(WAITLIST_ENDPOINT, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: json }).catch(function () {});
    } else if (onNetlify()) {
      var body = formBody(data, subject);
      if (!(navigator.sendBeacon && navigator.sendBeacon('/', body)))
        fetch('/', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }).catch(function () {});
    } else if (window.console) {
      console.info('[demo chat] partial (not sent outside Netlify):', data);
    }
    if (window.clarity) clarity('event', 'demo_chat_partial');
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') sendPartial(); });
  window.addEventListener('pagehide', sendPartial);

  function submit() {
    locked = true;
    renderProgress(true);
    composer.setAttribute('aria-disabled', 'true');
    input.placeholder = 'Setting things up…';
    lastAgent = null;
    var m = agentMsg(false);
    var row = el('div', 'ct-saving', '<b aria-hidden="true"></b>Saving your details…');
    m.appendChild(row); scroll();
    return Promise.all([send(), wait(900)]).then(function () { m.remove(); lastAgent = null; return done(); }, function () { m.remove(); lastAgent = null; return fail(); });
  }

  function done() {
    completed = true;
    if (window.lintrk) { window.lintrk('track', { conversion_id: 31735682 }); }
    if (window.gsTrack) { gsTrack('Lead', { email: S.email, first_name: S.first_name, last_name: S.last_name }, { content_name: 'AI Designer demo' }); }
    if (window.clarity) { clarity('event', 'waitlist_signup'); clarity('set', 'pm_tool', S.pm_tool); clarity('set', 'team_size', S.team_size); }
    var name = [S.first_name, S.last_name].filter(Boolean).join(' ');
    return say('You’re all set, ' + esc(S.first_name) + '. Pick a time for your 30-min demo call:', { fast: true }).then(function (m) {
      var box = el('div', 'ct-cal');
      box.id = 'ct-cal';
      box.innerHTML = '<div class="ct-cal__loading"><b aria-hidden="true"></b>Loading calendar…</div>';
      m.appendChild(box); scroll();
      input.placeholder = 'Demo requested ✓';
      embedCal(box, name);
    });
  }

  /* Cal.com inline booking (official embed script: auto-height, prefilled name/email).
     If the script can't load, fall back to a plain link. */
  function embedCal(box, name) {
    var fallback = function () {
      var url = BOOKING_URL + '?' + new URLSearchParams({ name: name, email: S.email || '' }).toString();
      box.innerHTML = '<a class="ct-book" href="' + esc(url) + '" target="_blank" rel="noopener">Book your 30-min call<span aria-hidden="true">→</span></a>';
    };
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; var s = d.createElement('script'); s.src = A; s.onerror = fallback; d.head.appendChild(s); cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
    var link = BOOKING_URL.replace(/^https:\/\/cal\.com\//, '');
    Cal('init', 'demo', { origin: 'https://cal.com' });
    Cal.ns.demo('inline', { elementOrSelector: '#ct-cal', calLink: link, config: { layout: 'month_view', theme: 'light', name: name, email: S.email || '' } });
    Cal.ns.demo('ui', { theme: 'light', hideEventTypeDetails: false, layout: 'month_view' });
    Cal.ns.demo('on', { action: 'linkReady', callback: function () { var l = box.querySelector('.ct-cal__loading'); if (l) l.remove(); var m = box.closest('.ct-msg') || box; window.scrollTo({ top: m.getBoundingClientRect().top + window.scrollY - 190, behavior: reduce ? 'auto' : 'smooth' }); } });
    Cal.ns.demo('on', { action: 'bookingSuccessful', callback: function () {
      if (window.clarity) clarity('event', 'demo_booked');
      if (window.gsTrack) gsTrack('Schedule', { email: S.email }, { content_name: 'AI Designer demo call' });
    } });
  }

  function fail() {
    locked = false;
    composer.removeAttribute('aria-disabled');
    renderProgress(true);
    return say('Something went wrong on our side. Reply “try again” to resend, or email hello@greensighter.com.', { err: true }).then(function () {
      setComposer(null);
      return next().then(function (r) { if (r.jump) return edit(r.jump).then(submit); userSay(r.text); return submit(); });
    });
  }

  /* ---------- kick-off: the first answer comes from the centred email field ---------- */
  setComposer(STEPS[0]);
  waiter = function (r) { if (r.text) start(r.text); };
})();
