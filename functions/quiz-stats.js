/* GET /quiz-stats: password-protected quiz analytics (HTTP Basic auth, any username).
 * The password is checked against env.STATS_PASS_SHA256 (hex SHA-256), so the password itself
 * never lives in the repo. Data comes from the QUIZ_DB D1 database filled by /api/qe. */

const STEPS = [
  ['home', 'Landing page'], ['name', 'Name'], ['role', 'Role'], ['pain', 'Pains'], ['stats', 'Stat screen'], ['cost', 'Cost comparison'],
  ['future', 'How it works'], ['setup', 'Ticket tool'], ['devs', 'Developers'], ['email', 'Work email'], ['book', 'Calendar'], ['video', 'Video page (after booking)']
];
const PAIN_LABELS = {
  hiring: 'Still hiring a designer', cost: 'Two salaries for design and code', bottleneck: 'Designer is the bottleneck',
  rebuild: 'Handoff takes days', mismatch: 'Ships don’t match Figma'
};
const RANGES = { '1': 'Today', '7': '7 days', '30': '30 days', '90': '90 days', all: 'All time' };
const TZ = 'Asia/Yerevan';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const fmtPct = (a, b) => (b ? pct(a, b) + '%' : '–');

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const deny = () => new Response('Password required', {
  status: 401,
  headers: { 'WWW-Authenticate': 'Basic realm="Vlad AI quiz stats", charset="UTF-8"', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }
});

export async function onRequestGet({ request, env }) {
  if (!env.STATS_PASS_SHA256) return new Response('Stats password is not configured.', { status: 503 });
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Basic ')) return deny();
  let pass = '';
  try { pass = atob(h.slice(6)).split(':').slice(1).join(':'); } catch (e) { return deny(); }
  if (!safeEqual(await sha256(pass), env.STATS_PASS_SHA256.toLowerCase())) return deny();
  if (!env.QUIZ_DB) return new Response('Analytics database is not connected.', { status: 503 });

  const url = new URL(request.url);
  const r = RANGES[url.searchParams.get('r')] ? url.searchParams.get('r') : '30';
  const adFilter = url.searchParams.get('ad') || '';
  const since = r === 'all' ? 0 : r === '1' ? startOfToday() : Date.now() - Number(r) * 864e5;

  const [sess, ans] = await Promise.all([
    env.QUIZ_DB.prepare(
      `SELECT sid, MIN(ts) t0, MAX(ts) t1, MAX(utm_source) us, MAX(utm_campaign) uca, MAX(utm_content) uc, MAX(device) dev, MAX(country) ctry,
              GROUP_CONCAT(DISTINCT type || ':' || step) evs
       FROM events WHERE ts >= ? GROUP BY sid ORDER BY t0 DESC LIMIT 20000`).bind(since).all(),
    env.QUIZ_DB.prepare(
      `SELECT sid, step, value FROM events WHERE ts >= ? AND type = 'complete' AND step IN ('role','pain','setup','devs') ORDER BY ts`).bind(since).all()
  ]);

  const adsAll = new Map();
  let sessions = (sess.results || []).map((x) => {
    const ev = new Set(String(x.evs || '').split(','));
    const ad = x.uc || (x.us ? `(${x.us}, no ad tag)` : '(direct / no tag)');
    adsAll.set(ad, (adsAll.get(ad) || 0) + 1);
    return { ...x, ev, ad };
  });
  if (adFilter) sessions = sessions.filter((s) => s.ad === adFilter);
  const bySid = new Map(sessions.map((s) => [s.sid, s]));

  // last answer per session and step
  for (const a of ans.results || []) {
    const s = bySid.get(a.sid); if (!s) continue;
    (s.ans ||= {})[a.step] = a.value || '';
  }

  const has = (s, t, st) => s.ev.has(`${t}:${st}`);
  const visits = sessions.filter((s) => has(s, 'view', 'name'));
  const landing = sessions.filter((s) => has(s, 'view', 'home'));
  const engaged = sessions.filter((s) => has(s, 'engaged', 'home'));
  const watched = sessions.filter((s) => has(s, 'watch', 'home'));
  const started = sessions.filter((s) => has(s, 'start', 'name'));
  const N = started.length;
  const leads = sessions.filter((s) => has(s, 'lead', 'email'));
  const booked = sessions.filter((s) => has(s, 'booked', 'book'));
  const screened = sessions.filter((s) => has(s, 'view', 'nofit'));
  const noDevs = sessions.filter((s) => has(s, 'view', 'nodevs'));

  // funnel
  const funnel = STEPS.map(([id, label]) => {
    const reached = sessions.filter((s) => has(s, 'view', id)).length;
    const done = id === 'book' ? booked.length
      : id === 'home' ? sessions.filter((s) => has(s, 'view', 'home') && has(s, 'view', 'name')).length
      : sessions.filter((s) => has(s, 'complete', id)).length;
    return { id, label, reached, done };
  });

  // answers
  const tally = (step, split) => {
    const m = new Map(); let total = 0;
    for (const s of sessions) {
      const v = s.ans?.[step]; if (v == null || v === '') continue;
      total++;
      for (const k of split ? v.split(',') : [v]) {
        const e = m.get(k) || { n: 0, leads: 0, booked: 0 };
        e.n++; if (has(s, 'lead', 'email')) e.leads++; if (has(s, 'booked', 'book')) e.booked++;
        m.set(k, e);
      }
    }
    return { total, rows: [...m.entries()].sort((a, b) => b[1].n - a[1].n) };
  };
  const roles = tally('role'), pains = tally('pain', true), tools = tally('setup'), devs = tally('devs');

  // by ad, by device, by day
  const group = (keyFn) => {
    const m = new Map();
    for (const s of sessions) {
      const k = keyFn(s); const e = m.get(k) || { engaged: 0, landing: 0, visits: 0, started: 0, role: 0, screened: 0, leads: 0, booked: 0 };
      if (has(s, 'view', 'home')) e.landing++; if (has(s, 'engaged', 'home')) e.engaged++; if (has(s, 'view', 'name')) e.visits++; if (has(s, 'start', 'name')) e.started++; if (has(s, 'complete', 'role')) e.role++;
      if (has(s, 'view', 'nofit')) e.screened++; if (has(s, 'lead', 'email')) e.leads++; if (has(s, 'booked', 'book')) e.booked++;
      m.set(k, e);
    }
    return m;
  };
  const byAd = [...group((s) => s.ad).entries()].sort((a, b) => b[1].started - a[1].started);
  const byDev = [...group((s) => s.dev || 'unknown').entries()].sort((a, b) => b[1].started - a[1].started);
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const byDay = [...group((s) => dayFmt.format(new Date(s.t0))).entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const html = page({ r, adFilter, visits, landing, engaged, watched, ads: [...adsAll.entries()].sort((a, b) => b[1] - a[1]), N, sessions, leads, booked, screened, funnel, roles, pains, tools, devs, noDevs, byAd, byDev, byDay, has });
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}

function startOfToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return new Date(parts + 'T00:00:00+04:00').getTime();
}

