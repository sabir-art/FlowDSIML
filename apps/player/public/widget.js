/*!
 * TutoClick : widget « bouton + pop-up » (L16). Sans dépendance, à intégrer tel quel :
 * <script src="https://<lecteur>/widget.js" data-demo="<identifiant>" data-label="Voir le tutoriel"
 *   data-size="large" data-start="click" data-lang="fr" defer></script>
 * - Le module s'ouvre dans une fenêtre modale (<dialog>) : focus piégé, Échap ferme, focus rendu au bouton.
 * - L'iframe n'est chargée qu'à l'ouverture et pointe toujours vers le lecteur qui sert ce script.
 * - Aucun cookie, aucun traceur : les statistiques sont celles du lecteur (règles d'accès inchangées).
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || !script.src) return;
  var d = script.dataset;
  var id = String(d.demo || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  var base = new URL('.', script.src).href;
  var lang = d.lang === 'en' ? 'en' : d.lang === 'fr' ? 'fr' : '';
  var color = /^#[0-9a-f]{6}$/i.test(d.color || '') ? d.color : '#A3195B';
  var size = d.size === 'medium' ? 'medium' : 'large';
  var label = (d.label || (lang === 'en' ? 'Watch the tutorial' : 'Voir le tutoriel')).slice(0, 60);
  var title = (d.title || label).slice(0, 120);
  var closeLabel = lang === 'en' ? 'Close' : 'Fermer';
  var q = [];
  if (d.start === 'click') q.push('start=click');
  if (lang) q.push('lang=' + lang);
  var src = base + '#/d/' + id + (q.length ? '?' + q.join('&') : '');

  var css =
    '.tcw-btn{position:fixed;z-index:2147483000;bottom:20px;' +
    (d.position === 'left' ? 'left' : 'right') +
    ':20px;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border:0;' +
    'border-radius:999px;background:' +
    color +
    ';color:#fff;font:600 15px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;' +
    'box-shadow:0 6px 20px rgba(0,0,0,.22)}' +
    '.tcw-btn:focus-visible{outline:3px solid #fff;box-shadow:0 0 0 6px ' +
    color +
    '}' +
    '.tcw-btn[data-inline]{position:static;box-shadow:none}' +
    '.tcw-dlg{padding:0;border:0;border-radius:16px;background:#0b0d10;overflow:hidden;' +
    (size === 'medium'
      ? 'width:min(960px,96vw);height:min(644px,92vh)'
      : 'width:min(1280px,96vw);height:min(860px,92vh)') +
    '}' +
    '.tcw-dlg::backdrop{background:rgba(8,10,14,.6)}' +
    '.tcw-dlg iframe{display:block;width:100%;height:100%;border:0}' +
    '.tcw-x{position:absolute;top:8px;right:8px;width:40px;height:40px;border:0;border-radius:50%;' +
    'background:rgba(255,255,255,.92);color:#080808;font:600 22px/1 system-ui,sans-serif;cursor:pointer}' +
    '.tcw-x:focus-visible{outline:3px solid ' +
    color +
    ';outline-offset:2px}' +
    '@media (prefers-reduced-motion:no-preference){.tcw-dlg[open]{animation:tcw-in .18s ease-out}}' +
    '@keyframes tcw-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tcw-btn';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  btn.appendChild(document.createTextNode(label));

  var dlg = document.createElement('dialog');
  dlg.className = 'tcw-dlg';
  dlg.setAttribute('aria-label', title);
  var x = document.createElement('button');
  x.type = 'button';
  x.className = 'tcw-x';
  x.setAttribute('aria-label', closeLabel);
  x.textContent = '×';
  dlg.appendChild(x);

  btn.addEventListener('click', function () {
    if (!dlg.querySelector('iframe')) {
      var f = document.createElement('iframe');
      f.src = src;
      f.title = title;
      f.allow = 'fullscreen; clipboard-write';
      dlg.insertBefore(f, x);
    }
    dlg.showModal();
    x.focus();
  });
  x.addEventListener('click', function () {
    dlg.close();
  });
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener('close', function () {
    btn.focus();
  });
  // Échap pressé dans le lecteur (focus dans l'iframe) : message du lecteur, origine vérifiée
  var playerOrigin = new URL(base).origin;
  window.addEventListener('message', function (e) {
    if (e.origin === playerOrigin && e.data && e.data.type === 'tutoclick:escape' && dlg.open) dlg.close();
  });

  // data-target="#id" : bouton placé dans la page au lieu d'être flottant
  function mount() {
    var target = null;
    try {
      target = d.target ? document.querySelector(d.target) : null;
    } catch (e) {
      target = null;
    }
    if (target) {
      btn.setAttribute('data-inline', '');
      target.appendChild(btn);
    } else document.body.appendChild(btn);
    document.body.appendChild(dlg);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
