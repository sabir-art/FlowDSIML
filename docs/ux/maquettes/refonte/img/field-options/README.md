# Focus et validation des champs : benchmark et 4 options (21/11)

> Le client n'a pas validé la première version de FIELD-01. Il l'a trouvée trop lourde (trait de 2 px plus un halo, qui donnent l'impression d'un double contour), trop proche de l'état d'erreur, et il a jugé que les contours décalés des boutons alourdissaient l'interface.
>
> **FIELD-01 est en pause chez le dev** jusqu'au choix du client.
>
> Captures à 1440 px, une par option et par thème : `option-{a,b,c,d}-{clair,sombre}.png`. Sources HTML : `src/option-*.html`.
>
> Les options A et B ajoutent une **variante teintée** (§2 bis), à la demande du client.
>
> Chaque option montre :
> - la modale « Inviter des membres » (MODAL-01), avec un champ au focus et un champ en erreur ;
> - les 8 états d'un champ ;
> - le Select au focus ;
> - le focus clavier sur un bouton primaire, un bouton secondaire et un lien.

## 1. Benchmark (sources lues le 21/11/2026)

| Système | Bordure : repos, puis focus | Halo | Souris ou clavier | Erreur | Focus des boutons |
|---|---|---|---|---|---|
| shadcn/ui | 1 px `input`, puis `ring` | 3 px extérieur, à 50 % | `focus-visible` | bordure `destructive` + anneau à 20 % (40 % en sombre), pas d'icône | mêmes classes (anneau de 3 px à 50 %) |
| Radix Themes | ombre interne de 1 px `gray-a7`, puis outline de 2 px en accent, décalage de -1 px | aucun (le trait est sur le bord) | `:focus` (par `:has`) | pas d'état invalide dans le CSS | `focus-visible`, 2 px, décalage de 2 px |
| GitHub Primer | 1 px `#d1d9e0`, puis bordure et outline de 2 px `#0969da`, décalage de -1 px | aucun | `:focus-within` | bordure `#cf222e`, outline rouge au focus, message sous le champ avec icône `AlertFill` | `focus-visible`, 2 px, décalage de -2 px (anneau intérieur pour le primaire) |
| Atlassian | 1 px `#8c8f97`, puis `#4688ec` et une ombre interne de 1 px (environ 2 px) | aucun | `:focus` | `#e2483d` + ombre interne | `focus-visible`, 2 px, décalage de 2 px |
| Stripe Elements | variables `inputFocusColorBorder` et `focusBoxShadow` (valeurs par défaut non publiées) | `focusBoxShadow` | `.Input:focus` | `.Input--invalid`, exemple : ombre de 2 px `colorDanger` | non vérifié |
| DSFR | trait bas interne de 2 px, puis outline de 2 px `#0a76f6`, décalage de 2 px | aucun | `:focus`, retiré par `:focus:not(:focus-visible)` | trait bas `#ce0500` + barre gauche sur le groupe + message avec icône | même outline (règle globale) |
| GOV.UK | 2 px `#0b0c0c`, puis outline de 3 px `#ffdd00` et ombre interne noire | jaune, collé | `:focus` | bordure rouge `#ca3535`, barre gauche de 5 px sur le groupe, préfixe masqué « Error: » | fond jaune, texte noir |
| Vercel Geist, Linear | valeurs non publiées : **non vérifié** | | | | |

**Sources** :
- shadcn/ui : `raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui/input.tsx` et `button.tsx`.
- Radix Themes : `raw.githubusercontent.com/radix-ui/themes/main/packages/radix-ui-themes/src/components/text-field.css`.
- GitHub Primer : `raw.githubusercontent.com/primer/react/main/packages/react/src/internal/components/TextInputWrapper.module.css` et `packages/postcss-preset-primer/src/mixins/focusOutline.css`.
- Atlassian : `unpkg.com/@atlaskit/textfield/dist/es2019/text-field.compiled.css` et `@atlaskit/focus-ring`.
- Stripe : `docs.stripe.com/elements/appearance-api`.
- DSFR : `unpkg.com/@gouvfr/dsfr/dist/component/input/input.css` et `form.css`.
- GOV.UK : `design-system.service.gov.uk/get-started/focus-states/`, `…/components/error-message/` et `govuk-frontend/src/govuk/helpers/_focused.scss`.
- Vercel Geist : `vercel.com/geist/input`.

