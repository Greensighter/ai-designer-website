/* Greensighter — landing page scripts */

(function () {
  var rot = document.querySelector('.rot');
  if (!rot) return;
  var items = Array.prototype.slice.call(rot.querySelectorAll('.rot__item'));
  var i = 0;
  function fit() { rot.style.width = items[i].offsetWidth + 'px'; }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  window.addEventListener('resize', fit);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  setInterval(function () {
    var cur = items[i];
    i = (i + 1) % items.length;
    var next = items[i];
    next.classList.remove('is-leaving');
    cur.classList.remove('is-active');
    cur.classList.add('is-leaving');
    next.classList.add('is-active');
    fit();
    setTimeout(function () { cur.classList.remove('is-leaving'); }, 560);
  }, 2200);
})();

(function () {
  var cta = document.getElementById('hero-cta');
  if (!cta) return;
  var slot = cta.parentNode;
  var fin = document.getElementById('waitlist');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RANGE = 750, MIN = 0.86, GAP = 20, cur = 0;
  var hov = false, hs = 1;
  cta.addEventListener('mouseenter', function () { hov = true; });
  cta.addEventListener('mouseleave', function () { hov = false; });
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function frame() {
    var r = slot.getBoundingClientRect();
    var h = cta.offsetHeight;
    var natural = r.top + scrollY; // resting spot at the top of the page, so the move is a straight line at constant speed
    var target = innerHeight - GAP - h;
    var goal = Math.min(1, Math.max(0, scrollY / RANGE));
    cur = goal; // linear: position follows scroll 1:1
    var p = cur;
    if (reduce) p = goal > 0 ? 1 : 0;
    if (p === 0) {
      if (cta.classList.contains('is-fixed')) {
        // Drop back into place instantly: no hover transition from translateX(-50%)
        cta.style.transition = 'none';
        cta.classList.remove('is-fixed');
        cta.style.top = ''; cta.style.transform = '';
        void cta.offsetWidth;
        cta.style.transition = '';
        hs = 1;
      }
    } else {
      var e = p; // linear timing
      cta.classList.add('is-fixed');
      cta.style.top = (natural + (target - natural) * e) + 'px';
      hs += ((hov ? 0.96 : 1) - hs) * 0.2;
      cta.style.transform = 'translateX(-50%) scale(' + ((1 - (1 - MIN) * e) * hs) + ')';
    }
    if (fin) {
      var f = fin.getBoundingClientRect();
      cta.classList.toggle('is-hidden', f.top < innerHeight - 80);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

(function () {
  document.querySelectorAll('.faq-q button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var open = !item.classList.contains('is-open');
      document.querySelectorAll('.faq-item.is-open').forEach(function (o) {
        if (o === item) return;
        o.classList.remove('is-open');
        o.querySelector('.faq-q button').setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
})();

(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Smooth scroll (Lenis) */
  function startLenis() {
    if (reduce || !window.Lenis) return;
    var lenis = new Lenis({ duration: 1.2, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -20, duration: 2.2, easing: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } });
      });
    });
  }
  if (document.readyState === 'complete') startLenis(); else window.addEventListener('load', startLenis);

  if (reduce) { document.documentElement.classList.remove('js-reveal'); return; }

  /* Split headings into words that rise from a mask */
  function split(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n, i = 0;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var w = document.createElement('span'); w.className = 'w';
        var inner = document.createElement('span'); inner.textContent = part;
        inner.style.setProperty('--w-d', (i++ * 0.045) + 's');
        w.appendChild(inner); frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
    el.classList.add('split');
  }
  document.querySelectorAll('.h1__new, .h2, .final__title').forEach(split);

  /* Fade-up groups with stagger */
  var groups = [
    ['.badge, .h1__old', 0.08],
    ['.sub__line', 0.08],
    ['.panel, .pv', 0],
    ['.card', 0.1],
    ['.how-card', 0.08],
    ['.compare__sub, .how__mark, .how__sub', 0],
    ['.ctable thead th', 0.06],
    ['.ctable tbody tr', 0.07],
    ['.faq__label, .faq-item', 0.05],
    ['.faq-figure', 0],
    ['.final__btn', 0.15]
  ];
  groups.forEach(function (g) {
    var els = document.querySelectorAll(g[0]);
    els.forEach(function (el, k) {
      el.classList.add('rv');
      if (el.classList.contains('panel') || el.classList.contains('pv') || el.classList.contains('faq-figure')) el.classList.add('rv--img');
      el.style.setProperty('--rv-d', Math.min(k * g[1], 0.6) + 's');
    });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  document.querySelectorAll('.rv, .split').forEach(function (el) { io.observe(el); });

  /* Safety: never leave content hidden */
  setTimeout(function () {
    document.querySelectorAll('.rv, .split').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in');
    });
  }, 2500);
})();

(function () {
  var box = document.getElementById('draw');
  if (!box) return;
  var cv = box.querySelector('canvas'), ctx = cv.getContext('2d');
  var strokes = [], cur = null, dpr = 1, color = box.querySelector('.pal__c.is-on').dataset.color;
  var MAXW = 26, MINW = 10, N = 30;

  // Paintbrush cursor, bristles dipped in the current colour
  function brush(c) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g transform="rotate(42 4 30)" stroke="#161616" stroke-width="0.9" stroke-linejoin="round">' +
      '<path d="M2 15.5L2.6 3Q4 1 5.4 3L6 15.5Z" fill="#9A6634"/>' +
      '<rect x="1.7" y="15.5" width="4.6" height="5.5" rx="0.6" fill="#D2D2CC"/>' +
      '<path d="M4 30C1.6 27 1.4 24 1.8 21H6.2C6.6 24 6.4 27 4 30Z" fill="' + c + '"/></g></svg>';
    box.style.setProperty('--pen', 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 4 30, crosshair');
  }

  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function tone(c, f, w) { // f: shade factor, w: mix toward warm white (impasto highlight)
    return 'rgb(' + c.map(function (v, i) { var x = Math.min(255, v * f); return Math.round(x + ([248, 243, 232][i] - x) * w); }).join(',') + ')';
  }
  function newStroke(hex) {
    var c = rgb(hex), br = [];
    for (var i = 0; i < N; i++) {
      var hi = Math.random() < 0.1, edge = Math.abs((i / (N - 1)) * 2 - 1);
      br.push({
        o: (i / (N - 1)) * 2 - 1 + (Math.random() - 0.5) * 0.08,
        w: 1.1 + Math.random() * 1.9,
        col: tone(c, 0.66 + Math.random() * 0.6, hi ? 0.3 + Math.random() * 0.25 : 0),
        dry: Math.random() * 0.3 + edge * 0.3, st: Math.random() * 10 + edge * 8,
        f: 1 / (18 + Math.random() * 40), ph: Math.random() * 6.28
      });
    }
    return { base: tone(c, 1, 0), dark: tone(c, 0.8, 0), br: br, pts: [] };
  }

  // Draw one segment of a stroke: body + bristles; paint runs dry with distance
  function seg(s, q, p) {
    var dx = p.x - q.x, dy = p.y - q.y, len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    var nx = -dy / len, ny = dx / len;
    s.dist += len;
    var load = Math.exp(-s.dist / 520);
    var w0 = q.w, w1 = p.w;
    ctx.lineCap = 'round';
    s.br.forEach(function (b) {
      var o = b.o + Math.sin(s.dist * b.f + b.ph) * 0.05;
      var ex = p.x + nx * o * w1 / 2, ey = p.y + ny * o * w1 / 2;
      if (load > b.dry && b.last && s.dist > b.st) {
        ctx.strokeStyle = b.col; ctx.lineWidth = b.w * (0.6 + 0.4 * load);
        ctx.beginPath(); ctx.moveTo(b.last[0], b.last[1]); ctx.lineTo(ex, ey); ctx.stroke();
      }
      b.last = [ex, ey];
    });
  }
  function dab(s, p) {
    ctx.fillStyle = s.base; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w * 0.45, p.w * 0.38, -0.6, 0, Math.PI * 2); ctx.fill();
    s.br.forEach(function (b, i) {
      if (i % 3) return;
      ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(p.x + b.o * p.w * 0.35, p.y + (Math.random() - 0.5) * p.w * 0.5, b.w * 0.7, 0, Math.PI * 2); ctx.fill();
    });
  }
  function start(s) { s.dist = 0; s.br.forEach(function (b) { b.last = null; }); }
  function render(s) {
    start(s);
    if (s.pts.length === 1) { dab(s, s.pts[0]); return; }
    var prev = s.pts[0];
    s.br.forEach(function (b) { b.last = [prev.x + b.o * prev.w / 2, prev.y]; });
    for (var i = 1; i < s.pts.length; i++) { seg(s, prev, s.pts[i]); prev = s.pts[i]; }
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = box.clientWidth * dpr; cv.height = box.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    strokes.forEach(render);
  }
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp }; }

  cv.addEventListener('pointerdown', function (e) {
    cv.setPointerCapture(e.pointerId);
    cur = newStroke(color); start(cur);
    var p = pos(e); p.w = MAXW * 0.85; cur.pts.push(p); cur.lastW = p.w;
    cur.br.forEach(function (b) { b.last = [p.x + b.o * p.w / 2, p.y]; });
  });
  cv.addEventListener('pointermove', function (e) {
    if (!cur) return;
    var q = cur.pts[cur.pts.length - 1], p = pos(e);
    var d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < 2) return;
    var v = d / Math.max(1, p.t - q.t);            // px per ms
    var target = Math.max(MINW, Math.min(MAXW, MAXW - v * 6));
    p.w = cur.lastW + (target - cur.lastW) * 0.25; cur.lastW = p.w;
    cur.pts.push(p); seg(cur, q, p);
  });
  function end() { if (cur) { if (cur.pts.length === 1) dab(cur, cur.pts[0]); strokes.push(cur); cur = null; } }
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  box.querySelectorAll('.pal__c').forEach(function (b) {
    b.addEventListener('click', function () {
      box.querySelectorAll('.pal__c').forEach(function (x) { x.classList.remove('is-on'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true');
      color = b.dataset.color; brush(color);
    });
  });
  box.querySelector('.draw__clear').addEventListener('click', function () { strokes = []; cur = null; size(); });
  brush(color);
  window.addEventListener('resize', size); size();
})();

/* Count-up for big numbers */
(function () {
  var els = document.querySelectorAll('[data-count]');
  if (!els.length || !('IntersectionObserver' in window)) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var el = e.target, to = +el.dataset.count, suf = el.dataset.suffix || '';
      if (reduce) { el.textContent = fmt(to) + suf; return; }
      var t0 = performance.now(), dur = 1800;
      (function tick(t) {
        var k = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt(to * ease) + (k === 1 ? suf : '');
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.5 });
  els.forEach(function (el) { io.observe(el); });
})();

/* Improve loop: arc travels to the next step, step lights up */
(function () {
  var cyc = document.querySelector('.cycle');
  if (!cyc) return;
  var arc = cyc.querySelector('.cycle__arc'), pills = cyc.querySelectorAll('.cycle__pill');
  var C = 879.6, i = 0, Q = C / 4, task = 1, num = cyc.querySelector('.cycle__n');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function go() {
    arc.style.transition = 'none';
    arc.style.transform = 'rotate(' + (-90 + i * 90 + 7) + 'deg)';
    arc.style.strokeDashoffset = C;
    arc.getBoundingClientRect();
    arc.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.45,0,.2,1)';
    arc.style.strokeDashoffset = C - (Q - 14);
    setTimeout(function () {
      i = (i + 1) % 4;
      pills.forEach(function (p, k) { p.classList.toggle('is-on', k === i); });
      if (i === 0) { task = task >= 50 ? 1 : task + 7; num.textContent = task; }
    }, 1600);
  }
  if (reduce) { num.textContent = 50; arc.style.transform = 'rotate(-83deg)'; arc.style.strokeDashoffset = C - (Q - 14); return; }
  var timer = null;
  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && !timer) { go(); timer = setInterval(go, 2600); }
      else if (!e.isIntersecting && timer) { clearInterval(timer); timer = null; }
    });
  }, { threshold: 0.3 }).observe(cyc);
})();

