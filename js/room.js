/* Grok Spooks - deterministic room layouts (pure data, used by sim + tests) and the 3D room view */
(function () {
'use strict';
const SP = window.SP;
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
SP.hash = hash; SP.rng = rng;
const DOOR_W = 2.6;
SP.DOOR_W = DOOR_W;

/* beam layouts in metres (room centred). mirrors: [x,z,solvedOrientation('/'|'\\')] */
const BEAMS = [
  { em: [-1, -4], mir: [[-2, -4, '\\'], [-2, 2, '\\'], [4, 2, '/'], [1, -1.5, null]], tg: [4, -4.5] },
  { em: [-1, 3], mir: [[-3, 3, '/'], [-3, -3, '/'], [3, -3, '\\'], [0, 0, null]], tg: [3, 4.2] },
  { em: [-1, -3], mir: [[-3, -3, '\\'], [-3, 3, '\\'], [3, 3, '/'], [0, 0.5, null]], tg: [3, -0.8] }
];

SP.layout = function (rid) {
  const def = SP.room(rid); if (!def) return null;
  const A = SP.AREAS[def.a], w = def.w, d = def.d, hw = w / 2, hd = d / 2;
  const R = rng(hash('room:' + rid));
  const L = { id: rid, def, area: def.a, w, d, hw, hd, pal: A.pal, doors: [], props: [], keep: [], puz: null, gems: [], elev: null, chest: null };
  // doors
  SP.doorsOf(rid).forEach((dr, i) => {
    let x = 0, z = 0, nx = 0, nz = 0;
    if (dr.side === 'N') { z = -hd; nz = 1; } else if (dr.side === 'S') { z = hd; nz = -1; } else if (dr.side === 'E') { x = hw; nx = -1; } else { x = -hw; nx = 1; }
    L.doors.push({ i, side: dr.side, to: dr.to, lock: dr.lock, dark: dr.darkSide, x, z, nx, nz });
    L.keep.push({ x: x + nx * 2, z: z + nz * 2, r: 2.8 });
  });
  if (def.hub) { L.elev = { x: -hw + 2.6, z: -hd + 0.2 }; L.keep.push({ x: L.elev.x, z: L.elev.z + 1.5, r: 2.4 }); }
  if (def.boss) L.keep.push({ x: 0, z: 0, r: 7 });
  const hasN = L.doors.some((q) => q.side === 'N');
  const chestPos = () => ({ x: hasN ? hw * 0.55 : 0, z: -hd + 1.5 });
  // puzzles
  const pz = def.puz;
  if (pz) {
    const P = L.puz = { type: pz };
    if (pz === 'plates') { P.plates = [{ x: -w * 0.27, z: -d * 0.08 }, { x: w * 0.27, z: -d * 0.08 }]; }
    else if (pz === 'levers') { P.levers = [{ x: -hw + 0.7, z: -hd + 2.4, nx: 1 }, { x: hw - 0.7, z: -hd + 2.4, nx: -1 }]; }
    else if (pz === 'fan') { P.fans = [{ x: -w * 0.3, z: -d * 0.22 }, { x: w * 0.3, z: -d * 0.22 }]; }
    else if (pz === 'crate') { P.crate = { x: -w * 0.22, z: d * 0.12 }; P.plate = { x: w * 0.22, z: -d * 0.12 }; L.keep.push({ seg: [P.crate.x, P.crate.z, P.plate.x, P.plate.z], r: 2.2 }); }
    else if (pz === 'paint') {
      P.painting = { x: hasN ? -w * 0.28 : 0, z: -hd + 0.15 };
      P.candles = [{ x: -w * 0.3, z: d * 0.18 }, { x: -w * 0.1, z: d * 0.05 }, { x: w * 0.1, z: d * 0.05 }, { x: w * 0.3, z: d * 0.18 }];
      const order = [0, 1, 2, 3].sort(() => R() - 0.5); P.cols = order; // candle i colour index
      L.keep.push({ x: P.painting.x, z: P.painting.z + 1.5, r: 2.2 });
    } else if (pz === 'dark') {
      const spots = [{ x: -hw + 0.12, z: -d * 0.25, wall: 'W' }, { x: hw - 0.12, z: -d * 0.25, wall: 'E' }, { x: w * 0.25, z: -hd + 0.12, wall: 'N' }, { x: -w * 0.25, z: -hd + 0.12, wall: 'N' }];
      const ok = spots.filter((s) => !L.doors.some((q) => Math.hypot(q.x - s.x, q.z - s.z) < 3.2));
      P.sw = ok[Math.floor(R() * ok.length)] || spots[0];
    } else if (pz === 'beam') {
      const bi = ['stacks', 'pond', 'clockface'].indexOf(rid); const B = BEAMS[Math.max(0, bi)];
      const sc = Math.min(1, (hw - 1.2) / 6);
      P.em = { x: -hw + 0.5, z: B.em[1] }; P.mir = B.mir.map((m, i) => ({ x: m[0] * sc, z: m[1], sol: m[2], o: m[2] ? (m[2] === '/' ? '\\' : '/') : (i % 2 ? '/' : '\\') }));
      P.tg = { x: B.tg[0] * sc, z: B.tg[1] };
      L.keep.push({ seg: [P.em.x, P.em.z, hw, P.em.z], r: 1.2 });
      P.mir.forEach((m) => { L.keep.push({ seg: [m.x, m.z, m.x, P.em.z], r: 1 }); L.keep.push({ seg: [m.x, m.z, P.tg.x, m.z], r: 1 }); L.keep.push({ x: m.x, z: m.z, r: 1.6 }); });
      L.keep.push({ x: P.tg.x, z: P.tg.z, r: 1.6 });
    }
    ['plates', 'levers', 'fans', 'candles'].forEach((k) => (P[k] || []).forEach((p) => L.keep.push({ x: p.x, z: p.z, r: 2 })));
    if (P.sw) L.keep.push({ x: P.sw.x, z: P.sw.z, r: 2 });
    if (P.crate) { L.keep.push({ x: P.crate.x, z: P.crate.z, r: 2.4 }); L.keep.push({ x: P.plate.x, z: P.plate.z, r: 2.2 }); }
    L.chest = chestPos(); L.keep.push({ x: L.chest.x, z: L.chest.z, r: 1.8 });
  }
  // props along the walls (band) + a few islands in open rooms
  const kinds = A.props; const want = Math.round(w * d / (def.boss ? 30 : 20));
  const coll = (x, z, pw, pd) => {
    for (const k of L.keep) {
      if (k.seg) { const [ax, az, bx, bz] = k.seg; const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)); if (Math.hypot(x - (ax + vx * t), z - (az + vz * t)) < k.r + Math.max(pw, pd) / 2) return true; }
      else if (Math.abs(x - k.x) < k.r + pw / 2 && Math.abs(z - k.z) < k.r + pd / 2 && Math.hypot(Math.max(0, Math.abs(x - k.x) - pw / 2), Math.max(0, Math.abs(z - k.z) - pd / 2)) < k.r) return true;
    }
    for (const p of L.props) if (Math.abs(x - p.x) < (pw + p.w) / 2 + 0.5 && Math.abs(z - p.z) < (pd + p.d) / 2 + 0.5) return true;
    return false;
  };
  const SIZES = {}; // footprint per kind (matches models)
  const FP = { chair: [0.7, 0.7], table: [2.3, 1.2], vase: [0.6, 0.6], clock: [0.9, 0.6], sofa: [2.1, 1], plant: [0.7, 0.7], piano: [1.9, 1.1], bench: [1.9, 0.6], statue: [0.9, 0.9], cabinet: [1.4, 0.6], shelf: [2.5, 0.6], desk: [1.9, 1], globe: [0.8, 0.8], books: [0.7, 0.6], lamp: [0.5, 0.5], stove: [1.5, 0.9], fridge: [1.1, 0.9], counter: [2.5, 0.9], barrel: [0.85, 0.85], crate: [0.95, 0.95], pots: [1.3, 0.7], sacks: [1.2, 0.8], pot: [0.9, 0.9], cactus: [0.7, 0.7], fern: [0.9, 0.9], sarco: [1, 2.1], urn: [0.7, 0.7], pillar: [1, 1], case: [1.3, 0.9], coffin: [0.9, 2], gear: [2, 2], trunk: [1.3, 0.8], mirror: [1.1, 0.4] };
  SP.FP = FP; void SIZES;
  let tries = 0;
  while (L.props.length < want && tries++ < 400) {
    const k = kinds[Math.floor(R() * kinds.length)]; let [pw, pd] = FP[k] || [1, 1];
    const side = Math.floor(R() * 4), island = !def.puz && !def.boss && R() < 0.22;
    let x, z, rot = 0;
    if (island) { x = (R() - 0.5) * (w - 7); z = (R() - 0.5) * (d - 6); rot = R() < 0.5 ? 0 : 1; }
    else if (side === 0) { x = (R() - 0.5) * (w - 3); z = -hd + pd / 2 + 0.25; }
    else if (side === 1) { x = (R() - 0.5) * (w - 3); z = hd - pd / 2 - 0.6; rot = 2; }
    else { rot = side === 2 ? 1 : 3; [pw, pd] = [pd, pw]; x = side === 2 ? -hw + pw / 2 + 0.25 : hw - pw / 2 - 0.25; z = (R() - 0.5) * (d - 3); }
    if (island && rot === 1) [pw, pd] = [pd, pw];
    if (Math.abs(x) + pw / 2 > hw - 0.2 || Math.abs(z) + pd / 2 > hd - 0.2) continue;
    if (coll(x, z, pw, pd)) continue;
    L.props.push({ i: L.props.length, k, x, z, w: pw, d: pd, rot, t: 'furn', solid: 1 });
  }
  // deco: rug, cobwebs (corners), curtains (north wall)
  const addDeco = (o) => { o.i = L.props.length; L.props.push(o); return o; };
  if (!def.boss) {
    const rx = (R() - 0.5) * 2, rz = d * 0.1;
    if (!L.keep.some((k) => !k.seg && Math.hypot(k.x - rx, k.z - rz) < k.r + 1)) addDeco({ k: 'rug', x: rx, z: rz, w: 3.4, d: 2.2, rot: 0, t: 'rug' });
  }
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], ci) => { if (ci < 2 || R() < 0.5) addDeco({ k: 'web', x: sx * (hw - 0.6), z: sz * (hd - 0.6), w: 1.2, d: 1.2, rot: 0, t: 'web' }); });
  const curX = [-w * 0.18, w * 0.18].filter((cx) => !L.doors.some((q) => q.side === 'N' && Math.abs(q.x - cx) < 3) && !(L.elev && Math.abs(L.elev.x - cx) < 2.5) && !(L.puz && L.puz.painting && Math.abs(L.puz.painting.x - cx) < 2.4) && !(L.puz && L.puz.sw && L.puz.sw.wall === 'N' && Math.abs(L.puz.sw.x - cx) < 1.6));
  curX.forEach((cx) => addDeco({ k: 'curtain', x: cx, z: -hd + 0.25, w: 1.8, d: 0.3, rot: 0, t: 'curtain' }));
  // gems
  const furn = L.props.filter((p) => p.t === 'furn');
  (def.gems || []).forEach((how, j) => {
    const gi = def.gemIdx[j]; const g = { gi, how };
    if (how === 'web' || how === 'curtain') { const c = L.props.filter((p) => p.t === how && !p.gem); const p = c[0] || furn[0]; if (p) { p.gem = gi + 1; g.prop = p.i; } }
    else if (how === 'furn') { const p = furn[Math.floor(R() * furn.length)]; if (p) { p.gem = gi + 1; g.prop = p.i; } }
    else if (how === 'dark') { g.x = (R() - 0.5) * (w - 6); g.z = (R() - 0.5) * (d - 6); }
    L.gems.push(g);
  });
  const free = furn.filter((p) => !p.gem);
  if (def.boo && free.length) L.booProp = free[Math.floor(R() * free.length)].i;
  L.hideProps = free.filter((p) => p.i !== L.booProp).map((p) => p.i);
  return L;
};
SP.doorEntry = function (L, door) { return { x: door.x + door.nx * 1.6, z: door.z + door.nz * 1.6 }; };

