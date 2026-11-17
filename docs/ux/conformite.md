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
| Analytics du workspace | `refonte/ecrans-compte.html?view=analytics` | `conformite/analytics-workspace.png` | ❌ NON CONFORME (4 écarts) |
| Éditeur (état Hotspot) et commentaires | `refonte/editeur.html` | `conformite/editeur.png` | ❌ NON CONFORME (9 écarts) |
| Éditeur, état Étape | `refonte/editeur.html?view=etape` | capture de l'app (panneau Étape) | ❌ NON CONFORME (5 écarts) |
| Éditeur, état Design | `refonte/editeur.html?view=design` | `conformite/editeur-design.png` | ❌ NON CONFORME (5 écarts) |
| Éditeur, état Réglages | `refonte/editeur.html?view=reglages` | `conformite/editeur-reglages.png` | ❌ NON CONFORME (6 écarts) |
| Partager | `refonte/partage-avance.html` (A1) | `conformite/partage.png` | ❌ NON CONFORME : A1 non développé, structure entièrement différente |
| Connexion, inscription, mot de passe, invitation | `refonte/auth.html?view=login,signup,forgot,reset,invite` | `conformite/connexion.png`, `inscription.png` | ❌ NON CONFORME (8 écarts) |
| Onboarding | `refonte/auth.html?view=onb1,onb2` | `conformite/onboarding.png` | ❌ NON CONFORME (3 écarts + panneau de marque) |
| Leads | `refonte/ecrans-compte.html?view=leads` | `conformite/leads.png` | ❌ NON CONFORME (6 écarts) |
| Membres | `refonte/ecrans-compte.html?view=membres` | `conformite/parametres-membres.png` | ❌ NON CONFORME (6 écarts) |
| Profil | `refonte/ecrans-compte.html?view=profil` | `conformite/parametres-profil.png` | ❌ NON CONFORME (4 écarts) |
| Paramètres du workspace | `refonte/ecrans-compte.html?view=workspace` | `conformite/parametres-workspace.png` | ❌ NON CONFORME (5 écarts) |
| Plans | `refonte/ecrans-compte.html?view=plans` | `conformite/plans.png` | ❌ NON CONFORME (4 écarts) |
| Player : étape et bulle, formulaire de lead, fin | `refonte/player.html?view=etape,formulaire,fin` | `conformite/player-*.png` | ❌ NON CONFORME (7 écarts) |
| F1 : vérification des flous | `refonte/f1-formation.html` (vue Flous) | `conformite/f1-flous.png` | ❌ NON CONFORME (6 écarts) |
| F1 : publication publique (RGPD) | `refonte/f1-formation.html?view=rgpd` | `conformite/f1-rgpd.png` | ❌ NON CONFORME (3 écarts) |
| F2 : éditeur du quiz | `refonte/f2-quiz.html?view=build` | `conformite/quiz-editeur.png` | ❌ NON CONFORME (5 écarts) |
| F2 : quiz dans le player (question, correction, résultats) | `refonte/f2-quiz.html?view=q,ok,ko,pass,fail` | `conformite/quiz-*.png` | ❌ NON CONFORME (7 écarts) |

> **Maquettes obsolètes.** Les maquettes d'origine (`docs/ux/maquettes/*.html`) datent d'avant la refonte. Elles portent l'ancienne identité et des contenus abandonnés : prix, offres Solo / Team, « Démo centers V2 », factures, connexion Google. **Elles ne sont plus une référence.** Les maquettes de refonte qui les remplacent sont `refonte/ecrans-compte.html` et `refonte/auth.html` (lot 2). Le player a sa maquette de refonte : `refonte/player.html`.
>
> **Écart transversal G-1 (tous les écrans avec barre latérale).** Le logo de la barre latérale est le symbole DSI suivi du texte HTML « TutoClick ». Il doit être le SVG `brand-tutoclic/production/logo-tutoclick-compact.svg` (`-sombre` en thème sombre), à 44 px de haut, avec « DSI des Missions Locales » dessous (voir D-1). Il n'est pas répété dans chaque tableau.

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

