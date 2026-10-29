// Meta Conversions API relay. The browser sends the event here; this function
// adds IP + user agent, hashes personal data, and forwards it to Meta.
// Secret: set META_CAPI_TOKEN in Netlify environment variables (never in code).
import { createHash } from 'node:crypto';

const PIXEL_ID = '1083937427973647';
const API = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
const ALLOWED = new Set(['PageView', 'JoinWaitlistClick', 'Lead']);
const sha = v => createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const token = Netlify.env.get('META_CAPI_TOKEN');
  if (!token) return new Response('Not configured', { status: 500 });

  let b;
  try { b = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  if (!ALLOWED.has(b.event_name) || !b.event_id) return new Response('Bad event', { status: 400 });

  const user_data = {
    client_ip_address: context.ip || req.headers.get('x-nf-client-connection-ip') || undefined,
    client_user_agent: req.headers.get('user-agent') || undefined,
    fbp: b.fbp || undefined,
    fbc: b.fbc || undefined,
  };
  if (b.email) user_data.em = [sha(b.email)];
  if (b.first_name) user_data.fn = [sha(b.first_name)];
  if (b.last_name) user_data.ln = [sha(b.last_name)];

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
  const testCode = Netlify.env.get('META_TEST_EVENT_CODE');
  if (testCode) payload.test_event_code = testCode;

  const r = await fetch(`${API}?access_token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const out = await r.text();
  return new Response(r.ok ? 'ok' : out, { status: r.ok ? 200 : 502 });
};

export const config = { path: '/api/meta-capi' };
