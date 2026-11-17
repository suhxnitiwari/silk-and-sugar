// Where order requests go. Paste a Formspree (or similar) form URL into
// FORM_ENDPOINT to receive them by email; until then the form opens a
// pre-written email to ORDER_EMAIL.
const FORM_ENDPOINT = '';
const ORDER_EMAIL = 'suhanitiwari@utexas.edu';
// The Stripe checkout worker (checkout-worker/worker.js). Paste its URL here
// once it is deployed; until then orders arrive as emailed requests.
const CHECKOUT_ENDPOINT = '';

const MINIMUM = 24;
const DELIVERY_MINIMUM = 100;

// Hand delivery is priced by driving distance from the UT Austin campus.
const ZONES = [
  { id: 'near', label: 'Within 10 miles of UT Austin', fee: 25 },
  { id: 'far', label: 'More than 10 miles from UT Austin', fee: 45 },
  { id: 'domain', label: 'The Domain', fee: 50 },
];

const FLAVORS = [
  { id: 'hazelnut', name: 'Chocolate hazelnut coffee', tone: '#41251A' },
  { id: 'butterscotch', name: 'Butterscotch toffee', tone: '#B07A45' },
  { id: 'double', name: 'Double chocolate walnut', tone: '#B9864E' },
  { id: 'strawberry', name: 'Strawberry shortcake crunch', tone: '#D29BA2' },
];

const KINDS = {
  cookie: { label: 'Cookies', price: 6, step: 6 },
  muffin: { label: 'Muffins', price: 5, step: 6 },
  loaf: { label: 'Loaves', price: 35, step: 1 },
};

