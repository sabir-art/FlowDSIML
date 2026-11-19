/**
 * Contrat central entre l'éditeur, le player, l'extension et les Edge Functions.
 * Le manifeste publié est IMMUABLE : chaque publication produit une nouvelle version.
 * Toute évolution incompatible incrémente MANIFEST_SCHEMA_VERSION ; le player doit
 * continuer à lire les versions antérieures.
 */
import { z } from 'zod';

export const MANIFEST_SCHEMA_VERSION = 1 as const;

/** Coordonnées relatives (0–1) au cadre de l'image de l'étape. */
export const rectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type Rect = z.infer<typeof rectSchema>;

/** L12-01 : zone masquée d'une capture (flou, pixels ou aplat de couleur, texte facultatif). */
export const maskSchema = rectSchema.extend({
  style: z.enum(['blur', 'pixels', 'solid']).default('blur').catch('blur'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#2A2F3A')
    .catch('#2A2F3A'),
  text: z.string().max(60).default('').catch(''),
  /** Zones copiées sur toutes les étapes (même position) : même identifiant de groupe. */
  group: z.string().max(40).optional().catch(undefined),
});
export type Mask = z.infer<typeof maskSchema>;

export const placementSchema = z.enum(['auto', 'top', 'bottom', 'left', 'right']);

export const hotspotActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('goto'), stepId: z.string() }),
  z.object({ type: z.literal('url'), url: z.string().url(), newTab: z.boolean().default(true) }),
  z.object({ type: z.literal('none') }),
]);
export type HotspotAction = z.infer<typeof hotspotActionSchema>;

export const ctaSchema = z.object({
  label: z.string().max(80),
  url: z.string().url(),
});
export type Cta = z.infer<typeof ctaSchema>;

export const hotspotSchema = rectSchema.extend({
  id: z.string(),
  /** Titre et corps en texte riche restreint (voir @flowdsiml/core richText). */
  title: z.string().max(200).default(''),
  body: z.string().max(4000).default(''),
  placement: placementSchema.default('auto'),
  action: hotspotActionSchema.default({ type: 'next' }),
  cta: ctaSchema.nullable().default(null),
  pulse: z.boolean().default(true),
  /** F1 : « beacon » = Walkthrough (pastille + bulle) ; « spotlight » = zone éclairée, reste assombri. */
  style: z.enum(['beacon', 'spotlight']).default('beacon').catch('beacon'),
});
export type Hotspot = z.infer<typeof hotspotSchema>;

export const zoomSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().min(1).max(4),
  /** L12-02 : « smooth » glisse depuis l'état précédent, « instant » saute directement. */
  transition: z.enum(['smooth', 'instant']).default('smooth').catch('smooth'),
  /** L12-02 : l'étape suivante (sans zoom propre) garde ce zoom. */
  keep: z.boolean().default(false).catch(false),
});
export type Zoom = z.infer<typeof zoomSchema>;

export const imageRefSchema = z.object({
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type ImageRef = z.infer<typeof imageRefSchema>;

/**
 * F1 : destination d'un choix de parcours (étape, chapitre, fin de la démo ou lien).
 * L22-09 : « next » = étape suivante dans l'ordre courant (suit les réordonnancements).
 */
export const choiceActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('goto'), stepId: z.string() }),
  z.object({ type: z.literal('chapter'), chapterId: z.string() }),
  z.object({ type: z.literal('end') }),
  z.object({ type: z.literal('url'), url: z.string().url().startsWith('https://') }),
]);
export type ChoiceAction = z.infer<typeof choiceActionSchema>;

/** F1 : choix de parcours (« Vous êtes conseiller → parcours A »). */
export const choiceSchema = z.object({ label: z.string().max(80), action: choiceActionSchema });
export type Choice = z.infer<typeof choiceSchema>;

/**
 * L22 : règle de branchement automatique. En quittant l'étape (« Suivant »), la première règle dont
 * la condition est vraie choisit la destination ; sinon, étape suivante. Les conditions portent sur
 * les choix faits plus tôt dans la session (menu de choix) ou sur les réponses au quiz.
 */
