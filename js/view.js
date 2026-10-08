/* Grok Spooks - three.js view: room build, entity sync, lights, fx, camera, tags */
(function () {
'use strict';
const SP = window.SP, T = window.THREE, M = SP.M, TAU = Math.PI * 2;
const V = SP.V = {};
let R, scene, cam, roomG, entG, fxG, hemi, moon, chand = [], spots = [], cones = [], W = null;
const ents = {}, picks = {}, projs = {}, teles = {}, bodies = {};
let props = [], doorsM = [], puzM = {}, beamG = null, beamKey = '', chestM = null, elevM = null, elevBossM = null, candyM = null, parts = [];
const camS = { x: 0, z: 0, shake: 0 };
V.init = function (canvas) {
  R = V.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  scene = new T.Scene(); scene.background = new T.Color('#140c26');
  cam = V.cam = new T.PerspectiveCamera(48, 1, 0.5, 120);
  hemi = new T.HemisphereLight('#9a8fe0', '#2a1840', 0.6); scene.add(hemi);
  moon = new T.DirectionalLight('#a8b8ff', 0.35); moon.position.set(-6, 12, 8); scene.add(moon);
  for (let i = 0; i < 2; i++) { const p = new T.PointLight('#ffd9a0', 0, 22, 1.4); p.position.set(0, 3.6, 0); scene.add(p); chand.push(p); }
  for (let i = 0; i < 4; i++) {
    const s = new T.SpotLight('#fff6d8', 0, 15, 0.55, 0.55, 1.2); s.position.set(0, 1.4, 0); scene.add(s); scene.add(s.target); spots.push(s);
    const cg = new T.ConeGeometry(1, 1, 24, 1, true); cg.translate(0, -0.5, 0); cg.rotateX(-Math.PI / 2);
    const cm = new T.Mesh(cg, new T.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.1, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    cm.visible = false; scene.add(cm); cones.push(cm);
  }
  roomG = new T.Group(); scene.add(roomG); entG = new T.Group(); scene.add(entG); fxG = new T.Group(); scene.add(fxG);
  V.resize();
};
V.resize = function () { const w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); c.traverse && c.traverse((o) => { if (o.geometry && !o.geometry.parameters) o.geometry.dispose(); }); } }

/* ---------------- textures ---------------- */
const texC = {};
function patTex(kind, a, b) {
  const k = kind + a + b; if (texC[k]) return texC[k];
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 128, 128); g.fillStyle = b; g.strokeStyle = b;
  if (kind === 'carpet') { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.beginPath(); g.moveTo(32 + i * 64, 6 + j * 64); g.lineTo(58 + i * 64, 32 + j * 64); g.lineTo(32 + i * 64, 58 + j * 64); g.lineTo(6 + i * 64, 32 + j * 64); g.fill(); } }
  else if (kind === 'wood') { for (let i = 0; i < 8; i++) { g.fillRect(0, i * 16, 128, 1.5); g.fillRect(((i * 37) % 128), i * 16, 1.5, 16); } }
  else if (kind === 'tile') { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) g.fillRect(i * 32, j * 32, 32, 32); }
  else if (kind === 'grass') { for (let i = 0; i < 300; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 5); }
  else if (kind === 'stone') { g.lineWidth = 2; for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) g.strokeRect(i * 48 + (j % 2) * 24 - 24, j * 32, 48, 32); }
  else if (kind === 'stripe') { for (let i = 0; i < 8; i++) g.fillRect(i * 16, 0, 6, 128); }
  else if (kind === 'brick') { g.lineWidth = 2; for (let j = 0; j < 8; j++) for (let i = 0; i < 3; i++) g.strokeRect(i * 48 + (j % 2) * 24 - 24, j * 16, 48, 16); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; texC[k] = t; return t;
}
const FLOORK = ['carpet', 'wood', 'tile', 'grass', 'stone', 'wood'], WALLK = ['stripe', 'stripe', 'brick', 'brick', 'stone', 'stripe'];

