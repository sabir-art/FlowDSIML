# L63 — Assistant IA : présentation des corrections et choix du modèle

Retour de l'utilisateur du 25/11 (tests réels) : dans l'assistant de l'éditeur, l'ancien texte est barré et illisible. Planche : `docs/ux/propositions/l63/planche-l63.png`. Elle montre l'écran actuel, la proposition en clair et en sombre, le menu des modèles, et la section Modèles des Paramètres.

## 1. Une proposition par étape et par champ

Chaque proposition est une carte : surface, bordure, rayon 12 px (RADIUS-01), retrait 12 px, 8 px entre deux cartes.

1. **En-tête** : « Étape {n} · {nom de l'étape} », en 13 px demi-gras, suivi d'une étiquette (BADGE-01 neutre) qui nomme le champ concerné : « Titre », « Texte de la bulle », « Bouton », « Note du présentateur », « Texte alternatif ».
2. **Avant** :
   - un libellé 12 px gris, puis le texte actuel dans un bloc `--fd-color-surface-sunken` de 14 px, en couleur de texte normale ;
   - **aucun barré** ;
   - les passages qui disparaissent sont **surlignés** en framboise doux : `--fd-framboise-100` / `--fd-framboise-800`, ou en sombre framboise-500 à 24 % / framboise-200.
3. **Après (proposé)** :
   - un libellé 12 px gris, puis le texte proposé dans un bloc à bordure ;
   - les passages ajoutés ou changés sont surlignés en vert doux (`--fd-vert-100` / `--fd-vert-800`, ou en sombre vert-500 à 24 % / vert-200).
4. **Variables** : elles s'affichent en pastille lisible (« Entreprise », « Prénom »), jamais en `{{company|vous}}`. Une variable ne peut pas être cassée par une proposition : elle est soit gardée, soit supprimée entière.
5. **Couleur et lecteurs d'écran** :
   - la couleur ne porte jamais seule le sens ;
   - pour les lecteurs d'écran, chaque passage est annoncé par « supprimé : … » ou « ajouté : … » (texte masqué à la vue) ;
   - la carte est un `role="group"` nommé « Étape {n}, {champ}, proposition ».
6. **Actions** :
   - **Appliquer** (primaire, petit, 32 px) et **Ignorer** (fantôme, petit) ;
   - après « Appliquer », les boutons laissent place à « ✓ Appliquée » en vert, avec un bouton fantôme **Annuler** pendant toute la session de l'assistant ;
   - après « Ignorer », la carte se replie en une ligne « Ignorée · Rétablir ».
7. **Ordre** : celui des étapes, puis des champs dans l'étape. Les cartes déjà appliquées restent visibles, repliées, jusqu'à la fermeture de l'assistant.

## 2. « Tout appliquer »

- Une barre collée en bas de la conversation, au-dessus du champ de saisie, filet en haut, fond `--fd-color-surface`.
- À gauche : « {n} en attente ». À droite : **Tout ignorer** (fantôme) et **Tout appliquer** (primaire).
- Elle n'apparaît que s'il reste au moins deux propositions en attente.
- « Tout appliquer » applique les propositions dans l'ordre. Un toast confirme « {n} propositions appliquées » avec « Annuler », qui annule le lot entier. Chaque application est aussi annulable dans l'historique de l'éditeur (Ctrl Z).

## 3. Modèle utilisé

- **Ligne sous l'en-tête de l'assistant** : « Modèle » (13 px gris), puis un sélecteur de 32 px (RADIUS-01 petit contrôle) qui affiche le modèle courant, par exemple « Claude Sonnet ».
- **Menu du sélecteur** : la liste des modèles autorisés par le propriétaire.
  - Chaque modèle a son nom et une ligne d'aide : « Rapide, pour la plupart des textes » pour Sonnet, « Plus précis, plus lent » pour Opus.
  - Le modèle courant est coché.
  - Une dernière ligne, grise, indique « Autres fournisseurs · Bientôt » et « Modèles choisis par le propriétaire dans Paramètres › Assistance IA ».
- **Un seul modèle autorisé** : son nom s'affiche en texte simple, sans sélecteur.
- **Mémoire du choix** : il est retenu pour la personne, par espace.
- **Traçabilité** : chaque réponse de l'assistant porte en pied « Généré par IA ({modèle}), à vérifier ».

## 4. Paramètres › Assistance IA › Modèles (propriétaires)

Une nouvelle section « Modèles », sous « Fonctions », avec des lignes de réglage (libellé et aide à gauche, contrôle à droite) :
- **Claude Sonnet** : interrupteur, aide « Rapide, pour la plupart des textes. »
- **Claude Opus** : interrupteur, aide « Plus précis, plus lent ; consomme davantage du quota de l'espace. »
- **Modèle par défaut** : liste limitée aux modèles cochés.
- **Autres fournisseurs** : « Bientôt » gris, interrupteur désactivé, visible.
- Au moins un modèle reste coché : décocher le dernier est refusé, avec l'aide « Gardez au moins un modèle. »
- Les admins voient la section en lecture seule, avec la mention « Réservé aux propriétaires ».

## 5. e2e

Le test couvre, en clair et sombre, à 1440 :
- aucun `text-decoration: line-through` dans l'assistant ;
- l'avant et l'après sont visibles, avec les passages surlignés et leur texte masqué pour les lecteurs d'écran ;
- Appliquer, Ignorer, Annuler et Rétablir ;
- Tout appliquer, avec « Annuler » du toast ;
- le sélecteur limité aux modèles autorisés, et le modèle envoyé avec la demande au faux fournisseur ;
- la section Modèles : le dernier modèle ne peut pas être décoché, et un admin la voit en lecture seule.
