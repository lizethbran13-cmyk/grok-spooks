/* Grok Spooks - procedural low-poly models (hunters, ghosts, bosses, props) */
(function () {
'use strict';
const SP = window.SP, T = window.THREE, TAU = Math.PI * 2;
const M = SP.M = {};
const matC = {};
function lam(c, o) { const k = 'l' + c + (o ? JSON.stringify(o) : ''); return matC[k] || (matC[k] = new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}))); }
function bas(c, o) { const k = 'b' + c + (o ? JSON.stringify(o) : ''); return matC[k] || (matC[k] = new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}))); }
M.lam = lam; M.bas = bas;
const geoC = {};
const box = (w, h, d) => geoC['b' + w + h + d] || (geoC['b' + w + h + d] = new T.BoxGeometry(w, h, d));
const sph = (r, s) => geoC['s' + r + (s || 12)] || (geoC['s' + r + (s || 12)] = new T.SphereGeometry(r, s || 12, Math.max(6, (s || 12) * 0.66 | 0)));
const cyl = (a, b, h, s) => geoC['c' + a + b + h + (s || 12)] || (geoC['c' + a + b + h + (s || 12)] = new T.CylinderGeometry(a, b, h, s || 12));
M.box = box; M.sph = sph; M.cyl = cyl;
function mesh(g, m, x, y, z, p) { const o = new T.Mesh(g, typeof m === 'string' ? lam(m) : m); o.position.set(x || 0, y || 0, z || 0); if (p) p.add(o); return o; }
M.mesh = mesh;
// B: box sitting on y (bottom at y)
function B(w, h, d, m, x, y, z, p) { return mesh(box(w, h, d), m, x, (y || 0) + h / 2, z, p); }
function S(r, m, x, y, z, p, s) { return mesh(sph(r, s), m, x, y, z, p); }
function C(r, h, m, x, y, z, p, r2, s) { return mesh(cyl(r, r2 == null ? r : r2, h, s), m, x, (y || 0) + h / 2, z, p); }
M.B = B; M.S = S; M.C = C;

