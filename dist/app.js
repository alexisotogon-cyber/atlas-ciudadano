// Coloca aquí el dominio público al desplegar.
const SITE_URL = 'https://atlasciudadano.nodobravo.mx';
import { mountSheet } from './sheet.js?v=83';
import { icon } from './icons.js?v=83';
import { t, lang, locale, setLang, applyStatic, diff1 } from './i18n.js?v=83';
// Pixel Ciudadano · Atlas ciudadano (INE, CCPC 2009–2024). Equipo Pixel Ciudadano.
// Layout "Atlas": menú lateral · tira de estados · objeto central (globo → mapa) · ficha de detalle.
import { mountGlobe } from './globe.js?v=83';
import { renderCard } from './card.js?v=83';
import { startDemo } from './demo.js?v=83';
import { mountYou } from './you.js?v=83';
import { startTutorial } from './tutorial.js?v=83';
import { openShareSheet } from './share.js?v=83';

const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const fmt = { format: value => Number(value).toLocaleString(locale()) };
const rounded = value => Math.round(value * 10) / 10;
const urlText = SITE_URL || (location.hostname === 'localhost' || location.hostname.startsWith('127.') ? '' : location.host);
const publicURL = () => urlText ? (SITE_URL || location.origin + location.pathname) : '';
const shareFooter = () => urlText || t('fix.searchSite');
const localTypes = (cc = S.cc) => t(cc === '09' ? 'text.alcaldias' : 'fix.municipios');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrowMq = matchMedia('(max-width: 860px)');
const narrow = () => narrowMq.matches;
narrowMq.addEventListener('change', () => renderDetail());
let mobileSheet = null;

const SEX_LABEL = { get todos() { return t("text.1"); }, get mujeres() { return t("text.2"); }, get hombres() { return t("text.3"); } };
const SEX_IDX = { todos: [0, 1, 2], mujeres: [1], hombres: [0] };   // 2 = no binario (2024), cuenta en "Todos"
const AGE_LABEL = ['18–29', '30–44', '45–59', '60+'];
const KIND = { get 2009() { return t("text.4"); }, get 2012() { return t("text.5"); }, get 2015() { return t("text.4"); }, get 2018() { return t("text.5"); }, get 2021() { return t("text.4"); }, get 2024() { return t("text.5"); } };
const NAMES = { '09': 'Ciudad de México', '05': 'Coahuila', '15': 'Estado de México', '16': 'Michoacán', '30': 'Veracruz' };
const CAPITAL = { '01': 'Aguascalientes', '02': 'Mexicali', '03': 'La Paz', '04': 'Campeche', '05': 'Saltillo', '06': 'Colima', '07': 'Tuxtla Gutiérrez', '08': 'Chihuahua', '09': 'Ciudad de México', '10': 'Durango', '11': 'Guanajuato', '12': 'Chilpancingo', '13': 'Pachuca', '14': 'Guadalajara', '15': 'Toluca', '16': 'Morelia', '17': 'Cuernavaca', '18': 'Tepic', '19': 'Monterrey', '20': 'Oaxaca de Juárez', '21': 'Puebla', '22': 'Querétaro', '23': 'Chetumal', '24': 'San Luis Potosí', '25': 'Culiacán', '26': 'Hermosillo', '27': 'Villahermosa', '28': 'Ciudad Victoria', '29': 'Tlaxcala', '30': 'Xalapa', '31': 'Mérida', '32': 'Zacatecas' };
const ART = { '01': 'Jardín de San Marcos', '02': 'viñedos del Valle de Guadalupe', '03': 'el Hongo de Balandra', '04': 'la ciudad amurallada', '05': 'dunas de Cuatro Ciénegas', '06': 'Comala y el Volcán de Fuego', '07': 'el Cañón del Sumidero', '08': 'Barrancas del Cobre', '09': 'el Palacio de Bellas Artes', '10': 'Mexiquillo', '11': 'la ciudad de colores', '12': 'Taxco', '13': 'los Prismas Basálticos', '14': 'campos de agave de Tequila', '15': 'Teotihuacán', '16': 'Janitzio', '17': 'Tepoztlán', '18': 'Mexcaltitán', '19': 'Monterrey y la Sierra Madre', '20': 'Hierve el Agua', '21': 'Cholula', '22': 'los arcos de Querétaro', '23': 'Tulum', '24': 'la cascada de Tamul', '25': 'el malecón de Mazatlán', '26': 'El Pinacate', '27': 'el Parque Museo La Venta', '28': 'Tampico', '29': 'Ocotlán', '30': 'El Tajín', '31': 'el cenote Ik Kil', '32': 'la catedral de cantera rosa' };
const REGIONS = [
  { k: 'noroeste', get n() { return t("text.6"); }, cc: ['02', '03', '26', '25', '08', '10'] },
  { k: 'noreste', get n() { return t("text.7"); }, cc: ['05', '19', '28', '24'] },
  { k: 'occidente', get n() { return t("text.8"); }, cc: ['14', '18', '06', '16', '01', '32'] },
  { k: 'centro', get n() { return t("text.9"); }, cc: ['09', '15', '13', '17', '21', '29', '22', '11'] },
  { k: 'sur', get n() { return t("text.10"); }, cc: ['12', '20', '07'] },
  { k: 'sureste', get n() { return t("text.11"); }, cc: ['30', '27', '04', '31', '23'] },
];

// Escala de 9 clases tipo "plasma": violeta (votó poca gente) → dorado claro (votó mucha). Cortes fijos entre años.
const EDGES = [40, 45, 50, 55, 60, 65, 70, 75];
const COLORS = ['#4b3a99', '#6a34b8', '#8f2fc0', '#b53aa8', '#dc4f86', '#f4725f', '#fb9f3f', '#fcd34d', '#fff1a8'];
const tierOf = r => EDGES.filter(e => r >= e).length;
const colorFor = r => r == null ? 'url(#nodata)' : COLORS[tierOf(r)];
const solidFor = r => r == null ? '#5a5070' : COLORS[tierOf(r)];
const rankTag = n => t(n <= 5 ? 'rank.top5' : n <= 10 ? 'rank.top10' : 'rank.place', { n });

const S = { mode: 'home', year: 2024, sex: 'todos', age: null, cc: null, mpio: null, region: null, spot: null, list: false, order: 'desc', q: '' };
let OFFICIAL, GEO, DATA, YEARS, CODES, NAT, view, raf = 0, playTimer = 0, globe = null, mission = null, picker = null;
const mpioCache = new Map();
let mpios = [];

/* ---------- cálculo ---------- */
const subgroup = (sex, age) => sex !== 'todos' || age != null;
function calc(flat, sex = S.sex, age = S.age, min = subgroup(sex, age) ? 100 : 25) {
  if (!flat) return { b: 0, s: 0, r: null };
  let b = 0, s = 0;
  for (const sx of SEX_IDX[sex]) for (const a of (age == null ? [0, 1, 2, 3] : [age])) { const i = (sx * 4 + a) * 2; b += flat[i] || 0; s += flat[i + 1] || 0; }
  return { b, s, r: b >= min && s > 0 ? 100 * s / b : null };   // s = 0: no hubo votación registrada → sin dato
}
const stateFlat = (cc, y = S.year) => DATA.states[cc][y];
function natFlat(y) {
  if (!NAT[y]) { const t = new Array(24).fill(0); for (const cc of CODES) stateFlat(cc, y).forEach((v, i) => t[i] += v); NAT[y] = t; }
  return NAT[y];
}
function regionFlat(k, y = S.year) { const t = new Array(24).fill(0); for (const cc of REGIONS.find(r => r.k === k).cc) stateFlat(cc, y).forEach((v, i) => t[i] += v); return t; }
const stateRates = (y = S.year, sex = S.sex, age = S.age) => CODES.map(cc => ({ cc, ...calc(stateFlat(cc, y), sex, age) }));
const mpioCalc = (m, y = S.year, sex, age) => calc(m.y && m.y[y], sex, age);
const natRate = (y = S.year, sx = S.sex, ag = S.age) => calc(natFlat(y), sx, ag);
const nameOf = cc => NAMES[cc] || GEO[cc].n;
const prevSame = y => YEARS.find(v => v === y - 6);
function wilson(s, b) {   // rango al 95 % para bases pequeñas (volatilidad, no muestreo)
  if (!b) return null; const p = s / b, z = 1.96, d = 1 + z * z / b, c = p + z * z / (2 * b), h = z * Math.sqrt(p * (1 - p) / b + z * z / (4 * b * b));
  return [100 * (c - h) / d, 100 * (c + h) / d];
}

/* ---------- lenguaje llano ---------- */
const one = r => Number(r).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
function share(r) {
  if (r < 42 || r >= 58) return t('share.n', { n: Math.round(r / 10).toLocaleString(locale()) });
  if (r < 48) return t('text.16');
  if (r < 52) return t('text.17');
  if (r < 55) return t('text.18');
  return t('text.19');
}
const isHalf = s => /mitad|half/.test(s);
const group = (sex = S.sex, age = S.age) => {
  const who = t(sex === 'mujeres' ? 'group.women' : sex === 'hombres' ? 'group.men' : 'group.people');
  return age == null ? who : t('group.age', { group: who, age: AGE_LABEL[age] });
};
function voted(r, who) { const value = share(r); return t(isHalf(value) ? 'voted.half' : 'voted.n', { share: value, who }); }
const diffText = (a, b, ref) => { const d = diff1(a, b); return t(Math.abs(d) < .05 ? 'diff.equal' : d > 0 ? 'diff.above' : 'diff.below', { n: one(Math.abs(d)), ref }); };
const people = n => n >= 1e6 ? t('people.million', { n: one(n / 1e6) }) : fmt.format(n);
const genderLine = (f, age = S.age) => { const m = calc(f, 'mujeres', age).r, h = calc(f, 'hombres', age).r; return m == null || h == null ? '' : t('gender.line', { women: one(m / 10), men: one(h / 10) }); };

/* ---------- mapa ---------- */
const stage = $('#stage'), svg = $('#map'), gStates = $('#g-states'), gMpios = $('#g-mpios');
const svgEl = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
const union = bs => [Math.min(...bs.map(b => b[0])), Math.min(...bs.map(b => b[1])), Math.max(...bs.map(b => b[2])), Math.max(...bs.map(b => b[3]))];
function targetView(b) {
  const W = stage.clientWidth, H = stage.clientHeight;
  let top = 20, bottom = 104, left = 76, right = 28;
  if (narrow()) {   // en celular la ficha es una hoja inferior que tapa parte del centro
    const sb = stage.getBoundingClientRect(), db = $('#detail').getBoundingClientRect();
    const dk = document.body.classList.contains('demoing') && $('#mission .demo-dock:not(.demo-dock--final)');   // en la demo manda la hoja de Pixel
    top = 60; left = right = 12; const sheetTop = db.height ? db.top : sb.bottom;   // la ficha se oculta durante la demo y el juego
    // En la demo cuenta lo más alto entre la hoja y la cabeza de Pixel; en el juego, el panel de la pregunta
    const px = dk && $('#stage .demo-stage-pixel:not([hidden])'), gp = document.body.classList.contains('gaming') && $('#mission .mission__panel');
    let limit = dk ? Math.min(sheetTop, dk.getBoundingClientRect().top) : sheetTop;
    if (px && px.getBoundingClientRect().height) limit = Math.min(limit, px.getBoundingClientRect().top);
    if (gp && gp.getBoundingClientRect().height) limit = Math.min(limit, gp.getBoundingClientRect().top);
    if (dk) top = 28;
    const hud = gp && $('#mission .mission__hud');
    if (hud) top = Math.max(top, hud.getBoundingClientRect().bottom - sb.top + 8);
    bottom = Math.max(16, sb.bottom - limit + (S.mode === 'map' && !document.body.matches('.demoing,.gaming,.presenting') ? 52 : 8));
  }
  // En el juego: la barra superior y el panel de la pregunta no deben tapar el mapa
  if (document.body.classList.contains('gaming') && !narrow()) {
    const sb = stage.getBoundingClientRect(), hud = $('#mission .mission__hud'), pan = $('#mission .mission__panel');
    if (hud) top = Math.max(top, hud.getBoundingClientRect().bottom - sb.top + 12);
    if (pan) {
      const pb = pan.getBoundingClientRect(), bw = b[2] - b[0], bh = b[3] - b[1];
      const fit = (l, bt) => Math.min((W - l - right) / bw, (H - top - bt) / bh);
      const sideL = pb.right - sb.left + 16, sideB = sb.bottom - pb.top + 12;
      if (fit(sideL, 24) >= fit(left, sideB)) { left = sideL; bottom = 24; } else bottom = sideB;
    }
  }
  const uw = Math.max(120, W - left - right), uh = Math.max(120, H - top - bottom);
  const k = Math.min(uw / (b[2] - b[0]), uh / (b[3] - b[1])) * (S.cc ? .92 : .97);
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  return { x: cx - (left + uw / 2) / k, y: cy - (top + uh / 2) / k, w: W / k, h: H / k, k };
}
const setView = v => { view = v; svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); scaleLabels(); };
/* Etiquetas de los estados resaltados: nombre y %, en píxeles de pantalla (máximo 3) */
const gLabels = $('#g-labels');
function scaleLabels() { if (view && gLabels) for (const g of gLabels.children) g.setAttribute('transform', `translate(${g.dataset.x} ${g.dataset.y}) scale(${1 / view.k})`); }
function paintSpotLabels(list = S.spot) {
  if (!gLabels) return;
  gLabels.replaceChildren();
  if (!list || !list.length || list.length > 3 || S.cc) return;
  list.forEach((cc, idx) => {
    const b = GEO[cc].b, r = calc(stateFlat(cc)).r, txt = `${nameOf(cc)} · ${r == null ? t('card.noData') : one(r) + '\u00a0%'}`;
    const g = svgEl('g', { class: 'spot-label' }); const below = idx % 2 === 1;   // se alternan arriba y abajo del estado para no encimarse
    g.dataset.x = (b[0] + b[2]) / 2; g.dataset.y = below ? b[3] : b[1];
    const w = 14 + txt.length * 7.4;
    g.append(svgEl('rect', { x: -w / 2, y: below ? 14 : -40, width: w, height: 26 }));
    const tx = svgEl('text', { x: 0, y: below ? 31.5 : -22.5, 'text-anchor': 'middle' }); tx.textContent = txt; g.append(tx);
    gLabels.append(g);
  });
  scaleLabels();
}
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
let mobileFlightDone = null;
function animateView(to, ms) {
  if (narrow()) { mobileFlightDone?.(); mobileFlightDone = null; }
  if (narrow()) ms = Math.min(ms, 300);
  cancelAnimationFrame(raf);
  if (!view || reduced || !ms) { setView(to); return Promise.resolve(); }
  const from = { ...view }, t0 = performance.now();
  return new Promise(res => {
    if (narrow()) mobileFlightDone = res;
    const f = now => {
      const t = Math.min(1, (now - t0) / ms), e = ease(t);
      setView({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: from.h + (to.h - from.h) * e, k: to.k });
      if (t < 1) raf = requestAnimationFrame(f); else { if (narrow()) mobileFlightDone = null; res(); }
    };
    raf = requestAnimationFrame(f);
  });
}
const natBox = () => union(CODES.map(c => GEO[c].b));
const activeBox = () => S.cc ? GEO[S.cc].b : S.region ? union(REGIONS.find(r => r.k === S.region).cc.map(c => GEO[c].b)) : natBox();
const flyTo = (b, ms = 750) => animateView(targetView(b), ms);
// Une los estados resaltados con 15 % de margen y sin acercar más de 4× respecto al país
function spotBox(list) {
  const u = union(list.map(c => GEO[c].b)), n = natBox();
  let w = (u[2] - u[0]) * 1.3, h = (u[3] - u[1]) * 1.3;
  const mw = (n[2] - n[0]) / 4, mh = (n[3] - n[1]) / 4; w = Math.max(w, mw); h = Math.max(h, mh);
  const cx = (u[0] + u[2]) / 2, cy = (u[1] + u[3]) / 2;
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
}