const PRESETS = [
  { id: 'sampler', name: 'The Sampler', note: 'Two dozen cookies, an even mix of all four flavors', tag: 'Every flavor',
    set: { 'hazelnut-cookie': 6, 'butterscotch-cookie': 6, 'double-cookie': 6, 'strawberry-cookie': 6 } },
  { id: 'meeting', name: 'The Morning Meeting', note: 'A dozen muffins and a dozen cookies',
    set: { 'hazelnut-muffin': 6, 'double-muffin': 6, 'butterscotch-cookie': 6, 'strawberry-cookie': 6 } },
  { id: 'celebration', name: 'The Celebration', note: 'Four dozen cookies, an even mix of all four flavors',
    set: { 'hazelnut-cookie': 12, 'butterscotch-cookie': 12, 'double-cookie': 12, 'strawberry-cookie': 12 } },
  { id: 'brunch', name: 'The Brunch', note: 'Two dozen muffins and a loaf',
    set: { 'hazelnut-muffin': 6, 'butterscotch-muffin': 6, 'double-muffin': 6, 'strawberry-muffin': 6, loaf: 1 } },
  // Holiday boxes live on holidays.html and arrive here as ?box=<id>.
  { id: 'thanksgiving-table', name: 'The Thanksgiving Table', note: 'Two dozen cookies in all four flavors, plus a loaf', holiday: true,
    set: { 'hazelnut-cookie': 6, 'butterscotch-cookie': 6, 'double-cookie': 6, 'strawberry-cookie': 6, loaf: 1 } },
  { id: 'thanksgiving-morning', name: 'Thanksgiving Morning', note: 'Two dozen muffins in all four flavors, plus a loaf', holiday: true,
    set: { 'hazelnut-muffin': 6, 'butterscotch-muffin': 6, 'double-muffin': 6, 'strawberry-muffin': 6, loaf: 1 } },
  { id: 'holiday-party', name: 'The Holiday Party', note: 'Four dozen cookies in all four flavors', holiday: true,
    set: { 'hazelnut-cookie': 12, 'butterscotch-cookie': 12, 'double-cookie': 12, 'strawberry-cookie': 12 } },
  { id: 'open-house', name: 'The Open House', note: 'Two dozen cookies, two dozen muffins and two loaves', holiday: true,
    set: { 'hazelnut-cookie': 6, 'butterscotch-cookie': 6, 'double-cookie': 6, 'strawberry-cookie': 6,
      'hazelnut-muffin': 6, 'butterscotch-muffin': 6, 'double-muffin': 6, 'strawberry-muffin': 6, loaf: 2 } },
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

// The guided builder: choose a size, fill it, add a loaf, review.
const SIZES = [
  { n: 24, name: 'Two dozen', guests: '12 to 24 guests' },
  { n: 48, name: 'Four dozen', guests: '24 to 48 guests' },
  { n: 72, name: 'Six dozen', guests: '36 to 72 guests' },
  { n: 96, name: 'Eight dozen', guests: '48 to 96 guests' },
];
const STEP_NEXT = { 1: 'Next: fill your box', 2: 'Next: banana bread', 3: 'Next: review' };
let boxSize = null;
let step = 1;

const sizeName = n => (SIZES.find(z => z.n === n) || { name: `${n}-piece` }).name.toLowerCase();
const fitSize = items => (SIZES.find(z => z.n >= items) || { n: Math.ceil(items / 24) * 24 }).n;

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
  const items = Object.entries(preset.set).filter(([key]) => kindOf(key) !== 'loaf').reduce((sum, [, n]) => sum + n, 0);
  boxSize = items ? fitSize(items) : 0;
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

function buildSizes() {
  $('#sizes').innerHTML = SIZES.map(z => `
    <button type="button" class="size" data-size="${z.n}">
      <span class="size-count">${z.n}</span>
      <span class="size-name">${z.name}</span>
      <span class="size-guests">${z.guests}</span>
      <span class="size-price">${money(z.n * KINDS.muffin.price)} to ${money(z.n * KINDS.cookie.price)}</span>
    </button>`).join('');
}

function goStep(n, scroll = true) {
  step = n;
  document.querySelectorAll('.step').forEach(el => {
    const on = Number(el.dataset.step) === n;
    el.hidden = !on;
    if (on) { el.classList.remove('step-in'); void el.offsetWidth; el.classList.add('step-in'); }
  });
  document.querySelectorAll('.wizard-steps button').forEach(b => {
    const k = Number(b.dataset.step);
    b.classList.toggle('is-current', k === n);
    b.classList.toggle('is-done', k < n);
    b.setAttribute('aria-current', k === n ? 'step' : 'false');
  });
  $('#step-back').hidden = n === 1;
  $('#step-next').hidden = n === 4;
  $('#step-next').textContent = STEP_NEXT[n] || 'Next';
  if (scroll) {
    const top = $('#wizard').getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) $('#wizard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function buildPresets() {
  $('#presets').innerHTML = `
    <div class="group-head"><h3>Or start with a ready-made box</h3><p>One click, then adjust</p></div>
    <div class="preset-grid">${PRESETS.filter(p => !p.holiday).map(p => `
      <button type="button" class="preset" data-preset="${p.id}">
        ${p.tag ? `<span class="tag">${p.tag}</span>` : ''}
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

  const target = boxSize || MINIMUM;
  $('#meter-fill').style.width = `${Math.min(t.items / target, 1) * 100}%`;
  let note = boxSize ? `A ${sizeName(boxSize)} box, waiting to be filled` : 'Choose a size to begin';
  if (t.items >= target) note = boxSize ? `Your ${sizeName(boxSize)} box is full` : 'Ready for your event';
  else if (t.items > 0) note = boxSize ? `${t.items} of ${boxSize}, room for ${target - t.items} more` : `${MINIMUM - t.items} more to reach two dozen`;
  else if (t.loaves) note = 'A loaf on its own is always welcome';
  $('#meter-note').textContent = note;
  const stage = $('#stage');
  const ready = t.items >= MINIMUM || (t.items === 0 && t.loaves > 0);
  // The ribbon ties itself the moment the box first reaches two dozen.
  if (ready && !stage.classList.contains('is-ready')) {
    stage.classList.add('tie');
    setTimeout(() => stage.classList.remove('tie'), 900);
  }
  stage.classList.toggle('is-ready', ready);

  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('is-active', b.dataset.preset === activePreset));
}

function buildZones() {
  $('#zones').innerHTML = ZONES.map((z, i) => `
    <label>
      <span class="zone-name"><input type="radio" name="zone" value="${z.id}"${i === 0 ? ' checked' : ''}>${z.label}</span>
      <span class="zone-fee">${money(z.fee)}</span>
    </label>`).join('');
}

function tile(key, name, art, unit, price) {
  return `
    <div class="tile">
      <button type="button" class="tile-art" data-key="${key}" data-dir="1" aria-label="Add six ${name} ${unit}">${art}<span class="tile-plus" aria-hidden="true">+6</span></button>
      <h5>${name}</h5>
      <p class="tile-price">${price}</p>
      <span class="stepper">
        <button type="button" data-key="${key}" data-dir="-1" aria-label="Fewer ${name} ${unit}">&minus;</button>
        <output id="q-${key}">0</output>
        <button type="button" data-key="${key}" data-dir="1" aria-label="More ${name} ${unit}">+</button>
      </span>
    </div>`;
}

function buildList() {
  const cookieArt = f => `<img src="images/cookie-${f.id}.jpg" alt="" loading="lazy">`;
  const muffinArt = f => `<svg viewBox="0 0 100 100"><use href="#t-muffin-${f.id}"/></svg>`;
  $('#builder-list').innerHTML = `
    <div class="group-head"><h4>Cookies</h4><p>$6 each, six at a time</p></div>
    <div class="tiles">${FLAVORS.map(f => tile(`${f.id}-cookie`, f.name, cookieArt(f), 'cookies', '$36 for six')).join('')}</div>
    <div class="group-head"><h4>Muffins</h4><p>$5 each, six at a time</p></div>
    <div class="tiles">${FLAVORS.map(f => tile(`${f.id}-muffin`, f.name, muffinArt(f), 'muffins', '$30 for six')).join('')}</div>`;
  $('#loaf-pick').innerHTML = row('loaf', 'Upside-down salted caramel banana bread', '#C99A62', 'loaves');
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
  const zone = ZONES.find(z => z.id === document.querySelector('input[name="zone"]:checked').value);
  const fee = delivery ? zone.fee : 0;
  const total = subtotal + fee;
  return { items, cookies: count.cookie, muffins: count.muffin, loaves: count.loaf, subtotal, delivery, zone, fee, total };
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
  $('#sum-delivery-label').textContent = t.delivery ? 'Hand delivery' : 'Pickup';
  $('#zones').hidden = !t.delivery;
  $('#mode-note').textContent = t.delivery
    ? `Hand delivered by me, on orders of $${DELIVERY_MINIMUM} or more.`
    : 'Pickup in Austin is always free.';
  $('#sum-total').textContent = money(t.total);

  const status = $('#sum-status');
  status.textContent = issue || 'Your order is ready for event details.';
  status.classList.toggle('ok', !issue);
  $('#to-details').setAttribute('aria-disabled', issue ? 'true' : 'false');
  $('#address-field').hidden = !t.delivery;

  renderFormOrder(t, issue);
  renderStage(t);
  renderWizard(t);
  const count = $('#nav-count');
  count.textContent = t.items + t.loaves;
  count.classList.remove('bump');
  void count.offsetWidth;
  count.classList.add('bump');
}

function renderWizard(t) {
  document.querySelectorAll('.size').forEach(b => b.classList.toggle('is-active', Number(b.dataset.size) === boxSize));
  const target = boxSize || MINIMUM;
  $('#fill-bar').style.width = `${Math.min(t.items / target, 1) * 100}%`;
  let fill = 'Tap a flavor to add six. Mix cookies and muffins any way you like.';
  if (boxSize && t.items >= boxSize) fill = `Your ${sizeName(boxSize)} box is full. Beautifully done.`;
  else if (boxSize && t.items > 0) fill = `${t.items} of ${boxSize} in. Room for ${boxSize - t.items} more.`;
  else if (boxSize) fill = `Your ${sizeName(boxSize)} box has room for ${boxSize}. Tap a flavor to add six.`;
  $('#fill-note').textContent = fill;
  $('#wizard').classList.toggle('is-full', Boolean(boxSize) && t.items >= boxSize);

  const lines = orderLines();
  $('#review').innerHTML = lines.length
    ? lines.map(l => `<li><span>${l.text}</span><span>${money(l.cost)}</span></li>`).join('')
    : '<li class="review-empty"><span>Your box is empty for now.</span></li>';
  let note = '';
  if (boxSize && t.items > 0 && t.items < boxSize) {
    note = `There's room for ${boxSize - t.items} more in your ${sizeName(boxSize)} box. Fill it in step II, or order it as it is.`;
  }
  $('#review-note').textContent = note;
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
  lines.push(`<li><span>${t.delivery ? `Hand delivery, ${t.zone.label}` : 'Pickup in Austin'}</span><span>${money(t.fee)}</span></li>`);
  lines.push(`<li class="form-total"><span>Total</span><span>${money(t.total)}</span></li>`);
  box.innerHTML = `<ul>${lines.join('')}</ul>`;
}

// A small note that slides up whenever something lands in the box.
function toast(message) {
  let shelf = $('#toasts');
  if (!shelf) {
    shelf = document.createElement('div');
    shelf.id = 'toasts';
    shelf.className = 'toasts';
    shelf.setAttribute('aria-live', 'polite');
    document.body.append(shelf);
  }
  const note = document.createElement('p');
  note.className = 'toast';
  note.textContent = message;
  shelf.append(note);
  while (shelf.children.length > 3) shelf.firstElementChild.remove();
  setTimeout(() => note.classList.add('is-leaving'), 2600);
  setTimeout(() => note.remove(), 3100);
}

const flavorName = key => (key === 'loaf' ? 'banana bread' : FLAVORS.find(f => key.startsWith(f.id)).name);
const plural = (n, kind) => (kind === 'loaf' ? (n === 1 ? 'loaf' : 'loaves') : `${kind}${n === 1 ? '' : 's'}`);

function addToBox(key, n) {
  setQty(key, qty[key] + n);
  activePreset = null;
  render();
  const kind = kindOf(key);
  toast(kind === 'loaf' ? 'A loaf of banana bread is in your box' : `Six ${flavorName(key)} ${plural(n, kind)} added`);
}

document.addEventListener('click', e => {
  const sizeBtn = e.target.closest('[data-size]');
  if (sizeBtn) {
    boxSize = Number(sizeBtn.dataset.size);
    activePreset = null;
    render();
    if (boxSize) {
      toast(`A ${sizeName(boxSize)} box it is`);
      goStep(2);
    } else {
      goStep(3);
    }
    return;
  }
  const stepBtn = e.target.closest('.wizard-steps [data-step]');
  if (stepBtn) {
    goStep(Number(stepBtn.dataset.step));
    return;
  }
  if (e.target.closest('#step-next')) {
    if (step === 1 && boxSize === null) {
      toast('Choose a size to begin');
      return;
    }
    goStep(step + 1);
    return;
  }
  if (e.target.closest('#step-back')) {
    goStep(step - 1);
    return;
  }
  const btn = e.target.closest('.stepper button, .tile-art');
  if (btn) {
    const key = btn.dataset.key;
    const stepSize = KINDS[kindOf(key)].step;
    const dir = Number(btn.dataset.dir);
    if (dir > 0) {
      const items = totals().items;
      if (kindOf(key) !== 'loaf' && boxSize && items + stepSize > boxSize) {
        if (btn.closest('#wizard')) {
          toast(`Your ${sizeName(boxSize)} box is full. Choose a bigger size to add more.`);
          $('#wizard').classList.add('nudge');
          setTimeout(() => $('#wizard').classList.remove('nudge'), 600);
          return;
        }
        boxSize = fitSize(items + stepSize);
      }
      addToBox(key, stepSize);
    } else {
      setQty(key, Math.max(0, qty[key] - step));
      activePreset = null;
      render();
    }
    return;
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    const items = totals().items + 6;
    if (boxSize === null || items > boxSize) boxSize = fitSize(items);
    addToBox(add.dataset.add, 6);
    return;
  }
  const preset = e.target.closest('[data-preset]');
  if (preset) {
    applyPreset(preset.dataset.preset);
    toast(`${PRESETS.find(p => p.id === preset.dataset.preset).name} is in your box`);
    goStep(2, false);
    if (!preset.classList.contains('preset')) $('#order').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (e.target.closest('[data-add-loaf]')) {
    addToBox('loaf', 1);
    goStep(3, false);
    $('#order').scrollIntoView({ behavior: 'smooth' });
  }
});

// The menu: on wide screens each flavor gets the whole screen as you scroll.
const FLAVOR_TINTS = ['#E8D6C0', '#EBD5BB', '#E3D2BE', '#EDD6C6'];
const NUMERALS = ['I', 'II', 'III', 'IV'];

function setUpShowcase() {
  const wrap = $('.flavors');
  if (!wrap) return;
  const cards = [...wrap.querySelectorAll('.flavor')];

  cards.forEach((card, i) => {
    const copy = document.createElement('div');
    copy.className = 'flavor-copy';
    [...card.children].filter(el => !el.matches('figure, h3')).forEach(el => copy.append(el));
    const id = FLAVORS[i].id;
    copy.insertAdjacentHTML('beforeend', `
      <div class="flavor-add">
        <button type="button" class="add-btn" data-add="${id}-cookie">Add six cookies</button>
        <button type="button" class="add-btn add-btn-line" data-add="${id}-muffin">Add six muffins</button>
      </div>`);
    card.append(copy);
    const fabric = card.querySelector('.photo-script .fabric');
    if (fabric) card.insertAdjacentHTML('afterbegin', `<span class="flavor-word" aria-hidden="true">${fabric.textContent.trim()}</span>`);
    card.querySelector('.flavor-photo')?.insertAdjacentHTML('afterend', '<span class="flavor-shadow" aria-hidden="true"></span>');
  });

  const stage = document.createElement('div');
  stage.className = 'flavors-stage';
  stage.append(...cards);
  stage.insertAdjacentHTML('beforeend', `
    <p class="flavors-count" aria-hidden="true"><span id="flavor-num">I</span> / IV</p>
    <div class="flavors-dots">${cards.map((c, i) => `<button type="button" data-goto="${i}"><span>${NUMERALS[i]}</span>${FLAVORS[i].name}</button>`).join('')}</div>`);
  wrap.append(stage);

  const wide = window.matchMedia('(min-width: 900px) and (min-height: 600px)');
  let current = -1;

  const show = i => {
    if (i === current) return;
    current = i;
    cards.forEach((card, j) => card.classList.toggle('is-active', j === i));
    stage.querySelectorAll('[data-goto]').forEach((dot, j) => dot.classList.toggle('is-active', j === i));
    stage.style.setProperty('--tint', FLAVOR_TINTS[i]);
    $('#flavor-num').textContent = NUMERALS[i];
  };

  const onScroll = () => {
    if (!wrap.classList.contains('is-pinned')) return;
    const rect = wrap.getBoundingClientRect();
    const travel = rect.height - window.innerHeight;
    const progress = Math.min(Math.max(-rect.top / travel, 0), 0.999);
    show(Math.floor(progress * cards.length));
  };

  const mode = () => {
    wrap.classList.toggle('is-pinned', wide.matches);
    current = -1;
    if (wide.matches) onScroll();
  };

  stage.addEventListener('click', e => {
    const dot = e.target.closest('[data-goto]');
    if (!dot) return;
    const travel = wrap.offsetHeight - window.innerHeight;
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + travel * ((Number(dot.dataset.goto) + 0.5) / cards.length), behavior: 'smooth' });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  wide.addEventListener('change', mode);
  mode();
}

document.addEventListener('change', e => {
  if (e.target.matches('input[name="fulfil"], input[name="zone"]')) render();
});

// Event details
const form = $('#order-form');
// Every order is baked fresh, so bake days open three days out.
const LEAD_DAYS = 3;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const firstDay = new Date();
firstDay.setHours(0, 0, 0, 0);
firstDay.setDate(firstDay.getDate() + LEAD_DAYS);
form.date.min = ymd(firstDay);

function buildDays() {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(firstDay);
    d.setDate(d.getDate() + i);
    return d;
  });
  $('#day-strip').innerHTML = days.map(d => `
    <button type="button" class="day" data-day="${ymd(d)}" aria-label="${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}">
      <span>${d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
      <strong>${d.getDate()}</strong>
      <em>${d.toLocaleDateString('en-US', { month: 'short' })}</em>
    </button>`).join('');
}

