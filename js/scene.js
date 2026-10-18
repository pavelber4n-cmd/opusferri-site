// millvane website: the machining scene (made-up bracket on a generic vise,
// on a generic B/C trunnion table). Used live in the hero and for the
// pre-rendered images. Units are mm, Z is up.
import * as THREE from './vendor/three.module.min.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { LineSegments2 } from './vendor/LineSegments2.js';
import { LineSegmentsGeometry } from './vendor/LineSegmentsGeometry.js';
import { LineMaterial } from './vendor/LineMaterial.js';

const IRIS = 0x5d63f2, IRIS_DIM = 0x5a60c8, RAPID = 0x7c8594;
const PIVOT_Z = 75;          // B axis height above the rotary table top
const PART_Z = 60;           // part base height above the rotary table top

/* ---------- part ---------- */
function rrect(s, w, h, r, cx = 0, cy = 0) {
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function circ(x, y, r) { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; }
function rrHole(w, h, r) {
  const p = new THREE.Path();
  // clockwise for a hole
  const x = -w / 2, y = -h / 2;
  p.moveTo(x + r, y);
  p.absarc(x + r, y + r, r, -Math.PI / 2, -Math.PI, true);
  p.lineTo(x, y + h - r); p.absarc(x + r, y + h - r, r, Math.PI, Math.PI / 2, true);
  p.lineTo(x + w - r, y + h); p.absarc(x + w - r, y + h - r, r, Math.PI / 2, 0, true);
  p.lineTo(x + w, y + r); p.absarc(x + w - r, y + r, r, 0, -Math.PI / 2, true);
  p.lineTo(x + r, y);
  return p;
}
export const PART = {
  holesCorner: [[52, 30], [-52, 30], [52, -30], [-52, -30]],
  holesFloor: [[20, 14], [-20, 14], [-20, -14], [20, -14]],
  pocket: { w: 66, h: 50, r: 8, floor: 14, top: 30 },
};
function partGeoms() {
  const a = rrect(new THREE.Shape(), 120, 80, 6);
  PART.holesCorner.forEach(([x, y]) => a.holes.push(circ(x, y, 4.5)));
  PART.holesFloor.forEach(([x, y]) => a.holes.push(circ(x, y, 2.5)));
  a.holes.push(circ(0, 0, 8));
  const ga = new THREE.ExtrudeGeometry(a, { depth: 14, bevelEnabled: false, curveSegments: 18 });
  const b = rrect(new THREE.Shape(), 90, 80, 3);
  b.holes.push(rrHole(66, 50, 8));
  const gb = new THREE.ExtrudeGeometry(b, { depth: 16, bevelEnabled: false, curveSegments: 18 });
  gb.translate(0, 0, 14);
  return [ga, gb];
}

/* ---------- toolpaths (part coordinates) ---------- */
const f3 = v => (Math.round(v * 1000) / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '.');
function buildProgram() {
  const segs = []; const g = [];
  const line = s => { g.push(s); return g.length - 1; };
  const seg = (kind, pts, ln, op) => segs.push({ kind, pts, ln, op });
  let cur = new THREE.Vector3(0, 0, 120);
  const go = (kind, p, ln, op) => { seg(kind, [cur.clone(), p.clone()], ln, op); cur = p.clone(); };

  line('%'); line('O1001 (BRACKET-01 OP1)'); line('G21 G17 G40 G80 G90');
  line('G0 G53 Z0.');
  // ---- OP10 vaneflow roughing, T3 D10 end mill
  line('(OP10 VANEFLOW POCKET ROUGHING)');
  const tc1 = line('T3 M6 (D10 END MILL 3FL)');
  line('S9500 M3');
  const x0 = -26, x1 = 26, r = 4, adv = 2.6;
  let ln = line(`G0 G54 X${f3(x0 + 3)} Y0. B0. C0.`);
  go('rapid', new THREE.Vector3(x0 + 3, 0, 60), ln, 0);
  ln = line('G43 H3 Z33. M8');
  go('rapid', new THREE.Vector3(x0 + 3, 0, 33), ln, 0);
  // helical entry
  for (let zt = 31.5; zt > 14.01; zt -= 2.5) {
    const z0 = cur.z, zt2 = Math.max(14, zt - 0);
    const pts = [];
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(new THREE.Vector3(x0 + 3 * Math.cos(a), 3 * Math.sin(a), z0 + (zt2 - z0) * i / 24)); }
    ln = line(`G3 X${f3(x0 + 3)} Y0. Z${f3(zt2)} I-3. J0.${zt === 31.5 ? ' F1200' : ''}`);
    seg('cut', pts, ln, 0); cur = pts[pts.length - 1].clone();
  }
  const rows = [0, 8, -8, 16, -16];
  rows.forEach((y0, ri) => {
    // move onto the row start, staying down
    if (ri > 0) {
      ln = line(`G1 X${f3(x0)} Y${f3(y0)} Z14.3 F4000`);
      const back = new THREE.Vector3(x0, rows[ri - 1] > 0 ? Math.min(rows[ri - 1], y0) : Math.max(rows[ri - 1], y0), 14.3);
      seg('link', [cur.clone(), new THREE.Vector3(cur.x, cur.y, 14.3), new THREE.Vector3(x0, cur.y, 14.3), back, new THREE.Vector3(x0, y0, 14.3)], ln, 0);
      cur = new THREE.Vector3(x0, y0, 14.3);
      ln = line('G1 Z14. F1800');
      go('cut', new THREE.Vector3(x0, y0, 14), ln, 0);
    } else {
      ln = line(`G1 X${f3(x0)} Y0. F1800`);
      go('cut', new THREE.Vector3(x0, 0, 14), ln, 0);
    }
    const dir = y0 > 0 ? 1 : (y0 < 0 ? -1 : 1);
    let x = x0;
    while (x < x1 - 0.01) {
      const pts = []; const xs = x;
      for (let i = 0; i <= 28; i++) {
        const t = i / 28 * Math.PI * 2;
        pts.push(new THREE.Vector3(xs + adv * i / 28 + r * Math.sin(t) * 0.92, y0 + dir * r * (1 - Math.cos(t)) * 0.5 * (y0 === 0 ? 1 : 1), 14));
      }
      x = xs + adv;
      ln = line(`G${dir > 0 ? 3 : 2} X${f3(x)} Y${f3(y0)} I${f3(r * 0.5)} J${f3(dir * r * 0.5)}`);
      seg('cut', pts, ln, 0); cur = pts[pts.length - 1].clone();
    }
  });
  // finishing contour (tool centre, offset 5 from the pocket wall)
  {
    const w = 56, h = 40, rr = 3, pts = [];
    ln = line('G1 X0. Y-20. F1400');
    go('cut', new THREE.Vector3(0, -20, 14), ln, 0);
    const corners = [[w / 2 - rr, -h / 2 + rr, -90], [w / 2 - rr, h / 2 - rr, 0], [-w / 2 + rr, h / 2 - rr, 90], [-w / 2 + rr, -h / 2 + rr, 180]];
    const P = [new THREE.Vector3(0, -20, 14)];
    corners.forEach(([cx, cy, a0]) => {
      for (let i = 0; i <= 8; i++) { const a = (a0 + 90 * i / 8) * Math.PI / 180; P.push(new THREE.Vector3(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 14)); }
    });
    P.push(new THREE.Vector3(0, -20, 14));
    ln = line('G1 X25. Y-20. (WALL PASS)');
    seg('cut', P, ln, 0); cur = P[P.length - 1].clone();
  }
  ln = line('G0 Z50. M9');
  go('rapid', new THREE.Vector3(cur.x, cur.y, 50), ln, 0);
  line('G0 G53 Z0.');
  go('rapid', new THREE.Vector3(cur.x, cur.y, 120), ln, 0);

  // ---- OP20 drill 4 x D5
  line('(OP20 DRILL 4X D5)');
  const tc2 = line('T5 M6 (D5 DRILL)');
  line('S5200 M3');
  const fh = PART.holesFloor;
  ln = line(`G0 G54 X${f3(fh[0][0])} Y${f3(fh[0][1])}`);
  go('rapid', new THREE.Vector3(fh[0][0], fh[0][1], 50), ln, 1);
  ln = line('G43 H5 Z50. M8');
  fh.forEach(([x, y], i) => {
    const l2 = i === 0 ? line(`G98 G83 X${f3(x)} Y${f3(y)} Z-1. R17. Q4. F420`) : line(`X${f3(x)} Y${f3(y)}`);
    go('rapid', new THREE.Vector3(x, y, 50), l2, 1);
    go('rapid', new THREE.Vector3(x, y, 17), l2, 1);
    for (let z = 13; ; z -= 4) {
      const zt = Math.max(-1, z - 4 + 4);
      go('cut', new THREE.Vector3(x, y, Math.max(-1, z)), l2, 1);
      if (z <= -1) break;
      go('rapid', new THREE.Vector3(x, y, 17), l2, 1);
      go('rapid', new THREE.Vector3(x, y, Math.max(-1, z) + 1), l2, 1);
      void zt;
    }
    go('rapid', new THREE.Vector3(x, y, 50), l2, 1);
  });
  line('G80 M9');
  ln = line('G0 G53 Z0.');
  go('rapid', new THREE.Vector3(cur.x, cur.y, 120), ln, 1);

  // ---- OP30 3+2 side hole, table tilted B-90
  line('(OP30 3+2 SIDE HOLE D8)');
  const tc3 = line('T7 M6 (D8 DRILL)');
  line('S3800 M3');
  const tilt = line('G0 B90. C0.');
  ln = line('G55 X0. Y-7.');
  // side hole in the -X end face; in part coordinates the tool comes in along +X
  const S = (d) => new THREE.Vector3(-60 - d, 0, 7);
  cur = S(60);
  ln = line('G43 H7 Z30. M8');
  go('rapid', S(30), ln, 2);
  const l3 = line('G98 G83 Z-20. R3. Q6. F300');
  go('rapid', S(3), l3, 2);
  for (let d = -6; ; d -= 6) {
    go('cut', S(Math.max(-20, d)), l3, 2);
    if (d <= -20) break;
    go('rapid', S(3), l3, 2); go('rapid', S(Math.max(-20, d) + 1), l3, 2);
  }
  go('rapid', S(30), l3, 2);
  line('G80 M9');
  ln = line('G0 G53 Z0.');
  go('rapid', S(70), ln, 2);
  const untilt = line('G0 B0. C0.');
  line('M30'); line('%');
  return { segs, gcode: g, tc: [tc1, tc2, tc3], tilt, untilt };
}