> ED-3, ED-4, ED-5 et ED-7 sont maintenant dessinés dans `refonte/editeur.html` (lien « ‹ Étape », « Insérer une variable », « Action au clic »).

### 3 bis. Éditeur, état Étape (`?view=etape`)

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| ET-1 | Formulaire de lead désactivé | Select désactivé avec « Aucun », puis aide « Créez d'abord un formulaire dans l'onglet Réglages. » **sous** le champ | Le texte d'aide est le placeholder du select, tronqué | Option « Aucun » + `fd-help` sous le champ (`aria-describedby`) | — |
| ET-2 | Séparateurs | Filets avant et après les interrupteurs, et avant « Supprimer l'étape » | Aucun | Ajouter les 3 filets | — |
| ET-3 | Liste des hotspots | Libellé « Hotspots · 1 », chaque hotspot en **ligne cliquable** sur fond `surface-sunken` (icône, titre, chevron à droite) qui ouvre le panneau Hotspot | Libellé « Hotspots », ligne en texte simple avec numéro | Lignes cliquables comme la maquette, sans numéro | — |
| ET-4 | Zones floutées | « Zones floutées · n » et une ligne par zone (même composant que ET-3) | « Zones floutées (0) », sans liste | Même format que ET-3. À 0 : libellé seul | — |
| ET-5 | « Supprimer l'étape » | Bouton fantôme danger **aligné à gauche** | Centré | Aligner à gauche | — |

### 3 ter. Éditeur, état Design (`?view=design`)

Image : `conformite/editeur-design.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| DS-1 | Cartes du mode de lecture | Titre + description, sans illustration | Vignette illustrée au-dessus du titre, icône devant le titre | Garder les vignettes | **À ajouter à la maquette** (je les intègre) ; retirer l'icône devant le titre |
| DS-2 | Couleurs du thème | Une **ligne** par couleur : pastille 28 px, libellé, champ hex en mono (104 px) à droite | Libellé au-dessus, puis pastille et hex en dessous (2 lignes par couleur) | Ligne unique comme la maquette | — |
| DS-3 | Arrondi | Segmenté **Net / Doux / Rond** | Curseur « Arrondi : 20 px » | Segmenté à 3 valeurs (8, 14, 20 px) | — |
| DS-4 | Mention TutoClick | **Interrupteur** « Afficher « Créé avec TutoClick » », aide « Retrait possible à partir du plan Pro. » collée dessous | Case à cocher, aide « Sur le plan Free, la mention reste affichée. » espacée | Interrupteur et aide de la maquette | — |
| DS-5 | Bouton d'action de la page | Filet ; libellé « Bouton d'action de la page » + aide ; interrupteur « Afficher le bouton » ; filet ; « Langue du player » | Même contenu, interrupteur libellé « Bouton d'action (CTA) », sans filets | Libellé « Afficher le bouton » et 2 filets | **Ajouté à la maquette** (reprend l'app ; remplace « Bouton de fin ») |

### 3 quater. Éditeur, état Réglages (`?view=reglages`)

Image : `conformite/editeur-reglages.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| RG-1 | Boutons « Créer le formulaire », « Ajouter… » | Boutons secondaires **à taille du contenu**, alignés à gauche, icône `+` | Pleine largeur, icône formulaire | Taille du contenu, icône `+` | — |
| RG-2 | Variable existante | **Ligne compacte** sur fond `surface-sunken` : `{{company}}` en mono, libellé + « Par défaut : … », boutons icône Modifier et Supprimer | Carte ouverte en permanence avec champs Libellé et Valeur par défaut, et « Supprimer » | Ligne compacte ; « Modifier » ouvre les deux champs **dans** la ligne (Enregistrer / Annuler) | — |
| RG-3 | Ajout d'une variable | Bouton « Ajouter une variable » | Champ « company » + bouton « Ajouter » | Le bouton ouvre une ligne en édition (clé, libellé, valeur par défaut) | — |
| RG-4 | Texte d'aide des variables | « Utilisez {{company}} dans vos textes. La valeur vient de l'URL (?company=…), d'un lien personnalisé ou de la valeur par défaut. » | Texte différent, avec « Les variables sont partagées par tout le workspace. » | Reprendre le texte de la maquette. Si les variables sont bien partagées par le workspace, garder cette phrase en 2e phrase | **À ajouter à la maquette** si confirmé |
| RG-5 | Checklist → Lecture automatique | Filet entre les deux sections | Aucun filet | Ajouter le filet | — |
| RG-6 | Lecture automatique | Interrupteur « Avancer seule », aide **sous** l'interrupteur | Interrupteur libellé comme le titre (« Lecture automatique »), aide dans le libellé | Libellé « Avancer seule », aide en `fd-help` dessous | — |

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

