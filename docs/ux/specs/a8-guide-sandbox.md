# A8 : guide optionnel du Sandbox (fiche 003)

> Précise la ligne « guide optionnel » de `a8-html.md` §3. Backlog validé par le chef le 21 novembre (priorité 2).
> État relevé sur `main` (ea2d63c) :
> - `sandboxSchema.guide` existe (booléen, `false` par défaut) ;
> - dans le plan, « Ajouter un guide optionnel (étapes F1 par-dessus) » est affiché avec « Bientôt » (`SandboxPlan.tsx`, l. 459).
>
> Règles : `composants.md` §17 et §18. Données fictives uniquement (Acme, `*.example`).

## 1. Le besoin

- Un Sandbox laisse le visiteur cliquer librement dans une copie du logiciel. C'est utile pour s'entraîner, mais un conseiller qui découvre l'outil ne sait pas par où commencer.
- Le guide donne un **fil conducteur** : quelques bulles qui montrent, page après page, les gestes d'une tâche (« Créer un rendez-vous », par exemple).
- Le visiteur reste **libre** :
  - il peut ignorer le guide, le mettre en pause en allant ailleurs, puis le reprendre ;
  - le guide ne bloque jamais la navigation.
- La complétion ne change pas : elle reste « a vu les pages clés » (§3 de `a8-html.md`). Le guide est une aide, pas une condition.

## 2. Modèle (reprise de l'existant)

- **Bulles** : ce sont les hotspots F1 des pages HTML (`step.hotspots`), avec le même schéma et le même éditeur que les étapes HTML d'une démo guidée :
  - titre, texte, placement ;
  - style Walkthrough ou Spotlight ;
  - même ancrage.
- **Ordre du guide** : il est ajouté aux réglages du Sandbox.

```ts
sandboxSchema = z.object({
  // … existant : start, autoLink, unlinked, guide, keyPages
  guide: z.boolean().default(false),               // guide activé
  guideSteps: z.array(z.object({
    page: z.string().max(40),                      // id de l'étape (page HTML)
    hotspot: z.string().max(40),                   // id du hotspot de cette page
    advance: z.enum(['click', 'next']).default('click'),
  })).max(30).default([]).catch([]),
});
```

- `advance` dit comment l'étape avance :
  - `click` (par défaut) : quand le visiteur clique dans la zone du hotspot. Si la zone recouvre un lien relié, la navigation se fait comme d'habitude, et le guide passe à l'étape suivante sur la nouvelle page.
  - `next` : la bulle a un bouton « Suivant », pour une explication sans geste.
- Une étape du guide dont la page ou le hotspot n'existe plus est **ignorée** par le lecteur. Dans l'éditeur, elle est signalée (§3.3).
- Hors guide, les hotspots d'une page de Sandbox ne s'affichent pas : seuls ceux de `guideSteps` sont montrés, un à la fois.

## 3. Éditeur

### 3.1 Réglage dans le plan
- La ligne « Ajouter un guide optionnel (étapes F1 par-dessus) · Bientôt » devient un interrupteur « Guide optionnel », avec l'aide « Des bulles qui montrent une tâche pas à pas. Le visiteur peut les ignorer. »
- Activé, il affiche dessous le bloc « Étapes du guide · {n} ».

### 3.2 Liste « Étapes du guide »
- Une ligne par étape :
  - le numéro, en 13 px 600 ;
  - le titre de la bulle (ou le début du texte), sur une ligne, avec des points de suspension ;
  - le nom de la page, en 13 px `text-muted` ;
  - « Au clic » ou « Bouton Suivant », en 13 px `text-muted` ;
  - le menu « Plus d'actions » : Modifier la bulle, Monter, Descendre, « Avancer au clic » ou « Avancer avec Suivant », Retirer du guide.
- On réordonne la liste par glisser-déposer, ou au clavier avec Monter et Descendre.
- Sous la liste, « Ajouter une étape » (bouton secondaire, icône `plus`) :
  - il ouvre la page courante du plan en mode Étape (vue Page) ;
  - l'auteur dessine la zone, comme pour une étape HTML guidée, et la bulle s'ouvre dans le panneau ;
  - à l'enregistrement, l'étape s'ajoute **à la fin** du guide.
