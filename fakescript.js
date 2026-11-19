/* 蛇喰鷲書房：本棚シェアで題を伏せる字（v1.1.18）。フォントは使わず線で描くので、どの端末でも同じに見える。
   同じ題はいつも同じ字になる（題から乱数の種を作る）。
   - 異世界文字（cyr）：キリル文字を崩したような字。線の部品を組み合わせた36字。横倒しで書く
   - ヴォイニッチ風（voy）：丸い字・「9」「8」のような字・背の高い飾り字。語の作りもそれらしく。横倒しで書く
   - 和風文字（wa）：ひらがなの崩し字に似せた14の形を少しずつ崩した字。縦に積んで、ときどき細い線でつなぐ
   - 文字化け（moji）：UTF-8 の題を Shift_JIS として読んだときの、ほんとうの化け方。ふつうの字なので題字と同じに書く */
(function (G) {
  function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; }
  // ---- 異世界文字（キリル文字を崩した感じ）：線の部品を2〜3個組み合わせて、36字のアルファベットを作る ----
  const P = { L: 'M1,2 L1,10', R: 'M7,2 L7,10', T: 'M1,2 L7,2', B: 'M1,10 L7,10', M: 'M1,6 L7,6', D1: 'M1,10 L7,2', D2: 'M1,2 L7,10',
    C: 'M4,2 L4,10', HR: 'M7,10 C7,12 6,12.6 4.8,12.4', BR: 'M1,2 L4.5,2 C8,2 8,6 4.5,6 L1,6', BB: 'M1,6 L4.5,6 C8,6 8,10 4.5,10 L1,10',
    ZH: 'M1,2 C3,4.2 3,6 4,6 C5,6 5,4.2 7,2 M1,10 C3,7.8 3,6 4,6 C5,6 5,7.8 7,10', O: 'M4,2 C8.4,2 8.4,10 4,10 C-0.4,10 -0.4,2 4,2',
    V: 'M1,2 L4,10 L7,2', LG: 'M1,10 L4,2 L7,10', HK: 'M1,2 C1,6 2,10 6,10 C7.4,10 7.6,8.5 7,7.5' };
  const SETS = [['L', 'R', 'D1'], ['L', 'R', 'M'], ['C', 'ZH'], ['L', 'BR'], ['L', 'BB', 'M'], ['L', 'R', 'B', 'HR'], ['T', 'C'], ['V', 'C'], ['LG', 'M'], ['O', 'C'],
    ['L', 'T'], ['L', 'D2', 'R'], ['O', 'M'], ['HK', 'C'], ['L', 'M', 'BR'], ['R', 'D1', 'B'], ['V', 'T'], ['L', 'R', 'T'], ['ZH', 'B'], ['O', 'D2'], ['LG', 'HR'],
    ['C', 'BB'], ['L', 'B', 'M'], ['R', 'BR'], ['D1', 'D2'], ['T', 'HK'], ['V', 'M'], ['O', 'T'], ['L', 'ZH'], ['C', 'D1', 'T'], ['LG', 'B'], ['R', 'HK'], ['L', 'R', 'D2', 'M'], ['O', 'HR'], ['BR', 'BB'], ['C', 'V', 'B']];
  const MARK = ['M2.5,-0.2 C3.4,1.1 4.6,1.1 5.5,-0.2', 'M2.6,0.4 L2.7,0.6 M5.3,0.4 L5.4,0.6', 'M3,0.8 L5.2,-0.4', ''];
  const CYR = SETS.map((s, i) => ({ d: s.map(k => P[k]).join(' ') + ' ' + (i % 4 === 1 ? MARK[i % 3] : ''), w: 9.5 }));
  // ---- ヴォイニッチ風：丸い字・「9」や「8」のような字・背の高い「絞首台」の字。語の作りもそれらしく ----
  const V = {
    o: ['M7.5,7.5 C7.5,4.3 2.5,4.3 2.5,7.5 C2.5,10.7 7.5,10.7 7.5,7.5', 9], a: ['M7,6.2 C5,4.4 2.5,5.6 2.5,7.9 C2.5,10.2 5.6,10.6 7,8.4 M7,5.4 L7,10.2', 9],
    e: ['M6.8,6 C5,4.8 2.8,5.8 2.8,7.8 C2.8,9.8 5.2,10.6 6.8,9.4', 8], i: ['M3,5.6 L3.2,10', 5], n: ['M2.5,5.6 L2.6,10 M2.6,10 C5.5,10.2 7.2,8.5 7,4.4', 9],
    y: ['M7,7.2 C7,4.6 3,4.6 3,7.1 C3,9.2 6.5,9.4 7,7.2 C7.2,10.4 6,12.8 3.4,13.6', 9], d: ['M5,6.6 C7.6,5 7.6,2.4 5,2.4 C2.4,2.4 2.4,5 5,6.6 C7.9,8.4 7.6,10.6 5,10.6 C2.4,10.6 2.1,8.6 5,6.6', 9],
    l: ['M2.6,10.2 L6.4,3.2 C7.4,1.6 8.8,3 7,4.6', 9], r: ['M3,10.2 L3,6.2 C4,4.9 6,5 7,6.3', 8.5], s: ['M3,6.2 C5,4.5 7.2,5.6 6,7.6 C5,9.4 3,10 3.4,10.3 L7.6,10.1', 9],
    q: ['M6,10.2 L6,3.2 L2.4,8.2 L8.2,8.2', 9.5], k: ['M3.4,10.2 L3.4,2 M6.6,10.2 L6.6,2 M1.2,4.2 C3.4,2.4 6.8,2.4 8.8,4.6 C9.8,6 8.2,7.2 6.6,6.6', 10.5],
    t: ['M3.4,10.2 L3.4,2 M6.6,10.2 L6.6,2 M1.2,5.2 C1.6,1.8 4,1.8 5,4.2 C6,1.8 8.4,1.8 8.8,5.2', 10.5],
    ch: ['M6,6 C4.4,4.8 2.4,5.8 2.4,7.8 C2.4,9.8 4.8,10.6 6,9.4 M12,6 C10.4,4.8 8.4,5.8 8.4,7.8 C8.4,9.8 10.8,10.6 12,9.4 M3.6,4.4 C6,3.6 9.6,3.6 11.6,4.4', 14],
  };
  const PRE = [['q', 'o'], ['o'], ['ch'], ['d'], ['s'], ['ch', 'o'], [], []], MID = [['k'], ['t'], ['e'], ['e', 'e'], ['o'], ['a'], ['k', 'e'], ['ch']], SUF = [['d', 'y'], ['a', 'i', 'i', 'n'], ['a', 'i', 'n'], ['o', 'l'], ['a', 'r'], ['e', 'y'], ['y'], ['o', 'r'], ['a', 'l']];
  // 題 → 字の並び（[{d, w}] と語の切れ目 null）
  function fake(title, kind) {
    const r = rng(hash(kind + title)), n = [...title.replace(/\s/g, '')].length || 1, out = [];
    if (kind === 'cyr') { for (let i = 0; i < Math.max(2, Math.round(n * 1.2)); i++) { if (i && r() < 0.17) out.push(null); out.push(CYR[Math.floor(r() * CYR.length)]); } return out; }
    const words = Math.max(1, Math.round(n / 2.6));
    for (let w = 0; w < words; w++) {
      if (w) out.push(null);
      const pick = a => a[Math.floor(r() * a.length)];
      [...pick(PRE), ...pick(MID), ...(r() < 0.4 ? pick(MID) : []), ...pick(SUF)].forEach(k => out.push({ d: V[k][0], w: V[k][1] }));
    }
    return out;
  }
  // 横一行の SVG（背表紙では90度回して使う）
  function svg(title, kind, color) {
    const gl = fake(title, kind); let x = 1, paths = '';
    const skew = kind === 'cyr' ? 'skewX(-9)' : '';
    for (const g of gl) { if (!g) { x += 4; continue; } paths += `<path transform="translate(${x.toFixed(1)},0) ${skew}" d="${g.d}"/>`; x += g.w; }
    return { w: x + 1, h: 15, html: `<svg viewBox="0 -1 ${(x + 1).toFixed(1)} 15" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${color || 'currentColor'}" stroke-width="${kind === 'cyr' ? 1.15 : 1.05}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>` };
  }
  G.FAKE = { svg, fake };
})(typeof window !== 'undefined' ? window : globalThis);
// ---- 和風文字（崩し字のような、筆で続けて書いた感じの字）。縦に積んで、ときどき前の字と細い線でつなぐ（連綿） ----
(function (G) {
  function rng(seed) { let a = seed || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; }
  function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // ひらがなの崩し字に似せた14の形を、少しずつ崩して字母にする（同じ字はいつも同じ形）
  const TPL = [
    'M4,1 C4,5 3.8,8 5.5,8.8 C7,9.4 8,8 8.6,6.5',
    'M1.5,4 C4,2.6 8.5,2.4 8.4,5 C8.3,8 5.5,9 3.8,9.2',
    'M5.2,3 C3.8,5.5 3,8.5 2.2,8.6 C1,8.7 1.4,4 5,3.2 C8.6,2.6 9.6,7.4 5.5,9.2',
    'M7,1.5 C5,3.5 3,5 2.8,5.6 C4,6.6 6,8 7.4,9.2',
    'M3.6,1.2 L4.8,2.2 M2.6,3.6 C2.4,5.5 2.2,7 2.6,7.6 C3.6,5.6 8.4,5 7.8,7.6 C7.4,9.2 5.2,9.6 3.6,9.4',
    'M2.2,2.6 L7.4,2.2 L2.8,6.8 C5.5,5 8.6,6 7.6,8.2 C6.8,9.8 4,9.4 4.6,8 C5,7.2 6.2,7.6 6.4,8.6',
    'M2,3 L7.6,2.6 M4.6,1 C4.4,4 5,7 6.4,9 M6.8,4.6 C4.8,7.4 2.6,8.8 2,7.6 C1.4,6.2 4.6,4.6 7,5 C9,5.4 9.2,8.2 6.6,9.4',
    'M1.6,3 L5.2,2.6 M3.6,1.2 C3.2,3.6 2.4,5.4 1.6,6.4 M6.4,3.4 L8,4.6 M6.2,5.4 C6.4,7.2 6.6,8.4 5.2,9 C3.8,9.6 3.4,8 5,7.8 C6.6,7.6 7.8,8.4 8.4,9.2',
    'M3.4,3.6 C5,4.6 6.4,6 6.8,7.4 C6,8.4 4.8,9.2 3.6,9.6',
    'M2.6,2.4 C2.2,5 2.6,7.6 3.6,8.2 C4.2,7.6 4.4,7 4.6,6.6 M6.8,3.2 C8,4.4 8.4,6 8.2,7',
    'M1.4,3.4 L8.6,3 M5.2,1.4 C5.2,4 5.6,6 4.4,6.4 C3.4,6.6 3.4,5 4.6,5 C5.8,5.2 5.6,7.4 4.6,9.6',
    'M3.4,1.6 C3.8,3 4.2,4.2 4.6,4.8 M6.8,3.2 C4.6,4.8 2.6,6.4 3.2,8 C3.8,9.2 6.4,9.2 8.2,8.6',
    'M4.4,1.6 C5.4,2.2 5.6,3 5,3.4 M5,4 C4.6,6.4 4.2,8 3.6,8.8 M2,6.6 L1.4,8 M7.4,6.2 C8.2,7 8.6,7.8 8.6,8.4',
    'M2,1.8 C3.6,2.6 4.6,3.6 4.2,4.6 C3.6,5.8 2.4,5.4 3.2,4.6 C4.6,3.4 8.4,4 7.8,6.6 C7.2,8.8 4.6,9.4 3,9'];
  const ALPHA = (() => {
    const r = rng(20261119), out = [];
    for (let v = 0; v < 4; v++) for (const t of TPL) {
      // 数字ひとつひとつを少し動かして崩す（v=0 はもとの形に近い）
      const amt = 0.35 + v * 0.35, sx = 0.9 + r() * 0.2, rot = (r() - 0.5) * 0.18;
      const d = t.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => {
        let X = (+x - 5) * sx, Y = +y - 5; [X, Y] = [X * Math.cos(rot) - Y * Math.sin(rot), X * Math.sin(rot) + Y * Math.cos(rot)];
        return (X + 5 + (r() - 0.5) * amt).toFixed(1) + ',' + (Y + 5 + (r() - 0.5) * amt).toFixed(1);
      });
      const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      out.push([{ d, w: 1.15, s: [nums[0], nums[1]], e: [nums[nums.length - 2], nums[nums.length - 1]] }]);
    }
    return out;
  })();
  // 縦の SVG（幅 10、1字ごとに高さ 11）
  function svgV(title, color) {
    const chars = [...title.replace(/\s/g, '')], r = rng(hash('wa' + title)); let y = 0, paths = '', prevEnd = null;
    for (const c of chars) {
      const g = ALPHA[hash(c) % ALPHA.length];
      const main = g.find(s => s.s);
      if (prevEnd && main && r() < 0.45) paths += `<path stroke-width="0.45" d="M${prevEnd[0].toFixed(1)},${prevEnd[1].toFixed(1)} C${prevEnd[0].toFixed(1)},${(prevEnd[1] + 1.2).toFixed(1)} ${main.s[0].toFixed(1)},${(y + main.s[1] - 1.2).toFixed(1)} ${main.s[0].toFixed(1)},${(y + main.s[1]).toFixed(1)}"/>`;
      for (const s of g) paths += `<path stroke-width="${s.w}" transform="translate(0,${y})" d="${s.d}"/>`;
      prevEnd = main ? [main.e[0], y + main.e[1]] : null; y += 11;
    }
    return { w: 10, h: y, html: `<svg viewBox="-0.5 -0.5 11 ${y + 1}" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${color || 'currentColor'}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>` };
  }
  // 文字化け：UTF-8 の字を Shift_JIS として読んだときの化け方（ほんとうの文字化け）。読めないところは「・」
  function mojibake(title) { try { return new TextDecoder('shift_jis').decode(new TextEncoder().encode(title)).replace(/\uFFFD/g, '・').replace(/[\uFF61-\uFF9F]+/g, m => m.normalize('NFKC')); } catch (e) { return title; } }
  G.FAKE.svgV = svgV; G.FAKE.mojibake = mojibake;
})(typeof window !== 'undefined' ? window : globalThis);
