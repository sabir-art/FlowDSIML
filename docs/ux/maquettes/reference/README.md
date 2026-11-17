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
