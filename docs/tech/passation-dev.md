# Passation du développement (25 novembre 2026)

Note pour le développeur qui reprend la branche `claude/dev-mvp`. Tout ce qui suit est vérifié
à la date de la note.

## État de la branche

- Branche de travail : `claude/dev-mvp`, poussée, arbre propre, aucune fusion en cours.
- Ne jamais pousser sur `main` : le chef intègre et déploie.
- Dernier commit de travail avant cette note : `756b5f0` (L60 lot B, de bout en bout).

### Sur main

Tout jusqu'au correctif du lot A inclus : invitations, toasts (bas, centrés sur le contenu),
en-tête des Paramètres (variante C), états vides des Paramètres, L61 (compte non confirmé), L62
(voix : refus nommés, voix du compte, réponse 424), L63 côté serveur, note `sandbox-v2.md`, banc
L60 et lot A (dont « une valeur doit avoir la forme de la donnée annoncée », `61862d1` sur
main, `f12d7f1` ici). Le lot A est **VERT** en recette UX
(`docs/ux/recettes/l60-lot-a/rapport.md` sur `claude/ux-design-system`).

### Pas encore sur main

- `15ee068` : lot B, vidéo testée de bout en bout sur un faux flux d'onglet.
- `756b5f0` : lot B, captures du banc envoyées puis ouvertes dans l'app.

Les deux sont à envoyer en recette UX (éditeur et lecteur) : l'UX attend le lot B.

## Travail en cours : L60 « Capture de bout en bout »

Spécification : `docs/ux/specs/l60-capture-bout-en-bout.md` (branche UX). État des lieux et
plan par lots : `docs/tech/l60-capture-etat-des-lieux.md`.

- **Lot A (terminé, VERT).** Fichiers clés : `apps/extension/lib/scan.ts`,
  `packages/core/src/pii.ts` (`plausibleValue`), `packages/core/src/labels.ts`,
  `apps/extension/lib/labelText.ts`, `apps/extension/lib/screenChange.ts` (`screenName`),
  `apps/extension/entrypoints/htmlbar.content.ts`, `apps/extension/lib/htmlUpload.ts`.
  Rapport : `docs/tech/recettes/l60-lot-a/rapport.md`.
- **Lot B (livré, recette UX à demander).** Faux flux d'onglet dans
  `apps/extension/entrypoints/offscreen/main.ts` (`FAKE_STREAM`, seulement si
  `WXT_E2E === '1'` : il doit rester absent du build du store). Rapport :
  `docs/tech/recettes/l60-lot-b/rapport.md`, contrôles générés dans `controles.md`.
  Quatre gênes y sont listées, non corrigées, à arbitrer par l'UX : deux étapes du même nom
  (page et menu ouvert), « Liens sans page » en double, noms tronqués dans la liste des
  étapes, barre d'adresse vide dans l'aperçu d'une démo guidée.
