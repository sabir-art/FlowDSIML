# Recette réelle du petit lot UX (65ae828 à 48e0bf8) : ROUGE

Recette du 26/11, faite à la place de l'utilisateur, sur `claude/dev-mvp` à 48e0bf8.

**Montage** :
- extension construite (`WXT_E2E=1`) et chargée dans Chromium, avec le faux Supabase et le banc (:54410) ;
- app locale (:5173) sur faux backend, données fictives.

## 1. Ce qui marche

| Commit | Ce que j'ai fait | Résultat |
|---|---|---|
| 65ae828 (données personnelles) | banc `etat-html` et `etat-captures`, puis mes pages pièges en mode HTML et Captures d'écran | voir §1.1 |
| 8f815b3 (toast) | parcours Équipe : Retirer l'invitation, puis confirmer | toast « Invitation retirée. » (`toast-invitation-retiree.png`) ; e2e Équipe 60/60 |
| fdbe2ae (titres techniques) | panneau Suggestions de l'éditeur | chaque signalement cite son champ et le début du texte (`suggestions-titres-techniques.png`) |
| 9334c3f (limite de 100 textes) | démo de 126 textes | « Analyse limitée aux 100 premiers textes sur 126 : les textes suivants, à partir de l'étape 2, ne sont pas analysés. » (`suggestions-limite-100.png`) ; e2e Suggestions 21/21 |
| 48e0bf8 (première rangée des Paramètres) | mesure du filet au premier texte, 8 pages, 1440 et 390, clair et sombre | Assistance IA et Page publique passent de 60/52 à **40/32 px**, comme les autres pages (`assistance-ia-1440-*.png`, `page-publique-1440-clair.png`) ; `parametres-espacement` 56/56 dans les 4 vues |

### 1.1 Données personnelles (65ae828)

- **Banc** : `etat-html` est conforme. La page piège a 9 états sur 9 et 0 remplacement, et la page de données 5 sur 5. `etat-captures` est conforme aussi.
- **Libellé du bouton** : un clic sur « Generate speech » donne bien « Cliquez sur « Generate speech » » (`captures-libelle-bouton.png`).
- **« Client : Camille Durand »** est remplacé (ma remarque du lot A est traitée).
- **« Responsable : Offre essentielle »** reste lisible : ce n'est pas un nom de personne.
- Adresse complète et téléphone sont toujours remplacés. « Ville : Lyon » reste lisible.

## 2. Ce qui bloque (ROUGE)

**Les noms d'un tableau sans `thead` ne sont pas remplacés.**

- Ma page (`html-tableau-sans-thead-page.png`) a un tableau dont la première ligne contient les en-têtes `th` « Nom » et « Rôle ». Il n'a pas de `thead`, ce qui est très courant dans les vrais logiciels. Ses cellules « Durand » et « Martin » sont restées en clair dans la copie.
- Dans la vérification, on voit 3 remplacements (Nom « Camille Durand », Adresse, Téléphone), mais aucun pour le tableau (`html-tableau-sans-thead-verification.png`).
- C'est une fuite de données personnelles. De plus, c'est le cas que j'avais validé au lot A : « quand un en-tête `th` est un libellé de nom, les cellules de cette colonne sont remplacées, même réduites à un mot ».

**Cause** : dans `apps/extension/lib/scan.ts`, `contextLabel` ne cherche l'en-tête que dans `thead tr` ou `[role="row"]`. Sans `thead`, il n'en trouve aucun.

**Correction demandée** :
- si le tableau n'a pas de `thead`, la ligne d'en-tête est la première ligne `tr` dont toutes les cellules (ou la plupart) sont des `th` ;
- elle n'est jamais la ligne de la cellule elle-même ;
- la règle vaut dans les deux modes (HTML et Captures d'écran).

**Banc** : il faut ajouter à la page de données un tableau sans `thead` (`th` « Nom | Rôle » dans la première ligne, puis « Durand » et « Martin »). Attendu :
- les 2 noms sont remplacés ;
- les en-têtes et les rôles restent lisibles ;
- dans le tableau voisin « Nom | Statut | Actions », « Projet Alpha » reste lisible : ce n'est pas un nom de personne.

## 3. Pour le VERT

Ce seul point. Le reste du lot est conforme et je ne le referai pas : je rejouerai le banc et ma page piège après la correction.
