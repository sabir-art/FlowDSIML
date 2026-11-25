# Recette réelle L60, lot A (628e87d, avec 1e0f804) : ROUGE

Recette du 25/11, faite à la place de l'utilisateur :
- extension construite (`WXT_E2E=1`) et chargée dans Chromium ;
- faux Supabase de l'extension ;
- banc du dev (`e2e/banc`, :54410) ;
- plus ma page piège (`page-piege.png`) : textes collés, en-têtes de tableau « Nom · Statut · Actions », « Ville : Lyon » seule, avis signé « Camille D. ».

## 1. Banc du dev, rejoué avec l'extension chargée

| Parcours | Résultat | Mon avis |
|---|---|---|
| Application à page unique | 3 écrans sur 3 : « Accueil », « Clients », « Atelier Durand » | conforme : noms d'écran justes (`banc-spa-page3.png`) |
| Formulaire envoyé | 2 sur 2 : « Demande de contact », « Demande envoyée » | conforme : « Envoyer la demande » n'est plus flouté (`banc-formulaire-page1.png`) |
| Scripts de tiers | 2 sur 2 | conforme (le chat du tiers reste un décor : Sandbox v2) |
| Onglets chargés en différé | 3 sur 3 : « Fiche produit · Résumé / Tarifs / Avis » | conforme : chaque onglet est copié seul (`banc-onglets-page2.png`) |
| Menu au survol | 3 sur 3 | conforme |
| Données personnelles | nom et e-mail remplacés ; « Modifier la fiche » et le lien restent lisibles | conforme (`banc-donnees-page1.png`) |
| Mode captures d'écran (`etat-captures`) | nom et e-mail repérés, bouton et lien non repérés | conforme |

## 2. Mes propres parcours

**Mode Captures d'écran** : 8 clics sur la page piège.
- Les libellés sont justes et sans texte technique.
- **ROUGE** : il y a toujours **8 détections « Nom · S••••• » sur 8 captures** (`captures-faux-positif-nom.png`). Le « S••••• » est le mot « Statut », pris pour la valeur du libellé « Nom » qui le précède. La page ne contient aucune donnée personnelle.

**Mode HTML** : capture de la même page.
- **ROUGE** : 2 remplacements, et les deux sont faux (`html-verification.png`) :
  - « Nom · S••••• » : là encore « Statut », l'en-tête de colonne qui suit « Nom » ;
  - « Adresse · L••• » : « Lyon », une **ville seule**. La décision produit du 25/11 est qu'une ville seule reste lisible.
- « Avis : « Très bon outil », Camille D. » n'est pas remplacé. Je l'accepte : prénom et initiale dans un avis, sans autre donnée. À confirmer avec la règle F1.

## 3. Ouverture dans le lecteur

Les copies ne s'ouvrent pas encore dans l'app ni dans le lecteur : c'est le lot B du plan du dev. J'ai jugé leur fidélité sur la relecture sans script (identique au rendu du lecteur) :
- styles, couleurs, police et logo sont conformes sur les 6 parcours ;
- aucun script copié ;
- les valeurs remplacées apparaissent floutées dans la copie (`banc-donnees-page1.png`, `banc-spa-page3.png`).

La recette du lot B ouvrira chaque démo dans l'éditeur et dans le lecteur.

## 4. À corriger pour passer au VERT

1. **En-têtes et libellés en série ne sont jamais des valeurs.**
   - Une cellule `th`, ou un élément dont le voisin est lui aussi un libellé court sans valeur (« Nom », « Statut », « Actions »), n'est pas un couple libellé/valeur.
   - Une valeur de « Nom » doit ressembler à un nom de personne (prénom et nom, initiales). Un mot de l'interface comme « Statut » n'en est pas un.
   - C'est à corriger dans les deux modes (captures d'écran et HTML).
2. **Ville seule lisible.**
   - Un champ « Ville » ou une ville isolée n'est plus remplacé.
   - Une adresse complète (numéro et rue, code postal avec ville) l'est toujours.
3. **Banc** : ajouter ma page piège (en-têtes « Nom / Statut / Actions », « Ville : Lyon », « NomStatutActions » collés), avec l'attendu « 0 détection », dans les deux modes.

Tout le reste du lot A est conforme : onglets, noms d'écran, boutons non floutés, données fictives remplacées.
