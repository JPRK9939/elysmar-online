/* World puzzles: jump courses (incl. moving platforms), brazier order, rune memory (simon), wind ring time-trial, shade lantern rush */
(function () {
  const PZ = G.puzzles = { list: {}, active: null };
  const D = G.D;
  const stoneM = () => G.toon('#c9c2d8'), glowM = c => new THREE.MeshToonMaterial({ color: c, gradientMap: G.tex.toon, emissive: c, emissiveIntensity: 0.6 });

  function plat(W, x, y, z, w, d, opts) {
    opts = opts || {}; const h = opts.h || 0.6;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.mat || stoneM()); m.position.set(x, y - h / 2, z); m.castShadow = m.receiveShadow = true; W.scene.add(m);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.08, d + 0.1), glowM(opts.rim || '#8fe8ff')); rim.position.y = h / 2; m.add(rim);
    const p = { x, z, y0: y, top: y, hw: w / 2, hd: d / 2, mesh: m, move: opts.move, h, t: 0 }; W.platforms.push(p); return p;
  }
  function chest(W, x, y, z, id) {
    const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), G.toon('#a0642a')); b.position.y = 0.4; g.add(b);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.3, 0.85), G.toon('#c9a04a')); lid.position.y = 0.95; g.add(lid);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: '#ffd77a', blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(3); gl.position.y = 1; g.add(gl);
    g.position.set(x, y, z); W.scene.add(g); g.userData.glow = gl; return g;
  }
  const ready = id => { const s = G.S && G.S.puzzles[id]; return !s || Date.now() > s.until; };
  const cdLeft = id => { const s = G.S.puzzles[id]; return s ? Math.max(0, Math.ceil((s.until - Date.now()) / 1000)) : 0; };
  PZ.ready = ready; PZ.cdLeft = cdLeft;
  function complete(id) { G.game.completePuzzle(id); }

  PZ.build = function (W) {
    // ===== 1. Sky Steps (medium jump course) =====
    {
      const [cx, cz] = D.PUZZLES.sky_steps.pos; const by = G.terrainH(cx, cz); const steps = [];
      for (let i = 0; i < 14; i++) { const a = i * 0.62, r = 7 + (i % 3) * 0.6; steps.push([cx + Math.cos(a) * r, by + 1.4 + i * 1.25, cz + Math.sin(a) * r]); }
      steps.forEach(([x, y, z], i) => plat(W, x, y, z, i % 4 === 3 ? 1.8 : 2.6, i % 4 === 3 ? 1.8 : 2.6));
      const top = plat(W, cx, by + 19.5, cz, 5.2, 5.2, { rim: '#ffd77a' }); const c = chest(W, cx, top.top, cz);
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 18, 8), stoneM()); pil.position.set(cx, by + 9.5, cz); W.scene.add(pil);
      PZ.list.sky_steps = { chest: c, cx, cz, top: top.top };
      W.interact.push({ type: 'puzzle', x: cx, z: cz, y: top.top, r: 2.6, needY: true, get label() { return ready('sky_steps') ? 'เปิดหีบสมบัติ' : 'หีบว่างเปล่า (รีเซ็ตใน ' + cdLeft('sky_steps') + ' วิ)'; }, act: () => { if (ready('sky_steps')) complete('sky_steps'); } });
      sign(W, cx + 9, cz + 2, 'บันไดฟ้า · ปานกลาง');
    }
    // ===== 2. Ruined Spire (challenge: small + moving platforms) =====
    {
      const [cx, cz] = D.PUZZLES.ruined_spire.pos; const by = G.terrainH(cx, cz); let y = by + 1.6; let x = cx - 10, z = cz;
      const path = [];
      for (let i = 0; i < 18; i++) {
        const mv = i % 3 === 2 ? { axis: i % 2 ? 'x' : 'z', amp: 3 + (i % 4), speed: 0.9 + i * 0.04 } : null;
        const a = i * 0.55; x = cx + Math.cos(a) * (8 + Math.sin(i) * 1.2); z = cz + Math.sin(a) * (8 + Math.sin(i) * 1.2);
        path.push(plat(W, x, y, z, i > 10 ? 1.5 : 2.0, i > 10 ? 1.5 : 2.0, { move: mv ? { ...mv, amp: Math.min(mv.amp, 2.5) } : null, rim: mv ? '#ff9a6a' : '#c58cff' })); y += 1.4;
      }
      const tx = cx + (x - cx) * 0.45, tz = cz + (z - cz) * 0.45;
      const top = plat(W, tx, y + 0.4, tz, 3.4, 3.4, { rim: '#ffd77a' }); const c = chest(W, tx, top.top, tz);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, y - by, 10), G.toon('#8a8272')); tower.position.set(cx, by + (y - by) / 2 - 2, cz); W.scene.add(tower);
      PZ.list.ruined_spire = { chest: c };
      W.interact.push({ type: 'puzzle', x: tx, z: tz, y: top.top, r: 2.2, needY: true, get label() { return ready('ruined_spire') ? 'เปิดหีบแห่งยอดหอคอย' : 'หีบว่างเปล่า (' + cdLeft('ruined_spire') + ' วิ)'; }, act: () => { if (ready('ruined_spire')) complete('ruined_spire'); } });
      sign(W, cx - 13, cz + 3, 'ยอดหอคอยพังทลาย · ท้าทาย');
    }
    // ===== 3. Braziers (order puzzle) =====
    {
      const [cx, cz] = D.PUZZLES.braziers.pos; const dirs = [['E', 1, 0], ['N', 0, -1], ['W', -1, 0], ['S', 0, 1]]; const order = ['E', 'N', 'W', 'S'];
      const st = PZ.list.braziers = { seq: [], br: {} };
      for (const [k, dx, dz] of dirs) {
        const x = cx + dx * 9, z = cz + dz * 9, y = G.terrainH(x, z); const g = new THREE.Group();
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.7, 10), G.toon('#5a5060')); bowl.position.y = 1.5; g.add(bowl);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 1.2, 6), G.toon('#4a4050')); leg.position.y = 0.6; g.add(leg);
        const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.tex.glow, color: '#ff9a3a', blending: THREE.AdditiveBlending, depthWrite: false })); fl.scale.setScalar(2.5); fl.position.y = 2.2; fl.visible = false; g.add(fl);
        g.position.set(x, y, z); W.scene.add(g); st.br[k] = { fl, x, y, z, lit: false };
        const label = { E: 'ตะวันออก', N: 'เหนือ', W: 'ตะวันตก', S: 'ใต้' }[k];
        W.interact.push({ type: 'puzzle', x, z, r: 2.4, get label() { return ready('braziers') ? (st.br[k].lit ? null : 'จุดไฟเตาทิศ' + label) : null; }, act: () => {
          if (!ready('braziers') || st.br[k].lit) return; st.br[k].lit = true; st.br[k].fl.visible = true; st.seq.push(k); G.audio.sfx('fire'); G.fx.burst(new THREE.Vector3(x, y + 2, z), { n: 30, color: '#ff9a3a', color2: '#ffe27a', up: true, speed: 4 });
          const okSoFar = st.seq.every((v, i) => v === order[i]);
          if (!okSoFar) { G.ui.note('ลำดับผิด... เปลวไฟดับลง', 'red'); G.audio.sfx('bad'); setTimeout(() => { st.seq = []; for (const b of Object.values(st.br)) { b.lit = false; b.fl.visible = false; } }, 700); }
          else if (st.seq.length === 4) { complete('braziers'); setTimeout(() => { st.seq = []; for (const b of Object.values(st.br)) { b.lit = false; b.fl.visible = false; } }, 4000); }
        } });
      }
      const tab = tablet(W, cx, cz, '#ffb36a');
      W.interact.push({ type: 'puzzle', x: cx, z: cz, r: 2.5, label: 'อ่านจารึก', act: () => G.ui.dialogSimple('จารึกโบราณ', D.PUZZLES.braziers.hint + '<br><span class="muted small">จุดไฟเตาทั้งสี่ตามลำดับที่ถูกต้อง</span>') });
    }
    // ===== 4. Rune memory (simon says) =====
    {
      const [cx, cz] = D.PUZZLES.rune_memory.pos; const cols = ['#ff6b8a', '#6bd8ff', '#9fff7a', '#ffd76b'];
      const st = PZ.list.rune_memory = { stones: [], seq: [], input: [], showing: false, round: 0, active: false };
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + Math.PI / 4; const x = cx + Math.cos(a) * 6, z = cz + Math.sin(a) * 6, y = G.terrainH(x, z);
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 0.5), new THREE.MeshToonMaterial({ color: '#5a5870', gradientMap: G.tex.toon, emissive: cols[i], emissiveIntensity: 0.05 }));
        m.position.set(x, y + 1.3, z); m.lookAt(cx, y + 1.3, cz); m.castShadow = true; W.scene.add(m); st.stones.push({ m, c: cols[i], x, y, z });
        W.interact.push({ type: 'puzzle', x, z, r: 2.3, get label() { return st.active && !st.showing ? 'แตะหินรูน' : null; }, act: () => press(i) });
      }
      tablet(W, cx, cz, '#6bd8ff');
      W.interact.push({ type: 'puzzle', x: cx, z: cz, r: 2.5, get label() { return st.active ? null : ready('rune_memory') ? 'เริ่มปริศนาหินรูน (จำลำดับแสง)' : 'หินรูนหลับใหล (' + cdLeft('rune_memory') + ' วิ)'; }, act: () => { if (!st.active && ready('rune_memory')) start(); } });
      const flash = i => { const s = st.stones[i]; s.m.material.emissiveIntensity = 1.2; G.audio.sfx('ding'); G.fx.burst(new THREE.Vector3(s.x, s.y + 2.5, s.z), { n: 14, color: s.c, speed: 3 }); setTimeout(() => s.m.material.emissiveIntensity = 0.05, 380); };
      const show = () => { st.showing = true; st.input = []; st.seq.forEach((v, k) => setTimeout(() => flash(v), 700 + k * 650)); setTimeout(() => { st.showing = false; G.ui.center('ถึงตาคุณ!', `รอบ ${st.round}/${3}`); }, 700 + st.seq.length * 650); };
      const start = () => { st.active = true; st.round = 1; st.seq = [0, 1, 2].map(() => Math.floor(Math.random() * 4)); G.ui.center('หินรูนแห่งความทรงจำ', 'จำลำดับแสงให้ดี'); show(); };
      const press = i => {
        if (!st.active || st.showing) return; flash(i); st.input.push(i); const k = st.input.length - 1;
        if (st.input[k] !== st.seq[k]) { G.ui.note('ผิดลำดับ! ปริศนารีเซ็ต', 'red'); G.audio.sfx('bad'); st.active = false; return; }
        if (st.input.length === st.seq.length) { if (st.round >= 3) { st.active = false; complete('rune_memory'); } else { st.round++; st.seq.push(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)); setTimeout(show, 800); } }
      };
    }
    // ===== 5. Wind rings (time trial) =====
    {
      const [cx, cz] = D.PUZZLES.wind_rings.pos; const rr = G.seeded(77); const rings = [];
      for (let i = 0; i < 10; i++) { const a = i * 0.75, r = 14 + i * 3; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; const y = G.terrainH(x, z) + 1.8 + (i % 3) * 1.2;
        const m = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 24), new THREE.MeshBasicMaterial({ color: '#9fffe0', transparent: true, opacity: 0.85 })); m.position.set(x, y, z); m.rotation.y = a; m.visible = false; W.scene.add(m); rings.push({ m, x, y, z, hit: false }); }
      const st = PZ.list.wind_rings = { rings, active: false, t: 0, idx: 0 };
      const y = G.terrainH(cx, cz); const totem = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3, 6), glowM('#5fe8c8')); totem.position.set(cx, y + 1.5, cz); W.scene.add(totem);
      W.interact.push({ type: 'puzzle', x: cx, z: cz, r: 2.6, get label() { return st.active ? null : ready('wind_rings') ? 'เริ่มวงแหวนสายลม (ผ่าน 10 วงใน ' + D.PUZZLES.wind_rings.time + ' วิ)' : 'สายลมสงบ (' + cdLeft('wind_rings') + ' วิ)'; },
        act: () => { if (st.active || !ready('wind_rings')) return; st.active = true; st.t = D.PUZZLES.wind_rings.time; st.idx = 0; rings.forEach(r => { r.hit = false; r.m.visible = true; r.m.material.color.set('#9fffe0'); }); rings[0].m.material.color.set('#ffd77a'); G.ui.center('วงแหวนสายลม', 'วิ่งผ่านวงแหวนสีทองตามลำดับ!'); G.audio.sfx('puzzle'); } });
    }
    // ===== 6. Shade lanterns (hit all three within 5s) =====
    {
      const [cx, cz] = D.PUZZLES.shade_lanterns.pos; const st = PZ.list.shade_lanterns = { lan: [], t: 0 };
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const x = cx + Math.cos(a) * 14, z = cz + Math.sin(a) * 14; const y = G.terrainH(x, z) + 3.5 + i * 2;
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), glowM('#6a3cc0')); m.position.set(x, y, z); W.scene.add(m);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, y - G.terrainH(x, z), 5), G.toon('#2a2038')); pole.position.set(x, (y + G.terrainH(x, z)) / 2 - 0.5, z); W.scene.add(pole);
        st.lan.push({ m, x, y, z, lit: 0 }); }
      tablet(W, cx, cz, '#c58cff');
      W.interact.push({ type: 'puzzle', x: cx, z: cz, r: 2.5, label: 'อ่านจารึกในความมืด', act: () => G.ui.dialogSimple('จารึกในความมืด', '"จุดตะเกียงทั้งสามด้วยการโจมตี ภายในห้าลมหายใจ"<br><span class="muted small">โจมตีตะเกียงด้วยอาวุธระยะไกลหรือเวทมนตร์ (คลิกที่ตะเกียง) · ' + (ready('shade_lanterns') ? 'พร้อม' : 'รีเซ็ตใน ' + cdLeft('shade_lanterns') + ' วิ') + '</span>') });
    }
  };
  function tablet(W, x, z, c) {
    const y = G.terrainH(x, z); const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.4), G.toon('#7a7488')); m.position.set(x, y + 1.1, z); m.castShadow = true; W.scene.add(m);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: G.tex.rune, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.set(x, y + 0.1, z); W.scene.add(r);
    return m;
  }
  function sign(W, x, z, text) { W.interact.push({ type: 'sign', x, z, r: 2.5, label: '📜 ' + text, act: () => G.ui.note(text + ' — กระโดดด้วย Space · ไปให้ถึงหีบบนยอด!') }); const y = G.terrainH(x, z); const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.1), G.toon('#a0784a')); p.position.set(x, y + 1.4, z); W.scene.add(p); const s = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.4, 4), G.toon('#6b4a2b')); s.position.set(x, y + .7, z); W.scene.add(s); }

  // called by combat when a projectile / swing lands on a lantern
  PZ.tryHitLantern = function (pos) {
    const st = PZ.list.shade_lanterns; if (!st || !ready('shade_lanterns')) return false; let hit = false;
    for (const l of st.lan) if (l.lit <= 0 && Math.hypot(pos.x - l.x, pos.y - l.y, pos.z - l.z) < 2.2) {
      l.lit = D.PUZZLES.shade_lanterns.time; l.m.material.emissive.set('#ffd77a'); l.m.material.color.set('#ffd77a'); hit = true; G.audio.sfx('ding'); G.fx.burst(new THREE.Vector3(l.x, l.y, l.z), { n: 30, color: '#ffd77a', speed: 5 });
    }
    if (hit && st.lan.every(l => l.lit > 0)) { complete('shade_lanterns'); st.lan.forEach(l => l.lit = 3); }
    return hit;
  };
  PZ.lanternTargets = function () { const st = PZ.list.shade_lanterns; return st ? st.lan.filter(l => l.lit <= 0) : []; };

  PZ.update = function (dt, ppos) {
    const W = G.world;
    for (const p of W.platforms) if (p.move) {
      p.t += dt; const off = Math.sin(p.t * p.move.speed) * p.move.amp; const nx = p.move.axis === 'x' ? p.x0 === undefined ? (p.x0 = p.x) + off : p.x0 + off : p.x;
      const nz = p.move.axis === 'z' ? (p.z0 === undefined ? (p.z0 = p.z) : p.z0) + off : p.z;
      p.dx = nx - p.x; p.dz = nz - p.z; p.x = nx; p.z = nz; p.mesh.position.x = nx; p.mesh.position.z = nz;
    }
    for (const k of ['sky_steps', 'ruined_spire']) { const c = PZ.list[k] && PZ.list[k].chest; if (c) c.userData.glow.visible = ready(k); }
    // wind rings
    const wr = PZ.list.wind_rings;
    if (wr && wr.active) {
      wr.t -= dt; const r = wr.rings[wr.idx]; r.m.rotation.z += dt * 2;
      if (Math.hypot(ppos.x - r.x, ppos.y + 1 - r.y, ppos.z - r.z) < 2.3) {
        r.hit = true; r.m.visible = false; G.audio.sfx('ding'); G.fx.burst(new THREE.Vector3(r.x, r.y, r.z), { n: 30, color: '#9fffe0', speed: 6 }); wr.idx++;
        if (wr.idx >= wr.rings.length) { wr.active = false; complete('wind_rings'); } else { wr.rings[wr.idx].m.material.color.set('#ffd77a'); wr.t += 1.5; }
      }
      G.ui.puzzleTimer(wr.active ? `🌀 ${wr.idx}/${wr.rings.length} · ${Math.max(0, wr.t).toFixed(1)} วิ` : '');
      if (wr.active && wr.t <= 0) { wr.active = false; wr.rings.forEach(r => r.m.visible = false); G.ui.note('หมดเวลา! ลองใหม่อีกครั้ง', 'red'); G.audio.sfx('fail'); G.ui.puzzleTimer(''); }
    }
    const sl = PZ.list.shade_lanterns;
    if (sl) for (const l of sl.lan) { l.m.rotation.y += dt; if (l.lit > 0) { l.lit -= dt; if (l.lit <= 0) { l.m.material.emissive.set('#6a3cc0'); l.m.material.color.set('#6a3cc0'); } } }
  };
})();