const markDay = () => document.querySelectorAll('.day').forEach(b => b.classList.toggle('is-active', b.dataset.day === form.date.value));

$('#day-strip').addEventListener('click', e => {
  const day = e.target.closest('.day');
  if (!day) return;
  form.date.value = day.dataset.day;
  form.date.classList.remove('invalid');
  $('#form-error').textContent = '';
  markDay();
});
form.date.addEventListener('change', markDay);
buildDays();

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
  if (form.date.value && form.date.value < form.date.min) {
    form.date.classList.add('invalid');
    error.textContent = 'Please choose a bake day at least three days from today.';
    return;
  }
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
    `${t.delivery ? `Hand delivery, ${t.zone.label}` : 'Pickup'}: ${money(t.fee)}`,
    `Total: ${money(t.total)}`,
  ].join('\n');
  const body = [
    `Name: ${data.name}`, `Email: ${data.email}`, `Phone: ${data.phone}`,
    `Company or occasion: ${data.occasion || ''}`, `Event date: ${data.date}`, `Time: ${data.time || ''}`,
    t.delivery ? `Delivery address: ${data.address}` : 'Pickup',
    `Notes: ${data.notes || ''}`, '', summary,
  ].join('\n');

  const subject = `Order request for ${data.date}`;
  const mailto = `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (CHECKOUT_ENDPOINT) {
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Opening secure checkout';
    try {
      const res = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: qty, fulfil: t.delivery ? 'delivery' : 'pickup', zone: t.zone.id, details: data }),
      });
      const reply = await res.json();
      if (!res.ok || !reply.url) throw new Error(reply.error || '');
      window.location.href = reply.url;
    } catch (err) {
      error.innerHTML = `${err.message || "Checkout didn't open."} Please try again, or <a href="${mailto}">email your order</a> to ${ORDER_EMAIL}.`;
      button.disabled = false;
      button.textContent = label;
    }
    return;
  }
  if (FORM_ENDPOINT) {
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Sending';
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...data, order: summary, _subject: subject }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // If the form service is down, the order can still reach me by email.
      error.innerHTML = `Your request didn't go through. Please try again, or <a href="${mailto}">email your order</a> to ${ORDER_EMAIL}.`;
      button.disabled = false;
      button.textContent = label;
      return;
    }
  } else {
    window.location.href = mailto;
  }

  form.hidden = true;
  $('#thanks').hidden = false;
  $('#thanks').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// With checkout live, the form speaks about paying now instead of an invoice later.
