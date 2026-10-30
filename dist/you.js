// "Tu dato": cuánto votó la gente como tú (estado, edad y sexo).
// Todo se calcula en el navegador con los datos del INE; no se guarda ni se envía nada.

const PERSON = 'M12 1a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M1 39V27a11 11 0 0 1 11-11a11 11 0 0 1 11 11v12z';

export function mountYou(dialog, api) {
  const { t } = api;
  const fmt1 = v => Number(v).toLocaleString(api.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const state = { cc: '', age: null, sex: 'todos' };
  const host = dialog.querySelector('.you-body');

  const AGES = [0, 1, 2, 3];
  const SEXES = [['mujeres', 'you.sexW'], ['hombres', 'you.sexM'], ['todos', 'you.sexX']];

  // Frase del grupo: "mujeres de 18 a 29 años", "personas de 60 años o más"…
  const groupLabel = () => t('you.group', { who: t(state.sex === 'mujeres' ? 'you.whoW' : state.sex === 'hombres' ? 'you.whoM' : 'you.whoX'), age: t(`you.age${state.age}`) });

  function render() {
    const options = api.states.map(s => `<option value="${s.cc}"${s.cc === state.cc ? ' selected' : ''}>${s.name}</option>`).join('');
    host.innerHTML = `
      <header class="you-head">
        <svg class="you-pixel" viewBox="0 0 505 665" aria-hidden="true"><use href="#logo"/></svg>
        <div><h2 id="you-t" class="you-title">${t('you.title')}</h2><p class="you-sub">${t('you.sub')}</p></div>
      </header>
      <div class="you-form">
        <label class="you-field"><span class="you-k">${t('you.state')}</span>
          <select id="you-cc"><option value="">${t('you.pick')}</option>${options}</select></label>
        <div class="you-field" role="radiogroup" aria-label="${t('you.ageK')}"><span class="you-k">${t('you.ageK')}</span>
          <div class="you-seg">${AGES.map(a => `<button type="button" role="radio" aria-checked="${state.age === a}" data-age="${a}">${t(`you.ageShort${a}`)}</button>`).join('')}</div></div>
        <div class="you-field" role="radiogroup" aria-label="${t('you.sexK')}"><span class="you-k">${t('you.sexK')}</span>
          <div class="you-seg">${SEXES.map(([k, l]) => `<button type="button" role="radio" aria-checked="${state.sex === k}" data-sex="${k}">${t(l)}</button>`).join('')}</div></div>
      </div>
      <div class="you-result" aria-live="polite">${result()}</div>`;
    host.querySelector('#you-cc').addEventListener('change', e => { state.cc = e.target.value; render(); host.querySelector('#you-cc').focus(); });
    host.querySelectorAll('[data-age]').forEach(b => b.addEventListener('click', () => { state.age = +b.dataset.age; render(); host.querySelector(`[data-age="${state.age}"]`).focus(); }));
    host.querySelectorAll('[data-sex]').forEach(b => b.addEventListener('click', () => { state.sex = b.dataset.sex; render(); host.querySelector(`[data-sex="${state.sex}"]`).focus(); }));
    host.querySelector('[data-you="png"]')?.addEventListener('click', () => download());
    host.querySelector('[data-you="share"]')?.addEventListener('click', () => share());
    host.querySelector('[data-you="map"]')?.addEventListener('click', () => { dialog.close(); api.toMap({ cc: state.cc, sex: state.sex, age: state.age }); });
  }

  // Cálculo del dato: 2021 (última intermedia, como 2027), comparaciones y 2024
  function numbers() {
    const r = api.rate(state.cc, state.sex, state.age, 2021);
    return {
      r, nat: api.rate(null, state.sex, state.age, 2021), old: api.rate(state.cc, 'todos', 3, 2021),
      r24: api.rate(state.cc, state.sex, state.age, 2024), name: api.states.find(s => s.cc === state.cc)?.name || '',
    };
  }

  function result() {
    if (!state.cc || state.age == null) return `<p class="you-empty">${t('you.empty')}</p>`;
    const n = numbers();
    if (n.r == null) return `<p class="you-empty">${t('you.noData')}</p>`;
    const k = Math.round(n.r / 10), d = n.nat != null ? api.diff1(n.r, n.nat) : null;
    const people = Array.from({ length: 10 }, (_, i) => `<svg viewBox="0 0 24 40" aria-hidden="true" class="hp${i < k ? ' on' : ''}" style="--i:${i}"><path d="${PERSON}"/></svg>`).join('');
    const dir = d == null || Math.abs(d) < .05 ? 'eq' : d > 0 ? 'up' : 'down';
    const row = (label, v, extra = '') => v == null ? '' : `<li><span>${label}</span><b>${fmt1(v)} %</b>${extra}</li>`;
    return `
      <div class="you-card" style="--c:${api.color(n.r)}">
        <p class="you-k">${t('you.lead', { group: groupLabel(), state: n.name })}</p>
        <div class="you-big">${fmt1(n.r)} %</div>
        <p class="you-when">${t('you.when')}</p>
        <div class="hs-people you-people" aria-label="${t('you.of10', { n: k })}">${people}</div>
        <ul class="you-cmp">
          ${row(t('you.cmpNat'), n.nat, dir === 'eq' ? `<em>${t('fix.same', { ref: t('you.cmpNat') })}</em>` : `<em class="hs-chip ${dir}">${dir === 'up' ? '▲' : '▼'} ${t('fix.points', { n: fmt1(Math.abs(d)) })}</em>`)}
          ${state.age !== 3 ? row(t('you.cmpOld', { state: n.name }), n.old) : ''}
          ${row(t('you.cmp24'), n.r24)}
        </ul>
        <p class="you-msg">${n.r < 50 ? t('you.msgLow', { k }) : t('you.msgHigh', { k })}</p>
      </div>
      <div class="you-actions">
        <button type="button" class="btn-primary" data-you="png">${api.icon('download')} ${t('you.png')}</button>
        <button type="button" class="btn-ghost" data-you="share">${api.icon('share-2')} ${t('you.share')}</button>
        <button type="button" class="btn-ghost" data-you="map">${api.icon('map')} ${t('you.map')}</button>
      </div>
      ${api.votingActions()}<p>${t('fix.free')}</p><p class="you-privacy">${t('you.privacy')}</p>`;
  }

  // Tarjeta vertical 1080×1920 para historias (Instagram, TikTok, WhatsApp)
  async function drawCard() {
    const n = numbers(), W = 1080, H = 1920;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    try { await Promise.all(['400 40px Inter', '600 40px Inter', '700 200px Inter'].map(f => document.fonts.load(f))); } catch { /* usa la fuente de respaldo */ }
    g.fillStyle = '#0f0f11'; g.fillRect(0, 0, W, H);
    // Póster del estado en la parte superior (recortado a 940 px de alto) con degradado hacia el fondo
    const PH = 940;
    const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = `assets/estados/${state.cc}.webp`; });
    if (img) { const s = Math.max(W / img.width, PH / img.height); g.save(); g.beginPath(); g.rect(0, 0, W, PH); g.clip(); g.drawImage(img, (W - img.width * s) / 2, 0, img.width * s, img.height * s); g.restore(); }
    const grad = g.createLinearGradient(0, PH - 320, 0, PH); grad.addColorStop(0, 'rgba(15,15,17,0)'); grad.addColorStop(1, 'rgba(15,15,17,1)');
    g.fillStyle = grad; g.fillRect(0, PH - 320, W, 320);
    // Texto (cada línea se reduce si no cabe en el ancho)
    const X = 72, MAXW = W - 2 * X;
    const fit = (txt, weight, size, x, y) => { let f = size; do { g.font = `${weight} ${f}px Inter, sans-serif`; f -= 2; } while (g.measureText(txt).width > MAXW && f > 20); g.fillText(txt, x, y); };
    g.fillStyle = '#f4f4f5'; fit(t('you.cardTitle', { state: n.name }), 600, 54, X, 1010);
    g.fillStyle = '#a1a1aa'; fit(groupLabel(), 400, 42, X, 1072);
    g.fillStyle = '#f4f4f5'; g.font = '700 230px Inter, sans-serif'; g.fillText(`${fmt1(n.r)} %`, X - 10, 1300);
    g.fillStyle = api.color(n.r); g.fillRect(X, 1330, 240, 12);
    g.fillStyle = '#d4d4d8'; fit(t('you.cardWhen'), 400, 38, X, 1410);
    const k = Math.round(n.r / 10), path = new Path2D(PERSON);
    for (let i = 0; i < 10; i++) { g.save(); g.translate(X + i * 94, 1450); g.scale(2.4, 2.4); g.fillStyle = i < k ? api.color(n.r) : '#3f3f46'; g.fill(path); g.restore(); }
    if (n.nat != null) { g.fillStyle = '#a1a1aa'; fit(t('you.cardNat', { v: fmt1(n.nat) }), 400, 38, X, 1620); }
    g.fillStyle = '#a1a1aa'; fit(api.shareFooter(), 400, 32, X, 1690);
    g.fillStyle = '#c4b5fd'; fit(t('you.cardCta'), 700, 78, X, 1760);
    g.fillStyle = '#3f3f46'; g.fillRect(X, 1812, W - 2 * X, 2);
    g.fillStyle = '#a1a1aa'; g.font = '600 30px Inter, sans-serif'; g.fillText('PIXEL CIUDADANO', X, 1868);
    g.fillStyle = '#71717a'; g.font = '400 26px Inter, sans-serif'; g.textAlign = 'right'; g.fillText(t('you.cardSrc2'), W - X, 1868); g.textAlign = 'left';
    g.fillStyle = '#a1a1aa'; fit(t('fix.independent'), 400, 24, X, 1902);
    return c;
  }
  async function download() {
    const c = await drawCard();
    c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `mi-dato-${state.cc}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/png');
  }
  async function share() {
    const n = numbers(), text = t('you.shareText', { v: fmt1(n.r), group: groupLabel(), state: n.name }) + ' ' + (api.publicURL() || t('fix.siteName'));
    try {
      const c = await drawCard(), blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const file = new File([blob], `mi-dato-${state.cc}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    api.share(text);
  }

  return {
    open(preset = {}) {
      if (preset.cc) state.cc = preset.cc;
      render(); dialog.showModal();
      setTimeout(() => host.querySelector(state.cc ? '[data-age]' : '#you-cc')?.focus(), 30);
    },
    refresh() { if (dialog.open) render(); },
  };
}
