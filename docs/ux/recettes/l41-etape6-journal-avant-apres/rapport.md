# Contre-recette L41 étape 5 et recette L41 étape 6 (dev-mvp 6fdd2c7)

**Banc** :
- `claude/dev-mvp` à 6fdd2c7, qui contient 69a8273, puis 248cf7b, 2a20be2, b536c56 et fdad3c0 ;
- faux backend, clés factices ;
- Chromium à 1440 × 900, en clair et en sombre.

| Lettre | Verdict |
| --- | --- |
| **Étape 5** · nouveau modèle décoché, icône à 8 px | **VERT**, une remarque importante |
| **Étape 6** · colonnes Avant et Après du journal | **ROUGE léger** : les listes de l'assistant sont à resserrer |
| Trouvé en passant (étape 4) | Section « Assistant IA » figée après l'ajout de la clé Anthropic |

## Étape 5 : VERT

**Tests** : e2e assistance-ia-modeles 20/20 en clair comme en sombre ; Deno 47/47.

| Contrôle | Résultat |
| --- | --- |
| Espace jamais réglé, Haiku proposé par la Console **après** la création de l'espace | Haiku arrive **décoché** (liste de l'espace : `null`). L'éditeur montre Auto, Sonnet et Opus, sans Haiku. |
| Le propriétaire coche Haiku | La liste est enregistrée (Sonnet, Opus, Haiku), et Haiku entre dans l'éditeur sous « Autres modèles », avec « Bêta » et la note du propriétaire. |
| Espace existant (modèles datés du 1er janvier 2000) | La liste reste la même : Auto, Sonnet, Opus, tous cochés. |
| Icône de « Gardez au moins un modèle coché. » | **8 px** entre l'icône et le texte, en clair comme en sombre. |

Capture : `etape5-nouveau-modele-decoche-et-icone-8px.png`.

**Remarque importante, non bloquante**. Le déclencheur `ai_assistant_proposed_at` remet `proposed_at` à `null` quand la Console décoche un modèle, puis à `now()` quand elle le recoche. Une erreur de clic dans la Console (décocher Sonnet, puis le recocher) date donc Sonnet d'aujourd'hui. **Tous les espaces jamais réglés perdent alors Sonnet**, en silence, et ne le retrouvent que si leur propriétaire le recoche. Correction proposée : garder la date de la **première** proposition (`first_proposed_at`, jamais remise à `null`), et ne dater d'aujourd'hui qu'un modèle qui n'a jamais été proposé.

## Étape 6 : ROUGE léger

**Tests** : e2e console 56/56 et console-modeles 58/58, en clair comme en sombre.

J'ai fait dans la Console :
- un ajout de clé refusé (OpenAI), un ajout réussi (Anthropic), un test et un remplacement ;
- Traduction → Claude Opus ;
- la règle « analyse de toute la démo » → Opus ;
- l'étiquette Bêta sur Opus.

| Point | Verdict | Mesure |
| --- | --- | --- |
| Valeurs lisibles : fonction, règle d'Auto, clés | **VERT** | « Traduction : Claude Sonnet (défaut) → Claude Opus » ; « Auto · analyse de toute la démo : Claude Sonnet → Claude Opus » ; « Anthropic : Aucune clé → Clé enregistrée, test réussi » ; remplacement « Clé enregistrée → Clé remplacée, test réussi ». |
| Clés : un état, jamais la clé | **VERT** | Aucune trace de la clé dans le DOM ni dans le CSV (recherche de `sk-fictive`). L'ajout refusé n'écrit rien, ce qui est logique puisque rien n'a été gardé. |
| Filtre « Modèles IA » | **VERT** | « Historique des changements » ouvre le journal filtré sur les 6 lignes IA, avec « Filtré sur Modèles IA ». « Tout afficher » rend les 10 lignes, dont « Connexion à la console ». |
| Export CSV | **VERT** | En-tête `date;personne;action;objet;avant;après`. Les 6 lignes correspondent au filtre, avec les mêmes valeurs qu'à l'écran. |
| **Listes longues de l'assistant** | **ROUGE léger : à resserrer** | Voir plus bas. |

Capture : `etape6-journal-filtre-valeurs.png`.

### Listes de l'assistant : je tranche, à resserrer

Avec 3 modèles, chaque ligne « Liste de l'assistant modifiée » répète **toute la liste avec les étiquettes** dans Avant et dans Après, sur des colonnes de 205 px. Une ligne monte à **6 lignes de texte** (`etape6-listes-longues-6-lignes.png`) : le journal devient difficile à parcourir, alors que la colonne Objet dit déjà ce qui a changé.

Demande : à l'écran, Avant et Après ne montrent que **ce qui change**, et l'export CSV garde les listes complètes.

| Objet | Avant | Après |
| --- | --- | --- |
| Claude Opus : étiquette | Recommandé | Bêta |
| Claude Haiku : proposition | Non proposé | Proposé |
| Ordre | Sonnet · Opus · Haiku | Haiku · Sonnet · Opus |

- Pour l'ordre : les noms courts, sans étiquette, sur une seule ligne.
- Le préfixe « Liste de l'assistant · » de l'objet répète la colonne Action : à retirer.