/* beam trace: returns {pts:[[x,z]...], hit:bool} for current mirror orientations */
SP.beamTrace = function (P, hw, hd) {
  let x = P.em.x, z = P.em.z, dx = 1, dz = 0; const pts = [[x, z]]; let hit = false;
  for (let b = 0; b < 12; b++) {
    let best = null, bt = 1e9;
    const cand = P.mir.map((m) => ({ m, x: m.x, z: m.z })).concat([{ tg: 1, x: P.tg.x, z: P.tg.z }]);
    for (const c of cand) {
      const rx = c.x - x, rz = c.z - z; const t = rx * dx + rz * dz; if (t < 0.3) continue;
      const off = Math.abs(rx * dz - rz * dx); if (off > 0.45) continue;
      if (t < bt) { bt = t; best = c; }
    }
    if (!best) { // to wall
      let t = 1e9; if (dx > 0) t = (hw - x); if (dx < 0) t = (x + hw); if (dz > 0) t = (hd - z); if (dz < 0) t = (z + hd);
      pts.push([x + dx * t, z + dz * t]); break;
    }
    x = best.x; z = best.z; pts.push([x, z]);
    if (best.tg) { hit = true; break; }
    const o = best.m.o; // '/' : E->N, N->E, W->S, S->W  (N = -z)
    let ndx, ndz; if (o === '/') { ndx = -dz; ndz = -dx; } else { ndx = dz; ndz = dx; }
    dx = ndx; dz = ndz;
  }
  return { pts, hit };
};
})();
