/* Grok Spooks - game controller: save, local hunter, goo clone, input, host loop, events, HUD */
(function () {
'use strict';
const SP = window.SP, GN = window.GrokNet, Sim = SP.Sim, V = SP.V, Snd = SP.Snd;
const $ = (id) => document.getElementById(id);
const G = SP.G = {};
G.$ = $;
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window) && navigator.maxTouchPoints > 0);
G.IS_TOUCH = IS_TOUCH;

/* ---------------- save ---------------- */
const KEY = 'grokSpooks_v1';
const DEF = () => ({ v: 1, name: '', color: GN.COLORS[0], hero: 0, muted: false, assist: false, coins: 0, gems: {}, boos: {}, keys: {}, bosses: {}, rooms: {}, doors: {}, upg: { vac: 0, flash: 0, heart: 0, magnet: 0 }, cur: 'porch', caught: {}, tut: 0, visited: {}, stats: { caught: 0, coins: 0 } });
let save = DEF();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) save = Object.assign(DEF(), s, { upg: Object.assign(DEF().upg, s.upg || {}), stats: Object.assign(DEF().stats, s.stats || {}) }); } catch (e) { /* ignore */ }
if (!save.name) { const gp = GN.savedProfile(); if (gp.hasName) { save.name = gp.name; save.color = gp.color; } }
G.save = () => save;
G.persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } };
G.myName = () => GN.cleanName(save.name || 'Hunter');
G.gemCount = (a) => Object.keys(save.gems).filter((k) => a == null || k.indexOf('g' + a + '_') === 0).length;
G.booCount = () => Object.keys(save.boos).length;
G.areaOpen = (a) => a === 0 || !!save.bosses[a - 1];
G.maxHp = () => (3 + (save.upg.heart || 0) + (save.assist ? 2 : 0)) * 2;
Snd.setMuted(!!save.muted);

/* ---------------- state ---------------- */
const GS = G.GS = { ui: 'title', pid: GN.pid(), role: 'solo', others: {}, rid: null, me: null, clone: null, ctrl: 'me', paused: false, hint: '', hintT: 0, toastQ: [], lastT: 0, time: 0, roomT: 0, evc: {} };
function newMe(x, z) { return { id: GS.pid, pid: GS.pid, x, z, ang: Math.PI, hp: G.maxHp(), down: false, downT: 0, inv: 0, vac: 0, blow: 0, dark: 0, pull: [0, 0], mv: 0, flashT: 0, cd: 0 }; }
G.assistOn = () => !!save.assist;
Sim.init({
  assist: () => (GS.role === 'client' ? false : !!save.assist),
  hurt: (pid, dmg, x, z) => { if (pid === GS.pid) G.hurtMe(dmg, x, z); else if (G.N) G.N.sendTo(pid, { t: 'hurt', d: dmg, x, z }); },
  collect: (b, p) => G.collect(b.pid, p),
  revive: (pid) => { if (pid === GS.pid) G.reviveMe(); else if (G.N) G.N.sendTo(pid, { t: 'revive' }); },
  clonePop: (pid) => { if (pid === GS.pid) G.popClone(); }
});

