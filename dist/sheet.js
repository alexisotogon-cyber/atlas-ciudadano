import { t } from './i18n.js?v=80';

// Hoja móvil: alturas reales, arrastre directo y avisos al terminar cada ajuste.
export function mountSheet({ sheet, handle, onChange = () => {}, isNarrow, onSwipe = () => {} }) {
  const mq = matchMedia('(max-width: 860px)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stage = document.querySelector('#stage');
  const rail = document.querySelector('.rail');
  const body = sheet.querySelector('#detail-body');
  const stops = ['peek', 'half', 'full'];
  const summary = document.createElement('div');
  summary.className = 'sheet-summary';
  summary.setAttribute('role', 'heading');
  summary.setAttribute('aria-level', '1');
  let detent = 'peek', heights, drag = null, timer, frame, suppressClick = false;
  const enabled = () => (isNarrow ? isNarrow() : mq.matches) && document.body.classList.contains('mode-map');
  const visible = () => enabled() && !document.body.matches('.demoing,.gaming,.presenting');
  function measure() {
    const title = body.querySelector('h1,h2,.d-title,.tc-name');
    // Nombre y cifra principal: lo mínimo para entender la ficha sin abrirla
    const pct = body.querySelector('.d-hero')?.textContent.trim().match(/^[\d.,]+\s?%/)?.[0];
    summary.textContent = (title?.textContent || '') + (pct ? ` · ${pct}` : '');
    const heading = title ? parseFloat(getComputedStyle(title).lineHeight) || title.offsetHeight : 32;
    const vh = document.querySelector('.atlas').clientHeight;
    const railHeight = rail.getBoundingClientRect().height;
    const nav = sheet.querySelector('.sheet-nav');
    heights = { peek: nav ? handle.offsetHeight + nav.offsetHeight + 4 : Math.max(120, Math.min(150, handle.offsetHeight + heading + 32)), half: vh * .48, full: Math.max(150, vh - 72 - railHeight) };
    heights.half = Math.max(heights.peek, Math.min(heights.full, heights.half));
    sheet.style.setProperty('--sheet-rail', `${railHeight}px`);
  }
  function paint(height) {
    sheet.style.setProperty('--sheet-h', `${height}px`);
  }
  function follow() {
    if (!visible()) return;
    stage.style.setProperty('--sheet-top-offset', `${Math.max(0, stage.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top)}px`);
    if (sheet.classList.contains('sheet-settling') || drag?.active) frame = requestAnimationFrame(follow);
  }
  function finish() {
    clearTimeout(timer);
    if (!enabled()) return;
    sheet.classList.remove('sheet-settling');
    follow();
    if (visible()) onChange(detent);
  }
  function labels() {
    handle.setAttribute('aria-expanded', String(detent !== 'peek'));
    handle.dataset.i18nAria = detent === 'peek' ? 'sheet.expand' : 'sheet.collapse';
    handle.setAttribute('aria-label', t(handle.dataset.i18nAria));
  }
  function set(next, { instant = false } = {}) {
    if (!enabled() || !stops.includes(next)) return;
    clearTimeout(timer); cancelAnimationFrame(frame);
    measure(); detent = next;
    if (!summary.isConnected) handle.after(summary);
    sheet.dataset.detent = next;
    sheet.classList.toggle('open', next !== 'peek');
    sheet.classList.remove('sheet-dragging');
    sheet.classList.toggle('sheet-instant', instant || motion.matches);
    sheet.classList.add('sheet-settling');
    labels(); paint(heights[next]);
    if (next === 'peek') body.scrollTop = 0;
    follow();
    if (instant || motion.matches) finish();
    else timer = setTimeout(finish, 300);
  }
  sheet.addEventListener('transitionend', e => {
    if (enabled() && e.target === sheet && e.propertyName === 'height' && sheet.classList.contains('sheet-settling')) finish();
  });
  sheet.addEventListener('pointerdown', e => {
    if (!visible() || e.button !== 0 || drag) return;
    const nav = sheet.querySelector('.sheet-nav');
    const top = e.clientY < (nav || handle).getBoundingClientRect().bottom + 8;
    if (!top && (!body.contains(e.target) || body.scrollTop > 0)) return;
    const control = !handle.contains(e.target) && e.target.closest('button,input,a,select,textarea,summary');
    if (control && !nav?.contains(e.target)) return;
    measure();
    drag = { id: e.pointerId, x: e.clientX, axis: null, control: !!control, y: e.clientY, lastY: e.clientY, time: e.timeStamp, velocity: 0, height: sheet.getBoundingClientRect().height, active: false, top, capture: handle.contains(e.target) ? handle : sheet };
  });
  sheet.addEventListener('pointermove', e => {
    if (!visible() || !drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    // El eje se decide una sola vez; un gesto horizontal nunca arrastra la hoja.
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.axis = drag.top && Math.abs(dx) > 1.5 * Math.abs(dy) ? 'x' : 'y';
    }
    if (drag.axis === 'x') { drag.capture.setPointerCapture(e.pointerId); e.preventDefault(); return; }
    if (drag.control) return;
    if (!drag.active) {
      if (!drag.top && (dy < -6 || body.scrollTop > 0)) { drag = null; return; }
      if (!drag.top && dy <= 6) return;
      drag.active = true; drag.capture.setPointerCapture(e.pointerId); sheet.classList.add('sheet-dragging');
    }
    e.preventDefault();
    const dt = e.timeStamp - drag.time;
    if (dt > 0) drag.velocity = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY; drag.time = e.timeStamp;
    paint(Math.max(heights.peek, Math.min(heights.full, drag.height - dy)));
    cancelAnimationFrame(frame); follow();
  });
  // Safari necesita cancelar el desplazamiento nativo solo al tirar hacia abajo desde el inicio.
  sheet.addEventListener('touchmove', e => {
    if (visible() && (drag?.axis === 'x' || (drag?.active && (drag.top || e.touches[0]?.clientY > drag.y)))) e.preventDefault();
  }, { passive: false });
  function release(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag; drag = null;
    if (!enabled()) return;
    if (d.capture.hasPointerCapture(e.pointerId)) d.capture.releasePointerCapture(e.pointerId);
    if (d.axis === 'x') {
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 300);
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (e.type === 'pointerup' && Math.abs(dx) >= 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
      return;
    }
    if (!d.active) return;
    const moved = Math.abs(e.clientY - d.y) > 6;
    if (!moved && e.type === 'pointerup') { sheet.classList.remove('sheet-dragging'); return; }
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 400);
    const h = sheet.getBoundingClientRect().height;
    let next = stops.reduce((a, b) => Math.abs(heights[a] - h) < Math.abs(heights[b] - h) ? a : b);
    if (e.type !== 'pointercancel' && e.timeStamp - d.time < 100 && Math.abs(d.velocity) > .5) {
      const direction = d.velocity < 0 ? 1 : -1;
      next = stops[Math.max(0, Math.min(2, stops.indexOf(detent) + direction))];
    }
    set(next);
  }
  sheet.addEventListener('pointerup', release);
  sheet.addEventListener('pointercancel', release);
  sheet.addEventListener('click', e => {
    if (visible() && suppressClick) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  handle.addEventListener('click', e => {
    if (!mq.matches) return;
    if (document.body.classList.contains('mode-home')) {
      const open = sheet.classList.toggle('open');
      handle.setAttribute('aria-expanded', String(open));
      return;
    }
    if (!enabled()) return;
    if (suppressClick) { e.preventDefault(); return; }
    set(stops[(stops.indexOf(detent) + 1) % 3]);
  });
  function sync() {
    if (enabled()) set(document.body.classList.contains('in-state') ? 'half' : 'peek', { instant: true });
    else {
      clearTimeout(timer); cancelAnimationFrame(frame); drag = null; summary.remove();
      ['--sheet-h', '--sheet-rail'].forEach(k => sheet.style.removeProperty(k));
      stage.style.removeProperty('--sheet-top-offset');
      sheet.classList.remove('sheet-dragging', 'sheet-settling', 'sheet-instant', 'open');
      delete sheet.dataset.detent;
      handle.dataset.i18nAria = 'sheet.toggle';
      handle.setAttribute('aria-label', t('sheet.toggle'));
      handle.setAttribute('aria-expanded', 'false');
    }
  }
  new MutationObserver(() => {
    if (!enabled()) return;
    const previous = heights?.[detent]; measure(); labels();
    if (heights[detent] !== previous) set(detent, { instant: true });
  }).observe(body, { childList: true });
  new MutationObserver(() => { if (enabled() !== summary.isConnected) sync(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', () => { if (enabled()) set(detent, { instant: true }); });
  mq.addEventListener('change', sync);
  document.addEventListener('pc-language-change', () => { if (enabled()) labels(); });
  if (mq.matches) sync();
  return { set, get detent() { return detent; } };
}
