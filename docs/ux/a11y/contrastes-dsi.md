# Contrastes de la peau DSI (L24)

> Vérification des jetons de couleur de `packages/ui/src/tokens.css`, en clair et en sombre, selon le RGAA 4.1 :
> - **3.2** : texte, 4,5:1 (3:1 au-delà de 24 px, ou 18,5 px en gras) ;
> - **3.3** : composants d'interface et éléments graphiques porteurs d'information, 3:1 ;
> - **10.7** : focus visible.
>
> Calcul selon la formule WCAG 2.1 de la luminance relative, sur les couples réellement utilisés par les composants (`base.css`, `controls.css`) et par les écrans validés.

## 1. Synthèse

- **Thème sombre** : tous les couples sont conformes.
- **Thème clair** : trois écarts de jetons, à corriger (A11Y-11, A11Y-12, A11Y-13), et des barres de graphique sous 3:1, acceptables à une condition (A11Y-14).

| Écart | Jeton | Valeur | Rapport mesuré | Correction proposée | Nouveau rapport |
|---|---|---|---|---|---|
| A11Y-11 | `text-subtle` sur `bg` | #66727F sur #EEF2F6 | 4,36:1 | **#5F6B78** | 4,83:1 sur le fond, 5,44:1 sur carte |
| A11Y-12 | `border-strong` sur `bg` (champs posés sur le fond : recherche du tableau de bord, filtres) | #8793A3 sur #EEF2F6 | 2,77:1 | **#768294** | 3,46:1 sur le fond, 3,90:1 sur carte |
| A11Y-13 | `focus` (anneau extérieur) sur `bg` | #2897D5 sur #EEF2F6 | 2,88:1 | **#1F7FB6** pour l'anneau seulement ; #2897D5 reste la couleur de marque | 3,91:1 sur le fond, 4,40:1 sur carte |

