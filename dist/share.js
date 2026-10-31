// Tarjetas verticales y diálogo reutilizable para compartir datos ciudadanos.
const PERSON = 'M12 1a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M1 39V27a11 11 0 0 1 11-11a11 11 0 0 1 11 11v12z';
const PIXEL = 'M470 435H770V284H875V515H740V785H647V663H608V785H517V545H487V657H405V479H470Z';

export async function drawShareCard(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  try {
    await Promise.all(['400 40px Inter', '600 64px Inter', '700 250px Inter'].map(font => document.fonts.load(font)));
  } catch { /* La fuente de respaldo permite generar la tarjeta sin Inter. */ }
  g.fillStyle = '#0f0f11';
  g.fillRect(0, 0, 1080, 1920);

  const poster = spec.poster ? await new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = spec.poster;
  }) : null;
  if (poster) {
    const scale = Math.max(1080 / poster.width, 940 / poster.height);
    g.save();
    g.beginPath();
    g.rect(0, 0, 1080, 940);
    g.clip();
    g.drawImage(poster, (1080 - poster.width * scale) / 2, 0, poster.width * scale, poster.height * scale);
    g.restore();
    const fade = g.createLinearGradient(0, 620, 0, 940);
    fade.addColorStop(0, 'rgba(15,15,17,0)');
    fade.addColorStop(1, '#0f0f11');
    g.fillStyle = fade;
    g.fillRect(0, 620, 1080, 320);
  } else {
    // El encabezado de marca también sirve si el póster no se puede cargar.
    const glow = g.createRadialGradient(540, 340, 20, 540, 340, 420);
    glow.addColorStop(0, '#2e1065');
    glow.addColorStop(1, '#0f0f11');
    g.fillStyle = glow;
    g.fillRect(0, 0, 1080, 760);
    g.fillStyle = 'rgba(196,181,253,0.07)';
    for (let y = 32; y < 760; y += 48) {
      for (let x = 32; x < 1080; x += 48) g.fillRect(x, y, 5, 5);
    }
    g.save();
    const scale = 220 / 505;
    g.translate((1080 - 220) / 2, 235);
    g.scale(scale, scale);
    g.translate(-395, -130);
    g.fillStyle = '#efe7fa';
    g.fill(new Path2D(PIXEL));
    g.fillRect(540, 240, 172, 165);
    g.fillStyle = '#8b5cf6';
    g.fillRect(770, 142, 120, 120);
    g.restore();
  }

  // Cada renglón se ajusta al ancho sin alterar el tamaño del lienzo.
  const fit = (text, weight, size, x, y, width = 936, family = 'Inter, sans-serif') => {
    text = String(text ?? '');
    let fontSize = size;
    g.font = `${weight} ${fontSize}px ${family}`;
    while (g.measureText(text).width > width && fontSize > 1) {
      fontSize = Math.max(1, fontSize - 1);
      g.font = `${weight} ${fontSize}px ${family}`;
    }
    g.fillText(text, x, y, width);
  };
  g.textBaseline = 'top';
  const rows = [];
  const text = (label, weight, size, height, color, family) => rows.push({ height, draw(y) {
    g.fillStyle = color;
    fit(label, weight, size, 72, y, 936, family);
  } });
  text(String(spec.kicker ?? '').toUpperCase(), 400, 32, 40, '#a1a1aa', 'ui-monospace, monospace');
  text(spec.title, 700, 84, 98, '#f4f4f5');
  // El subtítulo solo aparece si hay un grupo filtrado (no repite "todas las personas")
  if (spec.subtitle && !/^(todas las personas|all people|everyone)/i.test(spec.subtitle)) text(spec.subtitle, 600, 46, 56, '#c4b5fd');
  text(spec.valueText ?? (spec.value == null ? '—' : String(spec.value)), 700, 250, 262, '#f4f4f5');
  rows.push({ height: 14, draw(y) {
    g.fillStyle = spec.color || '#c4b5fd';
    g.fillRect(72, y, 300, 14);
  } });
  // «6 de cada 10 … votaron» explica la cifra mejor que «votó»; si existe, la sustituye
  const tenth = (spec.lines || []).find(line => /de cada 10|in 10|out of 10/i.test(String(line)));
  text(tenth || spec.valueLabel, 600, 44, 54, '#d4d4d8');
  if (spec.people != null) rows.push({ height: 88, draw(y) {
    const count = Math.max(0, Math.min(10, Math.round(spec.people)));
    const path = new Path2D(PERSON);
    for (let i = 0; i < 10; i++) {
      g.save();
      g.translate(72 + i * 94, y);
      g.scale(2.2, 2.2);
      g.fillStyle = i < count ? spec.color || '#c4b5fd' : '#3f3f46';
      g.fill(path);
      g.restore();
    }
  } });
  // Una sola comparación: la que dice si está arriba o abajo del país
  const lines = spec.lines || [];
  const key = lines.find(line => /^[▲▼]/.test(String(line))) || lines.find(line => line !== tenth);
  if (key) text(key, 600, 42, 52, '#f4f4f5');
  // Solo el dato: sin invitación ni dirección del sitio
  // Los espacios se comprimen cuando hay subtítulo, pictograma y tres comparaciones.
  const height = rows.reduce((sum, row) => sum + row.height, 0);
  const gap = Math.max(8, Math.min(40, (1780 - 980 - height) / (rows.length - 1)));
  let y = 980;
  for (const row of rows) {
    row.draw(y);
    y += row.height + gap;
  }
  g.fillStyle = '#3f3f46';
  g.fillRect(72, 1812, 936, 1);
  g.fillStyle = '#a1a1aa';
  fit('PIXEL CIUDADANO · ATLAS CIUDADANO', 600, 30, 72, 1840, 520);
  g.textAlign = 'right';
  fit(spec.source, 400, 26, 1008, 1840, 400);
  g.textAlign = 'left';
  fit(spec.independent, 400, 24, 72, 1892, 936);
  return canvas;
}