/* ---------- tools ---------- */
function lathe(profile, mat, seg = 40) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2); // lathe is around Y; make it around Z
  return new THREE.Mesh(g, mat);
}
function makeToolGroup(mats) {
  const grp = new THREE.Group();
  const holder = new THREE.Group();
  // holder: collet nut, body, flange (gauge line at z 70 above the nut start)
  holder.add(lathe([[0, 45], [15, 45], [16.5, 47], [16.5, 66], [19, 70], [22, 100], [26, 104], [31.5, 106], [31.5, 122], [26, 124], [22, 126], [22, 150], [0, 150]], mats.holder));
  const nose = lathe([[0, 152], [62, 152], [70, 160], [70, 300], [0, 300]], mats.head);
  holder.add(nose);
  const ram = new THREE.Mesh(new THREE.BoxGeometry(230, 260, 900), mats.head);
  ram.position.z = 300 + 450; holder.add(ram);
  grp.add(holder);
  const tools = [
    // end mill D10
    (() => { const t = new THREE.Group(); t.add(lathe([[0, 0], [4.6, 0], [5, 0.4], [5, 28], [4.7, 30], [5, 32], [5, 46], [0, 46]], mats.tool));
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(5.05, 5.05, 26, 3, 6, true), mats.flute); fl.rotation.x = Math.PI / 2; fl.position.z = 15; t.add(fl); return t; })(),
    // drill D5
    lathe([[0, 0], [2.5, 1.5], [2.5, 34], [3, 36], [3, 46], [0, 46]], mats.drill),
    // drill D8
    lathe([[0, 0], [4, 2.4], [4, 36], [4.5, 38], [4.5, 46], [0, 46]], mats.drill),
  ];
  tools.forEach((t, i) => { t.visible = i === 0; grp.add(t); });
  grp.userData.tools = tools; grp.userData.holder = holder;
  return grp;
}