**Anneau de focus** : `--fd-shadow-focus` trace un double anneau, 2 px de la couleur du fond (blanc en clair, #0B0D10 en sombre), puis 2 px de bleu.
- Contre un bouton prune, c'est l'anneau intérieur qui fait le contraste : blanc sur prune 7,38:1, et #0B0D10 sur le prune sombre 7,28:1. C'est conforme, même si le bleu seul ne l'est pas sur le prune.
- Seul le bleu contre le fond clair #EEF2F6 est trop faible, d'où A11Y-13.

**Graphiques** (A11Y-14) :
- l'orange `chart-1` (2,35:1) et le vert `chart-4` (2,12:1) sur blanc sont sous 3:1 ;
- l'exception du critère 3.3 s'applique si l'information est donnée autrement. C'est le cas des écrans validés (valeur écrite à côté de chaque barre, légende textuelle) ;
- règle à tenir : **jamais de barre sans sa valeur écrite**.

**Texte désactivé** (`text-disabled`) : exempté par le RGAA (composant inactif).

## 2. Mesures détaillées

### Thème clair

| Usage | Premier plan | Fond | Rapport | Seuil | Résultat |
|---|---|---|---|---|---|
| Texte courant sur le fond | `text` #080808 | `bg` #EEF2F6 | 17,80:1 | 4,5 | Conforme |
| Texte courant sur carte | `text` #080808 | `surface` #FFFFFF | 20,03:1 | 4,5 | Conforme |
| Texte secondaire sur le fond | `text-muted` #4F5966 | `bg` #EEF2F6 | 6,32:1 | 4,5 | Conforme |
| Texte secondaire sur carte | `text-muted` #4F5966 | `surface` #FFFFFF | 7,11:1 | 4,5 | Conforme |
| Texte secondaire sur zone en creux | `text-muted` #4F5966 | `surface-sunken` #F6F8FA | 6,68:1 | 4,5 | Conforme |
| Texte discret (aide, méta) sur carte | `text-subtle` #66727F | `surface` #FFFFFF | 4,91:1 | 4,5 | Conforme |
| Texte discret sur le fond | `text-subtle` #66727F | `bg` #EEF2F6 | 4,36:1 | 4,5 | **Non conforme** |
| Texte discret sur zone en creux | `text-subtle` #66727F | `surface-sunken` #F6F8FA | 4,61:1 | 4,5 | Conforme |
| Texte désactivé (exempté) | `text-disabled` #8793A3 | `surface` #FFFFFF | 3,12:1 | — | Conforme |
| Lien et bouton secondaire prune sur carte | `primary` #A3195B | `surface` #FFFFFF | 7,38:1 | 4,5 | Conforme |
| Lien prune sur le fond | `primary` #A3195B | `bg` #EEF2F6 | 6,56:1 | 4,5 | Conforme |
| Texte du bouton primaire | `on-primary` #FFFFFF | `primary` #A3195B | 7,38:1 | 4,5 | Conforme |
| Bouton primaire survolé | `on-primary` #FFFFFF | `primary-hover` #85164B | 9,49:1 | 4,5 | Conforme |
| Pastille prune pâle | `primary-soft-text` #85164B | `primary-soft` #FBF0F5 | 8,53:1 | 4,5 | Conforme |
| Pastille framboise pâle | `accent-soft-text` #AE0A44 | `accent-soft` #FDEFF3 | 6,43:1 | 4,5 | Conforme |
| Bouton framboise | `on-accent` #FFFFFF | `accent` #D60B52 | 5,21:1 | 4,5 | Conforme |
| Texte d'erreur sur carte | `danger` #D60B52 | `surface` #FFFFFF | 5,21:1 | 4,5 | Conforme |
| Texte d'erreur sur le fond | `danger` #D60B52 | `bg` #EEF2F6 | 4,63:1 | 4,5 | Conforme |
| Bouton danger | `on-danger` #FFFFFF | `danger` #D60B52 | 5,21:1 | 4,5 | Conforme |
| Texte de succès | `success` #557014 | `surface` #FFFFFF | 5,65:1 | 4,5 | Conforme |
| Badge succès | `success` #557014 | `success-soft` #F5F9E8 | 5,28:1 | 4,5 | Conforme |
| Texte d'avertissement | `warning` #855104 | `surface` #FFFFFF | 6,61:1 | 4,5 | Conforme |
| Badge avertissement | `warning` #855104 | `warning-soft` #FFF6E8 | 6,17:1 | 4,5 | Conforme |
| Texte d'information | `info` #1E6A95 | `surface` #FFFFFF | 5,91:1 | 4,5 | Conforme |
| Alerte d'information | `info` #1E6A95 | `info-soft` #EDF6FC | 5,40:1 | 4,5 | Conforme |
| Entrée active de la navigation | `on-nav-active` #FFFFFF | `nav-active` #080808 | 20,03:1 | 4,5 | Conforme |
| Texte sur la carte héros verte | `on-hero` #080808 | `hero` #95C11F | 9,47:1 | 4,5 | Conforme |
| Texte secondaire sur la carte héros | `hero-muted` #2E3A0A | `hero` #95C11F | 5,75:1 | 4,5 | Conforme |
| Pastille de tendance en hausse | `trend-up` #3F5410 | `trend-up-soft` #E6F0C7 | 7,10:1 | 4,5 | Conforme |
| Pastille de tendance en baisse | `trend-down` #AE0A44 | `trend-down-soft` #FDEFF3 | 6,43:1 | 4,5 | Conforme |
| Bordure des champs (composant) | `border-strong` #8793A3 | `surface` #FFFFFF | 3,12:1 | 3,0 | Conforme |
| Bordure des champs sur le fond | `border-strong` #8793A3 | `bg` #EEF2F6 | 2,77:1 | 3,0 | **Non conforme** |
| Séparateur décoratif (non exigé) | `border` #E2E8EF | `surface` #FFFFFF | 1,23:1 | — | Conforme |
| Anneau de focus sur carte | `focus` #2897D5 | `surface` #FFFFFF | 3,24:1 | 3,0 | Conforme |
| Anneau de focus sur le fond | `focus` #2897D5 | `bg` #EEF2F6 | 2,88:1 | 3,0 | **Non conforme** |
| Anneau de focus autour d'un bouton prune | `focus` #2897D5 | `primary` #A3195B | 2,27:1 | 3,0 | **Non conforme** |
| Point chaud sur capture claire | `hotspot` #D60B52 | `surface` #FFFFFF | 5,21:1 | 3,0 | Conforme |
| Barre de graphique orange | `chart-1` #F39200 | `surface` #FFFFFF | 2,35:1 | 3,0 | **Non conforme** |
| Barre de graphique bleue | `chart-3` #2897D5 | `surface` #FFFFFF | 3,24:1 | 3,0 | Conforme |
| Barre de graphique verte | `chart-4` #95C11F | `surface` #FFFFFF | 2,12:1 | 3,0 | **Non conforme** |
| Barre de progression sur sa piste | `chart-1` #F39200 | `chart-track` #FDE9CC | 1,98:1 | 3,0 | **Non conforme** |

### Thème sombre

| Usage | Premier plan | Fond | Rapport | Seuil | Résultat |
|---|---|---|---|---|---|
| Texte courant sur le fond | `text` #F3F5F8 | `bg` #0B0D10 | 17,81:1 | 4,5 | Conforme |
| Texte courant sur carte | `text` #F3F5F8 | `surface` #15191F | 16,15:1 | 4,5 | Conforme |
| Texte secondaire sur le fond | `text-muted` #A9B3BF | `bg` #0B0D10 | 9,16:1 | 4,5 | Conforme |
| Texte secondaire sur carte | `text-muted` #A9B3BF | `surface` #15191F | 8,30:1 | 4,5 | Conforme |
| Texte secondaire sur zone en creux | `text-muted` #A9B3BF | `surface-sunken` #0F1216 | 8,84:1 | 4,5 | Conforme |
| Texte discret (aide, méta) sur carte | `text-subtle` #8A95A3 | `surface` #15191F | 5,80:1 | 4,5 | Conforme |
| Texte discret sur le fond | `text-subtle` #8A95A3 | `bg` #0B0D10 | 6,40:1 | 4,5 | Conforme |
| Texte discret sur zone en creux | `text-subtle` #8A95A3 | `surface-sunken` #0F1216 | 6,18:1 | 4,5 | Conforme |
| Texte désactivé (exempté) | `text-disabled` #4B5563 | `surface` #15191F | 2,33:1 | — | Conforme |
| Lien et bouton secondaire prune sur carte | `primary` #CF86A9 | `surface` #15191F | 6,41:1 | 4,5 | Conforme |
| Lien prune sur le fond | `primary` #CF86A9 | `bg` #0B0D10 | 7,08:1 | 4,5 | Conforme |
| Texte du bouton primaire | `on-primary` #080808 | `primary` #CF86A9 | 7,28:1 | 4,5 | Conforme |
| Bouton primaire survolé | `on-primary` #080808 | `primary-hover` #E3A9C4 | 10,24:1 | 4,5 | Conforme |
| Pastille prune pâle | `primary-soft-text` #E3A9C4 | `primary-soft` #35101F | 8,62:1 | 4,5 | Conforme |
| Pastille framboise pâle | `accent-soft-text` #E97FA4 | `accent-soft` #36101D | 6,44:1 | 4,5 | Conforme |
| Bouton framboise | `on-accent` #080808 | `accent` #E35889 | 5,74:1 | 4,5 | Conforme |
| Texte d'erreur sur carte | `danger` #F07CA2 | `surface` #15191F | 6,81:1 | 4,5 | Conforme |
| Texte d'erreur sur le fond | `danger` #F07CA2 | `bg` #0B0D10 | 7,51:1 | 4,5 | Conforme |
| Bouton danger | `on-danger` #080808 | `danger` #F07CA2 | 7,73:1 | 4,5 | Conforme |
| Texte de succès | `success` #AED054 | `surface` #15191F | 10,04:1 | 4,5 | Conforme |
| Badge succès | `success` #AED054 | `success-soft` #1C2409 | 9,15:1 | 4,5 | Conforme |
| Texte d'avertissement | `warning` #F8BB61 | `surface` #15191F | 10,31:1 | 4,5 | Conforme |
| Badge avertissement | `warning` #F8BB61 | `warning-soft` #2B1D05 | 9,58:1 | 4,5 | Conforme |
| Texte d'information | `info` #7ABFE5 | `surface` #15191F | 8,74:1 | 4,5 | Conforme |
| Alerte d'information | `info` #7ABFE5 | `info-soft` #0E2231 | 8,06:1 | 4,5 | Conforme |
| Entrée active de la navigation | `on-nav-active` #080808 | `nav-active` #F3F5F8 | 18,34:1 | 4,5 | Conforme |
| Texte sur la carte héros verte | `on-hero` #080808 | `hero` #95C11F | 9,47:1 | 4,5 | Conforme |
| Texte secondaire sur la carte héros | `hero-muted` #2E3A0A | `hero` #95C11F | 5,75:1 | 4,5 | Conforme |
| Pastille de tendance en hausse | `trend-up` #AED054 | `trend-up-soft` #1C2409 | 9,15:1 | 4,5 | Conforme |
| Pastille de tendance en baisse | `trend-down` #E97FA4 | `trend-down-soft` #36101D | 6,44:1 | 4,5 | Conforme |
| Bordure des champs (composant) | `border-strong` #6B7787 | `surface` #15191F | 3,87:1 | 3,0 | Conforme |
| Bordure des champs sur le fond | `border-strong` #6B7787 | `bg` #0B0D10 | 4,27:1 | 3,0 | Conforme |
| Séparateur décoratif (non exigé) | `border` #272E37 | `surface` #15191F | 1,29:1 | — | Conforme |
| Anneau de focus sur carte | `focus` #51ABDD | `surface` #15191F | 6,90:1 | 3,0 | Conforme |
| Anneau de focus sur le fond | `focus` #51ABDD | `bg` #0B0D10 | 7,62:1 | 3,0 | Conforme |
| Anneau de focus autour d'un bouton prune | `focus` #51ABDD | `primary` #CF86A9 | 1,08:1 | 3,0 | **Non conforme** |
| Point chaud sur capture claire | `hotspot` #DC326D | `surface` #15191F | 3,96:1 | 3,0 | Conforme |
| Barre de graphique orange | `chart-1` #F5A730 | `surface` #15191F | 8,78:1 | 3,0 | Conforme |
| Barre de graphique bleue | `chart-3` #51ABDD | `surface` #15191F | 6,90:1 | 3,0 | Conforme |
| Barre de graphique verte | `chart-4` #95C11F | `surface` #15191F | 8,34:1 | 3,0 | Conforme |
| Barre de progression sur sa piste | `chart-1` #F5A730 | `chart-track` #33270F | 7,27:1 | 3,0 | Conforme |
## 3. Couleurs hors jetons

| Usage | Couleurs | Rapport | Résultat |
|---|---|---|---|
| Repère framboise des captures (PDF, lecteur) sur capture claire | #D60B52 sur #FFFFFF | 5,21:1 | Conforme (3:1 exigé) |
| Badge « Mot de passe » du centre (L14) | #6B3A00 sur #FDF0E0 | 8,39:1 | Conforme |
| Couleur principale du workspace, réglable (L14-08) | contrôlée en direct, refusée sous 4,5:1 | — | Conforme par construction |
| Carte héros verte | #080808 sur #95C11F | 9,47:1 | Conforme |

## 4. Règles pour la suite

- Tout nouveau jeton de texte doit atteindre 4,5:1 sur `bg`, `surface` et `surface-sunken`, et pas seulement sur `surface`.
- Une bordure qui délimite un champ ou un contrôle (pas un séparateur décoratif) doit atteindre 3:1 contre son fond réel.
- Le focus reste le double anneau. Sa couleur extérieure est contrôlée contre `bg` et `surface`.