/* glow sprite */
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowTex = new T.CanvasTexture(c); return glowTex;
}
M.glow = function (col, size, op) {
  const s = new T.Sprite(new T.SpriteMaterial({ map: glowTexture(), color: col, transparent: true, opacity: op == null ? 0.55 : op, depthWrite: false, blending: T.AdditiveBlending }));
  s.scale.set(size, size, 1); return s;
};
M.ring = function (r, col, op) { const m = new T.Mesh(new T.RingGeometry(r * 0.82, r, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op || 0.6, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; };
M.disc = function (r, col, op) { const m = new T.Mesh(new T.CircleGeometry(r, 32), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op || 0.4, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; };
M.text = function (txt, col, bg, w) { // canvas text sprite
  const c = document.createElement('canvas'); c.width = w || 256; c.height = 64; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(2, 2, c.width - 4, 60, 22) : g.rect(2, 2, c.width - 4, 60); g.fill(); }
  g.font = 'bold 40px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#120a28'; g.strokeText(txt, c.width / 2, 34); g.fillStyle = col || '#fff'; g.fillText(txt, c.width / 2, 34);
  const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(c.width / 64 * 0.5, 0.5, 1); s.renderOrder = 10; return s;
};

/* ---------- hunter ---------- */
M.hunter = function (color, hero, goo) {
  const g = new T.Group(); const body = new T.Group(); g.add(body); g.userData.body = body;
  const gm = goo ? new T.MeshLambertMaterial({ color: '#39ff6a', emissive: '#0f7a2a', transparent: true, opacity: 0.72 }) : null;
  const m = (c) => gm || lam(c);
  const skin = '#ffd7b0';
  C(0.18, 0.5, m('#2d2a5a'), -0.16, 0, 0, body); C(0.18, 0.5, m('#2d2a5a'), 0.16, 0, 0, body);
  B(0.3, 0.14, 0.42, m('#3a2a1a'), -0.16, 0, 0.06, body); B(0.3, 0.14, 0.42, m('#3a2a1a'), 0.16, 0, 0.06, body);
  const torso = C(0.36, 0.62, m(color), 0, 0.46, 0, body, 0.42); torso.userData.tint = 1;
  B(0.74, 0.12, 0.5, m('#1b1440'), 0, 0.66, 0, body);
  S(0.34, m(skin), 0, 1.36, 0.02, body, 14);
  const eyeM = gm || bas('#1b1440'); S(0.06, eyeM, -0.12, 1.4, 0.3, body, 8); S(0.06, eyeM, 0.12, 1.4, 0.3, body, 8);
  S(0.12, m('#ffb08a'), 0, 1.3, 0.33, body, 8);
  // hats
  const hh = (hero && hero.hat) || 'cap';
  if (hh === 'cap') { S(0.36, m(color), 0, 1.5, 0, body, 14).scale.set(1, 0.6, 1); B(0.42, 0.06, 0.32, m(color), 0, 1.5, 0.3, body); C(0.08, 0.04, m('#fff'), 0, 1.7, 0, body); }
  else if (hh === 'bow') { S(0.37, m('#7a3a1a'), 0, 1.44, -0.04, body, 14).scale.set(1, 0.85, 1); S(0.15, m('#7a3a1a'), -0.36, 1.28, -0.05, body, 8); S(0.15, m('#7a3a1a'), 0.36, 1.28, -0.05, body, 8); S(0.11, m(color), -0.12, 1.75, 0, body, 8); S(0.11, m(color), 0.12, 1.75, 0, body, 8); }
  else { S(0.37, m(color), 0, 1.52, 0, body, 14).scale.set(1, 0.72, 1); S(0.1, m('#fff'), 0, 1.82, 0, body, 8); B(0.76, 0.1, 0.1, m('#fff'), 0, 1.38, 0.28, body).visible = false; }
  // arms + nozzle
  const armL = C(0.09, 0.5, m(color), -0.46, 0.55, 0.05, body); armL.rotation.x = -0.6;
  const armR = C(0.09, 0.5, m(color), 0.46, 0.55, 0.12, body); armR.rotation.x = -1.1;
  const noz = new T.Group(); noz.position.set(0.2, 0.75, 0.42); body.add(noz); g.userData.noz = noz;
  C(0.07, 0.6, m('#cfd6e4'), 0, 0, 0, noz).rotation.x = Math.PI / 2; noz.children[0].position.set(0, 0, 0.3);
  C(0.15, 0.18, m('#9aa5b8'), 0, 0, 0, noz, 0.08).rotation.x = Math.PI / 2; noz.children[1].position.set(0, 0, 0.66);
  // Grok-Vac backpack
  const pack = new T.Group(); pack.position.set(0, 0.6, -0.36); body.add(pack);
  C(0.27, 0.72, m('#e9eef7'), 0, 0, 0, pack); C(0.28, 0.1, m(color), 0, 0.72, 0, pack); C(0.28, 0.06, m('#3ff0ff'), 0, 0.3, 0, pack);
  const lamp = S(0.1, gm || bas('#fffbe0'), 0, 0.24, 0.0, noz); lamp.position.set(0.12, 0.06, 0.1);
  g.userData.parts = { armL, armR, pack, torso };
  return g;
};

/* ---------- ghosts & monsters ---------- */
function eyes(p, y, z, s, col, sep) { const e = bas(col || '#1b1440'); S(s, e, -(sep || s * 1.6), y, z, p, 8); S(s, e, sep || s * 1.6, y, z, p, 8); }
function ghostBody(col, scale, op) {
  const g = new T.Group(); const mat = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: op || 0.92 });
  const head = mesh(sph(0.55, 16), mat, 0, 0.55, 0, g);
  const tail = mesh(cyl(0.52, 0.12, 0.8, 14), mat, 0, 0.05, 0, g); tail.rotation.x = 0.25;
  const aL = mesh(sph(0.17, 8), mat, -0.58, 0.4, 0.15, g), aR = mesh(sph(0.17, 8), mat, 0.58, 0.4, 0.15, g);
  // big friendly eyes
  S(0.16, bas('#ffffff'), -0.2, 0.68, 0.45, g, 10); S(0.16, bas('#ffffff'), 0.2, 0.68, 0.45, g, 10);
  S(0.085, bas('#1b1440'), -0.2, 0.68, 0.59, g, 8); S(0.085, bas('#1b1440'), 0.2, 0.68, 0.59, g, 8);
  const mouth = mesh(sph(0.1, 8), bas('#3a0a2a'), 0, 0.42, 0.5, g); mouth.scale.set(1.4, 0.7, 0.5);
  g.scale.setScalar(scale || 1); g.userData.mat = mat; g.userData.arms = [aL, aR]; g.userData.head = head; g.userData.mouth = mouth;
  return g;
}
M.enemy = function (kind) {
  const d = SP.EN[kind] || SP.EN.goob; const root = new T.Group(); let g;
  switch (kind) {
    case 'bat': {
      g = new T.Group(); S(0.24, bas('#3a2050'), 0, 0, 0, g, 10); S(0.06, bas('#ff3b6b'), -0.09, 0.05, 0.2, g, 6); S(0.06, bas('#ff3b6b'), 0.09, 0.05, 0.2, g, 6);
      const wm = new T.MeshBasicMaterial({ color: '#5a2a7a', side: T.DoubleSide });
      const wl = new T.Mesh(new T.PlaneGeometry(0.55, 0.3), wm), wr = wl.clone(); wl.position.set(-0.36, 0, 0); wr.position.set(0.36, 0, 0); wl.rotation.x = wr.rotation.x = -Math.PI / 2; g.add(wl); g.add(wr);
      g.userData.wings = [wl, wr]; g.position.y = 1.2; break;
    }
    case 'mummy': case 'skeleton': case 'armor': {
      g = new T.Group(); const bc = kind === 'mummy' ? '#efe3c0' : kind === 'skeleton' ? '#f2f2ea' : '#a9b4c8';
      const legs = []; for (const sx of [-0.18, 0.18]) legs.push(C(kind === 'skeleton' ? 0.07 : 0.16, 0.7, lam(bc), sx, 0, 0, g));
      const torso = kind === 'skeleton' ? C(0.08, 0.7, lam(bc), 0, 0.7, 0, g) : B(0.62, 0.72, 0.38, lam(bc), 0, 0.68, 0, g);
      if (kind === 'skeleton') for (let i = 0; i < 4; i++) B(0.5 - i * 0.05, 0.05, 0.28, lam(bc), 0, 0.82 + i * 0.13, 0, g);
      const arms = []; for (const sx of [-0.42, 0.42]) { const a = C(kind === 'skeleton' ? 0.06 : 0.12, 0.62, lam(bc), sx, 0.75, 0.1, g); a.rotation.x = kind === 'mummy' ? -1.4 : -0.3; arms.push(a); }
      const head = S(kind === 'armor' ? 0.3 : 0.28, lam(bc), 0, 1.68, 0, g, 12);
      if (kind === 'mummy') { for (let i = 0; i < 6; i++) B(0.66, 0.04, 0.4, lam('#c9b88a'), 0, 0.5 + i * 0.16, 0, g).rotation.z = (i % 2 ? 0.15 : -0.15); eyes(g, 1.72, 0.25, 0.06, '#ffd23f', 0.1); }
      if (kind === 'skeleton') { eyes(g, 1.7, 0.22, 0.07, '#1b1440', 0.1); S(0.08, bas('#7fffd4'), 0, 1.68, 0.05, g, 8); }
      if (kind === 'armor') { B(0.2, 0.05, 0.05, bas('#ff3b6b'), 0, 1.7, 0.29, g); C(0.04, 0.3, lam('#ff3b6b'), 0, 1.95, 0, g); const sw = new T.Group(); sw.position.set(0.5, 0.9, 0.3); g.add(sw); B(0.08, 1.2, 0.03, lam('#e6ecff'), 0, 0, 0, sw); B(0.3, 0.06, 0.08, lam('#d4a017'), 0, 0, 0, sw); g.userData.sword = sw; head.userData.helmet = 1; }
      g.userData.legs = legs; g.userData.arms = arms; g.userData.head = head; break;
    }
    case 'witch': {
      g = new T.Group(); const robe = mesh(cyl(0.12, 0.6, 1.2, 12), new T.MeshBasicMaterial({ color: '#6b2fb3', transparent: true, opacity: 0.95 }), 0, 0.6, 0, g);
      S(0.32, bas('#b6ff9a'), 0, 1.45, 0, g, 12); eyes(g, 1.5, 0.27, 0.06, '#1b1440', 0.11);
      C(0.45, 0.05, bas('#2a1450'), 0, 1.66, 0, g); C(0.01, 0.7, bas('#2a1450'), 0, 1.7, 0, g, 0.3).rotation.z = 0.15;
      const staff = new T.Group(); staff.position.set(0.5, 0.4, 0.2); g.add(staff); C(0.04, 1.5, lam('#8b5a2b'), 0, 0, 0, staff); const orb = S(0.13, bas('#ff9cff'), 0, 1.55, 0, staff, 10);
      g.userData.orb = orb; g.userData.mat = robe.material; break;
    }
    case 'swarm': g = ghostBody(d.col, 0.45); break;
    case 'brute': { g = ghostBody(d.col, 1.7); S(0.25, g.userData.mat, -0.62, 0.3, 0.2, g, 10); S(0.25, g.userData.mat, 0.62, 0.3, 0.2, g, 10); B(0.6, 0.06, 0.05, bas('#7a2a00'), 0, 0.82, 0.5, g).rotation.z = 0.3; break; }
    case 'boo': { g = ghostBody('#ffffff', 1); const t = S(0.12, bas('#ff6b9c'), 0, 0.36, 0.52, g, 8); t.scale.set(1, 1.6, 0.6); S(0.08, bas('#ffb3c8'), -0.33, 0.52, 0.42, g, 6); S(0.08, bas('#ffb3c8'), 0.33, 0.52, 0.42, g, 6); break; }
    case 'invis': g = ghostBody(d.col, 1, 0.75); break;
    default: g = ghostBody(d.col, kind === 'polter' ? 1.05 : 1);
  }
  root.add(g); root.userData.g = g;
  if (kind === 'shades') { const sh = new T.Group(); sh.position.set(0, 0.7, 0.5); g.add(sh); B(0.3, 0.16, 0.06, bas('#111'), -0.18, -0.08, 0, sh); B(0.3, 0.16, 0.06, bas('#111'), 0.18, -0.08, 0, sh); B(0.14, 0.04, 0.05, bas('#111'), 0, 0, 0, sh); root.userData.acc = sh; }
  if (kind === 'shieldy') { const sh = mesh(cyl(0.5, 0.5, 0.08, 16), lam('#c0c8d8'), 0, 0.5, 0.75, g); sh.rotation.x = Math.PI / 2; C(0.08, 0.1, lam('#8a94a8'), 0, 0, 0, sh); root.userData.acc = sh; }
  if (kind === 'polter') { const orbs = new T.Group(); orbs.position.y = 0.6; g.add(orbs); for (let i = 0; i < 3; i++) { const b = B(0.28, 0.08, 0.36, lam(['#e84a5f', '#3fa8ff', '#ffd23f'][i]), Math.cos(i * 2.1) * 1, 0, Math.sin(i * 2.1) * 1, orbs); b.rotation.z = 0.3; } root.userData.orbs = orbs; }
  const gl = M.glow(d.col, d.big ? 4.2 : kind === 'swarm' ? 1.3 : kind === 'bat' ? 1.4 : 2.6, kind === 'invis' ? 0.4 : 0.5); gl.position.y = kind === 'bat' ? 1.2 : 0.9; root.add(gl); root.userData.glow = gl;
  const sh = M.disc(d.big ? 1 : 0.5, '#000000', 0.35); sh.position.y = 0.02; root.add(sh);
  return root;
};
M.boss = function (id) {
  const d = SP.BOSS[id]; const root = new T.Group(); let g;
  if (id === 'mumbles') { g = M.enemy('mummy').userData.g; g.scale.setScalar(1.9); const crown = new T.Group(); crown.position.set(0, 1.95, 0); g.add(crown); B(0.7, 0.4, 0.5, lam('#2a5adf'), 0, 0, -0.05, crown); B(0.72, 0.1, 0.52, lam('#e2b84a'), 0, 0.15, -0.05, crown); C(0.08, 0.3, lam('#e2b84a'), 0, 0.4, 0.15, crown); }
  else if (id === 'mandrake') {
    g = new T.Group(); C(1.6, 0.7, lam('#7a4a2a'), 0, 0, 0, g, 1.3); C(1.5, 0.08, lam('#3a2a1a'), 0, 0.7, 0, g);
    for (let i = 0; i < 7; i++) { const l = B(0.5, 0.06, 1.8, lam('#3fbf4f'), Math.cos(i) * 0.7, 0.9, Math.sin(i) * 0.7, g); l.rotation.y = i * 0.9; l.rotation.x = 0.5; }
    const gh = ghostBody(d.col, 1.4); gh.position.y = 1.0; g.add(gh); g.userData.ghost = gh; S(0.35, bas('#ff6bd6'), 0, 2.6, 0, gh, 10);
  } else {
    g = ghostBody(d.col, 1.9);
    if (id === 'waltzy') { mesh(cyl(0.3, 0.9, 0.9, 16), new T.MeshBasicMaterial({ color: '#ff9ce6', transparent: true, opacity: 0.85 }), 0, -0.1, 0, g); C(0.18, 0.12, bas('#ffe14d'), 0, 1.08, 0, g); S(0.09, bas('#3ff0ff'), 0, 1.25, 0.05, g, 8); }
    if (id === 'pagewhirl') { B(0.55, 0.06, 0.06, bas('#111'), 0, 0.72, 0.56, g); C(0.12, 0.04, bas('#222'), -0.2, 0.68, 0.55, g).rotation.x = Math.PI / 2; C(0.12, 0.04, bas('#222'), 0.2, 0.68, 0.55, g).rotation.x = Math.PI / 2; C(0.45, 0.06, bas('#2a1a50'), 0, 1.02, 0, g); B(0.5, 0.12, 0.5, bas('#2a1a50'), 0, 1.05, 0, g); const bo = new T.Group(); bo.position.y = 0.4; g.add(bo); for (let i = 0; i < 5; i++) B(0.3, 0.42, 0.1, lam(['#e84a5f', '#3fa8ff', '#ffd23f', '#4ade80', '#c084fc'][i]), Math.cos(i * 1.256) * 1.2, 0, Math.sin(i * 1.256) * 1.2, bo); g.userData.books = bo; }
    if (id === 'souffle') { const hat = new T.Group(); hat.position.set(0, 1.05, 0); g.add(hat); C(0.35, 0.3, lam('#ffffff'), 0, 0, 0, hat); S(0.45, lam('#ffffff'), 0, 0.45, 0, hat, 12); g.userData.hat = hat; B(0.5, 0.05, 0.05, bas('#5a3a1a'), 0, 0.5, 0.55, g); }
    if (id === 'grumbleton') { const cr = new T.Group(); cr.position.set(0, 1.0, 0); g.add(cr); C(0.42, 0.25, lam('#ffd23f'), 0, 0, 0, cr, 0.38); for (let i = 0; i < 5; i++) { const sp2 = C(0.0, 0.25, lam('#ffd23f'), Math.cos(i * 1.256) * 0.35, 0.25, Math.sin(i * 1.256) * 0.35, cr, 0.08); sp2.scale.y = 1; } B(0.4, 0.08, 0.05, bas('#3a0a2a'), 0, 0.78, 0.55, g).rotation.z = -0.25; B(0.4, 0.08, 0.05, bas('#3a0a2a'), 0, 0.82, 0.53, g).rotation.z = 0.25; }
  }
  root.add(g); root.userData.g = g;
  const gl = M.glow(d.col, 6, 0.45); gl.position.y = 1.6; root.add(gl); root.userData.glow = gl;
  const sh = M.disc(1.3, '#000000', 0.35); sh.position.y = 0.02; root.add(sh);
  return root;
};