let sheet;
let generation = 0;
let copiedTimer;
let sharing = false;

function getSheet() {
  if (sheet) return sheet;
  sheet = document.createElement('dialog');
  sheet.className = 'share-sheet';
  sheet.setAttribute('aria-labelledby', 'share-sheet-title');
  sheet.innerHTML = `
    <header class="share-sheet__header">
      <h2 id="share-sheet-title"></h2>
      <button type="button" class="share-sheet__close">×</button>
    </header>
    <p class="share-sheet__status" role="status" aria-live="polite"></p>
    <img class="share-sheet__preview" alt="" hidden>
    <div class="share-sheet__actions">
      <button type="button" class="share-sheet__button share-sheet__primary" data-share="share" hidden></button>
      <button type="button" class="share-sheet__button" data-share="download" hidden></button>
      <button type="button" class="share-sheet__button" data-share="copy" hidden></button>
    </div>`;
  sheet.querySelector('.share-sheet__close').onclick = () => sheet.close();
  sheet.addEventListener('click', event => {
    if (event.target !== sheet) return;
    const box = sheet.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) sheet.close();
  });
  // Escape conserva el comportamiento nativo y cancela los trabajos pendientes.
  sheet.addEventListener('close', () => {
    if (sheet.open) return;
    generation++;
    clearTimeout(copiedTimer);
    sheet.querySelector('img').removeAttribute('src');
  });
  document.body.append(sheet);
  return sheet;
}

async function fallback(spec) {
  try {
    if (navigator.share) {
      await navigator.share({ text: spec.shareText, ...(spec.url ? { url: spec.url } : {}) });
      return 'shared';
    }
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled';
  }
  await navigator.clipboard.writeText(spec.url || spec.shareText);
  return 'copied';
}

export function openShareSheet(spec, api) {
  // Se devuelve la promesa para permitir esperar la preparación del diálogo.
  return showSheet(spec, api);
}

