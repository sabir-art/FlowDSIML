# F1 : données sensibles dans l'extension (implémentation)

Spec UX : `docs/ux/specs/f1-formation.md` §1 (branche de la Lead UX).

## Flux

1. **Capture** : chaque clic prend une capture PNG. Elle est gardée **dans le navigateur** (IndexedDB `fd-pending`), avec les détections de la page. Rien n'est envoyé, et la démo n'est pas encore créée.
2. **Fin** : l'extension ouvre `review.html`, l'écran « Vérifier les données avant l'envoi ».
   - Toutes les détections sont cochées par défaut. On les décoche une par une ; « Tout flouter » existe, mais pas « tout décocher ».
   - On peut tracer une zone à la main en glissant sur la capture.
3. **« Flouter et envoyer »** :
   - les zones cochées sont **incrustées dans les pixels** (mosaïque, puis flou gaussien) avant l'encodage WebP ;
   - la démo, les étapes et les hotspots sont créés, puis l'éditeur s'ouvre ;
   - l'original non flouté n'est jamais envoyé, et le tampon local est vidé.
4. **Annuler** : le tampon local est effacé. Rien n'a été envoyé.

## Détection (`lib/pii.ts`, `lib/scan.ts`)

- Elle se fait côté client, sur le texte du DOM (boîtes via `Range.getClientRects`), sans OCR.
- **Motifs** :
  - e-mail ;
  - téléphone FR ;
  - NIR (13 chiffres + clé) ;
  - IBAN ;
  - adresse (numéro + voie, ou code postal + ville) ;
  - date de naissance, seulement près de « naissance » ou « né(e) le » : une date de rendez-vous n'est pas signalée ;
  - Prénom + NOM.
- **Libellés** :
  - `autocomplete`, `aria-label`, `<label>`, `placeholder`, `name` des champs ;
  - en-tête de colonne, `<dt>`, libellé voisin (court, sans chiffre ni `@`), « Libellé : valeur ».
  - Types reconnus : nom, NIR, naissance, IBAN, e-mail, téléphone, adresse, identifiant.
- **Zones imposées** (type « Zone masquée ») : mots de passe, champs de carte bancaire, `[data-fd-blur]`.

## Ce qui sort du navigateur

- L'image WebP **déjà floutée**.
- `steps.element_meta.pii` : une entrée par détection, avec seulement `{ type, rect, blurred, manual }`. Ni texte, ni extrait. Le bilan RGPD (§2) s'en servira.
- L'extrait masqué (`06 •• •• •• ••`) ne sert qu'à l'écran local.

## Tests

- **Unitaires** : `lib/pii.test.ts` (motifs, libellés, masquage) et `lib/burn.test.ts`.
- **e2e** : `apps/extension/e2e/capture.e2e.cjs` (26 vérifications), sur une fiche fictive :
  - chaque type est détecté ;
  - un rendez-vous n'est pas pris pour une date de naissance ;
  - rien n'est envoyé avant validation ;
  - un faux positif peut être décoché ;
  - aucune valeur détectée ne circule sur le réseau ;
  - les métadonnées ne contiennent ni texte ni extrait ;
  - l'annulation n'envoie rien.
- **Capture d'écran** : `docs/tech/captures/f1/f1-verification-flous.png`.

## Correctif au passage

Le badge « REC » pouvait apparaître sur la capture. Le content script attend maintenant deux images d'affichage avant d'envoyer le clic, et le service worker ne répond qu'une fois la capture faite.
