/*!
 * TutoClick : bouton + pop-up (L16). Sans dépendance. Le bouton fait partie de la page hôte :
 * <button type="button" data-tutoclick="<identifiant>">Lancer le tutoriel</button>
 * <script src="https://<lecteur>/popup.js" defer></script>
 * Options sur le bouton : data-tutoclick-float (flottant en bas à droite), data-tutoclick-start="click",
 * data-tutoclick-lang="fr|en".
 * - Le module s'ouvre dans une fenêtre modale (<dialog>) : focus piégé, Échap ferme (y compris depuis le
 *   lecteur), focus rendu au bouton.
 * - L'iframe n'est chargée qu'à l'ouverture et pointe toujours vers le lecteur qui sert ce script.
 * - Aucun cookie, aucun traceur : les statistiques sont celles du lecteur (règles d'accès inchangées).
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || !script.src || window.__tutoclickPopup) return;
  window.__tutoclickPopup = true;
  var base = new URL('.', script.src).href;
  var playerOrigin = new URL(base).origin;
  var css =
    '.tcp-float{position:fixed;z-index:2147483000;bottom:20px;right:20px;min-height:44px;padding:0 18px;' +
    'border:0;border-radius:999px;background:#A3195B;color:#fff;font:600 15px/1 system-ui,-apple-system,' +
    '"Segoe UI",sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.22)}' +
    '.tcp-float:focus-visible{outline:3px solid #fff;box-shadow:0 0 0 6px #A3195B}' +
    '.tcp-dlg{padding:0;border:0;border-radius:16px;background:#0b0d10;overflow:hidden;' +
    'width:min(1280px,96vw);height:min(860px,92vh)}' +
    '.tcp-dlg::backdrop{background:rgba(8,10,14,.6)}' +
    '.tcp-dlg iframe{display:block;width:100%;height:100%;border:0}' +
    '.tcp-x{position:absolute;top:8px;right:8px;width:40px;height:40px;border:0;border-radius:50%;' +
    'background:rgba(255,255,255,.92);color:#080808;font:600 22px/1 system-ui,sans-serif;cursor:pointer}' +
    '.tcp-x:focus-visible{outline:3px solid #A3195B;outline-offset:2px}' +
    '@media (prefers-reduced-motion:no-preference){.tcp-dlg[open]{animation:tcp-in .18s ease-out}}' +
    '@keyframes tcp-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}';

  var dlg;
  var x;
  var opener = null;
  function ensureDialog() {
    if (dlg) return;
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    dlg = document.createElement('dialog');
    dlg.className = 'tcp-dlg';
    x = document.createElement('button');
    x.type = 'button';
    x.className = 'tcp-x';
    x.textContent = '×';
    dlg.appendChild(x);
    document.body.appendChild(dlg);
    x.addEventListener('click', function () {
      dlg.close();
    });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close();
    });
    dlg.addEventListener('close', function () {
      var f = dlg.querySelector('iframe');
      if (f) f.remove();
      if (opener) opener.focus();
    });
    // Échap pressé dans le lecteur (focus dans l'iframe) : message du lecteur, origine vérifiée
    window.addEventListener('message', function (e) {
      if (e.origin === playerOrigin && e.data && e.data.type === 'tutoclick:escape' && dlg.open) dlg.close();
    });
  }

  function open(el) {
    var id = String(el.getAttribute('data-tutoclick') || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    ensureDialog();
    var lang = el.getAttribute('data-tutoclick-lang');
    var en = lang === 'en';
    var q = [];
    if (el.getAttribute('data-tutoclick-start') === 'click') q.push('start=click');
    if (lang === 'fr' || lang === 'en') q.push('lang=' + lang);
    var title = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 120) || 'TutoClick';
    var f = document.createElement('iframe');
    f.src = base + '#/d/' + id + (q.length ? '?' + q.join('&') : '');
    f.title = title;
    f.allow = 'fullscreen; clipboard-write';
    dlg.insertBefore(f, x);
    dlg.setAttribute('aria-label', title);
    x.setAttribute('aria-label', en ? 'Close' : 'Fermer');
    opener = el;
    dlg.showModal();
    x.focus();
  }

  function bind(root) {
    var list = root.querySelectorAll('[data-tutoclick]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.__tutoclick) continue;
      el.__tutoclick = true;
      el.setAttribute('aria-haspopup', 'dialog');
      if (el.hasAttribute('data-tutoclick-float')) el.classList.add('tcp-float');
      el.addEventListener('click', function (e) {
        e.preventDefault();
        open(e.currentTarget);
      });
    }
  }
  function start() {
    if (document.querySelector('[data-tutoclick-float]')) ensureDialog();
    bind(document);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