function bar(n, max, us) {
  return `<span class="bar"><i style="width:${max ? Math.max(2, (n / max) * 100) : 0}%"${us ? ' class="us"' : ''}></i></span>`;
}

function page(d) {
  const { N, funnel, has } = d;
  const qs = (o) => '?' + new URLSearchParams({ r: d.r, ...(d.adFilter ? { ad: d.adFilter } : {}), ...o }).toString();
  const fmax = Math.max(1, ...funnel.map((f) => f.reached));
  const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const EXPLAINERS = ['stats', 'cost', 'future']; // hidden in the quiz for now: show them only if they have data
  const funnelRows = funnel.filter((f) => !EXPLAINERS.includes(f.id) || f.reached > 0).map((f, idx) => {
    const lost = f.reached - f.done;
    const note = f.id === 'stats' ? ' <span class="muted">(only if a non-cost pain was picked)</span>' : '';
    return `<tr><td>${idx + 1}. ${esc(f.label)}${note}</td><td class="n">${f.reached}</td><td class="viz">${bar(f.reached, fmax)}</td><td class="n">${f.id === 'name' || f.id === 'home' ? '–' : fmtPct(f.reached, N)}</td><td class="n">${f.done}</td><td class="n ${lost > 0 ? 'neg' : ''}">${f.reached ? lost + ' (' + pct(lost, f.reached) + '%)' : '–'}</td></tr>`;
  }).join('');

  const ansTable = (t, labels = {}) => {
    const max = Math.max(1, ...t.rows.map((x) => x[1].n));
    if (!t.rows.length) return '<p class="muted">No answers yet.</p>';
    return `<table><thead><tr><th>Answer</th><th class="n">People</th><th></th><th class="n">Share</th><th class="n">Leads</th><th class="n">Booked</th></tr></thead><tbody>${t.rows.map(([k, v]) =>
      `<tr><td>${esc(labels[k] || k)}</td><td class="n">${v.n}</td><td class="viz">${bar(v.n, max, k === 'Designer / freelancer')}</td><td class="n">${fmtPct(v.n, t.total)}</td><td class="n">${v.leads}</td><td class="n">${v.booked}</td></tr>`).join('')}</tbody></table>`;
  };

  const grpTable = (rows, first) => `<table><thead><tr><th>${first}</th><th class="n">Landing</th><th class="n">Engaged</th><th class="n">Quiz visits</th><th class="n">Started</th><th class="n">Answered role</th><th class="n">Designers out</th><th class="n">Leads</th><th class="n">Booked</th><th class="n">Start → lead</th></tr></thead><tbody>${rows.map(([k, v]) =>
    `<tr><td>${esc(k)}</td><td class="n">${v.landing}</td><td class="n">${v.engaged}</td><td class="n">${v.visits}</td><td class="n">${v.started}</td><td class="n">${v.role}</td><td class="n">${v.screened}</td><td class="n">${v.leads}</td><td class="n">${v.booked}</td><td class="n">${fmtPct(v.leads, v.started)}</td></tr>`).join('') || '<tr><td colspan="10" class="muted">No data yet.</td></tr>'}</tbody></table>`;

  const furthest = (s) => {
    if (has(s, 'complete', 'video')) return 'Booked, clicked the video';
    if (has(s, 'view', 'video')) return 'Booked, saw the video page';
    if (has(s, 'booked', 'book')) return 'Booked a call';
    if (has(s, 'view', 'nofit')) return 'Screened out (designer)';
    if (has(s, 'view', 'nodevs')) return 'Screened out (no developers)';
    let last = '';
    for (const [id, label] of STEPS) if (has(s, 'view', id)) last = label;
    return last ? 'Left at: ' + last : 'Landed only';
  };
  const recent = d.sessions.slice(0, 30).map((s) => `<tr><td>${esc(timeFmt.format(new Date(s.t0)))}</td><td>${esc(s.ad)}</td><td>${esc(s.ans?.role || '–')}</td><td>${esc(s.ans?.devs || '–')}</td><td>${esc(s.dev || '')}${s.ctry ? ' · ' + esc(s.ctry) : ''}</td><td>${esc(furthest(s))}</td></tr>`).join('');

  const kpi = (label, n, sub) => `<div class="kpi"><div class="kpi__n">${n}</div><div class="kpi__l">${label}</div>${sub ? `<div class="kpi__s">${sub}</div>` : ''}</div>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Quiz stats | Vlad AI</title><link rel="icon" href="/assets/img/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f6f6f4;--card:#fff;--ink:#0d0f0c;--muted:#6b6f68;--line:#e6e6e2;--accent:#6B56F0;--track:#ecebf9;--neg:#c2410c}
*{box-sizing:border-box;min-width:0}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Inter,system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:28px max(4vw,16px) 64px}
header{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;justify-content:space-between;margin-bottom:22px}
h1{font-size:26px;line-height:1.1;margin:0;font-weight:700;letter-spacing:-.01em}h1 small{display:block;font-size:14px;font-weight:500;color:var(--muted);margin-top:6px}
h2{font-size:17px;margin:0 0 4px}.sub{color:var(--muted);font-size:13.5px;margin:0 0 14px}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pill{padding:7px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);text-decoration:none;font-size:13.5px;font-weight:500}
.pill.on{background:var(--ink);color:#fff;border-color:var(--ink)}
select{font:inherit;font-size:13.5px;padding:7px 10px;border-radius:10px;border:1px solid var(--line);background:var(--card);max-width:260px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
.kpi__n{font-size:30px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.kpi__l{font-weight:600;font-size:13.5px}.kpi__s{color:var(--muted);font-size:12.5px;margin-top:2px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 20px 12px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:16px}.grid .card{margin-bottom:0}
.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-size:12.5px;font-weight:600;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:middle}tr:last-child td{border-bottom:0}
.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.neg{color:var(--neg)}.muted{color:var(--muted);font-size:13px}
.viz{width:30%;min-width:90px}.bar{display:block;height:10px;background:var(--track);border-radius:5px;overflow:hidden}.bar i{display:block;height:100%;background:var(--accent);border-radius:5px}.bar i.us{background:#c4c2bb}
footer{color:var(--muted);font-size:12.5px;margin-top:20px}
</style></head><body><div class="wrap">
<header><h1>Quiz analytics<small>Homepage → quiz · ${esc(RANGES[d.r])}${d.adFilter ? ' · ' + esc(d.adFilter) : ''} · times in Yerevan</small></h1>
<form class="filters" method="get">${Object.entries(RANGES).map(([k, v]) => `<a class="pill${k === d.r ? ' on' : ''}" href="${esc(qs({ r: k }))}">${v}</a>`).join('')}
<input type="hidden" name="r" value="${esc(d.r)}"><select name="ad" onchange="this.form.submit()" aria-label="Filter by ad"><option value="">All traffic</option>${d.ads.map(([k, n]) => `<option value="${esc(k)}"${k === d.adFilter ? ' selected' : ''}>${esc(k)} (${n})</option>`).join('')}</select></form></header>

<div class="kpis">
${kpi('Landing page visits', d.landing.length, 'opened the homepage')}
${kpi('Engaged landing visits', d.engaged.length, fmtPct(d.engaged.length, d.landing.length) + ' stayed 10s+ or scrolled')}
${kpi('Played the video', d.watched.length, fmtPct(d.watched.length, d.landing.length) + ' of landing visits')}
${kpi('Quiz page visits', d.visits.length, d.landing.length ? fmtPct(d.visits.length, d.landing.length) + ' of landing visits' : 'opened /quiz')}
${kpi('Started the quiz', N, fmtPct(N, d.visits.length) + ' of visits typed their name')}
${kpi('Answered role', funnel[1].done, fmtPct(funnel[1].done, N) + ' of starts')}
${kpi('Designers screened out', d.screened.length, fmtPct(d.screened.length, funnel[1].done) + ' of role answers')}
${kpi('No developers', d.noDevs.length, 'sent to the polite ending')}
${kpi('Leads (work email)', d.leads.length, fmtPct(d.leads.length, N) + ' of starts')}
${kpi('Booked calls', d.booked.length, fmtPct(d.booked.length, d.leads.length) + ' of leads')}
</div>

<section class="card"><h2>Step by step</h2><p class="sub">Reached = saw the screen. Completed = moved forward from it. Lost = reached but never completed. For the landing page, completed = opened the quiz. For the video page, completed = clicked into the video. For Name, reached = every quiz page visit; “Of starts” counts people who typed their name.</p>
<div class="scroll"><table><thead><tr><th>Step</th><th class="n">Reached</th><th></th><th class="n">Of starts</th><th class="n">Completed</th><th class="n">Lost here</th></tr></thead><tbody>${funnelRows}</tbody></table></div></section>

<div class="grid">
<section class="card"><h2>Role</h2><p class="sub">${d.roles.total} answered. Designers are shown in grey.</p><div class="scroll">${ansTable(d.roles)}</div></section>
<section class="card"><h2>Ticket tool</h2><p class="sub">${d.tools.total} answered.</p><div class="scroll">${ansTable(d.tools)}</div></section>
</div>
<div class="grid" style="margin-top:16px"><section class="card"><h2>Developers on the team</h2><p class="sub">${d.devs.total} answered.</p><div class="scroll">${ansTable(d.devs)}</div></section></div>
<section class="card" style="margin-top:16px"><h2>Pains</h2><p class="sub">${d.pains.total} answered. People can pick several, so shares add up to more than 100%.</p><div class="scroll">${ansTable(d.pains, PAIN_LABELS)}</div></section>

<section class="card"><h2>By ad</h2><p class="sub">Grouped by utm_content, so each Meta ad shows on its own row.</p><div class="scroll">${grpTable(d.byAd, 'Ad')}</div></section>
<div class="grid">
<section class="card"><h2>By device</h2><div class="scroll">${grpTable(d.byDev, 'Device')}</div></section>
<section class="card"><h2>By day</h2><div class="scroll">${grpTable(d.byDay, 'Day')}</div></section>
</div>
<section class="card" style="margin-top:16px"><h2>Latest visits</h2><p class="sub">No names or emails are stored here. Leads with contact details still arrive by email.</p><div class="scroll"><table><thead><tr><th>When</th><th>Ad</th><th>Role</th><th>Developers</th><th>Device</th><th>Result</th></tr></thead><tbody>${recent || '<tr><td colspan="6" class="muted">No visits yet.</td></tr>'}</tbody></table></div></section>
<footer>Tracking started on 24 Nov 2026. Visits before then aren’t included. Bots and the preview copy are not counted.</footer>
</div></body></html>`;
}