/* ---------- vise, table, trunnion ---------- */
function box(w, d, h, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat); m.position.set(x, y, z + h / 2); return m;
}
function makeVise(mats) {
  const g = new THREE.Group();
  g.add(box(200, 150, 50, mats.paint, 0, 0, -60));
  g.add(box(200, 12, 4, mats.steel, 0, 0, -14)); // rail
  // fixed and moving jaw
  [[1, 'jawA'], [-1, 'jawB']].forEach(([s, n]) => {
    const jaw = box(170, 26, 34, mats.paint, 0, s * (42 + 22 + 13), -14);
    g.add(jaw);
    const plate = box(170, 22, 24, mats.jaw, 0, s * (42 + 11), -14);
    plate.name = n; g.add(plate);
  });
  // parallels
  [-24, 24].forEach(y => g.add(box(150, 6, 10, mats.steel, 0, y, -10)));
  // spindle screw boss
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 30, 24), mats.steel);
  boss.position.set(0, -110, -40); g.add(boss);
  return g;
}
function makeTrunnion(mats) {
  const fixed = new THREE.Group(), cradle = new THREE.Group(), table = new THREE.Group();
  cradle.position.z = PIVOT_Z; // cradle rotates about its own origin (the B axis)
  // cradle body, below the table, with two arms up to the pivot
  const zf = -PIVOT_Z;
  cradle.add(box(380, 370, 40, mats.cast, 0, 0, zf - 70));
  [-1, 1].forEach(s => {
    const arm = box(380, 34, PIVOT_Z + 70, mats.cast, 0, s * 202, zf - 70); cradle.add(arm);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(82, 82, 34, 48), mats.cast); hub.position.set(0, s * 202, 0); cradle.add(hub);
    // fixed housings
    const h = new THREE.Group();
    h.add(box(260, 60, 330, mats.base, 0, s * 252, -260));
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(100, 100, 60, 48), mats.base); hb.position.set(0, s * 252, PIVOT_Z); h.add(hb);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(58, 58, 10, 40), mats.steel); cap.position.set(0, s * 287, PIVOT_Z); h.add(cap);
    fixed.add(h);
  });
  fixed.add(box(760, 640, 60, mats.base, 0, 0, -320));
  // rotary table (C)
  table.position.z = zf;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(165, 170, 30, 72), mats.table); disc.rotation.x = Math.PI / 2; disc.position.z = -15; table.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(165, 1.2, 6, 96), mats.steel); table.add(ring);
  // T-slots
  for (let i = 0; i < 4; i++) {
    const s = box(300, 14, 1.2, mats.slot, 0, 0, -0.9); s.rotation.z = i * Math.PI / 4; table.add(s);
  }
  cradle.add(table);
  return { fixed, cradle, table };
}

