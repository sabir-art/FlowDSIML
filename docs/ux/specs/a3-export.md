# Spec A3 : export (MP4, GIF, PDF, hors ligne)

> Lot A3 de la parité Guideflow (Share : Video / GIF / PDF export, Offline demos).
> Maquette : `docs/ux/maquettes/refonte/export.html` (`?view=choose|progress|done|error`, `&theme=dark`).
> Microcopie : `export.*` dans `docs/ux/i18n` (50 clés).

## 1. Points d'entrée

- Éditeur : menu ⋯ de la barre, entrée « Exporter » (`Download`).
- Page Partager : bouton secondaire « Exporter ».
- Carte de démo : menu ⋯, entrée « Exporter ».
- L'export porte sur la **dernière version publiée**. Si la démo n'est pas publiée, il porte sur le brouillon, avec une `fd-help` qui le signale.

## 2. Modale de choix (`<dialog>`, 720 px, plein écran sous 480 px)

- 4 cartes-format (`aria-pressed`, grille de 4 colonnes, 2 sous 720 px) : MP4 (`Film`), GIF (icône GIF), PDF (`FileText`), Hors ligne (`Archive`). Chacune a une description d'usage sur 2 lignes.
- Options contextuelles :

| Format | Options |
|---|---|
| MP4 | Qualité (1080p par défaut, 720p, 4K), durée par étape (Automatique = 2 s + 60 ms par caractère de bulle, plafonnée à 8 s), curseur et animation de clic, inclure les formulaires et sondages, mention FlowDSIML (forcée en plan Free) |
| GIF | Largeur (640 par défaut, 480, 960), durée par étape, curseur. Pas d'option de son |
| PDF | Mise en page Portrait / Paysage, une étape par page, texte de bulle en légende numérotée, sommaire des chapitres |
| Hors ligne | Inclure les formulaires (désactivé : pas d'envoi de lead hors ligne, ce qu'une `fd-help` explique), mention FlowDSIML |

- Ligne d'estimation (`fd-help`) : durée et poids, recalculés à chaque changement d'option, plus la note « variables par défaut, zones floutées conservées ». **Les flous sont toujours appliqués** à l'export : aucune option ne permet de les retirer.
- Pied : « Annuler » et « Exporter en {{format}} » (primaire, `Download`).

## 3. Progression

- La même modale passe à l'état progression, sans fermeture par clic extérieur. Échap demande confirmation (`cancelConfirm`).
- Barre `role="progressbar"` orange sur piste pâle, texte `aria-live` : « 62 % · étape 4 sur 6 · environ 30 secondes restantes » (mis à jour au plus toutes les 2 s pour les lecteurs d'écran).
- Phases : Préparation → Rendu des étapes (n / N) → Encodage (vidéo, GIF) ou Assemblage (PDF, zip). Une phase terminée a un `CircleCheck` vert, la phase en cours un indicateur rotatif (immobile avec `prefers-reduced-motion`), les phases à venir un rond vide.
- `fd-help` : « Le rendu se fait dans votre navigateur : gardez cet onglet ouvert. »
- Si l'utilisateur ferme la modale pendant l'export, le travail continue. Une **pilule de progression** flottante (en bas à droite, avec le pourcentage et `Film`) permet de rouvrir la modale. Un toast `toastDone` avec « Télécharger » s'affiche à la fin.

## 4. Terminé et erreur

- **Terminé** : carte fichier (`surface-sunken`) avec icône, nom de fichier en slug, durée, poids et qualité, et « Télécharger » en primaire. `fd-help` « conservé 7 jours dans Démo → Exports ». Lien secondaire « Exporter dans un autre format ».
- **Erreur** (`role="alertdialog"`) : icône sur `danger-soft`, message **actionnable** selon la cause (mémoire : `errorMemory` avec « Réessayer en 1080p » ; sinon `errorGeneric` avec « Réessayer »). Navigateur non compatible : message `unsupported` **avant** de lancer l'export, et bouton désactivé.

## 5. Liste « Exports » (démo)

Nouvelle section dans la page Partager, carte « Exports récents » : tableau Format · Date · Poids · Expire le · Télécharger / Supprimer, conservé 7 jours, vide par défaut (« Aucun export pour l'instant »).

## 6. Accessibilité

- Cartes-format en `aria-pressed`, nommées par leur titre, avec la description en `aria-describedby`.
- Progression lisible au lecteur d'écran sans spam. Le focus va sur « Télécharger » à la fin.
- Le PDF exporté a des balises (titres d'étape en H2, texte des bulles en texte réel, pas en image) et une langue de document.
