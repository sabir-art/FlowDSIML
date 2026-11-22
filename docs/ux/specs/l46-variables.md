# L46 : variables lisibles pour des non-codeurs

> Priorité client. Aujourd'hui :
> - l'auteur voit `{{first_name}}` en brut dans le champ ;
> - le menu Variable liste des clés techniques (« company », « first_name ») ;
> - l'aperçu affiche « Bienvenue » sans rien derrière ;
> - le gras apparaît en `**Pipeline**`.
>
> Modèle d'interaction : l'ajout de champ dynamique de Webflow (formulaires, notifications). La variable est un objet qu'on insère, qu'on lit et qu'on règle, pas du code qu'on tape.
> Maquette : `docs/ux/maquettes/refonte/l46-variables.html`. Captures : `img/l46-champ.png`, `img/l46-apercu.png`, `img/l46-une-ligne.png` et `img/l46-sombre.png`.
> Données fictives.

## 1. État actuel (code de `claude/dev-mvp`, f68f79e)

- `RichTextField.tsx` : un `textarea` avec un calque de surlignage. Les `**`, `*` et `{{clé}}` restent visibles dans le texte saisi.
- `Canvas.tsx` (`withVariablePills`) affiche `{{clé}}` dans une pastille. `VariablePreview.tsx` affiche la phrase avec les valeurs par défaut, souvent vides.
- Stockage : `{{clé}}` ou `{{clé|repli}}`, lu par `applyVariables` (`packages/core/src/variables.ts`). Une variable sans valeur disparaît avec l'espace qui la précède.
- Table `variables` (espace) : `key`, `label`, `default_value`. Pas de description ni d'exemple.
- Paramètres > Variables : `VariablesSettings` (`SoonSections.tsx`).

**Le format stocké ne change pas** : `{{clé|repli}}` reste la vérité, compatible avec le lecteur, les exports et les liens personnalisés. Seul l'éditeur change.

## 2. Éditeur de texte riche (WYSIWYG)

Remplace le `textarea` de `RichTextField` par un éditeur `contenteditable` (TipTap ou ProseMirror, au choix du dev), dans `packages/ui` (`fd-rte`).

- **Mise en forme visuelle** : gras, italique et lien s'affichent mis en forme, **jamais** de `**`, `*` ou `[texte](url)` visibles. Barre de 3 boutons à icône (Lucide `bold`, `italic`, `link`, infobulles L44 avec Ctrl B, Ctrl I, Ctrl K). Raccourcis clavier identiques.
- **Sérialisation** : à l'enregistrement, le contenu est converti au format actuel (`**gras**`, `*italique*`, `[texte](url)`, `{{clé|repli}}`). Au chargement, conversion inverse. Un test aller-retour garantit que tout texte existant est relu à l'identique.
- **Coller** : le texte collé est nettoyé (gras, italique et liens conservés, le reste retiré). Un `{{first_name}}` collé devient une pastille.
- **Champ sur une ligne** (titre, bouton, écran de fin) : même éditeur, sans retour à la ligne (Entrée valide), sans barre de mise en forme ; « + Variable » à droite dans le champ.
- Le champ garde le cadre, le focus et les tailles des champs actuels (`fd-input`).

## 3. Bouton « + Variable »

- Dans la barre du champ, à droite : bouton texte « + Variable » (icône `plus`, couleur `primary`, 32 px de haut). `aria-haspopup="dialog"`.
- Raccourci : taper `{` dans le texte ouvre le même catalogue sous le curseur ; la saisie qui suit filtre la liste. Échap ferme le catalogue et laisse le `{` tapé.
- **Champs concernés** (tous ceux où un texte est montré au visiteur) :
  - étape : titre, texte de la bulle, texte des points d'intérêt, libellé du bouton d'action ;
  - écran de fin : titre, texte, libellés des boutons ;
  - formulaire de lead : titre, texte d'introduction, message de confirmation ;
  - pop-up et bandeau d'annonce : titre, texte, bouton ;
  - checklist : titre et libellé des tâches ;
  - e-mails envoyés au visiteur (suivi, relance) : objet et corps ;
  - page personnalisée (liens personnalisés) : titre (aujourd'hui `personalTitle`).
- **Champs exclus** : noms internes (titre de la démo dans la bibliothèque, dossiers), adresses (URL), notes du présentateur, commentaires, champs de recherche.

## 4. Catalogue

Popover de 360 px sous le bouton (ou sous le curseur avec `{`), positionné par l'algorithme L44 (ne sort jamais de l'écran), 480 px de haut au plus avec défilement.

- **Recherche** en haut, focus à l'ouverture, sur le libellé, la description et la clé.
- **Groupes**, dans cet ordre :

