(function () {
'use strict';
const api = window.api;
const IS_ANDROID = api.platform === 'android';
const IS_WEB = !!api.web;   // the iPhone web version (Safari, Home Screen); otherwise it behaves like the phone build
if (IS_ANDROID) document.documentElement.classList.add('android');
// where deleted things go, in words for each platform
const TRASH_NOTE = IS_ANDROID ? '設定の「最近消したもの」に30日間残り、そこから元に戻せます。' : 'Windowsのごみ箱に入るので、元に戻せます。';
const TRASH_WORD = IS_ANDROID ? '「最近消したもの」' : 'ごみ箱';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
// plot mode state (the editor shows the work's plot instead of a chapter)
const PM = { on: false, wid: null, file: '', mtime: 0, saved: '', dirty: false, busy: false, savedAt: '' };
// search bar state
const SR = { open: false, list: [], i: -1, mute: false, last: null, t: null, layer: null, key: null };
const pad = n => String(n).padStart(2, '0');
const fmt = n => Number(n || 0).toLocaleString('ja-JP');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- catalog ---------- */
// plain-coloured spines first (all with gold bands), then the decorated ones
const COVERS = [
  { id: 'kraft', name: '生成り', price: 0, grp: 'plain' }, { id: 'ai', name: '藍', price: 0, grp: 'plain' }, { id: 'enji', name: 'えんじ', price: 0, grp: 'plain' },
  { id: 'shikkoku', name: '漆黒', price: 150, grp: 'plain' }, { id: 'hakuji', name: '白磁', price: 150, grp: 'plain' }, { id: 'hi', name: '緋', price: 150, grp: 'plain' },
  { id: 'ruri', name: '瑠璃', price: 150, grp: 'plain' }, { id: 'asagi', name: '浅葱', price: 150, grp: 'plain' }, { id: 'fukamidori', name: '深緑', price: 150, grp: 'plain' },
  { id: 'wakakusa', name: '若草', price: 150, grp: 'plain' }, { id: 'ebi', name: '葡萄', price: 150, grp: 'plain' }, { id: 'usubeni', name: '薄紅', price: 150, grp: 'plain' },
  { id: 'kurikawa', name: '栗皮', price: 150, grp: 'plain' }, { id: 'nibi', name: '鈍色', price: 150, grp: 'plain' },
  { id: 'sora', name: '空色', price: 150, grp: 'plain' }, { id: 'hakka', name: '薄荷', price: 150, grp: 'plain' },
  { id: 'seigaiha', name: '青海波', price: 400, grp: 'deco' }, { id: 'watoji', name: '和綴じ', price: 400, grp: 'deco' }, { id: 'kosho', name: '古書', price: 500, grp: 'deco' },
  { id: 'kinpaku', name: '金箔', price: 600, grp: 'deco' }, { id: 'madousho', name: '魔導書', price: 700, grp: 'deco' },
  { id: 'seizu', name: '星図', price: 700, grp: 'deco' }, { id: 'ryurin', name: '竜鱗', price: 900, grp: 'deco' },
  { id: 'aozora', name: '青空', price: 600, grp: 'deco' }, { id: 'ramune', name: 'ラムネ', price: 600, grp: 'deco' }];
const SLIMES = [
  { id: 'green', name: '若葉', price: 0, grp: 'slime', c: ['#5cc46b', '#c9f2c4', '#22703a'] },
  { id: 'mizu', name: '水色', price: 120, grp: 'slime', c: ['#5bb8e8', '#d4f0ff', '#1d5c88'] },
  { id: 'momo', name: '桃', price: 120, grp: 'slime', c: ['#f08cb0', '#ffe0ec', '#983a60'] },
  { id: 'yuyake', name: '夕焼け', price: 200, grp: 'slime', c: ['#f39a3f', '#ffe1b8', '#974310'] },
  { id: 'yoru', name: '夜', price: 250, grp: 'slime', c: ['#6a5cc0', '#c4bcf6', '#261d5e'] },
  { id: 'gold', name: '黄金', price: 800, grp: 'slime', c: ['#e2b23a', '#fff1b8', '#86590a'] }];
// looks only: a monster is fought exactly like a slime (HP = the day's goal, same reward)
const MONSTERS = [
  { id: 'ichikaku', name: '一角ウサギ', price: 1500, grp: 'monster', desc: '額に一本の角をもつウサギ。すばしこい' },
  { id: 'kelpie', name: 'ケルピー', price: 2000, grp: 'monster', desc: '水辺にあらわれる馬。たてがみは水草' },
  { id: 'mikeguma', name: '三毛クマ', price: 2000, grp: 'monster', desc: '三色の毛皮を持つクマ。ときどき、鳴き声が三重に聞こえる。' },
  { id: 'griffin', name: 'グリフォン', price: 2500, grp: 'monster', desc: '鷲の頭と翼、獅子の体' },
  { id: 'dragon', name: 'ドラゴン', price: 3000, grp: 'monster', desc: '翼ある赤き竜' }];
const FOES = [...SLIMES, ...MONSTERS];
// items no longer sold: still priced, so coins recomputed after a merge stay right for anyone who bought them
const RETIRED = { cover: { sakura: 150, ichimatsu: 300, yozora: 300, sumi: 500 }, slime: { metal: 500, niji: 1200 }, bgm: { journey: 100 } };
const GROUPS = { plain: ['単色', '生成り・藍・えんじは初めから持っています'], deco: ['装丁', '柄や飾りのある特別な装丁'], slime: ['スライム', '色違い6種'], monster: ['モンスター', '見た目だけ。強さも報酬もスライムと同じです'] };
const isMonster = id => MONSTERS.some(m => m.id === id);
const foeName = id => { const m = MONSTERS.find(x => x.id === id); if (m) return m.name; return (SLIMES.find(x => x.id === id) || SLIMES[0]).name + 'スライム'; };
const SPARKS = [
  { id: 'kin', name: '金', price: 0, c: '#ffd761' },
  { id: 'gin', name: '白銀', price: 100, c: '#e6ecf2' },
  { id: 'beni', name: '紅', price: 150, c: '#ff7f6e' },
  { id: 'midori', name: '翠', price: 150, c: '#86e0a6' },
  { id: 'ao', name: '蒼', price: 150, c: '#8fc8ff' },
  { id: 'murasaki', name: '紫', price: 200, c: '#c6a8ff' },
  { id: 'sakura', name: '桜', price: 200, c: '#ffb3cf' }];
const ZONE_PAL = ['#ffd761', '#c6a8ff', '#9fe7ff', '#ffb3cf', '#9ff0b8'];
const catalog = cat => cat === 'cover' ? COVERS : cat === 'slime' ? FOES : cat === 'bgm' ? BGMS : cat === 'script' ? SCRIPTS : SPARKS;
const CATS = ['cover', 'slime', 'bgm', 'spark', 'script'];
// v1.1.18: 本棚シェアで題を伏せる字（商店の「おまけ」）。字そのものは fakescript.js。説明の文は鱗雲さん作
const SCRIPTS = [
  { id: 'cyr', name: '異世界文字', price: 0, desc: '剣と魔法の世界の文字。', cover: 'enji' },
  { id: 'wa', name: '和風文字', price: 300, desc: '極東の民の文字。筆と墨で、流れるように続けて綴る。', cover: 'watoji' },
  { id: 'voy', name: 'ヴォイニッチ風', price: 400, desc: '誰にも読めない古写本の文字。', cover: 'kosho' },
  { id: 'moji', name: '文字化け', price: 500, desc: '捻じれてひしゃげた異界の文字。', cover: 'madousho' }];
const BGMS = [
  { id: 'none', name: '無音', price: 0, desc: '静かに書きたいときに。' },
  { id: 'rain', name: '雨の書斎', price: 0, desc: '雨音と、ときどきピアノ。' },
  { id: 'morning', name: '朝の小径', price: 100, desc: 'やわらかいアルペジオ。' },
  { id: 'stars', name: '星灯り', price: 100, desc: 'ゆっくり鳴るベルの音。' },
  { id: 'fire', name: '暖炉の書斎', price: 100, desc: '薪のはぜる音と、やわらかい和音。' },
  { id: 'forest', name: '夜の森', price: 100, desc: 'スズムシやコオロギの声と、夜風。' },
  { id: 'clock', name: '振り子時計', price: 100, desc: '振り子の音と、オルゴールのワルツ。' }];
// v1.1.16: BGM は一律100コインに。前の値段で買った曲は、差額を一度だけ返す（bgmPriceFix）
const BGM_OLD_PRICE = { morning: 200, stars: 300, journey: 400 };
const TITLES = [[1, '見習い筆耕'], [5, '駆け出しの書き手'], [10, '物語の旅人'], [20, '言葉の狩人'], [30, '熟練の綴り手'], [45, '万字の賢者'], [65, '物語の守り人'], [90, '伝説の文豪']];
const levelOf = t => Math.floor((Math.sqrt(1 + 8 * Math.max(0, t) / 500) - 1) / 2) + 1;
const titleOf = lv => { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (lv >= l) t = n; return t; };

/* ---------- state ---------- */
const S = {
  root: '', works: [], progress: null,
  view: lsGet('ss.view', 'library'), openWork: null, curWork: lsGet('ss.curWork', null), curCh: lsGet('ss.curCh', null),
  shopCat: 'cover', tidy: false, picked: new Set(), chPick: null
};
const workById = id => S.works.find(w => w.id === id);
function defaults() {
  return {
    coins: 0, totalWritten: 0, goal: 1000, dayStart: 4, daily: {}, kills: {},
    owned: { cover: ['kraft', 'ai', 'enji'], slime: ['green'], bgm: ['none', 'rain'], spark: ['kin'], script: ['cyr'] },
    zone: { count: 0, longest: 0, total: 0 }, zoneDaily: {},
    login: { last: '', streak: 0 }, loginRewards: {}, levelRewards: {},
    equipped: { slime: 'green', bgm: 'rain', spark: 'kin' }, settings: { font: 'mincho', size: 17, lh: 1.95, vol: 0.5, scene: '　＊　＊　＊', exHeading: true, exBr: false, fx: !matchMedia('(prefers-reduced-motion: reduce)').matches, plotDefault: 'auto', plotClean: true, plotFolder: 'folder', foeRandom: false }, createdAt: Date.now()
  };
}
function withDefaults(d) {
  const b = defaults(); d = d || {};
  if (d.equipped && d.equipped.slime && !FOES.some(f => f.id === d.equipped.slime)) d = { ...d, equipped: { ...d.equipped, slime: 'green' } };
  if (d.equipped && d.equipped.bgm && !BGMS.some(f => f.id === d.equipped.bgm)) d = { ...d, equipped: { ...d.equipped, bgm: 'rain' } };
  return { ...b, ...d, owned: { ...b.owned, ...(d.owned || {}) }, equipped: { ...b.equipped, ...(d.equipped || {}) }, settings: { ...b.settings, ...(d.settings || {}) }, daily: d.daily || {}, kills: d.kills || {}, zone: { ...b.zone, ...(d.zone || {}) }, zoneDaily: d.zoneDaily || {}, dev: d.dev || {}, login: { ...b.login, ...(d.login || {}) }, loginRewards: d.loginRewards || {}, levelRewards: d.levelRewards || {} };
}
function dayKey(date) { const s = S.progress ? S.progress.dayStart : 4; const t = new Date((date || new Date()).getTime() - s * 3600e3); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }
function shiftKey(k, n) { const [y, m, d] = k.split('-').map(Number); const t = new Date(y, m - 1, d + n); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }
// v1.1.12: setting「空白と改行も字数に数える」(settings.countWs). The same way counts the shown numbers and the slime damage.
let COUNT_WS = false;
const countChars = s => COUNT_WS ? Array.from(String(s || '').replace(/\r/g, '')).length : Array.from(String(s || '').replace(/[\s　]/g, '')).length;
let countModeSent = null;
async function syncCountMode() {
  COUNT_WS = !!(S.progress && S.progress.settings && S.progress.settings.countWs);
  if (countModeSent !== COUNT_WS && api.setCountMode) { try { await api.setCountMode(COUNT_WS); countModeSent = COUNT_WS; } catch (e) {} }
}

const chains = new Map();
function serial(key, fn) { const prev = chains.get(key) || Promise.resolve(); const next = prev.catch(() => {}).then(fn); chains.set(key, next); return next; }
function fileErr(e, what) {
  const busy = e && /EBUSY|EPERM|EACCES/.test(String(e.code || e.message));
  toast(what + (busy ? '。ファイルが他のアプリで開かれているか、同期中の可能性があります。' : '。') );
}

/* ---------- progress persistence ---------- */
let progT = null;
function saveProgress(now) {
  clearTimeout(progT);
  const run = () => serial('progress', () => api.writeProgress(S.progress)).catch(e => fileErr(e, '進行データを保存できませんでした'));
  if (now) return run();
  progT = setTimeout(run, 800); return Promise.resolve();
}

/* ---------- toast & dialog ---------- */
let toastT; function toast(msg) { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2800); }
const dlg = $('#dlg');
// A close that arrives in the first moments after opening, without anyone pressing a button,
// is treated as spurious: the dialog is shown again. (Seen in Chromium-based views right after showModal.)
const DLG_SETTLE = 400;
function openDlg(html, onBind) {
  dlg.innerHTML = html;
  const token = {}; dlg.__token = token; dlg.__openedAt = performance.now(); dlg.__userClose = false;
  dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDlg()));
  if (onBind) onBind(dlg);
  if (!dlg.open) dlg.showModal();
  const guard = () => {
    if (dlg.__token !== token || dlg.__userClose || dlg.open) return;
    if (performance.now() - dlg.__openedAt < DLG_SETTLE) { try { dlg.showModal(); } catch (e) {} dlg.addEventListener('close', guard, { once: true }); }
  };
  dlg.addEventListener('close', guard, { once: true });
}
// closing on purpose from code (after a button press, or the back button)
function closeDlg() { dlg.__userClose = true; if (dlg.open) dlg.close(); }
function confirmDlg(title, body, okLabel) {
  return new Promise(res => {
    let done = false;
    openDlg(`<div class="dlg"><h3>${esc(title)}</h3><p style="margin:0">${esc(body)}</p><div class="row"><span class="spacer"></span><button class="btn ghost" data-close>やめる</button><button class="btn danger" id="dOk">${esc(okLabel)}</button></div></div>`, d => {
      d.querySelector('#dOk').addEventListener('click', () => { done = true; closeDlg(); res(true); });
      const onClose = () => {
        if (done) return;
        if (!dlg.__userClose && performance.now() - dlg.__openedAt < DLG_SETTLE) { d.addEventListener('close', onClose, { once: true }); return; }
        done = true; res(false);
      };
      d.addEventListener('close', onClose, { once: true });
    });
  });
}
async function copyText(text) { try { await api.copy(text); toast('コピーしました（' + fmt(countChars(text)) + '字）'); } catch (e) { toast('コピーできませんでした'); } }

/* ---------- slime / monster renderer ---------- */
const GW = 24, GH = 18;
function slimeColors(id, t) { const s = SLIMES.find(x => x.id === id) || SLIMES[0]; if (!s.rainbow) return s.c; const h = (t / 20) % 360; return [`hsl(${h} 75% 60%)`, `hsl(${h} 90% 88%)`, `hsl(${h} 70% 30%)`]; }
function mix(a, b) { if (a.startsWith('hsl')) return a; const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v * 0.7 + y[i] * 0.3).toString(16).padStart(2, '0')).join(''); }
// Every cell edge is rounded to a whole pixel (no canvas scaling), so cells meet without the hairline seams
// that showed up as a mesh while the slime squashed and stretched.
function drawSlime(ctx, W, H, { color, t, hit, dead }) {
  ctx.clearRect(0, 0, W, H);
  const [base, light, dark] = slimeColors(color, t);
  const cell = Math.max(1, Math.floor(Math.min(W / GW, H / GH)));
  const sq = dead ? 0 : (reduceMotion ? 0 : Math.sin(t / 260) * 0.06);
  const sx = 1 + sq, sy = 1 - sq - (dead ? 0.38 : 0);
  const cxp = W / 2 + (hit ? Math.sin(t / 18) * cell * 0.4 : 0), by = H;
  const X = v => Math.round(cxp + (v - GW * cell / 2) * sx), Y = v => Math.round(by + (v - GH * cell) * sy);
  const R = (x, y, w, h) => { const x0 = X(x), y0 = Y(y); ctx.fillRect(x0, y0, Math.max(1, X(x + w) - x0), Math.max(1, Y(y + h) - y0)); };
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cxp, Y(GH * cell - cell * 0.6), GW * cell * 0.42 * sx, cell * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  const cx = 11.5, cy = 12.5;
  const inside = (x, y) => { const dx = (x - cx) / 11.2, dy = y - cy; const ry = dy < 0 ? 10.2 : 4.2; return dx * dx + (dy / ry) * (dy / ry) <= 1 && y <= 16.5; };
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    let c = base;
    if (edge) c = dark; else if (y > cy + 1.5) c = dark; else { const hx = x - (cx - 5), hy = y - (cy - 6); if (hx * hx + hy * hy <= 3.2) c = light; else if (y > cy) c = mix(base, dark); }
    ctx.fillStyle = c; R(x * cell, y * cell, cell, cell);
  }
  ctx.fillStyle = dead ? dark : '#1b1408';
  const eye = ex => { if (dead) { [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]].forEach(([a, b]) => R((ex - 1 + a) * cell, (cy - 3 + b) * cell, cell, cell)); } else { R(ex * cell, (cy - 3) * cell, cell, cell * 2); ctx.fillStyle = '#fff'; R(ex * cell, (cy - 3) * cell, cell * 0.5, cell * 0.5); ctx.fillStyle = '#1b1408'; } };
  eye(Math.round(cx - 3.5)); eye(Math.round(cx + 3.5));
  if (!dead) R((cx - 1) * cell, cy * cell, cell * 2, cell * 0.6);
  if (hit) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
}
// Pixel art for the monsters (40×30 cells). One letter per cell; "." is empty. Colours per letter in MON_PAL.
const MON_ART = {
  // v1.1.14: 一角ウサギ (from 鱗雲さん's reference pixel art) and 三毛クマ (after 小松竹さん's three bears) — pc-tools/monster-art/v1114/
  ichikaku: [
    "........................................",
    "........................................",
    "........................................",
    ".....................OOOO...............",
    "....................OWWWO...............",
    "...................OOWWWO...............",
    "..................OWWWWOO...............",
    ".................OWWPPPO................",
    ".................OWWPPO..OOOO...........",
    "........OO......OWWPPPOOOWWWO...........",
    "........OgO.....OWWPOOWWWWWWO...........",
    "........OGgO...OWWWPOWWWPPPOO...........",
    ".........OGGO.OWWWOOWWWPPPOO............",
    "..........OGGOOWWWOWPPPPPOO.............",
    "..........OGGGOWOOWWPPOOO...............",
    "...........OGWWWWWWOPOO.................",
    "..........OWWWWWWWWOO...................",
    ".........OWWWEWWWWO..OOO.O..............",
    "........OWWWWWWWWWO.OWWWOWO.............",
    "........OPWWWWWWWWOOWWWWWWO.............",
    "........OWWWWWWWSSWWWWWWWWWO.OO.........",
    ".........OOWWWWSWWWWWWWWWWWOOWWO........",
    "...........OSSSWWWWWWWWWWWWWOWWO........",
    "...........OSWWWWWWWWSWWWWWWOSSO........",
    "...........OSWWWWWWWSWWWWWWWSOO.........",
    "............OSWWWSSSSWWWWWWWSO..........",
    "............OSOSWSSSSWWWWWWSSO..........",
    "...........OOOOOWSOOSSSSSSSSO...........",
    "...........OWWOWWSO.OOWWWSSOO...........",
    "...........OOOOOOO..OOOOOOOO............"],
  ichikaku_dead: [
    "........................................",
    "........................................",
    "........................................",
    "...........OOOOOOO..OOOOOOOO............",
    "...........OWWOWWSO.OOWWWSSOO...........",
    "...........OOOOOWSOOSSSSSSSSO...........",
    "............OSOSWSSSSWWWWWWSSO..........",
    "............OSWWWSSSSWWWWWWWSO..........",
    "...........OSWWWWWWWSWWWWWWWSOO.........",
    "...........OSWWWWWWWWSWWWWWWOSSO........",
    "...........OSSSWWWWWWWWWWWWWOWWO........",
    ".........OOWWWWSWWWWWWWWWWWOOWWO........",
    "........OWWWWWWWSSWWWWWWWWWO.OO.........",
    "........OPWWWWWWWWOOWWWWWWO.............",
    "........OWWWXWXWWWO.OWWWOWO.............",
    ".........OWWWXWWWWO..OOO.O..............",
    "..........OWXWXWWWWOO...................",
    "...........OGWWWWWWOPOO.................",
    "..........OGGGOWOOWWPPOOO...............",
    "..........OGGOOWWWOWPPPPPOO.............",
    ".........OGGO.OWWWOOWWWPPPOO............",
    "........OGgO...OWWWPOWWWPPPOO...........",
    "........OgO.....OWWPOOWWWWWWO...........",
    "........OO......OWWPPPOOOWWWO...........",
    ".................OWWPPO..OOOO...........",
    ".................OWWPPPO................",
    "..................OWWWWOO...............",
    "...................OOWWWO...............",
    "....................OWWWO...............",
    ".....................OOOO..............."],
  mikeguma: [
    "........................................",
    "............OOO..........OOO............",
    "...........OyyyO........OyyyO...........",
    ".....OOO..OyYYYyO.OOOO.OyYYYyO..OOO.....",
    "....OCyCO.OyIIIYOOyywwOOyIIIYO.OCyCO....",
    "...OyYYYyOOZYIIYyyYWWWwwWIIWVOOwWWWwO...",
    "...OyYYYYO.OZYYYYYYWWWWWWWWVO.OgGGGGO...",
    "...OZYYYYO..OyYYYYYWWWWWWWWO..OgGGGHO...",
    "....OZYYYyO.OyYYYeYWWWWeWWWO.OgGGGHO....",
    ".....OZYYYyOyYYYYKYWWWWKWWWwOgGGGHO.....",
    "......OyYYYyYYYYYYWWWWWWWWWWgGGGGO......",
    "......OZYYYYYYYYWWWKKKWWWWWWGGGGHO......",
    ".......OZYYYYYYYWWWWKWWWWWWWGGGHO.......",
    "........OZYYYYYWWWKKKKKWWWWGGGHO........",
    ".........OyYYYYWWWKRTRKWWWGGGGO.........",
    ".........OZYYYWWWWKRRRKWWGGGGHO.........",
    "..........OZYYWWWWKTRTKWGGGGHO..........",
    "...........OyYWWWWKKKKKWGGGGO...........",
    "..........OyYWWWWWWWWWWWGGGGgO..........",
    ".........OyYYWWWWWWWWWWWGGGGGgO.........",
    ".........OyYYWWWWWWWWWWWGGGGGGO.........",
    ".........OyYYWWWWWWWWWWWGGGGGGO.........",
    ".........OZYYWWWWWWWWWWWGGGGGHO.........",
    "..........OZWWWWWWWWWWWWWGGGHO..........",
    "...........OwWWWWWWWWWWWWGGGO...........",
    "..........OwWWWWWWWWWWWWWGGGgO..........",
    "..........OwWWWWWWVVVVWWWGGGGO..........",
    "..........OVWWWWWWOOOOwWWGGGHO..........",
    "...........OVOVOVVO..OVVVOHOO...........",
    "............OOOOOO....OOOOOO............"],
  mikeguma_dead: [
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    ".O.O........OOOO........OOOO........O.O.",
    "OYOYO......OOWOWO......OWOWOO......OGOGO",
    "OYYYOO....OOOWWWOO....OOWWWOOO....OOGGGO",
    "OYYOOYO..OYOOWWOOWO..OWOOWWOOGO..OGOOGGO",
    "OYYOYYO..OYYOWWOWWO..OWWOWWOGGO..OGGOGGO",
    ".OYOYYYOOYYYOOWOWWWOOWWWOWOOGGGOOGGGOGO.",
    "..OYYYYYYYYYYOOWWWWWWWWWWOOGGGGGGGGGGO..",
    "...OYYYYYYYYZO.OWWWWWWWWVO.OGGGGGGGGHO..",
    "...OYKYYYYKYZO.OWKWWWWKWVO.OGKGGGGKGHO..",
    "...OYYYYYYYYZO.OWWWWWWWWVO.OGGGGGGGGHO..",
    "...OYYYKKYYYZO.OWWWKKWWWVO.OGGGKKGGGHO..",
    "...OYYKRRKYYZO.OWWKRRKWWVO.OGGKRRKGGHO..",
    "...OYYKRRKYYZO.OWWKRRKWWVO.OGGKRRKGGHO..",
    "...OYYKPPKYYZO.OWWKPPKWWVO.OGGKPPKGGHO..",
    "...OYYYKKYYYZO.OWWWKKWWWVO.OGGGKKGGGHO..",
    "...OYYYYYYYYZO.OWWWWWWWWVO.OGGGGGGGGHO..",
    "...OYYYYYYYYZO.OWWWWWWWWVO.OGGGGGGGGHO..",
    "...OYYYYYYYYZO.OWWWWWWWWVO.OGGGGGGGGHO..",
    "...OYYYYYYYYZO.OWWWWWWWWVO.OGGGGGGGGHO..",
    "...OYYYOOYYZO..OWWWOOWWVO..OGGGOOGGHO...",
    "...OYYYOOYYZO..OWWWOOWWVO..OGGGOOGGHO...",
    "...OYOYOOYOZO..OWOWOOWOVO..OGOGOOGOHO..."],
  kelpie: [
    "........................................",
    "............O...........................",
    "...........ObO..........................",
    "...........ObO..........................",
    ".........OOOmmOO........................",
    "........ObbbOmmmO.......................",
    ".......ObBBBbMMMmO......................",
    "......ObBBBBBMMMMO......................",
    ".....ObBBBEBBBMMMmO.....................",
    "....ObBBBBBBBBBMMMmO....................",
    "...ObBBBBBBDBBBBMMMO....................",
    "...ObBBBBBDObBBBMMMmOOOOOOO.............",
    "..ObDBBBDDOObBBBMMMMbbbbbbbOOO.OO.......",
    "..ODDDDDOO.ObBBBMBMMMBBBBBBbbbOmmOO.....",
    "...OOOOO...ODBBBMBMBMBBBBBBBBBbOmmmO....",
    "............ObBBMBMBMBBBBBBBBBBbOmMmO...",
    ".........~..ObBBMBMBMBBBBBBBBBBBOOmMmO..",
    "............ODBBBBMBMBBBBBBBBBBDOOmMMO..",
    ".............ObBBBMBMBBBBBBBBBBO..OmMmO.",
    ".............ObBDBBBMBBBBBBBDBBbO..OmMmO",
    ".............ObBObBBDDDDDDBBObBBO..OmMMO",
    ".............ObBObBBOOOOOObBObBBO..OmMMO",
    ".............ObBObBBO....ObBObBBO..OmmMO",
    ".............ObBObBBO.~..ObBObBBO..OmOmO",
    "............~ObBObBBO....ObBObBBO...OmO.",
    ".............ObBObBBO....ObBObBBO...OmO.",
    ".............ObBOKKKO....ObBOKKKO...OmO.",
    ".............OKKKOOO.....OKKKOOO....OmO.",
    "..............OOO.........OOO....~...O..",
    "........................................"],
  griffin: [
    "......................OOO.......OOOOOOO.",
    ".............O......OOlllOOOOOOOpppppppO",
    "............OcO....OlllLLLLLLpppPZZZZOO.",
    "............OcO....OlLLLLLLLLPPPPOOOOOOO",
    "........OOOOccO....OlLLlLlLLLQQQQqqqqqqq",
    ".......OccccCO....OLllLLLLLLLfZZZZZZZZZZ",
    "......OcCCCCCcOO.OLlLLLLLLlLLLOOOOOOOOOO",
    "...OOOgCCECCCCccOOLlLLLLlLLLfPppppppOOOO",
    "..OgggGCCCCCCCCCOOLlLLlLLLLLLPPZZZZZpppp",
    "...OgKGCCCCCCCCCcOLllLLLLLLfQQQOOOOOOOZO",
    "...OgGGcCCCCCCCCCOllLLLLLfLQQZQqqqOOOOO.",
    "....OggOcccCCCCCCOlLLLLfLPPPPOqZZZqqqqO.",
    ".....OO.OOOcCCCCCclLLfLLQQPZPpPOOOOZZZO.",
    "..........OcCCCCCCCfLLPQQQQOpZZpppOOOO..",
    "..........OcCCCCCCCOLPPPPQZqQOOZZZpO....",
    "..........OcCCCCCCCcTTTTTTOqQqqOOOO.....",
    "..........OcCCCCCCCCTTTTTTtTTQQO........",
    "..........OcCCCCCCCCTTTTTTTTTTTO.....OO.",
    "..........OcCCCCCCCCTTTTTTTTTTTtO...ODDO",
    "...........OcCCCCCCTTTTTTTTTTTTTO...ODDD",
    "...........OcCCCCCCTTTTTTTTTTTTTO...ODDO",
    "............OgGGCTTTTTTTTTTTTTTttOOOttO.",
    "............OgGGtTTTTTTTTTTTTttOOttttO..",
    "............OgGGOtttTTTTTTTTTOO..OOtO...",
    "............OgGGOOOOttttttTTTO.....O....",
    "............OgGGO...OOOOOOtTTO..........",
    "............OgGGO........OtTTO..........",
    "............OgGGO........OtttO..........",
    "...........OHHHHHO........OOO...........",
    "............OOOOO......................."],
  dragon: [
    "..............O...........O.............",
    ".........O..OOHO...O.....OWO............",
    "........OHOOHHO...OWO...OWwwO....O......",
    ".......OHOOHHO....OwWO.OWwwWO...OWO.....",
    ".......OHOHHO.....OwWWOWWwWWWO.OWwwO....",
    ".....OOrHrHROO....OwWWWWwWWWWWOwwWWO....",
    "...OOrrRRRRRrrO...OwWWWwwWWWWWwwWWWO....",
    "..OrrRRRERRRRRO...OwWWWwWWWWWwwWWWWWO...",
    ".OrDRRRRRRRRRRDO.OWwWWwwWWWwwWWWWWWWO...",
    ".ODRRRDRRRRRRRRO.OWwWWwWWWwwWWWWWWWO....",
    "..ODDDODDDRRRRRO.OWwWwWWWwwWWWWWWWO.....",
    "...OOO.OOOrRRRRO.OWwwwWwwWWWWWWWWWO.....",
    ".........OrRRRRrOOWwwWwwWWWWWWWWWO......",
    ".........OrRRRRRODWwwwDWWWWWWWWWO......O",
    ".........OrRRRRRrOrRRwRRRRDWWOOO......Or",
    ".........ODRRRRRRrRRRRRRRRRRRODO......Or",
    "..........OrDRRRRRRRRRRRRRRRRrO......OrR",
    "..........ODOrRRRRRRRRRRRRRRRRrO....OrRR",
    "...........OOrRRRRRRRRRRRRRRRRRrO....OrD",
    "...........OrRRRYYYYRRRRRRRRRRRRrO..OrRO",
    "............OyYYYYYYYYYYRRRRRRRRRrOOrRDO",
    "............OyRRRRYYYYYYYRRRRRDDRRrrRDO.",
    ".............OrRRRYYYYYYYRRRRDOODDRRDO..",
    ".............OrRRRYYYYYYRRRRRO..OODDO...",
    ".............OrRRRyyDDDDDRRRRO....OO....",
    ".............OrRRROOOOOOOrRRRO..........",
    ".............OrRRRO.....OrRRRO..........",
    ".............OrRRRO.....OrRRRO..........",
    "............OHHHHHHO...OHHHHHHO.........",
    ".............OOOOOO.....OOOOOO.........."],
  kelpie_dead: [
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "............~.....~.....................",
    "...........~.....~......................",
    "...........~.....~......................",
    "............~.....~.....................",
    "............~.....~.....................",
    "...........~.....~......................",
    "..OOO.......OOOOOOOO....................",
    ".ObbbO...OOOmmmmmmmmOO...........O......",
    ".OJBBOOOOmmmmMMMMMmmmmO.........OgO.O...",
    "..ObBbbbmMmMMMMMMMMMMMmO......O.OgOOgO..",
    ".ObBBJJMMMMMMMMMMMMMMMMmO....OgOOgOOgOOO",
    ".OJBJOOmMMMMMMMMMMMMMMMMmO.OOOHgOgOgGOgg",
    "..OJO.OmMMMMMMMMMMMMMMMMMOObbbOggGgGGOgO",
    "...O..ONMMMMMMMMMMMMMMMMMbbBBJgGgGgGGgGO",
    ".......ONMMMMMMMMMMMMMMNJJJBBOgGGGGGGgGO",
    "........ONNNNNNNMMMMMMMOOOObBbHGGgGGGGGO",
    "....OOOOOOpMMMMNNNMMMPPppppPBBOgGGGGgHHO",
    "..OOppppppPPPPPPPPPPPPPPPPPPPPpPGGGGGOO.",
    ".OppPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPpO.",
    "..OQQQQQPPPPPPPPPPPPPPPPPPPPPPPPQQQQQO..",
    "...OOOOOQQQQQQQQQQQQQQQQQQQQQQQQOOOOO...",
    "........OOOOOOOOOOOOOOOOOOOOOOOO........"],
  griffin_dead: [
    "............OllllO......................",
    "...........OlLLlO.......................",
    "........OOOOlLlO...........OO...........",
    ".......OpppOnnO...........OppOO.........",
    "......OpPPZOOO............OnnppO........",
    "....OOpPZZO................OZPPpO.......",
    "...OppPZOO...........OO.....OZPPpO......",
    "..OpPPZO...........OOccO.....OZPPpO.....",
    "..OnnZO...........OccCcO......OZZZO.....",
    "...OOO...........OcCCcO........OOO......",
    "................OcCCcO...............OOO",
    "...............OcCCcO..............OOlll",
    "...............OnncO.............OOllLLl",
    "................OOO.............OllLLllO",
    "...............................OlLLllOO.",
    "...............................OnnlOO...",
    "................................OOO.....",
    "........................................",
    "......OOO...............................",
    ".....OcccOO.............................",
    ".....OnnCccOOO........OOOOOO............",
    "......OcccCcccO....OOOppppppO...........",
    ".......OOOccCCcO..OpppPZZZZZO...........",
    "..........OOcccO..OnnZZOOOOO..OOO.......",
    "............OOO....OOOO......OcccOO.....",
    ".OOOO........................OnnCccOOO..",
    "OllllOOOO.....................OcccCcccO.",
    "OnnLLllllO.....................OOOccCCcO",
    ".OOlllllLlO.......................OOcccO",
    "...OOOOOllO.........................OOO."],
  dragon_dead: [
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "........................................",
    "......................OOOOOO............",
    "...................OOOWWWWwwOOO.........",
    "..................OwwWWWWwwWWWWOO.......",
    ".................OWwWWWWwwWWWWWwwO......",
    "................OWwwWWwwWWWWWwwwO.......",
    "................OwwWWwwWWWWwwwWWO.......",
    "..........O...OOWwWWwwWWWwwwWWWWO.......",
    ".........OHOOOHWWwWwWDWwwWWDWWWO........",
    "........OHHOHHOODRRRRRRRRRRRROOO........",
    ".....OOOHOHHRRrrRRRRRRRRRRRRRrrDO.......",
    "...OOrrrHrHRRRRRRRRRRRRRRRRRRRRRrO......",
    "..OrrRXRXRRRRRRRRRRRRRRRRRRRRRRRRO.....O",
    ".OrRRRRXRRRRRRRRRRRRRRRRRRRRRRRRRO....Or",
    "OrRRRRXRXRRRRRRRRRRRRRRRRRRRRRRRRrOOOOrR",
    "ODDDDDDDDDDDRRRRRRRRRRRRRRRRRDDRRRrrrrRR",
    ".OOOOOOOOOOOrRRRRDDDDDDRRRRRROOrRRRRRRRR",
    "..........OHHHHHHOOOOOOHHHHHHOODDDDDDDDD",
    "...........OOOOOO......OOOOOO..OOOOOOOOO"]
};
const MON_PAL = {"kelpie": {"O": "#071a22", "B": "#2f6f86", "b": "#5aa6bd", "D": "#173e4e", "M": "#2f8a4e", "m": "#1c5a32", "K": "#0d1418", "E": "#d6f6ff", "~": "#7fd4ee", "X": "#0d1418"}, "griffin": {"O": "#1d1308", "T": "#c08a3e", "t": "#8a5d22", "C": "#efe6cf", "c": "#bfb294", "F": "#7a5428", "f": "#b98a4a", "G": "#e2b23a", "g": "#a07818", "H": "#3a2a12", "D": "#4a2e12", "E": "#1b1408", "K": "#5a3f10", "L": "#d2a865", "l": "#e8c48a", "P": "#7a4e22", "p": "#a8743a", "Z": "#3e2610", "n": "#efe3c4", "Q": "#5e3c1a", "q": "#8a5e2c"}, "dragon": {"O": "#240a07", "R": "#b3352b", "r": "#e06a4c", "D": "#6a1712", "Y": "#e7b56a", "y": "#b9853f", "W": "#7c2621", "w": "#4a120e", "H": "#efe3c4", "E": "#ffd23a", "X": "#2a0c08"}, "kelpie_dead": {"O": "#1a0f08", "M": "#9b4a24", "m": "#d4844e", "N": "#5e2a12", "B": "#efe3c4", "b": "#fff7e6", "J": "#b9a988", "G": "#2f8a4e", "g": "#5cc070", "H": "#1c5a32", "P": "#d6d0c4", "p": "#f2eee6", "Q": "#9c968a", "~": "#bdb6aa"}};
MON_PAL.griffin_dead = MON_PAL.griffin; MON_PAL.dragon_dead = MON_PAL.dragon;
MON_PAL.ichikaku = MON_PAL.ichikaku_dead = {"O": "#3e2a27", "W": "#f4e6d6", "S": "#b39b90", "P": "#d48785", "p": "#dc9696", "G": "#c4923c", "g": "#fade96", "E": "#7a1a1e", "X": "#3e2a27"};
MON_PAL.mikeguma = {"O": "#2b170f", "W": "#f6eddb", "w": "#fffaf0", "V": "#d8cbb2", "Y": "#a89234", "y": "#c2ad4c", "Z": "#7a6a22", "G": "#615e5e", "g": "#7c7979", "H": "#454343", "I": "#f6eddb", "C": "#fffaf0", "K": "#24140e", "e": "#fffaf0", "R": "#be3c32", "T": "#fffaf0"};
MON_PAL.mikeguma_dead = {"O": "#2b1a12", "W": "#fbfaf6", "V": "#c9c6dc", "Y": "#a39436", "Z": "#867a2a", "G": "#6c6c6e", "H": "#565659", "K": "#24140e", "R": "#c8505a", "P": "#f09aa2"};
function drawMonster(ctx, W, H, { id, t, hit, dead }) {
  ctx.clearRect(0, 0, W, H);
  const key = dead ? id + '_dead' : id; const g = MON_ART[key], pal = MON_PAL[key]; if (!g) return;
  const cols = g[0].length, rows = g.length;
  const cell = Math.max(1, Math.floor(Math.min(W / cols, H / rows)));
  const ox = Math.round((W - cols * cell) / 2 + (hit ? Math.sin(t / 18) * cell * 0.6 : 0)), oy = H - rows * cell;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(W / 2, H - cell * 0.6, cols * cell * 0.4, cell * 1.1, 0, 0, Math.PI * 2); ctx.fill();
  // v1.1.14: the defeated 三毛クマ (three little bears) keeps shivering, each bear on its own beat
  const amp = Math.max(1, Math.round(cell * 0.35));
  const shiver = dead && id === 'mikeguma' ? x => { const k = x <= 12 ? 0 : x <= 26 ? 1 : 2; return [0, 1, 0, -1][(Math.floor((t || 0) / 55) + k * 3) % 4] * amp; } : null;
  for (let y = 0; y < rows; y++) { const row = g[y]; for (let x = 0; x < cols; x++) { const ch = row[x]; if (ch === '.') continue; ctx.fillStyle = pal[ch] || '#000'; ctx.fillRect(ox + x * cell + (shiver ? shiver(x) : 0), oy + y * cell, cell, cell); } }
  if (hit) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
}
function drawFoe(ctx, W, H, o) { if (isMonster(o.color)) drawMonster(ctx, W, H, { ...o, id: o.color }); else drawSlime(ctx, W, H, o); }
class SlimeView {
  constructor(cv, opts) { this.cv = cv; this.ctx = cv.getContext('2d'); this.ctx.imageSmoothingEnabled = false; this.color = 'green'; this.dead = false; this.hitUntil = 0; this.loop = this.loop.bind(this); if (!(opts && opts.static)) requestAnimationFrame(this.loop); }
  // the canvas is drawn at the screen's own pixel density, so the pixel art stays sharp on a phone
  fit() {
    const cv = this.cv, dpr = window.devicePixelRatio || 1;
    if (!cv.clientWidth) return;
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; this.ctx.imageSmoothingEnabled = false; }
  }
  draw(t) { this.fit(); drawFoe(this.ctx, this.cv.width, this.cv.height, { color: this.color, t, hit: t < this.hitUntil, dead: this.dead }); }
  loop(t) { if (!this.cv.isConnected) return; if (this.cv.offsetParent !== null) this.draw(t); requestAnimationFrame(this.loop); }
  hit() { this.hitUntil = performance.now() + 180; }
}
const mini = new SlimeView($('#miniSlime')), big = new SlimeView($('#bigSlime'));

