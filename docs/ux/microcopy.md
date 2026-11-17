# FlowDSIML : microcopie FR / EN

> Livrable 5 de la phase 2, design. Le texte de l'interface fait partie du design : ce guide fixe le ton, les règles et le vocabulaire.
> **Les chaînes elles-mêmes sont dans** `docs/ux/i18n/fr.json` et `docs/ux/i18n/en.json`, structurés pour i18next et prêts à copier dans l'app (décision D5 : FR et EN, FR par défaut).
> Vérification de cohérence (mêmes clés, mêmes variables) : `python3 docs/ux/tools/i18n-check.py docs/ux/i18n/fr.json docs/ux/i18n/en.json`.

---

## 1. Voix et ton

**FlowDSIML parle comme un collègue expérimenté** : clair, direct, chaleureux sans familiarité. On aide les gens à montrer leur produit. On ne les impressionne pas avec le nôtre.

| On est… | …mais pas |
|---|---|
| Clair : un mot simple plutôt qu'un mot technique | Jargonneux (« instancier », « payload ») |
| Direct : l'action d'abord | Bavard, ou avec des formules de politesse en cascade |
| Chaleureux : on encourage à la première démo | Infantilisant (« Youpi ! », emojis partout) |
| Honnête : on dit ce qui se passe, y compris nos erreurs | Vague (« Une erreur est survenue » sans issue) |

Le ton s'adapte au moment :
- **Onboarding et états vides** : encourageant, orienté vers la première réussite. **Aucun emoji** dans l'interface (« Bienvenue, Camille »).
- **Travail dans l'éditeur** : neutre et concis, on ne dérange pas.
- **Erreurs et actions destructives** : calme et précis. Jamais d'humour.
- **Player (côté prospect)** : c'est la voix de **notre client**, pas la nôtre. Les textes par défaut restent sobres et neutres, la marque FlowDSIML s'efface (sauf le filigrane du plan Free).

## 2. Règles d'écriture