/* ---------------- rooms ---------------- */
function roomOpts(rid) {
  const def = SP.room(rid), a = def.a; const taken = {};
  for (const k in save.gems) taken[k] = 1;
  return { cleared: !!save.rooms[rid], hasKey: !!save.keys[a], revDoors: save.doors[rid] || [], taken, booDone: !!save.boos[a], bossBeaten: !!save.bosses[a], haunt: !!save.rooms[rid] && Math.random() < 0.3 };
}
G.roomOpts = roomOpts;
// host/solo: change room for everyone
G.goRoom = function (rid, from, viaElev) {
  if (GS.role === 'client') return;
  const o = roomOpts(rid); G.enterRoom(rid, from, o, viaElev);
  if (G.N) G.N.bcast({ t: 'room', rid, from: from || null, o, el: viaElev ? 1 : 0 });
};
G.enterRoom = function (rid, from, o, viaElev) {
  const W = Sim.load(rid, o);
  GS.rid = rid; GS.roomT = 0; save.visited[rid] = 1;
  if (GS.role !== 'client') { save.cur = rid; }
  G.persist();
  const L = W.L; let ex = 0, ez = L.hd - 2;
  const d = from ? L.doors.find((q) => q.to === from) : null;
  if (d) { const e = SP.doorEntry(L, d); ex = e.x; ez = e.z; }
  else if (viaElev && L.elev) { ex = L.elev.x; ez = L.elev.z + 2.2; }
  else if (L.def.tut) { ex = 0; ez = L.hd - 2; }
  else if (L.doors.length) { const e = SP.doorEntry(L, L.doors.find((q) => !q.dark) || L.doors[0]); ex = e.x; ez = e.z; }
  const slot = G.N && G.N.room ? (G.N.room.me() || {}).slot || 0 : 0; ex += (slot === 1 ? 1 : slot === 2 ? -1 : 0);
  const hp = GS.me ? GS.me.hp : G.maxHp(); GS.me = newMe(ex, ez); GS.me.hp = Math.max(1, Math.min(G.maxHp(), hp)); GS.me.ang = d ? Math.atan2(d.nx, d.nz) : Math.PI;
  GS.cp = { x: ex, z: ez }; GS.clone = null; GS.ctrl = 'me'; GS.waitDoor = 0; GS.elevLock = 1;
  V.buildRoom(W); V.snapCam(ex, ez);
  G.UI && G.UI.roomIn(W);
  const hint = L.def.hint && !save['h_' + rid] ? L.def.hint : '';
  if (hint) { save['h_' + rid] = 1; G.persist(); setTimeout(() => G.hintMsg(hint, 7), 900); }
  if (L.def.boss && !W.cleared) Snd.music('boss'); else Snd.music(W.cleared ? 'lit' : 'dark');
  Snd.fx('door');
};

/* ---------------- damage / revive ---------------- */
G.hurtMe = function (dmg, x, z) {
  const me = GS.me; if (!me || me.down || me.inv > 0 || GS.ui !== 'game') return;
  if (save.assist) dmg = Math.max(1, Math.floor(dmg / 2));
  me.hp -= dmg; me.inv = 1.2; Snd.fx('hurt'); V.shake(0.5);
  if (x != null) { const a = Math.atan2(me.x - x, me.z - z); me.kx = Math.sin(a) * 6; me.kz = Math.cos(a) * 6; }
  if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { /* ignore */ }
  if (me.hp <= 0) { me.hp = 0; me.down = true; me.downT = 0; me.vac = me.blow = me.dark = 0; Snd.fx('down'); G.toast(G.alone() ? 'Spooked! Back to the door\u2026' : 'Spooked! Your friend can revive you: they stand next to you.', true); }
};
G.reviveMe = function () { const me = GS.me; if (!me || !me.down) return; me.down = false; me.hp = Math.max(4, Math.ceil(G.maxHp() / 2)); me.inv = 2; Snd.fx('revive'); G.toast('Revived! \uD83D\uDCAA'); };
G.alone = () => !(G.N && G.N.room && G.N.room.count() > 1);
function respawn() { const me = GS.me; me.down = false; me.hp = G.maxHp(); me.inv = 2.5; me.x = GS.cp.x; me.z = GS.cp.z; GS.clone = null; GS.ctrl = 'me'; Snd.fx('revive'); }
G.popClone = function () { if (!GS.clone) return; V.burst(GS.clone.x, 1, GS.clone.z, '#39ff6a', 14, 3); GS.clone = null; GS.ctrl = 'me'; G.toast('Goo clone popped! Tap SWAP to make a new one.'); };

/* ---------------- loot ---------------- */
G.collect = function (pid, p) {
  // host side: apply + tell everyone
  const msg = { t: 'got', pid, k: p.k, v: p.v || 0, gi: p.gi, a: p.a != null ? p.a : SP.room(GS.rid).a, x: p.x, z: p.z };
  G.applyGot(msg); if (G.N) G.N.bcast(msg);
};
G.applyGot = function (m) {
  const mine = m.pid === GS.pid;
  if (m.k === 'coin' || m.k === 'bill' || m.k === 'gold') { save.coins += m.v; save.stats.coins += m.v; if (mine || G.alone()) Snd.fx('coin'); V.floatText(m.x, 1.4, m.z, '+' + m.v, '#ffe14d'); }
  else if (m.k === 'heart') { if (mine && GS.me) { GS.me.hp = Math.min(G.maxHp(), GS.me.hp + 2); Snd.fx('heart'); V.floatText(m.x, 1.4, m.z, '\u2764', '#ff4d6d'); } }
  else if (m.k === 'gem') { const key = 'g' + m.a + '_' + m.gi; const fresh = !save.gems[key]; save.gems[key] = 1; Snd.fx('gem'); if (fresh) G.banner('\uD83D\uDC8E GEM FOUND! ' + G.gemCount(m.a) + '/' + SP.AREAS[m.a].gemN + ' in ' + SP.AREAS[m.a].n); }
  else if (m.k === 'key') { save.keys[m.a] = 1; Snd.fx('key'); G.banner('\uD83D\uDD11 You got the ' + SP.AREAS[m.a].n + ' key! It opens the locked gold door.'); }
  G.persist(); G.UI && G.UI.hud();
};

