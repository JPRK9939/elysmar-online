/* Stylised MOBA-like particle & spell effects (additive glows, ground runes, slashes, beams, projectiles) */
(function () {
  const F = G.fx = { list: [], projs: [], nums: [] };
  const MAX = 6000;
  let geo, pos, col, size, alpha, pts, P = [], free = [];

  F.init = function (scene) {
    F.scene = scene;
    geo = new THREE.BufferGeometry();
    pos = new Float32Array(MAX * 3); col = new Float32Array(MAX * 3); size = new Float32Array(MAX); alpha = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1)); geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: G.tex.glow } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*(320.0/-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC*t.rgb*1.4, t.a*vA); }'
    });
    pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 10; scene.add(pts);
    for (let i = 0; i < MAX; i++) { P.push({ life: 0 }); free.push(MAX - 1 - i); alpha[i] = 0; size[i] = 0; }
    F.ringGeo = new THREE.PlaneGeometry(1, 1); F.ringGeo.rotateX(-Math.PI / 2);
  };
  const tmpC = new THREE.Color();
  F.emit = function (x, y, z, o) {
    if (!free.length) return; const i = free.pop(); const p = P[i];
    p.x = x; p.y = y; p.z = z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.life = p.max = o.life || 1;
    p.s0 = o.size || 1; p.s1 = o.size1 !== undefined ? o.size1 : 0; p.g = o.grav || 0; p.drag = o.drag || 0;
    tmpC.set(o.color || '#fff'); p.r = tmpC.r; p.gg = tmpC.g; p.b = tmpC.b; p.a = o.alpha || 1;
  };
  F.burst = function (v, o) {
    o = o || {}; const n = o.n || 20, sp = o.speed || 5, c1 = new THREE.Color(o.color || '#fff'), c2 = new THREE.Color(o.color2 || o.color || '#fff');
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, e = (o.flat ? Math.random() * 0.3 : Math.random() * Math.PI) - (o.flat ? 0 : Math.PI / 2) * (o.up ? -0 : 1);
      const s = sp * (0.4 + Math.random() * 0.6);
      const vy = o.up ? Math.abs(Math.sin(e)) * s + (o.upBias || 0) : Math.sin(e) * s;
      tmpC.copy(c1).lerp(c2, Math.random());
      F.emit(v.x + (Math.random() - .5) * (o.spread || 0), v.y + (Math.random() - .5) * (o.spread || 0), v.z + (Math.random() - .5) * (o.spread || 0),
        { vx: Math.cos(a) * Math.cos(e) * s, vy, vz: Math.sin(a) * Math.cos(e) * s, life: (o.life || 0.8) * (0.6 + Math.random() * 0.6), size: (o.size || 1) * (0.6 + Math.random() * 0.8), size1: o.size1, grav: o.grav, drag: o.drag || 2, color: '#' + tmpC.getHexString() });
    }
  };
  F.column = function (v, o) {
    o = o || {}; for (let k = 0; k < (o.n || 40); k++) {
      const a = Math.random() * 6.28, r = Math.random() * (o.radius || 1);
      F.emit(v.x + Math.cos(a) * r, v.y + Math.random() * 0.5, v.z + Math.sin(a) * r, { vy: (o.speed || 4) * (0.5 + Math.random()), life: o.life || 1.2, size: o.size || 0.8, color: Math.random() < .5 ? o.color : (o.color2 || o.color), drag: 0.5 });
    }
  };
  // ground decal: expanding ring / rotating rune circle
  F.decal = function (v, o) {
    const mat = new THREE.MeshBasicMaterial({ map: o.tex || G.tex.ring, color: new THREE.Color(o.color || '#fff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(F.ringGeo, mat); m.position.set(v.x, (v.y || 0) + 0.08, v.z); m.renderOrder = 9; F.scene.add(m);
    F.list.push({ m, t: 0, life: o.life || 0.6, r0: o.r0 !== undefined ? o.r0 : 0.2, r1: o.radius || 4, spin: o.spin || 0, hold: o.hold || 0, follow: o.follow });
    return m;
  };
  F.ring = (v, o) => F.decal(v, Object.assign({ tex: G.tex.ring }, o));
  F.rune = (v, o) => F.decal(v, Object.assign({ tex: G.tex.rune, r0: (o && o.radius) || 3, spin: 2, hold: 0.7 }, o));
  // crescent slash
  F.slash = function (v, yaw, o) {
    o = o || {}; const r = o.radius || 2.6;
    const g = new THREE.RingGeometry(r * 0.55, r, 24, 1, -Math.PI * 0.45, Math.PI * (o.arc || 0.9));
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color || '#cfefff'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g, mat); m.rotation.order = 'YXZ'; m.rotation.y = yaw + Math.PI / 2 * 0 ; m.rotation.x = -Math.PI / 2 + (o.tilt || 0.25);
    const holder = new THREE.Group(); holder.position.set(v.x, v.y + (o.h || 1.1), v.z); holder.rotation.y = yaw - Math.PI / 2; holder.add(m);
    m.rotation.set(-Math.PI / 2 + (o.tilt || 0.2), 0, 0);
    F.scene.add(holder); F.list.push({ m: holder, mesh: m, t: 0, life: o.life || 0.25, slash: true, sweep: o.sweep || 3 });
  };
  F.beam = function (a, b, o) {
    o = o || {}; const len = a.distanceTo(b); const g = new THREE.CylinderGeometry(o.width || 0.35, o.width || 0.35, len, 10, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, len / 2);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color || '#fff'), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(g, mat); m.position.copy(a); m.lookAt(b); F.scene.add(m);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry((o.width || .35) * .4, (o.width || .35) * .4, len, 8, 1, true).rotateX(Math.PI / 2).translate(0, 0, len / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.add(inner);
    F.list.push({ m, t: 0, life: o.life || 0.45, beam: true });
    for (let k = 0; k < 30; k++) { const t = Math.random(); F.emit(G.lerp(a.x, b.x, t), G.lerp(a.y, b.y, t), G.lerp(a.z, b.z, t), { vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3, vz: (Math.random() - .5) * 3, life: .6, size: .7, color: o.color }); }
  };
  F.pillar = function (v, o) {
    o = o || {}; const g = new THREE.CylinderGeometry(o.radius || 1, o.radius || 1, o.height || 8, 20, 1, true); g.translate(0, (o.height || 8) / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color || '#fff6a0'), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(g, mat); m.position.copy(v); F.scene.add(m); F.list.push({ m, t: 0, life: o.life || 1.2, pillar: true });
    F.column(v, { color: o.color || '#fff6a0', color2: '#ffffff', radius: o.radius || 1, n: 50, speed: 5 });
  };
  F.projectile = function (from, target, o) {
    o = o || {}; const mat = new THREE.SpriteMaterial({ map: G.tex.glow, color: new THREE.Color(o.color || '#ffb347'), blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat); s.scale.setScalar(o.size || 0.9); s.position.copy(from); F.scene.add(s);
    let core = null; if (o.arrow) { core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })); s.add(core); s.scale.setScalar(0.45); }
    F.projs.push({ s, target, speed: o.speed || 26, color: o.color || '#ffb347', onHit: o.onHit, t: 0, trail: o.trail !== false, arc: o.arc || 0, start: from.clone() });
  };
  F.number = function (v, text, cls) {
    const el = document.createElement('div'); el.className = 'dmg ' + (cls || ''); el.textContent = text; document.getElementById('dmg-layer').appendChild(el);
    F.nums.push({ el, x: v.x + (Math.random() - .5) * .6, y: v.y, z: v.z + (Math.random() - .5) * .6, t: 0, life: cls === 'exp' ? 1.6 : 1.0, vx: (Math.random() - .5) * 40 });
  };
  F.shake = 0;
  F.doShake = a => { F.shake = Math.max(F.shake, a); };

  const tv = new THREE.Vector3();
  F.update = function (dt, cam) {
    // particles
    for (let i = 0; i < MAX; i++) {
      const p = P[i]; if (p.life <= 0) continue;
      p.life -= dt; if (p.life <= 0) { alpha[i] = 0; size[i] = 0; free.push(i); continue; }
      const k = Math.exp(-p.drag * dt); p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = 1 - p.life / p.max; pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      col[i * 3] = p.r; col[i * 3 + 1] = p.gg; col[i * 3 + 2] = p.b;
      size[i] = G.lerp(p.s0, p.s1 * p.s0, t); alpha[i] = p.a * (t < .1 ? t * 10 : 1 - Math.pow(t, 2));
    }
    geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = geo.attributes.alpha.needsUpdate = true;
    // meshes
    for (let i = F.list.length - 1; i >= 0; i--) {
      const e = F.list[i]; e.t += dt; const t = e.t / e.life;
      if (t >= 1) { F.scene.remove(e.m); e.m.traverse(o => { if (o.geometry && o.geometry !== F.ringGeo) o.geometry.dispose(); if (o.material) o.material.dispose(); }); F.list.splice(i, 1); continue; }
      if (e.slash) { e.mesh.material.opacity = 1 - t; e.mesh.rotation.z = -t * e.sweep * 0.3; e.m.scale.setScalar(1 + t * 0.4); }
      else if (e.beam) { e.m.children[0].material.opacity = e.m.material.opacity = 1 - t; const s = 1 + t * 1.5; e.m.scale.set(1 - t * .7, 1 - t * .7, 1); }
      else if (e.pillar) { e.m.material.opacity = 0.5 * (1 - t); e.m.scale.set(1 - t * 0.5, 1 + t * 0.3, 1 - t * 0.5); }
      else {
        if (e.follow) { e.m.position.x = e.follow.x; e.m.position.z = e.follow.z; e.m.position.y = e.follow.y + 0.08; }
        const grow = e.hold ? G.smooth(0, 0.2, t) : t; const r = G.lerp(e.r0, e.r1, Math.min(1, grow * (e.hold ? 1 : 1)));
        e.m.scale.set(r * 2, 1, r * 2); e.m.rotation.y += e.spin * dt;
        e.m.material.opacity = e.hold ? (t < e.hold ? 1 : 1 - (t - e.hold) / (1 - e.hold)) : 1 - t;
      }
    }
    // projectiles
    for (let i = F.projs.length - 1; i >= 0; i--) {
      const p = F.projs[i]; p.t += dt; const tgt = typeof p.target === 'function' ? p.target() : p.target;
      if (!tgt) { F.scene.remove(p.s); F.projs.splice(i, 1); continue; }
      tv.copy(tgt).sub(p.s.position); const d = tv.length();
      if (d < 0.6 || p.t > 3) { F.scene.remove(p.s); F.projs.splice(i, 1); p.onHit && p.onHit(p.s.position.clone()); continue; }
      tv.normalize().multiplyScalar(Math.min(d, p.speed * dt)); p.s.position.add(tv);
      if (p.arc) p.s.position.y += Math.sin(Math.min(1, p.t * 2) * Math.PI) * p.arc * dt * 6;
      if (p.s.children[0]) p.s.children[0].lookAt(tgt);
      if (p.trail) F.emit(p.s.position.x, p.s.position.y, p.s.position.z, { life: .35, size: .7, color: p.color, vx: (Math.random() - .5), vy: (Math.random() - .5), vz: (Math.random() - .5) });
    }
    // floating numbers
    const W = innerWidth, H = innerHeight;
    for (let i = F.nums.length - 1; i >= 0; i--) {
      const n = F.nums[i]; n.t += dt; if (n.t > n.life) { n.el.remove(); F.nums.splice(i, 1); continue; }
      tv.set(n.x, n.y + 1.8 + n.t * 1.4, n.z).project(cam);
      if (tv.z > 1) { n.el.style.display = 'none'; continue; } n.el.style.display = '';
      n.el.style.left = ((tv.x + 1) / 2 * W + n.vx * n.t) + 'px'; n.el.style.top = ((1 - tv.y) / 2 * H) + 'px';
      n.el.style.opacity = 1 - Math.pow(n.t / n.life, 3); n.el.style.transform = `translate(-50%,-50%) scale(${n.t < .12 ? 1 + (0.12 - n.t) * 6 : 1})`;
    }
    F.shake = Math.max(0, F.shake - dt * 3);
  };
  // ambient motes (fireflies by day/night, dark miasma in the veil)
  F.ambient = function (center, dark, night) {
    if (Math.random() < 0.35 + night * 0.5) {
      const a = Math.random() * 6.28, r = 4 + Math.random() * 30;
      const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r, y = G.terrainH(x, z) + 0.5 + Math.random() * 3;
      if (dark > 0.3 && Math.random() < dark) F.emit(x, y, z, { vy: 0.6, vx: (Math.random() - .5) * .5, life: 3, size: 1.6, color: Math.random() < .5 ? '#6a3cc0' : '#2a1550', alpha: 0.7 });
      else F.emit(x, y, z, { vy: 0.15, vx: (Math.random() - .5) * .6, vz: (Math.random() - .5) * .6, life: 3, size: 0.35, color: night > 0.5 ? '#c8ff8a' : '#fff6cc', alpha: 0.9 });
    }
  };
})();
