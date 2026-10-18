// opusferri.com — page behaviour. No cookies, no storage, no network calls.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
document.documentElement.classList.add('js');

/* menu */
const mb = document.querySelector('.menu-btn'), links = document.getElementById('nav-links');
if (mb && links) {
  mb.addEventListener('click', () => {
    const o = mb.getAttribute('aria-expanded') !== 'true';
    mb.setAttribute('aria-expanded', String(o)); links.classList.toggle('open', o);
  });
  links.addEventListener('click', e => { if (e.target.closest('a')) { mb.setAttribute('aria-expanded', 'false'); links.classList.remove('open'); } });
}

/* reveal on scroll */
const rev = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduce.matches) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  rev.forEach((el, i) => { el.style.transitionDelay = (i % 3) * 70 + 'ms'; io.observe(el); });
} else rev.forEach(el => el.classList.add('in'));

/* card glow follows the pointer */
document.querySelectorAll('.card').forEach(c => c.addEventListener('pointermove', e => {
  const r = c.getBoundingClientRect(); c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
}));

/* ---------- hero: live 3D scene ---------- */
const stage = document.getElementById('stage');
const canvas = document.getElementById('hero-canvas');
const pauseBtn = document.getElementById('pause');
const OPS = [
  ['10 · vaneflow pocket roughing', 'T3 · Ø10 end mill'],
  ['20 · drill 4 × Ø5', 'T5 · Ø5 drill'],
  ['30 · 3+2 side hole, B90', 'T7 · Ø8 drill'],
];
function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
async function startHero() {
  let mod;
  try { mod = await import('./scene.js'); } catch (e) { return; }
  const codeEl = document.getElementById('code');
  const hudOp = document.getElementById('hud-op'), hudTool = document.getElementById('hud-tool');
  const dro = ['x', 'y', 'z', 'b', 'c'].map(k => [k, document.getElementById('dro-' + k)]);
  const rows = window.matchMedia('(max-width:600px)');
  let gcode = [];
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const fmtLine = s => esc(s).replace(/(\([^)]*\))/g, '<span class="c">$1</span>');
  function showLine(ln, op) {
    const n = rows.matches ? 4 : 7, before = rows.matches ? 1 : 3;
    const a = Math.max(0, Math.min(gcode.length - n, ln - before));
    let h = '';
    for (let i = a; i < a + n && i < gcode.length; i++) h += `<li${i === ln ? ' class="on"' : ''}>${fmtLine(gcode[i])}</li>`;
    codeEl.innerHTML = h;
    if (OPS[op]) { hudOp.textContent = OPS[op][0]; hudTool.textContent = OPS[op][1]; }
  }
  let sc;
  try { sc = mod.createScene(canvas, { mode: 'hero', onLine: (ln, op) => showLine(ln, op) }); }
  catch (e) { return; }
  gcode = sc.gcode;

  let running = true, visible = true, paused = false, t = 0, last = 0, droT = 0, first = true;
  function size() { const r = stage.getBoundingClientRect(); sc.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height))); }
  size();
  new ResizeObserver(size).observe(stage);
  function loop(now) {
    if (!running) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    t += dt;
    sc.frame(t);
    if (first) { first = false; stage.classList.add('live'); }
    if (now - droT > 90) {
      droT = now;
      for (const [k, el] of dro) el.textContent = sc.dro[k].toFixed(3);
    }
    requestAnimationFrame(loop);
  }
  function update() {
    const want = visible && !paused && !document.hidden;
    if (want && !running) { running = true; last = 0; requestAnimationFrame(loop); }
    else if (!want) running = false;
  }
  new IntersectionObserver(es => { visible = es[0].isIntersecting; update(); }).observe(stage);
  document.addEventListener('visibilitychange', update);
  pauseBtn.hidden = false;
  pauseBtn.addEventListener('click', () => {
    paused = !paused; pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.querySelector('.sr').textContent = paused ? 'Play animation' : 'Pause animation';
    update();
  });
  requestAnimationFrame(loop);
}
if (stage && canvas && !reduce.matches && webgl()) {
  // load the 3D scene only once the page itself is ready
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(startHero, { timeout: 1500 }) : setTimeout(startHero, 200));
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
}

