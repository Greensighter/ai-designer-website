/* Greensighter — waitlist form
 *
 * On Netlify, sign-ups are saved with Netlify Forms (form name "waitlist"):
 * see them under Site → Forms, and turn on email notifications there.
 * To send to another service instead, set WAITLIST_ENDPOINT to a URL that
 * accepts a JSON POST (Formspree, your own API…).
 * On other hosts (local file, preview links) the form only shows the success state.
 */
var WAITLIST_ENDPOINT = '';

(function () {
  var form = document.getElementById('wl-form');
  if (!form) return;
  var success = document.getElementById('wl-success');
  var status = form.querySelector('.wl-form__status');
  var submit = form.querySelector('.wl-submit');

  // Personal mailbox providers: not accepted for the work email or the company website
  var FREE = ('gmail.com googlemail.com yahoo.com ymail.com rocketmail.com outlook.com hotmail.com live.com msn.com '
    + 'icloud.com me.com mac.com aol.com proton.me protonmail.com pm.me gmx.com gmx.net gmx.de web.de mail.com '
    + 'yandex.com yandex.ru ya.ru mail.ru inbox.ru list.ru bk.ru rambler.ru zoho.com zohomail.com tutanota.com tuta.io '
    + 'fastmail.com hey.com qq.com 163.com 126.com sina.com naver.com daum.net hanmail.net seznam.cz wp.pl o2.pl '
    + 'libero.it virgilio.it orange.fr laposte.net free.fr wanadoo.fr t-online.de freenet.de btinternet.com '
    + 'sky.com comcast.net verizon.net att.net sbcglobal.net cox.net shaw.ca rogers.com bigpond.com '
    + 'rediffmail.com mailinator.com guerrillamail.com 10minutemail.com temp-mail.org yopmail.com').split(' ');
  var SOCIAL = 'linkedin.com facebook.com instagram.com x.com twitter.com t.me github.com behance.net dribbble.com medium.com notion.site'.split(' ');
  function base(h) { h = h.replace(/^www\./, ''); return h; }
  function inList(h, list) { h = base(h); return list.some(function (d) { return h === d || h.slice(-(d.length + 1)) === '.' + d; }); }
  function isFree(h) { return inList(h, FREE) || /^(yahoo|hotmail|outlook|live|gmx|aol)\.[a-z.]{2,6}$/.test(base(h)); }
  function isSocial(h) { return inList(h, SOCIAL); }

  var rules = {
    first_name: function (v) { return v.trim().length > 0; },
    last_name: function (v) { return v.trim().length > 0; },
    email: function (v) {
      v = v.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return false;
      return isFree(v.split('@')[1]) ? 'Please use your work email, not a personal one (Gmail, Yahoo…).' : true;
    },
    website: function (v) {
      v = v.trim();
      if (!v) return false;
      if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
      var h;
      try { h = new URL(v).hostname.toLowerCase(); } catch (e) { return false; }
      if (h.indexOf('.') < 1) return false;
      return isFree(h) || isSocial(h) ? 'Please enter your company’s own website.' : true;
    },
    team_size: function (v) { return !!v; },
    pm_tool: function (v) { return !!v; },
    designers: function (v) { return !!v; }
  };

  function check(input) {
    var res = rules[input.name](input.value), ok = res === true;
    var field = input.closest('.field');
    var err = field.querySelector('.field__err');
    if (err) {                           // a rule can return its own message; otherwise show the default one
      if (!err.dataset.msg) err.dataset.msg = err.textContent;
      err.textContent = typeof res === 'string' ? res : err.dataset.msg;
    }
    field.classList.toggle('is-invalid', !ok);
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (err) {
      err.hidden = ok;
      if (!ok) input.setAttribute('aria-describedby', err.id); else input.removeAttribute('aria-describedby');
    }
    return ok;
  }

  Array.prototype.forEach.call(form.elements, function (el) {
    if (!rules[el.name]) return;
    el.addEventListener('blur', function () { if (el.value) check(el); });
    el.addEventListener('input', function () { if (el.closest('.field').classList.contains('is-invalid')) check(el); });
    el.addEventListener('change', function () { if (el.tagName === 'SELECT') check(el); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.hidden = true;
    var inputs = Array.prototype.filter.call(form.elements, function (el) { return rules[el.name]; });
    var firstBad = null;
    inputs.forEach(function (el) { if (!check(el) && !firstBad) firstBad = el; });
    if (firstBad) { firstBad.focus(); return; }

    var f = form.elements;
    var site = f.namedItem('website').value.trim();
    if (!/^https?:\/\//i.test(site)) site = 'https://' + site;
    var data = {
      first_name: f.namedItem('first_name').value.trim(),
      last_name: f.namedItem('last_name').value.trim(),
      email: f.namedItem('email').value.trim(),
      website: site,
      team_size: f.namedItem('team_size').value,
      pm_tool: f.namedItem('pm_tool').value,
      designers: f.namedItem('designers').value,
      source: 'landing-waitlist'
    };

    submit.disabled = true;
    submit.textContent = 'Joining…';

    var host = location.hostname;
    var onNetlify = /(^|\.)greensighter\.com$/.test(host) || /\.netlify\.app$/.test(host);
    var send;
    if (WAITLIST_ENDPOINT) {
      send = fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) { if (!r.ok) throw new Error('Request failed'); });
    } else if (onNetlify) {
      var body = new URLSearchParams({ 'form-name': 'waitlist', 'subject': f.namedItem('subject').value, 'bot-field': f.namedItem('bot-field').value });
      Object.keys(data).forEach(function (k) { if (k !== 'source') body.append(k, data[k]); });
      send = fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
        .then(function (r) { if (!r.ok) throw new Error('Request failed'); });
    } else {
      send = new Promise(function (res) { setTimeout(res, 500); });
    }

    send.then(function () {
      document.getElementById('wl-success-email').textContent = data.email;
      if (window.lintrk) { window.lintrk('track', { conversion_id: 31735682 }); }
      if (window.gsTrack) { gsTrack('Lead', { email: data.email, first_name: data.first_name, last_name: data.last_name }, { content_name: 'AI Designer waitlist' }); }
      if (window.clarity) { clarity('event', 'waitlist_signup'); clarity('set', 'pm_tool', data.pm_tool); clarity('set', 'team_size', data.team_size); }
      form.hidden = true;
      success.hidden = false;
      success.focus();
    }).catch(function () {
      status.textContent = 'Something went wrong. Please try again in a moment.';
      status.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Join Waitlist';
    });
  });
})();