Remarques non bloquantes :
- « Clé IA testée : Test réussi → Test réussi ». L'Avant devrait être le résultat du test précédent, ou « — ».
- Dans le CSV, la colonne action contient le code technique (`ai.assistant_list`, `ai.auto_rule`) au lieu du libellé de l'écran (« Liste de l'assistant modifiée »).
- La date tient sur 2 lignes (colonne de 128 px) : elle tiendrait sur une ligne en 148 px, pris sur Objet.

## Trouvé en passant (étape 4) : section « Assistant IA » figée après l'ajout de la clé

Sans clé Anthropic, j'ajoute la clé dans la même page. La carte Fournisseurs et « Modèle par fonction » se mettent à jour, mais **la section « Assistant IA : modèles proposés » reste comme sans clé** :
- les 3 modèles restent désactivés, avec « Ajoutez la clé Anthropic » ;
- l'aperçu ne montre que « Auto » ;
- les règles d'Auto proposent leurs modèles grisés.

Il faut recharger la page pour que tout redevienne normal (`etape4-section-figee-apres-ajout-cle.png`). De plus, sans clé, le bandeau dit « 2 règles d'Auto visent un modèle qui n'est plus proposé ». C'est faux : les modèles sont proposés, il manque seulement la clé, et la ligne « 4 fonctions coupées faute de clé Anthropic » le dit déjà.

Correction :
- recharger `console_assistant` après l'enregistrement ou le test d'une clé ;
- dans le bandeau, ne pas compter une règle comme « non proposée » quand son modèle est proposé mais sans clé.

Demandes concernées : L41 étape 5 · nouveau modèle décoché dans un espace jamais réglé · icône de l'erreur à 8 px · L41 étape 6 · journal de la Console, colonnes Avant et Après (fonction, règle d'Auto, liste de l'assistant, clés), filtre Modèles IA, export CSV · étape 4 · section Assistant IA après l'ajout d'une clé.

## Contre-recette sur bc4b452 (26/11) : A VERT, B ROUGE léger

**Banc** :
- `claude/dev-mvp` à bc4b452, qui contient 31bc369, 1b6a37a et 0272acd ;
- faux backend, clés factices ;
- Chromium à 1440 × 900, en clair et en sombre.

**Tests** : e2e console 56/56, console-modeles 62/62 et assistance-ia-modeles 21/21, en clair comme en sombre ; Deno 47/47.

### A · L41 : VERT

| Point | Verdict | Mesure |
| --- | --- | --- |
| `proposed_at` garde sa première date | **VERT** (lu dans le code) | Déclencheur : en mise à jour, une date déjà posée est gardée ; un modèle jamais proposé n'a pas de date. Décocher puis recocher ne change donc plus la date. Je ne peux pas lancer pgTAP ici (16/16 annoncés). |
| Journal : seulement ce qui change, une ligne par changement | **VERT** | « Claude Opus : Recommandé → Bêta », « Claude Haiku : Non proposé → Proposé », « Ordre : Sonnet · Opus → Opus · Sonnet ». Toutes les lignes font **52 px**, contre 6 lignes de texte avant. Le préfixe « Liste de l'assistant · » a disparu de l'objet. Capture : `bc4b452-A-journal-ce-qui-change.png`. |
| CSV : listes complètes et libellé de l'action | **VERT** | Action « Liste de l'assistant modifiée » au lieu du code `ai.*`. Objet « Claude Opus : étiquette Bêta ». Avant et Après donnent les listes complètes avec leurs étiquettes. Aucune clé dans le CSV ni dans le DOM. |
| Section Assistant IA rechargée après l'ajout d'une clé | **VERT** | Sans recharger la page, les 3 modèles redeviennent actifs avec la mention « Anthropic », et l'aperçu passe à Auto, Sonnet, Opus. |
| Sans clé, la cause « clé manquante » d'abord | **VERT** | Le bandeau ne dit plus que « 4 fonctions coupées faute de clé Anthropic : … ». La fausse ligne « règles non proposées » a disparu. |
| « — » avant un premier test de clé | **À changer, non bloquant** | Voir plus bas. |

**« — » contre « Jamais testée » : je corrige ma remarque.** Dans ma recette précédente, j'avais demandé « le test précédent, ou — ». Or « Test réussi → Test réussi » était juste pour un deuxième test, et pour un premier test, « Jamais testée » était plus clair. C'est cohérent avec « Aucune clé » sur la même colonne, et un « — » se lit comme une valeur absente ou une erreur. **Je demande de revenir à « Jamais testée ».** C'est mon erreur, pas celle du dev.

### B · Interrupteur désactivé gris (31bc369) : ROUGE léger