/* ---------- header / battle ---------- */
const P = () => S.progress;
// the day's foe: the one chosen in the shop, or (setting) a different owned one each day, fixed for that day
function foeToday() {
  const p = P(); const k = dayKey();
  const owned = FOES.filter(f => p.owned.slime.includes(f.id)).map(f => f.id);
  if (p.settings.foeRandom && owned.length > 1) {
    if (!p.foeOf || p.foeOf.day !== k || !owned.includes(p.foeOf.id)) { p.foeOf = { day: k, id: owned[hashN('foe' + k) % owned.length] }; saveProgress(); }
    return p.foeOf.id;
  }
  return FOES.some(f => f.id === p.equipped.slime) ? p.equipped.slime : 'green';
}
function todayDamage() { return P() ? (P().daily[dayKey()] || 0) : 0; }
function streakBefore(k) { let n = 0, d = shiftKey(k, -1); while (P().kills[d]) { n++; d = shiftKey(d, -1); } return n; }
function currentStreak() { const k = dayKey(); return P().kills[k] ? streakBefore(k) + 1 : streakBefore(k); }
// level L starts at 250·L·(L−1) characters (inverse of levelOf)
const levelStart = L => 250 * L * (L - 1);
const levelReward = L => 20 + 5 * L;
function xpInfo(total) { const lv = levelOf(total); const a = levelStart(lv), b = levelStart(lv + 1); return { lv, a, b, into: total - a, need: b - total, pct: Math.max(0, Math.min(100, (total - a) / (b - a) * 100)) }; }
function renderHeader() {
  const p = P(); if (!p) return; const x = xpInfo(p.totalWritten);
  $('#lvNum').textContent = x.lv; $('#lvTitle').textContent = titleOf(x.lv); $('#coinNum').textContent = fmt(p.coins);
  $('#xpFill').style.width = x.pct + '%';
  $('#lvChip').title = `累計 ${fmt(p.totalWritten)}字　次のレベルまで あと${fmt(x.need)}字（Lv${x.lv + 1}で +${levelReward(x.lv + 1)}コイン）`;
  if (S.view === 'battle') renderLevelPanel();
}
function renderLevelPanel() {
  const p = P(); if (!p) return; const x = xpInfo(p.totalWritten);
  const nextT = TITLES.find(([l]) => l > x.lv);
  $('#lvBig').textContent = 'Lv ' + x.lv; $('#lvBigTitle').textContent = titleOf(x.lv);
  $('#lvBigFill').style.width = x.pct + '%';
  $('#lvBigNums').textContent = `${fmt(x.into)} / ${fmt(x.b - x.a)}字`;
  $('#lvBigNote').textContent = `次のレベルまで あと${fmt(x.need)}字。Lv${x.lv + 1}になると +${levelReward(x.lv + 1)}コイン。` + (nextT ? `Lv${nextT[0]}で称号「${nextT[1]}」。` : '');
}
function renderHP() {
  const p = P(); if (!p) return;
  const goal = p.goal, dmg = todayDamage(), k = dayKey(), killed = !!p.kills[k];
  const hp = Math.max(0, goal - dmg), pct = killed ? 0 : Math.max(0, hp / goal * 100);
  for (const id of ['#miniHp', '#bigHp']) { const el = $(id); el.querySelector('i').style.width = pct + '%'; el.classList.toggle('dead', killed); }
  $('#miniDmg').textContent = fmt(killed ? 0 : hp); $('#miniGoal').textContent = fmt(goal);
  $('#miniState').textContent = '';
  $('#sfLive').hidden = killed; $('#sfDone').hidden = !killed; $('#sfReward').textContent = killed ? '+' + p.kills[k] : '';
  if (!$('#slimeFloat').hidden) requestAnimationFrame(() => placeSlime());
  $('#bigHpNum').textContent = fmt(killed ? 0 : hp); $('#bigGoal').textContent = fmt(goal); $('#bigDmg').textContent = fmt(dmg);
  $('#bigState').textContent = killed ? '討伐済み' : '';
  const foe = foeToday();
  mini.color = big.color = foe; mini.dead = big.dead = killed;
  $('#slimeName').textContent = killed ? `${foeName(foe)}を倒した` : `${foeName(foe)}があらわれた`;
  $('#battleNote').textContent = killed ? `今日の${isMonster(foe) ? 'モンスター' : 'スライム'}は討伐済みです（+${p.kills[k]}コイン）。${dmg > goal ? '超過 ' + fmt(dmg - goal) + '字。' : ''}また明日。` : '書いた文字数がそのままダメージになります。1日1体、倒すとコインが手に入ります。';
}
function renderBattleStats() {
  renderLevelPanel();
  const p = P(); if (!p) return;
  $('#stZoneN').textContent = p.zone.count + '回'; $('#stZoneMax').textContent = mmss(p.zone.longest); $('#stZoneSum').textContent = mmss(p.zone.total);
  $('#stStreak').textContent = currentStreak() + '日'; $('#stKills').textContent = Object.keys(p.kills).length + '体'; $('#stTotal').textContent = fmt(p.totalWritten);
  const k = dayKey(); let html = '';
  for (let i = 13; i >= 0; i--) {
    const d = shiftKey(k, -i); const w = p.daily[d] || 0; const kill = p.kills[d]; const pc = Math.min(100, Math.round(w / p.goal * 100));
    html += `<i class="${kill ? 'kill' : (w ? 'part' : '')}${i === 0 ? ' today' : ''}" style="--p:${pc}%" title="${d.slice(5).replace('-', '/')}　${fmt(w)}字${kill ? '　討伐' : ''}"></i>`;
  }
  $('#cal').innerHTML = html;
}
function maybeKill() {
  const p = P(); if (!p) return; const k = dayKey();
  if (p.kills[k] || todayDamage() < p.goal) return;
  const streak = streakBefore(k) + 1; const reward = 100 + Math.min((streak - 1) * 10, 100);
  p.kills[k] = reward; p.coins += reward; saveProgress(true); renderHeader(); renderHP();
  const foe = foeToday();
  openDlg(`<div class="dlg celebrate"><canvas id="cSl" width="192" height="144" style="width:144px;height:108px;image-rendering:pixelated;margin:0 auto;display:block"></canvas><h3>討伐成功</h3><p style="margin:0">${esc(foeName(foe))}を倒しました。${streak > 1 ? `<br><span class="muted small">${streak}日連続</span>` : ''}</p><div><span class="reward"><span class="coin"></span>+${reward} コイン</span></div><div><button class="btn gold" data-close>やった</button></div></div>`,
    d => { const v = new SlimeView(d.querySelector('#cSl'), { static: foe !== 'mikeguma' }); v.color = foe; v.dead = true; v.draw(0); requestAnimationFrame(() => v.draw(0)); });
}


/* ---------- floating slime (drag to move; position kept per PC) ---------- */
const sf = $('#slimeFloat');
let sfPos = lsGet('ss.slimePos', null), sfDrag = null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function placeSlime(x, y) {
  const w = sf.offsetWidth || 150, h = sf.offsetHeight || 110;
  if (x == null) {
    if (sfPos) { x = sfPos.fx * window.innerWidth; y = sfPos.fy * window.innerHeight; }
    // phone: beside the chapter title (the bottom edge of the text box holds the メモ／プロット tabs)
    else if (IS_ANDROID) { const r = edText.getBoundingClientRect(), hd = $('.ed-head').getBoundingClientRect(); x = r.right - w - 4; y = hd.top - 6; }
    else { const r = edText.getBoundingClientRect(); x = r.right - w - 24; y = r.top + 12; }
  }
  sf.style.left = clamp(x, 4, window.innerWidth - w - 4) + 'px';
  sf.style.top = clamp(y, 4, window.innerHeight - h - 4) + 'px';
}
function showSlime(on) { if (sf.hidden === !on) return; sf.hidden = !on; if (on) requestAnimationFrame(() => placeSlime()); }
sf.addEventListener('mousedown', e => e.preventDefault()); // keep the caret in the text box
sf.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  sfDrag = { dx: e.clientX - sf.offsetLeft, dy: e.clientY - sf.offsetTop }; sf.classList.add('dragging');
  window.addEventListener('pointermove', onDragMove); window.addEventListener('pointerup', endDrag, { once: true }); window.addEventListener('pointercancel', endDrag, { once: true });
});
function onDragMove(e) { if (sfDrag) placeSlime(e.clientX - sfDrag.dx, e.clientY - sfDrag.dy); }
function endDrag() {
  window.removeEventListener('pointermove', onDragMove);
  if (!sfDrag) return; sfDrag = null; sf.classList.remove('dragging');
  sfPos = { fx: sf.offsetLeft / window.innerWidth, fy: sf.offsetTop / window.innerHeight }; lsSet('ss.slimePos', sfPos);
}
sf.addEventListener('dblclick', () => { sfPos = null; lsSet('ss.slimePos', null); placeSlime(); });
window.addEventListener('resize', () => { if (!sf.hidden) placeSlime(); layoutSide(); });


/* ---------- zone: 3 minutes of writing without a pause of 20 s or more ---------- */
const ZONE_AFTER = 180000, ZONE_IDLE = 20000;
const ZONE = { active: false, streakStart: 0, last: 0, enteredAt: 0 };
const mmss = ms => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); return h ? h + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) : Math.floor(s / 60) + ':' + pad(s % 60); };
function zoneTouch() {
  const now = Date.now();
  if (!ZONE.last || now - ZONE.last > ZONE_IDLE) { if (ZONE.active) zoneEnd(); ZONE.streakStart = now; }
  ZONE.last = now;
  if (!ZONE.active && now - ZONE.streakStart >= ZONE_AFTER) zoneEnter(now);
}
function zoneEnter(now) {
  ZONE.active = true; ZONE.enteredAt = now;
  const p = P(); const k = dayKey(); p.zone.count++;
  const d = p.zoneDaily[k] || { n: 0, ms: 0 }; d.n++; p.zoneDaily[k] = d; saveProgress();
  document.body.classList.add('in-zone'); toast('ゾーンに入った'); zoneRender();
}
function zoneEnd() {
  if (!ZONE.active) return;
  const ms = Math.max(0, ZONE.last - ZONE.enteredAt);
  ZONE.active = false; document.body.classList.remove('in-zone');
  const p = P(); const k = dayKey();
  p.zone.total += ms; if (ms > p.zone.longest) { p.zone.longest = ms; if (ms > 60000) toast('ゾーン最長記録 ' + mmss(ms)); }
  const d = p.zoneDaily[k] || { n: 0, ms: 0 }; d.ms += ms; p.zoneDaily[k] = d; saveProgress();
  zoneRender();
}
function zoneRender() {
  const pill = $('#zonePill'); const now = Date.now();
  if (ZONE.active) { pill.hidden = false; pill.classList.add('on'); pill.textContent = 'ゾーン ' + mmss(now - ZONE.enteredAt); return; }
  pill.classList.remove('on');
  const streak = ZONE.last && now - ZONE.last <= ZONE_IDLE ? now - ZONE.streakStart : 0;
  if (streak >= 30000) { pill.hidden = false; pill.textContent = '集中 ' + mmss(streak) + ' / 3:00'; } else pill.hidden = true;
}
setInterval(() => { if (ZONE.active && Date.now() - ZONE.last > ZONE_IDLE) zoneEnd(); zoneRender(); }, 1000);


/* ---------- login bonus and level-up coins ---------- */
const LOGIN_TABLE = [20, 25, 30, 35, 40, 50, 100];
// the iPhone version starts with a welcome gift; kept in loginRewards so merging hand-over files keeps it counted
const GIFT_KEY = 'gift:welcome', GIFT_COINS = 150;
const giftHTML = () => `<p class="gift-line">書房へようこそ！ はじめましてのお祝い <span class="reward"><span class="coin"></span>+${GIFT_COINS} コイン</span></p>`;
function checkLogin() {
  const p = P(); if (!p) return; const k = dayKey();
  let gift = false;
  if (IS_WEB && !p.loginRewards[GIFT_KEY]) { p.loginRewards[GIFT_KEY] = GIFT_COINS; p.coins += GIFT_COINS; gift = true; }
  if (p.login.last === k) {
    if (gift) { saveProgress(true); renderHeader(); openDlg(`<div class="dlg celebrate"><h3>ようこそ</h3>${giftHTML()}<div><button class="btn gold" data-close>受け取る</button></div></div>`); }
    return;
  }
  const streak = p.login.last === shiftKey(k, -1) ? p.login.streak + 1 : 1;
  const step = (streak - 1) % 7; const reward = LOGIN_TABLE[step];
  p.login = { last: k, streak }; p.loginRewards[k] = reward; p.coins += reward; saveProgress(true); renderHeader();
  const stamps = LOGIN_TABLE.map((c, i) => `<div class="stamp${i < step ? ' got' : i === step ? ' today' : ''}"><span class="d">${i + 1}日目</span><span class="c"><span class="coin"></span>${c}</span></div>`).join('');
  openDlg(`<div class="dlg celebrate"><h3>ログインボーナス</h3><p class="muted small" style="margin:0">${streak}日連続${streak > 7 ? `（${Math.floor((streak - 1) / 7) + 1}周目）` : ''}</p><div class="stamps">${stamps}</div><div><span class="reward"><span class="coin"></span>+${reward} コイン</span></div>${gift ? giftHTML() : ''}<div><button class="btn gold" data-close>受け取る</button></div></div>`);
}
let lvBannerT = null;
function checkLevel(quiet) {
  const p = P(); if (!p) return; const lv = levelOf(p.totalWritten);
  let got = 0, from = 0;
  for (let L = 2; L <= lv; L++) if (!p.levelRewards[L]) { const c = levelReward(L); p.levelRewards[L] = c; p.coins += c; got += c; if (!from) from = L; }
  if (!got) return;
  saveProgress(true); renderHeader();
  const b = $('#lvBanner');
  $('#lvbNum').textContent = from === lv ? 'Lv ' + lv : `Lv ${from} 〜 ${lv}`;
  $('#lvbTitle').textContent = titleOf(lv); $('#lvbCoin').textContent = '+' + fmt(got) + ' コイン';
  b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(lvBannerT); lvBannerT = setTimeout(() => { b.hidden = true; }, quiet ? 3200 : 3600);
}

/* ---------- writing credit ---------- */
let lastDmgFx = 0, dmgAcc = 0;
// n > 0: damage (typed or pasted), n < 0: deleted text heals the slime. Today's damage never goes below 0.
// Each device keeps its own count of what was written there (p.dev[deviceId]); the day's damage and
// the lifetime total are the sum over devices, so writing on PC and phone on the same day adds up after a merge.
const DEVICE_ID = (() => { let id = lsGet('ss.deviceId', null); if (!id) { id = (IS_ANDROID ? 'and-' : 'pc-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); lsSet('ss.deviceId', id); } return id; })();
function adoptLegacy(p) {
  // counts made before ledgers existed belong to a shared 'legacy' bucket (same name on every device, so merges never double them)
  if (!Object.keys(p.dev).length && (p.totalWritten > 0 || Object.keys(p.daily).length)) p.dev.legacy = { daily: { ...p.daily }, total: p.totalWritten };
}
function sumLedgers(p) {
  const daily = {}; let total = 0;
  for (const L of Object.values(p.dev)) { for (const [d, v] of Object.entries(L.daily || {})) daily[d] = (daily[d] || 0) + (v || 0); total += L.total || 0; }
  p.daily = daily; p.totalWritten = total;
}
function addCredit(n) {
  const p = P(); const k = dayKey();
  const L = p.dev[DEVICE_ID] || (p.dev[DEVICE_ID] = { daily: {}, total: 0 });
  const before = L.daily[k] || 0; const after = Math.max(0, before + n); const applied = after - before;
  if (!applied) return;
  L.daily[k] = after; L.total = Math.max(0, (L.total || 0) + applied); sumLedgers(p); saveProgress();
  renderHP(); renderHeader(); if (applied > 0) { mini.hit(); checkLevel(); }
  dmgAcc += applied; const now = performance.now(); if (now - lastDmgFx > 500) { spawnDmg(dmgAcc); dmgAcc = 0; lastDmgFx = now; }
  maybeKill();
}
function spawnDmg(n) { if (reduceMotion || !n) return; const s = document.createElement('span'); s.className = 'dmg' + (n < 0 ? ' heal' : ''); s.textContent = n > 0 ? '-' + n : '+' + (-n); $('#miniWrap').appendChild(s); setTimeout(() => s.remove(), 1000); }

/* ---------- views ---------- */
async function setView(v) {
  if (S.view === 'editor' && v !== 'editor' && PM.on && PM.dirty && !await pmLeaveOK('ほかの画面へ移る')) return;
  closeTabCtx();
  if (S.view === 'editor' && v !== 'editor') { if (SR.open) srClose(false); saveChapter(); memoSave(); closePicker(); }
  if (v !== 'shop' && PV.id) PV.stop(true);
  S.view = v; lsSet('ss.view', v);
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.view === v ? 'page' : 'false'));
  for (const id of ['library', 'editor', 'battle', 'shop', 'settings']) $('#v-' + id).hidden = id !== v;
  document.body.classList.toggle('mode-editor', v === 'editor');
  if (v !== 'editor') { showSlime(false); layoutSide(); }
  if (v === 'editor' && !PM.on) S.enterEnd = true;
  if (v === 'library') renderLibrary(); if (v === 'editor') renderEditor();
  if (v === 'battle') { renderHP(); renderBattleStats(); } if (v === 'shop') renderShop(); if (v === 'settings') renderSettings();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'library') S.openWork = null; setView(b.dataset.view); }));
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { if (g.dataset.go === 'library') S.openWork = null; setView(g.dataset.go); } });

async function refreshWorks(quiet) {
  await syncCountMode();
  try { S.works = await api.list(); } catch (e) { fileErr(e, '保存先フォルダを読み込めませんでした'); }
  if (quiet) { S.covDirty = true; return; }   // the cover window is open: redraw when it closes
  if (S.view === 'library') renderLibrary();
}

