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

  var rules = {
    first_name: function (v) { return v.trim().length > 0; },
    last_name: function (v) { return v.trim().length > 0; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    website: function (v) {
      v = v.trim();
      if (!v) return false;
      if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
      try { var u = new URL(v); return u.hostname.indexOf('.') > 0; } catch (e) { return false; }
    },
    team_size: function (v) { return !!v; },
    pm_tool: function (v) { return !!v; },
    designers: function (v) { return !!v; }
  };

  function check(input) {
    var ok = rules[input.name](input.value);
    var field = input.closest('.field');
    var err = field.querySelector('.field__err');
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
