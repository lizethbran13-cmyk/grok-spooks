/* Grok Spooks - online co-op over grok-net (PeerJS, 5-letter codes, host-authoritative) */
(function () {
'use strict';
const SP = window.SP, GN = window.GrokNet, G = SP.G, GS = G.GS, Sim = SP.Sim, Snd = SP.Snd, $ = G.$;
const N = G.N = { room: null, sendT: 0, snapT: 0, fromHub: false };
N.isHost = () => !N.room || N.room.isHost;
N.send = (m) => { if (N.room) N.room.send(m); };
N.bcast = (m) => { if (N.room && N.room.isHost) N.room.broadcast(m); };
N.sendTo = (pid, m) => { if (N.room && N.room.isHost) N.room.sendTo(pid, m); };
function msg(t, ok) { const e = $('onlineMsg'); if (e) { e.textContent = t || ''; e.className = 'msg' + (ok ? ' ok' : ''); } }
N.msg = msg;
function syncPlayers() {
  if (!N.room) return; const ids = {};
  N.room.players().forEach((p) => { if (p.pid === GS.pid) return; ids[p.pid] = 1; const o = GS.others[p.pid] = GS.others[p.pid] || { s: null }; o.name = p.name; o.color = p.color; });
  for (const k in GS.others) if (!ids[k]) delete GS.others[k];
  G.UI && G.UI.hud();
}
N.allDown = function () { if (!GS.me || !GS.me.down) return false; for (const k in GS.others) { const o = GS.others[k]; if (o.s && o.rid === GS.rid && !o.s.down) return false; } return true; };
function common(room) {
  room.on('players', () => { if (N.room === room) syncPlayers(); });
  room.on('join', (p) => { if (N.room !== room) return; G.toast(p.name + ' joined! \uD83D\uDC7B'); Snd.fx('join'); if (room.isHost && GS.rid) room.sendTo(p.pid, { t: 'room', rid: GS.rid, from: null, o: G.roomOpts(GS.rid), el: 0 }); });
  room.on('leave', (p) => { if (N.room !== room) return; G.toast(p.name + ' left. The hunt goes on!', true); Snd.fx('leave'); delete GS.others[p.pid]; const W = Sim.W(); if (W && W.bodies[p.pid]) delete W.bodies[p.pid]; G.UI && G.UI.hud(); });
}
function startGameUI() { GS.ui = 'game'; G.UI.showScreens(); }
N.host = function (code) {
  N.leave(true); msg('Opening a room\u2026', true);
  const room = N.room = GN.createRoom({ role: 'host', code: code || undefined, name: G.myName(), color: G.save().color, autoCode: !code, rejoin: !!code, max: 3, pid: GS.pid });
  common(room);
  room.on('status', (t) => { if (!room.opened) msg(t, true); });
  room.on('open', () => {
    if (N.room !== room) return; GN.saveProfile(G.myName(), G.save().color); GS.role = 'host'; Snd.fx('join');
    G.toast('Room ' + room.code + ' is open! Friends join with this code.'); G.UI.codeBadge(room.code);
    if (!GS.rid || GS.ui !== 'game') { G.goRoom(G.startRoom()); startGameUI(); } syncPlayers();
  });
  room.on('message', (d, from) => {
    if (!d || typeof d !== 'object' || N.room !== room || from === GS.pid) return;
    const o = GS.others[from];
    switch (d.t) {
      case 'p': if (o && d.s && d.rid === GS.rid) { if (!o.s && d.s) {} o.s = clean(d.s); o.rid = d.rid; } else if (o && d.s) { o.rid = d.rid; o.s = clean(d.s); } break;
      case 'act': { if (!o || !o.s || o.rid !== GS.rid) break; G.syncBodies(); const W = Sim.W(); const b = W.bodies[from]; if (b) { if (typeof d.x === 'number') { b.x = d.x; b.z = d.z; } Sim.act(from, String(d.a), { ang: +d.ang || 0 }); } if (d.a === 'flash') o.flashT = 0.25; break; }
      case 'door': { const W = Sim.W(); const i = d.i | 0; if (W && W.L.doors[i] && Sim.doorOpen(i)) G.goRoom(W.L.doors[i].to, GS.rid); break; }
      case 'elev': { const a = d.a | 0; if (G.areaOpen(a) && SP.AREAS[a]) { G.goRoom(SP.AREAS[a].hub, null, true); G.UI.closeAll(); } else N.sendTo(from, { t: 'toast', m: 'The host hasn\u2019t unlocked that floor yet.' }); break; }
    }
  });
  room.on('error', (e) => { if (N.room !== room) return; if (!room.opened) { N.room = null; msg(e.title + ': ' + e.message); } else G.toast(e.title, true); });
  room.start();
};
N.join = function (code) {
  code = GN.normalizeCode(code);
  if (!GN.validCode(code)) { msg('Enter the 5-letter room code.'); return; }
  N.leave(true); msg('Joining room ' + code + '\u2026', true);
  const room = N.room = GN.createRoom({ role: 'join', code, name: G.myName(), color: G.save().color, pid: GS.pid, rejoin: !!N.fromHub });
  common(room);
  room.on('status', (t) => { if (!room.opened) msg(t, true); });
  room.on('open', () => { if (N.room !== room) return; GN.saveProfile(G.myName(), G.save().color); GS.role = 'client'; msg('Connected! Waiting for the host\u2026', true); Snd.fx('join'); G.UI.codeBadge(room.code); syncPlayers(); });
  room.on('message', (d) => {
    if (!d || typeof d !== 'object' || N.room !== room) return;
    switch (d.t) {
      case 'room': G.UI.closeAll(); G.enterRoom(String(d.rid), d.from, d.o || {}, !!d.el); startGameUI(); break;
      case 's': {
        if (d.r && d.r.r === GS.rid) Sim.unpack(d.r);
        for (const k in d.pl) { if (k === GS.pid) continue; const o = GS.others[k] = GS.others[k] || { s: null, name: 'Friend', color: '#3ff0ff' }; o.s = clean(d.pl[k]); o.rid = d.rid; }
        break;
      }
      case 'ev': if (Array.isArray(d.l)) G.onEvents(d.l); break;
      case 'got': G.applyGot(d); break;
      case 'hurt': G.hurtMe(d.d | 0, d.x, d.z); break;
      case 'revive': G.reviveMe(); break;
      case 'toast': G.toast(String(d.m || ''), true); break;
    }
  });
  room.on('reconnecting', () => G.toast('Lost the host \u2014 reconnecting\u2026', true));
  room.on('error', (e) => {
    if (N.room !== room) return;
    if (!room.opened) { N.room = null; msg(e.title + ': ' + e.message); return; }
    N.room = null; try { room.leave(); } catch (er) { /* ignore */ }
    for (const k in GS.others) delete GS.others[k];
    G.UI.codeBadge(null);
    G.toast('The host left \u2014 you keep hunting solo. Your save is safe!', true);
    GS.role = 'solo';
    if (GS.rid) { const keep = GS.me ? { hp: GS.me.hp, x: GS.me.x, z: GS.me.z } : null; G.goRoom(GS.rid, null); if (keep && GS.me) { GS.me.hp = keep.hp; } }
  });
  room.start();
};
N.leave = function (silent) {
  const r = N.room; N.room = null;
  if (r) try { r.leave(); } catch (e) { /* ignore */ }
  for (const k in GS.others) delete GS.others[k];
  if (GS.role !== 'solo') GS.role = 'solo';
  G.UI && G.UI.codeBadge(null);
  if (!silent) msg('');
};
function clean(s) {
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  return { x: n(s.x), z: n(s.z), ang: n(s.ang), vac: s.vac ? 1 : 0, blow: s.blow ? 1 : 0, dark: s.dark ? 1 : 0, pull: Array.isArray(s.pull) ? [n(s.pull[0]), n(s.pull[1])] : [0, 0], down: s.down ? 1 : 0, uv: Math.max(0, Math.min(3, s.uv | 0)), uf: Math.max(0, Math.min(3, s.uf | 0)), um: Math.max(0, Math.min(2, s.um | 0)), hero: Math.max(0, Math.min(2, s.hero | 0)), mv: s.mv ? 1 : 0, inv: s.inv ? 1 : 0, hp: n(s.hp), mhp: n(s.mhp) };
}
N.tick = function (dt) {
  if (!N.room || !N.room.opened) return;
  N.sendT -= dt;
  if (N.sendT > 0) return; N.sendT = 1 / 14;
  const s = G.mySnap(); if (!s) return;
  if (N.room.isHost) {
    const pl = {}; pl[GS.pid] = s; for (const k in GS.others) { const o = GS.others[k]; if (o.s && o.rid === GS.rid) pl[k] = o.s; }
    N.bcast({ t: 's', rid: GS.rid, r: Sim.pack(), pl });
  } else N.send({ t: 'p', rid: GS.rid, s });
};
N.hubCheck = function () {
  const prm = GN.params(); if (!prm) return false;
  N.fromHub = true; const sv = G.save(); sv.name = prm.name; sv.color = prm.color; G.persist();
  if (prm.mode === 'host') N.host(prm.code); else N.join(prm.code);
  GS.ui = 'online'; G.UI.showScreens(); return true;
};
})();