/* ---------------- events from the sim (host) or network (client) ---------------- */
G.onEvents = function (list) { list.forEach(onEv); };
function evPos(e) { return [e.x || 0, e.z || 0]; }
function onEv(e) {
  const W = Sim.W(); GS.evc[e.e] = (GS.evc[e.e] || 0) + 1;
  switch (e.e) {
    case 'flash': if (e.id !== GS.pid && e.id !== GS.pid + ':g') { V.flashFx(e.x, e.z, e.ang); Snd.fx('flash'); } break;
    case 'stun': Snd.fx('stun'); V.burst(e.x, 1.4, e.z, '#ffe14d', 8, 2.5, 0.4); break;
    case 'block': if (!e.pid || e.pid === GS.pid) blockHint(e.why); break;
    case 'catch': Snd.fx('catchg'); break;
    case 'cap': { Snd.fx('cap'); V.burst(e.x, 1, e.z, (SP.EN[e.k] || {}).col || '#fff', 18, 4, 0.6); V.floatText(e.x, 2, e.z, 'GOT IT!', '#4ade80'); save.caught[e.k] = (save.caught[e.k] || 0) + 1; save.stats.caught++; G.persist(); break; }
    case 'slam': Snd.fx('slam'); V.shake(0.8); V.ringFx(e.x, e.z, 2.5, '#ffe14d'); V.floatText(e.x, 2.4, e.z, 'SLAM! -' + e.dmg, '#ff9f43'); break;
    case 'free': Snd.fx('wrong'); break;
    case 'loot': Snd.fx('pop'); V.burst(e.x, 1, e.z, '#ffe9a8', 8, 2.5, 0.35); break;
    case 'boo': Snd.fx('boo'); G.toast('\uD83D\uDC7B A Boo was hiding here! FLASH it when it looks at you.'); break;
    case 'boolaugh': Snd.fx('boo'); break;
    case 'boocap': save.boos[e.a] = 1; G.persist(); G.banner('\uD83D\uDC7B BOO CAUGHT! ' + G.booCount() + '/' + SP.AREAS.length); break;
    case 'flush': Snd.fx('giggle'); G.toast('Found a hiding ghost!'); break;
    case 'pop': Snd.fx('giggle'); break;
    case 'wave': Snd.fx('giggle'); if (GS.roomT > 0.5) G.toast('More ghosts! \uD83D\uDC7B'); break;
    case 'boss': Snd.fx('boss'); G.UI.bossIntro(e.b); Snd.music('boss'); break;
    case 'bossopen': Snd.fx('stun'); G.toast('Now! Hold VAC! \uD83C\uDF00'); break;
    case 'bossfree': Snd.fx('wrong'); if (e.ph > 1) G.toast(e.timeout ? 'It got away! Try again.' : 'It broke free! Phase ' + e.ph + '!'); break;
    case 'bossdown': { Snd.fx('bossdown'); V.shake(1.2); V.burst(e.x, 2, e.z, '#ffe14d', 40, 6, 0.8, 1.2); save.bosses[e.a] = 1; save.rooms[GS.rid] = 1; G.persist(); const nx = SP.AREAS[e.a + 1]; G.banner('\uD83C\uDFC6 ' + SP.BOSS[e.b].n + ' CAPTURED!' + (nx ? ' The elevator now goes to the ' + nx.n + '!' : ' You saved Grok Manor!'), 6); Snd.music('lit'); if (!nx) setTimeout(() => G.UI.ending(), 2500); break; }
    case 'dizzy': Snd.fx('stun'); G.hintMsg('Dizzy! FLASH now!', 2.5); break;
    case 'stuckhat': G.hintMsg('His hat is stuck! PLUNGER it!', 3); break;
    case 'rest': G.hintMsg('He\u2019s resting! Hold VAC on his bandages!', 3); break;
    case 'bulbs': G.hintMsg('Hold DARK to find the real bulb, then FLASH it!', 3); break;
    case 'bulb': Snd.fx(e.real ? 'stun' : 'pop'); if (!e.real) G.toast('Fake bulb! Use DARK to find the glowing one.'); break;
    case 'clear': { if (W) W.cleared = true; save.rooms[e.rid] = 1; G.persist(); Snd.fx('clear'); Snd.music('lit'); V.burst(0, 2, 0, '#ffe9a8', 30, 5, 0.7, 1.3); G.banner('\uD83D\uDCA1 ROOM CLEAR! The lights are back on!'); break; }
    case 'solved': Snd.fx('solved'); V.burst(e.x, 1.2, e.z, '#ffe14d', 20, 4); G.toast('\u2728 Puzzle solved! The chest opened!'); break;
    case 'candle': Snd.fx(e.ok ? 'candle' : 'wrong'); if (!e.ok) G.toast('Oops, wrong order! Look at the painting.', true); break;
    case 'lever': Snd.fx('lever'); break;
    case 'mirror': Snd.fx('mirror'); break;
    case 'plunge': Snd.fx('plunge'); V.plungeFx(e.x, e.z, e.tx, e.tz); break;
    case 'shadesoff': case 'helmet': case 'shieldoff': case 'hatoff': case 'unwrap': Snd.fx('pop'); V.burst(e.x, 1.2, e.z, '#ffffff', 10, 3, 0.4); break;
    case 'bones': Snd.fx('breakx'); G.hintMsg('Quick! VAC the glowing skull!', 2.5); break;
    case 'rebuild': Snd.fx('giggle'); break;
    case 'ammo': if (e.pid === GS.pid) { Snd.fx('pop'); G.hintMsg('Got it! Now BLOW to fire it back!', 3); } break;
    case 'fire': Snd.fx('throwx'); break;
    case 'reflect': Snd.fx('mirror'); break;
    case 'throw': Snd.fx('throwx'); break;
    case 'break': Snd.fx('breakx'); V.burst(e.x, 1, e.z, '#ffd0a0', 6, 2, 0.3); break;
    case 'cast': Snd.fx('cast'); break;
    case 'summon': Snd.fx('giggle'); V.burst(e.x, 1, e.z, '#b46bff', 14, 3); break;
    case 'tp': V.burst(e.x, 1, e.z, '#b46bff', 10, 2.5); break;
    case 'quake': Snd.fx('quake'); V.shake(0.6); V.ringFx(e.x, e.z, 3.4, '#ff9f43'); break;
    case 'swing': Snd.fx('throwx'); break;
    case 'tele': if (e.dmg) { V.ringFx(e.x, e.z, e.r || 1.5, '#ff3b5c'); } break;
    case 'reveal': Snd.fx('reveal'); V.burst(e.x, 1.2, e.z, '#c58bff', 12, 2.5, 0.45); break;
    case 'doorrev': { Snd.fx('reveal'); const a = save.doors[GS.rid] = save.doors[GS.rid] || []; if (a.indexOf(e.i) < 0) a.push(e.i); G.persist(); G.toast('\u2728 A hidden door appeared!'); break; }
    case 'gemspot': V.burst(e.x, 1, e.z, '#ffffff', 10, 3, 0.4); break;
    case 'clonepop': if (e.pid === GS.pid) G.popClone(); break;
    case 'poof': V.burst(e.x, 1, e.z, '#ffffff', 10, 3); break;
    case 'tut': G.UI.tut(e.s); if (e.s >= 5) { save.tut = 1; G.persist(); } break;
    case 'pullc': Snd.fx('plunge'); break;
  }
}
function blockHint(why) {
  const t = { shades: '\uD83D\uDE0E Sunglasses! PLUNGER them off first.', shield: '\uD83D\uDEE1\uFE0F Shield! Hold VAC to pull the shield away (or flash from behind).', polter: 'Too quick! Catch its throw with VAC, then BLOW it back.', mummy: 'Mummies shrug off light. Hold VAC to unwrap it!', armor: 'Clang! PLUNGER the helmet off.', witch: 'Flash her while she chants, or BLOW her orb back!', brute: 'Too strong! FLASH it when it\u2019s tired after a slam.', boo: 'The Boo is hiding its face. FLASH when it looks at you!', bones: 'Now VAC the skull!', boss: 'Not yet! Watch for its weak moment.', bulb: 'Use DARK to find the real bulb, then FLASH it!' }[why];
  if (t) G.hintMsg(t, 3);
}

