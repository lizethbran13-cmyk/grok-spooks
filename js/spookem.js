/* Grok Spooks - SPOOK 'EM mode (Ratita Industries Super Pack DLC).
   You are WISP, a little ghost in the abandoned Willowmere Mansion. Spook the tourists out of the front door before dawn,
   with ghostly powers: BOO (bigger when they don't see you coming), HAUNT furniture, VANISH, FLICKER the lights.
   Solve the mansion's mysteries (chimes, portraits, seance candles, the sealed study) to find the 3 pieces of the old family photo.
   Host-authoritative: the host runs the sim, guests send input and render snapshots. */
(function () {
'use strict';
const SP = window.SP, G = SP.G, GS = G.GS, M = SP.M, Snd = SP.Snd, T = THREE, $ = G.$;
const SEM = SP.SEM = { on: false };
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
const esc = SP.esc || ((s) => String(s));

/* ---------------- save (host's mansion) ---------------- */
const SKEY = 'grokSpooks_sem';
let sv = { night: 1, pieces: [0, 0, 0], puz: {}, best: 0, done: 0, scaredTotal: 0 };
try { const s = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (s) sv = Object.assign(sv, s); } catch (e) { /* ignore */ }
const persist = () => { try { localStorage.setItem(SKEY, JSON.stringify(sv)); } catch (e) { /* ignore */ } };
SEM.save = () => sv;

/* ---------------- mansion layout ---------------- */
// rooms (x0..x1, z0..z1). Front door at (0, 14) on the south wall.
const ROOMS = [
  { id: 'hall', n: 'Entrance Hall', x0: -6, x1: 6, z0: 2, z1: 14, floor: ['#6a2a3a', '#7d3546'], wall: '#4a2a5a', light: '#ffcf8a' },
  { id: 'dining', n: 'Dining Room', x0: 6, x1: 18, z0: 2, z1: 14, floor: ['#5a3a22', '#6b4a2c'], wall: '#2a4a3a', light: '#ffb86b' },
  { id: 'library', n: 'Library', x0: -18, x1: -6, z0: 2, z1: 14, floor: ['#3a2a1a', '#4a3622'], wall: '#2b3a5a', light: '#ffd9a0' },
  { id: 'music', n: 'Music Room', x0: -18, x1: -4, z0: -14, z1: 2, floor: ['#2a2a4a', '#36365e'], wall: '#5a2a4a', light: '#d8b0ff' },
  { id: 'gallery', n: 'Portrait Gallery', x0: -4, x1: 6, z0: -14, z1: 2, floor: ['#4a3a2a', '#5c4a36'], wall: '#3a2a4a', light: '#ffe0b0' },
  { id: 'study', n: 'Sealed Study', x0: 6, x1: 18, z0: -14, z1: 2, floor: ['#2a3a3a', '#365050'], wall: '#1f3a4a', light: '#a8f0ff', sealed: 1 }
];
const RI = {}; ROOMS.forEach((r, i) => { RI[r.id] = i; });
const DOORS = [ // between rooms (door centre)
  { a: 'hall', b: 'dining', x: 6, z: 8, v: 1 }, { a: 'hall', b: 'library', x: -6, z: 8, v: 1 }, { a: 'hall', b: 'gallery', x: 1, z: 2, v: 0 },
  { a: 'library', b: 'music', x: -12, z: 2, v: 0 }, { a: 'music', b: 'gallery', x: -4, z: -6, v: 1 }, { a: 'gallery', b: 'study', x: 6, z: -6, v: 1, ward: 1 }
];
const FRONT = { x: 0, z: 14 };
const DW = 2.6; // door width
// wall lines: [x0,z0,x1,z1, gaps[]]
const WALLS = [
  [-18, -14, 18, -14, []], [-18, 14, 18, 14, [0]], [-18, -14, -18, 14, []], [18, -14, 18, 14, []],
  [-18, 2, 18, 2, [-12, 1]], [-6, 2, -6, 14, [8]], [6, 2, 6, 14, [8]], [-4, -14, -4, 2, [-6]], [6, -14, 6, 2, [-6]]
];
function roomAt(x, z) { for (let i = 0; i < ROOMS.length; i++) { const r = ROOMS[i]; if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return i; } return -1; }
SEM.roomAt = roomAt;

/* hauntable objects. scare: fear/sec to guests who can see it; r: scare radius; puz: puzzle role */
const OBJ = [
  { k: 'chandelier', x: 0, z: 8, room: 'hall', scare: 16, r: 6, anim: 'swing', n: 'Chandelier' },
  { k: 'armor', x: -4.6, z: 4, room: 'hall', scare: 15, r: 5, anim: 'walk', n: 'Suit of Armor' },
  { k: 'coatrack', x: 4.6, z: 12.4, room: 'hall', scare: 10, r: 4.5, anim: 'spin', n: 'Coat Rack' },
  { k: 'chair', x: 10, z: 6.5, room: 'dining', scare: 11, r: 4.5, anim: 'slide', n: 'Chair' },
  { k: 'cabinet', x: 16.6, z: 8, room: 'dining', scare: 14, r: 5, anim: 'plates', n: 'Plate Cabinet' },
  { k: 'armchair', x: -15, z: 11, room: 'library', scare: 11, r: 4.5, anim: 'rock', n: 'Rocking Chair' },
  { k: 'fireplace', x: -17.3, z: 6, room: 'library', scare: 16, r: 5.5, anim: 'fire', n: 'Fireplace' },
  { k: 'piano', x: -9, z: -11.6, room: 'music', scare: 16, r: 6, anim: 'play', n: 'Piano' },
  { k: 'statue', x: 4, z: -11, room: 'gallery', scare: 14, r: 5, anim: 'turn', n: 'Statue' },
  { k: 'bigpaint', x: 1, z: -13.7, room: 'gallery', scare: 13, r: 5.5, anim: 'eyes', n: 'Creepy Painting' },
  { k: 'horse', x: 15, z: -10, room: 'study', scare: 10, r: 4.5, anim: 'rock', n: 'Rocking Horse' },
  // puzzles
  { k: 'chime', x: -16, z: -6, room: 'music', puz: 'chime', i: 0, col: '#ff4d6d', n: 'Red Chime' },
  { k: 'chime', x: -14, z: -4, room: 'music', puz: 'chime', i: 1, col: '#3fa8ff', n: 'Blue Chime' },
  { k: 'chime', x: -11.5, z: -4, room: 'music', puz: 'chime', i: 2, col: '#ffe14d', n: 'Yellow Chime' },
  { k: 'chime', x: -9.5, z: -6, room: 'music', puz: 'chime', i: 3, col: '#4ade80', n: 'Green Chime' },
  { k: 'portrait', x: -16, z: 2.25, room: 'library', puz: 'portrait', i: 0, n: 'Portrait of Great-Grandpa' },
  { k: 'portrait', x: -12, z: 2.25, room: 'library', puz: 'portrait', i: 1, n: 'Portrait of Great-Grandma' },
  { k: 'portrait', x: -8, z: 2.25, room: 'library', puz: 'portrait', i: 2, n: 'Portrait of Baby Willowmere' },
  { k: 'candle', x: 12, z: 8.0 - 1.6, room: 'dining', puz: 'candle', i: 0, n: 'Candle' },
  { k: 'candle', x: 13.52, z: 8.0 - 0.49, room: 'dining', puz: 'candle', i: 1, n: 'Candle' },
  { k: 'candle', x: 12.94, z: 8.0 + 1.29, room: 'dining', puz: 'candle', i: 2, n: 'Candle' },
  { k: 'candle', x: 11.06, z: 8.0 + 1.29, room: 'dining', puz: 'candle', i: 3, n: 'Candle' },
  { k: 'candle', x: 10.48, z: 8.0 - 0.49, room: 'dining', puz: 'candle', i: 4, n: 'Candle' },
  { k: 'chest', x: 12, z: -12, room: 'study', puz: 'chest', n: 'Old Toy Chest' }
];
const CLOCK = { x: -12, z: 7 }; // portraits must all look at the grandfather clock
const PORTRAIT_GOAL = [2, 1, 0];  // eyes: 0 left, 1 middle, 2 right (seen from the room)
const PIECE_AT = [{ x: -9, z: -10.2 }, { x: -12, z: 3.4 }, { x: 12, z: -10.6 }];
const STORY = [
  'Diary, 1925: "We are moving to the big city. But WISP doesn\u2019t fit in the car!"',
  'Diary: "Wisp hid in the study and we couldn\u2019t find him to say goodbye. We sealed the room to keep him safe."',
  'Diary: "Someday a Willowmere will come back for you, Wisp. We promise."'
];
const WISPS = [[-2, 11], [15, 12], [-15, 4], [-16, -12], [0, -6], [14, -4], [3, 5], [-9, -2], [10, 3.5]];
const GKINDS = {
  tourist: { n: 'Tourist', sp: 1.7, mult: 1, cols: ['#ff7a3d', '#3fa8ff', '#ffe14d'] },
  kid: { n: 'Kid', sp: 2.3, mult: 1.35, cols: ['#4ade80', '#ff4fd8', '#3ff0ff'] },
  granny: { n: 'Granny', sp: 1.15, mult: 0.9, cols: ['#c084fc', '#f2a0b8'] },
  influencer: { n: 'Influencer', sp: 1.6, mult: 1, cols: ['#ff4fd8', '#ffffff'] },
  hunter: { n: 'Ghost Hunter', sp: 1.6, mult: 0.6, cols: ['#2d6a4a', '#8a5a2a'] },
  rosie: { n: 'Rosie Willowmere', sp: 1.4, mult: 0, cols: ['#ffd23f'] }
};

/* ---------------- sim state ---------------- */
let S = null, role = 'solo', myId = 'me', view = null, raf = 0, last = 0, inQ = [], netT = 0, snapT = 0;
SEM.S = () => S;
function nightCfg(n) { return { quota: Math.min(14, 6 + n * 2), total: Math.min(18, 9 + n * 2), time: Math.min(270, 195 + n * 15), maxIn: Math.min(8, 4 + n), hunters: n >= 2 }; }
function newGhost(id, name, col) { return { id, name, col, x: 0, z: 9 + (Object.keys(S.gh).length * 1.2), ang: Math.PI, ecto: 100, inv: 0, stun: 0, boo: 0, cdBoo: 0, cdFl: 0, ix: 0, iz: 0, act: null }; }
function newSim(players) {
  const c = nightCfg(sv.night), fam = sv.pieces.every(Boolean) && !sv.done;
  S = { t: 0, night: sv.night, fam: fam ? 1 : 0, dawn: c.time, quota: fam ? 0 : c.quota, total: c.total, maxIn: c.maxIn, hunters: c.hunters, spawned: 0, scared: 0, busT: 1.5, nid: 1,
    gh: {}, gu: [], ob: OBJ.map(() => ({ h: 0, cd: 0 })), wi: WISPS.map((w) => ({ x: w[0], z: w[1], on: 1, t: 0 })), fl: {}, ev: [], end: null,
    pz: { seq: [], prog: 0, chimes: sv.puz.chimes ? 1 : 0, por: sv.puz.por ? PORTRAIT_GOAL.slice() : [0, 2, 1], porOk: sv.puz.por ? 1 : 0, cand: [0, 0, 0, 0, 0], ward: sv.puz.ward ? 0 : 1, chest: sv.puz.chest ? 1 : 0, piece: sv.pieces.slice(), pick: [0, 0, 0], blowT: 0 } };
  const order = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [order[i], order[j]] = [order[j], order[i]]; } S.pz.seq = order;
  // pieces that were revealed but not picked up yet
  if (sv.puz.chimes && !sv.pieces[0]) S.pz.pick[0] = 1; if (sv.puz.por && !sv.pieces[1]) S.pz.pick[1] = 1; if (sv.puz.chest && !sv.pieces[2]) S.pz.pick[2] = 1;
  players.forEach((p) => { S.gh[p.id] = newGhost(p.id, p.name, p.col); });
  if (fam) S.dawn = 240;
  return S;
}
const ev = (e) => { S.ev.push(e); };
function guestsSee(gu, g) { if (g.inv) return false; const d = dist(gu.x, gu.z, g.x, g.z); if (d > 8) return false; return Math.abs(angDiff(gu.ang, Math.atan2(g.x - gu.x, g.z - gu.z))) < 1.4 || d < 1.6; }
function spawnGuest(k) {
  const kd = GKINDS[k]; const gu = { id: S.nid++, k, x: rnd(-1, 1), z: 15.5, ang: Math.PI, fear: 0, st: 'walk', path: [{ x: rnd(-1, 1), z: 12 }], t: 0, lastScare: 0, brave: 0, col: kd.cols[Math.random() * kd.cols.length | 0], flashT: 0, say: '', sayT: 0, sit: 0, hat: Math.random() * 3 | 0 };
  S.gu.push(gu); S.spawned++; return gu;
}
// room graph path (door points) from room a to room b
function roomPath(a, b) {
  if (a === b) return [];
  const prev = {}; const q = [a]; prev[a] = -1;
  while (q.length) { const r = q.shift(); if (r === b) break; DOORS.forEach((d, di) => { if (d.ward && S.pz.ward) return; let o = -1; if (RI[d.a] === r) o = RI[d.b]; else if (RI[d.b] === r) o = RI[d.a]; if (o < 0 || prev[o] !== undefined) return; prev[o] = { r, di }; q.push(o); }); }
  if (prev[b] === undefined) return null;
  const out = []; let cur = b; while (prev[cur] !== -1) { const p = prev[cur]; const d = DOORS[p.di]; const ra = ROOMS[p.r], rb = ROOMS[cur];
    const ca = { x: (ra.x0 + ra.x1) / 2, z: (ra.z0 + ra.z1) / 2 }, cb = { x: (rb.x0 + rb.x1) / 2, z: (rb.z0 + rb.z1) / 2 };
    const off = 1.1; const nx = d.v ? Math.sign(cb.x - ca.x) : 0, nz = d.v ? 0 : Math.sign(cb.z - ca.z);
    out.unshift({ x: d.x + nx * off, z: d.z + nz * off }); out.unshift({ x: d.x - nx * off, z: d.z - nz * off }); cur = p.r; }
  return out;
}
function poiIn(ri) { const r = ROOMS[ri]; return { x: rnd(r.x0 + 1.6, r.x1 - 1.6), z: rnd(r.z0 + 1.6, r.z1 - 1.6) }; }
function goSomewhere(gu) {
  const here = Math.max(0, roomAt(gu.x, gu.z)); let tr = Math.random() * ROOMS.length | 0; if (ROOMS[tr].sealed && S.pz.ward) tr = here;
  const p = roomPath(here, tr); if (!p) return; gu.path = p.concat([poiIn(tr)]); gu.st = 'walk';
}
function flee(gu) {
  if (gu.st === 'flee' || gu.st === 'gone') return; gu.st = 'flee'; gu.fear = 100; const here = Math.max(0, roomAt(gu.x, gu.z));
  gu.path = (roomPath(here, 0) || []).concat([{ x: FRONT.x, z: FRONT.z - 1 }, { x: FRONT.x, z: FRONT.z + 2.5 }]);
  gu.say = ['AAAAH!', 'GHOST!!', 'I\u2019M OUTTA HERE!', 'MOMMY!', 'NOPE NOPE NOPE!'][Math.random() * 5 | 0]; gu.sayT = 2;
  ev({ e: 'scream', x: gu.x, z: gu.z });
  S.gu.forEach((o) => { if (o !== gu && o.st !== 'flee' && o.st !== 'gone' && dist(o.x, o.z, gu.x, gu.z) < 5) addFear(o, 10, false); });
}
function addFear(gu, n, jump) {
  if (gu.st === 'flee' || gu.st === 'gone' || gu.k === 'rosie') return;
  gu.fear = Math.min(100, gu.fear + n * GKINDS[gu.k].mult); gu.lastScare = S.t;
  if (gu.fear >= 100) { flee(gu); return; }
  if (jump && n >= 15) { gu.st = 'scared'; gu.t = 1.1; }
}
function step(dt) {
  if (!S || S.end) return;
  S.t += dt; S.dawn -= dt;
  // ghosts
  for (const id in S.gh) {
    const g = S.gh[id];
    g.cdBoo = Math.max(0, g.cdBoo - dt); g.cdFl = Math.max(0, g.cdFl - dt); g.boo = Math.max(0, g.boo - dt);
    if (g.stun > 0) { g.stun -= dt; g.ix = g.iz = 0; }
    const m = Math.hypot(g.ix, g.iz); if (m > 0.1) { const sp = 5.4; g.x += g.ix / Math.max(1, m) * sp * dt; g.z += g.iz / Math.max(1, m) * sp * dt; g.ang += angDiff(g.ang, Math.atan2(g.ix, g.iz)) * Math.min(1, dt * 12); }
    // ghosts float through walls, but not out of the mansion or through the blue ward of the sealed study
    g.x = clamp(g.x, -17.5, 17.5); g.z = clamp(g.z, -13.5, 13.5);
    if (S.pz.ward && g.x > 5.6 && g.z < 2.4) { if (g.x - 5.6 < 2.4 - g.z) g.x = 5.6; else g.z = 2.4; }
    if (g.inv) { g.ecto -= 5 * dt; if (g.ecto <= 0) { g.ecto = 0; g.inv = 0; ev({ e: 'appear', id }); } } else g.ecto = Math.min(100, g.ecto + 6.5 * dt);
    S.wi.forEach((w) => { if (w.on && dist(w.x, w.z, g.x, g.z) < 1.1) { w.on = 0; w.t = 18; g.ecto = Math.min(100, g.ecto + 28); ev({ e: 'wisp', x: w.x, z: w.z, id }); } });
    for (let i = 0; i < 3; i++) if (S.pz.pick[i] && !S.pz.piece[i] && dist(PIECE_AT[i].x, PIECE_AT[i].z, g.x, g.z) < 1.2) { S.pz.piece[i] = 1; S.pz.pick[i] = 0; sv.pieces[i] = 1; persist(); ev({ e: 'piece', i, x: g.x, z: g.z }); }
    if (g.act) { act(g, g.act); g.act = null; }
  }
  S.wi.forEach((w) => { if (!w.on) { w.t -= dt; if (w.t <= 0) w.on = 1; } });
  S.ob.forEach((o) => { o.h = Math.max(0, o.h - dt); o.cd = Math.max(0, o.cd - dt); });
  for (const r in S.fl) { S.fl[r] -= dt; if (S.fl[r] <= 0) delete S.fl[r]; }
  // tour buses
  const inside = S.gu.filter((g) => g.st !== 'gone').length;
  S.busT -= dt;
  if (S.fam && !S.gu.some((g) => g.k === 'rosie') && S.t > 6) { spawnGuest('rosie'); ev({ e: 'rosie' }); }
  if (S.busT <= 0 && S.spawned < S.total && inside < S.maxIn && S.dawn > 25) {
    S.busT = rnd(16, 22); const n = Math.min(S.total - S.spawned, S.maxIn - inside, 2 + (Math.random() < 0.4 ? 1 : 0));
    for (let i = 0; i < n; i++) { const pool = ['tourist', 'tourist', 'kid', 'granny', 'influencer'].concat(S.hunters ? ['hunter'] : []); spawnGuest(pool[Math.random() * pool.length | 0]); }
    ev({ e: 'bus', n });
  }
  // guests
  for (const gu of S.gu) {
    if (gu.st === 'gone') continue;
    gu.sayT = Math.max(0, gu.sayT - dt); gu.flashT = Math.max(0, gu.flashT - dt);
    const kd = GKINDS[gu.k]; let sp = kd.sp;
    if (gu.st === 'flee') sp = kd.sp * 2.1 + 1.2;
    if (gu.st === 'scared') { gu.t -= dt; const g = nearestGhost(gu); if (g) { const a = Math.atan2(gu.x - g.x, gu.z - g.z); moveG(gu, Math.sin(a), Math.cos(a), sp * 1.6, dt); } if (gu.t <= 0) goSomewhere(gu); continue; }
    if (gu.st === 'look') { gu.t -= dt; if (gu.t <= 0) goSomewhere(gu); }
    else if (gu.path && gu.path.length) { const p = gu.path[0]; const d = dist(gu.x, gu.z, p.x, p.z); if (d < 0.35) gu.path.shift(); else moveG(gu, (p.x - gu.x) / d, (p.z - gu.z) / d, sp, dt); }
    else if (gu.st === 'flee') { gu.st = 'gone'; S.scared++; sv.scaredTotal++; ev({ e: 'gone', x: gu.x, z: gu.z, k: gu.k }); continue; }
    else { gu.st = 'look'; gu.t = rnd(2, 5); gu.ang = rnd(0, TAU); if (gu.k === 'tourist' && Math.random() < 0.5) { gu.flashT = 0.3; gu.say = '*click*'; gu.sayT = 1; } }
    if (gu.st === 'flee') continue;
    // seeing ghosts / getting used to them; ghost hunters flash visible ghosts
    for (const id in S.gh) { const g = S.gh[id]; if (guestsSee(gu, g)) { gu.brave = Math.min(1, gu.brave + dt * (gu.k === 'influencer' ? 0.5 : 0.25)); if (gu.k === 'influencer' && gu.sayT <= 0 && Math.random() < dt * 0.4) { gu.say = 'OMG filming this!'; gu.sayT = 1.6; }
      if (gu.k === 'hunter' && gu.flashT <= 0 && g.stun <= 0 && dist(gu.x, gu.z, g.x, g.z) < 6) { gu.flashT = 3.5; g.stun = 1.4; g.ecto = Math.max(0, g.ecto - 20); const a = Math.atan2(g.x - gu.x, g.z - gu.z); g.x += Math.sin(a) * 1.5; g.z += Math.cos(a) * 1.5; gu.say = 'GOTCHA, GHOST!'; gu.sayT = 1.5; ev({ e: 'flashed', id, x: g.x, z: g.z }); } } }
    // haunted objects in sight scare (only objects marked scary)
    S.ob.forEach((o, i) => { const d = OBJ[i]; if (!o.h || !d.scare) return; if (dist(gu.x, gu.z, d.x, d.z) < d.r) addFear(gu, d.scare * dt, false); });
    if (S.fl[roomAt(gu.x, gu.z)]) addFear(gu, 9 * dt, false);
    if (S.t - gu.lastScare > 3) { gu.fear = Math.max(0, gu.fear - 3.5 * dt); gu.brave = Math.max(0, gu.brave - dt * 0.05); }
    // guests in the dining room blow the seance candles out
    if (roomAt(gu.x, gu.z) === RI.dining && S.pz.ward && S.pz.cand.some(Boolean)) { S.pz.blowT += dt; if (S.pz.blowT > 3.5) { S.pz.blowT = 0; const i = S.pz.cand.indexOf(1); if (i >= 0) { S.pz.cand[i] = 0; gu.say = 'Who left these candles on?'; gu.sayT = 2; ev({ e: 'blowout', i }); } } }
  }
  S.gu = S.gu.filter((g) => g.st !== 'gone' || S.t < 0);
  // end of night
  const left = S.gu.length;
  if (S.fam) { if (S.famDone) end(true); else if (S.dawn <= 0) end(false); }
  else if (S.dawn <= 0 || (S.spawned >= S.total && left === 0)) end(S.scared >= S.quota);
}
function nearestGhost(gu) { let b = null, bd = 1e9; for (const id in S.gh) { const g = S.gh[id]; const d = dist(g.x, g.z, gu.x, gu.z); if (d < bd) { bd = d; b = g; } } return b; }
function moveG(gu, dx, dz, sp, dt) {
  gu.x += dx * sp * dt; gu.z += dz * sp * dt; gu.ang += angDiff(gu.ang, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
  if (gu.st === 'flee' && gu.z > 13.5 && Math.abs(gu.x) < 1.4) return; // out the front door
  const ri = roomAt(gu.x, gu.z); if (ri < 0 && gu.z < 14) { gu.x = clamp(gu.x, -17.5, 17.5); gu.z = clamp(gu.z, -13.5, 13.5); }
}
function nearObj(g) { let best = -1, bd = 2.4; OBJ.forEach((d, i) => { if (d.puz === 'chest' && S.pz.ward) return; const dd = dist(g.x, g.z, d.x, d.z); if (dd < bd) { bd = dd; best = i; } }); return best; }
SEM.nearObj = (g) => (S ? nearObj(g) : -1);
function act(g, a) {
  if (g.stun > 0) return;
  if (a === 'boo') {
    if (g.cdBoo > 0 || g.ecto < 12) { if (g.ecto < 12) ev({ e: 'noecto', id: g.id }); return; }
    g.cdBoo = 0.85; g.ecto -= 12; g.boo = 0.6; const wasInv = g.inv; g.inv = 0; let hit = 0, surprise = 0;
    S.gu.forEach((gu) => { if (gu.st === 'flee' || gu.st === 'gone') return; const d = dist(gu.x, gu.z, g.x, g.z); if (d > 3.6) return;
      if (gu.k === 'rosie') { gu.say = 'Hee hee! Hi little ghost!'; gu.sayT = 2; return; }
      const sees = !wasInv && Math.abs(angDiff(gu.ang, Math.atan2(g.x - gu.x, g.z - gu.z))) < 1.4;
      let k = sees ? (gu.brave > 0.6 ? 0.55 : 1) : 1.7; if (!sees) surprise++;
      addFear(gu, 32 * k * (d < 2 ? 1.2 : 1), true); hit++; if (gu.k !== 'rosie' && gu.st !== 'flee') { gu.say = sees && gu.brave > 0.6 ? 'Pfft. Cute ghost.' : ['EEK!', 'WHAT WAS THAT?!', 'Did you hear that?!', 'Yikes!'][Math.random() * 4 | 0]; gu.sayT = 1.4; } });
    ev({ e: 'boo', id: g.id, x: g.x, z: g.z, hit, surprise });
  } else if (a === 'vanish') {
    if (!g.inv && g.ecto < 8) { ev({ e: 'noecto', id: g.id }); return; } g.inv = g.inv ? 0 : 1; ev({ e: g.inv ? 'vanish' : 'appear', id: g.id });
  } else if (a === 'flicker') {
    if (g.cdFl > 0 || g.ecto < 30) { if (g.ecto < 30) ev({ e: 'noecto', id: g.id }); return; } const r = roomAt(g.x, g.z); if (r < 0) return;
    g.cdFl = 8; g.ecto -= 30; S.fl[r] = 2.4; S.gu.forEach((gu) => { if (roomAt(gu.x, gu.z) === r) { addFear(gu, 16, true); gu.brave *= 0.4; } }); ev({ e: 'flicker', r });
  } else if (a === 'haunt') {
    // Family Night: show Rosie the photo
    const ro = S.gu.find((q) => q.k === 'rosie' && q.st !== 'gone');
    if (S.fam && ro && dist(ro.x, ro.z, g.x, g.z) < 2.6) { S.famDone = 1; ro.say = 'Wisp?! Grandma told me all about you!'; ro.sayT = 4; ev({ e: 'family' }); return; }
    const i = nearObj(g); if (i < 0) { ev({ e: 'nothing', id: g.id }); return; }
    const d = OBJ[i], o = S.ob[i];
    if (d.puz) { puzzle(g, d, i); return; }
    if (o.cd > 0 || o.h > 0) return; if (g.ecto < 20) { ev({ e: 'noecto', id: g.id }); return; }
    g.ecto -= 20; o.h = 3.2; o.cd = 5; ev({ e: 'haunt', i, x: d.x, z: d.z });
  }
}
function puzzle(g, d, i) {
  const P = S.pz, o = S.ob[i]; if (o.cd > 0) return; o.cd = 0.5; o.h = 0.8; g.ecto = Math.max(0, g.ecto - 4);
  if (d.puz === 'chime') {
    ev({ e: 'chime', i: d.i, x: d.x, z: d.z }); if (P.chimes) return;
    if (P.seq[P.prog] === d.i) { P.prog++; if (P.prog >= 4) { P.chimes = 1; sv.puz.chimes = 1; persist(); if (!P.piece[0]) P.pick[0] = 1; ev({ e: 'solved', p: 'chimes', x: PIECE_AT[0].x, z: PIECE_AT[0].z }); } }
    else { P.prog = d.i === P.seq[0] ? 1 : 0; ev({ e: 'wrong' }); }
  } else if (d.puz === 'portrait') {
    if (P.porOk) return; P.por[d.i] = (P.por[d.i] + 1) % 3; ev({ e: 'portrait', i: d.i });
    if (P.por.every((v, k) => v === PORTRAIT_GOAL[k])) { P.porOk = 1; sv.puz.por = 1; persist(); if (!P.piece[1]) P.pick[1] = 1; ev({ e: 'solved', p: 'portraits', x: PIECE_AT[1].x, z: PIECE_AT[1].z }); }
  } else if (d.puz === 'candle') {
    if (!P.ward) return; P.cand[d.i] = 1; ev({ e: 'candle', i: d.i });
    if (P.cand.every(Boolean)) { P.ward = 0; sv.puz.ward = 1; persist(); ev({ e: 'solved', p: 'ward', x: 6, z: -6 }); }
  } else if (d.puz === 'chest') {
    if (P.chest) return; P.chest = 1; sv.puz.chest = 1; persist(); if (!P.piece[2]) P.pick[2] = 1; ev({ e: 'solved', p: 'chest', x: d.x, z: d.z });
  }
}
function end(win) {
  if (S.end) return;
  const stars = S.fam ? (win ? 3 : 0) : (S.scared >= S.quota + 4 ? 3 : S.scared >= S.quota + 2 ? 2 : S.scared >= S.quota ? 1 : 0);
  S.end = { win: win ? 1 : 0, stars, scared: S.scared, quota: S.quota, fam: S.fam, coins: S.scared * 15 + stars * 40 };
  if (role !== 'client') {
    if (S.fam && win) { sv.done = 1; } else if (win) sv.night++;
    sv.best = Math.max(sv.best || 0, S.scared); persist();
  }
  // everybody gets coins in their own Grok Spooks save
  const gs = G.save(); gs.coins += S.end.coins; G.persist();
  ev({ e: 'end', end: S.end });
}

/* ---------------- networking ---------------- */
const N = () => G.N;
const inRoom = () => !!(N() && N().room && N().room.opened && N().room.count() > 1);
function pack() {
  const r = (v) => Math.round(v * 100) / 100;
  return { t: r(S.t), dw: r(S.dawn), n: S.night, fam: S.fam, fd: S.famDone ? 1 : 0, q: S.quota, tot: S.total, sc: S.scared, sp: S.spawned,
    gh: Object.values(S.gh).map((g) => [g.id, r(g.x), r(g.z), r(g.ang), Math.round(g.ecto), g.inv, r(g.stun), r(g.boo), g.col, g.name]),
    gu: S.gu.map((u) => [u.id, u.k, r(u.x), r(u.z), r(u.ang), Math.round(u.fear), u.st, u.col, u.say, r(u.sayT), u.flashT > 0 ? 1 : 0, u.hat]),
    ob: S.ob.map((o) => (o.h > 0 ? 1 : 0)), wi: S.wi.map((w) => w.on), fl: Object.keys(S.fl).map(Number),
    pz: { seq: S.pz.seq, prog: S.pz.prog, ch: S.pz.chimes, por: S.pz.por, po: S.pz.porOk, cand: S.pz.cand, ward: S.pz.ward, chest: S.pz.chest, piece: S.pz.piece, pick: S.pz.pick }, ev: S.ev.slice(0, 30), end: S.end };
}
function unpack(d) {
  if (!S) S = newSimClient();
  S.t = d.t; S.dawn = d.dw; S.night = d.n; S.fam = d.fam; S.famDone = d.fd; S.quota = d.q; S.total = d.tot; S.scared = d.sc; S.spawned = d.sp;
  const gh = {}; d.gh.forEach((a) => { const o = S.gh[a[0]] || {}; gh[a[0]] = Object.assign(o, { id: a[0], x: a[1], z: a[2], ang: a[3], ecto: a[4], inv: a[5], stun: a[6], boo: a[7], col: a[8], name: a[9] }); }); S.gh = gh;
  S.gu = d.gu.map((a) => ({ id: a[0], k: a[1], x: a[2], z: a[3], ang: a[4], fear: a[5], st: a[6], col: a[7], say: a[8], sayT: a[9], flashT: a[10] ? 1 : 0, hat: a[11] }));
  S.ob = d.ob.map((h) => ({ h })); S.wi = d.wi.map((on, i) => ({ x: WISPS[i][0], z: WISPS[i][1], on })); S.fl = {}; d.fl.forEach((r) => { S.fl[r] = 1; });
  const p = d.pz; S.pz = { seq: p.seq, prog: p.prog, chimes: p.ch, por: p.por, porOk: p.po, cand: p.cand, ward: p.ward, chest: p.chest, piece: p.piece, pick: p.pick };
  (d.ev || []).forEach(onEv);
  if (d.end && !S.end) { S.end = d.end; const gs = G.save(); gs.coins += d.end.coins; G.persist(); showEnd(); }
}
function newSimClient() { return { t: 0, gh: {}, gu: [], ob: OBJ.map(() => ({ h: 0 })), wi: [], fl: {}, ev: [], pz: { seq: [0, 1, 2, 3], prog: 0, por: [0, 0, 0], cand: [0, 0, 0, 0, 0], ward: 1, piece: [0, 0, 0], pick: [0, 0, 0] } }; }
SEM.onMsg = function (d, from) {
  if (!d || typeof d !== 'object') return false;
  if (d.t === 'semon') { if (role !== 'host') { if (d.on) startClient(); else if (SEM.on) stop(true); } return true; }
  if (d.t === 'sems') { if (role === 'client' && SEM.on && d.s) { try { unpack(d.s); } catch (e) { /* ignore bad snapshot */ } } return true; }
  if (d.t === 'semi') { if (role === 'host' && S && from) { let g = S.gh[from]; if (!g) { const o = GS.others[from] || {}; g = S.gh[from] = newGhost(from, o.name || 'Friend', o.color || '#3ff0ff'); }
    const n = (v) => (typeof v === 'number' && isFinite(v) ? clamp(v, -1, 1) : 0); g.ix = n(d.jx); g.iz = n(d.jz); if (['boo', 'haunt', 'vanish', 'flicker'].indexOf(d.a) >= 0) act(g, d.a); } return true; }
  return false;
};
SEM.playerJoined = function (pid) { if (SEM.on && role === 'host') N().sendTo(pid, { t: 'semon', on: 1 }); };

/* ---------------- view ---------------- */
function lam(c, o) { return new T.MeshLambertMaterial(Object.assign({ color: c }, o || {})); }
function basic(c, o) { return new T.MeshBasicMaterial(Object.assign({ color: c }, o || {})); }
function bx(w, h, d, m, x, y, z, p) { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); p.add(o); return o; }
function cy(r, h, m, x, y, z, p, r2, s) { const o = new T.Mesh(new T.CylinderGeometry(r2 == null ? r : r2, r, h, s || 14), m); o.position.set(x, y + h / 2, z); p.add(o); return o; }
function sp(r, m, x, y, z, p, s) { const o = new T.Mesh(new T.SphereGeometry(r, s || 14, Math.max(8, (s || 14) * 0.7 | 0)), m); o.position.set(x, y, z); p.add(o); return o; }
function floorTex(a, b, kind) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 128, 128); g.fillStyle = b;
  if (kind % 2) { for (let i = 0; i < 4; i++) g.fillRect(0, i * 32, 128, 14); g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 8; i++) g.fillRect((i * 37) % 128, ((i * 16) % 128), 2, 32); }
  else { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 32, y * 32, 32, 32); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; }
