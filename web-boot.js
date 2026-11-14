// iPhone web version: offline cache, keeping the data, and the "add to Home Screen" guide.
(function () {
'use strict';
const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
document.documentElement.classList.add('web');
if (isIOS) document.documentElement.classList.add('ios');
if (standalone) document.documentElement.classList.add('standalone');

// works without a connection once it has been opened (sw.js keeps the app's files)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
// ask the browser not to clear this app's storage when the iPhone runs low on space
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then(p => { if (!p && (standalone || !isIOS)) return navigator.storage.persist(); }).catch(() => {});
}

// Safari tabs and the Home Screen app keep separate data, and Safari may clear a tab's data
// after 7 days without a visit, so the writing has to happen in the Home Screen app.
const SKIP = 'shobo.web.trySafari';
function guide() {
  if (!isIOS || standalone) return;
  try { if (sessionStorage.getItem(SKIP)) return; } catch (e) {}
  const box = document.createElement('div'); box.className = 'web-guide';
  box.innerHTML = `
  <div class="web-guide-in">
    <img src="icon-180.png" alt="" class="wg-icon">
    <h2>蛇喰鷲書房</h2>
    <p class="wg-lead">はじめに<b>ホーム画面に追加</b>してから使ってください。</p>
    <ol class="wg-steps">
      <li><span class="wg-n">1</span><span>画面の下（または上）の <b>共有ボタン</b> <svg class="wg-share" viewBox="0 0 20 24" aria-label="共有"><path d="M10 2v13M5.5 6.5 10 2l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 10H4v12h12V10h-2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg> を押します。<span class="wg-sub">見つからないときは「…」を押すと出てきます。</span></span></li>
      <li><span class="wg-n">2</span><span>下にずらして <b>「ホーム画面に追加」</b> を押し、右上の「追加」を押します。</span></li>
      <li><span class="wg-n">3</span><span>ホーム画面にできた <b>金色の羽ペン</b> から開きます。このSafariの画面は閉じてかまいません。</span></li>
    </ol>
    <div class="wg-why">
      <p><b>なぜ？</b> 原稿はインターネットではなく、このiPhoneの中に保存されます。Safariのままだと、しばらく開かないと保存した中身が消されることがあります。ホーム画面から開けば消されません。</p>
      <p>Safariで書いたものとホーム画面の書房は<b>別の保存場所</b>になり、あとから移せません。書くのはホーム画面の書房だけにしてください。</p>
    </div>
    <button type="button" class="btn ghost sm wg-try">Safariのまま見てみる（書いたものは残らないかもしれません）</button>
  </div>`;
  document.body.appendChild(box);
  box.querySelector('.wg-try').addEventListener('click', () => { try { sessionStorage.setItem(SKIP, '1'); } catch (e) {} box.remove(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guide); else guide();
})();
