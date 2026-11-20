# L30b : voix de synthèse (065) et sous-titres automatiques (066)

> Suite de L30, avec un second fournisseur : ElevenLabs. Version courte, écrans existants plus deltas, sans maquette.
> Les règles communes de L30 §0 s'appliquent : aperçu avant d'appliquer, mention « Généré par IA, à vérifier », états désactivé, quota atteint, en cours et erreur.
> S'appuie sur L28 §3 (voix off par étape), L21 (étape vidéo, sous-titres `.vtt`) et L28-03 (lecteur : « Activer le son », sous-titres).

## 1. États et codes

| Code | État | Où |
|---|---|---|
| L30-10 | Réglage : voix de synthèse et sous-titres automatiques (activation séparée, quota en secondes) | Paramètres > Assistance IA |
| L30-11 | Voix de synthèse : choix de la voix, avertissement, aperçu, appliquer | Éditeur > Étape > Voix off |
| L30-12 | Sous-titres automatiques : avertissement avant l'envoi de l'audio, aperçu éditable | Éditeur > Étape vidéo > Sous-titres, et Voix off > Transcription |
| L30-13 | Quota de secondes atteint ou fonction désactivée | Entrées 065 et 066 |

## 2. Réglage (L30-10)

- **Emplacement** : dans Paramètres > Assistance IA, les lignes « Voix de synthèse » et « Sous-titres automatiques » perdent le badge « Bientôt ». Elles forment une sous-section « Voix et sous-titres », avec leur propre bandeau. « Images générées » reste en « Bientôt ».
- **Activation séparée** : un autre fournisseur et des données d'une autre nature (l'audio) justifient un consentement à part. Ces deux fonctions restent décochées même si l'Assistance IA est activée.
  - Cocher l'une d'elles ouvre une confirmation dédiée, avec son bandeau et la case « J'ai lu ces informations. ».
- **Bandeau** (`fd-callout`, icône `shield`) :
  > « La voix de synthèse envoie le texte à lire au fournisseur ElevenLabs. Les sous-titres automatiques envoient la piste audio de l'étape (votre voix ou le son de la vidéo) au même fournisseur. Aucune image n'est envoyée. Les fichiers produits sont enregistrés dans votre espace. Rien n'est appliqué sans votre validation. »
  - Chaque phrase doit être vraie dans la configuration réelle. Le dev confirme la conservation et la réutilisation des données avec les conditions du fournisseur, puis complète ou retire la phrase concernée.
- **Quota en secondes** :
  - « Voix de synthèse : {{utilisées}} s sur {{quota}} s ce mois-ci » et « Sous-titres automatiques : {{utilisées}} s sur {{quota}} s ce mois-ci », chacun avec une barre (`role="progressbar"`) ;
  - au-delà de 120 s, l'affichage passe en minutes et secondes (« 4 min 10 s ») ;
  - renouvellement : « Renouvellement le {{date}} ». Si la date n'est pas connue, la ligne est omise ;
  - jamais de chiffre inventé : si le quota n'est pas défini, on affiche seulement le temps utilisé.

## 3. Voix de synthèse, 065 (L30-11)

- **Entrée** : dans la section « Voix off » de l'étape (L28 §3.1), le bouton « Générer à partir du texte » perd « Bientôt ». Il est désactivé selon la règle 4 de L30 si la fonction est coupée.
- **Panneau « Voix de synthèse »** (dans la section, sans modale) :
  1. **Texte à lire** :
     - prérempli avec la transcription de l'étape, sinon avec le texte de la bulle ;
     - modifiable, 1 000 caractères au plus ;
     - les variables sont lues avec leur valeur par défaut, et l'aide le dit : « Les variables sont lues avec leur valeur par défaut ({{company}} → « votre entreprise »). ».
  2. **Voix** :
     - une liste de 6 voix françaises au plus, puis les voix de la langue de la démo si elle est différente ;
     - chaque voix a un nom, une description courte (« Féminine, posée », « Masculine, dynamique ») et un bouton « Écouter un exemple » (icône `play`) ;
     - l'exemple est un extrait fourni par le fournisseur ou enregistré une fois par TutoClick. Il ne consomme pas de quota et n'envoie rien ;
     - la voix choisie est mémorisée pour la démo. Les étapes suivantes la proposent par défaut.
  3. **Vitesse** : « Lente », « Normale » (par défaut) ou « Rapide ».
  4. **Estimation** : « Environ {{n}} s » pour la durée estimée. On ne l'affiche que si elle est calculée à partir du texte ; sinon, on l'omet.
  5. **Bouton** : « Générer la voix ».
