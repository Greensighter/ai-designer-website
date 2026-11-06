/* POST /api/lead: demo requests from the booking chat (assets/js/chat.js).
 * Emails the team through Resend and keeps a backup copy in KV.
 * status = "complete" (finished chat) or "partial" (left halfway, answers so far). */

const FIELDS = ['status', 'first_name', 'last_name', 'email', 'website', 'team_size', 'pm_tool', 'designers', 'answered'];
const LABELS = { first_name: 'First name', last_name: 'Last name', email: 'Email', website: 'Website', team_size: 'Team size', pm_tool: 'Ticket tool', designers: 'Designers', answered: 'Answered' };

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function readBody(request) {
  const type = request.headers.get('content-type') || '';
  const raw = await request.text();
  if (raw.length > 8000) throw new Error('too large');
  if (type.includes('application/json')) return JSON.parse(raw || '{}');
  return Object.fromEntries(new URLSearchParams(raw));
}

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try { body = await readBody(request); } catch (e) { return json({ ok: false, error: 'bad request' }, 400); }
  if (body['bot-field']) return json({ ok: true }); // honeypot

  const lead = {};
  for (const k of FIELDS) lead[k] = String(body[k] ?? '').trim().slice(0, 300);
  lead.status = lead.status === 'partial' ? 'partial' : 'complete';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return json({ ok: false, error: 'email required' }, 400);

  const now = new Date().toISOString();
  const meta = { at: now, country: request.cf?.country || '', page: request.headers.get('referer') || '' };

  // Backup in KV: one record per email, latest state wins, keeps a short history.
  if (env.LEADS) {
    const key = `lead:${lead.email.toLowerCase()}`;
    const prev = await env.LEADS.get(key, 'json').catch(() => null);
    const history = (prev?.history || []).concat([{ status: lead.status, at: now }]).slice(-20);
    waitUntil(env.LEADS.put(key, JSON.stringify({ ...lead, ...meta, history })));
  }

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.email;
  const subject = lead.status === 'partial'
    ? `Unfinished demo request: ${name} (${lead.answered || 'Email'})`
    : `New demo request: ${name}`;
  const rows = Object.keys(LABELS).filter((k) => lead[k]).map((k) => [LABELS[k], lead[k]]);
  const text = `${subject}\n\n${rows.map(([l, v]) => `${l}: ${v}`).join('\n')}\n\nCountry: ${meta.country}\nTime: ${now}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
    <p style="margin:0 0 12px;font-size:16px"><b>${esc(subject)}</b></p>
    <table cellpadding="6" style="border-collapse:collapse">${rows.map(([l, v]) => `<tr><td style="color:#777">${esc(l)}</td><td><b>${esc(v)}</b></td></tr>`).join('')}</table>
    <p style="color:#999;font-size:12px;margin-top:16px">${esc(meta.country)} · ${esc(now)} · Reply to this email to reach ${esc(lead.email)}</p></div>`;

  if (!env.RESEND_API_KEY) return json({ ok: true, emailed: false, note: 'RESEND_API_KEY not set; saved to KV only' });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.LEAD_FROM || 'Greensighter AI Designer <leads@greensighter.com>',
      to: (env.LEAD_EMAILS || 'aram@greensighter.com').split(',').map((s) => s.trim()).filter(Boolean),
      reply_to: lead.email,
      subject, text, html
    })
  });
  if (!res.ok) {
    // The lead is already in KV; tell the browser so a finished request can be retried.
    return json({ ok: false, error: 'email failed', detail: (await res.text()).slice(0, 200) }, 502);
  }
  return json({ ok: true });
}

export const onRequest = () => json({ ok: false, error: 'method not allowed' }, 405);