// spine width grows with the characters written (√ so it keeps growing but slows down), capped at 120px
const spineWidth = chars => Math.round(30 + Math.min(90, Math.sqrt(Math.max(0, chars || 0)) / 5));
const hashN = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
const LABELED = ['seigaiha'];
// How much of the spine height each design leaves for the title: [share of height, label padding px]
const TITLE_ROOM = { watoji: [0.74, 18], kosho: [0.44, 14], madousho: [0.55, 0], ryurin: [0.64, 12] };
// ---- Title fitting (v1.1.2) ----
// One line first. Only when that makes the letters much smaller, break between phrases:
// after の・と・を・に・へ・は・が・や・も that follow a kanji, and where kanji meets katakana.
// The writer can also give her own breaks per work ("魔龍／帰巣録"); they are used on spines and covers.
const TITLE_ALIGN = 'stag';   // vertical titles in several columns: 'stag' = 2nd column onwards one character lower, 'center' = centred
const KANJI = '\\u4e00-\\u9fff\\u3400-\\u4dbf々〆ヶ', KATA = '\\u30a0-\\u30ff';
const RE_PART1 = new RegExp(`([${KANJI}])([のとをにへはがやも])`, 'g');
const RE_PART2 = new RegExp(`([${KANJI}])(?=[${KATA}])|([${KATA}])(?=[${KANJI}])`, 'g');
function titleParts(t) { return t.replace(RE_PART1, '$1$2\u0000').replace(RE_PART2, '$1$2\u0000').split('\u0000').filter(Boolean); }
// the writer's break, if it still matches the title (it is ignored after a rename)
function manualParts(title, brk) {
  if (!brk || !/／/.test(brk)) return null;
  const parts = brk.split('／').map(x => x.trim()).filter(Boolean);
  return parts.length > 1 && parts.join('') === String(title).replace(/\s+/g, '') ? parts : null;
}
const tfCache = new Map(); let tfEl = null;
function tfInner(kind, title, parts) {
  if (kind === 'manual') return parts.map(x => `<span class="tl">${esc(x)}</span>`).join('');
  if (kind === 'chunks') return parts.map(x => `<span>${esc(x)}</span>`).join('<wbr>');
  return esc(title);
}
// o: {title, brk, v (vertical), w, h (room in px), max, oneMin, min (font px), ls (em), al}
function fitTitleBox(o) {
  const key = JSON.stringify(o); const hit = tfCache.get(key); if (hit) return hit;
  if (!tfEl) {
    tfEl = document.createElement('div'); tfEl.setAttribute('aria-hidden', 'true'); tfEl.lang = 'ja';
    tfEl.style.cssText = 'position:fixed;left:-4000px;top:0;visibility:hidden;pointer-events:none;display:flex;align-items:center;justify-content:center;overflow:hidden;contain:strict';
    tfEl.innerHTML = '<span></span>'; document.body.appendChild(tfEl);
  }
  const box = tfEl, tt = box.firstChild;
  box.style.width = o.w + 'px'; box.style.height = o.h + 'px'; box.style.writingMode = o.v ? 'vertical-rl' : 'horizontal-tb';
  const fits = () => tt.scrollWidth <= box.clientWidth + 0.5 && tt.scrollHeight <= box.clientHeight + 0.5 && box.scrollWidth <= box.clientWidth + 0.5 && box.scrollHeight <= box.clientHeight + 0.5;
  const cls = kind => 'tf ' + kind + (o.v && o.al && (kind === 'chunks' || kind === 'manual') ? ' al-' + o.al : '');
  // largest size (in 0.5px steps) between lo and max that fits, or null
  const tryKind = (kind, parts, lo) => {
    tt.className = cls(kind); tt.innerHTML = tfInner(kind, o.title, parts);
    tt.style.cssText = `display:block;max-width:100%;max-height:100%;font-family:var(--font-display);font-weight:800;letter-spacing:${o.ls}em`;
    const at = f => { tt.style.fontSize = f + 'px'; return fits(); };
    let a = Math.round(lo * 2), b = Math.round(o.max * 2);
    if (a > b || !at(a / 2)) return null;
    while (a < b) { const m = Math.ceil((a + b) / 2); if (at(m / 2)) a = m; else b = m - 1; }
    return a / 2;
  };
  let r = null;
  const man = manualParts(o.title, o.brk);
  if (man) { const f = tryKind('manual', man, o.min); if (f) r = { kind: 'manual', parts: man, f }; }
  if (!r) {
    const parts = titleParts(o.title);
    const f1 = tryKind('one', null, o.min), f2 = parts.length > 1 ? tryKind('chunks', parts, o.min) : null;
    if (f1 && (!f2 || f1 >= Math.max(o.oneMin, f2 / 1.3))) r = { kind: 'one', f: f1 };
    else if (f2) r = { kind: 'chunks', parts, f: f2 };
    else r = { kind: 'now', f: tryKind('now', null, o.min) || o.min };   // one phrase too long for the room: break anywhere
  }
  const res = { cls: cls(r.kind), f: r.f, inner: tfInner(r.kind, o.title, r.parts) };
  if (tfCache.size > 400) tfCache.clear();
  tfCache.set(key, res); return res;
}
// measurements made before the book fonts arrive are thrown away
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { tfCache.clear(); if (S.view === 'library') renderLibrary(); }).catch(() => {});
const LABEL_TITLE = ['seigaiha', 'watoji', 'kosho', 'ryurin', 'aozora'];
function spineHTML(id, title, w, h, brk) {
  id = COVERS.some(c => c.id === id) ? id : 'kraft';
  const fs = Math.max(9, Math.min(16, Math.round((w - 12) * 0.62)));
  let t = '';
  if (title) {
    const [ratio, padv] = TITLE_ROOM[id] || [0.64, LABELED.includes(id) ? 12 : 0];
    const r = fitTitleBox({ title, brk: brk || '', v: true, w: Math.max(10, w - 8 - (LABEL_TITLE.includes(id) ? 6 : 0)), h: Math.max(20, Math.floor(h * ratio - padv)), max: fs, oneMin: Math.min(fs, 11), min: 9, ls: 0.06, al: TITLE_ALIGN });
    t = `<span class="sp-title ${r.cls}" style="font-size:${r.f}px;letter-spacing:.06em">${r.inner}</span>`;
  }
  return `<div class="spine sp-${id}${LABELED.includes(id) ? ' sp-label' : ''}" style="--w:${w}px;--h:${h}px;--fs:${fs}px"><span class="sp-deco"></span>${t}</div>`;
}
// Front cover made from the cover design: same colour / pattern, gold double frame, the title.
// face: 'ro' = vertical title, bound on the right / 'lo' = horizontal title, bound on the left
const COVER_LABEL = ['watoji', 'seigaiha', 'ryurin', 'seizu', 'aozora'];
function coverHTML(id, title, w, face, brk) {
  id = COVERS.some(c => c.id === id) ? id : 'kraft'; face = face === 'lo' ? 'lo' : 'ro';
  const v = face === 'ro', H = w * 4 / 3; let t = '';
  if (title) {
    const lab = COVER_LABEL.includes(id) ? 12 : 0;
    const bw = (v ? w * 0.62 : w * 0.68) - (v ? lab : lab * 1.5), bh = (v ? H * 0.76 : H * 0.54) - (v ? lab * 1.5 : lab);
    const r = fitTitleBox({ title, brk: brk || '', v, w: Math.floor(bw), h: Math.floor(bh), max: Math.round(w / 6.4), oneMin: Math.round(w / 10), min: Math.max(8, Math.round(w / 15)), ls: 0.1, al: v ? TITLE_ALIGN : '' });
    t = `<span class="fc-box"><span class="fc-t ${r.cls}" style="font-size:${r.f}px;letter-spacing:.1em">${r.inner}</span></span>${v ? '' : '<span class="fc-rule"></span>'}`;
  }
  return `<span class="fcover ${face} spine sp-${id}" style="--cw:${w}px"><span class="sp-deco"></span><span class="hinge"></span><span class="frame"></span>${t}</span>`;
}
function renderLibrary() {
  if (S.openWork && workById(S.openWork)) { $('#lib-list').hidden = true; $('#lib-work').hidden = false; renderWork(); return; }
  S.openWork = null; $('#lib-list').hidden = false; $('#lib-work').hidden = true;
  renderBkNag();
  const shelf = $('#shelf');
  if (!S.works.length) {
    shelf.innerHTML = `<div class="empty"><h3>まだ本棚は空です</h3><p class="muted">新しい作品を作るか、Driveからダウンロードしたmdファイルを取り込んでください。取り込んだ文字はダメージになりません。</p><p class="muted small">保存先：${esc(S.root)}</p><div class="row" style="justify-content:center"><button class="btn ghost" id="eImp">mdを取り込む</button><button class="btn gold" id="eNew">新しい作品</button></div></div>`;
    $('#eImp').onclick = () => openImport(null); $('#eNew').onclick = newWork; return;
  }
  const tidy = S.tidy;
  $('#libTidy').textContent = tidy ? '整理を終える' : '整理';
  $('#libTidy').setAttribute('aria-pressed', tidy);
  shelf.innerHTML = (tidy ? `<div class="tidy-bar"><span class="muted small" id="tidyCount">ごみ箱へ移す作品を選んでください</span><span class="spacer"></span><button class="btn sm danger" id="tidyGo" disabled>選んだ作品をごみ箱へ</button></div>` : '')
    + `<div class="bookshelf">${tidy ? '' : `<button class="slot-new" id="shelfNew" title="新しい作品" aria-label="新しい作品"><span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4c-6 0-11 4-13 11l-2 5 4-2c7-2 11-7 11-14z"/><path d="M5 19l7-7"/></svg></span></button>`}${S.works.map(w => {
      const sw = spineWidth(w.chars), sh = 200 + hashN(w.id) % 29;
      return `<button class="spine-btn${tidy && S.picked.has(w.id) ? ' picked' : ''}" data-w="${esc(w.id)}" style="--h:${sh}px" aria-pressed="${tidy ? S.picked.has(w.id) : 'false'}" title="${esc(w.title)}　${w.chapters.length}章・${fmt(w.chars)}字">${spineHTML(w.cover, w.title, sw, sh, w.titleBreak)}${tidy ? `<span class="pick-mark" aria-hidden="true">${S.picked.has(w.id) ? '✓' : ''}</span>` : ''}</button>`;
    }).join('')}</div><div class="row shelf-foot"><p class="shelf-hint muted small">${IS_ANDROID ? '背表紙は書いた文字数に合わせて太く育ちます。' : '背表紙は書いた文字数に合わせて太く育ちます。マウスを乗せると章数と文字数が出ます。'}</p><span class="spacer"></span>${tidy ? '' : '<button class="btn sm" id="shelfShare"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/></svg> 本棚をシェア</button>'}</div>`;
  if ($('#shelfNew')) $('#shelfNew').onclick = newWork;
  if ($('#shelfShare')) $('#shelfShare').onclick = openShare;
  shelf.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.w;
    if (!S.tidy) return openWork(id);
    if (S.picked.has(id)) S.picked.delete(id); else S.picked.add(id);
    renderLibrary();
  }));
  if (tidy) {
    const n = S.picked.size; $('#tidyGo').disabled = !n;
    if (n) $('#tidyCount').textContent = n + '作品を選んでいます';
    $('#tidyGo').onclick = async () => {
      const ids = [...S.picked]; const names = ids.map(id => (workById(id) || {}).title).filter(Boolean);
      if (!await confirmDlg('作品をごみ箱へ', names.join('、') + ' を消します。' + TRASH_NOTE, 'ごみ箱へ移動')) return;
      let ok = 0;
      for (const id of ids) {
        try { if (S.curWork === id) { await saveChapter(); S.curWork = S.curCh = null; loaded.key = null; } await api.trashWork(id); ok++; } catch (e) { fileErr(e, '「' + id + '」をごみ箱へ移動できませんでした'); }
      }
      S.picked.clear(); S.tidy = false; await refreshWorks(); if (ok) toast(ok + '作品を' + TRASH_WORD + 'へ移しました');
    };
  }
}
$('#libTidy').addEventListener('click', () => { S.tidy = !S.tidy; S.picked.clear(); renderLibrary(); });
$('#libImport').addEventListener('click', () => openImport(null));
$('#libNew').addEventListener('click', newWork);
$('#libFolder').addEventListener('click', () => api.openFolder(null));
async function newWork() {
  try { const wid = await api.createWork('無題の物語'); await api.createChapter(wid, '第一章', ''); await refreshWorks(); openWork(wid); }
  catch (e) { fileErr(e, '作品を作れませんでした'); }
}
function openWork(wid) { if (S.openWork !== wid) S.chPick = null; S.openWork = wid; setView('library'); }

function openImport(target) {
  const w = target && workById(target);
  const into = w ? `「${esc(w.title)}」の最後に章として追加します。` : '新しい作品として取り込みます。';
  openDlg(`<div class="dlg"><h3>mdを取り込む</h3><p class="note">${into} ${IS_ANDROID ? (IS_WEB ? '次に出るメニューで「ファイルを選択」を押し、iCloud Driveや「このiPhone内」から md・txt を選びます。右上の「選択」で複数選べます。' : '次の画面で左上のメニューから「ドライブ」を選ぶと、Driveのmdを直接開けます。複数選ぶには長押しします。') : 'ファイルは保存先フォルダにコピーされ、元のファイルはそのまま残ります。'}</p>
  <div class="radio" role="radiogroup" aria-label="章の分け方">
   <label><input type="radio" name="lv" value="0" checked> <span>ファイル1つを1章にする<br><span class="muted small">ファイル名が章タイトルになります。複数選択もできます</span></span></label>
   <label><input type="radio" name="lv" value="2"> <span>「## 見出し」ごとに章に分ける<br><span class="muted small">「# 見出し」は作品名になります。書き出したmdはこの形式です</span></span></label>
   <label><input type="radio" name="lv" value="1"> <span>「# 見出し」ごとに章に分ける</span></label>
  </div>
  <div class="radio"><label><input type="checkbox" id="dClean" checked> <span>行末の &lt;br&gt; などを消す<br><span class="muted small">&lt;br&gt;、行末の「\\」や空白、「\\!」のような記号のエスケープ、&amp;nbsp; などを普通の文字に直します。行頭の全角スペースは残します</span></span></label>
   <label><input type="checkbox" id="dOver" checked> <span>同じ名前の作品・章があれば上書きする<br><span class="muted small">取り込み直しても重複しません。上書き前の章は backup に残ります</span></span></label></div>
  <div class="row"><span class="spacer"></span><button class="btn ghost" data-close>やめる</button><button class="btn gold" id="dPick">ファイルを選ぶ</button></div></div>`, d => {
    d.querySelector('#dPick').addEventListener('click', async () => {
      const lv = Number(d.querySelector('input[name=lv]:checked').value); const clean = d.querySelector('#dClean').checked; const over = d.querySelector('#dOver').checked; closeDlg();
      try { if (S.curWork) await saveChapter(); const r = await api.importFiles(target, lv, clean, over); if (!r) return; if (S.curWork === r.wid) loaded.key = null; toast(r.count + '章を取り込みました' + (r.replaced ? `（うち${r.replaced}章を上書き）` : '')); await refreshWorks(); openWork(r.wid); }
      catch (e) { fileErr(e, '取り込めませんでした'); }
    });
  });
}

function renderWork() {
  const wid = S.openWork, w = workById(wid); const box = $('#lib-work'); if (!w) return;
  const owned = P().owned.cover; const chs = w.chapters;
  box.innerHTML = `<div class="stack">
  <div class="row"><button class="btn sm ghost" id="wBack">‹ 本棚へ</button><span class="spacer"></span><button class="btn sm ghost" id="wFolder">フォルダを開く</button></div>
  <div class="work-top"><button type="button" class="spine-stand" id="wSpine" aria-label="装丁を変える" aria-expanded="false"><span class="sp-wrap">${coverHTML(w.cover, w.title, IS_ANDROID ? 112 : 168, w.face, w.titleBreak)}</span><span class="cap">${IS_ANDROID ? '長押しで装丁を変える' : 'クリックで装丁を変える'}</span></button>
   <div class="stack">
    <div class="field"><label for="wTitle">作品名（フォルダ名）</label><input class="input" id="wTitle" value="${esc(w.title)}"></div>
    ${IS_ANDROID ? '' : '<div class="field plot-field" id="wPlot"></div>'}
    <div class="muted small" style="font-variant-numeric:tabular-nums">${chs.length}章・${fmt(w.chars)}字</div>
    ${shareFieldHTML(w)}
   </div></div>
  ${IS_ANDROID ? '<div class="field plot-field wide" id="wPlot"></div>' : ''}
  <div class="row"><h3>章</h3><button class="btn sm ghost" id="wSort" title="章の表示順を切り替えます（章の番号は変わりません）">${P().settings.chDesc ? '↓ 最新話から' : '↑ 1話から'}</button><span class="spacer"></span>${chs.length ? `<button class="btn sm ghost" id="wPick" aria-pressed="${!!S.chPick}">${S.chPick ? '選ぶのをやめる' : '選ぶ'}</button>` : ''}${chs.length && !S.chPick ? `<button class="btn sm gold" id="wLatest">最新話を書く</button>` : ''}<button class="btn sm" id="wAdd">章を追加</button><button class="btn sm" id="wImp">mdを取り込む</button></div>
  ${S.chPick ? `<div class="tidy-bar ch-pickbar"><span class="muted small" id="chPickCount"></span><button class="btn sm ghost" id="chPickAll">すべて選ぶ</button><span class="spacer"></span><button class="btn sm" id="chHide" disabled>一覧から隠す</button><button class="btn sm danger" id="chTrash" disabled>削除</button></div>` : ''}
  <ul class="chapters${S.chPick ? ' picking' : ''}" id="chList"></ul>
  ${w.hidden && w.hidden.length ? `<details class="hidden-files"${S.showHidden ? ' open' : ''}><summary>隠しているファイル（${w.hidden.length}）</summary><p class="note">章の一覧に出さず、文字数にも数えていないファイルです。消してはいません。</p><ul class="chapters">${w.hidden.map(h => `<li><span class="t muted">${esc(h.title)}</span><span class="spacer"></span><button class="btn sm" data-unhide="${esc(h.id)}">一覧に戻す</button></li>`).join('')}</ul><div class="row"><span class="spacer"></span><button class="btn sm ghost" id="unhideAll">すべて一覧に戻す</button></div></details>` : ''}
  <div class="row"><button class="btn sm gold" id="wExpCh">章ごとにmdで書き出す</button><button class="btn sm" id="wExp">1つのmdにまとめて書き出す</button><button class="btn sm" id="wCopy">作品の全文をコピー</button><span class="spacer"></span><button class="btn sm danger" id="wDel">ごみ箱へ移動</button></div>
  <p class="note">「章ごと」は、選んだフォルダの中に作品名のフォルダを作り、章を1つずつ.mdファイルで書き出します（同じ名前のファイルは上書き）。Driveのフォルダを選ぶか、書き出したフォルダをそのままDriveにアップロードしてください。</p>
 </div>`;
  const ul = $('#chList');
  // Display order only: newest-first shows the list reversed; chapter numbers and the saved order stay the same.
  const desc = !!P().settings.chDesc; const last = chs.length - 1;
  const when = c => P().settings.chDate && c.mtime ? `<span class="m ch-date">${chWhen(c.mtime)}</span>` : '';
  const shown = chs.map((c, i) => ({ c, i })); if (desc) shown.reverse();
  // ▲/▼ move a chapter up/down on screen; in newest-first view that is later/earlier in the story.
  const upStep = desc ? 1 : -1;
  ul.innerHTML = chs.length ? shown.map(({ c, i }) => {
    const upOff = desc ? i === last : i === 0, dnOff = desc ? i === 0 : i === last;
    if (S.chPick) return `<li class="${S.chPick.has(c.id) ? 'sel' : ''}"><label class="ch-check"><input type="checkbox" data-pick="${esc(c.id)}" ${S.chPick.has(c.id) ? 'checked' : ''}><span class="ch-no">${i + 1}</span><span class="ch-open"><span class="t">${esc(c.title)}</span><span class="m">${fmt(c.chars)}字</span>${when(c)}</span></label></li>`;
    return `<li><span class="ch-no">${i + 1}</span><button class="ch-open" data-ch="${esc(c.id)}"><span class="t">${esc(c.title)}</span><span class="m">${fmt(c.chars)}字</span>${when(c)}</button><button class="mv" data-up="${i}" ${upOff ? 'disabled' : ''} aria-label="上へ">▲</button><button class="mv" data-dn="${i}" ${dnOff ? 'disabled' : ''} aria-label="下へ">▼</button><button class="mv" data-rm="${esc(c.id)}" aria-label="章をごみ箱へ">×</button></li>`;
  }).join('')
    : `<li><span class="muted">章がありません。「章を追加」から始めましょう。</span></li>`;
  ul.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => openChapter(wid, b.dataset.ch)));
  if ($('#wPick')) $('#wPick').onclick = () => { S.chPick = S.chPick ? null : new Set(); renderWork(); };
  const hd = box.querySelector('.hidden-files'); if (hd) hd.addEventListener('toggle', () => { S.showHidden = hd.open; });
  box.querySelectorAll('[data-unhide]').forEach(b => b.addEventListener('click', async () => { try { await api.setHidden(wid, [b.dataset.unhide], false); await refreshWorks(); } catch (e) { fileErr(e, '戻せませんでした'); } }));
  if ($('#unhideAll')) $('#unhideAll').onclick = async () => { try { await api.setHidden(wid, w.hidden.map(h => h.id), false); await refreshWorks(); } catch (e) { fileErr(e, '戻せませんでした'); } };
  if (S.chPick) {
    const sel = S.chPick;
    const upd = () => {
      const n = sel.size; $('#chPickCount').textContent = n ? n + '章を選んでいます' : '章を選んでください';
      $('#chHide').disabled = $('#chTrash').disabled = !n;
      $('#chPickAll').textContent = n === chs.length ? '選択を外す' : 'すべて選ぶ';
      ul.querySelectorAll('[data-pick]').forEach(cb => cb.closest('li').classList.toggle('sel', cb.checked));
    };
    ul.querySelectorAll('[data-pick]').forEach(cb => cb.addEventListener('change', () => { if (cb.checked) sel.add(cb.dataset.pick); else sel.delete(cb.dataset.pick); upd(); }));
    $('#chPickAll').onclick = () => { if (sel.size === chs.length) sel.clear(); else chs.forEach(c => sel.add(c.id)); ul.querySelectorAll('[data-pick]').forEach(cb => { cb.checked = sel.has(cb.dataset.pick); }); upd(); };
    $('#chHide').onclick = async () => {
      const ids = [...sel];
      try { if (S.curWork === wid && ids.includes(S.curCh)) { await saveChapter(); loaded.key = null; } await api.setHidden(wid, ids, true); S.chPick = null; await refreshWorks(); toast(ids.length + '章を一覧から隠しました'); }
      catch (e) { fileErr(e, '隠せませんでした'); }
    };
    $('#chTrash').onclick = async () => {
      const ids = [...sel]; const names = chs.filter(c => sel.has(c.id)).map(c => c.title);
      if (!await confirmDlg(ids.length + '章を削除', (names.length > 6 ? names.slice(0, 6).join('、') + ' ほか' + (names.length - 6) + '章' : names.join('、')) + ' を消します。' + TRASH_NOTE, '削除する')) return;
      let ok = 0;
      for (const cid of ids) {
        try { if (S.curWork === wid && S.curCh === cid) { await saveChapter(); S.curCh = null; loaded.key = null; } await api.trashChapter(wid, cid); ok++; }
        catch (e) { fileErr(e, '「' + cid + '」を削除できませんでした'); }
      }
      S.chPick = null; await refreshWorks(); if (ok) toast(ok + '章を削除しました');
    };
    upd();
  }
  const move = async (i, d) => { const ids = chs.map(c => c.id); const j = i + d; if (j < 0 || j > last) return; [ids[i], ids[j]] = [ids[j], ids[i]]; try { await api.setOrder(wid, ids); await refreshWorks(); } catch (e) { fileErr(e, '並べ替えできませんでした'); } };
  ul.querySelectorAll('[data-up]').forEach(b => b.addEventListener('click', () => move(+b.dataset.up, upStep)));
  ul.querySelectorAll('[data-dn]').forEach(b => b.addEventListener('click', () => move(+b.dataset.dn, -upStep)));
  $('#wSort').onclick = () => { P().settings.chDesc = !desc; saveProgress(); renderWork(); };
  if ($('#wLatest')) $('#wLatest').onclick = () => openChapter(wid, chs[last].id);
  ul.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
    const cid = b.dataset.rm; const c = chs.find(x => x.id === cid);
    if (!await confirmDlg('章をごみ箱へ', '「' + (c ? c.title : '') + '」を消します。' + TRASH_NOTE, 'ごみ箱へ移動')) return;
    try { if (S.curWork === wid && S.curCh === cid) { await saveChapter(); S.curCh = null; loaded.key = null; } await api.trashChapter(wid, cid); await refreshWorks(); }
    catch (e) { fileErr(e, 'ごみ箱へ移動できませんでした'); }
  }));
  $('#wBack').onclick = () => { S.openWork = null; S.chPick = null; renderLibrary(); };
  bindShareField(w);
  $('#wFolder').onclick = () => api.openFolder(wid);
  $('#wTitle').addEventListener('change', async e => {
    const v = e.target.value.trim() || '無題の物語'; if (v === w.title) return;
    try { if (S.curWork === wid) { await saveChapter(); await memoSave(); memo.key = null; } const nid = await api.renameWork(wid, v); if (S.curWork === wid) { S.curWork = nid; lsSet('ss.curWork', nid); loaded.key = null; } S.openWork = nid; await refreshWorks(); }
    catch (err) { e.target.value = w.title; fileErr(err, '作品名を変えられませんでした'); }
  });
  // the cover is changed from the spine itself (PC: click, phone: long press)
  const spine = $('#wSpine');
  const openCov = () => {
    if ($('.cov-pop')) { closeCov(); return; }
    const pop = document.createElement('div'); pop.className = 'cov-pop front';
    const thumbs = face => COVERS.filter(c => owned.includes(c.id)).map(c => `<button type="button" data-cov="${c.id}" aria-pressed="${w.cover === c.id}" aria-label="装丁：${esc(c.name)}">${coverHTML(c.id, '', 44, face)}<span class="nm">${esc(c.name)}</span></button>`).join('');
    pop.innerHTML = `<div class="ttl">表紙の向き</div><div class="segm face-seg" role="group" aria-label="表紙の向き"><button type="button" data-face="ro" aria-pressed="${w.face !== 'lo'}">縦書き・右開き</button><button type="button" data-face="lo" aria-pressed="${w.face === 'lo'}">横書き・左開き</button></div>
      <div class="ttl">題字の改行（空欄なら自動）</div><input class="input brk" id="covBrk" placeholder="例：${esc(titleParts(w.title).length > 1 ? titleParts(w.title).join('／') : Array.from(w.title).length > 3 ? Array.from(w.title).slice(0, Math.floor(Array.from(w.title).length / 2)).join('') + '／' + Array.from(w.title).slice(Math.floor(Array.from(w.title).length / 2)).join('') : w.title)}" value="${esc(manualParts(w.title, w.titleBreak) ? w.titleBreak : '')}"><p class="brk-note" id="covBrkNote">「／」を入れたところで折り返します。背表紙にも使われます。</p>
      <div class="ttl">装丁</div><div class="cover-pick">${thumbs(w.face)}</div><div class="ft">装丁は商店で増やせます。</div>`;
    pop.style.left = (spine.offsetLeft + spine.offsetWidth + 12) + 'px'; pop.style.top = spine.offsetTop + 'px';
    box.querySelector('.work-top').appendChild(pop); spine.classList.add('open'); spine.setAttribute('aria-expanded', 'true');
    // redraw only the cover itself so the window stays open while choosing
    const redraw = () => { const wrap = spine.querySelector('.sp-wrap'); if (wrap) wrap.innerHTML = coverHTML(w.cover, w.title, IS_ANDROID ? 112 : 168, w.face, w.titleBreak); };
    const bindCov = () => pop.querySelectorAll('[data-cov]').forEach(b => b.addEventListener('click', async () => {
      try { await api.setCover(wid, b.dataset.cov); w.cover = b.dataset.cov; pop.querySelectorAll('[data-cov]').forEach(x => x.setAttribute('aria-pressed', x === b)); redraw(); refreshWorks(pop.isConnected); } catch (e) { fileErr(e, '装丁を変えられませんでした'); }
    }));
    bindCov();
    pop.querySelectorAll('[data-face]').forEach(b => b.addEventListener('click', async () => {
      const f = b.dataset.face; if (f === w.face || (f === 'ro' && w.face !== 'lo')) return;
      try { await api.setFace(wid, { face: f }); w.face = f; pop.querySelectorAll('[data-face]').forEach(x => x.setAttribute('aria-pressed', x === b)); pop.querySelector('.cover-pick').innerHTML = thumbs(f); bindCov(); redraw(); refreshWorks(pop.isConnected); } catch (e) { fileErr(e, '表紙の向きを変えられませんでした'); }
    }));
    const brk = pop.querySelector('#covBrk'), note = pop.querySelector('#covBrkNote');
    const NOTE = '「／」を入れたところで折り返します。背表紙にも使われます。';
    let brkT = null;
    const saveBrk = async () => {
      const v = brk.value.replace(/[\/]/g, '／').trim();
      if (v && !manualParts(w.title, v)) { note.textContent = '作品名と同じ文字に「／」を入れてください（今は自動で折り返します）'; note.style.color = 'var(--danger, #d9776a)'; return; }
      note.textContent = NOTE; note.style.color = '';
      if (v === (w.titleBreak || '')) return;
      try { await api.setFace(wid, { titleBreak: v }); w.titleBreak = v; redraw(); refreshWorks(pop.isConnected); } catch (e) { fileErr(e, '題字の改行を保存できませんでした'); }
    };
    brk.addEventListener('input', () => { clearTimeout(brkT); brkT = setTimeout(saveBrk, 500); });
    brk.addEventListener('change', () => { clearTimeout(brkT); saveBrk(); });
  };
  if (IS_ANDROID) {
    let lp = null, longDone = false, sx = 0, sy = 0;
    spine.addEventListener('contextmenu', e => e.preventDefault());
    spine.addEventListener('pointerdown', e => { longDone = false; sx = e.clientX; sy = e.clientY; clearTimeout(lp); lp = setTimeout(() => { longDone = true; try { navigator.vibrate && navigator.vibrate(15); } catch (er) {} openCov(); }, 450); });
    spine.addEventListener('pointermove', e => { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 12) clearTimeout(lp); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => spine.addEventListener(t, () => clearTimeout(lp)));
    spine.addEventListener('click', () => { if (!longDone && !$('.cov-pop')) toast('表紙を長押しすると装丁を変えられます'); });
  } else spine.addEventListener('click', openCov);
  renderPlotField(w);
  $('#wAdd').onclick = async () => { try { const cid = await api.createChapter(wid, '第' + (chs.length + 1) + '章', ''); await refreshWorks(); openChapter(wid, cid); } catch (e) { fileErr(e, '章を追加できませんでした'); } };
  $('#wImp').onclick = () => openImport(wid);
  $('#wExpCh').onclick = () => {
    const st = P().settings;
    openDlg(`<div class="dlg"><h3>章ごとにmdで書き出す</h3><p class="note">${IS_ANDROID ? (IS_WEB ? '章を1つずつ.mdファイルにして、共有メニューを開きます。「"ファイル"に保存」を選ぶと、iCloud Driveなどにまとめて保存できます。' : '章を1つずつ.mdファイルにして、共有メニューを開きます。「ドライブに保存」を選ぶと、まとめてDriveに保存できます。') : '次の画面で書き出し先のフォルダを選びます。その中に作品名のフォルダを作り、章を1つずつ.mdファイルにします（同じ名前のファイルは上書き）。'}</p>
    <div class="radio">
     <label><input type="checkbox" id="xHead" ${st.exHeading ? 'checked' : ''}> <span>先頭に「## 章タイトル」を付ける</span></label>
     <label><input type="checkbox" id="xBr" ${st.exBr ? 'checked' : ''}> <span>空行を &lt;br&gt; で書く（取り込んだ元のmdと同じ形式）<br><span class="muted small">オフにすると、アプリで見ている通りの普通の改行で書き出します</span></span></label>
    </div>
    <div class="row"><span class="spacer"></span><button class="btn ghost" data-close>やめる</button><button class="btn gold" id="xGo">${IS_ANDROID ? '共有する' : 'フォルダを選ぶ'}</button></div></div>`, d => {
      d.querySelector('#xGo').addEventListener('click', async () => {
        st.exHeading = d.querySelector('#xHead').checked; st.exBr = d.querySelector('#xBr').checked; saveProgress(); closeDlg();
        try {
          if (S.curWork === wid) await saveChapter();
          const r = await api.exportChapters(wid, { heading: st.exHeading, br: st.exBr }); if (!r) return;
          if (IS_ANDROID) { toast(r.count + '章を共有メニューに渡しました'); return; }
          openDlg(`<div class="dlg"><h3>${r.count}章を書き出しました</h3><div class="pathbox">${esc(r.dest)}</div><div class="row"><span class="spacer"></span><button class="btn" id="dOpen">フォルダを開く</button><button class="btn gold" data-close>閉じる</button></div></div>`, d2 => d2.querySelector('#dOpen').addEventListener('click', () => api.openPath()));
        } catch (e) { fileErr(e, '書き出せませんでした'); }
      });
    });
  };
  $('#wExp').onclick = async () => { try { if (S.curWork === wid) await saveChapter(); const md = await api.workMarkdown(wid); if (await api.saveText(w.title + '.md', md)) toast('書き出しました'); } catch (e) { fileErr(e, '書き出せませんでした'); } };
  $('#wCopy').onclick = async () => { try { if (S.curWork === wid) await saveChapter(); copyText(await api.workPlain(wid)); } catch (e) { fileErr(e, 'コピーできませんでした'); } };
  $('#wDel').onclick = async () => {
    if (!await confirmDlg('作品をごみ箱へ', '「' + w.title + '」を章ごと消します。' + TRASH_NOTE, 'ごみ箱へ移動')) return;
    try { if (S.curWork === wid) { await saveChapter(); S.curWork = S.curCh = null; loaded.key = null; } await api.trashWork(wid); S.openWork = null; await refreshWorks(); toast('ごみ箱へ移動しました'); }
    catch (e) { fileErr(e, 'ごみ箱へ移動できませんでした'); }
  };
}

function closeCov() { const p = $('.cov-pop'); if (p) p.remove(); const sp = $('#wSpine'); if (sp) { sp.classList.remove('open'); sp.setAttribute('aria-expanded', 'false'); } if (S.covDirty) { S.covDirty = false; if (S.view === 'library') renderLibrary(); } }
document.addEventListener('pointerdown', e => { const p = $('.cov-pop'); if (p && !p.contains(e.target) && !e.target.closest('#wSpine')) closeCov(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCov(); });

/* ---------- the plot on the work page ---------- */
function versionList(versions, using, pickable) {
  return `<div class="pv-list"><div class="h">同じ名前の版（${versions.length}）${pickable ? '<span class="spacer"></span><span>使いたい版の「これにする」を押します</span>' : ''}</div>${versions.map((v, i) => `<div class="r${v.rel === using ? ' use' : ''}">${v.folder ? `<span class="fd">${esc(v.folder)} ›</span>` : ''}<span class="fn">${esc(v.name)}</span>${v.rel === using ? '<span class="use-badge">使用中</span>' : ''}${i === 0 && pickable ? '<span class="badge">いちばん新しい</span>' : ''}<span class="d">${dateLabel(v.mtime)}</span>${pickable && v.rel !== using ? `<button type="button" class="btn sm" data-use="${esc(v.rel)}">これにする</button>` : ''}</div>`).join('')}</div>`;
}
async function renderPlotField(w) {
  await renderPlotFieldInner(w);
  const box = $('#wPlot'); if (!box || S.openWork !== w.id || box.querySelector('#wPlotWrite')) return;
  box.insertAdjacentHTML('beforeend', `<div class="row" style="margin-top:6px"><button type="button" class="btn sm" id="wPlotWrite">✎ プロットを書く</button><span class="muted small">${w.plot ? '執筆画面で、このプロットを直接書けます（自動保存なし）' : '「' + esc(w.title) + 'プロット.md」を作って書き始めます'}</span></div>`);
  $('#wPlotWrite').onclick = () => pmEnter(w.id);
}
async function renderPlotFieldInner(w) {
  const box = $('#wPlot'); if (!box) return; const wid = w.id;
  if (!w.plot) {
    box.innerHTML = api.plotCandidates
      ? `<label>プロット</label><div class="row"><button type="button" class="btn sm gold" id="wPlotPick">プロットにするファイルを選ぶ</button><span class="muted small">作品フォルダの中の md・txt から選びます</span></div>`
      : api.pickPlotFile
        ? `<label>プロット</label><div class="row"><button type="button" class="btn sm gold" id="wPlotDrive">${IS_WEB ? 'ファイルから選ぶ' : 'ドライブから選ぶ'}</button></div><span class="muted small">プロットの md を選ぶと、中身を写して持ちます。元のファイルを直したら「差し替える」で選び直してください。</span>`
        : `<label>プロット</label><p class="muted small" style="margin:0">プロットはPC版の作品ページで選べます。引き継ぎファイルで一緒に届きます。</p>`;
    const b = $('#wPlotPick'); if (b) b.onclick = () => pickPlot(w);
    const d = $('#wPlotDrive'); if (d) d.onclick = () => pickPlotDrive(w);
    return;
  }
  box.innerHTML = `<label>プロット</label><div class="muted small">読み込み中…</div>`;
  let info = null; try { info = await getPlot(wid); } catch (e) {}
  if (S.openWork !== wid || $('#wPlot') !== box) return;
  if (!info) { box.innerHTML = `<label>プロット</label><div class="muted small">プロットを読み込めませんでした。</div>`; return; }
  if (info.fromPc || info.fromPhone) {
    const from = info.fromPhone ? 'スマホで選んだ版' : 'PCから引き継いだ版';
    const when = info.mtime ? '・' + dateLabel(info.mtime) + 'の版' : '';
    box.innerHTML = `<label>プロット</label><div class="pf pf-phone"><div class="ic">筋</div><div class="pf-info" style="flex:1;min-width:0"><div class="nm">${esc(info.file.split('/').pop())}</div><div class="sub">${from}${when}・${fmt(info.chars)}字</div></div>${api.pickPlotFile ? '<button type="button" class="btn sm" id="wPlotRe">差し替える</button><button type="button" class="btn sm ghost" id="wPlotOff">外す</button>' : ''}</div><span class="muted small">執筆画面の「プロット」で見られます。${api.pickPlotFile ? 'PCから届いた版とぶつかったときは、元のファイルの日付が新しい方を残します。' : '選び直しはPC版の作品ページで。'}</span>`;
    if (api.pickPlotFile) {
      $('#wPlotRe').onclick = () => pickPlotDrive(w);
      $('#wPlotOff').onclick = async () => { if (!await confirmDlg('プロットを外す', IS_WEB ? '書房に写したプロットを消します。元のファイルはそのままです。' : 'スマホに写したプロットを消します。ドライブの元のファイルはそのままです。', '外す')) return; try { await api.clearPlot(wid); await refreshWorks(); toast('プロットを外しました'); } catch (e) { fileErr(e, '外せませんでした'); } };
    }
    return;
  }
  const auto = info.mode !== 'fixed'; const versions = info.versions || [];
  const name = info.missing ? '（ファイルが見つかりません）' : info.file.split('/').pop();
  let html = `<label>プロット</label><div class="pf"><div class="ic">筋</div><div style="flex:1;min-width:0"><div class="nm">${auto ? '「' + esc(info.key) + '」' : esc(name)}<span class="badge">${auto ? 'いちばん新しい版を自動で使う' : '選んだ版に固定'}</span></div><div class="sub">${info.missing ? '同じ名前のファイルが見つかりません。選び直してください' : (auto ? 'いま使っている版：' + esc(info.file) + '・' : '') + dateLabel(info.mtime) + 'に保存・' + fmt(info.chars) + '字'}</div></div><button type="button" class="btn sm" id="wPlotRe">選び直す</button><button type="button" class="btn sm ghost" id="wPlotOff">外す</button></div>
  <div class="modebar"><span class="lb">この作品のプロット</span><span class="segm" role="group" aria-label="この作品のプロット"><button type="button" data-pm="auto" aria-pressed="${auto}">いちばん新しい版を自動で</button><button type="button" data-pm="fixed" aria-pressed="${!auto}">選んだ版に固定</button></span></div>`;
  if (auto) {
    if (info.held) html += `<div class="plot-note warn">いちばん新しい版が空っぽか、前の版の半分より短いので、念のため古い版は消さずに残しています。</div>`;
    else if (info.lastClean) html += `<div class="plot-note">${dateLabel(info.lastClean.at)}　古い版を${info.lastClean.n}つごみ箱に入れました。（30日以内ならごみ箱から戻せます）</div>`;
    if (versions.length > 1) html += versionList(versions, info.file, false);
  } else html += versionList(versions, info.file, true);
  if (info.fellBack) html += `<div class="plot-note warn">選んでいた版が見つからないので、いちばん新しい版を表示しています。</div>`;
  if (!info.missing && isPhoneEdit(info.file) && api.restorePlotName) html += `<div class="plot-note">「${esc(fileBase(info.file))}」はスマホで直した版です。<button type="button" class="btn sm" id="wPlotName" style="margin-left:8px">元の名前に戻す</button></div>`;
  html += `<span class="muted small">名前が「${esc(info.key)}」のファイル（(1) などの番号違いを含む）は、どれも章の一覧に出しません。「外す」と章の一覧に戻ります。</span>`;
  box.innerHTML = html;
  const nb = $('#wPlotName'); if (nb) nb.onclick = () => restorePlotNameAsk(w, info.file, true);
  $('#wPlotRe').onclick = () => pickPlot(w);
  $('#wPlotOff').onclick = async () => { try { await api.clearPlot(wid); await refreshWorks(); toast('プロットを外しました。ファイルは章の一覧に戻ります'); } catch (e) { fileErr(e, '外せませんでした'); } };
  box.querySelectorAll('[data-pm]').forEach(b => b.addEventListener('click', async () => {
    const mode = b.dataset.pm; if ((mode === 'auto') === auto) return;
    try { await api.setPlotMode(wid, mode, mode === 'fixed' && !info.missing ? info.file : undefined); await refreshWorks(); } catch (e) { fileErr(e, '切り替えられませんでした'); }
  }));
  box.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', async () => { try { await api.setPlotMode(wid, 'fixed', b.dataset.use); await refreshWorks(); } catch (e) { fileErr(e, '切り替えられませんでした'); } }));
}
async function pickPlotDrive(w) {
  try {
    const r = await api.pickPlotFile(w.id); if (!r) return;
    await refreshWorks(); toast('「' + r.file + '」をプロットにしました（' + fmt(r.chars) + '字）');
  } catch (e) { fileErr(e, 'プロットを読み込めませんでした'); }
}
// a version edited on the phone gets the plot's plain name back; the old file with that name goes to backup
async function restorePlotNameAsk(w, rel, refresh) {
  if (PM.on && PM.wid === w.id && PM.dirty) { toast('書きかけのプロットを保存してから戻してください'); return; }
  const plain = fileBase(rel).replace(PHONE_MARK_RE, '').replace(/[ 　]*[(（]\d+[)）]$/, '');
  const r = await choiceDlg('元の名前に戻す', `「${fileBase(rel)}」を「${plain}」という名前に戻します。その名前だった前のファイルは backup に移します（消しません）。`, [['yes', '元の名前に戻す', 'gold'], ['no', 'このままにする', 'ghost']]);
  if (r !== 'yes') return;
  try { await api.restorePlotName(w.id, rel); if (PM.on && PM.wid === w.id) loaded.key = null; toast('元の名前に戻しました'); if (refresh) await refreshWorks(); }
  catch (e) { fileErr(e, '名前を戻せませんでした'); }
}
async function pickPlot(w) {
  let list = []; try { list = await api.plotCandidates(w.id); } catch (e) { fileErr(e, 'ファイルを読めませんでした'); return; }
  if (!list.length) { toast('作品フォルダに md・txt のファイルがありません'); return; }
  const label = { chapter: '章の一覧にあるファイル', hidden: '隠しているファイル', sub: '下のフォルダのファイル' };
  let rows = '', grp = null;
  for (const f of list) {
    if (f.kind !== grp) { grp = f.kind; rows += `<div class="grp">${label[grp]}</div>`; }
    rows += `<button type="button" data-rel="${esc(f.rel)}" aria-pressed="false">${f.folder ? `<span class="muted small">${esc(f.folder)} ›</span>` : ''}<span>${esc(f.name)}</span><span class="k">${f.kind === 'chapter' ? '章' : f.kind === 'hidden' ? '隠し' : ''}</span></button>`;
  }
  openDlg(`<div class="dlg"><h3>プロットにするファイル</h3><p class="note" style="margin:0">選んだファイルは章の一覧から外れ、字数にも数えません。ファイルはコピーせず、毎回そのファイルを読みに行きます。同じ名前で (1)・(2) のように番号の付いたファイルも、同じプロットの別の版として扱います。</p><div class="pick-list">${rows}</div><div class="row"><span class="spacer"></span><button class="btn ghost" data-close>やめる</button><button class="btn gold" id="ppGo" disabled>プロットにする</button></div></div>`, d => {
    let pick = null;
    d.querySelectorAll('[data-rel]').forEach(b => b.addEventListener('click', () => { pick = b.dataset.rel; d.querySelectorAll('[data-rel]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); d.querySelector('#ppGo').disabled = false; }));
    d.querySelector('#ppGo').addEventListener('click', async () => {
      closeDlg();
      try {
        if (S.curWork === w.id) await saveChapter(); await api.setPlot(w.id, pick, P().settings.plotDefault === 'fixed' ? 'fixed' : 'auto');
        if (isPhoneEdit(pick) && api.restorePlotName) await restorePlotNameAsk(w, pick, false);
        await refreshWorks(); toast('プロットにしました');
      }
      catch (e) { fileErr(e, 'プロットにできませんでした'); }
    });
  });
}

/* ---------- editor ---------- */
const edText = $('#edText'), edTitle = $('#edTitle');
let dirty = false, saveT = null, baseLen = 0, loadingKey = null;
const loaded = { key: null, mtime: 0 };
async function openChapter(wid, cid) {
  if (PM.on) { if (!await pmLeaveOK('章を開く')) return; PM.on = false; loaded.key = null; }
  await saveChapter();
  S.curWork = wid; S.curCh = cid; lsSet('ss.curWork', wid); lsSet('ss.curCh', cid); loaded.key = null;
  setView('editor');
}
function applySettings() {
  const s = P().settings; edText.className = 'paper ' + (s.font === 'gothic' ? 'gothic' : 'mincho'); edText.style.fontSize = (PM.on ? pmSize() : s.size) + 'px';
  // v1.1.13: line height (本文 1.4–2.4, default 1.95). The plot keeps its old ratio to the text (1.8 : 1.95).
  const lh = Math.min(2.4, Math.max(1.4, Number(s.lh) || 1.95)), de = document.documentElement.style;
  de.setProperty('--ed-lh', String(lh)); de.setProperty('--pm-lh', (lh * 1.8 / 1.95).toFixed(3));
  renderPreview();
}
function renderPreview() {
  const pv = $('#sPreview'); if (!pv || !S.progress) return; const s = P().settings, lh = Number(s.lh) || 1.95;
  pv.className = 'lh-preview ' + (s.font === 'gothic' ? 'gothic' : 'mincho'); pv.style.fontSize = s.size + 'px';
  $('#sSizeV').textContent = s.size + 'px';
  $('#sLhV').textContent = (lh < 1.7 ? '狭い' : lh < 2.05 ? 'ふつう' : '広い') + '（' + lh.toFixed(2) + '）';
}
function chapterInfo() { const w = workById(S.curWork); return w ? { w, chs: w.chapters, idx: w.chapters.findIndex(c => c.id === S.curCh) } : null; }
async function renderEditor() {
  if (SR.open && SR.key !== (PM.on ? 'plot:' + PM.wid : S.curWork + '/' + S.curCh)) srClose(false);
  pmChrome();
  if (PM.on) return renderPlotEditor();
  renderHP();
  const ci = chapterInfo();
  if (!ci || ci.idx < 0) { $('#edEmpty').hidden = false; $('#edBody').hidden = true; showSlime(false); return; }
  $('#edEmpty').hidden = true; $('#edBody').hidden = false; applySettings(); showSlime(true);
  const { w, chs, idx } = ci; const ch = chs[idx];
  $('#edWork').textContent = w.title; $('#edChNo').textContent = '第' + (idx + 1) + '章 / 全' + chs.length + '章';
  $('#edPrev').disabled = idx <= 0; $('#edNext').disabled = idx >= chs.length - 1;
  if (document.activeElement !== edTitle) edTitle.value = ch.title;
  const key = w.id + '/' + ch.id;
  if (loaded.key !== key && loadingKey !== key) {
    loadingKey = key;
    try {
      const r = await api.readChapter(w.id, ch.id);
      if (loadingKey !== key) return;
      edText.value = r.text; loaded.key = key; loaded.mtime = r.mtime; baseLen = countChars(r.text); dirty = false; setSave('');
      edText.focus(); caretToEnd(); askEnd();
    } catch (e) { fileErr(e, '章を開けませんでした'); }
    finally { if (loadingKey === key) loadingKey = null; }
  }
  else if (S.enterEnd && loaded.key === key) { edText.focus({ preventScroll: true }); caretToEnd(); askEnd(); }
  S.enterEnd = false;
  setCount();
  sideRender();
}
/* v1.1.18: 本文を書き始めるときは、キャレットを一番下に置いて、欄も一番下まで動かす（小松竹さんの要望）。
   章を開いたとき・ほかの画面から「執筆」に来たときに一律でそうする。
   スマホは最初のタップでキャレットがタップした場所に移り、キーボードが出ると欄が縮んで一番下が隠れるので、
   開いてから最初のタップのあとと、キーボードが出たあとにもう一度だけ一番下へ戻す（2回目からのタップはふつうに動く）。 */
let endUntil = 0, endTap = false;
function caretToEnd() { const n = edText.value.length; edText.setSelectionRange(n, n); edText.scrollTop = edText.scrollHeight; }
function askEnd() { endTap = true; endUntil = performance.now() + 1500; }
edText.addEventListener('pointerup', e => {
  if (!endTap || e.pointerType === 'mouse' || PM.on) return;
  endTap = false; endUntil = performance.now() + 1500;   // キーボードが出るまで、もう少し見張る
  setTimeout(caretToEnd, 0); setTimeout(caretToEnd, 350);
});
edText.addEventListener('keydown', () => { endTap = false; endUntil = 0; });
// 400-character manuscript sheets: 20 cells a line, a new line at every line break, an empty line counts as a line
function genkoSheets(text) { if (!String(text).trim()) return 0; let lines = 0; for (const l of String(text).replace(/\r/g, '').split('\n')) lines += Math.max(1, Math.ceil(Array.from(l).length / 20)); return lines / 20; }
function setCount(t) { const v = edText.value; if (PM.on) { $('#edCount').textContent = fmt(countChars(t ?? pmText())) + '字'; return; } $('#edCount').innerHTML = fmt(countChars(v)) + '字<span class="genko">原稿用紙 約' + (Math.round(genkoSheets(v) * 10) / 10).toFixed(1) + '枚</span>'; }
function setSave(s, err) { const el = $('#edSave'); el.textContent = s; el.classList.toggle('err', !!err); }
function markDirty() { dirty = true; setSave('未保存'); clearTimeout(saveT); saveT = setTimeout(saveChapter, 1200); setCount(); }
function credit() { const len = countChars(edText.value); const d = len - baseLen; baseLen = len; if (d) addCredit(d); }
edText.addEventListener('input', e => { if (!loaded.key) return; if (PM.on) { pmTouched(); srRefreshSoon(); return; } if (srMuted(e)) { markDirty(); baseLen = countChars(edText.value); setCount(); srRefreshSoon(); return; } srRefreshSoon(); markDirty(); zoneTouch(); queueSpark(/^delete/.test(e.inputType || '') ? 'heal' : 'magic'); if (e.isComposing) return; credit(e.inputType); });
edText.addEventListener('compositionend', () => { if (!PM.on) credit('compositionend'); });
function saveChapter() {
  clearTimeout(saveT);
  if (PM.on || String(loaded.key || '').startsWith('plot:')) return chains.get('ch') || Promise.resolve();   // the plot is saved only when asked
  if (!dirty || !loaded.key) return chains.get('ch') || Promise.resolve();
  const [wid, cid] = [S.curWork, S.curCh];
  if (loaded.key !== wid + '/' + cid) return Promise.resolve();
  const body = edText.value; dirty = false; setSave('保存中…');
  return serial('ch', () => api.writeChapter(wid, cid, body)).then(r => {
    if (loaded.key === wid + '/' + cid) loaded.mtime = r.mtime;
    const w = workById(wid); const c = w && w.chapters.find(x => x.id === cid);
    if (c) { w.chars += r.chars - c.chars; c.chars = r.chars; c.mtime = r.mtime; }
    if (!dirty) { const d = new Date(); setSave('保存済み ' + pad(d.getHours()) + ':' + pad(d.getMinutes())); }
  }).catch(e => { dirty = true; setSave('保存できませんでした。5秒後にもう一度試します', true); saveT = setTimeout(saveChapter, 5000); });
}
edTitle.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); edText.focus(); } });
edTitle.addEventListener('change', async () => {
  const ci = chapterInfo(); if (!ci || ci.idx < 0) return; const ch = ci.chs[ci.idx];
  const v = edTitle.value.trim(); if (!v || v === ch.title) { edTitle.value = ch.title; return; }
  try { await saveChapter(); await memoSave(); const ncid = await api.renameChapter(ci.w.id, ch.id, v); S.curCh = ncid; lsSet('ss.curCh', ncid); loaded.key = ci.w.id + '/' + ncid; await refreshWorks(); renderEditor(); }
  catch (e) { edTitle.value = ch.title; fileErr(e, '章の名前を変えられませんでした'); }
});
$('#edWork').onclick = async () => { await saveChapter(); openWork(S.curWork); };
$('#edCopy').onclick = () => copyText(edText.value);
$('#edExport').onclick = async () => { try { if (await api.saveText((edTitle.value || '無題') + '.md', edText.value)) toast('書き出しました'); } catch (e) { fileErr(e, '書き出せませんでした'); } };
const step = d => { const ci = chapterInfo(); if (!ci) return; const n = ci.chs[ci.idx + d]; if (n) openChapter(ci.w.id, n.id); };
$('#edPrev').onclick = () => step(-1); $('#edNext').onclick = () => step(1);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (PM.on && S.view === 'editor') { if (!document.activeElement || !document.activeElement.closest('#sidePanel')) pmSave(); } else saveChapter(); saveProgress(true); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter' && S.view === 'editor' && loaded.key && !PM.on) { e.preventDefault(); insertScene(); }
});
// Insert through the browser's own editing command so Ctrl+Z works and the usual input handling (damage, sparks, autosave) runs.
function insertAtCaret(text, selectFrom, selectTo) {
  const keep = edText.scrollTop;
  edText.focus();
  const start = edText.selectionStart;
  if (!document.execCommand('insertText', false, text)) { edText.setRangeText(text, start, edText.selectionEnd, 'end'); edText.dispatchEvent(new InputEvent('input', { inputType: 'insertText', bubbles: true })); }
  if (selectFrom != null) edText.setSelectionRange(start + selectFrom, start + (selectTo ?? selectFrom));
  holdScroll(keep);
}
// Chromium can throw a long textarea far down after a scripted insert (a line break in the middle of the text):
// put the view back where it was, then only move as far as needed to keep the caret in sight
function holdScroll(keep) {
  if (Math.abs(edText.scrollTop - keep) < 2) return;
  edText.scrollTop = keep;
  try {
    const p = caretPoint(), lh = parseFloat(getComputedStyle(edText).lineHeight) || 28;
    if (p.y > edText.clientHeight - lh) edText.scrollTop += p.y - edText.clientHeight + lh * 1.5;
    else if (p.y < lh) edText.scrollTop -= lh - p.y + lh * 0.5;
  } catch (e) {}
}
function insertScene() {
  if (!loaded.key) return;
  const mark = (P().settings.scene || '　＊　＊　＊').replace(/\n/g, '');
  const v = edText.value, a = edText.selectionStart, b = edText.selectionEnd;
  const before = v.slice(0, a), after = v.slice(b);
  // one empty line above and below the mark, reusing line breaks that are already there
  const nlBefore = before.length === 0 ? 0 : (before.match(/\n*$/)[0].length);
  const nlAfter = (after.match(/^\n*/)[0].length);
  const pre = before.length === 0 ? '' : '\n'.repeat(Math.max(0, 2 - nlBefore));
  const post = '\n'.repeat(Math.max(0, 2 - nlAfter));
  const text = pre + mark + post;
  // caret goes to the start of the line after the empty line below the mark
  const caret = pre.length + mark.length + 2;
  insertAtCaret(text);
  edText.setSelectionRange(a + caret, a + caret);
}
document.querySelectorAll('.ed-tools [data-wrap]').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
document.querySelectorAll('.ed-tools [data-wrap]').forEach(b => b.addEventListener('click', () => {
  if (!loaded.key) return;
  const [l, r] = b.dataset.wrap.split('|'); const sel = edText.value.slice(edText.selectionStart, edText.selectionEnd);
  insertAtCaret(l + sel + r, l.length + sel.length);
}));
document.querySelectorAll('.ed-tools [data-ins]').forEach(b => { b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', () => { if (loaded.key) insertAtCaret(b.dataset.ins); }); });
$('#edScene').addEventListener('mousedown', e => e.preventDefault());
$('#edScene').addEventListener('click', insertScene);
/* ---------- plot mode (v1.1.4): the plot is written in the same editor, saved only when asked ---------- */
const DEF_TAGS = ['【公式】', '【創作設定】', '【公式補完】', '【要Web確認】', '【要INDEX確認】', '【INDEX候補】'];
const plotTags = () => { const t = P().settings.plotTags; return Array.isArray(t) ? t : DEF_TAGS; };
const novelTools = document.querySelector('.ed-tools:not(.pm-tools)');
const pmDraftKey = wid => 'ss.plotDraft.' + wid;
const PHONE_MARK_RE = /[ 　]*[(（]スマホ[^)）]*[)）]$/;
// the day and time a chapter was last written (the file's date), for the chapter list (setting「最後に書いた日時」)
const chWhen = t => { const d = new Date(t); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fileBase = f => String(f || '').split('/').pop().replace(/\.(md|markdown|txt)$/i, '');
const isPhoneEdit = f => PHONE_MARK_RE.test(fileBase(f));
// which surface holds the plot: the look-as-you-type editor (default) or the plain textarea (setting "記号のまま")
const pmEd = $('#pmEd');
const pmUsesWy = () => (P().settings.pmView || 'wysi') !== 'raw';
const pmText = () => PM.wy ? wySerialize() : edText.value;
function pmSetText(md) { if (PM.wy) { wyRender(wyParse(md)); wyHistReset(); } else edText.value = md; }
function pmSurface() {
  const on = PM.on && PM.wy;
  pmEd.hidden = !on; edText.style.visibility = on ? 'hidden' : '';
  if (on) { pmEd.style.fontSize = pmSize() + 'px'; pmEd.classList.toggle('chips', P().settings.pmTag === 'chip'); }
  // v1.1.17: 記号のまま表示（textarea）もプロットの大きさに。本文に戻るときは本文の大きさ
  edText.style.fontSize = (PM.on ? pmSize() : (P().settings.size || 17)) + 'px';
}
// v1.1.17: プロットの文字の大きさ（設定「プロットモード」）。まだ選んでいなければ本文と同じ（前は本文の88%だった）
function pmSize() { const s = P().settings; return Number(s.pmSize) || Number(s.size) || 17; }
/* v1.1.17: プロット編集モードの「見出しへ移動」。開くたびに、いま書いてある見出しで並びを作り直す */
const pmJump = $('#pmJump');
if (IS_ANDROID) $('#pmSave').before($('#pmJumpWrap'));   // スマホは下の段（字数と保存のあいだ）
function pmHeads() {
  if (PM.wy) return [...pmEd.children].map((d, i) => /^h[1-6]$/.test(d.className) ? { lv: +d.className[1], text: d.textContent, at: i } : null).filter(Boolean);
  const out = []; let pos = 0;
  for (const l of edText.value.split('\n')) { const m = l.match(/^(#{1,6})\s+(.+)$/); if (m) out.push({ lv: m[1].length, text: m[2], at: pos + l.length }); pos += l.length + 1; }
  return out;
}
function pmJumpFill() {
  const hs = pmHeads(), minL = hs.length ? Math.min(...hs.map(h => h.lv)) : 1;
  pmJump.innerHTML = '<option value="">' + (hs.length ? '見出しへ移動…' : '見出しはまだありません') + '</option>'
    + hs.map((h, i) => `<option value="${i}">${'　'.repeat(h.lv - minL)}${esc(h.text.slice(0, 40))}</option>`).join('');
  pmJump._hs = hs;
}
['pointerdown', 'focus', 'keydown'].forEach(ev => pmJump.addEventListener(ev, e => { if (ev === 'keydown' && e.key !== ' ' && e.key !== 'Enter' && !e.key.startsWith('Arrow')) return; if (ev === 'keydown' && pmJump._hs) return; pmJumpFill(); }));
pmJump.addEventListener('blur', () => { pmJump._hs = null; });
pmJump.addEventListener('change', () => {
  const h = (pmJump._hs || [])[+pmJump.value]; pmJump.value = ''; pmJump._hs = null; if (!h) return;
  if (PM.wy) {
    const el = pmEd.children[h.at]; if (!el) return;
    pmEd.scrollTop += el.getBoundingClientRect().top - pmEd.getBoundingClientRect().top - 8;
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    pmEd.focus({ preventScroll: true }); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  } else {
    edText.focus({ preventScroll: true }); edText.setSelectionRange(h.at, h.at);
    const cs = getComputedStyle(edText), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.8;
    edText.scrollTop += caretPoint().y - lh * 0.55 - (parseFloat(cs.paddingTop) || 0);
  }
});
function pmChrome() {
  document.body.classList.toggle('plot-mode', PM.on);
  novelTools.hidden = PM.on; $('#pmTools').hidden = !PM.on; $('#pmSave').hidden = !PM.on; $('#pmBadge').hidden = !PM.on; $('#pmJumpWrap').hidden = !PM.on;
  document.querySelectorAll('.nv-hint').forEach(x => x.hidden = PM.on); document.querySelectorAll('.pm-hint').forEach(x => x.hidden = !PM.on);
  edTitle.readOnly = PM.on; edTitle.title = PM.on ? 'プロットのファイル名（名前は作品ページで変わります）' : '';
  if (!PM.on) closeMenus();
  pmSurface();
}
function pmSetSave() {
  const el = $('#edSave'); el.classList.remove('err');
  el.innerHTML = PM.dirty ? '<span class="pm-unsaved">● 保存していない変更があります</span>' : PM.savedAt ? '保存済み ' + PM.savedAt : '';
  $('#pmSave').disabled = !PM.dirty || PM.busy;
}
function choiceDlg(title, body, buttons) {
  return new Promise(res => {
    let done = false;
    openDlg(`<div class="dlg"><h3>${esc(title)}</h3><p style="margin:0">${esc(body)}</p><div class="row" style="flex-wrap:wrap"><span class="spacer"></span>${buttons.map(([v, l, k]) => `<button class="btn ${k || ''}" data-choice="${v}">${esc(l)}</button>`).join('')}</div></div>`, d => {
      d.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => { done = true; closeDlg(); res(b.dataset.choice); }));
      const onClose = () => {
        if (done) return;
        if (!dlg.__userClose && performance.now() - dlg.__openedAt < DLG_SETTLE) { d.addEventListener('close', onClose, { once: true }); return; }
        done = true; res('cancel');
      };
      d.addEventListener('close', onClose, { once: true });
    });
  });
}
// true = go on (saved, or the changes were let go)
async function pmLeaveOK(what) {
  if (PM.on && !PM.dirty) { clearTimeout(pmDraftT); lsSet(pmDraftKey(PM.wid), null); }
  if (!PM.on || !PM.dirty) return true;
  const r = await choiceDlg('保存していない変更があります', `プロットの変更を保存せずに${what}と、その変更はなくなります。`, [['save', '保存して進む', 'gold'], ['drop', '保存しない', 'danger'], ['cancel', 'やめる', 'ghost']]);
  if (r === 'save') return pmSave();
  if (r === 'drop') { clearTimeout(pmDraftT); lsSet(pmDraftKey(PM.wid), null); PM.dirty = false; loaded.key = null; pmSetSave(); return true; }
  return false;
}
async function pmEnter(wid) {
  closeTabCtx();
  if (!wid || !workById(wid)) { toast('書斎で作品を開いてから選んでください'); return; }
  if (PM.on && PM.wid === wid) { if (S.view !== 'editor') setView('editor'); return; }
  if (PM.on && !await pmLeaveOK('切り替える')) return;
  if (!PM.on) { await saveChapter(); await memoSave(); }
  PM.on = true; PM.wid = wid; PM.savedAt = ''; loaded.key = null; PM.wy = pmUsesWy();
  if (S.view === 'editor') renderEditor(); else setView('editor');
}
async function pmExit() {
  closeTabCtx();
  if (PM.on && !await pmLeaveOK('本文に戻る')) return;
  PM.on = false; loaded.key = null;
  if (S.view === 'editor') renderEditor(); else setView('editor');
}
async function renderPlotEditor() {
  const w = workById(PM.wid);
  if (!w) { PM.on = false; pmChrome(); return renderEditor(); }
  $('#edEmpty').hidden = true; $('#edBody').hidden = false; applySettings(); showSlime(false); layoutSide();
  $('#edWork').textContent = w.title; $('#edChNo').textContent = 'プロット';
  const key = 'plot:' + w.id;
  if (loaded.key !== key && loadingKey !== key) {
    loadingKey = key;
    try {
      let info = await api.plotInfo(w.id, {});
      if (!info || info.missing) {
        await api.createPlot(w.id, P().settings.plotDefault === 'fixed' ? 'fixed' : 'auto');
        info = await api.plotInfo(w.id, {});
        try { S.works = await api.list(); } catch (e) {}
        toast('「' + fileBase(info.file) + '」を作りました');
      }
      // a version edited on the phone: offer its own name back before writing to it
      if (api.restorePlotName && isPhoneEdit(info.file)) {
        const r = await choiceDlg('スマホで直した版です', `いま使われているのは「${fileBase(info.file)}」です。元の名前「${fileBase(info.file).replace(PHONE_MARK_RE, '').replace(/[ 　]*[(（]\d+[)）]$/, '')}」に戻してから開きますか？ 戻すと、その名前だった前のファイルは backup に移します（消しません）。`, [['yes', '元の名前に戻す', 'gold'], ['no', 'このまま開く', 'ghost']]);
        if (r === 'yes') { await api.restorePlotName(w.id, info.file); info = await api.plotInfo(w.id, {}); try { S.works = await api.list(); } catch (e) {} toast('元の名前に戻しました'); }
      }
      if (loadingKey !== key || !PM.on) return;
      let text = info.text, restored = false;
      const dr = lsGet(pmDraftKey(w.id), null);
      if (dr && typeof dr.text === 'string' && dr.text !== text) {
        const t = new Date(dr.at || 0);
        const r = await choiceDlg('保存していない書きかけがあります', `${t.getMonth() + 1}月${t.getDate()}日 ${pad(t.getHours())}:${pad(t.getMinutes())} に書いていた、保存していないプロットの中身が残っています。そちらを開きますか？`, [['draft', '書きかけを開く', 'gold'], ['file', '保存した方を開く', 'ghost']]);
        if (r === 'draft') { text = dr.text; restored = true; } else lsSet(pmDraftKey(w.id), null);
      }
      if (loadingKey !== key || !PM.on) return;
      PM.wy = pmUsesWy(); pmSurface();
      pmSetText(info.text); PM.savedNorm = pmText();   // what "unchanged" looks like on this surface
      if (restored) pmSetText(text);
      PM.file = info.file; PM.mtime = info.mtime || 0; PM.saved = info.text; PM.dirty = restored && pmText() !== PM.savedNorm;
      loaded.key = key; loaded.mtime = PM.mtime;
      edTitle.value = fileBase(info.file);
      if (PM.wy) { pmEd.focus(); wyCaretSet({ a: { line: 0, off: 0 }, b: { line: 0, off: 0 } }); pmEd.scrollTop = 0; }
      else { edText.focus(); edText.setSelectionRange(0, 0); edText.scrollTop = 0; }
    } catch (e) { fileErr(e, 'プロットを開けませんでした'); }
    finally { if (loadingKey === key) loadingKey = null; }
  }
  setCount(); pmSetSave(); pmBulletState();
}
let pmDraftT = null;
function pmTouched() {
  const cur = pmText();
  PM.dirty = cur !== (PM.savedNorm ?? PM.saved); pmSetSave(); setCount(cur); pmBulletState();
  clearTimeout(pmDraftT);
  // a copy in this device's storage, so a crash or a killed app does not lose what was written
  const wid = PM.wid, file = PM.file, text = cur, dirtyNow = PM.dirty;
  pmDraftT = setTimeout(() => lsSet(pmDraftKey(wid), dirtyNow ? { file, text, at: Date.now() } : null), 700);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && PM.on && PM.dirty && loaded.key) lsSet(pmDraftKey(PM.wid), { file: PM.file, text: pmText(), at: Date.now() }); });
async function pmSave() {
  if (!PM.on || !loaded.key || PM.busy) return false;
  if (!PM.dirty) return true;
  const text = pmText(), was = countChars(PM.saved), now = countChars(text);
  if (was >= 40 && now < was * 0.5 && !await confirmDlg('かなり短くなります', `保存すると ${fmt(was)}字 → ${fmt(now)}字 になります。本当に保存しますか？（前の中身は backup に残ります）`, '保存する')) return false;
  PM.busy = true; setSave('保存中…'); $('#pmSave').disabled = true;
  try {
    let r = await api.savePlot(PM.wid, PM.file, text, PM.mtime);
    if (r && r.conflict) {
      PM.busy = false; pmSetSave();
      if (!await confirmDlg('ほかで書き換えられています', 'このプロットのファイルは、開いたあとにアプリの外で書き換えられています。こちらの中身で上書きしますか？（外で書き換えられた中身は backup に残ります）', '上書きする')) return false;
      PM.busy = true; r = await api.savePlot(PM.wid, PM.file, text, PM.mtime, true);
    }
    PM.mtime = r.mtime; if (r.file) { PM.file = r.file; edTitle.value = fileBase(r.file); }
    PM.saved = text; PM.savedNorm = text; PM.dirty = pmText() !== text;
    const d = new Date(); PM.savedAt = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (!PM.dirty) { clearTimeout(pmDraftT); lsSet(pmDraftKey(PM.wid), null); }
    api.list().then(x => { S.works = x; }).catch(() => {});
    return true;
  } catch (e) { fileErr(e, 'プロットを保存できませんでした'); return false; }
  finally { PM.busy = false; pmSetSave(); }
}
$('#pmSave').addEventListener('click', () => pmSave());

// ---- editing whole lines (headings, bullets, indents) through insertText so Ctrl+Z keeps working ----
function lineRange() {
  const v = edText.value, a = edText.selectionStart, b = edText.selectionEnd;
  const ls = v.lastIndexOf('\n', a - 1) + 1;
  let le = v.indexOf('\n', b > a && v[b - 1] === '\n' ? b - 1 : b); if (le < 0) le = v.length;
  return { v, a, b, ls, le, lines: v.slice(ls, le).split('\n') };
}
function editLines(fn) {
  if (!PM.on || !loaded.key) return;
  const r = lineRange(); const out = fn(r.lines); const txt = out.join('\n');
  if (txt === r.lines.join('\n')) return;
  const keep = edText.scrollTop;
  edText.focus(); edText.setSelectionRange(r.ls, r.le);
  if (txt) insertAtCaret(txt); else document.execCommand('delete');
  if (r.lines.length > 1) edText.setSelectionRange(r.ls, r.ls + txt.length);
  else { const caret = Math.max(r.ls, Math.min(r.ls + txt.length, r.a + (txt.length - r.lines[0].length))); edText.setSelectionRange(r.a === r.le ? r.ls + txt.length : caret, r.a === r.le ? r.ls + txt.length : caret); }
  holdScroll(keep);
  pmBulletState();
}
const hLevel = l => { const m = /^(#{1,6})\s/.exec(l); return m ? m[1].length : 0; };
const plainLine = l => l.replace(/^\s*(?:#{1,6}\s+|[-*+]\s+)?/, '');
function pmHeading(n) {
  editLines(lines => {
    const body = lines.filter(l => l.trim()); const all = n && body.length && body.every(l => hLevel(l) === n);
    return lines.map(l => (!l.trim() && lines.length > 1) ? l : (all || !n) ? plainLine(l) : '#'.repeat(n) + ' ' + plainLine(l));
  });
}
const isBullet = l => /^\s*- /.test(l);
function pmBullet() {
  editLines(lines => {
    const body = lines.filter(l => l.trim()); const all = body.length && body.every(isBullet);
    return lines.map(l => (!l.trim() && lines.length > 1) ? l : all ? l.replace(/^(\s*)- /, '$1') : isBullet(l) ? l : l.match(/^\s*/)[0] + '- ' + l.replace(/^\s*(?:#{1,6}\s+)?/, ''));
  });
}
function pmIndent(d) {
  editLines(lines => lines.map(l => d > 0 ? ((l || lines.length === 1) ? '    ' + l : l) : l.replace(/^( {1,4}|\t)/, '')));
}
function pmBulletState() { if (!PM.on) return; if (PM.wy) { const d = wyLineAtCaret(); $('#pmBullet').setAttribute('aria-pressed', String(!!d && d.classList.contains('li'))); return; } const r = lineRange(); $('#pmBullet').setAttribute('aria-pressed', String(isBullet(r.lines[0] || ''))); }
// a line of its own, with an empty line above and below (a "---" right under text would turn that text into a heading)
function insertBlock(mark) {
  const v = edText.value, a = edText.selectionStart, b = edText.selectionEnd;
  const before = v.slice(0, a), after = v.slice(b);
  const pre = before.length === 0 ? '' : '\n'.repeat(Math.max(0, 2 - before.match(/\n*$/)[0].length));
  const post = '\n'.repeat(Math.max(0, 2 - after.match(/^\n*/)[0].length));
  insertAtCaret(pre + mark + post);
  const c = a + pre.length + mark.length + 2; edText.setSelectionRange(c, c);
}
edText.addEventListener('keydown', e => {
  if (!PM.on || !loaded.key || e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); pmIndent(e.shiftKey ? -1 : 1); return; }
  if (e.key === 'Backspace' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && edText.selectionStart === edText.selectionEnd) {
    const r = lineRange(), line = r.lines[0], col = r.a - r.ls, m = /^(\s*)- /.exec(line);
    const ind = (line.match(/^\s*/) || [''])[0];
    // caret just after "- " (or anywhere in the marker / the indent before it)
    if (m && col > 0 && col <= m[0].length) {
      e.preventDefault();
      if (m[1].length) editLines(ls => ls.map(l => l.replace(/^( {1,4}|\t)/, '')));
      else editLines(ls => ls.map(l => l.replace(/^- /, '')));
      const r2 = lineRange(); const mm = /^(\s*)- /.exec(r2.lines[0]);
      const at = r2.ls + (mm ? mm[0].length : 0); edText.setSelectionRange(at, at);
      return;
    }
    // inside the indent of a plain line: back to the previous 4-space step
    if (!m && col > 0 && col <= ind.length && /^ +$/.test(line.slice(0, col))) {
      e.preventDefault();
      const cut = col % 4 || 4; const keep = edText.scrollTop;
      edText.setSelectionRange(r.a - cut, r.a); document.execCommand('delete'); holdScroll(keep);
      return;
    }
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && edText.selectionStart === edText.selectionEnd) {
    const r = lineRange(); const line = r.lines[0]; const m = /^(\s*)- (.*)$/.exec(line);
    if (!m) return;
    e.preventDefault();
    if (!m[2].trim() && r.a === r.le) {
      // Enter on an empty bullet: one step out, and out of the list at the top level
      editLines(ls => ls.map(l => m[1] ? l.replace(/^( {1,4}|\t)/, '') : l.replace(/^(\s*)- \s*$/, '$1')));
      return;
    }
    insertAtCaret('\n' + m[1] + '- '); pmBulletState();
  }
});
['keyup', 'mouseup', 'focus'].forEach(t => edText.addEventListener(t, () => { if (PM.on) pmBulletState(); }));

// ---- the look-as-you-type plot editor: one <div> a line, saved as md ----
// line: { k: 'p' | 'h' | 'li' | 'ind' | 'rule' | 'brl', n (heading level), lv (indent step, 4 spaces each), html (inline) }
const wyInline = s => { let h = esc(s).replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>'); if (P().settings.pmTag === 'chip') h = h.replace(/【[^【】\n]{1,24}】/g, m => `<span class="tagchip">${m}</span>`); return h; };
function wyParse(md) {
  return String(md || '').replace(/\r/g, '').split('\n').map(l => {
    let m;
    if (/^\s*<br\s*\/?>\s*$/i.test(l)) return { k: 'brl', lv: 0, html: '' };
    if (/^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/.test(l)) return { k: 'rule', lv: 0, html: '' };
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) return { k: 'h', n: m[1].length, lv: 0, html: wyInline(m[2]) };
    if ((m = /^([ \t]*)[-*+]\s+(.*)$/.exec(l)) || (m = /^([ \t]*)[-*+]()$/.exec(l))) return { k: 'li', lv: Math.min(8, Math.floor(m[1].replace(/\t/g, '    ').length / 4)), html: wyInline(m[2]) };
    if ((m = /^([ \t]+)(\S.*)$/.exec(l))) { const lv = Math.floor(m[1].replace(/\t/g, '    ').length / 4); return lv ? { k: 'ind', lv: Math.min(8, lv), html: wyInline(m[2]) } : { k: 'p', lv: 0, html: wyInline(m[2]) }; }
    return { k: 'p', lv: 0, html: wyInline(l.trim() ? l : '') };
  });
}
function wyLineHTML(L) {
  const body = L.html || '<br>';
  if (L.k === 'h') return `<div class="h${L.n}">${body}</div>`;
  if (L.k === 'li') return `<div class="li" data-lv="${L.lv}" style="--lv:${L.lv}">${body}</div>`;
  if (L.k === 'ind') return `<div class="ind" data-lv="${L.lv}" style="--lv:${L.lv}">${body}</div>`;
  if (L.k === 'rule') return '<div class="rule" data-k="rule"><br></div>';
  if (L.k === 'brl') return '<div class="brl" data-k="brl"><br></div>';
  return `<div>${body}</div>`;
}
function wyRender(lines) { pmEd.innerHTML = (lines.length ? lines : [{ k: 'p', lv: 0, html: '' }]).map(wyLineHTML).join(''); }
// what a line div says, as md inline text: bold back to **, anything else as plain text
function wyInlineMd(node) {
  let out = '';
  for (const c of node.childNodes) {
    if (c.nodeType === 3) out += c.nodeValue.replace(/​/g, '');
    else if (c.nodeType === 1) {
      const t = c.tagName;
      if (t === 'BR') continue;
      const inner = wyInlineMd(c);
      out += (t === 'B' || t === 'STRONG') && inner.trim() ? '**' + inner + '**' : inner;
    }
  }
  return out.replace(/\n/g, ' ');
}
function wyLineOf(div) {
  const cl = div.classList, lv = Math.max(0, Math.min(8, Number(div.dataset.lv) || 0));
  const hm = /\bh([1-6])\b/.exec(div.className || '');
  if (cl.contains('rule')) return { k: 'rule', lv: 0, html: '' };
  if (cl.contains('brl')) return { k: 'brl', lv: 0, html: '' };
  const html = wyInline(wyInlineMd(div));
  if (hm) return { k: 'h', n: Number(hm[1]), lv: 0, html };
  if (cl.contains('li')) return { k: 'li', lv, html };
  if (cl.contains('ind') && lv) return { k: 'ind', lv, html };
  return { k: 'p', lv: 0, html };
}
function wyLines() { wyFix(); return [...pmEd.children].map(wyLineOf); }
function wySerialize() {
  wyFix();
  return [...pmEd.children].map(div => {
    const cl = div.classList, lv = Math.max(0, Math.min(8, Number(div.dataset.lv) || 0)), t = wyInlineMd(div);
    const hm = /\bh([1-6])\b/.exec(div.className || '');
    if (cl.contains('rule')) return '---';
    if (cl.contains('brl')) return '<br>';
    if (hm) return '#'.repeat(Number(hm[1])) + ' ' + t;
    if (cl.contains('li')) return '    '.repeat(lv) + '- ' + t;
    if (cl.contains('ind') && lv && t) return '    '.repeat(lv) + t;
    return t;
  }).join('\n');
}
// keep the top level made only of line divs (the browser sometimes leaves bare text, nests divs or adds styled spans)
function wyFix() {
  for (const n of [...pmEd.childNodes]) {
    if (n.nodeType === 1 && n.tagName === 'DIV') {
      for (const inner of [...n.querySelectorAll('div')]) { const d = document.createElement('div'); d.className = n.className; if (n.dataset.lv) { d.dataset.lv = n.dataset.lv; d.style.cssText = n.style.cssText; } while (inner.firstChild) d.appendChild(inner.firstChild); inner.remove(); n.after(d); }
      n.querySelectorAll('span:not(.tagchip),font').forEach(sp => sp.replaceWith(...sp.childNodes));
      continue;
    }
    if (n.nodeType === 3 && !n.nodeValue) { n.remove(); continue; }
    const d = document.createElement('div'); n.before(d); d.appendChild(n);
  }
  if (!pmEd.firstChild) pmEd.innerHTML = '<div><br></div>';
}
function wyLineAtCaret() { const sel = getSelection(); if (!sel.rangeCount) return null; let n = sel.getRangeAt(0).startContainer; while (n && n.parentNode !== pmEd) n = n.parentNode; return n && n.nodeType === 1 ? n : null; }
// caret as (line index, characters from the start of the line), so it survives a redraw
function wyPoint(node, off) {
  let line = node; while (line && line.parentNode !== pmEd) line = line.parentNode;
  if (!line) { if (node === pmEd) { const i = Math.min(off, pmEd.children.length - 1); return { line: Math.max(0, i), off: 0 }; } return { line: 0, off: 0 }; }
  const r = document.createRange(); r.selectNodeContents(line); try { r.setEnd(node, off); } catch (e) { return { line: [...pmEd.children].indexOf(line), off: 0 }; }
  return { line: [...pmEd.children].indexOf(line), off: r.toString().replace(/​/g, '').length };
}
function wyCaretGet() { const sel = getSelection(); if (!sel.rangeCount || !pmEd.contains(sel.anchorNode)) return null; const r = sel.getRangeAt(0); return { a: wyPoint(r.startContainer, r.startOffset), b: wyPoint(r.endContainer, r.endOffset) }; }
function wyDom(p) {
  const lines = pmEd.children; const line = lines[Math.max(0, Math.min(p.line, lines.length - 1))]; if (!line) return [pmEd, 0];
  let left = p.off; const w = document.createTreeWalker(line, NodeFilter.SHOW_TEXT); let t;
  while ((t = w.nextNode())) { if (left <= t.nodeValue.length) return [t, left]; left -= t.nodeValue.length; }
  return [line, line.childNodes.length && line.lastChild.nodeName === 'BR' ? line.childNodes.length - 1 : line.childNodes.length];
}
function wyCaretSet(c) { if (!c) return; const sel = getSelection(); const r = document.createRange(); const [an, ao] = wyDom(c.a), [bn, bo] = wyDom(c.b); try { r.setStart(an, ao); r.setEnd(bn, bo); sel.removeAllRanges(); sel.addRange(r); } catch (e) {} }
// undo of our own (the browser's undo cannot follow our line changes)
const WH = { list: [], i: -1, t: null };
function wyHistReset() { WH.list = [{ md: wySerialize(), c: null }]; WH.i = 0; clearTimeout(WH.t); WH.t = null; }
function wyCommit() { clearTimeout(WH.t); WH.t = null; const md = wySerialize(); if (WH.list[WH.i] && WH.list[WH.i].md === md) { WH.list[WH.i].c = wyCaretGet(); return; } WH.list = WH.list.slice(0, WH.i + 1); WH.list.push({ md, c: wyCaretGet() }); if (WH.list.length > 300) WH.list.shift(); WH.i = WH.list.length - 1; }
function wyUndo(d) {
  if (WH.t) wyCommit();
  const j = WH.i + d; if (j < 0 || j >= WH.list.length) return;
  const keep = pmEd.scrollTop; WH.i = j; const st = WH.list[j];
  wyRender(wyParse(st.md)); pmEd.scrollTop = keep;
  wyCaretSet(st.c || WH.list[j + 1 - (d < 0 ? 0 : 1)]?.c || { a: { line: 0, off: 0 }, b: { line: 0, off: 0 } });
  pmTouched();
}
// a change made line by line: redraw, put the caret back, remember it for undo
function wyOp(fn) {
  if (!PM.on || !PM.wy || !loaded.key) return;
  wyCommit();
  const c = wyCaretGet() || { a: { line: 0, off: 0 }, b: { line: 0, off: 0 } };
  const lines = wyLines(); const i0 = Math.min(c.a.line, c.b.line), i1 = Math.max(c.a.line, c.b.line);
  const nc = fn(lines, i0, i1, c) || c;
  const keep = pmEd.scrollTop; wyRender(lines); pmEd.scrollTop = keep;
  pmEd.focus(); wyCaretSet(nc); wyCommit(); pmTouched();
}
const wyText = L => L.html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
function wyHeading(n) {
  wyOp((ls, i0, i1) => {
    const sel = ls.slice(i0, i1 + 1), body = sel.filter(L => wyText(L).trim());
    const all = n && body.length && body.every(L => L.k === 'h' && L.n === n);
    for (let i = i0; i <= i1; i++) { const L = ls[i]; if (L.k === 'rule' || L.k === 'brl' || (!wyText(L).trim() && i1 > i0)) continue; if (all || !n) { L.k = 'p'; L.lv = 0; } else { L.k = 'h'; L.n = n; L.lv = 0; } }
  });
}
function wyBullet() {
  wyOp((ls, i0, i1) => {
    const body = ls.slice(i0, i1 + 1).filter(L => wyText(L).trim()); const all = body.length && body.every(L => L.k === 'li');
    for (let i = i0; i <= i1; i++) { const L = ls[i]; if (L.k === 'rule' || L.k === 'brl' || (!wyText(L).trim() && i1 > i0)) continue; if (all) L.k = L.lv ? 'ind' : 'p'; else { if (L.k === 'h') L.lv = 0; L.k = 'li'; } }
  });
}
function wyIndent(d) {
  wyOp((ls, i0, i1) => {
    for (let i = i0; i <= i1; i++) {
      const L = ls[i]; if (L.k === 'h' || L.k === 'rule' || L.k === 'brl') continue;
      if (d > 0) { if (L.k === 'p') { L.k = 'ind'; L.lv = 1; } else L.lv = Math.min(8, L.lv + 1); }
      else if (L.lv > 0) { L.lv--; if (L.k === 'ind' && !L.lv) L.k = 'p'; }
    }
  });
}
function wyRule() {
  wyOp((ls, i0, i1, c) => {
    const L = ls[i1]; const empty = !wyText(L).trim() && L.k !== 'rule';
    if (empty) { ls.splice(i1, 1, { k: 'rule', lv: 0, html: '' }, { k: 'p', lv: 0, html: '' }); return { a: { line: i1 + 1, off: 0 }, b: { line: i1 + 1, off: 0 } }; }
    ls.splice(i1 + 1, 0, { k: 'rule', lv: 0, html: '' }, { k: 'p', lv: 0, html: '' });
    return { a: { line: i1 + 2, off: 0 }, b: { line: i1 + 2, off: 0 } };
  });
}
// typing: the browser edits the text; afterwards the line kinds are tidied
pmEd.addEventListener('beforeinput', e => {
  if (!PM.on || !PM.wy) return;
  if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') { e.preventDefault(); wyUndo(e.inputType === 'historyUndo' ? -1 : 1); return; }
  if (e.inputType === 'deleteContentBackward' && !e.isComposing) {
    const c = wyCaretGet(); if (!c || c.a.line !== c.b.line || c.a.off !== c.b.off || c.a.off !== 0) return;
    const div = pmEd.children[c.a.line]; if (!div) return; const L = wyLineOf(div);
    // at the very start of a line: a bullet goes one step out (and stops being a bullet at the top), a heading becomes a plain line
    if (L.k === 'li' || L.k === 'h' || (L.k === 'ind' && L.lv)) {
      e.preventDefault();
      wyOp(ls => { const M = ls[c.a.line]; if (M.k === 'h') { M.k = 'p'; } else if (M.lv > 0) { M.lv--; if (M.k === 'ind' && !M.lv) M.k = 'p'; } else M.k = 'p'; });
      return;
    }
    if (L.k === 'rule' || L.k === 'brl') { e.preventDefault(); wyOp(ls => { ls[c.a.line] = { k: 'p', lv: 0, html: '' }; }); return; }
  }
  if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') { /* handled in the paste event */ }
});
pmEd.addEventListener('input', e => {
  if (!PM.on || !PM.wy || !loaded.key) return;
  if (e.inputType === 'insertParagraph' && !e.isComposing) {
    const cur = wyLineAtCaret(); const prev = cur && cur.previousElementSibling;
    if (cur && prev) {
      const curEmpty = !cur.textContent.replace(/​/g, '').length, prevEmpty = !prev.textContent.replace(/​/g, '').length;
      // Enter on an empty bullet: one step out (out of the list at the top level) instead of another empty bullet
      if (prev.classList.contains('li') && prevEmpty && cur.classList.contains('li') && curEmpty) {
        const idx = [...pmEd.children].indexOf(prev);
        wyOp(ls => { ls.splice(idx + 1, 1); const M = ls[idx]; if (M.lv > 0) M.lv--; else M.k = 'p'; return { a: { line: idx, off: 0 }, b: { line: idx, off: 0 } }; });
        return;
      }
      // the line after a heading, a rule or an empty-line mark is a plain line
      if (/\bh[1-6]\b|\brule\b|\bbrl\b/.test(prev.className) && /\bh[1-6]\b|\brule\b|\bbrl\b/.test(cur.className)) {
        if (curEmpty || /\brule\b|\bbrl\b/.test(prev.className)) { cur.className = ''; delete cur.dataset.lv; delete cur.dataset.k; cur.removeAttribute('style'); }
      }
      // a heading split before its first letter leaves the heading on the line below
      if (/\bh[1-6]\b/.test(prev.className) && prevEmpty && !curEmpty) { prev.className = ''; }
    }
  }
  if (!e.isComposing) wyFixLine();
  clearTimeout(WH.t); WH.t = setTimeout(wyCommit, 700);
  clearTimeout(wyTouchT); wyTouchT = setTimeout(pmTouched, 120);
});
let wyTouchT = null;
pmEd.addEventListener('compositionend', () => { wyFixLine(); clearTimeout(wyTouchT); wyTouchT = setTimeout(pmTouched, 120); });
// spans with copied styles that the browser leaves when lines are joined
function wyFixLine() { const d = wyLineAtCaret(); const sel = getSelection(); if (!d) { wyFix(); return; } const bad = d.querySelectorAll('span:not(.tagchip),font,div'); if (!bad.length && pmEd.firstChild && pmEd.firstChild.nodeType === 1) return; const c = wyCaretGet(); wyFix(); wyCaretSet(c); }
pmEd.addEventListener('keydown', e => {
  if (!PM.on || !PM.wy || e.isComposing || e.keyCode === 229) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'z' || k === 'y')) { e.preventDefault(); wyUndo(k === 'y' || e.shiftKey ? 1 : -1); return; }
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); wyIndent(e.shiftKey ? -1 : 1); return; }
});
['keyup', 'mouseup', 'focus'].forEach(t => pmEd.addEventListener(t, () => { if (PM.on && PM.wy) pmBulletState(); }));
// ---- paste: markdown or formatted text from elsewhere becomes the plot's own lines ----
function mdFromHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html'); const out = [];
  const inl = n => {
    let s = '';
    for (const c of n.childNodes) {
      if (c.nodeType === 3) s += c.nodeValue.replace(/\s+/g, ' ');
      else if (c.nodeType === 1) {
        const t = c.tagName;
        if (t === 'BR') s += '\n';
        else if (t === 'UL' || t === 'OL') continue;
        else if (t === 'B' || t === 'STRONG') { const x = inl(c).trim(); if (x) s += '**' + x + '**'; }
        else if (/^(SCRIPT|STYLE|BUTTON|SVG)$/.test(t)) continue;
        else s += inl(c);
      }
    }
    return s;
  };
  const push = (text, prefix) => { String(text).split('\n').forEach((l, i) => { const t = l.trim(); if (t || i === 0) out.push((i === 0 ? prefix : prefix.replace(/[^ ]/g, ' ')) + t); }); };
  const list = (el, depth) => {
    let n = 0;
    for (const li of el.children) {
      if (li.tagName !== 'LI') continue; n++;
      const mark = el.tagName === 'OL' ? (Number(el.getAttribute('start') || 1) + n - 1) + '. ' : '- ';
      const own = inl(li).replace(/^\s+|\s+$/g, '');
      push(own, '    '.repeat(depth) + mark);
      for (const sub of li.querySelectorAll(':scope > ul, :scope > ol, :scope > div > ul, :scope > div > ol')) list(sub, depth + 1);
    }
  };
  const walk = node => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { const t = c.nodeValue.trim(); if (t) push(t, ''); continue; }
      if (c.nodeType !== 1) continue;
      const t = c.tagName, h = /^H([1-6])$/.exec(t);
      if (h) { out.push('#'.repeat(Number(h[1])) + ' ' + inl(c).trim()); continue; }
      if (t === 'UL' || t === 'OL') { list(c, 0); continue; }
      if (t === 'HR') { out.push('---'); continue; }
      if (t === 'PRE') { out.push(...c.textContent.replace(/\n$/, '').split('\n')); continue; }
      if (t === 'P') { push(inl(c).trim(), ''); continue; }
      if (t === 'TABLE') { for (const tr of c.querySelectorAll('tr')) out.push([...tr.children].map(td => inl(td).trim()).join(' | ')); continue; }
      if (/^(DIV|SECTION|ARTICLE|BLOCKQUOTE|MAIN|BODY|SPAN|FONT|A|EM|I)$/.test(t) && c.querySelector('h1,h2,h3,h4,h5,h6,ul,ol,p,div,pre,table,hr')) { walk(c); continue; }
      if (/^(SCRIPT|STYLE|META|LINK|TITLE)$/.test(t)) continue;
      const x = inl(c).trim(); if (x) push(x, '');
    }
  };
  walk(doc.body);
  // blank lines between blocks, as chat apps show them, are kept only once
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function mdTidy(md) {
  const lines = String(md).replace(/\r/g, '').replace(/ /g, ' ').split('\n');
  // the step other apps indent by (2 spaces, 4 spaces or a tab) becomes 4 spaces
  const steps = lines.map(l => /^([ \t]+)(?:[-*+]|\d+[.)])\s/.exec(l)).filter(Boolean).map(m => m[1].replace(/\t/g, '    ').length);
  const unit = steps.length ? Math.max(1, Math.min(...steps)) : 4;
  return lines.map(l => {
    let m;
    if ((m = /^([ \t]*)[-*+•・]\s+(.*)$/.exec(l))) return '    '.repeat(Math.round(m[1].replace(/\t/g, '    ').length / unit)) + '- ' + m[2];
    if ((m = /^([ \t]+)(\d+[.)]\s+.*)$/.exec(l))) return '    '.repeat(Math.round(m[1].replace(/\t/g, '    ').length / unit)) + m[2];
    return l;
  }).map(l => l.replace(/__([^_]+)__/g, '**$1**').replace(/(^|[^*])\*(?!\*)([^*\n]+?)\*(?!\*)/g, '$1$2')).join('\n');
}
pmEd.addEventListener('paste', e => {
  if (!PM.on || !PM.wy) return;
  e.preventDefault();
  const cd = e.clipboardData; const html = cd.getData('text/html'), text = cd.getData('text/plain');
  const md = mdTidy(html && /<(h[1-6]|ul|ol|li|strong|b|p|hr|br)\b/i.test(html) ? mdFromHTML(html) : text);
  if (!md) return;
  if (!/\n/.test(md) && !/^\s*(#{1,6}\s|[-*+]\s|---)/.test(md)) { document.execCommand('insertText', false, md.replace(/\*\*([^*]+)\*\*/g, '$1')); return; }
  wyOp((ls, i0, i1, c) => {
    // what was selected goes, then the pasted lines go in at the caret
    const a = c.a, b = c.b;
    const head = wyText(ls[a.line] || { html: '' }), tail = wyText(ls[b.line] || { html: '' });
    const first = ls[a.line] || { k: 'p', lv: 0, html: '' };
    const before = head.slice(0, a.off), after = tail.slice(b.off);
    const add = wyParse(md);
    const merged = [];
    if (before.trim()) { merged.push({ ...first, html: wyInline(before) }); const f = add.shift(); if (f) merged[0].html = wyInline(before + wyText(f)); }
    merged.push(...add);
    if (!merged.length) merged.push({ k: 'p', lv: 0, html: '' });
    const last = merged[merged.length - 1]; const lastLen = wyText(last).length;
    if (after) last.html = wyInline(wyText(last) + after);
    ls.splice(a.line, b.line - a.line + 1, ...merged);
    const ln = a.line + merged.length - 1;
    return { a: { line: ln, off: lastLen }, b: { line: ln, off: lastLen } };
  });
});
// changing "見え方" while a plot is open moves the text across
function pmSwitchSurface() {
  if (!PM.on || !loaded.key) return;
  const want = pmUsesWy(); if (want === PM.wy) { pmSurface(); return; }
  const md = pmText(), wasDirty = PM.dirty;
  PM.wy = want; pmSurface();
  if (PM.wy) { pmSetText(PM.saved); PM.savedNorm = wySerialize(); pmSetText(md); }
  else { edText.value = md; PM.savedNorm = wasDirty ? PM.saved : md; }
  PM.dirty = pmText() !== PM.savedNorm; pmSetSave(); setCount();
}

// ---- search and replace (Ctrl+F / Ctrl+H), in the open chapter or the open plot ----
const srBar = $('#srBar'), srQ = $('#srQ'), srR = $('#srR');
const srWy = () => PM.on && PM.wy;
// a replacement (and undoing or redoing exactly that one) is not typing: no damage, no healing
function srMuted(e) {
  if (SR.mute) return true;
  const L = SR.last; if (!L) return false;
  if (e && e.inputType === 'historyUndo' && edText.value === L.before) return true;
  if (e && e.inputType === 'historyRedo' && edText.value === L.after) return true;
  return false;
}
function srOpen(rep) {
  if (S.view !== 'editor' || !loaded.key || $('#edBody').hidden) return;
  if (SR.open) { if (rep) srShowRep(true); const f = rep ? srR : srQ; f.focus(); f.select(); return; }
  SR.open = true; SR.key = loaded.key; srBar.hidden = false;
  const selText = srWy() ? String(getSelection()) : edText.value.slice(edText.selectionStart, edText.selectionEnd);
  if (selText && !/\n/.test(selText) && selText.length <= 60) srQ.value = selText;
  srShowRep(rep || !$('#srRepRow').hidden);
  (rep && srQ.value ? srR : srQ).focus(); (rep && srQ.value ? srR : srQ).select();
  srFind(true);
  if (!$('#slimeFloat').hidden) requestAnimationFrame(() => placeSlime());
}
function srShowRep(on) { $('#srRepRow').hidden = !on; $('#srMore').setAttribute('aria-expanded', String(on)); $('#srMore').textContent = on ? '置き換え ▾' : '置き換え ▸'; }
function srClose(focusText) {
  if (!SR.open) return;
  SR.open = false; srBar.hidden = true; srClear();
  if (!$('#slimeFloat').hidden) requestAnimationFrame(() => placeSlime());
  if (focusText !== false) {
    const m = SR.list[SR.i];
    if (srWy()) { pmEd.focus(); if (m) srSelectWy(m); }
    else { edText.focus(); if (m) edText.setSelectionRange(m.a, m.b); }
  }
}
function srClear() {
  if (SR.layer) { SR.layer.remove(); SR.layer = null; }
  edText.parentElement.classList.remove('sr-on');
  if (window.CSS && CSS.highlights) { CSS.highlights.delete('sr-all'); CSS.highlights.delete('sr-cur'); }
  $('#srCnt').textContent = ''; $('#srCnt').classList.remove('none');
}
// where the word appears: offsets in the textarea, or (line, from, to) in the plot editor
function srMatches(q) {
  const out = []; if (!q) return out;
  if (srWy()) {
    [...pmEd.children].forEach((div, line) => { const t = div.textContent; let i = 0, k; while ((k = t.indexOf(q, i)) >= 0) { out.push({ line, a: k, b: k + q.length }); i = k + q.length; } });
  } else {
    const v = edText.value; let i = 0, k; while ((k = v.indexOf(q, i)) >= 0) { out.push({ a: k, b: k + q.length }); i = k + q.length; }
  }
  return out;
}
function srCaretPos() {
  if (srWy()) { const c = wyCaretGet(); return c ? c.a : { line: 0, off: 0 }; }
  return edText.selectionStart;
}
function srFind(fromCaret) {
  if (!SR.open) return;
  const q = srQ.value; SR.list = srMatches(q);
  if (!q || !SR.list.length) { SR.i = -1; srPaint(); return; }
  if (fromCaret || SR.i < 0 || SR.i >= SR.list.length) {
    const c = srCaretPos();
    const at = SR.list.findIndex(m => srWy() ? (m.line > c.line || (m.line === c.line && m.b > c.off)) : m.b > c);
    SR.i = at < 0 ? 0 : at;
  }
  srPaint(true);
}
let srT = null;
function srRefreshSoon() { if (!SR.open) return; clearTimeout(srT); srT = setTimeout(() => { const keep = SR.i; SR.list = srMatches(srQ.value); SR.i = Math.min(keep, SR.list.length - 1); srPaint(false); }, 200); }
function srPaint(scroll) {
  const cnt = $('#srCnt'), q = srQ.value;
  cnt.textContent = !q ? '' : SR.list.length ? `${SR.i + 1} / ${SR.list.length}` : '0件';
  cnt.classList.toggle('none', !!q && !SR.list.length);
  if (srWy()) {
    if (!(window.CSS && CSS.highlights && window.Highlight)) return;
    const all = new Highlight(), cur = new Highlight();
    SR.list.forEach((m, i) => { const r = srRangeWy(m); if (r) (i === SR.i ? cur : all).add(r); });
    CSS.highlights.set('sr-all', all); CSS.highlights.set('sr-cur', cur);
    const m = SR.list[SR.i]; if (scroll && m) { const r = srRangeWy(m); if (r) { const rb = r.getBoundingClientRect(), eb = pmEd.getBoundingClientRect(); if (rb.top < eb.top + 30 || rb.bottom > eb.bottom - 30) pmEd.scrollTop += rb.top - eb.top - pmEd.clientHeight / 3; } }
    return;
  }
  // the textarea cannot colour its own text: a layer behind it shows the marks
  const wrap = edText.parentElement;
  if (!q || !SR.list.length) { if (SR.layer) SR.layer.innerHTML = ''; return; }
  if (!SR.layer) {
    const lay = document.createElement('div'); lay.className = 'sr-layer'; lay.setAttribute('aria-hidden', 'true'); wrap.insertBefore(lay, edText); SR.layer = lay;
    edText.addEventListener('scroll', srSync);
  }
  const cs = getComputedStyle(edText), lay = SR.layer;
  ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'padding-top', 'padding-left', 'padding-bottom', 'border-top-width', 'border-left-width', 'border-right-width', 'border-bottom-width', 'text-indent', 'word-break', 'tab-size', 'border-radius'].forEach(k => lay.style.setProperty(k, cs.getPropertyValue(k)));
  const sbw = edText.offsetWidth - edText.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  lay.style.paddingRight = (parseFloat(cs.paddingRight) + sbw) + 'px'; lay.style.background = getComputedStyle(edText).backgroundColor === 'rgba(0, 0, 0, 0)' ? (lay.style.background || '#15120d') : getComputedStyle(edText).backgroundColor;
  wrap.classList.add('sr-on');
  const v = edText.value; let h = '', from = 0;
  SR.list.forEach((m, i) => { h += esc(v.slice(from, m.a)) + `<mark${i === SR.i ? ' class="cur"' : ''}>${esc(v.slice(m.a, m.b))}</mark>`; from = m.b; });
  lay.innerHTML = h + esc(v.slice(from)) + '\n';
  srSync();
  const m = SR.list[SR.i];
  if (scroll && m) {
    const mk = lay.querySelector('mark.cur');
    if (mk) { const y = mk.offsetTop - edText.scrollTop; if (y < 30 || y > edText.clientHeight - 60) { edText.scrollTop = mk.offsetTop - edText.clientHeight / 3; srSync(); } }
  }
}
function srSync() { if (SR.layer) SR.layer.scrollTop = edText.scrollTop; }
function srRangeWy(m) {
  const div = pmEd.children[m.line]; if (!div) return null;
  const pa = wyDom({ line: m.line, off: m.a }), pb = wyDom({ line: m.line, off: m.b });
  const r = document.createRange(); try { r.setStart(pa[0], pa[1]); r.setEnd(pb[0], pb[1]); } catch (e) { return null; } return r;
}
function srSelectWy(m) { const r = srRangeWy(m); if (!r) return; const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
function srStep(d) {
  if (!SR.list.length) { srFind(false); return; }
  SR.i = (SR.i + d + SR.list.length) % SR.list.length; srPaint(true);
}
function srReplaceOne() {
  const q = srQ.value, rep = srR.value; if (!q || !SR.list.length || !loaded.key) return;
  const m = SR.list[SR.i];
  if (srWy()) { pmEd.focus(); srSelectWy(m); document.execCommand('insertText', false, rep); }
  else {
    const before = edText.value; const keep = edText.scrollTop;
    SR.mute = true; try { edText.focus(); edText.setSelectionRange(m.a, m.b); insertAtCaret(rep); } finally { SR.mute = false; }
    SR.last = { before, after: edText.value }; edText.scrollTop = keep;
  }
  // go on from just after the new text (it may itself contain the word)
  SR.list = srMatches(q);
  const nx = SR.list.findIndex(x => srWy() ? (x.line > m.line || (x.line === m.line && x.a >= m.a + rep.length)) : x.a >= m.a + rep.length);
  SR.i = nx < 0 ? (SR.list.length ? 0 : -1) : nx;
  srPaint(true); srR.focus();
}
function srReplaceAll() {
  const q = srQ.value, rep = srR.value; if (!q || !loaded.key) return;
  const n = srMatches(q).length; if (!n) { toast('見つかりませんでした'); return; }
  if (srWy()) {
    wyCommit();
    for (const div of [...pmEd.children]) {
      if (!div.textContent.includes(q)) continue;
      const md = wyInlineMd(div).split(q).join(rep); div.innerHTML = wyInline(md) || '<br>';
    }
    wyCommit(); pmTouched();
  } else {
    const before = edText.value, after = before.split(q).join(rep), keep = edText.scrollTop;
    // one step, so a single Ctrl+Z brings everything back
    SR.mute = true; try { edText.focus(); edText.select(); insertAtCaret(after); } finally { SR.mute = false; }
    SR.last = { before, after: edText.value };
    edText.setSelectionRange(0, 0); edText.scrollTop = keep;
  }
  toast(`${n}か所を置き換えました（Ctrl+Z で戻せます）`);
  srFind(false); srR.focus();
}
srQ.addEventListener('input', () => { SR.i = -1; srFind(true); });
srQ.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); srStep(e.shiftKey ? -1 : 1); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); srClose(); }
});
srR.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); if (e.ctrlKey || e.metaKey) srReplaceAll(); else srReplaceOne(); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); srClose(); }
});
$('#srPrev').addEventListener('click', () => srStep(-1));
$('#srNext').addEventListener('click', () => srStep(1));
$('#srMore').addEventListener('click', () => { const on = $('#srRepRow').hidden; srShowRep(on); (on ? srR : srQ).focus(); });
$('#srOne').addEventListener('click', srReplaceOne);
$('#srAll').addEventListener('click', srReplaceAll);
$('#srClose').addEventListener('click', () => srClose());
srBar.querySelectorAll('button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
  const k = e.key.toLowerCase();
  if ((k === 'f' || k === 'h') && S.view === 'editor' && loaded.key) { e.preventDefault(); srOpen(k === 'h'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && SR.open && (document.activeElement === edText || document.activeElement === pmEd)) srClose(); });
window.addEventListener('resize', () => { if (SR.open) srPaint(false); });

// ---- small menus under the toolbar buttons ----
let openMenuEl = null;
function closeMenus() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; document.querySelectorAll('.pm-tools [aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false')); } }
function openMenu(btn, items, right) {
  const was = openMenuEl && openMenuEl.__btn === btn; closeMenus(); if (was) return;
  const m = document.createElement('div'); m.className = 'pm-menu' + (right ? ' right' : ''); m.setAttribute('role', 'menu');
  for (const it of items) {
    if (it === '-') { m.insertAdjacentHTML('beforeend', '<div class="sep"></div>'); continue; }
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.innerHTML = it.html;
    if (it.cls) b.className = it.cls;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => { closeMenus(); it.run(); });
    m.appendChild(b);
  }
  // fixed to the window, so a toolbar that scrolls sideways (phone) does not cut the menu off
  const br = btn.getBoundingClientRect(); m.style.position = 'fixed'; m.style.top = (br.bottom + 4) + 'px'; m.style.left = br.left + 'px';
  document.body.appendChild(m); openMenuEl = m; m.__btn = btn; btn.setAttribute('aria-expanded', 'true');
  const r = m.getBoundingClientRect(); if (r.right > innerWidth - 8) m.style.left = Math.max(8, innerWidth - 8 - r.width) + 'px';
}
document.addEventListener('pointerdown', e => { if (openMenuEl && !e.target.closest('.pm-dd') && !e.target.closest('.pm-menu')) closeMenus(); });
window.addEventListener('resize', closeMenus); $('#pmTools').addEventListener('scroll', closeMenus);
if (IS_ANDROID) $('#pmSave').textContent = '保存';
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
$('#pmTools').querySelectorAll('button').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
$('#pmTools').querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => PM.wy ? wyHeading(Number(b.dataset.h)) : pmHeading(Number(b.dataset.h))));
$('#pmHMore').addEventListener('click', e => openMenu(e.currentTarget, [1, 2, 3, 4, 5, 6].map(n => ({ html: `<code>${'#'.repeat(n)}</code>見出し${n}`, run: () => PM.wy ? wyHeading(n) : pmHeading(n) })).concat(['-', { html: '<code>記号を外す</code>ふつうの行に戻す', run: () => PM.wy ? wyHeading(0) : pmHeading(0) }])));
$('#pmBullet').addEventListener('click', () => PM.wy ? wyBullet() : pmBullet());
$('#pmIn').addEventListener('click', () => PM.wy ? wyIndent(1) : pmIndent(1));
$('#pmOut').addEventListener('click', () => PM.wy ? wyIndent(-1) : pmIndent(-1));
$('#pmRule').addEventListener('click', () => { if (PM.on && loaded.key) { if (PM.wy) wyRule(); else insertBlock('---'); } });
$('#pmTags').addEventListener('click', e => openMenu(e.currentTarget, plotTags().map(t => ({ html: esc(t), run: () => { if (!loaded.key) return; if (PM.wy) { pmEd.focus(); document.execCommand('insertText', false, t); } else insertAtCaret(t); } })).concat(['-', { html: '<span class="sub">タグを編集…</span>', run: editTags }])));
$('#pmOut2').addEventListener('click', e => openMenu(e.currentTarget, [
  { html: '全文コピー', run: () => copyText(pmText()) },
  { html: 'mdで書き出す', run: async () => { try { if (await api.saveText(fileBase(PM.file) + '.md', pmText())) toast('書き出しました'); } catch (er) { fileErr(er, '書き出せませんでした'); } } },
  '-',
  { html: '箇条書きの空行を詰める', run: pmTidyBlank }
], true));
// UpNote puts a blank line wherever a list steps back out (bullet → blank → shallower bullet); take only those out
function tidyListBlanks(md) {
  const L = String(md).split('\n'), out = [], gone = [];
  const depth = l => { const m = /^([ \t]*)[-*+] /.exec(l); return m ? m[1].replace(/\t/g, '    ').length : -1; };
  for (let i = 0; i < L.length; i++) {
    if (L[i].trim() === '' && out.length) {
      let k = i; while (k < L.length && L[k].trim() === '') k++;
      const a = depth(out[out.length - 1]), b = k < L.length ? depth(L[k]) : -1;
      if (a >= 0 && b >= 0 && b < a) { for (let x = i; x < k; x++) gone.push(x); i = k - 1; continue; }
    }
    out.push(L[i]);
  }
  return { md: out.join('\n'), n: gone.length, gone };
}
function pmTidyBlank() {
  if (!PM.on || !loaded.key) return;
  const r = tidyListBlanks(pmText());
  if (!r.n) { toast('詰める空行はありませんでした'); return; }
  if (PM.wy) {
    wyCommit();
    const c = wyCaretGet(); const shift = ln => ln - r.gone.filter(x => x < ln).length;
    const keep = pmEd.scrollTop; wyRender(wyParse(r.md)); pmEd.scrollTop = keep;
    if (c) { pmEd.focus(); const fix = p => ({ line: Math.max(0, shift(p.line)), off: r.gone.includes(p.line) ? 0 : p.off }); wyCaretSet({ a: fix(c.a), b: fix(c.b) }); }
    wyCommit(); pmTouched();
  } else {
    const keep = edText.scrollTop, a = edText.selectionStart;
    const before = edText.value.slice(0, a).split('\n').length - 1, ln = before - r.gone.filter(x => x < before).length;
    edText.focus(); edText.setSelectionRange(0, edText.value.length); insertAtCaret(r.md);
    const pos = r.md.split('\n').slice(0, ln).reduce((s, l) => s + l.length + 1, 0); edText.setSelectionRange(pos, pos);
    holdScroll(keep);
  }
  toast(`空行を${r.n}か所詰めました` + (IS_ANDROID ? '' : '（元に戻すは Ctrl+Z）'));
}
function editTags() {
  openDlg(`<div class="dlg"><h3>タグを編集</h3><p class="note" style="margin:0">1行に1つ。上から順に「タグ ▾」に並びます。空にすると最初の6つに戻ります。</p><textarea class="input" id="tgList" rows="8" style="width:100%;font-family:var(--font-ui)">${esc(plotTags().join('\n'))}</textarea><div class="row"><span class="spacer"></span><button class="btn ghost" data-close>やめる</button><button class="btn gold" id="tgOk">保存</button></div></div>`, d => {
    d.querySelector('#tgOk').addEventListener('click', () => {
      const list = d.querySelector('#tgList').value.split('\n').map(x => x.trim()).filter(Boolean);
      P().settings.plotTags = list.length ? [...new Set(list)] : null; saveProgress(); closeDlg(); toast('タグを保存しました');
    });
  });
}

// ---- the 執筆 tab: right-click (long-press on the phone) to choose 本文 or プロット ----
let tabCtxEl = null;
function closeTabCtx() { if (tabCtxEl) { tabCtxEl.remove(); tabCtxEl = null; } }
function showTabCtx(btn) {
  closeTabCtx();
  const wid = PM.on ? PM.wid : (S.curWork || S.openWork);
  const w = workById(wid), ci = chapterInfo();
  const chName = ci && ci.idx >= 0 ? ci.chs[ci.idx].title : '';
  const plotName = w ? (w.plot && w.plot.key ? w.plot.key + '.md' : `「${w.title}プロット.md」を新しく作ります`) : '';
  const m = document.createElement('div'); m.className = 'tab-ctx'; m.setAttribute('role', 'menu');
  m.innerHTML = `<button type="button" data-k="novel" aria-current="${!PM.on}">本文を書く<small>${chName ? esc(chName) : '書斎で章を選びます'}</small></button>`
    + `<button type="button" data-k="plot" aria-current="${PM.on}" ${w ? '' : 'disabled'}>プロットを書く<small>${w ? esc(plotName) : '書斎で作品を開くと選べます'}</small></button>`;
  m.style.visibility = 'hidden'; document.body.appendChild(m); tabCtxEl = m;
  m.querySelector('[data-k=novel]').addEventListener('click', () => { if (PM.on) pmExit(); else { closeTabCtx(); setView('editor'); } });
  m.querySelector('[data-k=plot]').addEventListener('click', () => pmEnter(wid));
  // the phone has no Ctrl+F: search lives in this menu there
  if (IS_ANDROID) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.k = 'search'; b.innerHTML = '検索・置き換え<small>開いている章（またはプロット）の中を探します</small>';
    b.disabled = !loaded.key || S.view !== 'editor'; m.appendChild(b);
    b.addEventListener('click', () => { closeTabCtx(); srOpen(false); });
  }
  // v1.1.9 (measured after every item is in): on the phone the tabs are a bottom bar, so the menu opens above the tab when there is no room below
  const r = btn.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let top = r.bottom + 4; if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  m.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.left)) + 'px'; m.style.top = top + 'px'; m.style.visibility = '';
}
{
  const tab = document.querySelector('nav.tabs button[data-view="editor"]');
  if (tab) {
    // v1.1.9: a real Android long-press starts selecting the word and sends pointercancel before our timer ends,
    // so the label is unselectable (CSS + selectstart) and a cancel after a long-enough hold counts as the long-press
    let lp = null, fired = false, t0 = 0, sx = 0, sy = 0;
    const stop = () => { clearTimeout(lp); lp = null; };
    const fire = () => {
      stop(); if (fired) return; fired = true;
      try { navigator.vibrate && navigator.vibrate(15); } catch (er) {}
      try { getSelection().removeAllRanges(); } catch (er) {}
      showTabCtx(tab);
    };
    tab.addEventListener('contextmenu', e => { e.preventDefault(); if (lp) fire(); else if (!fired) showTabCtx(tab); });
    tab.addEventListener('selectstart', e => e.preventDefault());
    tab.addEventListener('pointerdown', e => { fired = false; stop(); if (e.pointerType === 'mouse') return; t0 = Date.now(); sx = e.clientX; sy = e.clientY; lp = setTimeout(fire, 450); });
    tab.addEventListener('pointermove', e => { if (lp && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 12) stop(); });
    tab.addEventListener('pointercancel', () => { if (lp && Date.now() - t0 >= 300) fire(); else stop(); });
    ['pointerup', 'pointerleave'].forEach(t => tab.addEventListener(t, stop));
    tab.addEventListener('click', e => { if (fired) { fired = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  }
  document.addEventListener('pointerdown', e => { if (tabCtxEl && !e.target.closest('.tab-ctx')) closeTabCtx(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTabCtx(); });
}


/* ---------- chapter notes and the plot (PC: left of the writing column; phone: tabs under the text box) ---------- */
const sideTabs = $('#sideTabs'), sidePanel = $('#sidePanel'), memoEd = $('#memoEd'), plotView = $('#plotView');
S.side = IS_ANDROID ? null : lsGet('ss.side', null);
if (IS_ANDROID) { const pw = $('.paper-wrap'); pw.appendChild(sideTabs); pw.appendChild(sidePanel); }
try { document.execCommand('defaultParagraphSeparator', false, 'div'); } catch (e) {}
const memo = { key: null, dirty: false, t: null };
const imgCache = new Map();
const setSpNote = t => { $('#spNote').textContent = t; };
const dateLabel = ms => { const d = new Date(ms); return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${pad(d.getMinutes())}`; };
function layoutSide() {
  const on = S.view === 'editor' && !$('#edBody').hidden && !PM.on;
  sideTabs.hidden = !on; sidePanel.hidden = !on || !S.side;
  if (!on || IS_ANDROID) return;
  const head = $('.ed-head').getBoundingClientRect(), stat = $('.ed-status').getBoundingClientRect(), col = $('main.wrap').getBoundingClientRect();
  sideTabs.style.top = (head.top + 30) + 'px';
  if (!S.side) return;
  // fits in the empty space left of the writing column; in a narrow window it lies over the text instead
  const room = col.left + 16 - 34 - 22;
  sidePanel.classList.toggle('over', room < 240);
  Object.assign(sidePanel.style, { top: head.top + 'px', height: Math.max(200, stat.bottom - head.top) + 'px', width: (room < 240 ? Math.min(360, innerWidth - 60) : Math.min(440, room)) + 'px' });
}
async function sideRender() {
  layoutSide();
  sideTabs.querySelectorAll('[data-side]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.side === S.side)));
  const ci = chapterInfo(); if (!S.side || !ci || ci.idx < 0) return;
  const isMemo = S.side === 'memo';
  memoEd.hidden = !isMemo; plotView.hidden = isMemo; $('#spPick').hidden = !isMemo || !api.listImages;
  if (isMemo) {
    $('#spTitle').innerHTML = `<b>${esc(ci.chs[ci.idx].title)}</b> のメモ`;
    $('#spFoot').textContent = api.saveImage ? '自由に書けます・自動で保存　画像は Ctrl+V でも貼れます' : '自由に書けます・自動で保存';
    if (!memo.dirty) setSpNote('');
    await memoLoad();
  } else {
    $('#spTitle').innerHTML = `<b>${esc(ci.w.title)}</b> のプロット`; setSpNote('見るだけ');
    await plotLoad(ci.w);
  }
}
sideTabs.querySelectorAll('[data-side]').forEach(b => {
  b.addEventListener('mousedown', e => e.preventDefault());
  b.addEventListener('click', () => {
    S.side = S.side === b.dataset.side ? null : b.dataset.side; if (!IS_ANDROID) lsSet('ss.side', S.side);
    if (S.side !== 'memo') { memoSave(); closePicker(); }
    if (IS_ANDROID && S.side) edText.blur();   // the keyboard and the notes never share the screen on a phone
    sideRender();
  });
});
$('#spClose').addEventListener('click', () => { S.side = null; memoSave(); sideRender(); });
// phone: going back to the text closes the notes; writing a note opens it over the whole text box
const backToText = () => { if (IS_ANDROID && S.side) { S.side = null; memoSave(); closePicker(); sideRender(); } };
edText.addEventListener('focus', backToText); edText.addEventListener('pointerdown', backToText);
memoEd.addEventListener('focus', () => sidePanel.classList.add('typing'));
memoEd.addEventListener('blur', () => { sidePanel.classList.remove('typing'); memoSave(); });

// A note is plain text; a line "![](path)" is a picture from the work folder. On screen each line is a <div>.
function memoLine(text) { const d = document.createElement('div'); if (text) d.textContent = text; else d.appendChild(document.createElement('br')); return d; }
function loadImg(wid, rel) { const k = wid + '/' + rel; if (!imgCache.has(k)) imgCache.set(k, api.readImage(wid, rel).catch(e => { imgCache.delete(k); throw e; })); return imgCache.get(k); }
function memoImgEl(rel) {
  const box = document.createElement('div'); box.className = 'mimg'; box.contentEditable = 'false'; box.dataset.src = rel;
  if (api.readImage) {
    box.innerHTML = '<img alt=""><button class="mx" type="button" title="この画像をメモから外す（ファイルは消えません）" aria-label="画像を外す">×</button>';
    const img = box.querySelector('img'); img.title = rel + '　ダブルクリックで画像ソフトで開きます';
    loadImg(S.curWork, rel).then(u => { img.src = u; }).catch(() => { box.classList.add('missing'); img.remove(); box.insertAdjacentHTML('afterbegin', `<span class="ph">画像が見つかりません：${esc(rel)}</span>`); });
  } else box.innerHTML = `<span class="ph">画像：${esc(rel.split('/').pop())}（PCで見られます）</span>`;
  return box;
}
function memoRender(text) {
  memoEd.textContent = '';
  for (const l of String(text || '').split('\n')) { const m = l.match(/^!\[[^\]]*\]\((.+)\)$/); memoEd.appendChild(m ? memoImgEl(m[1]) : memoLine(l)); }
  if (!memoEd.lastChild || memoEd.lastChild.classList.contains('mimg')) memoEd.appendChild(memoLine(''));
}
function memoText() {
  const lines = []; let buf = null;
  const flush = () => { if (buf !== null) { lines.push(buf); buf = null; } };
  const inline = el => { let s = ''; const kids = [...el.childNodes]; kids.forEach((n, i) => { if (n.nodeType === 3) s += n.data; else if (n.nodeName === 'BR') { if (i < kids.length - 1) s += '\n'; } else if (n.classList && n.classList.contains('mimg')) s += '\n![](' + n.dataset.src + ')\n'; else s += inline(n); }); return s; };
  for (const n of memoEd.childNodes) {
    if (n.nodeType === 3) { buf = (buf ?? '') + n.data; continue; }
    if (n.nodeName === 'BR') { lines.push(buf ?? ''); buf = null; continue; }
    if (n.classList && n.classList.contains('mimg')) { flush(); lines.push('![](' + n.dataset.src + ')'); continue; }
    if (n.nodeName === 'DIV' || n.nodeName === 'P') { flush(); lines.push(inline(n)); continue; }
    buf = (buf ?? '') + inline(n);
  }
  flush();
  return lines.join('\n').replace(/\u00a0/g, ' ').replace(/\s+$/, '');
}
async function memoLoad() {
  const key = S.curWork && S.curCh ? S.curWork + '/' + S.curCh : null;
  if (memo.key === key) return;
  await memoSave();
  memo.key = key; memo.dirty = false; memoEd.textContent = '';
  if (!key) return;
  try { const r = await api.readMemo(S.curWork, S.curCh); if (memo.key === key) memoRender(r.text); }
  catch (e) { if (memo.key === key) memoRender(''); }
}
function memoSave() {
  clearTimeout(memo.t);
  if (!memo.dirty || !memo.key) return chains.get('memo') || Promise.resolve();
  const i = memo.key.indexOf('/'); const wid = memo.key.slice(0, i), cid = memo.key.slice(i + 1);
  const text = memoText(); memo.dirty = false; setSpNote('保存中…');
  return serial('memo', () => api.writeMemo(wid, cid, text)).then(() => { if (!memo.dirty && S.side === 'memo') setSpNote('保存済み'); })
    .catch(() => { memo.dirty = true; setSpNote('保存できませんでした'); memo.t = setTimeout(memoSave, 5000); });
}
memoEd.addEventListener('input', () => {
  if (!memo.key) return;
  if (!memoEd.firstChild) memoEd.appendChild(memoLine(''));
  memo.dirty = true; setSpNote('未保存'); clearTimeout(memo.t); memo.t = setTimeout(memoSave, 900);
});
memoEd.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); memoSave(); } });
memoEd.addEventListener('click', e => { const x = e.target.closest('.mx'); if (!x) return; e.preventDefault(); x.closest('.mimg').remove(); memo.dirty = true; memoSave(); });
memoEd.addEventListener('dblclick', e => {
  const box = e.target.closest('.mimg'); if (!box || !api.openImage || box.classList.contains('missing')) return;
  api.openImage(S.curWork, box.dataset.src).catch(() => toast('画像を開けませんでした'));
});
const blobB64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
memoEd.addEventListener('paste', async e => {
  const items = [...((e.clipboardData && e.clipboardData.items) || [])];
  const it = items.find(i => i.kind === 'file' && /^image\//.test(i.type));
  if (it) {
    e.preventDefault();
    if (!api.saveImage) { toast('画像はPC版で貼り付けられます'); return; }
    const f = it.getAsFile(); const ext = ((f.type.split('/')[1] || 'png').replace('jpeg', 'jpg'));
    try { const rel = await api.saveImage(S.curWork, await blobB64(f), ext); memoInsertImage(rel); toast('作品フォルダに「' + rel + '」として保存しました'); }
    catch (err) { fileErr(err, '画像を保存できませんでした'); }
    return;
  }
  const text = e.clipboardData && e.clipboardData.getData('text/plain');
  if (text) { e.preventDefault(); document.execCommand('insertText', false, text); }
});
let memoRange = null;
document.addEventListener('selectionchange', () => { const sel = getSelection(); if (sel.rangeCount && memoEd.contains(sel.anchorNode)) memoRange = sel.getRangeAt(0).cloneRange(); });
// a picture goes on its own line, below the line the caret was on
function memoInsertImage(rel) {
  let block = null;
  if (memoRange && memoEd.contains(memoRange.startContainer)) {
    block = memoRange.startContainer === memoEd ? memoEd.childNodes[Math.max(0, memoRange.startOffset - 1)] : memoRange.startContainer;
    while (block && block.parentNode !== memoEd) block = block.parentNode;
  }
  const el = memoImgEl(rel), after = memoLine('');
  if (block) block.after(el); else memoEd.appendChild(el);
  el.after(after);
  memoEd.focus();
  const r = document.createRange(); r.setStart(after, 0); r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  memo.dirty = true; memoSave();
}
// 資料呼び出し: pictures in the work folder and its sub-folders (shown in place, never copied)
$('#spPick').addEventListener('mousedown', e => e.preventDefault());
$('#spPick').addEventListener('click', openPicker);
function closePicker() { const p = $('#imgPop'); if (p) p.remove(); }
document.addEventListener('mousedown', e => { const p = $('#imgPop'); if (p && !p.contains(e.target) && !e.target.closest('#spPick')) closePicker(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePicker(); });
async function openPicker() {
  if ($('#imgPop')) { closePicker(); return; }
  const wid = S.curWork; if (!wid || !api.listImages) return;
  const pop = document.createElement('div'); pop.className = 'img-pop'; pop.id = 'imgPop';
  pop.innerHTML = '<p class="muted small" style="margin:4px">画像を探しています…</p>'; document.body.appendChild(pop);
  const b = $('#spPick').getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(b.left, innerWidth - 348)) + 'px'; pop.style.top = (b.bottom + 6) + 'px';
  let list = []; try { list = await api.listImages(wid); } catch (e) {}
  if (!document.body.contains(pop)) return;
  const groups = new Map(); for (const it of list) { const g = it.folder || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); }
  pop.innerHTML = (list.length ? [...groups].map(([g, items]) => `<div class="grp">${g ? esc(g) + ' ›' : '作品フォルダ'}</div><div class="grid">${items.map(it => `<button type="button" class="th" data-rel="${esc(it.rel)}" title="${esc(it.rel)}"><span>${esc(it.name)}</span></button>`).join('')}</div>`).join('')
    : '<p class="muted small" style="margin:4px 2px 10px">作品フォルダに画像がありません。地図などの画像を作品フォルダ（その中のフォルダでもかまいません）に入れると、ここに並びます。</p>')
    + `<p class="note" style="margin:0 0 8px">画像はコピーせず、作品フォルダのものをそのまま表示します。</p><div class="row"><button type="button" class="btn sm ghost" id="ipFolder">フォルダを開く</button><span class="spacer"></span><button type="button" class="btn sm gold" id="ipGo" disabled>入れる</button></div>`;
  let pick = null;
  const go = () => { if (!pick) return; closePicker(); memoInsertImage(pick); };
  pop.querySelectorAll('.th').forEach(t => {
    loadImg(wid, t.dataset.rel).then(u => { t.style.backgroundImage = `url("${u}")`; }).catch(() => t.classList.add('bad'));
    t.addEventListener('click', () => { pop.querySelectorAll('.th').forEach(x => x.classList.toggle('on', x === t)); pick = t.dataset.rel; $('#ipGo').disabled = false; });
    t.addEventListener('dblclick', () => { pick = t.dataset.rel; go(); });
  });
  $('#ipGo').onclick = go; $('#ipFolder').onclick = () => api.openFolder(wid);
}
// the plot, shown read-only
function plotHTML(text) { let hn = 0; return String(text || '').replace(/\r/g, '').split('\n').map(l => { const h = l.match(/^(#{1,6})\s+(.+)/); return h ? `<h4 class="pv-h${h[1].length}" data-hi="${hn++}">${esc(h[2])}</h4>` : esc(l) + '\n'; }).join('').replace(/\n(<h4)/g, '$1'); }
async function getPlot(wid) {
  const st = P().settings;
  const info = await api.plotInfo(wid, { clean: !!st.plotClean, folder: st.plotFolder });
  if (info && info.cleaned) { toast(`新しいプロットに切り替えて、古い版を${info.cleaned}つごみ箱に入れました`); refreshWorks(); }
  return info;
}
async function plotLoad(w) {
  if (!w.plot) {
    plotView.innerHTML = `<p class="muted" style="margin-top:0">この作品にはまだプロットがありません。</p>` + (api.plotCandidates ? '<p class="muted small">作品ページの「プロット」で、作品フォルダの中のファイルを選べます。</p><button class="btn sm" id="pvGo">作品ページへ</button>' : '<p class="muted small">プロットはPC版の作品ページで選べます。引き継ぎファイルで一緒に届きます。</p>');
    $('#spFoot').textContent = ''; const g = $('#pvGo'); if (g) g.onclick = async () => { await saveChapter(); openWork(w.id); };
    return;
  }
  let info = null; try { info = await getPlot(w.id); } catch (e) {}
  const ci = chapterInfo(); if (S.side !== 'plot' || !ci || ci.w.id !== w.id) return;
  if (!info || info.missing) { plotView.innerHTML = '<p class="muted" style="margin-top:0">プロットのファイルが見つかりません。作品ページで選び直してください。</p>'; $('#spFoot').textContent = ''; return; }
  plotView.innerHTML = plotHTML(info.text);
  // jump to a heading (the list follows the plot's own heading levels)
  const hs = [...String(info.text || '').replace(/\r/g, '').matchAll(/^(#{1,6})\s+(.+)$/gm)];
  if (hs.length > 1) {
    const bar = document.createElement('div'); bar.className = 'pv-jump';
    const minL = Math.min(...hs.map(h => h[1].length));
    bar.innerHTML = `<select aria-label="見出しへ移動"><option value="">見出しへ移動…</option>${hs.map((h, i) => `<option value="${i}">${'　'.repeat(h[1].length - minL)}${esc(h[2].slice(0, 40))}</option>`).join('')}</select>`;
    plotView.prepend(bar);
    const sel = bar.querySelector('select');
    sel.addEventListener('change', () => {
      const el = plotView.querySelector(`[data-hi="${sel.value}"]`);
      if (el) plotView.scrollTop = el.offsetTop - bar.offsetHeight - 6;
      sel.value = '';
    });
  }
  $('#spFoot').innerHTML = `<span class="pf-name">${esc(info.file.split('/').pop())}</span><span class="spacer"></span><span>${info.fromPc ? 'PCから引き継いだ版' : dateLabel(info.mtime) + 'に保存'}</span>`;
}

api.onFocus(async () => {
  await refreshWorks();
  if (S.view !== 'editor') return;
  const ci = chapterInfo();
  if (!ci || ci.idx < 0) { renderEditor(); return; }
  const ch = ci.chs[ci.idx];
  if (!dirty && loaded.key === ci.w.id + '/' + ch.id && Math.abs(ch.mtime - loaded.mtime) > 1) {
    try { const r = await api.readChapter(ci.w.id, ch.id); edText.value = r.text; loaded.mtime = r.mtime; baseLen = countChars(r.text); setCount(); toast('ファイルが外で更新されていたので読み込み直しました'); } catch (e) {}
  }
  renderEditor();
});
api.onBeforeClose(async () => {
  if (PM.on && PM.dirty) {
    if (api.closeHold) api.closeHold();
    const r = await choiceDlg('保存していない変更があります', 'プロットの変更がまだ保存されていません。', [['save', '保存して閉じる', 'gold'], ['drop', '保存せずに閉じる', 'danger'], ['cancel', 'やめる', 'ghost']]);
    if (r === 'cancel') return;
    if (r === 'save' && !await pmSave()) return;
    if (r === 'drop') lsSet(pmDraftKey(PM.wid), null);
  }
  try { zoneEnd(); await saveChapter(); await memoSave(); await saveProgress(true); } catch (e) {} api.closeReady(); });


/* ---------- caret sparkles ---------- */
// Measure the caret with a hidden mirror of the textarea, then burst particles on a canvas laid over it.
const fxCanvas = $('#fxCanvas'), fxCtx = fxCanvas.getContext('2d');
const mirror = document.createElement('div'); mirror.setAttribute('aria-hidden', 'true'); document.body.appendChild(mirror);
const MIRROR_PROPS = ['boxSizing', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textIndent', 'letterSpacing', 'wordSpacing', 'tabSize', 'fontFeatureSettings', 'fontKerning'];
function caretPoint() {
  const cs = getComputedStyle(edText); const st = mirror.style;
  for (const p of MIRROR_PROPS) st[p] = cs[p];
  st.position = 'absolute'; st.visibility = 'hidden'; st.left = '-99999px'; st.top = '0'; st.whiteSpace = 'pre-wrap'; st.overflowWrap = 'break-word'; st.wordBreak = cs.wordBreak; st.overflow = 'hidden'; st.height = 'auto'; st.borderStyle = 'solid';
  const bl = parseFloat(cs.borderLeftWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
  st.width = (edText.clientWidth + bl + br) + 'px';
  const pos = edText.selectionEnd;
  mirror.textContent = edText.value.slice(0, pos);
  const mark = document.createElement('span'); mark.textContent = '​'; mirror.appendChild(mark);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.9;
  return { x: mark.offsetLeft + bl - edText.scrollLeft, y: mark.offsetTop + bt - edText.scrollTop + lh * 0.55 };
}
function fitFx() {
  const dpr = window.devicePixelRatio || 1; const w = edText.offsetWidth, h = edText.offsetHeight;
  if (fxCanvas.width !== Math.round(w * dpr) || fxCanvas.height !== Math.round(h * dpr)) {
    fxCanvas.width = Math.round(w * dpr); fxCanvas.height = Math.round(h * dpr); fxCanvas.style.width = w + 'px'; fxCanvas.style.height = h + 'px';
  }
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(fitFx).observe(edText);
const sparks = []; let fxRunning = false, sparkQueued = null;
const HEAL = ['#8fd19a', '#c9f5d1'];
function queueSpark(kind) {
  if (!P() || !P().settings.fx || reduceMotion) return;
  if (sparkQueued) { if (kind === 'heal') sparkQueued = 'heal'; return; }
  sparkQueued = kind;
  requestAnimationFrame(() => { const k = sparkQueued; sparkQueued = null; try { const c = caretPoint(); burst(c.x, c.y, k); } catch (e) {} });
}
// Small and sparse: a few motes drift up and to the right of the caret, where no text is yet.
// In the zone they turn multicoloured and a little livelier.
function burst(x, y, kind) {
  if (y < -10 || y > edText.clientHeight + 10) return;
  const own = (SPARKS.find(s => s.id === P().equipped.spark) || SPARKS[0]).c;
  const inZone = ZONE.active;
  const pal = kind === 'heal' ? HEAL : inZone ? [...ZONE_PAL, own] : [own];
  const n = kind === 'heal' ? 3 : inZone ? 5 : 3;
  const ox = x + 5, oy = y - 4;
  for (let i = 0; i < n; i++) {
    const a = kind === 'heal' ? -Math.PI / 2 + (Math.random() - 0.5) * 0.9 : -Math.PI / 3 + (Math.random() - 0.5) * 1.3;
    const sp = 0.35 + Math.random() * (inZone ? 1.2 : 0.8);
    sparks.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 18 + Math.random() * (inZone ? 18 : 12),
      size: 0.8 + Math.random() * (inZone ? 1.3 : 0.9), color: pal[(Math.random() * pal.length) | 0], star: inZone && Math.random() < 0.4, spin: Math.random() * Math.PI, kind });
  }
  if (inZone && kind === 'magic' && Math.random() < 0.12) sparks.push({ ring: true, x: ox, y: oy, life: 0, max: 20, color: pal[(Math.random() * pal.length) | 0] });
  if (!fxRunning) { fxRunning = true; fitFx(); requestAnimationFrame(fxStep); }
}
function drawStar(c, x, y, r, rot) {
  c.beginPath();
  for (let i = 0; i < 8; i++) { const ang = rot + i * Math.PI / 4; const rr = i % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); }
  c.closePath(); c.fill();
}
function fxStep() {
  const c = fxCtx; c.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  c.globalCompositeOperation = 'lighter';
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i]; p.life++;
    const t = p.life / p.max; if (t >= 1) { sparks.splice(i, 1); continue; }
    const alpha = 1 - t;
    if (p.ring) {
      c.globalAlpha = alpha * 0.45; c.strokeStyle = p.color; c.lineWidth = 1;
      c.beginPath(); c.arc(p.x, p.y, 2 + t * 11, 0, Math.PI * 2); c.stroke();
      continue;
    }
    p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy = p.vy * 0.95 - 0.01; p.spin += 0.1;
    const r = p.size * (1 - t * 0.4);
    c.globalAlpha = alpha * 0.18; c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, r * 2, 0, Math.PI * 2); c.fill();
    c.globalAlpha = alpha * 0.85; c.fillStyle = p.color;
    if (p.star) drawStar(c, p.x, p.y, r * 2.2, p.spin); else { c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  if (sparks.length) requestAnimationFrame(fxStep); else { fxRunning = false; c.clearRect(0, 0, fxCanvas.width, fxCanvas.height); }
}
edText.addEventListener('scroll', () => { if (!sparks.length) return; sparks.length = 0; });

/* ---------- shop ---------- */
function renderShop() {
  const p = P(); const cat = S.shopCat;
  document.querySelectorAll('#shopSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === cat));
  const list = catalog(cat);
  const owned = p.owned[cat];
  $('#shopHint').textContent = { cover: '買った装丁は、書斎の作品ページで背表紙を' + (IS_ANDROID ? '長押し' : 'クリック') + 'すると選べます。', slime: '選んだ討伐対象が毎日あらわれます。設定で「持っているものから毎日ランダム」にもできます。', bgm: '「▶ 試聴」で20秒ほど聞けます。買った曲を選んで、上の「♪ BGM」で再生します。', spark: '打つたびに散る火花の色です。ゾーンに入ると、選んだ色にほかの色が混ざって華やかになります。', script: '本棚をシェアするときに、題を伏せる字です。作品ページの「本棚シェア」で、作品ごとに選べます。異世界文字は初めから使えます。' }[cat];
  let grp = null;
  $('#goods').innerHTML = list.map(it => {
    const head = it.grp && it.grp !== grp && GROUPS[it.grp] ? `<div class="grp-h"><h3>${GROUPS[it.grp][0]}</h3><span class="muted small">${GROUPS[it.grp][1]}</span></div>` : ''; grp = it.grp;
    const own = owned.includes(it.id); const on = cat === 'cover' ? false : p.equipped[cat] === it.id;
    let pv = '';
    if (cat === 'cover') pv = spineHTML(it.id, it.name, 34, 88);
    else if (cat === 'slime') pv = `<canvas width="96" height="72" data-sl="${it.id}"${isMonster(it.id) ? ' class="mon"' : ''}></canvas>`;
    else if (cat === 'script') pv = scriptSample(it.id);
    else if (cat === 'spark') pv = `<div class="spark-pv">${[3, 5, 2, 4, 3].map((s, i) => `<i style="width:${s * 2}px;height:${s * 2}px;background:${it.c};box-shadow:0 0 ${s * 3}px ${it.c};opacity:${0.55 + i % 2 * 0.4}"></i>`).join('')}</div>`;
    else pv = `<div class="wave">${Array.from({ length: 12 }, (_, i) => `<i style="height:${it.id === 'none' ? 4 : 8 + Math.round(Math.abs(Math.sin((i + 1) * (it.id.length + 1))) * 28)}px;animation-delay:${-(i * 0.37 % 1).toFixed(2)}s"></i>`).join('')}</div>`
      + (it.id === 'none' ? '' : `<button class="pv-play" data-pv="${it.id}" aria-pressed="${PV.id === it.id}">${PV.id === it.id ? '■ 止める' : '▶ 試聴'}</button>`);
    const act = !own ? `<button class="btn sm gold" data-buy="${it.id}" ${p.coins < it.price ? 'disabled' : ''}><span class="coin"></span> ${fmt(it.price)}で買う</button>`
      : cat === 'cover' || cat === 'script' ? `<span class="muted small">所持</span>`
        : on ? `<span class="small" style="color:var(--gold)">使用中</span>` : `<button class="btn sm" data-eq="${it.id}">使う</button>`;
    return head + `<div class="good ${on ? 'on' : ''}"><div class="pv${cat === 'bgm' ? ' bgm' : ''}${cat === 'bgm' && PV.id === it.id ? ' playing' : ''}">${pv}</div><div class="nm">${esc(it.name)}</div>${it.desc ? `<div class="muted small">${esc(it.desc)}</div>` : ''}<div class="pr">${own ? '' : `<span class="coin"></span>${fmt(it.price)}`}</div>${act}</div>`;
  }).join('');
  fakeTitles($('#goods'));
  $('#goods').querySelectorAll('canvas[data-sl]').forEach(cv => { const v = new SlimeView(cv, { static: true }); v.color = cv.dataset.sl; v.draw(1200); });
  $('#goods').querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buy(cat, b.dataset.buy)));
  $('#goods').querySelectorAll('[data-eq]').forEach(b => b.addEventListener('click', () => equip(cat, b.dataset.eq)));
  $('#goods').querySelectorAll('[data-pv]').forEach(b => b.addEventListener('click', () => PV.id === b.dataset.pv ? PV.stop() : PV.start(b.dataset.pv)));
}
document.querySelectorAll('#shopSeg button').forEach(b => b.addEventListener('click', () => { S.shopCat = b.dataset.cat; renderShop(); }));
function buy(cat, id) {
  const p = P(); const list = catalog(cat); const it = list.find(x => x.id === id);
  if (!it || p.coins < it.price || p.owned[cat].includes(id)) return;
  p.coins -= it.price; p.owned[cat] = [...p.owned[cat], id]; saveProgress(true);
  renderHeader(); renderShop(); toast(it.name + 'を手に入れました');
}
function equip(cat, id) {
  P().equipped[cat] = id; saveProgress(true);
  if (cat === 'bgm') { if (PV.id) PV.stop(true); else if (BGM.on) BGM.play(id); }   // 試聴中なら止めて、BGM が鳴っていたら新しい曲へ
  renderShop(); renderHP();
}

/* ---------- settings ---------- */
function renderSettings() {
  if (api.version && !S.ver) api.version().then(v => { S.ver = v; $('#sVer').textContent = '蛇喰鷲書房 ' + v.platform + '　バージョン ' + v.version; }).catch(() => {});
  else if (S.ver) $('#sVer').textContent = '蛇喰鷲書房 ' + S.ver.platform + '　バージョン ' + S.ver.version;
  if (!api.relocatePick) $('#sMove').hidden = true;
  if (IS_ANDROID) { $('#sTrashPanel').hidden = false; renderTrash(); }
  $('#sScene').value = P().settings.scene;
  $('#sFx').checked = !!P().settings.fx;
  $('#sChDate').checked = !!P().settings.chDate;
  $('#sCountWs').checked = !!P().settings.countWs;
  const p = P(); $('#sRoot').textContent = S.root; $('#sGoal').value = p.goal; $('#sDay').value = String(p.dayStart);
  $('#sFont').value = p.settings.font; $('#sSize').value = p.settings.size; $('#sLh').value = p.settings.lh || 1.95; $('#sVol').value = p.settings.vol; renderPreview();
  const radio = (name, v) => document.querySelectorAll(`input[name=${name}]`).forEach(r => { r.checked = r.value === v; });
  radio('sFoe', p.settings.foeRandom ? 'random' : 'pick');
  if (!api.plotCandidates) $('#sPlotPanel').hidden = true;
  radio('sPlotDef', p.settings.plotDefault === 'fixed' ? 'fixed' : 'auto'); radio('sPlotFolder', p.settings.plotFolder === 'file' ? 'file' : 'folder');
  $('#sPlotClean').checked = !!p.settings.plotClean;
  radio('sPmView', p.settings.pmView === 'raw' ? 'raw' : 'wysi'); radio('sPmTag', p.settings.pmTag === 'chip' ? 'chip' : 'plain');
  $('#sPmSize').value = pmSize(); $('#sPmSizeV').textContent = pmSize() + 'px';
}
$('#sPmSize').addEventListener('input', e => { P().settings.pmSize = Number(e.target.value); $('#sPmSizeV').textContent = e.target.value + 'px'; saveProgress(); if (PM.on) pmSurface(); });
document.querySelectorAll('input[name=sFoe]').forEach(r => r.addEventListener('change', () => { if (!r.checked) return; P().settings.foeRandom = r.value === 'random'; P().foeOf = null; saveProgress(true); renderHP(); }));
document.querySelectorAll('input[name=sPlotDef]').forEach(r => r.addEventListener('change', () => { if (r.checked) { P().settings.plotDefault = r.value; saveProgress(); } }));
document.querySelectorAll('input[name=sPlotFolder]').forEach(r => r.addEventListener('change', () => { if (r.checked) { P().settings.plotFolder = r.value; saveProgress(); } }));
$('#sPlotClean').addEventListener('change', e => { P().settings.plotClean = e.target.checked; saveProgress(); });
document.querySelectorAll('input[name=sPmView]').forEach(r => r.addEventListener('change', () => { if (r.checked) { P().settings.pmView = r.value; saveProgress(); pmSwitchSurface(); } }));
document.querySelectorAll('input[name=sPmTag]').forEach(r => r.addEventListener('change', () => { if (r.checked) { P().settings.pmTag = r.value; saveProgress(); if (PM.on && PM.wy && loaded.key) { const md = wySerialize(); wyRender(wyParse(md)); } } }));
$('#sGoal').addEventListener('change', e => { let v = Math.round(Number(e.target.value) / 100) * 100; v = Math.min(50000, Math.max(100, v || 1000)); e.target.value = v; P().goal = v; saveProgress(true); renderHP(); maybeKill(); toast('目標を' + fmt(v) + '字にしました'); });
$('#sDay').addEventListener('change', e => { P().dayStart = Number(e.target.value); saveProgress(true); renderHP(); });
$('#sFont').addEventListener('change', e => { P().settings.font = e.target.value; saveProgress(); applySettings(); });
$('#sScene').addEventListener('change', e => { P().settings.scene = e.target.value || '　＊　＊　＊'; e.target.value = P().settings.scene; saveProgress(); });
$('#sFx').addEventListener('change', e => { P().settings.fx = e.target.checked; saveProgress(); });
$('#sChDate').addEventListener('change', e => { P().settings.chDate = e.target.checked; saveProgress(); });
// switching the way of counting: the jump in the count is neither damage nor healing (baseLen is reset)
$('#sCountWs').addEventListener('change', async e => {
  P().settings.countWs = e.target.checked; saveProgress(true);
  await syncCountMode();
  if (loaded.key && !PM.on) baseLen = countChars(edText.value);
  setCount(); await refreshWorks();
  toast(e.target.checked ? '空白と改行も字数に数えます' : '空白と改行は字数に数えません');
});
$('#sSize').addEventListener('input', e => { P().settings.size = Number(e.target.value); saveProgress(); applySettings(); });
$('#sLh').addEventListener('input', e => { P().settings.lh = Math.round(Number(e.target.value) * 100) / 100; saveProgress(); applySettings(); if (SR.layer) srRefreshSoon(); });
$('#sVol').addEventListener('input', e => { P().settings.vol = Number(e.target.value); BGM.setVol(P().settings.vol); saveProgress(); });
$('#sRootOpen').addEventListener('click', () => api.openFolder(null));
// v1.1.16: BGM を値下げした分を、前の値段で買っていた人に一度だけ返す。
// コインは「稼いだ分 − 今の値段で数えた買い物」で数え直せる作りなので、返したあとも数え直しとずれない。
function bgmPriceFix(p) {
  if (!p || p.bgm116) return 0;
  const refund = (p.owned.bgm || []).reduce((a, id) => a + Math.max(0, (BGM_OLD_PRICE[id] || 0) - priceOf('bgm', id)), 0);
  p.bgm116 = true; p.coins = (p.coins || 0) + refund;
  return refund;
}
async function afterProgressLoad() {
  const rf = bgmPriceFix(S.progress); await saveProgress(true);
  if (rf) { renderHeader(); toast('BGMの値下げに合わせて、差額の ' + fmt(rf) + ' コインを返しました'); }
}
function priceOf(cat, id) { const list = catalog(cat); const it = list.find(x => x.id === id); return it ? it.price : ((RETIRED[cat] || {})[id] || 0); }
// Coins only come from kills and only go to purchases, so after merging both sides they can be recomputed exactly.
function mergeProgress(local, incoming) {
  const m = withDefaults(JSON.parse(JSON.stringify(local))); const o = withDefaults(incoming);
  adoptLegacy(m); adoptLegacy(o);
  // the same device's ledger can only have grown, so keep the larger value per day; different devices add up
  for (const [id, L] of Object.entries(o.dev)) {
    const a = m.dev[id] || (m.dev[id] = { daily: {}, total: 0 });
    for (const [d, v] of Object.entries(L.daily || {})) a.daily[d] = Math.max(a.daily[d] || 0, v || 0);
    a.total = Math.max(a.total || 0, L.total || 0);
  }
  sumLedgers(m);
  for (const [d, v] of Object.entries(o.kills)) if (!m.kills[d]) m.kills[d] = v;
  for (const cat of CATS) m.owned[cat] = [...new Set([...(m.owned[cat] || []), ...(o.owned[cat] || [])])];
  m.zone = { count: Math.max(m.zone.count, o.zone.count), longest: Math.max(m.zone.longest, o.zone.longest), total: Math.max(m.zone.total, o.zone.total) };
  for (const [d, v] of Object.entries(o.zoneDaily)) { const a = m.zoneDaily[d] || { n: 0, ms: 0 }; m.zoneDaily[d] = { n: Math.max(a.n, v.n || 0), ms: Math.max(a.ms, v.ms || 0) }; }
  m.totalWritten = Math.max(m.totalWritten, o.totalWritten);
  for (const key of ['loginRewards', 'levelRewards']) for (const [x, v] of Object.entries(o[key])) if (!m[key][x]) m[key][x] = v;
  if ((o.login.last || '') > (m.login.last || '')) m.login = { ...o.login };
  const sum = obj => Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);
  const earned = sum(m.kills) + sum(m.loginRewards) + sum(m.levelRewards);
  const spent = CATS.reduce((a, cat) => a + m.owned[cat].reduce((s, id) => s + priceOf(cat, id), 0), 0);
  m.coins = Math.max(0, earned - spent);
  return m;
}
// ---- iPhone (web) only: a reminder on the bookshelf to save a backup into the Files app ----
// shown when something was written since the last backup and 7 days have passed (or never backed up);
// 「あとで」 hides it for a day. The last backup time lives in this device's storage.
const BK_KEY = 'ss.webBackup', BK_EVERY = 7 * 864e5, BK_LATER = 864e5;
const bkState = () => lsGet(BK_KEY, null) || {};
function bkMark() { lsSet(BK_KEY, { at: Date.now(), later: 0 }); renderBkNag(); }
function renderBkNag() {
  const el = $('#bkNag'); if (!el) return;
  const s = bkState(), now = Date.now();
  const chars = S.works.reduce((n, w) => n + (w.chars || 0), 0);
  const wrote = S.works.reduce((m, w) => Math.max(m, w.updatedAt || 0), 0);
  let msg = '';
  if (IS_WEB && chars > 0 && !(s.later && now < s.later)) {
    if (!s.at) msg = 'まだ一度もバックアップしていません。';
    else if (now - s.at >= BK_EVERY && wrote > s.at) msg = `前のバックアップから${Math.floor((now - s.at) / 864e5)}日たちました。`;
  }
  el.hidden = !msg; if (!msg) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="bk-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg></div>
  <div class="bk-t"><b>バックアップのお知らせ</b><span>${msg}iPhoneの「ファイル」に保存しておくと、書房のデータが消えてしまったときに戻せます。</span><span class="bk-how">「今すぐ保存」→ 共有メニューの「"ファイル"に保存」→「このiPhone内」</span></div>
  <div class="bk-b"><button type="button" class="btn ghost sm" id="bkLater">あとで</button><button type="button" class="btn gold sm" id="bkNow">今すぐ保存</button></div>`;
  $('#bkLater').onclick = () => { const st = bkState(); st.later = Date.now() + BK_LATER; lsSet(BK_KEY, st); renderBkNag(); };
  $('#bkNow').onclick = () => runBackup();
}
async function runBackup() {
  await saveChapter(); await memoSave(); await saveProgress(true);
  try {
    const r = await api.exportBundle();
    if (r) { if (IS_WEB) bkMark(); toast(IS_WEB ? `${r.works}作品・${r.chapters}章をバックアップしました` : `${r.works}作品・${r.chapters}章を書き出しました`); }
  } catch (e) { fileErr(e, '書き出せませんでした'); }
}
$('#bExport').addEventListener('click', async () => {
  return runBackup();
});
$('#bImport').addEventListener('click', async () => {
  await saveChapter(); await memoSave(); await saveProgress(true);
  try {
    const r = await api.importBundle(); if (!r) return;
    if (r.progress) { S.progress = mergeProgress(S.progress, r.progress); await saveProgress(true); }
    loaded.key = null; memo.key = null; await refreshWorks(); renderHeader(); renderHP(); renderSettings();
    openDlg(`<div class="dlg"><h3>読み込みました</h3><p style="margin:0;font-variant-numeric:tabular-nums">新しい作品 ${r.newWorks}　追加した章 ${r.added}<br>新しい方に更新した章 ${r.updated}　そのままの章 ${r.kept}${r.memos ? `<br>新しい方に更新したメモ ${r.memos}` : ''}${r.plots ? `<br>PCの版に差し替えたプロット ${r.plots}` : ''}${r.plotsKept ? `<br>スマホの方が新しいので残したプロット ${r.plotsKept}` : ''}${r.phonePlots ? `<br>スマホで直したプロット ${r.phonePlots}（新しい版として作品フォルダに入れました）` : ''}</p><div class="row"><span class="spacer"></span><button class="btn gold" data-close>閉じる</button></div></div>`);
  } catch (e) { toast(e.code === 'BAD_BUNDLE' || /引き継ぎ|読め/.test(e.message) ? '引き継ぎファイルとして読めませんでした' : '読み込めませんでした'); }
});
$('#sRootChange').addEventListener('click', async () => {
  await saveChapter(); await saveProgress(true);
  try {
    const r = await api.chooseRoot(); if (!r) return;
    S.root = r; const prog = await api.readProgress();
    if (prog) { S.progress = withDefaults(prog); adoptLegacy(S.progress); sumLedgers(S.progress); if (!S.progress.bgm116) await afterProgressLoad(); } else await saveProgress(true);
    S.curWork = S.curCh = null; loaded.key = null; S.openWork = null;
    await refreshWorks(); renderSettings(); renderHeader(); renderHP();
    toast(prog ? 'このフォルダの記録を読み込みました' : '保存先を変えました。コインや記録は引き継いでいます');
  } catch (e) { fileErr(e, '保存先を変えられませんでした'); }
});


/* ---------- phone: keyboard-aware height, back button, recently deleted ---------- */
if (IS_ANDROID) {
  const sub = document.querySelector('#lib-list .lib-head p'); if (sub) sub.textContent = IS_WEB ? '作品と章はこのiPhoneの中に保存されます。インターネットには送られません。ファイルとは取り込み・書き出しでやり取りします。' : '作品と章はこのスマホの中に保存されます。Driveとは取り込み・書き出しでやり取りします。';
  const scene = $('#edScene'); if (scene) scene.title = '場面転換を入れる';
}
if (IS_WEB) {
  // on the iPhone the hand-over file is the backup: keep it in iCloud Drive
  $('#bxHead').textContent = 'バックアップ（引き継ぎファイル）';
  $('#bxNote').textContent = '全作品とコイン・討伐記録を1つのファイルにまとめます。共有メニューの「"ファイル"に保存」で iCloud Drive に入れておけば、iPhoneを替えたときや中身が消えてしまったときに「読み込む」で戻せます。';
}
if (window.visualViewport) {
  const vv = window.visualViewport;
  // v1.1.13 (iPhone web): Safari lifts the whole page to show the caret while we also shrink the writing view to fit
  // above the keyboard, so the top went off-screen with a black gap below. In the writing view the page always fits
  // the visible area, so put it back at the top whenever the keyboard opens or Safari pans.
  const pin = () => { if (IS_WEB && document.body.classList.contains('mode-editor') && document.body.classList.contains('kb-open') && (window.scrollY || vv.offsetTop)) window.scrollTo(0, 0); };
  const upd = () => { document.documentElement.style.setProperty('--vvh', vv.height + 'px'); document.body.classList.toggle('kb-open', window.innerHeight - vv.height > 120 || (IS_ANDROID && screen.height - vv.height > screen.height * 0.3)); pin(); requestAnimationFrame(pin); };
  vv.addEventListener('resize', upd); vv.addEventListener('scroll', pin); upd();
  // v1.1.18: 開いた直後にキーボードが出て欄が縮んだら、もう一度一番下へ（キャレットが最後にあるときだけ）
  vv.addEventListener('resize', () => { if (!PM.on && performance.now() < endUntil && edText.selectionStart === edText.value.length) requestAnimationFrame(caretToEnd); });
  if (IS_WEB) document.addEventListener('focusin', e => { if (e.target === edText || (e.target.closest && e.target.closest('#pmEd'))) { setTimeout(pin, 60); setTimeout(pin, 350); } });
}
if (api.onBack) api.onBack(() => {
  if (dlg.open) { closeDlg(); return; }
  if (S.tidy) { S.tidy = false; S.picked.clear(); renderLibrary(); return; }
  if (S.view === 'library' && S.openWork) { S.openWork = null; renderLibrary(); return; }
  if (S.view === 'editor' && S.curWork) { saveChapter(); openWork(S.curWork); return; }
  if (S.view !== 'library') { setView('library'); return; }
  api.minimize && api.minimize();
});
async function renderTrash() {
  if (!api.listTrash) return;
  const ul = $('#sTrashList'); let items = [];
  try { items = await api.listTrash(); } catch (e) {}
  ul.innerHTML = items.length ? items.map(t => `<li><span class="t">${t.kind === 'work' ? '作品' : '章'}「${esc(t.name)}」${t.kind === 'chapter' ? `<span class="muted small">（${esc(t.work)}）</span>` : ''}<br><span class="muted small">${new Date(t.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}に消去</span></span><button class="btn sm" data-restore="${esc(t.id)}">元に戻す</button></li>`).join('')
    : '<li class="muted small">最近消したものはありません。</li>';
  ul.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', async () => {
    try { const r = await api.restoreTrash(b.dataset.restore); await refreshWorks(); renderTrash(); toast('「' + r + '」を元に戻しました'); } catch (e) { toast('元に戻せませんでした'); }
  }));
}


/* ---------- moving the shelf to another folder (PC) ---------- */
if (api.relocatePick) $('#sMove').addEventListener('click', async () => {
  await saveChapter(); await saveProgress(true);
  let pick;
  try { pick = await api.relocatePick(); } catch (e) { toast(e.message && /本棚/.test(e.message) ? e.message : '引っ越し先を調べられませんでした'); return; }
  if (!pick) return;
  const pl = pick.plan;
  const sum = k => pl.reduce((n, it) => n + it[k].length, 0);
  const destOnly = sum('destOnly');
  const rows = pl.map(it => `<li><b>${esc(it.work)}</b>　<span class="muted small">${it.isNew ? '新しく作る' : '同じ名前の作品に合流'}</span><br><span class="small">${[
    it.add.length ? `追加 ${it.add.length}章` : '', it.overwrite.length ? `<span style="color:var(--danger)">上書き ${it.overwrite.length}章</span>（${esc(it.overwrite.slice(0, 4).join('、'))}${it.overwrite.length > 4 ? ' ほか' : ''}）` : '',
    it.same.length ? `同じ内容 ${it.same.length}章` : '', it.destOnly.length ? `<span class="muted">引っ越し先にだけあるファイル ${it.destOnly.length}</span>` : ''].filter(Boolean).join('　')}</span></li>`).join('');
  openDlg(`<div class="dlg"><h3>本棚を引っ越す</h3><div class="pathbox">${esc(pick.dest)}</div>
    <ul class="move-plan">${rows || '<li class="muted">作品がありません</li>'}</ul>
    ${sum('overwrite') ? `<p class="note">上書きされる章の、引っ越し先にあった元の原稿は「_書房の記録\\backup\\引っ越し_日付」に退避してから入れ替えます。</p>` : ''}
    ${destOnly ? `<label class="check"><input type="checkbox" id="mvHide" checked> 引っ越し先にだけあるファイル（メモや旧原稿など ${destOnly}件）は章の一覧から隠しておく<br></label><p class="note" style="margin:0">消しはしません。作品ページの「隠しているファイル」からいつでも戻せます。</p>` : ''}
    <p class="note" style="margin:0">コインや討伐記録は、両方の記録を合わせます。今の本棚（${esc(S.root)}）は消さずに残します。</p>
    <div class="row"><span class="spacer"></span><button class="btn ghost" data-close>やめる</button><button class="btn gold" id="mvGo">引っ越す</button></div></div>`, d => {
    d.querySelector('#mvGo').addEventListener('click', async () => {
      const hide = !!(d.querySelector('#mvHide') && d.querySelector('#mvHide').checked);
      d.querySelector('#mvGo').disabled = true; d.querySelector('#mvGo').textContent = '引っ越し中…';
      try {
        const res = await api.relocateRun(pick.picked, pick.dest, { hideDestOnly: hide });
        const prog = await api.readProgress();
        S.progress = prog ? mergeProgress(S.progress, prog) : S.progress; await saveProgress(true);
        S.root = res.root; S.curWork = S.curCh = null; loaded.key = null; S.openWork = null; lsSet('ss.curWork', null);
        closeDlg(); await refreshWorks(); renderSettings(); renderHeader(); renderHP();
        toast('引っ越しました');
      } catch (e) { closeDlg(); fileErr(e, '引っ越しの途中で失敗しました。元の本棚はそのまま残っています'); }
    });
  });
});

/* ---------- v1.1.18 本棚シェア ----------
   本棚をカード（PNG）にして、SNS や LINE に送れるようにする。横長 1200×675／縦長 1080×1920。
   - 棚にのせる作品と題の伏せ方（異世界文字・和風文字・ヴォイニッチ風・文字化け）は作品ごとに作品ページで選ぶ（_作品情報.json の share）
   - 数字はうそをつかない：のせていない作品も数える。そのかわり棚に「ほか○作は棚にのせていません」と出す
   - カードは画面の外に本物の背表紙で組んで、SVG の foreignObject に入れて canvas に描く（使った字の分だけフォントを埋め込む）
   - PC は保存・コピー。スマホと iPhone 版は共有メニュー。iPhone で画像にできない・共有できないときは「長押しで保存」の表示 */
const SH_STATS = [['works', '作品'], ['chars', '本棚の文字数'], ['genko', '原稿用紙にすると'], ['level', '書き手のレベル'], ['written', 'このアプリで書いた字'],
  ['kills', '討伐した数'], ['streak', '連続討伐'], ['zoneN', 'ゾーンに入った回数'], ['zoneMax', 'いちばん長いゾーン'], ['zoneSum', 'ゾーンの合計']];
function shareCfg() {
  const s = P().settings.share || {};
  return { name: String(s.name || ''), lay: s.lay === 'port' ? 'port' : 'land', stats: { ...Object.fromEntries(SH_STATS.map(([k]) => [k, true])), ...(s.stats || {}) } };
}
function workShare(w) {
  const s = w.share || {}; let hide = typeof s.hide === 'string' ? s.hide : '';
  if (hide && !SCRIPTS.some(x => x.id === hide)) hide = '';
  if (hide && !(P().owned.script || []).includes(hide)) hide = 'cyr';   // 持っていない字（引き継ぎなどで）なら異世界文字で伏せる
  return { show: s.show !== false, hide };
}
// 背表紙（伏せ字つき）。文字化けはふつうの字なので題字として書く。ほかの字は fakeTitles() が DOM に入れたあとで重ねる
// 商店の見本：金の枠の札に、字を大きく書く（細い背表紙だと窮屈で、文字化けははみ出したため）
function scriptSample(id) {
  if (id === 'moji') return `<div class="ss-plate"><span class="ss-moji">${esc(FAKE.mojibake('小説'))}</span></div>`;
  if (id === 'wa') return `<div class="ss-plate v">${FAKE.svgV('蛇喰鷲').html}</div>`;
  return `<div class="ss-plate">${FAKE.svg('蛇喰鷲書房', id === 'voy' ? 'voy' : 'cyr').html}</div>`;
}
function fakeSpine(cover, title, w, h, mode, brk) {
  if (!mode) return spineHTML(cover, title, w, h, brk);
  if (mode === 'moji') return spineHTML(cover, FAKE.mojibake(title), w, h, '');
  return spineHTML(cover, title, w, h, brk).replace('<div class="spine', `<div data-fake="${mode}" data-t="${esc(title)}" data-c="${esc(cover)}" class="spine`);
}
function fakeTitles(root) {
  root.querySelectorAll('.spine[data-fake]').forEach(sp => {
    if (sp.querySelector('.fk')) return;
    const t = sp.querySelector('.sp-title'); if (!t) return;
    const mode = sp.dataset.fake, title = sp.dataset.t.replace(/\s/g, ''), W = sp.offsetWidth, H = sp.offsetHeight;
    const cs = getComputedStyle(t), col = cs.color;
    // 題箋や札のある装丁は、その地を残して中に書く。ほかは題字が始まる位置から、題字に使ってよい長さの中に
    const lab = sp.classList.contains('sp-label') || cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none';
    const [ratio, padv] = TITLE_ROOM[sp.dataset.c] || [0.64, LABELED.includes(sp.dataset.c) ? 12 : 0];
    let top = 0, el = t; while (el && el !== sp) { top += el.offsetTop; el = el.offsetParent; }
    const room = lab ? t.offsetHeight - 10 : H * ratio - padv - 6;
    t.style.color = 'transparent'; t.style.textShadow = 'none';
    const f = document.createElement('div'); f.className = 'fk'; f.setAttribute('aria-hidden', 'true');
    let fw, fh, rot = '';
    if (mode === 'wa') {   // 縦に積む
      const g = FAKE.svgV(title); fw = Math.min(W * 0.42, 15); fh = g.h * fw / g.w; if (fh > room) { fh = room; fw = fh * g.w / g.h; } f.innerHTML = g.html;
    } else {               // 洋書のように横倒し
      const g = FAKE.svg(title, mode === 'voy' ? 'voy' : 'cyr'); let th = Math.min(W * 0.4, 15), len = g.w * th / g.h; if (len > room) { len = room; th = len * g.h / g.w; }
      f.innerHTML = g.html; fw = len; fh = th; rot = ' rotate(90deg)';
    }
    const along = rot ? fw : fh, cy = lab ? top + t.offsetHeight / 2 : top + along / 2;
    f.style.cssText = `position:absolute;z-index:3;left:50%;top:${cy}px;width:${fw}px;height:${fh}px;color:${col};transform:translate(-50%,-50%)${rot};pointer-events:none`;
    sp.appendChild(f);
  });
}
// ---- 作品ページの「本棚シェア」 ----
function shareFieldHTML(w) {
  const ws = workShare(w), own = P().owned.script || ['cyr'];
  const opts = [['', 'そのまま'], ...SCRIPTS.filter(x => own.includes(x.id)).map(x => [x.id, x.name])];
  return `<div class="field share-field"><label>本棚シェア</label>
    <label class="check"><input type="checkbox" id="wShShow"${ws.show ? ' checked' : ''}> カードの棚にのせる</label>
    <div class="row" style="gap:8px;align-items:center;flex-wrap:nowrap"><span class="small">題</span><select class="input sm" id="wShHide">${opts.map(([v, n]) => `<option value="${v}"${v === ws.hide ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="muted small">のせなくても、作品数や文字数には数えます。${own.length < SCRIPTS.length ? 'ほかの伏せ字は商店の「おまけ」にあります。' : ''}</div></div>`;
}
function bindShareField(w) {
  const show = $('#wShShow'), hide = $('#wShHide'); if (!show) return;
  // 続けて変えても追い越さないよう、保存は順番に。保存するときのいちばん新しい値を書く
  let q = Promise.resolve();
  const save = () => { q = q.then(async () => {
    const v = { show: show.checked, hide: hide.value };
    try { await api.setFace(w.id, { share: v }); w.share = v; } catch (e) { fileErr(e, '本棚シェアの設定を保存できませんでした'); }
  }); clearTimeout(save.t); save.t = setTimeout(() => q.then(() => refreshWorks(true)), 400); };
  show.addEventListener('change', save); hide.addEventListener('change', save);
}
// ---- 数字（原稿用紙は章の中身から数える。章の更新日時が同じなら前に数えた値を使う） ----
const genkoCache = new Map();
async function genkoTotal(works) {
  let sum = 0;
  for (const w of works) for (const ch of w.chapters || []) {
    const key = w.id + '/' + ch.id, c = genkoCache.get(key);
    if (c && c.mtime === ch.mtime) { sum += c.v; continue; }
    try { const r = await api.readChapter(w.id, ch.id); const v = genkoSheets(r.text); genkoCache.set(key, { mtime: ch.mtime, v }); sum += v; } catch (e) {}
  }
  return sum;
}
async function shareStats(works) {
  const p = P(), x = xpInfo(p.totalWritten);
  const chars = works.reduce((a, w) => a + (w.chars || 0), 0);
  return { works: [fmt(works.length), '作'], chars: [fmt(chars), '字'], genko: ['約' + fmt(Math.round(await genkoTotal(works))), '枚'], level: ['Lv ' + x.lv, titleOf(x.lv)],
    written: [fmt(p.totalWritten), '字'], kills: [fmt(Object.keys(p.kills).length), '体'], streak: [fmt(currentStreak()), '日'],
    zoneN: [fmt(p.zone.count), '回'], zoneMax: [mmss(p.zone.longest), ''], zoneSum: [mmss(p.zone.total), ''] };
}
// ---- カードを組む（画面の外に置く） ----
const CARD = { land: { W: 1200, H: 675, kmax: 1.5 }, port: { W: 1080, H: 1920, kmax: 2.3 } };
async function buildCard() {
  const cfg = shareCfg(), L = CARD[cfg.lay], all = S.works.slice(), shown = all.filter(w => workShare(w).show);
  const st = await shareStats(all), d = new Date();
  const old = $('#shareCard'); if (old) old.remove();
  const el = document.createElement('div'); el.id = 'shareCard'; el.className = 'sc-' + cfg.lay;
  const keys = SH_STATS.filter(([k]) => cfg.stats[k]);
  el.innerHTML = `<div class="sc-fr"></div><div class="sc-fr2"></div>
    <div class="sc-hd"><img src="icon.png" alt=""><div><div class="sc-ttl">${esc(cfg.name.trim() ? cfg.name.trim() + 'の本棚' : 'わたしの本棚')}</div><div class="sc-sub">蛇喰鷲書房</div></div></div>
    <div class="sc-case${keys.length ? '' : ' wide'}">${shown.length < all.length ? `<div class="sc-more">ほか ${all.length - shown.length} 作は棚にのせていません</div>` : ''}<div class="sc-rows"></div></div>
    ${keys.length ? `<div class="sc-stats${keys.length <= 4 && cfg.lay === 'land' ? ' one' : ''}">${keys.map(([k, n]) => `<div class="sc-st"><div class="sc-k">${n}</div><div class="sc-v">${esc(st[k][0])}<small>${esc(st[k][1])}</small></div></div>`).join('')}</div>` : ''}
    <div class="sc-ft">${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}</div>`;
  document.body.appendChild(el);
  // 棚の段の数：背表紙がいちばん大きく見える段数（1〜4段）
  const rowsEl = el.querySelector('.sc-rows'), CW = rowsEl.clientWidth - 40, CH = rowsEl.clientHeight;
  const items = shown.map(w => ({ w, sw: spineWidth(w.chars), sh: 200 + hashN(w.id) % 29 }));
  let best = { k: 0, rows: [] };
  if (items.length) for (let r = 1; r <= Math.min(4, items.length); r++) {
    const total = items.reduce((a, it) => a + it.sw + 6, 0), rows = []; let cur = [], acc = 0;
    for (const it of items) { if (cur.length && acc + it.sw > total / r * 1.02 && rows.length < r - 1) { rows.push(cur); cur = []; acc = 0; } cur.push(it); acc += it.sw + 6; }
    rows.push(cur);
    const maxW = Math.max(...rows.map(rw => rw.reduce((a, it) => a + it.sw + 6, 0))), maxH = Math.max(...items.map(it => it.sh));
    const k = Math.min(L.kmax, CW / maxW, (CH - r * 22 - (r - 1) * 14) / r / maxH);
    if (k > best.k * 1.08) best = { k, rows };
  }
  rowsEl.innerHTML = best.rows.map(rw => `<div class="sc-shelf">${rw.map(it => fakeSpine(it.w.cover, it.w.title, Math.round(it.sw * best.k), Math.round(it.sh * best.k), workShare(it.w).hide, it.w.titleBreak)).join('')}</div>`).join('')
    || '<div class="sc-shelf"><span class="sc-empty">まだ棚にのせた作品はありません</span></div>';
  fakeTitles(el);
  return { el, W: L.W, H: L.H };
}
// ---- カードを PNG に（SVG の foreignObject → canvas）。使った字の分だけフォントを埋め込む ----
const fontData = new Map();
function readBin(url) {
  return new Promise((res, rej) => { const x = new XMLHttpRequest(); x.open('GET', url); x.responseType = 'arraybuffer'; x.onload = () => (x.status === 200 || x.status === 0) && x.response ? res(x.response) : rej(new Error('font ' + x.status)); x.onerror = () => rej(new Error('font')); x.send(); });
}
function toB64(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
async function cardPNG(card) {
  const { el, W, H } = card, used = new Set();
  for (const ch of el.textContent) used.add(ch.codePointAt(0)); for (let c = 0x20; c < 0x7f; c++) used.add(c);
  const hit = ur => ur.split(',').some(p => { const m = p.trim().replace(/^U\+/i, '').split('-'), a = parseInt(m[0], 16), b = m[1] ? parseInt(m[1], 16) : a; for (const c of used) if (c >= a && c <= b) return true; return false; });
  let css = ''; const fonts = [];
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch (e) { continue; }
    for (const r of rules) {
      if (r instanceof CSSFontFaceRule) {
        const ur = r.style.getPropertyValue('unicode-range'), m = r.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/);
        if (!m || (ur && !hit(ur))) continue;
        const url = new URL(m[1], sh.href || location.href).href;
        fonts.push((fontData.has(url) ? Promise.resolve(fontData.get(url)) : readBin(url).then(b => { const v = toB64(b); fontData.set(url, v); return v; }))
          .then(v => r.cssText.replace(m[0], `url(data:font/woff2;base64,${v})`)).catch(() => ''));
      } else css += r.cssText + '\n';
    }
  }
  const ff = (await Promise.all(fonts)).join('\n');
  const clone = el.cloneNode(true);
  for (const img of clone.querySelectorAll('img')) {   // 画像（羽ペン）も埋め込む
    const src = el.querySelector('img'); try { if (!src.complete) await new Promise(r => { src.onload = r; src.onerror = r; }); const c = document.createElement('canvas'); c.width = src.naturalWidth; c.height = src.naturalHeight; c.getContext('2d').drawImage(src, 0, 0); img.src = c.toDataURL('image/png'); } catch (e) { img.remove(); }
  }
  const x = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px;position:relative;overflow:hidden"><style>${x(ff + '\n' + css + '\n#shareCard{position:absolute!important;left:0!important;top:0!important}')}</style>${new XMLSerializer().serializeToString(clone)}</div></foreignObject></svg>`;
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('svg')); setTimeout(() => rej(new Error('timeout')), 20000); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });   // blob: はアプリの安全設定で使えない
  await new Promise(r => setTimeout(r, 50));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(img, 0, 0, W, H);
  const url = cv.toDataURL('image/png');   // iPhone（Safari）ではここで断られることがある
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  return { url, b64: url.split(',')[1], blob };
}
// ---- シェアの窓 ----
let shareJob = 0;
function openShare() {
  const cfg = shareCfg(), phone = IS_ANDROID;
  openDlg(`<div class="dlg share-dlg">
    <h3 style="margin:0">本棚をシェア</h3>
    <div class="share-grid">
      <div><div class="share-pv" id="shPv"><span class="muted small">カードを作っています…</span></div>
        <p class="muted small" style="margin:8px 0 0">棚にのせる作品と、題を伏せるかどうかは、作品ページの「本棚シェア」で選べます。数字は、のせていない作品も含めた本当の数です。</p></div>
      <div class="stack" style="gap:12px">
        <div class="field"><label for="shName">名前</label><input class="input" id="shName" maxlength="20" value="${esc(cfg.name)}" placeholder="空なら「わたしの本棚」"></div>
        <div class="field"><label>形</label><div class="row" style="gap:14px"><label class="check"><input type="radio" name="shLay" value="land"${cfg.lay === 'land' ? ' checked' : ''}> 横長</label><label class="check"><input type="radio" name="shLay" value="port"${cfg.lay === 'port' ? ' checked' : ''}> 縦長（スマホの画面いっぱい）</label></div></div>
        <div class="field"><label>のせる数字</label><div class="share-stats">${SH_STATS.map(([k, n]) => `<label class="check small"><input type="checkbox" data-st="${k}"${cfg.stats[k] ? ' checked' : ''}> ${n}</label>`).join('')}</div></div>
      </div>
    </div>
    <div class="row"><span class="spacer"></span><button class="btn ghost" data-close>閉じる</button>
      ${phone ? '<button class="btn gold" id="shShare" disabled>共有・保存</button>' : '<button class="btn" id="shCopy" disabled>画像をコピー</button><button class="btn gold" id="shSave" disabled>画像を保存</button>'}</div></div>`, d => {
    let png = null, timer = 0;
    const name = () => '蛇喰鷲書房_本棚_' + dayKey().replace(/-/g, '') + '.png';
    const render = async () => {
      const job = ++shareJob; png = null; d.querySelectorAll('#shShare,#shCopy,#shSave').forEach(b => b.disabled = true);
      const pv = d.querySelector('#shPv'); pv.classList.add('busy');
      let card = null;
      try {
        card = await buildCard(); const r = await cardPNG(card); if (job !== shareJob) return;
        png = r; pv.innerHTML = `<img alt="本棚のカード" src="${r.url}">`; d.querySelectorAll('#shShare,#shCopy,#shSave').forEach(b => b.disabled = false);
      } catch (e) {
        if (job !== shareJob) return;
        // 画像にできなかった（iPhone の Safari など）：カードをそのまま見せて、スクリーンショットで保存してもらう
        pv.innerHTML = ''; if (card) { const c = card.el.cloneNode(true); c.removeAttribute('id'); c.className = 'share-live sc-' + shareCfg().lay; c.id = 'shareLive'; pv.appendChild(c); fitLive(pv); }
        pv.insertAdjacentHTML('beforeend', '<p class="muted small" style="margin:8px 0 0">この端末では画像にできませんでした。カードを画面いっぱいに出して、スクリーンショットで保存してください。</p><button class="btn sm" id="shFull">画面いっぱいに出す</button>');
        pv.querySelector('#shFull').addEventListener('click', () => showFull(card));
      } finally { if (card) card.el.remove(); pv.classList.remove('busy'); }
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
    const save = () => { P().settings.share = { name: d.querySelector('#shName').value.trim(), lay: d.querySelector('[name=shLay]:checked').value, stats: Object.fromEntries([...d.querySelectorAll('[data-st]')].map(c => [c.dataset.st, c.checked])) }; saveProgress(); later(); };
    d.querySelector('#shName').addEventListener('input', save);
    d.querySelectorAll('[name=shLay],[data-st]').forEach(c => c.addEventListener('change', save));
    if (d.querySelector('#shSave')) d.querySelector('#shSave').addEventListener('click', async () => { if (!png) return; try { if (await api.saveCard(png.b64, name())) toast('本棚の画像を保存しました'); } catch (e) { fileErr(e, '画像を保存できませんでした'); } });
    if (d.querySelector('#shCopy')) d.querySelector('#shCopy').addEventListener('click', async () => { if (!png) return; try { await api.copyCard(png.b64); toast('本棚の画像をコピーしました。SNS や LINE に貼り付けられます'); } catch (e) { fileErr(e, '画像をコピーできませんでした'); } });
    if (d.querySelector('#shShare')) d.querySelector('#shShare').addEventListener('click', () => {
      if (!png) return;
      // iPhone は「タップの直後」でないと共有メニューが開かないので、ここでは待たずに呼ぶ
      api.shareCard(name(), png.b64, png.blob).then(ok => { if (!ok) showImg(png.url); }).catch(e => fileErr(e, '共有できませんでした'));
    });
    render();
  });
}
function fitLive(box) { const c = box.querySelector('#shareLive'); if (!c) return; const s = box.clientWidth / c.offsetWidth; c.style.transform = `scale(${s})`; c.style.transformOrigin = '0 0'; box.style.height = c.offsetHeight * s + 'px'; }
// 共有できなかったとき：画像を大きく出して、長押しで保存してもらう
function showImg(url) {
  const o = document.createElement('div'); o.className = 'share-full';
  o.innerHTML = `<img alt="本棚のカード" src="${url}"><p>${IS_WEB ? '画像を長押しすると、「写真に追加」で保存できます。' : '画像を長押しすると保存できます。'}</p><button class="btn">閉じる</button>`;
  o.querySelector('button').addEventListener('click', () => o.remove()); document.body.appendChild(o);
}
// 画像にできなかったとき：カードを画面いっぱいに（スクリーンショット用）
function showFull(card) {
  const o = document.createElement('div'); o.className = 'share-full live'; const c = card.el.cloneNode(true); c.id = 'shareLive'; c.className = 'share-live sc-' + shareCfg().lay;
  o.appendChild(c); o.insertAdjacentHTML('beforeend', '<p>スクリーンショットで保存してください。画面をタップすると閉じます。</p>');
  document.body.appendChild(o);
  const s = Math.min(innerWidth / card.W, (innerHeight - 40) / card.H); c.style.transform = `scale(${s})`; c.style.transformOrigin = '0 0'; c.style.width = card.W + 'px'; c.style.height = card.H + 'px';
  o.addEventListener('click', () => o.remove());
}

/* ---------- BGM (generated with Web Audio; no audio files) ---------- */
const BGM = {
  ctx: null, master: null, on: false, stopFns: [],
  ensure() { if (!this.ctx) { this.ctx = new AudioContext(); this.master = this.ctx.createGain(); this.master.gain.value = (P() ? P().settings.vol : 0.5) * 0.6; this.master.connect(this.ctx.destination); } this.ctx.resume(); return true; },
  setVol(v) { if (this.master) this.master.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.05); },
  stop() { this.stopFns.forEach(f => { try { f(); } catch (e) {} }); this.stopFns = []; },
  play(id) { this.stop(); this.ensure(); AMB.keepOnly(AMB_KEYS[id] || []); const tr = TRACKS[id]; if (tr) this.stopFns.push(tr(this.ctx, this.master)); },
  // 試聴のおわり：sec 秒かけて小さくしてから止める
  fadeStop(sec, done) {
    if (!this.ctx) { done && done(); return; }
    const v = (P() ? P().settings.vol : 0.5) * 0.6, g = this.master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + sec);
    setTimeout(() => { this.stop(); const t = this.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(v, t); done && done(); }, sec * 1000 + 30);
  }
};
// 商店の試聴（20秒ほど。おわりは少しずつ小さく）。BGM が鳴っていたら、試聴のあとに元の曲へ戻す
const PV = {
  id: null, timer: 0, wasOn: false,
  start(id) {
    if (this.id) this.stop(true, true);
    this.wasOn = BGM.on; this.id = id; BGM.play(id);
    this.timer = setTimeout(() => { const me = this.id; BGM.fadeStop(1.5, () => { if (this.id === me) this.finish(); }); }, 20000);
    this.redraw();
  },
  // quiet: すぐ止める。noResume: 元の曲に戻さない（続けて別の曲を試聴するとき）
  stop(quiet, noResume) { if (!this.id) return; clearTimeout(this.timer); BGM.stop(); this.finish(noResume); },
  finish(noResume) {
    clearTimeout(this.timer); this.id = null;
    if (this.wasOn && !noResume) BGM.play(P().equipped.bgm);
    this.redraw();
  },
  // 「♪ BGM」ボタンが押されたとき：試聴だけ止めて、元の曲には戻さない（ボタンの方で決める）
  cancel() { if (!this.id) return; clearTimeout(this.timer); BGM.stop(); this.id = null; this.redraw(); },
  redraw() { if (S.view === 'shop' && S.shopCat === 'bgm') renderShop(); }
};
// 環境音は bgm-gen.js が作る。ふだんは Worker（裏の作業場所）で作って、画面が固まらないようにする
const AMB_KEYS = { rain: ['rain'], fire: ['fire'], forest: ['forest', 'wind'], clock: ['room'] };
const AMB = {
  cache: {}, pending: {}, worker: undefined,
  getWorker() {
    if (this.worker !== undefined) return this.worker;
    try {
      this.worker = new Worker('bgm-gen.js');
      this.worker.onmessage = e => { const d = e.data; if (d.error) this.buildHere(d.key); else this.done(d.key, d.sr, [d.l, d.r]); };
      this.worker.onerror = e => { if (e && e.preventDefault) e.preventDefault(); this.worker = null; Object.keys(this.pending).forEach(k => this.buildHere(k)); };
    } catch (e) { this.worker = null; }
    return this.worker;
  },
  buildHere(key) { const pd = this.pending[key]; if (!pd || typeof SHOBO_AMB === 'undefined') return; setTimeout(() => { if (this.pending[key]) this.done(key, pd.sr, SHOBO_AMB.build(key, pd.sr)); }, 30); },
  done(key, sr, arr) {
    const pd = this.pending[key]; delete this.pending[key]; if (!pd || !BGM.ctx) return;
    const b = BGM.ctx.createBuffer(2, arr[0].length, sr); b.copyToChannel(arr[0], 0); b.copyToChannel(arr[1], 1);
    this.cache[key] = b; pd.wait.forEach(f => f(b));
  },
  get(key, sr, cb) {
    const c = this.cache[key]; if (c && c.sampleRate === sr) { cb(c); return; }
    if (this.pending[key]) { this.pending[key].wait.push(cb); return; }
    this.pending[key] = { sr, wait: [cb] };
    const w = this.getWorker(); if (w) w.postMessage({ key, sr }); else this.buildHere(key);
  },
  // 鳴らす曲で使わない環境音は捨てる（スマホのメモリのため）
  keepOnly(keys) { for (const k of Object.keys(this.cache)) if (!keys.includes(k)) delete this.cache[k]; },
  // できたら 1.5 秒かけて大きくしながら、くり返し鳴らす
  play(ctx, out, key, gain) {
    let src = null, stopped = false;
    this.get(key, ctx.sampleRate, b => {
      if (stopped) return;
      const g = ctx.createGain(), now = ctx.currentTime; src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + 1.5); src.connect(g); g.connect(out); src.start(now);
    });
    return () => { stopped = true; if (src) try { src.stop(); } catch (e) {} };
  }
};
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function note(ctx, out, t, m, dur, type, vol, att, rel) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = mtof(m); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (att || 0.01)); g.gain.setTargetAtTime(0, t + dur, rel || 0.08); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + (rel || 0.08) * 6); }
function sequencer(ctx, stepDur, onStep) { let step = 0, next = ctx.currentTime + 0.1; const id = setInterval(() => { while (next < ctx.currentTime + 0.25) { onStep(step, next); step++; next += stepDur; } }, 40); return () => clearInterval(id); }
// 時計のカチ・コチ（一度だけ作って使い回す）
function clockTick(ctx, hi) {
  const sr = ctx.sampleRate, d = new Float32Array(Math.floor(sr * 0.25));
  SHOBO_AMB.burst(d, 0, sr, hi ? 3300 : 2800, 0.12, 0.0004, 0.9);
  SHOBO_AMB.burst(d, Math.floor(sr * 0.006), sr, hi ? 5200 : 4600, 0.2, 0.0002, 0.4);
  SHOBO_AMB.burst(d, 0, sr, 850, 0.08, 0.004, 0.45);
  SHOBO_AMB.burst(d, 0, sr, hi ? 1900 : 1700, 0.01, 0.02, 0.06);
  const b = ctx.createBuffer(1, d.length, sr); b.copyToChannel(d, 0); return b;
}
// オルゴールの1音（基音＋金属っぽい上の音）
function musicBox(ctx, out, t, m, vol) {
  const f = mtof(m), dec = Math.max(0.35, 1.6 - (m - 60) * 0.035);
  [[1, 1, dec], [3.0, 0.09, dec * 0.25], [5.4, 0.06, 0.05], [8.9, 0.025, 0.02]].forEach(([r, a, tc]) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * r;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.003); g.gain.setValueAtTime(vol * a, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, tc);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.003 + tc * 7);
  });
}
// 自作のワルツ（16小節、3拍子）。数字は音の高さ、[a,b] は半拍ずつ、0 は休み
const MB_MEL = [[76, 79, 84], [83, 81, 76], [77, 81, 84], [83, [81, 79], 74], [76, 79, 84], [86, 83, 79], [81, 77, 74], [72, 0, 0],
  [81, 84, 81], [79, 83, 79], [77, 81, 77], [76, 79, 76], [74, 77, 81], [79, [77, 76], 74], [72, 76, 79], [84, 0, 0]];
