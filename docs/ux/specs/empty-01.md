# EMPTY-01 — États vides : une seule action, un aperçu du résultat

Retour de l'utilisateur (signalé deux fois) : un état vide ne doit jamais répéter l'action de l'en-tête. Par exemple, Glossaire affiche « Ajouter un terme » en haut et au centre ; Étiquettes fait de même. Cette spec fait partie de SETTINGS-HDR-01 (§6) et s'applique à toute l'app.

Planches : `docs/ux/propositions/empty-01/planche-empty-1440.png` et `planche-empty-390.png`. Elles montrent Glossaire, Étiquettes, Clés d'accès et Webhooks, avec l'en-tête E + B, en clair et en sombre.

## 1. Règle

- **Une action, un seul endroit.** L'action qui crée le premier élément est dans l'en-tête de la page (SETTINGS-HDR-01, ou PageHeader hors Paramètres). L'état vide n'a pas de bouton qui la répète, ni sous le même libellé ni sous un autre (« Nouvelle démo dans ce dossier » répète « Nouvelle démo » : l'action de l'en-tête crée déjà dans le dossier ouvert).
- **Exceptions admises** : un lien ou un bouton secondaire qui fait autre chose que l'en-tête, par exemple « Voir un exemple » (Démos) ou « Effacer les filtres » (aucun résultat).
- **État vide d'une page sans en-tête d'action**, comme un panneau de l'éditeur : il peut garder un bouton, puisque rien ne le répète. Exemple : « Ajouter une question » dans le quiz, si la barre du quiz n'a pas cette action ; si elle l'a, on la retire de l'état vide.
- **Trois sortes d'états vides**, à ne pas confondre :
  1. **Premier usage** (rien n'a encore été créé) : composant EmptyState avec aperçu (§2).
  2. **Aucun résultat** (filtres ou recherche) : EmptyState sans aperçu, avec une icône Lucide 20 px, le titre « Aucun … ne correspond … » et le bouton « Effacer les filtres ».
  3. **Vide dans un panneau** (commentaires d'une étape, journal d'envois, stats d'un quiz) : variante compacte, une ligne de texte gris, sans aperçu ni bouton.

## 2. Composant EmptyState (`packages/ui`)

Un seul composant pour tous les cas, sans copier-coller page par page.

```tsx
<EmptyState
  preview={<GlossaryPreview />}   // facultatif : premier usage seulement
  icon={SearchX}                  // facultatif : aucun résultat
  title="Ajoutez votre premier terme"
  body="L’ancien terme, le nouveau et une définition courte…"
  action={<Button variant="secondary">Voir un exemple</Button>} // facultatif, jamais l’action de l’en-tête
  size="page" | "compact"
/>
```

**Anatomie (premier usage)** :
- Le **socle** fait 460 px au plus, sur toute la largeur à 390 px.
  - Retraits : 28 px en haut, 32 px sur les côtés et 0 en bas. À 390 px : 20 px en haut et 16 px sur les côtés.
  - Rayon `--fd-radius-surface` (12 px).
  - Fond : léger dégradé vertical de `--fd-color-surface-sunken` vers `--fd-color-content-bg`.
- L'**aperçu** est posé dans le socle.
  - Cadre de surface `--fd-color-surface`, bordure `--fd-color-border`, rayon 12 px en haut seulement, posé sur le bas du socle.
  - Opacité 0,92.
  - Masque `mask-image: linear-gradient(#000 45%, transparent)` : la dernière ligne s'efface vers le bas.
  - `pointer-events: none`, `aria-hidden="true"`, rien de focalisable à l'intérieur.
  - Hauteur visible entre 110 et 140 px environ, soit 2 lignes et demie.
- **Titre** : 24 px sous le socle, `600 16px/1.4`, `--fd-color-text`, élément h2.
- **Phrase** : 4 px sous le titre, `400 14px/1.5`, `--fd-color-text-muted`, 420 px au plus de large, centrée.
- **Bloc entier** : centré, 40 px au-dessus et 48 px en dessous. À 390 px : 24 px et 32 px.

**Contenu des aperçus** :
- Ils sont faits de nos composants réels réduits (lignes, étiquettes, badges, boutons à icône, avatars), avec des données fictives fixes (Acme, example.com, Camille…).
- Pas d'image, pas d'icône seule.
- Ils doivent marcher en clair et en sombre, uniquement avec des jetons. Les couleurs d'étiquettes reprennent la palette L52.
- **Dégradés** : par principe, l'outil n'en utilise pas. Le fond du socle et le masque d'effacement sont la seule exception, demandée par l'utilisateur, et réservée à ce composant.
- **Mouvement** : aucun. En mouvement réduit, le rendu est le même.

## 3. Aperçus à faire (premier usage)

| Page | Titre | Aperçu |
|---|---|---|
| Glossaire | Ajoutez votre premier terme | 3 lignes « ancien terme (gris) → nouveau terme » : Fiche client → Compte, Opportunité → Affaire, Devis → Proposition commerciale |
| Étiquettes | Créez votre première étiquette | 2 cartes de démo (vignette, nom) avec des étiquettes de couleur : Ventes, Formation |
| Clés d'accès | Aucune clé pour l'instant | 2 lignes : icône clé, nom (CRM de l'équipe), `tc_••••••••3f2a · créée le 12 nov.`, bouton copier |
| Webhooks | Ajoutez votre premier webhook | 2 lignes : icône webhook, `https://hooks.example.com/leads`, événement, badge « Actif » avec point vert |
| Variables | Créez votre première variable | 2 lignes `{{prenom}} → Camille`, `{{logiciel}} → Acme CRM` (pastilles de variable L46) |
| Équipe (seul membre) | Invitez votre équipe | 2 lignes : avatar, nom fictif, rôle (Éditeur, Lecteur), badge « Invité » |
| Médiathèque | La médiathèque est vide | 3 vignettes (rectangles de surface avec type : image, vidéo, PDF) |
| Démos | Créez votre première démo | 2 cartes de démo (vignette, titre, « 8 étapes ») ; action secondaire « Voir un exemple » gardée |
| Dossier vide (Démos) | Rangez vos premières démos ici | 1 carte de démo dans un contour pointillé (dépôt) |
| Sandbox | Aucun Sandbox | 3 pages miniatures reliées par 2 traits |
| Leads | Aucun lead pour l'instant | 2 lignes : avatar initiales, `camille@example.com`, démo, date |
| Analytics / Visiteurs | Rien à analyser pour l'instant | 3 barres d'un mini histogramme et un indicateur « 42 visites » |
| Alertes (Analytics avancé) | Créez votre première alerte | 1 ligne d'alerte : icône, « Taux de complétion sous 50 % », interrupteur actif |
| Apprenants | Aucun apprenant identifié | 2 lignes : avatar, nom, barre de progression 60 % et 100 % |
| Formations / Centre | Aucune formation pour l'instant | 1 carte de formation : titre, « 3 modules », barre de progression |
| Intégrations › Connectées | Aucune connexion active | 2 tuiles d'intégration fictives : Slack, Webhook, avec la pastille « Connecté » |
| Notifications (cloche) | Rien de nouveau | Compact, sans aperçu (panneau) |

## 4. Inventaire des doublons à retirer

Relevé du 25/11 sur claude/dev-mvp : passage automatique de toutes les pages des e2e, plus les textes `*.empty*` de `fr.json`.

| Écran | Bouton à retirer de l'état vide | Action qui reste |
|---|---|---|
| Paramètres › Glossaire | « Ajouter un terme » | En-tête : Ajouter un terme (+ Importer un CSV) |
| Paramètres › Étiquettes | « Nouvelle étiquette » | En-tête : Nouvelle étiquette |
| Paramètres › Variables | bouton de l'état vide (s'il existe) | En-tête : Nouvelle variable |
| Paramètres › Intégrations › Webhooks | bouton de l'état vide | En-tête : Ajouter un webhook |
| Paramètres › Intégrations › Connectées | « Ajouter un webhook » | Lien secondaire « Voir les intégrations » (onglet Toutes) |
| Démos | « Nouvelle démo » (si présent) | En-tête : Nouvelle démo ; « Voir un exemple » reste |
| Démos › dossier vide | « Nouvelle démo dans ce dossier » | En-tête : Nouvelle démo (crée dans le dossier ouvert) |
| Sandbox | « Nouveau Sandbox » | En-tête de page : Nouveau Sandbox (à ajouter s'il manque) |
| Éditeur › Quiz | « Ajouter une question » | Barre du quiz : Ajouter une question |
| Analytics avancé › Alertes | bouton de l'état vide | En-tête de l'onglet : Nouvelle alerte |
| Apprenants › Formations | bouton de création (si présent) | En-tête : Nouvelle formation |
| Clés d'accès | — (déjà corrigé) | En-tête : Créer une clé |

Le dev vérifie chaque ligne marquée « si présent » à l'implémentation et la coche dans la PR.

## 5. e2e

Nouveau contrôle `etats-vides.e2e.cjs`, sur les pages du §3 à l'état vide, en clair et sombre, à 1440 et 390 :
- **Aucun doublon** : aucun bouton ou lien de l'état vide n'a le même nom accessible qu'une action de l'en-tête ou de la barre du haut.
- **Aperçu** : il porte `aria-hidden="true"` et ne contient aucun élément focalisable.
- **Titre et phrase** : visibles, avec un contraste AA.
- **Débordement** : aucun débordement horizontal à 390.
- **Contrôles et socle** : les contrôles de l'aperçu suivent RADIUS-01, et le socle utilise `--fd-radius-surface`.