/* ---------------- input ---------------- */
const IN = G.IN = { jx: 0, jz: 0, vac: 0, blow: 0, dark: 0, keys: {} };
G.press = function (a) {
  if (GS.ui !== 'game' || !GS.me) return; Snd.init();
  const b = ctrlBody(); if (!b || (b === GS.me && GS.me.down)) return;
  if (a === 'flash') {
    if (b.tugE && b.tugE.slam >= 1) { act(b, 'slam'); return; }
    if (b.cd > 0) return; b.cd = 0.45; aimAssist(b, 'flash'); b.flashT = 0.25;
    const r = Sim.flashR(bodyUpg(b)), an = Sim.flashA(bodyUpg(b)); V.flashFx(b.x, b.z, b.ang, r, an); Snd.fx('flash'); act(b, 'flash');
  } else if (a === 'plunge') { if (b.pcd > 0) return; b.pcd = 0.5; aimAssist(b, 'plunge'); act(b, 'plunge'); }
  else if (a === 'swap') swap();
};
function bodyUpg(b) { return { uv: save.upg.vac, uf: save.upg.flash, x: b.x, z: b.z }; }
function act(b, a) { const id = b === GS.me ? GS.pid : GS.pid + ':g'; if (GS.role === 'client') G.N.send({ t: 'act', a, ang: b.ang, x: b.x, z: b.z }); else { syncBodies(); Sim.act(id, a, { ang: b.ang }); } }
function ctrlBody() { return GS.ctrl === 'clone' && GS.clone ? GS.clone : GS.me; }
function swap() {
  if (!G.alone()) { G.toast('The Goo clone is for solo play. Team up with your friend!'); return; }
  Snd.fx('swap');
  if (!GS.clone) { const me = GS.me; const r = SP.collide(me.x + Math.cos(me.ang) * 1.3, me.z - Math.sin(me.ang) * 1.3, 0.45, { doors: false }); GS.clone = { id: GS.pid + ':g', clone: 1, x: r.x, z: r.z, ang: me.ang, vac: 0, blow: 0, dark: 0, pull: [0, 0], mv: 0, flashT: 0, cd: 0, hold: null }; V.burst(r.x, 1, r.z, '#39ff6a', 16, 3); G.toast('Goo clone made! Tap SWAP again to control it.'); return; }
  const from = ctrlBody(); from.hold = { vac: IN.vac, blow: IN.blow, dark: IN.dark };
  GS.ctrl = GS.ctrl === 'me' ? 'clone' : 'me'; const to = ctrlBody(); to.hold = null;
  if (from.hold.vac || from.hold.blow || from.hold.dark) G.toast((from === GS.me ? 'You keep' : 'The goo keeps') + ' ' + (from.hold.vac ? 'vacuuming' : from.hold.blow ? 'blowing' : 'shining the dark-light') + '!');
}
function aimAssist(b, kind) {
  const W = Sim.W(); if (!W) return; let best = null, bs = 1e9;
  const cands = [];
  if (kind === 'flash') W.ents.forEach((e) => { if (e.st === 'hide' || e.st === 'tug' || e.st === 'stun' || (e.k === 'invis' && !e.rev)) return; cands.push([e.x, e.z, e.k === 'boss' ? 8 : 7.5]); });
  if (kind === 'flash' && W.boss && W.boss.bulbs) W.boss.bulbs.forEach((u) => { if (!u.pop) cands.push([u.x, u.z, 7.5]); });
  if (kind === 'flash' && W.puz && W.L.puz.candles && !W.puz.solved) W.L.puz.candles.forEach((c, i) => { if ((W.puz.lit || []).indexOf(i) < 0) cands.push([c.x, c.z, 4.5]); });
  if (kind === 'vac') W.ents.forEach((e) => { if (e.st === 'stun' || e.st === 'open' || e.st === 'bones' || e.k === 'swarm') cands.push([e.x, e.z, 6]); });
  if (kind === 'vac') W.proj.forEach((p) => { if (!p.refl && p.k !== 'orb') cands.push([p.x, p.z, 5]); });
  if (kind === 'plunge') { W.ents.forEach((e) => { if ((e.k === 'shades' && e.sh) || (e.k === 'armor' && !e.free) || (e.k === 'boss' && e.st === 'stuck')) cands.push([e.x, e.z, 8]); }); const P = W.L.puz; if (P && W.puz && !W.puz.solved) { (P.levers || []).forEach((l) => cands.push([l.x, l.z, 8])); if (P.sw && W.puz.rev >= 1) cands.push([P.sw.x, P.sw.z, 8]); if (P.type === 'crate') cands.push([W.puz.cx, W.puz.cz, 8]); (P.mir || []).forEach((m) => cands.push([m.x, m.z, 5])); } }
  for (const [x, z, r] of cands) { const d = Math.hypot(x - b.x, z - b.z); if (d > r) continue; const da = Math.abs(SP.angDiff(b.ang, Math.atan2(x - b.x, z - b.z))); if (da > 1.3 && d > 3) continue; const s = da * 3 + d * 0.4; if (s < bs) { bs = s; best = [x, z]; } }
  if (best) b.ang = Math.atan2(best[0] - b.x, best[1] - b.z);
}

