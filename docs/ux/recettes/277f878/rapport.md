# Recette 277f878 (L63 fond) : VERT

Recette réelle du 25/11, données fictives.

## 1. Côté extension

**Montage** : l'extension est construite et chargée dans Chromium, contre le faux serveur de l'extension (`apps/extension/e2e/mock-supabase.cjs`). La capture se fait en mode Captures, sur une page piège de 8 éléments (`banc-pieges.png`). Les titres sont lus dans ce que l'extension envoie réellement au serveur.

| Élément cliqué | Libellé capturé | Attendu |
|---|---|---|
| Bouton aux textes collés « Generate speech » + « Text to Speech » + « Open » | Cliquez ici | Pas de texte collé : OK |
| Bouton icône avec `aria-label="Rechercher"` | Cliquez sur « Rechercher » | Libellé accessible d'abord : OK |
| Champ avec texte indicatif | Cliquez sur « Rechercher un contact » | OK |
| Lien sur deux lignes (« Paramètres du compte » / « Avancé · sécurité ») | Cliquez sur « Paramètres du compte » | Première ligne : OK |
| Bloc cliquable sans texte | Cliquez ici | OK |
| `div role="button"` « Exporter » | Cliquez sur « Exporter » | OK |
| Section avec en-têtes collés et un titre h3 | Cliquez sur « Liste des projets » | Titre de la section : OK |
| Bouton icône sans nom | Cliquez ici | OK |

Aucun sélecteur (`div:has(…)`) ni texte collé ne ressort.

## 2. Côté app

**Montage** : l'app tourne contre le faux Supabase. La démo est préparée avec :
- un titre d'étape `div:has(> #search-input) > button.btn-primary` ;
- un titre de bulle « Generate speechText to SpeechOpen » ;
- une étape vidéo de 29 pauses.

Le test a été passé en clair et en sombre. Il n'est pas commité (fichier local `_r277.e2e.cjs`).

**Résultats** :
- **Sans IA**, à l'ouverture de Suggestions : les 2 titres techniques sont signalés, avec « Titre technique issu de la capture… ». Rien n'est envoyé au fournisseur (`app-titres-techniques.png`).
- **Analyser la démo** envoie 66 textes, dont :
  - les 58 textes de la vidéo (29 titres et 29 textes de pause) ;
  - le texte de l'étape ;
  - les deux titres techniques.
- **Appliquer** sur une pause (p7) ne change que celle-ci. Les 29 pauses sont gardées et p8 est intacte.

## 3. Améliorations (non bloquantes)

1. **Les deux signalements sont identiques** sous « Étape 1 ». On ne sait pas lequel vise le titre de l'étape et lequel vise la bulle. Il faudrait citer le champ et le début du texte, par exemple : « Titre de la bulle : “Generate speechText…” ».
2. **Bouton à plusieurs `span` en ligne** : il donne « Cliquez ici ». Il serait mieux de prendre le premier morceau de texte de l'élément (« Generate speech ») quand le texte entier est collé.
3. **Limite de 100 textes** : une vidéo de 50 pauses (le maximum) remplit à elle seule les 100 textes, et les étapes suivantes ne sont pas analysées. Il faudrait le dire dans le panneau (« Analyse limitée aux 100 premiers textes »), ou envoyer en plusieurs fois.
4. **Hors 277f878, vu pendant la recette** : l'écran « Vérifier les données avant l'envoi » détecte un « Nom » à floute sur chacune des 8 captures, alors que la page ne contient aucune donnée personnelle. C'est un faux positif probable, à cause des en-têtes collés « NomStatutActions » (`verification-avant-envoi.png`). À ajouter au banc de la détection F1.
