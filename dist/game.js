// Misión 2027: toda la partida vive en memoria y usa los datos de la aplicación.
export function startMission(host, api) {
  const translations = new Map();
  const t = (key, fallback) => {
    const translated = api.t?.(key);
    const value = translated && translated !== key ? translated : fallback;
    translations.set(key, { value, fallback }); return value;
  };
  const { states } = api;
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const previousFocus = doc.activeElement;
  const timers = new Set();
  const frames = new Set();
  let destroyed = false;
  let ended = false;
  let generation = 0;
  let level = 0;
  let score = 0;
  let completed = 0;
  let results = [];
  let badges = [];
  let selectedCC = null;
  let phase = 'intro';
  let sound = false;
  let audio = null;
  let unsubscribe = null;
  let searchCleanup = null;
  let levels;

  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, action, className = '') => {
    const node = el('button', `mission__button ${className}`, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const later = (action, delay) => {
    const ticket = generation;
    const id = win.setTimeout(() => {
      timers.delete(id);
      if (!destroyed && ticket === generation) action();
    }, delay);
    timers.add(id);
    return id;
  };
  const frame = action => {
    const ticket = generation;
    const id = win.requestAnimationFrame(time => {
      frames.delete(id);
      if (!destroyed && ticket === generation) action(time);
    });
    frames.add(id);
  };
  const clearWork = () => {
    generation++;
    timers.forEach(id => win.clearTimeout(id));
    frames.forEach(id => win.cancelAnimationFrame(id));
    timers.clear();
    frames.clear();
    if (typeof searchCleanup === 'function') searchCleanup();
    searchCleanup = null;
  };
  const number = value => Number(value).toLocaleString(api.lang?.() || 'es', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  });
  const badge = () => score >= 450 ? t("text.231", "Leyenda cívica") : score >= 300 ? t("text.232", "Detective de datos") : t("text.233", "Explorador/a");

  const root = el('section', 'mission');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', t("text.234", "Misión 2027"));
  const hud = el('header', 'mission__hud');
  const logo = el('span', 'mission__logo', t("text.235", "MISIÓN 2027"));
  const progress = el('div', 'mission__progress');
  const levelLabel = el('span', 'mission__level');
  const xp = el('div', 'mission__xp');
  xp.setAttribute('role', 'progressbar');
  xp.setAttribute('aria-label', t("text.236", "Experiencia acumulada"));
  xp.setAttribute('aria-valuemin', '0');
  xp.setAttribute('aria-valuemax', '500');
  const segments = Array.from({ length: 5 }, () => {
    const segment = el('span', 'mission__segment');
    segment.append(el('span', 'mission__segment-fill'));
    xp.append(segment);
    return segment;
  });
  progress.append(levelLabel, xp);
  const tools = el('div', 'mission__tools');
  const stars = el('span', 'mission__stars');
  const soundButton = button('', () => {
    sound = !sound;
    if (sound) {
      const AudioContext = win.AudioContext || win.webkitAudioContext;
      if (AudioContext && !audio) audio = new AudioContext();
      if (audio) void audio.resume().catch(() => {});
    }
    updateSound();
  }, 'mission__sound');
  function updateSound() {
    const icon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'aria-hidden': 'true' })) icon.setAttribute(key, value);
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', sound ? 'M11 5 6 9H3v6h3l5 4Z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14' : 'M11 5 6 9H3v6h3l5 4Z M16 9l6 6 M22 9l-6 6');
    icon.append(path);
    soundButton.replaceChildren(icon);
    soundButton.setAttribute('aria-pressed', String(sound));
    soundButton.setAttribute('aria-label', sound ? t('game.soundMute', 'Silenciar') : t('text.238', 'Activar sonido'));
  }
  updateSound();
  const exitButton = button(t("text.239", "Salir ✕"), end, 'mission__exit');
  tools.append(stars, soundButton, exitButton);
  hud.append(logo, progress, tools);
  const panel = el('section', 'mission__panel');
  panel.setAttribute('aria-label', t("text.240", "Preguntas de la misión"));
  root.append(hud, panel);
  host.append(root);
  // El escenario contiene la misión: no se vuelve inerte para permitir tocar el mapa.
  const inertElements = [...doc.querySelectorAll('#rail-nav, .strip, #detail, #stage')]
    .filter(node => !node.contains(root) && !root.contains(node))
    .map(node => [node, node.inert]);
  inertElements.forEach(([node]) => { node.inert = true; });
  const modalOutside = () => [...doc.querySelectorAll('dialog[open]')].some(node => !root.contains(node));
  const focusables = () => [...root.querySelectorAll('button, input, select, a[href], [tabindex="0"]')]
    .filter(node => !node.disabled && !node.closest('[hidden], [inert]') && node.getClientRects().length);
  function keepFocus(event) {
    if (!destroyed && !root.contains(event.target) && !modalOutside()) focusables()[0]?.focus({ preventScroll: true });
  }
  doc.addEventListener('focusin', keepFocus);
  const hostProperties = ['position', 'inset', 'pointer-events'];
  const savedStyle = hostProperties.map(key => [key, host.style.getPropertyValue(key), host.style.getPropertyPriority(key)]);
  host.style.setProperty('position', 'absolute');
  host.style.setProperty('inset', '0');
  host.style.setProperty('pointer-events', 'none');

  function blip(kind) {
    if (!sound || !audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(kind === 'unlock' ? 523 : kind === 'correct' ? 660 : 180, now);
    oscillator.frequency.setValueAtTime(kind === 'unlock' ? 1046 : kind === 'correct' ? 880 : 110, now + 0.08);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.21);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  function updateHUD() {
    levelLabel.textContent = level < 5 ? `${t("text.241", "NIVEL ")}${level + 1}/5` : t("text.242", "MISIÓN CUMPLIDA");
    xp.setAttribute('aria-valuenow', String(score));
    xp.setAttribute('aria-valuetext', `${score}${t("text.243", " de 500 XP; ")}${completed}${t("text.244", " niveles completados")}`);
    segments.forEach((segment, index) => {
      segment.firstChild.style.width = `${Math.min(100, Math.max(0, score - index * 100))}%`;
    });
    stars.replaceChildren();
    badges.forEach(name => {
      const star = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      star.setAttribute('viewBox', '0 0 8 8');
      star.setAttribute('width', '8');
      star.setAttribute('height', '8');
      star.setAttribute('role', 'img');
      star.setAttribute('aria-label', name);
      const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M3 0h2v2h1v1h2v2H6v1H5v2H3V6H2V5H0V3h2V2h1z');
      path.setAttribute('fill', 'var(--accent)');
      star.append(path);
      stars.append(star);
    });
  }

  function intro(question, controls) {
    phase = 'answer';
    const heading = el('h2', 'mission__question', question);
    heading.tabIndex = -1;
    heading.id = `mission-question-${Math.random().toString(36).slice(2)}`;
    panel.setAttribute('aria-labelledby', heading.id);
    panel.append(heading, controls);
    heading.focus({ preventScroll: true });
  }

  function animateValue(update, target, duration = 900) {
    if (motion.matches) { update(target); return; }
    const start = win.performance.now();
    const step = time => {
      const fraction = Math.min(1, (time - start) / duration);
      update(target * fraction);
      if (fraction < 1) frame(step);
    };
    update(0);
    frame(step);
  }

  const stateName = cc => states.find(state => String(state.cc) === String(cc))?.name ?? String(cc);
  const answerText = spec => spec.type === 'map' ? stateName(spec.answer)
    : spec.type === 'slider' ? `${spec.answer}${t('text.15', ' de cada 10')}`
      : spec.options.find(option => option.id === spec.answer)?.label ?? String(spec.answer);

  function answer(points, reveal, picked) {
    if (phase !== 'answer') return;
    phase = 'reveal';
    doc.body.classList.remove('game-neutral-map');
    panel.querySelectorAll('.mission__submit, .mission__prediction-hint').forEach(node => { node.hidden = true; });
    panel.querySelectorAll('button, input, select').forEach(input => { input.disabled = true; });
    score += points;
    completed++;
    results[level] = { correct: points === 100, picked };
    if (points === 100) badges.push(`${t("text.246", "Estrella del nivel ")}${level + 1}`);
    updateHUD();
    blip(points === 100 ? 'correct' : 'wrong');
    const feedback = el('div', `mission__feedback mission__feedback--${points === 100 ? 'correct' : points > 0 ? 'almost' : 'wrong'}`);
    feedback.setAttribute('role', 'status');
    feedback.append(el('strong', '', points === 100 ? `${t('game.correct', '¡Correcto!')} +100`
      : points > 0 ? `${t('game.almost', 'Casi')}: +${points}` : t('game.wrong', 'No esta vez')));
    const explanation = el('div', 'mission__reveal');
    panel.append(feedback, explanation);
    const spec = levels[level];
    if (spec.type === 'map') {
      const correct = t('game.correct', '¡Correcto!').replace(/^[¡!]+|[¡!]+$/g, '');
      explanation.append(el('p', 'mission__answer', picked === spec.answer
        ? `✓ ${correct}: ${stateName(spec.answer)}`
        : `✗ ${t('game.youPicked', 'Elegiste')} ${stateName(picked)} · ${correct}: ${stateName(spec.answer)}`));
    }
    feedback.tabIndex = -1;
    feedback.focus({ preventScroll: true });
    const delay = reveal(explanation);
    later(() => {
      const next = button(t("text.250", "Siguiente ▸"), () => { level++; renderLevel(); }, 'mission__next');
      const footer = el('footer', 'mission__footer');
      footer.append(next);
      panel.append(footer);
      next.focus({ preventScroll: true });
    }, motion.matches ? 0 : (delay ?? 900));
  }

  function revealLevel(spec, container) {
    if (spec.after) api.show(spec.after);
    const reveal = () => {
      if (spec.countTo !== undefined) {
        const counter = el('p');
        counter.setAttribute('aria-hidden', 'true');
        container.append(counter);
        animateValue(value => { counter.textContent = `${number(value)} %`; }, spec.countTo);
      }
      (spec.bars || []).forEach(bar => {
        const row = el('div', 'mission__bar-row');
        row.append(el('span', '', `${bar.label}: ${number(bar.value)} %`));
        const track = el('div', 'mission__bar-track');
        track.setAttribute('aria-hidden', 'true');
        const fill = el('span', 'mission__bar-fill');
        track.append(fill); row.append(track); container.append(row);
        animateValue(value => { fill.style.width = `${Math.max(0, Math.min(100, value))}%`; }, bar.value);
        const scale = el('div', 'mission__bar-scale');
        scale.append(el('span', '', '0 %'), el('span', '', '100 %'));
        row.append(scale);
      });
    };
    // La explicación aparece de inmediato, incluso durante la transición del mapa.
    const why = el('p', 'mission__why');
    why.append(el('strong', '', t('game.why', 'Por qué:')), doc.createTextNode(' '),
      el('span', '', spec.reveal || (spec.bars || []).map(bar => `${bar.label}: ${number(bar.value)} %`).join(' · ') || answerText(spec)));
    container.append(why);
    if (spec.after2) {
      const secondStep = () => { api.show(spec.after2); reveal(); };
      const delay = motion.matches ? 0 : (spec.after2.delay ?? 900);
      if (delay === 0) secondStep(); else later(secondStep, delay);
      return delay + 900;
    }
    reveal();
    return 900;
  }

  function renderLevel() {
    clearWork();
    panel.replaceChildren();
    panel.classList.remove('mission__panel--unlocked');
    panel.scrollTop = 0;
    updateHUD();
    if (level === 5) { renderHome(); return; }
    const spec = levels[level];
    doc.body.classList.toggle('game-neutral-map', spec.type === 'map');
    if (spec.before) api.show(spec.before);
    const controls = el('div', 'mission__controls');
    if (spec.type === 'slider') {
      const label = el('label', 'mission__label', t("text.253", "Tu predicción: "));
      const output = el('output', '', t("text.254", "5 de cada 10"));
      const slider = el('input', 'mission__slider');
      slider.type = 'range';
      slider.min = '1'; slider.max = '10'; slider.step = '1'; slider.value = '5';
      const id = `mission-slider-${Math.random().toString(36).slice(2)}`;
      slider.id = id; label.htmlFor = id; output.htmlFor = id;
      label.append(output);
      const blocks = el('div', 'mission__blocks');
      const pixels = Array.from({ length: 10 }, (_, index) => {
        const pixel = el('button');
        pixel.type = 'button';
        pixel.setAttribute('aria-label', `${index + 1}${t('text.15', ' de cada 10')}`);
        pixel.addEventListener('click', () => {
          if (phase !== 'answer') return;
          slider.value = String(index + 1);
          interact();
        });
        return pixel;
      });
      blocks.append(...pixels);
      const sync = () => {
        output.value = `${slider.value}${t("text.15", " de cada 10")}`;
        slider.setAttribute('aria-valuetext', output.value);
        pixels.forEach((pixel, index) => pixel.classList.toggle('is-filled', index < Number(slider.value)));
      };
      sync();
      const submit = button(t("text.255", "¡Listo!"), () => {
        if (phase !== 'answer') return;
        const picked = Number(slider.value);
        const difference = Math.abs(Number(slider.value) - spec.answer);
        blocks.classList.add('is-answered');
        pixels.forEach((pixel, index) => {
          if (index + 1 === spec.answer) {
            pixel.classList.add('is-correct');
            pixel.dataset.label = `✓ ${t('game.answer', 'Respuesta')}: ${spec.answer}`;
          } else if (index + 1 === picked) {
            pixel.classList.add('is-wrong');
            pixel.dataset.label = '✗';
          }
        });
        answer(difference === 0 ? 100 : difference === 1 ? 60 : 20, container => revealLevel(spec, container), picked);
      });
      submit.classList.add('mission__submit');   // acción principal del nivel
      submit.disabled = true;
      const hint = el('p', 'mission__hint mission__prediction-hint', t('game.predictionHint', 'Mueve la barra o toca un cuadrito'));
      hint.id = `${id}-hint`;
      submit.setAttribute('aria-describedby', hint.id);
      slider.setAttribute('aria-describedby', hint.id);
      function interact() {
        sync();
        if (phase !== 'answer') return;
        submit.disabled = false;
        hint.hidden = true;
      }
      slider.addEventListener('input', interact);
      controls.append(label, blocks, slider, submit, hint);
      intro(spec.q, controls);
    } else if (spec.type === 'map') {
      const help = el('p', 'mission__hint', t("text.256", "Toca un estado en el mapa o usa la lista."));
      const list = el('div', 'mission__state-list'); list.hidden = true;
      const label = el('label', 'mission__label', t("text.119", "Estado"));
      const select = el('select', 'mission__select');
      label.append(select);
      const placeholder = el('option', '', t("text.257", "Selecciona un estado")); placeholder.value = ''; select.append(placeholder);
      states.forEach(state => { const option = el('option', '', state.name); option.value = state.cc; select.append(option); });
      select.addEventListener('change', () => { if (select.value) pickState(select.value); });
      list.append(label);
      const open = button(t("text.258", "Elegir de una lista"), () => {
        list.hidden = false; open.setAttribute('aria-expanded', 'true'); select.focus();
      });
      open.setAttribute('aria-expanded', 'false');
      controls.append(help, open, list);
      intro(spec.q, controls);
    } else if (spec.type === 'choice') {
      // Fisher-Yates evita alterar el arreglo de datos recibido.
      const options = [...spec.options];
      const labels = options.map(option => option.label);
      const fixedOrder = options.length === 2 && (
        (labels.includes(t("text.198", "Subió")) && labels.includes(t("text.199", "Bajó"))) ||
        (labels.includes(t("text.259", "Sí")) && labels.includes('No'))
      );
      if (!fixedOrder) {
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [options[i], options[j]] = [options[j], options[i]];
        }
      }
      const optionButtons = options.map(option => button(option.label, () => {
        if (phase !== 'answer') return;
        optionButtons.forEach((node, index) => {
          if (options[index].id === spec.answer) {
            node.classList.add('is-correct');
            node.prepend(doc.createTextNode('✓ '));
          } else if (options[index].id === option.id) {
            node.classList.add('is-wrong');
            node.prepend(doc.createTextNode('✗ '));
          } else node.classList.add('is-muted');
        });
        answer(option.id === spec.answer ? 100 : 0, container => revealLevel(spec, container), option.id);
      }));
      controls.append(...optionButtons);
      intro(spec.q, controls);
    }
  }

  function pickState(cc) {
    const spec = levels[level];
    if (spec?.type !== 'map' || phase !== 'answer') return;
    answer(cc === spec.answer ? 100 : (spec.partial || []).includes(cc) ? 50 : 0,
      container => revealLevel(spec, container), cc);
  }

  function renderHome() {
    const controls = el('div', 'mission__controls');
    const search = el('div', 'mission__search');
    const ticket = generation;
    // El buscador puede devolver una función opcional de limpieza.
    searchCleanup = api.mountSearch(search, pick => {
      if (destroyed || ticket !== generation || level !== 5 || phase !== 'answer' || !pick?.cc) return;
      selectedCC = pick.cc;
      showResult(true);
    });
    controls.append(search, button(t("text.260", "Saltar"), () => showResult(false), 'mission__link'));
    intro(t("text.261", "¿De dónde eres?"), controls);
  }

  function showResult(unlocked) {
    clearWork();
    phase = 'result';
    panel.replaceChildren();
    panel.removeAttribute('aria-labelledby');
    panel.classList.add('mission__panel--unlocked');
    const title = el('h2', 'mission__unlock-title', unlocked ? t("text.262", "CARTA DESBLOQUEADA") : t("text.263", "¡MISIÓN COMPLETADA!"));
    title.setAttribute('role', 'status');
    const overlay = el('div', 'mission__result');
    const scoreLine = el('p', 'mission__score');
    scoreLine.append(el('span', 'mission__score-label', t('text.264', 'Puntaje ')), el('span', '', `${score}/500`));
    overlay.append(title, scoreLine, el('p', 'mission__badge', badge()));
    const speech = el('div', 'mission__speech');
    speech.setAttribute('aria-live', 'polite');
    speech.append(el('span', 'mission__speech-label', 'PIXEL'), el('p', 'mission__speech-text', score >= 300
      ? t('game.cheerHi', '¡Eso, detective!')
      : t('game.cheerLo', '¿Otra ronda? Cada partida es distinta.')));
    overlay.append(speech);
    // Aviso de proyecto independiente en la pantalla final
    overlay.append(el('p', 'mission__notice', t('fix.independent', 'Proyecto independiente · No es sitio oficial del INE')));
    panel.append(overlay);
    if (unlocked) {
      blip('unlock');
      if (!motion.matches) {
        const burst = el('div', 'mission__burst'); burst.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 16; i++) {
          const particle = el('i', 'mission__particle');
          const angle = i * Math.PI / 8;
          particle.style.setProperty('--dx', `${Math.cos(angle) * 155}px`);
          particle.style.setProperty('--dy', `${Math.sin(angle) * 125}px`);
          burst.append(particle);
        }
        overlay.append(burst);
        later(() => burst.remove(), 750);
      }
      const card = el('div');
      overlay.append(card);
      const revealCard = () => {
        card.classList.add('mission__card');
        api.renderCard(card, selectedCC, { score, badge: badge() });
      };
      if (motion.matches) revealCard(); else later(revealCard, 700);
    }
    const learned = el('section', 'mission__learned');
    learned.append(el('h3', '', t('game.learned', 'Aprendiste:')));
    const summary = el('ul', 'mission__summary');
    levels.forEach((spec, index) => {
      const row = el('li', results[index]?.correct ? 'is-correct' : 'is-wrong');
      const value = spec.countTo !== undefined ? `${number(spec.countTo)} %` : answerText(spec);
      const text = `${spec.q} · ${value}`;
      const line = el('span', 'mission__summary-text');
      line.append(el('span', 'mission__summary-question', spec.q), el('strong', 'mission__summary-answer', ` · ${value}`));
      row.append(el('span', 'mission__summary-mark', results[index]?.correct ? '✓' : '✗'), line);
      row.title = text;
      summary.append(row);
    });
    learned.append(summary);
    overlay.append(learned);
    const actionSection = el('section', 'mission__actions');
    actionSection.append(el('h3', '', t('game.takeAction', 'Ahora haz algo:')));
    (api.actions || []).forEach(action => {
      const link = el('a', 'mission__button mission__action');
      link.href = action.href;
      link.target = '_blank';
      link.rel = 'noopener';
      if (action.icon) {
        const icon = el('span', 'mission__action-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = action.icon;
        link.append(icon);
      }
      const arrow = el('span', 'mission__action-arrow', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      link.append(el('span', '', action.label), arrow);
      actionSection.append(link);
    });
    overlay.append(actionSection);
    const actions = el('div', 'mission__controls');
    const share = button(t("text.265", "Compartir mi resultado"), () => {
      api.share(`${t("text.266", "Hice ")}${score}${t("text.267", "/500 en la Misión 2027 de Pixel Ciudadano. ¿Sabes quién vota en tu estado?")}`,
        { poster: null, score, correct: results.filter(x => x && x.correct).length, total: results.length || 5, badges: badges.slice() });   // datos para la tarjeta
    });
    actions.append(share, button(t("text.268", "Explorar el mapa"), end), button(t("text.269", "Jugar otra vez"), () => {
      score = 0; completed = 0; level = 0; badges = []; results = []; selectedCC = null;
      levels = api.levels();
      renderLevel();
    }));
    overlay.append(actions);
    share.focus({ preventScroll: true });
  }

  function renderInvitation() {
    clearWork();
    phase = 'invite';
    updateHUD();
    const title = el('h2', 'mission__question', t('game.inviteTitle', 'Misión 2027'));
    const text = el('p', 'mission__invite-text', t('game.inviteText', '5 preguntas · 2 minutos · aprende quién vota en México y desbloquea la carta de tu estado'));
    const start = button(t('game.start', 'Empezar'), renderLevel, 'mission__primary');
    const dismiss = button(t('game.notNow', 'Ahora no'), () => {
      if (ended || destroyed) return;
      ended = true;
      destroy();
      api.onEnd();
    }, 'mission__ghost');
    const controls = el('div', 'mission__controls');
    controls.append(start, dismiss);
    panel.replaceChildren(title, text, controls);
    start.focus({ preventScroll: true });
  }

  function end() {
    if (ended || destroyed) return;
    ended = true;
    const result = { score, maxScore: 500, badges: [...badges, ...(level === 5 ? [badge()] : [])], cc: selectedCC };
    destroy();
    api.onEnd(result);
  }

  function onKey(event) {
    if (destroyed || modalOutside()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      end();
    } else if (event.key === 'Tab') {
      const nodes = focusables();
      const current = nodes.indexOf(doc.activeElement);
      if (current < 0 || (event.shiftKey && current === 0) || (!event.shiftKey && current === nodes.length - 1)) {
        event.preventDefault();
        nodes[event.shiftKey ? nodes.length - 1 : 0]?.focus({ preventScroll: true });
      }
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearWork();
    if (typeof unsubscribe === 'function') unsubscribe();
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('focusin', keepFocus);
    inertElements.forEach(([node, wasInert]) => { node.inert = wasInert; });
    doc.body.classList.remove('game-neutral-map');
    if (audio) void audio.close().catch(() => {});
    const focusInside = root.contains(doc.activeElement);
    root.remove();
    savedStyle.forEach(([key, value, priority]) => {
      if (value) host.style.setProperty(key, value, priority);
      else host.style.removeProperty(key);
    });
    if (focusInside && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }

  levels = api.levels();
  unsubscribe = api.onMapPick(pickState);
  doc.addEventListener('keydown', onKey, true);
  renderInvitation();
  return { destroy, setLanguage(nextLevels) {
    if (destroyed || !api.t) return;
    const replacements = new Map();
    for (const [key, entry] of translations) {
      const translated = api.t(key);
      const next = translated && translated !== key ? translated : entry.fallback;
      if (entry.value !== next) replacements.set(entry.value, next);
      entry.value = next;
    }
    const pair = (before, after) => {
      if (typeof before === 'string' && typeof after === 'string' && before !== after) replacements.set(before, after);
      else if (before && after && typeof before === 'object') Object.keys(before).forEach(key => {
        pair(before[key], after[key]);
        if (typeof before[key] === 'string') before[key] = after[key];
      });
    };
    pair(levels, nextLevels);
    // Sustituye únicamente texto, sin recrear controles ni reiniciar temporizadores.
    const ordered = [...replacements].filter(([from]) => from).sort((a, b) => b[0].length - a[0].length);
    // También traduce fragmentos dentro de etiquetas con símbolos y puntajes.
    const pattern = ordered.length ? new RegExp(ordered.map(([from]) => from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;
    const translate = text => {
      if (replacements.has(text)) return replacements.get(text);
      return pattern ? text.replace(pattern, match => replacements.get(match)) : text;
    };
    const walker = doc.createTreeWalker(root, 4);
    while (walker.nextNode()) walker.currentNode.nodeValue = translate(walker.currentNode.nodeValue);
    root.querySelectorAll('[aria-label], [aria-valuetext], [title], [placeholder], [data-label]').forEach(node => {
      for (const attr of ['aria-label', 'aria-valuetext', 'title', 'placeholder', 'data-label']) if (node.hasAttribute(attr)) node.setAttribute(attr, translate(node.getAttribute(attr)));
    });
    badges = badges.map(translate); updateHUD();
    const slider = panel.querySelector('.mission__slider');
    if (slider) slider.setAttribute('aria-valuetext', panel.querySelector('output').value);
  } };
}
