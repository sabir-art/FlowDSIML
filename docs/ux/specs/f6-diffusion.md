# Spec F6 : diffusion (site ou pop-up, intranet, LMS, e-mail)

> Mettre un module là où sont les apprenants. La page « Diffuser » rassemble tous les canaux de diffusion. Le partage avancé d'A1 (lien, accès, intégration iframe ou pop-up, page publique) reste la base ; F6 ajoute l'intranet, le LMS et l'e-mail, plus une vue « Où ce module est diffusé ».
>
> Maquette : `docs/ux/maquettes/refonte/f6-diffusion.html` (`?view=lms|intranet|mail`, `&theme=dark`).
> Microcopie FR/EN (55 clés) : `share.distribute.*`.

## 1. Page « Diffuser »

- On y accède depuis l'éditeur (« Partager » devient « Diffuser » dans la phase Formation ; l'URL `/share` est conservée) et depuis le menu d'un module.
- Mise en page : 2 colonnes (une seule sous 1 100 px).
  - **Gauche** : 4 cartes de canal (`aria-pressed`, avec icône, titre et usage), puis le panneau du canal choisi.
  - **Droite** : la carte « Où ce module est diffusé ».
- **Canaux** :

  | Canal | Panneau |
  |---|---|
  | **Site ou pop-up** | Renvoie à l'onglet Intégrer d'A1 §5, sans changement |
  | **Intranet** | §2 |
  | **LMS** | §3 |
  | **E-mail** | §4 |

- **« Où ce module est diffusé »** :
  - une ligne par diffusion connue : centre de formation, domaines intranet ayant chargé l'iframe (avec le nombre de vues), paquets SCORM exportés (date et version) ;
  - badge « Actif » (vert) ou « Version ancienne » (neutre) quand un paquet complet a été exporté avant la dernière publication.

## 2. Intranet

- Select « Outil de l'intranet » : SharePoint (composant « Incorporer »), Wiki ou CMS (HTML), Lien texte seulement. Le code et les instructions s'adaptent au choix.
- **Code iframe** :
  - `title` explicite (« Tutoriel : {{titre}} »), `aspect-ratio: 16/10`, `allowfullscreen` ;
  - bloc de code sombre avec « Copier » ; le slug est surligné.
- **Instructions** numérotées, 3 étapes au maximum.
- **Vérification** : si le domaine de l'intranet indiqué n'est pas dans les « Sites autorisés » d'A1, on affiche une alerte warning avec le domaine en gras et un lien « L'ajouter », qui l'ajoute en un clic avec un toast.
- **Suivi** : avec l'accès « Domaine e-mail », l'apprenant connecté avec son adresse professionnelle est reconnu (SSO dans la vague B ; sinon, un lien magique une seule fois par navigateur).

## 3. LMS (SCORM)

- **Version** : SCORM 1.2 (par défaut, le plus compatible) ou SCORM 2004 (4e édition).
- **Type de paquet** :
  - **Léger** (par défaut, environ 40 Ko) : un `index.html` qui charge le player en ligne, donc toujours la **dernière version publiée**. Il faut un accès Internet depuis le LMS ;
  - **Complet** : player et captures inclus (comme l'export hors ligne d'A3), figé sur la version publiée.
- **Tableau « Ce que reçoit le LMS »**. Il est lisible par un non-technicien, avec les termes SCORM entre guillemets :

  | Donnée | SCORM 1.2 | SCORM 2004 |
  |---|---|---|
  | Statut | `cmi.core.lesson_status` : `completed`, `passed` ou `failed` | `cmi.completion_status` + `cmi.success_status` |
  | Score | `cmi.core.score.raw` (min 0, max 100) | `cmi.score.scaled` |
  | Reprise | `cmi.suspend_data` (étape) | idem |
  | Temps passé | `cmi.core.session_time` | `cmi.session_time` |

  Sans quiz, le LMS reçoit seulement `completed` (`noQuiz`).
- **Interrupteur « Aussi enregistrer les résultats dans le suivi Tutoclic »** (activé par défaut) : le paquet envoie aussi les événements à Tutoclic, et l'apprenant est identifié par l'identifiant fourni par le LMS (`cmi.core.student_id`), haché.
- **Téléchargement** : nom de fichier `{{slug}}-scorm12.zip` ou `-scorm2004.zip`, avec le poids. Le paquet est listé dans « Exports récents » (A3 §5).
- **Pas de xAPI ni de LTI** dans cette version. Ce sont des évolutions possibles (à noter dans la matrice, vague A+).

## 4. E-mail

- Aperçu d'un e-mail prêt à copier : objet, texte, bouton « Commencer le tutoriel » (le lien), mention du quiz. Le texte reprend le titre et la durée.
- Boutons :
  - « Copier le texte » : copie en HTML et en texte brut, toast « Texte copié » ;
  - « Joindre le mode d'emploi (PDF) » : lance l'export F5.
- Tutoclic **n'envoie aucun e-mail** depuis ce panneau (`intro`). Les invitations restent dans Accès (A1).

## 5. Accessibilité

- Cartes de canal : `aria-pressed`, avec l'usage en `aria-describedby`.
- Blocs de code : `pre` avec un bouton « Copier » nommé (« Copier le code d'intégration »), qui annonce « Copié » en `aria-live`. Le code ne passe jamais sous le bouton (espace réservé à droite).
- Le tableau SCORM est un vrai `<table>` avec des en-têtes.
- L'iframe générée a toujours un `title`.

## 6. Recette prévue

- **SCORM** : import des paquets 1.2 et 2004, léger et complet, dans Moodle (instance de test locale) et dans SCORM Cloud (validation). Vérifier :
  - le statut, le score et la reprise ;
  - la remontée dans F3 quand l'option est activée.
- **Intranet** : iframe dans une page HTML de test, avec un domaine autorisé puis non autorisé.
- **E-mail** : collage dans un client de messagerie (HTML et texte brut).
- Contrôles communs : 1 440, 1 024 et 390 px, en clair et en sombre.