/**
 * L25-10 : condition déclarative d'une règle de suite. Opérateurs en liste fermée ; aucune
 * expression n'est jamais évaluée (ni eval ni Function) : le lecteur compare des chaînes ou des nombres.
 * Sources : variable {{clé}}, réponse au menu de choix d'une étape, score du quiz (%), variante A/B.
 */
export const RULE_OPS = ['is', 'isNot', 'contains', 'lt', 'gt'] as const;
export type RuleOp = (typeof RULE_OPS)[number];
export const condSchema = z
  .object({
    source: z.enum(['var', 'answer', 'score', 'ab']),
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,39}$/)
      .optional(),
    stepId: z.string().max(40).optional(),
    op: z.enum(RULE_OPS),
    value: z.string().max(200),
  })
  .strict();
export type RuleCond = z.infer<typeof condSchema>;
export const ruleSchema = z.object({
  when: z.union([
    z.object({ choice: z.object({ stepId: z.string(), index: z.number().int().min(0).max(5) }) }),
    z.object({ quiz: z.object({ questionId: z.string(), answerId: z.string() }) }),
    z.object({ cond: condSchema }),
  ]),
  goto: choiceActionSchema,
});
export type Rule = z.infer<typeof ruleSchema>;

/**
 * L22-09 : règles de suite d'un menu de choix, telles que saisies dans l'éditeur. `rules` liste, dans
 * l'ordre, les réponses qui ont leur propre règle : leur destination est celle du choix (que la copie
 * d'une démo remappe déjà). Les autres réponses suivent `else`. Le lecteur lit seulement les choix.
 */
export const branchSchema = z.object({
  rules: z.array(z.number().int().min(0).max(5)).max(6).catch([]),
  else: choiceActionSchema.catch({ type: 'next' }),
});
export type Branch = z.infer<typeof branchSchema>;