- Liste vide : « Aucune étape. Ouvrez une page, puis « Ajouter une étape » pour placer la première bulle. »
- Limite : à 30 étapes, « Ajouter une étape » est désactivé, avec « 30 étapes au plus ».

### 3.3 Repères dans le plan
- Sur chaque carte de page qui porte des étapes du guide : « Guide : 1, 3 », en 13 px `text-muted`, sous « n liens ». Pas de badge.
- Une étape orpheline (page ou bulle supprimée) apparaît dans la liste avec l'icône `alert-triangle` et « Bulle introuvable : retirez-la ou replacez-la. » Les actions Retirer et Modifier sont disponibles.
- Liste de contrôle avant publication : avec le guide activé mais vide, « Guide activé sans étape » (non bloquant, avec le lien « Ajouter une étape »).

### 3.4 Aperçu
- « Aperçu » joue le Sandbox avec le guide, comme le visiteur, en commençant à la page de départ.

## 4. Lecteur (visiteur)

### 4.1 Démarrage
- À l'ouverture, si le guide est activé et non vide :
  - la page de départ s'affiche avec la **bulle de l'étape 1** ;
  - la bulle porte, en pied, « Étape 1 sur {n} » (13 px `text-muted`) et le lien « Explorer sans guide ».
- Si l'étape 1 n'est pas sur la page de départ, la bulle de départ dit : « Le guide commence sur la page « {page} ». », avec le bouton « Y aller ».

### 4.2 Pendant le guide
- Une seule bulle à la fois, celle de l'étape courante, quand le visiteur est sur sa page.
- Au clic dans la zone (`click`), ou sur « Suivant » (`next`), le guide avance.
- Dans la barre du lecteur, une pastille « Guide · {k}/{n} » (icône `route`) ouvre un petit menu :
  - « Reprendre à l'étape {k} » ;
  - « Recommencer le guide » ;
  - « Quitter le guide ».

### 4.3 Hors du chemin
- Si le visiteur va sur une page qui n'est pas celle de l'étape courante :
  - la bulle disparaît, et le guide est **en pause** ;
  - la pastille devient « Guide en pause · Revenir à l'étape {k} » ;
  - un clic ramène à la page de l'étape et rouvre la bulle.
- Aucun toast, aucune alerte : la liberté est voulue.

### 4.4 Fin et sortie
- Après la dernière étape, une bulle de fin dit « Guide terminé. Continuez à explorer librement. », avec le bouton « Fermer ». La pastille disparaît.
- « Explorer sans guide » ou « Quitter le guide » masquent la bulle. La pastille devient « Reprendre le guide ».
- L'état du guide (étape, quitté, terminé) est gardé pour la session (sessionStorage), comme la progression actuelle.

### 4.5 Petit écran (390 px)
- La bulle passe en feuille du bas, comme les étapes guidées (F7, L21-06), et remonte en haut si la zone est dans le tiers bas de l'écran.
- La pastille reste dans la barre du lecteur, avec le texte court « Guide {k}/{n} ».

## 5. Accessibilité

- La bulle est `role="dialog"` **non modal** (`aria-modal="false"`), nommée par son titre. Le focus n'est pas volé à l'ouverture : le texte de la bulle est annoncé par une région `aria-live="polite"` (« Étape 2 sur 6 du guide : … »).
- Échap ferme la bulle et met le guide en pause. Le focus revient sur la pastille.
- La pastille est un `button` avec `aria-haspopup="menu"` et un nom complet (« Guide, étape 2 sur 6 »).
- En mode `click`, la zone a un équivalent clavier : le lien ou le bouton réel de la page, ou, à défaut, « Suivant » dans la bulle.
- `prefers-reduced-motion` : pas d'animation de pastille ni de glissement de la bulle.

## 6. Analytics

- Nouveaux événements (`eventTypeSchema`) :
  - `guide_step`, avec `props.index` ;
  - `guide_done` ;
  - `guide_skip`, avec `props.at` (« Explorer sans guide » ou « Quitter le guide »).
- Dans Analytics, onglet Démos, pour un Sandbox : une ligne « Guide : {x} % terminé · {y} % ignoré », en 13 px `text-muted`, sous la démo. Pas de nouveau widget.

## 7. Textes (fr)

