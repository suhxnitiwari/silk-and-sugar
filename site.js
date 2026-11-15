// Shared touches for every page: the holiday order deadline in the top bar,
// the countdowns on the holidays page and the slowly turning seal in the corner.

// Each season's last day to order. Change a date here and every page follows.
const SEASONS = [
  { id: 'thanksgiving', name: 'Thanksgiving', closes: '2026-11-22T23:59:00', closesText: 'Sunday, November 22' },
  { id: 'christmas', name: 'Christmas', closes: '2026-12-16T23:59:00', closesText: 'Wednesday, December 16' },
];

const msLeft = season => new Date(season.closes) - Date.now();
const daysLeft = season => Math.ceil(msLeft(season) / 864e5);
const onHome = () => Boolean(document.getElementById('order'));

function leftText(season) {
  const days = daysLeft(season);
  if (days <= 1) return 'Last day to order';
  return `${days} days left`;
}

function seasonBar() {
  const season = SEASONS.find(s => msLeft(s) > 0);
  const bar = document.querySelector('.announce');
  if (!season || !bar) return;
  bar.innerHTML = `<a href="holidays.html#${season.id}">${season.name} orders close ${season.closesText}<span class="announce-sep" aria-hidden="true"></span>${leftText(season)}</a>`;
}

function countdowns() {
  SEASONS.forEach(season => {
    const open = msLeft(season) > 0;
    document.querySelectorAll(`[data-countdown="${season.id}"]`).forEach(el => {
      el.textContent = open
        ? `${daysLeft(season) <= 1 ? 'Today is the last day to order' : `Orders close in ${daysLeft(season)} days`}, on ${season.closesText}`
        : `${season.name} orders are closed`;
    });
    const chapter = document.getElementById(season.id);
    if (chapter && !open) {
      chapter.classList.add('is-closed');
      chapter.querySelectorAll('.bundle-link').forEach(link => {
        link.setAttribute('aria-disabled', 'true');
        link.textContent = 'Orders closed';
      });
    }
  });
}

function seal() {
  const link = document.createElement('a');
  link.className = 'seal-badge';
  link.href = onHome() ? '#order' : 'index.html#order';
  link.setAttribute('aria-label', 'Order from Silk and Sugar');
  link.innerHTML = `
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id="seal-circle" d="M60 60 m-45 0 a45 45 0 1 1 90 0 a45 45 0 1 1 -90 0" />
        <linearGradient id="gold-seal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#F8E2C8" />
          <stop offset=".45" stop-color="#E0B587" />
          <stop offset=".75" stop-color="#B98955" />
          <stop offset="1" stop-color="#8C5F35" />
        </linearGradient>
      </defs>
      <g class="seal-ring">
        <text><textPath href="#seal-circle" textLength="280" lengthAdjust="spacing">Baked fresh — Silk &amp; Sugar — Austin —</textPath></text>
      </g>
      <svg x="38" y="35" width="44" height="50" viewBox="0 0 200 220" overflow="visible">
        <g fill="url(#gold-seal)">
          <text x="80" y="130" class="mono-s">S</text>
          <text x="122" y="198" class="mono-s mono-cut">S</text>
          <text x="104" y="150" class="mono-amp mono-cut">&amp;</text>
        </g>
      </svg>
    </svg>`;
  document.body.append(link);
}

seasonBar();
countdowns();
seal();
