# L26 : prise en main, aide intégrée, modèles de formation, visiteurs récurrents, présentateur complet

> **Maquettes** :
> - `reference/l26-espace.html` (`?etat=checklist|aide|aide-recherche|modeles|modele-enregistrer`) : prise en main, aide, modèles ;
> - `reference/l26-recurrents.html` (`?etat=vue|sessions|mesure`) : visiteurs récurrents ;
> - `refonte/l26-presentateur.html` (`?view=pres-plus|telecommande|mobile|bilan`) : compléments du mode présentateur ;
> - `refonte/vague-b.html` (`?view=ia|crm|sso`) : cartes « Bientôt » (VB-01 à VB-03).
>
> **Base** :
> - `specs/l22-presentateur-collaboration.md` : mode présentateur livré ;
> - `specs/l19-analytics-avance.md` et `specs/a4-analytics.md` §1 : définition des visiteurs récurrents ;
> - `reference/onboarding.html` (ONB-01 à 04) : premier parcours, conservé ;
> - `specs/l25-capture-editeur-export.md` §8 : VB-01 à VB-03.
>
> **Données** : fictives (Acme, Globex, `.example`).

## 1. États et codes

| Code | État | Maquette |
|---|---|---|
| L26-01 | Tableau de bord : « Prise en main de votre espace » | `l26-espace.html?etat=checklist` |
| L26-02 | Aide contextuelle (tiroir) | `l26-espace.html?etat=aide` |
| L26-03 | Aide : résultats de recherche | `l26-espace.html?etat=aide-recherche` |
| L26-04 | Nouvelle démo > « Partir d'un modèle » | `l26-espace.html?etat=modeles` |
| L26-05 | Éditeur, menu ⋯ > « Enregistrer comme modèle » | `l26-espace.html?etat=modele-enregistrer` |
| L26-06 | Analytics : visiteurs récurrents (vue d'ensemble) | `l26-recurrents.html?etat=vue` |
| L26-07 | Analytics : nouveau ou récurrent dans les sessions | `l26-recurrents.html?etat=sessions` |
| L26-08 | Réglage « Mesure des visites » | `l26-recurrents.html?etat=mesure` |
| L26-09 | Vue présentateur : notes de la démo et modification en direct | `l26-presentateur.html?view=pres-plus` |
| L26-10 | Télécommande : appairage du téléphone | `l26-presentateur.html?view=telecommande` |
| L26-11 | Télécommande sur le téléphone | `l26-presentateur.html?view=mobile` |
| L26-12 | Bilan de fin de présentation | `l26-presentateur.html?view=bilan` |
| VB-01 à VB-03 | Cartes « Bientôt » : IA, CRM et e-mailing, connexion unique | `refonte/vague-b.html` + L25 §8 |

## 2. Prise en main d'un nouvel espace (L26-01)

Le parcours d'accueil ONB-01 à 04 (configuration, extension, première démo) ne change pas. Ensuite, la carte « Prise en main de votre espace » **remplace le bandeau « Premiers pas »** en tête de la page Démos.

- **Carte** :
  - icône `sparkles`, titre, « n étapes sur 7. Elles se cochent seules quand vous les faites. » ;
  - barre de progression (`progressbar`, `aria-valuetext` « n étapes sur 7 ») ;
  - bouton « Réduire » (`aria-expanded`).
- **Les 7 étapes**, sur deux colonnes (une seule sous 900 px), chacune cochée automatiquement :

| Étape | Cochée quand | Action |
|---|---|---|
| Personnaliser l'espace | logo importé ou couleur principale changée | « Personnaliser » → Paramètres > Marque |
| Installer l'extension | l'extension a répondu au moins une fois | « Installer » → page de l'extension |
| Capturer une première démo | une démo a au moins une capture | « Capturer » |
| Flouter les données sensibles | une capture a passé la vérification des données (F1 §1) | « Voir comment » |
| Publier et partager une démo | une démo est publiée | « Partager » |
| Inviter un membre de l'équipe | l'espace a au moins 2 membres | « Inviter » → Paramètres > Membres |
| Diffuser | un lien personnalisé, une intégration, une page publique ou un paquet SCORM existe | « Diffuser » → Partager > Diffusion |

- **Règles d'affichage** :
  - une étape faite est barrée, avec `checkCircle` en couleur succès et un texte « Fait » pour les lecteurs d'écran ;
  - la prochaine étape conseillée (la première non faite, dans l'ordre du tableau) a un fond `surface-selected` et le bouton principal. Les autres boutons sont discrets ;
  - « Voir comment » ouvre la visite guidée de l'étape (§3.3).
- **Qui voit quoi** :
  - propriétaires et administrateurs : les 7 étapes ;
  - éditeurs : les étapes 3 à 5 ;
  - lecteurs : rien.
- **Masquer** : « Masquer la prise en main » la retire pour la personne. Elle se rouvre depuis l'aide (« Reprendre la prise en main »).
- **Fin** : à 7 sur 7, la carte affiche « Votre espace est prêt » pendant 7 jours, avec « Masquer », puis disparaît.
- **Invitation** : tant que l'envoi d'e-mails n'est pas arbitré, « Inviter » ouvre la création d'un **lien d'invitation** à copier. L'envoi par e-mail reste en « Bientôt ».

## 3. Aide intégrée contextuelle (L26-02, L26-03)

### 3.1 Tiroir
- **Ouverture** : bouton `help` de la barre du haut (déjà présent), ou la touche F1. Il n'est pas modal (`aside` nommé « Aide ») : la page reste utilisable. Il fait 400 px de large, sous la barre du haut, et devient plein écran sous 640 px.
- **Le focus** va dans le champ de recherche à l'ouverture. Échap ferme le tiroir et rend le focus au bouton.
- **Sections** :
  1. **« Sur cette page · {{page}} »** : 2 à 4 articles liés à la page (table de correspondance route → articles), puis « Visite guidée de cette page » ;
  2. **« Apprendre TutoClick »** : le parcours (§3.4), avec sa progression ;
  3. **« Raccourcis »** : lien vers la liste des raccourcis (touche ?), qui existe déjà (L12) ;
  4. **pied** : « Besoin d'aide ? Contacter le support de la DSI », avec l'adresse ou le lien réglé dans Paramètres > Général > « Contact d'aide ». Sans réglage, le pied affiche « Demandez à un administrateur de l'espace » et la liste des administrateurs.
- **Éditeur** : les articles « Sur cette page » suivent l'onglet du panneau (Étape, Design, Réglages).

### 3.2 Articles et recherche (L26-03)
- **Les articles** sont des fichiers Markdown livrés avec l'app (`aide/*.md`, versionnés). Il n'y a pas de service externe et aucune donnée ne sort.
- **Un article s'ouvre dans le tiroir**, avec un bouton retour, un titre `h2`, et « Cet article vous a aidé ? Oui / Non ». La réponse est un compteur anonyme, sans texte libre.
- **Recherche** :
  - côté client, sur le titre et le texte, insensible aux accents et à la casse ;
  - les résultats remplacent les sections, avec le titre « n résultats pour « {{requête}} » » (`aria-live="polite"`), les termes trouvés en `mark`, et la rubrique sous chaque titre ;
  - aucun résultat : « Aucun article ne correspond. Essayez un autre mot, ou contactez le support de la DSI. »
- **Contenu minimal au lancement** : un article par page principale (Démos, Éditeur, Partager, Diffusion, Analytics, Apprenants, Centre de formation, Paramètres), plus « Données personnelles et floutage » et « Accessibilité des démos ».

### 3.3 Visites guidées
- Une visite guidée est une **démo TutoClick**, faite avec TutoClick, sur des données fictives. Elle s'ouvre dans le lecteur, en modale (`dialog`, 960 px). Ce n'est pas une surcouche sur l'app réelle.
- Les visites sont hébergées dans un espace système en lecture seule. Elles ne comptent pas dans les statistiques de l'espace.
- Elles reprennent l'accessibilité du lecteur.

### 3.4 « Apprendre TutoClick »
- Un parcours de 6 modules, chacun étant une visite guidée :
  - Capturer une démo ;
  - Modifier une étape ;
  - Flouter les données ;
  - Publier et partager ;
  - Diffuser (intranet, SCORM) ;
  - Lire les statistiques.
- **Progression** : par personne, « n sur 6 ». Un module est terminé quand sa dernière étape est vue.
- **Libellés** : les modules faits affichent « Revoir », le prochain « Commencer », les autres « n étapes ». **Pas de durée** affichée (règle « pas de texte faux »).

## 4. Bibliothèque de modèles de formation (L26-04, L26-05)

### 4.1 Partir d'un modèle (L26-04)
- **Entrée** : troisième carte de la modale « Nouvelle démo », « Partir d'un modèle » (icône `template`).
- **Modale** : 1 040 px, sur trois colonnes (une seule sous 1 000 px) :
  - **catégories** (boutons `aria-pressed`) : Tous, Logiciel, Procédure, Réglementaire, Accueil, puis un séparateur et « Modèles de l'espace ». Chaque catégorie affiche son nombre de modèles ;
  - **grille des modèles** (`radiogroup`) : icône, nom, « n chapitres · n étapes », et ce qui caractérise le modèle (quiz, Avant / Après, checklist, seuil) ;
  - **aperçu** du modèle choisi : description, puis chapitres et étapes numérotées avec leur type (bulle, saisie animée, quiz, pop-up, fin). En dessous, l'alerte « Le modèle apporte la structure et les textes. Les n étapes à capturer sont marquées « À capturer » : l'extension les propose dans l'ordre. »
- **Pied** : « Les textes utilisent vos variables ({{first_name}}) et votre style par défaut. », puis « Annuler » et « Utiliser ce modèle ».
- **Modèles livrés** (génériques, sans nom de logiciel) : Prise en main d'un logiciel, Nouvelle procédure, Changement de version (Avant / Après), Formation avec quiz noté (seuil 70 %), Accueil d'un nouvel agent (checklist), Démo d'une fonctionnalité (bouton d'action).
- **Résultat** : une démo brouillon.
  - Chaque étape à capture est une **étape « À capturer »** : cadre pointillé, titre de l'étape et bouton « Capturer cette étape ».
  - Les étapes sans capture (quiz, pop-up, fin) sont prêtes, avec des textes à relire.
  - Tant qu'une étape « À capturer » reste, la publication est bloquée, avec le message « n étapes restent à capturer ».
- **Capture guidée** : en ouvrant l'extension depuis une démo qui a des étapes « À capturer », la barre de capture affiche « Étape à capturer : {{titre}} (n / N) ». Chaque clic remplit l'étape suivante.

### 4.2 Enregistrer comme modèle (L26-05)
- **Où** : éditeur, menu ⋯ de la barre, « Enregistrer comme modèle ». Réservé aux propriétaires, administrateurs et éditeurs.
- **Champs** : nom (60 caractères), description (200 caractères, facultative), catégorie.
- **Captures** (radios) :
  - **Sans les captures** (recommandé, par défaut) : chaque étape devient « À capturer », et aucune donnée de la démo d'origine n'est copiée ;
  - **Avec les captures, comme exemple** : les zones floutées restent floutées, avec l'aide « À éviter si les captures montrent des données réelles ».
- **Gardés** : chapitres, textes des bulles, quiz, réglages et style.
- Le modèle est visible par tous les membres de l'espace. Il se gère dans la bibliothèque (menu ⋯ : Renommer, Supprimer).

## 5. Visiteurs récurrents (L26-06 à L26-08)

- **Définition** (A4 §1) : un visiteur récurrent est le **même navigateur revenu après plus de 30 minutes**, ou un **apprenant identifié** (F3) déjà venu.
- **Identifiant** :
  - un identifiant aléatoire (UUID), propre à l'espace, est gardé dans le `localStorage` du lecteur pour **13 mois au plus**. Il est renouvelé à échéance ;
  - il ne contient aucune donnée personnelle, n'est jamais partagé avec un autre site, et n'est pas un cookie tiers ;
  - pour un apprenant identifié, son identifiant d'apprenant est utilisé à la place.
- **Intégration chez un tiers** : dans une intégration sur un autre site, le stockage est cloisonné par le navigateur. Un même visiteur est donc compté une fois par site. C'est écrit dans « Comment c'est mesuré ».
- **Refus** :
  - le menu d'informations du lecteur propose « Ne pas mesurer mes visites » : l'identifiant est supprimé et un drapeau de refus est gardé ;
  - le signal Global Privacy Control du navigateur est respecté de la même façon.
- **Conformité** : la mesure est pensée pour l'exemption de consentement de la CNIL (mesure d'audience seule, sans recoupement). Le texte le dit et renvoie à la **validation du DPO**, sans affirmer la conformité.