/* ---------------- bodies for the sim ---------------- */
function bodyState(b, id, held) {
  const h = held || {};
  return { id, pid: GS.pid, clone: b.clone ? 1 : 0, x: b.x, z: b.z, ang: b.ang, vac: h.vac != null ? h.vac : b.vac, blow: h.blow != null ? h.blow : b.blow, dark: h.dark != null ? h.dark : b.dark, pull: b.pull, down: b.down ? 1 : 0, uv: save.upg.vac, uf: save.upg.flash, um: save.upg.magnet };
}
function syncBodies() {
  const W = Sim.W(); if (!W) return;
  const keep = {};
  const put = (s) => { const old = W.bodies[s.id]; if (old) Object.assign(old, s); else W.bodies[s.id] = s; keep[s.id] = 1; };
  put(bodyState(GS.me, GS.pid, GS.ctrl !== 'me' ? GS.me.hold : null));
  if (GS.clone) put(bodyState(GS.clone, GS.pid + ':g', GS.ctrl !== 'clone' ? GS.clone.hold : null));
  for (const pid in GS.others) { const o = GS.others[pid]; if (o.s && o.rid === GS.rid) put(Object.assign({ id: pid, pid }, o.s, { clone: 0 })); }
  for (const id in W.bodies) if (!keep[id]) delete W.bodies[id];
}
G.syncBodies = syncBodies;
G.mySnap = function () { const me = GS.me; if (!me) return null; return { x: +me.x.toFixed(2), z: +me.z.toFixed(2), ang: +me.ang.toFixed(2), vac: me.vac, blow: me.blow, dark: me.dark, pull: [+me.pull[0].toFixed(2), +me.pull[1].toFixed(2)], down: me.down ? 1 : 0, uv: save.upg.vac, uf: save.upg.flash, um: save.upg.magnet, hero: save.hero, mv: me.mv, inv: me.inv > 0 ? 1 : 0, hp: me.hp, mhp: G.maxHp() }; };

