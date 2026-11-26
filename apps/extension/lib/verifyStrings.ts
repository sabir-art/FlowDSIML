/** EXT-02 §2 : chaînes de l'écran « Vérifier avant l'envoi » (capture HTML). FR par défaut. */
const fr = {
  title: 'Vérifier avant l’envoi',
  intro:
    'Votre démo est une copie fixe des pages, et la navigation est rejouée à partir de vos clics. Voici ce que TutoClick n’a pas copié ou a protégé. Vous n’avez rien à faire, sauf si vous voulez garder un élément.',
  name: 'Titre de la démo',
  nameDefault: 'Capture du {{date}}',
  nameMissing: 'Donnez un titre à la démo.',
  type: 'Type',
  guided: 'Démo guidée',
  sandbox: 'Sandbox',
  append: 'Pages ajoutées au Sandbox « {{name}} »',
  appendUnnamed: 'Pages ajoutées au Sandbox d’où vous avez lancé la capture',
  sumPages: 'Pages copiées',
  sumScripts: 'Scripts non copiés',
  sumProtected: 'Protégés',
  sumKept: 'Gardés par vous',
  note_one:
    '1 script n’est pas copié ({{page}} de la page, {{track}} de suivi) : la démo n’en a pas besoin, la navigation est rejouée à partir de vos clics.',
  note_other:
    '{{n}} scripts ne sont pas copiés ({{page}} de la page, {{track}} de suivi) : la démo n’en a pas besoin, la navigation est rejouée à partir de vos clics.',
  group: {
    pages: 'Pages copiées',
    pageScripts: 'Scripts de la page',
    trackingScripts: 'Scripts de suivi',
    frames: 'Cadres intégrés',
    forms: 'Formulaires',
    pii: 'Données personnelles remplacées',
    externalLinks: 'Liens externes',
  },
  state: {
    pageScripts: 'Non copiés : la démo n’en a pas besoin',
    trackingScripts: 'Non copiés : ils mesurent l’audience du site',
    forms: 'Affichés, sans envoi',
    pii: 'Remplacées par des valeurs fictives',
    externalLinks: 'Désactivés',
  },
  pagesReady: 'Prêtes à l’envoi',
  pagesHeavy_one: '1 page trop lourde',
  pagesHeavy_other: '{{n}} pages trop lourdes',
  framesRemoved_one: '1 retiré',
  framesRemoved_other: '{{n}} retirés',
  keptCount_one: '1 gardé',
  keptCount_other: '{{n}} gardés',
  why: 'Pourquoi ?',
  whyOf: 'Pourquoi ? {{name}}',
  show: 'Voir',
  hide: 'Masquer',
  showOf: 'Voir : {{name}}',
  hideOf: 'Masquer : {{name}}',
  keep: 'Garder',
  keepOf: 'Garder : {{name}}',
  remove: 'Retirer',
  removeOf: 'Retirer : {{name}}',
  more: 'Afficher 20 de plus',
  shown: '{{shown}} sur {{total}}',
  filter: 'Filtrer par nom ou par source',
  filterOf: 'Filtrer : {{group}}',
  noMatch: 'Aucun élément ne correspond.',
  status: {
    notCopied: 'Non copié',
    removed: 'Retiré',
    replaced: 'Remplacé',
    disabled: 'Désactivé',
    kept: 'Gardé',
    ready: 'Prête',
    heavy: 'Trop lourde',
  },
  inPage: 'dans la page',
  fallback: {
    scriptInline: 'Script écrit dans la page',
    widget: 'Élément ajouté par un script',
    script: 'Script',
    frame: 'Cadre intégré',
    frameVideo: 'Vidéo intégrée',
    frameMap: 'Carte intégrée',
    form: 'Formulaire',
    link: 'Lien',
    pii: 'Donnée',
  },
  groupWhy: {
    pageScripts:
      'La démo est une copie fixe de la page. La navigation est rejouée à partir de vos clics, sans exécuter le code du site. Hors du site d’origine, ces scripts ne fonctionneraient pas de toute façon.',
    trackingScripts:
      'Ces scripts mesurent l’audience du site d’origine. Dans une démo, ils enverraient des données sur vos visiteurs à des tiers : ils ne sont jamais copiés.',
    frames:
      'Un cadre intégré charge une autre page à l’intérieur de la vôtre. Il est retiré, parce qu’il exécuterait du code extérieur dans la démo.',
    forms:
      'Les formulaires restent affichés, mais ils n’envoient rien : aucune donnée saisie dans la démo ne part vers le site d’origine.',
    pii: 'TutoClick a repéré ces données sur la page et les a remplacées par des valeurs fictives avant de la copier. « Garder » rétablit le texte d’origine dans la démo.',
    externalLinks:
      'Un lien vers un autre site est désactivé pour que le visiteur reste dans la démo. « Garder » le réactive : le visiteur verra d’abord « Vous quittez la démo ».',
  },
  reasonWhy: {
    scriptInline:
      'Code écrit dans la page. La démo est une copie fixe : la navigation est rejouée à partir de vos clics, sans exécuter ce code.',
    scriptSameSite:
      'Script du site. La démo est une copie fixe : la navigation est rejouée à partir de vos clics, sans exécuter ce script.',
    scriptThirdParty:
      'Script chargé depuis un autre site. Hors du site d’origine, il ne fonctionnerait pas, et la démo n’en a pas besoin.',
    widgetThirdParty:
      'Ajouté à la page par un script d’un autre site (discussion, cookies, aide). Dans la démo, il ne réagirait pas aux clics : il est retiré. « Garder » le laisse affiché, sans effet.',
    scriptTracking:
      'Script de mesure d’audience. Dans une démo, il enverrait des données sur vos visiteurs à un tiers.',
    frameVideo:
      'Vidéo intégrée d’un fournisseur reconnu. Les vidéos intégrées ne sont pas encore reprises dans la démo : le cadre est retiré.',
    frameMap:
      'Carte intégrée d’un fournisseur reconnu. Les cartes intégrées ne sont pas encore reprises dans la démo : le cadre est retiré.',
    frameThirdParty:
      'Cadre qui charge une autre page à l’intérieur de la vôtre. Il exécuterait du code extérieur dans la démo : il est retiré.',
    form: 'Le formulaire reste affiché, mais il n’envoie rien : aucune donnée saisie dans la démo ne part vers le site d’origine.',
    pii: 'Donnée personnelle repérée sur la page, remplacée par une valeur fictive. « Garder » rétablit le texte d’origine dans la démo.',
    piiKept:
      'Vous gardez cette donnée : le texte d’origine sera visible dans la démo. « Retirer » la remplace de nouveau.',
    linkExternal:
      'Lien vers un autre site, désactivé pour que le visiteur reste dans la démo. « Garder » le réactive : le visiteur verra d’abord « Vous quittez la démo ».',
    linkKept:
      'Vous gardez ce lien : dans la démo, le visiteur verra d’abord « Vous quittez la démo » et choisira de continuer ou non.',
    linkLocked:
      'Lien vers un autre site, désactivé. Il ne peut pas être gardé : son adresse n’est pas sécurisée (http). Seuls les liens en https peuvent l’être.',
  },
  pageWhyReady: 'La page est copiée en entier. Elle pèse {{size}}, sous la limite de {{max}} par page.',
  pageWhyHeavy:
    '« {{title}} » pèse {{size}}, au-delà des {{max}} permis par page : elle ne sera pas envoyée. Retirez-la, ou recapturez-la avec moins de contenu affiché.',
  // NUM-01 : espace insécable entre le nombre et l'unité
  size: '{{n}}\u00a0Mo',
  sizeKb: '{{n}}\u00a0Ko',
  pageN: '{{n}}. {{title}}',
  server: 'Le serveur applique les mêmes règles à l’envoi.',
  delete: 'Supprimer la capture',
  send: 'Envoyer',
  sending: 'Envoi… {{done}} sur {{total}}',
  sent: 'Envoyé. Ouverture de l’éditeur…',
  sendError: 'L’envoi a échoué. Réessayez.',
  nothing: 'Aucune page à vérifier.',
  noPageLeft: 'Il ne reste aucune page à envoyer.',
  cancel: 'Annuler',
  keepLinkTitle: 'Garder ce lien externe ?',
  keepLinkBody:
    '« {{label}} » mène à {{host}}. Dans la démo, le visiteur verra d’abord « Vous quittez la démo » et choisira de continuer ou non.',
  keepLinkOk: 'Garder le lien',
  deleteTitle: 'Supprimer la capture ?',
  deleteBody: 'Les pages seront effacées de ce navigateur. Rien n’a été envoyé.',
  deleteOk: 'Supprimer la capture',
  pageRemoved: '« {{title}} » est retirée de la démo.',
  undo: 'Annuler',
  srv_one: 'Démo envoyée. 1 élément gardé a été retiré par le serveur.',
  srv_other: 'Démo envoyée. {{n}} éléments gardés ont été retirés par le serveur.',
  srvLink: 'Lien « {{label}} » ({{host}}) : adresse signalée comme dangereuse.',
  openDemo: 'Ouvrir la démo',
};

