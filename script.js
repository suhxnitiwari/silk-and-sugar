// Where order requests go. Paste a Formspree (or similar) form URL into
// FORM_ENDPOINT to receive them by email; until then the form opens a
// pre-written email to ORDER_EMAIL.
const FORM_ENDPOINT = '';
const ORDER_EMAIL = 'suhanitiwari@utexas.edu';

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

const PRESETS = [
  { id: 'sampler', name: 'The Sampler', note: 'Six of each cookie',
    set: { 'hazelnut-cookie': 6, 'butterscotch-cookie': 6, 'double-cookie': 6, 'strawberry-cookie': 6 } },
  { id: 'meeting', name: 'The Morning Meeting', note: 'A dozen muffins and a dozen cookies',
    set: { 'hazelnut-muffin': 6, 'double-muffin': 6, 'butterscotch-cookie': 6, 'strawberry-cookie': 6 } },
  { id: 'celebration', name: 'The Celebration', note: 'Four dozen cookies, twelve of each',
    set: { 'hazelnut-cookie': 12, 'butterscotch-cookie': 12, 'double-cookie': 12, 'strawberry-cookie': 12 } },
  { id: 'brunch', name: 'The Brunch', note: 'Two dozen muffins and a loaf',
    set: { 'hazelnut-muffin': 6, 'butterscotch-muffin': 6, 'double-muffin': 6, 'strawberry-muffin': 6, loaf: 1 } },
];

// Box sizes for the preview: a dozen cookies, six muffins, one loaf.
const BOX = { cookie: { slots: 12, label: 'Cookies' }, muffin: { slots: 6, label: 'Muffins' }, loaf: { slots: 1, label: 'Banana bread' } };
const MAX_BOXES = 9;

const qty = {};
FLAVORS.forEach(f => { qty[`${f.id}-cookie`] = 0; qty[`${f.id}-muffin`] = 0; });
qty.loaf = 0;

// Pieces in the order they were added, so new ones land at the end of the box.
const packed = { cookie: [], muffin: [], loaf: [] };
let shown = { cookie: 0, muffin: 0, loaf: 0 };
let shownBoxes = { cookie: 0, muffin: 0, loaf: 0 };
let activePreset = null;

function setQty(key, n) {
  const kind = kindOf(key);
  const flavor = kind === 'loaf' ? 'loaf' : key.split('-')[0];
  const diff = n - qty[key];
  for (let i = 0; i < diff; i++) packed[kind].push(flavor);
  for (let i = 0; i < -diff; i++) packed[kind].splice(packed[kind].lastIndexOf(flavor), 1);
  qty[key] = n;
}

function applyPreset(id) {
  const preset = PRESETS.find(p => p.id === id);
  Object.keys(qty).forEach(key => setQty(key, 0));
  shown = { cookie: 0, muffin: 0, loaf: 0 };
  shownBoxes = { cookie: 0, muffin: 0, loaf: 0 };
  Object.entries(preset.set).forEach(([key, n]) => setQty(key, n));
  activePreset = id;
  render();
}

const presetPrice = p => Object.entries(p.set).reduce((sum, [key, n]) => sum + n * KINDS[kindOf(key)].price, 0);

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

function buildPresets() {
  $('#presets').innerHTML = `
    <div class="group-head"><h3>Ready-made boxes</h3><p>One click to start</p></div>
    <div class="preset-grid">${PRESETS.map(p => `
      <button type="button" class="preset" data-preset="${p.id}">
        <span class="preset-name">${p.name}</span>
        <span class="preset-note">${p.note}</span>
        <span class="preset-price">${money(presetPrice(p))}</span>
      </button>`).join('')}
    </div>`;
}

function slot(kind, flavor, isNew, delay) {
  if (!flavor) return '<span class="slot"></span>';
  const symbol = kind === 'loaf' ? 't-loaf' : `t-${kind}-${flavor}`;
  return `<span class="slot filled${isNew ? ' drop' : ''}" style="--d:${delay}ms"><svg><use href="#${symbol}"/></svg></span>`;
}