/* Candy - spectral miniature schnauzer */
M.candy = function () {
  const g = new T.Group(); const mat = new T.MeshBasicMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.8 }); const dk = new T.MeshBasicMaterial({ color: '#8aa0c0', transparent: true, opacity: 0.85 });
  mesh(box(0.34, 0.3, 0.62), mat, 0, 0.42, 0, g);
  const head = mesh(box(0.3, 0.3, 0.32), mat, 0, 0.66, 0.36, g); mesh(box(0.22, 0.16, 0.2), mat, 0, 0.6, 0.6, g);
  mesh(box(0.24, 0.14, 0.1), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 }), 0, 0.5, 0.62, g); // beard
  mesh(box(0.08, 0.16, 0.08), dk, -0.12, 0.86, 0.32, g); mesh(box(0.08, 0.16, 0.08), dk, 0.12, 0.86, 0.32, g);
  mesh(box(0.07, 0.06, 0.03), bas('#1b1440'), -0.08, 0.72, 0.53, g); mesh(box(0.07, 0.06, 0.03), bas('#1b1440'), 0.08, 0.72, 0.53, g); mesh(box(0.08, 0.06, 0.05), bas('#1b1440'), 0, 0.64, 0.71, g);
  for (const [x, z] of [[-0.12, 0.22], [0.12, 0.22], [-0.12, -0.22], [0.12, -0.22]]) mesh(box(0.08, 0.28, 0.08), dk, x, 0.14, z, g);
  const tail = mesh(box(0.05, 0.2, 0.05), dk, 0, 0.62, -0.32, g); tail.rotation.x = -0.5;
  mesh(box(0.36, 0.05, 0.05), bas('#ff4fd8'), 0, 0.55, 0.22, g); // collar
  const gl = M.glow('#9fe8ff', 1.6, 0.4); gl.position.y = 0.5; g.add(gl);
  g.userData.tail = tail; g.userData.head = head; return g;
};

