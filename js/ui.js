/* Grok Spooks - screens, HUD, touch controls, keyboard, map, elevator, upgrades, ghost gallery */
(function () {
'use strict';
const SP = window.SP, GN = window.GrokNet, G = SP.G, GS = G.GS, Sim = SP.Sim, Snd = SP.Snd, $ = G.$, esc = SP.esc;
const UI = G.UI = {};
const SCREENS = ['scrTitle', 'scrOnline', 'scrPause', 'scrMap', 'scrShop', 'scrElev', 'scrHow', 'scrGallery', 'scrBoss', 'scrEnd'];
UI.showScreens = function () {
  const map = { title: 'scrTitle', online: 'scrOnline', pause: 'scrPause', map: 'scrMap', shop: 'scrShop', elev: 'scrElev', how: 'scrHow', gallery: 'scrGallery', boss: 'scrBoss', end: 'scrEnd' };
  SCREENS.forEach((id) => $(id).classList.toggle('hidden', map[GS.ui] !== id && !(GS.over === id)));
  const inGame = !!(GS.rid && GS.me) && GS.ui !== 'title' && GS.ui !== 'online';
  $('hud').classList.toggle('hidden', !inGame);
  GS.paused = GS.ui !== 'game';
  if (GS.paused) resetInput();
  if (GS.ui === 'title') { Snd.music('title'); }
};
UI.closeAll = function () { if (GS.rid && GS.me) { GS.ui = 'game'; UI.showScreens(); } };
function open(name) { GS.ui = name; UI.showScreens(); }
G.startRoom = function () { const s = G.save(); if (!s.tut) return 'porch'; const r = SP.room(s.cur); if (r && G.areaOpen(r.a) && !r.boss) return r.id; return 'foyer'; };

/* ---------------- title ---------------- */
function title() {
  const s = G.save();
  $('nameIn').value = s.name || '';
  const row = $('colorRow'); row.innerHTML = '';
  GN.COLORS.forEach((c) => { const b = document.createElement('button'); b.type = 'button'; b.style.background = c; if (c === s.color) b.className = 'on'; b.onclick = () => { s.color = c; G.persist(); title(); Snd.fx('click'); }; row.appendChild(b); });
  const hr = $('heroRow'); hr.innerHTML = '';
  SP.HEROES.forEach((h, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'hero' + (s.hero === i ? ' on' : ''); b.innerHTML = '<i style="--c:' + s.color + '">' + ['\uD83E\uDDE2', '\uD83C\uDF80', '\uD83E\uDDF6'][i] + '</i><b>' + h.n + '</b><small>' + h.desc + '</small>'; b.onclick = () => { s.hero = i; G.persist(); title(); Snd.fx('click'); }; hr.appendChild(b); });
  $('assistT').checked = !!s.assist;
  const prog = SP.ROOMS.filter((r) => s.rooms[r.id]).length;
  $('titleFoot').innerHTML = s.tut ? 'Rooms lit: <b>' + prog + '/' + SP.ROOMS.length + '</b> &middot; Gems: <b>' + G.gemCount() + '/36</b> &middot; Boos: <b>' + G.booCount() + '/6</b> &middot; Coins: <b>' + s.coins + '</b>' : 'A cute-spooky ghost hunt for 1&ndash;3 players';
  $('bPlay').textContent = s.tut ? 'CONTINUE' : 'PLAY';
}
function saveName() { const s = G.save(); s.name = GN.cleanName($('nameIn').value || 'Hunter'); G.persist(); }

/* ---------------- HUD ---------------- */
UI.hud = function () {
  const s = G.save(), me = GS.me; if (!me) return;
  const mh = G.maxHp(), hp = Math.max(0, me.hp); let h = '';
  for (let i = 0; i < mh / 2; i++) { const v = hp - i * 2; h += '<i class="ht' + (v >= 2 ? '' : v === 1 ? ' half' : ' empty') + '"></i>'; }
  $('hearts').innerHTML = h;
  $('nCoins').textContent = s.coins;
  const W = Sim.W(); const a = W ? W.L.area : 0;
  $('nGems').textContent = G.gemCount(a) + '/' + SP.AREAS[a].gemN;
  $('nBoos').textContent = G.booCount() + '/6';
  $('pKey').classList.toggle('hidden', !s.keys[a]);
  $('bSwap').classList.toggle('hidden', !G.alone());
  const n = G.N && G.N.room ? G.N.room.count() : 1;
  $('mates').innerHTML = n > 1 ? Object.keys(GS.others).map((k) => { const o = GS.others[k]; const hp2 = o.s ? Math.ceil(o.s.hp / 2) : 0; return '<span class="mate" style="--c:' + o.color + '">' + esc(o.name) + (o.s && o.s.down ? ' \uD83D\uDCA4' : ' \u2764' + hp2) + (o.rid && o.rid !== GS.rid ? ' \u2026' : '') + '</span>'; }).join('') : '';
};
let hudT = 0;
UI.frame = function (dt) {
  hudT -= dt; if (hudT <= 0) { hudT = 0.25; UI.hud(); roomPill(); }
  const W = Sim.W(); if (!W) return;
  // hint line
  GS.hintT -= dt; const hint = $('hint');
  let txt = GS.hintT > 0 ? GS.hint : '';
  if (!txt && W.tut >= 0 && W.tut < 5) txt = TUT[W.tut];
  const cb = GS.ctrl === 'clone' && GS.clone ? GS.clone : GS.me;
  if (!txt && GS.me && GS.me.down && !G.alone()) txt = 'Spooked! Wait for a friend to stand next to you\u2026';
  if (!txt) { for (const k in GS.others) { const o = GS.others[k]; if (o.s && o.s.down && o.rid === GS.rid) { txt = '\uD83D\uDC4B ' + o.name + ' got spooked! Stand next to them (or VAC them) to revive!'; break; } } }
  if (!txt && W.ammo && W.ammo[cb.id || GS.pid]) txt = 'You\u2019re holding something! BLOW to fire it back!';
  hint.textContent = txt; hint.classList.toggle('hidden', !txt);
  // tug panel
  const tug = cb && cb.tugE; const tp = $('tugPanel');
  if (tug) { tp.classList.remove('hidden'); $('tugHp').textContent = Math.max(0, Math.ceil(tug.hp)); $('tugBar').style.width = Math.round(Math.min(1, tug.slam || 0) * 100) + '%'; tp.classList.toggle('ready', (tug.slam || 0) >= 1); $('tugTip').textContent = (tug.slam || 0) >= 1 ? 'Tap SLAM!' : cb.tugOK ? 'Great pulling! Keep going!' : 'Pull the stick the OTHER way!'; }
  else tp.classList.add('hidden');
  const fb = $('bFlash'); const slamReady = tug && (tug.slam || 0) >= 1; fb.classList.toggle('slam', !!slamReady); fb.querySelector('b').textContent = slamReady ? 'SLAM!' : 'FLASH';
  // boss bar
  const boss = W.boss; const bb = $('bossBar');
  if (boss && boss.st !== 'intro') { bb.classList.remove('hidden'); $('bossName').textContent = SP.BOSS[boss.b].n + (boss.ph > 1 ? '  \u00B7 Phase ' + boss.ph : ''); $('bossHp').style.width = Math.max(0, boss.hp / boss.mhp * 100) + '%'; } else bb.classList.add('hidden');
  // ammo / tool button states
  $('bVac').classList.toggle('on', !!(G.IN.vac)); $('bBlow').classList.toggle('on', !!G.IN.blow); $('bDark').classList.toggle('on', !!G.IN.dark);
  $('bSwap').classList.toggle('on', GS.ctrl === 'clone');
};
function roomPill() {
  const W = Sim.W(); if (!W) return; const L = W.L;
  const left = W.ents.filter((e) => e.wv).length;
  let st = W.cleared ? '\uD83D\uDCA1 Lit' : L.def.boss ? '\uD83D\uDC80 Boss' : left ? '\uD83D\uDC7B ' + left : (W.puz && !W.puz.solved) ? '\uD83E\uDDE9 Puzzle' : W.wave < L.def.waves.length || W.waveT > 0 ? '\uD83D\uDC7B \u2026' : '';
  if (W.haunt) st = '\uD83D\uDC7B Haunted again!';
  $('roomPill').innerHTML = '<b>' + esc(L.def.n) + '</b><small>' + esc(SP.AREAS[L.area].n) + (st ? ' &middot; ' + st : '') + '</small>';
}
const TUT = [
  '\uD83D\uDC4B Welcome, ghost hunter! Drag the left stick (or WASD) to walk.',
  '\uD83D\uDC7B A ghost! Your flashlight points where you walk. Tap FLASH to stun it!',
  '\uD83C\uDF00 Hold VAC to suck it in! Pull the stick AWAY from the ghost to drain it faster.',
  '\uD83E\uDE99 Great! Hold VAC on a cobweb or furniture to find coins.',
  '\u2728 The door is hidden! Hold DARK near the top of the room to reveal it.'
];
UI.tut = function (s) { if (s >= 5) G.banner('\u2728 Tutorial done! Walk through the door into Grok Manor.', 4); else if (s > 0) Snd.fx('solved'); };
UI.roomIn = function (W) { UI.hud(); roomPill(); $('roomPill').classList.remove('pop'); void $('roomPill').offsetWidth; $('roomPill').classList.add('pop'); };
UI.bossIntro = function (b) { const d = SP.BOSS[b]; $('bossCard').innerHTML = '<div class="bossT">BOSS GHOST</div><h2>' + esc(d.n) + '</h2><p class="sub">' + esc(d.tip) + '</p><p class="sub small">Red glowing areas show where attacks land. Step out of them!</p><button id="bBossGo" class="btn primary" type="button">LET\u2019S GO!</button>'; if (GS.role === 'solo') { open('boss'); $('bBossGo').onclick = () => { Snd.fx('click'); UI.closeAll(); }; } else { G.banner(d.n + '! ' + d.tip, 6); } };
UI.ending = function () { open('end'); };
UI.codeBadge = function (code) { const e = $('codeBadge'); if (!code) { e.classList.add('hidden'); return; } e.textContent = 'ROOM ' + code; e.classList.remove('hidden'); };

/* ---------------- map ---------------- */
function mapScr(a) {
  const W = Sim.W(); a = a == null ? (W ? W.L.area : 0) : a; const s = G.save();
  let h = '<div class="tabs">' + SP.AREAS.map((A, i) => '<button type="button" class="tab' + (i === a ? ' on' : '') + (G.areaOpen(i) ? '' : ' lock') + '" data-a="' + i + '">' + A.icon + '<small>' + (G.areaOpen(i) ? A.floor : '\uD83D\uDD12') + '</small></button>').join('') + '</div>';
  const A = SP.AREAS[a]; h += '<h3>' + A.icon + ' ' + esc(A.n) + '</h3>';
  if (!G.areaOpen(a)) h += '<p class="sub">Locked. Capture the boss of the ' + esc(SP.AREAS[a - 1].n) + ' to open this floor.</p>';
  else {
    const rooms = SP.areaRooms(a); h += '<div class="mapgrid">';
    rooms.forEach((r) => {
      const cl = s.rooms[r.id], vis = s.visited[r.id], cur = GS.rid === r.id; let ic = '';
      if (r.boss) ic += s.bosses[a] ? '\uD83C\uDFC6' : '\uD83D\uDC80'; if (r.hub) ic += '\u2195\uFE0F'; if (r.key && !s.keys[a]) ic += '\uD83D\uDD11'; if (r.boo) ic += s.boos[a] ? '\u2705' : (vis ? '\uD83D\uDC7B' : '');
      if (r.puz && !cl) ic += '\uD83E\uDDE9';
      h += '<div class="mroom' + (cl ? ' lit' : vis ? ' seen' : ' unk') + (cur ? ' cur' : '') + '" style="left:' + (r.gx * 33.3) + '%;top:' + (r.gy * 33.3) + '%"><b>' + (vis || cl ? esc(r.n) : '???') + '</b><span>' + ic + '</span>' + (cur ? '<em>YOU</em>' : '') + '</div>';
    });
    h += '</div>';
    h += '<p class="sub">\uD83D\uDC8E Gems ' + G.gemCount(a) + '/' + A.gemN + ' &middot; \uD83D\uDC7B Boo ' + (s.boos[a] ? '\u2705' : '\u2753') + ' &middot; \uD83D\uDD11 Key ' + (s.keys[a] ? '\u2705' : '\u2753') + ' &middot; Boss ' + (s.bosses[a] ? '\uD83C\uDFC6' : '\u2753') + '</p>';
    h += '<p class="sub small">Yellow rooms are lit. Gold doors need the area key. \u2195\uFE0F = elevator.</p>';
  }
  $('mapBody').innerHTML = h;
  $('mapBody').querySelectorAll('.tab').forEach((b) => { b.onclick = () => { Snd.fx('click'); mapScr(+b.dataset.a); }; });
  open('map');
}
/* ---------------- elevator ---------------- */
UI.elevator = function () {
  if (GS.ui !== 'game') return;
  const s = G.save();
  let h = '';
  SP.AREAS.forEach((A, i) => { const ok = G.areaOpen(i); h += '<button type="button" class="floor' + (ok ? '' : ' lock') + '" data-a="' + i + '"' + (ok ? '' : ' disabled') + '><i>' + A.icon + '</i><b>' + A.floor + ': ' + esc(A.n) + '</b><small>' + (ok ? '\uD83D\uDC8E ' + G.gemCount(i) + '/' + A.gemN + ' \u00B7 \uD83D\uDC7B ' + (s.boos[i] ? '\u2705' : '\u2753') + ' \u00B7 ' + (s.bosses[i] ? '\uD83C\uDFC6 boss caught' : 'boss: ?') : '\uD83D\uDD12 Capture the ' + esc(SP.AREAS[i - 1].n) + ' boss') + '</small></button>'; });
  $('elevList').innerHTML = h;
  $('elevList').querySelectorAll('.floor').forEach((b) => { b.onclick = () => { const a = +b.dataset.a; Snd.fx('click'); if (GS.role === 'client') { G.N.send({ t: 'elev', a }); UI.closeAll(); } else { UI.closeAll(); G.goRoom(SP.AREAS[a].hub, null, true); } }; });
  open('elev');
};
/* ---------------- upgrades shop ---------------- */
function shop() {
  const s = G.save(); let h = '<p class="sub">Coins: <b>\uD83E\uDE99 ' + s.coins + '</b> &middot; Gems found: <b>\uD83D\uDC8E ' + G.gemCount() + '</b></p>';
  SP.UPG.forEach((u) => {
    const lv = s.upg[u.id] || 0, max = u.cost.length, c = u.cost[lv];
    const ok = c && s.coins >= c[0] && G.gemCount() >= c[1];
    h += '<div class="upg"><i>' + u.icon + '</i><div><b>' + u.n + ' <span class="lv">' + '\u2605'.repeat(lv) + '\u2606'.repeat(max - lv) + '</span></b><small>' + u.desc + '</small></div>' + (c ? '<button type="button" class="btn small ' + (ok ? 'green' : 'alt') + '" data-u="' + u.id + '"' + (ok ? '' : ' disabled') + '>\uD83E\uDE99' + c[0] + (c[1] ? '<br><small>needs \uD83D\uDC8E' + c[1] + '</small>' : '') + '</button>' : '<span class="maxed">MAX</span>') + '</div>';
  });
  h += '<p class="sub small">Gems aren\u2019t spent, you just need to have found enough.</p>';
  $('shopBody').innerHTML = h;
  $('shopBody').querySelectorAll('[data-u]').forEach((b) => { b.onclick = () => { const u = SP.UPG.find((q) => q.id === b.dataset.u); const lv = s.upg[u.id] || 0, c = u.cost[lv]; if (!c || s.coins < c[0] || G.gemCount() < c[1]) return; s.coins -= c[0]; s.upg[u.id] = lv + 1; if (u.id === 'heart' && GS.me) GS.me.hp += 2; G.persist(); Snd.fx('buy'); G.toast(u.n + ' upgraded!'); shop(); UI.hud(); }; });
  open('shop');
}
/* ---------------- ghost gallery ---------------- */
function gallery() {
  const s = G.save(); let h = '<div class="gal">';
  SP.EN_ORDER.forEach((k) => { const d = SP.EN[k], n = s.caught[k] || 0; h += '<div class="gcard' + (n ? '' : ' unk') + '"><i style="--c:' + d.col + '">' + (n ? '\uD83D\uDC7B' : '?') + '</i><b>' + (n ? esc(d.n) : '???') + '</b><small>' + (n ? 'Caught ' + n + '<br>' + esc(d.how) : 'Not caught yet') + '</small></div>'; });
  h += '</div><p class="sub">Bosses caught: ' + Object.keys(s.bosses).length + '/6 &middot; Total ghosts: ' + s.stats.caught + '</p>';
  $('galBody').innerHTML = h; open('gallery');
}

/* ---------------- controls ---------------- */
function resetInput() { const I = G.IN; I.jx = I.jz = 0; I.vac = I.blow = I.dark = 0; I.keys = {}; joy.id = null; homeJoy(); ['bVac', 'bBlow', 'bDark'].forEach((id) => { const b = $(id); if (b) b.classList.remove('on'); }); }
const joy = { id: null, ox: 0, oy: 0 };
function homeJoy() { const k = $('joyknob'); if (k) k.style.transform = ''; const b = $('joybase'); if (b) { b.style.left = ''; b.style.top = ''; } }
function joystick() {
  const zone = $('joyzone'), base = $('joybase'), knob = $('joyknob'), R = 50;
  zone.addEventListener('pointerdown', (e) => { Snd.init(); if (joy.id !== null) return; joy.id = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } const r = zone.getBoundingClientRect(); joy.ox = e.clientX; joy.oy = e.clientY; base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px'; G.IN.jx = G.IN.jz = 0; $('joyhint').classList.add('hidden'); e.preventDefault(); });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId !== joy.id) return; let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } G.IN.jx = dx / R; G.IN.jz = dy / R; if (Math.hypot(G.IN.jx, G.IN.jz) < 0.12) G.IN.jx = G.IN.jz = 0; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; });
  const up = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; G.IN.jx = G.IN.jz = 0; homeJoy(); };
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up);
}
function holdBtn(id, key) {
  const b = $(id); let pid = null;
  b.addEventListener('pointerdown', (e) => { Snd.init(); pid = e.pointerId; try { b.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } G.IN[key] = 1; if (key !== 'dark') G.IN.dark = 0; if (key === 'blow') G.IN.vac = 0; if (key === 'vac') G.IN.blow = 0; b.classList.add('on'); e.preventDefault(); });
  const up = (e) => { if (pid !== null && e.pointerId !== pid) return; pid = null; G.IN[key] = 0; b.classList.remove('on'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
}
function tapBtn(id, a) { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); G.press(a); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 140); }); }
function keyboard() {
  addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT' || e.target && e.target.tagName === 'TEXTAREA') return;
    Snd.init(); const c = e.code;
    if (GS.ui === 'game') {
      if (['Space', 'KeyJ'].indexOf(c) >= 0 && !e.repeat) G.press('flash');
      else if (['KeyE', 'KeyI'].indexOf(c) >= 0 && !e.repeat) G.press('plunge');
      else if (c === 'KeyQ' && !e.repeat) G.press('swap');
      else if (c === 'KeyM') mapScr();
      else if (c === 'KeyP' || c === 'Escape') open('pause');
      G.IN.keys[c] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(c) >= 0) e.preventDefault();
    } else if ((c === 'Escape' || c === 'KeyP') && GS.rid && GS.ui !== 'title' && GS.ui !== 'online') UI.closeAll();
  });
  addEventListener('keyup', (e) => { G.IN.keys[e.code] = false; });
  addEventListener('blur', () => { G.IN.keys = {}; });
}

