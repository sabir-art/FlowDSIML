/* TutoClick — comportements des maquettes (statiques, sans backend).
   - icônes : <i data-icon="nom"></i>  (tracés inspirés de Lucide, licence ISC)
   - shell :  <body data-shell="app" data-page="demos">  → injecte barre latérale + barre du haut
   - modales : [data-open="id"] / [data-close] ; menus : [data-menu="id"] ; onglets : .tabs[role=tablist]
   - toasts : [data-toast="Texte"] ; copie : [data-copy]
   - thème : bouton du bandeau de maquette (clair / sombre / système) */
(function () {
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    play: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 9 5 3-5 3z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.7c1.9.7 3.1 2.5 3.5 5.3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17h.01"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>', chevronRight: '<path d="m9 6 6 6-6 6"/>', chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>', arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="m5 12 5 5L20 7"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    blur: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14h6M10 17h4"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    message: '<path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-5.5A8 8 0 1 1 21 12z"/>',
    form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    duplicate: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    camera: '<path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5z"/><circle cx="12" cy="13" r="3.5"/>',
    puzzle: '<path d="M19.4 14.6a2 2 0 1 0 0-3.2V7a1 1 0 0 0-1-1h-4.4a2 2 0 1 0-3.2 0H6.4a1 1 0 0 0-1 1v4.4a2 2 0 1 0 0 3.2V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
    chrome: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5h8.5M8.97 13.75 4.7 6.4M15.03 13.75 10.8 21"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    chevronUp: '<path d="m6 15 6-6 6 6"/>',
    move: '<path d="M12 2v20M2 12h20"/><path d="m9 5 3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 8.8-8.8M16 7l3 3M18.5 4.5l2 2"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-3h6v3M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M8 15h.01M16 15h.01"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
    send: '<path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>',
    userX: '<circle cx="9" cy="8" r="4"/><path d="M3 21v-1a6 6 0 0 1 12 0v1"/><path d="m17 8 4 4M21 8l-4 4"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  };
  const svg = (name, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${P[name] || ''}</svg>`;
  window.fdIcon = svg;
  const renderIcons = (root = document) => root.querySelectorAll('i[data-icon]').forEach((el) => { el.outerHTML = svg(el.dataset.icon); });

  /* ---- Shell de l'app ---- */
  const LOGO = '<img class="tc-logo tc-logo--l" src="../../brand-tutoclic/production/logo-tutoclick-compact.svg" alt="TutoClick" height="40"><img class="tc-logo tc-logo--d" src="../../brand-tutoclic/production/logo-tutoclick-compact-sombre.svg" alt="TutoClick" height="40">';
  window.fdLogo = LOGO;
  function shell() {
    const b = document.body; if (b.dataset.shell !== 'app') return;
    const page = b.dataset.page || '';
    const cur = (k) => (k === page ? ' aria-current="page"' : '');
    const main = document.querySelector('main');
    const wrap = document.createElement('div'); wrap.className = 'app';
    wrap.innerHTML = `
      <aside class="sidebar" id="sidebar" aria-label="Navigation principale">
        <button class="ws-switch" data-menu="ws-menu" aria-haspopup="menu" aria-expanded="false">
          <span class="ws-logo">A</span><span class="grow"><span class="t-label" style="display:block;font-weight:600">Acme Analytics</span><span class="t-caption subtle">Plan Team · 6 membres</span></span>${svg('chevronDown', 'width="16" height="16"')}
        </button>
        <div class="menu" id="ws-menu" role="menu" hidden style="top:60px;left:12px;width:216px">
          <button role="menuitem"><span class="ws-logo" style="width:20px;height:20px;font-size:10px">A</span>Acme Analytics ${svg('check', 'style="margin-left:auto;color:var(--fd-color-primary)"')}</button>
          <button role="menuitem"><span class="ws-logo" style="width:20px;height:20px;font-size:10px;background:var(--fd-lagoon-100);color:var(--fd-lagoon-800)">B</span>Bolt Agency</button>
          <hr><button role="menuitem">${svg('plus')}Nouveau workspace</button>
        </div>
        <nav class="nav" aria-label="Sections">
          <a href="dashboard.html"${cur('demos')}>${svg('play')}Démos<span class="count">24</span></a>
          <a href="#"${cur('centers')}>${svg('layers')}Démo centers<span class="badge" style="margin-left:auto">V2</span></a>
          <a href="analytics.html"${cur('analytics')}>${svg('chart')}Analytics</a>
          <a href="analytics.html#leads"${cur('leads')}>${svg('users')}Leads<span class="count">128</span></a>
          <div class="nav-title">Dossiers</div>
          <a href="#">${svg('folder')}Sales — Outbound</a>
          <a href="#">${svg('folder')}Site web</a>
          <a href="#">${svg('folder')}Onboarding</a>
          <a href="#">${svg('archive')}Archivées</a>
          <div class="nav-title">Workspace</div>
          <a href="parametres.html"${cur('settings')}>${svg('settings')}Paramètres</a>
          <a href="plans.html"${cur('plans')}>${svg('card')}Plans et facturation</a>
        </nav>
        <div class="sidebar-foot">
          <div class="usage"><div class="row between t-caption"><span>Démos publiées</span><span class="num">18 / ∞</span></div>
            <div class="row between t-caption" style="margin-top:8px"><span>Crédits IA</span><span class="num">820 / 1 000</span></div>
            <div class="progress warn" style="margin-top:6px"><span style="width:82%"></span></div></div>
          <div class="row"><span class="avatar">CM</span><span class="grow"><span class="t-label" style="display:block">Camille Martin</span><span class="t-caption subtle">camille@acme.example</span></span>
          <button class="btn btn-ghost btn-sm btn-icon" aria-label="Se déconnecter">${svg('logout')}</button></div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="btn btn-ghost btn-icon mobile-bar" aria-label="Ouvrir la navigation" data-toggle-sidebar>${svg('menu')}</button>
          <nav class="crumbs" aria-label="Fil d'Ariane">${b.dataset.crumbs || ''}</nav>
          <span class="grow"></span>
          <div class="input-affix hide-sm" style="width:260px">${svg('search')}<input class="input input-sm" type="search" placeholder="Rechercher…  /" aria-label="Rechercher"></div>
          <button class="btn btn-ghost btn-icon" aria-label="Aide">${svg('help')}</button>
          <button class="btn btn-ghost btn-icon" aria-label="Notifications">${svg('bell')}</button>
        </header>
        <div id="main-slot"></div>
      </div>`;
    main.parentNode.insertBefore(wrap, main);
    wrap.querySelector('#main-slot').replaceWith(main);
    main.id = 'contenu';
    const skip = document.createElement('a'); skip.className = 'skip'; skip.href = '#contenu'; skip.textContent = 'Aller au contenu';
    b.prepend(skip);
  }

  /* ---- Bandeau des maquettes ---- */
  function mockNav() {
    if (document.body.dataset.nomocknav !== undefined) return;
    const el = document.createElement('div'); el.className = 'mock-nav'; el.setAttribute('aria-label', 'Navigation des maquettes');
    el.innerHTML = `<span class="hide-sm">Maquette TutoClick (référence DSI)</span><a href="index.html">Sommaire</a><button type="button" data-theme-toggle>${svg('moon', 'width="14" height="14"')}<span>Thème</span></button>`;
    document.body.append(el);
  }
  const themes = ['system', 'light', 'dark'];
  function applyTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem('fd-mock-theme', t); } catch (e) {} }
  try { const t = localStorage.getItem('fd-mock-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  /* ---- Interactions ---- */
  function toast(text) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.append(box); }
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = `${svg('checkCircle')}<div class="grow"><div class="t-label" style="font-weight:600">${text}</div></div><button class="btn btn-ghost btn-sm btn-icon" aria-label="Fermer" style="margin:-4px -8px 0 0">${svg('x')}</button>`;
    t.querySelector('button').onclick = () => t.remove();
    box.append(t); setTimeout(() => t.remove(), 5000);
  }
  window.fdToast = toast;
  let lastTrigger = null;
  function openModal(id, trigger) {
    const m = document.getElementById(id); if (!m) return;
    lastTrigger = trigger; m.hidden = false;
    const f = m.querySelector('[autofocus], input, button, [href]'); f && f.focus();
  }
  function closeModal(m) { m.hidden = true; lastTrigger && lastTrigger.focus(); }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open],[data-close],[data-menu],[data-toast],[data-copy],[data-theme-toggle],[data-toggle-sidebar],[role="tab"],[data-seg] > button');
    document.querySelectorAll('.menu:not([hidden])').forEach((m) => { if (!m.contains(e.target) && !(t && t.dataset.menu === m.id)) { m.hidden = true; document.querySelectorAll(`[data-menu="${m.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false')); } });
    if (!t) { const bd = e.target.classList && e.target.classList.contains('modal-backdrop') ? e.target : null; if (bd) closeModal(bd); return; }
    if (t.dataset.open) { e.preventDefault(); openModal(t.dataset.open, t); }
    else if (t.hasAttribute('data-close')) { closeModal(t.closest('.modal-backdrop')); }
    else if (t.dataset.menu) { e.preventDefault(); e.stopPropagation(); const m = document.getElementById(t.dataset.menu); m.hidden = !m.hidden; t.setAttribute('aria-expanded', String(!m.hidden)); if (!m.hidden) m.querySelector('[role="menuitem"]').focus(); }
    else if (t.dataset.toast) { toast(t.dataset.toast); }
    else if (t.hasAttribute('data-copy')) { const old = t.innerHTML; t.innerHTML = `${svg('check')}<span>Copié</span>`; toast(t.dataset.copy || 'Copié dans le presse-papiers'); setTimeout(() => (t.innerHTML = old), 2000); }
    else if (t.hasAttribute('data-theme-toggle')) { const cur = document.documentElement.dataset.theme || 'system'; const nxt = themes[(themes.indexOf(cur) + 1) % 3]; applyTheme(nxt); toast(`Thème : ${({ system: 'système', light: 'clair', dark: 'sombre' })[nxt]}`); }
    else if (t.hasAttribute('data-toggle-sidebar')) { document.getElementById('sidebar').classList.toggle('open'); }
    else if (t.getAttribute('role') === 'tab') { selectTab(t); }
    else if (t.parentElement && t.parentElement.hasAttribute('data-seg')) { t.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === t))); t.parentElement.dispatchEvent(new CustomEvent('seg', { detail: t.dataset.value, bubbles: true })); }
  });
  function selectTab(t) {
    const list = t.closest('[role="tablist"]');
    list.querySelectorAll('[role="tab"]').forEach((x) => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; const p = document.getElementById(x.getAttribute('aria-controls')); if (p) p.hidden = !on; });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { const m = [...document.querySelectorAll('.modal-backdrop:not([hidden])')].pop(); if (m) closeModal(m); document.querySelectorAll('.menu:not([hidden])').forEach((x) => (x.hidden = true)); }
    const tab = e.target.closest && e.target.closest('[role="tab"]');
    if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')]; const i = tabs.indexOf(tab); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; n.focus(); selectTab(n); }
    if (e.key === '/' && !/input|textarea/i.test(e.target.tagName)) { const s = document.querySelector('input[type="search"]'); if (s) { e.preventDefault(); s.focus(); } }
  });

  /* ---- Faux écran capturé : <div data-fake="dashboard|list|modal"> ---- */
  function renderFakes() {
    document.querySelectorAll('[data-fake]:not([data-done])').forEach((el) => {
      const v = el.dataset.fake;
      const nav = [0, 1, 2, 3, 4].map((i) => `<div class="f-nav${i === (v === 'list' ? 2 : 1) ? ' on' : ''}"></div>`).join('');
      const cards = '<div class="f-cards">' + [0, 1, 2].map(() => '<div class="f-card"><i></i><b></b></div>').join('') + '</div>';
      const lines = '<div class="f-table">' + ['', 'w70', '', 'w50', '', 'w70'].map((c) => `<div class="f-line ${c}"></div>`).join('') + '</div>';
      el.innerHTML = `<div class="fake ${v === 'list' ? 'v2' : ''}" aria-hidden="true"><div class="f-side"><div class="f-logo"></div>${nav}</div>
        <div class="f-main"><div class="f-top"><div class="f-h"></div><div class="f-btn" style="height:auto"></div></div>${cards}${lines}</div>
        ${v === 'modal' ? '<div class="f-modal"><div class="f-line w50" style="height:10%;background:#1E2433;opacity:.8"></div><div class="f-line"></div><div class="f-line w70"></div><div class="f-btn" style="width:40%;height:14%;margin-top:auto;align-self:flex-end"></div></div>' : ''}</div>`;
      el.dataset.done = '1';
    });
  }
  window.fdRenderFakes = renderFakes;

  document.addEventListener('DOMContentLoaded', () => { shell(); mockNav(); renderFakes(); renderIcons(); document.dispatchEvent(new Event('fd:ready')); });
})();