const en: typeof fr = {
  title: 'Check before sending',
  intro:
    'Your demo is a fixed copy of the pages, and navigation is replayed from your clicks. Here is what TutoClick did not copy or has protected. You have nothing to do, unless you want to keep an item.',
  name: 'Demo title',
  nameDefault: 'Capture of {{date}}',
  nameMissing: 'Give the demo a title.',
  type: 'Type',
  guided: 'Guided demo',
  sandbox: 'Sandbox',
  append: 'Pages added to the Sandbox “{{name}}”',
  appendUnnamed: 'Pages added to the Sandbox you started the capture from',
  sumPages: 'Pages copied',
  sumScripts: 'Scripts not copied',
  sumProtected: 'Protected',
  sumKept: 'Kept by you',
  note_one:
    '1 script is not copied ({{page}} from the page, {{track}} tracking): the demo does not need it, navigation is replayed from your clicks.',
  note_other:
    '{{n}} scripts are not copied ({{page}} from the page, {{track}} tracking): the demo does not need them, navigation is replayed from your clicks.',
  group: {
    pages: 'Pages copied',
    pageScripts: 'Page scripts',
    trackingScripts: 'Tracking scripts',
    frames: 'Embedded frames',
    forms: 'Forms',
    pii: 'Personal data replaced',
    externalLinks: 'External links',
  },
  state: {
    pageScripts: 'Not copied: the demo does not need them',
    trackingScripts: 'Not copied: they measure the site’s audience',
    forms: 'Displayed, never submitted',
    pii: 'Replaced with fictional values',
    externalLinks: 'Disabled',
  },
  pagesReady: 'Ready to send',
  pagesHeavy_one: '1 page too heavy',
  pagesHeavy_other: '{{n}} pages too heavy',
  framesRemoved_one: '1 removed',
  framesRemoved_other: '{{n}} removed',
  keptCount_one: '1 kept',
  keptCount_other: '{{n}} kept',
  why: 'Why?',
  whyOf: 'Why? {{name}}',
  show: 'Show',
  hide: 'Hide',
  showOf: 'Show: {{name}}',
  hideOf: 'Hide: {{name}}',
  keep: 'Keep',
  keepOf: 'Keep: {{name}}',
  remove: 'Remove',
  removeOf: 'Remove: {{name}}',
  more: 'Show 20 more',
  shown: '{{shown}} of {{total}}',
  filter: 'Filter by name or source',
  filterOf: 'Filter: {{group}}',
  noMatch: 'No item matches.',
  status: {
    notCopied: 'Not copied',
    removed: 'Removed',
    replaced: 'Replaced',
    disabled: 'Disabled',
    kept: 'Kept',
    ready: 'Ready',
    heavy: 'Too heavy',
  },
  inPage: 'in the page',
  fallback: {
    scriptInline: 'Script written in the page',
    widget: 'Element added by a script',
    script: 'Script',
    frame: 'Embedded frame',
    frameVideo: 'Embedded video',
    frameMap: 'Embedded map',
    form: 'Form',
    link: 'Link',
    pii: 'Data item',
  },
  groupWhy: {
    pageScripts:
      'The demo is a fixed copy of the page. Navigation is replayed from your clicks, without running the site’s code. Outside the original site, these scripts would not work anyway.',
    trackingScripts:
      'These scripts measure the original site’s audience. In a demo, they would send data about your visitors to third parties: they are never copied.',
    frames:
      'An embedded frame loads another page inside yours. It is removed, because it would run outside code in the demo.',
    forms:
      'Forms stay displayed, but they send nothing: no data typed in the demo goes to the original site.',
    pii: 'TutoClick spotted this data on the page and replaced it with fictional values before copying it. “Keep” restores the original text in the demo.',
    externalLinks:
      'A link to another site is disabled so the visitor stays in the demo. “Keep” turns it back on: the visitor will first see “You are leaving the demo”.',
  },
  reasonWhy: {
    scriptInline:
      'Code written in the page. The demo is a fixed copy: navigation is replayed from your clicks, without running this code.',
    scriptSameSite:
      'Script from the site. The demo is a fixed copy: navigation is replayed from your clicks, without running this script.',
    scriptThirdParty:
      'Script loaded from another site. Outside the original site it would not work, and the demo does not need it.',
    widgetThirdParty:
      'Added to the page by a script from another site (chat, cookies, help). In the demo it would not respond to clicks, so it is removed. “Keep” leaves it visible, with no effect.',
    scriptTracking:
      'Audience tracking script. In a demo, it would send data about your visitors to a third party.',
    frameVideo:
      'Embedded video from a known provider. Embedded videos are not carried into the demo yet: the frame is removed.',
    frameMap:
      'Embedded map from a known provider. Embedded maps are not carried into the demo yet: the frame is removed.',
    frameThirdParty:
      'Frame that loads another page inside yours. It would run outside code in the demo: it is removed.',
    form: 'The form stays displayed, but it sends nothing: no data typed in the demo goes to the original site.',
    pii: 'Personal data spotted on the page, replaced with a fictional value. “Keep” restores the original text in the demo.',
    piiKept:
      'You are keeping this item: the original text will be visible in the demo. “Remove” replaces it again.',
    linkExternal:
      'Link to another site, disabled so the visitor stays in the demo. “Keep” turns it back on: the visitor will first see “You are leaving the demo”.',
    linkKept:
      'You are keeping this link: in the demo, the visitor will first see “You are leaving the demo” and choose whether to continue.',
    linkLocked:
      'Link to another site, disabled. It cannot be kept: its address is not secure (http). Only https links can be.',
  },
  pageWhyReady: 'The page is copied in full. It weighs {{size}}, under the limit of {{max}} per page.',
  pageWhyHeavy:
    '“{{title}}” weighs {{size}}, over the {{max}} allowed per page: it will not be sent. Remove it, or capture it again with less content displayed.',
  size: '{{n}}\u00a0MB',
  sizeKb: '{{n}}\u00a0KB',
  pageN: '{{n}}. {{title}}',
  server: 'The server applies the same rules when sending.',
  delete: 'Delete the capture',
  send: 'Send',
  sending: 'Sending… {{done}} of {{total}}',
  sent: 'Sent. Opening the editor…',
  sendError: 'Sending failed. Try again.',
  nothing: 'No page to check.',
  noPageLeft: 'There is no page left to send.',
  cancel: 'Cancel',
  keepLinkTitle: 'Keep this external link?',
  keepLinkBody:
    '“{{label}}” leads to {{host}}. In the demo, the visitor will first see “You are leaving the demo” and choose whether to continue.',
  keepLinkOk: 'Keep the link',
  deleteTitle: 'Delete the capture?',
  deleteBody: 'The pages will be erased from this browser. Nothing has been sent.',
  deleteOk: 'Delete the capture',
  pageRemoved: '“{{title}}” is removed from the demo.',
  undo: 'Undo',
  srv_one: 'Demo sent. 1 kept item was removed by the server.',
  srv_other: 'Demo sent. {{n}} kept items were removed by the server.',
  srvLink: 'Link “{{label}}” ({{host}}): address reported as dangerous.',
  openDemo: 'Open the demo',
};

export type VerifyStrings = typeof fr;
export const vs: VerifyStrings = (globalThis.navigator?.language ?? 'fr').toLowerCase().startsWith('en')
  ? en
  : fr;

/** Remplace {{clé}} par sa valeur. */
export const fmt = (t: string, v: Record<string, string | number> = {}) =>
  t.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(v[k] ?? ''));

/** Pluriel : clé `_one` pour 1 (et 0 en français), `_other` sinon. */
export function plural(one: string, other: string, n: number, v: Record<string, string | number> = {}) {
  return fmt(n <= 1 ? one : other, { n, ...v });
}