| Groupe | Libellé | Description | Exemple | Clé | Source de la valeur | Repli proposé |
|---|---|---|---|---|---|---|
| Visiteur | Prénom du visiteur | Prénom de la personne qui regarde la démo. | Camille | `first_name` | lien, CSV, formulaire | vous |
| Visiteur | Nom du visiteur | Nom de famille. | Martin | `last_name` | lien, CSV, formulaire | (vide) |
| Visiteur | Fonction du visiteur | Son poste, s'il est connu. | Conseillère | `job_title` (nouvelle) | lien, CSV, formulaire | (vide) |
| Visiteur | E-mail du visiteur | Adresse e-mail, pour un e-mail de suivi. | camille.martin@example.com | `email` | lien, CSV, formulaire | (vide) |
| Entreprise | Nom de l'entreprise | Structure du visiteur. | Acme Formation | `company` | lien, CSV, formulaire | votre structure |
| Démo | Titre de la démo | Le titre affiché en haut du lecteur. | Créer un rapport | `demo_title` (nouvelle) | calculée par le lecteur | — |
| Démo | Nombre d'étapes | Total des étapes de la démo. | 7 | `step_count` (nouvelle) | calculée par le lecteur | — |
| Date | Date du jour | Au moment où la démo est vue. | 20 novembre 2026 | `today` (nouvelle) | calculée, dans la langue du lecteur | — |
| Votre espace | (variables de Paramètres > Variables) | description saisie | exemple saisi | clé de l'espace | valeur fixe de l'espace, ou lien | repli saisi |

