// Silk & Sugar checkout: a Cloudflare Worker that turns a built box into a
// Stripe Checkout session. Prices and rules live here, never in the browser,
// so a buyer cannot change what they pay by editing the page.
//
// Setup: paste this file into a new Cloudflare Worker, then add a secret
// named STRIPE_SECRET_KEY (Settings > Variables and Secrets).

const SITE = 'https://silkandsugarbakery.com';
const ALLOWED_ORIGINS = [SITE, 'https://www.silkandsugarbakery.com', 'http://localhost:8970'];

const FLAVORS = {
  hazelnut: 'Chocolate hazelnut coffee',
  butterscotch: 'Butterscotch toffee',
  double: 'Double chocolate walnut',
  strawberry: 'Strawberry shortcake crunch',
};
const PRICES = { cookie: 600, muffin: 500, loaf: 3500 }; // cents
const ZONES = {
  near: { label: 'Hand delivery within 10 miles of UT Austin', fee: 2500 },
  far: { label: 'Hand delivery more than 10 miles from UT Austin', fee: 4500 },
  domain: { label: 'Hand delivery to The Domain', fee: 5000 },
};
const MINIMUM = 24;
const DELIVERY_MINIMUM = 10000;
const LEAD_DAYS = 3;

const clip = (value, max = 480) => String(value ?? '').trim().slice(0, max);

// Today's date in Austin, as YYYY-MM-DD, moved forward by `days`.
function austinDate(days = 0, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(now);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Checks the order and prices it. Returns { error } or { lines, total, ... }.
export function buildOrder(body, now = new Date()) {
  const items = body?.items || {};
  const details = body?.details || {};
  const lines = [];
  let pieces = 0;
  let subtotal = 0;

  for (const [key, raw] of Object.entries(items)) {
    const n = Number(raw);
    if (!n) continue;
    if (!Number.isInteger(n) || n < 0) return { error: 'Your box has a quantity we could not read.' };
    if (key === 'loaf') {
      if (n > 12) return { error: 'For more than twelve loaves, please email your order.' };
      lines.push({ name: 'Upside-down salted caramel banana bread', amount: PRICES.loaf, quantity: n });
      subtotal += n * PRICES.loaf;
      continue;
    }
    const [flavor, kind] = key.split('-');
    if (!FLAVORS[flavor] || !(kind === 'cookie' || kind === 'muffin')) return { error: 'Your box has an item we could not find.' };
    if (n % 6) return { error: 'Cookies and muffins come six at a time.' };
    lines.push({ name: `${FLAVORS[flavor]} ${kind}s`, amount: PRICES[kind], quantity: n });
    pieces += n;
    subtotal += n * PRICES[kind];
  }

  if (!lines.length) return { error: 'Your box is empty.' };
  if (pieces > 0 && pieces < MINIMUM) return { error: 'Orders begin at two dozen cookies and muffins.' };
  if (pieces > 600) return { error: 'For orders this large, please email so we can plan together.' };

  const delivery = body?.fulfil === 'delivery';
  let fee = 0;
  if (delivery) {
    const zone = ZONES[body?.zone];
    if (!zone) return { error: 'Please choose a delivery area.' };
    if (subtotal < DELIVERY_MINIMUM) return { error: 'Hand delivery begins at $100. Pickup is always free.' };
    fee = zone.fee;
    lines.push({ name: zone.label, amount: fee, quantity: 1 });
  }

  const date = clip(details.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Please choose a bake day.' };
  if (date < austinDate(LEAD_DAYS, now)) return { error: 'Please choose a bake day at least three days from today.' };

  for (const field of ['name', 'email', 'phone']) {
    if (!clip(details[field])) return { error: 'Please fill in your name, email and phone.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clip(details.email))) return { error: 'Please check your email address.' };
  if (delivery && !clip(details.address)) return { error: 'Please add your delivery address.' };

  return { lines, subtotal, fee, total: subtotal + fee, delivery, date };
}

// Stripe's API takes form encoding, with nested keys like line_items[0][quantity].
function encode(params) {
  const out = new URLSearchParams();
  const walk = (prefix, value) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => walk(prefix ? `${prefix}[${k}]` : k, v));
    } else {
      out.append(prefix, String(value));
    }
  };
  walk('', params);
  return out;
}

export function sessionParams(order, body) {
  const d = body.details;
  const summary = order.lines.map(l => `${l.quantity} x ${l.name}`).join('; ');
  const metadata = {
    bake_day: order.date,
    time: clip(d.time, 20),
    name: clip(d.name, 120),
    phone: clip(d.phone, 40),
    occasion: clip(d.occasion, 200),
    fulfilment: order.delivery ? 'Hand delivery' : 'Pickup',
    address: order.delivery ? clip(d.address) : '',
    notes: clip(d.notes),
    order: clip(summary, 490),
  };
  return {
    mode: 'payment',
    customer_email: clip(d.email, 200),
    success_url: `${SITE}/thanks.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/#order`,
    line_items: order.lines.map(l => ({
      quantity: l.quantity,
      price_data: { currency: 'usd', unit_amount: l.amount, product_data: { name: l.name } },
    })),
    metadata,
    payment_intent_data: { description: `Silk & Sugar order for ${order.date}`, metadata },
    custom_text: { submit: { message: `Baked fresh for ${order.date}. A receipt arrives by email the moment you pay.` } },
  };
}

function reply(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : SITE;
    if (request.method === 'OPTIONS') return reply({}, 204, allowed);
    if (request.method !== 'POST') return reply({ error: 'Not found' }, 404, allowed);
    if (!env.STRIPE_SECRET_KEY) return reply({ error: 'Checkout is not set up yet.' }, 500, allowed);

    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ error: 'We could not read your order.' }, 400, allowed);
    }

    const order = buildOrder(body);
    if (order.error) return reply({ error: order.error }, 400, allowed);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: encode(sessionParams(order, body)),
    });
    const session = await res.json();
    if (!res.ok) return reply({ error: 'Checkout could not start. Please try again in a moment.' }, 502, allowed);
    return reply({ url: session.url }, 200, allowed);
  },
};

export { encode, austinDate };
