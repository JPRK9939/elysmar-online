/* Local player: 360° orbit camera, movement/jumping/platforming, combat with any weapon, skills, gathering, interaction */
(function () {
  const P = G.player = { pos: new THREE.Vector3(0, 2, 6), vy: 0, onGround: true, yaw: 0, camYaw: 0.6, camPitch: 0.35, camDist: 9, keys: {}, cd: {}, atkCd: 0, target: null, auto: false,
    dead: false, gathering: null, lastHurt: -99, animA: 0, animT: 0, dash: 0, inv: 0, sendT: 0, time: 0, zone: null };
  const D = G.D; const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
  const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();
  const S = () => G.S, Gm = () => G.game;

  P.init = function () {
    const s = S(); P.pos.set(s.pos[0], s.pos[1], s.pos[2]); if (P.pos.x > 2000) P.pos.set(0, 2, 6);
    P.pos.y = Math.max(P.pos.y, G.world.groundAt(P.pos.x, P.pos.z, 999).h);
    P.model = G.models.gltfHero() || G.models.humanoid(s.look); G.world.scene.add(P.model); P.refreshLook();
    P.ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: G.tex.rune, color: '#ff6a5a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    G.world.scene.add(P.ring);
    bindInput();
  };
  P.refreshLook = function () { const w = S().equip.weapon; if (P.model.userData.P) G.models.setWeapon(P.model, w ? D.ITEMS[w.id].wtype : 'none', w && w.id, w && w.plus); };
  P.wepStr = () => { const w = S().equip.weapon; return w ? `${D.ITEMS[w.id].wtype}:${w.id}:${w.plus || 0}` : ''; };

  // ---------- input ----------
  let drag = null;
  function typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); }
  function bindInput() {
    const cv = G.world.renderer.domElement;
    addEventListener('keydown', e => {
      if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
      const k = e.key.toLowerCase(); P.keys[k] = true;
      if (k === ' ') { e.preventDefault(); P.jump(); }
      if (['1', '2', '3', '4', '5', '6'].includes(k)) P.useSkill(+k - 1);
      if (k === 'q') Gm().quickPotion('hp'); if (k === 'r') Gm().quickPotion('mp');
      if (k === 'f') P.interact();
      if (k === 'tab') { e.preventDefault(); P.cycleTarget(); }
      if (k === 'escape') { if (!G.ui.closeTop()) { P.target = null; P.auto = false; } }
      if (k === 'enter') { e.preventDefault(); document.getElementById('chat-input').focus(); }
      const panel = { i: 'inv', k: 'char', o: 'craft', j: 'journal', p: 'social', m: 'map', h: 'help' }[k]; if (panel) G.ui.togglePanel(panel);
    });
    addEventListener('keyup', e => { P.keys[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => { P.keys = {}; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mousedown', e => { G.audio.init(); drag = { x: e.clientX, y: e.clientY, moved: 0, btn: e.button }; });
    addEventListener('mousemove', e => {
      if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 4) { P.camYaw -= dx * 0.006; P.camPitch = G.clamp(P.camPitch + dy * 0.004, -0.45, 1.45); }
    });
    addEventListener('mouseup', e => { if (drag && drag.moved <= 4 && drag.btn === 0 && e.target === cv) clickWorld(e); drag = null; });
    cv.addEventListener('wheel', e => { P.camDist = G.clamp(P.camDist * (e.deltaY > 0 ? 1.1 : 0.9), 2.5, 26); }, { passive: true });
  }
  function clickWorld(e) {
    mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); raycaster.setFromCamera(mouse, G.world.camera);
    const m = G.ents.pickAt(raycaster);
    if (m) { P.target = m; P.auto = true; P.basicAttack(); return; }
    // other players → context
    for (const pl of G.ents.players.values()) { v3.set(pl.x, pl.y + 1, pl.z); if (raycaster.ray.distanceSqToPoint(v3) < 1) { G.ui.playerMenu(pl, e.clientX, e.clientY); return; } }
    P.basicAttack();
  }

  // ---------- targeting ----------
  P.findTarget = function (range, cone) {
    let best = null, bd = 1e9; const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    for (const e of G.ents.monsterAlive()) {
      const dx = e.x - P.pos.x, dz = e.z - P.pos.z, d = Math.hypot(dx, dz); if (d > range + (e.def.size || 1) * 0.5) continue;
      if (cone && d > 1.5 && (dx * fx + dz * fz) / d < cone) continue; if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  P.cycleTarget = function () {
    const list = G.ents.monsterAlive().map(e => ({ e, d: Math.hypot(e.x - P.pos.x, e.z - P.pos.z) })).filter(o => o.d < 30).sort((a, b) => a.d - b.d);
    if (!list.length) return; const i = list.findIndex(o => o.e === P.target); P.target = list[(i + 1) % list.length].e; P.auto = false;
  };
  const tpos = e => v3b.set(e.x, e.model.position.y + 0.8 * (e.def.size || 1), e.z);
  P.face = function (x, z) { P.yaw = Math.atan2(x - P.pos.x, z - P.pos.z); };

  // ---------- combat ----------
  function sendHits(list) { if (list.length) G.net.send({ t: 'hit', h: list }); }
  function hitMonster(e, cat, power, opts) {
    if (!e || e.dead) return null; const r = Gm().damage(cat, power); const dmg = Gm().applyDef(r.dmg, e.def.lv * 1.2 + e.def.def * (Gm().server && Gm().server.mul || 1));
    e.hit = 0.12; G.fx.number(e.model.position, (r.crit ? '💥' : '') + dmg, r.crit ? 'crit' : ''); G.audio.sfx(r.crit ? 'crit' : 'hit');
    const p = e.model.position; G.fx.burst(v3.set(p.x, p.y + (e.def.size || 1), p.z), { n: r.crit ? 22 : 10, color: opts && opts.color || '#ffffff', color2: '#ffe27a', speed: 5, size: 0.7 });
    if (r.crit) G.fx.doShake(0.25);
    if (P.target !== e && !P.target) P.target = e;
    return [e.id, dmg, opts && opts.slow ? 1 : 0];
  }
  P.basicAttack = function () {
    if (P.dead || P.atkCd > 0 || P.gathering) return; const st = Gm().st;
    let t = P.target && !P.target.dead ? P.target : null; const dist = t ? Math.hypot(t.x - P.pos.x, t.z - P.pos.z) : 1e9;
    if (!t || dist > st.range + (t.def.size || 1) * 0.6 + (st.cat === 'melee' ? 0 : 2)) t = P.findTarget(st.range + 0.5, st.cat === 'melee' ? 0.3 : 0.1) || (P.target && !P.target.dead && dist < st.range + 2 ? P.target : null);
    if (!t && P.target && !P.target.dead && st.cat === 'melee') { P.atkCd = 0.2; return; } // out of melee range
    P.atkCd = st.speed; P.animA = 3; P.animT = 0.35; G.models.triggerAttack(P.model);
    if (t) P.face(t.x, t.z);
    const hand = v3.set(P.pos.x + Math.sin(P.yaw) * 0.6, P.pos.y + 1.3, P.pos.z + Math.cos(P.yaw) * 0.6).clone();
    if (st.cat === 'melee') {
      G.fx.slash(P.pos, P.yaw, { color: st.wtype === 'axe' ? '#ffb36a' : '#cfefff', radius: st.range + 0.3, arc: st.wtype === 'dagger' ? 0.6 : 0.9 }); G.audio.sfx('swing');
      if (t) { const h = hitMonster(t, 'melee', st.wmul); if (h) { sendHits([h]); Gm().act('melee'); } }
      G.puzzles.tryHitLantern(v3.set(P.pos.x + Math.sin(P.yaw) * 1.6, P.pos.y + 1.5, P.pos.z + Math.cos(P.yaw) * 1.6));
    } else {
      const magic = st.cat === 'magic'; G.audio.sfx(magic ? 'magic' : 'bow');
      let aim = t ? (() => t.dead ? null : tpos(t).clone()) : null;
      if (!t) { const lan = G.puzzles.lanternTargets().find(l => Math.hypot(l.x - P.pos.x, l.z - P.pos.z) < st.range + 4); const tgt = lan ? new THREE.Vector3(lan.x, lan.y, lan.z) : new THREE.Vector3(P.pos.x + Math.sin(P.yaw) * st.range, P.pos.y + 1.3, P.pos.z + Math.cos(P.yaw) * st.range); if (lan) P.face(lan.x, lan.z); aim = tgt; }
      G.fx.projectile(hand, aim, { color: magic ? (st.wtype === 'wand' ? '#9fd8ff' : '#b08cff') : '#fff3c0', speed: magic ? 24 : 40, arrow: !magic, size: magic ? 1 : 0.5,
        onHit: pos => { G.puzzles.tryHitLantern(pos); if (t && !t.dead) { const h = hitMonster(t, st.cat, st.wmul, { color: magic ? '#b08cff' : '#fff3c0' }); if (h) { sendHits([h]); Gm().act(st.cat); } } G.fx.burst(pos, { n: 10, color: magic ? '#b08cff' : '#fff3c0', speed: 3 }); } });
    }
  };
  function monstersIn(cx, cz, r, filter) { return G.ents.monsterAlive().filter(e => Math.hypot(e.x - cx, e.z - cz) < r + (e.def.size || 1) * 0.5 && (!filter || filter(e))); }
  P.useSkill = function (slot) {
    const id = S().bar[slot]; if (!id || P.dead) return; const sk = D.SKILLS[id]; const s = S();
    if ((P.cd[id] || 0) > 0) return; if (s.mp < sk.mp) { G.ui.note('MP ไม่พอ', 'red'); return; }
    s.mp -= sk.mp; P.cd[id] = sk.cd; P.animA = 4; P.animT = 0.4; P.gathering = null;
    const cat = sk.cat === 'move' ? 'dodge' : sk.cat; const pos = P.pos; const fwd = v3.set(Math.sin(P.yaw), 0, Math.cos(P.yaw)).clone();
    const t = P.target && !P.target.dead ? P.target : P.findTarget(18, 0.2); const hits = [];
    const dmgCat = sk.cat === 'melee' || sk.cat === 'ranged' ? sk.cat : 'magic';
    switch (sk.kind) {
      case 'cone': {
        G.models.triggerAttack(P.model); if (t && Math.hypot(t.x - pos.x, t.z - pos.z) < 8) P.face(t.x, t.z);
        G.fx.slash(pos, P.yaw, { color: '#9fe8ff', radius: sk.radius, arc: 1.1, life: 0.35 }); G.fx.slash(pos, P.yaw, { color: '#ffffff', radius: sk.radius * 0.8, arc: 0.9, life: 0.25, h: 1.3 }); G.audio.sfx('swing');
        const fx2 = Math.sin(P.yaw), fz2 = Math.cos(P.yaw);
        monstersIn(pos.x, pos.z, sk.radius, e => { const dx = e.x - pos.x, dz = e.z - pos.z, d = Math.hypot(dx, dz) || 1; return (dx * fx2 + dz * fz2) / d > 0.2; }).forEach(e => { const h = hitMonster(e, 'melee', sk.power, { color: '#9fe8ff' }); h && hits.push(h); });
        break;
      }
      case 'proj': {
        G.models.triggerCast(P.model); if (t) P.face(t.x, t.z); G.audio.sfx('fire');
        const from = new THREE.Vector3(pos.x + Math.sin(P.yaw), pos.y + 1.4, pos.z + Math.cos(P.yaw));
        const aim = t ? () => t.dead ? null : tpos(t).clone() : new THREE.Vector3(pos.x + fwd.x * 16, pos.y + 1, pos.z + fwd.z * 16);
        G.fx.projectile(from, aim, { color: '#ff8a3a', size: 1.6, speed: 22, onHit: p => {
          G.fx.burst(p, { n: 50, color: '#ff6a2a', color2: '#ffe27a', speed: 8, size: 1.1 }); G.fx.ring(p, { color: '#ff8a3a', radius: sk.radius + 1, life: 0.4 }); G.audio.sfx('boom'); G.puzzles.tryHitLantern(p);
          const hs = []; monstersIn(p.x, p.z, sk.radius).forEach(e => { const h = hitMonster(e, 'magic', sk.power, { color: '#ff8a3a' }); h && hs.push(h); }); sendHits(hs); if (hs.length) Gm().act('magic', 2); } });
        Gm().act('magic'); break;
      }
      case 'heal': {
        G.models.triggerCast(P.model); const amt = Gm().st.heal * sk.power; const s2 = S(); const before = s2.hp; s2.hp = Math.min(Gm().st.maxHp, s2.hp + amt);
        G.fx.number(pos, '+' + Math.round(amt), 'heal'); G.fx.pillar(pos, { color: '#9fffb0', radius: 1.1, height: 6 }); G.fx.rune(pos, { tex: G.tex.runeGold, color: '#9fffb0', radius: 3, life: 1.2 }); G.audio.sfx('heal');
        const ids = G.ui.partyNear(sk.radius); if (ids.length) G.net.send({ t: 'heal', ids, amt: Math.round(amt) });
        Gm().act('heal', 1 + ids.length + (before < Gm().st.maxHp * 0.7 ? 1 : 0)); if (ids.length && Math.random() < 0.1) Gm().align(1);
        break;
      }
      case 'dash': {
        const mv = P.moveDir(); if (mv) P.yaw = Math.atan2(mv.x, mv.z);
        P.dash = 0.22; P.inv = 0.35; G.audio.sfx('dash'); G.fx.burst(v3.set(pos.x, pos.y + 1, pos.z), { n: 25, color: '#cfefff', speed: 4 }); Gm().act('dodge', 0); Gm().trainStat('dex', 1); break;
      }
      case 'aoe': {
        G.models.triggerAttack(P.model); const ice = sk.slow;
        G.fx.ring(pos, { color: ice ? '#9fefff' : '#ffffff', radius: sk.radius, life: 0.5 }); G.fx.rune(pos, { tex: ice ? G.tex.rune : G.tex.ring, color: ice ? '#9fefff' : '#cfe8ff', radius: sk.radius, life: 0.8 });
        G.fx.burst(v3.set(pos.x, pos.y + 1, pos.z), { n: 60, color: ice ? '#cfffff' : '#e0f0ff', color2: ice ? '#6fd8ff' : '#ffffff', speed: 10, flat: true, size: 1 }); G.audio.sfx(ice ? 'ice' : 'swing');
        monstersIn(pos.x, pos.z, sk.radius).forEach(e => { const h = hitMonster(e, dmgCat, sk.power, { slow: ice, color: ice ? '#9fefff' : '#fff' }); h && hits.push(h); });
        if (!ice) { for (let k = 0; k < 3; k++) setTimeout(() => G.fx.slash(P.pos, P.yaw + k * 2.1, { color: '#cfefff', radius: sk.radius, arc: 0.7 }), k * 70); }
        break;
      }
      case 'ground': {
        G.models.triggerCast(P.model); const tp = t ? new THREE.Vector3(t.x, t.model.position.y, t.z) : new THREE.Vector3(pos.x + fwd.x * 10, 0, pos.z + fwd.z * 10); if (!t) tp.y = G.terrainH(tp.x, tp.z); if (t) P.face(t.x, t.z);
        const meteor = id === 'meteor'; G.fx.rune(tp, { tex: meteor ? G.tex.runeDark : G.tex.rune, color: meteor ? '#ff7a3a' : '#fff3c0', radius: sk.radius, life: 1.2 });
        const land = () => {
          G.fx.burst(v3.set(tp.x, tp.y + 0.5, tp.z), { n: meteor ? 120 : 40, color: meteor ? '#ff6a2a' : '#fff3c0', color2: meteor ? '#7a2aff' : '#ffffff', speed: meteor ? 14 : 6, up: true, grav: 10, size: meteor ? 1.6 : 0.8 });
          G.fx.ring(tp, { color: meteor ? '#ff7a3a' : '#fff3c0', radius: sk.radius + 1, life: 0.6 }); if (meteor) { G.fx.doShake(0.8); G.audio.sfx('boom'); } else G.audio.sfx('bow');
          const hs = []; monstersIn(tp.x, tp.z, sk.radius).forEach(e => { const h = hitMonster(e, dmgCat, sk.power, { color: meteor ? '#ff7a3a' : '#fff3c0' }); h && hs.push(h); }); sendHits(hs); Gm().act(sk.cat, 1 + Math.min(3, hs.length));
        };
        if (meteor) G.fx.projectile(new THREE.Vector3(tp.x - 10, tp.y + 30, tp.z - 6), tp.clone(), { color: '#ff6a2a', size: 4, speed: 34, onHit: land });
        else { for (let k = 0; k < 16; k++) setTimeout(() => { const a = Math.random() * 6.28, r = Math.random() * sk.radius; G.fx.projectile(new THREE.Vector3(tp.x + Math.cos(a) * r, tp.y + 14, tp.z + Math.sin(a) * r), new THREE.Vector3(tp.x + Math.cos(a) * r, tp.y, tp.z + Math.sin(a) * r), { color: '#fff3c0', arrow: true, speed: 40, size: 0.5 }); }, k * 30); setTimeout(land, 450); }
        break;
      }
      case 'buff': {
        G.models.triggerCast(P.model); Gm().buffs.barrier = 8; G.fx.rune(pos, { tex: G.tex.runeGold, color: '#fff3a8', radius: sk.radius * 0.6, life: 1.5 }); G.fx.pillar(pos, { color: '#fff3a8', radius: 2, height: 5 }); G.audio.sfx('heal');
        const ids = G.ui.partyNear(sk.radius); if (ids.length) G.net.send({ t: 'heal', ids, amt: 0, barrier: 8 }); Gm().act('heal', 2 + ids.length); break;
      }
      case 'selfbuff': { Gm().buffs.berserk = 10; G.fx.burst(v3.set(pos.x, pos.y + 1, pos.z), { n: 50, color: '#ff3a3a', color2: '#ffb36a', speed: 6, up: true }); G.fx.ring(pos, { color: '#ff4a3a', radius: 4 }); G.audio.sfx('crit'); Gm().act('melee', 2); break; }
      case 'beam': {
        G.models.triggerCast(P.model); if (t) P.face(t.x, t.z); const dir = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw)); const a = new THREE.Vector3(pos.x + dir.x, pos.y + 1.3, pos.z + dir.z); const b = a.clone().addScaledVector(dir, 22);
        G.fx.beam(a, b, { color: '#ff9adf', width: 0.5, life: 0.5 }); G.audio.sfx('magic'); G.fx.doShake(0.3);
        G.ents.monsterAlive().forEach(e => { const rx = e.x - a.x, rz = e.z - a.z; const proj = rx * dir.x + rz * dir.z; if (proj < 0 || proj > 22) return; const perp = Math.abs(rx * dir.z - rz * dir.x); if (perp < sk.radius + (e.def.size || 1) * 0.5) { const h = hitMonster(e, 'magic', sk.power, { color: '#ff9adf' }); h && hits.push(h); } });
        G.puzzles.tryHitLantern(b); break;
      }
      case 'flowers': {
        for (let k = 0; k < 30; k++) { const a = Math.random() * 6.28, r = Math.random() * sk.radius; G.fx.emit(pos.x + Math.cos(a) * r, G.terrainH(pos.x + Math.cos(a) * r, pos.z + Math.sin(a) * r) + 0.3, pos.z + Math.sin(a) * r, { vy: 1.5, life: 2.5, size: 0.9, color: G.pick(['#ffb7dd', '#fff3a8', '#cfe3ff', '#ffffff']), drag: 1 }); }
        G.fx.rune(pos, { tex: G.tex.runeGold, color: '#ffb7dd', radius: sk.radius, life: 1.5 }); G.audio.sfx('heal');
        for (const n of Object.values(G.ents.npcs)) if (Math.hypot(n.x - pos.x, n.z - pos.z) < 8) { const ns = Gm().npc(n.id); if (ns.bloomDay !== G.today()) { ns.bloomDay = G.today(); Gm().addAffinity(n.id, n.id === 'seren' ? 40 : 15); G.ui.chat(`${n.def.name}: "${n.id === 'seren' ? 'เวทนี้... ฉันชอบมันที่สุดเลย' : 'ว้าว สวยจัง!'}"`, 'sys'); } }
        Gm().act('social'); G.net.send({ t: 'emote', fx: 'flowers', x: pos.x, z: pos.z }); break;
      }
    }
    if (hits.length) { sendHits(hits); Gm().act(sk.cat === 'ranged' ? 'ranged' : sk.cat === 'melee' ? 'melee' : 'magic', Math.min(3, hits.length)); }
    G.ui.refresh();
  };
  P.onHurt = function (m) {
    if (P.dead) return; const s = S();
    if (P.inv > 0) { G.fx.number(P.pos, 'MISS', 'miss'); Gm().act('dodge'); return; }
    let dmg = Math.max(1, Math.round(m.dmg - Gm().st.def * 0.5)); if (Gm().buffs.barrier > 0) dmg = Math.round(dmg * 0.6);
    if (Math.random() < Math.min(0.25, s.stats.dex * 0.003)) { G.fx.number(P.pos, 'MISS', 'miss'); Gm().act('dodge'); return; }
    s.hp -= dmg; P.lastHurt = P.time; G.fx.number(P.pos, '-' + dmg, 'hurt'); G.audio.sfx('hurt'); Gm().act('hurt'); if (m.aoe) G.fx.doShake(0.5);
    const mon = G.ents.mons.get(m.mid); if (mon && !P.target) P.target = mon;
    if (s.hp <= 0) { s.hp = 0; P.die(); } G.ui.refresh();
  };
  P.die = function () { P.dead = true; P.target = null; P.gathering = null; Gm().die(); document.getElementById('death').classList.remove('hidden'); G.audio.sfx('fail'); };
  P.respawn = function () { const s = S(); P.dead = false; s.hp = Math.round(Gm().st.maxHp * 0.6); s.mp = Math.round(Gm().st.maxMp * 0.6); document.getElementById('death').classList.add('hidden'); if (P.pos.x > 2000) G.net.send({ t: 'dgLeave' }); P.teleport(0, 7); G.ui.refresh(); };
  P.teleport = function (x, z) { P.pos.set(x, G.world.groundAt(x, z, 999).h + 0.5, z); P.vy = 0; G.fx.pillar(P.pos, { color: '#8fe8ff', radius: 1, height: 8 }); G.audio.sfx('magic'); Gm().flush(); };

  // ---------- gathering & interaction ----------
  P.startGather = function (node) {
    if (!node.ready || P.dead) return; P.gathering = { node, t: 0, max: node.def.time * (1 - Math.min(0.5, Gm().bonus('gather'))) }; P.face(node.x, node.z);
  };
  P.interact = function () { if (P.near) P.near.act(); };
  P.moveDir = function () {
    const k = P.keys; let f = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), r = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
    if (!f && !r) return null; const y = P.camYaw; const x = -Math.sin(y) * f + Math.cos(y) * r, z = -Math.cos(y) * f - Math.sin(y) * r; const l = Math.hypot(x, z); return { x: x / l, z: z / l };
  };
  P.jump = function () { if (P.dead) return; if (P.onGround) { P.vy = 12.5; P.onGround = false; G.audio.sfx('jump'); P.gathering = null; } };

  // ---------- update ----------
  let lastZone = null, lastXZ = null;
  P.update = function (dt) {
    P.time += dt; const s = S(); const st = Gm().st; const W = G.world;
    if (P.atkCd > 0) P.atkCd -= dt; for (const k in P.cd) if (P.cd[k] > 0) P.cd[k] -= dt; if (P.inv > 0) P.inv -= dt; if (P.animT > 0) P.animT -= dt; else P.animA = 0;
    let moving = false;
    if (!P.dead) {
      const mv = P.moveDir(); const sprint = P.keys.shift ? 1.35 : 1; let sp = st.moveSpd * sprint * (s.hp < st.maxHp * 0.15 ? 0.8 : 1);
      if (P.dash > 0) { P.dash -= dt; sp = 38; const dx = Math.sin(P.yaw), dz = Math.cos(P.yaw); P.pos.x += dx * sp * dt; P.pos.z += dz * sp * dt; G.fx.emit(P.pos.x, P.pos.y + 1, P.pos.z, { life: 0.4, size: 1.2, color: '#cfefff' }); }
      else if (mv) { moving = true; P.pos.x += mv.x * sp * dt; P.pos.z += mv.z * sp * dt; P.yaw = G.angLerp(P.yaw, Math.atan2(mv.x, mv.z), Math.min(1, dt * 14)); P.gathering = null; }
      if (P.auto && P.target && !P.target.dead && !mv) { const d = Math.hypot(P.target.x - P.pos.x, P.target.z - P.pos.z); if (d < st.range + (P.target.def.size || 1) * 0.6 + (st.cat === 'melee' ? 0 : 2)) { P.face(P.target.x, P.target.z); P.basicAttack(); } }
      if (P.keys.z || P.keys.x) P.basicAttack();
    }
    // vertical
    P.vy -= 32 * dt; P.pos.y += P.vy * dt;
    const g = W.groundAt(P.pos.x, P.pos.z, P.pos.y);
    if (P.pos.y <= g.h) { if (P.vy < -22 && !g.plat) { const fall = Math.round((-P.vy - 22) * 4); if (fall > 0 && !P.dead) P.onHurt({ dmg: fall + Gm().st.def * 0.5 }); } P.pos.y = g.h; P.vy = 0; P.onGround = true; if (g.plat && g.plat.dx !== undefined) { P.pos.x += g.plat.dx; P.pos.z += g.plat.dz; } }
    else if (P.pos.y > g.h + 0.15) P.onGround = false;
    W.collide(P.pos);
    // bounds
    if (P.pos.x > 2000) { const o = D.DUNGEON.origin; const dx = P.pos.x - o.x, dz = P.pos.z - o.z, d = Math.hypot(dx, dz); if (d > 39) { P.pos.x = o.x + dx / d * 39; P.pos.z = o.z + dz / d * 39; } }
    else { const d = Math.hypot(P.pos.x, P.pos.z); if (d > 560) { P.pos.x *= 560 / d; P.pos.z *= 560 / d; } }
    // exploration distance
    if (lastXZ) { const d = Math.hypot(P.pos.x - lastXZ.x, P.pos.z - lastXZ.z); if (d < 5) Gm().travel(d); } lastXZ = { x: P.pos.x, z: P.pos.z };
    // gathering
    if (P.gathering) {
      const gth = P.gathering; gth.t += dt; G.ui.cast(gth.t / gth.max, 'กำลังเก็บ ' + gth.node.def.name + '...');
      if (gth.t >= gth.max) { const n = gth.node; n.ready = false; n.respawn = n.def.respawn; n.mesh.visible = false; P.gathering = null; G.ui.cast(0);
        const qty = 1 + (Math.random() < 0.3 + s.stats.luk * 0.005 ? 1 : 0); Gm().add(n.def.item, qty); Gm().act('gather'); G.audio.sfx('gather'); G.fx.burst(v3.set(n.x, n.mesh.position.y + 0.8, n.z), { n: 16, color: '#b4ffb4', speed: 3, up: true });
        if (Math.random() < 0.04) { Gm().add(G.pick(['shiny_pebble', 'crystal', 'old_coin']), 1); G.ui.note('✨ พบของหายากระหว่างเก็บ!', 'gold'); } }
    } else G.ui.cast(0);
    // regen
    const combat = P.time - P.lastHurt < 6; if (!P.dead) { s.hp = Math.min(st.maxHp, s.hp + st.maxHp * (combat ? 0.002 : 0.02) * dt); s.mp = Math.min(st.maxMp, s.mp + st.maxMp * (combat ? 0.008 : 0.025) * (1 + Gm().bonus('mpregen')) * dt); }
    // zone detection
    const zn = G.zoneAt(P.pos.x, P.pos.z); if (!lastZone || zn.id !== lastZone) { lastZone = zn.id; P.zone = zn; G.ui.zone(zn.name, zn.lv); G.audio.zoneMusic(zn.id); if (zn.id !== 'wild') Gm().discover('z_' + zn.id, zn.name, 40); }
    for (const ws of W.waystones) if (Math.hypot(ws.x - P.pos.x, ws.z - P.pos.z) < 8) Gm().discover('ws_' + ws.id, 'หินเคลื่อนย้าย ' + ws.name, 20);
    // interactables
    let best = null, bd = 1e9;
    for (const it of W.interact) { const d = Math.hypot(it.x - P.pos.x, it.z - P.pos.z); if (d > it.r || d >= bd) continue; if (it.needY && Math.abs((it.y || 0) - P.pos.y) > 2.5) continue; if (it.y !== undefined && !it.needY) {} const l = it.label; if (!l) continue; best = it; bd = d; }
    P.near = best; G.ui.hint(best ? best.label : null);
    // model + anim
    P.model.position.copy(P.pos); P.model.rotation.y = P.yaw;
    const state = P.dead ? 'dead' : P.gathering ? 'gather' : !P.onGround ? 'jump' : moving || P.dash > 0 ? 'run' : 'idle';
    if (P.model.userData.gltf) G.models.animGLTF(P.model, state, dt); else G.models.animHumanoid(P.model, state, dt, P.keys.shift && moving ? 1.3 : 1);
    // target ring
    if (P.target && !P.target.dead) { P.ring.position.set(P.target.x, P.target.model.position.y + 0.06, P.target.z); P.ring.scale.setScalar(2.6 * (P.target.def.size || 1)); P.ring.material.opacity = 0.7 + Math.sin(P.time * 6) * 0.2; P.ring.rotation.y += dt; }
    else { P.ring.material.opacity = 0; if (P.target && P.target.dead) { P.target = null; P.auto = false; } }
    // camera
    const cam = W.camera; const tgt = v3.set(P.pos.x, P.pos.y + 1.6, P.pos.z);
    const cd = P.camDist, cp = Math.cos(P.camPitch);
    let cx = tgt.x + Math.sin(P.camYaw) * cp * cd, cy = tgt.y + Math.sin(P.camPitch) * cd, cz = tgt.z + Math.cos(P.camYaw) * cp * cd;
    const gy = (cx > 2000 ? 0 : G.terrainH(cx, cz)) + 0.5; if (cy < gy) cy = gy;
    cam.position.set(cx, cy, cz); if (G.fx.shake > 0) cam.position.add(v3b.set((Math.random() - .5) * G.fx.shake, (Math.random() - .5) * G.fx.shake, (Math.random() - .5) * G.fx.shake));
    cam.lookAt(tgt);
    // network state
    P.sendT -= dt; if (P.sendT <= 0) { P.sendT = 0.1; const a = P.dead ? 5 : P.animA ? P.animA : P.gathering ? 6 : !P.onGround ? 2 : moving ? 1 : 0;
      G.net.send({ t: 'state', s: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2), +P.yaw.toFixed(2), a, Math.round(s.hp), st.maxHp, s.lv, s.cls, P.wepStr()] }); }
  };
})();
