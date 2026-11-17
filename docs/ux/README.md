# Design FlowDSIML (`docs/ux/`)

Propriété : Lead UX. Référence pour le développement.

| Fichier | Contenu |
|---|---|
| [analyse-guideflow.md](analyse-guideflow.md) | Phase 1 : analyse fonctionnelle (personas, inventaire, parcours, sitemap, tarifs) |
| [identite-visuelle.md](identite-visuelle.md) | Identité : logo, palette, typographies, rayons, ombres, mouvement, mode sombre, thème du player |
| [tokens.md](tokens.md) | Guide d'intégration des tokens (`packages/ui/src/tokens.ts` → `tokens.css`), alias shadcn, Tailwind |
| [composants.md](composants.md) | Spécifications des composants et règles d'accessibilité (AA, focus, clavier) |
| [maquettes/index.html](maquettes/index.html) | Maquettes HTML cliquables (12 écrans, clair et sombre, desktop et mobile) |
| [microcopy.md](microcopy.md) | Voix, ton, règles d'écriture, glossaire FR/EN, conventions i18n |
| [i18n/fr.json](i18n/fr.json), [i18n/en.json](i18n/en.json) | Chaînes d'interface prêtes pour i18next |
| [tools/](tools/) | `contrast.py` (contrastes WCAG), `i18n-check.py` (cohérence FR/EN) |

**Voir les maquettes** : ouvrir `docs/ux/maquettes/index.html` dans un navigateur, depuis un clone du dépôt (les tokens sont chargés par chemin relatif), ou via GitHub Pages une fois le site publié.
