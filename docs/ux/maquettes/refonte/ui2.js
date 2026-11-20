/* UI v2 : icônes Lucide (tracés recopiés), cadre d'app et sélecteur Après / Avant. */
window.U2 = (() => {
  const P = {
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    grad: '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    puzzle: '<path d="M19.44 7.85c-.47.47-1.1.72-1.73.72H16a1 1 0 0 1-1-1V5.3c0-.64.25-1.27.72-1.73a2.5 2.5 0 1 0-3.44 0c.47.46.72 1.09.72 1.73v1.27a1 1 0 0 1-1 1H8.3c-.64 0-1.27-.25-1.73-.72a2.5 2.5 0 1 0 0 3.44c.46-.47 1.09-.72 1.73-.72H10a1 1 0 0 1 1 1v1.71c0 .64-.25 1.27-.72 1.73a2.5 2.5 0 1 0 3.44 0c-.47-.46-.72-1.09-.72-1.73V12.3a1 1 0 0 1 1-1h1.71c.64 0 1.27.25 1.73.72a2.5 2.5 0 1 0 0-3.44"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    img: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    bell: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',
    sort: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
    send: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    spark: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    unlink: '<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/>',
    bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
    italic: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
    dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
  };
  const I = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[n]}</svg>`;
  const LOGO = '../../brand-tutoclic/production/';
  const side = (cur = 'demos') => {
    const it = (k, ic, t) => `<a class="u2-nav" href="#" ${cur === k ? 'aria-current="page"' : ''}>${I(ic)}${t}</a>`;
    return `<aside class="u2-side"><img class="logo logo-l" src="${LOGO}logo-tutoclick-compact.svg" alt="TutoClick"><img class="logo logo-d" src="${LOGO}logo-tutoclick-compact-sombre.svg" alt="TutoClick">
      <nav aria-label="Navigation principale" style="display:flex;flex-direction:column;gap:2px">${it('demos', 'grid', 'Démos')}${it('sandbox', 'map', 'Sandbox')}${it('parcours', 'route', 'Parcours de formation')}${it('analytics', 'chart', 'Analytics')}<div class="u2-navsec">Formation</div>${it('apprenants', 'grad', 'Apprenants')}</nav>
      <span class="sp"></span><nav aria-label="Utilitaires" style="display:flex;flex-direction:column;gap:2px">${it('ext', 'puzzle', 'Extension')}${it('aide', 'help', 'Centre d’aide')}${it('settings', 'gear', 'Paramètres')}</nav>
      <div class="u2-me" style="margin-top:12px"><i>CM</i><span><b>Camille Martin</b><small>Acme Formation</small></span></div></aside>`;
  };
  const app = (cur, main, opts = {}) => `<div class="u2-app${opts.bare ? ' u2-app--bare' : ''}"${opts.theme ? ` data-theme="${opts.theme}"` : ''}${opts.h ? ` style="min-height:${opts.h}px"` : ''}>${opts.bare ? '' : side(cur)}<main class="u2-main">${main}</main></div>`;
  // Sélecteur Après / Avant (segmenté), un par section
  const switcher = () => {
    document.querySelectorAll('[data-u2-pair]').forEach((sec) => {
      const seg = sec.querySelector('.u2-seg');
      if (!seg) return;
      const panes = sec.querySelectorAll('[data-pane]');
      seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        panes.forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.show; });
      }));
    });
  };
  const pair = (title, after, beforeSrc, beforeAlt, sub = '', beforeLabel = 'Avant (app actuelle)') => `<section class="u2-sec" data-u2-pair><div style="display:flex;align-items:center;gap:16px"><h2 style="margin:0;font-size:18px;flex:1">${title}</h2><span class="fd-segmented u2-seg" role="group" aria-label="Version affichée"><button type="button" aria-pressed="true" data-show="apres">Après</button><button type="button" aria-pressed="false" data-show="avant">${beforeLabel}</button></span></div>${sub ? `<p>${sub}</p>` : ''}<div data-pane="apres">${after}</div><div class="u2-av" data-pane="avant" hidden><img src="${beforeSrc}" alt="${beforeAlt}"></div></section>`;
  document.addEventListener('DOMContentLoaded', () => setTimeout(switcher, 0));
  return { I, app, side, pair };
})();