/* ---------- props ---------- */
const W1 = '#8a5a3a', W2 = '#5e3a22';
M.PROP = {
  chair(g) { B(0.6, 0.08, 0.6, '#8a2a4a', 0, 0.45, 0, g); B(0.6, 0.7, 0.1, '#8a2a4a', 0, 0.5, -0.26, g); for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) B(0.07, 0.45, 0.07, W2, x, 0, z, g); return [0.7, 0.7]; },
  table(g) { B(2.2, 0.1, 1.1, W1, 0, 0.8, 0, g); for (const [x, z] of [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]]) B(0.1, 0.8, 0.1, W2, x, 0, z, g); B(2.25, 0.03, 0.6, '#f0e6d0', 0, 0.9, 0, g); C(0.06, 0.3, '#f5f0d8', -0.5, 0.92, 0, g); C(0.06, 0.3, '#f5f0d8', 0.5, 0.92, 0, g); return [2.3, 1.2]; },
  vase(g) { C(0.22, 0.5, '#3f7fbf', 0, 0, 0, g, 0.3); C(0.12, 0.3, '#3f7fbf', 0, 0.5, 0, g, 0.22); return [0.6, 0.6]; },
  clock(g) { B(0.8, 2.3, 0.5, W2, 0, 0, 0, g); C(0.28, 0.04, '#fef3c7', 0, 1.75, 0.27, g).rotation.x = Math.PI / 2; B(0.18, 0.6, 0.04, '#d4a017', 0, 0.6, 0.26, g); return [0.9, 0.6]; },
  sofa(g) { B(2, 0.5, 0.9, '#4a3a8a', 0, 0, 0, g); B(2, 0.6, 0.25, '#4a3a8a', 0, 0.5, -0.35, g); B(0.25, 0.35, 0.9, '#3a2a7a', -0.9, 0.5, 0, g); B(0.25, 0.35, 0.9, '#3a2a7a', 0.9, 0.5, 0, g); return [2.1, 1]; },
  plant(g) { C(0.3, 0.45, '#b4552a', 0, 0, 0, g, 0.22); S(0.45, '#2f9e44', 0, 0.85, 0, g); S(0.32, '#40c057', 0.2, 1.15, 0.1, g); return [0.7, 0.7]; },
  piano(g) { B(1.8, 1.1, 0.8, '#15131f', 0, 0, 0, g); B(1.7, 0.08, 0.32, '#f8fafc', 0, 0.78, 0.5, g); for (let i = 0; i < 8; i++) B(0.08, 0.05, 0.18, '#111', -0.7 + i * 0.2, 0.84, 0.46, g); return [1.9, 1.1]; },
  bench(g) { B(1.8, 0.12, 0.5, W1, 0, 0.45, 0, g); B(0.1, 0.45, 0.45, '#333', -0.75, 0, 0, g); B(0.1, 0.45, 0.45, '#333', 0.75, 0, 0, g); return [1.9, 0.6]; },
  statue(g) { B(0.8, 0.5, 0.8, '#9a9aa8', 0, 0, 0, g); C(0.25, 1.0, '#c8c8d4', 0, 0.5, 0, g, 0.3); S(0.25, '#c8c8d4', 0, 1.75, 0, g); return [0.9, 0.9]; },
  cabinet(g) { B(1.3, 1.6, 0.55, W2, 0, 0, 0, g); B(0.05, 1.2, 0.02, '#3a2414', 0, 0.2, 0.28, g); S(0.05, '#ffd23f', -0.1, 0.9, 0.29, g); S(0.05, '#ffd23f', 0.1, 0.9, 0.29, g); return [1.4, 0.6]; },
  shelf(g) { B(2.4, 2.4, 0.5, W2, 0, 0, 0, g); const cs = ['#e84a5f', '#3fa8ff', '#4ade80', '#ffd23f', '#c084fc', '#ff9f43']; for (let r = 0; r < 3; r++) for (let i = 0; i < 8; i++) B(0.2, 0.5, 0.34, cs[(i + r * 2) % 6], -0.95 + i * 0.27, 0.22 + r * 0.72, 0.08, g); return [2.5, 0.6]; },
  desk(g) { B(1.8, 0.1, 0.9, W1, 0, 0.78, 0, g); B(0.5, 0.78, 0.8, W2, -0.6, 0, 0, g); B(0.1, 0.78, 0.8, W2, 0.8, 0, 0, g); B(0.5, 0.05, 0.35, '#fff6dc', 0.2, 0.88, 0.05, g); return [1.9, 1]; },
  globe(g) { C(0.3, 0.1, W2, 0, 0, 0, g); C(0.04, 0.7, W2, 0, 0.1, 0, g); S(0.36, '#3f8fdf', 0, 1.1, 0, g); B(0.3, 0.06, 0.3, '#4ade80', 0.1, 1.25, 0.2, g); return [0.8, 0.8]; },
  books(g) { for (let i = 0; i < 4; i++) B(0.6 - i * 0.05, 0.14, 0.45, ['#e84a5f', '#3fa8ff', '#ffd23f', '#4ade80'][i], 0, i * 0.14, 0, g).rotation.y = i * 0.3; return [0.7, 0.6]; },
  lamp(g) { C(0.2, 0.06, '#333', 0, 0, 0, g); C(0.04, 1.4, '#333', 0, 0.06, 0, g); C(0.18, 0.3, '#f4d58d', 0, 1.4, 0, g, 0.3); return [0.5, 0.5]; },
  stove(g) { B(1.4, 0.95, 0.8, '#2a2a2e', 0, 0, 0, g); B(1.4, 0.06, 0.8, '#555', 0, 0.95, 0, g); C(0.2, 0.1, '#888', -0.35, 1.0, 0, g); C(0.2, 0.22, '#666', 0.35, 1.0, 0, g); B(0.9, 0.5, 0.04, '#ff7a3d', 0, 0.2, 0.41, g); return [1.5, 0.9]; },
  fridge(g) { B(1, 2.1, 0.8, '#dfe6ee', 0, 0, 0, g); B(0.04, 0.5, 0.06, '#7a8698', -0.35, 1.3, 0.42, g); B(1, 0.03, 0.82, '#9aa6b8', 0, 1.35, 0, g); return [1.1, 0.9]; },
  counter(g) { B(2.4, 0.95, 0.8, '#e8edf2', 0, 0, 0, g); B(2.5, 0.08, 0.9, '#8a96a8', 0, 0.95, 0, g); C(0.25, 0.25, '#ff6b9c', -0.6, 1.03, 0, g); return [2.5, 0.9]; },
  barrel(g) { C(0.42, 1, '#8a5a2a', 0, 0, 0, g, 0.38); C(0.44, 0.06, '#444', 0, 0.2, 0, g); C(0.44, 0.06, '#444', 0, 0.75, 0, g); return [0.85, 0.85]; },
  crate(g) { B(0.9, 0.9, 0.9, '#b07a3a', 0, 0, 0, g); B(0.92, 0.1, 0.92, '#7a4a1a', 0, 0.4, 0, g); return [0.95, 0.95]; },
  pots(g) { B(1.2, 0.8, 0.6, '#5a6470', 0, 0, 0, g); C(0.22, 0.25, '#b0b8c4', -0.3, 0.8, 0, g); C(0.18, 0.3, '#c87a3a', 0.3, 0.8, 0, g); return [1.3, 0.7]; },
  sacks(g) { S(0.4, '#c8b080', -0.25, 0.35, 0, g); S(0.38, '#d8c090', 0.3, 0.33, 0.05, g); S(0.3, '#b8a070', 0, 0.75, 0, g); return [1.2, 0.8]; },
  pot(g) { C(0.4, 0.5, '#c0602a', 0, 0, 0, g, 0.3); S(0.5, '#2f9e44', 0, 0.8, 0, g); for (let i = 0; i < 3; i++) S(0.1, ['#ff6b9c', '#ffd23f', '#c084fc'][i], Math.cos(i * 2) * 0.35, 1.1, Math.sin(i * 2) * 0.35, g); return [0.9, 0.9]; },
  cactus(g) { C(0.3, 0.3, '#c0602a', 0, 0, 0, g, 0.25); C(0.18, 1.2, '#3fa04f', 0, 0.3, 0, g); C(0.1, 0.4, '#3fa04f', 0.25, 0.8, 0, g); return [0.7, 0.7]; },
  fern(g) { for (let i = 0; i < 6; i++) { const l = B(0.25, 0.04, 1, '#2fae4f', Math.cos(i) * 0.3, 0.3, Math.sin(i) * 0.3, g); l.rotation.y = i; l.rotation.x = -0.5; } C(0.3, 0.3, '#7a4a2a', 0, 0, 0, g); return [0.9, 0.9]; },
  sarco(g) { B(0.9, 0.6, 2, '#c9a23a', 0, 0, 0, g); B(0.8, 0.2, 1.9, '#2a5adf', 0, 0.6, 0, g); S(0.3, '#e2b84a', 0, 0.85, 0.6, g); return [1, 2.1]; },
  urn(g) { C(0.3, 0.6, '#b8703a', 0, 0, 0, g, 0.2); C(0.15, 0.2, '#b8703a', 0, 0.6, 0, g, 0.25); B(0.6, 0.06, 0.06, '#2a2a2a', 0, 0.35, 0.28, g); return [0.7, 0.7]; },
  pillar(g) { C(0.4, 2.6, '#cfc6a8', 0, 0, 0, g); B(1, 0.2, 1, '#bdb498', 0, 0, 0, g); B(1, 0.2, 1, '#bdb498', 0, 2.5, 0, g); return [1, 1]; },
  case(g) { B(1.2, 0.8, 0.8, W2, 0, 0, 0, g); const gl = mesh(box(1.1, 0.7, 0.7), new T.MeshLambertMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.35 }), 0, 1.15, 0, g); S(0.18, '#ffd23f', 0, 1.05, 0, g); return [1.3, 0.9]; },
  coffin(g) { B(0.8, 0.5, 1.9, '#4a2a1a', 0, 0, 0, g); B(0.1, 0.02, 0.5, '#d4a017', 0, 0.5, 0, g); B(0.4, 0.02, 0.1, '#d4a017', 0, 0.5, 0.05, g); return [0.9, 2]; },
  gear(g) { const w = C(0.9, 0.25, '#8a8aa8', 0, 0, 0, g); for (let i = 0; i < 8; i++) B(0.3, 0.25, 0.3, '#8a8aa8', Math.cos(i * 0.785) * 0.95, 0, Math.sin(i * 0.785) * 0.95, g).rotation.y = i * 0.785; C(0.2, 0.3, '#d4a017', 0, 0, 0, g); return [2, 2]; },
  trunk(g) { B(1.2, 0.7, 0.7, '#6a3a1a', 0, 0, 0, g); B(1.22, 0.08, 0.72, '#d4a017', 0, 0.5, 0, g); B(0.15, 0.2, 0.05, '#d4a017', 0, 0.45, 0.36, g); return [1.3, 0.8]; },
  mirror(g) { B(1, 2, 0.12, '#d4a017', 0, 0, 0, g); B(0.85, 1.8, 0.14, '#a8d8ff', 0, 0.1, 0, g); return [1.1, 0.4]; }
};
M.prop = function (k) { const g = new T.Group(); const f = M.PROP[k] || M.PROP.crate; const sz = f(g); g.userData.size = sz; return g; };
})();
