# Composants tiers

Ce fichier recense les bibliothèques et les ressources tierces ajoutées pour les exports (lot L15). Toutes ont une licence permissive. Les dépendances déjà présentes avant L15 sont déclarées dans les `package.json` et `pnpm-lock.yaml` du dépôt.

## Exports PDF et GIF (`packages/exports`)

| Composant                                                                                       | Version | Licence                                                      | Usage                                                                      |
| ----------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [PDFKit](https://github.com/foliojs/pdfkit)                                                     | 0.17.2  | MIT                                                          | PDF balisés (démo, attestation) créés dans le navigateur (L35)             |
| [gifenc](https://github.com/mattdesl/gifenc)                                                    | 1.0.3   | MIT                                                          | Encodage des GIF animés dans le navigateur                                 |
| [fflate](https://github.com/101arrowz/fflate)                                                   | 0.8.3   | MIT                                                          | Paquets SCORM (zip) assemblés dans le navigateur (L16)                     |
| [mp4-muxer](https://github.com/Vanilagy/mp4-muxer)                                              | 5.2.2   | MIT                                                          | Vidéos MP4 (H.264, son AAC ou Opus) assemblées dans le navigateur (L25-11) |
| [uqr](https://github.com/unjs/uqr)                                                              | 0.1.2   | MIT                                                          | QR code de la télécommande du mode présentateur, rendu en SVG (L26-10)     |
| [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans) (TTF Regular, Bold, ExtraBold) | 2.071   | SIL Open Font License 1.1 (`packages/exports/fonts/OFL.txt`) | Police embarquée dans les PDF                                              |

### Dépendances de PDFKit

Incluses dans la version autonome de PDFKit (`pdfkit.standalone.js`), chargée seulement à l'export d'un PDF.

| Composant                                                                                      | Version | Licence     |
| ---------------------------------------------------------------------------------------------- | ------- | ----------- |
| fontkit (avec restructure, unicode-properties, unicode-trie, dfa, tiny-inflate, brotli, clone) | 2.0.4   | MIT         |
| linebreak                                                                                      | 1.1.0   | MIT         |
| png-js                                                                                         | 1.1.0   | MIT         |
| jpeg-exif                                                                                      | 1.1.4   | MIT         |
| crypto-js                                                                                      | 4.2.0   | MIT         |
| pako, buffer, events, readable-stream (portages navigateur de Node)                            | —       | MIT et Zlib |

## Vidéo et capture HTML (F7, A8)

| Composant                                                       | Version | Licence | Usage                                                                                      |
| --------------------------------------------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------ |
| [tus-js-client](https://github.com/tus/tus-js-client)           | 4.3.1   | MIT     | Envoi par reprise des vidéos depuis l'extension (F7)                                       |
| [sanitize-html](https://github.com/apostrophecms/sanitize-html) | 2.18.1  | MIT     | Second assainissement des captures HTML côté serveur, fonction `html-ingest` (A8)          |
| [jsdom](https://github.com/jsdom/jsdom)                         | 26.1.0  | MIT     | Tests unitaires du moteur d'opérations et de l'assainissement (`packages/core`, non livré) |

## Outils de test (L24, non livrés)

Ces dépendances de développement servent seulement aux tests automatisés (CI). Elles ne sont ni modifiées ni incluses dans les applications livrées.

| Composant                                                                        | Version | Licence    | Usage                                         |
| -------------------------------------------------------------------------------- | ------- | ---------- | --------------------------------------------- |
| [Playwright](https://github.com/microsoft/playwright)                            | 1.63.0  | Apache-2.0 | Pilotage du navigateur dans les tests e2e     |
| [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm), axe-core 4.14 | 4.14.0  | MPL-2.0    | Audit d'accessibilité automatisé (RGAA, WCAG) |

MPL-2.0 est une licence à copyleft faible, limité aux fichiers de la bibliothèque. Elle ne s'étend pas au code de TutoClick, et l'outil n'est utilisé qu'en test, sans modification.
