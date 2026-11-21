/* Open world: terrain, sky & day/night, vegetation, village, zone landmarks, gathering nodes, waystones, dungeon */
(function () {
  const W = G.world = { platforms: [], interact: [], gather: [], waystones: [], lamps: [], dayT: 0.3, time: 0 };
  const D = G.D;

  W.init = function (container) {
    const r = W.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75)); r.setSize(innerWidth, innerHeight);
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    W.scene = new THREE.Scene(); W.scene.fog = new THREE.Fog('#bcd6ff', 60, 420);
    W.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
    addEventListener('resize', () => { W.camera.aspect = innerWidth / innerHeight; W.camera.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight); });
    // lights
    W.hemi = new THREE.HemisphereLight('#dfefff', '#6a7a4a', 0.75); W.scene.add(W.hemi);
    W.sun = new THREE.DirectionalLight('#fff2d8', 1.25); W.sun.castShadow = true; W.sun.shadow.mapSize.set(2048, 2048);
    const sc = W.sun.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 1; sc.far = 260; W.sun.shadow.bias = -0.0008; W.sun.shadow.normalBias = 0.03;
    W.scene.add(W.sun); W.scene.add(W.sun.target);
    W.ambient = new THREE.AmbientLight('#8a7fb0', 0.15); W.scene.add(W.ambient);
    G.fx.init(W.scene);
  };

  // ---------- sky ----------
  function buildSky() {
    const g = new THREE.SphereGeometry(1500, 32, 16);
    W.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#6fa8ff') }, hor: { value: new THREE.Color('#ffe6f0') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, dark: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform float dark; varying vec3 vP; void main(){ float h=max(vP.y,0.0); vec3 c=mix(hor,top,pow(h,0.55)); float s=max(dot(vP,sunDir),0.0); c+=vec3(1.0,0.85,0.6)*pow(s,180.0)*2.0+vec3(1.0,0.7,0.5)*pow(s,8.0)*0.25; c=mix(c,vec3(0.16,0.08,0.28),dark*0.75*(1.0-h*0.3)); if(vP.y<0.0) c=mix(hor,vec3(0.2,0.2,0.3),min(-vP.y*4.0,1.0)); gl_FragColor=vec4(c,1.0); }' });
    W.sky = new THREE.Mesh(g, W.skyMat); W.sky.renderOrder = -1; W.scene.add(W.sky);
    // stars
    const sp = new Float32Array(1500 * 3); const rr = G.seeded(7);
    for (let i = 0; i < 1500; i++) { const th = rr() * 6.28, ph = Math.acos(rr() * 0.95); sp[i * 3] = Math.sin(ph) * Math.cos(th) * 1400; sp[i * 3 + 1] = Math.cos(ph) * 1400; sp[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 1400; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    W.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 3, map: G.tex.star, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: false }));
    W.scene.add(W.stars);
    W.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: '#dfe8ff', fog: false, depthWrite: false })); W.moon.scale.setScalar(120); W.scene.add(W.moon);
  }

  // ---------- terrain ----------
  function terrainColor(x, z, h, c) {
    const zn = G.zoneAt(x, z).id; const n = G.noise2(x * 0.08, z * 0.08) * 0.5 + 0.5;
    const base = { village: '#8cc36a', meadow_e: '#9fd36a', meadow_w: '#a6d86e', mistwood: '#4f8f52', ruins: '#a7a27a', rift: '#4b3f63', lake: '#7fc28a', wild: '#8cbf62', crypt: '#3a3448' }[zn] || '#8cbf62';
    c.set(base); c.offsetHSL((n - 0.5) * 0.04, 0, (n - 0.5) * 0.08);
    const dark = G.darkness(x, z); if (dark > 0) c.lerp(new THREE.Color('#3b2f55'), dark * 0.8);
    if (h < G.WATER_Y + 1.2) c.lerp(new THREE.Color('#e3d6a0'), G.smooth(G.WATER_Y + 1.2, G.WATER_Y + 0.2, h));
    if (h > 34) c.lerp(new THREE.Color('#8f8c86'), G.smooth(34, 44, h)); if (h > 58) c.lerp(new THREE.Color('#f4f6ff'), G.smooth(58, 66, h));
    const r = Math.hypot(x, z);
    const road = Math.min(Math.abs(x) < 2.6 && r < 230 ? 1 : 0, 1) || (Math.abs(z) < 2.6 && r < 300 ? 1 : 0) || (r > 10 && r < 13 ? 1 : 0);
    if (road && zn !== 'rift') c.lerp(new THREE.Color('#d1b383'), 0.75);
    if (r < 9) c.lerp(new THREE.Color('#d8d0c0'), 0.7);
  }
  function buildTerrain() {
    const S = D.WORLD_SIZE, N = 240; const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position; const cols = new Float32Array(p.count * 3); const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const h = G.terrainH(x, z); p.setY(i, h); terrainColor(x, z, h, c); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    W.terrain = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); W.terrain.receiveShadow = true; W.scene.add(W.terrain);
    // water
    const wg = new THREE.PlaneGeometry(S, S, 1, 1); wg.rotateX(-Math.PI / 2);
    W.waterMat = new THREE.MeshPhongMaterial({ color: '#5fb8e8', transparent: true, opacity: 0.72, shininess: 120, specular: '#ffffff', emissive: '#1a4a7a', emissiveIntensity: 0.25 });
    W.water = new THREE.Mesh(wg, W.waterMat); W.water.position.y = G.WATER_Y; W.scene.add(W.water);
  }

  // ---------- vegetation (instanced) ----------
  function instanced(geom, mat, list, opts) {
    const im = new THREE.InstancedMesh(geom, mat, list.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
    list.forEach((o, i) => { e.set(o.rx || 0, o.ry || 0, o.rz || 0); q.setFromEuler(e); s.set(o.sx || o.s, o.sy || o.s, o.sz || o.s); v.set(o.x, o.y, o.z); m4.compose(v, q, s); im.setMatrixAt(i, m4); if (o.c) im.setColorAt(i, new THREE.Color(o.c)); });
    im.castShadow = opts && opts.shadow; im.receiveShadow = opts && opts.recv; if (im.instanceColor) im.instanceColor.needsUpdate = true; W.scene.add(im); return im;
  }
  function blocked(x, z) {
    const r = Math.hypot(x, z); if (r < 58) return true; if (Math.abs(x) < 5 && r < 230) return true; if (Math.abs(z) < 5 && r < 300) return true;
    if (G.terrainH(x, z) < G.WATER_Y + 0.6) return true;
    for (const pz of Object.values(D.PUZZLES)) if (G.dist(x, z, pz.pos[0], pz.pos[1]) < 22) return true;
    if (G.dist(x, z, D.DUNGEON.entrance.x, D.DUNGEON.entrance.z) < 20) return true;
    if (G.dist(x, z, D.NPCS.seren.pos[0], D.NPCS.seren.pos[1]) < 10) return true;
    return false;
  }
  function buildVegetation() {
    const rr = G.seeded(42); const trees = { round: [], pine: [], dead: [], sakura: [] }, rocks = [], flowers = [], grass = [];
    for (let i = 0; i < 5200; i++) {
      const x = (rr() - .5) * 1100, z = (rr() - .5) * 1100; if (Math.hypot(x, z) > 540 || blocked(x, z)) continue;
      const zn = G.zoneAt(x, z).id; const h = G.terrainH(x, z); const n = G.noise2(x * 0.02, z * 0.02);
      let dens = { mistwood: 0.55, meadow_e: 0.05, meadow_w: 0.06, ruins: 0.04, rift: 0.1, lake: 0.08, wild: 0.18 }[zn] || 0;
      if (n > 0.15) dens *= 2.2;
      if (rr() < dens) {
        const s = 0.8 + rr() * 0.9; const o = { x, y: h, z, s, ry: rr() * 6.28 };
        if (zn === 'rift') trees.dead.push(o); else if (zn === 'mistwood' || h > 26) trees.pine.push(o); else if (rr() < 0.25) trees.sakura.push(o); else trees.round.push(o);
      } else if (rr() < 0.04) rocks.push({ x, y: h - 0.2, z, s: 0.5 + rr() * 1.6, rx: rr(), ry: rr() * 6, c: zn === 'rift' ? '#4a405a' : '#9a958a' });
    }
    for (let i = 0; i < 9000; i++) {
      const x = (rr() - .5) * 1000, z = (rr() - .5) * 1000; if (Math.hypot(x, z) > 500 || Math.hypot(x, z) < 14) continue; const zn = G.zoneAt(x, z).id; if (zn === 'rift' || zn === 'ruins') continue;
      const h = G.terrainH(x, z); if (h < G.WATER_Y + 0.5) continue;
      if ((zn === 'meadow_e' || zn === 'meadow_w' || zn === 'lake' || zn === 'village') && rr() < 0.45) flowers.push({ x, y: h + 0.15, z, s: 0.6 + rr() * 0.5, c: G.pick(['#ffd6ec', '#fff3a8', '#cfe3ff', '#ffffff', '#ffb3c7', '#e3c8ff']) });
      else grass.push({ x, y: h, z, s: 0.5 + rr() * 0.7, ry: rr() * 6, c: zn === 'mistwood' ? '#3f7a44' : '#7fbf5a' });
    }
    const trunk = G.toon('#7a5236');
    instanced(new THREE.CylinderGeometry(0.22, 0.35, 3, 6).translate(0, 1.5, 0), trunk, [...trees.round, ...trees.sakura], { shadow: true });
    instanced(new THREE.IcosahedronGeometry(2.1, 0).translate(0, 4.2, 0), G.toon('#ffffff'), trees.round.map(t => ({ ...t, c: G.pick(['#6fb85a', '#7fc86a', '#5aa850', '#8fd070']) })), { shadow: true });
    instanced(new THREE.IcosahedronGeometry(2.0, 0).translate(0, 4.2, 0), G.toon('#ffffff'), trees.sakura.map(t => ({ ...t, c: G.pick(['#ffc8dc', '#ffb3cf', '#ffd9e6']) })), { shadow: true });
    instanced(new THREE.CylinderGeometry(0.18, 0.3, 2, 6).translate(0, 1, 0), trunk, trees.pine, { shadow: true });
    instanced(new THREE.ConeGeometry(1.7, 5.5, 7).translate(0, 4.5, 0), G.toon('#ffffff'), trees.pine.map(t => ({ ...t, c: G.pick(['#2f6a45', '#3a7a50', '#2a5e40']) })), { shadow: true });
    instanced(new THREE.CylinderGeometry(0.1, 0.35, 5, 5).translate(0, 2.5, 0), G.toon('#3a2f45'), trees.dead.map(t => ({ ...t, rz: (t.s - 1.2) * 0.4 })), { shadow: true });
    instanced(new THREE.DodecahedronGeometry(1, 0), G.toon('#ffffff'), rocks, { shadow: true, recv: true });
    instanced(new THREE.ConeGeometry(0.12, 0.3, 5), new THREE.MeshLambertMaterial({ color: '#fff', emissive: '#332233', emissiveIntensity: 0.3 }), flowers);
    instanced(new THREE.ConeGeometry(0.08, 0.55, 3).translate(0, 0.27, 0), new THREE.MeshLambertMaterial({ color: '#ffffff' }), grass);
    W.treeCount = Object.values(trees).reduce((a, b) => a + b.length, 0);
  }

  // ---------- village ----------
  function buildVillage() {
    const houses = [[-22, -2, 7, 6, '#efe3c8', '#c45a4a', 0.3], [22, -2, 7, 6, '#f3ead6', '#5a7ac4', -0.3], [-6, -24, 9, 7, '#e8dcc0', '#7a5ac4', 0], [-30, 22, 6, 6, '#efe3c8', '#c4904a', 0.8], [26, 24, 6, 5, '#f3ead6', '#4ac48a', -0.8], [-12, 30, 6, 5, '#efe3c8', '#c45a4a', 2.8], [32, -24, 6, 6, '#efe3c8', '#c4904a', -2.3], [-34, -22, 6, 6, '#f3ead6', '#5a7ac4', 2.3]];
    for (const [x, z, w, d, wc, rc, ry] of houses) { const h = G.models.house(w, d, wc, rc); h.position.set(x, G.terrainH(x, z), z); h.rotation.y = Math.atan2(-x, -z); W.scene.add(h); W.lamps.push(h.userData.win); W.platforms.push({ x, z, hw: w / 2 + 0.3, hd: d / 2 + 0.3, top: h.position.y + 3.4, solid: true, ry: h.rotation.y }); }
    // fountain + central waystone
    const f = new THREE.Group(); f.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.8, 24), G.toon('#cfc8b8'))); const wtr = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.1, 24), new THREE.MeshPhongMaterial({ color: '#7fd0ff', emissive: '#2a6a9a', transparent: true, opacity: .8 })); wtr.position.y = 0.4; f.add(wtr);
    f.position.set(0, G.terrainH(0, 0) + 0.3, 0); f.children.forEach(c => c.receiveShadow = true); W.scene.add(f); W.fountain = f;
    addWaystone(-10, 7, 'village', D.VILLAGE.name);
    // lamp posts
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const x = Math.cos(a) * 15, z = Math.sin(a) * 15; addLamp(x, z); }
    // fences ring
    const fm = G.toon('#8a6a48'); const fl = [];
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; const x = Math.cos(a) * 50, z = Math.sin(a) * 50; if (Math.abs(x) < 6 || Math.abs(z) < 6) continue; fl.push({ x, y: G.terrainH(x, z) + 0.5, z, s: 1, ry: -a }); }
    instanced(new THREE.BoxGeometry(0.15, 1.1, 2.6), fm, fl, { shadow: true });
    // notice board + market stalls
    const board = new THREE.Group(); board.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.15), G.toon('#a0784a'))); board.children[0].position.y = 1.8; for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), G.toon('#6b4a2b')); p.position.set(s, 1.3, 0); board.add(p); }
    board.position.set(8, G.terrainH(8, -8), -8); board.lookAt(0, 1, 0); W.scene.add(board);
    W.interact.push({ type: 'board', x: 8, z: -8, r: 3, label: 'กระดานประกาศ (เคล็ดลับ)', act: () => G.ui.openPanel('help') });
  }
  function addLamp(x, z) {
    const y = G.terrainH(x, z); const g = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 6), G.toon('#3a3040')); p.position.y = 1.6; g.add(p);
    const bulbM = new THREE.MeshBasicMaterial({ color: '#ffe0a0' }); const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bulbM); b.position.y = 3.3; g.add(b);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: '#ffcf7a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.setScalar(2.5); glow.position.y = 3.3; g.add(glow);
    g.position.set(x, y, z); W.scene.add(g); W.lamps.push({ glow, bulbM });
  }
  function addWaystone(x, z, id, name) {
    const y = G.terrainH(x, z); const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 0.5, 8), G.toon('#8a86a0')); base.position.y = 0.25; g.add(base);
    const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), new THREE.MeshToonMaterial({ color: '#8fe8ff', gradientMap: G.tex.toon, emissive: '#3ab0ff', emissiveIntensity: 0.7 })); cry.position.y = 2.4; cry.scale.y = 1.8; g.add(cry);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: '#3a9fd8', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(3.2); gl.position.y = 2.4; g.add(gl);
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: G.tex.rune, color: '#4ab8f0', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); rune.rotation.x = -Math.PI / 2; rune.position.y = 0.55; g.add(rune);
    g.position.set(x, y, z); W.scene.add(g);
    const ws = { id, name, x, z, cry, rune, g }; W.waystones.push(ws);
    W.interact.push({ type: 'waystone', x, z, r: 3.2, label: 'หินเคลื่อนย้าย: ' + name, act: () => G.ui.openWaystones(ws) });
  }

  // ---------- zone landmarks ----------
  function buildLandmarks() {
    const rr = G.seeded(99); const stone = G.toon('#b8b0a0'), stoneD = G.toon('#7a7468');
    // ruins
    const pillars = [], blocks = [];
    for (let i = 0; i < 70; i++) { const a = rr() * 6.28, r = rr() * 90; const x = 270 + Math.cos(a) * r, z = -40 + Math.sin(a) * r; if (blocked(x, z)) continue; const y = G.terrainH(x, z);
      if (rr() < 0.5) pillars.push({ x, y, z, s: 1, sy: 0.4 + rr() * 1.4, rz: rr() < .2 ? 0.3 : 0 }); else blocks.push({ x, y: y + 0.3, z, s: 0.6 + rr() * 1.2, ry: rr() * 3, rx: rr() * .5 }); }
    instanced(new THREE.CylinderGeometry(0.8, 0.9, 7, 10).translate(0, 3.5, 0), stone, pillars, { shadow: true });
    instanced(new THREE.BoxGeometry(1.6, 1, 1.6), stoneD, blocks, { shadow: true, recv: true });
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4, x = 270 + Math.cos(a) * 50, z = -40 + Math.sin(a) * 50; arch(x, z, a); }
    addWaystone(240, -10, 'ruins', 'ซากปรักหักพัง');
    // dungeon gate
    const e = D.DUNGEON.entrance; const gy = G.terrainH(e.x, e.z); const gate = new THREE.Group();
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), G.toon('#4a4058')); p.position.set(s * 4, 4.5, 0); p.castShadow = true; gate.add(p); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(11, 1.6, 2), G.toon('#4a4058')); top.position.y = 9.4; gate.add(top);
    W.portalMat = new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: { t: { value: 0 }, c1: { value: new THREE.Color('#7b3cff') }, c2: { value: new THREE.Color('#ff5fd8') } },
      vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float t; uniform vec3 c1; uniform vec3 c2; varying vec2 vU; void main(){ vec2 p=vU-0.5; float r=length(p); float a=atan(p.y,p.x); float s=sin(a*5.0+r*18.0-t*3.0)*0.5+0.5; vec3 c=mix(c1,c2,s); float al=smoothstep(0.5,0.3,r)*(0.6+0.4*s); gl_FragColor=vec4(c*1.4+vec3(1.0)*smoothstep(0.15,0.0,r),al); }' });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 8.5), W.portalMat); portal.position.y = 4.4; gate.add(portal);
    gate.position.set(e.x, gy, e.z); gate.rotation.y = -Math.PI / 2; W.scene.add(gate);
    W.interact.push({ type: 'dungeon', x: e.x, z: e.z, r: 5, label: 'ประตู: ' + D.DUNGEON.name, act: () => G.ui.confirmDungeon() });
    // rift — purple crystals, floating rocks, the tear
    const crys = [], floaters = [];
    for (let i = 0; i < 90; i++) { const a = rr() * 6.28, r = rr() * 110; const x = -250 + Math.cos(a) * r, z = 240 + Math.sin(a) * r; if (blocked(x, z)) continue; crys.push({ x, y: G.terrainH(x, z), z, s: 0.6 + rr() * 1.8, sy: 1 + rr() * 2, rx: (rr() - .5) * .6, rz: (rr() - .5) * .6 }); }
    instanced(new THREE.OctahedronGeometry(0.8, 0).translate(0, 0.8, 0), new THREE.MeshToonMaterial({ color: '#9b5cff', gradientMap: G.tex.toon, emissive: '#5a1aa8', emissiveIntensity: 0.8 }), crys, { shadow: true });
    for (let i = 0; i < 30; i++) { const a = rr() * 6.28, r = 20 + rr() * 80; const x = -250 + Math.cos(a) * r, z = 240 + Math.sin(a) * r; floaters.push({ x, y: G.terrainH(x, z) + 10 + rr() * 25, z, s: 1 + rr() * 3, rx: rr(), ry: rr() }); }
    instanced(new THREE.DodecahedronGeometry(1, 0), G.toon('#3a3048'), floaters, { shadow: true });
    const tear = new THREE.Mesh(new THREE.PlaneGeometry(14, 40), W.portalMat.clone()); tear.material.uniforms.c1.value = new THREE.Color('#1a0530'); tear.material.uniforms.c2.value = new THREE.Color('#b04fff');
    tear.position.set(-250, G.terrainH(-250, 240) + 22, 240); W.scene.add(tear); W.tear = tear;
    addWaystone(-200, 175, 'rift', 'ขอบรอยแยก');
    // lake crystals + Seren's camp
    for (let i = 0; i < 26; i++) { const a = rr() * 6.28; const r = 80 + rr() * 14; const x = -240 + Math.cos(a) * r, z = -160 + Math.sin(a) * r; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.7 + rr(), 0), new THREE.MeshToonMaterial({ color: '#9fefff', gradientMap: G.tex.toon, emissive: '#3aa8d8', emissiveIntensity: 0.6, transparent: true, opacity: .9 })); c.position.set(x, G.terrainH(x, z) + 0.8, z); c.scale.y = 2; c.rotation.z = (rr() - .5); W.scene.add(c); }
    const sx = D.NPCS.seren.pos[0], sz = D.NPCS.seren.pos[1]; const camp = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3, 6), G.toon('#e8e4f4')); camp.position.set(sx - 4, G.terrainH(sx - 4, sz - 3) + 1.5, sz - 3); camp.castShadow = true; W.scene.add(camp);
    W.campfire = new THREE.Vector3(sx + 2, G.terrainH(sx + 2, sz + 1) + 0.2, sz + 1);
    addWaystone(-190, -110, 'lake', 'ทะเลสาบผลึก');
    addWaystone(10, -170, 'mistwood', 'ป่าหมอกจันทรา');
    addWaystone(80, 40, 'meadow', 'ทุ่งกระซิบ');
    // mistwood shrine stones
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; const x = 0 + Math.cos(a) * 60, z = -260 + Math.sin(a) * 60; if (blocked(x, z)) continue; const m = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 0.6), G.toon('#6a7a6a')); m.position.set(x, G.terrainH(x, z) + 2, z); m.rotation.y = a; m.castShadow = true; W.scene.add(m); }
  }
  function arch(x, z, a) {
    const y = G.terrainH(x, z); const g = new THREE.Group(); const m = G.toon('#c0b8a6');
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), m); p.position.set(s * 3, 3, 0); p.castShadow = true; g.add(p); }
    const t = new THREE.Mesh(new THREE.TorusGeometry(3, 0.6, 6, 12, Math.PI), m); t.position.y = 6; t.castShadow = true; g.add(t);
    g.position.set(x, y, z); g.rotation.y = a; g.rotation.z = (Math.random() - .5) * 0.15; W.scene.add(g);
  }

  // ---------- dungeon arena (separate realm) ----------
  function buildDungeon() {
    const o = D.DUNGEON.origin; const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(42, 44, 2, 48), G.toon('#3a3448')); floor.position.y = -1; floor.receiveShadow = true; g.add(floor);
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: G.tex.runeDark, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); rune.rotation.x = -Math.PI / 2; rune.position.set(0, 0.05, -10); g.add(rune); W.dgRune = rune;
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; const p = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 14, 8), G.toon('#4a4058')); p.position.set(Math.cos(a) * 40, 7, Math.sin(a) * 40); p.castShadow = true; g.add(p);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: '#b06fff', blending: THREE.AdditiveBlending, depthWrite: false })); fl.scale.setScalar(3); fl.position.set(Math.cos(a) * 38, 9, Math.sin(a) * 38); g.add(fl); }
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 30, 48, 1, true), G.toon('#241c34', { side: THREE.BackSide })); wall.position.y = 14; g.add(wall);
    g.position.set(o.x, 0, o.z); W.scene.add(g);
    const pl = new THREE.PointLight('#a06fff', 1.4, 90); pl.position.set(o.x, 16, o.z - 8); W.scene.add(pl);
    const ex = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), W.portalMat); ex.position.set(o.x, 2.5, o.z + 30); W.scene.add(ex);
    W.interact.push({ type: 'dgexit', x: o.x, z: o.z + 30, r: 3.5, label: 'ออกจากดันเจี้ยน', act: () => G.net.send({ t: 'dgLeave' }) });
  }

  // ---------- gathering nodes ----------
  function buildGather() {
    const rr = G.seeded(555); const mats = {
      herb: () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.8, 4), new THREE.MeshToonMaterial({ color: '#8fffb0', gradientMap: G.tex.toon, emissive: '#2aa860', emissiveIntensity: .6 })); l.position.set(Math.cos(i) * .2, .4, Math.sin(i) * .2); l.rotation.z = Math.cos(i) * .4; g.add(l); } return g; },
      flower: () => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), G.toon(G.pick(['#ffd6ec', '#fff3a8', '#ffb3c7']))); f.position.set(Math.cos(i * 1.6) * .3, .45, Math.sin(i * 1.6) * .3); g.add(f); const s = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .45, 3), G.toon('#4a9a4a')); s.position.copy(f.position); s.position.y = .22; g.add(s); } return g; },
      ore: () => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), G.toon('#8a8478')); r.position.y = .5; g.add(r); for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), G.toon('#d0a070', { emissive: new THREE.Color('#704010'), emissiveIntensity: .4 })); c.position.set(Math.cos(i * 1.5) * .6, .7 + (i % 2) * .3, Math.sin(i * 1.5) * .6); g.add(c); } return g; },
      wood: () => { const g = new THREE.Group(); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 2.2, 8), G.toon('#7a5236')); l.rotation.z = Math.PI / 2; l.position.y = .35; g.add(l); return g; },
      crystal: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshToonMaterial({ color: '#9fefff', gradientMap: G.tex.toon, emissive: '#3aa8ff', emissiveIntensity: .9 })); c.scale.y = 2.2; c.position.set((i - 1) * .35, .7, 0); c.rotation.z = (i - 1) * .3; g.add(c); } return g; }
    };
    for (const [type, def] of Object.entries(D.GATHER)) {
      let made = 0, tries = 0;
      while (made < def.count && tries++ < 2000) {
        const zid = def.zones[Math.floor(rr() * def.zones.length)]; const zn = D.ZONES.find(z => z.id === zid); const a = rr() * 6.28, r = Math.sqrt(rr()) * zn.r * 0.9; const x = zn.cx + Math.cos(a) * r, z = zn.cz + Math.sin(a) * r;
        if (blocked(x, z)) continue; const m = mats[type](); m.position.set(x, G.terrainH(x, z), z); m.rotation.y = rr() * 6; m.traverse(o => { if (o.isMesh) o.castShadow = true; }); W.scene.add(m);
        const node = { type, def, x, z, mesh: m, ready: true, respawn: 0 }; W.gather.push(node);
        W.interact.push({ type: 'gather', node, x, z, r: 2.4, get label() { return node.ready ? 'เก็บ ' + def.name : null; }, act: () => G.player.startGather(node) }); made++;
      }
    }
  }

  W.build = function () {
    buildSky(); buildTerrain(); buildVegetation(); buildVillage(); buildLandmarks(); buildDungeon(); buildGather();
    G.puzzles.build(W);
  };

  // collision/ground: terrain, water surface, platforms (puzzles) & house roofs
  W.groundAt = function (x, z, y) {
    let h = G.terrainH(x, z), plat = null;
    if (h < G.WATER_Y - 0.9) h = G.WATER_Y - 0.9;
    for (const p of W.platforms) {
      if (p.solid) continue;
      if (Math.abs(x - p.x) <= p.hw && Math.abs(z - p.z) <= p.hd && p.top <= y + 0.6 && p.top > h) { h = p.top; plat = p; }
    }
    return { h, plat };
  };
  // push out of solid boxes (houses)
  W.collide = function (pos) {
    for (const p of W.platforms) {
      if (!p.solid) continue; const dx = pos.x - p.x, dz = pos.z - p.z;
      const c = Math.cos(p.ry), s = Math.sin(p.ry); const lx = c * dx - s * dz, lz = s * dx + c * dz;
      if (Math.abs(lx) < p.hw && Math.abs(lz) < p.hd && pos.y < p.top) {
        const ox = p.hw - Math.abs(lx), oz = p.hd - Math.abs(lz); let nx = lx, nz = lz;
        if (ox < oz) nx = Math.sign(lx) * p.hw; else nz = Math.sign(lz) * p.hd;
        pos.x = p.x + c * nx + s * nz; pos.z = p.z - s * nx + c * nz;
      }
    }
  };

  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  W.update = function (dt, ppos) {
    W.time += dt; W.dayT = (W.dayT + dt / 1200) % 1; // 20-minute day
    const ang = W.dayT * Math.PI * 2 - Math.PI / 2; const sunY = Math.sin(ang); const day = G.smooth(-0.15, 0.25, sunY); W.night = 1 - day;
    const dark = G.darkness(ppos.x, ppos.z); W.dark = G.damp(W.dark || 0, dark, 1.5, dt);
    const sd = new THREE.Vector3(Math.cos(ang) * 0.8, sunY, 0.45).normalize();
    W.sun.position.set(ppos.x + sd.x * 120, ppos.y + Math.max(sd.y, 0.25) * 120, ppos.z + sd.z * 120); W.sun.target.position.copy(ppos);
    W.sun.intensity = (0.2 + day * 0.85) * (1 - W.dark * 0.55); W.sun.color.set(day > 0.5 ? '#fff2d8' : '#ffb98a').lerp(tmpC.set('#9fb4ff'), W.night);
    W.hemi.intensity = (0.3 + day * 0.3) * (1 - W.dark * 0.35); W.hemi.color.set('#dfefff').lerp(tmpC.set('#6a6aaa'), W.night);
    const top = tmpC.set('#5fa0ff').lerp(tmpC2.set('#0a0d2a'), W.night); W.skyMat.uniforms.top.value.copy(top);
    const hor = tmpC.set('#ffe6f0').lerp(tmpC2.set(sunY > -0.1 && sunY < 0.25 ? '#ff9a6a' : '#1a1a3a'), W.night * 0.95); W.skyMat.uniforms.hor.value.copy(hor);
    W.skyMat.uniforms.sunDir.value.copy(sd); W.skyMat.uniforms.dark.value = W.dark;
    W.sky.position.copy(ppos); W.stars.position.copy(ppos); W.stars.material.opacity = W.night; W.stars.visible = W.night > 0.05;
    W.moon.position.set(ppos.x - sd.x * 1300, ppos.y - sd.y * 1300 + 100, ppos.z - sd.z * 1300); W.moon.visible = W.night > 0.2;
    const fog = tmpC.copy(hor).lerp(tmpC2.set('#9fb8e8'), 0.45 * (1 - W.night)).lerp(tmpC2.set('#2a1a40'), W.dark * 0.85); W.scene.fog.color.copy(fog);
    W.scene.fog.near = G.lerp(110, 12, W.dark); W.scene.fog.far = G.lerp(ppos.x > 2000 ? 200 : 460, 140, W.dark);
    W.ambient.intensity = 0.15 + W.night * 0.25; W.renderer.toneMappingExposure = 1.05 - W.dark * 0.1;
    for (const l of W.lamps) { if (l.glow) { l.glow.visible = W.night > 0.25 || W.dark > 0.3; l.glow.material.opacity = W.night; l.bulbM.color.set(W.night > 0.4 ? '#ffe0a0' : '#9a8a6a'); } else l.color.set(W.night > 0.4 ? '#ffe8a0' : '#7a8aa0'); }
    // water ripple
    W.waterMat.emissiveIntensity = 0.2 + Math.sin(W.time) * 0.05;
    if (W.portalMat) W.portalMat.uniforms.t.value = W.time; if (W.tear) { W.tear.material.uniforms.t.value = W.time * 0.7; W.tear.lookAt(G.world.camera.position.x, W.tear.position.y, G.world.camera.position.z); }
    if (W.dgRune) W.dgRune.rotation.z += dt * 0.2;
    for (const ws of W.waystones) { ws.cry.rotation.y += dt; ws.cry.position.y = 2.4 + Math.sin(W.time * 2) * 0.2; ws.rune.rotation.z += dt * 0.4; }
    // fountain sparkles + campfire
    if (Math.random() < 0.5) G.fx.emit(G.rand(-2, 2), W.fountain.position.y + 0.6, G.rand(-2, 2), { vy: 3, vx: G.rand(-1, 1), vz: G.rand(-1, 1), grav: 6, life: 0.9, size: 0.4, color: '#bfefff' });
    if (W.campfire && G.dist(ppos.x, ppos.z, W.campfire.x, W.campfire.z) < 80) G.fx.emit(W.campfire.x + G.rand(-.3, .3), W.campfire.y, W.campfire.z + G.rand(-.3, .3), { vy: 2.5, life: 0.8, size: 0.8, color: Math.random() < .5 ? '#ff9a3a' : '#ffd27a' });
    // gathering respawn
    for (const n of W.gather) if (!n.ready) { n.respawn -= dt; if (n.respawn <= 0) { n.ready = true; n.mesh.visible = true; } }
    else if (n.type === 'crystal' || n.type === 'herb') { if (Math.random() < 0.02 && G.dist(ppos.x, ppos.z, n.x, n.z) < 60) G.fx.emit(n.x, n.mesh.position.y + 1, n.z, { vy: 0.8, life: 1.5, size: 0.4, color: n.type === 'herb' ? '#9fffb0' : '#9fefff' }); }
    G.puzzles.update(dt, ppos);
  };
})();
