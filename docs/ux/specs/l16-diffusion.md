# L16 : diffuser une démo (SCORM, intranet, e-mail)

> **Maquette** : `docs/ux/maquettes/reference/diffusion.html`, états par `?etat=` :
> `scorm` · `scorm-cours` · `scorm-pret` · `scorm-erreur` · `intranet` · `intranet-popup` · `mail` · `diffusions` · `non-publiee`.
>
> **Structure** : la modale « Diffuser » s'ouvre au-dessus de la page d'origine (tableau de bord dans la maquette), avec les composants de référence : `.modal`, `.tabs` en `role="tablist"`, `.segmented`, `.switch`, `.alert`, `.progress`, `.table`.
>
> **Base** : `refonte/f6-diffusion.html` et `specs/f6-diffusion.md`. Cette spec remplace F6 sur les points marqués **Change**.
>
> **Données** : fictives (`acme.example`, `demos.tutoclick.example`).

## 1. Accès et structure

- **Où s'ouvre la modale** :
  - menu d'une démo sur le tableau de bord : « Diffuser », juste après « Partager » ;
  - éditeur : menu « … » de la barre du haut, entrée « Diffuser » ;
  - adresse directe `#/demos/:id/distribute`, qui ouvre la modale au-dessus de l'éditeur.
- **Droits** : propriétaires, admins et éditeurs. Les lecteurs ne voient pas l'entrée.
- **En-tête** :
  - titre « Diffuser « {{titre}} » » (`h2`, nom de la modale) ;
  - sous-titre : badge d'état et version, par exemple « Publiée · version 3, publiée le 14 nov. 2026 ».
- **Onglets** : SCORM (icône `package`), Intranet (`globe`), E-mail (`mail`), « Où elle est diffusée » (`share`) avec un compteur.
- **Mémorisation** : l'onglet ouvert la dernière fois est retenu par démo et par navigateur. Par défaut, c'est SCORM.
- **Change** : « Site ou pop-up » n'est plus un canal séparé. L'iframe et le bouton avec pop-up sont dans l'onglet Intranet. L'onglet Intégrer de Partager (A1) reste inchangé pour les sites publics.

## 2. États et codes

| Code | État | `?etat=` | Contenu |
|---|---|---|---|
| L16-01 | SCORM, réglages | `scorm` | Version, critère de réussite, ce que reçoit le LMS, option des statistiques, « Générer le paquet » |
| L16-02 | SCORM, export en cours | `scorm-cours` | Barre de progression, réglages verrouillés, « Annuler la génération » |
| L16-03 | SCORM, prêt | `scorm-pret` | Alerte de succès, ligne du fichier avec « Télécharger », « Modifier les réglages », « Terminé » |
| L16-04 | SCORM, erreur | `scorm-erreur` | Alerte d'erreur avec la cause, « Réessayer » et un lien vers l'étape en cause |
| L16-05 | Intranet, iframe | `intranet` | Format, adresse de l'intranet, réglages, aperçu, alerte sur les sites autorisés, code |
| L16-06 | Intranet, bouton + pop-up | `intranet-popup` | Mêmes blocs, avec les réglages du bouton |
| L16-07 | E-mail | `mail` | Destinataires, objet et message préremplis, « Ouvrir dans ma messagerie » (mailto) |
| L16-08 | Où elle est diffusée | `diffusions` | Liste des diffusions connues, avec leur état |
| L16-09 | Démo non publiée | `non-publiee` | État vide « Publiez la démo pour la diffuser », onglets désactivés |

## 3. SCORM (L16-01)