- **Ligne** : libellé (14 px, graisse 700), description sur une ligne (12,5 px, `text-muted`), exemple à droite (« Ex. : Camille »). Survol et focus : fond `surface-hover`.
- **Clavier** : flèches pour parcourir (les groupes sont traversés), Entrée insère, Échap ferme et rend le focus au champ.
- **E-mail du visiteur** n'apparaît que dans les champs d'e-mail (objet, corps) et les formulaires : jamais dans une bulle (donnée personnelle affichée à l'écran).
- **Pied** : lien « Gérer les variables de l'espace » (icône `settings`) vers Paramètres > Variables, visible si l'utilisateur a le droit `demo.edit`.
- **Aucun résultat** : « Aucune variable ne correspond. » et, avec le droit, le bouton « Créer la variable « {saisie} » », qui ouvre la création (§8) préremplie.
- Les variables « calculées » (Démo, Date) n'ont pas de repli : elles ont toujours une valeur.

## 5. Pastille dans le champ

- **Aspect** : 24 px de haut, arrondi 6 px, fond `primary-soft`, texte `primary-soft-text` 13 px graisse 600, icône Lucide `braces` de 13 px à gauche, puis le **libellé** (« Prénom du visiteur »). Si un repli est défini : « · vous » en graisse 500, à 75 % d'opacité. Variables de l'espace : même forme, fond bleu doux (`info-soft`), pour les distinguer.
- **Jamais de clé technique** à l'écran. Le libellé vient du catalogue (variables prédéfinies, traduites en i18n) ou de la table `variables` (espace).
- **Nœud atomique** : pour le curseur, la pastille compte pour un seul caractère.
  - flèches gauche et droite : on passe par-dessus ;
  - Retour arrière ou Suppr à côté : la pastille est d'abord **sélectionnée** (contour `primary`), un second appui la supprime entière ;
  - glisser-déposer avec la souris, ou couper-coller, pour la déplacer ; le curseur de survol est `grab` ;
  - un double-clic n'en sélectionne pas le texte.
- **Clic** sur la pastille, ou Entrée quand elle est sélectionnée : ouvre son réglage (§6).
- **Variable supprimée de l'espace** : pastille grise barrée « Variable supprimée », avec sous le champ « Elle n'affiche rien chez le visiteur. Remplacez-la ou retirez-la. ». Jamais la clé.
- **Accessibilité** : la pastille est rendue avec `aria-label="Variable : Prénom du visiteur, si inconnu : vous"`. Le lecteur d'écran la lit comme un mot.

## 6. Réglage d'une pastille (valeur de repli)

Popover de 360 px ancré sur la pastille.

- En-tête : icône, libellé, bouton Fermer.
- Description et exemple (une ligne).
- Champ « Si inconnu, afficher » : prérempli avec le repli proposé du catalogue (« vous », « votre structure »…), modifiable, 40 caractères au plus. Aide : « Laissé vide, le mot disparaît et les espaces autour sont corrigés. » (comportement actuel d'`applyVariables`).
- Repli **par insertion** : chaque pastille a le sien (`{{first_name|vous}}` ici, `{{first_name|à vous}}` ailleurs).
- Bloc repliable « Dans un lien ou un fichier CSV » : comment fournir la valeur (paramètre `?prenom=Camille` ou colonne de l'import). Les paramètres d'URL acceptent la clé et un alias français (`prenom`, `nom`, `fonction`, `entreprise`), en plus des formes actuelles (`first_name`, `v_first_name`).
- Actions : « Retirer » (bouton fantôme, icône `trash`) et « Appliquer » (primaire). Entrée applique, Échap annule.
- **Valeur par défaut d'insertion** : le repli proposé du catalogue (ou celui saisi dans Paramètres > Variables). Il est visible dans la pastille dès l'insertion, sans ouvrir le réglage.

## 7. Aperçu

- **Canevas de l'éditeur** et **Aperçu** (bouton du haut) : les pastilles sont remplacées par les **exemples** du catalogue : « Bienvenue Camille ! ». Jamais de mot manquant ni de `{{…}}`.
- Commutateur au-dessus du canevas, affiché seulement si l'étape contient une variable : « Aperçu avec : Exemples | Valeurs de repli » (`fd-segmented`). « Valeurs de repli » montre ce que verra un visiteur dont on ne sait rien.
- Dans le canevas de l'éditeur seulement, les valeurs insérées sont légèrement surlignées (`primary` à 10 %), pour repérer les variables. Jamais dans le lecteur publié.
- `VariablePreview` (ligne sous le champ) est retiré : l'aperçu se fait dans le canevas.
- Lecteur publié : inchangé (valeurs réelles, sinon repli, sinon disparition propre).

## 8. Paramètres > Variables

- Tableau : Nom (libellé), Description, Exemple, Si inconnu, Utilisée dans (« 12 démos », comptage actuel). La clé n'est pas affichée ; elle est créée à partir du libellé (« Nom du logiciel » → `nom_du_logiciel`) et visible seulement dans le bloc « Dans un lien ou un fichier CSV ».
- Création et modification (tiroir) : Nom (obligatoire, 40 caractères), Description (une ligne, 80 caractères), Exemple (obligatoire : il sert à l'aperçu), Valeur fixe de l'espace (facultative : sinon la valeur vient du lien ou du CSV), Si inconnu.
- Texte d'en-tête : « Des mots que vous définissez une fois, puis insérez dans toutes les démos. Elles s'ajoutent aux variables prédéfinies (visiteur, entreprise, démo, date). »
- Suppression : confirmation qui indique le nombre de démos concernées ; les pastilles deviennent « Variable supprimée » (§5).
- **Migration** (dev) : ajouter `description text not null default ''`, `example text not null default ''` et `value text` à `variables`. `label` existe déjà ; les variables sans libellé prennent leur clé, mise en forme (« nom_logiciel » → « Nom logiciel »), à corriger par l'auteur.

## 9. Aide au premier usage

- Au premier clic sur « + Variable » (par utilisateur, préférence stockée), un encart en tête du catalogue : « **Qu'est-ce qu'une variable ?** Un mot qui s'adapte à chaque visiteur : « Bonjour Prénom du visiteur » devient « Bonjour Camille ». » et le lien « Compris ».
- L'encart ne revient plus après « Compris » ou après une première insertion.
- Il est `role="note"`, lu à l'ouverture du catalogue.

## 10. Recette

- **Aucun `{{`, `}}`, `**` ou `*` visible** dans l'éditeur, le canevas, l'aperçu et le lecteur, sur une démo qui en contient (test automatisé sur le texte visible).
- Aller-retour : les textes existants (démo de test et fixtures e2e) sont relus et réenregistrés à l'identique.
- Insertion par le bouton et par `{` ; recherche ; clavier complet ; suppression en deux appuis ; déplacement par glisser et par couper-coller.
- Repli : réglé sur une pastille, visible dans la pastille, appliqué dans « Valeurs de repli » et dans le lecteur sans valeur.
- Aperçu : « Bienvenue Camille » avec les exemples.
- Liens personnalisés et CSV : les valeurs arrivent dans le lecteur (y compris avec `?prenom=`).
- Paramètres > Variables : création, modification, suppression, comptage.
- Clair et sombre, 1 440 px et panneau de l'éditeur à 360 px.
- Lecteur d'écran : la pastille est lue « Variable : Prénom du visiteur, si inconnu : vous ».


## Ordre des valeurs (décision du chef, 22/11)

Pour chaque variable, dans cet ordre :
1. la **valeur connue** : celle du visiteur (lien, CSV, formulaire) ou la **valeur fixe** de l'espace (Paramètres > Variables) ;
2. le **repli de la pastille** (`{{clé|repli}}`), écrit par l'auteur pour cette phrase ;
3. le **défaut de l'espace** (repli général de la variable) ;
4. rien : la variable disparaît avec l'espace qui la précède.

C'est la même logique partout : éditeur (aperçu « Exemples » et « Valeurs de repli »), lecteur, SCORM, exports (PDF, GIF, vidéo, version accessible), liens personnalisés (`applyUrlVariables`) et voix de synthèse. Un test unitaire dans `packages/core` la vérifie : « Bienvenue chez {{company|vous}} » avec le défaut d'espace « votre entreprise » donne « Bienvenue chez vous » sans valeur, et « Bienvenue chez Acme » avec la valeur Acme.