### Écrans
- **Vue d'ensemble (L26-06)** :
  - KPI « Visiteurs récurrents » après « Visiteurs uniques » : pourcentage, puis « n sur N · revenus au moins une fois » ;
  - carte « Nouveaux et récurrents » : deux barres avec leur valeur écrite et `role="img"` résumé, puis la définition et « Comment c'est mesuré » (ouvre L26-08) ;
  - phrase : visites moyennes d'un récurrent et démos les plus revues, en chiffres réels. Avec moins de 20 récurrents sur la période, la phrase est omise.
- **Sessions (L26-07)** :
  - sous le visiteur, un badge « Nouveau », ou « Récurrent · visite n° n » (icône `repeat`) ;
  - le même badge apparaît dans Temps réel (L19-01), à la place de « Nouveau / Récurrent » omis jusqu'ici ;
  - le critère de segment « Nouveau ou récurrent » perd son badge « Bientôt » (L19-04).
- **Réglage (L26-08)** : modale « Mesure des visites », ouverte depuis « Mesure des visites » (Analytics) et depuis Paramètres > Confidentialité :
  - interrupteur « Reconnaître les visiteurs qui reviennent », **activé par défaut**, avec l'explication de l'identifiant ;
  - « Durée entre deux visites » : 30 minutes (par défaut) ou 24 heures ;
  - alerte sur la CNIL et le DPO ;
  - texte du cas désactivé : plus aucun identifiant n'est créé, les identifiants existants sont ignorés, et le KPI affiche « Mesure désactivée ».
  - Réservé aux propriétaires et administrateurs.