const MB_CH = [[48, 64, 67], [45, 60, 64], [41, 57, 60], [43, 59, 62], [48, 64, 67], [40, 59, 64], [41, 57, 60, 43, 59, 62], [48, 64, 67],
  [45, 60, 64], [40, 59, 64], [41, 57, 60], [48, 64, 67], [38, 57, 62], [43, 59, 62], [48, 64, 67], [48, 64, 67]];

const TRACKS = {
  none: () => () => {},
  rain(ctx, out) {
    const stopAmb = AMB.play(ctx, out, 'rain', 0.13);
    const scale = [60, 62, 64, 67, 69, 72, 74, 76];
    const stopSeq = sequencer(ctx, 0.25, (s, t) => {
      if (s % 12 === 0 && Math.random() < 0.7) { const m = scale[Math.floor(Math.random() * scale.length)]; note(ctx, out, t, m, 0.3, 'triangle', 0.09, 0.01, 0.6); if (Math.random() < 0.5) note(ctx, out, t + 0.5, m - 12, 0.3, 'sine', 0.06, 0.01, 0.8); }
    });
    return () => { stopSeq(); stopAmb(); };
  },
  morning(ctx, out) {
    const chords = [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]]; const pat = [0, 1, 2, 3, 2, 1, 2, 3];
    return sequencer(ctx, 60 / 96 / 2, (s, t) => {
      const c = chords[Math.floor(s / 16) % 4]; note(ctx, out, t, c[pat[s % 8]] + 12, 0.18, 'triangle', 0.08, 0.01, 0.12);
      if (s % 16 === 0) note(ctx, out, t, c[0] - 12, 2.2, 'sine', 0.12, 0.05, 0.3); if (s % 16 === 8) note(ctx, out, t, c[0] - 5, 1, 'sine', 0.06, 0.05, 0.3);
    });
  },
  stars(ctx, out) {
    const d1 = ctx.createOscillator(), d2 = ctx.createOscillator(), dg = ctx.createGain(); d1.type = d2.type = 'sine'; d1.frequency.value = mtof(48); d2.frequency.value = mtof(55); dg.gain.value = 0.035; d1.connect(dg); d2.connect(dg); dg.connect(out); d1.start(); d2.start();
    const sc = [60, 62, 64, 66, 67, 69, 71, 72, 74, 76, 79, 81];
    const stopSeq = sequencer(ctx, 0.5, (s, t) => { if (Math.random() < 0.42) { const m = sc[Math.floor(Math.random() * sc.length)]; note(ctx, out, t, m + 12, 0.05, 'sine', 0.07, 0.005, 1.1); note(ctx, out, t, m + 24, 0.03, 'sine', 0.015, 0.005, 0.7); } });
    return () => { stopSeq(); try { d1.stop(); d2.stop(); } catch (e) {} };
  },
  fire(ctx, out) {
    const stopAmb = AMB.play(ctx, out, 'fire', 0.26);
    // やわらかい和音：8秒ごとに Fmaj7 → B♭maj7 → Am7 → Gm7。ときどき和音の音をぽつりと
    const chords = [[41, 57, 60, 64], [46, 57, 62, 65], [45, 55, 60, 64], [43, 58, 62, 65]];
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.4; lp.connect(out);
    const stopSeq = sequencer(ctx, 2, (s, t) => {
      const ch = chords[Math.floor(s / 4) % 4];
      if (s % 4 === 0) ch.forEach((m, i) => [-5, 5].forEach(det => {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det;
        const v = i === 0 ? 0.04 : 0.022;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 2.5); g.gain.setValueAtTime(v, t + 6.5); g.gain.linearRampToValueAtTime(0, t + 10.5);
        o.connect(g); g.connect(lp); o.start(t); o.stop(t + 10.6);
      }));
      if (s % 4 !== 0 && Math.random() < 0.55) { const m = ch[1 + Math.floor(Math.random() * 3)] + 12; note(ctx, out, t + Math.random() * 0.8, m, 0.4, 'sine', 0.05, 0.02, 0.9); }
    });
    return () => { stopSeq(); stopAmb(); };
  },
  forest(ctx, out) {
    const a = AMB.play(ctx, out, 'forest', 1.0), b = AMB.play(ctx, out, 'wind', 1.0);
    return () => { a(); b(); };
  },
  clock(ctx, out) {
    const stopAmb = AMB.play(ctx, out, 'room', 0.03);
    const tk = [clockTick(ctx, true), clockTick(ctx, false)];
    // 1秒に1回カチ・コチ。オルゴールは 16小節（48秒）鳴って、20秒休む
    const stopSeq = sequencer(ctx, 0.5, (s, t) => {
      if (s % 2 === 0) { const b = ctx.createBufferSource(), g = ctx.createGain(); b.buffer = tk[(s / 2) % 2]; g.gain.value = 0.22 * (0.9 + 0.1 * Math.random()); b.connect(g); g.connect(out); b.start(t); }
      const cyc = 136, i = s % cyc; if (i >= 96) return; // 半拍の数：48秒 = 96、休み 40
      const bar = Math.floor(i / 6), beat = Math.floor((i % 6) / 2), half = i % 2, mel = MB_MEL[bar][beat], ch = MB_CH[bar];
      const m = Array.isArray(mel) ? mel[half] : (half ? 0 : mel); if (m) musicBox(ctx, out, t, m, 0.07);
      if (!half) {
        const c = ch.length > 3 && beat === 2 ? ch.slice(3) : ch.slice(0, 3);
        if (beat === 0 || (ch.length > 3 && beat === 2)) musicBox(ctx, out, t, c[0] + 12, 0.05); else c.slice(1).forEach(x => musicBox(ctx, out, t, x, 0.025));
      }
    });
    return () => { stopSeq(); stopAmb(); };
  }
};
$('#bgmBtn').addEventListener('click', () => {
  if (PV.id) PV.cancel();   // 試聴中に押したら、試聴を止めてからいつもどおり切り替える
  if (BGM.on) { BGM.stop(); BGM.on = false; }
  else { const id = P().equipped.bgm; BGM.play(id); BGM.on = true; if (id === 'none') toast('BGMが「無音」になっています。商店で曲を選べます'); }
  $('#bgmBtn').setAttribute('aria-pressed', BGM.on);
});

