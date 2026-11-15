// iPhone (Safari) stand-in for the Capacitor plugins the Android build uses.
// api-android.js is shared as it is; only the parts under it change:
//   Filesystem → IndexedDB (database "shobo", kept inside the home-screen app)
//   Share      → the iPhone share sheet (navigator.share with files)
//   Clipboard  → navigator.clipboard
//   App        → page visibility (pause/resume)
// Every file is also kept in memory, so reads are instant; writes go to IndexedDB before they resolve.
(function () {
'use strict';
window.SHOBO_WEB = true;
const VERSION = '1.1.14';
const DBN = 'shobo', ST = 'files';
const mem = { DATA: new Map(), CACHE: new Map() };
const norm = p => String(p).replace(/^\/+|\/+$/g, '');
const parent = p => p.split('/').slice(0, -1).join('/');
const fail = msg => { const e = new Error(msg); return Promise.reject(e); };

let db = null;
function openDb() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DBN, 1);
    rq.onupgradeneeded = () => { rq.result.createObjectStore(ST, { keyPath: 'p' }); };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error || new Error('保存場所（IndexedDB）を開けませんでした'));
    rq.onblocked = () => rej(new Error('ほかの画面で書房が開いています。閉じてからもう一度開いてください'));
  });
}
const loaded = (async () => {
  db = await openDb();
  db.onversionchange = () => { try { db.close(); } catch (e) {} };
  await new Promise((res, rej) => {
    const rq = db.transaction(ST, 'readonly').objectStore(ST).getAll();
    rq.onsuccess = () => { for (const r of rq.result || []) mem.DATA.set(r.p, { dir: !!r.dir, data: r.data, mtime: r.mtime }); res(); };
    rq.onerror = () => rej(rq.error);
  });
})();
loaded.catch(e => { if (window.__bootShow) window.__bootShow(String(e && e.message || e)); });

// one IndexedDB transaction for a set of puts and deletes (DATA only; CACHE stays in memory)
function persist(puts, dels) {
  return new Promise((res, rej) => {
    const tx = db.transaction(ST, 'readwrite'); const os = tx.objectStore(ST);
    for (const k of dels || []) os.delete(k);
    for (const [k, v] of puts || []) os.put({ p: k, dir: !!v.dir, data: v.dir ? '' : v.data, mtime: v.mtime });
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error || new Error('保存できませんでした'));
    tx.onabort = () => rej(tx.error && /quota/i.test(tx.error.name) ? new Error('iPhoneの空き容量が足りないため保存できませんでした') : (tx.error || new Error('保存できませんでした')));
  });
}
let last = 0;
const now = () => { const t = Date.now(); last = t > last ? t : last + 1; return last; };
function ensureDirs(dir, p, puts) {
  const m = mem[dir]; let cur = '';
  for (const seg of norm(p).split('/').slice(0, -1)) {
    cur = cur ? cur + '/' + seg : seg;
    if (!m.has(cur)) { const v = { dir: true, mtime: now() }; m.set(cur, v); if (puts) puts.push([cur, v]); }
  }
}
const save = (dir, puts, dels) => dir === 'DATA' ? persist(puts, dels) : Promise.resolve();
const sizeOf = v => v.dir ? 0 : new Blob([v.data]).size;

const FS = {
  async stat({ path, directory }) { await loaded; const v = mem[directory].get(norm(path)); if (!v) return fail('File does not exist'); return { type: v.dir ? 'directory' : 'file', mtime: v.mtime, ctime: v.mtime, size: v.dir ? 0 : String(v.data).length, uri: 'web://' + directory + '/' + norm(path) }; },
  async readFile({ path, directory }) { await loaded; const v = mem[directory].get(norm(path)); if (!v || v.dir) return fail('File does not exist'); return { data: v.data }; },
  async writeFile({ path, data, directory }) {
    await loaded; const p = norm(path), puts = [];
    ensureDirs(directory, p, puts);
    const v = { dir: false, data: String(data), mtime: now() }; mem[directory].set(p, v); puts.push([p, v]);
    await save(directory, puts); return { uri: 'web://' + directory + '/' + p };
  },
  async readdir({ path, directory }) {
    await loaded; const m = mem[directory], p = norm(path);
    if (p && !(m.get(p) || {}).dir) return fail('Directory does not exist');
    const files = [];
    for (const [k, v] of m) if (k !== p && parent(k) === p) files.push({ name: k.split('/').pop(), type: v.dir ? 'directory' : 'file', mtime: v.mtime, ctime: v.mtime, size: v.dir ? 0 : String(v.data).length, uri: 'web://' + directory + '/' + k });
    return { files };
  },
  async mkdir({ path, directory }) {
    await loaded; const p = norm(path), m = mem[directory];
    if (m.has(p)) return fail('Directory exists');
    const puts = []; ensureDirs(directory, p + '/x', puts); await save(directory, puts);
  },
  async rmdir({ path, directory }) {
    await loaded; const m = mem[directory], p = norm(path);
    if (!m.has(p)) return fail('Directory does not exist');
    const dels = []; for (const k of [...m.keys()]) if (k === p || k.startsWith(p + '/')) { m.delete(k); dels.push(k); }
    await save(directory, [], dels);
  },
  async deleteFile({ path, directory }) {
    await loaded; const p = norm(path), m = mem[directory];
    if (!m.has(p)) return fail('File does not exist');
    m.delete(p); await save(directory, [], [p]);
  },
  async rename({ from, to, directory, toDirectory }) {
    await loaded; const m = mem[directory], f = norm(from), t = norm(to);
    if ((toDirectory || directory) !== directory) return fail('rename across places is not supported');
    if (!m.has(f)) return fail('File does not exist');
    const puts = [], dels = []; ensureDirs(directory, t, puts);
    for (const k of [...m.keys()]) if (k === f || k.startsWith(f + '/')) { const v = m.get(k); m.delete(k); dels.push(k); const nk = t + k.slice(f.length); m.set(nk, v); puts.push([nk, v]); }
    await save(directory, puts, dels);
  },
  async getUri({ path, directory }) { return { uri: 'web://' + directory + '/' + norm(path) }; }
};

