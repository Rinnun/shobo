// If anything fails while starting, say so on screen instead of leaving a dead page.
(function () {
  function show(msg) {
    var box = document.getElementById('bootError');
    if (!box) {
      box = document.createElement('div'); box.id = 'bootError';
      box.style.cssText = 'position:fixed;left:10px;right:10px;top:10px;z-index:99;background:#2a1210;color:#ffd9d2;border:1px solid #a4483d;border-radius:10px;padding:12px 14px;font:13px/1.6 system-ui,sans-serif;white-space:pre-wrap;word-break:break-all;max-height:60vh;overflow:auto';
      (document.body || document.documentElement).appendChild(box);
      box.textContent = 'うまく起動できませんでした。この画面をスクショして送ってください。\n\n';
    }
    box.textContent += msg + '\n';
  }
  // "ResizeObserver loop ..." is a harmless browser notice (seen when the keyboard opens), not a failure
  window.addEventListener('error', function (e) { if (/ResizeObserver loop/.test(e.message || '')) return; show((e.message || 'エラー') + (e.filename ? '\n  ' + e.filename.split('/').pop() + ':' + e.lineno : '')); });
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; show('(promise) ' + (r && (r.message || r.code) || String(r))); });
  window.__bootShow = show;
})();
