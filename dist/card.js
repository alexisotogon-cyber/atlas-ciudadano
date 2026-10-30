const SVG_NS = 'http://www.w3.org/2000/svg';
const swaps = new WeakMap();
const bounded = value => Math.max(0, Math.min(100, Number(value) || 0));

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}
function svgElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}
function button(action, text, label) {
  const el = element('button', `pcard__button pcard__button--${action}`, text);
  el.type = 'button';
  el.dataset.act = action;
  if (label) el.setAttribute('aria-label', label);
  return el;
}
function bar(value, className) {
  const el = element('div', className);
  const fill = element('span');
  fill.style.width = `${bounded(value)}%`;
  el.append(fill);
  el.setAttribute('aria-hidden', 'true');
  return el;
}

// Cada fila representa ocho píxeles; los rectángulos heredan currentColor.
const pixels = {
  mujer: ['00111000', '00111000', '00010000', '01111100', '00111000', '01111100', '00101000', '00101000'],
  hombre: ['00111000', '00111000', '00010000', '01111100', '01010100', '00010000', '00101000', '00101000'],
  joven: ['00000000', '00111000', '00111000', '00010000', '00111000', '01010100', '00101000', '00101000'],
  mayor: ['00111000', '00101000', '00111000', '00010000', '00111110', '00101010', '00101010', '00101010']
};
function icon(kind) {
  const svg = svgElement('svg', { viewBox: '0 0 8 8', 'aria-hidden': 'true', class: 'pcard__icon' });
  (pixels[kind] || pixels.joven).forEach((row, y) => {
    [...row].forEach((pixel, x) => {
      if (pixel === '1') svg.append(svgElement('rect', { x, y, width: 1, height: 1, fill: 'currentColor' }));
    });
  });
  return svg;
}
function silhouette(model) {
  if (!model?.d || !Array.isArray(model.b) || model.b.length !== 4) return null;
  const [x0, y0, x1, y1] = model.b.map(Number);
  if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) return null;
  const dx = (x1 - x0) * .06, dy = (y1 - y0) * .06;
  const svg = svgElement('svg', { class: 'pcard__silhouette', 'aria-hidden': 'true',
    viewBox: `${x0 - dx} ${y0 - dy} ${x1 - x0 + 2 * dx} ${y1 - y0 + 2 * dy}` });
  svg.append(svgElement('path', { d: model.d, 'vector-effect': 'non-scaling-stroke' }));
  return svg;
}
function sparkline(trend = [], labels = {}) {
  // El margen superior e inferior conserva los círculos completos en 0 y 100.
  const svg = svgElement('svg', { class: 'pcard__trend', viewBox: '0 0 280 54',
    role: 'img', 'aria-label': labels.history || 'Historial de participación' });
  const title = svgElement('title');
  title.textContent = trend.map(p => `${p.year}, ${p.kind}: ${p.value == null ? (labels.noData || 'sin datos') : `${p.value} %`}${p.current ? (labels.current || ' (actual)') : ''}`).join('; ');
  svg.append(title, svgElement('line', { x1: 12, x2: 268, y1: 22, y2: 22, class: 'pcard__gridline' }));
  const x = i => trend.length <= 1 ? 140 : 12 + i * 256 / (trend.length - 1);
  const y = value => 38 - bounded(value) * .32;
  const valid = trend.map((p, i) => ({ ...p, x: x(i) }))
    .filter(p => p.value != null && Number.isFinite(Number(p.value)));
  if (valid.length) svg.append(svgElement('polyline', {
    points: valid.map(p => `${p.x},${y(p.value)}`).join(' '), class: 'pcard__trendline' }));
  trend.forEach((p, i) => {
    if (p.value != null && Number.isFinite(Number(p.value))) {
      svg.append(svgElement('circle', { cx: x(i), cy: y(p.value), r: p.current ? 3.6 : 2.5,
        class: `pcard__point${['Intermedia', 'Midterm'].includes(p.kind) ? ' pcard__point--hollow' : ''}` }));
    }
    const label = svgElement('text', { x: x(i), y: 52, 'text-anchor': 'middle' });
    label.textContent = `'${String(p.year).slice(-2)}`;
    svg.append(label);
  });
  return svg;
}

