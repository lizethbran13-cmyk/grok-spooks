/* Grok Spooks - host-authoritative room simulation: ghosts, tools, puzzles, loot, bosses.
   Runs on the host (or solo). Clients get W through snapshots. */
(function () {
'use strict';
const SP = window.SP, EN = SP.EN;
const Sim = SP.Sim = {};
let W = null, API = null;
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const angTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
SP.angDiff = angDiff; SP.angTo = angTo;
Sim.W = () => W;
Sim.init = (api) => { API = api; };
const asst = () => !!(API && API.assist && API.assist());
const TOOL = { vacR: 4.2, vacA: 0.62, flashR: 5.6, flashA: 0.68, blowR: 4.6, blowA: 0.62, darkR: 6.2, darkA: 0.6, plR: 7.5, plA: 0.62 };
SP.TOOL = TOOL;
Sim.vacR = (b) => TOOL.vacR + 0.6 * (b.uv || 0);
Sim.flashR = (b) => TOOL.flashR + 1.1 * (b.uf || 0);
Sim.flashA = (b) => TOOL.flashA + 0.08 * (b.uf || 0);
function inCone(b, x, z, r, a) { const d = dist(b.x, b.z, x, z); if (d > r) return false; if (d < 0.7) return true; return Math.abs(angDiff(b.ang, angTo(b.x, b.z, x, z))) <= a + Math.atan2(0.5, d); }
Sim.inCone = inCone;
function out(e) { W.out.push(e); }
function nid() { return ++W.seq; }

/* ---------------- load a room ---------------- */
Sim.load = function (rid, o) {
  o = o || {};
  const L = SP.layout(rid), def = L.def;
  W = { rid, L, def, t: 0, seq: 0, out: [], ents: [], picks: [], proj: [], tele: [], bodies: {}, btug: {}, ammo: {}, hurtT: {},
    cleared: !!o.cleared, wave: 0, waveT: -1, haunt: false, lit: o.cleared ? 1 : 0,
    pr: L.props.map(() => ({ v: 0, e: 0, g: 0 })), doorRev: {}, gemRev: {}, taken: o.taken || {}, hasKey: !!o.hasKey, chest: 0,
    puz: null, boss: null, booDone: !!o.booDone, tut: def.tut && !o.cleared ? 0 : -1, tutT: 0, elevOn: !!def.hub, bossBeaten: !!o.bossBeaten, keyGot: false };
  (o.revDoors || []).forEach((i) => { W.doorRev[i] = 1; });
  if (L.puz) {
    const P = L.puz, Z = W.puz = { type: P.type, solved: o.cleared ? 1 : 0 };
    if (P.type === 'plates') { Z.occ = [0, 0]; Z.hold = 0; }
    if (P.type === 'levers') Z.lv = [0, 0];
    if (P.type === 'fans') Z.fan = [0, 0];
    if (P.type === 'fan') { Z.fan = [0, 0]; Z.fanT = [0, 0]; }
    if (P.type === 'crate') { Z.cx = Z.solved ? P.plate.x : P.crate.x; Z.cz = Z.solved ? P.plate.z : P.crate.z; Z.vx = 0; Z.vz = 0; }
    if (P.type === 'paint') { const c = [0, 1, 2, 3].sort(() => Math.random() - 0.5); Z.seq = c.slice(0, 3); Z.lit = []; }
    if (P.type === 'dark') Z.rev = Z.solved ? 1 : 0;
    if (P.type === 'beam') { Z.o = P.mir.map((m) => Z.solved && m.sol ? m.sol : m.o); Z.hit = Z.solved ? 1 : 0; Z.cd = 0; }
    if (Z.solved) W.chest = 1;
  }
  if (def.boss) { if (!o.cleared) W.waveT = 1.6; else W.elevBoss = 1; }
  else if (!W.cleared && def.waves.length) W.waveT = 1.1;
  else if (W.cleared && !def.hub && !def.tut && o.haunt) { W.haunt = true; W.waveT = 1.4; }
  if (def.tut && !o.cleared) { W.tut = 0; W.L.doors.forEach((d) => { d.dark = true; }); }
  // pre-place hidden Boo
  W.booProp = (def.boo && !W.booDone && L.booProp != null) ? L.booProp : -1;
  return W;
};

/* ---------------- collision ---------------- */
function doorOpen(i) {
  const d = W.L.doors[i]; if (!d) return false;
  if (d.dark && !W.doorRev[i]) return false;
  return !Sim.doorLock(i);
}
Sim.doorLock = function (i) {
  const d = W.L.doors[i];
  if (W.tut >= 0 && W.tut < 5) return 'tut';
  if (d.dark && !W.doorRev[i]) return 'dark';
  if (d.lock === 'key' && !W.hasKey) return 'key';
  if (!W.cleared && !W.haunt && (W.def.boss ? !W.bossBeaten : (W.ents.some((e) => e.wv) || W.waveT > 0 || W.wave < W.def.waves.length))) return 'ghost';
  return null;
};
Sim.doorOpen = doorOpen;
function solids() {
  const s = [];
  W.L.props.forEach((p, i) => { if (p.solid && !W.pr[i].g) s.push(p); });
  const P = W.L.puz, Z = W.puz;
  if (P) {
    if (W.L.chest) s.push({ x: W.L.chest.x, z: W.L.chest.z, w: 1.2, d: 0.8 });
    if (P.type === 'crate') s.push({ x: Z.cx, z: Z.cz, w: 1, d: 1, crate: 1 });
    (P.fans || []).forEach((f) => s.push({ x: f.x, z: f.z, w: 0.5, d: 0.5 }));
    (P.candles || []).forEach((f) => s.push({ x: f.x, z: f.z, w: 0.5, d: 0.5 }));
    (P.mir || []).forEach((f) => s.push({ x: f.x, z: f.z, w: 0.7, d: 0.7 }));
    if (P.tg) s.push({ x: P.tg.x, z: P.tg.z, w: 0.7, d: 0.7 });
  }
  return s;
}
let solidCache = null, solidT = -1;
function getSolids() { if (solidT !== W.t) { solidCache = solids(); solidT = W.t; } return solidCache; }
// push circle (x,z,r) out of props + walls. walls let you into open door gaps (returns door index if past the wall)
SP.collide = function (x, z, r, opt) {
  if (!W) return { x, z };
  const L = W.L, hw = L.hw, hd = L.hd; opt = opt || {};
  const list = opt.noCrate ? getSolids().filter((s) => !s.crate) : getSolids();
  for (const p of list) {
    const dx = x - p.x, dz = z - p.z, ex = p.w / 2 + r, ez = p.d / 2 + r;
    if (Math.abs(dx) < ex && Math.abs(dz) < ez) { const px = ex - Math.abs(dx), pz = ez - Math.abs(dz); if (px < pz) x = p.x + Math.sign(dx || 1) * ex; else z = p.z + Math.sign(dz || 1) * ez; }
  }
  let door = -1;
  const gap = (along, d) => Math.abs(along - d) < SP.DOOR_W / 2 - r * 0.6;
  for (const [axis, lim, sgn, side] of [['x', hw, 1, 'E'], ['x', hw, -1, 'W'], ['z', hd, 1, 'S'], ['z', hd, -1, 'N']]) {
    const v = axis === 'x' ? x : z; if (v * sgn <= lim - r) continue;
    let pass = false;
    if (opt.doors !== false) L.doors.forEach((d, i) => { if (d.side === side && gap(axis === 'x' ? z : x, axis === 'x' ? d.z : d.x) && doorOpen(i)) { pass = true; if (v * sgn > lim + 0.15) door = i; } });
    if (!pass) { if (axis === 'x') x = sgn * (lim - r); else z = sgn * (lim - r); }
  }
  return { x, z, door };
};
function clampIn(e, m) { const L = W.L; e.x = Math.max(-L.hw + m, Math.min(L.hw - m, e.x)); e.z = Math.max(-L.hd + m, Math.min(L.hd - m, e.z)); }

/* ---------------- bodies helpers ---------------- */
function bodyList() { return Object.values(W.bodies); }
function alive() { return bodyList().filter((b) => !b.down); }
function nearestBody(x, z) { let best = null, bd = 1e9; for (const b of alive()) { const d = dist(x, z, b.x, b.z); if (d < bd) { bd = d; best = b; } } return best; }
function hurt(b, dmg, sx, sz) {
  if (!b || b.down) return; if ((W.hurtT[b.id] || 0) > W.t) return; W.hurtT[b.id] = W.t + 1.1;
  if (b.clone) { out({ e: 'clonepop', pid: b.pid, x: b.x, z: b.z }); API.clonePop && API.clonePop(b.pid); return; }
  API.hurt(b.pid, dmg, sx, sz);
}

/* ---------------- spawning ---------------- */
function spawnPoint(minD) {
  const L = W.L;
  for (let i = 0; i < 40; i++) {
    const x = rnd(-L.hw + 2, L.hw - 2), z = rnd(-L.hd + 2, L.hd - 2);
    if (alive().some((b) => dist(x, z, b.x, b.z) < (minD || 5))) continue;
    if (getSolids().some((p) => Math.abs(x - p.x) < p.w / 2 + 0.8 && Math.abs(z - p.z) < p.d / 2 + 0.8)) continue;
    return { x, z };
  }
  return { x: 0, z: -L.hd + 3 };
}
function mkEnt(k, x, z, extra) {
  const d = EN[k] || EN.goob;
  const e = Object.assign({ id: nid(), k, x, z, y: d.fly ? 1.2 : 0, vx: 0, vz: 0, ang: 0, st: 'spawn', t: 0.8, hp: d.hp, mhp: d.hp, cb: [], pd: 0, slam: 0, sh: 0, wrap: 0, rev: 0, hid: -1, free: 0, cd: rnd(0.5, 2), wv: 1 }, extra || {});
  if (k === 'shades' || k === 'shieldy' || k === 'armor') e.sh = 1;
  if (k === 'mummy') e.wrap = 1;
  W.ents.push(e); return e;
}
Sim.mkEnt = mkEnt;
function spawnWave(kinds, wv) {
  const hide = (W.L.hideProps || []).slice().sort(() => Math.random() - 0.5);
  kinds.forEach((k) => {
    if (k === 'swarm') { const p = spawnPoint(6); for (let i = 0; i < 6; i++) mkEnt('swarm', p.x + rnd(-1.2, 1.2), p.z + rnd(-1.2, 1.2), { wv }); return; }
    if (k === 'hider' && hide.length) { const pi = hide.pop(), pp = W.L.props[pi]; mkEnt('hider', pp.x, pp.z, { st: 'hide', t: rnd(4, 7), hid: pi, wv }); return; }
    const p = spawnPoint(5); mkEnt(k, p.x, p.z, { wv });
  });
  out({ e: 'wave', n: kinds.length });
}
function spawnBoss() {
  const id = W.def.boss, d = SP.BOSS[id];
  const hp = Math.round(d.hp * (asst() ? 0.75 : 1));
  const b = mkEnt('boss', 0, -W.L.hd * 0.35, { b: id, hp, mhp: hp, st: 'intro', t: 2.6, ph: 1, pat: 0, cnt: 0, wv: 1, open: 0, bulbs: null, sub: 0 });
  W.boss = b; out({ e: 'boss', b: id });
}

/* ---------------- loot ---------------- */
function pick(k, x, z, v, extra) { const p = Object.assign({ id: nid(), k, x, z, y: 0.6, vy: 3.5, vx: rnd(-1.6, 1.6), vz: rnd(-1.6, 1.6), v: v || 0, age: 0 }, extra || {}); W.picks.push(p); return p; }
function coins(x, z, n, val) { for (let i = 0; i < n; i++) pick(val >= 50 ? 'gold' : val >= 20 ? 'bill' : 'coin', x, z, val || 5); }
function gemDrop(gi, x, z) { if (W.taken['g' + W.def.a + '_' + gi]) { coins(x, z, 3, 10); return; } if (W.picks.some((p) => p.k === 'gem' && p.gi === gi)) return; pick('gem', x, z, 0, { gi, a: W.def.a }); out({ e: 'gemspot', x, z }); }
function lootProp(i, b) {
  const p = W.L.props[i], s = W.pr[i]; if (s.e) return; s.e = 1;
  if (p.t !== 'furn') s.g = 1;
  const n = p.t === 'web' ? 2 : p.t === 'rug' ? 4 : p.t === 'curtain' ? 3 : 3 + (Math.random() * 3 | 0);
  coins(p.x, p.z, n, 5);
  if (Math.random() < (asst() ? 0.35 : 0.22)) pick('heart', p.x, p.z);
  if (Math.random() < 0.12) pick('bill', p.x, p.z, 20);
  if (p.gem) gemDrop(p.gem - 1, p.x, p.z);
  out({ e: 'loot', i, t: p.t, x: p.x, z: p.z });
  if (W.tut === 3) tutNext();
}
function flushProp(i) {
  if (W.booProp === i) { W.booProp = -1; const p = W.L.props[i]; mkEnt('boo', p.x, p.z + 0.8, { st: 'flee', t: 1.5, wv: 0 }); out({ e: 'boo', x: p.x, z: p.z }); }
  W.ents.forEach((e) => { if (e.hid === i && e.st === 'hide') { e.hid = -1; e.st = 'stun'; e.t = 2.4; e.x = W.L.props[i].x; e.z = W.L.props[i].z + 0.9; out({ e: 'flush', x: e.x, z: e.z }); } });
}

/* ---------------- tools ---------------- */
function stun(e, t, why) {
  if (e.st === 'tug' || e.st === 'dead') return false;
  e.st = 'stun'; e.t = t * (asst() ? 1.4 : 1); e.vx = e.vz = 0; out({ e: 'stun', id: e.id, x: e.x, z: e.z, why }); return true;
}
function flashable(e, b) {
  switch (e.k) {
    case 'shades': return e.sh ? 'shades' : true;
    case 'shieldy': if (!e.sh) return true; return Math.abs(angDiff(e.ang, angTo(e.x, e.z, b.x, b.z))) > 1.7 ? true : 'shield';
    case 'polter': return 'polter';
    case 'mummy': return e.wrap > 0 ? 'mummy' : true;
    case 'armor': return e.free ? true : 'armor';
    case 'witch': return e.st === 'cast' ? true : 'witch';
    case 'invis': return e.rev > 0 ? true : 'hidden';
    case 'brute': return e.st === 'tired' ? true : 'brute';
    case 'boo': return e.st === 'face' ? true : 'boo';
    case 'hider': return e.st === 'hide' ? 'hidden' : true;
    case 'skeleton': return e.st === 'bones' ? 'bones' : true;
    case 'boss': return bossFlash(e, b);
  }
  return true;
}
Sim.act = function (bid, a, data) {
  if (!W) return; const b = W.bodies[bid]; if (!b || b.down) return;
  if (data && typeof data.ang === 'number') b.ang = data.ang;
  if (a === 'flash') doFlash(b);
  else if (a === 'plunge') doPlunge(b);
  else if (a === 'slam') doSlam(b);
};
function doFlash(b) {
  const R = Sim.flashR(b), A = Sim.flashA(b); let n = 0; const blocked = [];
  out({ e: 'flash', id: b.id, x: b.x, z: b.z, ang: b.ang });
  for (const e of W.ents) {
    if (e.st === 'tug' || e.st === 'stun' || e.st === 'spawn' || e.st === 'hide') continue;
    if (!inCone(b, e.x, e.z, R + (e.k === 'boss' ? 1.5 : 0), A)) continue;
    const f = flashable(e, b);
    if (f === true) {
      if (e.k === 'skeleton') { e.st = 'bones'; e.t = asst() ? 8 : 5.5; out({ e: 'bones', id: e.id, x: e.x, z: e.z }); n++; continue; }
      if (e.k === 'boss') { bossOpen(e); n++; continue; }
      if (stun(e, e.k === 'bat' ? 3.5 : e.k === 'boo' ? 2.8 : 3.2, 'flash')) n++;
    } else if (f && f !== 'hidden') blocked.push(f);
  }
  if (!n && blocked.length) out({ e: 'block', why: blocked[0], pid: b.pid });
  if (W.tut === 1 && n) tutNext();
  // puzzle: candles / hidden switch
  const P = W.L.puz, Z = W.puz;
  if (P && Z && !Z.solved) {
    if (P.type === 'paint') {
      let best = -1, bd = 1e9; P.candles.forEach((c, i) => { if (Z.lit.indexOf(i) >= 0) return; if (!inCone(b, c.x, c.z, R + 1, A + 0.15)) return; const d = Math.abs(angDiff(b.ang, angTo(b.x, b.z, c.x, c.z))) * 3 + dist(b.x, b.z, c.x, c.z) * 0.2; if (d < bd) { bd = d; best = i; } });
      if (best >= 0) {
        if (P.cols[best] === Z.seq[Z.lit.length]) { Z.lit.push(best); out({ e: 'candle', i: best, ok: 1 }); if (Z.lit.length >= 3) solve(); }
        else { Z.lit = []; out({ e: 'candle', i: best, ok: 0 }); }
      }
    }
    if (P.type === 'dark' && Z.rev >= 1 && inCone(b, P.sw.x, P.sw.z, R + 1, A + 0.2)) solve();
  }
  if (W.boss && W.boss.bulbs) bulbFlash(b, R, A);
}
function doPlunge(b) {
  const R = TOOL.plR; let best = null, bd = 1e9;
  const cand = (x, z, fn, pri) => { if (!inCone(b, x, z, R, TOOL.plA)) return; const d = dist(b.x, b.z, x, z) - (pri || 0); if (d < bd) { bd = d; best = { x, z, fn }; } };
  for (const e of W.ents) {
    if (e.k === 'shades' && e.sh && e.st !== 'tug') cand(e.x, e.z, () => { e.sh = 0; out({ e: 'shadesoff', id: e.id, x: e.x, z: e.z }); stun(e, 1.2, 'plunge'); }, 2);
    if (e.k === 'armor' && !e.free && e.st !== 'tug') cand(e.x, e.z, () => { e.free = 1; e.sh = 0; out({ e: 'helmet', id: e.id, x: e.x, z: e.z }); stun(e, 3.2, 'plunge'); }, 2);
    if (e.k === 'boss' && e.b === 'souffle' && e.st === 'stuck') cand(e.x, e.z, () => { out({ e: 'hatoff', id: e.id, x: e.x, z: e.z }); bossOpen(e); }, 3);
  }
  const P = W.L.puz, Z = W.puz;
  if (P && Z && !Z.solved) {
    if (P.type === 'levers') P.levers.forEach((l, i) => cand(l.x, l.z, () => { Z.lv[i] = asst() ? 9 : 6; out({ e: 'lever', i }); }, 1));
    if (P.type === 'dark' && Z.rev >= 1) cand(P.sw.x, P.sw.z, () => solve(), 1);
    if (P.type === 'crate') cand(Z.cx, Z.cz, () => { const a = angTo(Z.cx, Z.cz, b.x, b.z); Z.vx = Math.sin(a) * 4.5; Z.vz = Math.cos(a) * 4.5; out({ e: 'pullc' }); });
    if (P.type === 'beam') P.mir.forEach((m, i) => cand(m.x, m.z, () => turnMirror(i), 0.5));
  }
  if (best) { out({ e: 'plunge', id: b.id, x: b.x, z: b.z, tx: best.x, tz: best.z }); best.fn(); }
  else out({ e: 'plunge', id: b.id, x: b.x, z: b.z, tx: b.x + Math.sin(b.ang) * 4, tz: b.z + Math.cos(b.ang) * 4, miss: 1 });
}
function turnMirror(i) { const Z = W.puz; if (Z.cd > 0 || Z.solved) return; Z.cd = 0.55; Z.o[i] = Z.o[i] === '/' ? '\\' : '/'; out({ e: 'mirror', i }); beamCheck(); }
function beamCheck() { const P = W.L.puz, Z = W.puz; const tr = SP.beamTrace({ em: P.em, tg: P.tg, mir: P.mir.map((m, i) => ({ x: m.x, z: m.z, o: Z.o[i] })) }, W.L.hw, W.L.hd); Z.hit = tr.hit ? 1 : 0; if (tr.hit) solve(); }
Sim.beamCheck = beamCheck;
function doSlam(b) {
  const e = W.ents.find((q) => q.st === 'tug' && q.cb.indexOf(b.id) >= 0); if (!e || e.slam < 1) return;
  e.slam = 0; const dmg = e.k === 'boss' ? Math.max(14, e.mhp * 0.1) : Math.max(15, e.mhp * 0.3);
  e.hp -= dmg; out({ e: 'slam', id: e.id, x: e.x, z: e.z, dmg: Math.round(dmg) });
  W.ents.forEach((o) => { if (o !== e && o.st !== 'tug' && dist(o.x, o.z, e.x, e.z) < 3.5 && o.k !== 'boss' && flashable(o, b) === true) stun(o, 2, 'slam'); });
  coins(e.x, e.z, 2, 5);
}
function solve() {
  const Z = W.puz; if (!Z || Z.solved) return; Z.solved = 1; W.chest = 1;
  const c = W.L.chest; out({ e: 'solved', x: c.x, z: c.z });
  if (W.def.key && !W.hasKey) pick('key', c.x, c.z + 0.6, 0, { a: W.def.a });
  const cg = W.L.gems.find((g) => g.how === 'chest'); if (cg) gemDrop(cg.gi, c.x, c.z + 0.6);
  coins(c.x, c.z + 0.5, 8, 5);
}
Sim.solve = solve;

/* continuous tools: vac / blow / dark */
function tools(dt) {
  const A = asst();
  for (const b of bodyList()) {
    if (b.down) { W.btug[b.id] = 0; continue; }
    const vR = Sim.vacR(b);
    // ---- VAC ----
    if (b.vac) {
      let tug = W.btug[b.id] && W.ents.find((e) => e.id === W.btug[b.id] && e.st === 'tug');
      if (!tug) {
        W.btug[b.id] = 0;
        // catch stunned ghosts / swarm / bones / bats
        let best = null, bd = 1e9;
        for (const e of W.ents) {
          const ok = e.st === 'stun' || e.st === 'open' || (e.k === 'swarm' && e.st !== 'spawn') || e.st === 'bones' || (e.st === 'tug');
          if (!ok || !inCone(b, e.x, e.z, vR + (e.k === 'boss' ? 1.5 : 0), TOOL.vacA)) continue;
          const d = dist(b.x, b.z, e.x, e.z); if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          if (best.st !== 'tug') { best.st = 'tug'; best.cb = []; best.pd = angTo(b.x, b.z, best.x, best.z) + rnd(-1, 1); best.pdT = 1; best.free = best.free || 0; best.noC = 0; out({ e: 'catch', id: best.id, k: best.k, pid: b.pid }); if (W.tut === 2) W.tutHint = 1; }
          if (best.cb.indexOf(b.id) < 0) best.cb.push(b.id);
          W.btug[b.id] = best.id; tug = best;
        }
      }
      if (!tug) {
        // catch projectiles -> ammo
        if (!W.ammo[b.id]) for (let i = W.proj.length - 1; i >= 0; i--) { const p = W.proj[i]; if (!p.refl && p.k !== 'orb' && inCone(b, p.x, p.z, vR, TOOL.vacA + 0.2)) { W.proj.splice(i, 1); W.ammo[b.id] = p.k; out({ e: 'ammo', pid: b.pid, k: p.k }); break; } }
        for (const e of W.ents) {
          if (!inCone(b, e.x, e.z, vR, TOOL.vacA)) continue;
          if (e.k === 'shieldy' && e.sh && e.st !== 'tug') { e.shv = (e.shv || 0) + dt; if (e.shv > 1) { e.sh = 0; out({ e: 'shieldoff', id: e.id, x: e.x, z: e.z }); stun(e, 1.4, 'vac'); } }
          if (e.k === 'mummy' && e.wrap > 0 && e.st !== 'tug') { e.wrap -= dt * (A ? 1 : 0.7); if (e.wrap <= 0) { e.wrap = 0; out({ e: 'unwrap', id: e.id, x: e.x, z: e.z }); stun(e, 3.2, 'vac'); } }
          if (e.k === 'boss') bossVac(e, b, dt);
        }
        // props
        W.L.props.forEach((p, i) => {
          const s = W.pr[i]; if (s.g) return;
          const pr = Math.max(p.w, p.d) / 2;
          if (!inCone(b, p.x, p.z, vR + pr * 0.6, TOOL.vacA + 0.1)) return;
          s.v = Math.min(1, s.v + dt * (p.t === 'furn' ? 1.3 : 1.7)); s.vt = W.t;
          if (s.v >= 0.5) flushProp(i);
          if (s.v >= 1 && !s.e) lootProp(i, b);
        });
        // revive teammate
        for (const o of bodyList()) if (o.down && o !== b && dist(b.x, b.z, o.x, o.z) < 2.6) { o.rv = (o.rv || 0) + dt * 1.6; }
      }
    } else if (W.btug[b.id]) W.btug[b.id] = 0;
    // ---- BLOW ----
    if (b.blow) {
      if (!b.blowPrev && W.ammo[b.id]) { // fire ammo
        const k = W.ammo[b.id]; W.ammo[b.id] = 0;
        W.proj.push({ id: nid(), k, x: b.x + Math.sin(b.ang) * 0.8, z: b.z + Math.cos(b.ang) * 0.8, vx: Math.sin(b.ang) * 13, vz: Math.cos(b.ang) * 13, refl: 1, life: 1.6, ow: b.id });
        out({ e: 'fire', pid: b.pid });
      }
      for (const p of W.proj) if (p.k === 'orb' && !p.refl && inCone(b, p.x, p.z, TOOL.blowR, TOOL.blowA + 0.2)) {
        const own = W.ents.find((e) => e.id === p.ow); const a = own ? angTo(p.x, p.z, own.x, own.z) : b.ang; p.vx = Math.sin(a) * 10; p.vz = Math.cos(a) * 10; p.refl = 1; p.life = 2.2; out({ e: 'reflect', x: p.x, z: p.z });
      }
      for (const e of W.ents) if (e.k === 'swarm' && e.st !== 'tug' && inCone(b, e.x, e.z, TOOL.blowR, TOOL.blowA)) { const a = angTo(b.x, b.z, e.x, e.z); e.x += Math.sin(a) * dt * 5; e.z += Math.cos(a) * dt * 5; if (e.st !== 'stun') stun(e, 1, 'blow'); }
      W.L.props.forEach((p, i) => { const s = W.pr[i]; if (s.g || p.t !== 'furn') return; if (inCone(b, p.x, p.z, TOOL.blowR, TOOL.blowA)) { s.bv = (s.bv || 0) + dt; s.vt = W.t; if (s.bv > 0.5) flushProp(i); } });
      const P = W.L.puz, Z = W.puz;
      if (P && Z && !Z.solved) {
        if (P.type === 'fan') P.fans.forEach((f, i) => { if (inCone(b, f.x, f.z, TOOL.blowR + 0.6, TOOL.blowA + 0.1)) { Z.fan[i] = Math.min(1, Z.fan[i] + dt * 0.5); Z.fanT[i] = W.t; } });
        if (P.type === 'crate' && inCone(b, Z.cx, Z.cz, TOOL.blowR, TOOL.blowA + 0.1)) { const a = angTo(b.x, b.z, Z.cx, Z.cz); Z.vx += Math.sin(a) * dt * 9; Z.vz += Math.cos(a) * dt * 9; const sp = Math.hypot(Z.vx, Z.vz); if (sp > 3.2) { Z.vx *= 3.2 / sp; Z.vz *= 3.2 / sp; } }
        if (P.type === 'beam' && Z.cd <= 0) { let bi = -1, bd = 1e9; P.mir.forEach((m, i) => { if (inCone(b, m.x, m.z, TOOL.blowR, TOOL.blowA)) { const d = dist(b.x, b.z, m.x, m.z); if (d < bd) { bd = d; bi = i; } } }); if (bi >= 0 && (!b.blowPrev || (b.blowHeld || 0) > 0.9)) { turnMirror(bi); b.blowHeld = 0; } }
      }
      b.blowHeld = (b.blowHeld || 0) + dt;
    } else b.blowHeld = 0;
    b.blowPrev = !!b.blow;
    // ---- DARK-LIGHT ----
    if (b.dark) {
      for (const e of W.ents) if (inCone(b, e.x, e.z, TOOL.darkR, TOOL.darkA)) { if (e.k === 'invis' && e.rev <= 0) out({ e: 'reveal', x: e.x, z: e.z }); e.rev = A ? 9 : 6.5; }
      W.L.doors.forEach((d, i) => { if (d.dark && !W.doorRev[i] && inCone(b, d.x, d.z, TOOL.darkR + 1, TOOL.darkA + 0.1)) { d.rp = (d.rp || 0) + dt; if (d.rp > 0.7) { W.doorRev[i] = 1; out({ e: 'doorrev', i }); if (W.tut === 4) tutNext(); } } });
      W.L.gems.forEach((g) => { if (g.how === 'dark' && !W.gemRev[g.gi] && inCone(b, g.x, g.z, TOOL.darkR, TOOL.darkA + 0.1)) { W.gemRev[g.gi] = 1; gemDrop(g.gi, g.x, g.z); out({ e: 'reveal', x: g.x, z: g.z }); } });
      const P = W.L.puz, Z = W.puz;
      if (P && P.type === 'dark' && Z.rev < 1 && inCone(b, P.sw.x, P.sw.z, TOOL.darkR, TOOL.darkA + 0.15)) { Z.rev = Math.min(1, Z.rev + dt * 1.5); if (Z.rev >= 1) out({ e: 'reveal', x: P.sw.x, z: P.sw.z, sw: 1 }); }
      if (W.boss && W.boss.bulbs) W.boss.bulbs.forEach((u) => { if (u.real && inCone(b, u.x, u.z, TOOL.darkR, TOOL.darkA + 0.1)) u.rev = 3; });
      if (W.booProp >= 0) { const p = W.L.props[W.booProp]; if (inCone(b, p.x, p.z, TOOL.darkR, TOOL.darkA)) W.booHint = W.t + 1.5; }
    }
  }
}

/* ---------------- tug of war ---------------- */
function tug(e, dt) {
  const A = asst();
  const cbs = e.cb.map((id) => W.bodies[id]).filter((b) => b && !b.down && b.vac && W.btug[b.id] === e.id && dist(b.x, b.z, e.x, e.z) < Sim.vacR(b) + 3.2);
  e.cb = cbs.map((b) => b.id);
  if (!cbs.length) { e.noC = (e.noC || 0) + dt; if (e.noC > 0.3) breakFree(e); return; }
  e.noC = 0;
  e.pdT -= dt; if (e.pdT <= 0) { const a0 = angTo(cbs[0].x, cbs[0].z, e.x, e.z); e.pd = a0 + rnd(-1.6, 1.6); e.pdT = rnd(1.1, 2); }
  const big = e.k === 'boss' || e.k === 'brute';
  let rate = 0, pulling = 0;
  for (const b of cbs) {
    const px = b.pull ? b.pull[0] : 0, pz = b.pull ? b.pull[1] : 0, m = Math.hypot(px, pz);
    const ok = m > 0.3 && (px * Math.sin(e.pd) + pz * Math.cos(e.pd)) / m < -0.3;
    if (ok) pulling++;
    rate += 12 * (1 + 0.35 * (b.uv || 0)) * (ok ? 2.3 : 1);
  }
  if (cbs.length > 1) rate *= 1.35;
  if (A) rate *= 1.5;
  if (big && cbs.length === 1) rate *= 0.8;
  e.hp -= rate * dt;
  e.pulling = pulling;
  e.slam = Math.min(1, e.slam + dt * (pulling ? 0.42 : 0.1) * (big ? 0.8 : 1));
  // drift while held, leashed to the nearest catcher
  const sp = big ? 1.1 : 1.6, c = cbs[0];
  e.x += Math.sin(e.pd) * sp * dt * (pulling ? 0.4 : 1); e.z += Math.cos(e.pd) * sp * dt * (pulling ? 0.4 : 1);
  const d = dist(c.x, c.z, e.x, e.z), lmax = Math.min(Sim.vacR(c) - 0.4, big ? 3.8 : 3.2), lmin = big ? 2.2 : 1.6;
  if (d > lmax) { const a = angTo(c.x, c.z, e.x, e.z); e.x = c.x + Math.sin(a) * lmax; e.z = c.z + Math.cos(a) * lmax; }
  if (d < lmin) { const a = angTo(c.x, c.z, e.x, e.z); e.x = c.x + Math.sin(a) * lmin; e.z = c.z + Math.cos(a) * lmin; }
  clampIn(e, 0.7);
  if (e.k === 'boss' && e.mhp * (e.ph === 3 ? 0 : (e.ph === 1 ? 0.66 : 0.33)) > e.hp && e.hp > 0) { bossBreak(e); return; }
  if (e.k === 'boss') { e.tt = (e.tt || 0) + dt; if (e.tt > (A ? 10 : 7.5)) { bossBreak(e); return; } }
  if (e.hp <= 0) capture(e, cbs);
}
function breakFree(e) {
  if (e.k === 'boss') { bossBreak(e); return; }
  e.st = e.k === 'skeleton' ? 'move' : 'flee'; e.t = 1.2; e.cb = []; e.slam *= 0.5; out({ e: 'free', id: e.id });
  if (e.k === 'skeleton') { e.st = 'move'; e.hp = e.mhp; }
}
function capture(e, cbs) {
  W.ents.splice(W.ents.indexOf(e), 1); cbs.forEach((b) => { W.btug[b.id] = 0; });
  if (e.k === 'boss') { bossDown(e); return; }
  const d = EN[e.k] || EN.goob; const n = Math.max(1, Math.round(d.coins / 5));
  coins(e.x, e.z, Math.min(n, 8), n > 8 ? 10 : 5);
  if (Math.random() < (asst() ? 0.4 : 0.25) && e.k !== 'swarm') pick('heart', e.x, e.z);
  out({ e: 'cap', k: e.k, x: e.x, z: e.z, pids: cbs.map((b) => b.pid) });
  if (e.k === 'boo') { W.booDone = true; out({ e: 'boocap', a: W.def.a }); }
  if (W.tut === 2) tutNext();
}

/* ---------------- enemy AI ---------------- */
function steer(e, tx, tz, sp, dt, acc) {
  const a = angTo(e.x, e.z, tx, tz), d = dist(e.x, e.z, tx, tz);
  const vx = d > 0.05 ? Math.sin(a) * sp : 0, vz = d > 0.05 ? Math.cos(a) * sp : 0, k = Math.min(1, dt * (acc || 4));
  e.vx += (vx - e.vx) * k; e.vz += (vz - e.vz) * k;
}
function moveEnt(e, dt) {
  e.x += e.vx * dt; e.z += e.vz * dt;
  const d = EN[e.k]; if (d && d.walk) { const r = SP.collide(e.x, e.z, d.r, { doors: false }); e.x = r.x; e.z = r.z; }
  clampIn(e, 0.6);
  if (Math.hypot(e.vx, e.vz) > 0.2) e.ang = Math.atan2(e.vx, e.vz);
}
function face(e, b) { if (b) e.ang = angTo(e.x, e.z, b.x, b.z); }
function contact(e, r, dmg) { for (const b of alive()) if (dist(e.x, e.z, b.x, b.z) < r) hurt(b, dmg, e.x, e.z); }
function lungeAI(e, dt, sp, tgt) {
  const b = tgt || nearestBody(e.x, e.z); if (!b) { e.vx *= 0.9; e.vz *= 0.9; return; }
  const d = dist(e.x, e.z, b.x, b.z);
  if (e.st === 'move' || e.st === 'flee') {
    if (e.st === 'flee') { const a = angTo(b.x, b.z, e.x, e.z); steer(e, e.x + Math.sin(a) * 3, e.z + Math.cos(a) * 3, sp * 1.6, dt); e.t -= dt; if (e.t <= 0) e.st = 'move'; return; }
    const orb = W.t * 0.6 + e.id; const tx = b.x + Math.sin(orb) * 2.2, tz = b.z + Math.cos(orb) * 2.2;
    steer(e, tx, tz, sp, dt); e.cd -= dt;
    if (d < 3 && e.cd <= 0) { e.st = 'wind'; e.t = asst() ? 0.9 : 0.65; e.tx = b.x; e.tz = b.z; face(e, b); }
  } else if (e.st === 'wind') { e.vx *= 0.85; e.vz *= 0.85; e.t -= dt; if (e.t <= 0) { e.st = 'atk'; e.t = 0.4; const a = angTo(e.x, e.z, e.tx, e.tz); e.vx = Math.sin(a) * 7; e.vz = Math.cos(a) * 7; } }
  else if (e.st === 'atk') { contact(e, (EN[e.k] || EN.goob).r + 0.45, 1); e.t -= dt; if (e.t <= 0) { e.st = 'move'; e.cd = rnd(1.6, 2.8); e.vx *= 0.3; e.vz *= 0.3; } }
}
const AI = {
  goob(e, dt) { lungeAI(e, dt, EN.goob.sp); },
  shades(e, dt) { lungeAI(e, dt, EN.shades.sp); },
  shieldy(e, dt) { lungeAI(e, dt, EN.shieldy.sp); const b = nearestBody(e.x, e.z); if (b && e.st === 'move') face(e, b); },
  invis(e, dt) { lungeAI(e, dt, EN.invis.sp); },
  hider(e, dt) {
    if (e.st === 'hide') { const p = W.L.props[e.hid]; if (p) { e.x = p.x; e.z = p.z; } e.t -= dt; if (e.t <= 0) { e.st = 'move'; e.out = rnd(6, 9); e.hid = -1; out({ e: 'pop', x: e.x, z: e.z }); } return; }
    lungeAI(e, dt, EN.hider.sp);
    if (e.st === 'move') { e.out -= dt; if (e.out <= 0) { const hp = W.L.hideProps.filter((i) => !W.ents.some((o) => o.hid === i)); if (hp.length) { const i = hp[Math.random() * hp.length | 0]; const p = W.L.props[i]; steer(e, p.x, p.z, 4, dt, 8); if (dist(e.x, e.z, p.x, p.z) < 0.8) { e.st = 'hide'; e.hid = i; e.t = rnd(5, 8); } } else e.out = 5; } }
  },
  slammer(e, dt) {
    const b = nearestBody(e.x, e.z); if (!b) return;
    if (e.st === 'move') { const a = angTo(b.x, b.z, e.x, e.z) + 0.6; steer(e, b.x + Math.sin(a) * 5, b.z + Math.cos(a) * 5, EN.slammer.sp, dt); e.cd -= dt; if (e.cd <= 0 && dist(e.x, e.z, b.x, b.z) < 9) { e.st = 'wind'; e.t = asst() ? 1.3 : 1.0; face(e, b); const a2 = e.ang; W.tele.push({ id: nid(), k: 'line', x: e.x, z: e.z, x2: e.x + Math.sin(a2) * 10, z2: e.z + Math.cos(a2) * 10, w: 0.9, t: e.t, own: e.id, dmg: 0 }); } }
    else if (e.st === 'wind') { e.vx *= 0.8; e.vz *= 0.8; e.t -= dt; if (e.t <= 0) { e.st = 'atk'; e.t = 1.0; e.vx = Math.sin(e.ang) * 10; e.vz = Math.cos(e.ang) * 10; } }
    else if (e.st === 'atk') { contact(e, 1.0, 2); e.t -= dt; if (e.t <= 0) { e.st = 'rest'; e.t = 1.2; e.vx = e.vz = 0; } }
    else if (e.st === 'rest') { e.t -= dt; if (e.t <= 0) { e.st = 'move'; e.cd = rnd(2, 3.5); } }
    else if (e.st === 'flee') { e.t -= dt; if (e.t <= 0) e.st = 'move'; }
  },
  bat(e, dt) {
    const b = nearestBody(e.x, e.z); if (!b) return;
    e.y = 1.2 + Math.sin(W.t * 6 + e.id) * 0.25;
    if (e.st === 'move' || e.st === 'flee') { const a = W.t * 1.7 + e.id * 2; steer(e, b.x + Math.sin(a) * 3, b.z + Math.cos(a) * 3, EN.bat.sp, dt, 3); e.cd -= dt; if (e.cd <= 0) { e.st = 'wind'; e.t = 0.5; e.tx = b.x; e.tz = b.z; } if (e.st === 'flee') { e.t -= dt; if (e.t <= 0) e.st = 'move'; } }
    else if (e.st === 'wind') { e.vx *= 0.8; e.vz *= 0.8; e.t -= dt; if (e.t <= 0) { e.st = 'atk'; e.t = 0.45; const a = angTo(e.x, e.z, e.tx, e.tz); e.vx = Math.sin(a) * 8; e.vz = Math.cos(a) * 8; } }
    else if (e.st === 'atk') { contact(e, 0.8, 1); e.t -= dt; if (e.t <= 0) { e.st = 'move'; e.cd = rnd(2, 3.5); } }
  },
  polter(e, dt) {
    const b = nearestBody(e.x, e.z); if (!b) return;
    if (e.st === 'move' || e.st === 'flee') { const a = angTo(b.x, b.z, e.x, e.z) + Math.sin(W.t * 0.4 + e.id) * 0.8; steer(e, b.x + Math.sin(a) * 6, b.z + Math.cos(a) * 6, EN.polter.sp, dt); e.cd -= dt; if (e.cd <= 0) { e.st = 'wind'; e.t = asst() ? 1.1 : 0.85; face(e, b); } if (e.st === 'flee') { e.t -= dt; if (e.t <= 0) e.st = 'move'; } }
    else if (e.st === 'wind') { e.vx *= 0.8; e.vz *= 0.8; face(e, b); e.t -= dt; if (e.t <= 0) { e.st = 'move'; e.cd = rnd(2.6, 3.6); const a = angTo(e.x, e.z, b.x, b.z); W.proj.push({ id: nid(), k: W.def.a === 2 ? 'pot' : W.def.a === 1 ? 'book' : 'obj', x: e.x, z: e.z, vx: Math.sin(a) * 6.5, vz: Math.cos(a) * 6.5, refl: 0, life: 3, ow: e.id }); out({ e: 'throw', x: e.x, z: e.z }); } }
  },
  mummy(e, dt) { walkerAI(e, dt, e.wrap > 0 ? EN.mummy.sp : 1.6, 1.6, 1); },
  skeleton(e, dt) {
    if (e.st === 'bones') { e.vx = e.vz = 0; e.t -= dt; if (e.t <= 0) { e.st = 'move'; e.hp = e.mhp; out({ e: 'rebuild', x: e.x, z: e.z }); } return; }
    walkerAI(e, dt, EN.skeleton.sp, 1.6, 1);
  },
  armor(e, dt) {
    if (e.free) { lungeAI(e, dt, 1.8); return; }
    const b = nearestBody(e.x, e.z); if (!b) return;
    if (e.st === 'move' || e.st === 'flee') { steer(e, b.x, b.z, EN.armor.sp, dt); face(e, b); e.cd -= dt; if (dist(e.x, e.z, b.x, b.z) < 2.6 && e.cd <= 0) { e.st = 'wind'; e.t = asst() ? 1.25 : 0.95; W.tele.push({ id: nid(), k: 'ring', x: e.x, z: e.z, r: 2.4, t: e.t, own: e.id, dmg: 2, fol: 1 }); } if (e.st === 'flee') e.st = 'move'; }
    else if (e.st === 'wind') { e.vx = e.vz = 0; e.t -= dt; if (e.t <= 0) { e.st = 'stuck'; e.t = 1.4; out({ e: 'swing', x: e.x, z: e.z }); } }
    else if (e.st === 'stuck') { e.t -= dt; if (e.t <= 0) { e.st = 'move'; e.cd = rnd(1.2, 2); } }
  },
  witch(e, dt) {
    const b = nearestBody(e.x, e.z); if (!b) return;
    if (e.st === 'move' || e.st === 'flee') {
      const a = angTo(b.x, b.z, e.x, e.z) + Math.sin(W.t * 0.3 + e.id); steer(e, b.x + Math.sin(a) * 6, b.z + Math.cos(a) * 6, EN.witch.sp, dt); face(e, b);
      e.cd -= dt; e.tp = (e.tp || 7) - dt;
      if (e.tp <= 0) { e.tp = rnd(6, 9); const p = spawnPoint(4); out({ e: 'tp', x: e.x, z: e.z }); e.x = p.x; e.z = p.z; out({ e: 'tp', x: e.x, z: e.z }); }
      if (e.cd <= 0) { e.st = 'cast'; e.t = asst() ? 1.6 : 1.25; e.casts = (e.casts || 0) + 1; }
      if (e.st === 'flee') { e.t -= dt; if (e.t <= 0) e.st = 'move'; }
    } else if (e.st === 'cast') {
      e.vx *= 0.8; e.vz *= 0.8; face(e, b); e.t -= dt;
      if (e.t <= 0) {
        e.st = 'move'; e.cd = rnd(3.2, 4.2);
        if (e.casts % 3 === 0 && W.ents.filter((q) => q.k === 'swarm').length < 4) { for (let i = 0; i < 3; i++) mkEnt('swarm', e.x + rnd(-1, 1), e.z + rnd(-1, 1), { wv: e.wv }); out({ e: 'summon', x: e.x, z: e.z }); }
        else { const a = angTo(e.x, e.z, b.x, b.z); W.proj.push({ id: nid(), k: 'orb', x: e.x, z: e.z, vx: Math.sin(a) * 3.6, vz: Math.cos(a) * 3.6, refl: 0, life: 5, ow: e.id, home: b.id }); out({ e: 'cast', x: e.x, z: e.z }); }
      }
    }
  },
  swarm(e, dt) {
    const b = nearestBody(e.x, e.z); if (!b) return;
    if (e.st === 'move' || e.st === 'flee') { const j = Math.sin(W.t * 5 + e.id * 3); steer(e, b.x + j, b.z + Math.cos(W.t * 4 + e.id), EN.swarm.sp, dt, 3); e.cd -= dt; if (e.cd <= 0 && dist(e.x, e.z, b.x, b.z) < 0.8) { hurt(b, 1, e.x, e.z); e.cd = 2.5; } if (e.st === 'flee') e.st = 'move'; }
  },
  brute(e, dt) {
    const b = nearestBody(e.x, e.z); if (!b) return;
    if (e.st === 'move' || e.st === 'flee') { steer(e, b.x, b.z, EN.brute.sp, dt); face(e, b); e.cd -= dt; if (dist(e.x, e.z, b.x, b.z) < 3.4 && e.cd <= 0) { e.st = 'wind'; e.t = asst() ? 1.7 : 1.3; W.tele.push({ id: nid(), k: 'ring', x: e.x, z: e.z, r: 3.4, t: e.t, own: e.id, dmg: 2, fol: 1 }); } if (e.st === 'flee') { e.t -= dt; if (e.t <= 0) e.st = 'move'; } }
    else if (e.st === 'wind') { e.vx = e.vz = 0; e.t -= dt; if (e.t <= 0) { e.st = 'tired'; e.t = asst() ? 5 : 3.6; out({ e: 'quake', x: e.x, z: e.z }); } }
    else if (e.st === 'tired') { e.t -= dt; if (e.t <= 0) { e.st = 'move'; e.cd = rnd(1.5, 2.5); } }
  },
  boo(e, dt) {
    const b = nearestBody(e.x, e.z); if (!b) return;
    if (e.st === 'flee' || e.st === 'move') { const a = angTo(b.x, b.z, e.x, e.z) + Math.sin(W.t + e.id) * 1.2; steer(e, e.x + Math.sin(a) * 3, e.z + Math.cos(a) * 3, EN.boo.sp, dt, 2.5); e.t -= dt; if (e.t <= 0) { e.st = 'face'; e.t = asst() ? 2 : 1.4; out({ e: 'boolaugh', x: e.x, z: e.z }); } }
    else if (e.st === 'face') { e.vx *= 0.8; e.vz *= 0.8; face(e, b); e.t -= dt; if (e.t <= 0) { e.st = 'flee'; e.t = rnd(2, 3.2); } }
  },
  tutor(e, dt) { const b = nearestBody(e.x, e.z); if (e.st === 'move' || e.st === 'flee') { const a = W.t * 0.4; steer(e, Math.sin(a) * 3, -2 + Math.cos(a) * 1.5, 1, dt); if (b) face(e, b); if (e.st === 'flee') { e.t -= dt; if (e.t <= 0) e.st = 'move'; } } }
};
function walkerAI(e, dt, sp, reach, dmg) {
  const b = nearestBody(e.x, e.z); if (!b) return;
  if (e.st === 'move' || e.st === 'flee') { steer(e, b.x, b.z, sp, dt); e.cd -= dt; if (dist(e.x, e.z, b.x, b.z) < reach && e.cd <= 0) { e.st = 'wind'; e.t = asst() ? 0.95 : 0.7; face(e, b); } if (e.st === 'flee') { e.t -= dt; if (e.t <= 0) e.st = 'move'; } }
  else if (e.st === 'wind') { e.vx *= 0.7; e.vz *= 0.7; e.t -= dt; if (e.t <= 0) { e.st = 'atk'; e.t = 0.3; for (const o of alive()) if (dist(e.x, e.z, o.x, o.z) < reach + 0.4 && Math.abs(angDiff(e.ang, angTo(e.x, e.z, o.x, o.z))) < 1.2) hurt(o, dmg, e.x, e.z); } }
  else if (e.st === 'atk') { e.t -= dt; if (e.t <= 0) { e.st = 'move'; e.cd = rnd(1.2, 2.2); } }
}
function entStep(e, dt) {
  if (e.rev > 0) e.rev -= dt;
  if (e.st === 'spawn') { e.t -= dt; if (e.t <= 0) e.st = e.k === 'boo' ? 'flee' : 'move'; return; }
  if (e.st === 'tug') { tug(e, dt); return; }
  if (e.st === 'stun' || e.st === 'open') { e.vx *= 0.8; e.vz *= 0.8; moveEnt(e, dt); e.t -= dt; if (e.t <= 0) { if (e.k === 'boss') bossBreak(e, true); else { e.st = 'move'; e.cd = rnd(0.8, 1.6); } } return; }
  if (e.k === 'boss') { bossStep(e, dt); return; }
  (AI[e.tut ? 'tutor' : e.k] || AI.goob)(e, dt);
  if (e.st !== 'hide' && e.st !== 'bones') moveEnt(e, dt);
}

/* ---------------- bosses ---------------- */
function bossFlash(e) {
  if (e.st === 'dizzy' || e.st === 'exposed') return true;
  if (e.b === 'mandrake') return 'bulb';
  return 'boss';
}
function bossOpen(e) { if (e.st === 'open' || e.st === 'tug') return; e.st = 'open'; e.t = asst() ? 7 : 5; e.tt = 0; e.vx = e.vz = 0; W.tele = W.tele.filter((t) => t.own !== e.id); out({ e: 'bossopen', x: e.x, z: e.z }); if (e.bulbs) e.bulbs = null; }
Sim.bossOpen = bossOpen;
function bossBreak(e, timeout) {
  e.cb.forEach((id) => { W.btug[id] = 0; }); e.cb = []; e.tt = 0; e.slam *= 0.5;
  e.ph = e.hp < e.mhp * 0.34 ? 3 : e.hp < e.mhp * 0.67 ? 2 : 1;
  e.st = 'recover'; e.t = 1.4; e.wrap = 1; e.cnt = 0; out({ e: 'bossfree', x: e.x, z: e.z, ph: e.ph, timeout: !!timeout });
}
function bossDown(e) {
  W.boss = null; W.bossBeaten = true; W.tele = []; W.proj = [];
  W.ents.filter((q) => q.wv).forEach((q) => { out({ e: 'poof', x: q.x, z: q.z }); }); W.ents = W.ents.filter((q) => !q.wv);
  coins(e.x, e.z, 16, 10); for (let i = 0; i < 3; i++) pick('gold', e.x, e.z, 100); pick('heart', e.x, e.z); pick('heart', e.x, e.z);
  out({ e: 'bossdown', b: e.b, a: W.def.a, x: e.x, z: e.z });
  W.elevBoss = 1; clearRoom();
}
function bvec(e) { const b = nearestBody(e.x, e.z); return b; }
function lineTele(e, ang, len, t, w, dmg) { W.tele.push({ id: nid(), k: 'line', x: e.x, z: e.z, x2: e.x + Math.sin(ang) * len, z2: e.z + Math.cos(ang) * len, w: w || 1.1, t, own: e.id, dmg: dmg || 0 }); }
function ringTele(x, z, r, t, dmg, own, fol) { W.tele.push({ id: nid(), k: 'ring', x, z, r, t, own, dmg, fol }); }
function bossVac(e, b, dt) { if (e.b === 'mumbles' && e.st === 'rest' && e.wrap > 0) { e.wrap -= dt * (asst() ? 1 : 0.65); if (e.wrap <= 0) { e.wrap = 0; e.st = 'exposed'; e.t = asst() ? 5 : 3.5; out({ e: 'unwrap', id: e.id, x: e.x, z: e.z }); } } }
function bulbFlash(b, R, A) {
  const e = W.boss; for (const u of e.bulbs) { if (u.pop || !inCone(b, u.x, u.z, R + 1, A + 0.1)) continue; if (u.real) { out({ e: 'bulb', x: u.x, z: u.z, real: 1 }); e.x = u.x; e.z = u.z; bossOpen(e); return; } u.pop = 1; out({ e: 'bulb', x: u.x, z: u.z }); ringTele(u.x, u.z, 1.8, 0.8, 1, e.id); return; }
}
function summon(k, n, e) { const cur = W.ents.filter((q) => q.k === k && q.wv === 2).length; for (let i = cur; i < n; i++) { const p = spawnPoint(4); mkEnt(k, p.x, p.z, { wv: 2 }); } out({ e: 'summon', x: e.x, z: e.z }); }
function bossStep(e, dt) {
  const A = asst(), sp = (A ? 0.8 : 1) * (1 + (e.ph - 1) * 0.15), tl = (A ? 1.35 : 1) * (e.ph === 3 ? 0.85 : 1);
  e.t -= dt; const b = bvec(e);
  if (e.st === 'intro') { if (e.t <= 0) { e.st = 'idle'; e.t = 0.6; } return; }
  if (e.st === 'recover') { e.vx *= 0.9; e.vz *= 0.9; moveEnt(e, dt); if (e.t <= 0) { e.st = 'idle'; e.t = 0.6; } return; }
  if (!b) return;
  // touch damage
  if (['dash', 'idle', 'pound'].indexOf(e.st) >= 0 || e.b !== 'mandrake') { for (const o of alive()) if (dist(e.x, e.z, o.x, o.z) < 1.4 && e.st !== 'dizzy' && e.st !== 'stuck' && e.st !== 'rest' && e.st !== 'exposed') hurt(o, 1, e.x, e.z); }
  switch (e.b) {
    case 'waltzy': case 'grumbleton': {
      if (e.st === 'idle') { steer(e, b.x * 0.4, b.z * 0.4 - 2, 2 * sp, dt); moveEnt(e, dt); if (e.t <= 0) {
        const pat = e.b === 'waltzy' ? 'dash' : ['orbs', 'dash', e.ph >= 2 ? 'rings' : 'orbs'][e.pat++ % 3];
        if (pat === 'dash') { e.st = 'aim'; e.t = 1.0 * tl; face(e, b); lineTele(e, e.ang, 15, e.t, 1.2, 0); }
        else if (pat === 'orbs') { e.st = 'orbs'; e.t = 0.6; e.cnt = e.ph === 3 ? 4 : 3; }
        else { e.st = 'rings'; e.t = 1.4 * tl; alive().forEach((o) => ringTele(o.x, o.z, 2, e.t, 2, e.id)); summon(e.ph === 3 ? 'skeleton' : 'goob', 2, e); }
      } }
      else if (e.st === 'aim') { e.vx = e.vz = 0; if (e.t <= 0) { e.st = 'dash'; e.t = 1.25; e.vx = Math.sin(e.ang) * 12 * sp; e.vz = Math.cos(e.ang) * 12 * sp; } }
      else if (e.st === 'dash') { e.x += e.vx * dt; e.z += e.vz * dt; const L = W.L; if (Math.abs(e.x) > L.hw - 1.2 || Math.abs(e.z) > L.hd - 1.2 || e.t <= 0) { clampIn(e, 1.2); e.cnt++; e.vx = e.vz = 0; if (e.cnt >= 3) { e.st = 'dizzy'; e.t = (A ? 5 : 3.8); e.cnt = 0; out({ e: 'dizzy', x: e.x, z: e.z }); } else { e.st = 'aim'; e.t = 0.85 * tl; face(e, bvec(e) || b); lineTele(e, e.ang, 15, e.t, 1.2, 0); } } }
      else if (e.st === 'dizzy') { e.vx = e.vz = 0; if (e.t <= 0) { e.st = 'idle'; e.t = 1; if (e.b === 'waltzy' && e.ph >= 2) summon('goob', e.ph, e); } }
      else if (e.st === 'orbs') { e.vx *= 0.9; e.vz *= 0.9; if (e.t <= 0) { if (e.cnt-- > 0) { const tb = bvec(e); const a = angTo(e.x, e.z, tb.x, tb.z); W.proj.push({ id: nid(), k: 'orb', x: e.x, z: e.z, vx: Math.sin(a) * 3.4, vz: Math.cos(a) * 3.4, refl: 0, life: 6, ow: e.id, home: tb.id, big: 1 }); out({ e: 'cast', x: e.x, z: e.z }); e.t = 1.3 * tl; } else { e.st = 'idle'; e.t = 1.6; } } }
      else if (e.st === 'rings') { if (e.t <= 0) { e.st = 'idle'; e.t = 1.4; } }
      break;
    }
    case 'pagewhirl': {
      if (e.st === 'idle') { const a = W.t * 0.5; steer(e, Math.sin(a) * 5, -2 + Math.cos(a) * 2.5, 2 * sp, dt); moveEnt(e, dt); if (dist(e.x, e.z, b.x, b.z) < 3 && !W.tele.some((t) => t.own === e.id)) { e.st = 'slamw'; e.t = 1.2 * tl; ringTele(e.x, e.z, 3.6, e.t, 2, e.id, 1); } else if (e.t <= 0) { e.st = 'fanw'; e.t = 0.95 * tl; face(e, b); const n = e.ph === 1 ? 3 : 5; e.fan = []; for (let i = 0; i < n; i++) { const a2 = e.ang + (i - (n - 1) / 2) * 0.32; e.fan.push(a2); lineTele(e, a2, 12, e.t, 0.7, 0); } } }
      else if (e.st === 'fanw') { e.vx = e.vz = 0; if (e.t <= 0) { e.fan.forEach((a2) => W.proj.push({ id: nid(), k: 'book', x: e.x, z: e.z, vx: Math.sin(a2) * 7, vz: Math.cos(a2) * 7, refl: 0, life: 2.4, ow: e.id })); out({ e: 'throw', x: e.x, z: e.z }); e.st = 'idle'; e.t = 2.6 * tl; } }
      else if (e.st === 'slamw') { e.vx = e.vz = 0; if (e.t <= 0) { e.st = 'idle'; e.t = 1.2; out({ e: 'quake', x: e.x, z: e.z }); } }
      break;
    }
    case 'souffle': {
      if (e.st === 'idle') { steer(e, b.x, b.z, 1.6 * sp, dt); moveEnt(e, dt); face(e, b); if (e.t <= 0) { e.cnt++; if (e.cnt % 2) { e.st = 'pots'; e.t = 1.1 * tl; const n = 2 + e.ph; alive().forEach((o) => ringTele(o.x, o.z, 1.5, e.t, 2, e.id)); for (let i = 1; i < n; i++) { const p = spawnPoint(0); ringTele(p.x, p.z, 1.5, e.t, 2, e.id); } out({ e: 'throw', x: e.x, z: e.z }); } else { e.st = 'pound'; e.t = 1.3 * tl; ringTele(e.x, e.z, 4, e.t, 2, e.id, 1); } } }
      else if (e.st === 'pots') { e.vx *= 0.8; e.vz *= 0.8; if (e.t <= 0) { e.st = 'idle'; e.t = 1.3; } }
      else if (e.st === 'pound') { e.vx = e.vz = 0; if (e.t <= 0) { e.st = 'stuck'; e.t = A ? 6 : 4.5; out({ e: 'quake', x: e.x, z: e.z }); out({ e: 'stuckhat', x: e.x, z: e.z }); } }
      else if (e.st === 'stuck') { if (e.t <= 0) { e.st = 'idle'; e.t = 1; if (e.ph >= 2) summon('swarm', 3, e); } }
      break;
    }
    case 'mandrake': {
      e.vx = e.vz = 0; e.x += (0 - e.x) * dt * 2; e.z += (-1 - e.z) * dt * 2;
      if (!e.bulbs && (e.st === 'idle' || e.st === 'vines')) { const real = Math.random() * 3 | 0; e.bulbs = [0, 1, 2].map((i) => { const a = i * TAU / 3 + Math.random(); return { x: Math.sin(a) * 5.5, z: -1 + Math.cos(a) * 4.2, real: i === real ? 1 : 0, rev: 0, pop: 0 }; }); out({ e: 'bulbs' }); }
      if (e.bulbs) { e.bulbs.forEach((u) => { if (u.rev > 0) u.rev -= dt; }); if (e.bulbs.every((u) => u.pop || u.real) && e.bulbs.filter((u) => u.pop).length >= 2) {/* only real left */} }
      if (e.st === 'idle') { if (e.t <= 0) { e.st = 'vines'; e.t = 1.15 * tl; alive().forEach((o) => { const a = angTo(e.x, e.z, o.x, o.z); lineTele(e, a, 12, e.t, 1.1, 2); }); if (e.ph >= 2) { const a = Math.random() * TAU; lineTele(e, a, 12, e.t, 1.1, 2); } } }
      else if (e.st === 'vines') { if (e.t <= 0) { e.st = 'idle'; e.t = 2.4 * tl; if (e.ph >= 3 && Math.random() < 0.5) summon('bat', 2, e); } }
      break;
    }
    case 'mumbles': {
      if (e.st === 'idle') { steer(e, b.x * 0.5, b.z * 0.5, 1.1 * sp, dt); moveEnt(e, dt); face(e, b); if (e.t <= 0) { e.st = 'beam'; e.t = 1.25 * tl; face(e, b); lineTele(e, e.ang, 18, e.t, 1.2, 2); if (e.ph >= 2) { lineTele(e, e.ang + 0.6, 18, e.t, 1.2, 2); lineTele(e, e.ang - 0.6, 18, e.t, 1.2, 2); } } }
      else if (e.st === 'beam') { e.vx = e.vz = 0; if (e.t <= 0) { e.st = 'rest'; e.t = A ? 6 : 4.5; e.wrap = 1; out({ e: 'rest', x: e.x, z: e.z }); if (e.ph >= 2) summon('mummy', e.ph - 1, e); } }
      else if (e.st === 'rest') { e.vx = e.vz = 0; if (e.t <= 0) { e.st = 'idle'; e.t = 1.5; } }
      else if (e.st === 'exposed') { e.vx = e.vz = 0; if (e.t <= 0) { e.st = 'idle'; e.t = 1; e.wrap = 1; } }
      break;
    }
  }
}

/* ---------------- projectiles / telegraphs / pickups / puzzle ---------------- */
function projStep(dt) {
  const L = W.L;
  for (let i = W.proj.length - 1; i >= 0; i--) {
    const p = W.proj[i]; p.life -= dt;
    if (p.home && !p.refl) { const tb = W.bodies[p.home]; if (tb && !tb.down) { const a = angTo(p.x, p.z, tb.x, tb.z), sp = Math.hypot(p.vx, p.vz); const cur = Math.atan2(p.vx, p.vz); const na = cur + Math.max(-1.2 * dt, Math.min(1.2 * dt, angDiff(cur, a))); p.vx = Math.sin(na) * sp; p.vz = Math.cos(na) * sp; } }
    p.x += p.vx * dt; p.z += p.vz * dt;
    let dead = p.life <= 0 || Math.abs(p.x) > L.hw - 0.2 || Math.abs(p.z) > L.hd - 0.2;
    if (!dead && !p.refl) for (const b of alive()) if (dist(p.x, p.z, b.x, b.z) < (p.big ? 0.9 : 0.65)) { hurt(b, p.k === 'orb' && p.big ? 2 : 1, p.x, p.z); dead = true; break; }
    if (!dead && p.refl) for (const e of W.ents) {
      if (e.st === 'tug' || e.st === 'hide') continue;
      const r = e.k === 'boss' ? 1.6 : (EN[e.k] || EN.goob).r + 0.45; if (dist(p.x, p.z, e.x, e.z) > r) continue;
      if (e.k === 'boss') { if (e.b === 'pagewhirl' || e.b === 'grumbleton') bossOpen(e); else out({ e: 'block', why: 'boss' }); }
      else if (e.k === 'armor' && !e.free) { out({ e: 'clang', x: e.x, z: e.z }); }
      else { if (e.k === 'skeleton') { e.st = 'bones'; e.t = 5; } else { e.sh = 0; e.wrap = 0; stun(e, 3.2, 'hit'); } }
      dead = true; break;
    }
    if (dead) { W.proj.splice(i, 1); out({ e: 'break', k: p.k, x: p.x, z: p.z }); }
  }
}
function teleStep(dt) {
  for (let i = W.tele.length - 1; i >= 0; i--) {
    const t = W.tele[i]; t.t -= dt;
    if (t.fol) { const o = W.ents.find((e) => e.id === t.own); if (o) { t.x = o.x; t.z = o.z; } }
    if (t.t > 0) continue;
    if (t.dmg) for (const b of alive()) {
      let inside = false;
      if (t.k === 'ring') inside = dist(b.x, b.z, t.x, t.z) < t.r;
      else { const vx = t.x2 - t.x, vz = t.z2 - t.z, l2 = vx * vx + vz * vz; const u = Math.max(0, Math.min(1, ((b.x - t.x) * vx + (b.z - t.z) * vz) / l2)); inside = dist(b.x, b.z, t.x + vx * u, t.z + vz * u) < t.w; }
      if (inside) hurt(b, t.dmg, t.x, t.z);
    }
    out({ e: 'tele', k: t.k, x: t.x, z: t.z, r: t.r, dmg: t.dmg }); W.tele.splice(i, 1);
  }
}
function pickStep(dt) {
  const L = W.L;
  for (let i = W.picks.length - 1; i >= 0; i--) {
    const p = W.picks[i]; p.age += dt;
    if (p.y > 0.35 || p.vy > 0) { p.vy -= 12 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.z += p.vz * dt; if (p.y < 0.35) { p.y = 0.35; p.vy = 0; p.vx = p.vz = 0; } }
    p.x = Math.max(-L.hw + 0.5, Math.min(L.hw - 0.5, p.x)); p.z = Math.max(-L.hd + 0.5, Math.min(L.hd - 0.5, p.z));
    if (p.age < 0.35) continue;
    let got = null;
    for (const b of alive()) {
      const d = dist(p.x, p.z, b.x, b.z), mag = 1.2 + 1.3 * (b.um || 0) + (W.cleared ? 1 : 0);
      if (d < 0.85) { got = b; break; }
      const pull = (b.vac && inCone(b, p.x, p.z, Sim.vacR(b) + 1, TOOL.vacA + 0.2)) || (p.k !== 'gem' && p.k !== 'key' && d < mag);
      if (pull) { const a = angTo(p.x, p.z, b.x, b.z); p.x += Math.sin(a) * dt * 7; p.z += Math.cos(a) * dt * 7; }
    }
    if (got) {
      W.picks.splice(i, 1);
      if (p.k === 'gem') W.taken['g' + W.def.a + '_' + p.gi] = 1;
      if (p.k === 'key') { W.hasKey = true; W.keyGot = true; }
      API.collect(got, p);
    }
  }
}
function puzStep(dt) {
  const P = W.L.puz, Z = W.puz; if (!P || !Z) return;
  if (Z.cd > 0) Z.cd -= dt;
  if (Z.solved) return;
  if (P.type === 'plates') {
    Z.occ = P.plates.map((pl) => alive().some((b) => dist(b.x, b.z, pl.x, pl.z) < 1.0) ? 1 : 0);
    if (Z.occ[0] && Z.occ[1]) { Z.hold += dt; if (Z.hold > 0.4) solve(); } else Z.hold = 0;
  } else if (P.type === 'levers') {
    Z.lv = Z.lv.map((v) => Math.max(0, v - dt));
    if (Z.lv[0] > 0 && Z.lv[1] > 0) solve();
  } else if (P.type === 'fan') {
    for (let i = 0; i < 2; i++) if (W.t - (Z.fanT[i] || 0) > 3) Z.fan[i] = Math.max(0, Z.fan[i] - dt * 0.07);
    if (Z.fan[0] >= 0.75 && Z.fan[1] >= 0.75) solve();
  } else if (P.type === 'crate') {
    Z.cx += Z.vx * dt; Z.cz += Z.vz * dt; Z.vx *= Math.pow(0.12, dt); Z.vz *= Math.pow(0.12, dt);
    const r = SP.collide(Z.cx, Z.cz, 0.5, { doors: false, noCrate: true }); if (r.x !== Z.cx) Z.vx = 0; if (r.z !== Z.cz) Z.vz = 0; Z.cx = r.x; Z.cz = r.z;
    for (const b of alive()) { const d = dist(b.x, b.z, Z.cx, Z.cz); if (d < 0.95 && d > 0.01) { const a = angTo(b.x, b.z, Z.cx, Z.cz); Z.cx = b.x + Math.sin(a) * 0.95; Z.cz = b.z + Math.cos(a) * 0.95; } }
    if (dist(Z.cx, Z.cz, P.plate.x, P.plate.z) < 0.85) { Z.cx = P.plate.x; Z.cz = P.plate.z; Z.vx = Z.vz = 0; solve(); }
  }
}
function clearRoom() {
  if (W.cleared) return; W.cleared = true;
  const L = W.L, cx = 0, cz = 0;
  coins(cx, cz, 10, 5);
  const g = L.gems.find((q) => q.how === 'clear'); if (g) gemDrop(g.gi, cx, cz);
  if (W.def.key && !W.puz && !W.hasKey) pick('key', cx, cz, 0, { a: W.def.a });
  out({ e: 'clear', rid: W.rid });
}
Sim.clearRoom = clearRoom;
function tutNext() { W.tut++; W.tutT = 0; out({ e: 'tut', s: W.tut }); if (W.tut === 1) { mkEnt('goob', 0, -2.5, { tut: 1, wv: 0, st: 'spawn', t: 0.8 }); } if (W.tut >= 5) clearRoom(); }
Sim.tutNext = tutNext;

/* ---------------- main step ---------------- */
Sim.step = function (dt) {
  if (!W) return; dt = Math.min(dt, 0.05); W.t += dt;
  const def = W.def;
  // tutorial progression
  if (W.tut === 0) { W.tutT += dt; const b = alive()[0]; if (b && (Math.hypot(b.x, b.z - (W.L.hd - 2)) > 2.5 || W.tutT > 12)) tutNext(); }
  if (W.tut === 1 && !W.ents.some((e) => e.tut)) mkEnt('goob', 0, -2.5, { tut: 1, wv: 0 });
  if (W.tut === 2 && !W.ents.some((e) => e.tut)) mkEnt('goob', 0, -2.5, { tut: 1, wv: 0 });
  // waves
  if (W.waveT > 0) { W.waveT -= dt; if (W.waveT <= 0) {
    if (def.boss) spawnBoss();
    else if (W.haunt) { const pool = SP.AREA_POOL[def.a]; spawnWave([pool[Math.random() * pool.length | 0], pool[Math.random() * pool.length | 0]], 3); W.wave = def.waves.length; }
    else if (W.wave < def.waves.length) { spawnWave(def.waves[W.wave], 1); W.wave++; }
  } }
  if (!def.boss && W.waveT <= 0 && !W.haunt && W.wave < def.waves.length && !W.ents.some((e) => e.wv === 1)) W.waveT = 1.6;
  tools(dt);
  for (const e of W.ents.slice()) if (W.ents.indexOf(e) >= 0) entStep(e, dt);
  projStep(dt); teleStep(dt); pickStep(dt); puzStep(dt);
  // decay prop shake
  W.pr.forEach((s) => { if (s.v > 0 && !s.e && W.t - (s.vt || 0) > 0.2) s.v = Math.max(0, s.v - dt * 0.8); if (s.bv && W.t - (s.vt || 0) > 0.3) s.bv = 0; });
  // revive downed bodies standing near a friend
  for (const b of bodyList()) if (b.down) {
    if (alive().some((o) => !o.clone && dist(o.x, o.z, b.x, b.z) < 1.6)) b.rv = (b.rv || 0) + dt * 0.9;
    if ((b.rv || 0) >= 1.5) { b.rv = 0; API.revive(b.pid); }
  } else b.rv = 0;
  // haunt finished
  if (W.haunt && !W.ents.some((e) => e.wv === 3) && W.waveT <= 0) W.haunt = false;
  // clear check
  if (!W.cleared && !def.boss && !def.tut && W.waveT <= 0 && W.wave >= def.waves.length && !W.ents.some((e) => e.wv) && (!W.puz || W.puz.solved)) clearRoom();
  W.lit = Math.min(1, Math.max(0, W.lit + (W.cleared ? dt * 0.8 : -dt)));
};

/* ---------------- snapshot (host -> clients) ---------------- */
const r1 = (v) => Math.round(v * 100) / 100;
Sim.pack = function () {
  return {
    r: W.rid, t: r1(W.t), cl: W.cleared ? 1 : 0, lit: r1(W.lit), tut: W.tut, hk: W.hasKey ? 1 : 0, bb: W.bossBeaten ? 1 : 0, eb: W.elevBoss ? 1 : 0, ch: W.chest, hn: W.haunt ? 1 : 0, wv: W.wave, wt: r1(W.waveT),
    e: W.ents.map((e) => ({ id: e.id, k: e.k, b: e.b, x: r1(e.x), z: r1(e.z), y: r1(e.y || 0), a: r1(e.ang), st: e.st, hp: Math.max(0, Math.round(e.hp)), m: e.mhp, cb: e.cb, pd: r1(e.pd), sl: r1(e.slam), sh: e.sh, wr: r1(e.wrap), rv: e.rev > 0 ? 1 : 0, hid: e.hid, fr: e.free, wv: e.wv, ph: e.ph, pu: e.pulling || 0, bu: e.bulbs ? e.bulbs.map((u) => [r1(u.x), r1(u.z), u.real && u.rev > 0 ? 1 : 0, u.pop]) : null, tut: e.tut })),
    p: W.picks.map((p) => [p.id, p.k, r1(p.x), r1(p.z), r1(p.y), p.gi == null ? -1 : p.gi]),
    j: W.proj.map((p) => [p.id, p.k, r1(p.x), r1(p.z), p.refl, p.big ? 1 : 0]),
    tl: W.tele.map((t) => [t.id, t.k, r1(t.x), r1(t.z), r1(t.k === 'ring' ? t.r : t.x2), r1(t.k === 'ring' ? 0 : t.z2), r1(t.w || 0), r1(t.t), t.dmg]),
    pr: W.pr.map((s) => (s.g ? 'g' : s.e ? 'e' : String(Math.min(9, Math.round(s.v * 9))))).join(''),
    pz: W.puz, dr: W.doorRev, am: W.ammo, gr: W.gemRev, bt: W.btug
  };
};
Sim.unpack = function (s) { // client side: rebuild W-like view state
  if (!W || W.rid !== s.r) return false;
  W.t = s.t; W.cleared = !!s.cl; W.lit = s.lit; W.tut = s.tut; W.hasKey = !!s.hk; W.bossBeaten = !!s.bb; W.elevBoss = s.eb; W.chest = s.ch; W.haunt = !!s.hn; W.wave = s.wv; W.waveT = s.wt;
  W.ents = s.e.map((e) => ({ id: e.id, k: e.k, b: e.b, x: e.x, z: e.z, y: e.y, ang: e.a, st: e.st, hp: e.hp, mhp: e.m, cb: e.cb || [], pd: e.pd, slam: e.sl, sh: e.sh, wrap: e.wr, rev: e.rv, hid: e.hid, free: e.fr, wv: e.wv, ph: e.ph, pulling: e.pu, bulbs: e.bu ? e.bu.map((u) => ({ x: u[0], z: u[1], rev: u[2], real: u[2], pop: u[3] })) : null, tut: e.tut }));
  W.boss = W.ents.find((e) => e.k === 'boss') || null;
  W.picks = s.p.map((p) => ({ id: p[0], k: p[1], x: p[2], z: p[3], y: p[4], gi: p[5] }));
  W.proj = s.j.map((p) => ({ id: p[0], k: p[1], x: p[2], z: p[3], refl: p[4], big: p[5] }));
  W.tele = s.tl.map((t) => t[1] === 'ring' ? { id: t[0], k: 'ring', x: t[2], z: t[3], r: t[4], t: t[7], dmg: t[8] } : { id: t[0], k: 'line', x: t[2], z: t[3], x2: t[4], z2: t[5], w: t[6], t: t[7], dmg: t[8] });
  for (let i = 0; i < W.pr.length; i++) { const c = s.pr[i]; W.pr[i] = c === 'g' ? { v: 1, e: 1, g: 1 } : c === 'e' ? { v: 0, e: 1, g: 0 } : { v: (+c || 0) / 9, e: 0, g: 0 }; }
  W.puz = s.pz; W.doorRev = s.dr || {}; W.ammo = s.am || {}; W.gemRev = s.gr || {}; W.btug = s.bt || {};
  return true;
};
})();