function renderStage(t) {
  const boxes = [];
  ['cookie', 'muffin', 'loaf'].forEach(kind => {
    const list = packed[kind];
    const size = BOX[kind].slots;
    const count = Math.ceil(list.length / size);
    for (let b = 0; b < count; b++) boxes.push({ kind, start: b * size, n: count, b });
  });

  let fresh = 0;
  const visible = boxes.length > MAX_BOXES ? boxes.slice(0, MAX_BOXES - 1) : boxes;
  const html = visible.map(({ kind, start, n, b }) => {
    const size = BOX[kind].slots;
    const slots = [];
    for (let i = start; i < start + size; i++) {
      const isNew = i < packed[kind].length && i >= shown[kind];
      slots.push(slot(kind, packed[kind][i], isNew, isNew ? Math.min(fresh++ * 45, 900) : 0));
    }
    const tag = kind === 'loaf' ? BOX.loaf.label : `${BOX[kind].label}${n > 1 ? `, box ${b + 1} of ${n}` : ''}`;
    const isNewBox = b >= shownBoxes[kind];
    return `<div class="box box-${kind}${isNewBox ? ' box-new' : ''}"><span class="box-lid">Silk &amp; Sugar</span><div class="tray">${slots.join('')}</div><span class="box-tag">${tag}</span></div>`;
  });
  if (boxes.length > MAX_BOXES) {
    html.push(`<div class="box box-more"><span>+${boxes.length - visible.length} more boxes</span></div>`);
  }
  if (!boxes.length) {
    html.push(`<div class="box box-cookie box-empty"><span class="box-lid">Silk &amp; Sugar</span><div class="tray">${'<span class="slot"></span>'.repeat(12)}</div><span class="box-tag">Your box is waiting</span></div>`);
  }

  const wrap = $('#boxes');
  wrap.dataset.count = Math.min(Math.max(html.length, 1), MAX_BOXES);
  wrap.innerHTML = html.join('');
  shown = { cookie: packed.cookie.length, muffin: packed.muffin.length, loaf: packed.loaf.length };
  Object.keys(BOX).forEach(kind => { shownBoxes[kind] = Math.ceil(packed[kind].length / BOX[kind].slots); });

  const pieces = [];
  if (t.cookies) pieces.push(`${t.cookies} cookie${t.cookies === 1 ? '' : 's'}`);
  if (t.muffins) pieces.push(`${t.muffins} muffin${t.muffins === 1 ? '' : 's'}`);
  if (t.loaves) pieces.push(`${t.loaves} loa${t.loaves === 1 ? 'f' : 'ves'}`);
  const countText = pieces.length ? pieces.join(', ') : 'Empty for now';
  $('#stage-count').textContent = countText;
  $('#mini-count').textContent = pieces.length ? countText : 'Your box is empty';
  [$('#stage-total'), $('#mini-total')].forEach(el => {
    el.textContent = money(t.subtotal);
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  });

  $('#meter-fill').style.width = `${Math.min(t.items / MINIMUM, 1) * 100}%`;
  let note = 'Two dozen cookies and muffins to begin';
  if (t.items >= MINIMUM) note = 'Ready for your event';
  else if (t.items > 0) note = `${MINIMUM - t.items} more to reach two dozen`;
  else if (t.loaves) note = 'A loaf on its own is always welcome';
  $('#meter-note').textContent = note;
  $('#stage').classList.toggle('is-ready', t.items >= MINIMUM || (t.items === 0 && t.loaves > 0));

  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('is-active', b.dataset.preset === activePreset));
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
  if (t.items > 0 && t.items < MINIMUM) return `Just ${MINIMUM - t.items} more cookies or muffins to reach two dozen.`;
  if (t.delivery && t.subtotal < DELIVERY_MINIMUM) return `Hand delivery begins at $${DELIVERY_MINIMUM}, just ${money(DELIVERY_MINIMUM - t.subtotal)} away. Pickup is always free.`;
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
  renderStage(t);
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
    setQty(key, Math.max(0, qty[key] + step * Number(btn.dataset.dir)));
    activePreset = null;
    render();
    return;
  }
  const preset = e.target.closest('[data-preset]');
  if (preset) {
    applyPreset(preset.dataset.preset);
    if (!preset.classList.contains('preset')) $('#order').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (e.target.closest('[data-add-loaf]')) {
    setQty('loaf', qty.loaf + 1);
    activePreset = null;
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
    error.textContent = 'Please fill in the highlighted fields.';
    form[missing[0]].focus();
    return;
  }
  if (!form.labels.checked) {
    error.textContent = "Please confirm you've read the ingredients and allergens.";
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
      error.textContent = "Your request didn't go through. Please try again in a moment.";
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

// The phone summary bar shows only while the builder is on screen.
new IntersectionObserver(([entry]) => {
  $('#mini-bar').classList.toggle('is-on', entry.isIntersecting);
}, { rootMargin: '-30% 0px -30% 0px' }).observe($('.builder'));

buildPresets();
buildList();
render();