/* ---------- materials ---------- */
function makeMats() {
  return {
    part: new THREE.MeshStandardMaterial({ color: 0x9aa2b0, metalness: 0.85, roughness: 0.3 }),
    stock: new THREE.MeshBasicMaterial({ color: 0x9aa3af, transparent: true, opacity: 0.045, depthWrite: false }),
    paint: new THREE.MeshStandardMaterial({ color: 0x2a3039, metalness: 0.3, roughness: 0.55, envMapIntensity: 0.6 }),
    jaw: new THREE.MeshStandardMaterial({ color: 0x8d95a2, metalness: 0.8, roughness: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa1ad, metalness: 0.85, roughness: 0.28 }),
    cast: new THREE.MeshStandardMaterial({ color: 0x2b3039, metalness: 0.35, roughness: 0.6, envMapIntensity: 0.55 }),
    base: new THREE.MeshStandardMaterial({ color: 0x1c2027, metalness: 0.3, roughness: 0.7, envMapIntensity: 0.5 }),
    table: new THREE.MeshStandardMaterial({ color: 0x6d7480, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.8 }),
    slot: new THREE.MeshStandardMaterial({ color: 0x1b1f26, metalness: 0.2, roughness: 0.8 }),
    holder: new THREE.MeshStandardMaterial({ color: 0xa9b0bb, metalness: 0.9, roughness: 0.22 }),
    head: new THREE.MeshStandardMaterial({ color: 0x23272f, metalness: 0.4, roughness: 0.45, envMapIntensity: 0.7 }),
    tool: new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.9, roughness: 0.25 }),
    flute: new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
    drill: new THREE.MeshStandardMaterial({ color: 0xc9a46a, metalness: 0.85, roughness: 0.3 }),
    edge: new THREE.LineBasicMaterial({ color: 0x0e1116, transparent: true, opacity: 0.55 }),
  };
}

