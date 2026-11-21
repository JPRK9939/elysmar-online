/* GameCore — authoritative world logic (monsters, party, trade, dungeons, chat).
   Runs inside the Node server for online play, and inside the browser for offline play. */
(function (root) {
  const D = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('./data.js') : root.GameData;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
  let UID = 1;
  const uid = () => Date.now().toString(36) + (UID++).toString(36) + Math.random().toString(36).slice(2, 6);

  function rollDrops(def, luk) {
    const out = [];
    const bonus = 1 + (luk || 0) * 0.01;
    for (const [id, ch, mn, mx] of def.drops || []) {
      if (Math.random() < ch * bonus) out.push({ uid: uid(), id, qty: randi(mn, mx), plus: 0 });
    }
    return out;
  }

  // ------------------------------------------------------------
  class Sim {
    constructor(core, channel, instId, mode) {
      this.core = core; this.channel = channel; this.id = instId; this.mode = mode;
      this.mul = channel.mul || 1;
      this.monsters = new Map(); this.nextId = 1;
      this.wave = -1; this.cleared = false; this.waveDelay = 0; this.party = null;
      if (mode === 'world') this.spawnWorld(); else { this.waveDelay = 3; }
    }
    spawn(type, x, z, home) {
      const def = D.MONSTERS[type];
      const m = { id: this.nextId++, type, x, z, sx: x, sz: z, hp: Math.round(def.hp * this.mul), maxHp: Math.round(def.hp * this.mul),
        state: 'idle', target: null, atkCd: 1, wanderT: rand(1, 5), tx: x, tz: z, r: rand(0, 6.28), dead: false, respawn: 0,
        home: home || 0, slowT: 0, threat: {}, def };
      this.monsters.set(m.id, m); return m;
    }
    spawnWorld() {
      for (const zn of D.ZONES) {
        for (const [type, count] of zn.spawns) {
          for (let i = 0; i < count; i++) {
            const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * zn.r * 0.9;
            const x = zn.cx + Math.cos(a) * r, z = zn.cz + Math.sin(a) * r;
            if (dist2(x, z, D.VILLAGE.x, D.VILLAGE.z) < (D.VILLAGE.r + 8) ** 2) continue;
            this.spawn(type, x, z, zn.r);
          }
        }
      }
    }
    nextWave() {
      this.wave++;
      const W = D.DUNGEON.waves[this.wave];
      if (!W) { this.cleared = true; this.core.emit(this, 'dgClear', {}); return; }
      const o = D.DUNGEON.origin;
      for (const [type, count] of W) for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand(-.3, .3), r = type === 'warden' ? 0 : rand(14, 22);
        const m = this.spawn(type, o.x + Math.cos(a) * r, o.z - 10 + Math.sin(a) * r, 60);
        m.state = 'idle'; m.atkCd = 2;
      }
      this.core.emit(this, 'wave', { n: this.wave + 1, total: D.DUNGEON.waves.length });
    }
    update(dt, players) {
      if (this.mode === 'dungeon' && !this.cleared) {
        let alive = 0; for (const m of this.monsters.values()) if (!m.dead) alive++;
        if (alive === 0) { this.waveDelay -= dt; if (this.waveDelay <= 0) { this.waveDelay = 4; for (const [k, m] of this.monsters) if (m.dead) this.monsters.delete(k); this.nextWave(); } }
      }
      for (const m of this.monsters.values()) {
        const def = m.def;
        if (m.dead) {
          if (this.mode === 'world') { m.respawn -= dt; if (m.respawn <= 0) { m.dead = false; m.hp = m.maxHp; m.x = m.sx; m.z = m.sz; m.state = 'idle'; m.threat = {}; m.target = null; } }
          continue;
        }
        if (m.slowT > 0) m.slowT -= dt;
        const spd = def.spd * (m.slowT > 0 ? 0.45 : 1);
        // targeting
        let tgt = m.target ? players.find(p => p.id === m.target && !p.dead) : null;
        if (!tgt && def.aggro) {
          let best = 81; // 9m
          for (const p of players) { if (p.dead) continue; const d = dist2(m.x, m.z, p.x, p.z); if (d < best) { best = d; tgt = p; } }
          if (tgt) m.target = tgt.id;
        }
        if (tgt && dist2(m.x, m.z, m.sx, m.sz) > (m.home + 30) ** 2) { tgt = null; m.target = null; m.state = 'return'; m.threat = {}; }
        if (tgt && this.core.isSafe(tgt.x, tgt.z)) { tgt = null; m.target = null; m.state = 'return'; }
        if (tgt) {
          m.state = 'chase';
          const dx = tgt.x - m.x, dz = tgt.z - m.z, d = Math.sqrt(dx * dx + dz * dz) || 1;
          m.r = Math.atan2(dx, dz);
          const range = def.range + (def.size || 1) * 0.3;
          if (d > range) { m.x += dx / d * spd * 1.25 * dt; m.z += dz / d * spd * 1.25 * dt; }
          m.atkCd -= dt;
          if (d <= range + 0.4 && m.atkCd <= 0) {
            m.atkCd = def.boss ? 2.2 : 1.6;
            let dmg = Math.round(def.atk * this.mul * rand(0.85, 1.15));
            let aoe = false;
            if (def.boss && Math.random() < 0.35) { aoe = true; dmg = Math.round(dmg * 1.4); }
            m.state = 'attack';
            if (aoe) { for (const p of players) if (!p.dead && dist2(m.x, m.z, p.x, p.z) < 64) this.core.emit(this, 'attack', { mid: m.id, pid: p.id, dmg, aoe: true }); }
            else this.core.emit(this, 'attack', { mid: m.id, pid: tgt.id, dmg });
          }
        } else if (m.state === 'return') {
          const dx = m.sx - m.x, dz = m.sz - m.z, d = Math.sqrt(dx * dx + dz * dz);
          if (d < 1) { m.state = 'idle'; m.hp = m.maxHp; } else { m.x += dx / d * spd * 2 * dt; m.z += dz / d * spd * 2 * dt; m.r = Math.atan2(dx, dz); }
        } else {
          m.wanderT -= dt;
          if (m.wanderT <= 0) { m.wanderT = rand(3, 8); const a = rand(0, 6.28), r = rand(0, Math.min(14, m.home * 0.3 + 4)); m.tx = m.sx + Math.cos(a) * r; m.tz = m.sz + Math.sin(a) * r; }
          const dx = m.tx - m.x, dz = m.tz - m.z, d = Math.sqrt(dx * dx + dz * dz);
          if (d > 0.5) { m.x += dx / d * spd * 0.4 * dt; m.z += dz / d * spd * 0.4 * dt; m.r = Math.atan2(dx, dz); m.state = 'walk'; } else m.state = 'idle';
        }
      }
    }
    hit(mid, dmg, pid, opts) {
      const m = this.monsters.get(mid);
      if (!m || m.dead) return;
      dmg = Math.max(1, Math.min(Math.round(dmg), 999999));
      m.hp -= dmg; m.threat[pid] = (m.threat[pid] || 0) + dmg;
      if (!m.target || Math.random() < 0.3) m.target = pid;
      if (opts && opts.slow) m.slowT = 4;
      if (m.hp <= 0) {
        m.hp = 0; m.dead = true; m.respawn = m.def.boss ? 99999 : rand(14, 26); m.state = 'dead';
        let top = pid, best = -1; for (const k in m.threat) if (m.threat[k] > best) { best = m.threat[k]; top = k; }
        this.core.onKill(this, m, top);
      }
    }
    snapshot() {
      const out = [];
      for (const m of this.monsters.values()) out.push([m.id, m.type, +m.x.toFixed(2), +m.z.toFixed(2), m.hp, m.maxHp, m.state, +m.r.toFixed(2), m.dead ? 1 : 0, m.slowT > 0 ? 1 : 0]);
      return out;
    }
  }

  // ------------------------------------------------------------
  class GameCore {
    constructor(opts) {
      this.storage = opts.storage; this.log = opts.log || (() => {});
      this.clients = new Map(); this.channels = {};
      for (const s of D.SERVERS) { this.channels[s.id] = { ...s, sims: new Map() }; this.channels[s.id].sims.set('world', new Sim(this, this.channels[s.id], 'world', 'world')); }
      this.parties = new Map(); this.trades = new Map(); this.invites = new Map();
      this.snapT = 0; this.instN = 1; this.partyN = 1;
    }
    serverList() { return D.SERVERS.map(s => ({ id: s.id, name: s.name, desc: s.desc, cap: s.cap, pop: [...this.clients.values()].filter(c => c.p && c.p.channel === s.id).length })); }
    isSafe(x, z) { return dist2(x, z, D.VILLAGE.x, D.VILLAGE.z) < D.VILLAGE.r * D.VILLAGE.r; }

    addClient(conn) { this.clients.set(conn.id, conn); conn.send({ t: 'servers', list: this.serverList() }); }
    removeClient(conn) {
      const p = conn.p;
      if (p) {
        this.persist(conn);
        this.leaveParty(conn, true); this.cancelTrade(conn);
        this.broadcast(p.channel, { t: 'sys', msg: `${p.name} ออกจากเกม` }, conn.id);
      }
      this.clients.delete(conn.id);
    }
    persist(conn) { if (conn.p && conn.p.save) this.storage.save(conn.p.key, conn.p.save); }
    byName(channel, name) { name = String(name || '').toLowerCase(); for (const c of this.clients.values()) if (c.p && c.p.channel === channel && c.p.name.toLowerCase() === name) return c; return null; }
    send(id, msg) { const c = this.clients.get(id); if (c) c.send(msg); }
    broadcast(channel, msg, exceptId) { for (const c of this.clients.values()) if (c.p && c.p.channel === channel && c.id !== exceptId) c.send(msg); }
    simOf(p) { const ch = this.channels[p.channel]; return ch && ch.sims.get(p.inst); }

    handle(conn, msg) {
      const p = conn.p;
      if (msg.t === 'join') return this.join(conn, msg);
      if (msg.t === 'create') return this.create(conn, msg);
      if (!p || !p.save) return;
      switch (msg.t) {
        case 'state': {
          const s = msg.s || []; p.x = +s[0] || 0; p.y = +s[1] || 0; p.z = +s[2] || 0; p.r = +s[3] || 0; p.a = s[4] | 0;
          p.hp = s[5] | 0; p.mhp = s[6] | 0; p.lv = s[7] | 0; p.cls = String(s[8] || 'novice').slice(0, 20); p.dead = p.hp <= 0;
          p.wep = String(s[9] || '').slice(0, 24);
          if (p.party) { const party = this.parties.get(p.party); if (party) this.sendParty(party); }
          break;
        }
        case 'hit': {
          const sim = this.simOf(p); if (!sim) return;
          for (const h of (msg.h || []).slice(0, 24)) sim.hit(h[0], +h[1] || 0, p.id, { slow: !!h[2] });
          break;
        }
        case 'save': if (msg.data && typeof msg.data === 'object' && msg.data.inv) { msg.data.name = p.name; p.save = msg.data; if (msg.flush) this.persist(conn); } break;
        case 'chat': {
          const text = String(msg.msg || '').slice(0, 200); if (!text.trim()) return;
          const out = { t: 'chat', ch: msg.ch === 'party' ? 'party' : 'all', from: p.name, msg: text };
          if (out.ch === 'party' && p.party) { const party = this.parties.get(p.party); party && party.members.forEach(id => this.send(id, out)); }
          else this.broadcast(p.channel, out);
          break;
        }
        case 'whisper': {
          const t = this.byName(p.channel, msg.to); if (!t) return conn.send({ t: 'sys', msg: 'ไม่พบผู้เล่นชื่อนี้ในเซิร์ฟเวอร์' });
          const m = { t: 'chat', ch: 'whisper', from: p.name, to: t.p.name, msg: String(msg.msg || '').slice(0, 200) };
          t.send(m); conn.send(m); break;
        }
        case 'heal': {
          const amt = Math.min(+msg.amt || 0, 99999);
          for (const id of (msg.ids || []).slice(0, 6)) { const t = this.clients.get(id); if (t && t.p && t.p.party && t.p.party === p.party && t.id !== conn.id) t.send({ t: 'healed', amt, from: p.name, barrier: msg.barrier || 0 }); }
          break;
        }
        case 'emote': this.broadcastSim(p, { t: 'fx', id: p.id, fx: String(msg.fx || '').slice(0, 20), x: +msg.x || 0, z: +msg.z || 0 }, conn.id); break;
        // ----- party -----
        case 'pinvite': {
          const t = this.byName(p.channel, msg.name); if (!t || t === conn) return conn.send({ t: 'sys', msg: 'ไม่พบผู้เล่น' });
          if (t.p.party) return conn.send({ t: 'sys', msg: `${t.p.name} อยู่ในปาร์ตี้อื่นแล้ว` });
          this.invites.set(t.id + ':p', conn.id); t.send({ t: 'pinviteFrom', from: p.name, fromId: conn.id });
          conn.send({ t: 'sys', msg: `ส่งคำเชิญปาร์ตี้ถึง ${t.p.name} แล้ว` }); break;
        }
        case 'paccept': {
          const fromId = this.invites.get(conn.id + ':p'); this.invites.delete(conn.id + ':p');
          const leader = this.clients.get(fromId); if (!leader || !leader.p || leader.p.channel !== p.channel) return;
          let party = leader.p.party && this.parties.get(leader.p.party);
          if (!party) { party = { id: this.partyN++, leader: leader.id, members: [leader.id] }; this.parties.set(party.id, party); leader.p.party = party.id; }
          if (party.members.length >= 6) return conn.send({ t: 'sys', msg: 'ปาร์ตี้เต็มแล้ว (6 คน)' });
          this.leaveParty(conn, true);
          party.members.push(conn.id); p.party = party.id; this.sendParty(party, `${p.name} เข้าร่วมปาร์ตี้`); break;
        }
        case 'pleave': this.leaveParty(conn); break;
        case 'pkick': { const party = this.parties.get(p.party); if (party && party.leader === conn.id) { const t = this.clients.get(msg.id); if (t && t.p.party === party.id) this.leaveParty(t); } break; }
        // ----- trade -----
        case 'treq': {
          const t = this.byName(p.channel, msg.name); if (!t || t === conn) return conn.send({ t: 'sys', msg: 'ไม่พบผู้เล่น' });
          if (dist2(p.x, p.z, t.p.x, t.p.z) > 15 * 15) return conn.send({ t: 'sys', msg: 'ต้องอยู่ใกล้กันในระยะ 15 เมตรเพื่อเทรด' });
          this.invites.set(t.id + ':t', conn.id); t.send({ t: 'treqFrom', from: p.name, fromId: conn.id }); conn.send({ t: 'sys', msg: `ส่งคำขอเทรดถึง ${t.p.name}` }); break;
        }
        case 'tacc': {
          const fromId = this.invites.get(conn.id + ':t'); this.invites.delete(conn.id + ':t');
          const a = this.clients.get(fromId); if (!a || !a.p) return; this.cancelTrade(a); this.cancelTrade(conn);
          const tr = { a: a.id, b: conn.id, off: { [a.id]: { uids: [], gold: 0, lock: false, ok: false }, [conn.id]: { uids: [], gold: 0, lock: false, ok: false } } };
          this.trades.set(a.id, tr); this.trades.set(conn.id, tr);
          a.send({ t: 'tstart', with: p.name }); conn.send({ t: 'tstart', with: a.p.name }); this.sendTrade(tr); break;
        }
        case 'toffer': {
          const tr = this.trades.get(conn.id); if (!tr) return;
          const inv = p.save.inv || []; const uids = [...new Set((msg.uids || []).filter(u => inv.some(i => i.uid === u)))].slice(0, 12);
          const gold = Math.max(0, Math.min(Math.floor(+msg.gold || 0), p.save.gold || 0));
          tr.off[conn.id] = { uids, gold, lock: false, ok: false }; const o = tr.off[tr.a === conn.id ? tr.b : tr.a]; o.lock = false; o.ok = false;
          this.sendTrade(tr); break;
        }
        case 'tlock': { const tr = this.trades.get(conn.id); if (tr) { tr.off[conn.id].lock = true; this.sendTrade(tr); } break; }
        case 'tconfirm': {
          const tr = this.trades.get(conn.id); if (!tr) return; const me = tr.off[conn.id]; const other = tr.off[tr.a === conn.id ? tr.b : tr.a];
          if (!me.lock || !other.lock) return; me.ok = true; this.sendTrade(tr); if (other.ok) this.execTrade(tr); break;
        }
        case 'tcancel': this.cancelTrade(conn); break;
        // ----- dungeon -----
        case 'dgEnter': {
          if (p.lv < D.DUNGEON.minLv) return conn.send({ t: 'sys', msg: `ต้องเลเวล ${D.DUNGEON.minLv} ขึ้นไป` });
          const party = p.party && this.parties.get(p.party);
          if (party && party.leader !== conn.id) return conn.send({ t: 'sys', msg: 'หัวหน้าปาร์ตี้เท่านั้นที่เปิดดันเจี้ยนได้' });
          const ch = this.channels[p.channel]; const inst = 'dg' + (this.instN++);
          const sim = new Sim(this, ch, inst, 'dungeon'); ch.sims.set(inst, sim);
          const members = party ? party.members.map(id => this.clients.get(id)).filter(c => c && c.p && c.p.channel === p.channel && c.p.inst === 'world' && dist2(c.p.x, c.p.z, p.x, p.z) < 40 * 40) : [conn];
          const o = D.DUNGEON.origin;
          members.forEach((c, i) => { c.p.inst = inst; c.send({ t: 'dgStart', inst, x: o.x + (i - members.length / 2) * 2, z: o.z + 22 }); });
          break;
        }
        case 'dgLeave': {
          if (p.inst === 'world') return; p.inst = 'world'; const e = D.DUNGEON.entrance; conn.send({ t: 'dgEnd', x: e.x - 6, z: e.z }); break;
        }
        case 'ping': conn.send({ t: 'pong', ts: msg.ts }); break;
      }
    }

    join(conn, msg) {
      const ch = this.channels[msg.server]; if (!ch || !conn.account) return conn.send({ t: 'err', msg: 'ไม่พบเซิร์ฟเวอร์' });
      const pop = [...this.clients.values()].filter(c => c.p && c.p.channel === ch.id).length;
      if (pop >= ch.cap) return conn.send({ t: 'err', msg: 'เซิร์ฟเวอร์เต็ม' });
      const key = conn.account.id + '@' + ch.id;
      // kick duplicate login of the same character
      for (const c of this.clients.values()) if (c !== conn && c.p && c.p.key === key) { c.send({ t: 'err', msg: 'มีการล็อกอินซ้ำจากที่อื่น' }); this.removeClient(c); c.close && c.close(); }
      const save = this.storage.load(key);
      conn.pendingKey = key; conn.pendingChannel = ch.id;
      if (!save) return conn.send({ t: 'needCreate', server: ch.id });
      this.enter(conn, key, ch.id, save);
    }
    create(conn, msg) {
      if (!conn.pendingKey) return;
      const name = String(msg.name || '').trim().slice(0, 16);
      if (name.length < 2 || /[<>&"'\/\\]/.test(name)) return conn.send({ t: 'err', msg: 'ชื่อไม่ถูกต้อง (2-16 ตัวอักษร)' });
      if (this.storage.nameTaken(conn.pendingChannel, name, conn.pendingKey)) return conn.send({ t: 'err', msg: 'ชื่อนี้ถูกใช้แล้วในเซิร์ฟเวอร์นี้' });
      const save = D.newSave(name, msg.look || {});
      this.storage.save(conn.pendingKey, save);
      this.enter(conn, conn.pendingKey, conn.pendingChannel, save);
    }
    enter(conn, key, channel, save) {
      conn.p = { id: conn.id, key, channel, inst: 'world', name: save.name, save, x: save.pos[0], y: save.pos[1], z: save.pos[2], r: 0, a: 0, hp: save.hp, mhp: save.hp, lv: save.lv, cls: save.cls, look: save.look, party: null, dead: false, wep: '' };
      const ch = this.channels[channel];
      conn.send({ t: 'joined', id: conn.id, server: { id: ch.id, name: ch.name, mul: ch.mul, expMul: ch.expMul || 1 }, save });
      this.broadcast(channel, { t: 'sys', msg: `${save.name} เข้าสู่โลกเอลิสมาร์` }, conn.id);
    }
    leaveParty(conn, silent) {
      const p = conn.p; if (!p || !p.party) return; const party = this.parties.get(p.party); p.party = null;
      if (!party) return; party.members = party.members.filter(id => id !== conn.id);
      if (!silent || true) conn.send({ t: 'party', members: [], leader: null });
      if (party.members.length <= 1) { party.members.forEach(id => { const c = this.clients.get(id); if (c && c.p) { c.p.party = null; c.send({ t: 'party', members: [], leader: null, msg: 'ปาร์ตี้ถูกยุบ' }); } }); this.parties.delete(party.id); return; }
      if (party.leader === conn.id) party.leader = party.members[0];
      this.sendParty(party, `${p.name} ออกจากปาร์ตี้`);
    }
    sendParty(party, msg) {
      const now = Date.now(); if (!msg && party.lastSend && now - party.lastSend < 500) return; party.lastSend = now;
      const members = party.members.map(id => this.clients.get(id)).filter(Boolean).map(c => ({ id: c.id, name: c.p.name, hp: c.p.hp, mhp: c.p.mhp, lv: c.p.lv, cls: c.p.cls, x: c.p.x, z: c.p.z, inst: c.p.inst }));
      party.members.forEach(id => this.send(id, { t: 'party', members, leader: party.leader, msg }));
    }
    sendTrade(tr) {
      const desc = id => { const c = this.clients.get(id); const o = tr.off[id]; return { name: c.p.name, gold: o.gold, lock: o.lock, ok: o.ok, items: o.uids.map(u => c.p.save.inv.find(i => i.uid === u)).filter(Boolean) }; };
      const A = desc(tr.a), B = desc(tr.b);
      this.send(tr.a, { t: 'tupdate', me: A, them: B }); this.send(tr.b, { t: 'tupdate', me: B, them: A });
    }
    execTrade(tr) {
      const ca = this.clients.get(tr.a), cb = this.clients.get(tr.b); if (!ca || !cb) return;
      const oa = tr.off[tr.a], ob = tr.off[tr.b];
      const take = (c, o) => { const items = []; for (const u of o.uids) { const i = c.p.save.inv.findIndex(x => x.uid === u); if (i < 0) return null; items.push(c.p.save.inv[i]); } if ((c.p.save.gold || 0) < o.gold) return null; return items; };
      const ia = take(ca, oa), ib = take(cb, ob);
      if (!ia || !ib) { this.cancelTrade(ca, 'การเทรดล้มเหลว: ไอเทมไม่ตรงกัน'); return; }
      const apply = (c, give, get, goldOut, goldIn) => {
        c.p.save.inv = c.p.save.inv.filter(i => !give.some(g => g.uid === i.uid)).concat(get.map(i => ({ ...i })));
        c.p.save.gold = (c.p.save.gold || 0) - goldOut + goldIn; this.persist(c);
        c.send({ t: 'tdone', remove: give.map(i => i.uid), add: get, gold: goldIn - goldOut });
      };
      apply(ca, ia, ib, oa.gold, ob.gold); apply(cb, ib, ia, ob.gold, oa.gold);
      this.trades.delete(tr.a); this.trades.delete(tr.b);
      this.log('trade', { a: ca.p.name, b: cb.p.name, ai: ia.map(i => i.id), bi: ib.map(i => i.id), ag: oa.gold, bg: ob.gold });
    }
    cancelTrade(conn, msg) {
      const tr = this.trades.get(conn.id); if (!tr) return; this.trades.delete(tr.a); this.trades.delete(tr.b);
      this.send(tr.a, { t: 'tend', msg: msg || 'การเทรดถูกยกเลิก' }); this.send(tr.b, { t: 'tend', msg: msg || 'การเทรดถูกยกเลิก' });
    }

    playersIn(channel, inst) { const out = []; for (const c of this.clients.values()) if (c.p && c.p.channel === channel && c.p.inst === inst) out.push(c.p); return out; }
    broadcastSim(p, msg, exceptId) { for (const c of this.clients.values()) if (c.p && c.p.channel === p.channel && c.p.inst === p.inst && c.id !== exceptId) c.send(msg); }

    emit(sim, type, data) {
      const players = this.playersIn(sim.channel.id, sim.id);
      if (type === 'attack') { this.send(data.pid, { t: 'mhit', mid: data.mid, dmg: data.dmg, aoe: data.aoe }); for (const p of players) if (p.id !== data.pid) this.send(p.id, { t: 'matk', mid: data.mid }); }
      else if (type === 'wave') players.forEach(p => this.send(p.id, { t: 'wave', n: data.n, total: data.total }));
      else if (type === 'dgClear') {
        const R = D.DUNGEON.reward;
        players.forEach(p => this.send(p.id, { t: 'dgClear', exp: Math.round(R.exp * (sim.channel.expMul || 1)), gold: R.gold, items: R.items.map(([id, q]) => ({ uid: uid(), id, qty: q, plus: 0 })) }));
      }
    }
    onKill(sim, m, killerId) {
      const def = m.def; const players = this.playersIn(sim.channel.id, sim.id);
      players.forEach(p => this.send(p.id, { t: 'mdead', mid: m.id }));
      const killer = this.clients.get(killerId); if (!killer || !killer.p) return;
      // party EXP share (RO-style even share with bonus) for members nearby
      let sharers = [killer.p];
      if (killer.p.party) { const party = this.parties.get(killer.p.party); if (party) sharers = party.members.map(id => this.clients.get(id)).filter(c => c && c.p && c.p.inst === sim.id && c.p.channel === sim.channel.id && dist2(c.p.x, c.p.z, m.x, m.z) < 60 * 60).map(c => c.p); }
      const totalExp = def.exp * (sim.channel.expMul || 1) * (1 + 0.15 * (sharers.length - 1));
      const each = Math.max(1, Math.round(totalExp / sharers.length));
      for (const p of sharers) {
        const isKiller = p.id === killer.id;
        const luk = (p.save && p.save.stats && p.save.stats.luk) || 5;
        this.send(p.id, { t: 'reward', mtype: m.type, mid: m.id, exp: each, gold: isKiller ? randi(def.gold[0], def.gold[1]) : 0, drops: (isKiller || def.boss) ? rollDrops(def, luk) : [], kill: true });
      }
    }

    tick(dt) {
      for (const ch of Object.values(this.channels)) {
        for (const [inst, sim] of ch.sims) {
          const players = this.playersIn(ch.id, inst);
          if (inst !== 'world' && players.length === 0) { ch.sims.delete(inst); continue; }
          if (players.length) sim.update(dt, players);
        }
      }
      this.snapT += dt;
      if (this.snapT >= 0.1) {
        this.snapT = 0; this.monT = (this.monT || 0) + 1;
        const sendMon = this.monT % 2 === 0;
        for (const c of this.clients.values()) {
          const p = c.p; if (!p || !p.save) continue;
          const pl = [];
          for (const o of this.clients.values()) { const q = o.p; if (!q || q === p || q.channel !== p.channel || q.inst !== p.inst) continue; if (dist2(q.x, q.z, p.x, p.z) > 200 * 200) continue;
            pl.push([q.id, q.name, +q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2), +q.r.toFixed(2), q.a, q.hp, q.mhp, q.lv, q.cls, q.look, q.party && q.party === p.party ? 1 : 0, q.wep]); }
          const msg = { t: 'snap', pl };
          if (sendMon) { const sim = this.simOf(p); if (sim) msg.mo = sim.snapshot().filter(m => dist2(m[2], m[3], p.x, p.z) < 160 * 160); }
          c.send(msg);
        }
      }
    }
  }

  const API = { GameCore, Sim, uid };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.GameCoreLib = API;
})(typeof self !== 'undefined' ? self : this);