export function renderCard(host, model, { direction = 0, motionTiming = options => options } = {}) {
  const labels = model.labels || {};
  const previous = swaps.get(host);
  if (previous) previous.animations.forEach(animation => animation.cancel());
  const old = previous?.card?.parentNode === host ? previous.card : host.querySelector('.pcard');
  // Conserva sólo la tarjeta más reciente al interrumpir un cambio anterior.
  host.querySelectorAll('.pcard').forEach(card => { if (card !== old) card.remove(); });

  const card = element('article', `pcard${model.tier >= 5 ? ' holo' : ''}`);
  card.style.setProperty('--c', model.color || '#c084fc');
  card.setAttribute('aria-label', labels.rate || `${model.name}, ${model.rate} % de participación`);
  const header = element('header', 'pcard__header');
  header.append(element('span', 'pcard__pill', model.num),
    element('span', 'pcard__pill pcard__election', `${model.kind} ${model.year}`),
    button('close', '×', labels.close || 'Volver a todo México'));

  const art = element('div', 'pcard__art');
  const img = element('img');
  img.alt = ''; img.loading = 'eager'; img.decoding = 'async';
  img.addEventListener('error', () => { art.classList.add('pcard__art--fallback'); img.remove(); }, { once: true });
  if (model.img) img.src = model.img; else art.classList.add('pcard__art--fallback');
  if (model.img) art.append(img);
  const shape = silhouette(model.silhouette);
  if (shape) art.append(shape);

  const body = element('div', 'pcard__body');
  const nameRow = element('div', 'pcard__name-row');
  const names = element('div');
  names.append(element('h2', 'pcard__name', model.name), element('p', 'pcard__capital', model.capital));
  nameRow.append(names, element('span', 'pcard__rank', model.rank));

  const hp = element('section', 'pcard__hp');
  const rateRow = element('div', 'pcard__rate-row');
  const rate = element('div', 'pcard__rate', model.rateDisplay ?? model.rate);
  rate.append(element('span', 'pcard__percent', '%'));
  rateRow.append(rate, element('p', 'pcard__rate-text', model.rateText));
  hp.append(rateRow, bar(model.rate, 'pcard__bar'));
  if (model.delta) hp.append(element('p', `pcard__delta${model.delta.sign > 0 ? ' pcard__delta--positive' : model.delta.sign < 0 ? ' pcard__delta--negative' : ''}`, model.delta.text));

  const stats = element('div', 'pcard__stats');
  for (const stat of model.stats || []) {
    const item = element('div', 'pcard__stat');
    item.style.setProperty('--stat', stat.color || model.color || '#c084fc');
    item.append(icon(stat.icon), element('span', 'pcard__stat-label', stat.label),
      element('strong', 'pcard__stat-value', stat.text), bar(stat.value, 'pcard__stat-bar'));
    stats.append(item);
  }
  const footer = element('footer', 'pcard__footer');
  footer.append(element('p', 'pcard__gender', model.gender), sparkline(model.trend, labels));
  if (model.note) footer.append(element('p', 'pcard__note', model.note));
  body.append(nameRow, hp, stats, footer);
  const actions = element('nav', 'pcard__actions');
  actions.setAttribute('aria-label', labels.actions || 'Acciones del estado');
  actions.append(button('prev', '‹', labels.prev || 'Estado anterior'), button('mpios', labels.mpios || 'Ver municipios'),
    button('share', labels.share || 'Compartir'), button('next', '›', labels.next || 'Estado siguiente'));
  card.append(header, art, body, actions);
  host.append(card);

  const state = { card, animations: [] };
  swaps.set(host, state);
  if (!card.animate) { old?.remove(); return; }
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sign = Math.sign(direction);
  const incoming = reduced ? [{ opacity: 0 }, { opacity: 1 }] : [
    { opacity: 0, transform: sign ? `perspective(900px) translateX(${sign * 40}px) rotateY(${-sign * 70}deg)` : 'scale(.96)' },
    { opacity: 1, transform: sign ? 'perspective(900px) translateX(0) rotateY(0)' : 'scale(1)' }
  ];
  if (old) {
    old.classList.add('pcard--leaving');
    old.setAttribute('aria-hidden', 'true');
    old.inert = true;
    const outgoing = reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
      { opacity: 1, transform: 'perspective(900px) translateX(0) rotateY(0)' },
      { opacity: 0, transform: sign ? `perspective(900px) translateX(${-sign * 40}px) rotateY(${sign * 70}deg)` : 'scale(.96)' }
    ];
    const animation = old.animate(outgoing, motionTiming({ duration: reduced ? 150 : 260, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' }));
    animation.onfinish = () => { old.remove(); animation.cancel(); };
    state.animations.push(animation);
  }
  const entering = card.animate(incoming, motionTiming({ duration: reduced ? 150 : 340, easing: 'cubic-bezier(.2,.7,.2,1)' }));
  state.animations.push(entering);
}