## 6. Mode présentateur complet (L26-09 à L26-12)

L22 a livré les notes par étape, le lancement, la vue présentateur, l'écran public et l'écran noir. L26 y ajoute ce qui suit.

### 6.1 Notes de la démo et modification en direct (L26-09)
- **Notes de la démo** :
  - dans l'éditeur, Réglages > « Notes du présentateur · démo » : introduction, conclusion, questions à anticiper ; 2 000 caractères au plus, mêmes règles de confidentialité que les notes d'étape ;
  - dans la vue présentateur, des onglets « Étape n / Démo » en tête de la carte Notes. L'onglet « Démo » s'ouvre de lui-même à l'étape 1 et sur l'écran de fin.
- **Modifier pendant la présentation** :
  - le bouton « Modifier » (`pencil`) bascule les puces en zone de texte ;
  - l'enregistrement est automatique 1 s après la dernière frappe, avec la phrase « Enregistré dans la démo. Visible seulement par les éditeurs. » ;
  - pendant la saisie, les flèches et les raccourcis N, B, T sont désactivés. Échap quitte la modification sans fermer la présentation.
- **Puce « Téléphone connecté »** (bleu `#8CC8EC` sur `#10202C`, 9,2:1) à côté de « Écran public ouvert », quand la télécommande est appairée.

