# L48-E, Éditeur : rail d'outils, un panneau à la fois, en-tête allégé

> Paquet L48-E du benchmark (`benchmark-structure.md`, rang 5), **en dernier** : refonte de la disposition, sans nouvelle fonction.
> Maquette : `docs/ux/maquettes/refonte/l48e-editeur.html`. Code de départ : `apps/web/src/pages/editor/EditorPage.tsx` (b0aa6cc). Règles : `composants.md` §17, deltas T1 à T9.
> **Aucun changement de schéma, aucune fonction retirée.** Chaque réglage existant garde son composant (`GuidedStepFields`, `HotspotPanel`, `BlurPanel`, `ThemePanel`, `SettingsTab`, `CommentsPanel`, `VoiceFields`, `NextRulesFields`…). Seul l'endroit où il s'affiche change.

## 1. Disposition

```
┌ En-tête (56 px) ───────────────────────────────────────────────────────────┐
│ ←  Titre · état            ↶ ↷  [Édition|Aperçu]          ⋯  Partager  Publier │
├ Étapes (248) ┬ Canevas (flexible) ───────────────┬ Panneau (360) ┬ Rail (56) ┤
```

- De gauche à droite : la **colonne des étapes** (inchangée), le **canevas**, le **panneau** de l'outil actif, puis le **rail**.
- **Le panneau se ferme** : un clic sur l'outil actif, Échap ou le bouton `x` du panneau. Le canevas prend alors la place.
- La **barre flottante du canevas** (point d'intérêt, flou, zoom, recadrage, image) **disparaît** : ses outils passent dans le rail.
  - Le menu d'affichage « Ajuster » reste en haut à droite du canevas : c'est un réglage de vue, pas un outil d'édition.
- Les **commentaires** quittent le tiroir du bas pour le rail (§5). Le canevas garde toute sa hauteur.

## 2. Rail d'outils (56 px)

- Fond `surface`, filet de 1 px `border` à gauche.
- `role="toolbar"` avec `aria-orientation="vertical"`, nommé « Outils de l'étape ». Navigation aux flèches haut et bas.
- **Boutons à icône** de 40 × 40 px, icône Lucide de 20 px, avec une infobulle L44 à gauche (nom et raccourci).
- **Actif** : `aria-pressed="true"`, fond `surface-sunken` et icône `text`. Inactif : icône `text-muted`. Pas de couleur `primary`.
- Les groupes sont séparés par un filet de 24 px, sans titre visible. Chaque groupe est un `role="group"` avec un `aria-label`.

| Groupe | Outil (icône) | Panneau | Contenu actuel déplacé |
|---|---|---|---|
| Contenu | **Étape** (`type`) | Étape | Titre, texte de la bulle (L46), texte alternatif, animation de l'étape |
| | **Bouton d'action** (`mouse-pointer-click`) | Bouton d'action | `CtaFields` |
| | **Points d'intérêt** (`target`) | Points d'intérêt | `HotspotPanel` ; met le canevas en mode « placer un point » |
| | **Voix off** (`mic`) | Voix off | `VoiceFields` |
| | **Suite du parcours** (`git-branch`) | Suite du parcours | `NextRulesFields` (embranchements existants) |
| Écran | **Flou** (`droplet`) | Modale plein écran (§4) | `BlurPanel` et le flou automatique |
| | **Zoom** (`zoom-in`) | Zoom | « Zoom sur une zone » |
| | **Recadrage** (`crop`) | Recadrage | Recadrage actuel |
| | **Image** (`image`) | Image | Remplacer la capture |
| Apparence | **Design** (`palette`) | Design | `ThemePanel` |
| Collaborer | **Commentaires** (`message-square`) | Commentaires, 400 px (§5) | `CommentsPanel` ; un point `primary` de 8 px si un commentaire est non lu |
| | **Assistant** (`sparkles`) | Assistant, 400 px (L43) | Suggestions (ampoule actuelle de l'en-tête) |
| Bas du rail | **Réglages** (`settings`) | Réglages de la démo | `SettingsTab`, dont les notes du présentateur |

- Les outils sans objet pour l'étape ne sont pas masqués. Ils sont désactivés (`aria-disabled`), avec la raison dans l'infobulle. Exemples :
  - « Zoom » sur une étape HTML : « Pas de zoom sur une page HTML » ;
  - « Recadrage » sur une étape vidéo.
- **Pas d'entrée « Bientôt » dans le rail.** Le benchmark prévoyait d'y mettre « Document » avec ce badge. Je ne le retiens pas : un outil inutilisable dans une barre d'outils allonge la recherche à chaque clic (loi de Hick). Les types d'étape à venir restent annoncés dans « Ajouter une étape » (L48-G).
- **Raccourcis** : ceux d'aujourd'hui restent (`ShortcutsDialog`). On ajoute `Alt` + `1` à `9` pour ouvrir les 9 premiers outils, dans l'ordre du rail. Ils ne s'appliquent pas quand le focus est dans un champ de saisie : sur un clavier Mac AZERTY, `Alt` + chiffre écrit un caractère.

## 3. Panneau (360 px)

- En-tête de 56 px : le nom de l'outil en 17 px 600, puis le bouton `x` (« Fermer le panneau »).
- Le contenu défile seul. Les sections sont séparées par un filet, avec un titre en 13 px 600, en casse normale (plus de capitales espacées).
- **Un seul panneau ouvert à la fois.** Ouvrir un outil remplace le panneau ; le focus va sur le titre du panneau.
- **Lien avec le canevas** :
  - un clic sur un point d'intérêt ouvre « Points d'intérêt » et sélectionne ce point ;
  - un clic sur la bulle ouvre « Étape », avec le focus dans le texte.
- Le dernier outil ouvert est gardé par personne (`localStorage`, `fd.editor.tool`). Au premier usage, c'est « Étape ».
- « Supprimer l'étape » reste dans le panneau Étape, mais en pied, en bouton `ghost` au texte `danger`, et non plus en icône à côté du titre. Il garde sa confirmation.

## 4. Flou, en modale plein écran

- « Flou » ouvre une modale plein écran (`dialog` modal). Elle contient :
  - en-tête : « Flouter des zones », puis Annuler (`ghost`) et « Appliquer le flou » (`primary`) ;
  - au centre, la capture, avec le zoom (− et +, et « Ajuster ») ; on dessine les zones au glisser ;
  - à droite, une colonne de 300 px :
    - la liste des zones (une ligne par zone, bouton « Retirer ») ;
    - les réglages actuels de `BlurPanel` pour la zone choisie : style de masquage (Flou, Pixels, Aplat), intensité, « Appliquer à » (cette étape ou toutes les étapes).
  - Pas de détection automatique : elle n'existe pas dans l'éditeur. Le benchmark parlait d'un « flou automatique existant », c'était une erreur. Je ne l'ajoute pas.
- « Annuler », comme Échap, demande confirmation si des zones ont changé. « Appliquer » enregistre et revient à l'éditeur, sur la même étape.

## 5. Commentaires dans le rail (arbitrage L43)

- **Décision** : les commentaires passent du tiroir du bas à un **panneau latéral de 400 px**, comme l'assistant. Le tiroir écrasait le canevas de 40 % en hauteur.
- Contenu inchangé : fil par étape, composeur L43, mentions et résolution.
- « Interne à l'équipe · jamais publié » reste sous le titre du panneau, en 13 px `text-muted`.
- Les liens « Voir le commentaire » des notifications ouvrent l'éditeur avec ce panneau ouvert (`?outil=commentaires&c=<id>`).

## 6. En-tête (56 px)

- **À gauche** :
  - retour ;
  - titre (15 px 600, modifiable au clic, comme aujourd'hui) ;
  - **état en texte**, sans pastille : « Enregistré » ou « Enregistrement… », puis « · Non publié » s'il y a des modifications non publiées. 13 px `text-muted` ; « Non publié » en `warning` avec un point de 8 px.
- **Au centre** : Annuler et Rétablir (boutons à icône), puis le segmenté Édition et Aperçu.
- **À droite** :
  - **Plus** (`dots`), qui ouvre un menu :
    - Présenter ; Diffuser ; Exporter ; Traduire ; Rédiger avec l'IA ; Quiz ; Rechercher et remplacer ;
    - un filet ;
    - Raccourcis clavier, Aide (F1) ;
    - Versions, avec « Bientôt » en texte à droite.
    - Les entrées gardent leurs conditions d'aujourd'hui (droits, règles d'export).
  - **Partager** (secondaire) et **Publier** (principal, le seul de l'écran).
- Les icônes Commentaires, Idées et Aide quittent l'en-tête. Commentaires et Assistant sont dans le rail ; l'aide est sous F1 et dans Plus.

## 7. Petits écrans

- **De 1024 à 1279 px** : le panneau passe **au-dessus du canevas** (superposé, ombre `0 16px 48px rgb(8 10 14 / .16)`) au lieu de le pousser. Le rail reste.
- **Moins de 1024 px** : `EditorNarrow` actuel, inchangé.

## 8. Recette

1. Chaque réglage de l'ancien panneau à onglets se retrouve dans un outil du rail. Le tableau du §2 sert de liste à cocher.
2. Un seul panneau ouvert ; un clic sur l'outil actif le ferme et le canevas s'élargit.
3. Clic sur un point d'intérêt du canevas : le panneau « Points d'intérêt » s'ouvre avec ce point sélectionné.
4. Flou : dessiner 2 zones, puis Annuler : confirmation. Appliquer : les zones sont enregistrées et on revient sur la même étape.
5. Commentaires : le canevas garde sa hauteur ; le composeur L43 est en bas du panneau ; le point non lu disparaît à l'ouverture.
6. En-tête : un seul bouton `primary` (Publier) ; Présenter, Exporter et Traduire sont dans Plus, avec les mêmes conditions qu'avant.
7. Clavier :
   - Tab passe de l'en-tête aux étapes, au canevas, au panneau, puis au rail ;
   - flèches dans le rail ; `Alt` + `3` ouvre Points d'intérêt ; Échap ferme le panneau et rend le focus à l'outil.
8. Étape HTML : Zoom et Recadrage sont désactivés et l'infobulle donne la raison.
9. Sombre : outil actif et filets à 3:1 au moins sur le fond du rail.