/** F1 : options d'affichage d'une étape (pop-up, variante, menu de choix). */
export const stepOptionsSchema = z
  .object({
    /** « popup » : carte centrée par-dessus l'écran précédent ; « screen » : écran plein. */
    display: z.enum(['screen', 'popup']).default('screen').catch('screen'),
    variant: z.enum(['info', 'instruction']).default('info').catch('info'),
    /** Fond d'une pop-up : capture précédente floutée, ou couleur unie. */
    background: z.enum(['blur', 'color']).default('blur').catch('blur'),
    bgColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#080808')
      .catch('#080808'),
    showIcon: z.boolean().default(true).catch(true),
    /** Libellé du bouton principal (vide = « Suivant »). */
    buttonLabel: z.string().max(40).default('').catch(''),
    /** L12-05 : libellé de « Précédent » dans la bulle (vide = thème) et affichage du bouton. */
    prevLabel: z.string().max(24).default('').catch(''),
    showPrev: z.boolean().default(false).catch(false),
    /** Choix invalides ignorés un par un (un lien mal formé n'invalide pas la démo). */
    choices: z
      .array(z.unknown())
      .max(6)
      .default([])
      .catch([])
      .transform((list) =>
        list.flatMap((c) => {
          const r = choiceSchema.safeParse(c);
          return r.success ? [r.data] : [];
        }),
      ),
    /** L22-09 : règles de suite du menu de choix (absentes sur les menus créés avant L22). */
    branch: branchSchema.optional().catch(undefined),
    /** L25-06 : onglet de la capture (numéro d'ordre et titre), écrit par l'extension. */
    tab: z
      .object({ n: z.number().int().min(1).max(50), title: z.string().max(120) })
      .optional()
      .catch(undefined),
    /**
     * L25-02 : recadrage non destructif (zone gardée, relative à l'image d'origine). Hotspots,
     * flous, zoom et champ de la saisie sont relatifs au cadre recadré.
     */
    crop: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0.02).max(1),
        h: z.number().min(0.02).max(1),
      })
      .optional()
      .catch(undefined),
    /**
     * L25-04/05 : animation jouée à l'arrivée sur l'étape, avant la bulle. Une seule par étape.
     * Saisie : texte (variables possibles) écrit dans le champ repéré ; défilement : la capture pleine
     * page défile jusqu'à la position d'arrivée (distance en pixels de l'image).
     */
    animation: z
      .discriminatedUnion('type', [
        z.object({
          type: z.literal('typing'),
          text: z.string().max(200),
          field: z
            .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
            .nullable()
            .default(null),
          fieldLabel: z.string().max(80).default(''),
          speed: z.enum(['slow', 'normal', 'fast']).default('normal').catch('normal'),
        }),
        z.object({
          type: z.literal('scroll'),
          direction: z.enum(['down', 'up']).default('down').catch('down'),
          distance: z.number().min(0).max(30000),
          duration: z
            .union([z.literal(0.6), z.literal(1.2), z.literal(2)])
            .default(1.2)
            .catch(1.2),
        }),
      ])
      .optional()
      .catch(undefined),
    /** L25-06 : onglet d'origine de la capture, gardé quand l'éditeur rattache l'étape à un autre onglet. */
    tabCaptured: z
      .object({ n: z.number().int().min(1).max(50), title: z.string().max(120) })
      .optional()
      .catch(undefined),
    /** L25-06 : onglets affichés dans la barre du navigateur (absent : affichés). */
    showTabs: z.boolean().optional().catch(undefined),
    /**
     * L25-01 : capture de la page entière (animation de défilement). `path` dans l'éditeur (stockage),
     * `url` dans le manifeste publié ; `top` et `viewportHeight` en pixels de l'image.
     */
    fullPage: z
      .object({
        path: z.string().optional(),
        url: z.string().optional(),
        width: z.number().positive(),
        height: z.number().positive(),
        top: z.number().min(0),
        viewportHeight: z.number().positive(),
      })
      .optional()
      .catch(undefined),
    /** L25-10 : « Sinon, aller à » des règles de suite (absent : étape suivante). */
    rulesElse: choiceActionSchema.optional().catch(undefined),
    /** L22 : règles de branchement automatique (une règle invalide est ignorée seule). */
    rules: z
      .array(z.unknown())
      .max(10)
      .default([])
      .catch([])
      .transform((list) =>
        list.flatMap((r) => {
          const p = ruleSchema.safeParse(r);
          return p.success ? [p.data] : [];
        }),
      ),
  })
  .default({
    display: 'screen',
    variant: 'info',
    background: 'blur',
    bgColor: '#080808',
    showIcon: true,
    buttonLabel: '',
    prevLabel: '',
    showPrev: false,
    choices: [],
    rules: [],
  });
export type StepOptions = z.infer<typeof stepOptionsSchema>;
export type StepAnimation = NonNullable<StepOptions['animation']>;

/**
 * L17 : étape Avant / Après. L'image principale de l'étape est « Maintenant » ; `before` est la
 * capture « Avant » (ses zones floutées dans `beforeBlurs`). Disposition : côte à côte, curseur ou
 * bascule (imposée sous 640 px par le lecteur).
 */
export const beforeAfterSchema = z.object({
  layout: z.enum(['side', 'slider', 'toggle']).default('side').catch('side'),
  labels: z
    .object({
      before: z.string().max(20).default('').catch(''),
      after: z.string().max(20).default('').catch(''),
    })
    .default({ before: '', after: '' })
    .catch({ before: '', after: '' }),
  notes: z
    .object({
      before: z.string().max(140).default('').catch(''),
      after: z.string().max(140).default('').catch(''),
    })
    .default({ before: '', after: '' })
    .catch({ before: '', after: '' }),
  before: imageRefSchema,
  beforeBlurs: z.array(maskSchema).default([]).catch([]),
});
export type BeforeAfter = z.infer<typeof beforeAfterSchema>;

/** L17 : terme du glossaire du workspace (nouveau terme, ancien terme barré, autres formes). */
export const glossaryTermSchema = z.object({
  term: z.string().min(1).max(60),
  oldTerm: z.string().max(60).nullable().default(null).catch(null),
  definition: z.string().min(1).max(140),
  forms: z.array(z.string().min(1).max(60)).max(10).default([]).catch([]),
});
export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;

