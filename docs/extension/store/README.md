# Publier l’extension sur le Chrome Web Store (pas à pas)

> Pour le client, titulaire du compte développeur Chrome Web Store. Durée : environ 30 minutes, puis l’examen de Google (souvent quelques jours). Aucun secret n’est écrit dans le dépôt : les trois valeurs ci-dessous restent sur votre poste.

## 1. Préparer les trois valeurs

| Variable | Où la trouver | Exemple de forme |
|---|---|---|
| `WXT_SUPABASE_URL` | Supabase › Project Settings › API › Project URL | `https://<projet>.supabase.co` |
| `WXT_SUPABASE_ANON_KEY` | Supabase › Project Settings › API › clé **anon public** (ou **publishable**) | `eyJ…` ou `sb_publishable_…` |
| `WXT_APP_URL` | Adresse publique de l’app TutoClick | `https://<compte>.github.io/<dépôt>` |

- Ne prenez **jamais** la clé `service_role` ni une clé `sb_secret_` : le script la refuse.
- La clé anon est publique par conception (elle est dans l’app web) ; la sécurité repose sur les règles RLS de la base.

## 2. Construire l’archive

Depuis la racine du dépôt, avec Node 22 et pnpm :

```bash
pnpm install --frozen-lockfile
WXT_SUPABASE_URL=https://<projet>.supabase.co \
WXT_SUPABASE_ANON_KEY=<clé anon> \
WXT_APP_URL=https://<adresse de l’app> \
pnpm --filter @flowdsiml/extension zip:prod
```

- Le script vérifie les trois valeurs (adresses en https, ni locales ni d’exemple, clé de rôle « anon ») avant de construire.
- Résultat : `apps/extension/.output/flowdsimlextension-<version>-chrome.zip`.
- Variante sans poste local : le workflow GitHub « Extension » (Actions › Extension › Run workflow) construit la même archive avec les variables du dépôt, et la met en artefact.

Contrôle rapide du manifeste :

```bash
unzip -p apps/extension/.output/*.zip manifest.json
```

Attendu : `"name": "TutoClick Capture"`, pas de `debugger` dans `permissions`, pas de `host_permissions`, `optional_host_permissions: ["<all_urls>"]`. Les limites de cette version sont dans [`fiche.md`](fiche.md) §4.

## 3. Créer l’article

1. Ouvrez le [tableau de bord développeur](https://chrome.google.com/webstore/devconsole), puis **Nouvel élément**.
2. Téléversez l’archive `.zip` de l’étape 2.
3. Onglet **Fiche** : copiez les textes de [`fiche.md`](fiche.md) §1 (nom, résumé, description, catégorie, langue).
4. Visuels : téléversez `icone-128.png`, les 5 captures `capture-*-1280x800.png` dans l’ordre, `vignette-440x280.png` et `marquee-1400x560.png` (tous dans ce dossier).
5. Onglet **Pratiques de confidentialité** : objectif unique, justification de chaque autorisation, données déclarées et cases à cocher : [`fiche.md`](fiche.md) §3.
6. Lien de la politique de confidentialité : `<adresse de l’app>/extension/confidentialite.html`. Ouvrez-le pour vérifier qu’il s’affiche.
7. Onglet **Distribution** : visibilité **Non répertoriée**, régions selon votre choix.
8. **Envoyer pour examen**.

## 4. Après la publication

1. Copiez l’adresse de l’article (`https://chromewebstore.google.com/detail/<id>`).
2. Donnez-la à l’équipe : elle devient `VITE_EXTENSION_URL` dans les variables du dépôt. Tant qu’elle est vide, l’app affiche « Extension TutoClick · Bientôt disponible » partout où l’installation est proposée.
3. Pour une nouvelle version : augmentez `version` dans `apps/extension/package.json`, reconstruisez (étape 2) et téléversez l’archive sur le même article (**Package › Importer un nouveau package**).

## 5. Avant l’envoi : à confirmer

- [ ] Le DPO confirme les données déclarées (`fiche.md` §3) et la politique de confidentialité, dont la région d’hébergement (Union européenne).
- [x] La capture 1 montre « Espace » et « Format mobile » en « Bientôt » dans le popup (reprise par le Lead UX).
