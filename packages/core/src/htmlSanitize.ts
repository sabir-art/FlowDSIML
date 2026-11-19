/**
 * A8 : assainissement d'une capture HTML (côté extension ; le serveur assainit à nouveau). Retire
 * tout ce qui peut exécuter du code, charger un contenu tiers ou garder une saisie : scripts,
 * cadres, objets, gestionnaires on*, URL javascript:, valeurs des champs. Le résultat est inerte.
 */
const DROP =
  'script,noscript,iframe,frame,frameset,object,embed,applet,base,template,portal,meta[http-equiv],link,dialog[open] script';
const URL_ATTRS = [
  'href',
  'src',
  'xlink:href',
  'action',
  'formaction',
  'poster',
  'background',
  'cite',
  'data',
];
const BAD_URL = /^\s*(javascript|vbscript|data:(?!image\/(png|jpe?g|gif|webp|svg\+xml|avif)[;,]))/i;

/** CSS sans import ni exécution (expression(), javascript:, behavior, -moz-binding). */
export function sanitizeCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'x(')
    .replace(/(behavior|-moz-binding)\s*:[^;}]*/gi, '')
    .replace(/url\(\s*(['"]?)\s*(javascript|vbscript):[^)]*\)/gi, 'url()');
}

export function sanitizeDom(root: Element): void {
  for (const el of [...root.querySelectorAll(DROP)]) el.remove();
  const all = [root, ...root.querySelectorAll('*')];
  for (const el of all) {
    for (const a of [...el.attributes]) {
      const name = a.name.toLowerCase();
      if (
        name.startsWith('on') ||
        name === 'srcdoc' ||
        name === 'formaction' ||
        name === 'autofocus' ||
        name === 'nonce' ||
        name === 'integrity'
      ) {
        el.removeAttribute(a.name);
        continue;
      }
      if (URL_ATTRS.includes(name) && BAD_URL.test(a.value)) el.removeAttribute(a.name);
      if (name === 'style') el.setAttribute('style', sanitizeCss(a.value));
    }
    const tag = el.tagName.toLowerCase();
    if (tag === 'form') {
      el.removeAttribute('action');
      el.removeAttribute('method');
      el.removeAttribute('target');
    }
    if (tag === 'input') {
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (!['button', 'submit', 'reset', 'image'].includes(type)) el.removeAttribute('value');
      el.removeAttribute('checked');
    }
    if (tag === 'textarea') el.textContent = '';
    if (tag === 'option') el.removeAttribute('selected');
    if (tag === 'style') el.textContent = sanitizeCss(el.textContent ?? '');
    // SVG : <use> et <a> vers l'extérieur, animations qui réécrivent un lien
    if ((tag === 'set' || tag === 'animate') && /href/i.test(el.getAttribute('attributeName') ?? ''))
      el.remove();
  }
}