function buildView() {
  const R = SP.V.renderer;
  const sc = new T.Scene(); sc.background = new T.Color('#0d0820'); sc.fog = new T.Fog('#0d0820', 26, 60);
  const cam = new T.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 120);
  const hemi = new T.HemisphereLight('#b8a8ff', '#2a1840', 0.85); sc.add(hemi);
  const moon = new T.DirectionalLight('#c8d4ff', 0.55); moon.position.set(-10, 20, 12); sc.add(moon);
  const root = new T.Group(); sc.add(root);
  const v = { sc, cam, hemi, moon, root, walls: [], lights: [], obj: [], gh: {}, gu: {}, wi: [], pieces: [], tags: {}, camP: new T.Vector3(0, 14, 20), roomLights: {} };
  // outside: lawn, path, gate, moon
  const lawn = new T.Mesh(new T.PlaneGeometry(120, 120), lam('#1f3a2a')); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.02; root.add(lawn);
  bx(3, 0.02, 10, lam('#6a5a4a'), 0, 0, 19, root);
  const moonM = sp(4, basic('#fff6d0'), -30, 26, -40, root, 24); void moonM;
  for (let i = 0; i < 8; i++) { const tr = new T.Group(); tr.position.set((i % 2 ? 1 : -1) * rnd(22, 30), 0, rnd(-14, 18)); root.add(tr); cy(0.35, 3, lam('#3a2a1a'), 0, 0, 0, tr); sp(1.8, lam('#24402a'), 0, 3.8, 0, tr, 10); }
  // floors + room lights
  ROOMS.forEach((r, i) => {
    const w = r.x1 - r.x0, d = r.z1 - r.z0; const tx = floorTex(r.floor[0], r.floor[1], i); tx.repeat.set(w / 3, d / 3);
    const f = new T.Mesh(new T.PlaneGeometry(w, d), lam('#ffffff', { map: tx })); f.rotation.x = -Math.PI / 2; f.position.set((r.x0 + r.x1) / 2, 0.01, (r.z0 + r.z1) / 2); root.add(f);
    const L = new T.PointLight(r.light, 0.9, 16, 1.3); L.position.set((r.x0 + r.x1) / 2, 3.6, (r.z0 + r.z1) / 2); sc.add(L); v.roomLights[i] = L;
    // rug
    const rug = new T.Mesh(new T.PlaneGeometry(w * 0.45, d * 0.35), lam(['#8a1a3a', '#1a5a4a', '#3a2a8a', '#6a2a8a', '#8a5a1a', '#1a4a6a'][i])); rug.rotation.x = -Math.PI / 2; rug.position.set((r.x0 + r.x1) / 2, 0.02, (r.z0 + r.z1) / 2 + 1); root.add(rug);
  });
  // walls (each segment its own material so walls in front of the camera can fade)
  WALLS.forEach((wl) => {
    const [x0, z0, x1, z1, gaps] = wl, vert = x0 === x1, len = vert ? z1 - z0 : x1 - x0; let segs = [[0, len]];
    gaps.forEach((gp) => { const c = (vert ? gp - z0 : gp - x0); segs = segs.flatMap(([a, b]) => (c - DW / 2 > a && c + DW / 2 < b ? [[a, c - DW / 2], [c + DW / 2, b]] : [[a, b]])); });
    segs.forEach(([a, b]) => {
      const L = b - a, cx = vert ? x0 : x0 + (a + b) / 2, cz = vert ? z0 + (a + b) / 2 : z0; const ri = roomAt(cx + (vert ? 0.3 : 0), cz + (vert ? 0 : -0.3));
      const col = ri >= 0 ? ROOMS[ri].wall : '#3a2a4a'; const m = lam(col, { transparent: true, opacity: 1 });
      const w = bx(vert ? 0.3 : L + 0.3, 2.8, vert ? L + 0.3 : 0.3, m, cx, 0, cz, root);
      const trim = bx(vert ? 0.36 : L + 0.36, 0.14, vert ? L + 0.36 : 0.36, lam('#d4a017', { transparent: true }), cx, 2.8, cz, root);
      v.walls.push({ m: w, t: trim, vert, cx, cz, a: vert ? z0 + a : x0 + a, b: vert ? z0 + b : x0 + b, outer: Math.abs(cz) === 14 || Math.abs(cx) === 18 });
      // windows on outer walls
      if (Math.abs(cz) === 14 && !vert || Math.abs(cx) === 18 && vert) for (let q = a + 2.5; q < b - 1.5; q += 5) { const wx = vert ? x0 : x0 + q, wz = vert ? z0 + q : z0; const win = bx(vert ? 0.34 : 1.4, 1.3, vert ? 1.4 : 0.34, basic('#7a9aff', { transparent: true, opacity: 0.85 }), wx, 1.1, wz, root); v.walls[v.walls.length - 1].win = (v.walls[v.walls.length - 1].win || []).concat([win]); }
    });
  });
  // door frames + the front door
  DOORS.concat([{ x: 0, z: 14, v: 0, front: 1 }]).forEach((d) => { const g = new T.Group(); g.position.set(d.x, 0, d.z); if (d.v) g.rotation.y = Math.PI / 2; root.add(g); bx(0.25, 2.6, 0.4, lam('#7a4a22'), -DW / 2, 0, 0, g); bx(0.25, 2.6, 0.4, lam('#7a4a22'), DW / 2, 0, 0, g); bx(DW + 0.25, 0.3, 0.4, lam('#7a4a22'), 0, 2.4, 0, g);
    if (d.front) { const dr = bx(1.2, 2.3, 0.1, lam('#5a2a12'), -0.6, 0, 0.3, g); dr.rotation.y = -1.2; dr.position.x = -1.1; dr.position.z = 0.6; const s = M.text('\uD83D\uDEAA WAY OUT', '#ffe14d'); s.position.set(0, 3.1, 0.2); s.scale.multiplyScalar(1.1); g.add(s); }
    if (d.ward) { const wm = new T.Mesh(new T.PlaneGeometry(DW, 2.6), basic('#3ff0ff', { transparent: true, opacity: 0.5, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })); wm.position.y = 1.3; g.add(wm); v.ward = wm; } });
  // ward around the sealed study (glowing blue walls)
  const wardG = new T.Group(); root.add(wardG); [[12, 2, 12, 0.1], [6, -6, 0.1, 16]].forEach((q) => { const m = new T.Mesh(new T.BoxGeometry(q[2], 3, q[3]), basic('#3ff0ff', { transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false })); m.position.set(q[0], 1.5, q[1]); wardG.add(m); }); v.wardG = wardG;
  // furniture (decor)
  const P = (k, x, z, ry, s) => { const g = M.prop(k); g.position.set(x, 0, z); g.rotation.y = ry || 0; if (s) g.scale.setScalar(s); root.add(g); return g; };
  P('plant', -5, 13, 0); P('plant', 5, 3, 0); P('bench', -3, 13.3, 0); P('vase', 5.2, 6, 0);
  P('table', 12, 11.3, 0, 1.3); P('chair', 10.6, 12.4, Math.PI); P('chair', 13.4, 12.4, Math.PI); P('chair', 13.4, 10.2, 0); P('lamp', 17, 3, 0); P('plant', 17, 13, 0);
  P('shelf', -17.5, 10.5, Math.PI / 2); P('shelf', -9, 13.6, Math.PI); P('shelf', -14, 13.6, Math.PI); P('globe', -8, 11, 0); P('desk', -9, 6, 0); P('books', -9, 6.1, 0); P('clock', CLOCK.x, CLOCK.z, Math.PI);
  P('sofa', -14, -13, 0); P('lamp', -17, -1, 0); P('plant', -5, -13, 0); P('bench', -9, -9.8, 0);
  P('statue', -2.5, -3, 0); P('vase', 4.8, -1, 0); P('bench', 1, -8, 0); P('mirror', -3.5, -10, Math.PI / 2);
  P('desk', 16, -4, -Math.PI / 2); P('trunk', 9, -12.6, 0); P('lamp', 16.8, -13, 0); P('books', 16, -3.8, 0);
  // the round seance table
  cy(1.9, 0.12, lam('#3a1a2a'), 12, 0.8, 8, root, 1.9, 28); cy(0.3, 0.8, lam('#2a1220'), 12, 0, 8, root); const crys = sp(0.35, basic('#d8b0ff', { transparent: true, opacity: 0.8 }), 12, 1.25, 8, root); v.crystal = crys;
  // music stand showing the chime order (real 3D stand, the notes are drawn on its sheet)
  const st = new T.Group(); st.position.set(-12.8, 0, -8.6); root.add(st); cy(0.05, 1.3, lam('#2a2a2a'), 0, 0, 0, st); const cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = 128; const stex = new T.CanvasTexture(cvs);
  const sheet = new T.Mesh(new T.BoxGeometry(1.5, 0.75, 0.05), [lam('#eee'), lam('#eee'), lam('#eee'), lam('#eee'), lam('#ffffff', { map: stex }), lam('#ddd')]); sheet.position.set(0, 1.6, 0); sheet.rotation.x = -0.35; st.add(sheet); v.sheet = { cvs, stex, key: '' };
  // hauntable objects
  OBJ.forEach((d, i) => { const g = buildObj(d); g.position.set(d.x, 0, d.z); root.add(g); const hi = M.ring(0.9, '#b46bff', 0.0); hi.rotation.x = -Math.PI / 2; hi.position.set(d.x, 0.05, d.z); root.add(hi); v.obj.push({ g, d, base: g.position.clone(), hi, ry: g.rotation.y }); });
  // ecto wisps
  WISPS.forEach((w) => { const g = new T.Group(); g.position.set(w[0], 1, w[1]); sp(0.22, basic('#7dff9e'), 0, 0, 0, g, 10); const gl = M.glow('#4ade80', 1.8, 0.8); g.add(gl); root.add(g); v.wi.push(g); });
  // photo pieces
  PIECE_AT.forEach((p, i) => { const g = new T.Group(); g.position.set(p.x, 1.4, p.z); bx(0.8, 0.6, 0.05, lam('#e8d8b0', { emissive: '#3a3020' }), 0, -0.3, 0, g); bx(0.6, 0.42, 0.06, lam('#8a6a4a'), 0, -0.21, 0, g); g.add(M.glow('#ffe14d', 2.4, 0.9)); const n = M.text('\uD83E\uDDE9 PIECE ' + (i + 1), '#ffe14d'); n.position.y = 0.7; g.add(n); g.visible = false; root.add(g); v.pieces.push(g); });
  void R; return v;
}
function buildObj(d) {
  const g = new T.Group();
  switch (d.k) {
    case 'chandelier': { const h = new T.Group(); h.position.y = 4.2; g.add(h); cy(0.03, 1.2, lam('#2a2a2a'), 0, -1.2, 0, h); const ring = new T.Mesh(new T.TorusGeometry(0.8, 0.07, 8, 24), lam('#d4a017')); ring.rotation.x = Math.PI / 2; ring.position.y = -1.2; h.add(ring); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; cy(0.05, 0.22, lam('#fff6e0'), Math.cos(a) * 0.8, -1.2, Math.sin(a) * 0.8, h); sp(0.07, basic('#ffd27a'), Math.cos(a) * 0.8, -0.92, Math.sin(a) * 0.8, h, 8); } const gl = M.glow('#ffcf8a', 3, 0.6); gl.position.y = -1.1; h.add(gl); g.userData.sw = h; break; }
    case 'armor': { const m = lam('#b8c4d8'); cy(0.13, 0.75, m, -0.15, 0, 0, g); cy(0.13, 0.75, m, 0.15, 0, 0, g); bx(0.6, 0.7, 0.35, m, 0, 0.75, 0, g); sp(0.25, m, 0, 1.75, 0, g, 12); bx(0.3, 0.05, 0.05, basic('#111'), 0, 1.74, 0.23, g); cy(0.05, 0.25, lam('#e84a5f'), 0, 1.95, 0, g); bx(0.06, 1.3, 0.06, lam('#e6ecff'), 0.45, 0.4, 0.2, g); bx(0.8, 0.08, 0.5, lam('#4a3a2a'), 0, 0, 0, g); break; }
    case 'coatrack': { cy(0.05, 1.9, lam('#5a3a1a'), 0, 0, 0, g); cy(0.3, 0.06, lam('#5a3a1a'), 0, 0, 0, g); for (let i = 0; i < 4; i++) { const a = i * TAU / 4; bx(0.4, 0.05, 0.05, lam('#5a3a1a'), Math.cos(a) * 0.15, 1.75, Math.sin(a) * 0.15, g).rotation.y = a; } bx(0.5, 0.8, 0.2, lam('#3a5a8a'), 0.2, 0.95, 0, g); sp(0.22, lam('#8a2a2a'), -0.15, 1.95, 0, g, 10); break; }
    case 'chair': { const c = M.prop('chair'); g.add(c); break; }
    case 'cabinet': { const c = M.prop('cabinet'); c.rotation.y = -Math.PI / 2; g.add(c); const pl = new T.Group(); pl.position.y = 1.2; g.add(pl); for (let i = 0; i < 4; i++) { const p = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.04, 16), lam('#f2f6ff')); p.rotation.x = Math.PI / 2; p.position.set(-0.3, 0, -0.45 + i * 0.3); pl.add(p); } g.userData.plates = pl; break; }
    case 'armchair': { const r = new T.Group(); g.add(r); bx(0.9, 0.4, 0.9, lam('#8a2a4a'), 0, 0.3, 0, r); bx(0.9, 0.9, 0.2, lam('#8a2a4a'), 0, 0.6, -0.4, r); const rk = new T.Mesh(new T.TorusGeometry(0.6, 0.04, 6, 16, Math.PI * 0.6), lam('#5a3a1a')); rk.rotation.y = Math.PI / 2; rk.rotation.z = -Math.PI * 0.8; rk.position.set(0, 0.62, 0); r.add(rk); g.userData.rock = r; break; }
    case 'fireplace': { g.rotation.y = Math.PI / 2; bx(2.4, 2, 0.6, lam('#6a5a5a'), 0, 0, 0, g); bx(1.4, 1.1, 0.3, basic('#1a0a0a'), 0, 0.1, 0.2, g); bx(2.7, 0.2, 0.8, lam('#4a3a3a'), 0, 2, 0, g); const fl = new T.Group(); fl.position.set(0, 0.2, 0.25); g.add(fl); for (let i = 0; i < 3; i++) { const c = new T.Mesh(new T.ConeGeometry(0.18, 0.6, 8), basic(i % 2 ? '#ffb020' : '#ff6a1a')); c.position.set(-0.3 + i * 0.3, 0.3, 0); fl.add(c); } const gl = M.glow('#ff8a3d', 2.5, 0.7); gl.position.y = 0.4; fl.add(gl); g.userData.fire = fl; break; }
    case 'piano': { const p = M.prop('piano'); p.rotation.y = 0; g.add(p); g.userData.keys = p; break; }
    case 'statue': { bx(0.8, 0.5, 0.8, lam('#9a9aa8'), 0, 0, 0, g); const h = new T.Group(); h.position.y = 0.5; g.add(h); cy(0.3, 1.1, lam('#c8c8d4'), 0, 0, 0, h, 0.2); sp(0.3, lam('#d8d8e4'), 0, 1.4, 0, h, 12); sp(0.05, basic('#ff3b6b'), -0.1, 1.45, 0.27, h, 6); sp(0.05, basic('#ff3b6b'), 0.1, 1.45, 0.27, h, 6); g.userData.head = h; break; }
    case 'bigpaint': { bx(2.6, 2, 0.12, lam('#d4a017'), 0, 1, 0, g); bx(2.3, 1.7, 0.14, lam('#3a2a4a'), 0, 1.15, 0, g); sp(0.5, lam('#e8c8a8'), 0, 2.1, 0.08, g, 12).scale.z = 0.2; const e1 = sp(0.08, basic('#111'), -0.18, 2.18, 0.2, g, 8), e2 = sp(0.08, basic('#111'), 0.18, 2.18, 0.2, g, 8); g.userData.eyes = [e1, e2]; bx(1.1, 0.8, 0.1, lam('#2a1a3a'), 0, 1.3, 0.1, g); break; }
    case 'horse': { const r = new T.Group(); g.add(r); bx(1.1, 0.35, 0.35, lam('#d8a060'), 0, 0.5, 0, r); bx(0.3, 0.5, 0.3, lam('#d8a060'), 0.5, 0.8, 0, r); bx(0.12, 0.3, 0.32, lam('#6a3a1a'), 0.35, 0.9, 0, r); const rk = new T.Mesh(new T.TorusGeometry(0.7, 0.04, 6, 16, Math.PI * 0.6), lam('#8a2a2a')); rk.rotation.z = -Math.PI * 0.8; rk.position.y = 0.72; r.add(rk); g.userData.rock = r; break; }
    case 'chime': { cy(0.06, 1.6, lam('#5a3a1a'), 0, 0, 0, g); bx(0.8, 0.06, 0.06, lam('#5a3a1a'), 0, 1.6, 0, g); const b = new T.Mesh(new T.CylinderGeometry(0.12, 0.32, 0.5, 16, 1, true), lam(d.col, { emissive: d.col, emissiveIntensity: 0.25, side: T.DoubleSide })); b.position.set(0, 1.25, 0); g.add(b); g.userData.bell = b; cy(0.4, 0.06, lam('#3a2a1a'), 0, 0, 0, g); const gl = M.glow(d.col, 1.6, 0.3); gl.position.y = 1.25; g.add(gl); g.userData.gl = gl; break; }
    case 'portrait': { bx(1.5, 1.8, 0.1, lam('#d4a017'), 0, 0.9, 0, g); bx(1.25, 1.55, 0.12, lam(['#3a5a8a', '#8a3a5a', '#5a8a3a'][d.i]), 0, 1.02, 0, g); sp(0.38, lam('#f0d0b0'), 0, 1.85, 0.08, g, 12).scale.z = 0.25; const ew = [-0.13, 0.13].map((x) => sp(0.08, basic('#ffffff'), x, 1.92, 0.16, g, 8)); const pu = [-0.13, 0.13].map((x) => sp(0.045, basic('#111'), x, 1.92, 0.21, g, 6)); bx(0.9, 0.6, 0.12, lam('#2a2a3a'), 0, 1.0, 0.04, g); g.userData.pupils = pu; g.userData.whites = ew; g.position.y = 0.6; g.userData.frame = g.children[0]; g.userData.lift = 1; break; }
    case 'candle': { cy(0.07, 0.28, lam('#fff6e0'), 0, 0.92, 0, g); const f = new T.Mesh(new T.ConeGeometry(0.06, 0.16, 8), basic('#ffb020')); f.position.y = 1.3; g.add(f); const gl = M.glow('#ffb020', 1.2, 0.8); gl.position.y = 1.3; g.add(gl); g.userData.flame = [f, gl]; break; }
    case 'chest': { bx(1.3, 0.6, 0.8, lam('#7a3a1a'), 0, 0, 0, g); const lid = new T.Group(); lid.position.set(0, 0.6, -0.4); g.add(lid); bx(1.32, 0.18, 0.82, lam('#9a4a22'), 0, 0, 0.41, lid); bx(0.2, 0.2, 0.06, lam('#ffd23f'), 0, 0.42, 0.42, g); g.userData.lid = lid; break; }
  }
  return g;
}
function wispModel(col) {
  const g = new T.Group(); const body = new T.Group(); g.add(body);
  const mat = new T.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, transparent: true, opacity: 0.95 });
  sp(0.55, mat, 0, 1.3, 0, body, 18); const tail = new T.Mesh(new T.ConeGeometry(0.52, 0.9, 16), mat); tail.rotation.x = Math.PI; tail.position.y = 0.6; body.add(tail);
  const aL = sp(0.16, mat, -0.6, 1.15, 0.1, body, 10), aR = sp(0.16, mat, 0.6, 1.15, 0.1, body, 10);
  const eyeW = basic('#ffffff'), eyeB = basic('#1b1440');
  sp(0.15, eyeW, -0.2, 1.42, 0.45, body, 10); sp(0.15, eyeW, 0.2, 1.42, 0.45, body, 10); sp(0.08, eyeB, -0.2, 1.42, 0.58, body, 8); sp(0.08, eyeB, 0.2, 1.42, 0.58, body, 8);
  sp(0.07, basic('#ff9cc8'), -0.36, 1.25, 0.42, body, 8); sp(0.07, basic('#ff9cc8'), 0.36, 1.25, 0.42, body, 8);
  const mouth = sp(0.1, basic('#3a0a2a'), 0, 1.15, 0.5, body, 8); mouth.scale.set(1.3, 0.5, 0.5);
  const gl = M.glow(col, 3, 0.45); gl.position.y = 1.2; g.add(gl); const sh = M.disc(0.55, '#000000', 0.3); sh.position.y = 0.03; g.add(sh);
  g.userData = { body, mat, arms: [aL, aR], mouth, gl, sh }; return g;
}
const SKIN = ['#ffd7b0', '#e8b088', '#a8704a', '#7a4a2a'];
function guestModel(k, col, hat) {
  const g = new T.Group(), b = new T.Group(); g.add(b); const sk = lam(SKIN[(col.length + hat) % 4]); const shirt = lam(col);
  const s = k === 'kid' ? 0.75 : 1; b.scale.setScalar(s);
  const legs = [-0.15, 0.15].map((x) => { const l = new T.Group(); l.position.set(x, 0.75, 0); b.add(l); const m = new T.Mesh(new T.CylinderGeometry(0.11, 0.1, 0.75, 8), lam(k === 'granny' ? '#8a6aa8' : '#2d3a6a')); m.position.y = -0.37; l.add(m); bx(0.2, 0.1, 0.3, lam('#2a1a1a'), 0, -0.78, 0.04, l); return l; });
  const torso = cy(0.3, 0.7, shirt, 0, 0.72, 0, b, 0.26, 12); void torso;
  if (k === 'granny') cy(0.42, 0.55, shirt, 0, 0.45, 0, b, 0.3, 12);
  const arms = [-0.38, 0.38].map((x) => { const a = new T.Group(); a.position.set(x, 1.35, 0); b.add(a); const m = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.6, 8), shirt); m.position.y = -0.3; a.add(m); sp(0.08, sk, 0, -0.62, 0, a, 8); return a; });
  sp(0.3, sk, 0, 1.7, 0, b, 14); sp(0.045, basic('#1b1440'), -0.1, 1.74, 0.27, b, 6); sp(0.045, basic('#1b1440'), 0.1, 1.74, 0.27, b, 6);
  const mouth = sp(0.05, basic('#5a1a1a'), 0, 1.6, 0.28, b, 6);
  const hair = ['#3a2a1a', '#e8c060', '#a83a1a', '#1a1a1a', '#e0e0e8'][k === 'granny' ? 4 : (hat + col.length) % 4];
  if (k === 'granny') { sp(0.32, lam(hair), 0, 1.78, -0.05, b, 12); sp(0.16, lam(hair), 0, 2.02, -0.12, b, 10); bx(0.3, 0.06, 0.04, basic('#222'), 0, 1.75, 0.29, b); }
  else if (k === 'hunter') { cy(0.34, 0.2, lam('#2d6a4a'), 0, 1.86, 0, b, 0.3); bx(0.46, 0.06, 0.3, lam('#2d6a4a'), 0, 1.86, 0.25, b); }
  else if (k === 'rosie') { sp(0.33, lam('#a83a1a'), 0, 1.78, -0.04, b, 12); sp(0.12, lam('#ff4fd8'), 0.25, 1.95, 0, b, 8); }
  else if (hat === 0) { sp(0.32, lam(col), 0, 1.84, 0, b, 12).scale.y = 0.55; bx(0.36, 0.05, 0.3, lam(col), 0, 1.8, 0.25, b); }
  else sp(0.32, lam(hair), 0, 1.8, -0.04, b, 12).scale.y = 0.75;
  // accessories
  const hand = arms[1];
  if (k === 'tourist') { bx(0.22, 0.15, 0.12, lam('#222'), 0, -0.68, 0.12, hand); bx(0.07, 0.07, 0.08, lam('#6a8aff'), 0, -0.64, 0.2, hand); }
  if (k === 'influencer') { bx(0.12, 0.2, 0.03, lam('#111'), 0, -0.7, 0.12, hand); }
  if (k === 'hunter') { cy(0.06, 0.32, lam('#666'), 0, -0.85, 0.1, hand); }
  if (k === 'rosie') { const gl = M.glow('#ffd23f', 2.6, 0.5); gl.position.y = 1.2; g.add(gl); }
  const sh = M.disc(0.4, '#000000', 0.3); sh.position.y = 0.03; g.add(sh);
  g.userData = { b, legs, arms, mouth, s };
  return g;
}
function tag(key) { let el = view.tags[key]; if (!el) { el = document.createElement('div'); el.className = 'semTag'; $('semTags').appendChild(el); view.tags[key] = el; } el._seen = 1; return el; }
const _v = new T.Vector3();
function place(el, x, y, z) { _v.set(x, y, z).project(view.cam); if (_v.z > 1) { el.style.display = 'none'; return; } el.style.display = ''; el.style.transform = 'translate(' + ((_v.x * 0.5 + 0.5) * innerWidth).toFixed(0) + 'px,' + ((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(0) + 'px) translate(-50%,-100%)'; }
const FACES = ['\uD83D\uDE00', '\uD83D\uDE42', '\uD83D\uDE1F', '\uD83D\uDE28', '\uD83D\uDE31'];
function render(dt, time) {
  const V = view; if (!V || !S) return;
  const me = S.gh[myId] || Object.values(S.gh)[0];
  // ghosts
  const seenG = {};
  for (const id in S.gh) { const g = S.gh[id]; seenG[id] = 1; let m = V.gh[id]; if (!m) { m = V.gh[id] = { g: wispModel(g.col || '#b8f0ff'), x: g.x, z: g.z }; V.root.add(m.g); }
    const k = role === 'client' && id !== myId ? Math.min(1, dt * 12) : role === 'client' ? Math.min(1, dt * 16) : 1; m.x += (g.x - m.x) * k; m.z += (g.z - m.z) * k;
    const u = m.g.userData; m.g.position.set(m.x, 0, m.z); m.g.rotation.y += angDiff(m.g.rotation.y, g.ang) * Math.min(1, dt * 10);
    u.body.position.y = 0.25 + Math.sin(time * 2.5 + id.length) * 0.15; const boo = g.boo > 0 ? Math.sin((0.6 - g.boo) / 0.6 * Math.PI) : 0;
    u.body.scale.setScalar(1 + boo * 0.45); u.mouth.scale.set(1.3 + boo * 1.2, 0.5 + boo * 2.4, 0.5); u.arms[0].position.y = u.arms[1].position.y = 1.15 + boo * 0.5;
    const op = g.inv ? (id === myId ? 0.28 : 0.15) : g.stun > 0 ? 0.55 + Math.sin(time * 30) * 0.2 : 0.95; u.mat.opacity = op; u.gl.material.opacity = g.inv ? 0.12 : 0.45; u.body.children.forEach((c) => { if (c.material !== u.mat) c.visible = !g.inv || id === myId; });
    const t = tag('g' + id); t.innerHTML = (id === myId ? '\u2B50 ' : '') + esc(g.name || 'Ghost') + (g.stun > 0 ? ' \uD83D\uDCAB' : ''); t.className = 'semTag gh'; place(t, m.x, 2.6, m.z); }
  for (const id in V.gh) if (!seenG[id]) { V.root.remove(V.gh[id].g); delete V.gh[id]; }
  // guests
  const seenU = {};
  S.gu.forEach((u) => { seenU[u.id] = 1; let m = V.gu[u.id]; if (!m) { m = V.gu[u.id] = { g: guestModel(u.k, u.col || '#ff7a3d', u.hat | 0), x: u.x, z: u.z }; V.root.add(m.g); }
    const k = role === 'client' ? Math.min(1, dt * 10) : 1; const px = m.x, pz = m.z; m.x += (u.x - m.x) * k; m.z += (u.z - m.z) * k;
    const spd = Math.hypot(m.x - px, m.z - pz) / Math.max(dt, 1e-3); const ud = m.g.userData; m.g.position.set(m.x, 0, m.z); m.g.rotation.y += angDiff(m.g.rotation.y, u.ang) * Math.min(1, dt * 10);
    const ph = time * (u.st === 'flee' ? 16 : 9); const sw = spd > 0.3 ? Math.sin(ph) * 0.6 : 0; ud.legs[0].rotation.x = sw; ud.legs[1].rotation.x = -sw;
    const scared = u.st === 'flee' || u.st === 'scared'; ud.arms[0].rotation.x = scared ? -2.8 : -sw; ud.arms[1].rotation.x = scared ? -2.8 : (u.k === 'tourist' || u.k === 'influencer' || u.k === 'hunter') && u.st === 'look' ? -1.3 : sw; ud.arms[0].rotation.z = scared ? 0.3 : 0; ud.arms[1].rotation.z = scared ? -0.3 : 0;
    ud.b.position.y = u.st === 'scared' ? Math.abs(Math.sin(time * 14)) * 0.3 : 0; ud.mouth.scale.setScalar(scared ? 2.2 : 1);
    if (u.flashT && !m.fl) { m.fl = M.glow(u.k === 'hunter' ? '#fff6a0' : '#ffffff', 3, 0.9); m.fl.position.set(0.3, 1.4, 0.6); m.g.add(m.fl); } if (m.fl) m.fl.visible = !!u.flashT;
    const t = tag('u' + u.id); const f = Math.min(4, Math.floor(u.fear / 20)); t.className = 'semTag gu' + (u.k === 'rosie' ? ' rosie' : '');
    t.innerHTML = (u.k === 'rosie' ? '\uD83D\uDC9B ROSIE' : (u.st === 'flee' ? '\uD83D\uDE31' : FACES[f]) + '<i style="width:' + Math.round(u.fear) + '%"></i>') + (u.sayT > 0 && u.say ? '<b>' + esc(u.say) + '</b>' : '');
    place(t, m.x, 2.35 * (u.k === 'kid' ? 0.8 : 1), m.z); });
  for (const id in V.gu) if (!seenU[id]) { V.root.remove(V.gu[id].g); delete V.gu[id]; }
  for (const k in V.tags) { const el = V.tags[k]; if (!el._seen) { el.remove(); delete V.tags[k]; } else el._seen = 0; }
  // objects
  const P = S.pz, near = me ? nearObj(me) : -1;
  V.obj.forEach((o, i) => { const h = S.ob[i] && S.ob[i].h > 0, d = o.d, u = o.g.userData; const ht = h ? time : 0;
    o.hi.material.opacity = i === near ? 0.85 : (d.puz ? 0.2 : 0.12) + (h ? 0.4 : 0); o.hi.material.color.set(d.puz ? '#3ff0ff' : '#b46bff'); o.hi.scale.setScalar(i === near ? 1 + Math.sin(time * 6) * 0.08 : 1);
    o.g.position.copy(o.base); o.g.rotation.set(0, o.ry, 0);
    if (d.anim === 'swing' && u.sw) { u.sw.rotation.z = h ? Math.sin(ht * 7) * 0.45 : Math.sin(time * 0.8) * 0.03; }
    else if (d.anim === 'walk' && h) { o.g.position.x = o.base.x + Math.sin(ht * 3) * 0.6; o.g.rotation.y = Math.sin(ht * 6) * 0.3; o.g.position.y = Math.abs(Math.sin(ht * 8)) * 0.15; }
    else if (d.anim === 'spin' && h) o.g.rotation.y = ht * 12;
    else if (d.anim === 'slide' && h) { o.g.position.z = o.base.z + Math.sin(ht * 4) * 1.2; o.g.rotation.y = ht * 5; o.g.position.y = 0.3 + Math.sin(ht * 9) * 0.2; }
    else if (d.anim === 'plates' && u.plates) { u.plates.children.forEach((p, k) => { p.position.x = h ? -0.3 - Math.abs(Math.sin(ht * 4 + k)) * 1.6 : -0.3; p.position.y = h ? Math.sin(ht * 5 + k) * 0.6 : 0; p.rotation.z = h ? ht * 8 : 0; }); }
    else if (d.anim === 'rock' && u.rock) u.rock.rotation.z = h ? Math.sin(ht * 7) * 0.35 : 0;
    else if (d.anim === 'fire' && u.fire) { u.fire.children.forEach((c) => { if (c.material && c.material.color) c.material.color.set(h ? '#5dff8a' : (c.position.x === 0 ? '#ffb020' : '#ff6a1a')); }); u.fire.scale.setScalar(h ? 1.8 + Math.sin(ht * 20) * 0.2 : 1 + Math.sin(time * 12) * 0.05); }
    else if (d.anim === 'play' && h) { o.g.position.y = Math.abs(Math.sin(ht * 10)) * 0.1; o.g.rotation.z = Math.sin(ht * 13) * 0.04; }
    else if (d.anim === 'turn' && u.head) u.head.rotation.y = h ? Math.sin(ht * 3) * 1.5 : 0;
    else if (d.anim === 'eyes' && u.eyes) u.eyes.forEach((e) => { e.material.color.set(h ? '#ff3b6b' : '#111'); e.scale.setScalar(h ? 1.8 : 1); });
    if (d.puz === 'chime' && u.bell) { u.bell.rotation.z = h ? Math.sin(ht * 20) * 0.4 : 0; u.gl.material.opacity = h || P.chimes ? 0.9 : 0.3; }
    if (d.puz === 'portrait' && u.pupils) { const dir = (P.por || [0, 0, 0])[d.i]; u.pupils.forEach((p, k) => { p.position.x = (k ? 0.13 : -0.13) + (dir - 1) * 0.035; }); const ok = P.porOk || (P.por && P.por[d.i] === PORTRAIT_GOAL[d.i]); u.frame.material.emissive = new T.Color(ok ? '#6a5000' : '#000000'); }
    if (d.puz === 'candle' && u.flame) { const on = P.cand && (P.cand[d.i] || !P.ward); u.flame.forEach((f) => { f.visible = !!on; }); u.flame[0].scale.setScalar(1 + Math.sin(time * 12 + d.i) * 0.15); }
    if (d.puz === 'chest' && u.lid) u.lid.rotation.x = P.chest ? -1.4 : (h ? -0.3 : 0);
  });
  // sheet of music: the chime order (blank until you visit, then shows the coloured notes)
  const key = (P.seq || []).join('') + P.prog + (P.chimes ? 'x' : ''); if (V.sheet.key !== key) { V.sheet.key = key; const g = V.sheet.cvs.getContext('2d'); g.fillStyle = '#fff8e8'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#555'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(10, 30 + i * 16); g.lineTo(246, 30 + i * 16); g.stroke(); }
    const cols = ['#ff4d6d', '#3fa8ff', '#ffe14d', '#4ade80']; (P.seq || []).forEach((c, i) => { g.fillStyle = cols[c]; g.beginPath(); g.ellipse(45 + i * 55, 78 - i * 10, 16, 12, -0.3, 0, TAU); g.fill(); g.strokeStyle = '#222'; g.stroke(); g.fillRect(58 + i * 55, 20, 4, 58 - i * 10); if (i < P.prog || P.chimes) { g.fillStyle = '#16a34a'; g.font = 'bold 22px sans-serif'; g.fillText('\u2713', 36 + i * 55, 122); } }); V.sheet.stex.needsUpdate = true; }
  V.wi.forEach((w, i) => { const on = S.wi[i] && S.wi[i].on; w.visible = !!on; w.position.y = 1 + Math.sin(time * 3 + i) * 0.2; });
  V.pieces.forEach((p, i) => { p.visible = !!(P.pick && P.pick[i]); p.rotation.y = time * 1.5; p.position.y = 1.4 + Math.sin(time * 2 + i) * 0.15; });
  V.wardG.visible = !!P.ward; if (V.ward) V.ward.visible = !!P.ward; V.wardG.children.forEach((c) => { c.material.opacity = 0.14 + Math.sin(time * 3) * 0.05; });
  V.crystal.material.color.set(P.ward ? '#d8b0ff' : '#7dff9e'); V.crystal.position.y = 1.25 + Math.sin(time * 2) * 0.08;
  // lights: flicker
  ROOMS.forEach((r, i) => { const L = V.roomLights[i]; const f = S.fl && S.fl[i]; L.intensity = f ? (Math.random() < 0.5 ? 0.05 : 1.4) : (r.sealed && P.ward ? 0.35 : 0.9); });
  // camera: angled top-down follow; walls between the camera and you fade out
  const fx = me ? (V.gh[me.id] ? V.gh[me.id].x : me.x) : 0, fz = me ? (V.gh[me.id] ? V.gh[me.id].z : me.z) : 8;
  const portrait = innerHeight > innerWidth; const hgt = portrait ? 15 : 12, back = portrait ? 11 : 9.5;
  V.camP.lerp(_v.set(fx, hgt, fz + back), Math.min(1, dt * 5)); V.cam.position.copy(V.camP); V.cam.lookAt(fx, 0.5, fz - (portrait ? 0.5 : 1));
  const asp = innerWidth / innerHeight; if (Math.abs(V.cam.aspect - asp) > 1e-3) { V.cam.aspect = asp; V.cam.fov = portrait ? 62 : 50; V.cam.updateProjectionMatrix(); }
  V.walls.forEach((w) => { const front = !w.vert && w.cz > fz + 0.2 && w.cz < fz + 9 && fx > w.a - 3 && fx < w.b + 3; const op = front ? 0.18 : 1; w.m.material.opacity += (op - w.m.material.opacity) * Math.min(1, dt * 8); w.t.material.opacity = w.m.material.opacity; w.m.material.depthWrite = w.m.material.opacity > 0.9; if (w.win) w.win.forEach((q) => { q.visible = w.m.material.opacity > 0.5; }); });
  SP.V.renderer.render(V.sc, V.cam);
}

/* ---------------- HUD + input ---------------- */
const IN = { jx: 0, jz: 0, keys: {}, q: [] };
function ui() {
  if ($('sem')) return;
  const d = document.createElement('div'); d.id = 'sem'; d.className = 'hidden';
  d.innerHTML = '<div id="semTags"></div><div id="semTop"><div id="semClock"></div><div id="semScore"></div><div id="semEcto"><i></i><span>ECTO</span></div><div id="semPieces"></div><button id="semPause" class="rbtn" type="button" aria-label="Pause">&#10074;&#10074;</button></div>' +
    '<div id="semHint"></div><div id="semJoy"><div id="semJoyB"><div id="semJoyK"></div></div><div class="jh">FLOAT</div></div>' +
    '<div id="semBtns"><button class="cbtn sboo" id="sbBoo" type="button"><i>\uD83D\uDC7B</i><b>BOO!</b></button><button class="cbtn shaunt" id="sbHaunt" type="button"><i>\uD83E\uDE91</i><b>HAUNT</b></button><button class="cbtn svan" id="sbVan" type="button"><i>\uD83E\uDEE5</i><b>VANISH</b></button><button class="cbtn sfl" id="sbFl" type="button"><i>\uD83D\uDCA1</i><b>FLICKER</b></button></div>' +
    '<div id="semCard" class="hidden"></div>';
  document.body.appendChild(d);
  const zone = $('semJoy'), base = $('semJoyB'), knob = $('semJoyK'); let jid = null, ox = 0, oy = 0; const R = 50;
  zone.addEventListener('pointerdown', (e) => { if (jid !== null) return; jid = e.pointerId; try { zone.setPointerCapture(jid); } catch (er) { /* ignore */ } ox = e.clientX; oy = e.clientY; const r = zone.getBoundingClientRect(); base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px'; e.preventDefault(); Snd.init(); });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId !== jid) return; let dx = e.clientX - ox, dy = e.clientY - oy; const dd = Math.hypot(dx, dy); if (dd > R) { dx *= R / dd; dy *= R / dd; } IN.jx = dx / R; IN.jz = dy / R; if (Math.hypot(IN.jx, IN.jz) < 0.12) IN.jx = IN.jz = 0; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; });
  const up = (e) => { if (e.pointerId !== jid) return; jid = null; IN.jx = IN.jz = 0; knob.style.transform = ''; base.style.left = ''; base.style.top = ''; };
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
  const b = (id, a) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); Snd.init(); IN.q.push(a); });
  b('sbBoo', 'boo'); b('sbHaunt', 'haunt'); b('sbVan', 'vanish'); b('sbFl', 'flicker');
  $('semPause').addEventListener('click', () => pauseCard());
  addEventListener('keydown', (e) => { if (!SEM.on || e.repeat) return; IN.keys[e.code] = true; const a = { Space: 'boo', KeyE: 'haunt', KeyJ: 'haunt', KeyQ: 'vanish', KeyF: 'flicker', KeyR: 'flicker' }[e.code]; if (a) { IN.q.push(a); e.preventDefault(); } if (e.code === 'Escape' || e.code === 'KeyP') pauseCard(); });
  addEventListener('keyup', (e) => { IN.keys[e.code] = false; });
}
function inputVec() { const k = IN.keys; let x = IN.jx, z = IN.jz; if (k.KeyA || k.ArrowLeft) x -= 1; if (k.KeyD || k.ArrowRight) x += 1; if (k.KeyW || k.ArrowUp) z -= 1; if (k.KeyS || k.ArrowDown) z += 1; const m = Math.hypot(x, z); if (m > 1) { x /= m; z /= m; } return [x, z]; }
let hintT = 0;
function hint(t, sec) { const h = $('semHint'); h.textContent = t; h.classList.add('on'); hintT = sec || 3; }
function hud(dt) {
  const me = S.gh[myId] || Object.values(S.gh)[0]; if (!me) return;
  const mm = Math.max(0, Math.ceil(S.dawn)); $('semClock').innerHTML = (S.fam ? '\uD83D\uDC9B FAMILY NIGHT' : '\uD83C\uDF19 NIGHT ' + S.night) + '<small>' + Math.floor(mm / 60) + ':' + String(mm % 60).padStart(2, '0') + ' to dawn</small>';
  $('semScore').innerHTML = S.fam ? 'Find Rosie!' : '\uD83D\uDE31 <b>' + S.scared + '</b>/' + S.quota;
  $('semEcto').querySelector('i').style.width = Math.round(me.ecto) + '%'; $('semPieces').innerHTML = '\uD83E\uDDE9 ' + (S.pz.piece || []).filter(Boolean).length + '/3';
  const near = nearObj(me), ro = S.fam && S.gu.find((q) => q.k === 'rosie'); const hb = $('sbHaunt');
  if (ro && dist(ro.x, ro.z, me.x, me.z) < 2.6) { hb.classList.add('hot'); hb.querySelector('b').textContent = 'SHOW PHOTO'; hb.querySelector('i').textContent = '\uD83D\uDDBC\uFE0F'; }
  else { hb.classList.toggle('hot', near >= 0); hb.querySelector('b').textContent = near >= 0 && OBJ[near].puz ? 'TOUCH' : 'HAUNT'; hb.querySelector('i').textContent = near >= 0 && OBJ[near].puz ? '\u2728' : '\uD83E\uDE91'; }
  $('sbVan').classList.toggle('on', !!me.inv); $('sbBoo').classList.toggle('dim', me.ecto < 12); $('sbFl').classList.toggle('dim', me.ecto < 30);
  hintT -= dt; if (hintT <= 0) $('semHint').classList.remove('on');
}
const FX = { boo: 'boo', haunt: 'giggle', chime: 'coin', solved: 'gem', piece: 'key', scream: 'down', gone: 'coin', wisp: 'heart', flashed: 'hurt', flicker: 'flash', wrong: 'wrong', vanish: 'pop', appear: 'pop', portrait: 'click', candle: 'pop', blowout: 'wrong', bus: 'door', family: 'bossdown', noecto: 'wrong' };
function onEv(e) {
  if (FX[e.e]) Snd.fx(FX[e.e]);
  const mine = !e.id || e.id === myId;
  switch (e.e) {
    case 'boo': if (e.id === myId) { if (e.surprise) hint('SURPRISE! Sneaky BOOs (while VANISHED or from behind) scare way more! \uD83D\uDC7B', 2.2); else if (!e.hit) hint('Nobody close enough! Float right up to a guest, then BOO!', 2.2); } break;
    case 'noecto': if (mine) hint('Out of ECTO! Wait a moment or grab a green ecto wisp \uD83D\uDFE2', 2.2); break;
    case 'nothing': if (mine) hint('Float next to something glowing purple to HAUNT it!', 2); break;
    case 'flashed': if (e.id === myId) hint('A Ghost Hunter flashed you! VANISH or sneak up from behind!', 2.5); break;
    case 'bus': hint('\uD83D\uDE8C A tour bus! ' + e.n + ' new guest' + (e.n > 1 ? 's' : '') + ' at the front door.', 2.5); break;
    case 'gone': toast('\uD83D\uDE31 A guest ran out screaming! ' + S.scared + (S.fam ? '' : '/' + S.quota)); break;
    case 'solved': {
      const msg = { chimes: '\uD83C\uDFB5 The chimes play the old family song! The piano opens\u2026 a PHOTO PIECE!', portraits: '\uD83D\uDDBC\uFE0F All the portraits look at the clock. A secret drawer pops open: a PHOTO PIECE!', ward: '\uD83D\uDD6F\uFE0F The seance candles glow\u2026 the blue ward around the Sealed Study fades away!', chest: '\uD83E\uDDF8 The old toy chest creaks open: the last PHOTO PIECE!' }[e.p];
      banner(msg); break; }
    case 'piece': { const n = (S.pz.piece || []).filter(Boolean).length; banner('\uD83E\uDDE9 PHOTO PIECE ' + n + '/3! ' + STORY[e.i] + (n >= 3 ? ' (Finish this night for a special visitor\u2026)' : ''), 7); break; }
    case 'wrong': hint('Wrong note! Check the music stand for the chime order.', 2); break;
    case 'blowout': hint('A guest blew out a seance candle! Scare everyone out of the Dining Room first.', 2.6); break;
    case 'rosie': banner('\uD83D\uDC9B A girl with a golden locket walks in\u2026 It\u2019s ROSIE WILLOWMERE! Don\u2019t scare her: float up and SHOW PHOTO.', 7); break;
    case 'family': banner('\uD83D\uDC9B Rosie: "Wisp?! Grandma told me all about you! We never forgot you."', 6); break;
    case 'end': if (role !== 'client') showEnd(); break;
  }
}
let toastT = 0;
function toast(t) { G.toast(t); void toastT; }
function banner(t, s) { G.banner(t, s || 5); }
function card(html, bind) { const c = $('semCard'); c.innerHTML = '<div class="card">' + html + '</div>'; c.classList.remove('hidden'); if (bind) bind(c); }
function closeCard() { $('semCard').classList.add('hidden'); }
let paused = false;
function pauseCard() {
  if (!SEM.on || (S && S.end)) return; paused = role === 'solo';
  card('<h2>\uD83D\uDC7B PAUSED</h2>' + howHtml() + '<div class="btncol"><button class="btn primary" id="semRes" type="button">RESUME</button><button class="btn red small" id="semQuit" type="button">' + (role === 'client' ? 'LEAVE SPOOK \u2019EM' : 'QUIT SPOOK \u2019EM') + '</button></div>', (c) => {
    c.querySelector('#semRes').onclick = () => { paused = false; closeCard(); };
    c.querySelector('#semQuit').onclick = () => { paused = false; closeCard(); stop(); };
  });
}
function howHtml() {
  return '<ul class="semHow"><li>\uD83D\uDD79\uFE0F <b>Float</b> with the left stick. Ghosts drift right through walls!</li><li>\uD83D\uDC7B <b>BOO!</b> next to guests. Sneaky BOOs (while <b>VANISHED</b> or from behind) scare way more.</li><li>\uD83E\uDE91 <b>HAUNT</b> glowing purple things: swing the chandelier, play the piano, make the armor walk!</li><li>\uD83D\uDCA1 <b>FLICKER</b> the lights to spook a whole room.</li><li>\uD83D\uDE31 When a guest\u2019s fear bar fills, they run out the front door.</li><li>\uD83D\uDD26 Ghost Hunters flash visible ghosts. Sneak up on them!</li><li>\uD83E\uDDE9 Solve the mansion\u2019s mysteries (cyan glow) to find the 3 photo pieces.</li></ul>';
}
function showEnd() {
  const E = S.end; if (!E) return;
  const st = '\u2B50'.repeat(E.stars) + '\u2606'.repeat(3 - E.stars);
  let h;
  if (E.fam) h = E.win ? '<h2>\uD83D\uDC9B THE WILLOWMERES CAME BACK!</h2><p class="sub">Rosie found the photo you saved: the whole family, and a tiny ghost in the corner. You! She promises to visit every weekend.</p><p class="sub"><b>THE END\u2026</b> (but the tourists keep coming. Keep spooking!)</p>' : '<h2>\uD83C\uDF05 DAWN!</h2><p class="sub">Rosie went home before you could show her the photo. Try Family Night again!</p>';
  else h = '<h2>' + (E.win ? '\uD83C\uDF05 DAWN! YOU DID IT!' : '\uD83C\uDF05 DAWN\u2026') + '</h2><div class="semStars">' + st + '</div><p class="sub">You spooked <b>' + E.scared + '</b> guest' + (E.scared === 1 ? '' : 's') + ' (goal ' + E.quota + ').' + (E.win ? '' : ' Too many guests stayed till morning. Try again!') + '</p>';
  h += '<p class="sub">+' + E.coins + ' \uD83E\uDE99 for your ghost-hunting upgrades</p><p class="sub small">\uD83E\uDDE9 Photo pieces: ' + (S.pz.piece || []).filter(Boolean).length + '/3</p>';
  const host = role !== 'client';
  h += '<div class="btncol">' + (host ? '<button class="btn primary" id="semNext" type="button">' + (E.win && !E.fam ? 'NEXT NIGHT \uD83C\uDF19' : 'PLAY AGAIN') + '</button>' : '<p class="sub small">The host picks what\u2019s next\u2026</p>') + '<button class="btn alt small" id="semBack" type="button">' + (role === 'client' ? 'LEAVE' : 'BACK') + '</button></div>';
  card(h, (c) => { const n = c.querySelector('#semNext'); if (n) n.onclick = () => { closeCard(); begin(); }; c.querySelector('#semBack').onclick = () => { closeCard(); stop(); }; });
}

/* ---------------- flow ---------------- */
function players() { const me = { id: myId, name: G.myName(), col: G.save().color }; const out = [me]; if (inRoom()) for (const pid in GS.others) { const o = GS.others[pid]; out.push({ id: pid, name: o.name || 'Friend', col: o.color || '#3ff0ff' }); } return out; }
function begin() {
  newSim(players()); closeCard(); paused = false;
  if (role === 'host') N().bcast({ t: 'semon', on: 1 });
  const fam = S.fam;
  card('<h2>' + (fam ? '\uD83D\uDC9B FAMILY NIGHT' : '\uD83C\uDF19 NIGHT ' + S.night) + '</h2><p class="sub">' + (fam ? 'You found all 3 photo pieces! Tonight someone special visits Willowmere Mansion\u2026 Find ROSIE and SHOW her the photo. Don\u2019t scare her away!' : 'Spook <b>' + S.quota + '</b> guests out of Willowmere Mansion before dawn!' + (S.hunters ? ' \uD83D\uDD26 Ghost Hunters are coming tonight!' : '')) + '</p>' + (S.night === 1 && !fam ? howHtml() : '') + '<div class="btncol"><button class="btn primary" id="semGo" type="button">START HAUNTING!</button></div>', (c) => { paused = true; c.querySelector('#semGo').onclick = () => { paused = false; closeCard(); Snd.music('dark'); }; });
}
function show(on) { $('sem').classList.toggle('hidden', !on); document.body.classList.toggle('semOn', on); }
SEM.start = function () {
  if (!SP.DLC.on()) { SEM.preview(); return; }
  ui(); myId = GS.pid; role = inRoom() ? (N().room.isHost ? 'host' : 'client') : 'solo';
  if (role === 'client') { G.toast('Only the host can start SPOOK \u2019EM for the room.', true); return; }
  GS.semBack = GS.ui; GS.ui = 'sem'; G.UI.showScreens(); Snd.hold(null);
  view = buildView(); SEM.on = true; show(true); begin(); loopStart();
};
function startClient() {
  if (SEM.on) return; ui(); myId = GS.pid; role = 'client'; GS.semBack = 'game'; GS.ui = 'sem'; G.UI.showScreens(); Snd.hold(null);
  S = newSimClient(); view = buildView(); SEM.on = true; show(true); closeCard(); loopStart(); G.toast('The host started SPOOK \u2019EM! You\u2019re a ghost now \uD83D\uDC7B'); Snd.music('dark');
}
function stop(fromHost) {
  if (!SEM.on) return; SEM.on = false; show(false); closeCard();
  if (view) { for (const k in view.tags) view.tags[k].remove(); view.sc.traverse((o) => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); }); } view = null; S = null;
  if (role === 'host') { N().bcast({ t: 'semon', on: 0 }); G.goRoom(G.startRoom()); GS.ui = 'game'; G.UI.showScreens(); }
  else if (role === 'client') { GS.ui = GS.rid ? 'game' : 'title'; G.UI.showScreens(); if (!fromHost) { G.N.leave(); GS.rid = null; GS.me = null; GS.ui = 'title'; G.UI.showScreens(); G.UI.title && G.UI.title(); } }
  else { GS.ui = GS.semBack === 'game' || GS.semBack === 'pause' ? (GS.rid ? 'game' : 'title') : 'title'; G.UI.showScreens(); if (GS.ui === 'title' && G.UI.title) G.UI.title(); }
  role = 'solo';
}
SEM.stop = stop;
function loopStart() { /* the main game loop calls SEM.tick while SEM.on */ }
SEM.tick = (dt, time) => frame(dt, time);
function frame(dt, time) {
  const v = inputVec();
  if (role === 'client') {
    netT -= dt; const a = IN.q.shift(); if (netT <= 0 || a) { netT = 1 / 15; N().send({ t: 'semi', jx: v[0], jz: v[1], a: a || null }); }
    const me = S.gh[myId]; if (me && !S.end) { me.x += v[0] * 5.4 * dt * 0.5; me.z += v[1] * 5.4 * dt * 0.5; }
  } else if (S) {
    const me = S.gh[myId]; if (me) { me.ix = v[0]; me.iz = v[1]; const a = IN.q.shift(); if (a && !paused) me.act = a; }
    if (!paused) step(dt);
    const evs = S.ev.splice(0); evs.forEach(onEv);
    if (role === 'host') { snapT -= dt; if (snapT <= 0 || evs.length) { snapT = 1 / 12; const p = pack(); p.ev = evs; N().bcast({ t: 'sems', s: p }); } }
  }
  if (!view || !S) return;
  render(dt, time); hud(dt);
}
SEM.debug = { step: (s) => { const n = Math.round(s / 0.05); for (let i = 0; i < n && S && !S.end; i++) { step(0.05); S.ev.splice(0).forEach(onEv); } }, act: (a) => { const me = S.gh[myId]; act(me, a); S.ev.splice(0).forEach(onEv); }, tp: (x, z) => { const me = S.gh[myId]; me.x = x; me.z = z; }, OBJ, PORTRAIT_GOAL, ROOMS, role: () => role, unpause: () => { paused = false; closeCard(); } };

