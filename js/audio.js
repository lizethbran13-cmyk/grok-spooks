/* Grok Spooks - WebAudio sfx + eerie-but-cute music (no files) */
(function () {
'use strict';
const SP = window.SP;
SP.Snd = (() => {
  let ctx = null, master = null, sfx = null, mus = null, muted = false, mode = '', timer = 0, step = 0, nextT = 0, vacN = null, vacG = null, vacF = null;
  const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.75; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.8; sfx.connect(master);
    mus = ctx.createGain(); mus.gain.value = 0.13; mus.connect(master);
    timer = setInterval(tick, 60);
  }
  function tone(f, dur, type, vol, delay, bus, f2) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  let nbuf = null;
  function noiseBuf() { if (nbuf) return nbuf; const n = ctx.sampleRate * 1; nbuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return nbuf; }
  function noise(dur, vol, delay, freq, type) {
    if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = noiseBuf(); const g = ctx.createGain(); const f = ctx.createBiquadFilter(); f.type = type || 'highpass'; f.frequency.value = freq || 1500;
    const t = ctx.currentTime + (delay || 0); g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfx); s.start(t); s.stop(t + dur + 0.05);
  }
  const FX = {
    click() { tone(880, 0.05, 'square', 0.04); },
    flash() { tone(1800, 0.18, 'sine', 0.08, 0, null, 600); noise(0.12, 0.06, 0, 4000); },
    stun() { tone(1200, 0.25, 'triangle', 0.06, 0, null, 400); tone(900, 0.2, 'triangle', 0.04, 0.08, null, 300); },
    catchg() { tone(300, 0.2, 'sawtooth', 0.05, 0, null, 500); },
    cap() { [76, 79, 83, 88].forEach((m, i) => tone(mf(m), 0.16, 'triangle', 0.08, i * 0.07)); noise(0.25, 0.05, 0, 900, 'lowpass'); },
    slam() { tone(120, 0.35, 'sawtooth', 0.12, 0, null, 50); noise(0.3, 0.14, 0, 300, 'lowpass'); },
    coin() { tone(mf(88), 0.06, 'square', 0.035); tone(mf(93), 0.12, 'square', 0.03, 0.05); },
    gem() { [84, 88, 91, 96, 100].forEach((m, i) => tone(mf(m), 0.18, 'sine', 0.07, i * 0.06)); },
    key() { [79, 86, 91, 98].forEach((m, i) => tone(mf(m), 0.22, 'triangle', 0.08, i * 0.09)); },
    heart() { tone(mf(76), 0.12, 'sine', 0.08); tone(mf(84), 0.18, 'sine', 0.08, 0.1); },
    hurt() { tone(420, 0.3, 'sawtooth', 0.08, 0, null, 110); },
    down() { [67, 63, 60, 55].forEach((m, i) => tone(mf(m), 0.2, 'triangle', 0.08, i * 0.12)); },
    revive() { [60, 64, 67, 72, 76].forEach((m, i) => tone(mf(m), 0.14, 'triangle', 0.08, i * 0.06)); },
    door() { tone(180, 0.25, 'triangle', 0.08, 0, null, 120); noise(0.2, 0.04, 0, 600, 'lowpass'); },
    locked() { tone(200, 0.08, 'square', 0.06); tone(160, 0.12, 'square', 0.06, 0.1); },
    clear() { [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => tone(mf(m), 0.22, 'triangle', 0.08, i * 0.09)); tone(mf(60), 0.8, 'sine', 0.06, 0.1); },
    solved() { [79, 83, 86, 91].forEach((m, i) => tone(mf(m), 0.2, 'sine', 0.09, i * 0.08)); },
    wrong() { tone(300, 0.15, 'square', 0.05, 0, null, 200); tone(220, 0.25, 'square', 0.05, 0.15, null, 150); },
    giggle() { const b = 600 + Math.random() * 300; for (let i = 0; i < 4; i++) tone(b + (i % 2) * 180, 0.07, 'triangle', 0.04, i * 0.07); },
    boo() { for (let i = 0; i < 6; i++) tone(500 + (i % 2) * 250 + i * 30, 0.08, 'sine', 0.05, i * 0.08); },
    plunge() { tone(700, 0.08, 'sine', 0.08, 0, null, 300); tone(200, 0.1, 'square', 0.04, 0.08); },
    pop() { tone(500, 0.12, 'sine', 0.09, 0, null, 1400); },
    throwx() { noise(0.18, 0.06, 0, 1200); },
    breakx() { noise(0.2, 0.1, 0, 2500); tone(1500, 0.1, 'square', 0.03); },
    tele() { tone(880, 0.08, 'square', 0.03); },
    quake() { noise(0.5, 0.18, 0, 200, 'lowpass'); tone(70, 0.5, 'sine', 0.12); },
    cast() { tone(400, 0.4, 'sine', 0.06, 0, null, 1200); tone(600, 0.4, 'sine', 0.04, 0.05, null, 1600); },
    boss() { [48, 51, 55, 54].forEach((m, i) => tone(mf(m), 0.4, 'sawtooth', 0.06, i * 0.3)); },
    bossdown() { [60, 64, 67, 72, 76, 79, 84, 88, 91].forEach((m, i) => tone(mf(m), 0.25, 'triangle', 0.09, i * 0.09)); },
    reveal() { tone(1000, 0.3, 'sine', 0.05, 0, null, 2000); },
    bark() { tone(700, 0.06, 'square', 0.06, 0, null, 500); tone(750, 0.07, 'square', 0.06, 0.12, null, 500); },
    join() { [72, 79, 84].forEach((m, i) => tone(mf(m), 0.12, 'triangle', 0.07, i * 0.06)); },
    leave() { [79, 72].forEach((m, i) => tone(mf(m), 0.14, 'triangle', 0.06, i * 0.08)); },
    lever() { tone(250, 0.12, 'square', 0.06); noise(0.08, 0.05, 0.05, 800); },
    candle() { tone(mf(84), 0.2, 'sine', 0.07); },
    mirror() { tone(1400, 0.08, 'triangle', 0.05); tone(1700, 0.1, 'triangle', 0.04, 0.05); },
    swap() { tone(500, 0.12, 'sine', 0.06, 0, null, 900); },
    buy() { [76, 81, 84, 88].forEach((m, i) => tone(mf(m), 0.14, 'square', 0.05, i * 0.06)); }
  };
  function fx(n) { if (!ctx || muted) return; const f = FX[n]; if (f) try { f(); } catch (e) { /* ignore */ } }
  // held vacuum / blow hiss
  function hold(kind) {
    if (!ctx) return;
    if (!kind) { if (vacG) { vacG.gain.setTargetAtTime(0, ctx.currentTime, 0.05); } return; }
    if (!vacN) { vacN = ctx.createBufferSource(); vacN.buffer = noiseBuf(); vacN.loop = true; vacF = ctx.createBiquadFilter(); vacF.type = 'bandpass'; vacG = ctx.createGain(); vacG.gain.value = 0; vacN.connect(vacF); vacF.connect(vacG); vacG.connect(sfx); vacN.start(); }
    vacF.frequency.setTargetAtTime(kind === 'vac' ? 900 : kind === 'tug' ? 500 : 2200, ctx.currentTime, 0.05);
    vacG.gain.setTargetAtTime(muted ? 0 : kind === 'tug' ? 0.16 : 0.09, ctx.currentTime, 0.05);
  }
  // music: slow minor arpeggios (spooky), brighter when the room is lit, faster for bosses
  const SONGS = {
    dark: { bpm: 84, root: 57, prog: [0, -4, -2, -5], arp: [0, 3, 7, 10, 7, 3, 12, 7], bass: 'triangle', lead: 'sine' },
    lit: { bpm: 96, root: 60, prog: [0, 5, -3, 7], arp: [0, 4, 7, 12, 7, 4, 9, 7], bass: 'triangle', lead: 'triangle' },
    boss: { bpm: 132, root: 52, prog: [0, 1, -2, -1], arp: [0, 3, 6, 12, 6, 3, 0, 3], bass: 'sawtooth', lead: 'square' },
    title: { bpm: 90, root: 55, prog: [0, -4, 3, -2], arp: [0, 3, 7, 12, 15, 12, 7, 3], bass: 'triangle', lead: 'sine' }
  };
  function tick() {
    if (!ctx || !mode || muted) return;
    const s = SONGS[mode]; const spb = 60 / s.bpm / 2;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4, i = step % 8, r = s.root + s.prog[bar];
      const d = nextT - ctx.currentTime;
      tone(mf(r + s.arp[i] + 12), spb * 1.6, s.lead, mode === 'boss' ? 0.05 : 0.07, d, mus);
      if (i === 0 || i === 4) tone(mf(r - 12), spb * 3.6, s.bass, 0.12, d, mus);
      if (mode !== 'lit' && i === 6 && bar % 2 === 1) tone(mf(r + 18), spb * 3, 'sine', 0.035, d, mus, mf(r + 17));
      if (mode === 'boss' && i % 2 === 0) noise(0.05, 0.05, d, 6000);
      nextT += spb; step++;
    }
  }
  return {
    init, fx, hold,
    music(m) { if (mode !== m) { mode = m; step = 0; } },
    setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.75; if (muted) hold(null); },
    get muted() { return muted; }
  };
})();
})();
