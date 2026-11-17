# Référence DSI des maquettes d'origine

Ces fichiers sont une copie des maquettes d'origine (`docs/ux/maquettes/*.html`), avec la charte DSI et le logo TutoClick. C'est cette version que le développeur reproduit, sauf pour les écrans où le client a choisi une autre version dans l'outil de suivi.

Règle D13 : la structure, les éléments, les textes et les données de démo ne changent pas. Seuls changent les couleurs, la police, les rayons et le logo. La peau DSI transpose les couleurs, elle ne supprime aucun effet : dégradés, accents multiples, couleur par catégorie, halos, badges colorés.

- `assets/mockup.css` et `assets/mockup.js` : copies des fichiers d'origine (chemin des tokens ajusté, logo TutoClick).
- `assets/reference.css` : la couche qui transpose les effets d'origine dans la palette DSI.

| Effet d'origine | Transposition DSI |
|---|---|
| Sarcelle (action principale) | Prune DSI (rôle primary) |
| Orange (appel fort, carte « Recommandé », bouton « Passer à … », « Publier ») | Dégradé orange DSI vers framboise DSI ; bouton plein framboise, texte blanc |
| Carte « Plan actuel » (bordure et étiquette sarcelle) | Bleu DSI |
| Jauges par métrique (sarcelle pour les membres, jaune pour les crédits) | Bleu (membres), orange (crédits), vert (réussite) |
| Pilule « −20 % » verte | Vert DSI |
| Indicateur de page active dans la barre latérale, liseré des toasts, option « Fond dégradé » de l'éditeur | Rétablis (ils avaient été retirés le 17 nov., commit 09f17cd) |

Les emojis restent retirés : le client ne veut pas de caractères utilisés comme icônes.

## Accessibilité des dégradés d'appel fort

Le blanc sur l'orange DSI #F39200 n'atteint que 2,35:1, sous le seuil AA de 4,5:1. Sur le framboise DSI #D60B52, il atteint 5,21:1. Le dégradé est donc construit pour que le texte repose toujours sur au moins 70 % de framboise : ce mélange donne 4,5:1, et 80 % donne 4,78:1.

| Bouton | Fond |
|---|---|
| Normal | `linear-gradient(135deg, orange-500 0, framboise-600 24px)` + halo `0 6px 16px -6px` orange à 75 % |
| Petit (`btn-sm`) | même dégradé, arrêt à 16 px |
| Pleine largeur (texte centré) | `linear-gradient(90deg, orange-500 0%, framboise-600 22%)` |

L'orange reste visible dans l'angle haut gauche et dans le halo : l'effet chaud d'origine est conservé.

Le contraste a été mesuré au pixel sur le rendu Chromium (fond capturé sans le texte, comparé pixel à pixel à la version avec texte). Minimum sous le texte : 5,01:1 (« Publier les modifications »), 5,16:1 (« Publier »), 5,21:1 (« Passer à … »), en clair et en sombre.

Alternatives écartées :
- Départ en orange foncé #C65F00 : 4,17:1 avec le blanc. C'est encore sous 4,5:1 pour le texte normal (seul le texte gras de 18,66 px ou plus serait acceptable), et l'effet chaud se ternit.
- Texte sombre sur le dégradé : il deviendrait illisible côté framboise.
