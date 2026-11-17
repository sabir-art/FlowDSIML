# Spec F1 : parcours guidés (compléments formation)

> Phase « Formation » : former les équipes à un outil par des tutoriels interactifs. L'outil reste **générique** : aucune mention d'un programme ou d'un logiciel réel dans l'interface. On parle d'« outil », de « structure », d'« équipe », de « module » et d'« apprenant ».
>
> **Base F1 déjà spécifiée** dans `a2-editeur.md` et la maquette `editeur-avance.html` :
>
> | Fonction | Section de `a2-editeur.md` | Vue de la maquette |
> |---|---|---|
> | Walkthrough / Spotlight et cadre | §1 | `?view=modes` |
> | Étape pop-up | §2 | `popup` |
> | Checklist | §3 | `checklist` |
> | Branching par profil | §5 | `choix` |
>
> Ce document ajoute deux écrans **à développer** (§1, §2) et deux **propositions** à valider avant tout développement (§3, §4).
>
> Maquette : `docs/ux/maquettes/refonte/f1-formation.html`, avec `?view=flous|rgpd|avap|gloss` et `&theme=dark`.
> Microcopie FR/EN (69 clés) : `extension.piiCheck.*`, `editor.gdpr.*`, `editor.beforeAfter.*`, `editor.glossary.*`.

## 1. Vérification des flous avant envoi (extension) : à développer

**Quand ?** À la fin d'une capture, **avant tout envoi** à Supabase. L'extension ouvre un onglet de vérification (page de l'extension, plein écran). Rien ne quitte le navigateur avant le clic sur « Flouter et envoyer ».

**Détection, côté client uniquement :**
- Elle travaille sur le texte du DOM capturé : texte des nœuds, avec la boîte de chaque correspondance (`Range.getClientRects`). Pas d'OCR.
- Types et règles :

| Type | Règle (indicative) | Icône |
|---|---|---|
| Nom | Libellé de champ voisin (« Nom », « Prénom », « Usager »…), ou motif Prénom + NOM | `User` |
| N° de sécurité sociale | 13 chiffres + clé de 2, espaces tolérés, premier chiffre 1 ou 2 | `IdCard` |
| Téléphone | Numéro FR (0X ou +33, 10 chiffres), séparateurs tolérés | `Phone` |
| E-mail | Motif standard | `Mail` |
| Adresse | n° + type de voie (rue, avenue, bd…), ou code postal + ville | `Home` |
| Date de naissance | Date proche d'un libellé « naissance » / « né(e) le » | `Cake` |

- **Défaut : tout est coché**, donc tout sera flouté. Les **faux positifs** se décochent un par un. On ne décoche jamais par lot.
- Les **zones déjà définies** par l'utilisateur (outil Flou de l'extension) apparaissent comme « Sera floutée », sans type.

**Écran** (3 colonnes ; sous 1 100 px, la liste passe sous la capture) :
- **En-tête** : symbole DSI, `h1` « Vérifier les données avant l'envoi », sous-titre « {{demo}} · n captures · rien n'a encore quitté votre navigateur », badge d'état « Analyse terminée » (pendant l'analyse : spinner + `analyzing`, `aria-busy`).
- **Alerte warning** (`role="alert"`) avec le résumé (pluriel) et l'aide. Sans détection : alerte info `none`. On demande quand même de relire, car la détection n'est pas exhaustive.
- **Rail des captures** : vignette, titre, pastille de compte (`danger-soft` si au moins une détection, `success-soft` à 0, avec un `aria-label` explicite). Ordre : les captures avec détections d'abord, puis les autres.
- **Capture** :
  - détection cochée : flou réel 5 px et contour prune plein ;
  - détection décochée : contour framboise **pointillé** ;
  - détection sélectionnée : anneau bleu de focus de 3 px.

  Légende sous la capture. On peut **ajouter une zone** en glissant sur la capture.
- **Panneau « Capture n · n détections »** :
  - une ligne par détection : puce d'icône, type, **extrait masqué** en mono (par exemple `06 •• •• •• ••`, jamais la valeur en clair), interrupteur « Flouter : {{type}} » ;
  - un clic sur la ligne sélectionne la zone sur la capture, et inversement ;
  - s'il reste des détections décochées : `notBlurredWarning` en `fd-help` ;
  - bouton « Tout flouter sur cette capture ».