/* ---------------- room ---------------- */
V.buildRoom = function (w) {
  W = w; const L = W.L, pal = L.pal, hw = L.hw, hd = L.hd, a = L.area;
  clearGroup(roomG); clearGroup(entG); clearGroup(fxG);
  for (const k in ents) delete ents[k]; for (const k in picks) delete picks[k]; for (const k in projs) delete projs[k]; for (const k in teles) delete teles[k]; for (const k in bodies) delete bodies[k];
  parts = []; beamKey = ''; candyM = null;
  scene.background = new T.Color(pal.fog); scene.fog = new T.Fog(pal.fog, 22, 48);
  // floor
  const ft = patTex(FLOORK[a], pal.floor, pal.floor2).clone(); ft.needsUpdate = true; ft.repeat.set(L.w / 2.5, L.d / 2.5);
  const floor = new T.Mesh(new T.PlaneGeometry(L.w + 0.2, L.d + 0.2, 1, 1), new T.MeshPhongMaterial({ map: ft, shininess: 8 }));
  floor.rotation.x = -Math.PI / 2; roomG.add(floor);
  const outer = new T.Mesh(new T.PlaneGeometry(L.w + 30, L.d + 30), new T.MeshBasicMaterial({ color: pal.fog })); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; roomG.add(outer);
  // walls with gaps
  const wt = patTex(WALLK[a], pal.wall, shade(pal.wall, 14)).clone(); wt.needsUpdate = true;
  const wallM = new T.MeshPhongMaterial({ map: wt, shininess: 4 }); const trimM = M.lam(pal.trim);
  const H = 3.6;
  const sideGaps = { N: [], S: [], E: [], W: [] };
  L.doors.forEach((d) => sideGaps[d.side].push(d.side === 'N' || d.side === 'S' ? d.x : d.z));
  if (L.elev) sideGaps.N.push(L.elev.x);
  const wall = (side) => {
    const horiz = side === 'N' || side === 'S', len = horiz ? L.w : L.d, h = side === 'S' ? 0.55 : H;
    const gaps = sideGaps[side].slice().sort((p, q) => p - q); let s = -len / 2;
    const seg = (a0, a1) => { if (a1 - a0 < 0.05) return; const m = new T.Mesh(M.box(horiz ? a1 - a0 : 0.3, h, horiz ? 0.3 : a1 - a0), wallM); const c = (a0 + a1) / 2;
      if (side === 'N') m.position.set(c, h / 2, -hd - 0.15); else if (side === 'S') m.position.set(c, h / 2, hd + 0.15); else if (side === 'E') m.position.set(hw + 0.15, h / 2, c); else m.position.set(-hw - 0.15, h / 2, c);
      const tm = wt.clone(); tm.needsUpdate = true; tm.repeat.set((a1 - a0) / 2, h / 2); m.material = new T.MeshPhongMaterial({ map: tm, shininess: 4 }); roomG.add(m);
      const tr = new T.Mesh(M.box(horiz ? a1 - a0 : 0.36, 0.14, horiz ? 0.36 : a1 - a0), trimM); tr.position.copy(m.position); tr.position.y = h; roomG.add(tr); };
    gaps.forEach((g) => { seg(s, g - SP.DOOR_W / 2); s = g + SP.DOOR_W / 2; }); seg(s, len / 2);
    if (side !== 'S') gaps.forEach((g) => { const m = new T.Mesh(M.box(horiz ? SP.DOOR_W : 0.3, H - 2.6, horiz ? 0.3 : SP.DOOR_W), wallM); const y = 2.6 + (H - 2.6) / 2; if (side === 'N') m.position.set(g, y, -hd - 0.15); else if (side === 'E') m.position.set(hw + 0.15, y, g); else m.position.set(-hw - 0.15, y, g); roomG.add(m); });
  };
  ['N', 'S', 'E', 'W'].forEach(wall);
  // baseboard glow lines (readability)
  [[0, -hd + 0.02, L.w, 0.05], [-hw + 0.02, 0, 0.05, L.d], [hw - 0.02, 0, 0.05, L.d]].forEach(([x, z, w2, d2]) => { const m = new T.Mesh(M.box(w2, 0.12, d2), M.bas(shade(pal.trim, -20))); m.position.set(x, 0.06, z); roomG.add(m); });
  // doors
  doorsM = L.doors.map((d, i) => {
    const g = new T.Group(); const rot = d.side === 'N' ? 0 : d.side === 'S' ? Math.PI : d.side === 'E' ? -Math.PI / 2 : Math.PI / 2;
    g.position.set(d.x, 0, d.z); g.rotation.y = rot; roomG.add(g);
    const fr = M.lam(pal.trim); M.B(0.22, 2.75, 0.4, fr, -SP.DOOR_W / 2, 0, 0, g); M.B(0.22, 2.75, 0.4, fr, SP.DOOR_W / 2, 0, 0, g); M.B(SP.DOOR_W + 0.44, 0.22, 0.4, fr, 0, 2.6, 0, g);
    const panel = M.B(SP.DOOR_W - 0.1, 2.55, 0.12, '#6b3a1e', 0, 0, -0.05, g);
    const secret = M.B(SP.DOOR_W + 0.5, d.side === 'S' ? 0.55 : 3.6, 0.34, wallM, 0, 0, -0.02, g);
    const glow = M.glow('#ffd23f', 2.4, 0.0); glow.position.set(0, 1.4, 0.4); g.add(glow);
    const icon = M.text('', '#fff'); icon.position.set(0, 3.2, 0.3); g.add(icon); icon.visible = false;
    const sign = M.text(SP.room(d.to).n, '#ffe9a8', 'rgba(20,10,40,.75)', 512); sign.scale.set(2.6, 0.32, 1); sign.position.set(0, 3.0, 0.3); g.add(sign);
    if (d.side === 'S') { sign.position.set(0, 0.9, 0.6); }
    return { g, panel, secret, glow, icon, sign, last: '' };
  });
  // props
  props = L.props.map((p) => {
    let g;
    if (p.t === 'furn') { g = M.prop(p.k); g.rotation.y = (p.rot || 0) * Math.PI / 2; }
    else if (p.t === 'rug') { g = new T.Group(); M.B(p.w, 0.03, p.d, ['#7a2a4a', '#5a2a1a', '#3a5a6a', '#3a6a2a', '#7a5a2a', '#4a2a6a'][a], 0, 0.005, 0, g); M.B(p.w - 0.5, 0.035, p.d - 0.5, pal.trim, 0, 0.006, 0, g); M.B(p.w - 0.9, 0.04, p.d - 0.9, ['#9a3a5a', '#7a4a2a', '#4a7a8a', '#4a8a3a', '#9a7a3a', '#6a3a8a'][a], 0, 0.007, 0, g); }
    else if (p.t === 'web') { g = new T.Group(); const wm = new T.MeshBasicMaterial({ color: '#e8e8ff', transparent: true, opacity: 0.5, side: T.DoubleSide, wireframe: true }); const sx = Math.sign(p.x), sz = Math.sign(p.z); const tri = new T.Mesh(new T.CircleGeometry(1.3, 6, 0, Math.PI / 2), wm); tri.position.set(sx * 0.55, 1.2, sz * 0.55); tri.rotation.y = sz > 0 ? (sx > 0 ? Math.PI : -Math.PI / 2) : (sx > 0 ? Math.PI / 2 : 0); tri.rotation.y = Math.atan2(-sx, -sz) + Math.PI / 4 * 0; tri.lookAt(new T.Vector3(p.x - sx * 3, 1.2, p.z - sz * 3)); g.add(tri); const wl = new T.Mesh(new T.CircleGeometry(0.9, 8), new T.MeshBasicMaterial({ color: '#d8d8f0', transparent: true, opacity: 0.25, wireframe: true })); wl.rotation.x = -Math.PI / 2; wl.position.y = 0.03; g.add(wl); }
    else if (p.t === 'curtain') { g = new T.Group(); const cc = ['#a3213f', '#2f6b3a', '#2a5a8a', '#6a2a8a', '#a36a1f', '#5a2a8a'][a]; for (let i = 0; i < 5; i++) M.B(0.36, 2.9, 0.18, cc, -0.72 + i * 0.36, 0.1, (i % 2) * 0.08, g); M.B(2, 0.2, 0.3, pal.trim, 0, 3.0, 0, g); M.B(1.4, 1.6, 0.05, '#1a2a50', 0, 1.2, -0.1, g); }
    g.position.set(p.x, 0, p.z); roomG.add(g);
    return { g, p, base: g.position.clone() };
  });
  // puzzle
  puzM = {}; if (beamG) { beamG = null; }
  const P = L.puz;
  if (P) {
    if (P.plates) puzM.plates = P.plates.map((pl) => { const m = new T.Mesh(M.cyl(0.95, 0.95, 0.1, 24), new T.MeshBasicMaterial({ color: '#3ff0ff' })); m.position.set(pl.x, 0.05, pl.z); roomG.add(m); const r = M.ring(1.15, '#3ff0ff', 0.7); r.position.set(pl.x, 0.08, pl.z); roomG.add(r); const ic = M.text('\uD83D\uDC63', '#fff'); ic.position.set(pl.x, 0.9, pl.z); ic.scale.set(1.6, 0.4, 1); roomG.add(ic); return { m, r }; });
    if (P.levers) puzM.levers = P.levers.map((l) => { const g = new T.Group(); g.position.set(l.x, 0, l.z); g.rotation.y = l.nx > 0 ? Math.PI / 2 : -Math.PI / 2; roomG.add(g); M.B(0.8, 1.4, 0.3, '#5a5a6a', 0, 0.4, -0.1, g); const h = new T.Group(); h.position.set(0, 1.1, 0.1); g.add(h); M.C(0.06, 0.8, '#c8c8d8', 0, 0, 0, h); M.S(0.16, M.bas('#ff4d6d'), 0, 0.85, 0, h); const gl = M.glow('#ff4d6d', 1.4, 0.5); gl.position.set(0, 1.9, 0.2); g.add(gl); return { g, h, gl }; });
    if (P.fans) puzM.fans = P.fans.map((f) => { const g = new T.Group(); g.position.set(f.x, 0, f.z); roomG.add(g); M.C(0.08, 1.6, '#8a6a4a', 0, 0, 0, g); const wh = new T.Group(); wh.position.set(0, 1.7, 0.1); g.add(wh); for (let i = 0; i < 4; i++) { const b = M.B(0.5, 0.12, 0.05, ['#ff4d6d', '#ffe14d', '#4ade80', '#3fa8ff'][i], 0.3, -0.06, 0, wh); b.parent.remove(b); const pv = new T.Group(); pv.rotation.z = i * Math.PI / 2; pv.add(b); wh.add(pv); } const ring = M.ring(1, '#ffe14d', 0.9); ring.position.set(0, 0.05, 0); g.add(ring); return { g, wh, ring }; });
    if (P.type === 'crate') { const c = M.prop('crate'); c.scale.setScalar(1.05); roomG.add(c); puzM.crate = c; const pl = new T.Mesh(M.cyl(0.8, 0.8, 0.08, 4), new T.MeshBasicMaterial({ color: '#ffe14d' })); pl.rotation.y = Math.PI / 4; pl.position.set(P.plate.x, 0.04, P.plate.z); roomG.add(pl); puzM.plate = pl; const ar = M.text('\u2B07 CRATE HERE', '#ffe14d', null, 512); ar.scale.set(2.4, 0.3, 1); ar.position.set(P.plate.x, 1.1, P.plate.z); roomG.add(ar); }
    if (P.candles) { puzM.candles = P.candles.map((c, i) => { const g = new T.Group(); g.position.set(c.x, 0, c.z); roomG.add(g); M.C(0.3, 0.5, '#3a3a4a', 0, 0, 0, g, 0.35); const col = SP.PAINT_COLS[P.cols[i]][0]; M.C(0.14, 0.7, M.bas(col), 0, 0.5, 0, g); const fl = M.glow('#ffb84d', 1.2, 0.95); fl.position.set(0, 1.35, 0); g.add(fl); const ring = M.ring(0.55, col, 0.8); ring.position.y = 0.04; g.add(ring); return { g, fl }; });
      const pg = new T.Group(); pg.position.set(P.painting.x, 0, P.painting.z + 0.05); roomG.add(pg); M.B(3, 2, 0.12, pal.trim, 0, 1.2, 0, pg); const canv = document.createElement('canvas'); canv.width = 256; canv.height = 160; const pm = new T.Mesh(new T.PlaneGeometry(2.7, 1.7), new T.MeshBasicMaterial({ map: new T.CanvasTexture(canv) })); pm.position.set(0, 2.2, 0.08); pg.add(pm); puzM.paint = { canv, pm, key: '' }; }
    if (P.sw) { const g = new T.Group(); g.position.set(P.sw.x, 1.3, P.sw.z); g.rotation.y = P.sw.wall === 'W' ? Math.PI / 2 : P.sw.wall === 'E' ? -Math.PI / 2 : 0; roomG.add(g); const m = new T.Mesh(M.box(0.6, 0.6, 0.12), new T.MeshBasicMaterial({ color: '#ff6bff', transparent: true, opacity: 0 })); g.add(m); const gl = M.glow('#ff6bff', 1.8, 0); g.add(gl); const sp = M.glow('#c9a0ff', 0.6, 0.2); g.add(sp); puzM.sw = { m, gl, sp }; }
    if (P.em) {
      const em = new T.Group(); em.position.set(P.em.x, 0, P.em.z); roomG.add(em); M.B(0.7, 1.2, 0.7, '#5a5a6a', 0, 0, 0, em); M.S(0.25, M.bas('#fff36b'), 0.3, 1.0, 0, em); const eg = M.glow('#fff36b', 1.6, 0.8); eg.position.set(0.3, 1, 0); em.add(eg);
      puzM.mir = P.mir.map((m) => { const g = new T.Group(); g.position.set(m.x, 0, m.z); roomG.add(g); M.C(0.3, 0.3, '#5a5a6a', 0, 0, 0, g); const pv = new T.Group(); pv.position.y = 1; g.add(pv); M.B(1.1, 1.2, 0.08, M.lam('#d4a017'), 0, -0.6, -0.06, pv); M.B(1.0, 1.1, 0.06, M.bas('#bfe9ff'), 0, -0.55, 0, pv); return { g, pv }; });
      const tg = new T.Group(); tg.position.set(P.tg.x, 0, P.tg.z); roomG.add(tg); M.C(0.35, 0.6, '#5a5a6a', 0, 0, 0, tg); const cr = new T.Mesh(new T.OctahedronGeometry(0.42), new T.MeshBasicMaterial({ color: '#8a6bff' })); cr.position.y = 1.15; tg.add(cr); const tgl = M.glow('#8a6bff', 2, 0.5); tgl.position.y = 1.15; tg.add(tgl); puzM.tg = { cr, tgl };
      beamG = new T.Group(); roomG.add(beamG);
    }
    if (L.chest) { const g = new T.Group(); g.position.set(L.chest.x, 0, L.chest.z); roomG.add(g); M.B(1.1, 0.6, 0.7, '#8a4a1a', 0, 0, 0, g); M.B(1.14, 0.08, 0.74, '#ffd23f', 0, 0.3, 0, g); const lid = new T.Group(); lid.position.set(0, 0.6, -0.35); g.add(lid); M.B(1.1, 0.3, 0.7, '#9a5a2a', 0, 0, 0.35, lid); M.B(0.16, 0.2, 0.06, '#ffd23f', 0, -0.05, 0.72, lid); const gl = M.glow('#ffd23f', 2.2, 0); gl.position.y = 0.9; g.add(gl); chestM = { g, lid, gl }; }
  } else chestM = null;
  if (L.puz && !L.chest) chestM = null;
  if (!L.puz) chestM = null;
  // elevator
  elevM = null; elevBossM = null;
  if (L.elev) elevM = mkElev(L.elev.x, -hd, 0);
  if (L.def.boss) { elevBossM = mkElev(0, -hd, 0); elevBossM.g.visible = false; }
  // chandeliers
  chand.forEach((c, i) => { c.position.set((i ? 1 : -1) * L.w / 4, 3.5, -0.5); c.color.set(pal.lit); });
  for (let i = 0; i < 2; i++) { const g = new T.Group(); g.position.set((i ? 1 : -1) * L.w / 4, 3.5, -0.5); roomG.add(g); M.C(0.02, 0.8, '#333', 0, 0.2, 0, g); M.C(0.5, 0.1, pal.trim, 0, 0.2, 0, g, 0.3); for (let k = 0; k < 5; k++) M.S(0.07, M.bas('#fff6c0'), Math.cos(k * 1.256) * 0.45, 0.35, Math.sin(k * 1.256) * 0.45, g, 6); const gl = M.glow(pal.lit, 2.5, 0); gl.position.y = 0.3; g.add(gl); g.userData.gl = gl; chand[i].userData.g = g; }
  // candy
  candyM = M.candy(); candyM.position.set(0, 0, 0); scene.add(candyM); roomG.add(candyM);
  V.room = L;
};
function mkElev(x, z) {
  const g = new T.Group(); g.position.set(x, 0, z); roomG.add(g);
  M.B(2.4, 2.6, 0.2, '#c9a23a', 0, 0, 0.05, g); M.B(1.05, 2.4, 0.1, '#e6c35a', -0.55, 0, 0.18, g); M.B(1.05, 2.4, 0.1, '#e6c35a', 0.55, 0, 0.18, g);
  const s = M.text('\u25B2 ELEVATOR \u25BC', '#ffe14d', 'rgba(20,10,40,.85)', 512); s.scale.set(2.6, 0.33, 1); s.position.set(0, 3.0, 0.4); g.add(s);
  const pad = M.ring(1, '#ffe14d', 0.9); pad.position.set(0, 0.06, 1.3); g.add(pad); const pd2 = M.disc(0.9, '#ffe14d', 0.25); pd2.position.set(0, 0.05, 1.3); g.add(pd2);
  const gl = M.glow('#ffe14d', 3, 0.5); gl.position.set(0, 1.4, 0.6); g.add(gl);
  return { g, pad };
}
function shade(hex, amt) { const c = new T.Color(hex); c.offsetHSL(0, 0, amt / 100); return '#' + c.getHexString(); }

