/* Meta Pixel + Conversions API with shared event IDs (dedup). Loaded on every page. */
(function () {
  function cookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; }
  function fbc() {
    var c = cookie('_fbc'); if (c) return c;
    var id = new URLSearchParams(location.search).get('fbclid');
    return id ? 'fb.1.' + Date.now() + '.' + id : '';
  }
  function uid() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)); }
  window.gsTrack = function (name, user, custom) {
    var id = uid();
    var std = name === 'PageView' || name === 'Lead';
    if (window.fbq) fbq(std ? 'track' : 'trackCustom', name, custom || {}, { eventID: id });
    var body = Object.assign({ event_name: name, event_id: id, url: location.href, fbp: cookie('_fbp'), fbc: fbc(), custom_data: custom }, user || {});
    try {
      var blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      if (!(navigator.sendBeacon && navigator.sendBeacon('/api/meta-capi', blob))) {
        fetch('/api/meta-capi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
      }
    } catch (e) {}
  };
  // PageView after the pixel has set _fbp
  setTimeout(function () { window.gsTrack('PageView'); }, 400);
})();