if (CHECKOUT_ENDPOINT) {
  document.querySelectorAll('[data-checkout]').forEach(el => { el.textContent = el.dataset.checkout; });
}

// The phone summary bar shows only while the builder is on screen.
new IntersectionObserver(([entry]) => {
  $('#mini-bar').classList.toggle('is-on', entry.isIntersecting);
  document.body.classList.toggle('bar-on', entry.isIntersecting);
}, { rootMargin: '-30% 0px -30% 0px' }).observe($('.builder'));

setUpShowcase();
buildSizes();
buildPresets();
buildZones();
buildList();
render();
goStep(1, false);

// A box chosen on the holidays page arrives as ?box=<id>.
const chosen = new URLSearchParams(location.search).get('box');
if (PRESETS.some(p => p.id === chosen)) {
  applyPreset(chosen);
  goStep(4, false);
}

// On the hero, a silk brocade surfaces wherever the cursor moves, like light on fabric.
(() => {
  const hero = $('.hero');
  if (!hero || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const brocade = document.createElement('div');
  brocade.className = 'brocade';
  brocade.setAttribute('aria-hidden', 'true');
  hero.prepend(brocade);
  hero.addEventListener('pointermove', e => {
    const box = hero.getBoundingClientRect();
    brocade.style.setProperty('--mx', `${e.clientX - box.left}px`);
    brocade.style.setProperty('--my', `${e.clientY - box.top}px`);
    brocade.classList.add('is-lit');
  });
  hero.addEventListener('pointerleave', () => brocade.classList.remove('is-lit'));
})();
