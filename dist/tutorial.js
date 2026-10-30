let tutorialId = 0;

export function startTutorial(api) {
  const steps = api.steps || [];
  const previousFocus = document.activeElement;
  const id = `tutorial-${++tutorialId}`;
  const hole = document.createElement('div');
  const backdrop = document.createElement('div');
  const bubble = document.createElement('div');
  hole.className = 'tut-hole';
  backdrop.className = 'tut-backdrop';
  bubble.className = 'tut-bubble';
  hole.setAttribute('aria-hidden', 'true');
  backdrop.setAttribute('aria-hidden', 'true');
  bubble.setAttribute('role', 'dialog');
  bubble.setAttribute('aria-live', 'polite');
  bubble.setAttribute('aria-labelledby', `${id}-title`);
  bubble.setAttribute('aria-describedby', `${id}-text`);
  bubble.tabIndex = -1;
  hole.hidden = backdrop.hidden = bubble.hidden = true;
  document.body.append(backdrop, hole, bubble);

  let index = -1;
  let version = 0;
  let destroyed = false;
  let ready = false;
  let completed = false;
  let target = null;
  let focusPending = false;
  let frame = null;
  let enterFrame = null;
  let waitTimer = null;
  let advanceTimer = null;
  let moveTimer = null;
  let targetTimer = null;

  const translate = (key, fallback) => api.t?.(key, fallback) ?? fallback;
  const isFinal = () => index >= steps.length;

  function clearStep() {
    ready = false;
    target = null;
    if (frame !== null) cancelAnimationFrame(frame);
    if (enterFrame !== null) cancelAnimationFrame(enterFrame);
    clearInterval(waitTimer);
    clearInterval(moveTimer);
    clearTimeout(advanceTimer);
    clearTimeout(targetTimer);
    frame = enterFrame = waitTimer = moveTimer = advanceTimer = targetTimer = null;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    version++;
    const restoreFocus = bubble.contains(document.activeElement);
    clearStep();
    window.removeEventListener('resize', refresh);
    window.removeEventListener('scroll', refresh, true);
    document.removeEventListener('keydown', onKeydown, true);
    bubble.remove();
    hole.remove();
    backdrop.remove();
    if (restoreFocus && previousFocus?.isConnected) {
      previousFocus.focus?.({ preventScroll: true });
    }
  }

  function end(reason) {
    if (destroyed) return;
    destroy();
    api.onEnd?.(reason);
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      end('skip');
    }
  }

  function button(label, primary, onClick) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = primary ? 'tut-button tut-primary' : 'tut-button tut-ghost';
    node.textContent = label;
    node.addEventListener('click', onClick);
    return node;
  }

  function renderCard(card, final) {
    bubble.replaceChildren();
    bubble.classList.remove('tut-complete');
    bubble.classList.toggle('tut-final', final);
    if (final) bubble.setAttribute('aria-modal', 'true');
    else bubble.removeAttribute('aria-modal');

    const head = document.createElement('div');
    head.className = 'tut-head';
    const pixel = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pixel.setAttribute('viewBox', '0 0 505 665');
    pixel.setAttribute('aria-hidden', 'true');
    pixel.classList.add('tut-pixel');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#logo');
    pixel.append(use);
    const counter = document.createElement('span');
    counter.className = 'tut-count';
    counter.style.font = '400 12px/1.5 var(--pixel, monospace)';
    // El contador solo cuenta los pasos con acción; la tarjeta final dice "Listo"
    counter.textContent = index < steps.length
      ? translate('tut.count', 'Tutorial {n} de {total}').replaceAll('{n}', String(index + 1)).replaceAll('{total}', String(steps.length))
      : translate('tut.done', 'Listo');
    const check = document.createElement('span');
    check.className = 'tut-check';
    check.textContent = '✓';
    check.hidden = true;
    head.append(pixel, counter, check);
    const title = document.createElement('h2');
    title.id = `${id}-title`;
    title.className = 'tut-title';
    title.style.fontSize = '18px';
    title.textContent = card.title || '';
    const text = document.createElement('p');
    text.id = `${id}-text`;
    text.className = 'tut-text';
    text.style.fontSize = '15px';
    text.textContent = card.text || '';
    const actions = document.createElement('div');
    actions.className = 'tut-actions';
    if (final) {
      const items = card.actions || [];
      for (const action of items) {
        actions.append(button(action.label, !!action.primary, () => {
          if (destroyed || completed) return;
          completed = true;
          try {
            action.onClick?.();
          } finally {
            end('done');
          }
        }));
      }
      if (!items.length) {
        actions.append(button(translate('tut.done', 'Listo'), true, () => end('done')));
      }
    } else {
      actions.append(
        button(translate('tut.next', 'Siguiente'), true, next),
        button(translate('tut.skip', 'Saltar tutorial'), false, () => end('skip')),
      );
    }
    bubble.append(head, title, text, actions);
    focusPending = true;
  }

  function targetRect(node) {
    if (!node?.isConnected || node.closest('[hidden]')) return null;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0 ? rect : null;
  }

  function reposition() {
    frame = null;
    if (destroyed || !ready) return;
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    let rect = !isFinal() ? targetRect(target) : null;
    // El desplazamiento precede a la medición definitiva del objetivo.
    if (rect && ((rect.height <= height && (rect.top < 0 || rect.bottom > height)) || (rect.width <= width && (rect.left < 0 || rect.right > width)) || rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width)) {
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      rect = targetRect(target);
    }
    bubble.style.width = '';
    bubble.style.maxHeight = `${height - 24}px`;
    const size = bubble.getBoundingClientRect();
    let left = (width - size.width) / 2;
    let top = (height - size.height) / 2;
    let visible = !!rect;
    if (rect) {
      const gap = 20;
      const sides = [
        { name: 'right', room: width - rect.right - gap - 12, needed: size.width, left: rect.right + gap, top: rect.top + (rect.height - size.height) / 2 },
        { name: 'left', room: rect.left - gap - 12, needed: size.width, left: rect.left - size.width - gap, top: rect.top + (rect.height - size.height) / 2 },
        { name: 'bottom', room: height - rect.bottom - gap - 12, needed: size.height, left: rect.left + (rect.width - size.width) / 2, top: rect.bottom + gap },
        { name: 'top', room: rect.top - gap - 12, needed: size.height, left: rect.left + (rect.width - size.width) / 2, top: rect.top - size.height - gap },
      ];
      let side;
      if (width <= 860) {
        side = sides.find(item => item.name === (rect.top + rect.height / 2 < height / 2 ? 'bottom' : 'top'));
      } else {
        const fitting = sides.filter(item => item.room >= item.needed);
        side = (fitting.length ? fitting : sides)
          .reduce((best, item) => item.room > best.room ? item : best);
      }
      if (side.room > 0) {
        // Si falta altura, el contenido se desplaza dentro de la burbuja sin tapar el objetivo.
        if (side.name === 'top' || side.name === 'bottom') {
          bubble.style.maxHeight = `${Math.min(height - 24, side.room)}px`;
          const actual = bubble.getBoundingClientRect();
          left = width <= 860 ? (width - actual.width) / 2 : side.left;
          top = width <= 860 ? (side.name === 'top' ? 12 : height - actual.height - 12)
            : side.name === 'top' ? rect.top - actual.height - gap : rect.bottom + gap;
          if (actual.height > side.room) {
            visible = false;
            top = (height - actual.height) / 2;
          }
        } else {
          if (side.room < size.width) bubble.style.width = `${side.room}px`;
          const actual = bubble.getBoundingClientRect();
          left = side.name === 'left' ? rect.left - actual.width - gap : rect.right + gap;
          top = rect.top + (rect.height - actual.height) / 2;
          if (actual.width > side.room) {
            visible = false;
            left = (width - actual.width) / 2;
          }
        }
      } else {
        // Un objetivo que ocupa toda la pantalla no deja espacio para un hueco útil.
        visible = false;
      }
    }
    const actual = bubble.getBoundingClientRect();
    left = Math.max(12, Math.min(left, width - actual.width - 12));
    top = Math.max(12, Math.min(top, height - actual.height - 12));
    hole.hidden = !visible;
    if (visible) {
      Object.assign(hole.style, {
        left: `${rect.left - 8}px`, top: `${rect.top - 8}px`,
        width: `${rect.width + 16}px`, height: `${rect.height + 16}px`,
      });
    }
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.style.visibility = 'visible';
    if (focusPending) {
      focusPending = false;
      (bubble.querySelector('.tut-primary') || bubble.querySelector('button') || bubble)
        .focus({ preventScroll: true });
    }
  }

  function refresh() {
    if (!destroyed && ready && frame === null) frame = requestAnimationFrame(reposition);
  }

  function showStep() {
    clearStep();
    const currentVersion = ++version;
    hole.hidden = backdrop.hidden = bubble.hidden = true;
    bubble.style.visibility = 'hidden';
    const final = isFinal();
    const card = final ? (api.final || {}) : steps[index];
    renderCard(card, final);
    if (final) {
      backdrop.hidden = false;
      bubble.hidden = false;
      ready = true;
      refresh();
      return;
    }

    card.onEnter?.();
    if (destroyed || version !== currentVersion) return;
    // Se esperan dos cuadros para permitir que la interfaz termine de abrirse.
    enterFrame = requestAnimationFrame(() => {
      enterFrame = requestAnimationFrame(() => {
        enterFrame = null;
        if (destroyed || version !== currentVersion) return;
        const deadline = performance.now() + 600;
        const findTarget = () => {
          if (destroyed || version !== currentVersion) return;
          target = card.target?.() || null;
          if (!targetRect(target) && performance.now() < deadline) {
            targetTimer = setTimeout(findTarget, 40);
            return;
          }
          targetTimer = null;
          if (!targetRect(target)) target = null;
          bubble.hidden = false;
          ready = true;
          refresh();
          moveTimer = setInterval(refresh, 250);
        };
        findTarget();
        if (card.wait) {
          waitTimer = setInterval(() => {
            const satisfied = card.wait();
            if (!satisfied || destroyed || version !== currentVersion) return;
            clearInterval(waitTimer);
            waitTimer = null;
            bubble.classList.add('tut-complete');
            bubble.querySelector('.tut-check').hidden = false;
            refresh();
            advanceTimer = setTimeout(() => {
              if (!destroyed && version === currentVersion) next();
            }, 500);
          }, 200);
        }
      });
    });
  }

  function next() {
    if (destroyed || isFinal()) return;
    index++;
    showStep();
  }

  window.addEventListener('resize', refresh);
  window.addEventListener('scroll', refresh, true);
  document.addEventListener('keydown', onKeydown, true);
  next();
  return { destroy, next, refresh };
}