- **Petit lot demandé par l'UX, pas commencé :**
  - vrais tableaux : sous un `th` de nom (Nom, Prénom, Nom complet, Contact), remplacer les
    cellules de la colonne qui ont la forme d'un nom, même d'un seul mot ; jamais les
    en-têtes ; séries d'en-têtes et spans collés restent à 0 détection ;
  - libellés de nom à ajouter, avec la condition de forme : Client, Contact, Interlocuteur,
    Responsable, Bénéficiaire (« Client : Camille Durand » n'est pas détecté) ; cas au banc ;
  - toast « Invitation retirée » ; avertissements de titre technique qui citent le champ et
    le début du texte ; `labelText` : premier morceau de texte plutôt que « Cliquez ici »
    quand des spans sont collés ; dire dans le panneau quand la limite de 100 textes est
    atteinte ; première ligne de réglage sans marge haute quand elle ouvre une page des
    Paramètres.

## Le banc (`apps/extension/e2e/banc`)

Sites fictifs locaux, aucune adresse réelle. `serveur.cjs` sert le site sur le port 54410 et un
tiers sur 54411 : `/app`, `/formulaire`, `/tiers`, `/onglets`, `/menu`, `/donnees`, `/piege`.

```bash
cd apps/extension
node e2e/mock-supabase.cjs &            # faux Supabase de l'extension, port 54400
node e2e/banc/serveur.cjs &             # banc, ports 54410 et 54411
WXT_E2E=1 WXT_DEBUGGER=1 WXT_SUPABASE_URL=http://localhost:54400 \
  WXT_SUPABASE_ANON_KEY=anon WXT_APP_URL=http://localhost:54400 pnpm -s build
node e2e/banc/etat-html.cjs             # 7 parcours en mode HTML (JSON sur stdout)
node e2e/banc/etat-captures.cjs         # détection en mode captures d'écran
node e2e/banc/etat-video.cjs            # vidéo sur le faux flux
# De bout en bout : il faut aussi l'app et le lecteur en serveurs de dev
APP_URL=http://localhost:5173 PLAYER_URL=http://localhost:5174 \
  SHOTS_DIR=/tmp/lot-b RAPPORT=/tmp/lot-b/controles.md node e2e/banc/bout-en-bout.cjs
```

Les serveurs web se lancent avec les variables du job `e2e` de `.github/workflows/ci.yml`
(`VITE_SUPABASE_URL`, `VITE_PLAYER_URL`, `VITE_APP_ORIGIN`, `VITE_EXTENSION_ID`).

Règle du client : « vérifier » veut dire tester pour de vrai, extension construite chargée sur
le banc, et rendre un rapport « à la place de l'utilisateur » avec captures. Rien ne part en
recette UX sans cela.

## Commandes de test

```bash
pnpm format:check && pnpm -s lint && pnpm -s typecheck && pnpm test
pnpm -s check:workflows && pnpm -s check:rpc
# e2e web (depuis apps/web, serveurs de dev lancés)
APP_URL=http://localhost:5173 PLAYER_URL=http://localhost:5174 node e2e/<nom>.e2e.cjs
# pgTAP (PostgreSQL local, 1628 tests)
bash supabase/tests/local/run.sh
# Edge Functions, comme la CI
cd supabase/functions && npx -y deno@2.5.6 test --no-lock --allow-net=127.0.0.1 \
  webhooks-dispatch/ media/ ai/ access-email/ invite-email/ notify-email/ api/
```

Avant chaque poussée : la chaîne stricte, les e2e touchés, `a11y` et `espacements` **en
entier** si l'interface change, et les tests des Edge Functions si `supabase/functions`
change. Tout e2e ajouté entre dans `ci.yml`.

## Pièges connus

- `data-gap-exempt` ne couvre que les enfants **directs** : lancer `espacements.e2e` en entier.
- Tout changement d'empilement ou de position global (toasts, menus) : lancer la suite web
  complète. Les menus et listes déroulantes passent devant les toasts.
- Après une modification de `serveur.cjs`, arrêter vraiment le serveur du banc avant de le
  relancer. Entre deux e2e de l'extension, relancer `mock-supabase.cjs`.
- `permissions.e2e` et `external.e2e` demandent le build du store (seulement
  `WXT_SUPABASE_URL` et `WXT_SUPABASE_ANON_KEY`), pas le build des e2e. Le manifeste du store
  est gelé : toute permission ajoutée doit faire échouer la CI. Pas de `debugger` (option B).
- Les erreurs de `capturer()` (banc) sont rangées dans `erreur`, pas levées : les lire.
- Le sélecteur du type de démo dans l'écran de vérification est un groupe de boutons radio
  (`#kind [data-kind="sandbox"]`), pas des boutons.
- Le faux Supabase de l'extension ne rejoue pas l'assainissement de `html-ingest`.
- `cloche-build.e2e` demande un build de production. `aide`, `capture-animations` et
  `mouvement` peuvent échouer sous charge et passent seuls.
- Aucun délai fixe dans les tests ; tests de temps ancrés sur `date_trunc('day', now())`.
- Dépôt public : aucun secret, les fausses clés ne doivent pas ressembler à des clés.
- Migration déjà sur main = gelée ; nouveau fichier, pgTAP, RLS, `security definer` avec
  `search_path = ''`. Ne pas toucher `deploy.yml` ni `docs/tech/deploiement.md`.
- Nom de l'option IA dans l'extension : « Rédaction automatique », sans nom de fournisseur.

## File d'attente, dans l'ordre

1. Lot A : terminé, VERT.
2. Lot B (faux flux vidéo obligatoire) : livré, recette UX à obtenir ; puis le petit lot UX.
3. Lots C (popup « Que voulez-vous capturer ? »), D (barre commune), E (Terminer, arrivée).
4. Planches validées : mot de passe suggéré, Partager › Lien, sélecteur « Auto » de
   l'assistant, popup Slack (`docs/ux/propositions/retours-4-planches/note.md`), source de la
   voix (`docs/ux/specs/l62-voix-off.md` §6 ; l'Orbe du §7 n'est pas à développer).
5. Sandbox v2, étapes 1 à 6 (`docs/tech/sandbox-v2.md`).
6. Note `docs/tech/ia-fournisseurs.md` (sans code d'app ; spec UX
   `docs/ux/specs/l41-console-modeles-ia.md`).

Ensuite : états vides hors Paramètres, RADIUS-01 étapes 2 à 7, INVITE-01, BADGE-01.

## Décisions récentes du chef

- **Ville seule lisible** : une ville sans adresse n'est pas une donnée personnelle, elle
  reste lisible (« Ville : Lyon »). Une valeur n'est remplacée que si elle a la forme de la
  donnée annoncée par son libellé.
- **Réponse 424 pour les refus du fournisseur de voix** (clé, quota, offre, voix) : le message
  nommé doit arriver jusqu'à l'utilisateur ; 502 et 503 restent pour les pannes. Si le message
  n'apparaît toujours pas en production, relever le statut et le corps dans l'onglet Réseau.
- **Réglage Sandbox par démo** : activable par un éditeur, autorisé par défaut, avec un
  garde-fou d'espace qu'un administrateur peut fermer. À reporter dans `sandbox-v2.md`, avec
  le paragraphe en anglais pour la fiche du store et les critères à 100 % de l'étape 1.
