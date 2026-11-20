# L49 : sécurité des captures HTML

> Préoccupation du client : certaines structures partenaires interdisent la reproduction HTML de leurs logiciels. Il craint aussi qu'une page capturée contienne du code malveillant ou serve à tromper un visiteur (hameçonnage).
> **À réaliser après L48.**
> Maquette : `docs/ux/maquettes/refonte/l49-securite-html.html`. Captures : `img/l49-reglage.png`, `img/l49-rapport-extension.png`, `img/l49-editeur-liens.png`, `img/l49-desactive.png` et `img/l49-sombre-mobile.png`.
> Données fictives. Le dépôt est public : aucun nom de structure réelle dans l'interface, les textes ou les tests.

## 1. Ce qui existe déjà (code de `claude/dev-mvp`, 0e86ab9)

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

- **Accès** : carte en tête de la page Sécurité (L48-A §4), modifiable par les **propriétaires et admins** (badge « Admins »). Les autres la voient en lecture seule.
- **Texte** : « Une capture HTML copie la structure des pages (démo HTML, Sandbox). Une capture d'écran ne copie qu'une image. »
- **Choix** (`fieldset` « Autoriser les captures HTML », radios en cartes) :

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
- **Pied** : « Appliqué par l'app, l'extension et le serveur. » et « Enregistrer ».
- **Journal** : chaque changement est noté dans le journal de l'espace (qui, quand, ancienne et nouvelle valeur).
- **Données** : `workspaces.settings.htmlCapture = { mode: 'allowed' | 'domains' | 'disabled', domains: string[] }`, lisible par les membres et modifiable par les admins (RLS).

### 2.1 Application du réglage

| Où | `domains` (hors liste) ou `disabled` |
|---|---|
| **Serveur** (`html-ingest`) | Refuse la page : 403, avec le code `html_capture_disabled` ou `html_capture_domain`. Le domaine est lu dans l'adresse de la page (`html_meta.url`), jamais dans une valeur fournie à part. C'est la seule protection fiable. |
| **Extension** | Lit le réglage de l'espace avant d'afficher le mode HTML. Hors réglage, le bouton « Capture HTML » est **visible et désactivé**, avec la raison : « Non autorisée sur ce site : {domaine} n'est pas dans la liste des domaines de votre espace. Utilisez la capture d'écran, ou demandez à un admin. » (ou « Les captures HTML sont désactivées dans votre espace. »). La capture d'écran reste proposée. |
| **App, création (L48-G)** | Avec `disabled`, les types « Démo HTML » et « Sandbox » restent visibles, désactivés, avec « Désactivé par un admin (Sécurité > Captures HTML) ». Avec `domains`, ils restent actifs : le contrôle se fait au moment de la capture. |
| **App, éditeur** | Avec `disabled`, « Ajouter une page (capture HTML) » et « Capturer cette page » (L48-G §5) sont désactivés, avec la même raison. Les pages existantes restent modifiables (textes, liens, flou). |
| **Lecteur** | Aucun changement : les contenus déjà publiés restent lisibles. |

## 3. Rapport d'analyse de sécurité

- **Production** :
  - `sanitizeDom` (extension) et `sanitizePage` (serveur) **renvoient des compteurs**, en plus du HTML assaini ;
  - le serveur recalcule et enregistre **ses** compteurs dans `steps.html_meta.security` : `{ scripts, handlers, frames, forms, externalLinks, piiReplaced, other, analyzedAt }` ;
  - l'extension affiche les siens avant l'envoi ; l'éditeur affiche ceux du serveur ;
  - aucun chiffre n'est estimé.

| Compteur | Libellé (accord en nombre) | Contenu |
|---|---|---|
| `scripts` | {n} script(s) retiré(s) | `script`, `noscript`, URL `javascript:` ou `vbscript:` |
| `handlers` | {n} action(s) au clic retirée(s) | attributs `on*` |
| `frames` | {n} cadre(s) intégré(s) retiré(s) | `iframe`, `frame`, `object`, `embed` |
| `forms` | {n} formulaire(s) neutralisé(s) | `form` avec `action`, `method` ou `target` retirés, ou champs vidés |
| `externalLinks` | {n} lien(s) externe(s) désactivé(s) | liens vers un autre domaine (§4) |
| `piiReplaced` | {n} donnée(s) personnelle(s) remplacée(s) | remplacements « Xxxxxx » |
| `other` | {n} autre(s) élément(s) retiré(s) | `base`, `link`, `meta http-equiv`, `srcdoc`, CSS dangereux (affiché seulement s'il est différent de 0) |

- **Statut** :
  - **« Page sûre »** (bouclier coché, fond `success` à 14 %) si `scripts`, `handlers`, `frames`, `forms` et `other` valent 0 ;
  - sinon **« Éléments retirés »** (`triangle-alert`, fond `warning` à 16 %).
  - Phrase : « Rien d'actif à retirer sur cette page. » ou « Tout ce qui pouvait s'exécuter ou envoyer des données a été retiré. La page est publiable. »
  - Le statut est toujours écrit, jamais porté par la couleur seule.
  - Les deux statuts sont publiables : « Éléments retirés » informe, il ne bloque pas.
- **Où** :
  - **Extension**, écran « Vérification de la capture HTML » : rapport cumulé en tête (somme des pages) ; statut par page dans la liste ; un clic sur une page déplie son détail ; puis « Envoyer {n} pages ».
  - **Éditeur**, panneau Étape (page HTML) : section « Sécurité de la page », avec le rapport et la liste des liens externes (§4). Un badge discret « Éléments retirés » apparaît sur la vignette dans la liste des étapes.
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

## 5. Formulaires

- **Toujours neutralisés**, sans option. Le serveur retire `action`, `method` et `target`, vide les champs, et le cadre bloque `submit` (existant).
- Les formulaires de TutoClick (lead, quiz) ne sont pas concernés : ils sont rendus par le lecteur, hors de la page capturée.
- Dans l'éditeur, un champ d'une page capturée reste modifiable pour la démonstration (texte d'exemple), sans possibilité d'envoi.

## 6. Mention d'autorisation

> **Capturez uniquement des logiciels que vous êtes autorisé à reproduire.** Certaines structures interdisent la copie HTML de leurs écrans : utilisez alors des captures d'écran.

- Présentée en encart `note` (icône `info`, fond `surface-sunken`) :
  - dans le réglage (§2) ;
  - au lancement d'une capture HTML dans l'extension (barre de capture, avant la première page) ;
  - à l'étape 2 de « Nouvelle démo » pour les types HTML et Sandbox (L48-G) ;
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
- Clair, sombre, 390 px (réglage et rapport).