### 2.1 Français
- **Vouvoiement** partout. Écriture inclusive limitée au point médian pour les participes visibles par les prospects (« recontacté·e »). Ailleurs, on reformule de façon épicène (« les membres », « votre équipe »).
- **Boutons et actions** : verbe à l'**infinitif** et objet explicite. « Créer une démo », « Copier le lien », « Supprimer la démo ». Pas d'impératif sur les boutons (« Créez »), sauf dans les titres d'onboarding.
- **Titres** : phrase normale, majuscule au premier mot seulement (« Partager la démo », pas « Partager La Démo »).
- **Typographie française** : espace insécable (U+00A0, ou U+202F avant `; ! ?`) avant `: ; ! ? %` ; guillemets « … » avec espaces insécables ; points de suspension `…` (un seul caractère) ; apostrophe typographique `’` acceptée, `'` toléré dans le code.
- **Nombres** : séparateur de milliers = espace fine insécable (« 4 812 ») ; décimales avec une virgule (« 4,1 % ») ; à générer avec `Intl.NumberFormat('fr-FR')`, jamais à la main.
- **Dates** : « 17 nov. 2026 » (court), « 17 novembre 2026 à 14:32 » (long) ; relatives jusqu'à 7 jours (« il y a 2 h », « hier »), absolues au-delà. `Intl.DateTimeFormat` et `Intl.RelativeTimeFormat`.
- **Anglicismes** : on garde les termes du métier que nos utilisateurs emploient (lead, hotspot, embed, workspace, CTA). On traduit le reste (« intégrer » plutôt qu'« embedder » dans les libellés, « tableau de bord », « paramètres »).

### 2.2 Anglais
- **Sentence case** partout (« Share demo », « Plans & billing » : l'esperluette est acceptée dans la navigation uniquement).
- Contractions autorisées (« don't », « you'll »), ton naturel.
- Orthographe **américaine** (color, behavior, analyze).
- Nombres et dates via `Intl` (`en-US`) : « 4,812 », « Nov 17, 2026 ».

### 2.3 Dans les deux langues
- **Une idée par phrase.** Les phrases d'aide font au maximum 2 lignes.
- **Messages d'erreur** : ce qui s'est passé, puis quoi faire (« Saisissez une adresse email valide, par exemple nom@entreprise.com. »). Pas de « Erreur : », pas de code en premier plan, pas de reproche (« Vous avez saisi… »).
- **Confirmations destructives** : le titre reprend l'objet (« Supprimer “Nom” ? »), le corps dit ce qui sera perdu et ce qui est conservé, le bouton répète l'action (« Supprimer la démo »), jamais « OK » ni « Oui ».
- **Toasts** : participe passé ou constat court (« Lien copié », « Démo archivée »), avec une action d'annulation quand c'est possible.
- **Placeholders** : un exemple, pas une consigne (« nom@entreprise.com », « Ex. : Nouveau rapport »). La consigne va dans l'aide.
- **Limites de longueur** : bouton ≤ 24 caractères (FR) ; titre de bulle ≤ 60 ; texte de bulle conseillé ≤ 280. Le français est environ 20 % plus long que l'anglais : on conçoit à partir du FR.

## 3. Glossaire

| Concept | FR (interface) | EN (interface) | À éviter |
|---|---|---|---|
| Démo interactive | démo | demo | guideflow, tour, flow (dans l'UI) |
| Étape d'une démo | étape | step | slide, écran |
| Point cliquable pulsant | hotspot | hotspot | point chaud, beacon |
| Bulle d'explication | bulle | tooltip | infobulle (réservé aux infobulles de l'app) |
| Zone mise en évidence | zone | area | walkthrough |
| Carte sans cible | libre | free | spotlight |
| Pop-up de début ou de fin | pop-up · écran de fin | pop-up · end screen | modal |
| Bouton d'action principal | CTA (bouton principal) | CTA (primary button) | call-to-action en toutes lettres |
| Formulaire de capture | formulaire de lead | lead form | gate |
| Contact collecté | lead | lead | prospect (sauf en prose) |
| Visiteur de la démo | visiteur | visitor / viewer | utilisateur (ambigu avec nos utilisateurs) |
| Utilisateur de FlowDSIML | membre | member | user |
| Espace de travail | workspace | workspace | organisation, compte |
| Mettre en ligne | publier | publish | déployer, mettre en prod |
| Version en ligne | version publiée | published version | live |
| Intégration iframe | intégrer · code d'intégration | embed · embed code | embedder |
| Lien par prospect | lien personnalisé | custom link | lien tracké |
| Champ dynamique | variable | variable | token, merge tag (sauf pour parler de l'outil d'emailing) |
| Masquage de données | flou | blur | pixellisation (c'est un style de flou) |
| Rôles (D8) | Propriétaire · Admin · Éditeur · Lecteur | Owner · Admin · Editor · Viewer | Manager, Guest |
| Fin de parcours atteinte | démo terminée · complétion | completed · completion | conversion (réservé au CTA ou au formulaire) |
| Quitter avant la fin | abandon | drop-off | churn |

## 4. Conventions techniques (i18n)

- **Bibliothèque** : i18next (`react-i18next`) recommandée. Un fichier par langue (`fr.json`, `en.json`), clés imbriquées par écran : `common`, `nav`, `auth`, `onboarding`, `extension`, `dashboard`, `editor`, `share`, `player`, `analytics`, `settings`, `billing`, `empty`, `errors`, `validation`, `toasts`, `a11y`.
- **Pluriels** : suffixes i18next `_one` et `_other` (« steps_one », « steps_other »), avec `t('dashboard.card.steps', { count })`. Le français traite 0 comme du singulier (« 0 vue »), ce que i18next gère via `Intl.PluralRules`.
- **Interpolation** : `{{name}}`. ⚠️ **Conflit avec les variables de démo** (`{{first_name}}`), qui ont la même syntaxe. Règle :
  1. Les fichiers i18n n'écrivent **jamais** une variable de démo en dur. Pour afficher un exemple, on la passe en paramètre : `t('share.urlParamsHelp', { example: '?first_name={{contact.firstname}}' })`, avec `interpolation: { escapeValue: false }` sur ce composant seulement, ou un composant `<Trans>`.
  2. Le **player** n'utilise pas i18next pour les textes de démo : il résout lui-même les variables de démo dans le contenu saisi par le créateur. Seuls les libellés système du player (`player.*`) passent par i18n.
- **Balises riches** : `<terms>…</terms>` ou `<privacy>…</privacy>` dans `auth.signup.terms`, à rendre avec `<Trans components={{ terms: <a/>, privacy: <a/> }}>`.
- **Langue du player** = langue de la démo, et non celle du navigateur ou de l'app. Les libellés système `player.*` existent dans les deux langues ; une démo dans une autre langue (V2) reçoit ses libellés système de sa traduction.
- **Ne pas concaténer** des fragments traduits (« Démo » + « publiée ») : une phrase = une clé.
- **Nouveaux textes** : ajouter la clé dans les **deux** fichiers dans le même commit, puis lancer `i18n-check.py` (à brancher en CI).

## 5. Textes clés, référence rapide

| Moment | FR | EN |
|---|---|---|
| Bouton principal du dashboard | Nouvelle démo | New demo |
| Publication | Publier · « Démo publiée · les visiteurs voient la nouvelle version » | Publish · "Demo published · viewers now see the new version" |
| Sauvegarde automatique | Enregistrement… → Enregistré | Saving… → Saved |
| Modifications en attente | Modifications non publiées | Unpublished changes |
| Lancement du player | Lancer la démo · « Environ 1 min · aucune inscription » | Start demo · "About 1 min · no sign-up" |
| Fin de démo par défaut | Réserver une démo · Recommencer la visite | Book a demo · Restart the tour |
| Filigrane | Fait avec FlowDSIML | Made with FlowDSIML |
| Consentement par défaut | J'accepte d'être recontacté·e par {{company}}. | I agree to be contacted by {{company}}. |
| Limite atteinte | Vous avez atteint la limite de 5 démos publiées | You've reached the limit of 5 published demos |

Les textes de démo par défaut (bulle d'exemple, écran de fin) servent de **modèles**. L'éditeur les présente comme des placeholders modifiables, et non comme du contenu publié tel quel.
