# Matrice de conformité : maquettes ↔ application

> **Critère unique** : l'écran de l'app doit être **identique à la maquette, au style près**. Cela couvre la structure, la disposition, les composants, l'ordre, les libellés et les états. Règle D13 : aucun déploiement sans validation écrite de la Lead UX.
>
> **Méthode** :
> - **App** : build intégré `claude/dazzling-lamport-bu517g` (11707fb), servi en local avec le faux Supabase (`apps/web/e2e/fake-supabase.cjs`), à 1 440 × 900, en clair, pleine page.
> - **Maquettes** : `docs/ux/maquettes/refonte/*.html` ; à défaut, maquettes d'origine `docs/ux/maquettes/*.html`, dont on reprend la **structure** dans le style de la refonte.
> - **Images côte à côte** dans `docs/ux/conformite/<écran>.png`, avec la maquette à gauche et l'app à droite.
>
> **Données** : les chiffres et les noms de démos viennent du faux Supabase et ne sont **pas** des écarts. Les **libellés fixes**, eux, en sont.
>
> **Ce que la maquette ne prévoit pas** : un élément de l'app absent de la maquette est un écart, **sauf** si la Lead UX le déclare « à ajouter à la maquette » (colonne « Décision »). Dans ce cas, la maquette est mise à jour et sert de référence.

## Synthèse

| Écran | Maquette | Image | Statut |
|---|---|---|---|
| Dashboard (démos) | `refonte/dashboard.html` | `conformite/dashboard.png` | ❌ NON CONFORME (8 écarts) |
| Analytics d'une démo | `refonte/analytics.html` | `conformite/analytics.png` | ❌ NON CONFORME (7 écarts) |
| Analytics du workspace | **aucune maquette** | `conformite/analytics-workspace.png` | ⏳ MAQUETTE À FOURNIR (Lead UX) |
| Éditeur (état Hotspot) et commentaires | `refonte/editeur.html` | `conformite/editeur.png` | ❌ NON CONFORME (9 écarts) |
| Éditeur, états Étape, Design, Réglages | **non maquettés** dans la refonte | — | ⏳ MAQUETTE À FOURNIR (Lead UX) |
| Partager | `refonte/partage-avance.html` (A1) | `conformite/partage.png` | ❌ NON CONFORME : A1 non développé, structure entièrement différente |
| Connexion, inscription, mot de passe | anciennes maquettes, **obsolètes** | `conformite/connexion.png`, `inscription.png` | ⏳ MAQUETTE À FOURNIR |
| Onboarding | ancienne maquette, **obsolète** | `conformite/onboarding.png` | ⏳ MAQUETTE À FOURNIR |
| Leads | **aucune maquette** | — | ⏳ MAQUETTE À FOURNIR |
| Paramètres : profil, membres, workspace | ancienne maquette, **obsolète** | `conformite/parametres-*.png` | ⏳ MAQUETTE À FOURNIR |
| Plans | ancienne maquette, **obsolète** (prix et offres Solo / Team abandonnés) | `conformite/plans.png` | ⏳ MAQUETTE À FOURNIR |
| Player | ancienne maquette, **obsolète** | — | ⏳ MAQUETTE À FOURNIR |
| F1 : vérification des flous, modale RGPD | `refonte/f1-formation.html` | à produire | 🔜 |
| F2 : quiz (éditeur et player) | `refonte/f2-quiz.html` | `conformite/quiz-editeur.png` | 🔜 |

> **Maquettes obsolètes.** Les maquettes d'origine (`docs/ux/maquettes/*.html`) datent d'avant la refonte. Elles portent l'ancienne identité et des contenus abandonnés : prix, offres Solo / Team, « Démo centers V2 », factures, connexion Google. **Elles ne sont plus une référence.** Je produis des maquettes de refonte pour ces écrans. D'ici là, le dev **ne les modifie pas** : pas d'improvisation.

---

## 1. Dashboard (`/`)