/* ---------------- per-frame sync ---------------- */
const tmpV = new T.Vector3();
V.update = function (dt, time, ctx) {
  if (!W || !W.L) return;
  const L = W.L, lit = W.lit || 0, assist = ctx.assist;
  hemi.intensity = 0.62 + lit * 0.55; moon.intensity = 0.32 + lit * 0.35; hemi.color.set(lit > 0.5 ? '#fff0d8' : '#9a8fe0');
  chand.forEach((c) => { c.intensity = lit * 1.1; if (c.userData.g) c.userData.g.userData.gl.material.opacity = lit * 0.8; });
  // doors
  doorsM.forEach((dm, i) => {
    const d = L.doors[i]; const lock = SP.Sim.doorLock(i); const hidden = d.dark && !W.doorRev[i];
    dm.secret.visible = hidden; dm.panel.visible = !hidden && !!lock; dm.sign.visible = !hidden;
    const k = (hidden ? 'h' : lock || 'o'); if (dm.last !== k) { dm.last = k; dm.g.remove(dm.icon); dm.icon = M.text(lock === 'key' ? '\uD83D\uDD12' : lock === 'ghost' ? '\uD83D\uDC7B' : lock === 'tut' ? '\u2728' : '', '#fff'); dm.icon.scale.set(2, 0.5, 1); dm.icon.position.set(0, d.side === 'S' ? 1.6 : 3.45, 0.3); dm.g.add(dm.icon); dm.icon.visible = !hidden && !!lock && lock !== 'dark'; dm.panel.material = M.lam(lock === 'ghost' ? '#5a2a8a' : lock === 'key' ? '#8a6a1a' : '#6b3a1e'); }
    dm.glow.material.opacity = !hidden && !lock ? 0.35 + Math.sin(time * 3) * 0.1 : (hidden ? 0 : 0.15);
    if (hidden && d.rp) dm.secret.material = M.lam('#8a6aff');
  });
  // props
  props.forEach((pm, i) => {
    const s = W.pr[i] || {}; const p = pm.p;
    if (s.g) { if (pm.g.visible) { pm.g.visible = false; } return; }
    pm.g.visible = true;
    const sh = s.v > 0 && !s.e ? s.v : 0;
    pm.g.position.x = pm.base.x + (sh ? Math.sin(time * 50) * 0.06 * sh : 0); pm.g.position.z = pm.base.z + (sh ? Math.cos(time * 43) * 0.05 * sh : 0);
    if (p.t === 'curtain' || p.t === 'web' || p.t === 'rug') pm.g.scale.set(1 - sh * 0.15, 1 - sh * 0.2, 1);
    // hiding ghost wiggle
    if (W.ents.some((e) => e.hid === i && e.st === 'hide') && Math.sin(time * 2 + i) > 0.92) pm.g.rotation.z = Math.sin(time * 40) * 0.05; else pm.g.rotation.z = 0;
  });
  // puzzle
  const P = L.puz, Z = W.puz;
  if (P && Z) {
    if (puzM.plates) puzM.plates.forEach((pm, i) => { const on = Z.solved || (Z.occ && Z.occ[i]); pm.m.material.color.set(on ? '#4ade80' : '#3ff0ff'); pm.r.material.color.set(on ? '#4ade80' : '#3ff0ff'); pm.r.scale.setScalar(1 + Math.sin(time * 3) * 0.05); });
    if (puzM.levers) puzM.levers.forEach((lm, i) => { const down = Z.solved || (Z.lv && Z.lv[i] > 0); lm.h.rotation.x += ((down ? 1.9 : 0.2) - lm.h.rotation.x) * Math.min(1, dt * 10); lm.gl.material.color.set(down ? '#4ade80' : '#ff4d6d'); });
    if (puzM.fans) puzM.fans.forEach((fm, i) => { const v = Z.solved ? 1 : (Z.fan ? Z.fan[i] : 0); fm.wh.rotation.z += dt * (1 + v * 18); fm.ring.scale.setScalar(0.3 + v * 0.9); fm.ring.material.color.set(v >= 0.75 || Z.solved ? '#4ade80' : '#ffe14d'); });
    if (puzM.crate) { puzM.crate.position.set(Z.cx, 0, Z.cz); puzM.plate.material.color.set(Z.solved ? '#4ade80' : '#ffe14d'); }
    if (puzM.candles) { puzM.candles.forEach((cm, i) => { const on = Z.solved || (Z.lit && Z.lit.indexOf(i) >= 0); cm.fl.visible = on; cm.fl.scale.setScalar(1.1 + Math.sin(time * 9 + i) * 0.15); });
      const key = (Z.seq || []).join(','); if (puzM.paint.key !== key) { puzM.paint.key = key; drawPainting(puzM.paint.canv, Z.seq || []); puzM.paint.pm.material.map.needsUpdate = true; } }
    if (puzM.sw) { const r = Z.solved ? 1 : Z.rev || 0; puzM.sw.m.material.opacity = r * 0.95; puzM.sw.gl.material.opacity = r * 0.7; puzM.sw.m.material.color.set(Z.solved ? '#4ade80' : '#ff6bff'); puzM.sw.sp.material.opacity = (assist ? 0.35 : 0.12) + Math.sin(time * 4) * 0.08; puzM.sw.sp.visible = r < 1; }
    if (puzM.mir) {
      puzM.mir.forEach((mm, i) => { const o = Z.o ? Z.o[i] : '/'; const ta = o === '/' ? Math.PI / 4 : -Math.PI / 4; mm.pv.rotation.y += (ta - mm.pv.rotation.y) * Math.min(1, dt * 12); });
      const key = (Z.o || []).join('') + Z.solved; if (key !== beamKey) { beamKey = key; buildBeam(P, Z); }
      puzM.tg.cr.rotation.y += dt * 2; puzM.tg.cr.material.color.set(Z.solved || Z.hit ? '#4ade80' : '#8a6bff'); puzM.tg.tgl.material.color.set(Z.solved ? '#4ade80' : '#8a6bff');
    }
  }
  if (chestM) { const op = W.chest ? 1 : 0; chestM.lid.rotation.x += ((op ? -1.6 : 0) - chestM.lid.rotation.x) * Math.min(1, dt * 6); chestM.gl.material.opacity = op ? 0.4 : 0; }
  if (elevBossM) elevBossM.g.visible = !!W.elevBoss;
  [elevM, elevBossM].forEach((e) => { if (e) e.pad.material.opacity = 0.6 + Math.sin(time * 4) * 0.3; });
  syncEnts(dt, time, ctx); syncPicks(dt, time); syncProj(dt, time); syncTele(time); syncBodies(dt, time, ctx); stepParts(dt);
  // candy follows the local player
  if (candyM && ctx.me) { const me = ctx.me; const tx = me.x - Math.sin(me.ang) * 1.3 + Math.cos(me.ang) * 0.9, tz = me.z - Math.cos(me.ang) * 1.3 - Math.sin(me.ang) * 0.9; candyM.position.x += (tx - candyM.position.x) * Math.min(1, dt * 3); candyM.position.z += (tz - candyM.position.z) * Math.min(1, dt * 3); candyM.position.y = 0.25 + Math.sin(time * 3) * 0.1; candyM.rotation.y = Math.atan2(me.x - candyM.position.x, me.z - candyM.position.z); candyM.userData.tail.rotation.z = Math.sin(time * (ctx.candyAlert ? 25 : 8)) * 0.6; candyM.userData.head.rotation.x = ctx.candyAlert ? Math.sin(time * 14) * 0.15 : 0; }
  // camera
  const f = ctx.focus || { x: 0, z: 0 }; const portrait = cam.aspect < 1;
  const H = portrait ? 17 + (1 - cam.aspect) * 6 : 13.5, D = portrait ? 9 : 8.6;
  const mx = Math.max(0, L.hw - (portrait ? 3.5 : 8)), mz = Math.max(0, L.hd - 5);
  let fx = f.x, fz = f.z;
  if (W && W.ents && W.ents.length) { let best = null, bd = 1e9; for (const e of W.ents) { if (e.st === 'hide' || e.k === 'invis') continue; const d = Math.hypot(e.x - f.x, e.z - f.z) - (e.k === 'boss' ? 6 : 0); if (d < bd) { bd = d; best = e; } } if (best) { const k = best.k === 'boss' ? 0.4 : 0.25, d = Math.hypot(best.x - f.x, best.z - f.z); if (d < 14) { fx += (best.x - f.x) * k; fz += (best.z - f.z) * k; } } }
  const tx = Math.max(-mx, Math.min(mx, fx)), tz = Math.max(-mz, Math.min(mz, fz));
  camS.x += (tx - camS.x) * Math.min(1, dt * 4); camS.z += (tz - camS.z) * Math.min(1, dt * 4);
  camS.shake = Math.max(0, camS.shake - dt * 2); const sk = camS.shake * 0.35;
  cam.position.set(camS.x + (Math.random() - 0.5) * sk, H, camS.z + D + (Math.random() - 0.5) * sk); cam.lookAt(camS.x, 0, camS.z + 0.6);
  R.render(scene, cam);
  updateTags(ctx);
};
V.snapCam = function (x, z) { camS.x = x; camS.z = z; };
V.shake = function (a) { camS.shake = Math.max(camS.shake, a); };
function drawPainting(c, seq) {
  const g = c.getContext('2d'); g.fillStyle = '#2a1d46'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#3a2a5e'; g.fillRect(8, 8, 240, 144);
  g.font = 'bold 22px Trebuchet MS'; g.textAlign = 'center'; g.fillStyle = '#ffe9a8'; g.fillText('LIGHT IN THIS ORDER', 128, 34);
  seq.forEach((ci, i) => { const x = 52 + i * 76; g.fillStyle = SP.PAINT_COLS[ci][0]; g.fillRect(x - 12, 70, 24, 52); g.fillStyle = '#ffb84d'; g.beginPath(); g.ellipse(x, 60, 8, 13, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 24px Trebuchet MS'; g.fillText(String(i + 1), x, 146); if (i < 2) { g.fillStyle = '#ffe9a8'; g.fillText('\u279C', x + 38, 100); } });
}
function buildBeam(P, Z) {
  clearGroup(beamG);
  const tr = SP.beamTrace({ em: { x: P.em.x + 0.3, z: P.em.z }, tg: P.tg, mir: P.mir.map((m, i) => ({ x: m.x, z: m.z, o: Z.o[i] })) }, W.L.hw, W.L.hd);
  if (Z.solved) tr.hit = true;
  const mat = new T.MeshBasicMaterial({ color: tr.hit ? '#7dff9a' : '#fff36b', transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < tr.pts.length - 1; i++) { const [x1, z1] = tr.pts[i], [x2, z2] = tr.pts[i + 1]; const len = Math.hypot(x2 - x1, z2 - z1); if (len < 0.01) continue; const m = new T.Mesh(M.box(0.14, 0.14, len), mat); m.position.set((x1 + x2) / 2, 1.0, (z1 + z2) / 2); m.rotation.y = Math.atan2(x2 - x1, z2 - z1); beamG.add(m); }
}

/* entities */
function syncEnts(dt, time, ctx) {
  const seen = {};
  for (const e of W.ents) {
    seen[e.id] = 1; let v = ents[e.id];
    if (!v) { v = ents[e.id] = { m: e.k === 'boss' ? M.boss(e.b) : M.enemy(e.k), x: e.x, z: e.z }; v.m.position.set(e.x, 0, e.z); entG.add(v.m);
      if (e.k === 'mummy' || e.k === 'armor') { const gh = M.enemy(e.k === 'mummy' ? 'goob' : 'invis'); gh.userData.g.children.forEach((c) => { if (c.material && c.material.color && c.material.transparent) c.material = c.material.clone(); }); gh.visible = false; v.m.add(gh); v.alt = gh; if (gh.userData.g.userData.mat) gh.userData.g.userData.mat = gh.userData.g.userData.mat.clone(); }
      if (e.k === 'invis' && v.m.userData.g.userData.mat) { const nm = v.m.userData.g.userData.mat.clone(); v.m.userData.g.traverse((o) => { if (o.material === v.m.userData.g.userData.mat) o.material = nm; }); v.m.userData.g.userData.mat = nm; }
      const st = M.text('\u2605 \u2605', '#ffe14d'); st.scale.set(1.4, 0.35, 1); st.position.y = e.k === 'boss' ? 4 : 2.1; st.visible = false; v.m.add(st); v.stars = st;
      const ex = M.text('!', '#ff4d6d'); ex.scale.set(1, 0.6, 1); ex.position.y = e.k === 'boss' ? 4.3 : 2.2; ex.visible = false; v.m.add(ex); v.ex = ex;
      if (e.k === 'boss') { v.bulbs = []; }
    }
    // interpolate (client) / follow (host)
    const k = ctx.client ? Math.min(1, dt * 12) : 1; v.x += (e.x - v.x) * k; v.z += (e.z - v.z) * k;
    const m = v.m, g = m.userData.g; m.position.set(v.x, 0, v.z);
    let ry = e.ang || 0; if (e.st === 'tug') ry = (e.pd || 0) + Math.PI; m.rotation.y += SP.angDiff(m.rotation.y, ry) * Math.min(1, dt * 8);
    const d = SP.EN[e.k] || {}; const fly = d.fly ? (e.y || 1.2) - 1.2 : 0;
    g.position.y = (e.k === 'boss' && e.b === 'mandrake' ? 0 : (d.walk ? 0 : 0.35 + Math.sin(time * 2.5 + e.id) * 0.12)) + fly;
    const hide = e.st === 'hide'; m.visible = !hide;
    v.stars.visible = e.st === 'stun' || e.st === 'open' || e.st === 'dizzy' || e.st === 'stuck' || e.st === 'tired' || e.st === 'exposed' || e.st === 'bones'; if (v.stars.visible) v.stars.material.rotation = time * 3;
    v.ex.visible = e.st === 'wind' || e.st === 'aim' || e.st === 'cast' || e.st === 'pound' || e.st === 'beam' || e.st === 'fanw' || e.st === 'slamw' || e.st === 'vines';
    let sc = 1;
    if (e.st === 'spawn') sc = 0.3 + (1 - Math.max(0, Math.min(1, (e.t || 0) / 0.8))) * 0.7;
    if (e.st === 'tug') { const s = 1 + Math.sin(time * 22) * 0.06; g.scale.set((g.userData.bs || 1) * s, (g.userData.bs || 1) / s, (g.userData.bs || 1) * (1.15 + Math.sin(time * 15) * 0.1)); } else if (g.userData.bs) g.scale.setScalar(g.userData.bs * sc); else { g.userData.bs = g.scale.x; }
    if (e.st === 'wind') g.position.x = Math.sin(time * 40) * 0.06; else g.position.x = 0;
    if (m.userData.glow) m.userData.glow.material.opacity = e.st === 'stun' || e.st === 'open' ? 0.85 : 0.5;
    if (m.userData.acc) m.userData.acc.visible = !!e.sh;
    if (m.userData.orbs) { m.userData.orbs.rotation.y += dt * 3; m.userData.orbs.visible = e.st !== 'stun' && e.st !== 'tug'; }
    if (g.userData.wings) { const f = Math.sin(time * 20 + e.id); g.userData.wings[0].rotation.y = f * 0.6; g.userData.wings[1].rotation.y = -f * 0.6; }
    if (g.userData.legs && d.walk) { const ph = Math.hypot(e.vx || 0, e.vz || 0) > 0.1 || ctx.client ? time * 7 : 0; g.userData.legs[0].rotation.x = Math.sin(ph) * 0.5; g.userData.legs[1].rotation.x = -Math.sin(ph) * 0.5; }
    if (e.k === 'invis') { const mat = g.userData.mat; const op = e.rev ? 0.85 : (assist ? 0.2 : 0.06) + Math.max(0, Math.sin(time * 3 + e.id)) * 0.05; mat.opacity = op; m.userData.glow.material.opacity = e.rev ? 0.5 : op * 0.6; g.children.forEach((c) => { if (c.material && c.material !== mat) c.visible = !!e.rev || assist; }); }
    if (e.k === 'mummy' && v.alt) { const un = e.wrap <= 0; g.visible = !un; v.alt.visible = un; if (un) { v.alt.userData.g.position.y = 0.4 + Math.sin(time * 3) * 0.1; } if (e.wrap > 0 && e.wrap < 1) g.rotation.y = time * 6 * (1 - e.wrap); }
    if (e.k === 'armor' && v.alt) { v.alt.visible = !!e.free; g.visible = true; if (e.free) { g.rotation.x = Math.min(1.4, (g.rotation.x || 0) + dt * 4); g.position.set(-0.6, 0, 0); v.alt.userData.g.position.set(0.5, 0.5 + Math.sin(time * 3) * 0.1, 0); } else { const sw = g.userData.sword; if (sw) sw.rotation.x = e.st === 'wind' ? -1.4 : e.st === 'stuck' ? 1.3 : 0; } }
    if (e.k === 'skeleton') { const pile = e.st === 'bones'; g.rotation.x = pile ? -1.4 : 0; g.position.y = pile ? 0.2 : 0; g.scale.set(1, pile ? 0.5 : 1, 1); }
    if (e.k === 'witch' && g.userData.orb) g.userData.orb.scale.setScalar(e.st === 'cast' ? 1.6 + Math.sin(time * 20) * 0.4 : 1);
    if (e.k === 'boss') {
      if (g.userData.books) { g.userData.books.rotation.y += dt * 2.5; g.userData.books.visible = e.st !== 'open' && e.st !== 'tug'; }
      if (g.userData.hat) { g.userData.hat.rotation.z = e.st === 'stuck' ? 0.5 : 0; g.userData.hat.visible = !(e.st === 'open' || e.st === 'tug'); }
      if (e.b === 'mandrake') { const gh = g.userData.ghost; if (gh) { const out = e.st === 'open' || e.st === 'tug'; gh.position.y = out ? 1.6 : 0.6 + Math.sin(time * 2) * 0.1; } syncBulbs(v, e, time); }
      if (e.st === 'dash' || e.b === 'waltzy') g.rotation.y = e.st === 'dash' || e.st === 'dizzy' ? time * (e.st === 'dizzy' ? 4 : 14) : 0;
    }
  }
  for (const id in ents) if (!seen[id]) { const v = ents[id]; entG.remove(v.m); if (v.bulbs) v.bulbs.forEach((b) => entG.remove(b)); delete ents[id]; }
}
function syncBulbs(v, e, time) {
  const bu = e.bulbs || [];
  while (v.bulbs.length < bu.length) { const g = new T.Group(); M.C(0.06, 1, '#3fbf4f', 0, 0, 0, g); const s = M.S(0.42, new T.MeshBasicMaterial({ color: '#d86bff' }), 0, 1.2, 0, g); const gl = M.glow('#ffffff', 2, 0); gl.position.y = 1.2; g.add(gl); g.userData = { s, gl }; entG.add(g); v.bulbs.push(g); }
  v.bulbs.forEach((g, i) => { const u = bu[i]; g.visible = !!u && !u.pop; if (!u) return; g.position.set(u.x, 0, u.z); g.userData.gl.material.opacity = u.rev ? 0.9 : 0; g.userData.s.material.color.set(u.rev ? '#fff36b' : '#d86bff'); g.scale.y = 1 + Math.sin(time * 4 + i) * 0.05; });
}
const PCOL = { coin: '#ffd23f', bill: '#4ade80', gold: '#ffb020', heart: '#ff4d6d', key: '#ffe14d' };
function syncPicks(dt, time) {
  const seen = {};
  for (const p of W.picks) {
    seen[p.id] = 1; let m = picks[p.id];
    if (!m) {
      m = new T.Group();
      if (p.k === 'coin') { const c = M.C(0.22, 0.06, M.bas('#ffd23f'), 0, -0.03, 0, m); c.rotation.x = Math.PI / 2; }
      else if (p.k === 'bill') M.B(0.5, 0.05, 0.28, M.bas('#4ade80'), 0, 0, 0, m);
      else if (p.k === 'gold') M.B(0.5, 0.22, 0.26, M.bas('#ffb020'), 0, 0, 0, m);
      else if (p.k === 'heart') { M.S(0.16, M.bas('#ff4d6d'), -0.1, 0.1, 0, m); M.S(0.16, M.bas('#ff4d6d'), 0.1, 0.1, 0, m); const cn = new T.Mesh(new T.ConeGeometry(0.24, 0.32, 12), M.bas('#ff4d6d')); cn.rotation.z = Math.PI; cn.position.y = -0.08; m.add(cn); }
      else if (p.k === 'gem') { const g = new T.Mesh(new T.OctahedronGeometry(0.32), M.bas(SP.GEM_COLORS[(p.gi | 0) % 6])); m.add(g); const gl = M.glow(SP.GEM_COLORS[(p.gi | 0) % 6], 2, 0.8); m.add(gl); }
      else if (p.k === 'key') { const t = new T.Mesh(new T.TorusGeometry(0.18, 0.06, 6, 12), M.bas('#ffe14d')); t.position.x = -0.25; m.add(t); M.B(0.45, 0.08, 0.08, M.bas('#ffe14d'), 0.05, -0.04, 0, m); M.B(0.06, 0.15, 0.08, M.bas('#ffe14d'), 0.22, -0.15, 0, m); const gl = M.glow('#ffe14d', 2.2, 0.8); m.add(gl); }
      if (p.k !== 'gem' && p.k !== 'key') { const gl = M.glow(PCOL[p.k] || '#fff', p.k === 'heart' ? 1.3 : 0.9, 0.5); m.add(gl); }
      picks[p.id] = m; entG.add(m);
    }
    m.position.set(p.x, (p.y || 0.35) + Math.sin(time * 4 + p.id) * 0.06, p.z); m.rotation.y = time * 3;
  }
  for (const id in picks) if (!seen[id]) { entG.remove(picks[id]); delete picks[id]; }
}
function syncProj(dt, time) {
  const seen = {};
  for (const p of W.proj) {
    seen[p.id] = 1; let m = projs[p.id];
    if (!m) { m = new T.Group(); if (p.k === 'orb') { M.S(p.big ? 0.4 : 0.3, M.bas('#ff9cff'), 0, 0, 0, m); m.add(M.glow('#d86bff', p.big ? 2.6 : 2, 0.9)); } else { const c = { book: '#3fa8ff', pot: '#c0c8d8', obj: '#e84a5f' }[p.k] || '#e84a5f'; M.B(0.4, 0.15, 0.5, M.bas(c), 0, 0, 0, m); m.add(M.glow(p.refl ? '#3ff0ff' : '#ff9a6b', 1.4, 0.6)); } m.position.set(p.x, 1, p.z); projs[p.id] = m; entG.add(m); }
    m.position.x += (p.x - m.position.x) * Math.min(1, dt * 18); m.position.z += (p.z - m.position.z) * Math.min(1, dt * 18); m.position.y = 1; m.rotation.y += dt * 9; m.rotation.x += dt * 5;
    if (p.refl && !m.userData.r) { m.userData.r = 1; m.add(M.glow('#3ff0ff', 2, 0.9)); }
  }
  for (const id in projs) if (!seen[id]) { entG.remove(projs[id]); delete projs[id]; }
}
function syncTele(time) {
  const seen = {};
  for (const t of W.tele) {
    seen[t.id] = 1; let m = teles[t.id]; const col = t.dmg ? '#ff3b5c' : '#ff9f43';
    if (!m) {
      if (t.k === 'ring') { m = new T.Group(); const r = M.ring(t.r, col, 0.9); m.add(r); const f = M.disc(t.r, col, 0.25); m.add(f); m.userData.f = f; }
      else { const len = Math.hypot(t.x2 - t.x, t.z2 - t.z); m = new T.Mesh(new T.PlaneGeometry(t.w * 2, len), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(t.x2 - t.x, t.z2 - t.z) + Math.PI; m.position.set((t.x + t.x2) / 2, 0.07, (t.z + t.z2) / 2); m.userData.line = 1; }
      teles[t.id] = m; fxG.add(m);
    }
    if (m.userData.line) m.material.opacity = 0.3 + Math.abs(Math.sin(time * 10)) * 0.3;
    else { m.position.set(t.x, 0.08, t.z); const f = m.userData.f; const prog = Math.max(0, Math.min(1, 1 - t.t / 1.3)); f.scale.setScalar(Math.max(0.05, prog)); }
  }
  for (const id in teles) if (!seen[id]) { fxG.remove(teles[id]); delete teles[id]; }
}
/* bodies: hunters (+ goo clones) with flashlights */
function syncBodies(dt, time, ctx) {
  const seen = {}; let si = 0;
  for (const b of ctx.bodies) {
    seen[b.id] = 1; let v = bodies[b.id];
    if (!v || v.hero !== b.hero || v.color !== b.color) { if (v) entG.remove(v.m); v = bodies[b.id] = { m: M.hunter(b.color, SP.HEROES[b.hero] || SP.HEROES[0], b.clone), hero: b.hero, color: b.color, x: b.x, z: b.z, ang: b.ang }; entG.add(v.m);
      const vc = new T.Mesh(new T.CylinderGeometry(0.05, 0.6, 1, 10, 1, true), new T.MeshBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.25, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); vc.geometry.translate(0, -0.5, 0); vc.geometry.rotateX(-Math.PI / 2); vc.visible = false; entG.add(vc); v.vc = vc;
      const ar = new T.Mesh(new T.ConeGeometry(0.35, 0.9, 3), new T.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.85 })); ar.rotation.x = Math.PI / 2; const arG = new T.Group(); arG.add(ar); ar.position.z = 1.6; arG.visible = false; entG.add(arG); v.ar = arG;
      const ring = M.ring(0.7, b.color, 0.85); ring.position.y = 0.04; v.m.add(ring);
    }
    const k = b.local ? 1 : Math.min(1, dt * 12); v.x += (b.x - v.x) * k; v.z += (b.z - v.z) * k; v.ang += SP.angDiff(v.ang, b.ang) * (b.local ? 1 : Math.min(1, dt * 12));
    const m = v.m; m.position.set(v.x, 0, v.z); m.rotation.y = v.ang;
    const moving = b.mv; const body = m.userData.body; body.position.y = moving ? Math.abs(Math.sin(time * 10)) * 0.08 : 0;
    m.visible = !(b.inv && Math.sin(time * 30) > 0.3);
    body.rotation.x = b.down ? -1.45 : 0; body.position.y += b.down ? 0.3 : 0;
    // flashlight spot + cone
    const sp = spots[si], cn = cones[si]; si++;
    const fwdx = Math.sin(v.ang), fwdz = Math.cos(v.ang);
    if (sp && !b.down) {
      const dk = b.dark, fl = b.flashT > 0; const range = b.flashR || 5.6;
      sp.intensity = fl ? 4 : dk ? 1.6 : 1.7; sp.color.set(dk ? '#c58bff' : fl ? '#ffffff' : '#fff2c8'); sp.distance = range + 6; sp.angle = dk ? 0.5 : (b.flashA || 0.68) * 0.85;
      sp.position.set(v.x + fwdx * 0.4, 1.5, v.z + fwdz * 0.4); sp.target.position.set(v.x + fwdx * 5, 0, v.z + fwdz * 5);
      cn.visible = !b.vac && !b.blow; cn.position.set(v.x + fwdx * 0.55, 0.8, v.z + fwdz * 0.55); cn.rotation.set(0, v.ang, 0);
      const cl = dk ? range * 0.95 : range * 0.85, cr = Math.tan(dk ? 0.5 : (b.flashA || 0.68) * 0.9) * cl; cn.scale.set(cr, cr * 0.45, cl);
      cn.material.color.set(dk ? '#b46bff' : fl ? '#ffffff' : '#fff3b0'); cn.material.opacity = fl ? 0.45 : dk ? 0.22 : 0.09;
    } else if (sp) { sp.intensity = 0; cn.visible = false; }
    // vac / blow stream
    v.vc.visible = !!(b.vac || b.blow) && !b.down;
    if (v.vc.visible) { const tug = b.tugE; let len = b.vacR || 4.2, a = v.ang; if (tug) { len = Math.hypot(tug.x - v.x, tug.z - v.z); a = Math.atan2(tug.x - v.x, tug.z - v.z); }
      v.vc.position.set(v.x + Math.sin(a) * 0.7, 0.85, v.z + Math.cos(a) * 0.7); v.vc.rotation.set(0, a, 0); v.vc.scale.set(tug ? 0.5 : 1.6, tug ? 0.5 : 1.0, len);
      v.vc.material.color.set(b.blow ? '#ffffff' : tug ? '#3ff0ff' : '#7fd8ff'); v.vc.material.opacity = (b.blow ? 0.18 : 0.22) + Math.sin(time * 30) * 0.06; }
    // pull arrow (local tug only)
    v.ar.visible = !!(b.local && b.tugE);
    if (v.ar.visible) { v.ar.position.set(v.x, 0.15, v.z); v.ar.rotation.y = (b.tugE.pd || 0) + Math.PI; v.ar.children[0].material.color.set(b.tugOK ? '#4ade80' : '#ffe14d'); v.ar.children[0].scale.setScalar(1 + Math.sin(time * 10) * 0.12); }
  }
  for (; si < 4; si++) { spots[si].intensity = 0; cones[si].visible = false; }
  for (const id in bodies) if (!seen[id]) { entG.remove(bodies[id].m); entG.remove(bodies[id].vc); entG.remove(bodies[id].ar); delete bodies[id]; }
}

/* ---------------- particles ---------------- */
V.burst = function (x, y, z, col, n, sp, size, life) {
  for (let i = 0; i < (n || 10); i++) { const s = M.glow(col, size || 0.5, 0.9); s.position.set(x, y, z); fxG.add(s); const a = Math.random() * TAU, u = Math.random() * 2 - 0.5; parts.push({ s, vx: Math.cos(a) * (sp || 3) * Math.random(), vy: u * (sp || 3), vz: Math.sin(a) * (sp || 3) * Math.random(), t: life || 0.7, max: life || 0.7 }); }
};
V.floatText = function (x, y, z, txt, col) { const s = M.text(txt, col || '#ffe14d'); s.position.set(x, y, z); s.scale.multiplyScalar(1.2); fxG.add(s); parts.push({ s, vx: 0, vy: 1.4, vz: 0, t: 1.1, max: 1.1, txt: 1 }); };
V.flashFx = function (x, z, ang, r, a) {
  const len = r || 5.6, w = Math.tan(a || 0.68) * len; const g = new T.ConeGeometry(w, len, 20, 1, true); g.translate(0, -len / 2, 0); g.rotateX(-Math.PI / 2);
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); m.position.set(x + Math.sin(ang) * 0.5, 0.9, z + Math.cos(ang) * 0.5); m.rotation.y = ang; m.scale.y = 0.5; fxG.add(m);
  parts.push({ s: m, vx: 0, vy: 0, vz: 0, t: 0.28, max: 0.28, flash: 1 });
};
V.plungeFx = function (x, z, tx, tz) { const len = Math.hypot(tx - x, tz - z); const m = new T.Mesh(M.box(0.08, 0.08, len), M.bas('#ff4d6d')); m.position.set((x + tx) / 2, 0.9, (z + tz) / 2); m.rotation.y = Math.atan2(tx - x, tz - z); fxG.add(m); const cup = M.S(0.18, M.bas('#ff4d6d'), tx, 0.9, tz, fxG); parts.push({ s: m, t: 0.35, max: 0.35, vx: 0, vy: 0, vz: 0, flash: 1 }); parts.push({ s: cup, t: 0.35, max: 0.35, vx: 0, vy: 0, vz: 0 }); };
V.ringFx = function (x, z, r, col) { const m = M.ring(r, col || '#ffffff', 0.8); m.position.set(x, 0.1, z); fxG.add(m); parts.push({ s: m, vx: 0, vy: 0, vz: 0, t: 0.5, max: 0.5, grow: 1 }); };
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t -= dt; const k = Math.max(0, p.t / p.max);
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt; if (!p.txt && !p.flash && !p.grow) p.vy -= 3 * dt;
    if (p.s.material) p.s.material.opacity = (p.flash ? 0.6 : 0.9) * k;
    if (p.grow) p.s.scale.setScalar(1 + (1 - k) * 1.5);
    if (p.t <= 0) { fxG.remove(p.s); parts.splice(i, 1); }
  }
}

