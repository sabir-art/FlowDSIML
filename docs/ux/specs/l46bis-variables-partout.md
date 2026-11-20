# L46-bis, Variables dans tous les textes montrés au visiteur

> Complète L46 (`l46-variables.md`), livré en 27bf895 seulement pour la bulle et son titre (`StepPanel`, `HotspotPanel`).
> Maquette : `docs/ux/maquettes/refonte/l46bis-variables.html`. Règles visuelles : `composants.md` §17.
> **Aucun changement de schéma.** Le format stocké reste `{{clé|repli}}`, et le lecteur sait déjà le remplacer (`applyVariables`, dans `packages/core/src/variables.ts`). La relance s'enregistre dans `workspaces.settings`, un JSON qui existe déjà.

## 1. Deux variantes du même champ

On garde le composant de L46 (`VarTextField`) en deux variantes :

| Variante | Où | Aspect |
|---|---|---|
| **Texte riche** | Textes de plusieurs lignes | Barre gras, italique, lien, puis « + Variable » à droite (comme la bulle) |
| **Une ligne** | Titres, libellés de bouton, éléments de liste, objet d'e-mail | Champ de 40 px, « + Variable » en lien `primary` de 13 px à droite, **dans** le champ (comme le titre de la bulle aujourd'hui). Pas de barre de mise en forme. |

- Pastille, catalogue, repli, aperçu et aide au premier usage : comme L46, avec les écarts de validation corrigés (nom seul dans la pastille, recherche de 40 px).
- La touche `{` ouvre le catalogue dans les deux variantes.
- Compteur de caractères : il compte le texte affiché avec les **exemples**. C'est la longueur que verra le visiteur, pas la clé.

## 2. Surfaces

| Surface | Composant | Champs avec variables | Variante |
|---|---|---|---|
| **Bouton d'action** | `CtaFields` | Libellé ; **adresse du lien** | Une ligne |
| **Écran de fin** (dernière étape de texte, « Merci ! ») | `StepPanel`, étape de texte | Titre ; texte ; libellé du bouton | Une ligne, texte riche, une ligne |
| **Étape pop-up** | `GuidedStepFields`, `editor.advanced.popup` | Titre ; texte ; libellé du bouton | Une ligne, texte riche, une ligne |
| **Formulaire** | `FormPanel` | Titre ; introduction ; message de remerciement | Une ligne, texte riche, texte riche |
| **Checklist** | `SettingsTab`, `editor.advanced.checklist` | Titre ; éléments (un par chapitre) | Une ligne |
| **Relance des apprenants** | `LearnersPage`, `learners.remind` | Objet ; message (§3) | Une ligne, texte simple |

- **Pas de variables** dans les libellés des champs du formulaire (« Adresse e-mail »…), dans les textes alternatifs, ni dans les noms de chapitres côté éditeur. Ce sont des textes d'interface, pas des messages.
- **Adresse du lien** du bouton d'action :
  - la valeur est encodée dans l'adresse (`encodeURIComponent`) ;
  - le catalogue ne propose que les variables du groupe Visiteur et Entreprise ;
  - au survol de la pastille, une ligne d'aide : « Ajoutée à l'adresse, encodée ».
  - Avec une valeur inconnue et sans repli, le paramètre est vide (`?prenom=`), le lien reste valide.
- **Formulaire** : **nouveau comportement du lecteur**. Aujourd'hui, les valeurs viennent seulement de l'adresse (`?company=…`) et du lien personnalisé (`main.tsx`). Après l'envoi du formulaire :
  - les champs saisis qui correspondent à une variable (prénom, nom, fonction, entreprise) prennent leur valeur pour la suite de la session, dans le remerciement, les bulles suivantes et l'écran de fin ;
  - une valeur de l'adresse ou du lien personnalisé n'est jamais écrasée ;
  - rien n'est gardé après la session.

## 3. Relance des apprenants

- Aujourd'hui, « Relancer » ouvre la messagerie, avec un objet et un message fixes (`learners.remind.subject` et `body`) et **un seul e-mail** en copie cachée pour tous.
- L46-bis ajoute une boîte « Préparer la relance » avant l'ouverture de la messagerie :
  - « Objet » (une ligne) et « Message » (texte simple : `mailto` ne porte pas de mise en forme), préremplis avec les textes actuels ;
  - « Enregistrer comme message par défaut de l'espace », case cochée par défaut ;
  - action principale « Ouvrir dans ma messagerie », puis « Annuler ».
- **Variables possibles** : celles qui ont la même valeur pour tous les destinataires : Nom de l'espace, Date du jour et les variables de l'espace.
- **Variables par personne** (Prénom de l'apprenant, Lien personnel) :
  - elles sont présentes dans le catalogue, mais désactivées ;
  - raison affichée : « Un seul e-mail part à tous, en copie cachée : pas de valeur par personne. » ;
  - à droite, « Bientôt » en texte, car un envoi personnalisé demanderait un envoi par le serveur, qui n'existe pas.
  - Elles ne sont jamais masquées.
- Le message par défaut est gardé dans les réglages de l'espace (`workspaces.settings.reminder`, objet et texte). C'est une clé dans un JSON existant, pas une colonne.

## 4. Lecteur

- Le lecteur remplace les variables dans toutes les surfaces du §2, avec la même règle que la bulle : valeur connue, sinon repli, sinon rien, sans espace double.
- Aperçu de l'éditeur : la bascule « Exemples / Valeurs de repli » de L46 s'applique aussi à l'écran de fin, à la pop-up, au formulaire et à la checklist.

## 5. Recette

1. Chaque champ du tableau §2 a « + Variable » ; `{` ouvre le catalogue ; la pastille montre le nom seul.
2. Bouton d'action avec l'adresse `https://intranet.example/inscription?prenom=` suivie de « Prénom du visiteur » : avec « Camille », le lecteur ouvre `…?prenom=Camille` ; avec « Jean Ö », il ouvre `…?prenom=Jean%20%C3%96`.
3. Écran de fin « Merci Prénom du visiteur ! », avec le repli « » : un visiteur inconnu lit « Merci ! », sans espace double.
4. Checklist « Votre parcours, Prénom du visiteur » : l'aperçu en mode « Valeurs de repli » montre le repli.
5. Formulaire envoyé avec le prénom « Camille », sans `?first_name` dans l'adresse : le remerciement dit « Merci Camille » ; avec `?first_name=Léa` dans l'adresse, il dit « Merci Léa ».
6. Relance : « Prénom de l'apprenant » est désactivé, avec sa raison et « Bientôt ». « Nom de l'espace » insère la pastille, et la messagerie s'ouvre avec « Acme Formation » dans le message.
7. Relance : le message modifié est proposé de nouveau à la relance suivante, si la case est restée cochée.
8. Clavier : pour chaque surface, `{`, puis les flèches, puis Entrée insèrent la pastille ; Retour arrière la supprime d'un coup.
