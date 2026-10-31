import { icon as svgIcon } from './icons.js?v=83';

// Recorrido narrado por Pixel; la aplicación conserva el control del mapa.
export function startDemo(host, api) {
  const t = (key, fallback) => {
    const value = api?.t?.(key);
    return value == null || value === key ? fallback : value;
  };
  const locale = () => (typeof api.lang === 'function' ? api.lang() : api.lang) || 'es-MX';
  if (!host || !api || !Array.isArray(api.steps) || !api.steps.length) {
    throw new TypeError('El recorrido necesita un contenedor y al menos un paso.');
  }

  const doc = host.ownerDocument;
  const win = doc.defaultView;
  let steps = api.steps;
  const narrow = win.matchMedia('(max-width: 860px)');
  let direction = 1;
  let storyBar = null;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups = [];   // temporizadores y animaciones de cada paso
  const runCleanups = () => { while (cleanups.length) { try { cleanups.pop()(); } catch { /* ya limpio */ } } };
  const hadClass = host.classList.contains('demo');
  const previousFocus = doc.activeElement;
  const animations = new Set();
  let index = -1;
  let displayed = null;
  let destroyed = false;
  let timer = null;
  let frame = null;

  host.classList.add('demo');
  const dock = doc.createElement('div');
  dock.className = 'demo-dock';
  dock.innerHTML = `
    <div class="demo-mascot" aria-hidden="true">
      <span class="demo-shadow"></span>
      <div class="demo-pixel-pop"><div class="demo-pixel-float">
        <svg class="demo-pixel" viewBox="0 0 505 665"><use href="#logo"/></svg>
      </div></div>
      <span class="demo-spark"></span>
    </div>
    <section class="demo-bubble" role="dialog">
      <div class="demo-content"></div>
      <div class="demo-live" aria-live="polite" aria-atomic="true"></div>
    </section>`;
  dock.querySelector('section').setAttribute('aria-label', t('demo.dialog', 'Recorrido guiado'));
  host.append(dock);
  const content = dock.querySelector('.demo-content');
  const live = dock.querySelector('.demo-live');
  const pixel = dock.querySelector('.demo-pixel');
  const pop = dock.querySelector('.demo-pixel-pop');
  const spark = dock.querySelector('.demo-spark');
  const mascot = dock.querySelector('.demo-mascot');
  const bubble = dock.querySelector('section');
  // Pixel conserva sus nodos y gestos aunque salga del panel.
  const stagePixel = api.stage ? element('div', 'demo-stage-pixel') : null;
  const stageSpeech = stagePixel ? element('div', 'demo-stage-speech') : null;
  const stageLines = stagePixel ? element('div', 'demo-stage-lines') : null;
  const stageText = stagePixel ? element('p', 'demo-stage-text') : null;
  if (stagePixel) {
    stageSpeech.setAttribute('aria-live', 'polite');
    stageSpeech.setAttribute('aria-atomic', 'true');
    stageLines.append(stageText);
    stageSpeech.append(element('span', 'demo-stage-label', 'PIXEL'), stageLines);
    stagePixel.append(mascot, stageSpeech);
    api.stage.append(stagePixel);
  }

  // La hoja móvil tapa parte del escenario; colocamos a Pixel sobre su borde.
  function positionStagePixel() {
    if (!stagePixel || destroyed) return;
    const stageRect = api.stage.getBoundingClientRect();
    const sheetRect = dock.getBoundingClientRect();
    if (narrow.matches) dock.style.setProperty('--demo-stage-height', `${stageRect.height}px`);
    else dock.style.removeProperty('--demo-stage-height');
    const overlap = narrow.matches && !stagePixel.hidden
      ? Math.max(0, stageRect.bottom - Math.max(stageRect.top, sheetRect.top)) : 0;
    stagePixel.style.setProperty('--demo-sheet-overlap', `${overlap}px`);
  }
  const stageObserver = stagePixel && win.ResizeObserver ? new win.ResizeObserver(positionStagePixel) : null;
  if (stagePixel) {
    stageObserver?.observe(dock);
    stageObserver?.observe(api.stage);
    win.addEventListener('resize', positionStagePixel);
  }

  // Las siete marcas viven en el escenario y desaparecen en el cierre.
  function updateStoryBar(step) {
    if (!narrow.matches || !api.stage) { storyBar?.remove(); storyBar = null; return; }
    if (!storyBar) {
      storyBar = element('div', 'demo-story-bar');
      storyBar.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 7; i++) storyBar.append(element('span', 'demo-story-segment'));
      api.stage.append(storyBar);
    }
    storyBar.hidden = step.layout === 'final';
    [...storyBar.children].forEach((node, i) => node.classList.toggle('is-filled', i <= index));
  }

  // El desplazamiento vertical conserva prioridad sobre el cambio de historia.
  let swipe = null;
  dock.addEventListener('pointerdown', event => {
    if (!narrow.matches || event.isPrimary === false || event.button !== 0 ||
        displayed?.layout === 'final' || event.target.closest('button, a, input, select, textarea, summary, [role="slider"], [contenteditable]')) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dock.setPointerCapture(event.pointerId);
  });
  dock.addEventListener('pointercancel', () => { swipe = null; });
  dock.addEventListener('pointerup', event => {
    const start = swipe; swipe = null;
    if (!narrow.matches || !start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      if (dx < 0) dock.querySelector('.demo-actions .demo-button--primary')?.click();
      else go(index - 1);
    }
  });

  function onWidthChange() {
    if (!destroyed && index >= 0) { cancelMotion(); render(steps[index], displayed); }
  }
  narrow.addEventListener('change', onWidthChange);

  function renderStageSpeech(step, first) {
    if (!stagePixel) return;
    const wasHidden = stagePixel.hidden;
    stagePixel.hidden = step.layout === 'final';
    if (stagePixel.hidden) return;
    const line = step.say || step.title || step.kicker || `${t('text.120', 'Paso ')}${index + 1}`;
    // Ambas frases se superponen durante 150 ms sin duplicar anuncios accesibles.
    if (!first && !wasHidden && !motion.matches && stageText.textContent) {
      const outgoing = stageText.cloneNode(true);
      outgoing.classList.add('demo-stage-text--outgoing');
      outgoing.setAttribute('aria-hidden', 'true');
      stageLines.append(outgoing);
      animate(outgoing, [{ opacity: 1 }, { opacity: 0 }], { duration: 150 });
      animate(stageText, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      const fadeTimer = win.setTimeout(() => outgoing.remove(), 150);
      cleanups.push(() => { win.clearTimeout(fadeTimer); outgoing.remove(); });
    }
    stageText.textContent = line;
    positionStagePixel();
  }

  function element(tag, className, text) {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function animate(node, keyframes, options) {
    if (motion.matches || !node || typeof node.animate !== 'function') return;
    const animation = node.animate(keyframes, api.motionTiming ? api.motionTiming(options) : options);
    animations.add(animation);
    animation.finished.then(() => {
      // Liberamos también los efectos persistentes de las transiciones terminadas.
      animation.cancel();
      animations.delete(animation);
    }, () => animations.delete(animation));
  }

  function cancelMotion() {
    win.clearTimeout(timer);
    win.cancelAnimationFrame(frame);
    timer = null;
    frame = null;
    animations.forEach(animation => animation.cancel());
    animations.clear();
  }

  function button(text, kind, action, iconName = null) {
    const node = element('button', `demo-button demo-button--${kind}`, text);
    node.type = 'button';
    if (iconName) {
      const label = element('span', 'demo-button-label', text);
      node.replaceChildren(label);
      node.insertAdjacentHTML(iconName === 'chevron-left' ? 'afterbegin' : 'beforeend', svgIcon(iconName));
    }
    node.addEventListener('click', action);
    return node;
  }

  function end(mode) {
    if (destroyed) return;
    destroy();
    api.onEnd?.(mode);
  }

  // Las gráficas usan coordenadas internas y colores heredados del tema.
  function svgNode(tag, attributes = {}, text) {
    const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function chart(viz) {
    const box = element('figure', `demo-viz demo-viz--${viz.type}`);
    const number = value => Number(value).toLocaleString(locale());
    // Valores con un decimal fijo (61.0 %, 47.0) para que coincidan con las cifras grandes
    const one = value => Number(value).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const clamp = value => Math.max(0, Math.min(100, value));
    const grow = node => animate(node, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 700, easing: 'ease-out' });
    if (viz.type === 'sim') {
      // Variante compacta: conserva la vista del mapa sin resaltar equivalencias.
      const from = Number(viz.from), to = Number(viz.to), base = Number(viz.base);
      const label = element('label', 'demo-sim-label', viz.label || '');
      const slider = element('input', 'demo-slider');
      slider.type = 'range'; slider.min = from; slider.max = to; slider.step = 'any'; slider.value = from;
      label.append(slider);
      const limits = element('div', 'demo-sim-limits');
      limits.append(element('span', '', viz.minLabel || ''), element('span', '', viz.maxLabel || ''));
      const result = element('output', 'demo-sim-count');
      result.setAttribute('aria-live', 'polite');
      const equiv = element('p', 'demo-sim-equiv');
      const millions = n => one(n / 1e6);
      let anim = null, auto = null, cheered = false;
      const stop = () => {
        win.clearTimeout(auto); auto = null;
        win.cancelAnimationFrame(anim); anim = null;
      };
      const update = () => {
        const v = Number(slider.value), extra = Math.max(0, Math.round((v - from) / 100 * base));
        result.textContent = extra ? `+${millions(extra)} ${viz.millions || t('demo.millions', 'millones')}` : '0';
        slider.style.setProperty('--p', `${clamp((v - from) / (to - from || 1) * 100)}%`);
        // Se usa el primer estado que cabe, igual que en el cierre original.
        const big = extra ? (viz.equiv || []).find(st => st.votes <= extra) : null;
        equiv.replaceChildren();
        if (big && viz.equivText) {
          const parts = viz.equivText.split(/(\{state\}|\{n\}|\{pct\})/);
          for (const part of parts) {
            equiv.append(part === '{state}' ? element('b', '', big.name) :
              doc.createTextNode(part === '{n}' ? millions(big.votes) : part === '{pct}' ? one(100 * extra / viz.natVotes) : part));
          }
        } else equiv.textContent = viz.equivStart || '';
        if (v >= to && !cheered) { cheered = true; mascotMotion({ gesture: 'cheer' }, false); }
        if (v < to) cheered = false;
      };
      const runTo = target => {
        stop();
        if (motion.matches) { slider.value = target; update(); return; }
        const start = Number(slider.value), t0 = win.performance.now();
        const tick = now => {
          const k = Math.min(1, Math.max(0, (now - t0) / 1400)), e = 1 - Math.pow(1 - k, 3);
          slider.value = start + (target - start) * e;
          update();
          anim = k < 1 ? win.requestAnimationFrame(tick) : null;
        };
        anim = win.requestAnimationFrame(tick);
      };
      const play = button(viz.play || t('demo.closeGap', 'Cerrar la brecha'), 'sim-play', () => runTo(to));
      slider.addEventListener('pointerdown', stop);
      slider.addEventListener('input', () => { stop(); update(); });
      update();
      if (!motion.matches) auto = win.setTimeout(() => runTo(to), 900);
      cleanups.push(stop);
      const row = element('div', 'demo-sim-row'); row.append(result, play);
      box.append(label, limits, row, element('p', 'demo-sim-unit', viz.unit || ''), equiv,
        element('p', 'demo-sim-note', viz.note || ''));
    } else if (viz.type === 'gap') {
      // Cada figura representa una de diez personas: la comparación es ilustrativa.
      const from = Number(viz.from), to = Number(viz.to);
      const extra = Math.max(0, Math.round((to - from) / 100 * Number(viz.base)));
      const filled = value => Math.round(clamp(Number(value)) / 10);
      const millions = value => one(value / 1e6);
      const rows = [];
      for (const [i, item] of (viz.rows || []).slice(0, 2).entries()) {
        if (i) {
          const marker = element('div', 'demo-gap2-marker');
          const arrow = element('span', 'demo-gap2-arrow', '↕');
          arrow.setAttribute('aria-hidden', 'true');
          const markerText = element('span', '', viz.gapText || '');
          marker.append(arrow, markerText);
          box.append(marker);
          rows.marker = markerText;
        }
        const row = element('div', 'demo-gap2-row');
        row.style.setProperty('--row-color', item.color || 'var(--accent)');
        const header = element('div', 'demo-gap2-header');
        const value = element('span', 'demo-gap2-value');
        const describe = n => `${(viz.ofTen || '{n} de 10').replace('{n}', filled(n))} · ${one(n)}\u00a0%`;
        value.textContent = describe(item.value);
        header.append(element('span', 'demo-gap2-label', item.label), value);
        const people = element('div', 'demo-gap2-people');
        const icons = [];
        for (let j = 0; j < 10; j++) {
          const person = svgNode('svg', { viewBox: '0 0 24 40', 'aria-hidden': 'true', class: `demo-gap2-person${j < filled(item.value) ? ' is-filled' : ''}` });
          person.append(svgNode('path', { d: 'M12 1a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M1 39V27a11 11 0 0 1 11-11a11 11 0 0 1 11 11v12z' }));
          person.style.setProperty('--pop-delay', `${Math.max(0, j - filled(from)) * 120}ms`);
          people.append(person);
          icons.push(person);
        }
        row.append(header, people);
        box.append(row);
        rows.push({ item, value, describe, icons });
      }
      const result = element('div', 'demo-gap2-result');
      result.hidden = true;
      result.setAttribute('aria-live', 'polite');
      result.setAttribute('aria-atomic', 'true');
      const count = element('div', 'demo-gap2-count');
      // La cifra visual cuenta sin anunciar cada cuadro a lectores de pantalla.
      count.setAttribute('aria-hidden', 'true');
      const announcement = element('span', 'demo-live');
      const unit = element('p', 'demo-gap2-unit', viz.resultUnit || 'votantes más');
      const equiv = element('p', 'demo-gap2-equiv');
      const big = extra ? (viz.equiv || []).find(st => st.votes <= extra) : null;
      if (big && viz.equivText) {
        for (const part of viz.equivText.split(/(\{state\}|\{n\}|\{pct\})/)) {
          equiv.append(part === '{state}' ? element('b', '', big.name) :
            doc.createTextNode(part === '{n}' ? millions(big.votes) : part === '{pct}' ? one(100 * extra / viz.natVotes) : part));
        }
      }
      result.append(count, announcement, unit, equiv);
      let closed = false, anim = null;
      const stop = () => { win.cancelAnimationFrame(anim); anim = null; };
      const showCount = value => { count.textContent = `+${millions(value)} ${viz.millions || t('demo.millions', 'millones')}`; };
      const toggle = button(viz.button || t('demo.closeGap', 'Cerrar la brecha'), 'gap2', () => {
        stop();
        closed = !closed;
        toggle.setAttribute('aria-pressed', String(closed));
        toggle.textContent = closed ? (viz.buttonBack || 'Ver como era') : (viz.button || t('demo.closeGap', 'Cerrar la brecha'));
        const young = rows[0];
        if (young) {
          young.value.textContent = young.describe(closed ? to : young.item.value);
          young.icons.forEach((person, i) => person.classList.toggle('is-new', closed && i >= filled(from) && i < filled(to)));
        }
        result.hidden = !closed;
        if (rows.marker) rows.marker.textContent = closed ? (viz.gapClosed || viz.gapText || '') : (viz.gapText || '');
        announcement.textContent = closed ? `+${millions(extra)} ${viz.millions || t('demo.millions', 'millones')}` : '';
        if (!closed) return;
        mascotMotion({ gesture: 'cheer' }, false);
        showCount(motion.matches ? extra : 0);
        if (motion.matches) return;
        const start = win.performance.now();
        const tick = now => {
          const progress = motion.matches ? 1 : Math.min(1, Math.max(0, (now - start) / 900));
          showCount(extra * progress);
          anim = progress < 1 ? win.requestAnimationFrame(tick) : null;
        };
        anim = win.requestAnimationFrame(tick);
      });
      toggle.setAttribute('aria-pressed', 'false');
      // Las animaciones CSS se cancelan al quitar la clase; el contador libera su rAF.
      cleanups.push(() => {
        stop();
        rows.forEach(row => row.icons.forEach(person => person.classList.remove('is-new')));
      });
      box.append(toggle, result);
    } else if (viz.type === 'picto') {
      const row = element('div', 'demo-pictos');
      const count = Math.max(1, Math.min(50, Math.round(viz.of || 10)));
      const filled = Math.max(0, Math.min(count, Math.round(Number(viz.value) / 10)));
      for (let i = 0; i < count; i++) {
        const person = svgNode('svg', { viewBox: '0 0 24 40', 'aria-hidden': 'true', class: i < filled ? 'demo-person is-filled' : 'demo-person' });
        if (i < filled && viz.color) person.style.setProperty('--c', viz.color);
        person.append(svgNode('path', { d: 'M12 1a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M1 39V27a11 11 0 0 1 11-11a11 11 0 0 1 11 11v12z' }));
        row.append(person);
        if (i < filled) animate(person, [{ opacity: .15 }, { opacity: 1 }], { duration: 180, delay: i * 60, fill: 'backwards' });
      }
      box.append(row);
      box.setAttribute('aria-label', viz.caption || `${filled}/${count}`);
    } else if (viz.type === 'bars') {
      for (const item of (viz.items || []).slice(0, 5)) {
        const row = element('div', 'demo-bar-row');
        const track = element('div', 'demo-bar-track');
        const bar = element('span', `demo-bar${item.hi ? ' is-highlight' : ''}`);
        bar.style.width = `${clamp(Number(item.value) / (Number(viz.max) || 100) * 100)}%`;
        if (item.color) { bar.style.setProperty('--c', item.color); bar.classList.add('has-color'); row.classList.toggle('is-hi', !!item.hi); }
        track.append(bar);
        row.append(element('span', 'demo-bar-label', item.label), track, element('span', 'demo-bar-value', one(item.value) + (viz.unit || '')));
        box.append(row);
        grow(bar);
      }
    } else if (viz.type === 'dumbbell' || viz.type === 'line') {
      const svg = svgNode('svg', { viewBox: '0 0 360 90', role: 'img', 'aria-label': viz.caption || t('demo.chart', 'Gráfica de participación') });
      const lo = Number(viz.min ?? 0), hi = Number(viz.max ?? 100);
      const ratio = v => clamp((Number(v) - lo) / (hi - lo || 1) * 100) / 100;
      if (viz.type === 'dumbbell' && viz.a && viz.b) {
        const x = v => 40 + ratio(v) * 280;
        svg.setAttribute('aria-label', `${viz.a.label}: ${number(viz.a.value)}; ${viz.b.label}: ${number(viz.b.value)}${viz.note ? `. ${viz.note}` : ''}`);
        svg.append(svgNode('line', { x1: 40, x2: 320, y1: 56, y2: 56, class: 'demo-axis' }));
        for (let tick = Math.ceil(lo / 10) * 10, n = 0; tick <= hi && n < 100; tick += 10, n++) {
          svg.append(svgNode('line', { x1: x(tick), x2: x(tick), y1: 52, y2: 60, class: 'demo-axis' }), svgNode('text', { x: x(tick), y: 78, 'text-anchor': 'middle' }, number(tick)));
        }
        const line = svgNode('line', { x1: x(viz.a.value), x2: x(viz.b.value), y1: 43, y2: 43, class: 'demo-connector' });
        svg.append(line); grow(line);
        for (const [i, item] of [viz.a, viz.b].entries()) {
          const accent = Number(item.value) >= Number(i ? viz.a.value : viz.b.value);
          const dot = svgNode('circle', { cx: x(item.value), cy: 43, r: item.color ? 8 : 5, class: accent ? 'demo-dot is-highlight' : 'demo-dot' });
          if (item.color) { dot.style.setProperty('--c', item.color); dot.classList.add('has-color'); }
          svg.append(dot, svgNode('text', { x: x(item.value), y: i ? 29 : 13, 'text-anchor': x(item.value) < 90 ? 'start' : x(item.value) > 270 ? 'end' : 'middle' }, `${item.label} ${one(item.value)}`));
        }
      } else if (viz.type === 'line') {
        const points = viz.points || [];
        const x = i => 28 + i / Math.max(1, points.length - 1) * 304;
        const y = v => 65 - ratio(v) * 44;
        points.forEach((point, i) => {
          if (point.mid) svg.append(svgNode('rect', { x: x(i) - 12, y: 12, width: 24, height: 58, class: 'demo-mid-band' }));
        });
        if (lo <= 50 && hi >= 50) svg.append(svgNode('line', { x1: 20, x2: 340, y1: y(50), y2: y(50), class: 'demo-grid' }));
        const line = svgNode('polyline', { points: points.map((p, i) => `${x(i)},${y(p.y)}`).join(' '), class: 'demo-line', pathLength: 1 });
        svg.append(line);
        animate(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 700, easing: 'ease-out' });
        points.forEach((point, i) => {
          const highlight = String(point.x) === String(viz.hi);
          const pd = svgNode('circle', { cx: x(i), cy: y(point.y), r: point.color ? (highlight ? 6 : 4.5) : 3.5, class: `demo-line-dot${point.mid ? ' is-mid' : ''}${highlight ? ' is-highlight' : ''}` });
          if (point.color) { pd.style.setProperty('--c', point.color); pd.classList.add('has-color'); }
          svg.append(pd, svgNode('text', { x: x(i), y: 86, 'text-anchor': 'middle' }, point.x));
          // Con 6 puntos o menos se rotulan todos, así cualquier cifra del paso aparece en la gráfica
          if (points.length <= 6 || !i || i === points.length - 1 || highlight) svg.append(svgNode('text', { x: x(i), y: y(point.y) - 8, 'text-anchor': 'middle' }, one(point.y)));
        });
        svg.setAttribute('aria-label', points.map(p => `${p.x}: ${number(p.y)}`).join(', '));
      }
      box.append(svg);
    }
    if (viz.type !== 'sim' && (viz.caption || viz.note)) box.append(element('figcaption', 'demo-viz-caption', viz.caption || viz.note));
    animate(box, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, easing: 'ease-out' });
    return box;
  }

  function mascotMotion(step, first) {
    animate(pop, stagePixel ? [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(0)' }] : first ? [{ transform: 'translateY(24px)' }, { transform: 'translateY(0)' }] : [{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: stagePixel ? 260 : first ? 480 : 260, easing: stagePixel ? 'steps(3)' : first ? 'cubic-bezier(.34,1.56,.64,1)' : 'ease-out' });
    const gestures = {
      wave: ['rotate(0)', 'rotate(-8deg)', 'rotate(8deg)', 'rotate(0)'],
      point: ['translateX(0) rotate(0)', 'translateX(6px) rotate(6deg)', 'translateX(0) rotate(0)'],
      crouch: ['scaleY(1)', 'scaleY(.92)', 'scaleY(1)'],
      cheer: ['translateY(0)', 'translateY(-6px)', 'translateY(0)', 'translateY(-6px)', 'translateY(0)']
    };
    const gesture = step.layout === 'final' ? 'cheer' : step.gesture;
    if (gestures[gesture]) animate(pixel, gestures[gesture].map(transform => ({ transform })), { duration: 600, delay: first ? 480 : 260, easing: 'ease-out' });
    animate(spark, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-18px)', opacity: 0 }], { duration: 420, easing: 'ease-out' });
  }

  // El compromiso comparte almacenamiento y comportamiento en cualquier paso.
  function renderPledge(pl) {
    const box = element('section', 'demo-pledge');
    box.append(element('h3', 'demo-actions-title', pl.title));
    let saved = {};
    try {
      const stored = JSON.parse(win.localStorage.getItem('pc-pledge') || '{}');
      if (stored && typeof stored === 'object') saved = stored;
    } catch { /* sin almacenamiento */ }
    const list = element('ul', 'demo-pledge-list');
    pl.items.forEach((text, i) => {
      const li = element('li', ''), label = element('label', ''), cb = element('input', '');
      cb.type = 'checkbox';
      cb.checked = !!saved[i];
      cb.addEventListener('change', () => {
        saved[i] = cb.checked;
        try { win.localStorage.setItem('pc-pledge', JSON.stringify(saved)); } catch { /* sin almacenamiento */ }
        if (pl.items.every((_, j) => !!saved[j])) mascotMotion({ gesture: 'cheer' }, false);
      });
      label.append(cb, element('span', '', text));
      li.append(label); list.append(li);
    });
    box.append(list);
    if (pl.note) box.append(element('p', 'demo-pledge-note', pl.note));
    box.append(button(pl.share, 'pledge-share', () => api.share?.(pl.shareText)));
    if (api.openYou && pl.you) box.append(button(pl.you, 'you-open', () => api.openYou()));
    return box;
  }

  function renderFinal(step) {
    const data = step.final || {};
    if (!stagePixel) content.append(mascot);
    const grid = element('div', 'demo-final-grid');
    const left = element('div', 'demo-final-left');
    const title = element('h2', 'demo-final-title', data.title || step.title || '');
    title.tabIndex = -1;
    if (data.kicker) left.append(element('p', 'demo-final-kicker', data.kicker));
    left.append(title, element('p', 'demo-final-subtitle', data.subtitle || ''));
    // Franja de cifras clave, cada una con el color de la escala del mapa
    if (data.kpis?.length) {
      const band = element('div', 'demo-kpis');
      for (const k of data.kpis) {
        const cell = element('div', 'demo-kpi'); if (k.color) cell.style.setProperty('--c', k.color);
        cell.append(element('span', 'demo-kpi-value', k.value), element('span', 'demo-kpi-label', k.label)); band.append(cell);
      }
      left.append(band);
    }
    if (data.sim) {
      // "La brecha generacional": deslizador desde la participación juvenil real hasta la de 60+,
      // contador, cuadrícula de 100 pixeles (cada uno = 1 % de los jóvenes) y equivalencia verificable
      const sim = data.sim, from = Number(sim.from), to = Number(sim.to), base = Number(sim.base);
      const card = element('section', 'demo-final-card demo-gap');
      const label = element('label', 'demo-sim-label', sim.label || '');
      const slider = element('input', 'demo-slider');
      slider.type = 'range'; slider.min = from; slider.max = to; slider.step = 'any'; slider.value = from;
      label.append(slider);
      const limits = element('div', 'demo-sim-limits');
      limits.append(element('span', '', sim.minLabel), element('span', '', sim.maxLabel));
      const play = button(sim.play || 'Cerrar la brecha', 'gap-play', () => runTo(to));
      const result = element('output', 'demo-gap-count'); result.setAttribute('aria-live', 'polite');
      const unit = element('p', 'demo-gap-unit', sim.unit || '');
      const equiv = element('p', 'demo-gap-equiv');
      const grid = element('div', 'demo-gap-grid'); grid.setAttribute('aria-hidden', 'true');
      const cells = Array.from({ length: 100 }, () => { const c = element('span', 'demo-gap-px'); grid.append(c); return c; });
      const legend = element('p', 'demo-gap-legend', sim.gridLegend || '');
      const note = element('p', 'demo-final-note', sim.note || '');
      const millions = n => (n / 1e6).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      let lastSpot = '', spotTimer = 0, cheered = false;
      const update = () => {
        const v = Number(slider.value), extra = Math.max(0, Math.round((v - from) / 100 * base));
        result.textContent = extra ? `+${millions(extra)} ${sim.millions || 'millones'}` : '0';
        slider.style.setProperty('--p', `${(v - from) / (to - from) * 100}%`);
        const nFrom = Math.round(from), nNow = Math.round(v);
        cells.forEach((c, i) => { c.className = 'demo-gap-px' + (i < nFrom ? ' is-on' : i < nNow ? ' is-new' : ''); });
        grid.style.setProperty('--c-from', sim.colorFrom || 'var(--accent)'); grid.style.setProperty('--c-new', sim.colorTo || 'var(--accent)');
        // Equivalencia honesta: el estado más grande cuyos votantes registrados en 2021 caben en los votantes adicionales
        const one1 = v => Number(v).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const big = extra ? (sim.equiv || []).find(st => st.votes <= extra) : null;
        const fit = big ? [big] : [];
        equiv.innerHTML = '';
        if (big && sim.equivText) {
          const parts = sim.equivText.split('{state}');
          equiv.append(document.createTextNode(parts[0]), element('b', '', big.name), document.createTextNode(parts[1].replace('{n}', millions(big.votes)).replace('{pct}', one1(100 * extra / sim.natVotes))));
        } else equiv.textContent = sim.equivStart || '';
        const key = fit.map(st => st.cc).join(',');
        if (key !== lastSpot) { lastSpot = key; clearTimeout(spotTimer); spotTimer = setTimeout(() => show({ ...step.view, spot: fit.length ? fit.map(st => st.cc) : step.view.spot }), 140); }
        if (v >= to - .05 && !cheered) { cheered = true; mascotMotion({ gesture: 'cheer' }, false); }
        if (v < to - .05) cheered = false;
      };
      let anim = 0;
      const runTo = target => {
        cancelAnimationFrame(anim);
        if (motion.matches) { slider.value = target; update(); return; }
        const start = Number(slider.value), t0 = performance.now(), ms = 1400;
        const tick = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); slider.value = start + (target - start) * e; update(); if (k < 1) anim = requestAnimationFrame(tick); };
        anim = requestAnimationFrame(tick);
      };
      slider.addEventListener('input', () => { cancelAnimationFrame(anim); update(); });
      update();
      // La brecha se cierra sola una vez al entrar (momento clave); luego el usuario la mueve
      if (!motion.matches) { const auto = setTimeout(() => runTo(to), 900); cleanups.push(() => clearTimeout(auto)); }
      const top = element('div', 'demo-gap-top'); top.append(result, play);
      card.append(label, limits, top, unit, equiv, grid, legend, note);
      left.append(card);
      cleanups.push(() => { cancelAnimationFrame(anim); clearTimeout(spotTimer); });
    }
    if (data.ranking) {
      const card = element('section', 'demo-final-card demo-ranking');
      card.append(element('h3', 'demo-card-title', data.ranking.title || ''));
      if (data.ranking.note) card.append(element('p', 'demo-ranking-note', data.ranking.note));
      const ref = Number(data.ranking.ref) || Number(data.sim?.from) || 100;
      const items = (data.ranking.items || []).slice(0, 5);
      const max = Math.max(1, ...items.map(item => Number(item.value) || 0));
      const rows = [];
      items.forEach(item => {
        const row = button('', 'ranking', () => {
          rows.forEach(node => { node.classList.toggle('is-active', node === row); node.setAttribute('aria-pressed', String(node === row)); });
          show({ ...step.view, spot: [item.cc] });
        });
        row.setAttribute('aria-pressed', 'false');
        const track = element('span', 'demo-ranking-track');
        const bar = element('span', 'demo-ranking-bar'); bar.style.width = `${Math.max(0, Math.min(100, Number(item.value) / ref * 100))}%`; if (item.color) bar.style.setProperty('--c', item.color); track.append(bar);   // la línea al final = referencia
        const fmt1 = v => Math.abs(v).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const value = element('span', 'demo-ranking-value', `${fmt1(Number(item.value))}\u00a0%`);
        // Diferencia exacta, calculada antes de redondear (Durango: −9.0, no −8.9)
        const d = Number(item.exact ?? item.value) - ref; value.append(element('small', 'demo-ranking-delta', `${d < 0 ? '−' : '+'}${fmt1(d)} pts`));
        row.append(element('span', 'demo-ranking-name', item.name), track, value);
        rows.push(row); card.append(row);
      });
      left.append(card);
    }
    const right = element('div', 'demo-final-right');
    const tablist = element('div', 'demo-tabs'); tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', t('demo.actions', 'Acciones'));
    const panels = [], tabs = [];
    const prefix = `demo-${Math.random().toString(36).slice(2)}`;
    const select = i => tabs.forEach((tab, n) => { tab.setAttribute('aria-selected', String(i === n)); tab.tabIndex = i === n ? 0 : -1; panels[n].hidden = i !== n; });
    (data.tabs || []).forEach((item, i) => {
      const tab = button(item.label, 'tab', () => select(i));
      tab.id = `${prefix}-tab-${i}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `${prefix}-panel-${i}`);
      const panel = element('div', 'demo-tab-panel'); panel.id = `${prefix}-panel-${i}`; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id); panel.tabIndex = 0;
      tab.addEventListener('keydown', event => {
        const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const n = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        select(n); tabs[n].focus();
      });
      for (const action of item.actions || []) {
        const link = element('a', 'demo-action-link'); link.href = action.href; link.target = '_blank'; link.rel = 'noopener';
        const icon = element('span', 'demo-action-icon'); icon.setAttribute('aria-hidden', 'true');
        // Los iconos SVG proceden de la API confiable de la aplicación.
        if (api.icon && action.icon) icon.innerHTML = api.icon(action.icon) || '';
        const arrow = element('span', 'demo-action-arrow');
        arrow.innerHTML = svgIcon('chevron-right');
        link.append(icon, element('span', '', action.label), arrow); panel.append(link);
      }
      if (item.extra) panel.append(element('p', 'demo-final-note', item.extra));
      for (const recommendation of item.items || []) {
        const card = element('section', 'demo-final-card');
        const text = element('p', 'demo-final-note');
        // Las recomendaciones pueden incluir énfasis del contenido confiable.
        text.innerHTML = recommendation.text || '';
        card.append(element('h3', 'demo-card-title', recommendation.title), text); panel.append(card);
      }
      tabs.push(tab); panels.push(panel); tablist.append(tab);
    });
    if (data.stacked) {
      // Sin pestañas: "Para ti" y "Para el INE" visibles a la vez, cada uno con su título
      panels.forEach((panel, i) => { panel.hidden = false; panel.removeAttribute('role'); panel.removeAttribute('aria-labelledby'); panel.tabIndex = -1;
        const sec = element('section', `demo-final-section demo-final-section--${data.tabs[i].id}`); sec.append(element('h3', 'demo-actions-title', data.tabs[i].label), panel); right.append(sec); });
    } else { select(0); if (data.actionsTitle) right.append(element('h3', 'demo-actions-title', data.actionsTitle)); right.append(tablist, ...panels); }
    if (data.pledge) right.append(renderPledge(data.pledge));
    grid.append(left, right); content.append(grid);
    const actions = element('div', 'demo-final-actions');
    const game = button(data.buttons?.game || t('text.274', 'Jugar Misión 2027'), 'primary', () => end('game'));
    actions.append(game, button(data.buttons?.explore || t('text.272', 'Explorar por mi cuenta'), 'ghost', () => end('explore'))); content.append(actions);
    live.textContent = `${data.title || step.title || ''}. ${data.subtitle || ''}`;
    title.focus({ preventScroll: true });
    content.querySelectorAll('.demo-final-card, .demo-action-link').forEach((card, i) => animate(card, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, delay: i * 80, fill: 'backwards', easing: 'ease-out' }));
  }

  function show(view) {
    try { Promise.resolve(api.show?.(view)).catch(() => {}); }
    catch { /* Los errores del mapa no bloquean el recorrido. */ }
  }

  function render(step, previous) {
    if (destroyed) return;
    const first = !displayed;
    const oldRect = bubble.getBoundingClientRect();
    if (!stagePixel) dock.prepend(mascot);
    runCleanups();
    content.replaceChildren();
    const final = step.layout === 'final';
    updateStoryBar(step);
    dock.classList.toggle('demo-dock--final', final);
    dock.classList.toggle('demo-dock--top', !final && step.dock === 'tl');
    bubble.className = final ? 'demo-final' : 'demo-bubble';
    bubble.scrollTop = 0;
    renderStageSpeech(step, first);
    if (final) {
      renderFinal(step);
      displayed = step;
      mascotMotion(step, first);
      return;
    }
    if (step.say && !stagePixel) {
      const row = element('div', 'demo-speech-row');
      const speech = element('div', 'demo-speech');
      speech.setAttribute('aria-live', 'polite');
      speech.setAttribute('aria-atomic', 'true');
      speech.append(element('span', 'demo-speech-label', 'PIXEL'), element('p', 'demo-speech-text', step.say));
      row.append(mascot, speech); content.append(row);
    }
    content.append(element('div', 'demo-kicker', step.kicker || `${t("text.120", "Paso ")}${index + 1}${t("text.20", " de ")}${steps.length}`));
    content.append(element('h2', 'demo-title', step.title || ''));

    const counters = [];
    if (step.stat || step.stat2) {
      const row = element('div', 'demo-stats');
      // Con la gráfica de pesas las cifras siguen el mismo eje: menor a la izquierda, mayor a la derecha
      if (step.viz?.type === 'dumbbell') row.classList.add('demo-stats--axis');
      for (const key of ['stat', 'stat2']) {
        const stat = step[key];
        if (!stat) continue;
        const cell = element('div', 'demo-stat');
        if (stat.color) { cell.classList.add('has-color'); cell.style.setProperty('--c', stat.color); }   // color de la escala del mapa
        const number = element('div', 'demo-number');
        const decimals = Math.min(20, Math.max(0, Math.trunc(stat.decimals || 0)));
        const formatter = new Intl.NumberFormat(locale(), {
          minimumFractionDigits: decimals, maximumFractionDigits: decimals
        });
        const target = Number(stat.value);
        const from = Number(previous?.[key]?.value ?? 0);
        const paint = value => { number.textContent = formatter.format(value) + (stat.suffix || ''); };
        paint(motion.matches ? target : from);
        counters.push({ from, target, paint });
        cell.append(number, element('div', 'demo-stat-label', stat.label || ''));
        row.append(cell);
      }
      content.append(row);
    }

    if (step.viz) content.append(chart(step.viz));
    if (step.pledge) content.append(renderPledge(step.pledge));

    const prose = element('div', 'demo-text');
    // El texto y los enlaces provienen del contenido confiable de la aplicación.
    prose.innerHTML = step.text || '';
    // Orden de lectura: la frase clave va justo después del título
    const heading = content.querySelector('.demo-title'); if (heading) heading.after(prose); else content.append(prose);
    if (step.actions) {
      const links = element('section', 'demo-step-links');
      links.append(element('h3', 'demo-block-title', step.actions.title || ''));
      for (const item of step.actions.items || []) {
        const link = element('a', 'demo-step-link');
        link.href = item.href; link.target = '_blank'; link.rel = 'noopener';
        const icon = element('span', 'demo-step-link-icon'); icon.setAttribute('aria-hidden', 'true');
        if (api.icon && item.icon) icon.innerHTML = api.icon(item.icon) || '';
        const arrow = element('span', 'demo-step-link-arrow'); arrow.setAttribute('aria-hidden', 'true');
        arrow.innerHTML = svgIcon('chevron-right');
        link.append(icon, element('span', 'demo-step-link-label', item.label), arrow);
        links.append(link);
      }
      content.append(links);
    }
    if (step.details) {
      // Se conserva el formato original y el orden de los bloques adicionales.
      for (const entry of Array.isArray(step.details) ? step.details : [step.details]) {
        const details = element('details', 'demo-details');
        details.append(element('summary', '', entry.summary || ''));
        for (const item of entry.items || []) {
          const section = element('section', 'demo-details-item');
          const text = element('p', '');
          // El contenido editorial confiable puede incluir énfasis en negrita.
          text.innerHTML = item.text || '';
          section.append(element('h4', '', item.title || ''), text);
          details.append(section);
        }
        content.append(details);
      }
    }
    if (step.blocks?.length) {
      const blocks = element('div', 'demo-blocks');
      for (const block of step.blocks) {
        const column = element('section', 'demo-block');
        column.append(element('h3', 'demo-block-title', block.title));
        const list = element('ul', 'demo-list');
        for (const item of block.items || []) {
          const li = doc.createElement('li');
          li.innerHTML = item;
          list.append(li);
        }
        column.append(list);
        blocks.append(column);
      }
      content.append(blocks);
    }

    const footer = element('div', 'demo-footer');
    const progress = element('div', 'demo-progress');
    progress.setAttribute('role', 'list');
    progress.setAttribute('aria-label', `${t("text.120", "Paso ")}${index + 1}${t("text.20", " de ")}${steps.length}`);
    steps.forEach((_, i) => {
      const segment = element('span', `demo-segment${i <= index ? ' demo-segment--filled' : ''}`);
      segment.setAttribute('role', 'listitem');
      segment.setAttribute('aria-label', `${t("text.120", "Paso ")}${i + 1}`);
      if (i === index) segment.setAttribute('aria-current', 'step');
      progress.append(segment);
    });
    const actions = element('div', 'demo-actions');
    const back = button(t("text.271", "Anterior"), 'ghost', () => go(index - 1), 'chevron-left');
    back.disabled = index === 0;
    const last = index === steps.length - 1;
    const next = button(step.buttons?.next?.label ?? (last ? t("text.272", "Explorar por mi cuenta") : t("text.273", "Siguiente")), 'primary',
      () => step.buttons?.next ? end(step.buttons.next.mode) : last ? end('explore') : go(index + 1), 'chevron-right');
    actions.append(back, next);
    if (last && !step.buttons) actions.append(button(t("text.274", "Jugar Misión 2027"), 'ghost', () => end('game')));
    actions.append(button(step.buttons?.skip?.label ?? t("text.275", "Saltar recorrido"), 'skip',
      () => end(step.buttons?.skip ? step.buttons.skip.mode : 'skip')));
    footer.append(progress, actions);
    content.append(footer);
    if (narrow.matches) {
      const body = element('div', 'demo-story-content');
      body.append(...[...content.children].filter(node => node !== footer));
      content.prepend(body);
    }
    positionStagePixel();
    const newRect = bubble.getBoundingClientRect();
    if (!narrow.matches && !first && previous?.layout !== 'final' && step.dock !== previous?.dock) animate(dock, [{ transform: `translateY(${oldRect.top - newRect.top}px)` }, { transform: 'translateY(0)' }], { duration: 300, easing: 'ease-out' });

    // La región viva anuncia únicamente el título y la primera oración.
    const plain = (prose.textContent || '').trim();
    const sentence = plain.match(/^.*?[.!?…](?=\s|$)/u)?.[0] || plain;
    live.textContent = `${step.title || ''}${sentence ? `. ${sentence}` : ''}`;
    displayed = step;
    next.focus({ preventScroll: true });

    if (motion.matches) return;
    mascotMotion(step, first);
    if (narrow.matches) {
      animate(content.querySelector('.demo-story-content'), [
        { transform: `translateX(${direction * 24}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }
      ], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    } else animate(content, [
      { transform: 'translateY(8px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 220, easing: 'ease-out' });

    if (counters.length) {
      const start = win.performance.now();
      const tick = now => {
        if (destroyed) return;
        const t = Math.min(1, Math.max(0, (now - start) / 900));
        const eased = 1 - (1 - t) ** 3;
        counters.forEach(({ from, target, paint }) => paint(from + (target - from) * eased));
        if (t < 1) frame = win.requestAnimationFrame(tick);
        else frame = null;
      };
      frame = win.requestAnimationFrame(tick);
    }
  }

  function go(i) {
    if (destroyed || !Number.isInteger(i) || i < 0 || i >= steps.length || i === index) return;
    const previous = displayed;
    cancelMotion();
    if (narrow.matches) direction = i < index ? -1 : 1;
    index = i;
    const step = steps[index];
    // El movimiento del mapa y la aparición del diálogo son independientes.
    // En celular el encuadre depende de la altura de la tarjeta: primero se dibuja y luego se mueve el mapa
    if (!narrow.matches) show(step.view);
    if (destroyed || index !== i) return;
    if (narrow.matches) { render(step, previous); positionStagePixel(); win.requestAnimationFrame(() => { if (!destroyed && index === i) show(step.view); }); }
    else if (!displayed || motion.matches) render(step, previous);
    else {
      animate(pop, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.9)' }], { duration: 120, fill: 'forwards', easing: 'ease-out' });
      animate(content, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
      timer = win.setTimeout(() => {
        cancelMotion();
        render(step, previous);
      }, 120);
    }
  }

  function onKey(event) {
    const target = event.composedPath?.()[0] || event.target;
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
      target?.closest?.('input, textarea, select, [role="textbox"]') ||
      (event.key !== 'Escape' && target?.closest?.('[role="tablist"]')) || target?.isContentEditable) return;
    if (!['ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') end('skip');
    else go(index + (event.key === 'ArrowLeft' ? -1 : 1));
  }

  function onMotionChange() {
    if (destroyed || !motion.matches) return;
    cancelMotion();
    render(steps[index], displayed);
  }

  function destroy() {
    runCleanups();
    if (destroyed) return;
    destroyed = true;
    cancelMotion();
    doc.removeEventListener('keydown', onKey);
    motion.removeEventListener('change', onMotionChange);
    const ownedFocus = dock.contains(doc.activeElement);
    stageObserver?.disconnect();
    win.removeEventListener('resize', positionStagePixel);
    stagePixel?.remove();
    storyBar?.remove();
    narrow.removeEventListener('change', onWidthChange);
    dock.remove();
    if (!hadClass) host.classList.remove('demo');
    if (ownedFocus && previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
  }

  doc.addEventListener('keydown', onKey);
  motion.addEventListener('change', onMotionChange);
  go(0);
  return { destroy, go, setSteps(next) {
    if (destroyed || !Array.isArray(next) || next.length !== steps.length) return;
    cancelMotion(); steps = next; render(steps[index], displayed);
  } };
}