/* ---------------- DOM tags (names, ghost HP, help) ---------------- */
let tagEl = null; const tagPool = {};
function updateTags(ctx) {
  if (!tagEl) tagEl = document.getElementById('tags'); if (!tagEl) return;
  const used = {};
  const put = (key, x, y, z, html, cls) => {
    tmpV.set(x, y, z).project(cam); if (tmpV.z > 1) return;
    let el = tagPool[key]; if (!el) { el = tagPool[key] = document.createElement('div'); tagEl.appendChild(el); }
    if (el._h !== html) { el.innerHTML = html; el._h = html; } if (el.className !== 'tag ' + (cls || '')) el.className = 'tag ' + (cls || '');
    el.style.transform = 'translate(' + ((tmpV.x + 1) / 2 * innerWidth) + 'px,' + ((1 - tmpV.y) / 2 * innerHeight) + 'px) translate(-50%,-100%)'; el.style.display = ''; used[key] = 1;
  };
  for (const b of ctx.bodies) {
    const v = bodies[b.id]; if (!v) continue;
    if (!b.clone && (!b.local || ctx.mp)) put('n' + b.id, v.x, 2.3, v.z, SP.esc(b.name) + (b.down ? ' <b>HELP!</b>' : ''), 'name' + (b.down ? ' down' : '')); else if (b.local && b.down) put('n' + b.id, v.x, 2.3, v.z, '<b>Spooked!</b>', 'name down');
    if (b.clone) put('n' + b.id, v.x, 2.1, v.z, 'GOO' + (b.ctrl ? ' \u2B50' : ''), 'goo');
  }
  for (const e of W.ents) {
    const v = ents[e.id]; if (!v) continue;
    if (e.st === 'tug' || (e.k === 'boss' ? false : (e.st === 'stun' && e.hp < e.mhp))) put('h' + e.id, v.x, e.k === 'boss' ? 4.2 : (SP.EN[e.k] && SP.EN[e.k].big ? 3.2 : 2.2), v.z, '<b>' + Math.max(0, Math.ceil(e.hp)) + '</b>', 'hp' + (e.st === 'tug' ? ' tug' : ''));
  }
  for (const k in tagPool) if (!used[k]) { if (tagPool[k].style.display !== 'none') tagPool[k].style.display = 'none'; }
}
V.clearTags = function () { for (const k in tagPool) tagPool[k].style.display = 'none'; };
SP.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
})();
