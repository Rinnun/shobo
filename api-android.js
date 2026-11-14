// Android storage layer for 蛇喰鷲書房.
// Gives the shared screen code the same window.api the Windows build gets from Electron,
// but keeps everything in the app's own storage (Capacitor Filesystem):
//   library/<作品>/<章>.md, library/<作品>/_作品情報.json
//   library/_書房の記録/progress.json, backup/, trash/
// Files go to and from Google Drive through the system file picker and the share sheet.
(function () {
'use strict';
// Plugins come from Capacitor's prebuilt browser scripts in vendor/ (loaded before this file).
const need = (g, k) => { if (!window[g] || !window[g][k]) throw new Error('Capacitor の部品「' + g + '.' + k + '」が読み込めませんでした'); return window[g][k]; };
const FS = need('capacitorFilesystem', 'Filesystem');
const Share = need('capacitorShare', 'Share');
const Clip = need('capacitorClipboard', 'Clipboard');
const App = need('capacitorApp', 'App');
const M = window.MdTools;
const WEB = !!window.SHOBO_WEB;   // the iPhone web version (ios-web/web-cap.js stands in for Capacitor)
const D = 'DATA', CACHE = 'CACHE';
const ROOT = 'library', SYS = ROOT + '/_書房の記録', META = '_作品情報.json';
const j = (...a) => a.filter(Boolean).join('/');
const pad = n => String(n).padStart(2, '0');
const dayStamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

async function exists(p, dir = D) { try { await FS.stat({ path: p, directory: dir }); return true; } catch { return false; } }
async function readText(p) { const r = await FS.readFile({ path: p, directory: D, encoding: 'utf8' }); return String(r.data).replace(/^﻿/, ''); }
async function writeText(p, data, dir = D) { await FS.writeFile({ path: p, data: String(data), directory: dir, encoding: 'utf8', recursive: true }); }
async function ls(p) { try { return (await FS.readdir({ path: p, directory: D })).files || []; } catch { return []; } }
async function mkdirp(p, dir = D) { try { await FS.mkdir({ path: p, directory: dir, recursive: true }); } catch {} }
async function rmrf(p, dir = D) { try { await FS.rmdir({ path: p, directory: dir, recursive: true }); } catch { try { await FS.deleteFile({ path: p, directory: dir }); } catch {} } }
async function move(from, to) { await FS.rename({ from, to, directory: D, toDirectory: D }); }
const entName = e => typeof e === 'string' ? e : e.name;
const isDir = e => typeof e !== 'string' && e.type === 'directory';
const isFile = e => typeof e === 'string' ? true : e.type === 'file';

async function uniqueName(dir, base, ext, except) {
  let n = base + ext, i = 2;
  while (n !== except && await exists(j(dir, n))) { n = `${base} (${i})${ext}`; i++; }
  return n;
}

const cache = new Map(); const backedUp = new Set();
const wdir = wid => { if (!wid || /[\\/]/.test(wid) || wid === '..') throw new Error('bad work id'); return j(ROOT, wid); };
const cfile = (wid, cid) => { if (!cid || /[\\/]/.test(cid)) throw new Error('bad chapter id'); return j(wdir(wid), cid); };
async function readMeta(wid) { try { return JSON.parse(await readText(j(wdir(wid), META))); } catch { return null; } }
async function writeMeta(wid, m) { await writeText(j(wdir(wid), META), JSON.stringify(m, null, 2)); }
async function meta(wid) { return (await readMeta(wid)) || { cover: 'kraft', order: [], createdAt: Date.now() }; }
// chapter notes and the plot (which arrives from the PC in the hand-over file) live with the app's records
// "(1)" from exporters and "（スマホ 11-14）" from a phone edit are not part of a plot's name
const PHONE_MARK = /[ 　]*[(（]スマホ[^)）]*[)）]$/;
const plotKey = f => { let b = M.baseName(String(f).split('/').pop()), o; do { o = b; b = b.replace(/[ 　]*[(（]\d+[)）]$/, '').replace(PHONE_MARK, '').trim(); } while (b !== o); return b; };
async function readJson(p, d) { try { return JSON.parse(await readText(p)); } catch { return d; } }
const memoPath = wid => { wdir(wid); return j(SYS, 'memo', wid + '.json'); };
const plotPath = wid => { wdir(wid); return j(SYS, 'plot', wid + '.json'); };
async function readMemos(wid) { return (await readJson(memoPath(wid), {})) || {}; }
async function writeMemos(wid, all) { await writeText(memoPath(wid), JSON.stringify(all)); }
async function readMemo(wid, cid) { const m = (await readMemos(wid))[cid]; return m ? { text: String(m.text || ''), updatedAt: m.updatedAt || 0 } : { text: '', updatedAt: 0 }; }
async function writeMemo(wid, cid, text) {
  if (!cid || /[\\/]/.test(cid)) throw new Error('bad chapter id');
  const all = await readMemos(wid); text = String(text || '');
  if (text.trim()) all[cid] = { text, updatedAt: Date.now() }; else delete all[cid];
  await writeMemos(wid, all); return true;
}
// The phone keeps a copy of the plot: either the one that came from the PC in a bundle (src 'pc'),
// or one picked on the phone from Drive (src 'phone', replaced by hand). updatedAt = the source file's date.
async function plotInfo(wid) {
  const p = await readJson(plotPath(wid), null); if (!p || typeof p.text !== 'string') return null;
  const phone = p.src === 'phone';
  return { key: p.key || plotKey(p.file || ''), mode: phone ? 'phone' : 'pc', file: p.file || '', text: p.text, mtime: Number(p.updatedAt) || 0, pickedAt: Number(p.pickedAt) || 0, chars: M.countChars(p.text), versions: [], fromPc: !phone, fromPhone: phone };
}
async function pickPlotFile(wid) {
  await ready;
  const files = await pickFiles(false); if (!files.length) return null;
  const f = files[0];
  if (/\u0000/.test(f.text.slice(0, 2000))) throw new Error('文字のファイルではないようです');
  const now = Date.now();
  // Drive does not always pass the file's date; then the time it was picked stands in for it
  const mt = Number(f.mtime) || 0, date = mt > 0 && mt < now - 5000 ? mt : now;
  const rec = { key: plotKey(f.name), file: f.name, text: f.text, updatedAt: date, pickedAt: now, src: 'phone' };
  await writeText(plotPath(wid), JSON.stringify(rec));
  return { file: f.name, chars: M.countChars(f.text), dated: date !== now };
}
// writing the plot on the phone: the copy here is changed, and the next bundle carries it to the PC
// as a new version named "<名前>（スマホ 11-14）.md" (the PC can give it the plain name back)
async function createPlot(wid) {
  await ready;
  const name = wid + 'プロット', rec = { key: name, file: name + '.md', text: '# ' + wid + ' プロット\n\n', updatedAt: Date.now(), src: 'phone', edited: true };
  await writeText(plotPath(wid), JSON.stringify(rec)); return { key: name, mode: 'phone', file: rec.file };
}
async function savePlot(wid, rel, text) {
  await ready;
  const cur = await readJson(plotPath(wid), null);
  if (cur && typeof cur.text === 'string') {
    const d0 = new Date(), st = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}_${pad(d0.getHours())}${pad(d0.getMinutes())}${pad(d0.getSeconds())}`;
    const bdir = j(SYS, 'backup', 'plot', wid);
    await writeText(j(bdir, st + '_' + String(cur.file || 'プロット.md').split('/').pop()), cur.text);
    const olds = (await ls(bdir)).map(f => f.name || f).sort();
    for (const f of olds.slice(0, Math.max(0, olds.length - 40))) await rmrf(j(bdir, f));
  }
  const base = plotKey((cur && cur.file) || rel || (wid + 'プロット.md')), d = new Date();
  const rec = { key: base, file: `${base}（スマホ ${pad(d.getMonth() + 1)}-${pad(d.getDate())}）.md`, text: String(text), updatedAt: Date.now(), src: 'phone', edited: true };
  await writeText(plotPath(wid), JSON.stringify(rec));
  return { mtime: rec.updatedAt, file: rec.file, chars: M.countChars(rec.text) };
}
async function clearPlot(wid) { if (await exists(plotPath(wid))) await rmrf(plotPath(wid)); return true; }

async function init() {
  await mkdirp(j(SYS, 'backup')); await mkdirp(j(SYS, 'trash'));
  const cutoff = Date.now() - 30 * 864e5;
  for (const e of await ls(j(SYS, 'backup'))) { const t = Date.parse(entName(e)); if (t && t < cutoff) await rmrf(j(SYS, 'backup', entName(e))); }
  const idx = await trashIndex(); const keep = [];
  for (const t of idx) { if (t.at < cutoff) await rmrf(j(SYS, 'trash', t.id)); else keep.push(t); }
  if (keep.length !== idx.length) await writeTrashIndex(keep);
}
const ready = init();

async function workInfo(wid) {
  const dir = wdir(wid);
  const stored = await readMeta(wid);
  const m = stored || { cover: 'kraft', order: [], createdAt: Date.now() };
  const ents = await ls(dir);
  const pl = await readJson(plotPath(wid), null); const pkey = pl && (pl.key || plotKey(pl.file || ''));
  const files = ents.filter(e => isFile(e) && M.CH_RE.test(entName(e)) && !(pkey && plotKey(entName(e)) === pkey)).map(entName).sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));
  const byName = new Map(ents.map(e => [entName(e), e]));
  const order = (m.order || []).filter(n => files.includes(n));
  for (const f of files) if (!order.includes(f)) order.push(f);
  const hiddenSet = new Set(m.hidden || []); const hidden = [];
  const chapters = []; let chars = 0, updatedAt = m.createdAt || 0;
  for (const f of order) {
    if (hiddenSet.has(f)) { hidden.push({ id: f, title: M.baseName(f) }); continue; }
    const p = j(dir, f); let e = byName.get(f);
    if (!e || e.mtime == null) { try { e = await FS.stat({ path: p, directory: D }); } catch { continue; } }
    const mtime = Number(e.mtime) || 0, size = Number(e.size) || 0;
    const c = cache.get(p); let n;
    if (c && c.mtime === mtime && c.size === size) n = c.chars;
    else { n = M.countChars(await readText(p)); cache.set(p, { mtime, size, chars: n }); }
    chapters.push({ id: f, title: M.baseName(f), chars: n, mtime });
    chars += n; if (mtime > updatedAt) updatedAt = mtime;
  }
  const isWork = !!stored || files.length > 0;
  if (isWork && (!stored || order.join('\n') !== (m.order || []).join('\n'))) { m.order = order; await writeMeta(wid, m).catch(() => {}); }
  return { id: wid, title: wid, cover: m.cover || 'kraft', face: m.face === 'lo' ? 'lo' : 'ro', titleBreak: m.titleBreak || '', chapters, hidden, chars, updatedAt, isWork, plot: pkey ? { key: pkey, mode: 'pc' } : null };
}
async function listWorks() {
  await ready;
  const out = [];
  for (const e of await ls(ROOT)) {
    const name = entName(e);
    if (!isDir(e) || /^[_.]/.test(name)) continue;
    try { const w = await workInfo(name); if (w.isWork) out.push(w); } catch {}
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}
async function readChapter(wid, cid) {
  const p = cfile(wid, cid);
  const [text, st] = await Promise.all([readText(p), FS.stat({ path: p, directory: D })]);
  return { text, mtime: Number(st.mtime) || 0 };
}
async function writeChapter(wid, cid, text) {
  const p = cfile(wid, cid);
  const bkey = dayStamp() + '/' + wid + '/' + cid;
  if (!backedUp.has(bkey)) {
    backedUp.add(bkey);
    const b = j(SYS, 'backup', dayStamp(), wid, cid);
    if (!(await exists(b)) && (await exists(p))) { try { await writeText(b, await readText(p)); } catch {} }
  }
  await writeText(p, text);
  const st = await FS.stat({ path: p, directory: D });
  const chars = M.countChars(text);
  cache.set(p, { mtime: Number(st.mtime) || 0, size: Number(st.size) || 0, chars });
  return { mtime: Number(st.mtime) || 0, chars };
}
async function createWork(title) {
  await ready;
  const name = await uniqueName(ROOT, M.sanitize(title), '');
  await mkdirp(j(ROOT, name));
  await writeMeta(name, { cover: 'kraft', order: [], createdAt: Date.now() });
  return name;
}
async function renameWork(wid, title) {
  const name = await uniqueName(ROOT, M.sanitize(title), '', wid);
  if (name !== wid) {
    await move(wdir(wid), j(ROOT, name));
    for (const d of ['memo', 'plot']) if (await exists(j(SYS, d, wid + '.json'))) { try { await move(j(SYS, d, wid + '.json'), j(SYS, d, name + '.json')); } catch {} }
  }
  return name;
}
async function setCover(wid, cover) { const m = await meta(wid); m.cover = cover; await writeMeta(wid, m); }
async function setFace(wid, o) { const m = await meta(wid); if (o.face !== undefined) m.face = o.face === 'lo' ? 'lo' : 'ro'; if (o.titleBreak !== undefined) m.titleBreak = String(o.titleBreak || '').trim(); await writeMeta(wid, m); }
async function setOrder(wid, order) {
  const m = await meta(wid); const hid = (m.order || []).filter(x => (m.hidden || []).includes(x) && !order.includes(x));
  m.order = [...order, ...hid]; await writeMeta(wid, m);
}
async function setHidden(wid, ids, hide) {
  const m = await meta(wid); const h = new Set(m.hidden || []);
  for (const id of ids) { if (hide) h.add(id); else h.delete(id); }
  m.hidden = [...h]; await writeMeta(wid, m);
}
async function createChapter(wid, title, body) {
  const name = await uniqueName(wdir(wid), M.sanitize(title), '.md');
  await writeText(j(wdir(wid), name), body || '');
  const m = await meta(wid); m.order = [...(m.order || []).filter(x => x !== name), name]; await writeMeta(wid, m);
  return name;
}
async function renameChapter(wid, cid, title) {
  const ext = (cid.match(M.CH_RE) || ['.md'])[0];
  const name = await uniqueName(wdir(wid), M.sanitize(title), ext, cid);
  if (name === cid) return cid;
  await move(cfile(wid, cid), j(wdir(wid), name));
  const m = await meta(wid); m.order = (m.order || []).map(x => x === cid ? name : x); await writeMeta(wid, m);
  const memos = await readMemos(wid);
  if (memos[cid]) { memos[name] = memos[cid]; delete memos[cid]; await writeMemos(wid, memos).catch(() => {}); }
  return name;
}

/* ---- recently deleted (Android has no recycle bin) ---- */
async function trashIndex() { try { return JSON.parse(await readText(j(SYS, 'trash', 'index.json'))); } catch { return []; } }
async function writeTrashIndex(list) { await writeText(j(SYS, 'trash', 'index.json'), JSON.stringify(list)); }
async function trashWork(wid) {
  const id = Date.now() + '-w'; await mkdirp(j(SYS, 'trash'));
  await move(wdir(wid), j(SYS, 'trash', id));
  const idx = await trashIndex(); idx.unshift({ id, kind: 'work', name: wid, at: Date.now() }); await writeTrashIndex(idx);
  return true;
}
async function trashChapter(wid, cid) {
  const id = Date.now() + '-c'; await mkdirp(j(SYS, 'trash'));
  await move(cfile(wid, cid), j(SYS, 'trash', id));
  const idx = await trashIndex(); idx.unshift({ id, kind: 'chapter', name: M.baseName(cid), file: cid, work: wid, at: Date.now() }); await writeTrashIndex(idx);
  const m = await meta(wid); m.order = (m.order || []).filter(x => x !== cid); m.hidden = (m.hidden || []).filter(x => x !== cid); await writeMeta(wid, m);
  return true;
}
async function restoreTrash(id) {
  const idx = await trashIndex(); const t = idx.find(x => x.id === id); if (!t) throw new Error('not found');
  if (t.kind === 'work') {
    const name = await uniqueName(ROOT, t.name, '');
    await move(j(SYS, 'trash', id), j(ROOT, name));
  } else {
    if (!(await exists(wdir(t.work)))) { await mkdirp(wdir(t.work)); await writeMeta(t.work, { cover: 'kraft', order: [], createdAt: Date.now() }); }
    const name = await uniqueName(wdir(t.work), M.baseName(t.file), (t.file.match(M.CH_RE) || ['.md'])[0]);
    await move(j(SYS, 'trash', id), j(wdir(t.work), name));
    const m = await meta(t.work); m.order = [...(m.order || []), name]; await writeMeta(t.work, m);
  }
  await writeTrashIndex(idx.filter(x => x.id !== id));
  return t.name;
}

/* ---- picking files (Drive appears in the system picker) ---- */
function pickFiles(multiple) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; if (multiple) inp.multiple = true; inp.style.display = 'none';
    document.body.appendChild(inp);
    let done = false;
    const finish = v => { if (done) return; done = true; inp.remove(); resolve(v); };
    inp.addEventListener('change', async () => {
      const out = [];
      for (const f of inp.files) { if (f.size > 20e6) continue; out.push({ name: f.name, text: await f.text(), mtime: f.lastModified || 0 }); }
      finish(out);
    });
    inp.addEventListener('cancel', () => finish([]));
    inp.click();
  });
}
/* ---- sharing files out (pick "ドライブに保存" in the share sheet) ---- */
async function shareFiles(title, files) {
  const dir = 'export/' + Date.now();
  const uris = [];
  for (const f of files) {
    const p = j(dir, M.sanitize(f.name.replace(/\.(md|json)$/i, '')) + (f.name.match(/\.(md|json)$/i) || ['.md'])[0]);
    await writeText(p, f.text, CACHE);
    uris.push((await FS.getUri({ path: p, directory: CACHE })).uri);
  }
  // No 'title' here: Drive's 「ドライブに保存」 would use it as the file name and drop the extension.
  try { await Share.share({ dialogTitle: title, files: uris }); }
  catch (e) { if (!/cancel/i.test(String(e && e.message))) throw e; return false; }
  return true;
}

async function importFiles(target, level, clean, overwrite) {
  await ready;
  const files = await pickFiles(true);
  if (!files.length) return null;
  let all = [], workTitle = null;
  for (const f of files) {
    if (/\u0000/.test(f.text.slice(0, 2000))) continue;
    const r = M.parseMd(clean !== false ? M.cleanMd(f.text) : f.text, f.name, level || 0);
    if (!workTitle) workTitle = r.workTitle || (files.length === 1 ? M.baseName(f.name) : null);
    all = all.concat(r.chapters);
  }
  if (!all.length) return null;
  let wid = target;
  if (!wid) { const name = M.sanitize(workTitle || '取り込んだ作品'); wid = overwrite !== false && await exists(j(ROOT, name)) ? name : await createWork(name); }
  let replaced = 0;
  for (const c of all) {
    const name = M.sanitize(c.title) + '.md';
    if (overwrite !== false && await exists(j(wdir(wid), name))) {
      await writeChapter(wid, name, c.body); replaced++;
      const m = await meta(wid); if (!(m.order || []).includes(name)) { m.order = [...(m.order || []), name]; await writeMeta(wid, m); }
    } else await createChapter(wid, c.title, c.body);
  }
  return { wid, count: all.length, replaced };
}
async function workMarkdown(wid) {
  const info = await workInfo(wid); const parts = [];
  for (const c of info.chapters) { const { text } = await readChapter(wid, c.id); parts.push('## ' + c.title + '\n\n' + text.replace(/\s+$/, '')); }
  return '# ' + info.title + '\n\n' + parts.join('\n\n') + '\n';
}
async function workPlain(wid) {
  const info = await workInfo(wid); const parts = [];
  for (const c of info.chapters) { const { text } = await readChapter(wid, c.id); parts.push(c.title + '\n\n' + text.replace(/\s+$/, '')); }
  return parts.join('\n\n\n');
}
async function exportChapters(wid, opts) {
  const info = await workInfo(wid); const files = [];
  for (const c of info.chapters) { const { text } = await readChapter(wid, c.id); files.push({ name: c.id, text: M.chapterFileText(c.title, text, opts) }); }
  if (!files.length) return null;
  return (await shareFiles(info.title, files)) ? { dest: '共有メニュー', count: files.length } : null;
}

/* ---- bundle: same format as the Windows build ---- */
async function readProgress() { try { return JSON.parse(await readText(j(SYS, 'progress.json'))); } catch { return null; } }
async function writeProgress(p) { await writeText(j(SYS, 'progress.json'), JSON.stringify(p)); }
async function exportBundle() {
  const works = [];
  for (const w of await listWorks()) {
    const chapters = [];
    for (const c of w.chapters) { const { text } = await readChapter(w.id, c.id); chapters.push({ file: c.id, title: c.title, body: text, updatedAt: Math.round(c.mtime) }); }
    const pj = await readJson(plotPath(w.id), null);
    works.push({ title: w.title, cover: w.cover, face: w.face, titleBreak: w.titleBreak, chapters, memos: await readMemos(w.id), plot: pj && pj.edited && typeof pj.text === 'string' ? { key: pj.key, file: pj.file, text: pj.text, updatedAt: pj.updatedAt, edited: true } : undefined });
  }
  const data = { format: 'shobo-bundle', version: 1, app: '蛇喰鷲書房', exportedAt: new Date().toISOString(), progress: await readProgress(), works };
  const ok = await shareFiles('引き継ぎファイル', [{ name: `蛇喰鷲書房_${WEB ? 'バックアップ' : '引き継ぎ'}_${dayStamp()}.json`, text: JSON.stringify(data) }]);
  return ok ? { works: works.length, chapters: works.reduce((n, w) => n + w.chapters.length, 0) } : null;
}
async function importBundle() {
  const files = await pickFiles(false); if (!files.length) return null;
  let data;
  try { data = JSON.parse(files[0].text.replace(/^﻿/, '')); } catch { const e = new Error('ファイルを読めませんでした'); e.code = 'BAD_BUNDLE'; throw e; }
  if (!data || data.format !== 'shobo-bundle' || !Array.isArray(data.works)) { const e = new Error('引き継ぎファイルではありません'); e.code = 'BAD_BUNDLE'; throw e; }
  const res = { newWorks: 0, added: 0, updated: 0, kept: 0 };
  for (const w of data.works) {
    if (!w || !Array.isArray(w.chapters)) continue;
    const wid = M.sanitize(w.title);
    if (!(await exists(j(ROOT, wid)))) { await mkdirp(j(ROOT, wid)); await writeMeta(wid, { cover: w.cover || 'kraft', face: w.face === 'lo' ? 'lo' : 'ro', titleBreak: w.titleBreak || '', order: [], createdAt: Date.now() }); res.newWorks++; }
    const m = await meta(wid); const order = [...(m.order || [])];
    for (const c of w.chapters) {
      let name = M.sanitize(c.file || c.title); if (!M.CH_RE.test(name)) name += '.md';
      const p = j(wdir(wid), name); const body = String(c.body || ''); const when = Number(c.updatedAt) || 0;
      if (await exists(p)) {
        const st = await FS.stat({ path: p, directory: D }); const local = await readText(p);
        // the phone cannot set a file's time, so "newer" compares the sender's edit time with this file's last write
        if (local === body) res.kept++;
        else if (when > (Number(st.mtime) || 0) + 2000) { await writeChapter(wid, name, body); res.updated++; }
        else res.kept++;
      } else { await writeText(p, body); res.added++; }
      if (!order.includes(name)) order.push(name);
    }
    m.order = order; await writeMeta(wid, m);
    // chapter notes: the newer note wins, chapter by chapter
    if (w.memos && typeof w.memos === 'object') {
      const local = await readMemos(wid); let changed = false;
      for (const [cid, v] of Object.entries(w.memos)) {
        if (!v || typeof v.text !== 'string' || /[\\/]/.test(cid)) continue;
        const l = local[cid];
        if (!l || (Number(v.updatedAt) || 0) > (Number(l.updatedAt) || 0)) { if (!l || l.text !== v.text) { local[cid] = { text: v.text, updatedAt: Number(v.updatedAt) || Date.now() }; changed = true; res.memos = (res.memos || 0) + 1; } }
      }
      if (changed) await writeMemos(wid, local);
    }
    // plot: when the PC's and the phone's differ, the one whose source file is newer stays
    const mine = await readJson(plotPath(wid), null);
    if (w.plot && typeof w.plot.text === 'string') {
      const theirs = Number(w.plot.updatedAt) || 0, ours = mine && typeof mine.text === 'string' ? Number(mine.updatedAt) || 0 : -1;
      if (!mine || mine.text !== w.plot.text) {
        if (theirs >= ours) { await writeText(plotPath(wid), JSON.stringify({ key: w.plot.key || plotKey(w.plot.file || ''), file: w.plot.file || '', text: w.plot.text, updatedAt: theirs || Date.now(), src: 'pc' })); res.plots = (res.plots || 0) + 1; }
        else res.plotsKept = (res.plotsKept || 0) + 1;
      }
    } else if (w.plot === null && mine && mine.src !== 'phone') await rmrf(plotPath(wid));   // the PC took it off; a plot picked on the phone stays
  }
  return { ...res, progress: data.progress || null };
}

let backCb = null;
App.addListener('backButton', () => { if (backCb) backCb(); else App.minimizeApp(); });

window.api = {
  platform: 'android',
  web: WEB,
  root: async () => WEB ? 'このiPhoneの中（ホーム画面の書房の中）' : 'このスマホの中（アプリ専用の場所）',
  list: listWorks,
  work: workInfo,
  chooseRoot: async () => null,
  openFolder: async () => '',
  openPath: async () => '',
  createWork, renameWork, setCover, setFace, setOrder, setHidden, trashWork,
  version: async () => { try { const i = await App.getInfo(); return { version: i.version, platform: WEB ? 'iPhone版（ウェブ）' : 'Android版' }; } catch { return { version: '?', platform: WEB ? 'iPhone版（ウェブ）' : 'Android版' }; } }, workMarkdown, workPlain,
  readChapter, writeChapter, createChapter, renameChapter, trashChapter,
  readMemo, writeMemo, plotInfo, pickPlotFile, clearPlot, createPlot, savePlot,
  listTrash: trashIndex, restoreTrash,
  importFiles,
  saveText: async (name, text) => shareFiles(M.baseName(name), [{ name, text }]),
  copy: async t => { await Clip.write({ string: String(t) }); return true; },
  exportChapters, exportBundle, importBundle,
  readProgress, writeProgress,
  onBeforeClose: cb => App.addListener('pause', () => cb()),
  onFocus: cb => App.addListener('resume', () => cb()),
  onBack: cb => { backCb = cb; },
  minimize: () => App.minimizeApp(),
  closeReady: () => {}
};
})();
