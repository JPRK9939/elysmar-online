/* Boot: title world → login (phone+password / Google / offline) → server select → character creation → game loop */
(function () {
  const D = G.D; const $ = id => document.getElementById(id);
  let mode = 'title', cfg = { googleClientId: '' }, preview = null, look = { hair: '#f2e6c8', skin: '#f6d7bf', cloth: '#5a6fd0', style: 0, ears: 0 }, authMode = 'login';
  const show = id => { ['screen-login', 'screen-servers', 'screen-create', 'screen-loading'].forEach(s => $(s).classList.toggle('hidden', s !== id)); };
  const msg = (t, ok) => { $('auth-msg').textContent = t || ''; $('auth-msg').classList.toggle('ok', !!ok); };

  async function boot() {
    G.initTextures(); G.world.init($('game'));
    show('screen-loading'); $('loading-text').textContent = 'กำลังสร้างโลกเอลิสมาร์...';
    await new Promise(r => setTimeout(r, 30));
    G.world.build(); G.ents.initNpcs();
    await G.models.tryLoadGLTF();
    show('screen-login'); bindAuth(); requestAnimationFrame(loop);
    if (location.protocol.startsWith('http')) { try { cfg = await (await fetch('/api/config')).json(); } catch (e) {} }
    setupGoogle(); connectOnline();
  }

  // ---------- auth ----------
  function bindAuth() {
    document.querySelectorAll('.auth-card .tabs button').forEach(b => b.onclick = () => { authMode = b.dataset.tab; document.querySelectorAll('.auth-card .tabs button').forEach(x => x.classList.toggle('on', x === b)); $('lbl-pass2').classList.toggle('hidden', authMode !== 'register'); $('btn-auth').textContent = authMode === 'register' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'; msg(''); });
    $('btn-auth').onclick = () => {
      G.audio.init(); const phone = $('in-phone').value.trim(), pw = $('in-pass').value;
      if (!phone || !pw) return msg('กรุณากรอกเบอร์โทรและรหัสผ่าน');
      if (authMode === 'register' && pw !== $('in-pass2').value) return msg('รหัสผ่านไม่ตรงกัน');
      if (!G.net || !G.net.online) return msg('ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ — รัน "npm start" แล้วเปิด http://localhost:8080 หรือเล่นออฟไลน์');
      msg('กำลังตรวจสอบ...', true); G.net.send({ t: 'auth', mode: authMode, phone, password: pw });
    };
    $('in-pass').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-auth').click(); });
    $('btn-offline').onclick = () => { G.audio.init(); startNet(new G.LocalNet()); };
    $('btn-logout').onclick = () => { try { localStorage.removeItem('ely_token'); } catch (e) {} location.reload(); };
  }
  function setupGoogle() {
    if (!cfg.googleClientId) { $('google-off').classList.remove('hidden'); return; }
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => { google.accounts.id.initialize({ client_id: cfg.googleClientId, callback: r => { G.audio.init(); msg('กำลังเข้าสู่ระบบด้วย Google...', true); G.net.send({ t: 'auth', mode: 'google', credential: r.credential }); } });
      google.accounts.id.renderButton($('google-btn'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 300 }); };
    document.head.appendChild(s);
  }
  async function connectOnline() {
    if (/\.github\.io$/.test(location.hostname)) {
      $('conn-status').innerHTML = '🚧 เวอร์ชันทดลองบนเว็บ (อยู่ระหว่างพัฒนา) — กด <b>เล่นออฟไลน์</b> เพื่อเริ่มเล่น · โหมดออนไลน์ต้องรันเซิร์ฟเวอร์เอง';
      document.querySelector('.auth-card').classList.add('static-host'); return;
    }
    const net = new G.WsNet(G.serverUrl()); $('conn-status').textContent = 'กำลังเชื่อมต่อ ' + G.serverUrl() + ' ...';
    try { await net.connect(); $('conn-status').textContent = '🟢 เชื่อมต่อเซิร์ฟเวอร์แล้ว'; startNet(net, true); let tok = null; try { tok = localStorage.getItem('ely_token'); } catch (e) {} if (tok) net.send({ t: 'auth', mode: 'resume', token: tok }); }
    catch (e) { $('conn-status').innerHTML = '🔴 ไม่พบเซิร์ฟเวอร์ออนไลน์ — เล่นออฟไลน์ได้ หรือรัน <b>npm start</b> แล้วเปิด http://localhost:8080'; }
  }

  // ---------- network handlers ----------
  function startNet(net, keepScreen) {
    if (G.net && G.net !== net && G.net.ws) G.net.ws.close();
    G.net = net; const on = (t, f) => net.on(t, f);
    on('authOk', m => { if (m.token && m.token !== 'offline') { try { localStorage.setItem('ely_token', m.token); } catch (e) {} } $('acct-label').textContent = 'บัญชี: ' + (m.account.label || m.account.id); renderServers(m.servers); show('screen-servers'); });
    on('authErr', m => { msg(m.msg); try { if (/เซสชัน/.test(m.msg)) localStorage.removeItem('ely_token'); } catch (e) {} });
    on('servers', m => { if (mode === 'servers') renderServers(m.list); });
    on('needCreate', () => { show('screen-create'); startCreate(); });
    on('err', m => { if (mode === 'game') G.ui.note(m.msg, 'red'); else { $('create-msg').textContent = m.msg; alert(m.msg); } });
    on('joined', m => enterGame(m));
    on('snap', m => mode === 'game' && G.ents.applySnap(m));
    on('mdead', m => G.ents.onDead(m.mid));
    on('matk', m => G.ents.onMatk(m.mid));
    on('mhit', m => { G.ents.onMatk(m.mid); G.player.onHurt(m); });
    on('reward', m => G.game.onReward(m));
    on('chat', m => { const cls = m.ch === 'party' ? 'party' : m.ch === 'whisper' ? 'whisper' : 'all'; const pre = m.ch === 'whisper' ? (m.from === G.S.name ? `→ ${G.esc(m.to)}` : `${G.esc(m.from)} กระซิบ`) : `${m.ch === 'party' ? '[ปาร์ตี้] ' : ''}${G.esc(m.from)}`; G.ui.chat('', cls, `<b>${pre}:</b> ${G.esc(m.msg)}`); });
    on('sys', m => G.ui.chat(m.msg, 'sys'));
    on('party', m => { G.ui.party = { members: m.members || [], leader: m.leader }; if (m.msg) G.ui.chat(m.msg, 'party'); G.ui.refresh(); });
    on('pinviteFrom', m => G.ui.ask(`<b>${G.esc(m.from)}</b> ชวนคุณเข้าปาร์ตี้`, () => G.net.send({ t: 'paccept' })));
    on('treqFrom', m => G.ui.ask(`<b>${G.esc(m.from)}</b> ขอเทรดกับคุณ`, () => G.net.send({ t: 'tacc' })));
    on('tstart', m => { G.ui.trade = { with: m.with, offer: [], gold: 0 }; G.ui.openPanel('trade', '🤝 เทรดกับ ' + G.esc(m.with)); G.ui.openPanel('inv'); });
    on('tupdate', m => { if (!G.ui.trade) return; G.ui.trade.me = m.me; G.ui.trade.them = m.them; G.ui.refresh(); });
    on('tdone', m => { G.S.inv = G.S.inv.filter(i => !m.remove.includes(i.uid)); m.add.forEach(i => G.game.addInst(i, true)); G.game.addGold(m.gold); G.game.act('trade', 3 + m.add.length); G.ui.trade = null; G.ui.closePanel('trade'); G.ui.note('🤝 เทรดสำเร็จ!', 'gold'); G.audio.sfx('coin'); G.game.flush(true); });
    on('tend', m => { G.ui.trade = null; const p = G.ui.open.trade; if (p) { p.remove(); delete G.ui.open.trade; } G.ui.note(m.msg, 'red'); });
    on('dgStart', m => { G.ents.clearMonsters(); G.player.pos.set(m.x, 0.5, m.z); G.player.vy = 0; G.ui.center(D.DUNGEON.name, 'เตรียมพร้อม...'); G.audio.sfx('boom'); G.game.flush(); });
    on('dgEnd', m => { G.ents.clearMonsters(); G.player.teleport(m.x, m.z); G.ui.puzzleTimer(''); });
    on('wave', m => { G.ui.center(m.n === m.total ? '⚠ บอสปรากฏตัว!' : `ระลอกที่ ${m.n}/${m.total}`, m.n === m.total ? D.MONSTERS.warden.name : ''); G.audio.sfx(m.n === m.total ? 'boom' : 'ding'); if (m.n === m.total) G.fx.doShake(1.2); });
    on('dgClear', m => { G.ui.center('ดันเจี้ยนสำเร็จ!', 'ผู้พิทักษ์ถูกปราบแล้ว'); G.game.addExp(m.exp); G.game.addGold(m.gold); m.items.forEach(i => G.game.addInst(i)); G.game.questEvent('dungeon', 'crypt'); G.game.align(2); G.audio.sfx('levelup'); });
    on('healed', m => { const s = G.S; if (m.amt) { s.hp = Math.min(G.game.st.maxHp, s.hp + m.amt); G.fx.number(G.player.pos, '+' + m.amt, 'heal'); G.fx.column(G.player.pos, { color: '#9fffb0', n: 25 }); } if (m.barrier) { G.game.buffs.barrier = m.barrier; G.fx.ring(G.player.pos, { color: '#fff3a8', radius: 2 }); } G.ui.chat(`${G.esc(m.from)} ${m.amt ? 'ฮีลให้คุณ +' + m.amt : 'ให้ม่านศักดิ์สิทธิ์แก่คุณ'}`, 'party'); G.game.act('social', 0.3); });
    on('fx', m => { if (m.fx === 'flowers') for (let k = 0; k < 25; k++) { const a = Math.random() * 6.28, r = Math.random() * 6; const x = m.x + Math.cos(a) * r, z = m.z + Math.sin(a) * r; G.fx.emit(x, G.terrainH(x, z) + .3, z, { vy: 1.5, life: 2.5, size: .9, color: G.pick(['#ffb7dd', '#fff3a8', '#cfe3ff']), drag: 1 }); } });
    on('disconnected', () => { if (mode === 'game') { G.ui.center('การเชื่อมต่อหลุด', 'กำลังโหลดใหม่...'); setTimeout(() => location.reload(), 3000); } else $('conn-status').textContent = '🔴 การเชื่อมต่อหลุด'; });
    net.connect && !keepScreen && net.connect();
  }
  function renderServers(list) {
    mode = 'servers'; const el = $('server-list'); el.innerHTML = '';
    for (const s of list) { const d = document.createElement('div'); d.className = 'server'; d.innerHTML = `<b>${G.esc(s.name)}</b><div><div>${G.esc(s.desc)}</div></div><div class="pop">${s.pop}/${s.cap} คน<div class="pop-bar"><i style="width:${Math.min(100, s.pop / s.cap * 100)}%"></i></div></div>`; d.onclick = () => { G.net.send({ t: 'join', server: s.id }); }; el.appendChild(d); }
  }

  // ---------- character creation with 360° preview ----------
  const PAL = { hair: ['#f2e6c8', '#f2f2f7', '#2a2228', '#7a3b1e', '#c99a4b', '#ff8fb1', '#8fd3a8', '#6a8aff', '#b07aff'], skin: ['#fbe7dc', '#f6d7bf', '#e8c4a0', '#c99a74', '#8a5a3a'], cloth: ['#5a6fd0', '#d65a5a', '#2f7a5a', '#f4f1e6', '#5a4a8a', '#2a2a3a', '#d6a84a', '#ff8fd1'] };
  function startCreate() {
    mode = 'create';
    document.querySelectorAll('.swatches').forEach(w => { const k = w.dataset.k; w.innerHTML = PAL[k].map(c => `<i style="background:${c}" data-c="${c}" class="${look[k] === c ? 'on' : ''}"></i>`).join(''); w.onclick = e => { if (!e.target.dataset.c) return; look[k] = e.target.dataset.c; w.querySelectorAll('i').forEach(i => i.classList.toggle('on', i === e.target)); rebuildPreview(); }; });
    document.querySelectorAll('.opts').forEach(o => o.onclick = e => { if (!e.target.dataset.v) return; look[o.dataset.k] = +e.target.dataset.v; o.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target)); rebuildPreview(); });
    $('btn-create').onclick = () => { const n = $('in-name').value.trim(); if (n.length < 2) return $('create-msg').textContent = 'ชื่อต้องยาว 2 ตัวอักษรขึ้นไป'; G.net.send({ t: 'create', name: n, look }); };
    rebuildPreview();
    let drag = null; const cv = G.world.renderer.domElement;
    cv.onmousedown = e => drag = e.clientX; addEventListener('mousemove', e => { if (drag !== null && preview && mode === 'create') { preview.rotation.y += (e.clientX - drag) * 0.01; drag = e.clientX; } }); addEventListener('mouseup', () => drag = null);
  }
  function rebuildPreview() { const rot = preview ? preview.rotation.y : 0.4; if (preview) G.world.scene.remove(preview); preview = G.models.humanoid(look); G.models.setWeapon(preview, 'staff', 'apprentice_staff', 0); preview.position.set(-3, G.terrainH(-3, 30), 30); preview.rotation.y = rot; G.world.scene.add(preview); }

  // ---------- enter game ----------
  function enterGame(m) {
    if (preview) { G.world.scene.remove(preview); preview = null; } G.world.renderer.domElement.onmousedown = null;
    G.myId = m.id; G.game.load(m.save, m.server); G.player.init(); G.ui.init();
    ['screen-login', 'screen-servers', 'screen-create', 'screen-loading'].forEach(s => $(s).classList.add('hidden')); $('hud').classList.remove('hidden');
    $('server-tag').textContent = m.server.name + (G.net.online ? '' : ' · ออฟไลน์'); mode = 'game';
    G.ui.chat(`ยินดีต้อนรับสู่เอลิสมาร์, ${m.save.name}. ม่านรัตติกาลปกคลุมโลกนี้... แต่คุณคือใครกันแน่?`, 'sys');
    if (!m.save.quests.done.m1 && !m.save.quests.active.m1) { G.ui.chat('💡 ไปคุยกับ "ผู้เฒ่ามาเรน" (เครื่องหมาย ! สีทอง) ใกล้น้ำพุ — กด H เพื่อดูวิธีเล่น', 'sys'); if (!m.save.inv.length) { G.game.add('wooden_sword', 1, 0, true); G.game.add('apprentice_staff', 1, 0, true); G.game.add('short_bow', 1, 0, true); G.game.add('hp_potion', 5, 0, true); G.game.equip(G.S.inv.find(i => i.id === 'wooden_sword').uid); } }
    G.audio.init(); addEventListener('beforeunload', () => G.game.flush(true));
  }

  // ---------- loop ----------
  let last = performance.now(), titleT = 0;
  function loop(now) {
    requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; const W = G.world;
    if (mode === 'game') {
      G.player.update(dt); G.ents.update(dt, W.camera); W.update(dt, G.player.pos); G.game.tick(dt);
      G.fx.ambient(G.player.pos, W.dark || 0, W.night || 0);
    } else if (mode === 'create' && preview) {
      const p = preview.position; W.camera.position.set(p.x + 0.4, p.y + 1.6, p.z + 5.6); W.camera.lookAt(p.x + 1.3, p.y + 1.05, p.z); G.models.animHumanoid(preview, 'idle', dt); W.update(dt, p);
    } else {
      titleT += dt * 0.04; const c = new THREE.Vector3(0, 0, 0); W.camera.position.set(Math.cos(titleT) * 70, 30, Math.sin(titleT) * 70); W.camera.lookAt(0, 6, 0); G.ents.update && G.player.pos.set(0, 2, 0); W.update(dt, c.set(0, 2, 0));
      for (const n of Object.values(G.ents.npcs)) G.models.animHumanoid(n.model, 'idle', dt);
    }
    G.fx.update(dt, W.camera); W.renderer.render(W.scene, W.camera);
  }
  boot().catch(e => { console.error(e); $('loading-text').textContent = 'เกิดข้อผิดพลาด: ' + e.message; });
})();
