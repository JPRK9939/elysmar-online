/* HUD & windows: inventory/equipment, character/class/skills, crafting+enhancement, journal (quests/lore/puzzles),
   social (party/trade), world map, NPC dialogue with gifts & hearts, shops, waystones, help */
(function () {
  const U = G.ui = { open: {}, sel: null, party: { members: [], leader: null }, trade: null, refreshQ: false };
  const D = G.D; const $ = id => document.getElementById(id); const esc = G.esc;
  const S = () => G.S, Gm = () => G.game;
  const itemIcon = (it, extra) => { const d = D.ITEMS[it.id]; return `<div class="it r${d.rarity || 0} ${extra || ''}" data-uid="${it.uid}" title="${esc(d.name)}">${d.icon}${it.plus ? `<span class="pl">+${it.plus}</span>` : ''}${it.qty > 1 ? `<span class="q">${it.qty}</span>` : ''}</div>`; };
  const iname = it => { const d = D.ITEMS[it.id]; return `<span style="color:${D.RARITY[d.rarity || 0]}">${d.icon} ${esc(d.name)}${it.plus ? ' +' + it.plus : ''}</span>`; };
  const statLine = d => { const o = []; for (const [k, n] of [['atk', 'ATK'], ['matk', 'MATK'], ['def', 'DEF'], ['hp', 'HP'], ['mp', 'MP'], ['luk', 'LUK'], ['heal', 'ฮีล%']]) if (d[k]) o.push(`${n} +${k === 'heal' ? Math.round(d[k] * 100) : d[k]}`); if (d.wtype) o.unshift(D.WTYPES[d.wtype].name + ' · ' + { melee: 'ระยะประชิด', magic: 'เวทมนตร์', ranged: 'ระยะไกล' }[D.WTYPES[d.wtype].cat]); if (d.heal && d.type === 'consume') o.push('ฟื้น HP ' + d.heal); if (d.mana) o.push('ฟื้น MP ' + d.mana); return o.join(' · '); };

  U.init = function () {
    document.querySelectorAll('#menu-buttons button').forEach(b => b.onclick = () => U.togglePanel(b.dataset.p));
    $('btn-respawn').onclick = () => G.player.respawn();
    const ci = $('chat-input');
    ci.addEventListener('keydown', e => { if (e.key === 'Enter') { const v = ci.value.trim(); ci.value = ''; ci.blur(); if (v) U.sendChat(v); e.stopPropagation(); } });
    $('panels').addEventListener('click', onPanelClick);
    setInterval(() => { if (U.refreshQ) { U.refreshQ = false; U.render(); } }, 150);
    setInterval(U.drawMinimap, 200);
    U.render();
  };
  U.refresh = () => { U.refreshQ = true; };

  // ---------- feedback ----------
  U.note = function (text, color) { const el = document.createElement('div'); el.className = 'note ' + (color || ''); el.innerHTML = text; $('notify').prepend(el); setTimeout(() => el.remove(), 5000); while ($('notify').children.length > 6) $('notify').lastChild.remove(); };
  U.chat = function (text, cls, raw) { const el = document.createElement('div'); el.className = 'c-' + (cls || 'all'); if (raw) el.innerHTML = raw; else el.textContent = text; const log = $('chat-log'); log.appendChild(el); while (log.children.length > 120) log.firstChild.remove(); log.scrollTop = log.scrollHeight; };
  U.center = function (title, sub) { const el = document.createElement('div'); el.className = 'cm'; el.innerHTML = esc(title) + (sub ? `<small>${esc(sub)}</small>` : ''); $('center-msg').innerHTML = ''; $('center-msg').appendChild(el); };
  U.zone = function (name, lv) { const z = $('zone-name'); z.innerHTML = esc(name) + (lv && lv !== '-' ? `<div style="font-size:14px;text-align:center;font-family:Mitr">Lv. ${lv}</div>` : ''); z.style.opacity = 1; clearTimeout(U._zt); U._zt = setTimeout(() => z.style.opacity = 0, 3500); };
  U.hint = function (label) { const h = $('interact-hint'); if (!label) { h.classList.add('hidden'); return; } h.classList.remove('hidden'); const s = `<kbd>F</kbd> ${esc(label)}`; if (h._s !== s) { h.innerHTML = s; h._s = s; } };
  U.cast = function (frac, label) { const c = $('castbar'); if (!frac) { c.classList.add('hidden'); return; } c.classList.remove('hidden'); c.querySelector('i').style.width = (frac * 100) + '%'; c.querySelector('span').textContent = label; };
  U.puzzleTimer = function (t) { if (!t) { if (U._pt) { U._pt.remove(); U._pt = null; } return; } if (!U._pt) { U._pt = document.createElement('div'); U._pt.className = 'cm'; U._pt.style.animation = 'none'; U._pt.style.fontSize = '24px'; $('center-msg').appendChild(U._pt); } U._pt.textContent = t; };

  // ---------- HUD ----------
  U.render = function () {
    if (!S()) return; const s = S(), st = Gm().st;
    $('pf-name').textContent = s.name; $('pf-lv').textContent = 'Lv.' + s.lv; const c = Gm().cls(); $('pf-class').innerHTML = `<span style="color:${c.color}">${Gm().clsName()}</span> <span class="muted">· ${D.WTYPES[st.wtype].name}</span>`;
    const bar = (sel, v, m) => { const b = document.querySelector('#player-frame .bar.' + sel); b.querySelector('i').style.width = (Math.max(0, v) / m * 100) + '%'; b.querySelector('b').textContent = `${Math.round(v)} / ${m}`; };
    bar('hp', s.hp, st.maxHp); bar('mp', s.mp, st.maxMp); bar('xp', s.exp, D.expForLevel(s.lv));
    document.querySelector('.align-bar i').style.left = (50 - (s.align || 0) / 2) + '%';
    $('pf-gold').textContent = `💰 ${G.fmt(s.gold)} G`;
    // skillbar
    let sb = '';
    s.bar.forEach((id, i) => { const sk = id && D.SKILLS[id]; const cd = id ? G.player.cd[id] || 0 : 0; sb += `<div class="slot ${sk && s.mp < sk.mp ? 'nomp' : ''}" data-slot="${i}" title="${sk ? esc(sk.name + ' · MP ' + sk.mp + ' · CD ' + sk.cd + 's\n' + sk.desc) : 'ว่าง'}"><span class="key">${i + 1}</span>${sk ? sk.icon : ''}${cd > 0 ? `<div class="cd" style="transform:scaleY(${cd / sk.cd})"></div><span class="cdt">${cd.toFixed(0)}</span>` : ''}</div>`; });
    const hpN = ['hp_potion', 'hi_potion', 'herbal_tea', 'sweet_bun', 'elixir'].reduce((n, id) => n + Gm().count(id), 0), mpN = Gm().count('mp_potion') + Gm().count('elixir');
    sb += `<div class="slot sep" data-pot="hp" title="ยา HP (Q)"><span class="key">Q</span>🧪<span class="cnt">${hpN}</span></div><div class="slot" data-pot="mp" title="ยา MP (R)"><span class="key">R</span>💧<span class="cnt">${mpN}</span></div>`;
    const sbe = $('skillbar'); sbe.innerHTML = sb; sbe.onclick = e => { const sl = e.target.closest('.slot'); if (!sl) return; if (sl.dataset.pot) Gm().quickPotion(sl.dataset.pot); else G.player.useSkill(+sl.dataset.slot); };
    // quest tracker
    let qt = ''; for (const id of Object.keys(s.quests.active)) { const q = Gm().qdef(id); if (!q) continue; const [a, b] = Gm().progress(id); const done = a >= b; const who = D.NPCS[Gm().turnInNpc(id)];
      qt += `<div class="qt ${q.main ? 'main' : ''} ${done ? 'done' : ''}"><b>${q.main ? '⭐ ' : q.echo ? '🔮 ' : ''}${esc(q.name)}</b>${done ? `กลับไปหา ${who ? who.name : ''}` : questGoal(q) + ` (${a}/${b})`}</div>`; }
    $('quest-tracker').innerHTML = qt;
    // target
    const t = G.player.target; const tf = $('target-frame');
    if (t && !t.dead) { tf.classList.remove('hidden'); $('tf-name').innerHTML = `Lv.${t.def.lv} ${esc(t.def.name)} ${t.def.aggro ? '<span style="color:#ff8a8a">⚔</span>' : ''}`; tf.querySelector('i').style.width = (t.hp / t.maxHp * 100) + '%'; tf.querySelector('b').textContent = `${t.hp} / ${t.maxHp}`; } else tf.classList.add('hidden');
    // party
    let pf = ''; for (const m of U.party.members) { if (m.id === G.myId) continue; const c2 = D.CLASSES[(m.cls || 'novice').split(':')[0]] || D.CLASSES.novice; pf += `<div class="pm ${m.id === U.party.leader ? 'leader' : ''}"><span class="pm-n">${c2.icon} ${esc(m.name)}</span> <span class="muted">Lv.${m.lv}</span><div class="bar hp"><i style="width:${m.mhp ? m.hp / m.mhp * 100 : 0}%"></i></div></div>`; }
    $('party-frame').innerHTML = pf;
    for (const k of Object.keys(U.open)) { if (!U.open[k] || !PANELS[k] || k === 'map' || U.open[k].contains(document.activeElement) && document.activeElement.tagName === 'INPUT') continue; const b = U.open[k].querySelector('.body'); const sc = b.parentNode.scrollTop; b.innerHTML = PANELS[k].body(); b.parentNode.scrollTop = sc; }
  };
  const questGoal = q => q.type === 'kill' ? `กำจัด ${D.MONSTERS[q.target].name}` : q.type === 'gather' ? `รวบรวม ${D.ITEMS[q.target].name}` : q.type === 'talk' ? `คุยกับ ${D.NPCS[q.target].name}` : q.type === 'puzzle' ? `ไขปริศนา ${D.PUZZLES[q.target].name}` : q.type === 'dungeon' ? 'เคลียร์ดันเจี้ยน' : '';
  setInterval(() => { if (S() && G.player.model) { const sb = $('skillbar'); S().bar.forEach((id, i) => { const el = sb.children[i]; if (!el || !id) return; const sk = D.SKILLS[id]; const cd = G.player.cd[id] || 0; let c = el.querySelector('.cd'); if (cd > 0) { if (!c) { U.refresh(); return; } c.style.transform = `scaleY(${cd / sk.cd})`; el.querySelector('.cdt').textContent = cd.toFixed(0); } else if (c) U.refresh(); }); const s = S(), st = Gm().st; const hb = document.querySelector('#player-frame .bar.hp'); hb.querySelector('i').style.width = (s.hp / st.maxHp * 100) + '%'; hb.querySelector('b').textContent = `${Math.round(s.hp)} / ${st.maxHp}`; const mb = document.querySelector('#player-frame .bar.mp'); mb.querySelector('i').style.width = (s.mp / st.maxMp * 100) + '%'; mb.querySelector('b').textContent = `${Math.round(s.mp)} / ${st.maxMp}`; const t = G.player.target; if (t && !t.dead) { const tf = $('target-frame'); tf.querySelector('i').style.width = (t.hp / t.maxHp * 100) + '%'; tf.querySelector('b').textContent = `${t.hp} / ${t.maxHp}`; } else if (!$('target-frame').classList.contains('hidden')) U.refresh(); else if (t) U.refresh(); } }, 100);

  // ---------- panels ----------
  const PANELS = {};
  const pos = { inv: [null, 90, 300], char: [300, 90], craft: [300, 90], journal: [300, 90], social: [null, 90, 300], map: ['c', 70], help: ['c', 90], shop: [300, 90], trade: ['c', 120], ws: ['c', 140] };
  U.openPanel = function (k, title) {
    if (U.open[k]) return U.open[k]; const P = PANELS[k]; const el = document.createElement('div'); el.className = 'panel'; el.dataset.k = k;
    el.innerHTML = `<h3><span>${title || P.title}</span><button class="x" data-act="close">✕</button></h3><div class="body">${P.body()}</div>`;
    const [l, t, r] = pos[k] || [300, 90]; if (l === 'c') { el.style.left = '50%'; el.style.transform = 'translateX(-50%)'; } else if (l === null) el.style.right = (r || 20) + 'px'; else el.style.left = l + 'px'; el.style.top = t + 'px';
    $('panels').appendChild(el); U.open[k] = el; makeDrag(el); G.audio.sfx('ui'); return el;
  };
  U.closePanel = k => { if (U.open[k]) { U.open[k].remove(); delete U.open[k]; if (k === 'trade' && U.trade) G.net.send({ t: 'tcancel' }); } };
  U.togglePanel = k => U.open[k] ? U.closePanel(k) : U.openPanel(k);
  U.closeTop = function () { if ($('panels').querySelector('.dialog')) { $('panels').querySelector('.dialog').remove(); return true; } const ks = Object.keys(U.open); if (ks.length) { U.closePanel(ks[ks.length - 1]); return true; } const pm = document.querySelector('.pmenu'); if (pm) { pm.remove(); return true; } return false; };
  function makeDrag(el) { const h = el.querySelector('h3'); h.onmousedown = e => { if (e.target.dataset.act) return; const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop; el.style.transform = ''; el.style.right = ''; const mm = ev => { el.style.left = (ev.clientX - sx) + 'px'; el.style.top = Math.max(0, ev.clientY - sy) + 'px'; }; const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); }; addEventListener('mousemove', mm); addEventListener('mouseup', mu); }; }

  // ----- inventory -----
  PANELS.inv = { title: '🎒 กระเป๋า & อุปกรณ์', body() {
    const s = S(); let h = '<div class="equip">';
    for (const [k, n] of [['weapon', 'อาวุธ'], ['armor', 'เกราะ'], ['helm', 'หมวก'], ['acc', 'เครื่องประดับ']]) h += `<div>${n}${s.equip[k] ? itemIcon(s.equip[k], U.sel === s.equip[k].uid ? 'sel' : '') : '<div class="it empty">·</div>'}</div>`;
    h += '</div><div class="grid">'; const inv = s.inv; for (let i = 0; i < Math.max(36, inv.length); i++) h += inv[i] ? itemIcon(inv[i], U.sel === inv[i].uid ? 'sel' : '') : '<div class="it empty"></div>';
    h += `</div><div class="muted small" style="margin-top:6px">💰 ${G.fmt(s.gold)} G · ${inv.length} ช่อง · คลิกไอเทมเพื่อดูรายละเอียด</div>`;
    const it = U.sel && Gm().byUid(U.sel);
    if (it) { const d = D.ITEMS[it.id]; const eq = Object.values(s.equip).some(e => e && e.uid === it.uid); const slot = Object.keys(s.equip).find(k => s.equip[k] && s.equip[k].uid === it.uid);
      h += `<div class="tip"><div class="nm2">${iname(it)}</div><div class="small muted">${statLine(d)}</div>${d.desc ? `<div class="small">${esc(d.desc)}</div>` : ''}<div class="small muted">ราคาขาย ${Gm().sellPrice(it)} G</div><div class="acts">`;
      if (eq) h += `<button data-act="unequip" data-v="${slot}">ถอด</button>`; else if (['weapon', 'armor', 'helm', 'acc'].includes(d.type)) h += `<button data-act="equip" data-v="${it.uid}">สวมใส่</button>`;
      if (d.type === 'consume' && !eq) h += `<button data-act="use" data-v="${it.uid}">ใช้</button>`;
      if (U.open.shop && !eq) h += `<button data-act="sell" data-v="${it.uid}">ขาย</button>`;
      if (U.trade && !eq) h += `<button data-act="toffer" data-v="${it.uid}">ใส่ในการเทรด</button>`;
      if (!eq && !d.unique) h += `<button class="danger" data-act="drop" data-v="${it.uid}">ทิ้ง</button>`;
      h += '</div></div>'; } else h += '<div class="tip muted">เลือกไอเทม... อาวุธทุกชนิดใส่ได้ทุกอาชีพ</div>';
    return h; } };
  // ----- character -----
  PANELS.char = { title: '🧑 ตัวละคร', tab: 'stat', body() {
    const s = S(), st = Gm().st, tab = PANELS.char.tab; let h = `<div class="sub">${[['stat', 'สถานะ'], ['class', 'อาชีพ'], ['skill', 'สกิล']].map(([k, n]) => `<button data-act="tab" data-p="char" data-v="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (tab === 'stat') {
      h += `<div class="kv"><span>HP</span><span>${st.maxHp}</span><span>MP</span><span>${st.maxMp}</span><span>ATK</span><span>${st.atk}</span><span>MATK</span><span>${st.matk}</span><span>DEF</span><span>${st.def}</span><span>คริติคอล</span><span>${(st.crit * 100).toFixed(1)}%</span><span>พลังฮีล</span><span>${st.heal}</span><span>ความเร็ว</span><span>${st.moveSpd.toFixed(1)}</span></div><hr style="border-color:var(--line)">`;
      h += '<div class="muted small" style="margin-bottom:4px">สเตตัสเพิ่มจากการใช้งานจริง ไม่มีแต้มให้กด</div>';
      for (const [k, n] of Object.entries(D.STAT_NAMES)) { const need = 8 + s.stats[k] * 4; h += `<div class="stat-row"><span>${n}</span><b>${s.stats[k]}</b><div class="mini"><i style="width:${(s.statXp[k] / need * 100).toFixed(0)}%"></i></div></div>`; }
      h += `<div class="small muted" style="margin-top:6px">STR←ตีประชิด · INT←ใช้เวท/ไขปริศนา · DEX←ยิงธนู/หลบ · VIT←รับดาเมจ · WIS←ฮีล · LUK←คราฟ/ตีบวก/เก็บของ · CHA←คุย/เทรด</div>`;
      h += `<div class="small" style="margin-top:6px">☀/☾ แนวทาง: <b>${s.align > 20 ? 'ผู้นำแสง' : s.align < -20 ? 'ผู้เดินในรัตติกาล' : 'ผู้อยู่กึ่งกลาง'}</b> (${s.align}) · เวลาเล่น ${Math.floor(s.playTime / 60)} นาที</div>`;
    } else if (tab === 'class') {
      const sc = Gm().classScores(); const max = Math.max(D.CLASS_T2, ...Object.values(sc));
      h += `<div>อาชีพปัจจุบัน: <b style="color:${Gm().cls().color}">${Gm().clsName()}</b></div><div class="small muted" style="margin:4px 0 8px">อาชีพเปลี่ยนตามพฤติกรรมล่าสุดของคุณ (คะแนนเก่าค่อย ๆ จางลง) · ขั้น 1 ที่ ${D.CLASS_T1} คะแนน · ขั้น 2 ที่ ${D.CLASS_T2} + Lv.${D.CLASS_T2_LV} (ชื่อขึ้นกับแสง/ความมืด)</div>`;
      for (const [k, c] of Object.entries(D.CLASSES)) { if (!c.act) continue; const v = sc[k] || 0; h += `<div class="cls-row"><span>${c.icon}</span><span style="color:${c.color}">${c.name}</span><div class="mini"><i style="width:${(v / max * 100).toFixed(0)}%;background:${c.color}"></i></div><span class="small">${v.toFixed(0)}</span></div>`; }
      const b = Gm().cls().bonus; h += `<div class="tip small">โบนัสอาชีพ: ${Object.keys(b).length ? Object.entries(b).map(([k, v]) => `${k} +${Math.round(v * (Gm().clsTier() === 2 ? 2 : 1) * 100)}%`).join(' · ') : 'ไม่มี (ยังเป็นผู้หลงทาง)'}<br>การกระทำทั้งหมด: ${Object.entries(s.acts).map(([k, v]) => `${k} ${Math.floor(v)}`).join(' · ') || '-'}</div>`;
    } else {
      h += '<div class="small muted">คลิกสกิล แล้วคลิกช่องด้านล่างเพื่อจัดลงแถบสกิล · สกิลใหม่ปลดล็อกจากการใช้งานและความสัมพันธ์กับ NPC</div>';
      for (const [id, sk] of Object.entries(D.SKILLS)) { const has = s.skills.includes(id); const u = sk.unlock; const req = !u ? 'เริ่มต้น' : u.act ? `${u.act} ${Math.floor(s.acts[u.act] || 0)}/${u.n}` : `${D.NPCS[u.npc].name} ♥${u.hearts}`;
        h += `<div class="list-row" style="${has ? '' : 'opacity:.45'}${U.selSkill === id ? ';border-color:var(--gold)' : ''}" ${has ? `data-act="selskill" data-v="${id}"` : ''}><span style="font-size:22px">${sk.icon}</span><div><b>${sk.name}</b> <span class="small muted">MP ${sk.mp} · CD ${sk.cd}s</span><div class="small muted">${sk.desc}</div></div><span class="r small">${has ? '✔' : req}</span></div>`; }
      h += '<div style="display:flex;gap:6px;margin-top:8px">' + [0, 1, 2, 3, 4, 5].map(i => `<div class="slot" data-act="setbar" data-v="${i}"><span class="key">${i + 1}</span>${s.bar[i] ? D.SKILLS[s.bar[i]].icon : ''}</div>`).join('') + '</div>';
    }
    return h; } };
  // ----- crafting & enhancement -----
  PANELS.craft = { title: '🔨 คราฟ & ตีบวก', tab: 'craft', body() {
    const tab = PANELS.craft.tab; let h = `<div class="sub"><button data-act="tab" data-p="craft" data-v="craft" class="${tab === 'craft' ? 'on' : ''}">คราฟของ</button><button data-act="tab" data-p="craft" data-v="enh" class="${tab === 'enh' ? 'on' : ''}">ตีบวก</button></div>`;
    if (tab === 'craft') {
      for (const r of Gm().recipes()) { const d = D.ITEMS[r.out]; const ok = Gm().canCraft(r);
        h += `<div class="list-row"><span style="font-size:22px">${d.icon}</span><div><span style="color:${D.RARITY[d.rarity || 0]}">${d.name}</span>${r.qty > 1 ? ' x' + r.qty : ''}<div class="mats">${r.mats.map(([id, n]) => `<span class="${Gm().count(id) >= n ? 'ok' : 'no'}">${D.ITEMS[id].icon}${D.ITEMS[id].name} ${Gm().count(id)}/${n}</span>`).join(' · ')}</div></div><div class="r"><button data-act="craft" data-v="${r.id}" ${ok ? '' : 'disabled'}>สร้าง</button></div></div>`; }
      const locked = D.RECIPES.filter(r => r.locked && !S().recipes.includes(r.id)).length; if (locked) h += `<div class="small muted">🔒 อีก ${locked} สูตรลับ — ปลดล็อกจากความสัมพันธ์กับ NPC</div>`;
    } else {
      const all = [...Object.values(S().equip).filter(Boolean), ...S().inv.filter(i => ['weapon', 'armor', 'helm', 'acc'].includes(D.ITEMS[i.id].type))];
      h += `<div class="small muted">หินตีบวก: ${Gm().count('enh_stone')} · สกรอลป้องกัน: ${Gm().count('protect_scroll')} · ทอง: ${G.fmt(S().gold)}<br>+5 ขึ้นไปล้มเหลวจะลดระดับ · +8 ขึ้นไปมีโอกาสแตก 30% (ใช้สกรอลป้องกันได้)</div>`;
      for (const it of all) { const p = it.plus || 0; const c = Gm().enhanceCost(it); const rate = p < 10 ? Math.min(99, Math.round((D.ENHANCE_RATE[p] + Gm().bonus('enhance') + S().stats.luk * 0.001) * 100)) : 0;
        h += `<div class="list-row">${itemIcon(it)}<div>${iname(it)}<div class="mats">${p >= 10 ? 'สูงสุดแล้ว' : `→ +${p + 1} · โอกาส ${rate}% · 💠1 · ${G.fmt(c.gold)}G`}</div></div><div class="r">${p < 10 ? `<button data-act="enh" data-v="${it.uid}">ตีบวก</button><button data-act="enhp" data-v="${it.uid}" title="ใช้สกรอลป้องกัน">🛡</button>` : ''}</div></div>`; }
      if (!all.length) h += '<div class="muted">ไม่มีอุปกรณ์</div>';
    }
    return h; } };
  // ----- journal -----
  PANELS.journal = { title: '📖 บันทึกการเดินทาง', tab: 'quest', body() {
    const s = S(), tab = PANELS.journal.tab; let h = `<div class="sub">${[['quest', 'ภารกิจ'], ['lore', 'ความทรงจำ'], ['puzzle', 'ปริศนา'], ['npc', 'ความสัมพันธ์']].map(([k, n]) => `<button data-act="tab" data-p="journal" data-v="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (tab === 'quest') { const act = Object.keys(s.quests.active); if (!act.length) h += '<div class="muted">ไม่มีภารกิจ — ไปคุยกับ NPC ที่มีเครื่องหมาย ! เหนือหัว</div>';
      for (const id of act) { const q = Gm().qdef(id); const [a, b] = Gm().progress(id); h += `<div class="lore-entry"><b>${q.main ? '⭐ ' : ''}${esc(q.name)}</b> <span class="small muted">${a}/${b}</span><br>${esc(q.text)}</div>`; }
      h += `<div class="small muted">เนื้อเรื่องหลักสำเร็จ ${Object.keys(s.quests.done).filter(k => D.QUESTS[k] && D.QUESTS[k].main).length}/9 · เสียงสะท้อนที่ได้ยิน ${(s.echoes || []).length}</div>`;
      for (const w of (s.echoes || []).slice(-5).reverse()) h += `<div class="lore-entry small">🔮 ${esc(w)}</div>`; }
    else if (tab === 'lore') { h += `<div class="small muted">เศษความทรงจำ ${s.lore.length}/${Object.keys(D.LORE).length} — ความจริงของโลกที่ถูกความมืดครอบงำ... และตัวคุณ</div>`; for (const [n, l] of Object.entries(D.LORE)) h += s.lore.includes(+n) ? `<div class="lore-entry"><b>#${n} ${esc(l.title)}</b><br>${esc(l.text)}</div>` : `<div class="lore-entry muted">#${n} ??? </div>`; }
    else if (tab === 'puzzle') { for (const [id, p] of Object.entries(D.PUZZLES)) { const r = G.puzzles.ready(id); const n = (s.puzzles[id] && s.puzzles[id].n) || 0; h += `<div class="list-row"><span>${p.hard ? '🔥' : '🧩'}</span><div><b>${p.name}</b> <span class="small muted">${p.diff}</span><div class="small muted">${({ jump: 'กระโดดข้ามแพลตฟอร์ม', brazier: 'จุดไฟตามลำดับ', simon: 'จำลำดับแสง', rings: 'วิ่งผ่านวงแหวนจับเวลา', lanterns: 'โจมตีตะเกียงภายในเวลา' })[p.kind]} · พิกัด (${p.pos[0]}, ${p.pos[1]}) · สำเร็จ ${n} ครั้ง</div></div><span class="r small">${r ? '✨ พร้อม' : G.puzzles.cdLeft(id) + ' วิ'}</span></div>`; } }
    else { for (const [id, n] of Object.entries(D.NPCS)) { const ns = Gm().npc(id); const h2 = Gm().hearts(id); h += `<div class="list-row"><b>${n.name}</b><span class="small muted">${n.title}</span><span class="r"><span style="color:#ff8fb1">${'♥'.repeat(h2)}${'♡'.repeat(10 - h2)}</span> <span class="small muted">🔥${ns.streak || 0} วัน</span></span></div><div class="small muted" style="margin:-4px 0 6px 10px">ชอบ: ${n.likes.concat(n.loves).map(i => D.ITEMS[i].icon).join(' ')} ${ns.aff >= 200 ? '' : '(ข้อมูลเพิ่มเมื่อสนิทกันมากขึ้น)'}</div>`; } }
    return h; } };
  // ----- social -----
  PANELS.social = { title: '👥 ปาร์ตี้ & ผู้เล่น', body() {
    let h = `<div class="small muted">เซิร์ฟเวอร์: <b>${esc(Gm().server ? Gm().server.name : '')}</b> · ${G.net.online ? 'ออนไลน์' : 'ออฟไลน์ (เล่นคนเดียว)'}</div><h4 style="margin:8px 0 4px">ปาร์ตี้ (${U.party.members.length || 1}/6)</h4>`;
    if (U.party.members.length) { for (const m of U.party.members) h += `<div class="list-row">${m.id === U.party.leader ? '👑' : '·'} ${esc(m.name)} <span class="small muted">Lv.${m.lv} ${(D.CLASSES[(m.cls || 'novice').split(':')[0]] || {}).name || ''}</span><span class="r">${U.party.leader === G.myId && m.id !== G.myId ? `<button data-act="pkick" data-v="${m.id}">เตะ</button>` : ''}</span></div>`; h += '<button data-act="pleave">ออกจากปาร์ตี้</button>'; }
    else h += '<div class="muted small">ยังไม่มีปาร์ตี้ — คลิกที่ผู้เล่นคนอื่น หรือพิมพ์ /party ชื่อ · ปาร์ตี้แบ่ง EXP และได้โบนัส +15% ต่อสมาชิก</div>';
    h += '<h4 style="margin:12px 0 4px">ผู้เล่นใกล้เคียง</h4>'; const near = [...G.ents.players.values()].map(p => ({ p, d: Math.hypot(p.x - G.player.pos.x, p.z - G.player.pos.z) })).sort((a, b) => a.d - b.d).slice(0, 12);
    if (!near.length) h += '<div class="muted small">ไม่มีผู้เล่นใกล้ ๆ</div>';
    for (const { p, d } of near) h += `<div class="list-row">${esc(p.name)} <span class="small muted">Lv.${p.lv} · ${d.toFixed(0)}m</span><span class="r"><button data-act="pinvite" data-v="${esc(p.name)}">ชวนปาร์ตี้</button><button data-act="treq" data-v="${esc(p.name)}">เทรด</button></span></div>`;
    return h; } };
  // ----- map -----
  PANELS.map = { title: '🗺️ แผนที่โลกเอลิสมาร์', body() { setTimeout(U.drawBigMap, 0); return '<canvas id="bigmap" class="mapbig" width="560" height="560"></canvas><div class="small muted">คลิกหินเคลื่อนย้ายที่ค้นพบแล้วในโลกเพื่อวาร์ป · ⭐ ปริศนา · 💀 ดันเจี้ยน · 🟢 NPC</div>'; } };
  // ----- help -----
  PANELS.help = { title: '❔ วิธีเล่น', body() { return `<div class="help-grid"><b>WASD</b><span>เดิน (Shift วิ่งเร็ว)</span><b>Space</b><span>กระโดด</span><b>ลากเมาส์</b><span>หมุนกล้อง 360° รอบตัวละคร · ล้อเมาส์ซูม</span><b>คลิกซ้าย</b><span>โจมตี / เลือกเป้าหมาย (โจมตีอัตโนมัติ)</span><b>Tab</b><span>สลับเป้าหมาย</span><b>1-6</b><span>สกิล</span><b>Q / R</b><span>ยา HP / MP</span><b>F</b><span>คุย/เก็บของ/โต้ตอบ</span><b>I K O J P M</b><span>กระเป๋า · ตัวละคร · คราฟ · บันทึก · ปาร์ตี้ · แผนที่</span><b>Enter</b><span>แชท (/w ชื่อ ข้อความ, /p ข้อความปาร์ตี้, /party ชื่อ, /trade ชื่อ)</span></div>
    <div class="tip small"><b>อาชีพเปลี่ยนตามพฤติกรรม:</b> ตีมอนประชิดบ่อย → นักรบ · ใช้เวท → จอมเวท · ยิงธนู → นักล่า · ฮีล → นักบวช · คราฟ/ตีบวก → ช่างฝีมือ · สำรวจ/ไขปริศนา → นักสำรวจ · ซื้อขาย → พ่อค้า · คุยกับ NPC → นักกวี<br>อาวุธทุกแบบใส่ได้ทุกอาชีพ สเตตัสเติบโตจากสิ่งที่คุณทำจริง</div>
    <div class="tip small"><b>NPC:</b> คุยทุกวันต่อเนื่องเพื่อเพิ่มหัวใจ · ให้ของขวัญที่ชอบ (วันละ 2 ชิ้น) · ทำภารกิจ — ทุกระดับหัวใจจะได้ของตอบแทน สูตรลับ สกิล หรือไอเทมเฉพาะตัวที่ 10 หัวใจ</div>
    <div class="tip small">เสียง: เพลง <input type="range" min="0" max="1" step="0.05" value="${G.audio.vol.music}" data-act="vol" data-v="music"> เอฟเฟกต์ <input type="range" min="0" max="1" step="0.05" value="${G.audio.vol.sfx}" data-act="vol" data-v="sfx"><br><button data-act="savequit">บันทึก & กลับหน้าเลือกเซิร์ฟเวอร์</button></div>`; } };
  // ----- shop -----
  PANELS.shop = { title: '🛒 ร้านค้า', kind: 'general', body() {
    const list = D.SHOPS[PANELS.shop.kind] || []; let h = `<div class="small muted">💰 ${G.fmt(S().gold)} G · คลิกไอเทมในกระเป๋า (I) แล้วกด "ขาย" เพื่อขายของ</div>`;
    for (const id of list) { const d = D.ITEMS[id]; h += `<div class="list-row"><span style="font-size:22px">${d.icon}</span><div><span style="color:${D.RARITY[d.rarity || 0]}">${d.name}</span><div class="small muted">${statLine(d)}</div></div><div class="r">${Gm().buyPrice(id)}G <button data-act="buy" data-v="${id}">ซื้อ</button>${D.STACKABLE(d.type) ? `<button data-act="buy10" data-v="${id}">x10</button>` : ''}</div></div>`; }
    return h; } };
  // ----- trade -----
  PANELS.trade = { title: '🤝 เทรด', body() {
    const T = U.trade; if (!T || !T.me) return '<div class="muted">กำลังเปิดการเทรด...</div>';
    const col = (o, mine) => `<div><h4>${esc(o.name)} ${o.lock ? '<span class="lockd">🔒ล็อก</span>' : ''} ${o.ok ? '<span class="lockd">✔ยืนยัน</span>' : ''}</h4><div class="grid">${o.items.map(i => itemIcon(i, mine ? 'tradeitem' : '')).join('')}</div><div>💰 ${G.fmt(o.gold)} G</div></div>`;
    return `<div class="trade-cols">${col(T.me, true)}${col(T.them)}</div><div class="small muted">เลือกไอเทมจากกระเป๋า (I) แล้วกด "ใส่ในการเทรด" · คลิกไอเทมฝั่งคุณเพื่อเอาออก</div>
    <div style="display:flex;gap:6px;margin-top:8px;align-items:center"><input id="trade-gold" type="number" min="0" value="${T.me.gold}" style="width:110px"><button data-act="tgold">ตั้งทอง</button><button data-act="tlock" ${T.me.lock ? 'disabled' : ''}>🔒 ล็อก</button><button data-act="tconfirm" ${T.me.lock && T.them.lock && !T.me.ok ? '' : 'disabled'} class="primary" style="padding:8px">ยืนยันเทรด</button><button data-act="close">ยกเลิก</button></div>`; } };
  // ----- waystones -----
  PANELS.ws = { title: '💎 หินเคลื่อนย้าย', body() { let h = '<div class="small muted">วาร์ปไปยังหินที่เคยค้นพบแล้ว</div>'; for (const w of G.world.waystones) { const ok = S().explored['ws_' + w.id]; h += `<div class="list-row">💎 ${w.name}<span class="r">${ok ? `<button data-act="warp" data-v="${w.id}">วาร์ป</button>` : '<span class="small muted">ยังไม่ค้นพบ</span>'}</span></div>`; } return h; } };
  U.openWaystones = () => U.openPanel('ws');

  // ---------- panel clicks ----------
  function onPanelClick(e) {
    const el = e.target.closest('[data-act],[data-uid]'); if (!el) return; const act = el.dataset.act, v = el.dataset.v;
    const panel = el.closest('.panel'); const pk = panel && panel.dataset.k;
    if (!act && el.dataset.uid) { if (pk === 'trade' && el.classList.contains('tradeitem')) { U.trade.offer = U.trade.offer.filter(u => u !== el.dataset.uid); sendOffer(); return; } U.sel = U.sel === el.dataset.uid ? null : el.dataset.uid; if (pk !== 'inv') U.openPanel('inv'); U.render(); return; }
    switch (act) {
      case 'close': if (panel) U.closePanel(pk); else el.closest('.dialog') && el.closest('.dialog').remove(); break;
      case 'tab': PANELS[el.dataset.p].tab = v; U.render(); break;
      case 'equip': Gm().equip(v); U.sel = null; break; case 'unequip': Gm().unequip(v); U.sel = null; break; case 'use': Gm().use(v); break;
      case 'sell': Gm().sell(v); U.sel = null; break; case 'drop': if (confirm('ทิ้งไอเทมนี้?')) { Gm().removeUid(v); U.sel = null; U.render(); } break;
      case 'craft': Gm().craft(v); U.render(); break;
      case 'enh': case 'enhp': { const it = Gm().byUid(v); const r = Gm().enhance(v, act === 'enhp'); if (!r) break; showEnh(r, it); break; }
      case 'buy': Gm().buy(v, 1); break; case 'buy10': Gm().buy(v, 10); break;
      case 'selskill': U.selSkill = v; U.render(); break;
      case 'setbar': if (U.selSkill) { const b = S().bar; const ex = b.indexOf(U.selSkill); if (ex >= 0) b[ex] = b[+v] || null; b[+v] = U.selSkill; U.selSkill = null; Gm().markDirty(); U.render(); } break;
      case 'pinvite': G.net.send({ t: 'pinvite', name: v }); break; case 'treq': G.net.send({ t: 'treq', name: v }); break;
      case 'pleave': G.net.send({ t: 'pleave' }); break; case 'pkick': G.net.send({ t: 'pkick', id: v }); break;
      case 'toffer': if (U.trade && !U.trade.offer.includes(v)) { U.trade.offer.push(v); sendOffer(); } break;
      case 'tgold': U.trade.gold = Math.max(0, Math.min(S().gold, +$('trade-gold').value || 0)); sendOffer(); break;
      case 'tlock': G.net.send({ t: 'tlock' }); break; case 'tconfirm': G.net.send({ t: 'tconfirm' }); break;
      case 'warp': { const w = G.world.waystones.find(x => x.id === v); if (w) { if (G.player.pos.x > 2000) { U.note('วาร์ปในดันเจี้ยนไม่ได้', 'red'); break; } G.player.teleport(w.x + 2, w.z + 3); U.closePanel('ws'); U.closePanel('map'); } break; }
      case 'savequit': Gm().flush(true); setTimeout(() => location.reload(), 400); break;
    }
  }
  $('panels') && $('panels').addEventListener('input', e => { if (e.target.dataset.act === 'vol') G.audio.setVol(e.target.dataset.v, +e.target.value); });
  function sendOffer() { G.net.send({ t: 'toffer', uids: U.trade.offer, gold: U.trade.gold || 0 }); }
  function showEnh(r, it) {
    const d = D.ITEMS[it.id]; const msg = { ok: `✨ สำเร็จ! ${d.name} +${r.plus}`, fail: 'ล้มเหลว... ระดับคงเดิม', down: `ล้มเหลว! ระดับลดลงเป็น +${r.plus}`, break: `💥 ${d.name} แตกสลาย!`, cost: 'หินตีบวกหรือทองไม่พอ', max: 'ตีบวกสูงสุดแล้ว', noscroll: 'ไม่มีสกรอลป้องกัน' }[r.res];
    U.note(msg, r.res === 'ok' ? 'gold' : 'red'); if (r.res === 'ok') { G.fx.pillar(G.player.pos, { color: '#ffd77a', radius: 1, height: 6 }); if (r.plus >= 7) U.center('ตีบวกสำเร็จ!', d.name + ' +' + r.plus); }
    if (r.res === 'break') G.fx.burst(new THREE.Vector3(G.player.pos.x, G.player.pos.y + 1.2, G.player.pos.z), { n: 40, color: '#888', speed: 6, grav: 10 }); U.render();
  }

  // ---------- NPC dialogue ----------
  U.dialogSimple = function (title, html) { const old = $('panels').querySelector('.dialog'); if (old) old.remove(); const d = document.createElement('div'); d.className = 'dialog'; d.innerHTML = `<div class="who">${esc(title)}</div><div class="text">${html}</div><div class="opts2"><button data-act="close">ปิด</button></div>`; $('panels').appendChild(d); };
  U.openNpc = function (id, mode) {
    const n = D.NPCS[id]; const old = $('panels').querySelector('.dialog'); if (old) old.remove();
    const d = document.createElement('div'); d.className = 'dialog'; $('panels').appendChild(d); G.audio.sfx('talk');
    // talking to a quest target completes "talk" quests
    for (const [qid, st] of Object.entries(S().quests.active)) { const q = Gm().qdef(qid); if (q.type === 'talk' && q.target === id && !st.n) { st.n = 1; } }
    const r = mode ? null : Gm().talk(id); const h = Gm().hearts(id);
    const line = n.lines[Math.min(n.lines.length - 1, Math.floor(h / 2))];
    let text = mode === 'gift' ? 'จะให้อะไรฉันเหรอ? (วันละ 2 ชิ้น)' : esc(line) + (r && r.daily ? ` <span class="small" style="color:#ff8fb1">(+ความสัมพันธ์ · คุยต่อเนื่อง ${Gm().npc(id).streak} วัน)</span>` : '');
    let opts = '';
    if (mode === 'gift') { const gifts = S().inv.filter(i => D.ITEMS[i.id].type !== 'weapon' && D.ITEMS[i.id].type !== 'armor' && D.ITEMS[i.id].type !== 'helm' && !D.ITEMS[i.id].unique); text += '<div class="grid" style="margin-top:8px">' + gifts.map(i => `<div class="it r${D.ITEMS[i.id].rarity || 0}" data-act="give" data-v="${i.uid}" title="${esc(D.ITEMS[i.id].name)}">${D.ITEMS[i.id].icon}${i.qty > 1 ? `<span class="q">${i.qty}</span>` : ''}</div>`).join('') + '</div>'; opts = '<button data-act="back">กลับ</button>'; }
    else {
      for (const qid of Object.keys(S().quests.active)) { const q = Gm().qdef(qid); if (Gm().isDone(qid) && Gm().turnInNpc(qid) === id) { if (q.choice) q.choice.forEach((c, i) => opts += `<button class="primary" style="padding:8px" data-act="turnin" data-v="${qid}" data-c="${i}">✔ ${esc(c.text)}</button>`); else opts += `<button class="primary" style="padding:8px" data-act="turnin" data-v="${qid}">✔ ส่งภารกิจ: ${esc(q.name)}</button>`; } }
      for (const qid of Gm().available(id)) { const q = qid === 'echo:new' ? { name: 'ตามหาเสียงสะท้อนใหม่', main: true } : D.QUESTS[qid]; opts += `<button data-act="qinfo" data-v="${qid}">${q.main ? '⭐' : '❗'} ${esc(q.name)}</button>`; }
      opts += `<button data-act="gift">🎁 ให้ของขวัญ</button>`;
      if (n.shop) opts += `<button data-act="shop" data-v="${n.shop}">🛒 ร้านค้า</button>`;
      if (id === 'fenn') opts += `<button data-act="enhpanel">🔨 ตีบวก</button>`;
      opts += `<button data-act="close">ลาก่อน</button>`;
    }
    d.innerHTML = `<div class="who">${n.name}<small>${n.title}</small></div><div class="hearts">${'♥'.repeat(h)}${'♡'.repeat(10 - h)} <span class="small muted">${Gm().npc(id).aff % 100}/100</span></div><div class="text">${text}</div><div class="opts2">${opts}</div>`;
    d.onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, v = b.dataset.v;
      if (a === 'close') d.remove(); else if (a === 'back') U.openNpc(id, null); else if (a === 'gift') U.openNpc(id, 'gift');
      else if (a === 'give') { const res = Gm().gift(id, v); const say = { love: '💖 นี่มัน...! ของที่ฉันชอบที่สุดเลย ขอบคุณมาก!', like: '😊 ขอบใจนะ ฉันชอบสิ่งนี้', neutral: 'อืม... ขอบใจ', dislike: '😣 เอ่อ... ฉันไม่ค่อยชอบสิ่งนี้เท่าไหร่', limit: 'วันนี้ให้มามากพอแล้วล่ะ พรุ่งนี้ค่อยมาใหม่นะ' }[res]; U.openNpc(id, 'gift'); d.remove(); U.dialogSimple(n.name, say); G.audio.sfx(res === 'love' || res === 'like' ? 'heal' : 'ui'); }
      else if (a === 'qinfo') { const q = v === 'echo:new' ? { name: 'ตามหาเสียงสะท้อน', text: 'เสียงสะท้อนจากอดีตยังคงดังอยู่ทั่วเอลิสมาร์ ทุกเสียงจะเล่าความจริงที่ต่างกัน... เจ้าจะเชื่อเสียงไหน?', reward: {} } : D.QUESTS[v];
        d.querySelector('.text').innerHTML = `<b>${esc(q.name)}</b><br>${esc(q.text)}<div class="small muted" style="margin-top:6px">รางวัล: ${q.reward.exp ? q.reward.exp + ' EXP ' : ''}${q.reward.gold ? q.reward.gold + 'G ' : ''}${(q.reward.items || []).map(([i, c]) => D.ITEMS[i].icon + 'x' + c).join(' ')}${q.reward.lore ? ' 📜เศษความทรงจำ' : ''}</div>`;
        d.querySelector('.opts2').innerHTML = `<button class="primary" style="padding:8px" data-act="accept" data-v="${v}">รับภารกิจ</button><button data-act="back">ไว้ก่อน</button>`; }
      else if (a === 'accept') { Gm().accept(v); U.openNpc(id, 'after'); }
      else if (a === 'turnin') { Gm().turnIn(v, b.dataset.c !== undefined ? +b.dataset.c : undefined); Gm().addAffinity(id, 20); U.openNpc(id, 'after'); }
      else if (a === 'shop') { d.remove(); PANELS.shop.kind = v; U.closePanel('shop'); U.openPanel('shop', '🛒 ร้านของ' + n.name); U.openPanel('inv'); }
      else if (a === 'enhpanel') { d.remove(); PANELS.craft.tab = 'enh'; U.openPanel('craft'); U.render(); }
    };
    U.refresh();
  };
  U.confirmDungeon = function () {
    const lv = D.DUNGEON.minLv; U.dialogSimple(D.DUNGEON.name, `ดันเจี้ยนปาร์ตี้ 4 ระลอก + บอส "ผู้พิทักษ์แห่งเสียงสะท้อน"<br><span class="small muted">ต้อง Lv.${lv}+ · หัวหน้าปาร์ตี้เปิดได้ สมาชิกในระยะ 40m จะถูกดึงเข้าไปด้วย · เล่นคนเดียวก็ได้ (ยากมาก)</span>`);
    const dl = $('panels').querySelector('.dialog'); const b = document.createElement('button'); b.className = 'primary'; b.style.padding = '8px'; b.textContent = 'เข้าสู่ดันเจี้ยน'; b.onclick = () => { G.net.send({ t: 'dgEnter' }); dl.remove(); }; dl.querySelector('.opts2').prepend(b);
  };
  U.playerMenu = function (pl, x, y) {
    document.querySelectorAll('.pmenu').forEach(m => m.remove()); const m = document.createElement('div'); m.className = 'panel pmenu'; m.style.left = x + 'px'; m.style.top = y + 'px'; m.style.minWidth = '160px'; m.style.padding = '8px';
    m.innerHTML = `<b>${esc(pl.name)}</b> <span class="small muted">Lv.${pl.lv}</span><div style="display:flex;flex-direction:column;gap:4px;margin-top:6px"><button data-a="p">👥 ชวนเข้าปาร์ตี้</button><button data-a="t">🤝 ขอเทรด</button><button data-a="w">💬 กระซิบ</button></div>`;
    m.onclick = e => { const a = e.target.dataset.a; if (a === 'p') G.net.send({ t: 'pinvite', name: pl.name }); if (a === 't') G.net.send({ t: 'treq', name: pl.name }); if (a === 'w') { const ci = $('chat-input'); ci.value = '/w ' + pl.name + ' '; ci.focus(); } m.remove(); };
    $('panels').appendChild(m); setTimeout(() => addEventListener('mousedown', function h(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('mousedown', h); } }), 0);
  };
  U.ask = function (text, onYes) { const d = document.createElement('div'); d.className = 'dialog'; d.style.bottom = '200px'; d.innerHTML = `<div class="text">${text}</div><div class="opts2"><button class="primary" style="padding:8px" data-a="y">ตอบรับ</button><button data-a="n">ปฏิเสธ</button></div>`; d.onclick = e => { const a = e.target.dataset.a; if (!a) return; if (a === 'y') onYes(); d.remove(); }; $('panels').appendChild(d); setTimeout(() => d.remove(), 30000); };
  U.partyNear = function (r) { return U.party.members.filter(m => m.id !== G.myId && Math.hypot(m.x - G.player.pos.x, m.z - G.player.pos.z) < r).map(m => m.id); };

  // ---------- chat ----------
  U.sendChat = function (v) {
    if (v.startsWith('/')) {
      const [cmd, ...rest] = v.slice(1).split(' '); const arg = rest.join(' ');
      if (cmd === 'w' || cmd === 'whisper') { const [to, ...m] = rest; G.net.send({ t: 'whisper', to, msg: m.join(' ') }); }
      else if (cmd === 'p') G.net.send({ t: 'chat', ch: 'party', msg: arg });
      else if (cmd === 'party' || cmd === 'invite') G.net.send({ t: 'pinvite', name: arg });
      else if (cmd === 'trade') G.net.send({ t: 'treq', name: arg });
      else if (cmd === 'leave') G.net.send({ t: 'pleave' });
      else if (cmd === 'stuck') G.player.teleport(0, 7);
      else if (cmd === 'pos') U.chat(`พิกัด: ${G.player.pos.x.toFixed(0)}, ${G.player.pos.z.toFixed(0)}`, 'sys');
      else U.chat('คำสั่ง: /w ชื่อ ข้อความ · /p ข้อความ · /party ชื่อ · /trade ชื่อ · /leave · /stuck · /pos', 'sys');
      return;
    }
    G.net.send({ t: 'chat', ch: $('chat-ch').value, msg: v });
    if (!G.net.online) U.chat('', 'all', `<b>${esc(S().name)}:</b> ${esc(v)}`);
  };

  // ---------- minimap ----------
  U.drawMinimap = function () {
    if (!S() || !G.player.model) return; const c = $('minimap'), g = c.getContext('2d'); const R = 90, scale = 0.9; const px = G.player.pos.x, pz = G.player.pos.z;
    $('mm-coords').textContent = `${px.toFixed(0)}, ${pz.toFixed(0)} · ${G.player.zone ? G.player.zone.name : ''}`;
    if (!U._mmBg || U._mmKey !== Math.round(px / 8) + ':' + Math.round(pz / 8)) {
      U._mmKey = Math.round(px / 8) + ':' + Math.round(pz / 8);
      const bg = U._mmBg = U._mmBg || document.createElement('canvas'); bg.width = bg.height = 180; const b = bg.getContext('2d'); const col = new THREE.Color();
      for (let y = 0; y < 180; y += 4) for (let x = 0; x < 180; x += 4) { const wx = px + (x - R) / scale, wz = pz + (y - R) / scale; const h = wx > 2000 ? 0 : G.terrainH(wx, wz);
        if (wx > 2000) col.set(Math.hypot(wx - 3000, wz) < 42 ? '#3a3448' : '#111'); else if (h < G.WATER_Y) col.set('#4aa0d8'); else { const z = G.zoneAt(wx, wz).id; col.set({ village: '#c9b088', mistwood: '#3f7a48', ruins: '#a09878', rift: '#4b3b63', lake: '#7fbf8a' }[z] || '#8cc062'); col.offsetHSL(0, 0, (h - 10) * 0.004); }
        b.fillStyle = '#' + col.getHexString(); b.fillRect(x, y, 4, 4); }
    }
    g.clearRect(0, 0, 180, 180); g.save(); g.beginPath(); g.arc(R, R, R, 0, 6.28); g.clip(); g.drawImage(U._mmBg, 0, 0);
    const dot = (x, z, color, r) => { const sx = R + (x - px) * scale, sy = R + (z - pz) * scale; if (Math.hypot(sx - R, sy - R) > R) return; g.fillStyle = color; g.beginPath(); g.arc(sx, sy, r || 2.5, 0, 6.28); g.fill(); };
    for (const e of G.ents.mons.values()) if (!e.dead) dot(e.x, e.z, e.def.aggro ? '#ff5a5a' : '#ffb3b3', e.def.boss ? 5 : 2);
    for (const n of Object.values(G.ents.npcs)) dot(n.x, n.z, '#5aff8a', 3);
    for (const p of G.ents.players.values()) dot(p.x, p.z, p.party ? '#7fd6ff' : '#ffffff', 3);
    for (const w of G.world.waystones) dot(w.x, w.z, '#6fd8ff', 3.5);
    for (const p of Object.values(D.PUZZLES)) dot(p.pos[0], p.pos[1], '#ffd77a', 3);
    g.restore(); g.save(); g.translate(R, R); g.rotate(-G.player.yaw + Math.PI); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.fill(); g.restore();
    g.strokeStyle = 'rgba(255,215,122,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(R, R, R - 1, 0, 6.28); g.stroke();
    g.fillStyle = '#ffd77a'; g.font = '11px Mitr'; g.fillText('N', R - 4, 12);
  };
  U.drawBigMap = function () {
    const c = $('bigmap'); if (!c) return; const g = c.getContext('2d'); const S2 = 560, sc = S2 / 1120; const col = new THREE.Color();
    for (let y = 0; y < S2; y += 4) for (let x = 0; x < S2; x += 4) { const wx = x / sc - 560, wz = y / sc - 560; const h = G.terrainH(wx, wz); if (Math.hypot(wx, wz) > 560) col.set('#1a1530'); else if (h < G.WATER_Y) col.set('#4aa0d8'); else { const z = G.zoneAt(wx, wz).id; col.set({ village: '#c9b088', mistwood: '#3f7a48', ruins: '#a09878', rift: '#4b3b63', lake: '#7fbf8a' }[z] || '#8cc062'); col.offsetHSL(0, 0, (h - 10) * 0.004); } g.fillStyle = '#' + col.getHexString(); g.fillRect(x, y, 4, 4); }
    const P = (x, z) => [(x + 560) * sc, (z + 560) * sc];
    g.font = '13px Mitr'; g.textAlign = 'center';
    for (const z of D.ZONES) { const [x, y] = P(z.cx, z.cz); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(z.name + (z.lv !== '-' ? ` Lv.${z.lv}` : ''), x + 1, y + 1); g.fillStyle = '#fff'; g.fillText(z.name + (z.lv !== '-' ? ` Lv.${z.lv}` : ''), x, y); }
    g.font = '16px sans-serif';
    for (const p of Object.values(D.PUZZLES)) { const [x, y] = P(p.pos[0], p.pos[1]); g.fillText(p.hard ? '🔥' : '⭐', x, y); }
    for (const n of Object.values(D.NPCS)) { const [x, y] = P(n.pos[0], n.pos[1]); g.fillStyle = '#5aff8a'; g.beginPath(); g.arc(x, y, 3, 0, 6.28); g.fill(); }
    for (const w of G.world.waystones) { const [x, y] = P(w.x, w.z); g.fillText(S().explored['ws_' + w.id] ? '💎' : '◇', x, y); }
    { const [x, y] = P(D.DUNGEON.entrance.x, D.DUNGEON.entrance.z); g.fillText('💀', x, y); }
    const [px, py] = P(G.player.pos.x > 2000 ? D.DUNGEON.entrance.x : G.player.pos.x, G.player.pos.x > 2000 ? D.DUNGEON.entrance.z : G.player.pos.z); g.fillStyle = '#ff4a6a'; g.beginPath(); g.arc(px, py, 6, 0, 6.28); g.fill(); g.strokeStyle = '#fff'; g.stroke();
    c.onclick = e => { const r = c.getBoundingClientRect(); const wx = (e.clientX - r.left) / sc - 560, wz = (e.clientY - r.top) / sc - 560; const w = G.world.waystones.find(w => Math.hypot(w.x - wx, w.z - wz) < 20 && S().explored['ws_' + w.id]); if (w && G.player.pos.x < 2000) { G.player.teleport(w.x + 2, w.z + 3); U.closePanel('map'); } };
  };
})();