function buildStates() {
  CODES.forEach((cc, i) => { const p = svgEl('path', { d: GEO[cc].d, 'data-cc': cc }); p.style.setProperty('--i', i); gStates.append(p); });
}
function paintStates() {
  const rates = stateRates(), reg = S.region && REGIONS.find(r => r.k === S.region).cc;
  for (const p of gStates.children) {
    const cc = p.dataset.cc, r = rates[+cc - 1].r;
    p.style.fill = colorFor(r);
    p.classList.toggle('current', cc === S.cc);
    p.classList.toggle('dim', (!!S.spot && !S.spot.includes(cc)) || (!S.spot && !!reg && !reg.includes(cc)));
    p.classList.toggle('spot', !!S.spot && S.spot.includes(cc));
  }
  for (const p of gStates.querySelectorAll('.spot')) gStates.append(p);   // el contorno resaltado queda encima
  paintSpotLabels();
}
function paintMpios() {
  for (const p of gMpios.children) {
    const m = mpios[+p.dataset.i], r = mpioCalc(m).r;
    p.style.fill = colorFor(r);
    p.classList.toggle('sel', S.mpio === m.id);
  }
}
async function loadMpios(cc) {
  if (!mpioCache.has(cc)) mpioCache.set(cc, fetch(`assets/mpios/${cc}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  return mpioCache.get(cc);
}
async function showMpios(cc) {
  gMpios.classList.add('fade');
  try {
    const list = await loadMpios(cc);
    if (S.cc !== cc) return;
    mpios = list; gMpios.replaceChildren();
    list.forEach((m, i) => gMpios.append(svgEl('path', { d: m.d, 'data-i': i })));
    paintMpios(); renderDetail(); renderCaption();
    requestAnimationFrame(() => gMpios.classList.remove('fade'));
  } catch (e) { console.warn(e); notice(t("text.25")); }
}
let noticeT = 0;
function notice(t) { const n = $('#notice'); n.textContent = t; n.hidden = !t; clearTimeout(noticeT); if (t) noticeT = setTimeout(() => n.hidden = true, 3500); }
const say = t => { const s = $('#sr'); if (s) { s.textContent = ''; setTimeout(() => s.textContent = t, 30); } };

/* ---------- navegación ---------- */
async function selectState(cc, { instant = false, keepRegion = false } = {}) {
  if (S.mode === 'home') await enterMap({ instant: true });
  const detent = narrow() && S.cc && cc ? mobileSheet?.detent : null;
  S.cc = cc; S.mpio = null; S.list = false; S.q = '';
  if (cc && !keepRegion && S.region && !REGIONS.find(r => r.k === S.region).cc.includes(cc)) S.region = null;
  document.body.classList.toggle('in-state', !!cc);
  mpios = []; gMpios.replaceChildren();
  markStrip(true);
  paintStates(); renderAll(); writeHash();
  if (cc) say(`${nameOf(cc)}: ${one(calc(stateFlat(cc)).r)}${t("text.26")}`);
  if (narrow()) { $('#detail-body').scrollTop = 0; mobileSheet?.set(detent || (cc ? 'half' : 'peek')); }
  const fly = flyTo(activeBox(), instant ? 0 : 750);
  const sm = cc ? showMpios(cc) : null;
  await fly; await sm;
}
function selectMpio(id, { focus = true } = {}) {
  $('#tooltip').hidden = true;
  S.mpio = S.mpio === id ? null : id;
  paintMpios();
  const sel = gMpios.querySelector('.sel'); if (sel) gMpios.append(sel);
  renderDetail(); renderCaption(); writeHash();
  $('#detail').scrollTop = 0;   // la ficha siempre vuelve arriba al elegir un municipio
  if (narrow()) { $('#detail-body').scrollTop = 0; mobileSheet?.set(S.mpio ? 'half' : 'peek'); }
  if (focus) { if (!narrow()) $('#detail').classList.add('open'); setTimeout(() => $('#d-title')?.focus({ preventScroll: true }), 60); }
}
function selectRegion(k) {
  S.region = S.region === k ? null : k; S.cc = null; S.mpio = null; S.spot = null;
  document.body.classList.remove('in-state'); mpios = []; gMpios.replaceChildren();
  if (S.mode === 'home') enterMap({});
  paintStates(); renderAll(); writeHash(); flyTo(activeBox());
}
// Orden por clave del INE (01 Aguascalientes … 32 Zacatecas), también dentro de cada región
const byIne = () => CODES.slice().sort();
const visibleCodes = () => S.region ? byIne().filter(cc => REGIONS.find(r => r.k === S.region).cc.includes(cc)) : byIne();
function step(d) {
  const list = visibleCodes(); const i = list.indexOf(S.cc);
  // Sin estado, o con uno fuera de la lista visible: empieza por un extremo. Al llegar al final, da la vuelta.
  if (i === -1) { selectState(list[d > 0 ? 0 : list.length - 1], { keepRegion: true }); return; }
  selectState(list[(i + d + list.length) % list.length], { keepRegion: true });
}
function setFilter(k, v) { S[k] = v; refresh(); }
function setYear(y) { S.year = y; refresh(); }
function refresh() { paintStates(); if (S.cc) paintMpios(); renderAll(); writeHash(); }
// «Ver todo México» visible sobre el mapa solo cuando hay un estado, región o municipio abierto
function syncBack() { const b = $('#back-mx'); if (b) b.hidden = S.mode !== 'map' || !(S.cc || S.region || S.mpio); }
function renderAll() { renderStrip(); renderRegions(); renderFilters(); renderYears(); renderDetail(); renderCaption(); renderFeatured(); syncBack(); }

/* ---------- silueta ---------- */
function silhouette(cc) {
  const [x0, y0, x1, y1] = GEO[cc].b, pad = Math.max(x1 - x0, y1 - y0) * .06;
  return `<svg class="sil" viewBox="${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><path d="${GEO[cc].d}"/></svg>`;
}

/* ---------- tira de cartas ---------- */
const STRIP_NAMES = new Set(['02', '03', '09', '15', '16', '23', '24', '30', '05']);
function buildStrip() {
  const strip = $('#strip');
  byIne().forEach(cc => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'scard'; b.dataset.cc = cc; b.setAttribute('role', 'option'); b.tabIndex = -1;
    b.innerHTML = `<span class="sc-art" style="background-image:url(assets/estados/thumb/${cc}.webp)"><b class="sc-num" aria-hidden="true">${cc}</b></span><span class="sc-top"><span class="nm">${esc(STRIP_NAMES.has(cc) ? t('strip.' + cc) : nameOf(cc))}</span><span class="rt"></span></span>`;
    b.addEventListener('click', () => selectState(S.mode !== 'home' && cc === S.cc ? null : cc, { keepRegion: true }));
    strip.append(b);
  });
  strip.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); strip.scrollLeft += e.deltaY; } }, { passive: false });
  strip.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    else if (e.key === 'Home') { e.preventDefault(); selectState(visibleCodes()[0], { keepRegion: true }); }
  });
}
function renderStrip() {
  const rates = stateRates(), vis = new Set(visibleCodes());
  for (const c of $('#strip').children) {
    const cc = c.dataset.cc, r = rates[+cc - 1].r;
    c.hidden = !vis.has(cc);
    c.querySelector('.nm').textContent = STRIP_NAMES.has(cc) ? t('strip.' + cc) : nameOf(cc);
    c.querySelector('.rt').textContent = r == null ? '—' : `${one(r)}\u00a0%`;
    c.style.setProperty('--c', solidFor(r));

    c.setAttribute('aria-selected', String(cc === S.cc));
    c.setAttribute('aria-label', `${nameOf(cc)}, ${r == null ? t("text.27") : one(r) + t("text.28")}`);
  }
  const reg = S.region && REGIONS.find(r => r.k === S.region);
  $('#strip-title').textContent = reg ? `${t("text.29")}${reg.n}` : t("text.30");
  $('#strip-count').textContent = String(vis.size);
}
function markStrip(center) {
  const strip = $('#strip'), c = S.cc && strip.querySelector(`.scard[data-cc="${S.cc}"]`);
  for (const x of strip.children) x.setAttribute('aria-selected', String(x.dataset.cc === S.cc));
  if (c && center) setTimeout(() => {   // centrar la carta elegida dentro de la tira (sin mover la página)
    const cr = c.getBoundingClientRect(), sr = strip.getBoundingClientRect();
    strip.scrollBy({ left: cr.left - sr.left - (sr.width - cr.width) / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, 60);
}

/* ---------- menú lateral ---------- */
function buildRegions() {
  $('#regions').innerHTML = REGIONS.map(r => `<li><button type="button" class="nav-region" data-region="${r.k}"><i></i><span>${r.n}</span><small>${r.cc.length}${t("text.31")}`).join('');
  $('#regions').addEventListener('click', e => { const b = e.target.closest('[data-region]'); if (b) selectRegion(b.dataset.region); });
  $('#rail-nav').addEventListener('click', e => {
    const b = e.target.closest('[data-nav]'); if (!b) return;
    const n = b.dataset.nav;
    if (n === 'home') goHome(); else if (n === 'map') startTour(); else if (n === 'game') startGame();
  });
}
function renderRegions() {
  for (const b of document.querySelectorAll('.nav-region')) {
    const k = b.dataset.region, r = calc(regionFlat(k)).r;
    b.querySelector('span').textContent = REGIONS.find(x => x.k === k).n;
    b.setAttribute('aria-pressed', String(S.region === k));
    b.querySelector('i').style.background = solidFor(r);
    b.querySelector('small').textContent = `${REGIONS.find(x => x.k === k).cc.length}${t("text.32")}${r == null ? '—' : one(r) + '\u00a0%'}`;
    // Nombre accesible aunque el riel compacto oculte el texto
    b.setAttribute('aria-label', `${REGIONS.find(x => x.k === k).n}, ${b.querySelector('small').textContent}`);
  }
  const cur = S.mode === 'game' ? 'game' : S.mode === 'home' ? 'home' : 'map';
  for (const b of document.querySelectorAll('.nav-item')) { if (b.dataset.nav === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
}
let featIdx = 0, featTimer = 0;
function renderFeatured() {
  const top = stateRates().filter(x => x.r != null).sort((a, b) => b.r - a.r);
  if (!top.length) return;
  const picks = [top[0], top[top.length - 1], top[1]];
  const f = picks[featIdx % picks.length], i = top.indexOf(f);
  const label = i === 0 ? t("text.33") : i === top.length - 1 ? t("text.34") : t("text.35");
  $('#featured').innerHTML = `<p class="feat-k">${label} · ${S.year}</p><div class="feat-art" style="background-image:url(assets/estados/thumb/${f.cc}.webp)"></div><p class="feat-t">${esc(nameOf(f.cc))}</p><p class="feat-d">${cap(voted(f.r, group()))}: <b>${one(f.r)}\u00a0%</b>.</p><button type="button" class="feat-go" data-cc="${f.cc}${t("text.36")}`;
}
function rotateFeatured() { clearInterval(featTimer); if (!reduced) featTimer = setInterval(() => { featIdx++; renderFeatured(); }, 9000); }

/* ---------- filtros, años, leyenda ---------- */
function buildControls() {
  const mk = (host, items, key) => items.forEach(([v, label]) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.v = v; b.textContent = label;
    b.addEventListener('click', () => setFilter(key, v === 'null' ? null : key === 'age' ? +v : v)); host.append(b);
  });
  mk($('#sex'), Object.entries(SEX_LABEL), 'sex');
  mk($('#age'), [['null', t("text.37")], ...AGE_LABEL.map((l, i) => [i, l])], 'age');
  const fb = $('#filters-btn'), fp = $('#filters');
  fb.addEventListener('click', () => { fp.hidden = !fp.hidden; fb.setAttribute('aria-expanded', String(!fp.hidden)); if (!fp.hidden) fp.querySelector('[aria-checked=true]')?.focus(); });
  document.addEventListener('pointerdown', e => { if (!fp.hidden && !e.target.closest('#filters,#filters-btn')) { fp.hidden = true; fb.setAttribute('aria-expanded', 'false'); } });
  $('#y-prev').addEventListener('click', () => { stopPlay(); const i = YEARS.indexOf(S.year); if (i > 0) setYear(YEARS[i - 1]); });
  $('#y-next').addEventListener('click', () => { stopPlay(); const i = YEARS.indexOf(S.year); if (i < YEARS.length - 1) setYear(YEARS[i + 1]); });
  $('#play').addEventListener('click', () => playTimer ? stopPlay() : startPlay());
  renderLegend();
}
function renderLegend() {
  $('#legend').innerHTML = `<b><span class="legend-title-long" data-i18n="legend.title">${t('legend.title')}</span><span class="legend-title-short" data-i18n="legend.short">${t('legend.short')}</span></b><div class="bar">${COLORS.map(c => `<i style="background:${c}"></i>`).join('')}</div><p class="legend-hint">${t('legend.hint')}</p><div class="ticks"><span></span>${EDGES.map(e => `<span>${e}</span>`).join('')}</div><div class="ends"><span data-i18n="legend.less">${t('legend.less')}</span><span class="nd" title="${esc(t('legend.noData'))}"><i></i><span data-i18n="legend.none">${t('legend.none')}</span></span><span data-i18n="legend.more">${t('legend.more')}</span></div>`;
}
function renderFilters() {
  for (const b of $('#sex').children) { b.textContent = SEX_LABEL[b.dataset.v]; b.setAttribute('aria-checked', String(b.dataset.v === S.sex)); }
  for (const b of $('#age').children) b.setAttribute('aria-checked', String(b.dataset.v === String(S.age)));
  $('#age').firstElementChild.textContent = t('text.37');
  $('#filters-dot').hidden = !subgroup(S.sex, S.age);
}
function renderYears() {
  $('#y-val').textContent = S.year; $('#y-kind').textContent = KIND[S.year];
  const i = YEARS.indexOf(S.year); $('#y-prev').disabled = i === 0; $('#y-next').disabled = i === YEARS.length - 1;
}
function startPlay() {
  S.year = YEARS[0]; refresh(); const p = $('#play'); p.classList.add('on'); p.innerHTML = icon('pause'); p.setAttribute('aria-label', t("text.40"));
  playTimer = setInterval(() => { const i = YEARS.indexOf(S.year) + 1; if (i >= YEARS.length) stopPlay(); else setYear(YEARS[i]); }, 2200);
}
function stopPlay() { clearInterval(playTimer); playTimer = 0; const p = $('#play'); p.classList.remove('on'); p.innerHTML = icon('play'); p.setAttribute('aria-label', t("text.41")); }

/* ---------- pie del objeto central ---------- */
function renderCaption() {
  let caption = '';
  if (S.mode === 'home') caption = t('text.42');
  else {
    const m = S.mpio && mpios.find(x => x.id === S.mpio);
    const r = m ? mpioCalc(m).r : S.cc ? calc(stateFlat(S.cc)).r : S.region ? calc(regionFlat(S.region)).r : natRate().r;
    const place = m ? m.n : S.cc ? nameOf(S.cc) : S.region ? REGIONS.find(x => x.k === S.region).n : 'México';
    if (r != null) caption = t('caption.place', { place, voted: voted(r, t('with.id', { group: group() })), year: S.year });
  }
  $('#caption').textContent = caption;
  renderPresentBubble();
}

/* ---------- ficha de detalle ---------- */
function trait(kind, label, value, r, sub = '') {
  return `<li class="trait"><span class="t-ic">${icon(kind)}</span><span class="t-l">${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="t-v">${value}</span>${r != null ? `<span class="t-bar"><i style="width:${Math.max(0, Math.min(100, r))}%"></i></span>` : ''}</li>`;
}
const pct = r => r == null ? '—' : one(r) + '\u00a0%';
/* Cifra destacada de la ficha: número grande, comparación y pictograma, para leerse de un vistazo */
const PERSON = 'M12 1a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M1 39V27a11 11 0 0 1 11-11a11 11 0 0 1 11 11v12z';
function heroStat(r, ref, refName) {
  if (r == null) return '';
  const n = Math.round(r / 10), d = ref != null ? diff1(r, ref) : null;
  const people10 = Array.from({ length: 10 }, (_, i) => `<svg viewBox="0 0 24 40" aria-hidden="true" class="hp${i < n ? ' on' : ''}" style="--i:${i}"><path d="${PERSON}"/></svg>`).join('');
  const dir = d == null ? '' : Math.abs(d) < .05 ? 'eq' : d > 0 ? 'up' : 'down';
  const chip = d == null ? '' : `<span class="hs-chip ${dir}">${dir === 'up' ? '▲' : dir === 'down' ? '▼' : '='} ${dir === 'eq' ? t('hero.equal', { ref: refName }) : t('hero.vs', { n: one(Math.abs(d)), ref: refName })}</span>`;
  return `<div class="home-stat d-hero" style="--c:${solidFor(r)}"><div class="hs-row"><div class="hs-num">${pct(r)}</div>${chip}</div><div class="hs-txt">${t('hero.sub', { n, who: t('with.id', { group: group() }) })}</div><div class="hs-people">${people10}</div></div>`;
}
/* ¿Quién votó?: filas etiquetadas por sexo y edad; la línea marca el total y cada fila filtra el mapa */
function whoVoted(f) {
  const tot = calc(f, 'todos', null).r, w = r => Math.max(0, Math.min(100, r ?? 0));
  const row = (label, r, key, val, on) => `<li><button type="button" class="wv-row${on ? ' on' : ''}" data-f="${key}:${val}" aria-pressed="${on}"><span class="wv-check" aria-hidden="true"></span><span class="wv-l">${label}</span><span class="wv-bar"><i style="width:${w(r)}%"></i>${tot != null ? `<b style="left:${w(tot)}%"></b>` : ''}</span><span class="wv-v">${pct(r)}</span></button></li>`;
  const sex = [['mujeres', t('text.2')], ['hombres', t('text.3')]].map(([k, l]) => row(l, calc(f, k, S.age).r, 's', k, S.sex === k)).join('');
  const age = AGE_LABEL.map((l, a) => row(t('who.ageRow', { a: l }), calc(f, S.sex, a).r, 'a', a, S.age === a)).join('');
  return `<section class="who" aria-label="${t('who.title')}"><h2 class="sec">${t('who.title')}</h2>
    <p class="who-hint"><span class="who-key" aria-hidden="true"></span>${t('who.hint2', { p: pct(tot) })}</p>
    ${subgroup(S.sex, S.age) ? `<p class="who-active"><span>${t('who.active')} <b>${cap(group())}</b></span><button type="button" class="who-clear" data-f="clear">${icon('x')} ${t('who.clear')}</button></p>` : ''}
    <h3 class="who-g">${t('who.sex')}${S.age != null ? ` · ${AGE_LABEL[S.age]}` : ''}</h3><ul class="wv">${sex}</ul>
    <h3 class="who-g">${t('who.age')}${S.sex !== 'todos' ? ` · ${t(S.sex === 'mujeres' ? 'text.2' : 'text.3').toLowerCase()}` : ''}</h3><ul class="wv">${age}</ul></section>`;
}
function bindWho(body) {
  body.querySelectorAll('.wv-row,.who-clear').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.f === 'clear') { S.sex = 'todos'; S.age = null; refresh(); return; }
    const [k, v] = b.dataset.f.split(':');
    if (k === 's') S.sex = S.sex === v ? 'todos' : v; else S.age = S.age === +v ? null : +v;
    refresh();
  }));
}
function spark(get, { ref } = {}) {
  const W = 300, H = 100, X0 = 16, X1 = 284, Y0 = 20, Y1 = 70;
  const x = i => X0 + (X1 - X0) * i / (YEARS.length - 1), yy = v => Y1 - (Y1 - Y0) * (Math.max(30, Math.min(90, v)) - 30) / 60;
  const vals = YEARS.map(get), refs = ref ? YEARS.map(ref) : null;
  const line = a => a.map((v, i) => v == null ? null : `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yy(v).toFixed(1)}`).filter(Boolean).join('');
  let h = `<svg class="spark" viewBox="0 0 ${W} ${H}${t("text.43")}${YEARS.map((y, i) => `${y} ${vals[i] == null ? t("text.27") : one(vals[i]) + '%'}`).join(', ')}">`;
  YEARS.forEach((y, i) => { if (KIND[y] === t("text.4")) h += `<rect x="${x(i) - 19}" y="4" width="38" height="${H - 8}" rx="6" class="mid"/>`; });
  if (refs) h += `<path d="${line(refs)}" class="ref"/>`;
  h += `<path d="${line(vals)}" class="mine"/>`;
  YEARS.forEach((y, i) => {
    const v = vals[i], on = y === S.year;
    if (v != null) h += `<g class="pt${on ? ' on' : ''}" data-y="${y}"><circle cx="${x(i)}" cy="${yy(v)}" r="${on ? 5 : 3.5}"/><text x="${x(i)}" y="${yy(v) - 9}" text-anchor="middle">${one(v)}</text></g>`;
    h += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="yr${on ? ' on' : ''}">${y}</text>`;
  });
  return h + '</svg>';
}
function rankInfo(cc) {
  const rs = stateRates().filter(x => x.r != null).sort((a, b) => b.r - a.r), i = rs.findIndex(x => x.cc === cc);
  const country = natRate().r;
  const tie = [rs[i - 1], rs[i + 1]].filter(x => x && rs[i] && Math.abs(x.r - rs[i].r) < .5 && Math.sign(diff1(x.r, country)) === Math.sign(diff1(rs[i].r, country))).map(x => nameOf(x.cc));
  return { n: i + 1, of: rs.length, tie };
}
/* Las diferencias usan las cifras redondeadas que ve la persona. */
const signedPts = (a, b) => { const d = diff1(a, b); return Math.abs(d) < .05 ? t('diff.equal', { ref: t('fix.reference') }) : t('fix.points', { n: `${d > 0 ? '+' : '−'}${one(Math.abs(d))}` }); };
function officialTrait(scope, y) {
  if (y !== 2024 || !OFFICIAL?.states) return '';
  const codes = scope === 'state' ? [S.cc] : scope === 'region' ? REGIONS.find(x => x.k === S.region).cc : CODES;
  if (!codes.every(cc => Number.isFinite(OFFICIAL.states[cc]?.ln))) return '';
  const ln = codes.reduce((sum, cc) => sum + OFFICIAL.states[cc].ln, 0);
  const base = codes.reduce((sum, cc) => sum + calc(stateFlat(cc, y), 'todos', null).b, 0);
  return trait('id-card', t('trait.official'), fmt.format(ln), null, t('trait.officialHelp')) + `<li class="d-note">${t('fix.baseNote', { ln: fmt.format(ln), dif: fmt.format(ln - base) })}</li>`;
}
function demographicFacts(f, get) {
  const women = calc(f, 'mujeres', S.age).r, men = calc(f, 'hombres', S.age).r;
  const young = calc(f, S.sex, 0).r, old = calc(f, S.sex, 3).r;
  const py = prevSame(S.year), current = get(S.year), previous = py ? get(py) : null;
  return { women, men, young, old, py, current, previous };
}
function detailFacts(scope, f, get, regObj) {
  const d = demographicFacts(f, get);
  const tile = (label, value, sub = '') => `<div class="detail-fact"><span class="df-label">${esc(label)}</span><strong>${esc(value)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  let tiles;
  if (scope === 'region') {
    const rs = stateRates().filter(x => regObj.cc.includes(x.cc) && x.r != null).sort((a, b) => b.r - a.r);
    const extreme = (key, x) => tile(t(key), x ? nameOf(x.cc) : t('card.noData'), x ? pct(x.r) : '');
    tiles = extreme('fact.best', rs[0]) + extreme('fact.worst', rs.at(-1)) + tile(t('fact.states'), fmt.format(regObj.cc.length));
  } else {
    const pair = (label, a, b, key) => tile(label === 'fact.gender' && S.age != null ? t('fix.genderGroup', { age: AGE_LABEL[S.age] }) : label === 'fact.age' && S.sex !== 'todos' ? t('fix.ageGroup', { sex: SEX_LABEL[S.sex] }) : t(label), a == null || b == null ? '—' : scope === 'nat' ? signedPts(a, b) : `${pct(a)} · ${pct(b)}`, a == null || b == null ? '' : scope === 'nat' ? `${pct(a)} · ${pct(b)}` : t(key, { n: signedPts(a, b) }));
    tiles = pair('fact.gender', d.women, d.men, 'fact.womenDelta') + pair('fact.age', d.young, d.old, 'fact.youngDelta');
    tiles += tile(t('fact.change'), d.current != null && d.previous != null ? signedPts(d.current, d.previous) : '—', d.previous != null ? t('fact.previous', { y: d.py, p: pct(d.previous) }) : t('fact.noPrevious'));
  }
  return `<section class="detail-facts" aria-label="${t('fact.title')}">${tiles}</section>`;
}

/* Pixel narra el mapa: cada cambio de vista cancela los temporizadores anteriores. */
let presentTimer = 0, presentFade = 0, presentBubble;
function clearPresentTimers() { clearInterval(presentTimer); clearTimeout(presentFade); presentTimer = presentFade = 0; }
function placePresentBubble() {
  if (!presentBubble || !document.body.classList.contains('presenting')) return;
  const sb = stage.getBoundingClientRect(), db = $('#detail').getBoundingClientRect();
  const overlap = narrow() && db.width && db.left < sb.right && db.right > sb.left ? Math.max(0, sb.bottom - db.top) : 0;
  const back = $('#back-mx');
  stage.style.setProperty('--present-tools-top', `${Math.max(80, back.hidden ? 0 : back.getBoundingClientRect().bottom - sb.top + 14)}px`);
  presentBubble.style.setProperty('--present-bottom', `${Math.max(14, overlap + 14)}px`);
}
function renderPresentBubble() {
  clearPresentTimers();
  if (!document.body.classList.contains('presenting') || !DATA || S.mode === 'home') {
    if (presentBubble) presentBubble.hidden = true;
    return;
  }
  if (!presentBubble) {
    presentBubble = document.createElement('aside');
    presentBubble.className = 'present-bubble';
    stage.append(presentBubble);
    const observer = new ResizeObserver(placePresentBubble);
    observer.observe(stage); observer.observe($('#detail')); observer.observe($('#back-mx'));
    $('#detail').addEventListener('transitionend', placePresentBubble);
  }
  const reg = S.region && REGIONS.find(x => x.k === S.region);
  const municipality = S.mpio && mpios.find(x => x.id === S.mpio);
  const flat = y => municipality ? municipality.y?.[y] : S.cc ? stateFlat(S.cc, y) : reg ? regionFlat(reg.k, y) : natFlat(y);
  const get = y => calc(flat(y)).r, d = demographicFacts(flat(S.year), get);
  const name = municipality ? municipality.n : S.cc ? nameOf(S.cc) : reg ? reg.n : t('place.mexico');
  const facts = [], big = value => `<strong>${esc(value)}</strong>`;
  const add = (key, args) => facts.push(t(key, args));
  if (d.current != null) {
    const rows = municipality ? mpios.map(m => ({ id: m.id, r: mpioCalc(m).r })).filter(x => x.r != null).sort((a, b) => b.r - a.r) : [];
    add(municipality ? 'fix.bubbleLocal' : S.cc ? 'bubble.turnoutRank' : 'bubble.turnout', {
      name: esc(name), p: big(pct(d.current)), y: S.year,
      n: municipality ? rows.findIndex(x => x.id === municipality.id) + 1 : S.cc ? rankInfo(S.cc).n : '', of: rows.length, type: localTypes()
    });
  }
  const ref = municipality ? calc(stateFlat(S.cc)).r : natRate().r;
  const refName = municipality ? nameOf(S.cc) : t(subgroup(S.sex, S.age) ? 'share.countryGroup' : 'share.country');
  if ((S.cc || reg) && d.current != null && ref != null) facts.push(big(diffText(d.current, ref, refName)));
  if (d.women != null && d.men != null) add('fix.bubbleGender', { w: big(pct(d.women)), m: big(pct(d.men)), age: S.age == null ? t('fix.allAges') : AGE_LABEL[S.age], d: big(signedPts(d.women, d.men)) });
  if (d.young != null && d.old != null) add('fix.bubbleAge', { y: big(pct(d.young)), o: big(pct(d.old)), sex: S.sex === 'todos' ? t('fix.allSexes') : SEX_LABEL[S.sex] });
  if (d.current != null && d.previous != null) add('bubble.change', { y: d.py, n: big(signedPts(d.current, d.previous)) });
  if (!facts.length) facts.push(esc(t('card.noData')));
  facts.splice(5);
  presentBubble.hidden = false;
  presentBubble.innerHTML = `<svg class="present-pixel" viewBox="0 0 505 665" aria-hidden="true"><use href="#logo"/></svg><div class="present-speech"><p class="present-title">${esc(name)}${subgroup(S.sex, S.age) ? ` · ${esc(group())}` : ''}</p><div class="present-text" aria-live="polite" aria-atomic="true">${facts[0]}</div><div class="present-dots">${facts.map((_, i) => `<button type="button" aria-label="${esc(t('bubble.fact', { n: i + 1, total: facts.length }))}" aria-pressed="${i === 0}" data-fact="${i}"></button>`).join('')}</div></div>`;
  let index = 0;
  const text = presentBubble.querySelector('.present-text');
  const show = i => {
    clearTimeout(presentFade); index = i;
    const update = () => {
      text.innerHTML = facts[index]; text.classList.remove('is-fading');
      presentBubble.querySelectorAll('[data-fact]').forEach((b, j) => b.setAttribute('aria-pressed', String(index === j)));
      placePresentBubble();
    };
    if (reduced) update();
    else { text.classList.add('is-fading'); presentFade = setTimeout(update, 180); }
  };
  const start = () => {
    clearInterval(presentTimer);
    if (!reduced && facts.length > 1) presentTimer = setInterval(() => {
      if (!presentBubble.matches(':hover, :focus-within') && !document.hidden) show((index + 1) % facts.length);
    }, 6000);
  };
  presentBubble.querySelectorAll('[data-fact]').forEach(b => b.addEventListener('click', () => { show(+b.dataset.fact); start(); }));
  start(); requestAnimationFrame(placePresentBubble);
}

// Los módulos reciben el límite móvil sin cambiar los tiempos de escritorio.
function mobileTiming(options) {
  if (!narrow()) return options;
  return { ...options, duration: reduced ? 0 : Math.min(options.duration || 0, 300), delay: 0 };
}
// La cabecera móvil vive fuera del contenido desplazable y conserva el foco de sus botones.
function renderMobileNav() {
  let nav = $('#sheet-nav');
  const sheet = $('#detail');
  if (!narrow() || S.mode !== 'map' || !(S.cc || S.region)) {
    nav?.remove(); sheet.classList.remove('has-sheet-nav'); return;
  }
  if (!nav) {
    nav = document.createElement('nav'); nav.id = 'sheet-nav'; nav.className = 'sheet-nav';
    nav.innerHTML = '<button type="button" class="sheet-prev">‹</button><div class="sheet-nav-center" aria-live="polite" aria-atomic="true"></div><button type="button" class="sheet-next">›</button>';
    $('.sheet-handle').after(nav);
    nav.querySelector('.sheet-prev').addEventListener('click', () => { if (narrow()) S.mpio ? backToState() : step(-1); });
    nav.querySelector('.sheet-next').addEventListener('click', () => { if (narrow() && !S.mpio) step(1); });
  }
  sheet.classList.add('has-sheet-nav');
  const municipality = S.mpio && mpios.find(m => m.id === S.mpio);
  const region = S.region && REGIONS.find(r => r.k === S.region);
  const name = municipality ? municipality.n : S.cc ? nameOf(S.cc) : region.n;
  const rate = municipality ? mpioCalc(municipality).r : S.cc ? calc(stateFlat(S.cc)).r : calc(regionFlat(S.region, S.year)).r;
  const rank = S.cc && !S.mpio ? rankInfo(S.cc) : null;
  const sub = rank ? t('nav.stateRank', { n: rank.n || '—', of: rank.of, rate: pct(rate) }) : municipality ? nameOf(S.cc) : pct(rate);
  nav.querySelector('.sheet-prev').setAttribute('aria-label', t(S.mpio ? 'nav.backState' : 'nav.prevState'));
  const next = nav.querySelector('.sheet-next'); next.hidden = !!S.mpio;
  next.setAttribute('aria-label', t('nav.nextState'));
  const center = nav.querySelector('.sheet-nav-center');
  const markup = `<div class="sheet-nav-text"><strong role="heading" aria-level="1">${esc(name)}</strong><small>${esc(sub)}</small></div>`;
  if (center.dataset.text !== markup) {
    const old = center.querySelector('.sheet-nav-text')?.cloneNode(true);
    center.dataset.text = markup; center.innerHTML = markup;
    if (old && !reduced) {
      old.classList.add('sheet-nav-out'); old.setAttribute('aria-hidden', 'true'); center.append(old);
      old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).finished.then(() => old.remove());
      center.firstElementChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    }
  }
}
// Se reorganizan nodos solo en móvil; el render de escritorio conserva su marcado.
function compactMobileDetail(body) {
  if (!narrow()) return;
  const who = body.querySelector(':scope > .who');
  if (!who) return;
  const disclosure = document.createElement('details'); disclosure.className = 'who-m';
  disclosure.innerHTML = `<summary>${t('who.title')}<span aria-hidden="true">⌄</span></summary>`;
  who.before(disclosure); disclosure.append(who);
  const chart = body.querySelector(':scope > .spark');
  if (chart) chart.after(disclosure);
  const more = body.querySelector(':scope > .more');
  if (more) disclosure.after(more);
}
function compactMobileHome(body) {
  if (!narrow()) return;
  const blocks = [...body.querySelectorAll(':scope > .home-block')];
  const carousel = document.createElement('div'); carousel.className = 'home-carousel';
  carousel.setAttribute('role', 'region'); carousel.setAttribute('aria-label', t('home.carousel')); carousel.tabIndex = 0;
  blocks[1].before(carousel);
  blocks.slice(1, 4).forEach(block => carousel.append(block));
  blocks[1].querySelector('p').textContent = t('home.challengeShort');
  const insights = carousel.querySelector('.insights');
  const more = document.createElement('details'); more.className = 'insights-more';
  more.innerHTML = `<summary>${t('home.moreInsights')}</summary>`;
  [...insights.children].slice(1).forEach(card => more.append(card)); insights.append(more);
  const actions = blocks[4], disclosure = document.createElement('details'); disclosure.className = 'voting-m';
  disclosure.innerHTML = `<summary>${t('fix.actions')}<span aria-hidden="true">⌄</span></summary>`;
  actions.querySelector('h2').remove(); actions.before(disclosure); disclosure.append(actions);
}
function renderDetail() {
  const body = $('#detail-body'), y = S.year;
  renderMobileNav();
  if (S.mode === 'home') {
    // Portada: cifra protagonista, tres hallazgos que llevan al mapa y un adelanto de 2027
    const nf = natFlat(2024), nat = calc(nf, 'todos', null).r, m = calc(nf, 'mujeres', null).r, h = calc(nf, 'hombres', null).r;
    const hj = calc(nf, 'hombres', 0).r, old = calc(nf, 'todos', 3).r;
    const rs = stateRates(2024).filter(x => x.r != null).sort((a, b) => b.r - a.r), top = rs[0], low = rs[rs.length - 1];
    const y21 = calc(natFlat(2021), 'todos', 0), o21 = calc(natFlat(2021), 'todos', 3).r, extra = (o21 - y21.r) / 100 * y21.b;
    const n10 = Math.round(nat / 10);
    const people10 = Array.from({ length: 10 }, (_, i) => `<svg viewBox="0 0 24 40" aria-hidden="true" class="hp${i < n10 ? ' on' : ''}" style="--i:${i}"><path d="M12 1a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M1 39V27a11 11 0 0 1 11-11a11 11 0 0 1 11 11v12z"/></svg>`).join('');
    const pair = (a, av, b, bv) => `<span class="ins-pair">${[[a, av], [b, bv]].map(([l, v]) => `<span class="ins-row"><span class="ins-l">${l}</span><span class="ins-bar"><i style="width:${v}%;--c:${solidFor(v)}"></i></span><span class="ins-v">${pct(v)}</span></span>`).join('')}</span>`;
    const card = (i, kick, title, viz) => `<button type="button" class="insight" data-act="insight" data-i="${i}"><span class="ins-k">${kick} · 2024</span><span class="ins-t">${title}</span>${viz}<span class="ins-cta">${t('home.see')} ${icon('arrow-right')}</span></button>`;
    // Encabezado sin cifras (las cifras van en "El panorama" con su etiqueta); el d-cta solo se ve en celular
    const head = t("text.48").split('<p class="d-lead">')[0], t49 = t("text.49"), cta = t49.slice(t49.indexOf('<div class="d-cta">'));
    const pics = (r, c) => Array.from({ length: 10 }, (_, i) => `<svg viewBox="0 0 24 40" aria-hidden="true" class="hp${i < Math.round(r / 10) ? ' on' : ''}" style="--i:${i}"><path d="${PERSON}"/></svg>`).join('');
    const kpi = (label, r, sub) => `<div class="home-kpi" style="--c:${solidFor(r)}"><span class="hk-label">${label}</span><span class="hk-num">${pct(r)}</span><span class="hk-sub">${sub}</span><span class="hs-people">${pics(r)}</span></div>`;
    const sec = (n, title) => `<h2 class="home-sec"><span>${n}</span>${title}</h2>`;
    body.innerHTML = `${head.replace(/<p class="eyebrow">.*?<\/p>/, `<p class="eyebrow home-credit">${t('home.creditCompact')}</p>`)}
      <section class="home-block">${sec('01', t('home.s1'))}
        <div class="home-kpis">
          ${kpi(t('home.k24'), nat, t('home.of10', { n: Math.round(nat / 10) }))}
          ${kpi(t('home.k21y'), y21.r, t('home.of10', { n: Math.round(y21.r / 10) }))}
        </div>
        <p class="home-bridge">${t('home.bridge')}</p></section>
      <p class="d-lead">${t('home.lead2')}</p>${cta}${icon('arrow-right')}${t('home.ctaEnd')}
      <section class="home-block">${sec('02', t('home.s2'))}<p>${t('fix.elected')}</p>
        <button type="button" class="teaser" data-act="sim"><span class="ins-k">${t('home.simK2')}</span><span class="tz-num">+${people(extra)}</span><span class="tz-txt">${t('home.simText2')}</span><span class="d-note">${t('fix.method', { b: people(y21.b), o: one(o21), y: one(y21.r) })}</span><span class="ins-cta">${t('home.simCta')} ${icon('arrow-right')}</span></button></section>
      <section class="home-block">${sec('03', t('home.s3'))}
        <button type="button" class="you-cta" data-act="you"><svg class="you-cta-px" viewBox="0 0 505 665" aria-hidden="true"><use href="#logo"/></svg><span><b>${t('you.ctaT')}</b><small>${t('you.ctaS')}</small></span>${icon('arrow-right')}</button></section>
      <section class="home-block">${sec('04', t('home.s4'))}
        <div class="insights">
          ${card(0, t('home.i1k'), t('home.i1t', { top: esc(nameOf(top.cc)), low: esc(nameOf(low.cc)), d: one(diff1(top.r, low.r)) }), pair(esc(nameOf(top.cc)), top.r, esc(nameOf(low.cc)), low.r))}
          ${card(1, t('home.i2k'), t('home.i2t', { d: one(diff1(m, h)) }), pair(t('text.2'), m, t('text.3'), h))}
          ${card(2, t('home.i3k'), t('home.i3t', { d: one(diff1(old, calc(nf, 'todos', 0).r)) }), pair(t('text.65'), calc(nf, 'todos', 0).r, t('home.old'), old))}
        </div></section>${votingActions()}`;
    compactMobileHome(body);
    return;
  }
  if (S.mpio && mpios.length) return renderMpioDetail(body);
  const scope = S.cc ? 'state' : S.region ? 'region' : 'nat';
  const flatFor = yy => scope === 'state' ? stateFlat(S.cc, yy) : scope === 'region' ? regionFlat(S.region, yy) : natFlat(yy);
  const f = flatFor(y), get = (yy, sx = S.sex, ag = S.age) => calc(flatFor(yy), sx, ag).r;
  const now = calc(f), r = now.r, nat = natRate().r, py = prevSame(y), prev = py ? get(py) : null;
  const regObj = S.region && REGIONS.find(x => x.k === S.region);
  const name = scope === 'state' ? nameOf(S.cc) : scope === 'region' ? `${t("text.29")}${regObj.n}` : 'México';
  const filt = subgroup(S.sex, S.age) ? ` · ${cap(group())}` : '';
  let head;
  if (scope === 'state') {
    const rk = rankInfo(S.cc);
    head = `<p class="eyebrow">${t('detail.eyebrow', { kind: KIND[y], year: y, n: rk.n || '—' })}${esc(filt)}</p>
      <article class="tcard" aria-label="${esc(name)}"><div class="tc-art"><img src="assets/estados/${S.cc}.webp" alt="${esc(t('detail.posterAlt', { name, capital: CAPITAL[S.cc], art: ART[S.cc] }))}" decoding="async" width="560" height="840"></div>
      <div class="tc-body"><h1 class="tc-name" id="d-title" tabindex="-1">${esc(name)}</h1><p class="tc-rank">${rk.n ? t(subgroup(S.sex, S.age) ? 'fix.rankGroup' : 'rank.participation', { n: rk.n, group: group() }) : t('card.noData')}</p></div></article>`;
  } else head = `<p class="eyebrow">${KIND[y]} ${y}${esc(filt)}</p>`;
  const ties = scope === 'state' && r != null ? rankInfo(S.cc).tie : [];
  const desc = r == null ? t('text.59') : ties.length ? t('detail.tie', { names: esc(ties.join(t('join.and'))), side: t(diff1(r, nat) > 0 ? 'fix.above' : diff1(r, nat) < 0 ? 'fix.below' : 'fix.at') }) : '';
  const ch = r != null && prev != null ? diff1(r, prev) : null;
  const more = `${t("text.70")}${scope === 'region' && ch != null ? trait('trending-up', `${t("text.67")}${py}`, signedPts(r, prev), null, t('detail.previous', { kind: KIND[y].toLowerCase() })) : ''}${trait('vote', t('fix.counts', { s: fmt.format(now.s), b: fmt.format(now.b) }), '', null)}${trait('id-card', t('trait.base'), fmt.format(now.b), null, t('trait.baseHelp'))}${officialTrait(scope, y)}</ul><p class="d-note">${t("text.71")}`;
  const extra = scope === 'state' ? mpioBlock() : '';
  body.innerHTML = `${head}${scope === 'state' ? '' : `<h1 class="d-title" id="d-title" tabindex="-1">${esc(name)}</h1>`}
    ${heroStat(r, scope === 'nat' ? null : nat, t(subgroup(S.sex, S.age) ? 'hero.countryGroup' : 'hero.country'))}
    ${detailFacts(scope, f, get, regObj)}
    ${desc ? `<p class="d-lead">${desc}</p>` : ''}
    ${whoVoted(f)}
    ${more}${t("text.76")}${spark(yy => get(yy), { ref: scope !== 'nat' ? yy => natRate(yy).r : null })}
    <p class="d-note">${scope !== 'nat' ? t("text.75") : ''}${t("text.77")}${extra}
    ${actionsBar(scope === 'state')}`;
  body.querySelectorAll('.spark .pt').forEach(g => g.addEventListener('click', () => { stopPlay(); setYear(+g.dataset.y); }));
  compactMobileDetail(body);
  bindWho(body);
}
function actionsBar(isState) {
  return `${t("text.80")}${icon('arrow-right')}${t("text.81")}${icon('ellipsis')}${t("text.82")}${isState || S.mpio ? t("text.78") : ''}${isState ? t("text.79") : ''}</div></details></div>`;
}
function mpioBlock() {
  if (!mpios.length) return `<p>${t('fix.searchLocalEmpty', { type: localTypes() })}</p>`;
  const rows = mpios.map(m => ({ m, ...mpioCalc(m) })).filter(x => x.r != null).sort((a, b) => b.r - a.r);
  if (!rows.length) return '';
  const hi = rows[0], lo = rows[rows.length - 1];
  let list = '';
  if (S.list) {
    const q = norm(S.q.trim());
    const shown = rows.map((x, i) => ({ ...x, rank: i + 1 })).filter(x => !q || norm(x.m.n).includes(q));
    if (S.order === 'asc') shown.reverse();
    list = `${t("text.85")}${S.order === 'desc'}${t("text.86")}${S.order === 'asc'}${t("text.87").replace(/Buscar municipio en este estado|Search municipalities in this state/g, t('fix.localSearch', { type: localTypes() }))}${esc(S.q)}"></div>
      <ol class="m-list">${shown.map(x => `<li><button type="button" data-mpio="${x.m.id}" aria-current="${S.mpio === x.m.id}"><span class="n">${x.rank}</span><span class="nm">${esc(x.m.n)}<i style="width:${x.r}%"></i></span><span class="r">${one(x.r)}\u00a0%</span></button></li>`).join('') || t("text.84")}</ol>`;
  }
  return `<button type="button" class="list-toggle" data-act="list" aria-expanded="${S.list}"><span>${S.list ? t('fix.localHide', { type: localTypes() }) : t('fix.localList', { n: rows.length, type: localTypes() })}${t("text.91")}${esc(hi.m.n)}${t("text.92")}${esc(lo.m.n)}</small></button>${list}`;
}
function renderMpioDetail(body) {
  const m = mpios.find(x => x.id === S.mpio); if (!m) { S.mpio = null; renderDetail(); return; }
  const y = S.year, now = mpioCalc(m), r = now.r, sr = calc(stateFlat(S.cc)).r, py = prevSame(y), prev = py ? mpioCalc(m, py).r : null;
  const rows = mpios.map(x => mpioCalc(x).r).filter(v => v != null).sort((a, b) => b - a);
  const rank = r == null ? null : rows.findIndex(v => v <= r) + 1;
  const ci = now.b && now.b < 2000 ? wilson(now.s, now.b) : null;
  const g = (sx, ag) => mpioCalc(m, y, sx, ag).r;
  const yr = g(S.sex, 0), old = g(S.sex, 3), mu = g('mujeres', S.age), ho = g('hombres', S.age), ch = r != null && prev != null ? diff1(r, prev) : null;
  const chips = [`${t("text.93")}${nameOf(S.cc)}`, t('detail.election', { kind: KIND[y].toLowerCase(), year: y })]; if (now.b && now.b < 500) chips.push(t("text.94"));
  body.innerHTML = `<button type="button" class="back" data-act="back">${icon('arrow-left')} ${esc(nameOf(S.cc))}${S.cc === '09' ? t('text.102').replace(/Municipio|Municipality/, t('fix.municipalityHeading')) : t('text.102')}${rank ? t('fix.localRank', { n: rank, of: rows.length, type: localTypes() }) : t("text.96")}</p>
    <h1 class="d-title" id="d-title" tabindex="-1">${esc(m.n)}</h1>
    <p class="d-meta">${chips.filter(c => c !== t("text.94")).join(' · ')}${now.b && now.b < 500 ? t("text.97") : ''}</p>
    ${heroStat(r, sr, esc(nameOf(S.cc)))}

    ${ci ? `${t("text.99")}${one(ci[0])}–${one(ci[1])}\u00a0%.</p>` : ''}
    ${whoVoted(m.y && m.y[y])}
    <details class="more"><summary>${t('who.more')}</summary><ul class="traits">${trait('vote', t("text.100"), fmt.format(now.s), null, t('detail.ofVoters', { n: fmt.format(now.b) }))}${ch != null ? trait('trending-up', `${t("text.67")}${py}`, signedPts(r, prev), null) : ''}${t("text.104")}${spark(yy => mpioCalc(m, yy).r, { ref: yy => calc(stateFlat(S.cc, yy)).r })}${t("text.105")}${esc(nameOf(S.cc))}${t("text.106")}${actionsBar(true)}
    ${mpioBlock()}`;
  body.querySelectorAll('.spark .pt').forEach(g2 => g2.addEventListener('click', () => { stopPlay(); setYear(+g2.dataset.y); }));
  compactMobileDetail(body);
  bindWho(body);
}
function backToState() {
  const id = S.mpio; S.mpio = null; paintMpios(); renderDetail(); renderCaption(); writeHash();
  setTimeout(() => (narrow() ? $('.sheet-prev') : ($(`#detail-body [data-mpio="${id}"]`) || $('#d-title')))?.focus({ preventScroll: true }), 40);
}
function bindDetail() {
  const body = $('#detail-body');
  body.addEventListener('click', e => {
    const q = e.target.closest('[data-quick]');
    if (q) { const [k, v] = q.dataset.quick.split(':'); if (k === 's') S.sex = v; else if (k === 'a') S.age = +v; else S.year = +v; enterMap({}); return; }
    const mp = e.target.closest('[data-mpio]'); if (mp) { selectMpio(mp.dataset.mpio); return; }
    const st = e.target.closest('.mini[data-cc],.link[data-cc]'); if (st) { selectState(st.dataset.cc, { keepRegion: true }); return; }
    const o = e.target.closest('[data-order]'); if (o) { S.order = o.dataset.order; renderDetail(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'map') startTour(); else if (a === 'game') startGame();
    else if (a === 'sim') startTour().then(() => demo?.go?.(6));
    else if (a === 'you') openYou();
    else if (a === 'insight') openInsight(+b.dataset.i);
    else if (a === 'list') { S.list = !S.list; renderDetail(); if (S.list) setTimeout(() => $('#m-q')?.focus({ preventScroll: true }), 30); }
    else if (a === 'back') backToState();
    else if (a === 'country') { S.region = null; selectState(null); }
    else if (a === 'share') shareView(); else if (a === 'link') copyLink(); else if (a === 'csv') downloadCSV(); else if (a === 'card') openCard(S.cc);
  });
  body.addEventListener('input', e => { if (e.target.id === 'm-q') { S.q = e.target.value; const pos = e.target.selectionStart; renderDetail(); const i = $('#m-q'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } } });
  body.addEventListener('pointermove', e => {
    const c = e.target.closest('.tcard'); if (!c || reduced || e.pointerType === 'touch') return;
    const b = c.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5;
    c.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`); c.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
    c.style.setProperty('--mx', `${((x + .5) * 100).toFixed(1)}%`); c.style.setProperty('--my', `${((y + .5) * 100).toFixed(1)}%`);
  });
  body.addEventListener('pointerleave', () => { const c = body.querySelector('.tcard'); if (c) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } }, true);
  $('#featured').addEventListener('click', e => { const b = e.target.closest('[data-cc]'); if (b) selectState(b.dataset.cc); });
  mobileSheet = mountSheet({ isNarrow: narrow, onSwipe: dir => { if (narrow() && !S.mpio && (S.cc || S.region)) step(dir); }, sheet: $('#detail'), handle: $('.sheet-handle'), onChange: () => {
    if (narrow() && S.mode === 'map') { mobileFlightDone?.(); mobileFlightDone = null; cancelAnimationFrame(raf); setView(targetView(activeBox())); }
  } });
  $('#q')?.addEventListener('focus', () => { if (narrow() && S.mode === 'map') mobileSheet?.set('full'); });   // el teclado no tapa los resultados
}

/* ---------- compartir, enlace, CSV, carta ---------- */
function viewText() {
  const m = S.mpio && mpios.find(x => x.id === S.mpio);
  const reg = S.region && REGIONS.find(x => x.k === S.region);
  const r = m ? mpioCalc(m).r : S.cc ? calc(stateFlat(S.cc)).r : reg ? calc(regionFlat(reg.k)).r : natRate().r;
  const place = m ? `${m.n} (${nameOf(S.cc)})` : S.cc ? nameOf(S.cc) : reg ? reg.n : t('place.mexico');
  return t('share.place', { place, voted: voted(r, t('with.id', { group: group() })), year: S.year, rate: pct(r).replace('\u00a0%', '') });
}
async function doShare(text) {
  const url = publicURL() ? publicURL() + location.hash : '';
  try { if (navigator.share) { await navigator.share({ title: 'Pixel Ciudadano', text, ...(url ? { url } : {}) }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); notice(t("text.107")); } catch { notice(url); }
}
/* Tarjetas para compartir: cada opción de "Compartir" genera una imagen vertical (share.js) */
const shareApi = { t: (k, f) => { const v = t(k); return v === k ? f : v; }, locale };
function viewShareSpec(text) {
  const m = S.mpio && mpios.find(x => x.id === S.mpio);
  const regObj = S.region && REGIONS.find(x => x.k === S.region);
  const r = m ? mpioCalc(m).r : S.cc ? calc(stateFlat(S.cc)).r : S.region ? calc(regionFlat(S.region)).r : natRate().r;
  const ref = m ? calc(stateFlat(S.cc)).r : (S.cc || S.region) ? natRate().r : null;
  const refName = m ? nameOf(S.cc) : t(subgroup(S.sex, S.age) ? 'share.countryGroup' : 'share.country');
  const lines = [];
  if (r != null && ref != null) { const dd = diff1(r, ref); lines.push(Math.abs(dd) < .05 ? t('share.eq', { ref: refName }) : t(dd > 0 ? 'share.up' : 'share.down', { n: one(Math.abs(dd)), ref: refName })); }
  if (r != null) lines.push(t(subgroup(S.sex, S.age) ? 'share.of10g' : 'share.of10', { n: Math.round(r / 10), who: group().toLowerCase() }));
  return {
    poster: !m && S.cc ? `assets/estados/${S.cc}.webp` : null,
    kicker: t('detail.election', { kind: KIND[S.year].toLowerCase(), year: S.year }),
    title: m ? m.n : S.cc ? nameOf(S.cc) : regObj ? `${t("text.29")}${regObj.n}` : 'México',
    subtitle: m ? nameOf(S.cc) + (subgroup(S.sex, S.age) ? ` · ${cap(group())}` : '') : subgroup(S.sex, S.age) ? cap(group()) : t('share.everyone'),
    value: r, valueText: r == null ? '—' : pct(r), valueLabel: t('share.voted', { year: S.year }),
    color: solidFor(r), people: r == null ? null : Math.round(r / 10), lines,
    urlText: shareFooter(), independent: t('fix.independent'), cta: t('share.cta'), source: t('share.source', { year: S.year }),
    filename: `pixel-ciudadano-${m ? m.id : S.cc || S.region || 'mexico'}-${S.year}.png`,
    shareText: text || `${viewText()}${t("text.108")}`, url: publicURL() ? publicURL() + location.hash : '',
  };
}
const shareView = () => openShareSheet(viewShareSpec(), shareApi);
async function copyLink() { try { await navigator.clipboard.writeText(location.href); notice(t("text.109")); } catch { notice(location.href); } }
function saveCSV(filename, rows) {
  const csv = rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadNationalCSV() {
  const rows = [['estado', 'clave', 'año', 'tipo', 'grupo', 'base', 'votos', 'participacion']];
  const groups = [['todos', 'todos', null], ['mujeres', 'mujeres', null], ['hombres', 'hombres', null], ...AGE_LABEL.map((label, age) => [label, 'todos', age])];
  for (const cc of CODES) for (const year of YEARS) for (const [label, sex, age] of groups) {
    const value = calc(stateFlat(cc, year), sex, age);
    rows.push([nameOf(cc), cc, year, [2012, 2018, 2024].includes(year) ? 'presidencial' : 'intermedia', label, value.b, value.s, value.r == null ? '' : value.r.toFixed(1)]);
  }
  saveCSV('pixel-ciudadano-estados-2009-2024.csv', rows);
}
function downloadDictionaryCSV() {
  const fields = ['estado', 'clave', 'año', 'tipo', 'grupo', 'base', 'votos', 'participacion'];
  saveCSV('pixel-ciudadano-diccionario.csv', [[t('csv.field'), t('csv.description')], ...fields.map(field => [field, t('csv.dict.' + field)])]);
}
function downloadCSV() {
  if (!S.cc || !mpios.length) return;
  const py = prevSame(S.year);
  const head = ['clave_inegi', 'municipio', 'estado', 'eleccion', 'base_ln_sin_no_especificados', 'votaron', 'participacion_pct', 'mujeres_pct', 'hombres_pct', 'edad_18_29_pct', 'edad_60_mas_pct', `cambio_vs_${py || 'na'}_pts`, 'pocos_registros'];
  const v = x => x == null ? '' : rounded(x).toFixed(1);
  const lines = mpios.map(m => {
    const n = mpioCalc(m, S.year, 'todos', null), p = py ? mpioCalc(m, py, 'todos', null).r : null;
    return [m.id, `"${m.n.replace(/"/g, '""')}"`, nameOf(S.cc), S.year, n.b, n.s, v(n.r), v(mpioCalc(m, S.year, 'mujeres', null).r), v(mpioCalc(m, S.year, 'hombres', null).r), v(mpioCalc(m, S.year, 'todos', 0).r), v(mpioCalc(m, S.year, 'todos', 3).r), n.r != null && p != null ? diff1(n.r, p).toFixed(1) : '', n.b < 500 ? 'si' : 'no'].join(',');
  });
  const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n') + `${t("text.110")}${S.year}${t('csv.processed')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pixel-ciudadano_${norm(nameOf(S.cc)).replace(/\s+/g, '_')}_${S.year}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  notice(t("text.111"));
}
function cardModel(cc, extra = {}) {
  const y = S.year, f = stateFlat(cc, y), st = calc(f, 'todos', null), nat = calc(natFlat(y), 'todos', null), rs = stateRates(y, 'todos', null).filter(x => x.r != null).sort((a, b) => b.r - a.r), rk = { n: rs.findIndex(x => x.cc === cc) + 1, of: rs.length };
  const stat = (icon, label, sx, ag) => { const r = calc(f, sx, ag).r; return { icon, label, value: r ?? 0, text: pct(r), color: solidFor(r) }; };
  const s = share(st.r);
  return {
    labels: Object.fromEntries(['close','history','actions','prev','next','mpios','share','noData','current'].map(k => [k, k === 'mpios' && cc === '09' ? t('fix.localList', { n: 16, type: localTypes(cc) }) : t('card.' + k)]).concat([['rate', t('card.rate', { name: nameOf(cc), rate: one(st.r) })]])),
    cc, num: rk.n ? rankTag(rk.n) : t('card.noData'), name: nameOf(cc), capital: t('detail.capital', { capital: CAPITAL[cc] }), img: `assets/estados/${cc}.webp`, silhouette: GEO[cc],
    color: solidFor(st.r), tier: st.r != null && st.r >= 60 ? 5 : 0,
    rate: rounded(st.r), rateDisplay: one(st.r), rateText: cap(s) + (isHalf(s) ? t("text.113") : t("text.114")), rank: `${t('detail.rank', { n: rk.n, of: rk.of })}`,
    delta: { text: diffText(st.r, nat.r, t("text.52")), sign: Math.sign(diff1(st.r, nat.r)) }, year: y, kind: KIND[y],
    stats: [stat('mujer', t("text.2"), 'mujeres', null), stat('hombre', t("text.3"), 'hombres', null), stat('joven', '18–29', 'todos', 0), stat('mayor', '60+', 'todos', 3)],
    gender: genderLine(f, null), trend: YEARS.map(yy => { const r = calc(stateFlat(cc, yy), 'todos', null).r; return { year: yy, value: r == null ? null : rounded(r), kind: KIND[yy], current: yy === y }; }),
    note: extra.score != null ? `${t("text.115")}${extra.score}${t("text.116")}${extra.badge}"` : null,
  };
}
function openCard(cc) { const d = $('#card-dialog'), host = $('#card-dialog-host'); host.replaceChildren(); renderCard(host, cardModel(cc), { motionTiming: mobileTiming }); d.showModal(); }
function bindCardDialog() {
  const d = $('#card-dialog');
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('[data-close]')) { d.close(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close' || a === 'mpios') d.close();
    else if (a === 'share') openShareSheet(viewShareSpec(`${viewText()}${t("text.117")}${nameOf(S.cc)}${t("text.118")}`), shareApi);
    else if (a === 'prev' || a === 'next') { step(a === 'next' ? 1 : -1); setTimeout(() => renderCard($('#card-dialog-host'), cardModel(S.cc), { direction: a === 'next' ? 1 : -1, motionTiming: mobileTiming }), 30); }
  });
}

