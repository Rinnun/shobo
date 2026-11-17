/* 蛇喰鷲書房：BGM の環境音（雨・暖炉・夜の森など）を作る部品。v1.1.16
   画面とは別の作業場所（Worker）で動かして、計算のあいだ画面が固まらないようにする。
   Worker が使えないときは、画面側でも同じものを使う（index.html で renderer.js より前に読み込む）。
   どれも起動時に数十秒分を計算して、最後の 1.5 秒を頭に重ねてなめらかにくり返す。 */
(function (G) {
const AMB = {
  // 2ch の配列を作り、fill(d, ch, N, sr) で中身を書いてもらい、最後の fade 秒を頭に重ねてつなぎ目を消す
  make(sr, sec, fill) {
    const len = Math.floor(sr * sec), fade = Math.floor(sr * 1.5), N = len + fade, out = [];
    for (let c = 0; c < 2; c++) { const d = new Float32Array(N); fill(d, c, N, sr); for (let k = 0; k < fade; k++) { const x = k / fade; d[k] = d[k] * Math.sqrt(x) + d[len + k] * Math.sqrt(1 - x); } out.push(d.subarray(0, len)); }
    return out;
  },
  // ゆっくり揺れる強さ（minS〜maxS 秒ごとに lo〜hi の値へ、なめらかに移る）
  env(N, sr, minS, maxS, lo, hi) {
    const e = new Float32Array(N); let i = 0, a = lo + (hi - lo) * Math.random();
    while (i < N) { const seg = Math.max(1, Math.floor(sr * (minS + (maxS - minS) * Math.random()))), b = lo + (hi - lo) * Math.random(); for (let k = 0; k < seg && i < N; k++, i++) e[i] = a + (b - a) * (1 - Math.cos(Math.PI * k / seg)) / 2; a = b; }
    return e;
  },
  pinkGen() { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0; return () => { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; return (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.11; }; },
  k(f, sr) { return 1 - Math.exp(-2 * Math.PI * f / sr); },
  // 雑音の粒を共鳴させて足す（雨粒・薪のはぜ・時計のカチなど）
  burst(d, t0, sr, f, bw, tau, amp) {
    const r = Math.exp(-Math.PI * f * bw / sr), a1 = 2 * r * Math.cos(2 * Math.PI * f / sr), a2 = r * r, T = sr * tau, L = Math.min(d.length - t0, Math.floor(T * 8));
    let y1 = 0, y2 = 0; for (let k = 0; k < L; k++) { const x = (Math.random() * 2 - 1) * Math.exp(-k / T); const y = a1 * y1 - a2 * y2 + x * (1 - r); y2 = y1; y1 = y; d[t0 + k] += y * amp; }
  },
  tone(d, t0, sr, f, len, amp, att, glide) { // 短い正弦波（虫の声や泡の音）
    let ph = 0; const L = Math.min(d.length - t0, len), A = Math.max(1, att);
    for (let k = 0; k < L; k++) { ph += 2 * Math.PI * f * (1 + (glide || 0) * k / L) / sr; const e = Math.min(1, k / A, (L - k) / A); d[t0 + k] += Math.sin(ph) * amp * e; }
  }
};

/* 雨（案C 本降り） */
function fillRain(d, c, N, sr) {
  const env = AMB.env(N, sr, 2, 5, 0.35, 1), pink = AMB.pinkGen(), kL = AMB.k(380, sr), kH = AMB.k(4800, sr);
  let br = 0, l1 = 0, l2 = 0, h1 = 0, h2 = 0;
  for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; br = (br + 0.02 * w) / 1.02; l1 += kL * (br - l1); l2 += kL * (l1 - l2); const p = pink(); h1 += kH * (p - h1); h2 += kH * (h1 - h2); d[i] = (l2 * 0.85 * 6 + h2 * 0.55) * (0.55 + 0.45 * env[i]); }
  const n = Math.floor(150 * N / sr);
  for (let j = 0; j < n; j++) {
    const t0 = Math.floor(Math.random() * N); if (Math.random() > 0.35 + 0.65 * env[t0]) continue;
    const amp = 0.4 * Math.pow(Math.random(), 2) * (0.6 + 0.4 * Math.random());
    AMB.burst(d, t0, sr, 1500 + 5500 * Math.random(), 0.35, 0.0008 + 0.0025 * Math.random(), amp);
    if (Math.random() < 0.05) AMB.tone(d, t0, sr, 900 + 1800 * Math.random(), Math.floor(sr * (0.012 + 0.02 * Math.random())), amp * 0.5, 20, 0.6);
  }
}

/* 暖炉：低いごうごうという燃える音、炎のさわさわ、薪のぱちぱち */
function fillFire(d, c, N, sr) {
  const fl = AMB.env(N, sr, 0.25, 1.2, 0.6, 1), slow = AMB.env(N, sr, 4, 9, 0.8, 1), pink = AMB.pinkGen();
  const kR = AMB.k(160, sr), kA = AMB.k(2600, sr), kB = AMB.k(500, sr);
  let br = 0, r1 = 0, r2 = 0, a1 = 0, b1 = 0;
  for (let i = 0; i < N; i++) {
    const w = Math.random() * 2 - 1; br = (br + 0.02 * w) / 1.02; r1 += kR * (br - r1); r2 += kR * (r1 - r2);
    const p = pink(); a1 += kA * (p - a1); b1 += kB * (p - b1);
    d[i] = r2 * 3 * slow[i] * (0.7 + 0.3 * fl[i]) + (a1 - b1) * 0.35 * fl[i] * slow[i];
  }
  // ぱちぱち：数粒ずつかたまって鳴る
  const ev = Math.floor(8 * N / sr);
  for (let j = 0; j < ev; j++) {
    let t = Math.floor(Math.random() * N); const cnt = 1 + Math.floor(Math.pow(Math.random(), 2) * 9), base = 1.1 * Math.pow(Math.random(), 1.6);
    for (let q = 0; q < cnt && t < N; q++) { AMB.burst(d, t, sr, 2000 + 6000 * Math.random(), 0.6, 0.00012 + 0.0004 * Math.random(), base * (0.4 + 0.6 * Math.random())); t += Math.floor(sr * (0.004 + 0.035 * Math.random())); }
  }
  // ときどき大きめの「ぽん」
  const pops = Math.floor(0.06 * N / sr);
  for (let j = 0; j < pops; j++) { const t = Math.floor(Math.random() * N), a = 0.35 + 0.35 * Math.random(); AMB.burst(d, t, sr, 500 + 400 * Math.random(), 0.3, 0.002, a * 0.6); AMB.burst(d, t, sr, 4000, 0.6, 0.0003, a * 0.8); }
}

/* 夜の森：やわらかい風と葉ずれ、スズムシ・エンマコオロギ風の声、遠くの虫の合唱。虫には響きをつける */
// 虫の翅の1拍（パルス）：澄んだ音が少し下がりながら鳴る。倍音とざらつきを少し混ぜる
function bugPulse(d, t0, sr, f, len, amp, glide) {
  let ph = 0; const L = Math.min(d.length - t0, len), A = Math.max(1, Math.floor(sr * 0.002));
  for (let k = 0; k < L; k++) {
    const x = k / L; ph += 2 * Math.PI * f * (1 - glide * x) / sr;
    const e = Math.min(1, k / A) * Math.pow(1 - x, 0.6) * (0.9 + 0.1 * (Math.random() * 2 - 1));
    d[t0 + k] += (Math.sin(ph) + 0.08 * Math.sin(2 * ph) + 0.025 * Math.sin(3 * ph)) * amp * e;
  }
}
// スズムシ風「リーン」：細かいパルスの連なりが、ふくらんでしぼむ
function suzuSong(d, t, sr, f0, amp) {
  const dur = 0.3 + 0.35 * Math.random(), per = 0.021 + 0.004 * Math.random(), n = Math.floor(dur / per), f = f0 * (0.985 + 0.03 * Math.random());
  for (let q = 0; q < n; q++) { const x = q / n, e = Math.pow(Math.sin(Math.PI * Math.min(1, x / 0.65 * 0.5 + (x > 0.65 ? (x - 0.65) / 0.35 * 0.5 : 0))), 0.8); bugPulse(d, t + Math.floor(q * per * sr), sr, f * (1 - 0.01 * x) * (0.997 + 0.006 * Math.random()), Math.floor(sr * per * 0.68), amp * (0.25 + 0.75 * e), 0.025); }
  return Math.floor(dur * sr);
}
// エンマコオロギ風「コロコロリー」：3〜4拍の「コロ」を何回か、最後に長めの「リー」
function emmaSong(d, t, sr, f0, amp) {
  let u = t; const reps = 2 + Math.floor(Math.random() * 3), f = f0 * (0.985 + 0.03 * Math.random());
  for (let r = 0; r < reps; r++) { const np = 3 + Math.floor(Math.random() * 2); for (let q = 0; q < np; q++) { bugPulse(d, u, sr, f * (0.996 + 0.008 * Math.random()), Math.floor(sr * 0.017), amp * (0.8 + 0.2 * Math.random()), 0.04); u += Math.floor(sr * 0.033); } u += Math.floor(sr * (0.11 + 0.05 * Math.random())); }
  if (Math.random() < 0.7) { const np = 8 + Math.floor(Math.random() * 8); for (let q = 0; q < np; q++) { bugPulse(d, u, sr, f * (0.996 + 0.008 * Math.random()), Math.floor(sr * 0.015), amp * (1 - 0.6 * q / np), 0.03); u += Math.floor(sr * 0.026); } }
  return u - t;
}
// 1匹ぶんの鳴き方：鳴く→少し間→鳴く…を、ときどき長めに休みながら
function bugTrack(d, sr, kind, f0, amp) {
  let t = Math.floor(Math.random() * sr * 3);
  while (t < d.length - sr) {
    t += kind === 'suzu' ? suzuSong(d, t, sr, f0, amp) : emmaSong(d, t, sr, f0, amp);
    t += Math.floor(sr * (kind === 'suzu' ? 0.35 + 0.6 * Math.random() : 0.4 + 1.0 * Math.random()));
    if (Math.random() < 0.07) t += Math.floor(sr * (2 + 6 * Math.random()));
  }
}
// 簡単な響き（夜の空気の広がり）
function verb(x, sr, t60, ch) {
  const out = new Float32Array(x.length), combs = (ch ? [31.1, 36.7, 40.9, 44.3] : [29.7, 37.1, 41.1, 43.7]).map(ms => Math.floor(sr * ms / 1000));
  for (const D of combs) { const g = Math.pow(10, -3 * D / sr / t60), buf = new Float32Array(D); let i = 0, lp = 0; for (let n = 0; n < x.length; n++) { const y = buf[i]; lp = y * 0.6 + lp * 0.4; buf[i] = x[n] + lp * g; out[n] += y * 0.25; i = (i + 1) % D; } }
  for (const ms of [5.0, 1.7]) { const D = Math.floor(sr * ms / 1000), buf = new Float32Array(D); let i = 0; for (let n = 0; n < out.length; n++) { const z = buf[i], v = out[n] + z * 0.6; buf[i] = v; out[n] = z - v * 0.6; i = (i + 1) % D; } }
  return out;
}
// 風と葉ずれ（虫とは別の長さでくり返して、同じ流れが目立たないようにする）
function fillWind(d, c, N, sr) {
  // ほとんど凪いでいて、ときどきゆっくりそよぐ（6〜14秒ごとの波、2乗して静かな時間を長く）
  const gust = AMB.env(N, sr, 6, 14, 0.05, 0.75), pink = AMB.pinkGen(), kW = AMB.k(500, sr), kWh = AMB.k(180, sr), kLa = AMB.k(25, sr), kHp = AMB.k(2500, sr);
  let w1 = 0, w2 = 0, wh = 0, lv = 0, la = 0, hp = 0;
  for (let i = 0; i < N; i++) {
    const g = gust[i], x = pink(); w1 += kW * (x - w1); w2 += kW * (w1 - w2); wh += kWh * (w2 - wh);
    if (Math.random() < 0.002 * g * g * g) lv += 0.5 + Math.random(); lv *= 0.9985; la += kLa * (lv - la);
    const w = Math.random() * 2 - 1; hp += kHp * (w - hp);
    d[i] = (w2 - wh) * 0.4 * (0.03 + g * g) + (w - hp) * la * 0.005;
  }
}
function fillForest(d, c, N, sr) {
  const near = new Float32Array(N), far = new Float32Array(N);
  (c === 0 ? [['suzu', 4400, 0.05], ['emma', 4600, 0.03]] : [['suzu', 4150, 0.035], ['emma', 4450, 0.045], ['emma', 4950, 0.018]]).forEach(([k, f, a]) => bugTrack(near, sr, k, f, a));
  for (let j = 0; j < 9; j++) bugTrack(far, sr, Math.random() < 0.5 ? 'suzu' : 'emma', 3900 + 1300 * Math.random(), 0.006 + 0.01 * Math.random());
  let fl = 0; const kF = AMB.k(2800, sr); for (let i = 0; i < N; i++) { fl += kF * (far[i] - fl); near[i] += fl; }
  const wet = verb(near, sr, 1.4, c);
  for (let i = 0; i < N; i++) d[i] += near[i] * 0.7 + wet[i] * 0.55;
}

/* 振り子時計の部屋：ごく小さな部屋の気配だけ（時計とオルゴールは別に鳴らす） */
function fillRoom(d, c, N, sr) { const k = AMB.k(180, sr); let br = 0, l = 0; for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; br = (br + 0.02 * w) / 1.02; l += k * (br - l); d[i] = l * 2.5; } }

const FILLS = { rain: [20, fillRain], fire: [30, fillFire], forest: [30, fillForest], wind: [41, fillWind], room: [10, fillRoom] };
// 左右2本の Float32Array（それぞれ自分の入れ物を持つ）を返す
function build(key, sr) { const [sec, fill] = FILLS[key]; return AMB.make(sr, sec, fill).map(a => a.slice()); }
G.SHOBO_AMB = { build, burst: AMB.burst };
if (typeof document === 'undefined' && typeof postMessage === 'function') {
  onmessage = e => { const { key, sr } = e.data; try { const [l, r] = build(key, sr); postMessage({ key, sr, l, r }, [l.buffer, r.buffer]); } catch (err) { postMessage({ key, sr, error: String(err) }); } };
}
})(self);