/** F7 : vidéo de l'onglet (temps en millisecondes, dans la vidéo d'origine). */
export const videoSchema = z.object({
  url: z.string(),
  durationMs: z.number().int().min(1).max(600000),
  /** Passages retirés au montage. */
  cuts: z
    .array(z.object({ from: z.number(), to: z.number() }))
    .max(50)
    .default([]),
  /** Pauses-étapes : la vidéo s'arrête et affiche une bulle. */
  pauses: z
    .array(
      z.object({
        id: z.string().max(40),
        t: z.number().min(0),
        title: z.string().max(200).default(''),
        body: z.string().max(2000).default(''),
      }),
    )
    .max(50)
    .default([]),
  captions: z
    .array(z.object({ from: z.number(), to: z.number(), text: z.string().max(200) }))
    .max(500)
    .default([]),
  captionsDefault: z.boolean().default(false),
  autoplayMuted: z.boolean().default(true),
  hasVoice: z.boolean().default(false),
  /** Image de chaque pause (PDF, conversion en captures). */
  frames: z.record(z.string(), z.string()).default({}),
});
export type VideoStep = z.infer<typeof videoSchema>;

/** A8 : page HTML capturée (servie en iframe srcdoc sandbox) et ses opérations. */
/** L25-07 : style en liste blanche stricte (aucune chaîne CSS libre). */
export const htmlStyleSchema = z
  .object({
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    background: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    fontSize: z.number().min(8).max(96).optional(),
    fontWeight: z.enum(['400', '600', '700']).optional(),
  })
  .strict();
/** L25-08 : graphique redessiné par le lecteur (valeurs toujours écrites). */
export const htmlChartSchema = z
  .object({
    type: z.enum(['bar', 'line', 'donut']),
    rows: z
      .array(z.object({ label: z.string().max(40), value: z.number().finite() }).strict())
      .min(1)
      .max(12),
    title: z.string().max(120).optional(),
  })
  .strict();
export type HtmlChartValue = z.infer<typeof htmlChartSchema>;
export const htmlOpSchema = z.object({
  id: z.string().max(40),
  sel: z.string().min(1).max(500),
  op: z.enum(['text', 'hide', 'blur', 'link', 'image', 'remove', 'style', 'chart']),
  sels: z.array(z.string().min(1).max(500)).min(1).max(200).optional(),
  value: z.union([z.string().max(5000), htmlStyleSchema, htmlChartSchema]).optional(),
  before: z.string().max(5000).optional(),
  scope: z.enum(['step', 'all']).default('step'),
  group: z.string().max(40).optional(),
});
export type HtmlOp = z.infer<typeof htmlOpSchema>;
export const htmlStepSchema = z.object({
  url: z.string(),
  ops: z
    .array(htmlOpSchema.catch(null as never))
    .max(500)
    .default([])
    .transform((a) => a.filter(Boolean)),
  title: z.string().max(200).default(''),
  viewport: z.object({ w: z.number(), h: z.number() }).nullable().default(null).catch(null),
  /** Liens de la page déjà résolus vers une autre page de la démo (liaison automatique). */
  links: z
    .array(z.object({ sel: z.string().max(500), step: z.string().max(40) }))
    .max(300)
    .default([])
    .catch([]),
});
export type HtmlStep = z.infer<typeof htmlStepSchema>;

/** A8 : réglages d'une démo Sandbox (navigation libre). */
export const sandboxSchema = z.object({
  start: z.string().nullable().default(null),
  autoLink: z.boolean().default(true),
  unlinked: z.enum(['toast', 'none', 'highlight']).default('toast').catch('toast'),
  guide: z.boolean().default(false),
  keyPages: z.array(z.string()).max(200).default([]),
});
export type SandboxSettings = z.infer<typeof sandboxSchema>;

