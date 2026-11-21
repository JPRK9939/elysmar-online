/* Utilities: noise, terrain height, textures, math helpers */
window.G = window.G || {};
(function () {
  const D = window.GameData;
  G.D = D;
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false; // treat hex colours as sRGB → richer, non-washed colours
  G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.smooth = (a, b, x) => { const t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  G.damp = (a, b, k, dt) => G.lerp(a, b, 1 - Math.exp(-k * dt));
  G.angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  G.dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

  // seeded RNG for deterministic world decoration
  G.seeded = function (seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

  // ---------- Perlin noise ----------
  const perm = new Uint8Array(512);
  (function () { const r = G.seeded(20261121); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; })();
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => { const u = h & 1 ? x : -x, v = h & 2 ? y : -y; return (h & 4) ? u + v : (u + v) * 0.7071 + (h & 3 ? 0 : x * 0.3); };
  G.noise2 = function (x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    return G.lerp(G.lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u), G.lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u), v);
  };
  G.fbm = function (x, y, oct) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < (oct || 4); i++) { s += G.noise2(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; };

  // ---------- Terrain ----------
  G.terrainH = function (x, z) {
    if (x > 2000) return 0; // dungeon realm (separate flat arena)
    let h = G.fbm(x * 0.0042, z * 0.0042, 4) * 26 + G.noise2(x * 0.035, z * 0.035) * 1.2 + 9;
    const r = Math.hypot(x, z);
    h = 6 + (h - 6) * G.smooth(52, 100, r);                     // village plateau
    const dl = Math.hypot(x + 240, z + 160);                       // crystal lake bowl
    if (dl < 100) h = G.lerp(h, -7, Math.pow(1 - dl / 100, 1.6) * 1.1);
    const dr = Math.hypot(x + 250, z - 240);                       // rift crater
    if (dr < 120) h -= Math.pow(1 - dr / 120, 2) * 9;
    const dd = Math.hypot(x - 320, z + 10);                        // flatten around dungeon gate
    if (dd < 22) h = G.lerp(h, G.fbm(320 * 0.0042, -10 * 0.0042, 4) * 26 + 9, 1 - G.smooth(10, 22, dd));
    if (r > 470) h += Math.pow((r - 470) / 50, 2) * 10;            // edge mountains
    return h;
  };
  G.WATER_Y = -2.2;
  G.zoneAt = function (x, z) {
    if (x > 2000) return { id: 'crypt', name: D.DUNGEON.name };
    if (Math.hypot(x - D.VILLAGE.x, z - D.VILLAGE.z) < D.VILLAGE.r + 6) return { id: 'village', name: D.VILLAGE.name };
    let best = null, bd = 1e9;
    for (const zn of D.ZONES) { const d = Math.hypot(x - zn.cx, z - zn.cz) / zn.r; if (d < 1 && d < bd) { bd = d; best = zn; } }
    return best || { id: 'wild', name: 'ดินแดนรกร้าง' };
  };
  G.darkness = function (x, z) { // 0..1 how deep in the dusk veil
    const dr = Math.hypot(x + 250, z - 240); const r = Math.hypot(x, z);
    return Math.max(1 - G.smooth(60, 190, dr), G.smooth(430, 560, r) * 0.8, x > 2000 ? 0.55 : 0);
  };

  // ---------- Textures ----------
  G.tex = {};
  G.makeToonGradient = function () {
    const c = document.createElement('canvas'); c.width = 4; c.height = 1; const g = c.getContext('2d');
    [90, 160, 220, 255].forEach((v, i) => { g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i, 0, 1, 1); });
    const t = new THREE.CanvasTexture(c); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
  };
  G.makeGlowTex = function (inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner || 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, outer || 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  };
  G.makeStarTex = function () {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.translate(32, 32);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr;
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 7 : 30; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill();
    return new THREE.CanvasTexture(c);
  };
  G.makeRingTex = function () {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,.25)'); gr.addColorStop(0.92, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  };
  G.makeRuneTex = function (color) {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.translate(128, 128);
    g.strokeStyle = color || '#fff'; g.shadowColor = color || '#fff'; g.shadowBlur = 12; g.lineWidth = 4;
    g.beginPath(); g.arc(0, 0, 118, 0, Math.PI * 2); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 96, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(Math.cos(a) * 96, Math.sin(a) * 96); g.lineTo(Math.cos(a + Math.PI * 2 / 3) * 96, Math.sin(a + Math.PI * 2 / 3) * 96); g.stroke(); }
    g.font = '20px serif'; g.fillStyle = color || '#fff'; const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.save(); g.rotate(a); g.fillText(glyphs[i], -6, -100); g.restore(); }
    return new THREE.CanvasTexture(c);
  };
  G.initTextures = function () {
    G.tex.toon = G.makeToonGradient(); G.tex.glow = G.makeGlowTex(); G.tex.star = G.makeStarTex(); G.tex.ring = G.makeRingTex();
    G.tex.rune = G.makeRuneTex('#bfe8ff'); G.tex.runeDark = G.makeRuneTex('#c79bff'); G.tex.runeGold = G.makeRuneTex('#ffd77a');
  };
  G.toon = function (color, opts) {
    return new THREE.MeshToonMaterial(Object.assign({ color: new THREE.Color(color), gradientMap: G.tex.toon }, opts || {}));
  };
  G.fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.floor(n));
  G.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  G.today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
})();
