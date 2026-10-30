// Globo ortográfico; sin dependencias y con muestreo cooperativo.
const DEG = Math.PI / 180;
const LAND_URL = 'assets/data/land-110m.json';   // copia local de world-atlas@2.0.2 (licencia ISC)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = t => t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
const smoothstep = t => { const k = clamp((t - .65) / .35, 0, 1); return k * k * (3 - 2 * k); };

export function mountGlobe(host, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const testCtx = document.createElement('canvas').getContext('2d');
  const reduced = !!opts.reducedMotion;
  const minZoom = opts.minZoom ?? 1, maxZoom = opts.maxZoom ?? 3.5;
  const abort = new AbortController();
  let dead = false, visible = true, raf = 0, last = 0;
  let w = 0, h = 0, dpr = 1, rotLon = -102, rotLat = 23;
  let zoom = clamp(opts.initialZoom ?? 1.8, minZoom, maxZoom), zoomAnimation = null;
  let pointer = null, px = 0, py = 0, pauseUntil = 0, spinning = true;
  let secondPointer = null, sx = 0, sy = 0, pinchDistance = 0;
  let flight = null, flightTimer = 0, orbit = 0, sway = -1;
  // offsetX desplaza el centro (fracción del ancho); size es el radio relativo.
  let offX = opts.offsetX || 0, cxOff = 0, cyOff = 0, worldAlpha = 1;
  let worldReady = false;
  const size = opts.size || 0.42;

  // Las superficies del fondo se reutilizan incluso durante el acercamiento.
  const sphere = document.createElement('canvas');
  sphere.width = sphere.height = 1024;
  const sc = sphere.getContext('2d');
  let theme = opts.theme === 'light' ? 'light' : 'dark';
  function paintSphere() {
    sc.clearRect(0, 0, 1024, 1024);
    // Relleno sólido (estilo pixel sobrio, sin degradado)
    sc.fillStyle = theme === 'light' ? '#e6e3f0' : '#150c26';
    sc.beginPath(); sc.arc(512, 512, 457, 0, Math.PI * 2); sc.fill();
  }
  paintSphere();

  const palette = [];
  const states = Object.entries(opts.states || {}).map(([cc, state]) => {
    const color = opts.colorOf ? opts.colorOf(cc) : '#bc91e2';
    const index = palette.push(color) - 1;
    return { cc, b: state.b, path: new Path2D(state.d), index };
  });
  let worldColors;
  function paintDots() {
    worldColors = Array.from({ length: 64 }, (_, i) =>
      `rgba(${theme === 'light' ? '76,29,149' : '213,185,238'},${0.25 + 0.45 * i / 63})`);
  }
  paintDots();
  const dash = [2, 6], solid = [];
  const p1 = 17.5 * DEG, p2 = 29.5 * DEG;
  const n = Math.log(Math.cos(p1) / Math.cos(p2)) /
    Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
  const F = Math.cos(p1) * Math.tan(Math.PI / 4 + p1 / 2) ** n / n;
  const r0 = 6371 * F / Math.tan(Math.PI / 4 + 12 * DEG / 2) ** n;

  function stateAt(lon, lat) {
    // Evita proyectar los puntos que están lejos de México.
    if (lon < -119 || lon > -85 || lat < 13 || lat > 34) return -1;
    const r = 6371 * F / Math.tan(Math.PI / 4 + lat * DEG / 2) ** n;
    const t = n * (lon + 102) * DEG;
    const x = 10 * r * Math.sin(t), y = -10 * (r0 - r * Math.cos(t));
    for (let i = 0; i < states.length; i++) {
      const s = states[i], b = s.b;
      if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] &&
          testCtx.isPointInPath(s.path, x, y)) return i;
    }
    return -1;
  }

  function cloud() {
    return { x: new Float32Array(16384), y: new Float32Array(16384),
      z: new Float32Array(16384), c: new Uint8Array(16384), count: 0, born: -1 };
  }
  const world = cloud(), mexico = cloud();
  function add(points, lon, lat, color = 0) {
    const i = points.count;
    if (i === points.x.length) {
      for (const key of ['x', 'y', 'z', 'c']) {
        const next = new points[key].constructor(i * 2);
        next.set(points[key]);
        points[key] = next;
      }
    }
    const a = lon * DEG, b = lat * DEG, cos = Math.cos(b);
    points.x[i] = cos * Math.sin(a);
    points.y[i] = Math.sin(b);
    points.z[i] = cos * Math.cos(a);
    points.c[i] = color;
    points.count++;
    if (points.born < 0) points.born = performance.now();
  }

  // Cada tarea cede el hilo tras unos pocos milisegundos.
  const jobs = new Set();
  function schedule(step, fast = false) {
    if (dead) return;
    const job = { id: 0, idle: !fast && typeof requestIdleCallback === 'function' };
    const run = () => {
      jobs.delete(job);
      if (dead) return;
      const end = performance.now() + 5;
      do { if (!step()) return; } while (performance.now() < end);
      schedule(step, fast);
    };
    jobs.add(job);
    job.id = job.idle ? requestIdleCallback(run, { timeout: 100 }) : setTimeout(run, 0);
  }
  function sampleMexico() {
    let mx = -118, my = 14;
    schedule(() => {
      const s = stateAt(mx, my);
      if (s >= 0) add(mexico, mx, my, states[s].index);
      mx += 0.33;
      if (mx > -86) { mx = -118; my += 0.33; }
      if (my <= 33) return true;
      startWorld();
      return false;
    }, true);
  }

  // Las longitudes se desenvuelven para conservar los polígonos del antimeridiano.
  function decode(topology) {
    const tr = topology.transform;
    const arcs = topology.arcs.map(arc => {
      let x = 0, y = 0;
      return arc.map(p => {
        if (!tr) return [p[0], p[1]];
        x += p[0]; y += p[1];
        return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]];
      });
    });
    const polygons = [];
    function polygon(rings) {
      const decoded = rings.map(indices => {
        const ring = [];
        for (const index of indices) {
          const arc = arcs[index < 0 ? ~index : index];
          for (let k = 0; k < arc.length; k++) {
            if (ring.length && k === 0) continue;
            const p = arc[index < 0 ? arc.length - 1 - k : k];
            let lon = p[0];
            if (ring.length) lon += 360 * Math.round((ring[ring.length - 1][0] - lon) / 360);
            ring.push([lon, p[1]]);
          }
        }
        if (ring.length && Math.abs(ring[ring.length - 1][0] - ring[0][0]) > 180) {
          const pole = ring.reduce((sum, p) => sum + p[1], 0) < 0 ? -90 : 90;
          ring.push([ring[ring.length - 1][0], pole], [ring[0][0], pole]);
        }
        return ring;
      });
      if (!decoded[0]?.length) return;
      const b = [Infinity, Infinity, -Infinity, -Infinity];
      for (const p of decoded[0]) {
        b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]);
        b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]);
      }
      const mid = (b[0] + b[2]) / 2;
      for (let i = 1; i < decoded.length; i++) {
        const ring = decoded[i];
        if (!ring.length) continue;
        const shift = 360 * Math.round((mid - ring[0][0]) / 360);
        for (const p of ring) p[0] += shift;
      }
      polygons.push({ rings: decoded, b, mid });
    }
    function geometry(g) {
      if (g.type === 'Polygon') polygon(g.arcs);
      else if (g.type === 'MultiPolygon') g.arcs.forEach(polygon);
      else if (g.type === 'GeometryCollection') g.geometries.forEach(geometry);
    }
    geometry(topology.objects.land);
    return polygons;
  }
  function onLand(polygons, lon, lat) {
    for (const polygon of polygons) {
      const b = polygon.b;
      if (lat < b[1] || lat > b[3]) continue;
      const x = lon + 360 * Math.round((polygon.mid - lon) / 360);
      if (x < b[0] || x > b[2]) continue;
      let inside = false;
      for (const ring of polygon.rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const a = ring[i], c = ring[j];
          if ((a[1] > lat) !== (c[1] > lat) &&
              x < (c[0] - a[0]) * (lat - a[1]) / (c[1] - a[1]) + a[0]) inside = !inside;
        }
      }
      if (inside) return true;
    }
    return false;
  }
  // También difiere la decodificación hasta después del primer pintado.
  let fetchTimer = 0;
  function startWorld() {
    fetchTimer = setTimeout(() => {
    if (dead) return;
    fetch(LAND_URL, { signal: abort.signal }).then(r => {
      if (!r.ok) throw new Error('land');
      return r.json();
    }).then(topology => {
      if (dead) return;
      const polygons = decode(topology);
      let lon = -180, lat = -88.75;
      schedule(() => {
        if (onLand(polygons, lon, lat) && stateAt(lon, lat) < 0) add(world, lon, lat);
        lon += 1.25 / Math.cos(lat * DEG);
        if (lon >= 180) { lon = -180; lat += 1.25; }
        if (lat < 90) return true;
        worldReady = true;
        return false;
      });
    }).catch(() => { /* El globo local funciona sin red. */ });
    }, 0);
  }

  const pins = (opts.pins || []).map(pin => {
    const el = document.createElement('div');
    el.className = 'globe-pin is-hidden';
    el.style.cssText = 'position:absolute;left:0;top:0;will-change:transform;pointer-events:none;max-width:calc(100% - 16px);overflow:hidden;box-sizing:border-box';
    const label = document.createElement('span');
    label.textContent = pin.label;
    const value = document.createElement('b');
    value.textContent = pin.value;
    el.append(label, value);
    host.appendChild(el);
    const a = pin.lon * DEG, b = pin.lat * DEG;
    const numericValue = Number.parseFloat(pin.value);
    return { el, x: Math.cos(b) * Math.sin(a), y: Math.sin(b),
      z: Math.cos(b) * Math.cos(a), hidden: true, width: null,
      value: Number.isNaN(numericValue) ? -Infinity : numericValue,
      screenX: 0, screenY: 0, visible: false, hide: true };
  });

  const pinOrder = pins.map((_, i) => i).sort((a, b) => pins[b].value - pins[a].value);
  function runnable() { return !dead && !document.hidden && visible && w > 0 && h > 0; }
  function wake() {
    if (runnable() && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!runnable() && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function resize() {
    w = host.clientWidth; h = host.clientHeight;
    if (opts.mobile && spinning && !flight) cyOff = -h * 0.33;   // en celular México queda arriba de la hoja inferior
    dpr = Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.5 : 2);   // en celular, menos píxeles = menos batería
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(entries => { visible = entries[entries.length - 1].isIntersecting; wake(); });
  io.observe(host);
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('resize', resize);

  function applyFlight(t) {
    const f = flight, k = ease(t);
    rotLon = f.fromLon + (f.lon - f.fromLon) * k;
    rotLat = f.fromLat + (23.5 - f.fromLat) * k;
    zoom = f.fromZoom + (f.zoom - f.fromZoom) * k;
    offX = f.fromOff * (1 - k);
    cxOff = f.fromCX + (f.cx - f.fromCX) * k;
    cyOff = f.fromCY + (f.cy - f.fromCY) * k;
    worldAlpha = f.fromAlpha * (1 - smoothstep(t));
    if (typeof f.onProgress === 'function') f.onProgress(t);
  }
  function finishFlight() {
    if (!flight) return;
    const f = flight;
    clearTimeout(flightTimer);
    applyFlight(1);
    if (flight === f) flight = null;
    f.resolve();
    wake();
  }
  function cancelFlight() {
    if (!flight) return;
    clearTimeout(flightTimer);
    const resolve = flight.resolve;
    flight = null;
    resolve();
  }
  function down(e) {
    if (secondPointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cancelFlight();
    zoomAnimation = null;
    if (pointer === null) {
      pointer = e.pointerId; px = e.clientX; py = e.clientY;
    } else {
      secondPointer = e.pointerId; sx = e.clientX; sy = e.clientY;
      pinchDistance = Math.hypot(sx - px, sy - py);
    }
    canvas.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (secondPointer !== null) {
      if (e.pointerId === pointer) { px = e.clientX; py = e.clientY; }
      else if (e.pointerId === secondPointer) { sx = e.clientX; sy = e.clientY; }
      else return;
      const distance = Math.hypot(sx - px, sy - py);
      if (pinchDistance > 0) zoom = clamp(zoom * distance / pinchDistance, minZoom, maxZoom);
      pinchDistance = distance;
      return;
    }
    if (e.pointerId !== pointer) return;
    const scale = 180 / Math.max(1, Math.min(w, h) * size * zoom * Math.PI);
    rotLon -= (e.clientX - px) * scale;
    rotLat = clamp(rotLat + (e.clientY - py) * scale, -80, 80);
    px = e.clientX; py = e.clientY;
  }
  function up(e) {
    if (e.pointerId === secondPointer) secondPointer = null;
    else if (e.pointerId === pointer) {
      pointer = secondPointer; px = sx; py = sy; secondPointer = null;
    } else return;
    pinchDistance = 0;
    pauseUntil = performance.now() + 2000;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  }
  // El lienzo limita el bloqueo del desplazamiento a su propia superficie.
  function wheel(e) {
    e.preventDefault();
    cancelFlight();
    zoomAnimation = null;
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? h : 1);
    zoom = clamp(zoom * Math.exp(-delta * 0.0015), minZoom, maxZoom);
    pauseUntil = performance.now() + 2000;
    wake();
  }
  function stepZoom(factor) {
    if (dead) return;
    cancelFlight();
    const target = clamp((zoomAnimation ? zoomAnimation.to : zoom) * factor, minZoom, maxZoom);
    if (reduced) { zoom = target; zoomAnimation = null; }
    else zoomAnimation = { from: zoom, to: target, start: performance.now() };
    pauseUntil = performance.now() + 2000;
    wake();
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('wheel', wheel, { passive: false });

  // Sólo números y buffers reutilizados en el pintado; el DOM requiere cadenas CSS.
  function frame(now) {
    raf = 0;
    if (!runnable()) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (zoomAnimation) {
      const t = clamp((now - zoomAnimation.start) / 250, 0, 1);
      zoom = zoomAnimation.from + (zoomAnimation.to - zoomAnimation.from) * (1 - (1 - t) ** 3);
      if (t === 1) zoomAnimation = null;
    }
    if (flight) {
      const t = clamp((now - flight.start) / flight.ms, 0, 1);
      if (t === 1) finishFlight(); else applyFlight(t);
    } else if (!reduced && spinning && pointer === null && now >= pauseUntil) {
      // Vaivén de ocho grados a cada lado del centro de México.
      const nl = ((rotLon + 180) % 360 + 360) % 360 - 180;
      if (nl >= -94) sway = -1; else if (nl <= -110) sway = 1;
      const next = nl + dt * 3 * sway;
      rotLon += (nl >= -110 && nl <= -94 ? clamp(next, -110, -94) : next) - nl;
    }
    if (!reduced) orbit -= dt * 3;
    const a = rotLon * DEG, b = rotLat * DEG;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const radius = Math.min(w, h) * size * zoom, cx = w / 2 + w * offX + cxOff, cy = h / 2 + cyOff;
    ctx.clearRect(0, 0, w, h);
    const outer = radius * 512 / 457;
    ctx.drawImage(sphere, cx - outer, cy - outer, outer * 2, outer * 2);
    ctx.globalAlpha = worldAlpha;
    // Aro nítido de 2px en lugar del halo difuso
    ctx.strokeStyle = theme === 'light' ? '#c4b5fd' : '#4c3a75';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
    if (!worldReady) drawGraticule(now, radius, cx, cy);
    drawDots(world, false, now, ca, sa, cb, sb, radius, cx, cy);
    drawDots(mexico, true, now, ca, sa, cb, sb, radius, cx, cy);
    ctx.globalAlpha = worldAlpha;
    ctx.setLineDash(dash);
    ctx.lineDashOffset = orbit;
    ctx.strokeStyle = 'rgba(213,185,238,.22)';
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash(solid);
    ctx.lineDashOffset = 0;
    for (let i = 0; i < 2; i++) {
      const angle = -0.65 + i * Math.PI, c = Math.cos(angle), s = Math.sin(angle);
      const x = cx + radius * 1.18 * c, y = cy + radius * 1.18 * s;
      ctx.beginPath(); ctx.moveTo(x + 4 * s + 3 * c, y - 4 * c + 3 * s);
      ctx.lineTo(x, y); ctx.lineTo(x + 4 * s - 3 * c, y - 4 * c - 3 * s); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i], z0 = p.x * sa + p.z * ca;
      const z = p.y * sb + z0 * cb;
      p.visible = z >= 0.15;
      p.hide = !p.visible;
      if (p.width === null) p.width = p.el.offsetWidth;
      const x = clamp(cx + radius * (p.x * ca - p.z * sa), 8, Math.max(8, w - p.width - 8));
      const y = clamp(cy - radius * (p.y * cb - z0 * sb), 8, Math.max(8, h - 30));
      p.screenX = x; p.screenY = y;
      p.el.style.transform = `translate(${x}px,${y}px)`;
    }
    // De mayor a menor valor: una etiqueta se muestra solo si no choca con las que ya se mostraron (usa su ancho real).
    for (let a = 0; a < pinOrder.length; a++) {
      const p = pins[pinOrder[a]];
      if (!p.visible) continue;
      for (let b = 0; b < a; b++) {
        const q = pins[pinOrder[b]];
        if (q.hide) continue;
        if (Math.abs(p.screenY - q.screenY) < 24 && p.screenX < q.screenX + q.width + 6 && q.screenX < p.screenX + p.width + 6) { p.hide = true; break; }
      }
    }
    for (let i = 0; i < pins.length; i++) {
      const p = pins[i];
      p.el.style.opacity = p.hide ? 0 : worldAlpha;
      if (p.hide !== p.hidden) { p.el.classList.toggle('is-hidden', p.hide); p.hidden = p.hide; }
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function drawDots(points, local, now, ca, sa, cb, sb, radius, cx, cy) {
    ctx.globalAlpha = (local || reduced ? 1 : clamp((now - points.born) / 650, 0, 1)) * (local ? 1 : worldAlpha);
    const size = radius / (local ? 120 : 170);
    for (let i = 0; i < points.count; i++) {
      const z0 = points.x[i] * sa + points.z[i] * ca;
      const z = points.y[i] * sb + z0 * cb;
      if (z <= 0) continue;
      const side = size * (0.6 + 0.4 * z);
      ctx.fillStyle = local ? palette[points.c[i]] : worldColors[Math.min(63, z * 63 | 0)];
      ctx.fillRect(cx + radius * (points.x[i] * ca - points.z[i] * sa) - side / 2,
        cy - radius * (points.y[i] * cb - z0 * sb) - side / 2, side, side);
    }
    ctx.globalAlpha = 1;
  }
  // La misma proyección sirve para el ajuste del vuelo y para consumidores externos.
  function unitProject(lon, lat, longitude = rotLon, latitude = rotLat) {
    const a = (lon - longitude) * DEG, b = lat * DEG, r = latitude * DEG;
    const z = Math.cos(b) * Math.cos(a);
    return { x: Math.cos(b) * Math.sin(a),
      y: -(Math.sin(b) * Math.cos(r) - z * Math.sin(r)),
      visible: Math.sin(b) * Math.sin(r) + z * Math.cos(r) >= 0 };
  }
  function project(lon, lat) {
    const p = unitProject(lon, lat), radius = Math.min(w, h) * size * zoom;
    return { x: w / 2 + w * offX + cxOff + radius * p.x,
      y: h / 2 + cyOff + radius * p.y, visible: p.visible };
  }
  function drawGraticule(now, radius, cx, cy) {
    ctx.save();
    ctx.strokeStyle = 'rgba(213,185,238,.10)';
    ctx.globalAlpha = worldAlpha * (reduced ? 1 : .75 + .25 * Math.sin(now / 700));
    ctx.lineWidth = .75;
    const line = (fixed, latitude) => {
      ctx.beginPath();
      let pen = false;
      for (let v = latitude ? -180 : -90; v <= (latitude ? 180 : 90); v += 3) {
        const p = unitProject(latitude ? v : fixed, latitude ? fixed : v);
        if (!p.visible) { pen = false; continue; }
        const x = cx + radius * p.x, y = cy + radius * p.y;
        if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
    };
    for (let lat = -60; lat <= 60; lat += 30) line(lat, true);
    for (let lon = -180; lon < 180; lon += 30) line(lon, false);
    ctx.restore();
  }
  resize();
  // El primer pintado precede al muestreo y a cualquier solicitud de red.
  cancelAnimationFrame(raf);
  frame(performance.now());
  sampleMexico();

  return {
    project,
    zoomIn() { stepZoom(1.25); },
    zoomOut() { stepZoom(1 / 1.25); },
    setTheme(value) {
      theme = value === 'light' ? 'light' : 'dark';
      paintSphere(); paintDots(); wake();
    },
    flyToMexico(options = {}) {
      cancelFlight();
      zoomAnimation = null;
      if (dead) return Promise.resolve();
      const { ms = 1700, targetRect = null, onProgress = null } =
        typeof options === 'number' ? { ms: options } : (options || {});
      spinning = false;
      // Elige la vuelta más corta para evitar giros acumulados durante el reposo.
      const lon = rotLon + ((-102 - rotLon + 180) % 360 + 360) % 360 - 180;
      let targetZoom = 2.4, cx = 0, cy = 0;
      if (targetRect && targetRect.width > 0 && targetRect.height > 0 && w > 0 && h > 0) {
        const points = [];
        for (const x of [-117.1, -101.9, -86.7]) {
          for (const y of [14.5, 23.6, 32.7]) {
            if (x !== -101.9 || y !== 23.6) points.push(unitProject(x, y, -102, 23.5));
          }
        }
        const xs = points.map(p => p.x), ys = points.map(p => p.y);
        const left = Math.min(...xs), right = Math.max(...xs);
        const top = Math.min(...ys), bottom = Math.max(...ys);
        const fittedRadius = Math.min(targetRect.width / (right - left), targetRect.height / (bottom - top));
        targetZoom = clamp(fittedRadius / (Math.min(w, h) * size), minZoom, maxZoom);
        const radius = targetZoom * Math.min(w, h) * size;
        cx = targetRect.left + targetRect.width / 2 - radius * (left + right) / 2 - w / 2;
        cy = targetRect.top + targetRect.height / 2 - radius * (top + bottom) / 2 - h / 2;
      }
      targetZoom = clamp(targetZoom, minZoom, maxZoom);
      return new Promise(resolve => {
        flight = { start: performance.now(), ms, fromLon: rotLon, fromLat: rotLat,
          fromZoom: zoom, fromOff: offX, fromCX: cxOff, fromCY: cyOff,
          fromAlpha: worldAlpha, lon, zoom: targetZoom, cx, cy, onProgress, resolve };
        if (reduced || !Number.isFinite(ms) || ms <= 0) { finishFlight(); return; }
        // La promesa termina incluso si la pestaña está oculta.
        flightTimer = setTimeout(finishFlight, ms);
        wake();
      });
    },
    destroy() {
      if (dead) return;
      dead = true;
      zoomAnimation = null;
      cancelAnimationFrame(raf);
      clearTimeout(fetchTimer);
      cancelFlight();
      abort.abort();
      for (const job of jobs) {
        if (job.idle) cancelIdleCallback(job.id); else clearTimeout(job.id);
      }
      jobs.clear();
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      canvas.removeEventListener('wheel', wheel);
      if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      if (secondPointer !== null && canvas.hasPointerCapture(secondPointer)) canvas.releasePointerCapture(secondPointer);
      canvas.remove();
      for (const pin of pins) pin.el.remove();
    }
  };
}