function holeDisc() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, '#05070a'); gr.addColorStop(0.75, '#141820'); gr.addColorStop(0.95, '#5b6270'); gr.addColorStop(1, '#5b627000');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.rotation.y = -Math.PI / 2; m.position.set(-60.05, 0, 7);
  return m;
}

/* ---------- path drawing ---------- */
function samplePath(prog) {
  const S = []; const speed = { cut: 170, link: 380, rapid: 650 };
  let t = 0;
  prog.segs.forEach((sg, si) => {
    for (let i = 1; i < sg.pts.length; i++) {
      const a = sg.pts[i - 1], b = sg.pts[i]; const L = a.distanceTo(b);
      const dt = L / (sg.op > 0 ? (sg.kind === 'cut' ? (sg.op === 2 ? 14 : 38) : 220) : speed[sg.kind]);
      S.push({ a, b, t0: t, t1: t + dt, kind: sg.kind, ln: sg.ln, op: sg.op, si });
      t += dt;
    }
  });
  return { S, T: t };
}
function pathLines(S, width = 1.6) {
  const pos = new Float32Array(S.length * 6), col = new Float32Array(S.length * 6);
  const C = { cut: new THREE.Color(IRIS), link: new THREE.Color(0xdfe3ff), rapid: new THREE.Color(RAPID) };
  S.forEach((s, i) => {
    pos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
    const c = C[s.kind]; col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
  });
  const g = new LineSegmentsGeometry();
  g.setPositions(pos); g.setColors(col);
  const m = new LineMaterial({ vertexColors: true, linewidth: width, transparent: true, opacity: 0.95 });
  const l = new LineSegments2(g, m); l.renderOrder = 3;
  return l;
}

function fatLines(pairs, color, width, opts = {}) {
  const pos = [];
  pairs.forEach(([a, b]) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z));
  const g = new LineSegmentsGeometry(); g.setPositions(pos);
  const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity: opts.opacity ?? 1, dashed: !!opts.dashed, dashSize: 4, gapSize: 3 });
  const l = new LineSegments2(g, m); if (opts.dashed) l.computeLineDistances();
  return l;
}