- **Pied fixe** : mention de confidentialité (`Lock`), « Annuler la capture » (`ConfirmDialog`), puis le bouton primaire « Flouter et envoyer n captures ».

**Règles :**
- Le flou est **appliqué à l'image** avant l'envoi : pixels floutés dans le PNG envoyé. Ce n'est pas un calque CSS. L'original non flouté n'est **jamais** stocké.
- Les métadonnées envoyées par détection : type et boîte, **jamais** le texte détecté. Elles alimentent le bilan RGPD (§2).
- Clavier : flèches haut / bas dans la liste, Espace pour basculer, Tab vers la capture. Chaque zone de la capture est un bouton nommé « {{type}}, floutée / non floutée ».

## 2. Avertissement RGPD avant publication publique : à développer

**Quand ?** À la publication (ou au passage de l'accès à « Toute personne avec le lien », A1 §3), **si** l'accès est public. Rien ne s'affiche pour un accès restreint (invitation, domaine, mot de passe, jeton).

**Modale** `<dialog>` de 560 px :
- puce `Shield` sur fond `warning-soft` et titre « Publier en accès public ? » ;
- texte `body` ;
- **Bilan** calculé sur la version à publier : zones floutées, détections **non floutées** (avec les numéros d'étape, en gras) et rappel « Commentaires internes : jamais publiés » ;
- **deux cases obligatoires** (relu chaque étape ; données fictives ou floutées). « Publier en public » reste `disabled` tant qu'elles ne sont pas cochées, avec `aria-describedby` vers `why` ;
- lien « Choisir Invitation, Domaine e-mail ou Mot de passe » vers l'onglet Accès ;
- actions : « Revoir l'étape n » (s'il reste des détections non floutées : ouvre l'éditeur sur l'étape), « Annuler », « Publier en public ».

La confirmation est **demandée à chaque publication publique** (pas de « ne plus afficher »). L'horodatage et l'auteur de la confirmation sont journalisés avec la version (preuve de diligence).

## 3. Proposition : étape « Avant / Après »

> **Proposition** à valider par le chef d'équipe : non prévue au développement à ce stade.

- Nouveau type d'étape. Il montre l'**ancien geste** à côté du **nouveau** pour accompagner tout changement d'outil.
- **Panneau** : capture « Avant » (une capture de la démo ou une image importée), capture « Après », **disposition** (Côte à côte, Curseur de comparaison, Bascule), libellés (par défaut « Avant · Maintenant »).
- **Player** : 2 captures avec une étiquette au-dessus. « Avant » est en pastille **neutre** et la capture est désaturée (l'ancien outil n'est pas une erreur : jamais de framboise). « Après » est en pastille vert DSI avec texte noir. Dessous, une note qui donne les deux gestes (« Avant : … » / « Maintenant : … »).
- **Mobile** : disposition « Bascule » imposée (un écran à la fois, segmenté Avant / Maintenant).
- **Accessibilité** : chaque capture a un `alt` (« Avant : … ») et la note est en texte réel. Le curseur est un `input type="range"` étiqueté.

## 4. Proposition : glossaire de correspondance

> **Proposition** à valider.

- **Glossaire du workspace** (Paramètres → Glossaire) : ancien terme, nouveau terme, définition courte (140 caractères au maximum), nombre de modules qui l'utilisent. Import et export CSV.
- **Dans le player** : un terme du glossaire présent dans une bulle est souligné en pointillé. Au survol ou au focus, sa définition s'affiche dans une infobulle en portail (§15.7), avec `aria-describedby`. Un bouton « Glossaire » (`Book`) ouvre un tiroir avec recherche, où l'ancien terme apparaît barré au-dessus du nouveau.
- Le centre de formation (F4) reprend le glossaire en page dédiée.

## 5. Recette prévue

- **§1** :
  - captures de test avec un nom, un NIR, un téléphone, un e-mail, une adresse et une date (tout fictif, `.example`) : chaque type est détecté ;
  - un faux positif se décoche ;
  - le PNG reçu par Supabase est bien flouté ;
  - aucune valeur détectée dans le réseau.
- **§2** : la modale apparaît uniquement en accès public ; le bouton reste bloqué sans les deux cases ; le bilan est juste.
- Contrôles communs : 1 440 / 1 024, clair et sombre, au clavier et au lecteur d'écran (NVDA ou VoiceOver).
