/* Core RPG systems: inventory, equipment, stats-from-use, behaviour-based classes, skills, quests,
   NPC relationships (Harvest-Moon style), crafting, enhancement, shops, lore & alignment */
(function () {
  const D = G.D; const Gm = G.game = { dirty: false, buffs: {} };
  let S = null;
  const uid = () => G.GameCoreLibUid ? G.GameCoreLibUid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

  Gm.load = function (save, server) {
    S = G.S = save; Gm.server = server;
    // migrate / defaults
    const def = D.newSave(save.name, save.look);
    for (const k in def) if (S[k] === undefined) S[k] = def[k];
    for (const k in def.stats) { if (S.stats[k] === undefined) S.stats[k] = 5; if (S.statXp[k] === undefined) S.statXp[k] = 0; }
    S.inv.forEach(i => { if (!i.uid) i.uid = uid(); });
    Gm.recalc(); if (S.hp <= 0) S.hp = Gm.st.maxHp;
  };

  // ---------- items ----------
  Gm.item = id => D.ITEMS[id];
  Gm.count = id => S.inv.reduce((n, i) => n + (i.id === id ? i.qty : 0), 0);
  Gm.add = function (id, qty, plus, quiet) {
    const def = D.ITEMS[id]; if (!def) return; qty = qty || 1;
    if (D.STACKABLE(def.type)) { const st = S.inv.find(i => i.id === id); if (st) st.qty += qty; else S.inv.push({ uid: uid(), id, qty, plus: 0 }); }
    else for (let k = 0; k < qty; k++) S.inv.push({ uid: uid(), id, qty: 1, plus: plus || 0 });
    if (!quiet) { G.ui.chat(`ได้รับ ${def.icon} ${def.name} x${qty}`, 'loot'); G.audio.sfx('pickup'); }
    Gm.markDirty(); G.ui.refresh();
  };
  Gm.addInst = function (inst, quiet) {
    const def = D.ITEMS[inst.id]; if (!def) return;
    if (D.STACKABLE(def.type)) return Gm.add(inst.id, inst.qty, 0, quiet);
    S.inv.push({ uid: inst.uid || uid(), id: inst.id, qty: 1, plus: inst.plus || 0 }); if (!quiet) { G.ui.chat(`ได้รับ ${def.icon} ${def.name}${inst.plus ? ' +' + inst.plus : ''}`, 'loot'); G.audio.sfx('pickup'); }
    Gm.markDirty(); G.ui.refresh();
  };
  Gm.remove = function (id, qty) {
    let need = qty || 1;
    for (let i = S.inv.length - 1; i >= 0 && need > 0; i--) { const it = S.inv[i]; if (it.id !== id) continue; const take = Math.min(it.qty, need); it.qty -= take; need -= take; if (it.qty <= 0) S.inv.splice(i, 1); }
    Gm.markDirty(); return need === 0;
  };
  Gm.removeUid = function (u, qty) { const i = S.inv.findIndex(x => x.uid === u); if (i < 0) return null; const it = S.inv[i]; if (qty && it.qty > qty) { it.qty -= qty; Gm.markDirty(); return { ...it, qty }; } S.inv.splice(i, 1); Gm.markDirty(); return it; };
  Gm.byUid = u => S.inv.find(x => x.uid === u) || Object.values(S.equip).find(x => x && x.uid === u);
  Gm.equip = function (u) {
    const i = S.inv.findIndex(x => x.uid === u); if (i < 0) return; const it = S.inv[i]; const def = D.ITEMS[it.id];
    const slot = def.type; if (!['weapon', 'armor', 'helm', 'acc'].includes(slot)) return;
    S.inv.splice(i, 1); if (S.equip[slot]) S.inv.push(S.equip[slot]); S.equip[slot] = it;
    G.audio.sfx('ui'); Gm.recalc(); Gm.markDirty(); G.ui.refresh(); G.player && G.player.refreshLook();
  };
  Gm.unequip = function (slot) { if (!S.equip[slot]) return; S.inv.push(S.equip[slot]); S.equip[slot] = null; Gm.recalc(); Gm.markDirty(); G.ui.refresh(); G.player && G.player.refreshLook(); };
  Gm.use = function (u) {
    const it = S.inv.find(x => x.uid === u); if (!it) return; const def = D.ITEMS[it.id];
    if (def.type !== 'consume') { if (['weapon', 'armor', 'helm', 'acc'].includes(def.type)) Gm.equip(u); return; }
    if (S.hp <= 0) return;
    if (def.heal) { const h = Math.min(def.heal, Gm.st.maxHp - S.hp); S.hp += h; G.fx.number(G.player.pos, '+' + Math.round(def.heal), 'heal'); }
    if (def.mana) S.mp = Math.min(Gm.st.maxMp, S.mp + def.mana);
    G.fx.column(G.player.pos, { color: def.mana && !def.heal ? '#6fb8ff' : '#7dff9a', n: 20, radius: 0.6 }); G.audio.sfx('heal');
    Gm.remove(it.id, 1); G.ui.refresh();
  };
  Gm.quickPotion = function (kind) {
    const order = kind === 'mp' ? ['mp_potion', 'elixir'] : ['hp_potion', 'hi_potion', 'herbal_tea', 'sweet_bun', 'elixir'];
    for (const id of order) { const it = S.inv.find(x => x.id === id); if (it) return Gm.use(it.uid); }
    G.ui.note(kind === 'mp' ? 'ไม่มีน้ำมานา' : 'ไม่มียาฟื้นพลัง', 'red');
  };

  // ---------- derived stats ----------
  Gm.cls = () => D.CLASSES[S.cls ? S.cls.split(':')[0] : 'novice'] || D.CLASSES.novice;
  Gm.clsTier = () => (S.cls || '').includes(':2') ? 2 : S.cls === 'novice' ? 0 : 1;
  Gm.clsName = function () {
    const c = Gm.cls(); const tier = Gm.clsTier(); if (tier < 2) return c.icon + ' ' + c.name;
    return c.icon + ' ' + c.t2[S.align >= 0 ? 0 : 1];
  };
  Gm.bonus = function (k) { const c = Gm.cls(); const t = Gm.clsTier(); return (c.bonus[k] || 0) * (t === 2 ? 2 : 1); };
  Gm.recalc = function () {
    const st = S.stats; const e = S.equip; let gear = { atk: 0, matk: 0, def: 0, hp: 0, mp: 0, luk: 0, heal: 0, sell: 0 };
    for (const it of Object.values(e)) { if (!it) continue; const d = D.ITEMS[it.id]; const m = 1 + (it.plus || 0) * 0.1; for (const k in gear) if (d[k]) gear[k] += (k === 'atk' || k === 'matk' || k === 'def') ? d[k] * m + (it.plus || 0) * (k === 'def' ? 1 : 2) : d[k]; }
    const wt = e.weapon ? D.ITEMS[e.weapon.id].wtype : 'none'; const W = D.WTYPES[wt];
    const luk = st.luk + gear.luk + Gm.bonus('cha') * 0;
    const out = {
      wtype: wt, cat: W.cat, range: W.range, speed: W.speed, wmul: W.mul,
      maxHp: Math.round((90 + S.lv * 14 + st.vit * 10 + gear.hp) * (1 + Gm.bonus('hp'))),
      maxMp: Math.round((40 + S.lv * 6 + st.int * 3 + st.wis * 4 + gear.mp) * (1 + Gm.bonus('mp'))),
      atk: Math.round(gear.atk + (W.cat === 'ranged' ? st.dex * 2.1 + st.str * 0.5 : st.str * 2.2 + st.dex * 0.4) + S.lv * 1.5),
      matk: Math.round(gear.matk + st.int * 2.3 + st.wis * 0.6 + S.lv * 1.5),
      def: Math.round(gear.def + st.vit * 0.8 + S.lv * 0.5),
      crit: Math.min(0.6, 0.05 + luk * 0.003 + st.dex * 0.002 + Gm.bonus('crit')),
      heal: Math.round((st.wis * 4.2 + st.int * 0.8 + S.lv * 3 + 10) * (1 + Gm.bonus('heal') + gear.heal)),
      moveSpd: 7.2 * (1 + Gm.bonus('speed') + Math.min(0.15, st.dex * 0.002)), luk, sell: gear.sell + Gm.bonus('sell')
    };
    Gm.st = out; S.hp = Math.min(S.hp, out.maxHp); S.mp = Math.min(S.mp, out.maxMp); return out;
  };
  Gm.damage = function (cat, power, opts) {
    const st = Gm.st; let base = cat === 'magic' ? st.matk : st.atk;
    let mul = 1 + (cat === 'melee' ? Gm.bonus('melee') : cat === 'magic' ? Gm.bonus('magic') : cat === 'ranged' ? Gm.bonus('ranged') : 0);
    if (Gm.buffs.berserk > 0) mul *= 1.5;
    let dmg = base * power * mul * G.rand(0.9, 1.1); const crit = Math.random() < st.crit; if (crit) dmg *= 1.8;
    return { dmg: Math.max(1, Math.round(dmg)), crit };
  };
  Gm.applyDef = (dmg, monDef) => Math.max(1, Math.round(dmg - monDef * 0.6));

  // ---------- EXP & level ----------
  Gm.addExp = function (n, quiet) {
    if (n <= 0) return; S.exp += Math.round(n); if (!quiet) G.fx.number(G.player.pos, '+' + Math.round(n) + ' EXP', 'exp');
    while (S.exp >= D.expForLevel(S.lv)) {
      S.exp -= D.expForLevel(S.lv); S.lv++; Gm.recalc(); S.hp = Gm.st.maxHp; S.mp = Gm.st.maxMp;
      G.audio.sfx('levelup'); G.fx.pillar(G.player.pos, { color: '#ffe27a', radius: 1.3, height: 10, life: 1.6 }); G.fx.ring(G.player.pos, { color: '#ffd77a', radius: 6, life: 1 });
      G.ui.center('LEVEL UP!', 'เลเวล ' + S.lv); G.ui.chat(`เลเวลอัพ! ตอนนี้เลเวล ${S.lv}`, 'sys'); Gm.checkClass();
    }
    Gm.markDirty(); G.ui.refresh();
  };
  Gm.addGold = function (n) { S.gold = Math.max(0, Math.round(S.gold + n)); if (n > 0) G.audio.sfx('coin'); Gm.markDirty(); G.ui.refresh(); };

  // ---------- behaviour tracking → stats, skills, class ----------
  Gm.act = function (cat, n) {
    n = n || 1; S.acts[cat] = (S.acts[cat] || 0) + n;
    const w = D.ACT_WEIGHT[cat];
    if (w) { for (const k in S.score) S.score[k] *= Math.pow(0.9985, n); S.score[cat] = (S.score[cat] || 0) + w * n; }
    const tr = D.STAT_TRAIN[cat]; if (tr) Gm.trainStat(tr[0], tr[1] * n);
    for (const [id, sk] of Object.entries(D.SKILLS)) if (sk.unlock && sk.unlock.act === cat && (S.acts[cat] || 0) >= sk.unlock.n) Gm.learnSkill(id);
    if (w) Gm.checkClass(); Gm.markDirty();
  };
  Gm.trainStat = function (k, xp) {
    S.statXp[k] = (S.statXp[k] || 0) + xp; const need = () => 8 + S.stats[k] * 4;
    while (S.statXp[k] >= need()) { S.statXp[k] -= need(); S.stats[k]++; G.ui.note(`${D.STAT_NAMES[k]} เพิ่มขึ้นเป็น ${S.stats[k]} (จากการฝึกฝน)`, 'purple'); Gm.recalc(); }
  };
  Gm.learnSkill = function (id) {
    if (S.skills.includes(id)) return; S.skills.push(id); const sk = D.SKILLS[id];
    G.ui.center('เรียนรู้สกิลใหม่!', sk.icon + ' ' + sk.name); G.audio.sfx('levelup');
    const empty = S.bar.findIndex(b => !b); if (empty >= 0) S.bar[empty] = id; else if (S.bar.length < 6) S.bar.push(id);
    Gm.markDirty(); G.ui.refresh();
  };
  Gm.classScores = function () {
    const out = {}; for (const [k, c] of Object.entries(D.CLASSES)) { if (!c.act) continue; out[k] = c.act.reduce((s, a) => s + (S.score[a] || 0), 0) / (c.act.length > 1 ? 1.4 : 1); } return out;
  };
  Gm.checkClass = function () {
    const sc = Gm.classScores(); let best = 'novice', bv = 0; for (const k in sc) if (sc[k] > bv) { bv = sc[k]; best = k; }
    let next = 'novice'; if (bv >= D.CLASS_T1) next = best; if (bv >= D.CLASS_T2 && S.lv >= D.CLASS_T2_LV) next = best + ':2';
    // hysteresis: keep current unless the new one leads clearly
    const cur = S.cls || 'novice'; const curK = cur.split(':')[0];
    if (next !== cur) { if (curK !== 'novice' && next.split(':')[0] !== curK && sc[curK] && bv < sc[curK] * 1.15) return; const old = Gm.clsName(); S.cls = next; Gm.recalc();
      G.ui.center('อาชีพเปลี่ยนแปลง!', Gm.clsName()); G.ui.chat(`พฤติกรรมของคุณหล่อหลอมให้กลายเป็น ${Gm.clsName()} (จาก ${old})`, 'sys'); G.fx.pillar(G.player.pos, { color: Gm.cls().color, radius: 1.5, height: 12 }); G.audio.sfx('levelup'); G.ui.refresh(); }
  };
  Gm.align = function (n) { S.align = G.clamp((S.align || 0) + n, -100, 100); G.ui.note(n > 0 ? `☀ แสงในตัวคุณเพิ่มขึ้น (${S.align})` : `☾ ความมืดในตัวคุณเพิ่มขึ้น (${S.align})`, n > 0 ? 'gold' : 'purple'); G.ui.refresh(); };

  // ---------- rewards from server ----------
  Gm.onReward = function (m) {
    const def = D.MONSTERS[m.mtype];
    Gm.addExp(m.exp); if (m.gold) Gm.addGold(m.gold);
    for (const d of m.drops || []) Gm.addInst(d);
    if (m.kill) { S.kills[m.mtype] = (S.kills[m.mtype] || 0) + 1; Gm.questEvent('kill', m.mtype);
      if (def && !def.aggro && Math.random() < 0.15) Gm.align(-1); // hunting passive creatures darkens you a little
      if (def && def.boss) Gm.align(3);
      if (m.mtype === 'shade' && Math.random() < 0.02) Gm.unlockLore(12); }
  };

  // ---------- lore ----------
  Gm.unlockLore = function (n) {
    if (!D.LORE[n] || S.lore.includes(n)) return; S.lore.push(n); S.lore.sort((a, b) => a - b);
    G.ui.center('เศษความทรงจำ #' + n, D.LORE[n].title); G.ui.chat(`📜 ${D.LORE[n].title}: ${D.LORE[n].text}`, 'lore'); G.audio.sfx('puzzle'); Gm.addExp(50 * n, true); Gm.markDirty();
  };

  // ---------- quests ----------
  Gm.questState = id => S.quests.active[id];
  Gm.qdef = id => id.startsWith('echo') ? S.quests.active[id] && S.quests.active[id].def : D.QUESTS[id];
  Gm.available = function (npc) {
    const out = [];
    for (const [id, q] of Object.entries(D.QUESTS)) {
      if (q.giver !== npc || S.quests.active[id]) continue; if (S.quests.done[id] && !q.repeat) continue;
      if (q.req && !S.quests.done[q.req]) continue; if (q.repeat && S.quests.done[id] && Date.now() - S.quests.done[id] < 5 * 60e3) continue;
      out.push(id);
    }
    if ((npc === 'maren' || npc === 'seren') && S.quests.done.m9 && !Object.keys(S.quests.active).some(k => k.startsWith('echo'))) out.push('echo:new');
    return out;
  };
  Gm.makeEcho = function () {
    const n = (S.echoN || 0) + 1; const zones = D.ZONES.filter(z => z.id !== 'lake'); const zn = G.pick(zones); const mon = G.pick(zn.spawns)[0]; const md = D.MONSTERS[mon];
    const usePuzzle = Math.random() < 0.3; const pz = G.pick(Object.keys(D.PUZZLES));
    return { name: 'เสียงสะท้อน #' + n, giver: 'maren', type: usePuzzle ? 'puzzle' : 'kill', target: usePuzzle ? pz : mon, n: usePuzzle ? 1 : 8 + Math.floor(Math.random() * 8), echo: true,
      text: usePuzzle ? `เสียงสะท้อนดังมาจาก "${D.PUZZLES[pz].name}" ไขปริศนาที่นั่นเพื่อฟังมันให้ชัด` : `เสียงสะท้อนซ่อนอยู่ในตัว${md.name}ที่${zn.name} กำจัดพวกมันเพื่อปลดปล่อยเสียง`,
      reward: { exp: Math.round(D.expForLevel(S.lv) * 0.35), gold: 50 + S.lv * 20, items: Math.random() < 0.4 ? [['enh_stone', 1]] : [['hp_potion', 3]] },
      choice: [{ text: 'เชื่อเสียงสะท้อนนี้', align: 4 }, { text: 'มันกำลังโกหก...', align: -4 }] };
  };
  Gm.accept = function (id) {
    if (id === 'echo:new') { S.echoN = (S.echoN || 0) + 1; const def = Gm.makeEcho(); id = 'echo' + S.echoN; S.quests.active[id] = { n: 0, def }; }
    else S.quests.active[id] = { n: 0 };
    const q = Gm.qdef(id); G.ui.chat(`รับภารกิจ: ${q.name}`, 'sys'); G.audio.sfx('ding');
    if (q.type === 'talk') Gm.questEvent('talk', null); Gm.markDirty(); G.ui.refresh();
  };
  Gm.progress = function (id) {
    const q = Gm.qdef(id), s = S.quests.active[id]; if (!q || !s) return [0, 1];
    if (q.type === 'gather') return [Math.min(Gm.count(q.target), q.n), q.n];
    return [Math.min(s.n, q.n || 1), q.n || 1];
  };
  Gm.isDone = id => { const [a, b] = Gm.progress(id); return a >= b; };
  Gm.questEvent = function (type, target) {
    for (const [id, s] of Object.entries(S.quests.active)) {
      const q = Gm.qdef(id); if (!q || q.type !== type) continue;
      if (type === 'kill' && q.target === target) { s.n++; if (s.n === q.n) G.ui.note(`✔ ${q.name} สำเร็จแล้ว! กลับไปส่งภารกิจ`, 'gold'); }
      if ((type === 'puzzle' || type === 'dungeon') && q.target === target) { s.n = 1; G.ui.note(`✔ ${q.name} สำเร็จแล้ว!`, 'gold'); }
      if (type === 'talk' && q.target === target) s.n = 1;
    }
    G.ui.refresh();
  };
  Gm.turnInNpc = function (id) { const q = Gm.qdef(id); return q.type === 'talk' ? q.target : q.giver; };
  Gm.turnIn = function (id, choiceIdx) {
    const q = Gm.qdef(id); if (!q || !Gm.isDone(id)) return;
    if (q.type === 'gather') Gm.remove(q.target, q.n);
    const R = q.reward || {}; delete S.quests.active[id]; S.quests.done[id] = Date.now();
    if (R.exp) Gm.addExp(R.exp * (Gm.server && Gm.server.expMul || 1)); if (R.gold) Gm.addGold(R.gold);
    for (const [it, n] of R.items || []) Gm.add(it, n);
    if (R.lore) Gm.unlockLore(R.lore); if (R.affinity) Gm.addAffinity(q.giver, R.affinity); if (R.align) Gm.align(R.align);
    if (q.choice && choiceIdx !== undefined) { const c = q.choice[choiceIdx]; if (c.align) Gm.align(c.align); for (const [it, n] of c.items || []) Gm.add(it, n); if (c.stat) { S.stats[c.stat[0]] += c.stat[1]; Gm.recalc(); } }
    if (q.echo) { const E = D.ECHO; const w = `"${G.pick(E.who)}... ${G.pick(E.why)}" — ${G.pick(E.hint)}`; G.ui.dialogSimple('🔮 เสียงสะท้อน', w); S.echoes = (S.echoes || []).concat([w]).slice(-30); }
    G.ui.center('ภารกิจสำเร็จ', q.name); G.audio.sfx('puzzle'); Gm.markDirty(); G.ui.refresh();
  };

  // ---------- NPC relationships ----------
  Gm.npc = id => S.npc[id] || (S.npc[id] = { aff: 0, last: '', streak: 0, got: [], talks: 0, giftDay: '' });
  Gm.hearts = id => Math.min(10, Math.floor(Gm.npc(id).aff / D.AFFINITY_PER_HEART));
  Gm.addAffinity = function (id, n) {
    const ns = Gm.npc(id); const before = Gm.hearts(id); ns.aff = Math.min(1000, Math.max(0, ns.aff + Math.round(n * (1 + Gm.bonus('affinity')))));
    const after = Gm.hearts(id); if (after > before) { G.ui.note(`💗 ความสัมพันธ์กับ ${D.NPCS[id].name} เพิ่มเป็น ${after} หัวใจ!`, 'gold'); G.audio.sfx('levelup'); }
    for (let h = 1; h <= after; h++) { const r = D.NPCS[id].rewards[h]; if (r && !ns.got.includes(h)) { ns.got.push(h); Gm.npcReward(id, h, r); } }
    Gm.markDirty();
  };
  Gm.npcReward = function (id, h, r) {
    const nm = D.NPCS[id].name; const [type, v] = r;
    if (type === 'recipe') { if (!S.recipes.includes(v)) S.recipes.push(v); const rc = D.RECIPES.find(x => x.id === v); G.ui.chat(`💗 ${nm} สอนสูตร: ${D.ITEMS[rc.out].name}`, 'loot'); }
    else if (type === 'skill') { Gm.learnSkill(v); G.ui.chat(`💗 ${nm} สอนเวท: ${D.SKILLS[v].name}`, 'loot'); }
    else if (type === 'lore') Gm.unlockLore(v);
    else if (type === 'skillxp') { Gm.trainStat('wis', 60); }
    else { Gm.add(type, v); G.ui.chat(`💗 ${nm} มอบของขวัญให้คุณ (ความสัมพันธ์ ${h} หัวใจ)`, 'loot'); if (D.ITEMS[type] && D.ITEMS[type].unique) G.ui.center('ของขวัญล้ำค่า!', D.ITEMS[type].icon + ' ' + D.ITEMS[type].name); }
  };
  Gm.talk = function (id) {
    const ns = Gm.npc(id); const today = G.today(); ns.talks++;
    if (ns.last !== today) {
      const y = new Date(Date.now() - 864e5); const yest = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
      ns.streak = ns.last === yest ? ns.streak + 1 : 1; ns.last = today;
      Gm.addAffinity(id, 25 + Math.min(ns.streak, 7) * 5); Gm.act('social');
      if (ns.streak === 3 || ns.streak === 7) { Gm.add(ns.streak === 7 ? 'old_coin' : 'sweet_bun', ns.streak === 7 ? 1 : 2); G.ui.note(`🔥 คุยต่อเนื่อง ${ns.streak} วัน! ${D.NPCS[id].name} ให้ของขวัญพิเศษ`, 'gold'); }
      return { daily: true };
    }
    if (ns.talks % 5 === 0) Gm.addAffinity(id, 2);
    return { daily: false };
  };
  Gm.gift = function (id, u) {
    const ns = Gm.npc(id); const it = S.inv.find(x => x.uid === u); if (!it) return null; const n = D.NPCS[id]; const today = G.today();
    if (ns.giftDay === today && ns.giftsToday >= 2) return 'limit';
    if (ns.giftDay !== today) { ns.giftDay = today; ns.giftsToday = 0; } ns.giftsToday++;
    Gm.remove(it.id, 1); let pts = 15, re = 'neutral';
    if (n.loves.includes(it.id)) { pts = 120; re = 'love'; } else if (n.likes.includes(it.id)) { pts = 50; re = 'like'; } else if (n.dislikes.includes(it.id)) { pts = -40; re = 'dislike'; }
    if (D.ITEMS[it.id].rarity) pts += D.ITEMS[it.id].rarity * 15;
    Gm.addAffinity(id, pts); Gm.act('social', re === 'love' ? 3 : 1); if (re === 'love') Gm.align(1);
    return re;
  };

  // ---------- crafting & enhancement ----------
  Gm.recipes = () => D.RECIPES.filter(r => !r.locked || S.recipes.includes(r.id));
  Gm.canCraft = r => r.mats.every(([id, n]) => Gm.count(id) >= n);
  Gm.craft = function (rid) {
    const r = D.RECIPES.find(x => x.id === rid); if (!r || !Gm.canCraft(r)) return false;
    for (const [id, n] of r.mats) Gm.remove(id, n);
    const dbl = Math.random() < Gm.bonus('craftDouble'); Gm.add(r.out, r.qty * (dbl ? 2 : 1));
    if (dbl) G.ui.note('✨ ฝีมือช่าง! ได้ของเพิ่มเป็นสองเท่า', 'gold');
    G.audio.sfx('craft'); G.fx.burst(new THREE.Vector3(G.player.pos.x, G.player.pos.y + 1.2, G.player.pos.z), { n: 24, color: '#ffd77a', speed: 3 });
    Gm.act('craft'); return true;
  };
  Gm.enhanceCost = it => ({ stone: 1, gold: 100 * ((it.plus || 0) + 1) * ((it.plus || 0) + 1) });
  Gm.enhance = function (u, protect) {
    const it = Gm.byUid(u); if (!it) return; const def = D.ITEMS[it.id]; if (!['weapon', 'armor', 'helm', 'acc'].includes(def.type)) return;
    const p = it.plus || 0; if (p >= D.ENHANCE_MAX) return { res: 'max' };
    const cost = Gm.enhanceCost(it); if (Gm.count('enh_stone') < cost.stone || S.gold < cost.gold) return { res: 'cost' };
    if (protect && Gm.count('protect_scroll') < 1) return { res: 'noscroll' };
    Gm.remove('enh_stone', cost.stone); Gm.addGold(-cost.gold); if (protect) Gm.remove('protect_scroll', 1);
    const rate = Math.min(0.99, D.ENHANCE_RATE[p] + Gm.bonus('enhance') + S.stats.luk * 0.001); Gm.act('enhance');
    let res;
    if (Math.random() < rate) { it.plus = p + 1; res = 'ok'; G.audio.sfx('anvil'); }
    else if (p >= 7 && !protect && Math.random() < 0.3) { res = 'break'; const i = S.inv.findIndex(x => x.uid === u); if (i >= 0) S.inv.splice(i, 1); else for (const k in S.equip) if (S.equip[k] && S.equip[k].uid === u) S.equip[k] = null; G.audio.sfx('break'); }
    else if (p >= 5 && !protect) { it.plus = p - 1; res = 'down'; G.audio.sfx('fail'); }
    else { res = 'fail'; G.audio.sfx('fail'); }
    Gm.recalc(); Gm.markDirty(); G.ui.refresh(); G.player && G.player.refreshLook();
    if (res === 'ok' && it.plus >= 7) G.net.send({ t: 'chat', ch: 'all', msg: `✨ ตีบวก ${def.name} +${it.plus} สำเร็จ!` });
    return { res, rate, plus: it.plus };
  };

  // ---------- shop ----------
  Gm.buyPrice = id => Math.ceil(D.ITEMS[id].price * (1 - Gm.bonus('buy')));
  Gm.sellPrice = it => Math.floor(D.ITEMS[it.id].price * 0.4 * (1 + (it.plus || 0) * 0.3) * (1 + Gm.st.sell));
  Gm.buy = function (id, qty) { qty = qty || 1; const cost = Gm.buyPrice(id) * qty; if (S.gold < cost) { G.ui.note('ทองไม่พอ', 'red'); return false; } Gm.addGold(-cost); Gm.add(id, qty); Gm.act('trade', 0.5); return true; };
  Gm.sell = function (u, qty) { const it = S.inv.find(x => x.uid === u); if (!it) return; if (D.ITEMS[it.id].unique) { G.ui.note('ไอเทมความทรงจำขายไม่ได้', 'red'); return; } qty = Math.min(qty || it.qty, it.qty); const g = Gm.sellPrice(it) * qty; Gm.removeUid(u, qty); Gm.addGold(g); Gm.act('trade', 0.5 + Math.min(3, g / 300)); G.ui.refresh(); };

  // ---------- puzzles ----------
  Gm.completePuzzle = function (id) {
    const pz = D.PUZZLES[id]; if (!G.puzzles.ready(id)) return;
    S.puzzles[id] = { until: Date.now() + pz.cooldown * 1000, n: ((S.puzzles[id] && S.puzzles[id].n) || 0) + 1 };
    G.ui.center('ไขปริศนาสำเร็จ!', pz.name + ' · ' + pz.diff); G.audio.sfx('puzzle');
    G.fx.pillar(G.player.pos, { color: '#9fffe0', radius: 1.2, height: 9 }); G.fx.burst(new THREE.Vector3(G.player.pos.x, G.player.pos.y + 1, G.player.pos.z), { n: 60, color: '#ffd77a', color2: '#9fffe0', speed: 7 });
    const R = pz.reward; Gm.addExp(R.exp * (1 + Gm.bonus('speed'))); if (R.gold) Gm.addGold(R.gold); for (const [it, n] of R.items || []) Gm.add(it, n);
    if (R.lore && S.puzzles[id].n === 1) Gm.unlockLore(R.lore);
    Gm.act('puzzle'); Gm.questEvent('puzzle', id); Gm.markDirty();
  };

  // ---------- exploration ----------
  let distAcc = 0;
  Gm.travel = function (d) { distAcc += d; S.playTime += 0; if (distAcc > 30) { distAcc = 0; Gm.act('explore'); } };
  Gm.discover = function (key, name, exp) { if (S.explored[key]) return false; S.explored[key] = Date.now(); G.ui.note(`🗺️ ค้นพบ: ${name}`, 'gold'); if (exp) Gm.addExp(exp); Gm.act('explore', 4); Gm.markDirty(); return true; };

  // ---------- death ----------
  Gm.die = function () {
    const loss = Math.floor(D.expForLevel(S.lv) * 0.03); S.exp = Math.max(0, S.exp - loss); S.hp = 0; G.ui.chat(`คุณหมดสติ... เสีย EXP ${loss}`, 'err'); Gm.markDirty();
  };

  // ---------- persistence ----------
  let saveT = 0;
  Gm.markDirty = () => { Gm.dirty = true; };
  Gm.tick = function (dt) {
    for (const k in Gm.buffs) if (Gm.buffs[k] > 0) Gm.buffs[k] -= dt;
    S.playTime += dt; saveT += dt;
    if (Gm.dirty && saveT > 4) { saveT = 0; Gm.flush(); }
  };
  Gm.flush = function (force) {
    if (!S || !G.player) return; S.pos = [+G.player.pos.x.toFixed(1), +G.player.pos.y.toFixed(1), +G.player.pos.z.toFixed(1)];
    if (S.pos[0] > 2000) { const e = D.DUNGEON.entrance; S.pos = [e.x - 6, G.terrainH(e.x - 6, e.z) + 1, e.z]; }
    Gm.dirty = false; G.net.send({ t: 'save', data: S, flush: !!force });
  };
})();