/* ---------- búsqueda ---------- */
let IDX = null;
const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STOP = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'heroica', 'ciudad', 'villa', 'municipio']);
const toks = t => norm(t).split(/[^a-z0-9ñ]+/).filter(w => w && !STOP.has(w));
const shortName = n => n.replace(/^Heroica (Ciudad|Villa) de /, '').replace(/^Heroica /, '');
const loadIdx = () => IDX || (IDX = fetch('assets/data/buscar.json').then(r => r.json())
  .then(a => a.map(([cc, id, n, pob]) => { const sn = shortName(n); return { cc, id, n: sn, pob: pob || 0, k: norm(sn), t: toks(n) }; })).catch(() => []));
function matchScore(qt, qn, it) {
  if (it.k.startsWith(qn)) return 3;
  if (qt.every(w => it.t.some(x => x.startsWith(w)))) return 2;
  const strong = it.t.filter(x => x.length > 3);
  if (strong.length && strong.every(x => qt.includes(x))) return 1;
  return 0;
}
async function search(q) {
  const qn = norm(q.trim()), qt = toks(q);
  if (qn.length < 2 || !qt.length) return [];
  const st = CODES.map(cc => ({ cc, n: nameOf(cc), k: norm(nameOf(cc)), t: toks(nameOf(cc) + ' ' + GEO[cc].n) })).map(x => ({ x, s: matchScore(qt, qn, x) })).filter(o => o.s).sort((a, b) => b.s - a.s).map(o => o.x);
  const all = await loadIdx(), here = x => x.cc === S.cc ? 1 : 0;
  const mp = all.map(x => ({ x, s: matchScore(qt, qn, x) })).filter(o => o.s).sort((a, b) => b.s - a.s || here(b.x) - here(a.x) || b.x.pob - a.x.pob).map(o => o.x);
  return (S.cc ? mp.concat(st) : st.concat(mp)).slice(0, 8);
}
function bindSearch(input, list, onPick) {
  let hits = [], sel = -1, seq = 0;
  const draw = () => {
    list.hidden = !hits.length; input.setAttribute('aria-expanded', String(!!hits.length));
    list.innerHTML = hits.map((h, i) => `<li role="option" id="${list.id}-${i}" aria-selected="${i === Math.max(sel, 0)}" data-i="${i}"><span>${esc(h.id ? t('fix.searchTown', { name: h.n, type: t(h.cc === '09' ? 'fix.alcaldia' : 'fix.municipio'), state: nameOf(h.cc) }) : t('fix.searchState', { name: nameOf(h.cc) }))}</span><small></small></li>`).join('');
    if (hits.length && sel >= 0) input.setAttribute('aria-activedescendant', `${list.id}-${sel}`); else input.removeAttribute('aria-activedescendant');
  };
  const pick = h => { if (!h) return; hits = []; draw(); input.value = ''; input.blur(); onPick(h); };
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-autocomplete', 'list');
  const onFocus = () => loadIdx();
  const onInput = async () => { const n = ++seq; const r = await search(input.value); if (n !== seq) return; hits = r; sel = -1; draw(); };
  const onKey = e => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && hits.length) { e.preventDefault(); sel = e.key === 'ArrowDown' ? (sel + 1) % hits.length : (sel <= 0 ? hits.length - 1 : sel - 1); draw(); }
    else if (e.key === 'Escape') { hits = []; draw(); }
    else if (e.key === 'Enter' && !input.form) { e.preventDefault(); pick(hits[Math.max(sel, 0)]); }
  };
  const onBlur = () => setTimeout(() => { hits = []; draw(); }, 150);
  const onSubmit = e => { e.preventDefault(); pick(hits[Math.max(sel, 0)]); };
  const onList = e => { const li = e.target.closest('li'); if (!li) return; e.preventDefault(); pick(hits[+li.dataset.i]); };
  input.addEventListener('focus', onFocus); input.addEventListener('input', onInput); input.addEventListener('keydown', onKey); input.addEventListener('blur', onBlur);
  input.form?.addEventListener('submit', onSubmit); list.addEventListener('pointerdown', onList);
  return () => { input.removeEventListener('focus', onFocus); input.removeEventListener('input', onInput); input.removeEventListener('keydown', onKey); input.removeEventListener('blur', onBlur); input.form?.removeEventListener('submit', onSubmit); list.removeEventListener('pointerdown', onList); };
}
async function goTo({ cc, id }) {
  if (S.cc !== cc) await selectState(cc); else if (!mpios.length) await showMpios(cc);
  if (id && S.cc === cc && S.mpio !== id) selectMpio(id);
  else if (!id) { $('#detail').classList.add('open'); $('#d-title')?.focus({ preventScroll: true }); }
}