/* ---------------- per-frame local movement ---------------- */
function moveBody(b, dt, ix, iz, live) {
  const W = Sim.W();
  const tugE = W.ents.find((e) => e.st === 'tug' && e.cb && e.cb.indexOf(b.id) >= 0);
  b.tugE = tugE || null;
  let sp = 4.6;
  if (b.vac || b.blow || b.dark) sp *= 0.72;
  const m = Math.hypot(ix, iz); b.pull = [ix, iz]; b.mv = m > 0.15 ? 1 : 0;
  if (tugE) {
    b.ang = Math.atan2(tugE.x - b.x, tugE.z - b.z);
    const ok = m > 0.3 && (ix * Math.sin(tugE.pd) + iz * Math.cos(tugE.pd)) / m < -0.3; b.tugOK = ok;
    const big = tugE.k === 'boss' || tugE.k === 'brute';
    b.x += ix * sp * 0.3 * dt + Math.sin(tugE.pd) * dt * (ok ? 0.25 : big ? 1.4 : 0.9); b.z += iz * sp * 0.3 * dt + Math.cos(tugE.pd) * dt * (ok ? 0.25 : big ? 1.4 : 0.9);
  } else if (live && m > 0.12) { b.x += ix * sp * dt; b.z += iz * sp * dt; b.ang += SP.angDiff(b.ang, Math.atan2(ix, iz)) * Math.min(1, dt * 14); }
  if (b.kx) { b.x += b.kx * dt; b.z += b.kz * dt; b.kx *= Math.pow(0.02, dt); b.kz *= Math.pow(0.02, dt); if (Math.abs(b.kx) < 0.1) b.kx = b.kz = 0; }
  const r = SP.collide(b.x, b.z, 0.45, { doors: !b.clone });
  b.x = r.x; b.z = r.z;
  return r.door;
}
G.frame = function (dt) {
  const W = Sim.W(); if (!W || !GS.me) return;
  GS.roomT += dt;
  const me = GS.me;
  // input vector
  let ix = IN.jx, iz = IN.jz; const k = IN.keys;
  if (k.KeyA || k.ArrowLeft) ix -= 1; if (k.KeyD || k.ArrowRight) ix += 1; if (k.KeyW || k.ArrowUp) iz -= 1; if (k.KeyS || k.ArrowDown) iz += 1;
  const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; }
  const cb = ctrlBody(), other = cb === me ? GS.clone : me;
  if (me.down) { me.vac = me.blow = me.dark = 0; me.downT += dt; if (G.alone() && me.downT > 1.6) respawn(); else if (me.downT > 15) { G.reviveMe(); } else if (!G.alone() && G.N && G.N.allDown && G.N.allDown()) respawn(); }
  // tools held by controlled body; the other keeps its latched hold
  if (!(cb === me && me.down)) { cb.vac = IN.vac || k.KeyK || k.ShiftLeft || k.ShiftRight ? 1 : 0; cb.blow = IN.blow || k.KeyL || k.KeyB ? 1 : 0; cb.dark = IN.dark || k.KeyF || k.KeyU ? 1 : 0; if (cb.blow) cb.vac = 0; if (cb.vac || cb.blow) cb.dark = 0; }
  if (cb.vac && !cb.wasVac) aimAssist(cb, 'vac'); cb.wasVac = cb.vac;
  if (other && other.hold) { other.vac = other.hold.vac; other.blow = other.hold.blow; other.dark = other.hold.dark; }
  for (const b of [me, GS.clone]) { if (!b) continue; b.cd = Math.max(0, (b.cd || 0) - dt); b.pcd = Math.max(0, (b.pcd || 0) - dt); b.flashT = Math.max(0, (b.flashT || 0) - dt); }
  me.inv = Math.max(0, me.inv - dt);
  let door = -1;
  if (!(cb === me && me.down)) door = moveBody(cb, dt, ix, iz, true);
  if (other) moveBody(other, dt, 0, 0, false);
  if (me.down) { me.vac = me.blow = me.dark = 0; }
  // doors (real hunter only)
  if (door >= 0 && cb === me && !GS.waitDoor) {
    const d = W.L.doors[door];
    GS.waitDoor = 1; setTimeout(() => { GS.waitDoor = 0; }, 900);
    if (GS.role === 'client') { G.N.send({ t: 'door', i: door }); me.x += d.nx * 0.7; me.z += d.nz * 0.7; } else G.goRoom(d.to, GS.rid);
    return;
  }
  // elevator pads
  const pads = []; if (W.L.elev) pads.push({ x: W.L.elev.x, z: W.L.elev.z + 1.3 }); if (W.elevBoss) pads.push({ x: 0, z: -W.L.hd + 1.3 });
  const onPad = pads.some((p) => Math.hypot(me.x - p.x, me.z - p.z) < 1);
  if (onPad && !GS.elevLock && cb === me) { GS.elevLock = 1; G.UI.elevator(); }
  if (!onPad) GS.elevLock = 0;
  // sim
  if (GS.role !== 'client') { syncBodies(); Sim.step(dt); const ev = W.out.splice(0); if (ev.length) { G.onEvents(ev); if (G.N) G.N.bcast({ t: 'ev', l: ev }); } }
  else Sim.W().t += dt;
  if (G.N) G.N.tick(dt);
  // audio for held tools
  const tug = cb.tugE; Snd.hold(tug ? 'tug' : cb.vac ? 'vac' : cb.blow ? 'blow' : null);
  // candy: barks near hidden gems / boo
  GS.candyAlert = candyCheck(W, me, dt);
};
let barkT = 0;
function candyCheck(W, me, dt) {
  barkT -= dt; let near = false;
  W.L.props.forEach((p, i) => { if (W.pr[i].e && W.booProp !== i) return; if (!(p.gem && !save.gems['g' + W.L.area + '_' + (p.gem - 1)]) && W.booProp !== i) return; if (Math.hypot(p.x - me.x, p.z - me.z) < 3.2) near = true; });
  W.L.gems.forEach((g) => { if (g.how === 'dark' && !W.gemRev[g.gi] && !save.gems['g' + W.L.area + '_' + g.gi] && Math.hypot(g.x - me.x, g.z - me.z) < 3.5) near = true; });
  if (near && barkT <= 0) { barkT = 4; Snd.fx('bark'); G.hintMsg('\uD83D\uDC36 Candy sniffs something hidden nearby!', 2.2); }
  return near;
}
/* bodies for the view */
G.viewBodies = function () {
  const out = []; const me = GS.me; if (!me) return out;
  const vr = Sim.vacR({ uv: save.upg.vac }), fr = Sim.flashR({ uf: save.upg.flash }), fa = Sim.flashA({ uf: save.upg.flash });
  out.push({ id: GS.pid, local: 1, name: G.myName(), color: save.color, hero: save.hero, x: me.x, z: me.z, ang: me.ang, vac: me.vac, blow: me.blow, dark: me.dark, down: me.down, inv: me.inv > 0, mv: me.mv, flashT: me.flashT, tugE: me.tugE, tugOK: me.tugOK, vacR: vr, flashR: fr, flashA: fa, ctrl: GS.ctrl === 'me' });
  if (GS.clone) { const c = GS.clone; out.push({ id: c.id, local: 1, clone: 1, color: '#39ff6a', hero: save.hero, x: c.x, z: c.z, ang: c.ang, vac: c.vac, blow: c.blow, dark: c.dark, mv: c.mv, flashT: c.flashT, tugE: c.tugE, tugOK: c.tugOK, vacR: vr, flashR: fr, flashA: fa, ctrl: GS.ctrl === 'clone' }); }
  for (const pid in GS.others) { const o = GS.others[pid]; if (!o.s || o.rid !== GS.rid) continue; const s = o.s; const W = Sim.W(); out.push({ id: pid, name: o.name, color: o.color, hero: s.hero | 0, x: s.x, z: s.z, ang: s.ang, vac: s.vac, blow: s.blow, dark: s.dark, down: s.down, inv: s.inv, mv: s.mv, flashT: o.flashT || 0, tugE: W ? W.ents.find((e) => e.st === 'tug' && e.cb && e.cb.indexOf(pid) >= 0) : null, vacR: Sim.vacR(s), flashR: Sim.flashR(s), flashA: Sim.flashA(s) }); if (o.flashT) o.flashT = Math.max(0, o.flashT - 1 / 60); }
  return out;
};