**État « démo non publiée »** : `refonte/partage-avance.html?view=nonpubliee`. Il fait partie de la refonte A1 :
- sous-titre « brouillon, jamais publiée » ;
- en-tête « Aperçu » et « Publier » (au lieu de « Ouvrir » et « Copier le lien ») ;
- alerte warning en haut de l'onglet Lien, puis le champ d'adresse modifiable (bouton « Copier » désactivé), puis le bouton « Publier la démo » avec l'aide « Les autres onglets se débloquent après la publication. » ;
- onglets Accès, Intégrer et Page publique désactivés ;
- aperçu grisé ;
- récapitulatif réduit à « Aucune diffusion active : la démo n'est pas publiée. »

Microcopie FR/EN : `share.unpublished.*`.

---

## 5. Analytics du workspace (`/analytics`)

Maquette : `refonte/ecrans-compte.html?view=analytics`. Image : `conformite/analytics-workspace.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| AW-1 | Titre | « Analytics », sous-titre « Toutes les démos du workspace. » | « Analytics du workspace », « Indicateurs des 30 derniers jours » | Libellés de la maquette (la période est dans le segmenté) | — |
| AW-2 | Pied des KPI | Badge de tendance + « vs 30 jours précédents » ; pour Leads, « x % des visiteurs » | Aucun pied | Ajouter les pieds, comme le dashboard | — |
| AW-3 | Tableau « Par démo » | Badge « Brouillon » après le titre d'une démo non publiée ; « — » si le taux est indéfini | « 0 % » et pas de badge | Badge neutre « Brouillon » ; « — » à la place de 0 % sans vue | — |
| AW-4 | Sous le tableau | Aide « Un clic sur une démo ouvre ses analytics. Tri par colonne. » | Absente | Ajouter (et rendre les en-têtes triables) | — |

## 6. Leads (`/leads`)

Maquette : `refonte/ecrans-compte.html?view=leads`. Image : `conformite/leads.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| LE-1 | En-tête | Titre, sous-titre « Personnes ayant rempli un formulaire dans vos démos. », bouton « Exporter en CSV » **à droite de l'en-tête** | Pas de sous-titre ; l'export est dans la barre de filtres | Comme la maquette | — |
| LE-2 | Barre de filtres | Recherche pilule « Rechercher un e-mail ou une entreprise » (380 px min), **select pilule « Toutes les démos »**, compteur « n leads » à droite | Recherche « Rechercher un email », pas de filtre par démo, compteur collé | Ajouter le filtre par démo, compteur à droite | — |
| LE-3 | Colonne E-mail | E-mail en **gras** | Normal | Gras | — |
| LE-4 | Colonne Démo | Lien souligné prune vers la démo | Texte simple | Lien | — |
| LE-5 | Colonne Consentement | Badge vert « Oui » avec coche, ou badge neutre « Non » | Coche seule | Badges texte (jamais la couleur ou l'icône seule) | — |
| LE-6 | Suppression | Bouton icône corbeille neutre (`aria-label` « Supprimer le lead … ») | Corbeille framboise | Neutre ; le danger est dans la confirmation | — |

## 7. Membres (`/settings/members`)

Maquette : `refonte/ecrans-compte.html?view=membres`. Image : `conformite/parametres-membres.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| ME-1 | Sous-titre | « 3 membres · 1 invitation en attente » | Absent | Ajouter | — |
| ME-2 | Carte d'invitation | Titre « Inviter des membres » ; champ **à puces** (une puce par e-mail, « Ajouter un e-mail, puis Entrée »), select Rôle et bouton sur **une ligne** | « Inviter un membre », zone de texte multiligne | Champ à puces sur une ligne | — |
| ME-3 | Texte d'aide de l'invitation | « L'envoi automatique des e-mails d'invitation arrive bientôt. En attendant, copiez le lien d'invitation et transmettez-le. » | Mentionne « un SMTP personnalisé (avant la bêta) » | Texte de la maquette (pas de jargon technique) | — |
| ME-4 | Invitations en attente | **Carte dédiée** « Invitations en attente · n » : e-mail, rôle (badge), expiration, « Copier le lien », « Révoquer » | Absente | Ajouter la carte (masquée s'il n'y a aucune invitation) | — |
| ME-5 | Carte des membres | Titre « Membres · n » avec puce ; avatar coloré, nom (« (vous) »), e-mail ; **select de rôle** pour les autres membres ; corbeille | Pas de titre ; pas de select de rôle | Comme la maquette (select réservé aux propriétaires et admins) | — |
| ME-6 | « Quitter » | Pour soi : lien framboise « Quitter » avec icône | Idem | ✅ | — |

## 8. Profil (`/settings/profile`)

Maquette : `refonte/ecrans-compte.html?view=profil`. Image : `conformite/parametres-profil.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| PR-1 | Sous-titre | « Vos informations et préférences personnelles. » | Absent | Ajouter | — |
| PR-2 | Carte « Informations » | En-tête avec puce d'icône et titre « Informations » | Pas d'en-tête | Ajouter | — |
| PR-3 | Thème | Segmenté standard (fond `surface-sunken`, bouton actif blanc) | Segmenté avec bordure et actif framboise pâle | Segmenté standard du design system | — |
| PR-4 | Mot de passe | Titre « Mot de passe », libellé « Nouveau mot de passe », aide « 8 caractères minimum. » **sous** le champ | « Changer de mot de passe », contrainte dans le libellé | Comme la maquette | — |

## 9. Paramètres du workspace (`/settings/workspace`)

Maquette : `refonte/ecrans-compte.html?view=workspace`. Image : `conformite/parametres-workspace.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| WS-1 | Sous-titre | « Nom, adresse des démos, confidentialité. » | Absent | Ajouter | — |
| WS-2 | Carte « Identité » | En-tête avec puce et titre « Identité » | Pas d'en-tête | Ajouter | — |
| WS-3 | Adresse des démos | Libellé « Adresse des démos », champ avec **préfixe** `demos.tutoclick.example/` en mono | « Adresse personnalisée », champ nu | Champ à préfixe (le domaine réel vient de la config) | — |
| WS-4 | Liens publics | Titre « Liens publics », aide sans la phrase sur les accès restreints | Titre « Autoriser les liens publics » + phrase « Les accès restreints … arrivent prochainement » | Libellés de la maquette | — |
| WS-5 | Carte « Plan » | **Résumé** : badge du plan, « n démo publiée sur N », bouton « Voir le plan et l'utilisation » (vers Plans) | Tableau complet des limites (doublon de Plans) | Résumé seulement | — |

## 10. Plans (`/settings/plans`)

Maquette : `refonte/ecrans-compte.html?view=plans`. Image : `conformite/plans.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| PL-1 | Sous-titre | « Plan actuel : Pro. » | Absent | Ajouter | — |
| PL-2 | Bas des cartes | Bouton « Nous contacter » (icône e-mail) sur chaque plan **sauf** le plan actuel | Aucun bouton | Ajouter | — |
| PL-3 | Utilisation | Carte « Utilisation du plan Pro » avec 2 jauges (Démos publiées, Membres) et la phrase sur le paiement | Carte « Plan » qui répète **tout** le tableau des limites | Carte « Utilisation » réduite aux 2 jauges + phrase | — |
| PL-4 | Alerte | Alerte info en haut, pleine largeur | Idem | ✅ | — |

## 11. Connexion, inscription, mot de passe, invitation

Maquette : `refonte/auth.html` (`?view=login,signup,forgot,reset,invite`). Images : `conformite/connexion.png`, `conformite/inscription.png`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| AU-1 | Panneau de marque, haut | Logo TutoClick **mono blanc** (`logo-tutoclick-mono-blanc.svg`, 48 px) | Logo DSI blanc + texte « TutoClick » | Logo TutoClick mono blanc | — |
| AU-2 | Panneau de marque, accroche | « Des tutoriels interactifs pour prendre en main vos outils. » **centrée verticalement** | « Des démos interactives qui vendent votre produit pendant que vous dormez. » en bas | Accroche et position de la maquette (le discours commercial est abandonné) | — |
| AU-3 | Panneau de marque, puces | « Capturez un parcours en quelques clics », « Partagez-le ou intégrez-le dans votre intranet », « Suivez qui est formé, et où » | Puces « commerciales » (leads, engagement) | Puces de la maquette | — |
| AU-4 | Panneau de marque, bas | « Une solution de la DSI des Missions Locales » | Absent | Ajouter | — |
| AU-5 | Connexion, lien magique | Séparateur « ou » puis **bouton secondaire** « Recevoir un lien de connexion par e-mail » | Lien texte « Ou recevez un lien de connexion par email. » | Bouton secondaire | — |
| AU-6 | Libellés | « E-mail professionnel » ; « Créer un compte » ; « Déjà un compte ? Se connecter » | « Email professionnel » ; « Créer un compte gratuit » ; « Déjà inscrit ? » | Libellés de la maquette (« e-mail » avec trait d'union partout) | — |
| AU-7 | Inscription | Titre « Créer un compte », sous-titre « Gratuit, sans carte bancaire. » ; **jauge de robustesse** du mot de passe ; **case CGU et politique de confidentialité** obligatoire | « Créez votre compte » ; pas de jauge ; pas de case | Comme la maquette | — |
| AU-8 | Outils en haut à droite | Segmentés standard (thème : icônes ; langue : FR / EN) | Segmentés avec bordure et actif framboise | Segmentés standard | — |

Les vues « Mot de passe oublié », « Nouveau mot de passe » et « Invitation » suivent la même mise en page : à reprendre telles que maquettées.

## 12. Onboarding (`/onboarding`)

Maquette : `refonte/auth.html?view=onb1,onb2`. Image : `conformite/onboarding.png`. Le panneau de marque suit AU-1 à AU-4.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| ON-1 | Indicateur d'étapes | **Au-dessus** du titre | Entre le sous-titre et le champ | Au-dessus du titre | — |
| ON-2 | Libellé du champ | « Nom de la structure ou de l'équipe » | « Nom de l'entreprise ou de l'équipe » | Libellé de la maquette | — |
| ON-3 | « Annuler » | Lien souligné prune | Texte gris | Lien | — |

## 13. Player (`/#/d/:id`)

Maquette : `refonte/player.html` (`?view=etape,formulaire,fin`, `&theme=dark`, et à 390 px). Images : `conformite/player-etape.png`, `player-formulaire.png`, `player-fin.png`. App : build intégré, port 5179, manifeste de test à 3 étapes dont un formulaire. Microcopie FR/EN : `player.finish`, `player.chapters`, `player.meta`, `player.progress`, `player.end.*`, `player.form.processedBy`, `player.form.privacyPolicy`, `player.form.emailPro`.

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| PY-1 | En-tête, gauche | Pastille du workspace (logo, ou initiales sur fond blanc), titre de la démo en gras, méta « workspace · n étapes · durée » | Titre seul, petit, sans pastille ni méta | Comme la maquette | — |
| PY-2 | En-tête, droite | Bouton fantôme « Chapitres » (seulement si la démo a des chapitres), puis le CTA de la page en primaire avec icône `external` | CTA seul | Ajouter « Chapitres » (ouvre le menu des chapitres) | — |
| PY-3 | Barre de navigation | **Une pilule** blanche centrée : ←, barre de progression **prune** (240 px), « n / N », →, séparateur, langue (globe), plein écran | Boutons séparés, barre de progression **orange** pleine largeur, compteur à droite, pas de bouton de langue | Pilule de la maquette. L'orange est réservé au logo et à la marque, jamais à l'interface | — |
| PY-4 | Bulle | Titre, texte, pied « n / N » + « Suivant » (avec chevron). « Précédent » est dans la barre, pas dans la bulle | « Précédent » ajouté dans la bulle à partir de l'étape 2 | Retirer « Précédent » de la bulle | — |
| PY-5 | Formulaire de lead | Voile **sur la capture seulement** (l'en-tête et le CTA restent lisibles) ; titre, description, « E-mail professionnel * », case de consentement, ligne « Données traitées par {{workspace}}. Politique de confidentialité » (lien), bouton « Continuer » avec flèche à droite | Voile sur toute la page (CTA grisé), libellé « Email * », pas de ligne sur le traitement des données | Comme la maquette. La ligne « Données traitées par… » est **toujours** affichée ; le lien n'apparaît que si une politique est renseignée (Paramètres du workspace) | — |
| PY-6 | Fin d'une démo simple | Dernière étape : le bouton de la bulle devient « **Terminer** » et ouvre la modale de fin (puce de succès, « Tutoriel terminé », « Vous avez parcouru les n étapes de « titre ». », CTA de la page en primaire, « Recommencer » en fantôme) | **Pas d'écran de fin** : le → de la barre est désactivé et la bulle garde « Suivant » sans effet | Ajouter l'écran de fin. Sans CTA de page, seul « Recommencer » est affiché, en secondaire. Avec un quiz (F2), la fin du quiz garde son propre écran | — |
| PY-7 | Mobile (≤ 720 px) | La bulle devient une **feuille du bas** au-dessus de la barre ; le formulaire et la fin s'ouvrent en feuille du bas ; « Chapitres », méta, langue et plein écran sont masqués | Non vérifié sur l'app à 390 px | À appliquer, puis je le vérifie en recette | — |

## 14. F1 : vérification des flous et publication publique

Maquette : `refonte/f1-formation.html` (vues Flous et RGPD). Images : `conformite/f1-flous.png`, `conformite/f1-rgpd.png` (captures de la recette F1).

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| FL-1 | En-tête | Symbole TutoClick, titre, sous-titre « module · n captures · rien n'a encore quitté votre navigateur », badge « Analyse terminée » | Symbole DSI | Symbole TutoClick (voir G-1) | — |
| FL-2 | Capture | **Aperçu réel du flou** sur chaque zone, cadre framboise plein si la zone sera floutée, pointillé si elle ne le sera pas, bleu si elle est sélectionnée | Rectangles roses pleins, sans aperçu du flou | Afficher le flou tel qu'il sera appliqué, avec les 3 cadres de la légende | — |
| FL-3 | Vignettes | Libellé « n · titre » et pastille du nombre de détections **à droite du libellé**, sous la vignette | Pastille en haut à droite de la vignette | Comme la maquette | — |
| FL-4 | Détections | Chaque détection est une **carte bordée** (puce d'icône, type, valeur masquée en mono, interrupteur) ; la carte sélectionnée a une bordure bleue | Lignes simples, sans carte | Cartes de la maquette | — |
| FL-5 | Sous la liste | Phrase qui nomme les détections **non floutées** (« La date de naissance et l'adresse ne seront pas floutées. Vérifiez qu'il s'agit bien de données fictives. »), puis « Tout flouter sur cette capture » avec une coche | Bouton sans icône ; phrase non vérifiable (tout était activé) | Icône coche ; phrase affichée dès qu'une détection est désactivée | — |
| FL-6 | Pied | « Annuler la capture » en **bouton secondaire**, puis le primaire « Flouter et envoyer n captures » avec l'icône d'envoi | « Annuler la capture » en lien framboise ; primaire sans icône | Comme la maquette | — |
| RP-1 | Résumé de la modale RGPD | Lignes simples, sans fond ; les détections non floutées en **gras** avec l'étape | Encadré sur fond `surface-sunken` | Lignes de la maquette | — |
| RP-2 | Restreindre l'accès | Ligne « Besoin de restreindre l'accès ? Choisir Invitation, Domaine e-mail ou Mot de passe. » (liens vers l'onglet Accès) | Absente | Ajouter | — |
| RP-3 | Aide « Cochez les deux confirmations pour publier. » | **Sous** les boutons, alignée à droite | Au-dessus des boutons, à gauche | Comme la maquette | — |

Le bouton « Revoir l'étape n » de la modale n'apparaît que s'il reste des détections non floutées. Il n'a pas pu être vérifié avec les données de test.

## 15. F2 : quiz (éditeur et player)

Maquette : `refonte/f2-quiz.html` (`?view=build,q,ok,ko,pass,fail`). Images : `conformite/quiz-editeur.png`, `quiz-question.png`, `quiz-correction.png`, `quiz-reussite.png`, `quiz-echec.png`. Les captures du player viennent de la recette F2 : la marque y est encore « Tutoclic », ce qui est un écart (G-2 : « TutoClick » partout).

### Éditeur du quiz

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| QE-1 | En-tête | Titre « Quiz du module » au-dessus de la liste, bouton « Tester le quiz » dans la carte « Validation » | Barre d'en-tête avec retour ←, titre, « Enregistré », et « Tester le quiz » en haut à droite | Garder l'en-tête de l'app (cohérent avec l'éditeur) ; retirer « Tester le quiz » de la carte | **À ajouter à la maquette** |
| QE-2 | Liste des questions | Cartes posées sur le fond, sans carte englobante | Carte « Questions » qui englobe la liste | Retirer la carte englobante | — |
| QE-3 | Carte de la question | Puce d'icône « ? » devant « Question n » ; pas d'alerte | Pas de puce ; alerte info « Choix unique : seule la première bonne réponse est gardée. » | Ajouter la puce ; retirer l'alerte (le bouton radio suffit) | — |
| QE-4 | Seuil de réussite | Libellé seul, valeur « 70 % » **à droite du curseur** | Valeur dans le libellé (« Seuil de réussite : 80 % ») | Comme la maquette | — |
| QE-5 | Bas de la carte | Rien | « Supprimer la question » centré | Garder, en bouton fantôme danger **aligné à gauche** | **À ajouter à la maquette** |
| QE-6 | Carte « Réussite par question » | Absente | Présente (« Aucune tentative pour l'instant. ») | Garder | **À ajouter à la maquette** |

### Quiz dans le player

| N° | Zone | Maquette | App | Correction | Décision |
|---|---|---|---|---|---|
| QP-1 | Barre du player | **Absente** pendant le quiz | Présente, avec progression orange et compteur des étapes | Masquer la barre pendant le quiz (déjà relevé en recette, F2-1) | — |
| QP-2 | Progression du quiz | Barre **prune** entre « Question n sur N » et « Seuil : x % », sur la même ligne | Barre orange sous la ligne | Comme la maquette (pas d'orange dans l'interface) | — |
| QP-3 | Question | Bouton « Précédente » en bas à gauche à partir de la question 2 | Absent | Ajouter | — |
| QP-4 | Correction | Encadré avec icône (`xCircle` ou `checkCircle`), titre en gras et explication ; **sous** l'encadré, bouton secondaire « Revoir l'étape n du module » à gauche et « Question suivante → » à droite | Lien « Revoir l'étape 1 du module » dans l'encadré, sans icône ; pas de flèche sur le bouton | Comme la maquette | — |
| QP-5 | Résultat, liste | Questions **sans numéro**, « Revoir » à droite de chaque erreur liée à une étape | Questions numérotées | Retirer les numéros | — |
| QP-6 | Résultat, actions | Réussite : « Repasser le quiz » à gauche, primaire « Module suivant : titre → » à droite (ou CTA de fin s'il n'y a pas de module suivant). Échec : « Revoir le module » avec icône à gauche, « Réessayer le quiz » à droite | Réussite : « Terminer » seul, centré. Échec : 2 boutons centrés | Boutons de la maquette, en bas, aux deux extrémités | — |
| QP-7 | Marque | « Créé avec TutoClick » | « Créé avec Tutoclic » | Nom exact « TutoClick » (G-2) | — |