| Écran (rôle) | Résultat |
| --- | --- |
| Paramètres › Sécurité (lecteur), activé et désactivé | **Gris** : piste #4f5966 en clair et #a9b3bf en sombre, opacité 1, bouton couleur de surface. Conforme. |
| Paramètres › Notifications (admin, propriétaire, lecteur), désactivé et éteint | Inchangé (piste claire, opacité 0,5) : normal, la règle ne vise que l'état activé. |
| **Éditeur › Voix off, « Lecture automatique » et « Sous-titres affichés » (lecteur), activés et désactivés** | **Restent prune** (#a3195b en clair, #cf86a9 en sombre), opacité 1, alors que la case « Animation de pulsation » juste au-dessus est grise. |

Capture : `bc4b452-B-interrupteur-securite-gris-editeur-prune.png` (Sécurité en clair et en sombre, puis l'éditeur en clair et en sombre).

Cause : `apps/web/src/styles/maquette.css` l. 1372, `.mk .fd-switch input:checked + .fd-switch__track { background: var(--fd-color-primary) }`. Elle est plus spécifique que la règle de `controls.css` et l'emporte dans tout ce qui est sous `.mk`, soit l'éditeur et les écrans refaits.

Correction : ajouter `:not(:disabled):not([aria-disabled='true'])` à la règle `.mk`, ou y dupliquer la règle grise. Puis contrôler dans l'e2e un interrupteur de l'éditeur en rôle lecteur.

Demandes concernées : L41 (date de la première proposition, journal de la liste de l'assistant, CSV, section rechargée après une clé, cause « clé manquante » d'abord, état avant un premier test) · interrupteur activé et désactivé en gris (31bc369).

## Recette sur ab5c870 (26/11) : A VERT, B ROUGE léger (inchangé), D VERT

**Banc** : `claude/dev-mvp` à ab5c870, qui contient 388de70 et ab5c870, en clair et en sombre.

| Lettre | Verdict | Mesure |
| --- | --- | --- |
| **A** · L41 | **VERT** | Tout est acquis depuis bc4b452. En plus, avec 388de70, le premier test de la clé ElevenLabs (définie au déploiement, jamais testée) écrit « **Jamais testée** → Test réussi », et le test suivant « Test réussi → Test réussi ». |
| **B** · interrupteur gris | **ROUGE léger, inchangé** | ab5c870 ne touche pas `maquette.css` : dans l'éditeur en lecture seule, « Lecture automatique » et « Sous-titres affichés » restent prune (voir la section précédente). |
| **D** · plan du Sandbox, liens jamais ouverts | **VERT** | Voir le détail ci-dessous. |

**Détail de D**, sur le plan d'une page « Mon compte » qui contient 5 liens sans page :
- « Factures » garde « Capturer cette page ».
- « Se déconnecter », « Supprimer mon compte », « Tarifs (PDF) » et « Ne plus recevoir la lettre » (`?action=unsubscribe`) affichent le bouclier et « Jamais ouverte par sécurité » en texte discret (gris, 13 px), sans bouton.
- « Ouvrir la page » et le menu ⋯ (Relier / Laisser) restent, ce que le chef a accepté.
- e2e l48g-liens : 31/31 ; axe sans violation ; test unitaire `riskyLink` : 3/3.
- Le contrôle des liens à risque de l'e2e tourne toujours en clair, même avec `THEME=dark`, car son contexte n'utilise pas `themedContext`. Je l'ai rejoué en sombre : conforme.

Capture : `ab5c870-D-liens-jamais-ouverts.png`, en clair et en sombre.

Remarques non bloquantes sur D :
1. « Ouvrir la page » sur « Se déconnecter » ouvre la vraie adresse de déconnexion : l'auteur se déconnecte de son propre site. Le geste est volontaire, mais je propose une infobulle sur ce lien pour les liens à risque : « Ouvre la page sur votre site : cela peut vous déconnecter ou agir sur votre compte. »
2. La spec §5 (a19e542) prévoyait la raison précise (« adresse de déconnexion », « fichier »). Le texte unique « Jamais ouverte par sécurité » choisi par le chef suffit. Je mets la spec à jour.
3. Le motif de `isRisky` peut aussi écarter des liens anodins dont le libellé contient « Supprimer » ou « Effacer » (par exemple « Effacer les filtres »). C'est sans danger, puisque ces liens restent ouvrables et peuvent être reliés.
4. Dans l'e2e, passer le contexte de ce contrôle par `themedContext`.

Demandes concernées : L41 (« Jamais testée » avant un premier test) · interrupteur gris (31bc369) · Sandbox v2, plan « Liens sans page », liens de déconnexion, de suppression, de désabonnement et fichiers jamais ouverts.

## Vérification B sur 73a9839 (26/11) : VERT

- Paramètres › Sécurité (lecteur) et Éditeur › Voix off (lecteur), « Lecture automatique » et « Sous-titres affichés » activés et désactivés : **piste grise** (#4f5966 en clair, #a9b3bf en sombre), opacité 1, bouton couleur de surface. L'éditeur suit maintenant le reste de l'app.
- Propriétaire, interrupteurs actifs : la piste reste prune (#a3195b, #cf86a9). Aucune régression.
- Nouvel e2e interrupteur-lecture : 3/3 en clair comme en sombre.

Capture : `73a9839-B-interrupteur-gris-partout.png` (Sécurité, puis l'éditeur, en clair et en sombre).

Demandes concernées : interrupteur activé et désactivé en gris (31bc369, 73a9839).
