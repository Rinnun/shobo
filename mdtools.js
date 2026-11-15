// Shared Markdown helpers (same rules as the Windows build's store.js).
(function (root) {
'use strict';
const CH_RE = /\.(md|markdown|txt)$/i;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
function sanitize(name) {
  let s = String(name || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').trim();
  if (!s) s = '無題';
  if (RESERVED.test(s)) s = '_' + s;
  if (s[0] === '_') s = '＿' + s.slice(1); // the listing skips names starting with _ or .
  if (s[0] === '.') s = '．' + s.slice(1);
  return s.slice(0, 100);
}
// v1.1.12: setting「空白と改行も字数に数える」(the app sets it through api.setCountMode)
let countWs = false;
const countChars = s => countWs ? Array.from(String(s || '').replace(/\r/g, '')).length : Array.from(String(s || '').replace(/[\s　]/g, '')).length;
const setCountWs = ws => { ws = !!ws; const changed = ws !== countWs; countWs = ws; return changed; };
const baseName = f => String(f || '無題').replace(CH_RE, '');
const trimBlank = s => s.replace(/^\s*\n/, '').replace(/\s+$/, '');

// Strip leftovers that some exporters put into Markdown: <br> tags, hard-break markers
// (trailing "\" or trailing spaces), backslash escapes and HTML entities.
// Leading full-width spaces (paragraph indents) are left alone.
const ENT = { nbsp: ' ', ensp: ' ', emsp: '　', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
// When a file uses <br> (or &nbsp;-only lines) for empty lines, its blank lines are Markdown
// paragraph separators: each separator becomes one plain newline, and a paragraph that is only
// <br> becomes one empty line. Files without <br> keep their line breaks exactly as they are.
function cleanMd(text) {
  let s = String(text).replace(/\r\n?/g, '\n');
  const exported = /<br\s*\/?>/i.test(s) || /^[ \t]*&nbsp;[ \t]*$/m.test(s);
  if (exported) {
    const lead = s.match(/^\n*/)[0], tail = s.match(/\n*$/)[0];
    s = s.slice(lead.length, s.length - tail.length)
      .split(/\n[ \t]*(?:\n[ \t]*)+/)
      .map(block => block.split('\n').map(line => line.replace(/(<br\s*\/?>[ \t]*)+$/i, '')).join('\n'))
      .join('\n') + (tail ? '\n' : '');
  }
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!~|>"'])/g, '$1');
  s = s.replace(/\\$/gm, '');
  s = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return m; } }
    const v = ENT[e.toLowerCase()]; return v === undefined ? m : v;
  });
  s = s.replace(/[ \t ]+$/gm, '');
  return s;
}

function parseMd(text, fname, level) {
  text = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!level) {
    // a heading on the first line ("## 001.砂漠万年青") becomes the chapter title and leaves the body
    const h = text.match(/^\n*#{1,3}[ \t]+(.+?)[ \t]*#*[ \t]*(?:\n|$)/);
    if (h) return { workTitle: null, chapters: [{ title: h[1].trim(), body: text.slice(h[0].length).replace(/^\n+/, '') }] };
    return { workTitle: null, chapters: [{ title: baseName(fname), body: text }] };
  }
  const re = new RegExp('^' + '#'.repeat(level) + '[ \\t]+(.+)$');
  let workTitle = null; const parts = []; let cur = null;
  for (const line of text.split('\n')) {
    const m = line.match(re);
    if (m) { if (cur) parts.push(cur); cur = { title: m[1].trim(), lines: [] }; continue; }
    if (level === 2 && !cur && !workTitle) { const h = line.match(/^#[ \t]+(.+)$/); if (h) { workTitle = h[1].trim(); continue; } }
    if (!cur) cur = { title: null, lines: [] };
    cur.lines.push(line);
  }
  if (cur) parts.push(cur);
  const chapters = parts.map(p => ({ title: p.title || 'はじめに', body: trimBlank(p.lines.join('\n')) + '\n' }))
    .filter(p => p.title !== 'はじめに' || p.body.trim());
  return { workTitle, chapters: chapters.length ? chapters : [{ title: baseName(fname), body: '' }] };
}

// Back to the exported-Markdown shape: each line its own paragraph, empty lines written as <br>.
function toBrMd(body) {
  const lines = String(body).replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  return lines.map(l => l.trim() === '' ? '<br>' : l).join('\n\n') + '\n';
}
function chapterFileText(title, body, opts) {
  const o = opts || {};
  let t = o.br ? toBrMd(body) : String(body);
  if (o.heading) t = '## ' + title + '\n\n' + t;
  return t;
}


root.MdTools = { CH_RE, sanitize, countChars, setCountWs, baseName, cleanMd, parseMd, toBrMd, chapterFileText };
})(window);