/* ---------------- main loop ---------------- */
let last = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t; GS.time += dt;
  if (GS.ui === 'game' && !GS.paused) G.frame(dt);
  else if (GS.ui === 'game' && GS.paused && GS.role !== 'solo') G.frame(dt); // online games keep running while a menu is open
  if (Sim.W() && GS.me) {
    const cb = ctrlBody();
    V.update(dt, GS.time, { bodies: G.viewBodies(), me: GS.me, focus: cb, client: GS.role === 'client', assist: !!save.assist, mp: !G.alone(), candyAlert: GS.candyAlert });
    if (G.UI) G.UI.frame(dt);
  }
}
G.boot = function () {
  V.init($('c'));
  addEventListener('resize', () => V.resize());
  if (G.UI) G.UI.init();
  requestAnimationFrame(loop);
  window.__sp = { G, GS, Sim, SP, save: () => save, W: () => Sim.W(), IN };
};

/* ---------------- toasts / hints ---------------- */
G.toast = function (t, warn) { const el = document.createElement('div'); el.className = 'toast' + (warn ? ' warn' : ''); el.textContent = t; const box = $('toasts'); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100); };
G.hintMsg = function (t, sec) { GS.hint = t; GS.hintT = sec || 3; };
G.banner = function (t, sec) { const b = $('banner'); b.textContent = t; b.classList.remove('hidden'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(G._bt); G._bt = setTimeout(() => b.classList.add('hidden'), (sec || 3.5) * 1000); };
})();