/* Blur-up: reveal each image once it has loaded */
(function () {
  document.querySelectorAll('img.lazy').forEach(function (img) {
    function done() { img.classList.add('is-loaded'); }
    if (img.complete && img.naturalWidth) done();
    else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
  });
})();

/* Benefits: Greensighter vs generic AI — both phones switch together.
   Runs continuously while the block is on screen. */
(function () {
  var vs = document.querySelector('.panel.vs');
  if (!vs) return;
  var cols = vs.querySelectorAll('.vs__phone'), dots = document.querySelectorAll('.vs__dots button'), bar = document.querySelector('.vs__dots');
  var n = dots.length, i = 0, MS = 4500, timer = null, visible = false, paused = false;
  var startedAt = 0, remaining = MS;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  bar.style.setProperty('--vs-ms', MS + 'ms');
  function show(k) {
    i = (k + n) % n;
    cols.forEach(function (c) { c.querySelectorAll('.vs__shot').forEach(function (s, j) { s.classList.toggle('is-on', j === i); }); });
    dots.forEach(function (d, j) {
      d.classList.remove('is-on'); void d.offsetWidth;
      d.classList.toggle('is-on', j === i); d.classList.toggle('is-done', j < i);
      d.setAttribute('aria-selected', j === i ? 'true' : 'false');
    });
    remaining = MS;
  }
  function run() {                       // count down what's left of the current step
    clearTimeout(timer);
    if (reduce || !visible || paused) return;
    startedAt = Date.now();
    timer = setTimeout(function () { show(i + 1); run(); }, remaining);
  }
  function pause() {
    if (paused) return;
    paused = true; bar.classList.add('is-paused');
    clearTimeout(timer);
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
  }
  function resume() { paused = false; bar.classList.remove('is-paused'); run(); }
  dots.forEach(function (d, j) { d.addEventListener('click', function () { show(j); run(); }); });
  new IntersectionObserver(function (es) {
    var was = visible; visible = es[0].isIntersecting;
    if (visible && !was) { show(i); run(); }
    else if (!visible) clearTimeout(timer);
  }, { threshold: 0.35 }).observe(vs);
})();

/* LinkedIn conversion: Join Waitlist button clicks (sign-ups are tracked in waitlist.js) */
document.querySelectorAll('a[href*="waitlist.html"]').forEach(function (a) {
  a.addEventListener('click', function () {
    if (window.lintrk) { window.lintrk('track', { conversion_id: 31735690 }); }
  });
});