/* ---------- vaneflow: animated 2D toolpath ---------- */
const vf = document.getElementById('vf');
if (vf) buildVaneflow(vf);
function buildVaneflow(svg) {
  const NS = 'http://www.w3.org/2000/svg';
  const g = svg.querySelector('#vf-paths'), tool = svg.querySelector('#vf-tool');
  const CX = 320, CY = 180, RT = 12, R = 11, ADV = 17;
  // rounded rectangle centred on the pocket, as a dense polyline (clockwise from the bottom middle)
  function rrPoly(hx, hy, rc) {
    const pts = [];
    if (hy < 0.5) { for (let x = -hx; x <= hx; x += 1) pts.push([CX + x, CY]); return pts; }
    rc = Math.min(rc, hx, hy);
    const seg = (x0, y0, x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0))); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
    const arc = (cx, cy, a0) => { for (let i = 0; i < 12; i++) { const a = (a0 + 90 * i / 12) * Math.PI / 180; pts.push([cx + rc * Math.cos(a), cy + rc * Math.sin(a)]); } };
    const L = CX - hx, Rr = CX + hx, T = CY - hy, B = CY + hy;
    seg(CX, B, L + rc, B); arc(L + rc, B - rc, 90);
    seg(L, B - rc, L, T + rc); arc(L + rc, T + rc, 180);
    seg(L + rc, T, Rr - rc, T); arc(Rr - rc, T + rc, 270);
    seg(Rr, T + rc, Rr, B - rc); arc(Rr - rc, B - rc, 0);
    seg(Rr - rc, B, CX, B); pts.push([CX, B]);
    return pts;
  }
  // trochoid along a polyline: loops bulge to the outside (away from the pocket centre)
  function trochoid(poly) {
    const out = []; let s = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[Math.min(poly.length - 1, i + 1)], o = poly[Math.max(0, i - 1)];
      if (i > 0) s += Math.hypot(p[0] - o[0], p[1] - o[1]);
      let tx = q[0] - o[0], ty = q[1] - o[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      let nx = -ty, ny = tx;
      if ((p[0] - CX) * nx + (p[1] - CY) * ny < 0) { nx = -nx; ny = -ny; }
      if (poly.length && Math.abs(p[1] - CY) < 0.5 && poly[0][1] === poly[poly.length - 1][1] && poly[0][1] === CY) { nx = 0; ny = 1; }
      const th = s / ADV * Math.PI * 2;
      out.push([p[0] + R * Math.sin(th) * tx * 0.9 + R * (1 - Math.cos(th)) * 0.5 * nx, p[1] + R * Math.sin(th) * ty * 0.9 + R * (1 - Math.cos(th)) * 0.5 * ny]);
    }
    return out;
  }
  const d = pts => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
  const segs = [];
  const levels = 4, hx0 = 140, maxHy = 150 - RT - R - 2;
  let prevEnd = null;
  for (let k = 0; k <= levels; k++) {
    const hy = maxHy * k / levels, hx = hx0 + (280 - RT - R - 2 - hx0) * k / levels;
    const tp = trochoid(rrPoly(hx, hy, 10 + k * 5));
    if (prevEnd) segs.push({ kind: 'link', pts: [prevEnd, [prevEnd[0], prevEnd[1] - 4], [tp[0][0], tp[0][1] - 4], tp[0]] });
    segs.push({ kind: 'cut', pts: tp });
    prevEnd = tp[tp.length - 1];
  }
  const fin = rrPoly(280 - RT, 150 - RT, 30 - RT);
  segs.push({ kind: 'link', pts: [prevEnd, fin[0]] });
  segs.push({ kind: 'fin', pts: fin });
  const els = segs.map(sg => {
    const mk = cls => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d(sg.pts)); p.setAttribute('class', cls); return p; };
    const area = sg.kind !== 'link' ? mk('area') : null;
    if (area) { area.setAttribute('stroke-width', String(RT * 2 + R)); g.appendChild(area); }
    const line = mk(sg.kind === 'fin' ? 'fin' : sg.kind);
    return { sg, area, line, len: 0 };
  });
  els.forEach(e => g.appendChild(e.line));
  els.forEach(e => { e.len = e.line.getTotalLength(); });
  const speed = { cut: 1500, link: 700, fin: 600 };
  let total = 0; els.forEach(e => { e.t0 = total; e.dur = e.len / speed[e.sg.kind]; total += e.dur; });
  const HOLD = 2.5, CYC = total + HOLD; svg.dataset.cycle = CYC.toFixed(1);
  function set(e, frac) {
    const L = e.len;
    if (e.sg.kind === 'link') { e.line.style.opacity = frac > 0 ? '' : '0'; e.line.style.strokeDasharray = frac >= 1 ? '' : `${L * frac} ${L}`; if (frac >= 1) e.line.style.strokeDasharray = ''; return; }
    for (const p of [e.line, e.area]) if (p) { p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = String(L * (1 - frac)); }
  }
  function at(t) {
    let cur = null;
    for (const e of els) {
      const f = Math.max(0, Math.min(1, (t - e.t0) / e.dur));
      set(e, f);
      if (t >= e.t0 && t < e.t0 + e.dur) cur = [e, f];
    }
    let p;
    if (cur) p = cur[0].line.getPointAtLength(cur[0].len * cur[1]);
    else { const e = els[els.length - 1]; p = e.line.getPointAtLength(e.len); }
    tool.setAttribute('cx', p.x.toFixed(1)); tool.setAttribute('cy', p.y.toFixed(1));
  }
  if (reduce.matches) { at(total); tool.style.display = 'none'; return; }
  at(0);
  let t = 0, last = 0, on = false;
  function loop(now) {
    if (!on) return;
    t += last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    at(t % CYC);
    requestAnimationFrame(loop);
  }
  new IntersectionObserver(es => {
    const v = es[0].isIntersecting;
    if (v && !on) { on = true; last = 0; requestAnimationFrame(loop); } else if (!v) on = false;
  }, { threshold: 0.15 }).observe(svg);
}
