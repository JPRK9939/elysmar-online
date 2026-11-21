/* Networked entities: monsters (server-simulated), other players, NPCs + floating name labels */
(function () {
  const E = G.ents = { mons: new Map(), players: new Map(), npcs: {} };
  const D = G.D; const v3 = new THREE.Vector3();
  const layer = () => document.getElementById('name-layer');
  const groundY = (x, z) => x > 2000 ? 0 : Math.max(G.terrainH(x, z), G.WATER_Y - 0.9);

  function label(cls) { const el = document.createElement('div'); el.className = 'nm ' + cls; layer().appendChild(el); return el; }

  E.initNpcs = function () {
    for (const [id, n] of Object.entries(D.NPCS)) {
      const hat = { maren: 'witch', rowan: 'helm', fenn: 'bandana' }[id];
      const m = G.models.humanoid({ hair: n.colors.hair, skin: n.colors.skin, cloth: n.colors.cloth, style: id === 'lira' || id === 'seren' ? 3 : id === 'kip' ? 0 : 1, ears: n.colors.elf ? 1 : 0 }, { hat: id === 'seren' ? null : hat, beard: id === 'maren' || id === 'fenn', helmColor: '#5a6a8a' });
      if (id === 'kip') m.scale.setScalar(0.75);
      if (id === 'seren') G.models.setWeapon(m, 'staff', 'bloom_staff', 0); if (id === 'rowan') G.models.setWeapon(m, 'sword', 'iron_sword', 0); if (id === 'fenn') G.models.setWeapon(m, 'axe', 'hand_axe', 0);
      const [x, z] = n.pos; m.position.set(x, groundY(x, z), z); m.rotation.y = Math.atan2(-x, -z); G.world.scene.add(m);
      const ent = E.npcs[id] = { id, def: n, model: m, x, z, el: label('npc'), baseRot: m.rotation.y };
      G.world.interact.push({ type: 'npc', npc: id, x, z, r: 3.2, label: 'คุยกับ ' + n.name, act: () => G.ui.openNpc(id) });
    }
  };

  E.applySnap = function (m) {
    const seen = new Set();
    for (const p of m.pl) {
      const [id, name, x, y, z, r, a, hp, mhp, lv, cls, look, party, wep] = p; seen.add(id);
      let e = E.players.get(id);
      if (!e) {
        const model = G.models.humanoid(look || {}); model.position.set(x, y, z); G.world.scene.add(model);
        e = { id, name, model, x, y, z, r, el: label('player') }; E.players.set(id, e);
      }
      Object.assign(e, { tx: x, ty: y, tz: z, tr: r, a, hp, mhp, lv, cls, party, name });
      if (a === 3 && e.lastA !== 3) G.models.triggerAttack(e.model); if (a === 4 && e.lastA !== 4) G.models.triggerCast(e.model); e.lastA = a;
      if (wep) { const [wt, iid, pl] = wep.split(':'); G.models.setWeapon(e.model, wt, iid, +pl); } else G.models.setWeapon(e.model, 'none');
    }
    for (const [id, e] of E.players) if (!seen.has(id)) { G.world.scene.remove(e.model); e.el.remove(); E.players.delete(id); }
    if (m.mo) {
      const ms = new Set();
      for (const s of m.mo) {
        const [id, type, x, z, hp, maxHp, state, r, dead, slow] = s; ms.add(id);
        let e = E.mons.get(id);
        if (!e) { const model = G.models.monster(type); model.position.set(x, groundY(x, z), z); G.world.scene.add(model); e = { id, type, def: D.MONSTERS[type], model, x, z, el: null, fade: 1 }; E.mons.set(id, e); }
        e.tx = x; e.tz = z; e.hp = hp; e.maxHp = maxHp; e.state = state; e.tr = r; e.slow = slow;
        if (!dead && e.dead) { e.model.visible = true; e.fade = 1; e.model.scale.setScalar(1); e.x = x; e.z = z; }
        e.dead = !!dead;
      }
      for (const [id, e] of E.mons) if (!ms.has(id)) { G.world.scene.remove(e.model); if (e.el) e.el.remove(); E.mons.delete(id); if (G.player.target === e) G.player.target = null; }
    }
  };
  E.clearMonsters = function () { for (const e of E.mons.values()) { G.world.scene.remove(e.model); if (e.el) e.el.remove(); } E.mons.clear(); G.player.target = null; G.player.auto = false; };
  E.onDead = function (mid) {
    const e = E.mons.get(mid); if (!e) return; e.dead = true; e.dying = 1;
    const p = e.model.position; G.fx.burst(v3.set(p.x, p.y + 1, p.z), { n: 40, color: e.def.color, color2: '#ffffff', speed: 6, grav: 6 });
    G.fx.ring(p, { color: e.def.color, radius: 3 * (e.def.size || 1), life: 0.5 }); if (e.def.boss) { G.fx.doShake(1); G.audio.sfx('boom'); }
    if (G.player.target === e) G.player.target = null;
  };
  E.onMatk = function (mid) { const e = E.mons.get(mid); if (e) e.model.userData.atkT = 0.5; };
  E.monsterAlive = () => [...E.mons.values()].filter(e => !e.dead);

  const QMARK = id => {
    const av = G.game.available(id); const S = G.S;
    for (const qid of Object.keys(S.quests.active)) if (G.game.isDone(qid) && G.game.turnInNpc(qid) === id) return '<span class="qmark">?</span>';
    for (const qid of Object.keys(S.quests.active)) { const q = G.game.qdef(qid); if (q.type === 'talk' && q.target === id) return '<span class="qmark">?</span>'; }
    return av.length ? '<span class="qmark">!</span>' : '';
  };
  let labelT = 0;
  E.update = function (dt, cam) {
    const W = innerWidth, H = innerHeight; const pp = G.player.pos;
    const place = (el, x, y, z, maxD) => {
      const d = Math.hypot(x - pp.x, z - pp.z); if (d > maxD) { el.style.display = 'none'; return false; }
      v3.set(x, y, z).project(cam); if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { el.style.display = 'none'; return false; }
      el.style.display = ''; el.style.left = ((v3.x + 1) / 2 * W) + 'px'; el.style.top = ((1 - v3.y) / 2 * H) + 'px'; return true;
    };
    labelT -= dt; const refreshText = labelT <= 0; if (refreshText) labelT = 0.5;
    for (const e of E.players.values()) {
      e.x = G.damp(e.x, e.tx, 12, dt); e.y = G.damp(e.y, e.ty, 12, dt); e.z = G.damp(e.z, e.tz, 12, dt); e.r = G.angLerp(e.r, e.tr, Math.min(1, dt * 12));
      e.model.position.set(e.x, e.y, e.z); e.model.rotation.y = e.r;
      const st = e.hp <= 0 ? 'dead' : e.a === 1 ? 'run' : e.a === 2 ? 'jump' : e.a === 6 ? 'gather' : 'idle';
      G.models.animHumanoid(e.model, st, dt);
      if (place(e.el, e.x, e.y + 2.5, e.z, 60) && refreshText) { e.el.className = 'nm ' + (e.party ? 'party' : 'player'); const c = D.CLASSES[(e.cls || 'novice').split(':')[0]] || D.CLASSES.novice; e.el.innerHTML = `<span class="t">${c.icon} Lv.${e.lv}</span>${G.esc(e.name)}`; }
    }
    for (const e of E.mons.values()) {
      if (e.dead) {
        if (e.dying > 0) { e.dying -= dt * 1.5; e.model.scale.setScalar(Math.max(0.01, e.dying)); e.model.position.y -= dt; } else e.model.visible = false;
        if (e.el) e.el.style.display = 'none'; continue;
      }
      const d = Math.hypot(e.tx - e.x, e.tz - e.z); if (d > 12) { e.x = e.tx; e.z = e.tz; }
      e.x = G.damp(e.x, e.tx, 8, dt); e.z = G.damp(e.z, e.tz, 8, dt);
      e.model.position.set(e.x, groundY(e.x, e.z), e.z); e.model.rotation.y = G.angLerp(e.model.rotation.y, e.tr, Math.min(1, dt * 8));
      const dp = Math.hypot(e.x - pp.x, e.z - pp.z); e.model.visible = dp < 170;
      if (dp < 90) G.models.animMonster(e.model, e.state, dt);
      if (e.hit > 0) { e.hit -= dt; e.model.traverse(o => { if (o.isMesh && o.material.emissive) { if (o.userData.em === undefined) o.userData.em = o.material.emissiveIntensity; o.material.emissiveIntensity = e.hit > 0 ? 1.2 : o.userData.em; } }); }
      if (e.slow && Math.random() < 0.2) G.fx.emit(e.x, e.model.position.y + 0.5, e.z, { vy: 0.5, life: 0.6, size: 0.6, color: '#bfefff' });
      const show = dp < 30 || G.player.target === e;
      if (show) { if (!e.el) e.el = label('mon'); const hy = 1.6 + (e.def.size || 1) * 1.1 + (e.def.boss ? 3 : 0);
        if (place(e.el, e.x, e.model.position.y + hy, e.z, 40) && (refreshText || e.hit > 0 || G.player.target === e)) e.el.innerHTML = `Lv.${e.def.lv} ${e.def.name}<div class="mhp"><i style="width:${(e.hp / e.maxHp * 100).toFixed(0)}%"></i></div>`; }
      else if (e.el) e.el.style.display = 'none';
    }
    for (const n of Object.values(E.npcs)) {
      const d = Math.hypot(n.x - pp.x, n.z - pp.z);
      if (d < 7) n.model.rotation.y = G.angLerp(n.model.rotation.y, Math.atan2(pp.x - n.x, pp.z - n.z), dt * 4); else n.model.rotation.y = G.angLerp(n.model.rotation.y, n.baseRot, dt);
      if (d < 120) G.models.animHumanoid(n.model, 'idle', dt);
      if (place(n.el, n.x, n.model.position.y + 2.6, n.z, 45) && refreshText) { const h = G.game.hearts(n.id); n.el.innerHTML = `${QMARK(n.id)}<span class="t">${n.def.title}</span>${n.def.name}<div class="heart">${'♥'.repeat(h)}${'♡'.repeat(10 - h)}</div>`; }
    }
  };
  E.pickAt = function (raycaster) {
    let best = null, bd = 1e9;
    for (const e of E.mons.values()) { if (e.dead || !e.model.visible) continue; const s = (e.def.size || 1) * 1.1 + 0.4; v3.set(e.x, e.model.position.y + s, e.z); const d = raycaster.ray.distanceSqToPoint(v3); if (d < s * s * 1.4) { const dc = raycaster.ray.origin.distanceTo(v3); if (dc < bd) { bd = dc; best = e; } } }
    return best;
  };
})();
