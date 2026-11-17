// Fades sections and cards up as they scroll into view. Content stays visible
// without JavaScript, and motion is skipped for people who prefer less of it.
(() => {
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('motion-ready');
  if (calm || !('IntersectionObserver' in window)) return;

  // The logo, menu links and order button ease in one after another on load.
  document.querySelectorAll('.announce, .brand, .nav a').forEach((el, i) => {
    el.style.setProperty('--i', i);
    el.classList.add('load-in');
  });

  // Headings, text and buttons inside a block cascade in one by one.
  const groups = [
    '.section-head > *', '.chapter-head > *', '.price-line', '.flavor', '.promise', '.occasion', '.steps li',
    '.loaf-inner > *', '.label-grid > div', '.statement', '.about-intro-head > *', '.about-intro-body > *',
    '.collage > *', '.about-kitchen > .arch', '.about-kitchen-text > *', '.about-cta > *', '.footer-cols > div',
    '.pantry-list li', '.free-of', '.chapter-facts', '.bundle', '.chapter-note', '.chapter-date', '.holiday-close > *',
    '.mode-wrap', '.holiday-hero > *',
  ];
  const targets = document.querySelectorAll(groups.join(','));
  targets.forEach(el => {
    const siblings = [...el.parentElement.children].filter(c => c.matches(groups.join(',')));
    el.style.setProperty('--stagger', `${Math.min(Math.max(siblings.indexOf(el), 0), 8) * 110}ms`);
    el.classList.add('reveal');
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  targets.forEach(el => io.observe(el));
})();

// Between pages the box folds shut over the screen, then opens on arrival.
(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fold = document.createElement('div');
  fold.className = 'fold';
  fold.setAttribute('aria-hidden', 'true');
  fold.innerHTML = '<span class="fold-flap fold-top"></span><span class="fold-flap fold-bottom"></span><span class="fold-seal">S&amp;S</span>';
  document.body.append(fold);

  const store = {
    get: () => { try { return sessionStorage.getItem('fold'); } catch { return null; } },
    set: () => { try { sessionStorage.setItem('fold', '1'); } catch { /* private mode */ } },
    clear: () => { try { sessionStorage.removeItem('fold'); } catch { /* private mode */ } },
  };

  const open = () => {
    fold.classList.add('is-on', 'is-shut');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fold.classList.remove('is-shut');
      setTimeout(() => fold.classList.remove('is-on'), 650);
    }));
  };

  if (store.get()) {
    store.clear();
    fold.style.transition = 'none';
    fold.querySelectorAll('*').forEach(el => { el.style.transition = 'none'; });
    fold.classList.add('is-on', 'is-shut');
    requestAnimationFrame(() => {
      fold.querySelectorAll('*').forEach(el => { el.style.transition = ''; });
      setTimeout(open, 250);
    });
  }

  window.addEventListener('pageshow', e => {
    if (e.persisted) fold.classList.remove('is-on', 'is-shut');
  });

  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || !/\.html$|\/$/.test(url.pathname)) return;
    e.preventDefault();
    fold.classList.add('is-on');
    requestAnimationFrame(() => fold.classList.add('is-shut'));
    setTimeout(() => { store.set(); location.href = url.href; }, 750);
  });
})();

