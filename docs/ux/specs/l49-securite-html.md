# L49 : sécurité des captures HTML

> Préoccupation du client : certaines structures partenaires interdisent la reproduction HTML de leurs logiciels. Il craint aussi qu'une page capturée contienne du code malveillant ou serve à tromper un visiteur (hameçonnage).
> **À réaliser après L48.** Spec mise à jour le 21 novembre sur `main` = `d33d5a1` : elle suit L48-E (éditeur à rail), L48-G (types et Sandbox), le delta UI de L49 (`ui-deltas-l41-l49.md`) et §18 de `composants.md`. Le découpage en paquets est au §8, les textes au §9.
> Maquette : `docs/ux/maquettes/refonte/l49-securite-html.html`. Captures : `img/l49-reglage.png`, `img/l49-rapport-extension.png`, `img/l49-editeur-liens.png`, `img/l49-desactive.png` et `img/l49-sombre-mobile.png`.
> Données fictives. Le dépôt est public : aucun nom de structure réelle dans l'interface, les textes ou les tests.

## 1. Ce qui existe déjà (code de `claude/dev-mvp`, 0e86ab9, vérifié sur d33d5a1)

- **Assainissement double** :
  - dans l'extension, `sanitizeDom` et `sanitizeCss` de `packages/core/src/htmlSanitize.ts` ;
  - sur le serveur, la fonction `html-ingest` (`sanitizePage`).
  - Sont retirés : scripts, `noscript`, cadres (`iframe`, `frame`), `object`, `embed`, `base`, `link`, `meta http-equiv`, gestionnaires `on*`, URL `javascript:`, `vbscript:` et `data:` hors images, `srcdoc`, `formaction`, valeurs des champs, `@import` et `expression()` en CSS, animations SVG qui réécrivent un lien.
  - Les formulaires perdent `action`, `method` et `target`.
- **Données personnelles** : remplacées par « Xxxxxx » et floutées dans l'extension.
- **Affichage** : iframe `sandbox="allow-scripts"` (jamais `allow-same-origin`, ni popups, ni navigation, ni formulaires), CSP dans le cadre, `referrer` désactivé, `submit` bloqué.
- **Liens externes** : inertes dans les faits (navigation interdite par le cadre), mais conservés dans le HTML, sans que l'auteur le sache ni puisse le choisir.
- **Ce qui manque** :
  - aucun réglage pour interdire ou limiter les captures HTML ;
  - aucun **compte rendu** de ce qui a été retiré ;
  - pas de mention d'autorisation.

## 2. Réglage « Captures HTML » (Paramètres > Espace > Sécurité)