- **Avertissement avant le premier envoi de la session** :
  - une ligne au-dessus du bouton : « Le texte ci-dessus sera envoyé à ElevenLabs pour produire l'audio. » ;
  - aucune modale à chaque fois : la confirmation a eu lieu dans le réglage.
- **Aperçu** :
  - mini-lecteur avec la durée réelle ;
  - mention « Généré par IA, à vérifier » ;
  - boutons « Appliquer » et « Ignorer », plus le lien « Générer à nouveau ».
- **Appliquer** :
  - la piste remplace la voix de l'étape s'il y en avait une. Une confirmation s'affiche si une voix enregistrée existe : « Remplacer votre enregistrement par la voix de synthèse ? » ;
  - la transcription reçoit le texte lu ;
  - toast « Voix appliquée. », avec « Annuler » ;
  - la liste des étapes affiche l'icône `audio-lines` avec le repère « IA ».
- **Lecteur** : aucune différence avec une voix enregistrée (L28-03). Les sous-titres sont obligatoires et viennent du texte lu.
- **Hors périmètre** : clonage de voix (jamais), voix sur les étapes vidéo (la piste vidéo garde son son).

## 4. Sous-titres automatiques, 066 (L30-12)

- **Entrées** :
  - étape vidéo (L21) : panneau Sous-titres, « Transcription automatique » perd « Bientôt » ;
  - voix off enregistrée (L28 §3) : sous le champ Transcription, le bouton « Transcrire la voix ».
- **Avertissement avant l'envoi de l'audio**, à chaque demande, parce que l'audio peut contenir des voix ou des noms :
  - une modale « Envoyer l'audio pour transcription ? » ;
  - texte : « La piste audio de cette étape ({{durée}}) sera envoyée à ElevenLabs. Vérifiez qu'elle ne contient pas de nom, de numéro ou d'information sur une personne réelle. » ;
  - case « Ne plus demander pour cette démo », non cochée par défaut ;
  - boutons « Envoyer » et « Annuler ».
- **Aperçu** :
  - la liste éditable des sous-titres, avec début, fin et texte, dans le même composant que « Modifier (n) » de L21 ;
  - la langue détectée ;
  - mention « Généré par IA, à vérifier » ;
  - boutons « Appliquer » et « Ignorer ».
- **Appliquer** :
  - les sous-titres remplacent ceux de l'étape, avec une confirmation si des sous-titres existent déjà ;
  - toast « Sous-titres appliqués. », avec « Annuler » ;
  - pour une voix off, la transcription prend le texte.
- **Glossaire** : les termes du glossaire sont envoyés comme vocabulaire attendu, si le fournisseur le permet.
- **Durée maximale** : 2 min par demande, comme la voix off L28. Au-delà, pour la vidéo : « Vidéo trop longue pour une transcription automatique (2 min au plus). Importez un fichier .vtt. ».

## 5. Quota atteint, fonction désactivée (L30-13)

- **Fonction désactivée** : l'entrée est estompée (`aria-disabled`) avec l'infobulle « Voix de synthèse désactivée dans cet espace. Un administrateur peut l'activer dans Paramètres > Assistance IA. ». Même texte pour « Sous-titres automatiques ».
- **Quota atteint** :
  - « Quota de voix de synthèse atteint pour ce mois ({{quota}} s). Il se renouvelle le {{date}}. » (`role="alert"`), sans envoi ;
  - même texte pour « Quota de sous-titres automatiques » ;
  - bouton « Fermer ».
- **Demande plus longue que le reste du quota** : « Il reste {{n}} s ce mois-ci, la demande en demande environ {{m}}. » Le bouton d'envoi est désactivé.

## 6. Fonctions à venir
- L'onglet IA ne garde que « Images générées » en « Bientôt ».
- Son bandeau reste celui de L30 §11.

## 7. Recette
- Données fictives uniquement. L'audio de test est une voix de synthèse ou un enregistrement sans nom ni donnée personnelle.
- Pour chaque fonction :
  - aperçu, « Appliquer », « Ignorer », Annuler ;
  - remplacement d'une piste existante avec confirmation ;
  - quota atteint et demande trop longue (limite abaissée en développement) ;
  - fonction désactivée.
- Vérifier sur un échantillon que seuls le texte (065) ou la piste audio (066) partent chez le fournisseur.
- Lecteur d'écran :
  - noms des voix et boutons « Écouter un exemple » ;
  - annonce « Proposition prête. » ;
  - navigation dans la liste des sous-titres.
- Contrôles : 1 440, 1 024 et 390 px, en clair et en sombre.
