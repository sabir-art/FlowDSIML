# FlowDSIML — Architecture technique (phase 1 : analyse)

> Statut : v0.2. **Décision client : la stack est limitée à GitHub + Supabase.** La section [« Révision : stack GitHub + Supabase »](#révision--stack-github--supabase) en fin de document **remplace** les §3 (stack), §5 (monorepo), §7.2–7.3 (services et secrets) et les ADR 001, 005, 006 et 007. Les §0, 1, 2, 4 et 6 restent valables, avec les adaptations indiquées dans la révision.
> Auteur : développeur senior / architecte full-stack.
> Périmètre : ce document décrit **comment** construire une plateforme de démos interactives offrant les capacités de Guideflow (capture → démo guidée → partage → analytics → leads), sans reprendre sa marque. Aucun code applicatif n'est écrit à ce stade.

> Méthode : l'analyse s'appuie sur les pages publiques de Guideflow (capture, sandbox, live demo, intégrations, enterprise, sécurité, centre d'aide) et des concurrents (Navattic, Storylane, Arcade, Supademo, Walnut), ainsi que sur la connaissance des briques open source (rrweb, SingleFile). Les détails internes des concurrents sont **déduits** de leur comportement public, pas documentés par eux ; ils sont signalés comme tels.

---

## 0. Comprendre le produit en une page

Une « démo interactive » est une **reconstitution navigable d'un parcours dans un logiciel**, sans exécuter le vrai logiciel. Le cycle de vie :

```
 [Extension Chrome]          [Backend]                [Éditeur]               [Player public]
  l'utilisateur clique  ──►  upload des captures ──►  steps, hotspots,   ──►  lien / iframe / démo center
  dans son app (SaaS)        (images ou HTML)         textes, thème,          ──► événements (vues, clics,
                             + métadonnées clics      variables, branches          complétion, formulaires)
                                                                               ──► leads ──► CRM / webhooks
```

Trois familles de « démos » existent sur le marché :

| Type | Principe | Exemple de capacité Guideflow |
|---|---|---|
| **Démo guidée (screenshot)** | Une image par étape + hotspot cliquable + bulle de texte | Démo standard, vidéo/GIF exportables |
| **Démo HTML / sandbox** | Snapshot DOM figé de chaque page, rejoué dans une iframe ; le texte et les images restent éditables, l'utilisateur peut explorer librement | `/product/sandbox` (clone de l'app, données modifiables, navigation libre) |
| **Live demo / guide in-app** | Une couche (overlay) injectée par script ou extension **par-dessus la vraie application** ; aucune capture | `/product/live-demo` (guides sur l'app réelle, pour sales en appel ou onboarding) |

Le MVP doit viser la première famille et préparer la seconde (voir §2).

---

## 1. Décomposition technique des modules

### 1.1 Extension de capture (Chrome, Manifest V3)
- **Rôle** : enregistrer un parcours dans n'importe quelle web app où l'utilisateur est connecté.
- **Composants MV3** :
  - *Service worker* : session d'enregistrement, auth (token du workspace), upload en file d'attente (retry, reprise).
  - *Content script* injecté dans l'onglet : écoute `click`, `input`, `submit`, navigation SPA (`history.pushState`, `popstate`), calcule la **position relative** du clic (x/y en % du viewport) et le **sélecteur CSS** de l'élément cible, masque les champs sensibles.
  - *Capture* : `chrome.tabs.captureVisibleTab` (screenshot PNG/WebP) **et/ou** sérialisation DOM (snapshot HTML + CSS inlinés + assets) — voir §2.
  - *Popup / side panel* : démarrer, pause, arrêter, choisir le mode, flouter une zone, choisir le workspace.
- **Points durs** : iframes cross-origin (non capturables en DOM depuis le parent → capture par frame via `all_frames`), canvas/WebGL (impossible en DOM → fallback image), shadow DOM, polices protégées, pages très longues, écrans HiDPI (`devicePixelRatio`).
- **Confidentialité** : floutage automatique (emails, n° de carte, champs `type=password`), règles de masquage par workspace, aucun envoi tant que l'utilisateur n'a pas validé.
- **Distribution** : Chrome Web Store (Edge l'accepte aussi ; Firefox = V2).

### 1.2 Éditeur no-code (web app authentifiée)
- Timeline des **steps** (glisser-déposer, dupliquer, supprimer, insérer un chapitre/écran texte).
- Canvas d'une étape : image ou snapshot HTML, **hotspots** (position, forme, pulsation), **tooltips/bulles** (texte riche, boutons, CTA), **zones floutées**, zoom/pan, recadrage.
- **Branches / chapitres** : menu de choix, sauts conditionnels (« si clic sur A → étape 7 »).
- **Thème** : couleurs, polices, logo, forme des bulles, appliqué au workspace ou à la démo.
- **Variables de personnalisation** : `{{company_name}}`, `{{first_name}}`… remplacées au rendu à partir de l'URL (query params), d'un lien personnalisé ou d'un CRM.
- **Formulaires / gating** : formulaire de capture de lead à une étape donnée.
- **Édition HTML (mode sandbox)** : clic sur un texte du snapshot → édition inline ; remplacement d'images ; masquage d'éléments. Exige le snapshot DOM.
- **Versions** : brouillon vs version publiée ; historique ; restauration.
- **Collaboration** : commentaires (V2), verrouillage optimiste (pas de co-édition temps réel au MVP).
- **IA** (§1.8) : génération des textes d'étapes, traduction, voix-off.

### 1.3 Player public (runtime de lecture)
- **Bundle séparé, léger** (< 80 ko gzip visé), servi depuis un **domaine dédié** (ex. `play.<domaine>`), isolé de l'app.
- Charge un **manifeste JSON publié et immuable** (steps, hotspots, thème, variables) + assets sur CDN.
- Rend : image + overlay SVG/HTML **ou** snapshot HTML dans une iframe `sandbox` (§2) ; navigation clavier, responsive (mise à l'échelle proportionnelle du canvas), accessibilité (focus, ARIA).
- Substitue les variables côté client (échappement HTML strict).
- Émet les **événements analytics** (§1.5) par `navigator.sendBeacon`.
- Formats de diffusion : lien public, **embed iframe** (snippet + script de redimensionnement via `postMessage`), popup/lightbox déclenchée par un bouton du site client, export vidéo/GIF (V2, rendu serveur).
- Contrôle d'accès : public, protégé par mot de passe, restreint au domaine e-mail, lien expirant, désindexation (`noindex`).

### 1.4 Démo center (hub)
- Page publique regroupant plusieurs démos par catégories/persona, avec recherche, brandée au workspace, sur sous-domaine ou **domaine personnalisé** (CNAME + certificat automatique).
- Techniquement : un « méta-player » qui lit une collection publiée ; même runtime, même tracking.

### 1.5 Analytics
- **Ingestion** : endpoint `POST /e` (batch d'événements), sans cookie tiers ; identifiant visiteur anonyme en `localStorage` du domaine player (consentement requis selon le contexte, §6).
- **Événements** : `demo_view`, `step_view`, `hotspot_click`, `cta_click`, `form_submit`, `demo_complete`, `demo_exit`, durée par étape, source (`utm_*`, referrer, embed host).
- **Stockage** : PostgreSQL partitionné par mois au MVP (suffisant jusqu'à quelques dizaines de millions d'événements) ; migration vers **ClickHouse** quand le volume l'exige (V2).
- **Restitution** : tableau de bord par démo (vues, taux de complétion, entonnoir par étape, CTA), par lien, par compte (enrichissement IP→entreprise en V2 via fournisseur tiers), export CSV.
- **Relais** : envoi vers GA4 / Segment / dataLayer du site hôte via `postMessage` (opt-in par le client).

### 1.6 Leads
- Formulaires intégrés au player, champs configurables, consentement explicite.
- Un **lead** = identité (email…) + visiteur anonyme rattaché → reconstitution de son parcours.
- Notifications (email, Slack) et synchronisation CRM.

### 1.7 API publique, webhooks, intégrations
- **API REST** versionnée (`/v1`), clés API par workspace (hachées en base, scopes), rate limiting, OpenAPI généré.
- **Webhooks** sortants signés (HMAC-SHA256, horodatage anti-rejeu, retries exponentiels, journal de livraison) : `lead.created`, `demo.completed`, `demo.published`…
- **Intégrations** (ordre de priorité proposé) :
  1. Webhooks + **Zapier/Make** (couvre beaucoup de besoins à faible coût) ;
  2. **HubSpot** (OAuth, création/maj contact + timeline event) ;
  3. **Salesforce** (OAuth, Lead/Contact + activité) ;
  4. Slack (notifications) ; GA4/Segment (événements) ;
  5. V3 : Marketo, Pardot, Outreach, Gong, Intercom, Calendly/Chili Piper (prise de RDV en fin de démo).
- Chaque intégration = un **connecteur** isolé dans `packages/integrations/<nom>`, exécuté par un **worker** asynchrone (jamais dans la requête HTTP).

### 1.8 IA
- **Textes d'étapes** : à partir du screenshot (modèle multimodal) + élément cliqué + contexte produit → titre et description de bulle.
- **Traductions** : traduction du manifeste (textes uniquement, variables préservées) → une **locale** par démo, sélection automatique selon `Accept-Language`.
- **Voix-off** : TTS par étape (fournisseur externe), fichiers audio stockés et mis en cache ; synchronisation avec l'avancement.
- **Anonymisation intelligente** (V2) : détection de données personnelles sur les captures.
- Architecture : jobs asynchrones (file de tâches), **quotas par plan** (crédits IA), journal de coût par workspace, fournisseur abstrait derrière une interface (`packages/ai`) pour pouvoir changer de modèle.

### 1.9 Auth, équipes, billing
- **Auth** : email + mot de passe, magic link, Google OAuth au MVP ; **SSO SAML/OIDC + SCIM** en V3 (Enterprise).
- **Multi-tenant** : un utilisateur appartient à N **workspaces** ; rôles `owner`, `admin`, `editor`, `viewer` ; invitations par email ; dossiers et permissions par dossier en V2.
- **Billing** : Stripe Billing (Checkout + Customer Portal + webhooks), plans Free / Pro / Business / Enterprise, limites appliquées côté serveur (nb de démos publiées, sièges, crédits IA, branding retiré, domaine perso, intégrations).
- **Isolation** : chaque requête filtrée par `workspace_id` ; politiques Row-Level Security PostgreSQL en défense en profondeur.

### 1.10 Desktop / mobile / Figma (V3)
- **Desktop** (capture d'apps natives) : application Electron/Tauri, capture d'écran + position de la souris à chaque clic (pas de DOM) → même pipeline que les screenshots.
- **Mobile** : import de captures/enregistrement d'écran (iOS/Android) ; modèle « appareil » (frame téléphone) dans le player.
- **Figma** : plugin Figma qui exporte des frames en images + liens de prototype → steps et hotspots.
- Tous convergent vers le **même modèle de données** (une étape = une image ou un snapshot + des hotspots) : c'est la clé pour ne pas multiplier les players.

### 1.11 Live demo / guides in-app (V3)
- Script JS (ou extension) chargé sur la vraie application du client, qui affiche des bulles ancrées sur des **sélecteurs CSS** robustes (attributs `data-*`, texte, position relative), avec tolérance aux changements de DOM. Réutilise le moteur de bulles du player.

---

## 2. Capture : screenshot ou DOM ?

### 2.1 Les deux approches

**A. Screenshot (image par étape)**
Capture du viewport en image + coordonnées du clic. Utilisé par Arcade, Supademo et le mode « screenshot » de Guideflow/Storylane (constat d'après leurs produits publics).

**B. Snapshot DOM / HTML**
Sérialisation de la page : HTML + CSS calculés/inlinés + images/polices récupérées, rejouée dans une iframe. Utilisé par Navattic, Walnut, Storylane (mode HTML) et le mode sandbox de Guideflow (déduit du comportement : texte éditable, rendu responsive, pas de pixellisation).

Briques open source :
- **rrweb** (`rrweb-snapshot`) : sérialise le DOM en arbre JSON avec identifiants de nœuds, gère les mutations, le shadow DOM, masque les inputs ; conçu pour le *session replay*. Excellent pour capturer, moins direct pour **éditer** ensuite.
- **SingleFile** (lib/extension) : produit un **fichier HTML autonome** (CSS et assets inlinés, scripts supprimés). Très bon pour un snapshot figé et éditable comme du HTML.

### 2.2 Comparatif

| Critère | Screenshot | DOM / HTML |
|---|---|---|
| Complexité d'implémentation | **Faible** (quelques semaines) | **Élevée** (mois de cas limites : CSS, polices, iframes, canvas, CORS des assets) |
| Fidélité visuelle | Parfaite (pixel exact) | Très bonne mais imparfaite (polices manquantes, CSS dynamiques, canvas vides) |
| Éditer le contenu (texte, chiffres, logos) | Non (seulement flou/annotation, ou retouche image) | **Oui** (édition inline) |
| Responsive / mobile | Mise à l'échelle de l'image, texte petit | Reflow natif possible |
| Poids | 100–400 ko/étape (WebP) | 0,5–5 Mo/page avant dédup, ~100 ko après dédup des assets |
| Personnalisation par variables *dans* l'écran | Non (seulement dans les bulles) | **Oui** (remplacer « Acme » par `{{company}}` dans l'UI) |
| Navigation libre (sandbox) | Non | **Oui** |
| Sécurité | Inerte (image) | Contenu tiers à **assainir** (scripts, liens, formulaires) ; risque XSS si mal isolé |
| SEO / accessibilité | Faible | Meilleure |
| Fuite de données | Visible mais statique | Données cachées dans le DOM (attributs, `<script>` JSON, tokens) → nettoyage obligatoire |
| Apps non web (desktop, Figma, mobile) | **Compatible** | Impossible |

### 2.3 Recommandation MVP

**Architecture « double moteur », mais livraison en deux temps :**

1. **MVP = screenshot**, avec métadonnées riches. À chaque clic, l'extension enregistre l'image **et** des métadonnées légères (sélecteur, texte de l'élément, bounding box, URL, titre de page). Avantages : time-to-market, fiabilité, compatibilité future desktop/Figma/mobile, métadonnées utiles pour l'IA (textes générés) dès le MVP.
2. **Le modèle de données prévoit dès le jour 1** un `capture_type` par étape (`image` | `html`) et un champ `snapshot_asset_id`. Ainsi le mode HTML s'ajoute en V2 sans migration lourde.
3. **V2 = snapshot HTML** basé sur **rrweb-snapshot** pour la capture (plus robuste sur les SPA/shadow DOM, licence MIT) puis **conversion côté serveur en document HTML statique** assaini (approche à la SingleFile : CSS inlinés, scripts retirés, assets dédupliqués par hash sur S3). L'extension capture **les deux** (image + DOM) : l'image sert de vignette et de fallback si le rendu HTML est défaillant.

Justification : la valeur différenciante du HTML (édition inline, sandbox) est réelle mais son coût d'ingénierie est le principal risque du projet ; on le prend une fois le produit validé avec de vrais utilisateurs.

> Licences à vérifier avant usage : rrweb (MIT). SingleFile est sous **AGPL-3.0** : on s'en inspire pour l'approche, on **n'intègre pas son code** dans un SaaS propriétaire sans avis juridique.

---

## 3. Stack technique recommandée

Critères : petite équipe (2–4 devs), un seul langage, peu d'opérations, coûts bas au départ, pas de verrouillage fort.

| Couche | Choix | Justification |
|---|---|---|
| Langage | **TypeScript** partout | Un langage pour extension, front, back, workers ; types partagés (manifeste de démo). |
| Monorepo | **pnpm workspaces + Turborepo** | Simple, cache de build, standard. |
| App web (marketing + éditeur + dashboard) | **Next.js (App Router) + React** | SSR pour pages publiques / démo center / SEO, routes API possibles, écosystème. |
| UI | **Tailwind CSS + shadcn/ui (Radix)** | Rapide, accessible, composants possédés (alignement avec la Designer via tokens). |
| État éditeur | **Zustand** + immer, undo/redo | Léger ; l'éditeur est un état local complexe. |
| Player | **Preact** (ou Vanilla TS) bundlé avec **Vite** | Taille minimale, chargé chez des tiers ; indépendant de Next. |
| Extension | **WXT** (framework MV3, Vite) + React | Gère manifest, HMR, build multi-navigateurs. |
| API | **Hono** (ou routes Next) + **Zod** + OpenAPI | API publique typée et documentée ; Hono déployable partout. Au MVP, une seule app Node suffit. |
| Base de données | **PostgreSQL** (Neon ou Supabase managé) | Relationnel, JSONB pour le manifeste, RLS, partitionnement. |
| ORM | **Drizzle ORM** | SQL explicite, migrations, léger, bon support RLS. |
| Auth | **Better Auth** (self-hosted, TS) — alternative : Clerk | Pas de coût par MAU, contrôle des données (RGPD), SSO/SAML via plugins plus tard. Clerk si on veut aller plus vite au prix d'un coût et d'une dépendance. |
| Files de jobs | **pg-boss** (sur Postgres) au MVP → BullMQ/Redis si besoin | Zéro infra supplémentaire au début. |
| Stockage objets | **Cloudflare R2** (S3-compatible) | Pas de frais de sortie (egress) — critique pour un player très consulté. |
| CDN / player / assets | **Cloudflare** (CDN + Workers pour l'ingestion d'événements) | Latence mondiale, absorbe les pics, protection DDoS. |
| Hébergement app/API/workers | **Vercel** (Next) + **Fly.io ou Railway** (workers) — ou tout sur **Scaleway / OVH** si exigence d'hébergement UE | Simple à opérer ; régions UE disponibles. |
| Analytics (stockage) | Postgres partitionné → **ClickHouse Cloud** en V2 | Démarrer simple, migrer quand > ~50 M événements. |
| Paiement | **Stripe Billing** (+ Stripe Tax) | Standard, portail client, TVA UE. |
| Emails transactionnels | **Resend** (ou Postmark) | Simple, templates React Email. |
| IA (texte, traduction) | API **Anthropic Claude** (modèle multimodal) derrière `packages/ai` | Qualité de rédaction + vision ; abstraction pour changer de fournisseur. |
| TTS (voix-off) | **ElevenLabs** ou Azure TTS | Qualité / langues ; coût par caractère à suivre. |
| Observabilité | **Sentry** (erreurs) + logs structurés (Axiom/Better Stack) | Couvre front, back, extension. |
| Analytics produit (interne) | **PostHog** (UE) | Comprendre l'usage de l'éditeur. |
| Tests | **Vitest** (unitaires) + **Playwright** (E2E, y compris l'extension) | Standard TS. |
| CI/CD | **GitHub Actions** | Le dépôt est sur GitHub. |

Principe : **un monolithe modulaire** (une app Next + une API + des workers partageant les packages), pas de microservices.

---

## 4. Modèle de données

Conventions : PostgreSQL, clés `uuid` (v7, triables), `created_at`/`updated_at` partout, suppression logique (`deleted_at`) sur les objets métier, `workspace_id` sur toute table tenant.

### 4.1 Identité, équipes, billing

```
users              (id, email UNIQUE, name, avatar_url, locale, email_verified_at, last_login_at)
auth_accounts      (id, user_id → users, provider[password|google|saml], provider_account_id, password_hash?)
sessions           (id, user_id, expires_at, ip, user_agent)
workspaces         (id, name, slug UNIQUE, logo_asset_id?, plan_id, region, settings JSONB, custom_domain?)
members            (id, workspace_id, user_id, role[owner|admin|editor|viewer], UNIQUE(workspace_id,user_id))
invitations        (id, workspace_id, email, role, token_hash, invited_by, expires_at, accepted_at?)
api_keys           (id, workspace_id, name, key_prefix, key_hash, scopes[], last_used_at, revoked_at?)
plans              (id, code[free|pro|business|enterprise], limits JSONB, stripe_price_ids JSONB)
subscriptions      (id, workspace_id UNIQUE, stripe_customer_id, stripe_subscription_id, plan_id,
                    status[trialing|active|past_due|canceled], seats, current_period_end, cancel_at?)
usage_counters     (workspace_id, period, metric[ai_credits|published_demos|views], value)
audit_logs         (id, workspace_id, actor_user_id?, action, target_type, target_id, metadata JSONB, ip)
```

### 4.2 Contenu

```
folders            (id, workspace_id, parent_id?, name)
demos              (id, workspace_id, folder_id?, title, slug, status[draft|published|archived],
                    type[guided|sandbox], theme_id?, default_locale, current_version_id?, created_by)
demo_versions      (id, demo_id, number, manifest JSONB  -- snapshot complet et IMMUABLE publié
                    , manifest_url  -- copie sur CDN, published_at, published_by)
steps              (id, demo_id, position, chapter_id?, capture_type[image|html|text],
                    image_asset_id?, snapshot_asset_id?, page_url, page_title, viewport_w, viewport_h,
                    dpr, element_meta JSONB  -- sélecteur, texte, bbox, durée_auto?, audio_asset_id?)
chapters           (id, demo_id, title, position)
hotspots           (id, step_id, kind[click|hover|none], x_pct, y_pct, w_pct, h_pct, shape,
                    tooltip JSONB  -- {title, body (rich), placement, buttons[]},
                    action JSONB  -- {type: next|goto_step|url|form|cta, target}, position)
blur_regions       (id, step_id, x_pct, y_pct, w_pct, h_pct)
step_translations  (id, step_id, hotspot_id?, locale, fields JSONB, source[ai|human])
themes             (id, workspace_id, name, tokens JSONB  -- couleurs, police, rayons, logo)
variables          (id, workspace_id, key, label, default_value, source[url|link|crm])
assets             (id, workspace_id, kind[image|html_snapshot|audio|video|font], storage_key,
                    sha256, mime, bytes, width?, height?)  -- dédupliqué par sha256
forms              (id, workspace_id, name, fields JSONB, consent_text, redirect_url?)
collections        (id, workspace_id, title, slug, theme_id?, settings JSONB)   -- démo center
collection_items   (collection_id, demo_id, category, position)
```

Le **manifeste publié** (`demo_versions.manifest`) dénormalise steps/hotspots/thème/traductions en un JSON unique : le player ne lit jamais les tables d'édition. Les tables `steps`/`hotspots` représentent le **brouillon**.

### 4.3 Diffusion, leads, analytics, intégrations

```
links              (id, demo_id | collection_id, workspace_id, token UNIQUE, name,
                    variables JSONB  -- valeurs pré-remplies (lien personnalisé prospect),
                    password_hash?, allowed_email_domains[], expires_at?, utm JSONB)
visitors           (id, workspace_id, anon_id, lead_id?, first_seen_at, country?, company_domain?)
leads              (id, workspace_id, email, name?, company?, fields JSONB, consent_at, source_link_id?,
                    source_demo_id?, UNIQUE(workspace_id,email))
events             (id, workspace_id, demo_id, version_id, link_id?, visitor_id, session_id,
                    type, step_id?, hotspot_id?, props JSONB, occurred_at,
                    ip_trunc, user_agent_family, referrer_host, embed_host)
                    -- PARTITION BY RANGE (occurred_at), rétention configurable
integrations       (id, workspace_id, provider[hubspot|salesforce|slack|zapier…], status,
                    credentials_encrypted, config JSONB)
webhook_endpoints  (id, workspace_id, url, secret_encrypted, events[], active)
webhook_deliveries (id, endpoint_id, event_type, payload JSONB, status, attempts, next_retry_at, response_code)
ai_jobs            (id, workspace_id, kind[step_text|translate|tts], target_id, status,
                    provider, input_tokens, output_tokens, chars, cost_micro_usd, error?)
```

Relations clés : `workspace 1—N demos 1—N steps 1—N hotspots` ; `demo 1—N demo_versions` ; `demo 1—N links` ; `visitor N—1 lead` ; `event N—1 visitor`.

---

## 5. Structure du monorepo

```
flowdsiml/
├─ apps/
│  ├─ web/            Next.js : marketing, auth, dashboard, éditeur, démo center (SSR), routes API internes
│  ├─ api/            Hono : API publique /v1, ingestion d'événements (ou Cloudflare Worker), webhooks Stripe
│  ├─ worker/         Jobs : traitement des captures, IA, TTS, sync CRM, webhooks sortants, emails
│  ├─ player/         Bundle Preact/Vite du player public + script d'embed (embed.js)
│  ├─ extension/      Extension Chrome MV3 (WXT)
│  └─ docs/           (V2) documentation publique / API reference
├─ packages/
│  ├─ db/             Schéma Drizzle, migrations, seeds, politiques RLS
│  ├─ core/           Logique métier (démos, publication, permissions, quotas) — sans framework
│  ├─ manifest/       Types + schéma Zod du manifeste de démo (contrat éditeur ↔ player ↔ extension)
│  ├─ ui/             Design system (tokens issus de la Designer, composants shadcn)
│  ├─ player-core/    Moteur de rendu des étapes/bulles (partagé player, éditeur en prévisualisation, live demo)
│  ├─ capture/        Sérialisation DOM, masquage, utilitaires de sélecteurs (V2 rrweb)
│  ├─ ai/             Interface fournisseurs IA/TTS, prompts, comptage des coûts
│  ├─ integrations/   Connecteurs (hubspot, salesforce, slack, zapier…)
│  ├─ analytics/      Schéma d'événements, client d'ingestion, requêtes d'agrégats
│  ├─ billing/        Plans, limites, client Stripe
│  └─ config/         tsconfig, eslint, prettier, tailwind preset partagés
├─ docs/
│  ├─ tech/           architecture.md (ce document), ADR (decisions/)
│  └─ design/         livrables UX
├─ .github/workflows/ CI (lint, typecheck, tests, build, déploiement)
├─ turbo.json · pnpm-workspace.yaml · package.json
```

Règle : `packages/manifest` est le **contrat central** ; toute évolution est versionnée (`manifest.schemaVersion`) et le player sait lire les versions antérieures.

---

## 6. Roadmap et risques

### 6.1 Phases

Hypothèse : 2 développeurs full-stack + 1 designer, à temps plein.

**MVP — ~12 semaines** (objectif : un utilisateur crée, publie et mesure une démo screenshot)

| Sem. | Contenu |
|---|---|
| 1–2 | Monorepo, CI, DB, auth (email + Google), workspaces, membres, invitations, design system de base |
| 3–5 | Extension MV3 : enregistrement des clics, screenshots, floutage manuel, upload ; création de démo |
| 5–8 | Éditeur : timeline, hotspots, bulles, thème, variables simples (URL), chapitres basiques, publication (versions) |
| 8–9 | Player + lien public + embed iframe + mot de passe ; prévisualisation dans l'éditeur |
| 9–10 | Analytics de base (vues, complétion, entonnoir par étape), formulaire lead, notification email, webhooks |
| 10–11 | Stripe (Free/Pro), limites de plan ; IA : génération des textes d'étapes |
| 12 | Durcissement sécurité, RGPD (DPA, export/suppression), tests E2E, publication Chrome Web Store, bêta privée |

**V2 — +3 à 4 mois**
Capture HTML (rrweb) + édition inline + sandbox ; démo center + domaine personnalisé ; HubSpot, Salesforce, Slack, Zapier ; traductions IA + voix-off ; liens personnalisés par prospect ; dossiers et permissions ; commentaires ; export vidéo/GIF ; ClickHouse si nécessaire ; enrichissement IP→entreprise.

**V3 — +4 à 6 mois**
Enterprise : SSO SAML/OIDC, SCIM, journaux d'audit exposés, résidence des données, SLA, préparation SOC 2 / ISO 27001 ; live demo / guides in-app ; app desktop ; plugin Figma ; import mobile ; intégrations avancées (Marketo, Outreach, Gong…) ; branches conditionnelles avancées ; API publique complète.

### 6.2 Risques et parades

| Risque | Détail | Parade |
|---|---|---|
| **Sécurité de l'embed** | Le player tourne dans le site d'un tiers ; un snapshot HTML contient du contenu non maîtrisé | Player sur **domaine distinct** de l'app (cookies non partagés) ; snapshots servis depuis un **3ᵉ domaine** (`*.usercontent…`) dans `<iframe sandbox="allow-same-origin">` **sans** `allow-scripts` ; assainissement serveur (DOMPurify/parse5 : suppression `<script>`, `on*`, `javascript:`, formulaires) ; `postMessage` avec vérification d'origine et schéma de messages |
| **CSP** | Les sites clients ont des CSP qui bloquent iframes/scripts ; la nôtre doit être stricte | Doc d'intégration (`frame-src play.<domaine>`) ; notre CSP : `frame-ancestors` configurable par workspace (liste de domaines autorisés à embarquer), `script-src` avec nonces ; en-têtes `X-Content-Type-Options`, `Referrer-Policy` |
| **Clickjacking / usurpation** | Une démo pourrait imiter une vraie page de login | Bandeau « démo » non masquable sur plan Free, désactivation des champs mot de passe dans les snapshots, signalement d'abus |
| **Fuite de données capturées** | Emails clients, tokens, données de prod dans les captures | Floutage automatique, masquage des inputs, nettoyage des attributs/`<script>` JSON, prévisualisation avant upload, suppression définitive des assets |
| **RGPD** | Visiteurs anonymes trackés, leads, sous-traitants hors UE | Hébergement UE, DPA client + registre de sous-traitants, minimisation (IP tronquée, pas de cookie tiers), mode « sans tracking » / consentement relayé par l'hôte, rétention configurable, droits d'accès/suppression, chiffrement des secrets d'intégration, mentions légales |
| **Coûts IA** | Génération par étape × nb d'étapes × utilisateurs ; TTS coûteux | Crédits par plan, mise en cache, génération à la demande (pas automatique), modèles moins chers pour la traduction, suivi `ai_jobs.cost` et alertes |
| **Coûts de stockage / bande passante** | Images et snapshots × versions × vues | WebP/AVIF, déduplication par sha256, R2 sans egress, CDN avec cache long (assets immuables), purge des brouillons abandonnés, limites par plan |
| **Fragilité de la capture** | SPA, iframes, canvas, shadow DOM, HiDPI | Screenshot au MVP ; jeu de tests sur 20 apps SaaS de référence ; fallback image |
| **Revue Chrome Web Store** | Permissions larges (`<all_urls>`, `tabs`) → revue longue, risque de rejet | `activeTab` + permissions optionnelles demandées à la volée, politique de confidentialité claire, justification de chaque permission, compte développeur vérifié tôt |
| **Abus / contenu illicite** | Hébergement public de contenus utilisateurs | CGU, signalement, modération, limites anti-spam sur Free |
| **Propriété intellectuelle** | Ressemblance avec Guideflow | Nom, marque, UI et textes originaux ; on reprend les capacités, pas l'interface |

---

## 7. Ce qui MANQUE pour démarrer

### 7.1 Décisions à prendre (chef d'équipe / produit)
1. **Nom définitif et marque** (FlowDSIML est-il le nom commercial ?) — conditionne domaine, extension, Stripe.
2. **Validation du périmètre MVP** (screenshot d'abord, HTML en V2) et du planning (taille réelle de l'équipe ?).
3. **Hébergement UE obligatoire ?** (Vercel/Fly en région UE vs Scaleway/OVH) et cible clients (PME vs Enterprise).
4. **Auth : Better Auth (self-hosted) ou Clerk (managé)**.
5. **Plans et prix** (limites Free/Pro/Business), devise, essai gratuit.
6. **Langues du produit** au lancement (FR + EN ?).
7. **Fournisseurs IA et TTS** retenus et budget mensuel plafond.
8. **Entité juridique** qui facture (nécessaire pour Stripe, CGU, DPA, Chrome Web Store).

### 7.2 Comptes et services tiers à créer
| Service | Usage | Qui / quand |
|---|---|---|
| **Nom de domaine** (+ sous-domaines `app.`, `play.`, `api.`, domaine `usercontent` séparé) | App, player, isolation des snapshots | Avant semaine 2 |
| **Cloudflare** | DNS, CDN, R2, Workers | Semaine 1 |
| **GitHub** : accès admin au dépôt `sabir-art/FlowDSIML`, secrets Actions, protection de branche | CI/CD | Semaine 1 |
| **Hébergeur** : Vercel (team) + Fly.io/Railway, ou Scaleway | App, API, workers | Semaine 1 |
| **PostgreSQL managé** (Neon ou Supabase, région UE) | Base de données | Semaine 1 |
| **Google Cloud** : projet OAuth (client ID/secret, écran de consentement vérifié) | Login Google | Semaine 2 |
| **Chrome Web Store** : compte développeur (frais d'inscription unique ~5 USD), vérification d'identité, politique de confidentialité publique | Publication extension | Avant semaine 10 (délai de revue) |
| **Stripe** : compte vérifié (entité, IBAN), produits/prix, Stripe Tax, clés test + live, secret webhook | Billing | Semaine 9 |
| **Resend / Postmark** : domaine d'envoi vérifié (SPF, DKIM, DMARC) | Emails | Semaine 2 |
| **Anthropic** (clé API) ; **ElevenLabs/Azure** (clé TTS, V2) | IA | Semaine 10 / V2 |
| **Sentry**, **PostHog** (UE), logs | Observabilité | Semaine 1–2 |
| **HubSpot** (compte développeur + app OAuth), **Salesforce** (Developer Edition + Connected App), **Slack** (app), **Zapier** (compte partenaire) | Intégrations | V2 |
| **Figma** (compte dev pour plugin), **Apple/Microsoft** signing (app desktop) | V3 | V3 |

### 7.3 Clés et secrets (à stocker dans un gestionnaire de secrets, jamais dans le dépôt)
`DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `R2_ACCESS_KEY_ID/SECRET`, `R2_BUCKET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `SENTRY_DSN`, `POSTHOG_KEY`, `ENCRYPTION_KEY` (chiffrement des tokens d'intégration), plus `CHROME_WEBSTORE_*` (publication automatisée, optionnel).

### 7.4 Livrables attendus des autres membres
- **Lead Designer UX** : parcours capture → édition → publication, maquettes éditeur et player, **design tokens** (couleurs, typo, rayons) exportables pour `packages/ui`, états vides/erreurs, guidelines d'accessibilité.
- **Chef d'équipe / juridique** : CGU, politique de confidentialité, DPA, liste des sous-traitants, mentions légales — requis pour le Chrome Web Store et Stripe.

### 7.5 Accès nécessaires pour l'équipe technique
- Droits d'écriture sur le dépôt et sur les secrets GitHub Actions.
- Accès aux consoles : Cloudflare, hébergeur, base de données, Stripe (mode test), Google Cloud, Chrome Web Store (rôle développeur), Sentry.
- 3 à 5 **applications SaaS de test** (comptes de démo) pour valider la capture sur des cas réels.

---

## Annexe — Décisions d'architecture (résumé ADR)

| # | Décision | Statut |
|---|---|---|
| ADR-001 | Monolithe modulaire TypeScript en monorepo pnpm/Turborepo | Proposé |
| ADR-002 | Capture screenshot au MVP, modèle prêt pour HTML (rrweb) en V2 | Proposé |
| ADR-003 | Manifeste de démo publié, immuable, servi par CDN ; le player ne lit pas la DB | Proposé |
| ADR-004 | Trois domaines séparés : app / player / contenus utilisateurs | Proposé |
| ADR-005 | PostgreSQL + RLS ; analytics dans Postgres partitionné puis ClickHouse | Proposé |
| ADR-006 | Stockage R2 + CDN Cloudflare (pas d'egress) | Proposé |
| ADR-007 | Jobs asynchrones (pg-boss) pour IA, intégrations, webhooks | Proposé |

---

## Révision : stack GitHub + Supabase

> Décision client (17/11/2026) : on n'utilise **que GitHub et Supabase**. Projet Supabase existant : ref `<project-ref>`, URL `https://<project-ref>.supabase.co`. La ref et l'URL sont des identifiants publics. Les clés ne figurent **jamais** dans ce document ni dans le dépôt.
>
> Les limites et quotas Supabase et GitHub cités ci-dessous viennent de leur documentation publique telle que je la connais. Il faut **les revérifier** sur la page des prix et la documentation au moment de dimensionner, car ils changent souvent.

### R.1 Correspondance avec l'architecture initiale

| Besoin | Proposition v0.1 | **Révision GitHub + Supabase** |
|---|---|---|
| Base de données | Postgres managé + Drizzle | **Supabase Postgres**, migrations SQL dans `supabase/migrations` (Supabase CLI) |
| Accès aux données | API Hono + ORM | **supabase-js** (PostgREST) + **RLS** partout ; fonctions SQL `security definer` (RPC) pour les opérations sensibles |
| Types TypeScript | Drizzle | **`supabase gen types typescript`** → `packages/db/types.ts`, régénérés en CI |
| Auth | Better Auth / Clerk | **Supabase Auth** : email + mot de passe et magic link ; Google OAuth en option |
| Stockage | Cloudflare R2 + CDN | **Supabase Storage** (CDN intégré) : buckets privés + URLs signées ; un bucket public pour les manifestes publiés |
| API publique, webhooks entrants (Stripe…) | Hono sur Fly | **Edge Functions** (Deno) |
| Jobs asynchrones | pg-boss + workers Fly | **pgmq** (Supabase Queues) + **pg_cron** + **pg_net** (pour appeler les Edge Functions) + triggers / Database Webhooks |
| Analytics | Postgres → ClickHouse, PostHog | **Tables Postgres partitionnées** uniquement ; agrégats précalculés par pg_cron |
| Front (app + éditeur) | Next.js sur Vercel | **SPA statique Vite + React** sur **GitHub Pages** |
| Player | Bundle Preact sur CDN | Bundle Preact **statique** sur GitHub Pages (manifeste lu depuis Supabase Storage) |
| CI/CD | GitHub Actions | **GitHub Actions** : lint, tests, `supabase db push`, `supabase functions deploy`, déploiement Pages |
| Observabilité | Sentry, Axiom | **Logs Supabase** (Postgres, Auth, Edge Functions) + table `client_errors` alimentée par le front |

**Drizzle : abandonné.** Supabase CLI gère déjà les migrations SQL, les types générés suffisent pour supabase-js, et la logique de sécurité vit dans les politiques RLS, écrites en SQL de toute façon. Un ORM ajouterait une seconde source de vérité du schéma sans rien apporter. On écrit les migrations en SQL à la main et on les teste avec **pgTAP** (`supabase test db`).

Choix entre Vite et Next en export statique : **Vite**. Next en `output: 'export'` perd ce qui justifiait Next (SSR, middleware, routes API) et garde sa complexité. Vite + React Router donne une SPA plus simple, plus rapide à compiler, et naturelle pour un éditeur riche.

### R.2 Architecture révisée

```
 Extension MV3 ──(supabase-js, session dans chrome.storage)──┐
   capture PNG → conversion WebP dans l'extension            │
   upload via URL d'upload signée                            ▼
                                                  ┌────────── Supabase ──────────┐
 SPA app/éditeur (GitHub Pages) ──supabase-js──►  │ Auth   Postgres+RLS   Storage │
                                                  │ Edge Functions  pgmq  pg_cron│
 Player (GitHub Pages) ──GET manifest public──►   │ bucket `published` (public)  │
        └──POST événements──► Edge Function `track` (ou RPC) ──► events (partitionnée)
                                                  └──────────────────────────────┘
 Stripe (plus tard) ──webhook──► Edge Function `stripe-webhook`
```

**Flux de publication.** Dans l'éditeur, « Publier » appelle la RPC `publish_demo(demo_id)` (`security definer`). Elle vérifie le rôle du membre et les quotas du plan, construit le manifeste JSON, insère `demo_versions` et place un message dans la file pgmq. Une Edge Function écrit ensuite `published/<workspace>/<demo>/<version>.json` et `published/<demo>/latest.json` dans le bucket public. Le player ne lit **jamais** la base : seulement ce fichier et les images.

**Images.** Les images des démos publiées sont copiées dans un bucket public sous un chemin non devinable (hash), ce qui permet le cache CDN. Les captures des brouillons restent dans un bucket **privé**, lues par l'éditeur via des URLs signées à durée courte.

### R.3 Détail par brique Supabase

**Base et RLS**
- Fonction `is_member(workspace_id, min_role)` (SQL `stable`, `security definer`) utilisée par toutes les politiques RLS. Index sur `members(user_id, workspace_id)`.
- Le rôle `anon` n'a **aucun accès** aux tables. Le player passe par le Storage public et par la fonction de tracking.
- Le `workspace_id` courant reste côté client. Les droits sont toujours vérifiés par RLS, jamais par une valeur envoyée par le client.
- Extensions à activer : `pgmq`, `pg_cron`, `pg_net`, `pgcrypto`, `pgtap` (tests). Les secrets d'intégration (tokens CRM, V2) vont dans **Supabase Vault**.

**Auth**
- Email + mot de passe et magic link au MVP ; Google OAuth activable sans code.
- Un trigger sur `auth.users` crée le profil (`public.users`) et un workspace personnel.
- Invitations : table `invitations` + Edge Function qui envoie l'email (ou `auth.admin.inviteUserByEmail`).
- SSO SAML (V3, Enterprise) : proposé par Supabase sur les plans payants (à vérifier).
- L'extension se connecte avec supabase-js. La session est stockée dans `chrome.storage.local` via un adaptateur `storage` personnalisé.

**Storage**

| Bucket | Accès | Contenu |
|---|---|---|
| `captures` | privé (RLS `storage.objects` par workspace) | Captures brutes et brouillons |
| `published` | **public** | Manifestes publiés + images des versions publiées |
| `branding` | public | Logos, polices du thème |
| `snapshots` (V2) | privé, puis copie publique à la publication | Snapshots HTML assainis |

- L'extension convertit en WebP elle-même (`OffscreenCanvas.convertToBlob`) avant l'upload : pas de traitement d'image côté serveur au MVP.
- Les transformations d'images de Supabase (redimensionnement à la volée) sont une option payante, inutile au MVP.

**Edge Functions** (dossier `supabase/functions/`)

| Fonction | Rôle | Phase |
|---|---|---|
| `track` | Ingestion des événements du player : validation du schéma, limite de taille, troncature de l'IP, insertion en lot | MVP |
| `publish-worker` | Consomme la file pgmq et écrit le manifeste et les images dans `published` | MVP |
| `lead-submit` | Formulaire de lead (anti-spam par jeton honeypot et limite par IP), puis notification et webhooks | MVP |
| `webhooks-dispatch` | Livraison signée HMAC des webhooks sortants, avec retries (déclenchée par pg_cron) | MVP |
| `send-email` | Emails transactionnels via le SMTP personnalisé | MVP |
| `api-v1` | API publique avec clés API par workspace | V2 |
| `stripe-webhook`, `billing-portal` | Paiement | Phase billing |
| `ai-step-text`, `ai-translate`, `ai-tts` | IA | V2 |
| `crm-sync-*` | HubSpot, Salesforce… | V2 |

Les Edge Functions ont des limites de mémoire, de temps CPU et de durée par requête (de l'ordre de la centaine de Mo et de quelques secondes de CPU ; à vérifier). Elles conviennent aux appels HTTP et aux traitements JSON, **pas** à l'export vidéo ou GIF ni au rendu headless. L'export vidéo (V2) se fera donc **dans le navigateur** (WebCodecs / ffmpeg.wasm), ou nécessitera un service hors Supabase.

**Jobs**
- `pgmq` : files `publish`, `webhooks`, `emails`, `ai` (V2).
- `pg_cron` :
  - chaque minute, appel via `pg_net` des workers qui vident les files ;
  - chaque nuit, création de la partition `events` du mois suivant, purge selon la rétention, recalcul des agrégats ;
  - chaque heure, nettoyage des uploads orphelins.
- Triggers : insertion d'un lead → message dans `webhooks` et `emails`.

**Analytics**
- Table `events` partitionnée par mois (`PARTITION BY RANGE (occurred_at)`), partitions créées par pg_cron. On n'installe pas d'extension supplémentaire si elle n'est pas disponible.
- Tables d'agrégats `demo_stats_daily(demo_id, day, views, completions, …)` et `step_stats_daily`, mises à jour toutes les 5 à 15 minutes. Les tableaux de bord lisent les agrégats, jamais les événements bruts.
- Taille de la base à surveiller : 1 million d'événements représente environ 300 à 500 Mo avec les index. Le plan gratuit (quelques centaines de Mo) **ne tient pas** en production. Il faut une rétention courte des événements bruts (90 jours, par exemple), puis seulement les agrégats.
- Pas de PostHog : les analytics internes sur l'usage du produit seront, si besoin, une table `product_events` alimentée par la SPA.

### R.4 Front et player sur GitHub Pages : limites et parades

| Limite | Conséquence | Parade |
|---|---|---|
| **Pas d'en-têtes HTTP personnalisés** | Pas de CSP en en-tête, pas de `frame-ancestors` ni de `X-Frame-Options`, pas de HSTS configurable | CSP via `<meta http-equiv="Content-Security-Policy">`, qui ignore `frame-ancestors`. Le **contrôle des sites autorisés à embarquer** la démo se fait côté player : il lit `document.referrer` et `location.ancestorOrigins` (Chrome) et les compare à la liste du workspace dans le manifeste. C'est une protection **contournable**, à présenter comme telle. |
| **Domaine unique `sabir-art.github.io`** | **Tous les sites Pages d'un même compte GitHub partagent la même origine**, même répartis dans plusieurs dépôts. App et player auraient la même origine. Le player, exécuté chez des tiers, partagerait alors le `localStorage` où supabase-js garde la session de l'éditeur. | (1) Au MVP, le player ne lit ni n'écrit jamais la session ; aucune donnée utilisateur n'est rendue en HTML brut (textes échappés, pas de `innerHTML`) ; la CSP `<meta>` limite `script-src` à `'self'`. (2) **Recommandé avant la bêta publique** : un domaine personnalisé avec deux sous-domaines (`app.` et `play.`). Chaque site Pages accepte un domaine personnalisé, donc deux dépôts ou deux sites donnent deux origines. À défaut de domaine : publier le player depuis **une organisation GitHub distincte** (`<org>.github.io`), ce qui donne une autre origine sans frais. |
| **Pas de rendu serveur** | Démo center et pages publiques peu visibles pour le SEO ; aperçus de partage (Open Graph) identiques pour toutes les démos | Au MVP : génération statique en CI d'une page HTML par démo publiée (déclenchée par `repository_dispatch` depuis une Edge Function), sinon `noindex`. Plus tard : une Edge Function qui sert les métadonnées Open Graph. |
| **Routage SPA** | Pas de réécriture côté serveur | `HashRouter` pour le player et les liens publics, ou astuce `404.html` pour l'app |
| **Dépôt privé** | GitHub Pages sur un dépôt privé exige un plan GitHub payant, et le site publié reste **public** | Le site ne contient que du code front compilé, pas de secret. La clé publique Supabase (anon/publishable) peut y figurer, la sécurité reposant sur RLS. |
| **Quotas Pages** | Taille du site, bande passante mensuelle « souple », builds par heure limités (ordre de grandeur : 1 Go de site, 100 Go/mois ; à vérifier) | Les images et manifestes passent par **Supabase Storage**, pas par Pages. Pages ne sert que le JS et le CSS, quelques Mo. |
| **Snapshots HTML (V2)** | Exécuter du HTML capturé sur l'origine du player est dangereux | Servir le snapshot assaini depuis Supabase Storage, l'afficher dans `<iframe sandbox>` **sans** `allow-scripts` ni `allow-same-origin` (chargé via `srcdoc` après récupération). Supabase Storage pourrait servir le HTML avec un type restreint (`text/plain`) pour éviter le XSS : à vérifier, et c'est une raison de plus pour passer par `srcdoc`. |

**Embed iframe chez les clients.** Leur CSP doit autoriser `frame-src https://sabir-art.github.io` (ou le futur `play.<domaine>`). Notre player n'envoie aucun en-tête bloquant, l'embed fonctionne donc partout. Le revers : n'importe quel site peut embarquer une démo publique ; voir la parade côté player ci-dessus.

### R.5 Monorepo révisé

```
flowdsiml/
├─ apps/
│  ├─ web/            SPA Vite + React (auth, dashboard, éditeur, démo center) → GitHub Pages
│  ├─ player/         Bundle Preact + embed.js → GitHub Pages (même site au MVP, origine séparée dès que possible)
│  └─ extension/      Extension Chrome MV3 (WXT)
├─ supabase/
│  ├─ config.toml     Configuration du projet (Auth, Storage, functions)
│  ├─ migrations/     Migrations SQL horodatées (schéma, RLS, fonctions, cron, buckets)
│  ├─ functions/      Edge Functions (track, publish-worker, lead-submit, webhooks-dispatch, send-email, _shared/)
│  ├─ tests/          Tests pgTAP (RLS : un membre d'un workspace ne voit rien d'un autre)
│  └─ seed.sql        Données de développement
├─ packages/
│  ├─ db/             Types générés (supabase gen types) + client supabase-js typé
│  ├─ manifest/       Schéma Zod du manifeste (contrat éditeur ↔ player ↔ functions)
│  ├─ player-core/    Moteur de rendu des étapes et bulles
│  ├─ ui/             Design system (tokens de la Designer)
│  └─ config/         tsconfig, eslint, prettier
├─ docs/tech/ · docs/design/
└─ .github/workflows/ ci.yml · deploy.yml · extension.yml
```

Le code partagé entre les Edge Functions (Deno) et le front (Node/Vite) se limite à `packages/manifest`, importé dans Deno par chemin relatif ou via `deno.json` `imports`. Pas de dépendance Node dans ce package.

### R.6 CI/CD GitHub Actions

| Workflow | Déclencheur | Étapes |
|---|---|---|
| `ci.yml` | PR et push | `pnpm install` → lint → typecheck → tests Vitest → `supabase start` (Postgres local dans Docker) → `supabase db reset` → `supabase test db` (pgTAP) → vérification que les types générés sont à jour → build web, player, extension |
| `deploy.yml` | push sur `main` (environnement GitHub `production` protégé) | `supabase link --project-ref $SUPABASE_PROJECT_REF` → `supabase db push` → `supabase functions deploy` → `supabase secrets set` (à partir des secrets GitHub) → build Vite avec les variables publiques → `actions/upload-pages-artifact` + `actions/deploy-pages` |
| `extension.yml` | tag `ext-v*` | Build WXT → archive `.zip` en artefact de release (publication sur le Chrome Web Store manuelle, ou automatisée plus tard) |

Un second projet Supabase « staging » serait préférable pour tester les migrations avant la production. À défaut, on utilise les **branches Supabase** (option payante) ou on teste uniquement en local avec `supabase start` en CI. Décision à prendre (R.8).

**Secrets et variables GitHub Actions** (noms seulement ; les valeurs sont saisies dans *Settings → Secrets and variables → Actions*, environnement `production`) :

| Nom | Type | Usage |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | secret | Jeton personnel Supabase pour la CLI (`link`, `db push`, `functions deploy`) |
| `SUPABASE_DB_PASSWORD` | secret | Mot de passe Postgres, requis par `db push` |
| `SUPABASE_PROJECT_REF` | variable (non secrète) | `<project-ref>` |
| `VITE_SUPABASE_URL` | variable | URL du projet, injectée dans le build |
| `VITE_SUPABASE_ANON_KEY` | variable (publique par conception) | Clé anon/publishable injectée dans le front ; la sécurité repose sur RLS |
| `SMTP_*` (host, port, user, pass, from) | secrets | Configurés dans Supabase Auth (tableau de bord) ; reportés en secrets si `send-email` les utilise |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | secrets | Phase billing, poussés vers Supabase via `supabase secrets set` |
| `AI_API_KEY` (ex. `ANTHROPIC_API_KEY`) | secret | V2 |
| `WEBHOOK_SIGNING_KEY`, `TRACK_SALT` | secrets | Signature des webhooks sortants ; sel du hachage des IP |

Règles :
- la clé **`service_role`** n'est **jamais** dans le front ni dans un fichier du dépôt. Les Edge Functions la reçoivent automatiquement de Supabase ; il ne faut pas la recopier dans GitHub ;
- les jetons ne sont jamais affichés dans les logs (`::add-mask::`).

### R.7 Ce qui reste incontournable hors GitHub / Supabase

| Élément | Pourquoi on ne peut pas s'en passer | Quand |
|---|---|---|
| **SMTP personnalisé** (Brevo, Resend, Amazon SES, ou le SMTP d'un hébergeur mail existant) | Le SMTP intégré de Supabase sert aux tests. Il est limité à quelques emails par heure et n'envoie qu'aux adresses des membres de l'équipe du projet. Sans SMTP personnalisé, **aucun utilisateur externe ne peut s'inscrire** (confirmation, magic link, invitation). Il faut aussi un domaine d'envoi avec SPF et DKIM. | **Avant la bêta** (vers la semaine 9) ; en développement, le SMTP intégré suffit |
| **Chrome Web Store** (compte développeur, frais uniques modestes, vérification d'identité, politique de confidentialité publique) | Seule voie de distribution d'une extension Chrome à des utilisateurs normaux | En développement : chargement de l'extension non empaquetée (`chrome://extensions` → mode développeur). Compte à créer **vers la semaine 8**, car la revue peut prendre plusieurs jours, voire semaines |
| **Stripe** | Paiement par carte, abonnements, TVA. Supabase ne facture pas pour nous | Phase billing (fin du MVP ou V2). Avant cela, plans gérés à la main en base |
| **Clé API IA** (+ TTS pour la voix-off) | Génération des textes, traductions, voix-off | V2 |
| **Nom de domaine** | Pas strictement obligatoire, mais **fortement recommandé** : isolation app/player (R.4), domaine d'envoi d'emails, crédibilité, URL stable si on quitte un jour GitHub Pages. Faute de domaine, il faut au minimum une organisation GitHub distincte pour le player | Avant la bêta publique |
| **Google Cloud** (client OAuth) | Seulement si on active « Se connecter avec Google » | Optionnel |
| **Fournisseurs CRM** (apps OAuth HubSpot, Salesforce, Slack) | Intégrations | V2 |
| Export vidéo côté serveur, enrichissement IP → entreprise, app desktop signée | Hors des capacités des Edge Functions, ou service tiers par nature | V2/V3, à décider |

**Plan Supabase.** Un projet gratuit est **mis en pause après une période d'inactivité**, sans sauvegardes quotidiennes et avec des quotas faibles (base de quelques centaines de Mo, 1 Go de stockage). Pour la bêta et la production, il faut passer au **plan Pro**, payant mais toujours chez Supabase. Il faut le budgéter.

### R.8 Impacts sur le reste du document

- **§1** : modules inchangés. L'API publique, les webhooks et les intégrations deviennent des Edge Functions ; les workers deviennent pgmq + pg_cron.
- **§2** (capture) : recommandation inchangée. Le screenshot au MVP est encore plus pertinent, puisqu'il n'y a pas de serveur pour assainir du HTML lourd.
- **§4** (modèle de données) : inchangé, avec deux différences :
  - `users`, `auth_accounts` et `sessions` sont remplacés par `auth.users` (géré par Supabase) et une table `public.profiles` ;
  - `assets.storage_key` désigne un chemin Supabase Storage (`bucket/chemin`), et les secrets d'intégration passent dans Vault.
- **§6** (roadmap) : MVP toujours d'environ 12 semaines. Il y a moins d'infrastructure à monter (−1 semaine), mais il faut écrire et tester les politiques RLS et les contraintes de GitHub Pages (+1 semaine). L'export vidéo et ClickHouse passent en « à décider ».
- **Décisions nouvelles** :
  1. **Domaine personnalisé**, ou organisation GitHub séparée pour le player.
  2. Supabase **Pro** à partir de la bêta.
  3. Projet **staging** séparé ou tests uniquement en local.
  4. Fournisseur **SMTP**.
  5. Dépôt public ou privé : avec un dépôt privé, Pages demande un plan GitHub payant.
- **Accès nécessaires** : rôle *Developer* ou *Admin* sur le projet Supabase `<project-ref>` (pour générer `SUPABASE_ACCESS_TOKEN` et connaître le mot de passe de la base) ; droits admin sur le dépôt GitHub (secrets, environnements, activation de Pages en mode « GitHub Actions »).

### R.9 ADR révisés

| # | Décision | Statut |
|---|---|---|
| ADR-001r | Monorepo pnpm ; front en SPA Vite statique, logique serveur en Edge Functions et SQL | Proposé |
| ADR-005r | Supabase Postgres + RLS + migrations SQL (pas d'ORM) ; analytics dans des tables partitionnées + agrégats | Proposé |
| ADR-006r | Supabase Storage : buckets privés + URLs signées ; bucket public pour les versions publiées | Proposé |
| ADR-007r | Jobs asynchrones avec pgmq + pg_cron + pg_net | Proposé |
| ADR-008 | Hébergement du front et du player sur GitHub Pages ; domaine personnalisé (ou organisation séparée) requis avant la bêta pour isoler le player | Proposé |
| ADR-009 | Auth Supabase (email + mot de passe, magic link) ; SMTP personnalisé obligatoire avant toute inscription externe | Proposé |