- **Accès** : première section de la page Sécurité (`pages/settings/SecuritySettings.tsx`, L48-A §4), modifiable par les **propriétaires et admins**. Les autres rôles voient les mêmes valeurs en lecture seule, avec « Modifiable par un admin » en 13 px `text-muted` (pas de badge « Admins », §17.4).
- **Disposition (delta L49)** : une ligne de réglage (§17.3), avec le libellé et une ligne d'aide à gauche (40 %) et les **3 radios simples** à droite, l'un sous l'autre (pas de cartes). Les domaines sont des pastilles grises sous les radios. La mention (§6) est en texte gris, sans encadré.
- **Texte** : « Une capture HTML copie la structure des pages (démo HTML, Sandbox). Une capture d'écran ne copie qu'une image. »
- **Choix** (`fieldset` « Autoriser les captures HTML », radios simples avec une ligne d'aide chacun) :

| Valeur | Libellé | Aide | Effet |
|---|---|---|---|
| `allowed` (par défaut) | Autorisées | Sur tous les sites. Chaque page est analysée et nettoyée. | Comportement actuel, plus le rapport (§3) |
| `domains` | Seulement sur ces domaines | Ailleurs, l'extension propose les captures d'écran uniquement. | Liste de domaines, avec ajout et retrait ; jokers de sous-domaines `*.example.org` |
| `disabled` | Désactivées | Captures d'écran uniquement. Les démos HTML et les Sandbox existants restent lisibles, sans nouvelle page. | Aucune nouvelle page HTML |

- **Domaines** :
  - saisis sans protocole ni chemin, en minuscules, validés (nom de domaine valide, 50 au plus) ;
  - correspondance exacte, ou par sous-domaine avec `*.` (qui ne couvre pas le domaine nu : `*.example.org` ne couvre pas `example.org`) ;
  - pastilles avec « Retirer » (nom accessible « Retirer app.example.com »).
- **Mention** sous les choix : voir §6.
- **Pied** : « Appliqué par l'app, l'extension et le serveur. » en 13 px `text-muted`, puis « Enregistrer » (principal, désactivé tant que rien n'a changé).
- **Journal** : chaque changement est noté dans `public.audit_log` (qui, quand, ancienne et nouvelle valeur dans `meta`). La contrainte `audit_log.action` est élargie à `settings.html_capture`.
- **Données** : `workspaces.settings.htmlCapture = { mode: 'allowed' | 'domains' | 'disabled', domains: string[] }`, lisible par les membres.
- **Écriture** : nouvelle RPC `set_html_capture(p_ws uuid, p_mode text, p_domains text[])`, `security definer`. Elle vérifie le rôle admin ou propriétaire, valide les domaines (même règle que l'app) et écrit le journal, sur le modèle de `set_ai_settings` (`20261123200000_assistance_ia.sql`). L'app n'écrit jamais `settings.htmlCapture` directement.

### 2.1 Application du réglage

| Où | `domains` (hors liste) ou `disabled` |
|---|---|
| **Serveur** (`html-ingest`) | Refuse la page : 403, avec `{ error: 'HTML_CAPTURE_DISABLED' }` ou `{ error: 'HTML_CAPTURE_DOMAIN' }` (même format que les erreurs actuelles de la fonction). Le domaine est lu dans l'adresse de la page (`html_meta.url`), jamais dans une valeur fournie à part. C'est la seule protection fiable. |
| **Extension** | Lit le réglage de l'espace avant d'afficher le mode HTML. Hors réglage, le bouton « Capture HTML » est **visible et désactivé**, avec la raison : « Non autorisée sur ce site : {domaine} n'est pas dans la liste des domaines de votre espace. Utilisez la capture d'écran, ou demandez à un admin. » (ou « Les captures HTML sont désactivées dans votre espace. »). La capture d'écran reste proposée. |
| **App, création (L48-G)** | Avec `disabled`, les types « Démo HTML » et « Sandbox » restent visibles, désactivés, avec « Désactivé par un admin (Sécurité > Captures HTML) ». Avec `domains`, ils restent actifs : le contrôle se fait au moment de la capture. |
| **App, éditeur** | Avec `disabled`, « Capturer cette page » (L48-G §5) affiche la raison de l'admin à la place de « Bientôt ». C'est la raison la plus forte, et elle reste vraie même après l'arrivée du canal vers l'extension. Les pages existantes restent modifiables (textes, liens, flou). |
| **Lecteur** | Aucun changement : les contenus déjà publiés restent lisibles. |

## 3. Rapport d'analyse de sécurité

- **Production** :
  - `sanitizeDom` (extension) et `sanitizePage` (serveur) **renvoient des compteurs**, en plus du HTML assaini ;
  - **Compteurs déclaratifs côté extension ; garantie = assainissement serveur.** (Arbitrage du chef, 21 novembre.) Pour chaque compteur, le serveur enregistre le plus grand des deux chiffres, le sien et celui que l'extension envoie. Ces chiffres sont informatifs : la protection repose sur le nettoyage fait par le serveur, jamais sur les compteurs.
  - le serveur enregistre ces compteurs dans `steps.html_meta.security` : `{ scripts, handlers, frames, forms, externalLinks, dangerousLinks, piiReplaced, other, safeBrowsing: 'ok' | 'unavailable', analyzedAt }` ;
  - l'extension affiche les siens avant l'envoi ; l'éditeur affiche ceux qui sont enregistrés ;
  - aucun chiffre n'est estimé : chacun vient d'un comptage réel, du serveur ou de l'extension.

| Compteur | Libellé (accord en nombre) | Contenu |
|---|---|---|
| `scripts` | {n} script(s) retiré(s) | `script`, `noscript`, URL `javascript:` ou `vbscript:` |
| `handlers` | {n} action(s) au clic retirée(s) | attributs `on*` |
| `frames` | {n} cadre(s) intégré(s) retiré(s) | `iframe`, `frame`, `object`, `embed` |
| `forms` | {n} formulaire(s) neutralisé(s) | `form` avec `action`, `method` ou `target` retirés, ou champs vidés |
| `externalLinks` | {n} lien(s) externe(s) désactivé(s) | liens vers un autre domaine (§4) |
| `piiReplaced` | {n} donnée(s) personnelle(s) remplacée(s) | remplacements « Xxxxxx » |
| `other` | {n} autre(s) élément(s) retiré(s) | `base`, `link`, `meta http-equiv`, `srcdoc`, CSS dangereux (affiché seulement s'il est différent de 0) |
| `dangerousLinks` | Liens dangereux bloqués : {n} (vérifiés par Google Safe Browsing) | liens de la page signalés par Google Safe Browsing (§4.1) ; ligne toujours affichée, même à 0 |

- **Cas nominal** : la vérification répond, la ligne affiche le nombre de liens dangereux, même à 0.
- **Vérification indisponible** (exception : panne de l'API, quota dépassé ou délai de 5 s dépassé ; la clé est configurée en production) : si Google Safe Browsing n'a pas répondu, la ligne devient « Vérification Google indisponible », avec l'icône `circle-alert` et la date de la dernière tentative. Le serveur refait la vérification à la publication.
- **Statut** (delta L49 : un point de 8 px et un texte, **sans badge ni fond coloré**) :
  - **« Page sûre »** (point `success`) si `scripts`, `handlers`, `frames`, `forms`, `other` et `dangerousLinks` valent 0 ;
  - sinon **« Éléments retirés »** (point `warning`) ;
  - si rien n'a été retiré mais que Google Safe Browsing n'a pas répondu : **« Vérification partielle »** (point `text-muted`) au lieu de « Page sûre ».
- **Compte rendu en une phrase** (delta L49), puis le détail repliable : « 3 pages nettoyées : 18 éléments actifs retirés, 1 lien dangereux bloqué ». « Détail » déplie le tableau des compteurs ci-dessus (une ligne par compteur, chiffre aligné à droite, `tabular-nums`).
  - Phrase : « Rien d'actif à retirer sur cette page. » ou « Tout ce qui pouvait s'exécuter ou envoyer des données a été retiré. La page est publiable. »
  - Le statut est toujours écrit, jamais porté par la couleur seule.
  - Les deux statuts sont publiables : « Éléments retirés » informe, il ne bloque pas.
- **Où** :
  - **Extension**, écran « Vérification de la capture HTML » : rapport cumulé en tête (somme des pages) ; statut par page dans la liste ; un clic sur une page déplie son détail ; puis « Envoyer {n} pages ».
    - Corrigé le 21 novembre : la vérification Google se fait sur le serveur, à l'envoi. L'extension ne connaît donc pas encore les liens dangereux. Son résumé omet la partie « liens dangereux bloqués », et une ligne de 12 px `text-muted` sous le rapport dit : « Les liens sont vérifiés par Google Safe Browsing à l'envoi. »
  - **Éditeur** (rail L48-E, outil **Étape**, page HTML) : une section « Sécurité de la page » en une ligne (statut, puis le lien « Détail » qui déplie les compteurs), puis la liste des liens externes (§4). Rien n'est ajouté sur la vignette de la colonne des étapes (§17.4).
  - **Liste de contrôle avant publication** : une ligne d'information « {n} pages analysées : {x} sûres, {y} avec éléments retirés », non bloquante.
- **Accessibilité** : le rapport est un `role="group"` « Analyse de sécurité » ; les compteurs sont une liste ; les icônes sont `aria-hidden`.

## 4. Liens externes

- **Définition** : un lien de la page dont le domaine diffère de celui de la page capturée (les sous-domaines du même domaine sont internes). Les liens internes relèvent du Sandbox (L48-G).
- **Par défaut : désactivé.**
  - Le serveur remplace `href` par `data-tc-href` (adresse conservée pour l'éditeur) et ajoute `data-tc-ext="off"` : au clic, rien ne se passe.
  - Si le réglage de clic non relié du Sandbox l'affiche, le message est « Ce lien mène hors de la démo. ».
- **Option par lien** : dans l'éditeur, la liste « Liens externes · {n} » montre le texte du lien, l'adresse complète (police à chasse fixe) et un interrupteur « Autoriser le lien {texte} ». Libellés : « Désactivé » ou « Autorisé ».
  - **Modifiable** par les éditeurs ; en lecture seule pour les lecteurs.
  - **Seules les adresses `https:`** peuvent être autorisées. Les autres restent désactivées, avec la raison écrite « Adresse non sécurisée ».
  - **Si le domaine du lien n'est plus autorisé** par le réglage (mode `domains`), le lien reste autorisé : le réglage porte sur les captures, pas sur les liens.
- **Lien autorisé, côté visiteur** : au clic, le lecteur (et non la page capturée) ouvre un dialogue « Vous quittez la démo ».
  - Texte : « Ce lien ouvre un site extérieur dans un nouvel onglet : » suivi du **domaine** en gras.
  - Actions : « Rester dans la démo » (focus par défaut) et « Ouvrir ».
  - L'ouverture se fait par `window.open(url, '_blank', 'noopener,noreferrer')` depuis le lecteur. Le cadre garde son `sandbox` sans popups.
  - Le domaine affiché vient de l'adresse réelle, jamais du texte du lien : c'est la protection contre l'hameçonnage.
- **Données** : `steps.html_ops` reçoit une opération `{ op: 'extlink', sel, allow: true }` par lien autorisé.

### 4.1 Liens dangereux (Google Safe Browsing)

- **Qui vérifie** : le **serveur** seulement (`html-ingest`, puis de nouveau à la publication), avec la clé fournie par le client.
  - La clé reste un secret côté serveur, jamais dans l'extension, l'app ou le lecteur.
  - Méthode recommandée : l'API par préfixes de hachage (Update API), pour ne pas envoyer les adresses complètes à un tiers. À valider avec le DPO ; à mentionner au registre des traitements.
- **Ce qui est vérifié** : tous les liens de la page, internes et externes, ainsi que les adresses d'images et de styles conservées.
- **Lien signalé** :
  - il est désactivé et **ne peut pas être autorisé** ;
  - « Bloqué, site signalé » en texte `danger` de 13 px 600 (icône `shield-alert` de 16 px), à la place de l'interrupteur : pas de badge ni de fond (delta L49) ;
  - l'interrupteur est retiré, et non grisé ;
  - le lien est compté dans `dangerousLinks`.
- **Côté visiteur** : un lien signalé ne fait rien. Aucune ouverture, même si un ancien réglage l'avait autorisé : la vérification de la publication l'emporte.
- **Re-vérification** : à chaque publication. Si un lien déjà autorisé est signalé plus tard, son autorisation est retirée, et une alerte apparaît dans l'éditeur : « Le lien {texte} mène à un site signalé : il a été bloqué. »
  - Livré en b3db1ad, validé le 21 novembre : l'alerte s'affiche dans l'infobulle d'erreur du bouton Publier, avec « Aller à l'étape {n} ». Cette publication-là est arrêtée, pour que l'auteur voie le changement avant de republier ; la suivante passe, puisque le lien est désactivé.
- **Indisponibilité** :
  - les liens restent désactivés par défaut ;
  - un lien déjà autorisé reste autorisé ;
  - l'autorisation d'un **nouveau** lien est refusée tant que la vérification n'a pas répondu, avec la raison « Vérification Google indisponible, réessayez plus tard ».

## 5. Formulaires

- **Toujours neutralisés**, sans option. Le serveur retire `action`, `method` et `target`, vide les champs, et le cadre bloque `submit` (existant).
- Les formulaires de TutoClick (lead, quiz) ne sont pas concernés : ils sont rendus par le lecteur, hors de la page capturée.
- Dans l'éditeur, un champ d'une page capturée reste modifiable pour la démonstration (texte d'exemple), sans possibilité d'envoi.

## 6. Mention d'autorisation

> **Capturez uniquement des logiciels que vous êtes autorisé à reproduire.** Certaines structures interdisent la copie HTML de leurs écrans : utilisez alors des captures d'écran.

- Présentée en texte de 13 px `text-muted`, avec l'icône `info` de 16 px, **sans encadré ni fond** (delta L49) :
  - dans le réglage (§2) ;
  - au lancement d'une capture HTML dans l'extension (barre de capture, avant la première page) ;
  - à l'étape 2 de « Nouvelle démo » pour les types HTML et Sandbox (L48-G), sous la liste des sources ;
  - dans l'article d'aide « Capturer en HTML ».
- Pas de case à cocher : la mention informe, elle n'engage pas.

## 7. Recette

- **Réglage** : les 3 modes ; ajout d'un domaine invalide refusé avec un message ; joker ; lecture seule pour un éditeur ; entrée dans le journal.
- **Serveur** (tests de `html-ingest`) :
  - en mode `disabled`, 403 `html_capture_disabled` ;
  - en mode `domains`, une page de `crm.partenaire.example` est refusée avec 403 `html_capture_domain`, et une page de `app.example.com` est acceptée ;
  - un en-tête trafiqué n'y change rien.
- **Extension** : hors liste, bouton HTML désactivé avec la raison ; capture d'écran disponible ; rapport cumulé et par page ; chiffres identiques à ceux du serveur sur la page de test de `lib.test.ts`.
- **Éditeur** : section « Sécurité de la page » ; liens externes listés ; autoriser `https://docs.example.com` puis ouvrir l'aperçu : dialogue « Vous quittez la démo » avec le bon domaine ; un lien `http:` ne peut pas être autorisé.
- **Création** : avec `disabled`, Démo HTML et Sandbox sont visibles, désactivés, avec la raison.
- **Mention** présente aux 4 endroits.
- **Lecteur** : un lien externe non autorisé ne fait rien ; un formulaire capturé ne s'envoie jamais (test de `submit`).
- **Google Safe Browsing** :
  - avec l'adresse de test officielle de Safe Browsing, le lien est bloqué, porte le badge « Bloqué, site signalé », ne peut pas être autorisé, et le rapport compte 1 lien dangereux ;
  - API simulée en panne ou quota dépassé (réponse 429 ou 5xx) : « Vérification Google indisponible », et la nouvelle vérification à la publication passe ;
  - aucune adresse complète dans les journaux du serveur.
- Clair, sombre, 390 px (réglage et rapport).
- **Bases (§18)** : `boutons-natifs.e2e.cjs` passe sur Paramètres › Sécurité, l'éditeur (page HTML) et le dialogue « Vous quittez la démo » ; corps des dialogues avec 16 px au moins entre les blocs ; captures réelles en clair et en sombre regardées pour chaque écran touché.

## 8. Découpage pour le dev (à enchaîner dans l'ordre)

| Paquet | Contenu | Dépend de | e2e et tests |
|---|---|---|---|
| **P1, réglage et refus** | §2 en entier : RPC `set_html_capture`, journal, ligne de réglage dans Sécurité, refus 403 dans `html-ingest`, types désactivés à la création, « Capturer cette page » avec la raison, mention aux 3 endroits de l'app (§6) | rien | pgTAP de la RPC (rôles, domaines invalides, journal) ; tests Deno de `html-ingest` (403 et en-tête trafiqué) ; e2e `l49-reglage` |
| **P2, rapport** | §3 : compteurs dans `sanitizeDom` et `sanitizePage` (même liste, mêmes noms), `html_meta.security`, section « Sécurité de la page », ligne de la liste de contrôle avant publication | P1 | tests unitaires des compteurs sur la page de `lib.test.ts` (chiffres identiques des deux côtés) ; e2e `l49-rapport` |
| **P3, liens externes** | §4 sans Safe Browsing et §5 : `data-tc-href` et `data-tc-ext`, liste avec interrupteurs, `extlink` dans `html_ops`, dialogue « Vous quittez la démo » dans le lecteur | P2 | e2e éditeur (autoriser, `http:` refusé) et lecteur (dialogue, domaine réel, `noopener`) |
| **P4, Safe Browsing** | §4.1 : vérification à la réception et à la publication, compteur `dangerousLinks`, « Bloqué, site signalé », état « Vérification Google indisponible » | P3. La clé existe : le secret de l'Edge Function `GOOGLE_SAFE_BROWSING_API_KEY` est configuré en production (confirmé par le chef le 21 novembre). On livre donc le **cas nominal** : vérification à chaque réception et à chaque publication. | adresse de test officielle de Safe Browsing ; journaux sans adresse complète |
| **Extension** | §2.1 (bouton HTML désactivé avec la raison), rapport cumulé et par page (§3), mention au lancement (§6) | P1, P2 | e2e de l'extension (mode HTML) |

## 9. Textes (i18n, nouvelles clés)

| Clé | Texte |
|---|---|
| `htmlCapture.title` | Captures HTML |
| `htmlCapture.help` | Une capture HTML copie la structure des pages (démo HTML, Sandbox). Une capture d'écran ne copie qu'une image. |
| `htmlCapture.legend` | Autoriser les captures HTML |
| `htmlCapture.allowed` / `allowedHelp` | Autorisées / Sur tous les sites. Chaque page est analysée et nettoyée. |
| `htmlCapture.domains` / `domainsHelp` | Seulement sur ces domaines / Ailleurs, l'extension propose les captures d'écran uniquement. |
| `htmlCapture.disabled` / `disabledHelp` | Désactivées / Captures d'écran uniquement. Les démos HTML et les Sandbox existants restent lisibles, sans nouvelle page. |
| `htmlCapture.domainLabel` | Ajouter un domaine |
| `htmlCapture.domainInvalid` | Saisissez un nom de domaine, sans « https:// » ni chemin (exemple : app.example.com). |
| `htmlCapture.domainMax` | 50 domaines au plus. |
| `htmlCapture.removeDomain` | Retirer {{domain}} |
| `htmlCapture.applied` | Appliqué par l'app, l'extension et le serveur. |
| `htmlCapture.readOnly` | Modifiable par un admin |
| `htmlCapture.blockedByAdmin` | Désactivé par un admin (Sécurité > Captures HTML) |
| `htmlCapture.notice` | Capturez uniquement des logiciels que vous êtes autorisé à reproduire. Certaines structures interdisent la copie HTML de leurs écrans : utilisez alors des captures d'écran. |
| `htmlSecurity.title` | Sécurité de la page |
| `htmlSecurity.safe` / `removed` / `partial` | Page sûre / Éléments retirés / Vérification partielle |
| `htmlSecurity.safeBody` / `removedBody` | Rien d'actif à retirer sur cette page. / Tout ce qui pouvait s'exécuter ou envoyer des données a été retiré. La page est publiable. |
| `htmlSecurity.summary` | {{pages}} pages nettoyées : {{removed}} éléments actifs retirés, {{dangerous}} liens dangereux bloqués |
| `htmlSecurity.detail` | Détail |
| `htmlSecurity.c.scripts` … `c.other` | les libellés du tableau du §3, au singulier et au pluriel (`_one`, `_other`), avec une majuscule initiale dans la liste des compteurs (« Script retiré », « Actions au clic retirées ») |
| `htmlSecurity.dangerous` | Liens dangereux bloqués : {{count}} (vérifiés par Google Safe Browsing) |
| `htmlSecurity.gsbUnavailable` | Vérification Google indisponible |
| `htmlSecurity.checklistTotal_one` / `_other` | 1 page analysée / {{count}} pages analysées |
| `htmlSecurity.checklistSafe_one` / `_other` | 1 sûre / {{count}} sûres |
| `htmlSecurity.checklistRemoved` | {{count}} avec éléments retirés |
| Assemblage (corrigé le 21 novembre) | Total, « : », puis les morceaux non nuls séparés par « , » : « 3 pages analysées : 2 sûres, 1 avec éléments retirés », « 2 pages analysées : 2 sûres ». Pour une seule page : « 1 page analysée : sûre » ou « 1 page analysée : avec éléments retirés ». |
| `extLinks.title` | Liens externes · {{count}} |
| `extLinks.allow` | Autoriser le lien {{text}} |
| `extLinks.off` / `on` | Désactivé / Autorisé |
| `extLinks.insecure` | Adresse non sécurisée |
| `extLinks.blocked` | Bloqué, site signalé |
| `extLinks.blockedLater` | Le lien {{text}} mène à un site signalé : il a été bloqué. |
| `extLinks.gsbRetry` | Vérification Google indisponible, réessayez plus tard |
| `extLinks.outside` | Ce lien mène hors de la démo. |
| `player.leave.title` | Vous quittez la démo |
| `player.leave.body` | Ce lien ouvre un site extérieur dans un nouvel onglet : |
| `player.leave.stay` / `open` | Rester dans la démo / Ouvrir |
