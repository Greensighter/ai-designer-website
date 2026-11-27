/* POST /api/qe: anonymous quiz analytics events from assets/js/start.js.
 * One row per event in the D1 database bound as QUIZ_DB. No names or emails are stored:
 * only the screen, the answer chosen on choice screens, the ad tags and the device type. */

const TYPES = new Set(['view', 'engaged', 'watch', 'start', 'complete', 'back', 'lead', 'booked']);
const STEPS = new Set(['home', 'name', 'role', 'nofit', 'pain', 'stats', 'cost', 'future', 'setup', 'devs', 'nodevs', 'email', 'book', 'video']);
const ANSWERED = new Set(['role', 'pain', 'setup', 'devs']); // the only steps whose value is kept
const clip = (v, n = 120) => (v == null ? null : String(v).slice(0, n) || null);

export async function onRequestPost({ request, env }) {
  if (!env.QUIZ_DB) return new Response(null, { status: 204 });
  let b;
  try {
    const raw = await request.text();
    if (raw.length > 2000) throw 0;
    b = JSON.parse(raw);
  } catch (e) { return new Response('bad request', { status: 400 }); }

  const type = String(b.type || ''), step = String(b.step || '');
  const sid = String(b.sid || '');
  if (!TYPES.has(type) || !STEPS.has(step) || !/^[a-z0-9]{8,32}$/.test(sid)) return new Response('bad request', { status: 400 });

  const ua = request.headers.get('user-agent') || '';
  if (/bot|crawl|spider|preview|headless/i.test(ua)) return new Response(null, { status: 204 });
  const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';

  await env.QUIZ_DB.prepare(
    'INSERT INTO events (ts, sid, type, step, value, utm_source, utm_campaign, utm_content, device, country) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(
    Date.now(), sid, type, step,
    type === 'complete' && ANSWERED.has(step) ? clip(b.value, 300) : null,
    clip(b.utm_source), clip(b.utm_campaign), clip(b.utm_content),
    device, request.cf?.country || null
  ).run();

  return new Response(null, { status: 204 });
}