/* ---------------- locked preview (not owned) ---------------- */
SEM.preview = function () {
  ui(); show(false);
  const c = $('semCard'); c.classList.remove('hidden'); document.getElementById('sem').classList.remove('hidden');
  c.innerHTML = '<div class="card"><div class="semLockT">\uD83D\uDD12 DLC</div><h2>\uD83D\uDC7B SPOOK \u2019EM</h2><p class="sub"><b>Ratita Industries Super Pack</b></p><ul class="semHow"><li>\uD83D\uDC7B Play as WISP, a little ghost in the abandoned Willowmere Mansion</li><li>\uD83D\uDE31 Spook tourists, kids, influencers and Ghost Hunters out the front door</li><li>\uD83E\uDE91 Ghost powers: BOO, HAUNT furniture, VANISH, FLICKER the lights</li><li>\uD83E\uDDE9 Solve the mansion\u2019s mysteries and find the 3 lost photo pieces</li><li>\uD83D\uDC00 2 new bosses in the hunt: MECHA-RATITA 3000 and The Cheddar Phantom (2 new lab floors)</li><li>\uD83E\uDD1D Online: the host shares the pack with friends</li></ul><div class="btncol"><a class="btn primary" href="' + SP.DLC.SHOP + '">UNLOCK IN THE GROK ARCADE (25 \uD83C\uDF9F\uFE0F)</a><button class="btn alt small" id="semPrevBack" type="button">BACK</button></div></div>';
  c.querySelector('#semPrevBack').onclick = () => { c.classList.add('hidden'); document.getElementById('sem').classList.add('hidden'); };
};
})();
