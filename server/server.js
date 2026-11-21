/* Elysmar Online — game server
   - Serves the web client (http://localhost:PORT)
   - WebSocket game protocol (multiple game servers / channels)
   - Accounts: phone + password (scrypt-hashed) or Google Sign-In (ID token verified)
   - Login events are logged to a Google Sheet through an Apps Script web app (see tools/google-apps-script.gs) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const D = require('../shared/data.js');
const { GameCore } = require('../shared/core.js');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- config ----------
const CONFIG_PATH = path.join(__dirname, 'config.json');
if (!fs.existsSync(CONFIG_PATH)) fs.copyFileSync(path.join(__dirname, 'config.example.json'), CONFIG_PATH);
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const PORT = process.env.PORT || CONFIG.port || 8080;

// ---------- JSON file store ----------
function loadJson(file, def) { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); } catch { return def; } }
const dirty = new Set();
const DB = { accounts: loadJson('accounts.json', { byId: {}, byPhone: {} }), saves: loadJson('saves.json', {}), sessions: loadJson('sessions.json', {}) };
function markDirty(k) { dirty.add(k); }
function flush() {
  for (const k of dirty) { const tmp = path.join(DATA_DIR, k + '.json.tmp'); fs.writeFileSync(tmp, JSON.stringify(DB[k])); fs.renameSync(tmp, path.join(DATA_DIR, k + '.json')); }
  dirty.clear();
}
setInterval(flush, 5000);
process.on('SIGINT', () => { core && [...core.clients.values()].forEach(c => core.persist(c)); flush(); process.exit(0); });

const storage = {
  load: key => DB.saves[key] || null,
  save: (key, data) => { DB.saves[key] = data; markDirty('saves'); },
  nameTaken: (server, name, key) => { name = name.toLowerCase(); for (const k in DB.saves) if (k !== key && k.endsWith('@' + server) && (DB.saves[k].name || '').toLowerCase() === name) return true; return false; }
};

// ---------- Google Sheet login log ----------
async function sheetLog(row) {
  if (!CONFIG.sheetWebhookUrl) return;
  try {
    await fetch(CONFIG.sheetWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ secret: CONFIG.sheetSecret || '', ...row, time: new Date().toISOString() }), redirect: 'follow' });
  } catch (e) { console.warn('[sheet] log failed:', e.message); }
}

// ---------- auth ----------
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const normPhone = p => { let s = String(p || '').replace(/[\s\-()]/g, ''); if (s.startsWith('+66')) s = '0' + s.slice(3); return s; };
const attempts = new Map();
function rateLimited(ip) { const now = Date.now(); const a = (attempts.get(ip) || []).filter(t => now - t < 60000); a.push(now); attempts.set(ip, a); return a.length > 12; }
function newSession(accId) { const token = crypto.randomBytes(32).toString('hex'); DB.sessions[token] = { id: accId, exp: Date.now() + 7 * 864e5 }; markDirty('sessions'); return token; }

async function verifyGoogle(credential) {
  if (!CONFIG.googleClientId) throw new Error('ยังไม่ได้ตั้งค่า Google Client ID บนเซิร์ฟเวอร์');
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  if (!r.ok) throw new Error('Google token ไม่ถูกต้อง');
  const info = await r.json();
  if (info.aud !== CONFIG.googleClientId) throw new Error('Google token ไม่ได้ออกให้เกมนี้');
  if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('อีเมล Google ยังไม่ยืนยัน');
  return info;
}

async function handleAuth(conn, msg) {
  if (rateLimited(conn.ip)) return conn.send({ t: 'authErr', msg: 'พยายามบ่อยเกินไป กรุณารอ 1 นาที' });
  try {
    let acc, event = 'login', method = msg.mode;
    if (msg.mode === 'register') {
      const phone = normPhone(msg.phone), pw = String(msg.password || '');
      if (!/^0\d{8,9}$|^\+\d{9,15}$/.test(phone)) throw new Error('รูปแบบเบอร์โทรไม่ถูกต้อง');
      if (pw.length < 6) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
      if (DB.accounts.byPhone[phone]) throw new Error('เบอร์นี้ลงทะเบียนแล้ว');
      const salt = crypto.randomBytes(16).toString('hex');
      acc = { id: 'p_' + crypto.randomBytes(8).toString('hex'), type: 'phone', phone, salt, hash: hashPw(pw, salt), created: Date.now() };
      DB.accounts.byId[acc.id] = acc; DB.accounts.byPhone[phone] = acc.id; markDirty('accounts'); event = 'register'; method = 'phone';
    } else if (msg.mode === 'login') {
      const phone = normPhone(msg.phone); const id = DB.accounts.byPhone[phone]; acc = id && DB.accounts.byId[id];
      const ok = acc && crypto.timingSafeEqual(Buffer.from(hashPw(String(msg.password || ''), acc.salt), 'hex'), Buffer.from(acc.hash, 'hex'));
      if (!ok) throw new Error('เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง'); method = 'phone';
    } else if (msg.mode === 'google') {
      const info = await verifyGoogle(String(msg.credential || ''));
      const id = 'g_' + info.sub; acc = DB.accounts.byId[id];
      if (!acc) { acc = { id, type: 'google', email: info.email, gname: info.name, created: Date.now() }; DB.accounts.byId[id] = acc; markDirty('accounts'); event = 'register'; }
    } else if (msg.mode === 'resume') {
      const s = DB.sessions[msg.token]; if (!s || s.exp < Date.now()) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      acc = DB.accounts.byId[s.id]; if (!acc) throw new Error('ไม่พบบัญชี'); method = 'resume';
    } else throw new Error('unknown auth');
    acc.lastLogin = Date.now(); markDirty('accounts');
    conn.account = { id: acc.id, type: acc.type };
    const token = msg.mode === 'resume' ? msg.token : newSession(acc.id);
    conn.send({ t: 'authOk', token, account: { id: acc.id, type: acc.type, label: acc.type === 'google' ? acc.email : acc.phone.replace(/(\d{3})\d+(\d{2})/, '$1•••$2') }, servers: core.serverList() });
    if (method !== 'resume' || CONFIG.logResume) sheetLog({ event, method, accountId: acc.id, phone: acc.phone || '', email: acc.email || '', name: acc.gname || '', ip: conn.ip, ua: conn.ua });
    console.log(`[auth] ${event} ${method} ${acc.id}`);
  } catch (e) { conn.send({ t: 'authErr', msg: e.message }); }
}

// ---------- game core ----------
const core = new GameCore({ storage, log: (type, data) => console.log('[' + type + ']', JSON.stringify(data)) });
let last = Date.now();
setInterval(() => { const now = Date.now(); core.tick(Math.min(0.1, (now - last) / 1000)); last = now; }, 50);
setInterval(() => { for (const c of core.clients.values()) core.persist(c); }, 30000);

// ---------- HTTP (static client) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/api/config') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ googleClientId: CONFIG.googleClientId || '', servers: core.serverList(), version: D.VERSION })); }
  let file;
  if (url.startsWith('/shared/')) file = path.join(ROOT, url);
  else file = path.join(ROOT, 'client', url === '/' ? 'index.html' : url);
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });
let CID = 1;
wss.on('connection', (ws, req) => {
  const conn = { id: 'c' + (CID++), ws, ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0], ua: String(req.headers['user-agent'] || '').slice(0, 120),
    send: m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }, close: () => ws.close() };
  core.addClient(conn);
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'auth') return handleAuth(conn, msg);
    if (!conn.account) return conn.send({ t: 'authErr', msg: 'กรุณาเข้าสู่ระบบ' });
    core.handle(conn, msg);
  });
  ws.on('close', () => core.removeClient(conn));
});

server.listen(PORT, () => {
  console.log(`\n  ✦ Elysmar Online server running → http://localhost:${PORT}`);
  console.log(`  Google Sign-In: ${CONFIG.googleClientId ? 'enabled' : 'disabled (set googleClientId in server/config.json)'}`);
  console.log(`  Sheet logging : ${CONFIG.sheetWebhookUrl ? 'enabled' : 'disabled (set sheetWebhookUrl in server/config.json)'}\n`);
});
