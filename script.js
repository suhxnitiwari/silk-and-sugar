// Where order requests go. Paste a Formspree (or similar) form URL into
// FORM_ENDPOINT to receive them by email; until then the form opens a
// pre-written email to ORDER_EMAIL.
const FORM_ENDPOINT = '';
const ORDER_EMAIL = 'hello@silkandsugarbakery.com';

const MINIMUM = 24;
const DELIVERY_FEE = 30;
const DELIVERY_MINIMUM = 100;

const FLAVORS = [
  { id: 'hazelnut', name: 'Chocolate hazelnut coffee', tone: '#5E3B2C' },
  { id: 'butterscotch', name: 'Butterscotch toffee', tone: '#B07A45' },
  { id: 'double', name: 'Double chocolate walnut', tone: '#2F1A12' },
  { id: 'strawberry', name: 'Strawberry shortcake crunch', tone: '#D29BA2' },
];

const KINDS = {
  cookie: { label: 'Cookies', price: 6, step: 6 },
  muffin: { label: 'Muffins', price: 5, step: 6 },
  loaf: { label: 'Loaves', price: 35, step: 1 },
};

const qty = {};
FLAVORS.forEach(f => { qty[`${f.id}-cookie`] = 0; qty[`${f.id}-muffin`] = 0; });
qty.loaf = 0;

const money = n => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const $ = sel => document.querySelector(sel);

function row(key, name, tone, unit) {
  return `
    <div class="row">
      <div class="row-name"><span class="row-dot" style="--tone:${tone}"></span><h4>${name}</h4></div>
      <span class="stepper">
        <button type="button" data-key="${key}" data-dir="-1" aria-label="Fewer ${name} ${unit}">&minus;</button>
        <output id="q-${key}">0</output>
        <button type="button" data-key="${key}" data-dir="1" aria-label="More ${name} ${unit}">+</button>
      </span>
    </div>`;
}

function group(title, note, rows) {
  return `
    <div class="group">
      <div class="group-head"><h3>${title}</h3><p>${note}</p></div>
      ${rows.join('')}
    </div>`;
}

function buildList() {
  $('#builder-list').innerHTML = [
    group('Cookies', '$6 each, in half dozens', FLAVORS.map(f => row(`${f.id}-cookie`, f.name, f.tone, 'cookies'))),
    group('Muffins', '$5 each, in half dozens', FLAVORS.map(f => row(`${f.id}-muffin`, f.name, f.tone, 'muffins'))),
    group('Banana bread', '$35 a loaf, order one on its own',
      [row('loaf', 'Upside-down salted caramel banana bread', '#C99A62', 'loaves')]),
  ].join('');
}

const kindOf = key => (key === 'loaf' ? 'loaf' : key.split('-')[1]);

function totals() {
  const count = { cookie: 0, muffin: 0, loaf: 0 };
  let subtotal = 0;
  Object.entries(qty).forEach(([key, n]) => {
    const kind = kindOf(key);
    count[kind] += n;
    subtotal += n * KINDS[kind].price;
  });
  const items = count.cookie + count.muffin;
  const delivery = document.querySelector('input[name="fulfil"]:checked').value === 'delivery';
  const fee = delivery ? DELIVERY_FEE : 0;
  const total = subtotal + fee;
  return { items, cookies: count.cookie, muffins: count.muffin, loaves: count.loaf, subtotal, delivery, fee, total };
}

function problem(t) {
  if (t.items === 0 && t.loaves === 0) return 'Add cookies, muffins or a loaf to begin.';
  if (t.items > 0 && t.items < MINIMUM) return `Add ${MINIMUM - t.items} more cookies or muffins to reach the two dozen minimum.`;
  if (t.delivery && t.subtotal < DELIVERY_MINIMUM) return `Delivery starts at $${DELIVERY_MINIMUM}. Add ${money(DELIVERY_MINIMUM - t.subtotal)} more, or choose pickup.`;
  return '';
}