/* ---------- boot ---------- */
(async function boot() {
  // On the PC the saved folder may be on Google Drive, which can appear a little after Windows starts.
  if (api.waitReady && !(await api.root())) {
    const pend = await api.pending();
    openDlg(`<div class="dlg"><h3>保存先の準備を待っています</h3><p style="margin:0">本棚のフォルダがまだ見つかりません。Google Drive が起動して G ドライブが使えるようになると、自動で開きます。</p><div class="pathbox">${esc(pend || '')}</div><p class="note" style="margin:0">しばらく待っても開かないときは、Google Drive が起動しているか確かめてください。保存先は勝手に変えません。</p><div class="row"><span class="spacer"></span><button class="btn" id="wPick">別のフォルダを選ぶ</button></div></div>`, d => {
      d.addEventListener('cancel', e => e.preventDefault());
      d.querySelector('#wPick').addEventListener('click', () => api.chooseRoot().catch(() => {}));
    });
    await api.waitReady();
    closeDlg();
  }
  try {
    S.root = await api.root();
    const prog = await api.readProgress();
    S.progress = withDefaults(prog); adoptLegacy(S.progress); sumLedgers(S.progress);
    if (!prog || !S.progress.bgm116) await afterProgressLoad();
  } catch (e) { S.progress = withDefaults(null); fileErr(e, '保存先を準備できませんでした'); }
  renderHeader(); renderHP();
  await refreshWorks();
  setView(['library', 'editor', 'battle', 'shop', 'settings'].includes(S.view) ? S.view : 'library');
  maybeKill();
  // one thing at a time: kill dialog, then login bonus, then the level-up banner (it would sit under a dialog's backdrop)
  const afterLogin = () => checkLevel(true);
  const showLogin = () => { checkLogin(); if (dlg.open) dlg.addEventListener('close', afterLogin, { once: true }); else afterLogin(); };
  if (dlg.open) dlg.addEventListener('close', showLogin, { once: true }); else showLogin();
  let lastDay = dayKey();
  setInterval(() => { renderHP(); if (S.view === 'battle') renderBattleStats(); const k = dayKey(); if (k !== lastDay) { lastDay = k; checkLogin(); } }, 60000);
})();
})();
