import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { buildOrder, sessionParams, encode, austinDate } from './worker.js';

const now = new Date('2026-11-17T18:00:00Z');
const details = { name: 'Jane Doe', email: 'jane@example.com', phone: '5125550100', date: '2026-11-20', time: '10:00' };
const box = { 'hazelnut-cookie': 12, 'strawberry-cookie': 6, 'double-muffin': 6, loaf: 1 };

test('prices a mixed box from the server table', () => {
  const o = buildOrder({ items: box, fulfil: 'pickup', details }, now);
  assert.equal(o.error, undefined);
  assert.equal(o.total, 12 * 600 + 6 * 600 + 6 * 500 + 3500);
});

test('adds the delivery zone fee', () => {
  const o = buildOrder({ items: box, fulfil: 'delivery', zone: 'domain', details: { ...details, address: '11500 Rock Rose Ave' } }, now);
  assert.equal(o.fee, 5000);
  assert.equal(o.lines.at(-1).name, 'Hand delivery to The Domain');
});

test('enforces the house rules', () => {
  assert.match(buildOrder({ items: { 'hazelnut-cookie': 12 }, details }, now).error, /two dozen/);
  assert.match(buildOrder({ items: { 'hazelnut-cookie': 25 }, details }, now).error, /six at a time/);
  assert.match(buildOrder({ items: box, details: { ...details, date: '2026-11-19' } }, now).error, /three days/);
  assert.match(buildOrder({ items: { loaf: 2 }, fulfil: 'delivery', zone: 'near', details: { ...details, address: 'x' } }, now).error, /\$100/);
  assert.match(buildOrder({ items: { 'fake-cookie': 24 }, details }, now).error, /could not find/);
  assert.equal(buildOrder({ items: { loaf: 1 }, fulfil: 'pickup', details }, now).total, 3500);
});

test('three days counts from Austin time', () => {
  assert.equal(austinDate(3, new Date('2026-11-18T03:30:00Z')), '2026-11-20');
});

test('encodes Stripe line items', () => {
  const o = buildOrder({ items: box, fulfil: 'pickup', details }, now);
  const form = encode(sessionParams(o, { details }));
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '600');
  assert.equal(form.get('line_items[0][quantity]'), '12');
  assert.equal(form.get('metadata[bake_day]'), '2026-11-20');
  assert.equal(form.get('success_url'), 'https://silkandsugarbakery.com/thanks.html?session_id={CHECKOUT_SESSION_ID}');
});

test('fetch handler returns the Stripe URL', async () => {
  const realFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => { sent = { url, init }; return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/test' }), { status: 200 }); };
  try {
    const req = new Request('https://worker.example/', { method: 'POST', headers: { Origin: 'https://silkandsugarbakery.com' },
      body: JSON.stringify({ items: box, fulfil: 'pickup', details: { ...details, date: austinDate(5) } }) });
    const res = await worker.fetch(req, { STRIPE_SECRET_KEY: 'sk_test_placeholder' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).url, 'https://checkout.stripe.com/c/pay/test');
    assert.equal(sent.url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://silkandsugarbakery.com');
  } finally {
    globalThis.fetch = realFetch;
  }
});