- **Introduction** : « Un fichier .zip à importer dans votre plateforme de formation (LMS), par exemple Moodle ou Chamilo. Le paquet contient la version publiée et fonctionne sans connexion à TutoClick. »
- **Change** : un seul type de paquet, le paquet complet, figé sur la version publiée. Le paquet « léger », qui charge la démo en ligne, est abandonné. Il dépendait d'un accès Internet et de l'option des statistiques.
- **Version SCORM** : sélecteur à deux choix, « SCORM 1.2 » (par défaut) ou « SCORM 2004 » (4e édition). Aide : « 1.2 est accepté par presque tous les LMS. Choisissez 2004 si votre LMS le demande. »
- **Critère de réussite** : boutons radio (`fieldset` avec `legend`).
  - **Toutes les étapes vues** (par défaut). Aide : « Le LMS reçoit « terminé » à la dernière étape. »
  - **Quiz réussi, score d'au moins [70] %**. Le champ du score (de 1 à 100) n'est actif que si cette option est choisie. Aide : « Le LMS reçoit « réussi » ou « échoué » et le score. »
  - Si la démo n'a pas de quiz, la deuxième option est désactivée, avec l'aide : « Ajoutez un quiz dans l'éditeur pour utiliser ce critère. »
- **Ce que reçoit le LMS** : vrai tableau (`caption` masquée, `th scope`). Il dépend du critère choisi :

  | Donnée | « Toutes les étapes vues » | « Quiz réussi » |
  |---|---|---|
  | Statut | Terminé à la dernière étape vue | Réussi ou échoué selon le score minimum |
  | Score | (ligne absente) | Meilleur score du quiz, de 0 à 100 |
  | Reprise | Dernière étape vue | idem |
  | Temps passé | Durée de chaque session | idem |

  Correspondance technique, dans la documentation et pas dans l'écran :
  - SCORM 1.2 : `cmi.core.lesson_status`, `cmi.core.score.raw`, `cmi.suspend_data`, `cmi.core.session_time` ;
  - SCORM 2004 : `cmi.completion_status`, `cmi.success_status`, `cmi.score.scaled`, `cmi.suspend_data`, `cmi.session_time`.
- **Envoyer aussi les statistiques à TutoClick** : interrupteur **désactivé par défaut**.
  - **Change** : F6 l'activait par défaut.
  - Aide : « Désactivé par défaut. Activé, le paquet transmet la progression au suivi des apprenants. Le LMS doit alors pouvoir joindre demos.tutoclick.example, et chaque apprenant est identifié par un code chiffré tiré de son identifiant LMS. »
  - Le code est un hachage de l'identifiant LMS (`student_id`) salé par workspace. TutoClick ne reçoit aucun nom ni e-mail.
  - Désactivé, le paquet ne fait **aucun appel réseau**.
- **Pied** : « Annuler » et « Générer le paquet » (icône `package`).

## 4. Génération : en cours, prêt, erreur (L16-02 à 04)

- **En cours (L16-02)** :
  - bloc `role="status"` en tête : indicateur de chargement, « Génération du paquet… » et l'avancement réel (« Captures 12 sur 18 ») ;
  - `progressbar` avec `aria-valuenow` ;
  - les réglages sont verrouillés (`fieldset disabled`) ;
  - pied : « Annuler la génération » et un bouton principal « Génération… » en `aria-disabled` ;
  - texte : « Vous pouvez fermer cette fenêtre : le paquet restera disponible dans la liste des exports. » À la fermeture, la génération continue et un toast annonce « Paquet SCORM prêt » avec le lien « Télécharger » ;
  - pas de pourcentage ni de durée estimée inventés : seul le nombre de captures traitées s'affiche.
- **Prêt (L16-03)** :
  - alerte de succès (`role="status"`) : « Paquet prêt. Déposez-le dans votre LMS comme une nouvelle activité SCORM. » ;
  - ligne du fichier :
    - nom `{{slug}}-scorm12.zip` ou `-scorm2004.zip` en police mono ;
    - dessous : poids réel, version SCORM, version publiée, critère de réussite ;
    - bouton principal « Télécharger » ;
  - pied : « Modifier les réglages » (retour à L16-01) et « Terminé » ;
  - si l'on change un réglage, la ligne du fichier disparaît et le bouton « Générer le paquet » revient : le fichier ne correspond plus aux réglages.