/* ---------- deviation shader for the compare image ---------- */
function devMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.0, roughness: 0.75, envMapIntensity: 0.35 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPw = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vPw;
vec3 ramp(float d){ // d in mm: -0.2 gouge .. +0.4 material left
  vec3 ok = vec3(0.38,0.74,0.52);
  vec3 left = vec3(0.30,0.52,0.98);
  vec3 left2 = vec3(0.55,0.36,0.98);
  vec3 goug = vec3(0.96,0.30,0.28);
  if (d < 0.0) return mix(ok, goug, clamp(-d/0.15,0.0,1.0));
  return d < 0.2 ? mix(ok, left, d/0.2) : mix(left, left2, clamp((d-0.2)/0.2,0.0,1.0));
}`).replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  float d = 0.0;
  // material left in two pocket corners (a larger finishing radius in program B)
  vec2 c1 = vec2(33.0-8.0, 25.0-8.0), c2 = vec2(-33.0+8.0, 25.0-8.0);
  float inPocket = step(14.01, vPw.z) * step(abs(vPw.x), 33.2) * step(abs(vPw.y), 25.2);
  d += inPocket * 0.42 * smoothstep(8.0, 2.0, abs(length(vPw.xy - c1) - 8.0) + max(0.0, 8.0 - (vPw.x - c1.x) - (vPw.y - c1.y)) * 0.0) * step(c1.x, vPw.x) * step(c1.y, vPw.y);
  d += inPocket * 0.42 * step(vPw.x, c2.x) * step(c2.y, vPw.y) * smoothstep(8.0, 2.0, abs(length(vPw.xy - c2) - 8.0));
  // a small gouge on the floor near a hole
  d -= 0.2 * smoothstep(6.0, 1.0, length(vPw.xy - vec2(14.0, -9.0))) * step(vPw.z, 14.05) * step(13.95, vPw.z);
  // stock left on one shoulder
  d += 0.25 * smoothstep(0.0, 1.0, clamp((vPw.x - 46.0)/10.0, 0.0, 1.0)) * step(13.95, vPw.z) * step(vPw.z, 14.05);
  vec4 diffuseColor = vec4( ramp(d), opacity );`);
  };
  return m;
}

