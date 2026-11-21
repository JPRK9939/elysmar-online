/* Procedural anime-style models (characters, NPCs, monsters, weapons).
   Optional: drop a CC0 rigged character at client/assets/models/hero.glb (e.g. from Quaternius / KayKit)
   with animations named Idle / Run / Attack — it will replace the procedural player body automatically. */
(function () {
  const M = G.models = { gltf: null };
  const geoCache = {};
  const geo = (k, f) => geoCache[k] || (geoCache[k] = f());
  const SPH = (r, w, h) => geo('s' + r + w + h, () => new THREE.SphereGeometry(r, w || 16, h || 12));
  const CYL = (a, b, h, s) => geo('c' + a + b + h + s, () => new THREE.CylinderGeometry(a, b, h, s || 10));
  const BOX = (x, y, z) => geo('b' + x + y + z, () => new THREE.BoxGeometry(x, y, z));
  const CONE = (r, h, s) => geo('k' + r + h + s, () => new THREE.ConeGeometry(r, h, s || 10));
  const mesh = (g, m, x, y, z, shadow) => { const o = new THREE.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); if (shadow !== false) o.castShadow = true; return o; };
  const darker = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k || 0.6).getHexString();

  M.tryLoadGLTF = function () {
    if (location.protocol === 'file:' || !THREE.GLTFLoader) return Promise.resolve();
    return new Promise(res => {
      new THREE.GLTFLoader().load('assets/models/hero.glb', g => { M.gltf = g; console.log('[models] hero.glb loaded'); res(); }, undefined, () => res());
    });
  };

  // ---------- Weapons ----------
  M.weapon = function (wtype, itemId, plus) {
    const def = itemId ? G.D.ITEMS[itemId] : null; const rar = def ? def.rarity || 0 : 0;
    const glowC = ['#bcd', '#7fd6ff', '#c58cff', '#ffcc4d'][rar];
    const metal = G.toon(rar >= 2 ? '#d8d0ff' : '#cfd6e0', { emissive: new THREE.Color(glowC), emissiveIntensity: 0.15 + (plus || 0) * 0.06 });
    const wood = G.toon('#7a4e2a'); const g = new THREE.Group();
    if (wtype === 'sword' || wtype === 'dagger') {
      const L = wtype === 'dagger' ? 0.45 : 0.95;
      g.add(mesh(BOX(0.07, L, 0.025), metal, 0, 0.18 + L / 2)); g.add(mesh(BOX(0.28, 0.05, 0.07), G.toon('#c9a04a'), 0, 0.17)); g.add(mesh(CYL(0.03, 0.03, 0.22, 6), wood, 0, 0.05));
    } else if (wtype === 'axe') {
      g.add(mesh(CYL(0.035, 0.035, 1.0, 6), wood, 0, 0.4)); const h = mesh(BOX(0.34, 0.26, 0.05), metal, 0.12, 0.82); g.add(h);
    } else if (wtype === 'staff' || wtype === 'wand') {
      const L = wtype === 'wand' ? 0.5 : 1.5; g.add(mesh(CYL(0.035, 0.045, L, 6), wtype === 'wand' ? G.toon('#e8e0c8') : wood, 0, L / 2 - 0.2));
      const orbC = itemId === 'bloom_staff' ? '#ffb7dd' : rar >= 2 ? '#c58cff' : '#7fd6ff';
      const orb = mesh(SPH(wtype === 'wand' ? 0.07 : 0.12, 10, 8), new THREE.MeshBasicMaterial({ color: orbC }), 0, L - 0.15); g.add(orb);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: orbC, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(wtype === 'wand' ? 0.5 : 0.8); sp.position.copy(orb.position); g.add(sp);
      if (wtype === 'staff') { const ring = mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 16), G.toon('#c9a04a'), 0, L - 0.15); g.add(ring); g.userData.ring = ring; }
      g.userData.tip = orb;
    } else if (wtype === 'bow') {
      const arc = mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 16, Math.PI), wood, 0, 0.35); arc.rotation.z = -Math.PI / 2; g.add(arc);
      const str = mesh(CYL(0.006, 0.006, 1.1, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.35, 0, false); g.add(str); str.position.x = 0;
      g.rotation.z = 0;
    }
    return g;
  };

  // ---------- Humanoid ----------
  M.humanoid = function (look, opts) {
    look = Object.assign({ hair: '#e8d8a8', skin: '#f6d7bf', cloth: '#5a6fd0', style: 0, ears: 0 }, look || {}); opts = opts || {};
    const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
    const skin = G.toon(look.skin), cloth = G.toon(look.cloth), cloth2 = G.toon(darker(look.cloth, 0.55)), hair = G.toon(look.hair), boot = G.toon('#3a2a24'), trim = G.toon('#e9d28a');
    if (opts.armor) { cloth.emissive = new THREE.Color(opts.armorGlow || '#4b2c8a'); cloth.emissiveIntensity = 0.4; }
    const P = {};
    // legs
    P.legL = new THREE.Group(); P.legL.position.set(-0.13, 0.82, 0); P.legL.add(mesh(CYL(0.09, 0.08, 0.78, 8), cloth2, 0, -0.39)); P.legL.add(mesh(BOX(0.16, 0.14, 0.26), boot, 0, -0.76, 0.04)); body.add(P.legL);
    P.legR = new THREE.Group(); P.legR.position.set(0.13, 0.82, 0); P.legR.add(mesh(CYL(0.09, 0.08, 0.78, 8), cloth2, 0, -0.39)); P.legR.add(mesh(BOX(0.16, 0.14, 0.26), boot, 0, -0.76, 0.04)); body.add(P.legR);
    // torso + robe skirt
    P.torso = new THREE.Group(); P.torso.position.y = 0.85; body.add(P.torso);
    P.torso.add(mesh(CYL(0.22, 0.27, 0.62, 12), cloth, 0, 0.32));
    P.torso.add(mesh(CYL(0.28, 0.4, 0.38, 14), cloth, 0, -0.08));
    P.torso.add(mesh(new THREE.TorusGeometry(0.265, 0.035, 6, 16), trim, 0, 0.06).rotateX(Math.PI / 2));
    P.torso.add(mesh(BOX(0.1, 0.1, 0.04), trim, 0, 0.5, 0.21));
    // cape
    const capeG = geo('cape', () => { const g = new THREE.PlaneGeometry(0.62, 1.0, 1, 4); g.translate(0, -0.5, 0); return g; });
    P.cape = mesh(capeG, new THREE.MeshToonMaterial({ color: new THREE.Color(darker(look.cloth, 0.75)), gradientMap: G.tex.toon, side: THREE.DoubleSide }), 0, 0.62, -0.2); P.cape.rotation.x = 0.12; P.torso.add(P.cape);
    // arms
    const arm = side => { const a = new THREE.Group(); a.position.set(0.3 * side, 0.58, 0); a.add(mesh(CYL(0.065, 0.06, 0.52, 8), cloth, 0, -0.24)); a.add(mesh(SPH(0.075, 8, 6), skin, 0, -0.52)); P.torso.add(a); return a; };
    P.armL = arm(-1); P.armR = arm(1);
    P.hand = new THREE.Group(); P.hand.position.set(0, -0.53, 0.02); P.hand.rotation.x = Math.PI / 2.2; P.armR.add(P.hand);
    // head
    P.head = new THREE.Group(); P.head.position.y = 0.88; P.torso.add(P.head);
    P.head.add(mesh(SPH(0.27, 18, 14), skin, 0, 0.22));
    const eyeM = new THREE.MeshBasicMaterial({ color: opts.eyeColor || '#3b2a5a' }), hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const s of [-1, 1]) { const e = mesh(SPH(0.05, 8, 8), eyeM, 0.1 * s, 0.2, 0.235, false); e.scale.set(0.8, 1.25, 0.5); P.head.add(e); const h = mesh(SPH(0.016, 6, 6), hiM, 0.1 * s + 0.015, 0.23, 0.26, false); P.head.add(h); }
    if (opts.glowEyes) { eyeM.color.set(opts.glowEyes); }
    // hair
    const crownG = geo('hcrown', () => new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.4));
    const backG = geo('hback', () => new THREE.SphereGeometry(0.3, 16, 12, Math.PI, Math.PI, 0, Math.PI * 0.78));
    P.head.add(mesh(crownG, hair, 0, 0.23, 0)); P.head.add(mesh(backG, hair, 0, 0.22, -0.02));
    for (let i = -2; i <= 2; i++) { const b = mesh(CONE(0.07, 0.22, 5), hair, i * 0.075, 0.33, 0.22); b.rotation.x = Math.PI * 0.95; b.rotation.z = i * 0.12; P.head.add(b); }
    if (look.style == 1) { const l = mesh(BOX(0.5, 0.65, 0.12), hair, 0, -0.02, -0.2); P.head.add(l); for (const s of [-1, 1]) P.head.add(mesh(BOX(0.08, 0.42, 0.12), hair, 0.25 * s, 0.05, 0.05)); }
    if (look.style == 2) { const t = mesh(CONE(0.11, 0.7, 8), hair, 0, 0.05, -0.32); t.rotation.x = -2.6; P.head.add(t); P.tail = t; }
    if (look.style == 3) for (const s of [-1, 1]) { const t = mesh(CONE(0.1, 0.6, 8), hair, 0.3 * s, 0.1, -0.08); t.rotation.z = 2.9 * s; P.head.add(t); P.head.add(mesh(SPH(0.06, 6, 6), G.toon('#ff6f91'), 0.28 * s, 0.38, -0.05)); }
    if (look.ears == 1 || opts.elf) for (const s of [-1, 1]) { const e = mesh(CONE(0.05, 0.28, 5), skin, 0.3 * s, 0.24, -0.02); e.rotation.z = -1.3 * s; e.rotation.x = 0.3; P.head.add(e); }
    if (opts.hat === 'witch') { const h = mesh(CONE(0.3, 0.55, 12), G.toon('#2b2050'), 0, 0.68, -0.02); h.rotation.x = -0.15; P.head.add(h); P.head.add(mesh(CYL(0.45, 0.45, 0.03, 20), G.toon('#2b2050'), 0, 0.45, 0)); }
    if (opts.hat === 'helm') { P.head.add(mesh(SPH(0.31, 14, 10), G.toon(opts.helmColor || '#3a3550', { emissive: new THREE.Color('#2a1a50'), emissiveIntensity: .4 }), 0, 0.25, 0)); P.head.add(mesh(BOX(0.34, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: opts.glowEyes || '#9b7bff' }), 0, 0.22, 0.28)); }
    if (opts.hat === 'crown') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.head.add(mesh(CONE(0.06, 0.25, 4), G.toon('#ffcc4d', { emissive: new THREE.Color('#aa6600'), emissiveIntensity: .5 }), Math.cos(a) * 0.25, 0.6, Math.sin(a) * 0.25)); } }
    if (opts.hat === 'bandana') { P.head.add(mesh(CYL(0.29, 0.3, 0.1, 14), G.toon('#c9483a'), 0, 0.36, -0.02)); }
    if (opts.beard) { const b = mesh(CONE(0.16, 0.4, 8), hair, 0, -0.02, 0.18); b.rotation.x = Math.PI; P.head.add(b); }
    root.userData.P = P; root.userData.body = body; root.userData.anim = { t: Math.random() * 10, atk: 0, cast: 0, dead: 0 };
    root.userData.wtype = 'none';
    return root;
  };
  M.setWeapon = function (model, wtype, itemId, plus) {
    const P = model.userData.P; if (!P) return; const key = wtype + ':' + itemId + ':' + (plus || 0); if (model.userData.wkey === key) return; model.userData.wkey = key;
    while (P.hand.children.length) P.hand.remove(P.hand.children[0]);
    model.userData.wtype = wtype || 'none';
    if (wtype && wtype !== 'none') { const w = M.weapon(wtype, itemId, plus); if (wtype === 'bow') { w.rotation.set(0, 0, 0); } P.hand.add(w); model.userData.weapon = w; }
  };
  // state: idle | run | attack | cast | jump | dead | gather | sit
  M.animHumanoid = function (model, state, dt, speed) {
    const P = model.userData.P, A = model.userData.anim; if (!P) return;
    A.t += dt * (speed || 1);
    const t = A.t; const body = model.userData.body;
    const run = state === 'run' ? 1 : 0; const sw = Math.sin(t * 11) * 0.85 * run;
    P.legL.rotation.x = G.damp(P.legL.rotation.x, sw, 20, dt); P.legR.rotation.x = G.damp(P.legR.rotation.x, -sw, 20, dt);
    P.armL.rotation.x = G.damp(P.armL.rotation.x, -sw * 0.8, 20, dt); P.armR.rotation.x = G.damp(P.armR.rotation.x, sw * 0.8, 20, dt);
    P.armL.rotation.z = G.damp(P.armL.rotation.z, -0.12, 10, dt); P.armR.rotation.z = G.damp(P.armR.rotation.z, 0.12, 10, dt);
    body.position.y = run ? Math.abs(Math.sin(t * 11)) * 0.08 : Math.sin(t * 2) * 0.015;
    P.torso.rotation.x = G.damp(P.torso.rotation.x, run * 0.12, 10, dt);
    P.cape.rotation.x = G.damp(P.cape.rotation.x, 0.12 + run * 0.6 + Math.sin(t * 3) * 0.05, 6, dt);
    if (P.tail) P.tail.rotation.z = Math.sin(t * 4) * 0.2 * (1 + run);
    if (state === 'jump') { P.legL.rotation.x = -0.6; P.legR.rotation.x = 0.3; P.armL.rotation.z = -0.8; P.armR.rotation.z = 0.8; }
    if (state === 'gather' || state === 'sit') { P.armR.rotation.x = -0.9 + Math.sin(t * 8) * 0.4; P.armL.rotation.x = -0.9 - Math.sin(t * 8) * 0.4; P.torso.rotation.x = 0.35; }
    // attack overlay
    if (A.atk > 0) {
      A.atk = Math.max(0, A.atk - dt * 3.5); const k = 1 - A.atk; const wt = model.userData.wtype;
      if (wt === 'bow') { P.armR.rotation.x = -1.5; P.armL.rotation.x = -1.5; P.armL.rotation.z = 0.3; }
      else if (wt === 'staff' || wt === 'wand') { P.armR.rotation.x = -1.2 - Math.sin(k * Math.PI) * 0.8; }
      else { P.armR.rotation.x = k < 0.35 ? G.lerp(0, -2.6, k / 0.35) : G.lerp(-2.6, 0.6, (k - 0.35) / 0.65); P.armR.rotation.z = 0.12 + Math.sin(k * Math.PI) * 0.6; P.torso.rotation.y = Math.sin(k * Math.PI) * -0.4; }
    } else P.torso.rotation.y = G.damp(P.torso.rotation.y, 0, 10, dt);
    if (A.cast > 0) { A.cast = Math.max(0, A.cast - dt * 2); P.armR.rotation.x = -1.6; P.armL.rotation.x = -1.6; P.armL.rotation.z = 0.25; P.armR.rotation.z = -0.25; }
    if (model.userData.weapon && model.userData.weapon.userData.ring) model.userData.weapon.userData.ring.rotation.y += dt * 2;
    const deadT = state === 'dead' ? 1 : 0; A.dead = G.damp(A.dead, deadT, 6, dt);
    body.rotation.x = -A.dead * Math.PI / 2; body.position.y += A.dead * 0.25;
  };
  M.triggerAttack = m => { if (m.userData.anim) m.userData.anim.atk = 1; };
  M.triggerCast = m => { if (m.userData.anim) m.userData.anim.cast = 1; };

  // ---------- GLTF hero wrapper ----------
  M.gltfHero = function () {
    if (!M.gltf || !THREE.SkeletonUtils) return null;
    const scene = THREE.SkeletonUtils.clone(M.gltf.scene); const box = new THREE.Box3().setFromObject(scene); const h = box.max.y - box.min.y || 1;
    scene.scale.setScalar(1.75 / h); scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const root = new THREE.Group(); root.add(scene); const mixer = new THREE.AnimationMixer(scene); const acts = {};
    for (const clip of M.gltf.animations) { const n = clip.name.toLowerCase(); for (const k of ['idle', 'run', 'walk', 'attack', 'jump', 'death', 'cast']) if (n.includes(k) && !acts[k]) acts[k] = mixer.clipAction(clip); }
    root.userData.gltf = { mixer, acts, cur: null }; root.userData.anim = { atk: 0, cast: 0 }; root.userData.P = null;
    return root;
  };
  M.animGLTF = function (model, state, dt) {
    const g = model.userData.gltf; g.mixer.update(dt); const A = model.userData.anim;
    let want = state === 'run' ? (g.acts.run || g.acts.walk) : state === 'dead' ? g.acts.death : state === 'jump' ? g.acts.jump : g.acts.idle;
    if (A.atk > 0) { A.atk -= dt * 2; want = g.acts.attack || want; } if (A.cast > 0) { A.cast -= dt * 2; want = g.acts.cast || g.acts.attack || want; }
    if (want && want !== g.cur) { if (g.cur) g.cur.fadeOut(0.15); want.reset().fadeIn(0.15).play(); g.cur = want; }
  };

  // ---------- Monsters ----------
  M.monster = function (type) {
    const def = G.D.MONSTERS[type]; const c = def.color; const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
    const mat = G.toon(c); const eyeGlow = new THREE.MeshBasicMaterial({ color: def.shape === 'wraith' || def.shape === 'knight' || def.shape === 'boss' ? '#ff4fd8' : '#1a1030' });
    const P = { body }; const s = def.size || 1;
    const eyes = (y, z, sp, r) => { for (const k of [-1, 1]) { const e = mesh(SPH(r || 0.07, 8, 6), eyeGlow, sp * k, y, z, false); e.scale.z = 0.5; body.add(e); if (eyeGlow.color.getHex() === 0x1a1030) body.add(mesh(SPH((r || .07) * 0.35, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), sp * k + 0.02, y + 0.03, z + 0.02, false)); } };
    switch (def.shape) {
      case 'slime': {
        const m = new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: G.tex.toon, transparent: true, opacity: 0.88, emissive: new THREE.Color(c), emissiveIntensity: 0.15 });
        const b = mesh(SPH(0.55, 18, 14), m, 0, 0.45); b.scale.set(1, 0.8, 1); body.add(b); P.blob = b; eyes(0.55, 0.45, 0.16, 0.08);
        body.add(mesh(SPH(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6 }), -0.2, 0.75, 0.25, false));
        const leaf = mesh(CONE(0.08, 0.25, 5), G.toon('#7ed957'), 0, 0.95, 0); leaf.rotation.z = 0.4; body.add(leaf); break;
      }
      case 'imp': {
        body.add(mesh(SPH(0.4, 14, 12), mat, 0, 0.9)); eyes(0.95, 0.35, 0.13, 0.08);
        for (const k of [-1, 1]) { const h = mesh(CONE(0.07, 0.3, 6), G.toon('#4a2a2a'), 0.22 * k, 1.28, 0); h.rotation.z = -0.4 * k; body.add(h); const w = mesh(BOX(0.4, 0.25, 0.02), G.toon(darker(c, .6)), 0.45 * k, 1.0, -0.2); w.rotation.y = 0.5 * k; body.add(w); P['w' + k] = w; }
        const lan = new THREE.Group(); lan.position.set(0.45, 0.55, 0.2); lan.add(mesh(BOX(0.18, 0.24, 0.18), G.toon('#3a2a1a'), 0, 0)); const fl = mesh(SPH(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' }), 0, 0, 0, false); lan.add(fl);
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: '#ffaa44', blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(1.2); lan.add(gl); body.add(lan); P.lan = lan; P.float = 0.3; break;
      }
      case 'mushroom': {
        body.add(mesh(CYL(0.22, 0.28, 0.6, 10), G.toon('#f3e6cf'), 0, 0.35)); const cap = mesh(SPH(0.55, 16, 10, 0), mat, 0, 0.7); cap.scale.set(1, 0.6, 1); body.add(cap); P.cap = cap;
        for (let i = 0; i < 6; i++) { const a = i * 1.1; body.add(mesh(SPH(0.07, 6, 6), G.toon('#fff'), Math.cos(a) * 0.38, 0.88 + (i % 2) * .05, Math.sin(a) * 0.38)); }
        eyes(0.45, 0.24, 0.09, 0.05); for (const k of [-1, 1]) body.add(mesh(SPH(0.1, 6, 6), G.toon('#f3e6cf'), 0.15 * k, 0.05, 0.05)); break;
      }
      case 'dog': {
        const bone = G.toon(c); body.add(mesh(BOX(0.4, 0.35, 0.9), bone, 0, 0.6)); for (let i = 0; i < 4; i++) body.add(mesh(BOX(0.46, 0.05, 0.06), G.toon('#bdb6a0'), 0, 0.62, -0.3 + i * 0.18));
        const head = new THREE.Group(); head.position.set(0, 0.85, 0.5); head.add(mesh(BOX(0.36, 0.32, 0.38), bone, 0, 0, 0)); head.add(mesh(BOX(0.22, 0.16, 0.25), bone, 0, -0.06, 0.25));
        for (const k of [-1, 1]) { const e = mesh(CONE(0.07, 0.18, 4), bone, 0.13 * k, 0.22, -0.05); head.add(e); head.add(mesh(SPH(0.045, 6, 6), new THREE.MeshBasicMaterial({ color: '#7fffd0' }), 0.1 * k, 0.05, 0.19, false)); }
        body.add(head); P.head = head; P.legs = [];
        for (const [x, z] of [[-.15, .35], [.15, .35], [-.15, -.35], [.15, -.35]]) { const l = new THREE.Group(); l.position.set(x, 0.45, z); l.add(mesh(CYL(0.05, 0.04, 0.45, 6), bone, 0, -0.22)); body.add(l); P.legs.push(l); }
        const tail = mesh(CYL(0.03, 0.02, 0.4, 5), bone, 0, 0.8, -0.55); tail.rotation.x = -0.8; body.add(tail); P.tail = tail; break;
      }
      case 'golem': {
        const rock = G.toon(darker(c, 0.8)), mossM = G.toon('#7fae5a');
        body.add(mesh(BOX(0.9, 0.8, 0.6), rock, 0, 1.0)); body.add(mesh(BOX(0.92, 0.12, 0.62), mossM, 0, 1.42)); body.add(mesh(BOX(0.45, 0.4, 0.4), rock, 0, 1.65)); body.add(mesh(BOX(0.47, 0.08, 0.42), mossM, 0, 1.86));
        const core = mesh(SPH(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#9effa0' }), 0, 1.0, 0.31, false); body.add(core); eyes(1.68, 0.21, 0.1, 0.05); eyeGlow.color.set('#9effa0');
        P.arms = []; for (const k of [-1, 1]) { const a = new THREE.Group(); a.position.set(0.6 * k, 1.3, 0); a.add(mesh(BOX(0.3, 0.8, 0.3), rock, 0, -0.4)); body.add(a); P.arms.push(a); }
        for (const k of [-1, 1]) body.add(mesh(BOX(0.3, 0.6, 0.3), rock, 0.25 * k, 0.3, 0)); break;
      }
      case 'wraith': {
        const cl = new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: G.tex.toon, transparent: true, opacity: 0.85, emissive: new THREE.Color('#2a1050'), emissiveIntensity: 0.6 });
        const cloak = mesh(CONE(0.55, 1.5, 12), cl, 0, 0.85); cloak.rotation.x = Math.PI; cloak.position.y = 0.9; body.add(cloak); const cl2 = mesh(CONE(0.5, 1.1, 12), cl, 0, 1.2); body.add(cl2);
        body.add(mesh(SPH(0.3, 12, 10), G.toon('#1a0f2e'), 0, 1.65)); eyes(1.65, 0.24, 0.1, 0.06);
        for (const k of [-1, 1]) { const a = mesh(CONE(0.12, 0.8, 6), cl, 0.45 * k, 1.2, 0.1); a.rotation.z = 2.6 * k; body.add(a); }
        P.float = 0.5; P.wisp = '#9b5cff'; break;
      }
      case 'knight': case 'boss': {
        const h = M.humanoid({ hair: '#222', skin: '#4a3a6a', cloth: c, style: 0 }, { armor: true, hat: def.shape === 'boss' ? 'crown' : 'helm', glowEyes: '#ff4fd8', armorGlow: def.shape === 'boss' ? '#5a1a8a' : '#3a1a6a' });
        M.setWeapon(h, 'sword', def.shape === 'boss' ? 'knight_blade' : 'iron_sword', 3); body.add(h); P.hum = h; P.wisp = '#7b3cff';
        if (def.shape === 'boss') { const r = new THREE.Mesh(F_planeGeo(), new THREE.MeshBasicMaterial({ map: G.tex.runeDark, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.y = 0.05; r.scale.setScalar(4); root.add(r); P.rune = r; }
        break;
      }
    }
    body.scale.setScalar(s); root.userData.P = P; root.userData.t = Math.random() * 10; root.userData.def = def;
    // blob shadow
    const sh = new THREE.Mesh(F_planeGeo(), new THREE.MeshBasicMaterial({ map: G.tex.glow, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.scale.setScalar(1.6 * s); root.add(sh);
    return root;
  };
  let _pg = null; function F_planeGeo() { return _pg || (_pg = new THREE.PlaneGeometry(1, 1)); }
  M.animMonster = function (root, state, dt) {
    const P = root.userData.P, def = root.userData.def; root.userData.t += dt; const t = root.userData.t;
    const moving = state === 'walk' || state === 'chase' || state === 'return';
    const atk = root.userData.atkT > 0; if (atk) root.userData.atkT -= dt;
    const b = P.body;
    switch (def.shape) {
      case 'slime': { const k = moving ? Math.abs(Math.sin(t * 8)) : Math.sin(t * 3) * 0.3 + 0.3; P.blob.scale.set(1 + (1 - k) * 0.15, 0.8 * (0.85 + k * 0.3), 1 + (1 - k) * 0.15); b.position.y = moving ? k * 0.35 : 0; if (atk) b.position.z = Math.sin((root.userData.atkT) * 10) * 0.4; break; }
      case 'imp': b.position.y = P.float + Math.sin(t * 3) * 0.12; P['w-1'].rotation.y = -0.5 + Math.sin(t * 20) * 0.5; P['w1'].rotation.y = 0.5 - Math.sin(t * 20) * 0.5; P.lan.rotation.z = Math.sin(t * 2) * 0.3; if (atk) b.rotation.x = Math.sin(root.userData.atkT * 12) * 0.4; else b.rotation.x = 0; break;
      case 'mushroom': b.position.y = moving ? Math.abs(Math.sin(t * 7)) * 0.2 : 0; b.rotation.z = moving ? Math.sin(t * 7) * 0.1 : 0; P.cap.scale.y = 0.6 + (atk ? Math.sin(root.userData.atkT * 15) * 0.15 : 0); break;
      case 'dog': { const sw = moving ? Math.sin(t * 14) * 0.7 : 0; P.legs.forEach((l, i) => l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? sw : -sw)); P.tail.rotation.z = Math.sin(t * 12) * 0.5; P.head.rotation.x = atk ? -0.5 : Math.sin(t * 2) * 0.05; break; }
      case 'golem': { const sw = moving ? Math.sin(t * 4) * 0.4 : 0; P.arms[0].rotation.x = atk ? -2.2 : sw; P.arms[1].rotation.x = atk ? -2.2 : -sw; b.rotation.z = moving ? Math.sin(t * 4) * 0.05 : 0; break; }
      case 'wraith': b.position.y = P.float + Math.sin(t * 2.4) * 0.2; b.rotation.y = Math.sin(t) * 0.2; if (atk) b.position.z = 0.4; else b.position.z = 0; break;
      case 'knight': case 'boss': M.animHumanoid(P.hum, moving ? 'run' : 'idle', dt, def.shape === 'boss' ? 0.6 : 0.8); if (atk && !root.userData.atkTrig) { M.triggerAttack(P.hum); root.userData.atkTrig = true; } if (!atk) root.userData.atkTrig = false;
        if (P.rune) P.rune.rotation.z += dt * 0.6; b.position.y = def.shape === 'boss' ? 0.3 + Math.sin(t * 1.5) * 0.15 : 0; break;
    }
    if (P.wisp && Math.random() < 0.3) { const p = root.position; G.fx.emit(p.x + (Math.random() - .5), p.y + Math.random() * 2 * (def.size || 1), p.z + (Math.random() - .5), { vy: 0.8, life: 1, size: 0.8, color: P.wisp, alpha: 0.6 }); }
  };

  // ---------- Village props ----------
  M.house = function (w, d, wallC, roofC) {
    const g = new THREE.Group(); const h = 3.4;
    const wall = mesh(BOX(w, h, d), G.toon(wallC || '#efe3c8'), 0, h / 2); wall.receiveShadow = true; g.add(wall);
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(mesh(BOX(0.25, h, 0.25), G.toon('#6b4a2b'), x, h / 2, z));
    const roof = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.82, 2.6, 4), G.toon(roofC || '#c45a4a'), 0, h + 1.3); roof.rotation.y = Math.PI / 4; roof.scale.z = d / w; g.add(roof);
    g.add(mesh(BOX(1.1, 2, 0.1), G.toon('#5a3a20'), 0, 1, d / 2 + 0.05));
    const winM = new THREE.MeshBasicMaterial({ color: '#ffe8a0' }); g.userData.win = winM;
    for (const x of [-w / 3, w / 3]) g.add(mesh(BOX(0.7, 0.7, 0.1), winM, x, 2.1, d / 2 + 0.05, false));
    g.add(mesh(BOX(0.5, 1.2, 0.5), G.toon('#8a7a70'), w / 3, h + 1.6, -d / 5));
    return g;
  };
})();