- **Erreur (L16-04)** : alerte `role="alert"`.
  - Titre : « Le paquet n'a pas pu être généré. »
  - Cause et action, selon le cas :
    - capture illisible : « La capture de l'étape {{n}} est illisible. Remplacez-la dans l'éditeur, puis relancez la génération. », avec le lien « Ouvrir l'étape {{n}} » ;
    - taille dépassée (au-delà de 500 Mo) : « Le paquet dépasse 500 Mo. Réduisez le nombre d'étapes ou la taille des captures. » ;
    - erreur serveur ou réseau : « Une erreur est survenue. Réessayez dans quelques instants. »
  - Boutons : « Réessayer » dans l'alerte et dans le pied. Les réglages restent modifiables.

## 5. Intranet (L16-05, L16-06)

- **Format** : sélecteur à deux choix, « Dans la page (iframe) » (par défaut) ou « Bouton + pop-up ».
- **Adresse de l'intranet** (facultative, en police mono) : un domaine sans `https://`. Elle sert à vérifier les sites autorisés (A1).
  - Si le domaine n'est pas autorisé : alerte warning « {{domaine}} n'est pas dans les sites autorisés : la démo ne s'y affichera pas. », avec un bouton « L'ajouter ». Le domaine est ajouté en un clic, un toast le confirme et l'alerte disparaît.
  - Si l'accès de la démo est « Tout le monde » sans liste de sites, pas d'alerte.
- **Réglages de l'iframe** :
  - « Démarrer au clic » : interrupteur, activé par défaut. Il affiche une couverture et un bouton « Lancer la démo » ;
  - « Taille » : « S'adapte à la largeur » (ratio 16:10) ou « Taille fixe ». Avec « Taille fixe », deux champs Largeur et Hauteur apparaissent, en px.
- **Réglages du bouton + pop-up** :
  - « Texte du bouton » : 40 caractères au plus, « Lancer le tutoriel » par défaut ;
  - « Position » : « Dans le texte de la page » ou « Flottant, en bas à droite ».
- **Aperçu** :
  - page d'intranet fictive (barre d'adresse avec le domaine saisi, ou `intranet.example` à défaut) ;
  - il montre l'iframe avec sa couverture, ou le bouton et la pop-up ouverte ;
  - il se met à jour en direct. C'est une image (`role="img"`, nom « Aperçu sur une page d'intranet fictive »), pas une démo jouable.