export const stepSchema = z.object({
  id: z.string(),
  chapterId: z.string().nullable().default(null),
  kind: z.enum(['image', 'text', 'html', 'before_after', 'video']),
  /** F7 : pour kind = video (null si le fichier manque). */
  video: videoSchema.nullable().default(null).catch(null),
  /** A8 : pour kind = html (null si la page manque). */
  html: htmlStepSchema.nullable().default(null).catch(null),
  /** L17 : pour kind = before_after (null si la capture « Avant » manque). */
  beforeAfter: beforeAfterSchema.nullable().default(null).catch(null),
  /** Pour kind = image (MVP). */
  image: imageRefSchema.nullable().default(null),
  /** Pour kind = html (V2) : URL du snapshot assaini. */
  snapshotUrl: z.string().nullable().default(null),
  /** Pour kind = text : écran de titre / transition. */
  title: z.string().max(200).default(''),
  body: z.string().max(4000).default(''),
  hotspots: z.array(hotspotSchema).default([]),
  blurs: z.array(maskSchema).default([]),
  zoom: zoomSchema.nullable().default(null),
  /** Formulaire de lead affiché avant cette étape. */
  gateFormId: z.string().nullable().default(null),
  cta: ctaSchema.nullable().default(null),
  options: stepOptionsSchema,
});
export type Step = z.infer<typeof stepSchema>;

/**
 * F2 : question de quiz (réponses : 2 à 6 ; vrai/faux : 2 réponses fixes). L19 : en mode Sondage,
 * note de 0 à 10 (nps) et réponse écrite (text, 500 caractères), sans réponses proposées.
 */
export const quizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['single', 'multiple', 'truefalse', 'nps', 'text']),
  prompt: z.string().max(200),
  answers: z
    .array(z.object({ id: z.string(), label: z.string().max(200), correct: z.boolean().default(false) }))
    .max(6)
    .default([]),
  explanation: z.string().max(1000).default(''),
  stepId: z.string().nullable().default(null),
  points: z.number().int().min(1).max(100).default(1),
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

/** F2 : quiz de validation du module (ou sondage : même moteur, sans bonne réponse ni seuil). */
export const quizSchema = z.object({
  mode: z.enum(['quiz', 'survey']).default('quiz').catch('quiz'),
  threshold: z.number().int().min(0).max(100).default(70),
  /** 0 = illimitées. */
  attempts: z.number().int().min(0).max(5).default(3),
  feedback: z.enum(['each', 'end']).default('each').catch('each'),
  shuffle: z.boolean().default(true),
  required: z.boolean().default(true),
  questions: z.array(quizQuestionSchema).min(1),
});
export type Quiz = z.infer<typeof quizSchema>;

export const chapterSchema = z.object({ id: z.string(), title: z.string().max(120) });
export type Chapter = z.infer<typeof chapterSchema>;

/** L25-03 : cadre du navigateur (style, barre d'adresse, onglets, boutons de fenêtre, téléphone). */
export const frameSchema = z.object({
  style: z.enum(['light', 'dark', 'minimal', 'none']).default('light').catch('light'),
  addressBar: z.boolean().default(true).catch(true),
  address: z.string().max(120).default('').catch(''),
  tabs: z.boolean().default(false).catch(false),
  tabTitle: z.string().max(80).default('').catch(''),
  windowButtons: z.boolean().default(true).catch(true),
  /** Démo mobile (L21) : cadre du téléphone affiché. */
  phone: z.boolean().default(true).catch(true),
});
export type Frame = z.infer<typeof frameSchema>;
export const DEFAULT_FRAME: Frame = frameSchema.parse({});