async function showSheet(spec, api) {
  let dialog;
  let status;
  const token = ++generation;
  const current = () => token === generation && dialog?.open;
  const t = (key, value) => api?.t?.(key, value) || value;
  try {
    dialog = getSheet();
    clearTimeout(copiedTimer);
    const preview = dialog.querySelector('img');
    status = dialog.querySelector('[role="status"]');
    const share = dialog.querySelector('[data-share="share"]');
    const download = dialog.querySelector('[data-share="download"]');
    const copy = dialog.querySelector('[data-share="copy"]');
    const close = dialog.querySelector('.share-sheet__close');
    dialog.querySelector('h2').textContent = t('share.title', 'Comparte tu tarjeta');
    close.setAttribute('aria-label', t('share.close', 'Cerrar'));
    share.disabled = sharing;
    share.setAttribute('aria-busy', String(sharing));
    share.textContent = t('share.share', 'Compartir');
    download.textContent = t('share.download', 'Descargar imagen');
    copy.textContent = t('share.copy', 'Copiar enlace');
    for (const button of [share, download, copy]) {
      button.hidden = true;
      button.onclick = null;
      button.classList.toggle('share-sheet__primary', button === share);
    }
    preview.hidden = true;
    preview.removeAttribute('src');
    status.hidden = false;
    status.textContent = api.t('share.loading');
    dialog.setAttribute('aria-busy', 'true');
    if (!dialog.open) dialog.showModal();
    close.focus();

    const canvas = await drawShareCard(spec);
    if (!current()) return;
    preview.src = canvas.toDataURL('image/png');
    const blob = await new Promise((resolve, reject) => canvas.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error(api.t('share.failGen')));
    }, 'image/png'));
    if (!current()) return;
    const file = new File([blob], spec.filename || 'pixel-ciudadano.png', { type: 'image/png' });
    let canShare = false;
    try { canShare = !!navigator.canShare?.({ files: [file] }); } catch { /* Se ofrece la descarga. */ }
    const recover = async error => {
      if (error?.name === 'AbortError' || !current()) return;
      // No se vuelve a abrir el envío nativo: las alternativas ya están visibles.
      status.hidden = false;
      status.textContent = `${api.t('share.fail')} ${t('share.download', 'Descargar imagen')} · ${t('share.copy', 'Copiar enlace')}`;
    };
    share.hidden = !canShare;
    share.onclick = async () => {
      if (sharing) return;
      sharing = true;
      share.disabled = true;
      share.setAttribute('aria-busy', 'true');
      try { await navigator.share({ files: [file], title: spec.title }); }
      catch (error) { await recover(error); }
      finally {
        sharing = false;
        share.disabled = false;
        share.setAttribute('aria-busy', 'false');
      }
    };
    download.hidden = false;
    download.classList.toggle('share-sheet__primary', !canShare);
    download.onclick = async () => {
      let url;
      let link;
      try {
        url = URL.createObjectURL(blob);
        link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.append(link);
        link.click();
      } catch (error) { await recover(error); }
      finally {
        link?.remove();
        if (url) setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    };
    copy.hidden = false;
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(spec.url || spec.shareText);
        if (!current()) return;
        copy.textContent = t('share.copied', 'Enlace copiado');
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => {
          if (current()) copy.textContent = t('share.copy', 'Copiar enlace');
        }, 2000);
      } catch (error) { await recover(error); }
    };
    preview.alt = [spec.title, spec.subtitle, spec.valueText, spec.valueLabel].filter(Boolean).join('. ');
    preview.hidden = false;
    status.hidden = true;
    dialog.setAttribute('aria-busy', 'false');
    (canShare ? share : download).focus();
  } catch (error) {
    if (token !== generation) return;
    try {
      const result = await fallback(spec);
      if (current()) {
        status.hidden = false;
        status.textContent = result === 'copied' ? t('share.copied', 'Enlace copiado') : t('share.title', 'Comparte tu tarjeta');
      }
    } catch {
      if (current() && status) status.textContent = `${api.t('share.failGen')} ${spec.url || ''}`;
    } finally {
      if (current()) dialog.setAttribute('aria-busy', 'false');
    }
  }
}