- **Code à coller** : bloc `pre` avec retour à la ligne et coloration, et le bouton « Copier » (nom accessible « Copier le code d'intégration », toast « Code copié »).
  - Iframe : `src` vers `/e/{{slug}}`, `title="Démo : {{titre}}"`, `loading="lazy"`, `allow="fullscreen"`, `aspect-ratio:16/10`.
  - Pop-up : un `button` avec `data-tutoclick="{{slug}}"`, et le script `popup.js` en `defer`.
- **Aide** sous le code : « SharePoint : composant « Incorporer ». Wiki ou CMS : bloc HTML. Si l'intranet refuse les scripts, utilisez le format iframe. »
- **Pied** : « Fermer ».

## 6. E-mail (L16-07)

- **Change** : F6 proposait de copier le texte. Le bouton principal ouvre maintenant la messagerie par un lien `mailto:` prérempli.
- **Introduction** : « Ouvre votre messagerie avec un message prêt à envoyer. TutoClick n'envoie aucun e-mail. »
- **Champs** :
  - **Destinataires** (facultatif) : adresses séparées par des virgules. Aide : « Séparez les adresses par des virgules. Vous pouvez aussi les ajouter dans votre messagerie. » Une adresse mal formée est signalée à la sortie du champ, avec `aria-invalid` et le message « Adresse invalide : {{valeur}} » ;
  - **Objet** : prérempli « Tutoriel : {{titre}} » ;
  - **Message** : prérempli, modifiable. Il contient le lien direct `/d/{{slug}}`, sans durée ni nombre de questions inventés. Sous le champ, un compteur « n / 1 500 caractères » (`aria-describedby`).
- **Limite** : au-delà de 1 500 caractères, le lien mailto risque d'être tronqué par certaines messageries.
  - Le compteur passe en erreur.
  - « Ouvrir dans ma messagerie » est désactivé, avec l'aide : « Message trop long pour un lien mailto. Copiez le texte. »
  - « Copier le texte » reste disponible.
- **Lien `mailto:`** : `mailto:{{destinataires}}?subject={{objet}}&body={{message}}`, chaque partie encodée avec `encodeURIComponent`, en texte brut.
- **Pied** : « Copier le texte » (toast « Texte copié ») et « Ouvrir dans ma messagerie » (bouton principal, icône `mail`). C'est un vrai lien `<a href="mailto:…">`, pas un bouton.
- Aucun envoi, aucune adresse enregistrée : les destinataires saisis ne sont pas sauvegardés.

## 7. Où elle est diffusée (L16-08)

- Liste, une ligne par diffusion connue : icône, nom, détail, état et action éventuelle.
  - **Lien direct** : adresse en mono, nombre de vues. « Actif » si le lien est accessible, « Désactivé » si l'accès est fermé.
  - **Centre de formation** : nom de la formation. Une ligne par formation.
  - **Intranet** : domaine détecté (référent des chargements de l'iframe ou de la pop-up), nombre de vues, date de la dernière vue. Les domaines vus sans être déclarés apparaissent aussi.
  - **LMS · SCORM 1.2 ou 2004** : date de génération, auteur, version publiée embarquée.
    - Si une publication plus récente existe : badge warning « Version ancienne » et bouton « Générer la version {{n}} », qui ouvre l'onglet SCORM avec les mêmes réglages.
    - Sinon : badge « À jour ».
    - Une ligne par paquet généré. Les 5 derniers sont gardés.
- **Compteur de l'onglet** : nombre de lignes.
- **Note** : « Un paquet SCORM est une copie : après chaque publication, générez-le à nouveau et remplacez-le dans le LMS. Les envois par e-mail ne sont pas suivis ici : ils partent de votre messagerie. »
- **Vide** : « Cette démo n'est encore diffusée nulle part. Choisissez un canal dans les onglets SCORM, Intranet ou E-mail. »
- Les nombres de vues sont réels. Si une donnée est absente, elle est omise (pas de « 0 vue » inventé pour un paquet SCORM : sans l'option des statistiques, TutoClick ne sait rien).

## 8. Démo non publiée (L16-09) et modifications non publiées

- **Jamais publiée** :
  - sous-titre « Brouillon · jamais publiée » ;
  - les onglets SCORM, Intranet et E-mail sont visibles mais en `aria-disabled` ;
  - le contenu est remplacé par un état vide (`role="status"`) :
    - titre « Publiez la démo pour la diffuser » ;
    - texte « Le paquet SCORM, le code pour l'intranet et le lien de l'e-mail utilisent la version publiée. Cette démo n'a pas encore été publiée. » ;
    - boutons « Ouvrir dans l'éditeur » et « Publier la démo » (le second seulement pour qui a le droit de publier) ;
  - après la publication, la modale passe sur l'onglet SCORM, avec le toast « Démo publiée · version 1 ».
- **Publiée avec des modifications non publiées** (badge « Modifiée ») : les onglets restent actifs. Une alerte info s'affiche en tête de chaque onglet : « Des modifications ne sont pas encore publiées : la diffusion utilise la version {{n}}. », avec le lien « Publier ».
- **Démo archivée** : l'entrée « Diffuser » est absente.

## 9. Accessibilité

- Modale : `role="dialog"`, nommée par le titre. Focus sur l'onglet actif à l'ouverture, piège du focus, Échap pour fermer (sauf pendant une génération lancée : la fermeture la laisse continuer), retour du focus sur le déclencheur.
- Onglets : flèches gauche et droite. Les onglets désactivés gardent le focus mais ne s'activent pas.
- Choix exclusifs (version, format, critère) : `radiogroup` ou boutons radio, avec un nom.
- Progression : `role="status"` et `progressbar`. Succès en `status`, erreur en `alert`.
- « Copier » annonce le résultat dans le toast (`aria-live`).
- Aperçu de l'intranet : `role="img"` et un nom. Il n'est jamais seul porteur de l'information.

## 10. Hors périmètre

- xAPI, cmi5, LTI.
- Envoi d'e-mails par TutoClick (non arbitré).
- Dépôt automatique dans un LMS (API Moodle, etc.).
- Statistiques SCORM sans l'option activée.