export const themeSchema = z.object({
  // Valeurs par défaut = tokens --fd-player-* (packages/ui/src/tokens.ts)
  // Charte DSI des Missions Locales (refonte) : prune, framboise, fond ardoise 100
  primary: z.string().default('#A3195B'),
  hotspot: z.string().default('#D60B52'),
  background: z.string().default('#EEF2F6'),
  surface: z.string().default('#FFFFFF'),
  text: z.string().default('#080808'),
  /** L18 : texte des boutons sur la couleur principale (noir sur le Vert DSI, par exemple). */
  onPrimary: z.string().default('#FFFFFF').catch('#FFFFFF'),
  fontFamily: z.string().default("'Plus Jakarta Sans', system-ui, sans-serif"),
  radius: z.number().min(0).max(32).default(20),
  /** L18 : arrondi des boutons (999 = pilule). */
  buttonRadius: z.number().min(0).max(999).default(999).catch(999),
  logoUrl: z.string().nullable().default(null),
  /** L18 : police importée dans la médiathèque (WOFF2, https), utilisée sous le nom CUSTOM_FONT. */
  fontUrl: z.string().startsWith('https://').nullable().default(null).catch(null),
  showBranding: z.boolean().default(true),
  /** Fond dégradé du lecteur (maquette editeur.html, onglet Design › Cadre). */
  backgroundGradient: z.boolean().default(false),
  /**
   * L25-03 : cadre du navigateur autour des captures (toute la démo). Absent dans les manifestes
   * publiés avant L25 : pas de cadre. L'adresse affichée n'est jamais celle de la capture d'office :
   * seule une adresse saisie dans l'éditeur est publiée.
   */
  frame: frameSchema.optional().catch(undefined),
});
export type Theme = z.infer<typeof themeSchema>;

export const variableSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().max(80).default(''),
  default: z.string().max(200).default(''),
});
export type Variable = z.infer<typeof variableSchema>;

export const formFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().max(80),
  type: z.enum(['email', 'text', 'tel']),
  required: z.boolean().default(false),
});
export const formSchema = z.object({
  id: z.string(),
  title: z.string().max(120),
  description: z.string().max(500).default(''),
  submitLabel: z.string().max(40).default('Continuer'),
  fields: z.array(formFieldSchema).min(1),
  consentText: z.string().max(500).default(''),
  skippable: z.boolean().default(false),
});
export type LeadForm = z.infer<typeof formSchema>;

/** L25-09 : liaison d'une colonne (élément d'une étape HTML, graphique, variable). */
export const datasetBindingSchema = z.object({
  column: z.string().max(60),
  kind: z.enum(['element', 'chart', 'variable']),
  stepId: z.string().max(40).optional(),
  sel: z.string().max(500).optional(),
  opId: z.string().max(40).optional(),
  key: z.string().max(40).optional(),
  label: z.string().max(120).optional(),
});
export type DatasetBinding = z.infer<typeof datasetBindingSchema>;
export const datasetSchema = z.object({
  columns: z.array(z.string().max(60)).max(20),
  rows: z.array(z.array(z.string().max(200)).max(20)).max(1000),
  bindings: z
    .array(datasetBindingSchema.catch(null as never))
    .max(40)
    .default([])
    .transform((a) => a.filter(Boolean)),
  rowMode: z.enum(['link', 'first']).default('first').catch('first'),
  linkColumn: z.string().max(60).nullable().default(null),
});
export type Dataset = z.infer<typeof datasetSchema>;