function render() {
  Object.entries(qty).forEach(([key, n]) => {
    $(`#q-${key}`).textContent = n;
    document.querySelector(`[data-key="${key}"][data-dir="-1"]`).disabled = n === 0;
  });

  const t = totals();
  const issue = problem(t);
  $('#sum-cookies').textContent = t.cookies;
  $('#sum-muffins').textContent = t.muffins;
  $('#sum-loaves').textContent = t.loaves;
  $('#sum-subtotal').textContent = money(t.subtotal);
  $('#sum-delivery').textContent = money(t.fee);
  $('#sum-total').textContent = money(t.total);

  const status = $('#sum-status');
  status.textContent = issue || 'Your order is ready for event details.';
  status.classList.toggle('ok', !issue);
  $('#to-details').setAttribute('aria-disabled', issue ? 'true' : 'false');
  $('#address-field').hidden = !t.delivery;

  renderFormOrder(t, issue);
}

function orderLines() {
  const lines = [];
  FLAVORS.forEach(f => {
    ['cookie', 'muffin'].forEach(kind => {
      const n = qty[`${f.id}-${kind}`];
      if (n) lines.push({ text: `${n} ${f.name} ${kind}${n === 1 ? '' : 's'}`, cost: n * KINDS[kind].price });
    });
  });
  if (qty.loaf) lines.push({ text: `${qty.loaf} banana bread loa${qty.loaf === 1 ? 'f' : 'ves'}`, cost: qty.loaf * KINDS.loaf.price });
  return lines;
}

function renderFormOrder(t, issue) {
  const box = $('#form-order');
  if (issue) {
    box.innerHTML = `<p>${issue} <a href="#order">Back to your order</a></p>`;
    return;
  }
  const lines = orderLines().map(l => `<li><span>${l.text}</span><span>${money(l.cost)}</span></li>`);
  lines.push(`<li><span>${t.delivery ? 'Hand delivery' : 'Pickup in Austin'}</span><span>${money(t.fee)}</span></li>`);
  lines.push(`<li class="form-total"><span>Total</span><span>${money(t.total)}</span></li>`);
  box.innerHTML = `<ul>${lines.join('')}</ul>`;
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.stepper button');
  if (btn) {
    const key = btn.dataset.key;
    const step = KINDS[kindOf(key)].step;
    qty[key] = Math.max(0, qty[key] + step * Number(btn.dataset.dir));
    render();
    return;
  }
  if (e.target.closest('[data-add-loaf]')) {
    qty.loaf += 1;
    render();
    $('#order').scrollIntoView({ behavior: 'smooth' });
  }
});

document.querySelectorAll('input[name="fulfil"]').forEach(r => r.addEventListener('change', render));

// Event details
const form = $('#order-form');
const tomorrow = new Date(Date.now() + 864e5);
form.date.min = tomorrow.toISOString().slice(0, 10);

form.addEventListener('input', e => {
  e.target.classList.remove('invalid');
  $('#form-error').textContent = '';
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const t = totals();
  const issue = problem(t);
  const error = $('#form-error');
  if (issue) {
    error.textContent = issue;
    return;
  }

  const required = ['name', 'email', 'phone', 'date'];
  if (t.delivery) required.push('address');
  const missing = required.filter(n => !form[n].value.trim() || !form[n].checkValidity());
  missing.forEach(n => form[n].classList.add('invalid'));
  if (missing.length) {
    error.textContent = 'Fill in the highlighted fields.';
    form[missing[0]].focus();
    return;
  }
  if (!form.labels.checked) {
    error.textContent = 'Read the ingredients and allergens, then check the box.';
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  const summary = [
    ...orderLines().map(l => `${l.text}: ${money(l.cost)}`),
    `${t.delivery ? 'Hand delivery' : 'Pickup'}: ${money(t.fee)}`,
    `Total: ${money(t.total)}`,
  ].join('\n');
  const body = [
    `Name: ${data.name}`, `Email: ${data.email}`, `Phone: ${data.phone}`,
    `Company or occasion: ${data.occasion || ''}`, `Event date: ${data.date}`, `Time: ${data.time || ''}`,
    t.delivery ? `Delivery address: ${data.address}` : 'Pickup',
    `Notes: ${data.notes || ''}`, '', summary,
  ].join('\n');

  if (FORM_ENDPOINT) {
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...data, order: summary, _subject: `Order request for ${data.date}` }),
      });
      if (!res.ok) throw new Error();
    } catch {
      error.textContent = "Your request didn't send. Try again in a moment.";
      return;
    }
  } else {
    const subject = encodeURIComponent(`Order request for ${data.date}`);
    window.location.href = `mailto:${ORDER_EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`;
  }

  form.hidden = true;
  $('#thanks').hidden = false;
  $('#thanks').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

buildList();
render();