/* ---- a button the user taps, for the few things Safari only allows straight after a tap ---- */
function tapToFinish(title, body, label, act) {
  return new Promise((res, rej) => {
    const box = document.createElement('div'); box.className = 'web-tap';
    box.innerHTML = '<div class="web-tap-in"><h3></h3><p></p><div class="row"><button class="btn ghost" type="button" data-no>やめる</button><button class="btn gold" type="button" data-go></button></div></div>';
    box.querySelector('h3').textContent = title; box.querySelector('p').textContent = body; box.querySelector('[data-go]').textContent = label;
    document.body.appendChild(box);
    box.querySelector('[data-no]').addEventListener('click', () => { box.remove(); rej(new Error('cancel')); });
    box.querySelector('[data-go]').addEventListener('click', () => { const r = act(); box.remove(); Promise.resolve(r).then(res, rej); });
  });
}

/* ---- the share sheet: 「"ファイル"に保存」 puts the files in iCloud Drive / このiPhone内 ---- */
const typeFor = n => /\.json$/i.test(n) ? ['application/json', 'text/plain'] : ['text/markdown', 'text/plain'];
function asFile(uri) {
  const m = /^web:\/\/(DATA|CACHE)\/(.*)$/.exec(uri); const v = m && mem[m[1]].get(m[2]);
  if (!v) throw new Error('書き出すファイルが見つかりません');
  const name = m[2].split('/').pop();
  for (const t of typeFor(name)) { const f = new File([v.data], name, { type: t }); if (!navigator.canShare || navigator.canShare({ files: [f] })) return f; }
  return new File([v.data], name, { type: 'text/plain' });
}
function download(files) {
  for (const f of files) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
}
const Share = {
  async share(o) {
    const files = (o.files || []).map(asFile);
    const canFiles = navigator.share && (!navigator.canShare || navigator.canShare({ files }));
    if (!canFiles) { download(files); return {}; }
    const go = () => navigator.share({ files });
    try { await go(); return {}; }
    catch (e) {
      if (e && e.name === 'AbortError') throw new Error('Share canceled');
      if (e && e.name === 'NotAllowedError') {
        // Safari wants the share sheet opened right after a tap: ask for one more tap
        try { await tapToFinish('書き出しの準備ができました', files.length > 1 ? `${files.length}個のファイルを書き出します。` : `「${files[0].name}」を書き出します。`, '共有メニューを開く', go); return {}; }
        catch (e2) { if (e2 && (e2.name === 'AbortError' || /cancel/i.test(e2.message))) throw new Error('Share canceled'); throw e2; }
      }
      throw e;
    }
  }
};

const Clipboard = {
  async write({ string }) {
    const s = String(string);
    try { await navigator.clipboard.writeText(s); return; } catch (e) {}
    await tapToFinish('コピーの準備ができました', `${s.length.toLocaleString()}字をコピーします。`, 'コピーする', () => navigator.clipboard.writeText(s));
  }
};

/* ---- app life: going to the background is "pause", coming back is "resume" ---- */
const App = {
  addListener(ev, cb) {
    let h = null;
    if (ev === 'pause') { h = () => { if (document.visibilityState === 'hidden') cb(); }; document.addEventListener('visibilitychange', h); window.addEventListener('pagehide', cb); }
    else if (ev === 'resume') { h = () => { if (document.visibilityState === 'visible') cb(); }; document.addEventListener('visibilitychange', h); }
    return { remove() { if (h) document.removeEventListener('visibilitychange', h); if (ev === 'pause') window.removeEventListener('pagehide', cb); } };
  },
  minimizeApp() {},
  async getInfo() { return { version: VERSION, build: '', name: '蛇喰鷲書房', id: 'shobo-web' }; }
};

window.capacitorFilesystem = { Filesystem: FS };
window.capacitorShare = { Share };
window.capacitorClipboard = { Clipboard };
window.capacitorApp = { App };
window.__shoboWeb = { loaded, mem, sizeOf };
})();