/* ---------- "Tu dato": participación de personas como tú ---------- */
let you = null;
function openYou(preset) {
  if (!you) {
    const dlg = $('#you-dialog');
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
    you = mountYou(dlg, {
      t, locale, icon, diff1, votingActions, shareFooter, publicURL, color: solidFor, share: text => doShare(text),
      states: CODES.map(cc => ({ cc, name: nameOf(cc) })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
      rate: (cc, sex, age, y) => calc(cc ? stateFlat(cc, y) : natFlat(y), sex, age).r,
      async toMap({ cc, sex, age }) { endTour(); endGame(true); await enterMap({}); S.sex = sex; S.age = age; S.year = 2021; S.region = null; await selectState(cc); },
    });
  }
  you.open(preset || (S.cc ? { cc: S.cc } : {}));
}
/* ---------- portada ↔ mapa (mismo objeto central) ---------- */
// Botones de la portada sobre el globo (en escritorio); en celular siguen en la hoja
$('#cta-explore .cap').innerHTML = icon('arrow-right');
$('#cta-explore').addEventListener('click', () => startTour());
$('#cta-game').addEventListener('click', () => startGame());
$('#g-zin').innerHTML = icon('plus'); $('#g-zout').innerHTML = icon('minus');
$('#g-zin').addEventListener('click', () => globe?.zoomIn());
$('#g-zout').addEventListener('click', () => globe?.zoomOut());
function mountHomeGlobe() {
  if (globe) return;
  try {
    const PINS = [['31', -89.0, 20.7], ['02', -115.4, 30.6], ['09', -99.13, 19.43], ['14', -103.4, 20.6], ['19', -100.3, 25.7], ['07', -92.6, 16.7]];
    globe = mountGlobe($('#globe'), {
      theme: document.documentElement.dataset.theme, size: narrow() ? .27 : .42, mobile: narrow(), initialZoom: narrow() ? 1.3 : 1.2, minZoom: 1, maxZoom: 4, states: GEO, reducedMotion: reduced, colorOf: cc => solidFor(calc(stateFlat(cc, 2024), 'todos', null).r),
      pins: PINS.map(([cc, lon, lat]) => { const r = calc(stateFlat(cc, 2024), 'todos', null).r; return { lon, lat, label: nameOf(cc), value: Math.round(r) + '\u00a0%', color: solidFor(r) }; }),
    });
  } catch (e) { console.warn(e); }
}
function mexicoRect() {
  const v = targetView(natBox()), b = natBox();
  return { left: (b[0] - v.x) * v.k, top: (b[1] - v.y) * v.k, width: (b[2] - b[0]) * v.k, height: (b[3] - b[1]) * v.k };
}
let entering = null;
function enterMap({ instant = false } = {}) {
  if (S.mode !== 'home') { refresh(); return Promise.resolve(); }
  if (entering) return entering;
  S.mode = 'map'; document.body.classList.remove('mode-home'); document.body.classList.add('mode-map', 'flying');
  if (narrow()) mobileSheet?.set(S.cc ? 'half' : 'peek', { instant: true });
  setView(targetView(activeBox())); refresh();
  svg.style.opacity = '0';
  const fade = t => { if (t > .6) svg.style.opacity = String(Math.min(1, (t - .6) / .35)); };
  entering = (globe && !instant ? globe.flyToMexico({ ms: reduced ? 0 : 1600, targetRect: mexicoRect(), onProgress: fade }) : Promise.resolve()).then(() => {
    svg.style.opacity = ''; document.body.classList.remove('flying');
    globe?.destroy(); globe = null; entering = null;
    if (S.region) flyTo(activeBox(), 600);
  });
  return entering;
}
function goHome() {
  stopPlay(); endGame(true); endTour();
  S.mode = 'home'; S.cc = null; S.mpio = null; S.region = null; S.spot = null; S.sex = 'todos'; S.age = null; S.year = 2024;
  document.body.classList.remove('mode-map', 'in-state'); document.body.classList.add('mode-home');
  mpios = []; gMpios.replaceChildren(); paintStates(); mountHomeGlobe(); renderAll();
  try { history.replaceState(null, '', location.pathname); } catch { /* sin historial */ }
}

/* ---------- Recorrido guiado con Pixel (todas las cifras se calculan de los datos) ---------- */
let HALL = null;
// Enlaces oficiales del INE (verificados: responden 200)
function ineActions(svg = true) {   // la demo recibe el nombre del ícono; el juego, el SVG
  const L = (key, href, ic) => ({ label: t(key), href, icon: svg ? icon(ic) : ic });
  return [L('act.credential', 'https://listanominal.ine.mx/scpln/', 'id-card'), L('act.module', 'https://ubicatumodulo.ine.mx/', 'map-pin'), L('fix.casilla', 'https://ubicatucasilla.ine.mx/', 'map-pin'), L('act.tramite', 'https://www.ine.mx/credencial/tramite-credencial-tipo/', 'refresh-cw')];
}
function votingActions() {
  return `<section class="home-block"><h2 class="sec">${t('fix.actions')}</h2>${ineActions().map(a => `<p><a href="${a.href}" target="_blank" rel="noopener noreferrer">${a.label} ↗</a></p>`).join('')}<p class="d-note">${t('vote.lang')}</p></section>`;
}
async function demoSteps() {
  if (!HALL) HALL = await fetch('assets/data/hallazgos.json').then(r => r.json()).catch(() => null);
  const R = (y, sx = 'todos', ag = null) => calc(natFlat(y), sx, ag, 25).r;
  const st = (y, sx = 'todos', ag = null) => CODES.map(cc => ({ cc, r: calc(stateFlat(cc, y), sx, ag, 25).r })).filter(x => x.r != null).sort((a, b) => b.r - a.r);
  const base = { year: 2024, sex: 'todos', age: null, spot: null, cc: null };
  const n24 = R(2024), m = R(2024, 'mujeres'), h = R(2024, 'hombres'), g09 = diff1(R(2009, 'mujeres'), R(2009, 'hombres')), g24 = diff1(m, h);
  const hj = R(2024, 'hombres', 0), old = R(2024, 'todos', 3), s24 = st(2024), top = s24[0], low = s24[s24.length - 1];
  const n21 = R(2021);
  // Entre intermedias (2015 → 2021), como compara el propio manual del INE
  const d = CODES.map(cc => ({ cc, d: diff1(calc(stateFlat(cc, 2021), 'todos', null).r, calc(stateFlat(cc, 2015), 'todos', null).r) })).sort((a, b) => b.d - a.d), up = d[0], dn = d[d.length - 1], nUp = d.filter(x => x.d > 0).length, n15 = R(2015);
  const y21 = st(2021, 'todos', 0).reverse().slice(0, 5);
  const sm = HALL?.por_tamano?.['<10k'], bg = HALL?.por_tamano?.['>75k'];
  const sign = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${one(Math.abs(v))}`;
  const N = 7, k = i => `${t("text.120")}${i}${t("text.20")}${N}`;
  const C = solidFor;   // color de la escala del mapa para cada cifra
  const ages = [0, 1, 2, 3].map(a => { const v = rounded(R(2024, 'todos', a)); return { label: AGE_LABEL[a], value: v, hi: a === 0, color: C(v) }; });
  const serie = YEARS.map(y => { const v = rounded(R(y)); return { x: String(y), y: v, mid: [2009, 2015, 2021].includes(y), color: C(v) }; });
  const yb = calc(natFlat(2021), 'todos', 0), y60 = R(2021, 'todos', 3);
  const url = publicURL() || location.href.split('#')[0];
  return [
    { id: 'hola', say: t('pixel.s1'), kicker: k(1), title: t("text.121"), gesture: 'wave', stat: { value: rounded(n24), suffix: '\u00a0%', decimals: 1, label: t("text.122"), color: C(n24) },
      viz: { type: 'picto', value: n24, of: 10, color: C(n24), caption: t('viz.picto', { n: Math.round(n24 / 10) }) },
      text: t("demo.hello", { p: one(n24), n: Math.round(n24 / 10) }), view: { ...base } },
    { id: 'contraste', say: t('pixel.s2', { top: nameOf(top.cc), low: nameOf(low.cc), d: one(diff1(top.r, low.r)) }), kicker: k(2), title: t('demo.from', { a: nameOf(low.cc), b: nameOf(top.cc) }), gesture: 'point', stat: { value: rounded(top.r), suffix: '\u00a0%', decimals: 1, label: nameOf(top.cc), color: C(top.r) }, stat2: { value: rounded(low.r), suffix: '\u00a0%', decimals: 1, label: nameOf(low.cc), color: C(low.r) },
      viz: { type: 'dumbbell', min: 40, max: 80, a: { label: nameOf(low.cc), value: rounded(low.r), color: C(low.r) }, b: { label: nameOf(top.cc), value: rounded(top.r), color: C(top.r) }, note: t('viz.gap', { n: one(diff1(top.r, low.r)) }) },
      text: t('demo.contrast', { top: nameOf(top.cc), low: nameOf(low.cc), share: share(low.r), y: one(calc(stateFlat(low.cc, 2021), 'todos', 0, 25).r) }), view: { ...base, spot: [top.cc, low.cc] } },
    { id: 'mujeres', say: t('pixel.s3', { n: CODES.filter(cc => calc(stateFlat(cc, 2024), 'mujeres', null).r > calc(stateFlat(cc, 2024), 'hombres', null).r).length }), kicker: k(3), title: t("text.130"), gesture: 'point', stat: { value: rounded(m), suffix: '\u00a0%', decimals: 1, label: t('group.women'), color: C(m) }, stat2: { value: rounded(h), suffix: '\u00a0%', decimals: 1, label: t('group.men'), color: C(h) },
      viz: { type: 'line', min: 0, max: 12, unit: '', hi: '2024', points: [2012, 2018, 2024].map(y => ({ x: String(y), y: diff1(R(y, 'mujeres'), R(y, 'hombres')) })), caption: t('viz.genderGap') },
      text: t("demo.women", { g24: one(g24), g12: one(diff1(R(2012, "mujeres"), R(2012, "hombres"))) }), view: { ...base, sex: 'mujeres' } },
    { id: 'jovenes', say: t('pixel.s4'), kicker: k(4), title: t("text.134"), gesture: 'crouch', stat: { value: rounded(R(2024, 'todos', 0)), suffix: '\u00a0%', decimals: 1, label: t("text.65"), color: C(R(2024, 'todos', 0)) }, stat2: { value: rounded(old), suffix: '\u00a0%', decimals: 1, label: t("text.66"), color: C(old) },
      viz: { type: 'bars', max: 100, unit: '\u00a0%', items: ages, caption: t('viz.ages') },
      text: t("demo.youth", { d: one(diff1(old, R(2024, "todos", 0))), hj: one(hj) }), view: { ...base, age: 0 } },
    { id: 'intermedias', say: t('pixel.s5'), kicker: k(5), title: t("text.138"), gesture: 'point', stat: { value: rounded(n15), suffix: '\u00a0%', decimals: 1, label: t('mid.lbl', { y: 2015 }), color: C(n15) }, stat2: { value: rounded(n21), suffix: '\u00a0%', decimals: 1, label: t('mid.lbl', { y: 2021 }), color: C(n21) },
      viz: { type: 'line', min: 30, max: 80, hi: '2021', points: serie, caption: t('viz.series') },
      text: t('demo.mid2', { p15: one(n15), p21: one(n21), k: nUp }), view: { ...base, year: 2021, spot: d.filter(x => x.d > 0).map(x => x.cc) } },
    { id: 'municipios', say: t('pixel.s6'), kicker: k(6), title: t("text.143"), gesture: 'crouch', dock: 'tl', ...(sm && bg ? { stat: { value: sm.part, suffix: '\u00a0%', decimals: 1, label: t("text.144"), color: C(sm.part) }, stat2: { value: bg.part, suffix: '\u00a0%', decimals: 1, label: t("text.145"), color: C(bg.part) } } : {}),
      ...(HALL?.por_tamano ? { viz: { type: 'bars', max: 100, unit: '\u00a0%', caption: t('viz.size'), items: [['<10k', 'size.small'], ['10-75k', 'size.mid'], ['>75k', 'size.big']].map(([key, lk], i) => ({ label: t(lk), value: HALL.por_tamano[key].part, hi: i === 0, color: C(HALL.por_tamano[key].part) })) } } : {}),
      text: t('demo.localInvite') + (sm && bg ? `<p>${t('demo.localData', { n1: fmt.format(sm.n), n2: fmt.format(bg.n) })}</p>` : ''), view: { ...base, cc: '20' } },
    (() => {
      // Paso 7 dentro del mapa: simulador compacto, 3 estados resaltados, enlaces del INE y recomendaciones plegadas
      const votes21 = CODES.map(cc => ({ cc, name: nameOf(cc), votes: calc(stateFlat(cc, 2021), 'todos', null).s })).sort((a, b) => b.votes - a.votes);
      const natVotes = calc(natFlat(2021), 'todos', null).s, toNat = Math.round((n21 - yb.r) / 100 * yb.b), hj21 = R(2021, 'hombres', 0);
      const low3 = y21.slice(0, 3);
      return { id: '2027', say: t('pixel.s7', { m: one((y60 - yb.r) / 100 * yb.b / 1e6) }), kicker: k(7), title: t('close.title2'), gesture: 'cheer',
        text: `${t('close.text2')}<p>${t('fix.elected')}</p>`,
        view: { ...base, year: 2021, age: 0, spot: low3.map(x => x.cc) },
        viz: { type: 'gap',
          rows: [{ label: t('gap.young'), value: yb.r, color: C(yb.r) }, { label: t('gap.old'), value: y60, color: C(y60) }],
          gapText: t('gap.diff', { n: one(diff1(y60, yb.r)) }), button: t('gap.btn'), buttonBack: t('gap.back'), ofTen: t('gap.ofTen'), gapClosed: t('gap.closed'),
          base: yb.b, from: yb.r, to: y60, millions: t('final.millions'), resultUnit: t('gap.result'),
          equiv: votes21, natVotes, equivText: t('final.equiv2') },
        actions: { title: t('final.secYou'), items: [...ineActions(false), { label: t('vote.lang'), href: 'https://ubicatumodulo.ine.mx/', icon: 'map-pin' }] },
        pledge: { title: t('final.pledgeTitle'), items: [t('final.pledge1'), t('final.pledge2'), t('final.pledge3')], note: t('fix.free'), share: t('final.pledgeShare'), shareText: t('final.pledgeText', { y: one(yb.r) }) + ' ' + url },
        details: [{ summary: t('gap.how'), items: [{ title: t('gap.howT'), text: t('final.simNote3', { n: people(yb.b), avg: one(n21), alt: people(toNat) }) }] },
          { summary: t('final.secIne'), items: [
          { title: t('final.ine1t'), text: t('final.ine1b', { y: one(yb.r), o: one(y60), h: one(hj21) }) },
          { title: t('final.ine2t2'), text: t('final.ine2b', { list: low3.map(x => nameOf(x.cc)).join(', ') }) },
          { title: t('final.ine3t'), text: t('final.ine3') },
          { title: t('final.ine4t'), text: t('final.ine4') },
        ] }],
        buttons: { next: { label: t('close.next'), mode: 'you' }, skip: { label: t('close.skip'), mode: 'explore' } },
      };
    })(),
  ];
}
let demo = null;
const tourButtons = new MutationObserver(() => {
  if (!demo || $('#mission .demo-title')?.textContent !== t('close.title2')) return;
  const actions = $('#mission .demo-actions');
  if (!actions || actions.querySelector('[data-tutorial]')) return;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'demo-button demo-button--ghost'; button.dataset.tutorial = '';
  button.textContent = t('fix.tutorial');
  button.onclick = () => { endTour(); runTutorial(); };
  actions.insertBefore(button, actions.querySelector('.demo-button--skip'));
});
tourButtons.observe($('#mission'), { childList: true, subtree: true });
// Hallazgos de la portada: llevan directo al dato en el mapa
async function openInsight(i) {
  await enterMap({});
  S.region = null; S.mpio = null; S.year = 2024; S.sex = 'todos'; S.age = null; S.spot = null;
  if (S.cc) await selectState(null);
  if (i === 0) { const rs = stateRates(2024).filter(x => x.r != null).sort((a, b) => b.r - a.r); S.spot = [rs[0].cc, rs[rs.length - 1].cc]; }
  else if (i === 1) S.sex = 'mujeres';
  else S.age = 0;   // jóvenes 18–29 de ambos sexos, como dice la tarjeta
  refresh(); $('#detail').scrollTop = 0; flyTo(S.spot ? spotBox(S.spot) : natBox(), 700);
}
async function startTour() {
  if (demo) return;
  if (mission) endGame(true);
  await enterMap({});
  S.region = null; S.mpio = null;
  if (S.cc) await selectState(null);
  S.mode = 'demo'; document.body.classList.add('demoing'); refresh();
  const steps = await demoSteps();
  demo = startDemo($('#mission'), {
    t, lang: locale, steps, motionTiming: mobileTiming, stage: $('#stage'),
    async show(v) {
      S.year = v.year ?? 2024; S.sex = v.sex ?? 'todos'; S.age = v.age ?? null; S.spot = v.spot || null;
      if (v.cc && S.cc !== v.cc) await selectState(v.cc, { keepRegion: true });
      else if (!v.cc && S.cc) await selectState(null);
      refresh(); if (!v.cc) flyTo(v.spot && v.spot.length <= 6 ? spotBox(v.spot) : natBox(), 700);
    },
    icon, share: text => openShareSheet(viewShareSpec(text), shareApi), openYou: () => openYou(),
    onEnd(mode) { endTour(); if (mode === 'game') startGame(); else if (mode === 'tutorial') runTutorial(); else if (mode === 'you') openYou(); },
  });
}
function endTour() {
  if (!demo) return;
  const d = demo; demo = null; try { d.destroy(); } catch { /* ya cerrado */ }
  document.body.classList.remove('demoing'); $('#mission').classList.remove('demo');
  S.mode = 'map'; S.spot = null; S.sex = 'todos'; S.age = null; S.year = 2024;
  if (S.cc) selectState(null); else { refresh(); flyTo(natBox(), 500); }
}
/* ---------- Mini tutorial: cómo usar el mapa ---------- */
let tut = null;
async function runTutorial() {
  if (tut) return;
  endTour(); endGame(true);
  await enterMap({});
  S.region = null; S.sex = 'todos'; S.age = null; S.year = 2024; S.mpio = null; S.spot = null;
  if (S.cc) await selectState(null); else { refresh(); flyTo(natBox(), 500); }
  const tt = (key, fallback) => { const v = t(key); return v === key ? fallback : v; };
  let cc0 = null, y0 = null;
  tut = startTutorial({
    t: tt,
    steps: [
      { id: 'click', title: t('tut.1t'), text: t('tut.1'), target: () => gStates.querySelector('path[data-cc="09"]'),
        onEnter: () => { S.spot = ['09']; paintStates(); }, wait: () => S.cc === '09' },
      { id: 'wheel', title: t('tut.2t'), text: narrow() ? t('tut.2m') : t('tut.2'), target: () => narrow() ? $('#q') : $('#stage'),
        onEnter: () => { if (narrow()) mobileSheet?.set('half'); S.spot = null; paintStates(); cc0 = S.cc; }, wait: () => !!S.cc && S.cc !== cc0 },
      { id: 'filter', title: t('tut.3t'), text: t('tut.3'), target: () => $('#detail .who'),
        onEnter: () => { if (narrow()) { mobileSheet?.set('full'); const who = $('#detail .who-m'); if (who) who.open = true; } else $('#detail').classList.add('open'); $('#detail .who')?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); },
        wait: () => S.sex !== 'todos' || S.age != null },
      { id: 'year', title: t('tut.4t'), text: t('tut.4'), target: () => $('.years'),
        onEnter: () => { y0 = S.year; }, wait: () => S.year !== y0 },
      { id: 'back', title: t('tut.5t'), text: t('tut.5'), target: () => $('#back-mx:not([hidden])'),
        onEnter: () => { if (!S.cc) selectState('09'); }, wait: () => !S.cc && !S.region },
      ...(!narrow() ? [{ id: 'present', title: t('tut.6t'), text: t('tut.6'), target: () => $('#present') }] : []),
    ],
    final: { title: t('tut.endT'), text: t('tut.end'), actions: [
      { label: t('final.game'), primary: true, onClick: () => startGame() },
      { label: t('you.ctaT'), onClick: () => openYou() },
      { label: t('tut.explore'), onClick: () => {} },
    ] },
    onEnd: () => { tut = null; if (S.spot) { S.spot = null; paintStates(); } },
  });
}
/* ---------- Misión 2027: banco de preguntas (todo se calcula de los datos) ---------- */
const pickN = (arr, n) => arr.map(x => [Math.random(), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
const word10 = n => t(['words.zero','words.one','words.two','words.three','words.four','words.five','words.six','words.seven','words.eight','words.nine','words.ten'][n]);
function buildLevels(seed = Math.random() * 0x100000000) {
  // Una semilla estable permite traducir la misma partida sin cambiar preguntas.
  let randomState = seed >>> 0;
  const random = () => { randomState = (1664525 * randomState + 1013904223) >>> 0; return randomState / 0x100000000; };
  const pickN = (arr, n) => arr.map(x => [random(), x]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
  const R = (y, sx = 'todos', ag = null) => calc(natFlat(y), sx, ag, 25).r;
  const st = (y, sx = 'todos', ag = null) => CODES.map(cc => ({ cc, r: calc(stateFlat(cc, y), sx, ag, 25).r })).filter(x => x.r != null).sort((a, b) => b.r - a.r);
  const base = { year: 2024, sex: 'todos', age: null, spot: null };
  const slider = (q, r, view, extra = '') => ({ type: 'slider', q, answer: Math.max(1, Math.min(10, Math.round(r / 10))), countTo: rounded(r), before: { ...base, ...view, spot: null }, after: { ...base, ...view }, reveal: `${t("text.163")}${one(r)}\u00a0%: ${word10(Math.round(r / 10))}${t("text.164")}${extra}` });
  const mapQ = (q, list, view, tail) => ({ type: 'map', q, answer: list[0].cc, partial: [list[1].cc], before: { ...base, ...view, spot: null }, after: { ...base, ...view, spot: [list[0].cc] }, reveal: `${t("text.165")}${nameOf(list[0].cc)}: ${one(list[0].r)}\u00a0%. ${tail(list)}` });
  const ch = (q, options, answer, view, reveal, bars) => ({ type: 'choice', q, options, answer, before: { ...base, ...view.before }, after: { ...base, ...view.after }, ...(view.after2 ? { after2: { view: { ...base, ...view.after2 }, delay: 900 } } : {}), reveal, ...(bars ? { bars } : {}) });
  const sliders = [
    () => slider(t("text.166"), R(2024), {}),
    () => slider(t("text.167"), R(2024, 'mujeres'), { sex: 'mujeres' }),
    () => slider(t("text.168"), R(2024, 'todos', 0), { age: 0 }, t("text.169")),
    () => slider(t("text.170"), R(2024, 'todos', 3), { age: 3 }, t("text.171")),
    () => slider(t("text.172"), R(2021), { year: 2021 }),
    () => slider(t("text.173"), R(2009), { year: 2009 }, t("text.174")),
  ];
  const maps = [
    () => mapQ(t("text.175"), st(2024), {}, l => `${t("text.176")}${nameOf(l[l.length - 1].cc)}, ${one(l[l.length - 1].r)}\u00a0%.`),
    () => { const l = st(2024).reverse(); return mapQ(t("text.177"), l, {}, () => `${t("text.178")}${nameOf(l[l.length - 1].cc)}, ${one(l[l.length - 1].r)}\u00a0%.`); },
    () => mapQ(t("text.179"), st(2021), { year: 2021 }, l => `${t("text.180")}${nameOf(l[1].cc)}, ${one(l[1].r)}\u00a0%.`),
    () => mapQ(t("text.181"), st(2024, 'todos', 0), { age: 0 }, () => `${t("text.182")}${one(R(2024, 'todos', 0))}${t("text.183")}`),
    () => { const g = CODES.map(cc => ({ cc, r: diff1(calc(stateFlat(cc, 2024), 'mujeres', null).r, calc(stateFlat(cc, 2024), 'hombres', null).r) })).sort((a, b) => b.r - a.r); return { ...mapQ(t("text.184"), g, { sex: 'mujeres' }, () => ''), reveal: `${t("text.165")}${nameOf(g[0].cc)}${t("text.185")}${one(g[0].r)}${t("text.186")}${nameOf(g[g.length - 1].cc)}.` }; },
  ];
  const regs = REGIONS.map(r => ({ ...r, v: calc(regionFlat(r.k, 2024), 'todos', null).r })).sort((a, b) => b.v - a.v);
  const choices = [
    () => { const m = R(2024, 'mujeres'), h = R(2024, 'hombres'); return ch(t("text.187"), [{ id: 'm', label: t("text.2") }, { id: 'h', label: t("text.3") }], m > h ? 'm' : 'h', { before: {}, after: { sex: 'mujeres' } }, `${t("text.188")}${one(m)}${t("text.189")}${one(h)}${t("text.190")}`, [{ label: t("text.2"), value: rounded(m) }, { label: t("text.3"), value: rounded(h) }]); },
    () => { const gs = [['h0', t("text.46"), 'hombres', 0], ['m0', t("text.191"), 'mujeres', 0], ['h3', t("text.192"), 'hombres', 3], ['m1', t("text.193"), 'mujeres', 1]].map(([id, label, sx, ag]) => ({ id, label, sx, ag, r: R(2024, sx, ag) })); const lo = gs.slice().sort((a, b) => a.r - b.r)[0]; return ch(t("text.194"), gs.map(g => ({ id: g.id, label: g.label })), lo.id, { before: {}, after: { sex: lo.sx, age: lo.ag } }, `${lo.label}${t("text.195")}${one(lo.r)}${t("text.196")}`, gs.map(g => ({ label: g.label, value: rounded(g.r) }))); },
    () => { const a = R(2015), b = R(2021), k = CODES.filter(cc => calc(stateFlat(cc, 2021), 'todos', null).r > calc(stateFlat(cc, 2015), 'todos', null).r).length; return ch(t("text.197"), [{ id: 'up', label: t("text.198") }, { id: 'down', label: t("text.199") }], b > a ? 'up' : 'down', { before: { year: 2015 }, after: { year: 2015 }, after2: { year: 2021 } }, t('game.mid', { a: one(a), b: one(b), k })); },
    () => { const ys = [2012, 2018, 2024].map(y => ({ id: String(y), label: String(y), r: R(y) })), top = ys.slice().sort((a, b) => b.r - a.r)[0]; return ch(t("text.204"), ys.map(y => ({ id: y.id, label: y.label })), top.id, { before: {}, after: { year: +top.id } }, `${t('game.in', { year: top.label })}${one(top.r)}\u00a0%. ${ys.filter(y => y !== top).map(y => `${y.label}: ${one(y.r)}\u00a0%`).join('; ')}.`, ys.map(y => ({ label: y.label, value: rounded(y.r) }))); },
    () => { const opts = [regs[0], ...pickN(regs.slice(1), 3)]; return ch(t("text.205"), pickN(opts, 4).map(r => ({ id: r.k, label: r.n })), regs[0].k, { before: {}, after: { spot: regs[0].cc } }, `${t("text.206")}${regs[0].n}: ${one(regs[0].v)}${t("text.207")}${regs[regs.length - 1].n}, ${one(regs[regs.length - 1].v)}\u00a0%.`); },
    () => { const lo = regs[regs.length - 1], opts = [lo, ...pickN(regs.slice(0, -1), 3)]; return ch(t("text.208"), pickN(opts, 4).map(r => ({ id: r.k, label: r.n })), lo.k, { before: {}, after: { spot: lo.cc } }, `${t("text.206")}${lo.n}: ${one(lo.v)}${t("text.209")}${regs[0].n}, ${one(regs[0].v)}\u00a0%.`); },
    () => { const l = st(2024); let a, b; for (let i = 0; i < 50; i++) { [a, b] = pickN(l, 2); if (Math.abs(a.r - b.r) >= 5) break; } const w = a.r > b.r ? a : b; return ch(`${t("text.210")}${nameOf(a.cc)}${t("text.211")}${nameOf(b.cc)}?`, [{ id: a.cc, label: nameOf(a.cc) }, { id: b.cc, label: nameOf(b.cc) }], w.cc, { before: {}, after: { spot: [a.cc, b.cc] } }, `${nameOf(w.cc)}: ${one(w.r)}${t("text.212")}${one((w === a ? b : a).r)}\u00a0%.`, [{ label: nameOf(a.cc), value: rounded(a.r) }, { label: nameOf(b.cc), value: rounded(b.r) }]); },
    () => { const y = R(2024, 'todos', 0), o = R(2024, 'todos', 3); return ch(t("text.213"), [{ id: 'y', label: t("text.214") }, { id: 'o', label: t("text.66") }], o > y ? 'o' : 'y', { before: {}, after: { age: 3 } }, `${t("text.215")}${one(o)}${t("text.212")}${one(y)}${t("text.216")}${one(diff1(o, y))}${t("text.217")}`, [{ label: t('age.young'), value: rounded(y) }, { label: t('age.old'), value: rounded(o) }]); },
    () => { const g09 = diff1(R(2012, 'mujeres'), R(2012, 'hombres')), g24 = diff1(R(2024, 'mujeres'), R(2024, 'hombres')); return ch(t("text.218"), [{ id: 'up', label: t("text.219") }, { id: 'down', label: t("text.220") }], g24 > g09 ? 'up' : 'down', { before: { year: 2012, sex: 'mujeres' }, after: { year: 2024, sex: 'mujeres' } }, `${g24 > g09 ? t("text.219") : t("text.220")}${t("text.221")}${one(g09)}${t("text.222")}${one(g24)}${t("text.223")}`); },
  ];
  const lv = [pickN(sliders, 1)[0](), pickN(maps, 1)[0](), ...pickN(choices, 3).map(f => f())];
  return [lv[0], ...pickN(lv.slice(1), 4)];
}

/* ---------- Misión 2027 (juego) ---------- */
// El resultado compartido no incluye el rango: se replican los umbrales de badge() en game.js.
const gameRank = score => t(score >= 450 ? 'text.231' : score >= 300 ? 'text.232' : 'text.233');
let gameSeed = 0, gameLoading = false;
async function startGame() {
  if (mission || gameLoading) return;
  gameLoading = true;
  try {
    const { startMission } = await import('./game.js?v=83');
    if (mission) return;
    let chosenCC = null;
    if (demo) endTour();
    await enterMap({});
    if (S.cc) await selectState(null);
    S.region = null; S.sex = 'todos'; S.age = null; S.year = 2024; S.mode = 'game';
    document.body.classList.add('gaming'); $('#detail').dataset.note = t('game.panelNote'); refresh(); flyTo(natBox(), 500);
    const nf = y => natFlat(y), rs = stateRates(2024).filter(x => x.r != null).sort((a, b) => b.r - a.r);
    const d1821 = CODES.map(cc => ({ cc, d: diff1(calc(stateFlat(cc, 2021), 'todos', null).r, calc(stateFlat(cc, 2018), 'todos', null).r) })).sort((a, b) => b.d - a.d);
    const facts = {
      nat2024: rounded(calc(nf(2024), 'todos', null).r), nat2018: rounded(calc(nf(2018), 'todos', null).r), nat2021: rounded(calc(nf(2021), 'todos', null).r),
      top: { cc: rs[0].cc, name: nameOf(rs[0].cc), rate: rounded(rs[0].r) }, second: { cc: rs[1].cc, name: nameOf(rs[1].cc), rate: rounded(rs[1].r) },
      low: { cc: rs[rs.length - 1].cc, name: nameOf(rs[rs.length - 1].cc), rate: rounded(rs[rs.length - 1].r) },
      women: rounded(calc(nf(2024), 'mujeres', null).r), men: rounded(calc(nf(2024), 'hombres', null).r),
      groups: [{ key: 'h18', label: t("text.46"), rate: rounded(calc(nf(2024), 'hombres', 0).r) }, { key: 'm60', label: t("text.224"), rate: rounded(calc(nf(2024), 'mujeres', 3).r) }, { key: 'h45', label: t("text.225"), rate: rounded(calc(nf(2024), 'hombres', 2).r) }],
      lowest: 'h18',
      up2021: { name: nameOf(d1821[0].cc), delta: rounded(d1821[0].d) }, down2021: { name: nameOf(d1821[d1821.length - 1].cc), delta: rounded(d1821[d1821.length - 1].d) },
    };
    mission = startMission($('#mission'), {
      t, lang: locale, facts, actions: ineActions(), levels: () => { chosenCC = null; gameSeed = Math.random() * 0x100000000; return buildLevels(gameSeed); }, states: CODES.map(cc => ({ cc, name: nameOf(cc) })),
      show(v) { if ('year' in v) S.year = v.year; if ('sex' in v) S.sex = v.sex; if ('age' in v) S.age = v.age; S.spot = v.spot || null; refresh(); requestAnimationFrame(() => flyTo(natBox(), 400)); },
      onMapPick(fn) { picker = fn; return () => { if (picker === fn) picker = null; }; },
      mountSearch(el, onPick) {
        el.innerHTML = t("text.226");
        return bindSearch(el.querySelector('#g-q'), el.querySelector('#g-res'), h => { chosenCC = h.cc; onPick({ cc: h.cc, name: nameOf(h.cc) }); });
      },
      renderCard(el, cc, extra) { S.year = 2024; S.sex = 'todos'; S.age = null; S.spot = [cc]; refresh(); renderCard(el, cardModel(cc, extra || {}), { motionTiming: mobileTiming }); },
      share: (text, res = {}) => {
        if ((res.score ?? 0) < 300) {
          const cc = res.cc && CODES.includes(res.cc) ? res.cc : chosenCC;
          const saved = { ...S };
          let spec;
          // La tarjeta usa el estado de origen y las cifras generales de 2024.
          try { Object.assign(S, { cc, mpio: null, region: null, year: 2024, sex: 'todos', age: null }); spec = viewShareSpec(); }
          finally { Object.assign(S, saved); }
          spec.kicker = t('share.gameStateK', { score: res.score ?? 0 });
          spec.poster = cc ? `assets/estados/${cc}.webp` : null;
          spec.url = publicURL() ? publicURL() + '#y=2024&s=todos' + (cc ? '&e=' + cc : '') : '';
          return openShareSheet(spec, shareApi);
        }
        return openShareSheet({
        poster: null, kicker: t('share.gameK'), title: t('share.gameT'), subtitle: gameRank(res.score ?? 0),
        value: null, valueText: `${res.score ?? 0}/500`, valueLabel: t('share.gameL', { c: res.correct ?? 0, n: res.total ?? 5 }),
        urlText: shareFooter(), independent: t('fix.independent'), color: '#8b5cf6', people: null, lines: [t('share.gameLine')], cta: t('share.gameCta'), source: t('share.source', { year: '2009–2024' }),
        filename: 'pixel-ciudadano-mision-2027.png', shareText: text, url: publicURL(),
      }, shareApi);
      },
      onEnd(res) { endGame(false); if (res && res.cc) selectState(res.cc); },
    });  } catch (error) { console.error(error); }
  finally { gameLoading = false; }
}
function endGame(silent) {
  if (!mission) return;
  const m = mission; mission = null; picker = null;
  try { m.destroy(); } catch { /* ya destruido */ }
  document.body.classList.remove('gaming');
  S.mode = 'map'; S.spot = null; S.sex = 'todos'; S.age = null; S.year = 2024;
  if (!silent) refresh();
}

/* ---------- interacción en el mapa ---------- */
function showTip(e, html) {
  const t = $('#tooltip'), b = stage.getBoundingClientRect();
  t.innerHTML = html; t.hidden = false;
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.min(Math.max(8, e.clientX - b.left + 16), b.width - w - 8) + 'px';
  t.style.top = Math.min(Math.max(8, e.clientY - b.top + 16), b.height - h - 8) + 'px';
}
// Gestos móviles comparten el estado view con los vuelos y los controles existentes.
let mobileMapClickBlockedUntil = 0;
function bindMobileMap() {
  const pointers = new Map();
  let base = null, fit = null, pinch = null, tap = null, tapTimer = 0, dispatching = false;
  const enabled = () => narrow() && S.mode === 'map' && !document.body.matches('.presenting,.demoing,.gaming');
  const point = e => ({ x: e.clientX, y: e.clientY });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const relative = p => { const r = svg.getBoundingClientRect(); return { x: (p.x - r.left) / r.width, y: (p.y - r.top) / r.height }; };
  function apply(v) {
    const w = Math.max(fit.w / 6, Math.min(fit.w, v.w)), h = w * fit.h / fit.w;
    setView({ x: Math.max(fit.x, Math.min(fit.x + fit.w - w, v.x)), y: Math.max(fit.y, Math.min(fit.y + fit.h - h, v.y)), w, h, k: stage.clientWidth / w });
  }
  function begin() {
    base = { ...view }; fit = targetView(activeBox());
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: distance(a, b), center: relative(midpoint(a, b)) };
    } else pinch = null;
  }
  function emitTap(p) {
    if (!enabled() || !p.target.isConnected) return;
    dispatching = true; mobileMapClickBlockedUntil = 0;
    p.target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.x, clientY: p.y }));
    dispatching = false;
  }
  // Solo los toques breves producen selección; se descartan los clics sintetizados tras arrastrar.
  svg.addEventListener('click', e => {
    if (enabled() && !dispatching && e.detail !== 0) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  svg.addEventListener('pointerdown', e => {
    if (!enabled() || e.button !== 0 || pointers.size >= 2) return;
    mobileFlightDone?.(); mobileFlightDone = null; cancelAnimationFrame(raf);
    const p = { ...point(e), start: point(e), time: e.timeStamp, target: e.target, moved: false };
    pointers.set(e.pointerId, p); svg.setPointerCapture(e.pointerId);
    if (pointers.size > 1) { clearTimeout(tapTimer); tap = null; pointers.forEach(v => { v.moved = true; }); }
    begin();
  });
  svg.addEventListener('pointermove', e => {
    if (!enabled() || !pointers.has(e.pointerId)) return;
    e.preventDefault();
    const p = pointers.get(e.pointerId); Object.assign(p, point(e));
    if (distance(p, p.start) >= 8) { p.moved = true; clearTimeout(tapTimer); tap = null; }
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()], center = relative(midpoint(a, b));
      const factor = distance(a, b) / Math.max(1, pinch.distance);
      const w = Math.max(fit.w / 6, Math.min(fit.w, base.w / factor)), h = w * fit.h / fit.w;
      apply({ x: base.x + pinch.center.x * base.w - center.x * w, y: base.y + pinch.center.y * base.h - center.y * h, w });
    } else if (p.moved && base.w < fit.w * .999) {
      const r = svg.getBoundingClientRect();
      apply({ x: base.x - (p.x - p.start.x) * base.w / r.width, y: base.y - (p.y - p.start.y) * base.h / r.height, w: base.w });
    }
  });
  function end(e) {
    const p = pointers.get(e.pointerId); if (!p) return;
    pointers.delete(e.pointerId);
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    if (!enabled()) { pointers.clear(); return; }
    if (e.type === 'pointerup' && !p.moved && distance(point(e), p.start) < 8 && e.timeStamp - p.time < 300) {
      const now = performance.now();
      if (tap && now - tap.time < 300 && distance(p, tap) < 30) {
        clearTimeout(tapTimer); tap = null;
        fit = targetView(activeBox()); const pos = relative(p);
        const w = Math.max(fit.w / 6, view.w / 2), h = w * fit.h / fit.w;
        apply({ x: view.x + pos.x * (view.w - w), y: view.y + pos.y * (view.h - h), w });
      } else {
        if (tap) { clearTimeout(tapTimer); emitTap(tap); }
        tap = { ...p, time: now };
        tapTimer = setTimeout(() => { const pending = tap; tap = null; if (pending) emitTap(pending); }, 300);
      }
    } else mobileMapClickBlockedUntil = performance.now() + 400;
    if (pointers.size) {
      pointers.forEach(v => { v.start = point({ clientX: v.x, clientY: v.y }); v.moved = true; }); begin();
    }
  }
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  narrowMq.addEventListener('change', () => { pointers.clear(); clearTimeout(tapTimer); tap = null; });
}

function bindMap() {
  bindMobileMap();
  svg.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || S.mode === 'home') return;
    const p = e.target.closest('path'); if (!p) { $('#tooltip').hidden = true; return; }
    if (p.parentNode === gMpios) {
      const m = mpios[+p.dataset.i], c = mpioCalc(m), r = c.r, ref = calc(stateFlat(S.cc)).r, ci = c.b && c.b < 2000 ? wilson(c.s, c.b) : null;
      showTip(e, `<strong>${esc(m.n)}</strong>${r == null ? t("text.227") : `<b>${one(r)}</b><span>%</span><small>${diffText(r, ref, t("text.228"))}${ci ? `${t("text.229")}${one(ci[0])}–${one(ci[1])}\u00a0%` : ''}</small>`}`);
    } else {
      const cc = p.dataset.cc, r = calc(stateFlat(cc)).r, ref = natRate().r;
      showTip(e, `<strong>${esc(nameOf(cc))}</strong>${r == null ? t("text.227") : `<b>${one(r)}</b><span>%</span><small>${diffText(r, ref, t("text.52"))}</small>`}`);
    }
  });
  stage.addEventListener('pointerleave', () => { $('#tooltip').hidden = true; });
  svg.addEventListener('pointerleave', () => { $('#tooltip').hidden = true; });
  svg.addEventListener('click', e => {
    if (narrow() && mobileMapClickBlockedUntil > performance.now()) { e.preventDefault(); return; }
    const p = e.target.closest('path'); $('#tooltip').hidden = true;
    if (!p) return;
    if (picker && p.dataset.cc) { picker(p.dataset.cc); return; }
    if (S.mode === 'game' || S.mode === 'demo') return;
    if (p.parentNode === gMpios) selectMpio(mpios[+p.dataset.i].id, { focus: !narrow() });
    else if (p.dataset.cc !== S.cc) selectState(p.dataset.cc, { keepRegion: true });
  });
  // Vista completa: siempre vuelve a todo México, aunque haya zoom manual, región o resaltado
  $('#back-mx').addEventListener('click', () => {
    cancelAnimationFrame(raf); S.region = null; S.spot = null; S.mpio = null;
    if (S.cc) selectState(null); else { refresh(); flyTo(natBox(), 600); }
  });
  // Modo presentación: pantalla completa, sin menú ni tira; el mapa y la ficha quedan grandes
  const presentBtn = $('#present');
  const setPresent = on => {
    document.body.classList.toggle('presenting', on);
    renderPresentBubble();
    syncBack();
    presentBtn.setAttribute('aria-pressed', String(on));
    const key = on ? 'present.off' : 'present.on';
    presentBtn.dataset.i18nAria = key; presentBtn.dataset.i18nTitle = key;
    const lbl = t(key); presentBtn.setAttribute('aria-label', lbl); presentBtn.title = lbl;
    setTimeout(() => { refresh(); flyTo(activeBox(), 400); }, 60);
  };
  presentBtn.addEventListener('click', async () => {
    const on = !document.body.classList.contains('presenting');
    try {
      if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      else if (!on && document.fullscreenElement) await document.exitFullscreen();
    } catch {}
    setPresent(on);
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('presenting')) setPresent(false); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    // El diálogo conserva su cierre nativo y protege las capas inferiores.
    if (document.querySelector('dialog[open]')) { e.stopImmediatePropagation(); return; }
    if (narrow() && S.mode === 'map' && !document.body.classList.contains('presenting') && !tut && !demo && !mission) {
      e.preventDefault(); e.stopImmediatePropagation();
      $('#filters').hidden = true; $('#filters-btn').setAttribute('aria-expanded', 'false');
      mobileSheet?.set('peek'); return;
    }
    if (!document.body.classList.contains('presenting') || tut || demo || mission) return;
    e.preventDefault(); e.stopImmediatePropagation();
    setPresent(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, { capture: true });
  let acc = 0, at = 0;
  stage.addEventListener('wheel', e => {   // rueda/trackpad sobre el mapa: siguiente estado (escritorio)
    if (!S.cc || narrow() || S.mode !== 'map' || e.target.closest('.filters,.years,.tools,.legend,.present-bubble')) return;
    e.preventDefault();
    const now = performance.now(); if (now - at < 650) return;
    acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(acc) < 60) return;
    step(Math.sign(acc)); acc = 0; at = now;
  }, { passive: false });
  const zoom = f => { const cx = view.x + view.w / 2, cy = view.y + view.h / 2, w = view.w * f, h = view.h * f; animateView({ x: cx - w / 2, y: cy - h / 2, w, h, k: view.k / f }, 280); };
  $('#zoom-in').addEventListener('click', () => zoom(.7)); $('#zoom-out').addEventListener('click', () => zoom(1.4));
  document.addEventListener('keydown', e => {
    const t = e.target instanceof Element ? e.target : document.body;
    if (e.defaultPrevented || tut || document.querySelector('dialog[open]') || t.matches('input,textarea,select') || t.closest('dialog') || S.mode === 'game' || S.mode === 'demo') return;
    const openMenu = document.querySelector('details.menu[open]');
    if (e.key === 'Escape' && openMenu) { openMenu.open = false; openMenu.querySelector('summary').focus(); return; }
    if (e.key === 'Escape') {
      if (narrow() && S.mode === 'map') { mobileSheet?.set('peek'); return; }
      if (!$('#filters').hidden) { $('#filters').hidden = true; $('#filters-btn').focus(); }
      else if (S.mpio) backToState(); else if (S.cc) selectState(null, { keepRegion: true }); else if (S.region) selectRegion(S.region);
    } else if (S.cc && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !t.closest('#strip')) step(e.key === 'ArrowRight' ? 1 : -1);
  });
  $('#national-csv').addEventListener('click', downloadNationalCSV);
  $('#dictionary-csv').addEventListener('click', downloadDictionaryCSV);
  $('#print-view').addEventListener('click', () => window.print());
  $('#about-btn').addEventListener('click', () => $('#about').showModal());
  $('#help-btn').addEventListener('click', () => runTutorial());
}

/* ---------- URL compartible ---------- */
function writeHash() {
  if (routingHash) return;
  if (S.mode === 'home') return;
  const p = new URLSearchParams({ y: S.year, s: S.sex }); if (S.age != null) p.set('a', S.age); if (S.region) p.set('r', S.region); if (S.cc) p.set('e', S.cc); if (S.mpio) p.set('m', S.mpio);
  try { history.replaceState(null, '', '#' + p); } catch { /* sin historial */ }
}
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1)), y = +p.get('y');
  if (YEARS.includes(y)) S.year = y; if (SEX_IDX[p.get('s')]) S.sex = p.get('s');
  const a = p.get('a'); if (a != null && +a >= 0 && +a < 4) S.age = +a;
  const r = p.get('r'); if (REGIONS.some(x => x.k === r)) S.region = r;
  return { cc: GEO[p.get('e')] ? p.get('e') : null, m: p.get('m') };
}

let routingHash = false;
window.addEventListener('hashchange', async () => {
  if (!DATA || routingHash) return;
  routingHash = true;
  try {
    endTour(); endGame(true);
    S.sex = 'todos'; S.age = null; S.region = null;
    const route = readHash();
    await selectState(route.cc, { instant: true, keepRegion: true });
    if (route.m && mpios.some(m => m.id === route.m)) selectMpio(route.m, { focus: false });
  } finally { routingHash = false; writeHash(); }
});
/* ---------- arranque ---------- */
async function start() {
  try {
    const [g, d, official] = await Promise.all([fetch('assets/estados.json').then(r => r.json()), fetch('assets/data/estados.json').then(r => r.json()), fetch('assets/data/oficial2024.json').then(r => r.ok ? r.json() : null).catch(() => null)]);
    OFFICIAL = official;
    GEO = g; DATA = d; YEARS = d.years; CODES = Object.keys(GEO).sort(); NAT = {};
    const sr = document.createElement('p'); sr.id = 'sr'; sr.className = 'sr-only'; sr.setAttribute('aria-live', 'polite'); document.body.append(sr);
    const deep = !!location.hash, initial = deep ? readHash() : {};
    buildStates(); buildStrip(); buildRegions(); buildControls(); bindMap(); bindDetail(); bindCardDialog();
    bindSearch($('#q'), $('#q-results'), h => goTo({ cc: h.cc, id: h.id || null }));
    $('#loading').remove();
    if (deep) {
      S.mode = 'map'; document.body.classList.replace('mode-home', 'mode-map'); if (narrow()) mobileSheet?.set('peek', { instant: true }); setView(targetView(activeBox())); refresh();
      if (initial.cc) { await selectState(initial.cc, { instant: true, keepRegion: true }); if (initial.m) selectMpio(initial.m, { focus: false }); }
    } else { setView(targetView(natBox())); paintStates(); mountHomeGlobe(); renderAll(); }
    rotateFeatured();
    let t; new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (S.mode !== 'home') setView(targetView(activeBox())); }, 120); }).observe(stage);
  } catch (e) {
    console.error(e); const l = $('#loading'); if (l) l.innerHTML = t("text.230");
  }
}
/* ---------- preferencias sin reiniciar la vista ---------- */
function syncPreferences() {
  const light = document.documentElement.dataset.theme === 'light';
  const themeButton = $('#theme-toggle');
  themeButton.innerHTML = icon(light ? 'moon' : 'sun');
  themeButton.setAttribute('aria-label', t(light ? 'theme.dark' : 'theme.light'));
  themeButton.title = t(light ? 'theme.dark' : 'theme.light');
  const languageButton = $('#lang-toggle');
  languageButton.textContent = lang() === 'es' ? 'EN' : 'ES';
  languageButton.setAttribute('aria-label', t('language.target'));
  languageButton.title = t('language.target');
  $('#play').setAttribute('aria-label', t(playTimer ? 'text.40' : 'text.41'));
}
function bindPreferences() {
  $('#theme-toggle').addEventListener('click', async event => {
    const button = event.currentTarget;
    const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    const update = () => {
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('pc-theme', theme); } catch { /* Almacenamiento no disponible. */ }
      syncPreferences();
    };
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return; }
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    try {
      const transition = document.startViewTransition(update);
      await transition.ready;
      document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: narrow() ? 300 : 420, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' });
    } catch { update(); }
  });
  $('#lang-toggle').addEventListener('click', () => setLang(lang() === 'es' ? 'en' : 'es'));
  document.addEventListener('pc-language-change', () => {
    syncPreferences();
    renderCitation();
    if (!DATA) return;
    renderLegend(); refresh(); renderDetail(); renderCaption();
    $('#tooltip').hidden = true;
    $('#q').dispatchEvent(new Event('input'));
    if ($('#card-dialog').open && S.cc) renderCard($('#card-dialog-host'), cardModel(S.cc), { motionTiming: mobileTiming });
    if (mission) mission.setLanguage(buildLevels(gameSeed));
    if (demo) demoSteps().then(steps => demo?.setSteps(steps));
  });
  new MutationObserver(() => {
    globe?.setTheme(document.documentElement.dataset.theme);
    syncPreferences();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  setLang(lang());
}

function renderCitation() {
  const el = document.querySelector('[data-i18n="static.322"]');
  if (el) el.textContent = t('static.322') + t('fix.citation', { url: SITE_URL || location.origin + location.pathname, date: new Date().toLocaleDateString(locale()) });
}
bindPreferences();
renderCitation();
start();