/* ---------------- init ---------------- */
UI.init = function () {
  if (!G.IS_TOUCH) document.body.classList.add('kbd');
  joystick(); holdBtn('bVac', 'vac'); holdBtn('bBlow', 'blow'); holdBtn('bDark', 'dark'); tapBtn('bFlash', 'flash'); tapBtn('bPlunge', 'plunge'); tapBtn('bSwap', 'swap'); keyboard();
  const on = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); Snd.init(); Snd.fx('click'); fn(); });
  on('bPlay', () => { saveName(); G.persist(); GS.role = 'solo'; G.goRoom(G.startRoom(), null, false); open('game'); });
  on('bOnline', () => { saveName(); open('online'); G.N.msg(''); });
  on('bHow', () => { GS.howBack = 'title'; open('how'); });
  on('bHowBack', () => { open(GS.howBack || 'title'); });
  on('bHost', () => { saveName(); G.N.host(); });
  on('bJoin', () => { saveName(); G.N.join($('codeIn').value); });
  on('bOnlineBack', () => { G.N.leave(); open('title'); title(); });
  $('assistT').addEventListener('change', () => { G.save().assist = $('assistT').checked; G.persist(); });
  $('assistT2').addEventListener('change', () => { G.save().assist = $('assistT2').checked; G.persist(); if (GS.me) GS.me.hp = Math.min(GS.me.hp, G.maxHp()); UI.hud(); });
  $('nameIn').addEventListener('change', saveName);
  on('bPause', () => open('pause')); on('bMap', () => mapScr());
  on('bMute', () => { const s = G.save(); s.muted = !s.muted; Snd.setMuted(s.muted); G.persist(); muteIcon(); });
  on('bResume', () => UI.closeAll()); on('bPMap', () => mapScr()); on('bPShop', () => shop()); on('bPGal', () => gallery()); on('bPHow', () => { GS.howBack = 'pause'; open('how'); });
  on('bPCp', () => { if (GS.me && GS.cp) { GS.me.x = GS.cp.x; GS.me.z = GS.cp.z; GS.clone = null; GS.ctrl = 'me'; } UI.closeAll(); });
  on('bPQuit', () => { G.N.leave(true); GS.rid = null; GS.me = null; V.clearTags && V.clearTags(); Snd.hold(null); GS.ui = 'title'; UI.showScreens(); title(); });
  ['bMapBack', 'bShopBack', 'bElevBack', 'bGalBack'].forEach((id) => on(id, () => (GS.ui === 'map' || GS.ui === 'shop' || GS.ui === 'gallery') && GS.fromPause ? open('pause') : UI.closeAll()));
  on('bEndGo', () => UI.closeAll());
  $('scrPause').addEventListener('click', () => { GS.fromPause = true; }, true);
  $('bMap').addEventListener('click', () => { GS.fromPause = false; }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetInput(); });
  $('pauseHint').textContent = G.IS_TOUCH ? '' : 'Keys: WASD move \u00B7 Space FLASH \u00B7 Shift/K VAC \u00B7 L/B BLOW \u00B7 F DARK \u00B7 E PLUNGER \u00B7 Q SWAP \u00B7 M map \u00B7 P pause';
  muteIcon(); title();
  const V = SP.V; void V;
  if (!G.N.hubCheck()) { GS.ui = 'title'; UI.showScreens(); }
  // orientation hint is not needed: both orientations are supported
};
function muteIcon() { $('bMute').innerHTML = G.save().muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'; }
const V = SP.V;
})();