### 6.2 Télécommande (L26-10, L26-11)
- **Appairage (L26-10)** :
  - nouvelle option dans la modale de lancement (L22-02) : « Piloter depuis mon téléphone ». La même action existe dans la vue présentateur (menu ⋯ ou touche R) ;
  - la modale affiche un QR code (`role="img"` nommé), l'adresse courte `tutoclick.example/t` et un code de 6 chiffres lisible (`aria-label` chiffre par chiffre) ;
  - **sécurité** :
    - le code est à usage unique, valable 5 minutes ;
    - 5 essais au plus, puis un nouveau code ;
    - le jeton lie le téléphone à **cette présentation seulement**. Il expire à la fin de la présentation, et au plus tard après 4 heures ;
    - un seul téléphone à la fois.
  - Le téléphone n'a pas besoin de compte. Il n'accède à rien d'autre de l'espace.
  - Le statut « En attente du téléphone… » (`aria-live`) devient « Téléphone connecté ».
- **Téléphone (L26-11)** :
  - fond `#0B0D10` ;
  - en tête : titre de la démo et « n / N » ;
  - minuteur en 40 px (`role="timer"`) ;
  - notes de l'étape en puces de 19 px, puis « Ensuite : {{titre}} » ;
  - en bas, à portée de pouce : « Préc. » (64 px de haut) et « Suivante » (vert DSI `#C5E86C`, texte `#12210A`, 12,1:1) ; puis « Écran noir » (`aria-pressed`) et « Terminer » (avec confirmation) ;
  - l'écran reste allumé (Wake Lock) pendant la présentation ;
  - si le réseau est perdu : bandeau « Connexion perdue, reconnexion… ». Les commandes sont désactivées jusqu'au retour.
