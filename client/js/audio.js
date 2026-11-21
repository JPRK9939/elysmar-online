/* Audio: procedural SFX + ambient music.
   If you drop Pixabay (free licence) tracks into client/assets/audio/ named
   village.mp3, field.mp3, forest.mp3, ruins.mp3, rift.mp3, dungeon.mp3, they are used instead of the procedural music. */
(function () {
  const A = G.audio = { ctx: null, master: null, musicGain: null, sfxGain: null, enabled: true, zone: null, files: {}, cur: null, vol: { music: 0.35, sfx: 0.6 } };
  try { const v = JSON.parse(localStorage.getItem('ely_vol') || 'null'); if (v) A.vol = v; } catch (e) {}

  A.init = function () {
    if (A.ctx) return;
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain(); A.master.connect(A.ctx.destination);
      A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = A.vol.music; A.musicGain.connect(A.master);
      A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = A.vol.sfx; A.sfxGain.connect(A.master);
      const len = A.ctx.sampleRate; const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate); const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; A.noiseBuf = buf;
      // reverb
      const ir = A.ctx.createBuffer(2, A.ctx.sampleRate * 2.5, A.ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3); }
      A.verb = A.ctx.createConvolver(); A.verb.buffer = ir; const vg = A.ctx.createGain(); vg.gain.value = 0.5; A.verb.connect(vg); vg.connect(A.musicGain);
      setInterval(A.musicTick, 250);
    } catch (e) { A.enabled = false; }
  };
  A.setVol = function (k, v) { A.vol[k] = v; if (k === 'music' && A.musicGain) A.musicGain.gain.value = v; if (k === 'sfx' && A.sfxGain) A.sfxGain.gain.value = v; if (A.cur) A.cur.volume = A.vol.music; try { localStorage.setItem('ely_vol', JSON.stringify(A.vol)); } catch (e) {} };

  function tone(freq, dur, type, vol, slide, dest, delay) {
    const t = A.ctx.currentTime + (delay || 0); const o = A.ctx.createOscillator(); const g = A.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || A.sfxGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, freq, vol, q, delay) {
    const t = A.ctx.currentTime + (delay || 0); const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf;
    const f = A.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq || 1000, t); f.Q.value = q || 1;
    const g = A.ctx.createGain(); g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.sfxGain); s.start(t); s.stop(t + dur + 0.05);
  }
  const SFX = {
    swing: () => noise(0.15, 1800, 0.25, 0.8),
    hit: () => { noise(0.12, 600, 0.35, 1.5); tone(140, 0.12, 'square', 0.12, 0.5); },
    crit: () => { noise(0.2, 900, 0.4, 1); tone(220, 0.2, 'sawtooth', 0.15, 0.4); tone(880, 0.15, 'sine', 0.1, 1.5); },
    magic: () => { tone(520, 0.35, 'sine', 0.15, 2); tone(780, 0.3, 'triangle', 0.08, 1.6, null, 0.05); },
    fire: () => { noise(0.5, 400, 0.35, 0.6); tone(180, 0.4, 'sawtooth', 0.08, 0.5); },
    ice: () => { for (let i = 0; i < 5; i++) tone(1200 + i * 300, 0.25, 'sine', 0.06, 1.2, null, i * 0.03); noise(0.4, 4000, 0.15, 2); },
    bow: () => { tone(300, 0.08, 'triangle', 0.2, 2.5); noise(0.1, 3000, 0.15, 3); },
    heal: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, 'sine', 0.1, 1, null, i * 0.07)); },
    dash: () => noise(0.25, 2500, 0.3, 0.5),
    hurt: () => { tone(200, 0.15, 'square', 0.12, 0.6); noise(0.1, 500, 0.2); },
    levelup: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => { tone(f, 0.6, 'triangle', 0.12, 1, null, i * 0.09); tone(f * 2, 0.4, 'sine', 0.05, 1, null, i * 0.09); }); },
    coin: () => { tone(988, 0.08, 'square', 0.08); tone(1319, 0.25, 'square', 0.08, 1, null, 0.08); },
    pickup: () => tone(660, 0.12, 'triangle', 0.15, 1.5),
    gather: () => { noise(0.08, 2000, 0.2, 2); tone(440, 0.1, 'triangle', 0.08, 1.2); },
    craft: () => { tone(400, 0.1, 'square', 0.1); tone(600, 0.1, 'square', 0.1, 1, null, 0.12); tone(900, 0.3, 'triangle', 0.12, 1, null, 0.24); },
    anvil: () => { tone(1500, 0.6, 'triangle', 0.15, 0.98); tone(2250, 0.4, 'sine', 0.08); noise(0.05, 5000, 0.3); },
    fail: () => { tone(300, 0.3, 'sawtooth', 0.12, 0.5); tone(200, 0.4, 'sawtooth', 0.1, 0.5, null, 0.15); },
    break: () => { noise(0.6, 3000, 0.4, 0.5); tone(150, 0.5, 'sawtooth', 0.15, 0.3); },
    puzzle: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'sine', 0.12, 1, null, i * 0.12)); },
    ding: () => tone(880, 0.3, 'sine', 0.12),
    bad: () => tone(160, 0.3, 'square', 0.1, 0.8),
    jump: () => tone(300, 0.12, 'sine', 0.08, 1.8),
    ui: () => tone(700, 0.05, 'sine', 0.06),
    boom: () => { noise(0.8, 200, 0.6, 0.5); tone(60, 0.7, 'sine', 0.4, 0.4); },
    talk: () => { for (let i = 0; i < 3; i++) tone(500 + Math.random() * 300, 0.05, 'triangle', 0.04, 1, null, i * 0.06); }
  };
  A.sfx = function (name) { if (!A.ctx || !A.enabled || !SFX[name]) return; try { SFX[name](); } catch (e) {} };

  // ---------- music ----------
  const SCALES = {
    village: { root: 261.6, sc: [0, 2, 4, 7, 9, 12, 14, 16], tempo: 0.5, pad: [0, 4, 7], wave: 'triangle' },
    field: { root: 293.7, sc: [0, 2, 4, 7, 9, 12, 14], tempo: 0.42, pad: [0, 7, 12], wave: 'triangle' },
    forest: { root: 220, sc: [0, 2, 3, 7, 9, 10, 12], tempo: 0.55, pad: [0, 3, 7], wave: 'sine' },
    ruins: { root: 196, sc: [0, 2, 3, 5, 7, 8, 12], tempo: 0.6, pad: [0, 3, 8], wave: 'sine' },
    rift: { root: 164.8, sc: [0, 1, 3, 6, 7, 10, 12], tempo: 0.75, pad: [0, 1, 6], wave: 'sawtooth' },
    dungeon: { root: 146.8, sc: [0, 1, 3, 5, 7, 8, 11], tempo: 0.33, pad: [0, 3, 6], wave: 'square' }
  };
  let step = 0, nextT = 0, padNodes = [];
  A.zoneMusic = function (zoneId) {
    const map = { village: 'village', meadow_e: 'field', meadow_w: 'field', wild: 'field', lake: 'forest', mistwood: 'forest', ruins: 'ruins', rift: 'rift', crypt: 'dungeon' };
    const z = map[zoneId] || 'field'; if (z === A.zone) return; A.zone = z;
    if (A.cur) { const old = A.cur; A.cur = null; fadeOut(old); }
    tryFile(z);
    startPad(z);
  };
  function fadeOut(el) { const iv = setInterval(() => { el.volume = Math.max(0, el.volume - 0.05); if (el.volume <= 0.01) { el.pause(); clearInterval(iv); } }, 80); }
  function tryFile(z) {
    if (location.protocol === 'file:') return;
    if (A.files[z] === false) return;
    const el = A.files[z] || new Audio('assets/audio/' + z + '.mp3');
    el.loop = true; el.volume = 0;
    el.onerror = () => { A.files[z] = false; };
    A.files[z] = el;
    el.play().then(() => { if (A.zone !== z) { el.pause(); return; } A.cur = el; stopPad(); const iv = setInterval(() => { el.volume = Math.min(A.vol.music, el.volume + 0.03); if (el.volume >= A.vol.music - 0.01) clearInterval(iv); }, 80); }).catch(() => { A.files[z] = false; });
  }
  function stopPad() { padNodes.forEach(n => { try { n.g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.8); n.o.stop(A.ctx.currentTime + 3); } catch (e) {} }); padNodes = []; }
  function startPad(z) {
    if (!A.ctx) return; stopPad(); const S = SCALES[z];
    S.pad.forEach((semi, i) => {
      const o = A.ctx.createOscillator(); const g = A.ctx.createGain(); const f = A.ctx.createBiquadFilter();
      o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = S.root / 2 * Math.pow(2, semi / 12); f.type = 'lowpass'; f.frequency.value = 700;
      g.gain.value = 0; g.gain.setTargetAtTime(0.045, A.ctx.currentTime, 2);
      const lfo = A.ctx.createOscillator(); const lg = A.ctx.createGain(); lfo.frequency.value = 0.1 + i * 0.05; lg.gain.value = 3; lfo.connect(lg); lg.connect(o.frequency); lfo.start();
      o.connect(f); f.connect(g); g.connect(A.musicGain); g.connect(A.verb); o.start(); padNodes.push({ o, g });
    });
  }
  A.musicTick = function () {
    if (!A.ctx || !A.zone || A.cur || A.ctx.state !== 'running') return;
    const S = SCALES[A.zone]; const now = A.ctx.currentTime;
    if (nextT < now) nextT = now;
    while (nextT < now + 0.5) {
      if (Math.random() < 0.7) {
        const deg = S.sc[Math.floor(Math.abs(Math.sin(step * 1.7) * 7 + Math.random() * 2)) % S.sc.length];
        const f = S.root * Math.pow(2, deg / 12) * (Math.random() < 0.2 ? 2 : 1);
        const t = nextT - now; const o = A.ctx.createOscillator(); const g = A.ctx.createGain();
        o.type = S.wave === 'square' || S.wave === 'sawtooth' ? 'triangle' : S.wave; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + t); g.gain.exponentialRampToValueAtTime(0.05, now + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + t + S.tempo * 3);
        o.connect(g); g.connect(A.musicGain); g.connect(A.verb); o.start(now + t); o.stop(now + t + S.tempo * 3 + 0.1);
      }
      step++; nextT += S.tempo;
    }
  };
})();
