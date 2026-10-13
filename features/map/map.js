// Mapa trasy: rysowanie SVG, przesuwanie, przybliżanie i gotowe widoki.
import { s } from '../../shared/js/dom.js';

let api = null;

export function initMap({ coastline, route, views, stops }) {
  const { width: W, height: H, unitsPerNm: PPM } = coastline;
  const ASP = H / W;
  const svg = document.getElementById('map');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.aspectRatio = `${W} / ${H}`;

  // Warstwy rysowane od spodu: morze, ląd, nazwy geograficzne, kurs, nazwy portów, numery postojów.
  s('rect', { x: -2000, y: -2000, width: 5000, height: 5000, fill: 'var(--sea)' }, svg);
  s('path', { d: coastline.land, fill: 'var(--land)', stroke: 'var(--land-edge)', 'stroke-width': '0.7', 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }, svg);
  const geo = s('g', { style: 'font-family:var(--serif);font-style:italic' }, svg);
  const routes = s('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  const line = { 'stroke-width': '2.6', 'vector-effect': 'non-scaling-stroke' };
  s('path', { d: route.week1, stroke: 'var(--r1)', ...line }, routes);
  s('path', { d: route.week2, stroke: 'var(--r2)', ...line }, routes);
  s('path', { d: route.excursion, stroke: 'var(--r2)', 'stroke-dasharray': '5 4', ...line }, routes);
  const names = s('g', { style: 'font-family:var(--sans);font-weight:600' }, svg);
  const badges = s('g', { style: 'font-family:var(--sans);font-weight:600' }, svg);

  const geoEls = coastline.labels.map((l) => {
    const t = s('text', { x: l.x, y: l.y, 'text-anchor': l.anchor, 'dominant-baseline': 'central', fill: l.kind === 'water' ? 'var(--water-text)' : 'var(--muted)' }, geo);
    t.textContent = l.name;
    return t;
  });

  const marks = stops.map((stop) => {
    const g = s('g', {}, badges);
    const circle = s('circle', { cx: stop.x, cy: stop.y, fill: stop.week === 1 ? 'var(--r1)' : 'var(--r2)', stroke: 'var(--paper)', 'stroke-width': '1.5', 'vector-effect': 'non-scaling-stroke' }, g);
    const num = s('text', { x: stop.x, y: stop.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'var(--paper)' }, g);
    num.textContent = stop.n;
    const name = s('text', { 'text-anchor': stop.label.anchor, 'dominant-baseline': 'central', fill: 'var(--ink)', stroke: 'var(--sea)', 'stroke-width': '3.5', 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, names);
    name.textContent = stop.name;
    return { stop, circle, num, name };
  });

  const vb = { x: 0, y: 0, w: W };

  function clamp() {
    vb.w = Math.max(W / 14, Math.min(W, vb.w));
    const h = vb.w * ASP;
    vb.x = Math.max(0, Math.min(W - vb.w, vb.x));
    vb.y = Math.max(0, Math.min(H - h, vb.y));
  }

  // Elementy opisowe (numery, nazwy, podziałka) mają stały rozmiar na ekranie niezależnie od przybliżenia.
  function apply() {
    clamp();
    const h = vb.w * ASP;
    svg.setAttribute('viewBox', `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${h.toFixed(2)}`);
    const ppu = (svg.getBoundingClientRect().width || W) / vb.w;
    const k = 1 / ppu;
    const r = Math.max(9, Math.min(12, 9 + ppu * 1.5));
    for (const m of marks) {
      m.circle.setAttribute('r', (r * k).toFixed(3));
      m.num.setAttribute('font-size', (11 * k).toFixed(3));
      m.name.setAttribute('x', (m.stop.x + m.stop.label.dx * k).toFixed(2));
      m.name.setAttribute('y', (m.stop.y + m.stop.label.dy * k).toFixed(2));
      m.name.setAttribute('font-size', (13 * k).toFixed(3));
      m.name.style.strokeWidth = `${3.5 * k}px`;
    }
    names.style.display = ppu >= 1.15 ? '' : 'none';
    for (const t of geoEls) t.setAttribute('font-size', (13 * k).toFixed(3));
    geo.style.display = ppu >= 0.55 ? '' : 'none';
    let nm = 1;
    for (const n of [1, 2, 5, 10, 20]) { nm = n; if (n * PPM * ppu >= 56) break; }
    document.getElementById('sb').style.width = `${Math.round(nm * PPM * ppu)}px`;
    document.getElementById('sl').textContent = `${nm} Mm`;
  }

  function setView(cx, cy, w) { vb.w = w; vb.x = cx - w / 2; vb.y = cy - (w * ASP) / 2; apply(); }

  function press(name) {
    document.querySelectorAll('.bar [data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === name ? 'true' : 'false'));
  }

  function zoomAt(px, py, factor) {
    const rect = svg.getBoundingClientRect();
    const fx = (px - rect.left) / rect.width, fy = (py - rect.top) / rect.height;
    const mx = vb.x + fx * vb.w, my = vb.y + fy * vb.w * ASP;
    const nw = Math.max(W / 14, Math.min(W, vb.w / factor));
    vb.w = nw; vb.x = mx - fx * nw; vb.y = my - fy * nw * ASP;
    apply(); press('');
  }

  const zoomCenter = (factor) => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor); };

  document.querySelectorAll('.bar [data-view]').forEach((b) => b.addEventListener('click', () => {
    const [cx, cy, w] = views[b.dataset.view];
    setView(cx, cy, w); press(b.dataset.view);
  }));
  document.getElementById('zin').addEventListener('click', () => zoomCenter(1.6));
  document.getElementById('zout').addEventListener('click', () => zoomCenter(1 / 1.6));
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

  // Przeciąganie jednym palcem lub myszą, przybliżanie dwoma palcami.
  const pointers = new Map();
  svg.addEventListener('pointerdown', (e) => { svg.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); svg.classList.add('drag'); });
  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    if (pointers.size === 1) {
      const rect = svg.getBoundingClientRect();
      vb.x -= ((e.clientX - prev.x) / rect.width) * vb.w;
      vb.y -= ((e.clientY - prev.y) / rect.height) * vb.w * ASP;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      apply(); press('');
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a2, b2] = [...pointers.values()];
      const d1 = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      if (d0 > 0) zoomAt((a2.x + b2.x) / 2, (a2.y + b2.y) / 2, d1 / d0);
    }
  });
  const release = (e) => { pointers.delete(e.pointerId); if (!pointers.size) svg.classList.remove('drag'); };
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);
  window.addEventListener('resize', apply);

  api = { setView, press, ASP, stops };
  apply();
}

// Przybliża mapę do podanych postojów (numery z shared/data/stops.json).
export function focusStops(numbers) {
  if (!api) return;
  const points = numbers.map((n) => api.stops.find((st) => st.n === n));
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = 55;
  const w = Math.max(170, x1 - x0 + 2 * pad, (y1 - y0 + 2 * pad) / api.ASP);
  api.setView((x0 + x1) / 2, (y0 + y1) / 2, w);
  api.press('');
}