- **Synchronisation** : les deux écrans partagent le même canal temps réel que l'écran public (L22-04). Une action sur un écran se reflète sur l'autre en moins d'une seconde.

### 6.3 Bilan de fin (L26-12)
- **Terminer** remplace le toast de L22 par une modale « Présentation terminée · durée » :
  - rappel de la durée cible ;
  - tableau du temps passé par étape (`role="table"`), avec une barre et la durée écrite. L'étape la plus longue est en gras, avec « la plus longue » et une barre orange (`#B85B00`, 4,6:1 sur blanc). Au-delà de 6 étapes, les dernières sont regroupées ;
  - texte : « Ce bilan n'est gardé que pour vous, 30 jours. Une présentation n'est pas comptée comme une vue. », et le nombre d'étapes dont les notes ont changé.
- **Boutons** : « Fermer », « Retour à l'éditeur » (principal).
- **Conservation** : 30 jours, visible seulement par la personne qui a présenté. Rien ne passe dans Analytics.

## 7. Vague B (VB-01 à VB-03)

Spécifiées dans L25 §8 et en cours chez le développeur :
- VB-01 : Assistance IA, page « Fonctions à venir », bandeau « Aucune donnée n'est envoyée à un service d'IA » ;
- VB-02 : carte « Outils d'e-mailing » ;
- VB-03 : carte « Connexion unique (SSO / SAML) » dans Paramètres > Sécurité.

Le tiroir d'aide (§3) ajoute un lien « Fonctions à venir » dans sa section « Raccourcis ».

## 8. Accessibilité

- **Checklist** : liste ordonnée. Chaque étape faite a un texte « Fait » en `sr-only`, et la progression a son `aria-valuetext`.
- **Tiroir d'aide** : non modal, nommé, focus géré à l'ouverture et à la fermeture, résultats annoncés en `aria-live="polite"`. Les visites guidées reprennent les règles du lecteur.
- **Modèles** : grille en `radiogroup`, catégories en boutons `aria-pressed`, aperçu nommé. Au clavier : flèches dans la grille, Entrée pour utiliser le modèle.
- **Visiteurs récurrents** : badges en texte (jamais la couleur seule), barres avec valeurs écrites et `role="img"`.
- **Présentateur** : focus à double anneau sur fond sombre (L22). La zone de notes est nommée. Sur le téléphone, les cibles font au moins 48 px et l'ordre de tabulation suit l'ordre visuel.

## 9. Hors périmètre

- Assistant conversationnel dans l'aide, et articles générés par IA (« Bientôt », VB-01).
- Surcouche de visite guidée sur l'app réelle (les visites sont des démos en modale).
- Partage public de modèles entre espaces ; place de marché de modèles.
- Recoupement des visiteurs entre appareils ; empreinte du navigateur (exclue).
- Télécommande avec aperçu vidéo de l'écran public ; plusieurs présentateurs à la fois.