/* ---------- the scene ---------- */
export function createScene(canvas, opts = {}) {
  const mode = opts.mode || 'hero';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.still });
  renderer.setPixelRatio(Math.min(opts.dpr || window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = mode === 'compare' ? 0.8 : 1.05;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1d24, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(500, -250, 700); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xa5b4ff, 0.9); rim.position.set(-500, 500, 200); scene.add(rim);

  const mats = makeMats();
  const world = new THREE.Group(); scene.add(world);
  const tr = makeTrunnion(mats);
  const partGroup = new THREE.Group(); partGroup.position.z = PART_Z;
  const showMachine = mode === 'hero' || mode === 'poster' || mode === 'sim';
  if (showMachine) { world.add(tr.fixed); world.add(tr.cradle); tr.table.add(partGroup); }
  else world.add(partGroup);

  const [ga, gb] = partGeoms();
  const partMat = mode === 'compare' ? devMaterial() : mode === 'design'
    ? new THREE.MeshStandardMaterial({ color: 0x7f8aa3, metalness: 0.15, roughness: 0.6, envMapIntensity: 0.45 }) : mats.part;
  [ga, gb].forEach(g => {
    partGroup.add(new THREE.Mesh(g, partMat));
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), mats.edge); partGroup.add(e);
  });
  const side = holeDisc(); partGroup.add(side);
  side.visible = mode !== 'hero' && mode !== 'cam';
  if (mode === 'hero' || mode === 'poster' || mode === 'sim' || mode === 'cam') {
    const vise = makeVise(mats); partGroup.add(vise);
    const sg = new THREE.BoxGeometry(124, 84, 32); sg.translate(0, 0, 16);
    const st = new THREE.Mesh(sg, mats.stock); partGroup.add(st);
    const se = new THREE.LineSegments(new THREE.EdgesGeometry(sg), new THREE.LineBasicMaterial({ color: 0x8f96ff, transparent: true, opacity: 0.22 }));
    partGroup.add(se);
  }
  const extraLines = [];
  if (mode === 'design') {
    // sketch profile of the pocket on the top face, and construction lines
    const pts = rrHole(66, 50, 8).getPoints(16).map(p => new THREE.Vector3(p.x, p.y, 30.1));
    const pairs = []; for (let i = 1; i < pts.length; i++) pairs.push([pts[i - 1], pts[i]]);
    pairs.push([pts[pts.length - 1], pts[0]]);
    const sk = fatLines(pairs, IRIS, 2.6); partGroup.add(sk); extraLines.push(sk);
    const V = (x, y) => new THREE.Vector3(x, y, 30.1);
    const cl = fatLines([[V(-72, 0), V(72, 0)], [V(0, -52), V(0, 52)]], 0xa5b4ff, 1.4, { dashed: true, opacity: 0.8 });
    partGroup.add(cl); extraLines.push(cl);
    // sketch points at the corner centres
    [[25, 17], [-25, 17], [25, -17], [-25, -17]].forEach(([x, y]) => {
      const d = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      d.position.set(x, y, 30.15); partGroup.add(d);
    });
  }

  const prog = buildProgram();
  const { S, T } = samplePath(prog);
  const lines = pathLines(mode === 'cam' ? S.filter(x => x.op === 0 && x.kind !== 'rapid') : S, mode === 'hero' ? 2.0 : 3.0); partGroup.add(lines);
  lines.visible = mode === 'hero' || mode === 'poster' || mode === 'cam';

  const tool = makeToolGroup(mats);
  if (showMachine) world.add(tool);

  const camera = new THREE.PerspectiveCamera(opts.fov || 30, 1, 5, 6000);
  camera.up.set(0, 0, 1);
  const views = {
    hero: { pos: [430, -230, 290], tgt: [0, 0, 86] },
    poster: { pos: [430, -230, 290], tgt: [0, 0, 86] },
    sim: { pos: [390, -270, 235], tgt: [-10, 0, 100] },
    cam: { pos: [125, -215, 330], tgt: [0, 4, 66] },
    design: { pos: [150, -200, 190], tgt: [0, 0, 8] },
    compare: { pos: [140, -190, 210], tgt: [0, 0, 6] },
  };
  const V = views[mode];
  const tgt = new THREE.Vector3(...V.tgt);
  const basePos = new THREE.Vector3(...V.pos);
  camera.position.copy(basePos); camera.lookAt(tgt);
  if (mode === 'design' || mode === 'compare') partGroup.position.z = 0;

  // timeline: cycle = op1+op2, tilt, op3, untilt, pause
  const tA = S.findIndex(s => s.op === 2);
  const T12 = S[tA].t0, T3 = T - T12;
  const TILT = 2.4, PAUSE = 2.2;
  const CYCLE = T12 + TILT + T3 + TILT + PAUSE;
  let onLine = opts.onLine || (() => {}), lastLn = -1;
  const tmp = new THREE.Vector3();
  let curOp = 0;

  function setB(deg) { tr.cradle.rotation.y = deg * Math.PI / 180; }
  function state(t) {
    t = ((t % CYCLE) + CYCLE) % CYCLE;
    let pt, ln, b = 0, op, drawUpTo, uu = 0;
    if (t < T12) {
      const i = bsearch(S, t); const s = S[i]; const u = (t - s.t0) / Math.max(1e-6, s.t1 - s.t0);
      pt = tmp.copy(s.a).lerp(s.b, u); ln = s.ln; op = s.op; drawUpTo = i + 1;
    } else if (t < T12 + TILT) {
      const u = ease((t - T12) / TILT); b = 90 * u; pt = tmp.copy(S[tA].a); ln = prog.tilt; op = 2; drawUpTo = tA; uu = u;
    } else if (t < T12 + TILT + T3) {
      const tt = T12 + (t - T12 - TILT); const i = bsearch(S, tt); const s = S[i]; const u = (tt - s.t0) / Math.max(1e-6, s.t1 - s.t0);
      pt = tmp.copy(s.a).lerp(s.b, u); ln = s.ln; op = 2; b = 90; drawUpTo = i + 1;
    } else {
      const u = ease(Math.min(1, (t - T12 - TILT - T3) / TILT)); b = 90 * (1 - u); const s = S[S.length - 1];
      pt = tmp.copy(s.b); ln = prog.untilt; op = 2; drawUpTo = S.length; uu = u;
    }
    return { pt, ln, b, op, drawUpTo, t, u: uu };
  }
  function bsearch(a, t) { let lo = 0, hi = a.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m].t0 <= t) lo = m; else hi = m - 1; } return lo; }
  function ease(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }

  const dro = { x: 0, y: 0, z: 0, b: 0, c: 0 };
  function worldAt(p, b) { setB(b); world.updateMatrixWorld(true); return partGroup.localToWorld(p.clone()); }
  const tiltA = worldAt(S[tA - 1].b, 0), tiltB = worldAt(S[tA].a, 90);
  const untA = worldAt(S[S.length - 1].b, 90), untB = worldAt(S[0].a, 0);
  setB(0);
  function apply(st) {
    setB(st.b);
    world.updateMatrixWorld(true);
    let w;
    if (st.ln === prog.tilt || st.ln === prog.untilt) {
      const [A, B] = st.ln === prog.tilt ? [tiltA, tiltB] : [untA, untB];
      const u = st.u; w = A.clone().lerp(B, u); w.z += 90 * Math.sin(Math.PI * u);
    } else w = partGroup.localToWorld(st.pt.clone());
    tool.position.copy(w);
    tool.userData.tools.forEach((m, i) => { m.visible = i === st.op; });
    lines.geometry.instanceCount = st.drawUpTo;
    if (mode === 'hero' || mode === 'poster') side.visible = (st.op === 2 && st.drawUpTo > tA + 3) || st.ln === prog.untilt;
    dro.x = st.pt.x; dro.y = st.pt.y; dro.z = st.pt.z; dro.b = st.b; dro.c = 0;
    if (st.ln !== lastLn) { lastLn = st.ln; onLine(st.ln, st.op); }
    curOp = st.op;
  }

  // collision example for the "sim" render: tool too short, holder hits the jaw
  if (mode === 'sim') {
    // a tool set up too short: at B30 C90 the holder meets the pocket wall
    tr.table.rotation.z = Math.PI / 2; setB(30); world.updateMatrixWorld(true);
    const red = new THREE.MeshStandardMaterial({ color: 0xff4d4f, emissive: 0x7a1012, metalness: 0.4, roughness: 0.45 });
    const holder = tool.userData.holder;
    holder.children[0].material = red; holder.position.z = -27;
    tool.userData.tools.forEach((m, i) => { m.visible = i === 0; m.scale.z = i === 0 ? 0.62 : 1; });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(30, 15.6, 5.4), new THREE.MeshStandardMaterial({ color: 0xff4d4f, emissive: 0x5a0c0e, metalness: 0.2, roughness: 0.5, transparent: true, opacity: 0.85 }));
    hit.position.set(0, 32.5, 27.75); partGroup.add(hit);
    tool.position.copy(partGroup.localToWorld(new THREE.Vector3(0, 18, 14)));
    lines.visible = false; side.visible = true;
  }

  let w0 = 0, h0 = 0;
  function resize(w, h) {
    if (w === w0 && h === h0) return; w0 = w; h0 = h;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    lines.material.resolution.set(w, h); extraLines.forEach(l => l.material.resolution.set(w, h));
    // keep the scene framed on narrow screens
    camera.fov = (opts.fov || 30) * (camera.aspect < 1 ? Math.min(1.7, 1 / camera.aspect * 0.95) : 1);
    camera.updateProjectionMatrix();
  }
  let sway = 0;
  function frame(t) {
    if (mode === 'hero' || mode === 'poster') {
      apply(state(t));
      sway = Math.sin(t * 0.12) * 0.22;
      const r = Math.hypot(basePos.x, basePos.y), a0 = Math.atan2(basePos.y, basePos.x) + sway;
      camera.position.set(r * Math.cos(a0), r * Math.sin(a0), basePos.z); camera.lookAt(tgt);
    } else if (mode === 'cam') {
    }
    renderer.render(scene, camera);
  }
  return { renderer, resize, frame, gcode: prog.gcode, tc: prog.tc, CYCLE, T12, T3, TILT, dro, get op() { return curOp; } };
}