**Ce qu'on en retient** :
1. **Le focus est dessiné sur le bord du champ lui-même**, en 1 ou 2 px (Radix, Primer, Atlassian). Seul shadcn ajoute un halo extérieur translucide. Les systèmes publics (DSFR, GOV.UK) utilisent un contour épais et très contrasté.
2. **Boutons et liens : focus au clavier seulement** (`focus-visible`), partout. Primer et Radix (variantes soft et ghost) dessinent le contour **à l'intérieur** du bouton : il est collé, et il n'alourdit pas.
3. **L'erreur utilise un rouge nettement distinct de la couleur de marque**, avec un message sous le champ. Les systèmes accessibles y ajoutent une icône (Primer, DSFR) ou un préfixe lu par les lecteurs d'écran (GOV.UK).
4. Notre `--fd-color-danger` actuel (#D60B52, teinte à 339°) n'est qu'à **8°** de la prune (#A3195B, 331°), d'où la confusion. Dans toutes les options, l'erreur passe à un **rouge franc** :
   - #C42B1C en clair (5,7:1 sur blanc), à 34° de la prune ;
   - #F97066 en sombre (6,3:1 sur #15191F) ;
   - avec l'icône `CircleAlert` devant le message.

## 2. Les 4 options

Contraste de l'indicateur de focus (1.4.11) mesuré contre le fond, puis contre la bordure au repos. Au repos, la bordure vaut #8A94A2 en clair et #5E6978 en sombre.

| Option | Focus d'un champ (souris et clavier) | Focus clavier d'un bouton | Indicateur en clair | Indicateur en sombre | Impression |
|---|---|---|---|---|---|
| **A · Anneau neutre** (type shadcn) | bordure gris foncé + anneau gris de 3 px à 50 % | anneau prune de 3 px à 40 %, collé | 5,6:1 ; 1,8:1 | 8,3:1 ; 2,6:1 | sobre, mais l'anneau gris paraît terne |
| **B · Bordure prune, halo doux** | bordure prune de 1 px + halo prune de 3 px à 12 % | anneau prune de 3 px à 35 %, collé | 7,4:1 ; 2,4:1 | 6,4:1 ; 2,0:1 | le plus léger, et à la marque |
| **C · Trait net** (type Linear et Geist) | bordure encre + 1 px, soit un trait net de 2 px | contour encre de 2 px, décalé de 2 px | 20,0:1 ; 6,5:1 | 16,2:1 ; 5,1:1 | le plus visible, mais plus dur ; sans marque |
| **D · Neutre, marque sur le primaire** | bordure gris foncé + halo gris de 3 px à 25 % | anneau gris de 3 px | 5,6:1 ; 1,8:1 | 8,3:1 ; 2,6:1 | très calme ; le focus sur les boutons se voit peu |

Toutes les options respectent **2.4.7** (focus visible) et **1.4.11** (le trait de focus fait plus de 3:1 contre le fond). Seule C dépasse aussi 3:1 entre l'état de repos et l'état de focus. C'est l'exigence de **2.4.13** (AAA), que le RGAA ne demande pas.

### 2 bis. Variante teintée (demande du client, options A et B)

Dans la capture qu'il a fournie, le client aime le champ rempli **au fond bleu très clair** avec une bordure de couleur au focus. C'est très probablement le style de remplissage automatique de Chrome, gardé tel quel dans l'outil de référence. Plutôt que de neutraliser ce style vers la couleur `surface`, les options **A** et **B** montrent deux états de plus :

- **Rempli par le navigateur, variante teintée** : fond **prune-50** (#FBF0F5 en clair ; #2A1A23 en sombre, soit prune-300 à environ 10 % sur `surface`), avec une bordure prune ;
- **Focus, variante teintée** : le même fond, avec la bordure et le halo de l'option.

| Mesure | Clair | Sombre |
|---|---|---|
| Texte sur le fond teinté | 18,0:1 | 15,1:1 |
| Texte secondaire sur le fond teinté | 6,4:1 | 7,8:1 |
| Bordure prune sur le fond teinté | 6,6:1 | 6,0:1 |

- **Pas de confusion avec l'erreur** : l'erreur garde un fond blanc (`surface`), une bordure **rouge franc** et un message avec icône. On n'utilise jamais de fond rose ou rouge pâle.
- La teinte est très légère (1,11:1 contre le blanc). Elle ne porte donc aucune information à elle seule : c'est un agrément visuel, et l'état reste signalé par la bordure.
- **Recommandation** : si le client la retient, l'appliquer au **remplissage automatique** (`:-webkit-autofill`, avec `box-shadow: inset 0 0 0 1000px var(--fd-color-tint)`), et **pas** au focus ordinaire. Teinter tout champ au focus ferait ressembler chaque formulaire à un formulaire pré-rempli.

## 3. Recommandation UX : option **B**, avec deux ajustements

1. **Champs : B tel quel.** Bordure prune de 1 px, halo prune de 3 px à 12 %, même rayon, aucun second contour, à la souris comme au clavier.
   - C'est le pattern préféré du client, et celui de la majorité des systèmes : le focus est sur le bord du champ.
   - L'indicateur est la **bordure prune** (7,4:1 et 6,4:1 contre le fond), le halo n'est qu'un renfort. La règle est conforme au niveau AA.
2. **Boutons et liens : focus au clavier seulement, contour collé, sans décalage** (pattern de Primer et Radix) :
   - boutons secondaires, ghost, liens et onglets : `outline: 2px solid` prune, `outline-offset: 0` (1 px d'écart pour un lien en texte) ;
   - **bouton primaire prune** : anneau **intérieur** blanc de 2 px (`box-shadow: inset 0 0 0 2px var(--fd-color-surface)`), plus le contour prune collé. Le focus se voit (blanc sur prune : 7,4:1) sans rien ajouter autour du bouton.
   - On retire l'anneau de 35 % de la capture B : sur le bouton primaire, il fait moins de 3:1.
3. **Erreur** : rouge franc avec icône, comme dans les captures.
   - Au focus d'un champ en erreur, on garde la bordure rouge et un halo rouge à 15 % (pattern de Primer).
   - Le jeton `--fd-color-danger` change donc pour toute l'app, y compris les boutons destructifs. Le texte blanc sur #C42B1C reste lisible, à 5,7:1.

**Si le client veut encore plus discret** : option A pour les champs, avec le focus des boutons du point 2. Je déconseille D : son focus de bouton ne se distingue pas assez.