Maquette : `refonte/dashboard.html`. Image : `conformite/dashboard.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| D-1 | Logo de la barre latérale | Logo **TutoClick compact** (`brand-tutoclic/production/logo-tutoclick-compact.svg`, 44 px), « DSI des Missions Locales » dessous | Symbole DSI + texte HTML « TutoClick » | Utiliser le SVG compact, en version claire ou sombre selon le thème | — |
| D-2 | Sélecteur de workspace | Absent | Select « Acme » avec icône immeuble sous le logo | Garder, mais **seulement si l'utilisateur a 2 workspaces ou plus**. Sinon, le masquer | **À ajouter à la maquette** (sous le logo, pilule pleine largeur) |
| D-3 | Sous-titre | « Vos parcours interactifs, prêts à partager. » | Le même, suivi de « · 1 / 25 démos publiées » (lien) | Retirer le quota (il est dans Plans) | — |
| D-4 | KPI héro | Bouton rond noir avec `ArrowUpRight` en haut à droite de la carte « Vues (30 jours) », qui mène à Analytics | Absent | Ajouter le bouton (`aria-label` « Voir les analytics ») | — |
| D-5 | Pied des KPI | « vs 30 jours précédents » | Idem | ✅ (c'est la maquette qui a été corrigée) | — |
| D-6 | Pied du KPI Leads quand l'évolution est nulle | Badge de tendance « +12 » | Pastille « — » | Pour une évolution nulle, badge neutre « 0 » (même pilule, sans icône) | — |
| D-7 | Barre « Toutes les démos » | Titre, segmenté (Toutes / Publiées / Brouillons), puis **à droite** : bouton pilule « Dossiers ▾ » (menu) et select pilule « Modifiées récemment ▾ » | Segmenté, puis à droite un bouton de tri sans chevron (icône ↕) | Bouton de tri en select pilule avec chevron, comme la maquette | — |
| D-8 | Dossiers | Menu « Dossiers ▾ » dans la barre | **Ligne de puces en plus** (« Tous les dossiers 2 », « Sans dossier 2 », « Nouveau dossier ») sous la barre | Supprimer la ligne de puces. Le menu « Dossiers ▾ » liste les dossiers (avec compteurs), puis « Sans dossier » et « Nouveau dossier… » | — |
| D-9 | Méta d'une carte en brouillon | « Brouillon · 6 étapes · il y a 3 j » | « Brouillon · 0 vue · 0 lead · maintenant » | Brouillon : nombre d'étapes et date. Publiée : vues · leads · date | — |
| D-10 | Vignette d'une démo sans capture | Cadre gris (barre de fenêtre + écran) avec pastille framboise | Fond rose avec courbe et titre « Onboarding » | Afficher le cadre gris de la maquette, sans pastille et sans titre | — |
| D-11 | Thème | La maquette a une bascule Clair / Sombre en bas à droite | Absente de la page | **Pas un écart** : la bascule de la maquette sert à la démonstration. Dans l'app, le thème reste dans le menu du compte | — |

---

## 2. Analytics d'une démo (`/demos/:id/analytics`)

Maquette : `refonte/analytics.html`. Image : `conformite/analytics.png`. Deux corrections ont été faites **dans la maquette** : la navigation active est « Démos » (décision RF6), et le pied des KPI est « vs 30 jours précédents ».

| N° | Zone | Maquette | App | Correction |
|---|---|---|---|---|
| AN-1 | Logo | Logo TutoClick compact | Symbole DSI + texte | Voir D-1 |
| AN-2 | Actions de l'en-tête | Période (7 j / 30 j / 90 j), « Partager », « Exporter » | En plus : bouton **« Éditeur »** | Retirer « Éditeur » (le retour ← et la carte de démo y mènent) |
| AN-3 | Rangée de KPI | **4 KPI** : Vues (héro), Visiteurs uniques, Taux de complétion, Leads | **5 KPI**, avec « Clics CTA » en plus et des libellés tronqués (« Visiteurs uniqu… », « vs 30 jours p… ») | Revenir à 4 KPI. Les clics CTA vont dans l'onglet Sessions d'A4 |
| AN-4 | Pied du KPI Leads | Badge « +9 », puis « **5,6 % des visiteurs** » (taux de conversion) | « — vs 30 jours précédents » | Afficher le taux de conversion leads / visiteurs |
| AN-5 | Légende du donut | Puce, libellé, **pourcentage en gras**, puis nombre en gris à droite (« 47 % · 566 ») | Nombre « 62 vues » **avant** le pourcentage | Ordre de la maquette : pourcentage, puis nombre sans « vues » |
| AN-6 | Carte « Leads » en bas de page | **Absente** | Carte « Leads » en plus : recherche, compteur, état vide « Ajouter un formulaire » | Supprimer. La page Leads existe dans la navigation |
| AN-7 | Graphique « Vues par jour » | Une barre par jour de la période (14 jours visibles), le pic en noir | 3 barres (données du faux Supabase) | ✅ Structure conforme : seules les données diffèrent |

## 3. Éditeur (`/demos/:id/edit`), état « Hotspot sélectionné », et commentaires

Maquette : `refonte/editeur.html` (état Hotspot et bulle, commentaires en liste). Image : `conformite/editeur.png`, plus la capture de l'app avec le hotspot sélectionné.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| ED-1 | Barre du haut, symbole | Symbole TutoClick | Symbole DSI | `symbole-tutoclick.svg` | — |
| ED-2 | État d'enregistrement | Pilule unique « Brouillon · enregistré » | Badge « Brouillon », et « Enregistré » ailleurs | Une seule pilule : statut · état d'enregistrement | — |
| ED-3 | Bouton « Quiz » | Absent (maquette antérieure à F2) | Présent entre « Aperçu » et « Partager » | Garder | **À ajouter à la maquette** |
| ED-4 | En-tête du panneau Hotspot | Puce + « Hotspot et bulle » | En plus : lien « ‹ Étape » | Garder (retour au panneau de l'étape) | **À ajouter à la maquette** (lien fantôme à droite du titre) |
| ED-5 | Barre d'outils du texte | Gras, italique, lien | En plus : select « Insérer une variable » | Garder (fonction des variables) | **À ajouter à la maquette** |
| ED-6 | Sous le texte | Rien | Compteur « 31 / 4000 caractères », **aperçu rendu** en bande grise, **et** ligne « Aperçu : … » | Supprimer la bande grise. Garder la ligne « Aperçu : » seulement si le texte contient une variable. Afficher le compteur à partir de 3 600 caractères | — |
| ED-7 | Champs | Titre, texte, position, interrupteurs CTA et pulsation | En plus : select « **Action au clic** » | Garder (étape suivante, aller à…, lien) | **À ajouter à la maquette** (sous « Position de la bulle ») |
| ED-8 | Pulsation | **Interrupteur** « Animation de pulsation » | Case à cocher | Interrupteur | — |
| ED-9 | Séparateurs | Filet entre les champs de la bulle et les interrupteurs, puis avant « Supprimer le hotspot » | Aucun | Ajouter les 2 filets | — |
| ED-10 | Commentaires | En-tête avec compteur « n ouverts », interrupteur « Afficher les résolus (n) », chevron, liste, saisie | ✅ Conforme (état vide de l'app vérifié séparément) | — | — |

> Les **états Étape, Design et Réglages** du panneau ne sont pas dessinés dans `refonte/editeur.html`. Je les ajoute à la maquette. D'ici là, ne pas les modifier.

## 4. Partager (`/demos/:id/share`)

Maquette : `refonte/partage-avance.html` (A1 : onglets Lien, Accès, Intégrer, Page publique, aperçu et récapitulatif). Image : `conformite/partage.png`.

**NON CONFORME dans son ensemble** : l'app affiche encore la page d'avant A1.

Écarts :
- titre « Partager — Démo CRM » sans retour ← ni sous-titre ;
- boutons « Éditeur » et « Analytics » au lieu de « Ouvrir » et « Copier le lien » ;
- **pas d'onglets** ;
- liens personnalisés en formulaire au lieu de la carte sous la grille ;
- aperçu sans récapitulatif.

À refaire entièrement selon `specs/a1-partage.md` et la maquette, vue par vue :

| Vue | URL de la maquette |
|---|---|
| Lien | `?view=lien` |
| Accès | `?view=acces` |
| Intégrer | `?view=integrer` |
| Page publique | `?view=page` |

État « démo non publiée » : il n'est pas maquetté. Je l'ajoute (carte d'alerte en haut de l'onglet Lien, onglets désactivés sauf Lien).
