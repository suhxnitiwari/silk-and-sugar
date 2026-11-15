// Draws the cookies, muffins and loaf shown in the box preview as SVG symbols.
// Chunks are irregular shards (hand-chopped, never chips) and every shape is
// seeded, so the art looks the same on every visit.

const TREAT_ART = {
  hazelnut: {
    dough: ['#9A6A4C', '#6E4733', '#43281B'],
    bits: [
      { color: '#22110A', count: 7, size: 7, sides: 5 },
      { color: '#CFA273', count: 5, size: 4.5, sides: 7 },
    ],
  },
  butterscotch: {
    dough: ['#E7BA80', '#C88D52', '#90592A'],
    bits: [
      { color: '#93541F', count: 6, size: 5.5, sides: 4 },
      { color: '#B36A28', count: 4, size: 6.5, sides: 9, soft: true },
    ],
    specks: { color: '#FFFDF7', count: 12, size: 1.5 },
  },
  double: {
    dough: ['#62392A', '#41251A', '#25130C'],
    bits: [
      { color: '#120804', count: 8, size: 7, sides: 5 },
      { color: '#BE8F60', count: 5, size: 5, sides: 7 },
    ],
  },
  strawberry: {
    dough: ['#F5CDD0', '#E2A6AD', '#B9787F'],
    bits: [
      { color: '#FFF7EC', count: 7, size: 6.5, sides: 5 },
      { color: '#E6B465', count: 9, size: 3, sides: 6, soft: true },
    ],
    specks: { color: '#B8394E', count: 9, size: 1.7 },
  },
};

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = n => n.toFixed(1);

function shard(rand, cx, cy, size, sides, soft) {
  const turn = rand() * Math.PI * 2;
  const jitter = soft ? 0.18 : 0.42;
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = turn + (i / sides) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const d = size * (1 - jitter + rand() * jitter * 2);
    pts.push(`${f1(cx + Math.cos(a) * d)},${f1(cy + Math.sin(a) * d)}`);
  }
  return pts.join(' ');
}

function spot(rand, cx, cy, radius) {
  const a = rand() * Math.PI * 2;
  const d = Math.sqrt(rand()) * radius;
  return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
}

function wobblyCircle(rand, cx, cy, r, wobble, points = 30) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const d = r + (rand() - 0.5) * wobble;
    pts.push(`${f1(cx + Math.cos(a) * d)},${f1(cy + Math.sin(a) * d)}`);
  }
  return pts.join(' ');
}

function gradient(id, [light, mid, dark]) {
  return `<radialGradient id="${id}" cx="38%" cy="32%" r="75%">
    <stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/>
  </radialGradient>`;
}

function topping(rand, art, cx, cy, radius, scale = 1) {
  let out = '';
  art.bits.forEach(bit => {
    for (let i = 0; i < bit.count; i++) {
      const [x, y] = spot(rand, cx, cy, radius);
      out += `<polygon points="${shard(rand, x, y, bit.size * scale, bit.sides, bit.soft)}" fill="${bit.color}"/>`;
      out += `<circle cx="${f1(x - bit.size * scale * 0.3)}" cy="${f1(y - bit.size * scale * 0.3)}" r="${f1(bit.size * scale * 0.22)}" fill="#fff" opacity=".18"/>`;
    }
  });
  if (art.specks) {
    for (let i = 0; i < art.specks.count; i++) {
      const [x, y] = spot(rand, cx, cy, radius + 2);
      const s = art.specks.size;
      out += `<rect x="${f1(x)}" y="${f1(y)}" width="${s}" height="${s}" fill="${art.specks.color}" transform="rotate(${Math.round(rand() * 90)} ${f1(x)} ${f1(y)})"/>`;
    }
  }
  return out;
}

function cracks(rand, cx, cy, radius, color) {
  let out = '';
  for (let i = 0; i < 6; i++) {
    const [x, y] = spot(rand, cx, cy, radius);
    const a = rand() * Math.PI;
    const l = 6 + rand() * 9;
    out += `<path d="M${f1(x)} ${f1(y)} q${f1(Math.cos(a) * l * 0.5 + 3)} ${f1(Math.sin(a) * l * 0.5 - 3)} ${f1(Math.cos(a) * l)} ${f1(Math.sin(a) * l)}" stroke="${color}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".35"/>`;
  }
  return out;
}

