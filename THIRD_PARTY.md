# Composants tiers

Ce fichier recense les bibliothèques et les ressources tierces ajoutées pour les exports (lot L15). Toutes ont une licence permissive. Les dépendances déjà présentes avant L15 sont déclarées dans les `package.json` et `pnpm-lock.yaml` du dépôt.

## Exports PDF et GIF (`packages/exports`)

| Composant | Version | Licence | Usage |
|---|---|---|---|
| [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 | MIT | Création des PDF (démo, attestation) dans le navigateur |
| [gifenc](https://github.com/mattdesl/gifenc) | 1.0.3 | MIT | Encodage des GIF animés dans le navigateur |
| [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans) (TTF Regular, Bold, ExtraBold) | 2.071 | SIL Open Font License 1.1 (`packages/exports/fonts/OFL.txt`) | Police embarquée dans les PDF |

### Dépendances de jsPDF

Installées avec jsPDF. Seules `fflate`, `fast-png` et `@babel/runtime` servent au rendu utilisé ici. Les autres sont des dépendances facultatives de jsPDF (rendu HTML et SVG), que TutoClick n'appelle pas : elles restent dans des fichiers séparés, jamais chargés.

| Composant | Version | Licence |
|---|---|---|
| fflate | 0.8.3 | MIT |
| fast-png | 6.4.0 | MIT |
| iobuffer | 5.4.0 | MIT |
| pako | 2.2.0 | MIT et Zlib |
| @babel/runtime | 7.28 | MIT |
| html2canvas | 1.4.1 | MIT |
| css-line-break, text-segmentation, utrie, base64-arraybuffer | — | MIT |
| canvg | 3.0.11 | MIT |
| rgbcolor | 1.0.1 | MIT |
| stackblur-canvas, svg-pathdata, raf, performance-now | — | MIT |
| core-js, regenerator-runtime | — | MIT |
| DOMPurify | 3.4 | MPL-2.0 ou Apache-2.0, au choix (Apache-2.0 retenue) |
