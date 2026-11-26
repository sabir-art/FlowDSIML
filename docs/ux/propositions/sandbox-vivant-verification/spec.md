# « Vérifier avant l'envoi » en mode Sandbox vivant (Sandbox v2, à brancher en 3c)

Planche : `planche-verification-sandbox-vivant.png` (avant 3b annoté, après en clair et en sombre, après avec chat.js gardé). Captures pleine taille : `apres-clair.png`, `apres-sombre.png`, `apres-chat-garde-clair.png`.

L'après garde **les mêmes composants** que l'écran actuel (`.sumbar`, `.note`, `section.grp`, `.gh2`, `li.el2`, `.st2`, `.wy`, `.bt.ac2`). Seuls les textes, l'ordre des groupes et le contenu des lignes changent. La copie inerte (démo guidée) ne change pas.

## Règles

1. **Mode vivant** (Sandbox avec enregistrement) : on n'affiche plus aucun texte de la copie inerte (« copie fixe », « non copiés », « la démo n'en a pas besoin »).
2. **Compteurs** : Pages copiées · Scripts rejoués · Scripts bloqués · Gardés par vous.
3. **Groupes, dans cet ordre** :
   1. Pages copiées ;
   2. Scripts ;
   3. Réponses du site ;
   4. Éléments ajoutés par un script ;
   5. Données personnelles remplacées ;
   6. Formulaires ;
   7. Liens externes.

   « Sandbox vivant », « Scripts de la page » et « Scripts de suivi » disparaissent en mode vivant.
4. **Scripts** : une ligne par script et par page.
   - Nom ou source en `code`, puis catégorie et page en meta.
   - État en pastille : Rejoué (coche) ou Bloqué.
   - Action inverse : Bloquer ou Garder. « Pourquoi ? » reprend les textes actuels `live.why.*`.
   - La mesure d'audience garde sa catégorie « Mesure d'audience » quand elle est reconnue.
5. **Pastilles** : l'état par défaut est **neutre** (`.st2`). L'orange (`.st2.kp`) est réservé à un **choix de l'auteur** : « Gardé » pour un script d'un autre site rétabli, « Affiché » pour un élément dont le script est gardé. Ces choix sont ceux que compte « Gardés par vous ».
6. **Réponses du site** : un groupe à part, une ligne par page, avec « n réponses lues par la page · n données remplacées » (ou « aucune donnée personnelle ») et la pastille Rejouées. Pas d'action.
7. **Éléments ajoutés par un script** : pas d'action propre, ils suivent leur script.
   - Pastille « Absent » si le script est bloqué, « Affiché » s'il est gardé.
   - Meta : « Ajouté par {source} · {page} ».
8. **Données personnelles remplacées** : dans les pages **et** dans les réponses, avec « Garder », comme aujourd'hui.

## Textes (FR)

| Clé (proposée) | Texte |
| --- | --- |
| `introLive` | Votre Sandbox rejoue les pages avec leurs scripts et les données qu’elles ont lues : menus, onglets et formulaires réagissent comme sur le site. Tout se passe dans une boîte fermée, sans aucune sortie réseau. Voici ce que TutoClick a bloqué ou protégé. Vous n’avez rien à faire, sauf si vous voulez changer un choix. |
| `sumPlayed` / `sumBlocked` | Scripts rejoués / Scripts bloqués |
| `noteLive_one` | 1 script d’un autre site est bloqué : « Garder » le rejoue, toujours sans accès au réseau. Si la page envoie quelque chose au site, elle reçoit un succès fictif. |
| `noteLive_other` | {{n}} scripts d’autres sites sont bloqués ({{kinds}}) : « Garder » en rejoue un, toujours sans accès au réseau. Si la page envoie quelque chose au site, elle reçoit un succès fictif. |
| `noteLiveNone` | Aucun script n’est bloqué. Si la page envoie quelque chose au site, elle reçoit un succès fictif. |
| `group.scripts` | Scripts — « {{played}} rejoués · {{blocked}} bloqués » |
| `group.responses` | Réponses du site — « Rejouées dans la démo, avec des valeurs fictives » |
| `group.widgetsLive` | Éléments ajoutés par un script — « Ils suivent leur script : absents tant qu’il est bloqué » |
| `group.piiLive` | Données personnelles remplacées — « Dans les pages et les réponses du site » |
| `group.formsLive` | Formulaires — « Envoi simulé : succès fictif, rien ne part vers le site » |
| `status.absent` / `status.shown` / `status.kept` | Absent / Affiché / Gardé |
| `whyWidgetLive` | Ajouté à la page par {{source}}. Dans le Sandbox, il apparaît seulement si ce script est gardé ; il réagit alors comme sur le site, sans accès au réseau. |

L'anglais suit la même structure.

## e2e à ajouter (html-verification ou capture-v2)

1. En Sandbox vivant, l'écran ne contient ni « copie fixe » ni « non copié ».
2. Il y a un seul groupe de scripts. « Scripts de la page » et « Scripts de suivi » sont absents.
3. « Garder » sur un script d'un autre site :
   - la pastille passe à « Gardé » (`.kp`) ;
   - le compteur « Gardés par vous » augmente de 1 ;
   - l'élément ajouté par ce script passe d'« Absent » à « Affiché ».
4. Les réponses du site forment leur propre groupe, et aucune ligne de réponse n'apparaît dans les scripts.
5. Axe : aucune violation grave, en clair et en sombre.