function cookieSymbol(id, art, seed) {
  const rand = seeded(seed);
  return `<symbol id="t-cookie-${id}" viewBox="0 0 100 100">
    <defs>${gradient(`g-cookie-${id}`, art.dough)}</defs>
    <ellipse cx="51" cy="55" rx="43" ry="41" fill="#000" opacity=".22"/>
    <polygon points="${wobblyCircle(rand, 50, 50, 42, 4)}" fill="url(#g-cookie-${id})"/>
    ${cracks(rand, 50, 50, 30, art.dough[2])}
    ${topping(rand, art, 50, 50, 31)}
  </symbol>`;
}

function muffinSymbol(id, art, seed) {
  const rand = seeded(seed);
  let pleats = '';
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    pleats += `<line x1="${f1(50 + Math.cos(a) * 39)}" y1="${f1(50 + Math.sin(a) * 39)}" x2="${f1(50 + Math.cos(a) * 47)}" y2="${f1(50 + Math.sin(a) * 47)}" stroke="#CDB58F" stroke-width="1"/>`;
  }
  let bumps = '';
  for (let i = 0; i < 5; i++) {
    const [x, y] = spot(rand, 50, 50, 20);
    bumps += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(9 + rand() * 6)}" fill="${art.dough[0]}" opacity=".35"/>`;
  }
  return `<symbol id="t-muffin-${id}" viewBox="0 0 100 100">
    <defs>${gradient(`g-muffin-${id}`, art.dough)}</defs>
    <circle cx="51" cy="54" r="46" fill="#000" opacity=".2"/>
    <circle cx="50" cy="50" r="47" fill="#EADCC4"/>
    ${pleats}
    <polygon points="${wobblyCircle(rand, 50, 49, 40, 5, 36)}" fill="url(#g-muffin-${id})"/>
    ${bumps}
    ${cracks(rand, 50, 49, 28, art.dough[2])}
    ${topping(rand, art, 50, 49, 29, 1.15)}
  </symbol>`;
}

function loafSymbol() {
  const rand = seeded(91);
  let crumbs = '';
  for (let i = 0; i < 26; i++) {
    const x = 26 + rand() * 148;
    const y = 24 + rand() * 52;
    crumbs += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(0.8 + rand() * 1.4)}" fill="#5A3416" opacity=".45"/>`;
  }
  const banana = (y, flip) => `
    <path d="M24 ${y} C 64 ${y - 24 * flip}, 136 ${y - 24 * flip}, 176 ${y}
             C 136 ${y + 12 * flip}, 64 ${y + 12 * flip}, 24 ${y} Z" fill="#F2D58F" stroke="#B9752E" stroke-width="3.5"/>
    <path d="M40 ${y - 3 * flip} C 76 ${y - 15 * flip}, 124 ${y - 15 * flip}, 160 ${y - 3 * flip}" stroke="#C99247" stroke-width="1.4" fill="none" stroke-dasharray="2 5"/>`;
  return `<symbol id="t-loaf" viewBox="0 0 200 100">
    <defs>
      <linearGradient id="g-loaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B07335"/><stop offset=".5" stop-color="#8A5224"/><stop offset="1" stop-color="#5E3315"/></linearGradient>
      <linearGradient id="g-glaze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE2A8" stop-opacity=".45"/><stop offset=".5" stop-color="#E7A24F" stop-opacity=".1"/><stop offset="1" stop-color="#FFE2A8" stop-opacity=".3"/></linearGradient>
    </defs>
    <rect x="12" y="16" width="180" height="76" rx="14" fill="#000" opacity=".22"/>
    <rect x="8" y="10" width="184" height="78" rx="14" fill="url(#g-loaf)"/>
    ${crumbs}
    ${banana(42, 1)}
    ${banana(58, -1)}
    <rect x="8" y="10" width="184" height="78" rx="14" fill="url(#g-glaze)"/>
  </symbol>`;
}

function mountTreats() {
  let seed = 7;
  const symbols = Object.entries(TREAT_ART).map(([id, art]) =>
    cookieSymbol(id, art, (seed += 13)) + muffinSymbol(id, art, (seed += 13))).join('') + loafSymbol();
  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.setAttribute('aria-hidden', 'true');
  holder.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  holder.innerHTML = symbols;
  document.body.prepend(holder);
}

mountTreats();
