# « Vérifier avant l'envoi » en Sandbox vivant : rapport à la place de l'utilisateur

Planche UX : `docs/ux/propositions/sandbox-vivant-verification/spec.md` (branche UX, 0a0c403).
Recette du 26/11 sur le banc local, avec l'extension construite et chargée dans Chromium. Données
fictives uniquement.

Script : `apps/extension/e2e/banc/verification-vivant.cjs`, 27/27 (lancé deux fois). Deux sites ont été
capturés en Sandbox :

- `tiers` : script de la page, `chat.js` et `analytics.js` d'un autre site, bouton « Discuter avec
  nous » ajouté par `chat.js` ;
- `spa` : pages qui lisent des réponses du site.

## Ce que voit l'utilisateur

1. **Texte d'introduction du mode vivant.** Plus aucun texte de la copie inerte : ni « copie fixe », ni
   « non copié », ni « la démo n'en a pas besoin ». Vérifié en clair et en sombre, sur les deux sites.
2. **Compteurs** : Pages copiées · Scripts rejoués · Scripts bloqués · Gardés par vous.
   Exemple `tiers` : 2 · 2 · 4 · 0.
3. **Note** : « 4 scripts d'autres sites sont bloqués (discussion, aide) : « Garder » en rejoue un,
   toujours sans accès au réseau. Si la page envoie quelque chose au site, elle reçoit un succès
   fictif. » Sans script bloqué, c'est la note `noteLiveNone`.
4. **Groupes, dans l'ordre de la planche.** Pages copiées → Scripts → Réponses du site → Éléments
   ajoutés par un script → Données personnelles remplacées → Formulaires → Liens externes. Un groupe
   vide n'apparaît pas. Il n'y a qu'un seul groupe « Scripts » : « Sandbox vivant », « Scripts de la
   page » et « Scripts de suivi » ont disparu.
5. **Scripts** : une ligne par script et par page.
   - Pastille neutre « ✓ Rejoué » ou « Bloqué ».
   - « Garder » sur `chat.js` donne une pastille orange « ✓ Gardé », et « Gardés par vous » passe de
     0 à 1. Le focus reste sur le bouton, qui devient « Bloquer ».
6. **Éléments ajoutés par un script** : sans action propre.
   - Le bouton « Discuter avec nous » est « Absent » tant que `chat.js` est bloqué, et « Affiché »
     (orange) quand il est gardé, page par page.
   - Meta : « Ajouté par localhost:54411/chat.js · 1. Tableau de bord ».
7. **Réponses du site** (`spa`) : un groupe à part, juste après « Scripts ».
   - Une ligne par page : « 1 réponse lue par la page · aucune donnée personnelle », avec la pastille
     « Rejouées ».
   - Pas d'action, et aucune ligne de réponse dans les scripts.
8. **Accessibilité** : axe ne relève aucune violation sérieuse, en clair et en sombre, sur les deux
   sites.

## Captures

- `tiers-avant-clair.png` : à l'arrivée, en clair.
- `tiers-chat-garde-sombre.png` : après « Garder » sur `chat.js`, en sombre.
- `spa-reponses-clair.png` : le groupe « Réponses du site ».

## Écarts et points à valider (UX)

- **Auteur d'un élément ajouté.** La capture connaît le site de l'élément, pas le script qui l'a
  ajouté. Parmi les scripts de ce site, on retient ceux dont le code contient le texte de l'élément
  (« Discuter avec nous » → `chat.js`). S'il en reste plusieurs, la meta dit « Ajouté par un script de
  {site} » au lieu de deviner, et l'élément est « Affiché » si l'un d'eux est gardé.
- **Cadres intégrés retirés.** La planche ne les nomme pas. S'il y en a, leur groupe est placé entre
  « Formulaires » et « Liens externes ».
- **Page sans enregistrement dans un Sandbox vivant** (enregistreur en échec). Ses scripts retirés
  restent dans les groupes de la copie inerte, en fin d'écran. Cela n'arrive pas sur le banc.
- **Formulaires en mode vivant.** La pastille dit « Simulé » et le « Pourquoi ? » donne le texte
  `whyForms`. La planche ne fixe pas ces deux libellés.
- **Ce que compte « Gardés par vous ».** Il compte les scripts gardés qui étaient bloqués par défaut,
  les données gardées et les liens gardés. Un élément « Affiché » n'est pas compté : il suit son
  script, d'où + 1 et non + 2.
- **Rangement de `analytics.js`.** Sur le banc, il est rangé « Script d'un autre site » et non
  « Mesure d'audience », parce que `categoryOf` ne reconnaît pas une mesure d'audience servie depuis
  localhost. Les vrais services de mesure sont reconnus.

## Non-régression

| Test | Résultat |
| --- | --- |
| `html-verification` (copie inerte) | 52/52 |
| `banc/capture-v2` | 8/8 critères |

Pour `banc/capture-v2`, l'interaction reste à 89,3 % et il n'y a aucune sortie réseau. Le critère du
groupe vaut désormais pour les sites qui ont des scripts : le site statique n'en a aucun, donc il n'a
pas de groupe « Scripts ».