export const manifestSchema = z.object({
  schemaVersion: z.literal(MANIFEST_SCHEMA_VERSION),
  demoId: z.string(),
  versionId: z.string(),
  workspaceId: z.string(),
  /** PLY-01 : nom du workspace (en-tête du lecteur, « Données traitées par … »). Absent avant la migration 131500. */
  workspaceName: z.string().max(120).default('').catch(''),
  /** F7 : démo capturée au format mobile (cadre téléphone, feuille du bas, « Touchez »). */
  device: z.enum(['desktop', 'mobile']).default('desktop').catch('desktop'),
  viewport: z.object({ w: z.number(), h: z.number() }).nullable().default(null).catch(null),
  /** A8 : démo guidée ou Sandbox (navigation libre entre pages HTML reliées). */
  kind: z.enum(['guided', 'sandbox']).default('guided').catch('guided'),
  sandbox: sandboxSchema.nullable().default(null).catch(null),
  title: z.string(),
  locale: z.string().default('fr'),
  publishedAt: z.string(),
  theme: themeSchema,
  variables: z.array(variableSchema).default([]),
  chapters: z.array(chapterSchema).default([]),
  steps: z.array(stepSchema).min(1),
  forms: z.array(formSchema).default([]),
  /** Origines autorisées à embarquer la démo (vide = toutes). Contrôle côté player, contournable. */
  allowedEmbedOrigins: z.array(z.string()).default([]),
  /** F1 : checklist de progression (un élément par chapitre, sinon par étape) dans le player. */
  checklist: z
    .object({
      title: z.string().max(80).default(''),
      position: z.enum(['left', 'right', 'collapsed']).default('right').catch('right'),
    })
    .nullable()
    .default(null)
    .catch(null),
  /** F1 : lecture automatique (avance seule après delayMs, avec pause). */
  autoplay: z
    .object({
      enabled: z.boolean().default(false),
      delayMs: z.number().int().min(1500).max(30000).default(4000),
    })
    .nullable()
    .default(null)
    .catch(null),
  /** F2 : quiz après la dernière étape (null si le module n'en a pas). */
  quiz: quizSchema.nullable().default(null).catch(null),
  /** Bouton d'action du client, affiché en permanence dans la barre du player (P6). */
  cta: ctaSchema.nullable().default(null),
  /** P13 : politique de confidentialité du workspace (https), affichée sous les formulaires de lead. */
  privacyUrl: z.string().url().startsWith('https://').nullable().default(null).catch(null),
  /**
   * L17 : termes du glossaire présents dans la démo (préfiltre serveur), null si le soulignement est
   * désactivé pour le workspace ou la démo. Un terme invalide est ignoré seul.
   */
  glossary: z
    .array(z.unknown())
    .max(500)
    .nullable()
    .default(null)
    .catch(null)
    .transform((list) =>
      list === null
        ? null
        : list.flatMap((t) => {
            const r = glossaryTermSchema.safeParse(t);
            return r.success ? [r.data] : [];
          }),
    ),
  /**
   * L18 : test A/B en cours (une seule bulle par démo). Le lecteur tire la variante une fois par
   * visiteur (A ou B, mémorisée localement) et marque ses événements (props.abt, props.abv).
   */
  ab: z
    .object({
      testId: z.string(),
      hotspotId: z.string(),
      splitB: z.number().int().min(10).max(90),
      b: z.object({
        title: z.string().max(200).default(''),
        body: z.string().max(4000).default(''),
        cta: ctaSchema.nullable().default(null),
      }),
    })
    .nullable()
    .default(null)
    .catch(null),
  /**
   * L25-09 : jeu de données publié, réduit aux colonnes liées (et à la colonne de correspondance).
   * Ligne choisie selon le lien personnalisé (colonne = variable) ou toujours la première.
   */
  dataset: datasetSchema.nullable().default(null).catch(null),
  /** URL de l'endpoint d'ingestion analytics. */
  trackUrl: z.string().nullable().default(null),
});
export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(input: unknown): Manifest {
  return manifestSchema.parse(input);
}

/** Événements analytics émis par le player. */
export const eventTypeSchema = z.enum([
  'demo_view',
  'step_view',
  'hotspot_click',
  'cta_click',
  'form_view',
  'form_submit',
  'demo_complete',
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const trackEventSchema = z.object({
  type: eventTypeSchema,
  stepId: z.string().nullable().optional(),
  hotspotId: z.string().nullable().optional(),
  stepIndex: z.number().int().min(0).optional(),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  at: z.string().optional(),
});
export const trackBatchSchema = z.object({
  demoId: z.string().uuid(),
  versionId: z.string().uuid(),
  linkToken: z.string().max(64).nullable().optional(),
  visitorId: z.string().min(8).max(64),
  sessionId: z.string().min(8).max(64),
  referrer: z.string().max(500).nullable().optional(),
  embedOrigin: z.string().max(300).nullable().optional(),
  events: z.array(trackEventSchema).min(1).max(50),
});
export type TrackBatch = z.infer<typeof trackBatchSchema>;
