// Meta Conversions API relay (Cloudflare Pages Function).
// The browser sends the event here; this adds IP + user agent, hashes personal
// data and forwards it to Meta. The pixel sends the same event_id, so Meta dedups.
// Secrets (Cloudflare Pages → Settings → Variables and secrets):
//   META_CAPI_TOKEN        required
//   META_TEST_EVENT_CODE   optional, only while testing in Events Manager
const PIXEL_ID = '1083937427973647';
const API = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
const ALLOWED = new Set(['PageView', 'Lead', 'Schedule', 'EngagedVisit']);

async function sha(v) {
  const data = new TextEncoder().encode(String(v).trim().toLowerCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request, env }) {
  if (!env.META_CAPI_TOKEN) return new Response('Not configured', { status: 500 });

  let b;
  try { b = await request.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  if (!ALLOWED.has(b.event_name) || !b.event_id) return new Response('Bad event', { status: 400 });

  const user_data = {
    client_ip_address: request.headers.get('cf-connecting-ip') || undefined,
    client_user_agent: request.headers.get('user-agent') || undefined,
    fbp: b.fbp || undefined,
    fbc: b.fbc || undefined,
  };
  if (b.email) user_data.em = [await sha(b.email)];
  if (b.first_name) user_data.fn = [await sha(b.first_name)];
  if (b.last_name) user_data.ln = [await sha(b.last_name)];

  const event = {
    event_name: b.event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: String(b.event_id).slice(0, 64),
    event_source_url: b.url,
    action_source: 'website',
    user_data,
  };
  if (b.custom_data) event.custom_data = b.custom_data;

  const payload = { data: [event] };
  if (env.META_TEST_EVENT_CODE) payload.test_event_code = env.META_TEST_EVENT_CODE;

  const r = await fetch(`${API}?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const out = await r.text();
  return new Response(r.ok ? 'ok' : out, { status: r.ok ? 200 : 502 });
}