| Clé | Texte |
|---|---|
| `editor.sandbox.guide` | Guide optionnel |
| `editor.sandbox.guideHelp` | Des bulles qui montrent une tâche pas à pas. Le visiteur peut les ignorer. |
| `editor.sandbox.guideSteps` | Étapes du guide · {{count}} |
| `editor.sandbox.guideAdd` | Ajouter une étape |
| `editor.sandbox.guideEmpty` | Aucune étape. Ouvrez une page, puis « Ajouter une étape » pour placer la première bulle. |
| `editor.sandbox.guideMax` | 30 étapes au plus |
| `editor.sandbox.guideOnClick` | Au clic |
| `editor.sandbox.guideOnNext` | Bouton Suivant |
| `editor.sandbox.guideOrphan` | Bulle introuvable : retirez-la ou replacez-la. |
| `editor.sandbox.guideOnPages` | Guide : {{list}} |
| `checklist.guideEmpty` | Guide activé sans étape |
| `player.guide.step` | Étape {{k}} sur {{n}} |
| `player.guide.skip` | Explorer sans guide |
| `player.guide.startsOn` | Le guide commence sur la page « {{page}} ». |
| `player.guide.goThere` | Y aller |
| `player.guide.pill` | Guide · {{k}}/{{n}} |
| `player.guide.pillShort` | Guide {{k}}/{{n}} |
| `player.guide.paused` | Guide en pause · Revenir à l'étape {{k}} |
| `player.guide.resume` | Reprendre le guide |
| `player.guide.resumeAt` | Reprendre à l'étape {{k}} |
| `player.guide.restart` | Recommencer le guide |
| `player.guide.quit` | Quitter le guide |
| `player.guide.done` | Guide terminé. Continuez à explorer librement. |
| `player.guide.close` | Fermer |
| `player.guide.live` | Étape {{k}} sur {{n}} du guide : {{title}} |
| `analytics.guideLine` | Guide : {{done}} % terminé · {{skip}} % ignoré |

## 8. Découpage

| Paquet | Contenu | Recette |
|---|---|---|
| **P1, modèle et lecteur** | `guideSteps` dans `sandboxSchema` ; bulle, pastille, pause, reprise, fin ; sessionStorage ; petit écran ; événements | recette 1 à 6, 9 |
| **P2, éditeur** | interrupteur, liste, ajout depuis la vue Page, ordre, orphelines, repères du plan, liste de contrôle | recette 7, 8 |
| **P3, analytics** | ligne « Guide : x % terminé · y % ignoré » | recette 10 |

## 9. Recette (1440 et 390 px, en clair et en sombre, données fictives)

1. Sandbox de 3 pages, guide de 4 étapes (2 sur la page de départ) : la bulle 1 s'affiche à l'ouverture, avec « Étape 1 sur 4 » et « Explorer sans guide ».
2. Clic dans la zone de l'étape 2, qui recouvre un lien relié : la page change et la bulle 3 s'affiche sur la nouvelle page.
3. Étape en `next` : « Suivant » avance ; la zone n'est pas cliquable pour avancer.
4. Le visiteur va sur une page hors chemin : la bulle disparaît, la pastille dit « Guide en pause · Revenir à l'étape 3 », et un clic y ramène avec la bulle.
5. « Explorer sans guide » : aucune bulle, la pastille dit « Reprendre le guide » et la reprise repart à l'étape courante.
6. Après la dernière étape : bulle « Guide terminé… », puis plus de pastille. La complétion reste celle des pages clés.
7. Éditeur : activer le guide, ajouter 2 étapes depuis la vue Page, les inverser au clavier (Monter), puis supprimer une bulle sur sa page : l'étape devient orpheline, avec le message.
8. Plan : « Guide : 1, 3 » sur les cartes concernées. Guide activé et vide : une ligne non bloquante dans la liste de contrôle.
9. Accessibilité : le focus n'est pas volé, Échap met en pause, la pastille est nommée, `aria-live` annonce l'étape. axe sans violation grave. `boutons-natifs.e2e.cjs` passe sur le lecteur avec le guide ouvert.
10. Analytics : `guide_step`, `guide_done` et `guide_skip` sont enregistrés ; la ligne du Sandbox affiche les deux pourcentages.
