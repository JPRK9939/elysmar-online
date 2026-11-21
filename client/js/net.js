/* Networking: WebSocket to the game server, or an in-browser LocalNet running the same GameCore (offline mode) */
(function () {
  class Emitter {
    constructor() { this.h = {}; }
    on(t, f) { (this.h[t] = this.h[t] || []).push(f); }
    dispatch(m) { (this.h[m.t] || []).forEach(f => { try { f(m); } catch (e) { console.error('handler ' + m.t, e); } }); (this.h['*'] || []).forEach(f => f(m)); }
  }
  class WsNet extends Emitter {
    constructor(url) { super(); this.url = url; this.online = true; this.queue = []; }
    connect() {
      return new Promise((res, rej) => {
        let opened = false; const ws = this.ws = new WebSocket(this.url);
        ws.onopen = () => { opened = true; this.queue.forEach(m => ws.send(m)); this.queue = []; res(); };
        ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.dispatch(m); };
        ws.onclose = () => { if (!opened) rej(new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์')); else this.dispatch({ t: 'disconnected' }); };
        ws.onerror = () => {};
      });
    }
    send(m) { const s = JSON.stringify(m); if (this.ws && this.ws.readyState === 1) this.ws.send(s); else this.queue.push(s); }
  }
  class LocalNet extends Emitter {
    constructor() {
      super(); this.online = false; const self = this;
      const storage = {
        load: k => { try { return JSON.parse(localStorage.getItem('ely_save_' + k)); } catch (e) { return null; } },
        save: (k, d) => { try { localStorage.setItem('ely_save_' + k, JSON.stringify(d)); } catch (e) {} },
        nameTaken: () => false
      };
      this.core = new GameCoreLib.GameCore({ storage });
      this.conn = { id: 'local', account: { id: 'offline', type: 'local' }, send: m => setTimeout(() => self.dispatch(m), 0) };
      let last = performance.now();
      this.iv = setInterval(() => { const now = performance.now(); this.core.tick(Math.min(0.1, (now - last) / 1000)); last = now; }, 50);
    }
    connect() { this.core.addClient(this.conn); setTimeout(() => this.dispatch({ t: 'authOk', token: 'offline', account: { id: 'offline', type: 'local', label: 'โหมดออฟไลน์' }, servers: this.core.serverList() }), 0); return Promise.resolve(); }
    send(m) { if (m.t === 'auth') return; this.core.handle(this.conn, m); }
  }
  G.WsNet = WsNet; G.LocalNet = LocalNet;
  G.serverUrl = function () {
    if (location.protocol === 'http:' || location.protocol === 'https:') return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    return 'ws://localhost:8080';
  };
})();
