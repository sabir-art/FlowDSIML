/**
 * L41 (spec UX l41-console-modeles-ia, docs/tech/ia-fournisseurs.md §4) : onglet Console « Modèles IA ».
 * Étape 2 : en-tête et section Fournisseurs. Les clés passent par l'Edge Function `ai` (actions console_*) :
 * collée une seule fois, testée, enregistrée dans le coffre seulement si le test réussit, jamais
 * réaffichée (ni en clair, ni masquée, ni ses derniers caractères). Lecture seule : tout est visible,
 * les actions sont désactivées.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  GripVertical,
  History,
  KeyRound,
  Plug,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Modal, Select } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { WriteButton, useConsoleRole } from './shared';
import '../../components/ai/ai.css';

type Provider = 'anthropic' | 'openai' | 'elevenlabs';
interface ProviderState {
  provider: Provider;
  label: string;
  state: 'connected' | 'refused' | 'missing';
  source: 'vault' | 'env' | null;
  addedAt: string | null;
  lastTest: { at: string; ok: boolean; cause: string | null; ms: number | null } | null;
}

type Fn = 'assistant' | 'write' | 'suggest' | 'translate' | 'voice' | 'captions';
interface FnState {
  fn: Fn;
  status: 'active' | 'fallback' | 'cut' | 'off';
  chosen: string;
  model: string | null;
  provider: Provider | null;
  explicit: boolean;
  choices: Array<{
    id: string;
    label: string;
    provider: Provider;
    speed: number;
    cost: number;
    available: boolean;
  }>;
}
const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  elevenlabs: 'ElevenLabs',
};

/** Appel d'une action de la Console sur l'Edge Function `ai` ; erreur : code et cause seulement. */
async function consoleAi<T>(action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('ai', { body: { action, ...extra } });
  if (!error) return { ok: true as const, result: (data as { result: T }).result };
  let body: { error?: string; cause?: string; status?: number } = {};
  const ctx = (error as { context?: Response }).context;
  try {
    if (ctx && typeof ctx.json === 'function') body = await ctx.json();
  } catch {
    /* corps illisible : erreur générique */
  }
  return { ok: false as const, error: body.error ?? 'NETWORK', cause: body.cause, status: body.status };
}

export function Models() {
  const { t, i18n } = useTranslation();
  const [list, setList] = useState<ProviderState[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [keyFor, setKeyFor] = useState<ProviderState | null>(null);
  const [fns, setFns] = useState<FnState[] | null>(null);
  // Règles d'Auto dont le modèle n'est plus proposé (signalées par la section de l'assistant)
  const [ruleWarn, setRuleWarn] = useState<string[]>([]);
  const load = useCallback(() => {
    void consoleAi<ProviderState[]>('console_providers').then((r) => {
      if (r.ok) setList(r.result);
      else setFailed(true);
    });
    // L41 étape 3 : modèle par fonction (l'état dépend des clés : rechargé avec elles)
    void consoleAi<FnState[]>('console_functions').then((r) => r.ok && setFns(r.result));
  }, []);
  useEffect(load, [load]);

  if (failed)
    return (
      <p className="alert alert-danger" role="alert">
        {t('console.ai.loadError')}
      </p>
    );
  if (!list)
    return (
      <p className="sr-only" role="status">
        {t('console.loading')}
      </p>
    );
  const none = list.every((p) => p.state === 'missing');
  // Bandeau d'attention : fonctions en repli ou coupées faute de clé (spec UX §1)
  const attention = (fns ?? []).filter((f) => f.status === 'fallback' || f.status === 'cut');
  const names = (xs: FnState[]) =>
    new Intl.ListFormat(i18n.language === 'en' ? 'en' : 'fr', { type: 'conjunction' }).format(
      xs.map((f) => t(`console.ai.fn.${f.fn}`)),
    );
  // Groupes par cause : clé manquante (par fournisseur), puis modèle retiré
  const groups = [
    ...(['anthropic', 'openai', 'elevenlabs'] as const).flatMap((p) => {
      const xs = attention.filter((f) => f.status === 'cut' && f.provider === p);
      return xs.length
        ? [
            {
              key: `cut-${p}`,
              text: t('console.ai.attentionCut', {
                count: xs.length,
                name: PROVIDER_LABEL[p],
                list: names(xs),
              }),
            },
          ]
        : [];
    }),
    ...(() => {
      const xs = attention.filter((f) => f.status === 'fallback');
      return xs.length
        ? [{ key: 'retired', text: t('console.ai.attentionRetired', { count: xs.length, list: names(xs) }) }]
        : [];
    })(),
    ...(ruleWarn.length
      ? [
          {
            key: 'rules',
            text: t('console.ai.attentionRules', {
              count: ruleWarn.length,
              list: new Intl.ListFormat(i18n.language === 'en' ? 'en' : 'fr', { type: 'conjunction' }).format(
                ruleWarn.map((r) => t(`console.ai.ruleShort.${r}`)),
              ),
            }),
          },
        ]
      : []),
  ];
  return (
    <div className="console-stack">
      <div className="console-card-head console-ai-head">
        <div>
          <h2 className="console-ai-title">{t('console.ai.title')}</h2>
          <p className="fd-muted">{t('console.ai.sub')}</p>
        </div>
        <Link className="fd-btn fd-btn--sm" to="/console/equipe?objet=ai">
          <History aria-hidden="true" />
          {t('console.ai.history')}
        </Link>
      </div>
      {!none && groups.length > 0 && (
        <p className="console-ai-attention" role="status">
          <TriangleAlert aria-hidden="true" />
          {/* Décision du chef : une phrase par cause (« 4 fonctions coupées faute de clé Anthropic : A, B, C et D. ») */}
          <span>
            {groups.map((g) => (
              <span key={g.key} className="console-ai-attention__l">
                {g.text}
              </span>
            ))}
          </span>
        </p>
      )}
      {none && (
        <section className="fd-card console-ai-empty" aria-labelledby="ai-empty-t">
          <span className="console-ai-empty__ic" aria-hidden="true">
            <KeyRound />
          </span>
          <h3 id="ai-empty-t">{t('console.ai.emptyTitle')}</h3>
          <p className="fd-muted">{t('console.ai.emptyBody')}</p>
          <WriteButton className="fd-btn fd-btn--primary fd-btn--sm" onClick={() => setKeyFor(list[0]!)}>
            <KeyRound aria-hidden="true" />
            {t('console.ai.addAny')}
          </WriteButton>
        </section>
      )}
      <section className="fd-card" aria-labelledby="ai-prov-t">
        <h3 id="ai-prov-t" className="console-h2">
          {t('console.ai.providers')}
        </h3>
        <p className="fd-muted console-ai-help">{t('console.ai.providersHelp')}</p>
        <ul className="console-ai-list" role="list">
          {list.map((p) => (
            <ProviderRow key={p.provider} p={p} quiet={none} onKey={() => setKeyFor(p)} onTested={load} />
          ))}
          <li className="console-ai-row is-soon">
            <span className="console-ai-tile" aria-hidden="true">
              <Plug />
            </span>
            <div className="console-ai-name">
              <b>{t('console.ai.others')}</b>
              <small>{t('console.ai.othersHelp')}</small>
            </div>
            <span className="console-ai-state">{t('console.ai.soon')}</span>
            <span />
          </li>
        </ul>
      </section>
      {fns && <FunctionModels fns={fns} onChanged={setFns} />}
      {fns && <AssistantModels onWarn={setRuleWarn} />}
      {keyFor && (
        <KeyDialog
          p={keyFor}
          onClose={() => setKeyFor(null)}
          onSaved={() => {
            setKeyFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Libellé d'une cause nommée (« Le fournisseur refuse la clé (401) »). */
function causeText(
  t: (k: string, o?: Record<string, unknown>) => string,
  cause?: string | null,
  status?: number,
) {
  const known = [
    'KEY_REFUSED',
    'KEY_FORBIDDEN',
    'MODEL_UNKNOWN',
    'BUSY',
    'PROVIDER_DOWN',
    'TIMEOUT',
    'NETWORK',
  ];
  return t(`console.ai.cause.${known.includes(cause ?? '') ? cause : 'PROVIDER'}`, { status: status ?? '' });
}

function ProviderRow({
  p,
  quiet,
  onKey,
  onTested,
}: {
  p: ProviderState;
  /** État vide : « Ajouter la clé » en secondaire, « Ajouter une clé » reste le seul bouton primaire. */
  quiet: boolean;
  onKey: () => void;
  onTested: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const has = p.state !== 'missing';
  const test = async () => {
    setBusy(true);
    const r = await consoleAi<{ ok: boolean; ms: number; cause?: string; status?: number }>(
      'console_key_test',
      {
        provider: p.provider,
      },
    );
    setBusy(false);
    if (r.ok && r.result.ok) toast(t('console.ai.testOk', { name: p.label, ms: r.result.ms }));
    else if (r.ok)
      toast(
        t('console.ai.testKo', { name: p.label, cause: causeText(t, r.result.cause, r.result.status) }),
        undefined,
        { tone: 'warning' },
      );
    else
      toast(
        t('console.ai.testKo', { name: p.label, cause: causeText(t, r.cause ?? r.error, r.status) }),
        undefined,
        { tone: 'warning' },
      );
    onTested();
  };
  const helpId = `ai-${p.provider}-h`;
  return (
    <li className="console-ai-row">
      <span className="console-ai-tile" aria-hidden="true">
        {p.label[0]}
      </span>
      <div className="console-ai-name">
        <b>{p.label}</b>
        <small>{t(`console.ai.use.${p.provider}`)}</small>
      </div>
      <span className="console-ai-state">
        {p.state === 'connected' ? (
          <span className="console-ai-pill is-ok">
            <Check aria-hidden="true" />
            {t('console.ai.connected')}
          </span>
        ) : p.state === 'refused' ? (
          <span className="console-ai-pill is-bad">{t('console.ai.refused')}</span>
        ) : (
          <span className="console-ai-pill is-warn">{t('console.ai.missing')}</span>
        )}
      </span>
      <div className="console-ai-acts">
        <small className="fd-muted" id={helpId}>
          {p.state === 'refused'
            ? causeText(t, p.lastTest?.cause, undefined)
            : p.source === 'vault' && p.addedAt
              ? t('console.ai.addedOn', { date: formatDate(p.addedAt) })
              : p.source === 'env'
                ? t('console.ai.deployed')
                : ''}
        </small>
        {has && (
          <WriteButton
            className="fd-btn fd-btn--sm"
            label={t('console.ai.testOf', { name: p.label })}
            disabled={busy}
            onClick={() => void test()}
          >
            {t('console.ai.test')}
          </WriteButton>
        )}
        <WriteButton
          className={`fd-btn fd-btn--sm${has || quiet ? '' : ' fd-btn--primary'}`}
          label={t(has ? 'console.ai.replaceOf' : 'console.ai.addOf', { name: p.label })}
          onClick={onKey}
        >
          {!has && <KeyRound aria-hidden="true" />}
          {t(has ? 'console.ai.replace' : 'console.ai.add')}
        </WriteButton>
      </div>
    </li>
  );
}

function KeyDialog({ p, onClose, onSaved }: { p: ProviderState; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const has = p.state !== 'missing';
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const value = key.trim();
    setErr(null);
    if (value.length < 10 || /\s/.test(value)) return setErr(t('console.ai.badKey'));
    setBusy(true);
    const r = await consoleAi<{ ok: true; ms: number; replaced: boolean }>('console_key_save', {
      provider: p.provider,
      key: value,
    });
    setBusy(false);
    // La clé ne reste pas dans la page, quel que soit le résultat
    setKey('');
    if (r.ok) {
      toast(
        t(r.result.replaced ? 'console.ai.replaced' : 'console.ai.added', { name: p.label, ms: r.result.ms }),
      );
      onSaved();
    } else if (r.error === 'KEY_TEST') setErr(causeText(t, r.cause, r.status));
    else if (r.error === 'BAD_KEY') setErr(t('console.ai.badKey'));
    else setErr(t('console.ai.saveError'));
  }
  return (
    <Modal
      open
      onClose={onClose}
      icon={<KeyRound />}
      title={t(has ? 'console.ai.replaceTitle' : 'console.ai.addTitle', { name: p.label })}
      closeLabel={t('common.close')}
      onDismiss={busy ? () => undefined : undefined}
      footer={
        <>
          <button type="button" className="fd-btn" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="ai-key-f" className="fd-btn fd-btn--primary" disabled={busy}>
            {busy ? t('console.ai.testing') : t('console.ai.testSave')}
          </button>
        </>
      }
    >
      <form id="ai-key-f" className="field" onSubmit={submit} noValidate>
        <label htmlFor="ai-key">{t('console.ai.keyLabel')}</label>
        <input
          id="ai-key"
          className="input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={err ? true : undefined}
          aria-describedby={`ai-key-h${err ? ' ai-key-e' : ''}`}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        {err && (
          <span className="field-error" id="ai-key-e" role="alert">
            {err}
          </span>
        )}
        <span className="help" id="ai-key-h">
          {t('console.ai.keyHelp')}
        </span>
      </form>
    </Modal>
  );
}

/** Aide d'un modèle : vitesse et coût relatifs (1 à 3). */
const helpOf = (t: (k: string) => string, c: { speed: number; cost: number }) =>
  `${t(`console.ai.speed.${c.speed}`)} · ${t(`console.ai.cost.${c.cost}`)}`;

/**
 * Spec UX §3 : une ligne de 64 px par fonction (nom et aide, liste de 40 px, état). Un changement
 * s'applique aux demandes suivantes, sans confirmation ; il est journalisé et le toast propose « Annuler ».
 */
function FunctionModels({ fns, onChanged }: { fns: FnState[]; onChanged: (f: FnState[]) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const ro = useConsoleRole() !== 'admin';
  const [busy, setBusy] = useState<Fn | null>(null);
  const set = async (f: FnState, model: string | null, undo: boolean) => {
    if (busy) return;
    setBusy(f.fn);
    const r = await consoleAi<{ old: string | null; functions: FnState[] }>('console_set_model', {
      fn: f.fn,
      model,
    });
    setBusy(null);
    if (!r.ok) return toast(t('console.ai.modelError'), undefined, { tone: 'warning' });
    onChanged(r.result.functions);
    // Recette UX : le focus revient sur la liste de la fonction changée (souris comme clavier)
    requestAnimationFrame(() => document.getElementById(`ai-fn-${f.fn}`)?.focus());
    const now = r.result.functions.find((x) => x.fn === f.fn)!;
    const label = now.choices.find((c) => c.id === now.chosen)?.label ?? now.chosen;
    if (undo)
      toast(t('console.ai.modelSet', { fn: t(`console.ai.fn.${f.fn}`), model: label }), {
        label: t('console.undo'),
        durationMs: 8000,
        onClick: () => void set(now, r.result.old, false),
      });
  };
  return (
    <section className="fd-card" aria-labelledby="ai-fn-t">
      <h3 id="ai-fn-t" className="console-h2">
        {t('console.ai.functions')}
      </h3>
      <p className="fd-muted console-ai-help">{t('console.ai.functionsHelp')}</p>
      <ul className="console-ai-list console-ai-fns" role="list">
        {fns.map((f) => {
          const id = `ai-fn-${f.fn}`;
          const known = f.choices.some((c) => c.id === f.chosen);
          const retired = f.status === 'fallback';
          const cut = f.status === 'cut';
          return (
            <li key={f.fn} className="console-ai-row">
              <div className="console-ai-name">
                <label htmlFor={id}>
                  <b>{t(`console.ai.fn.${f.fn}`)}</b>
                </label>
                <small>{t(`console.ai.fnHelp.${f.fn}`)}</small>
              </div>
              <div className={`console-ai-pick${retired ? ' is-retired' : ''}${cut ? ' is-cut' : ''}`}>
                <Select
                  id={id}
                  value={f.chosen}
                  // Pas de désactivation pendant l'envoi : le focus reste sur la liste (WCAG 2.4.3)
                  disabled={ro || f.chosen === 'auto' || f.status === 'off'}
                  aria-describedby={`${id}-s`}
                  onChange={(e) => void set(f, e.target.value, true)}
                >
                  {f.chosen === 'auto' && <option value="auto">{t('console.ai.autoSee')}</option>}
                  {f.chosen !== 'auto' && !known && (
                    <option value={f.chosen} disabled>
                      {t('console.ai.retiredModel')}
                    </option>
                  )}
                  {f.status === 'off' && !f.choices.length && (
                    <option value={f.chosen}>{t('console.ai.noModel')}</option>
                  )}
                  {f.chosen !== 'auto' &&
                    f.choices.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        disabled={!c.available}
                        data-description={c.available ? helpOf(t, c) : t('console.ai.missing')}
                      >
                        {c.label}
                      </option>
                    ))}
                </Select>
              </div>
              <span className="console-ai-fstate" id={`${id}-s`}>
                {f.status === 'active' ? (
                  <span className="console-ai-pill is-ok">
                    <Check aria-hidden="true" />
                    {t('console.ai.active')}
                  </span>
                ) : retired ? (
                  <span className="console-ai-warn">
                    <TriangleAlert aria-hidden="true" />
                    {t('console.ai.retiredFallback', {
                      model: f.choices.find((c) => c.id === f.model)?.label ?? f.model,
                    })}
                  </span>
                ) : cut ? (
                  <span className="console-ai-warn">
                    <TriangleAlert aria-hidden="true" />
                    {t('console.ai.cutMissing', { name: PROVIDER_LABEL[f.provider!] })}
                  </span>
                ) : (
                  <span className="console-ai-pill">{t('console.ai.off')}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type Tag = 'none' | 'recommended' | 'beta';
interface AsstRow {
  model: string;
  position: number;
  proposed: boolean;
  tag: Tag;
  label: string;
  provider: Provider;
  available: boolean;
}
interface AsstState {
  models: AsstRow[];
  rules: { short: string; whole_demo: string; fallback: string };
}

/**
 * Spec UX §4 : modèles proposés dans l'assistant (ordre, case Proposer, étiquette), règles d'« Auto »
 * et aperçu du menu tel que les utilisateurs le voient, mis à jour en direct. Au moins un modèle coché.
 */
function AssistantModels({ onWarn }: { onWarn: (rules: string[]) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const ro = useConsoleRole() !== 'admin';
  const [st, setSt] = useState<AsstState | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [lastHelp, setLastHelp] = useState<string | null>(null);
  useEffect(() => {
    void consoleAi<AsstState>('console_assistant').then((r) => r.ok && setSt(r.result));
  }, []);
  // Bandeau d'attention de la page : règles d'Auto dont le modèle n'est plus proposé
  const staleKey = st
    ? (['short', 'whole_demo', 'fallback'] as const)
        .filter(
          (r) =>
            st.rules[r] !== 'next' &&
            !st.models.some((m) => m.model === st.rules[r] && m.proposed && m.available),
        )
        .join(',')
    : '';
  useEffect(() => onWarn(staleKey ? staleKey.split(',') : []), [staleKey, onWarn]);
  if (!st) return null;
  const save = async (models: AsstRow[], focusId?: string) => {
    if (ro) return;
    if (!models.some((m) => m.proposed)) return setLastHelp(t('console.ai.keepOne'));
    setLastHelp(null);
    setSt({ ...st, models });
    const r = await consoleAi<AsstState>('console_assistant_set', {
      models: models.map((m) => ({ model: m.model, proposed: m.proposed, tag: m.tag })),
    });
    if (!r.ok) {
      toast(r.error === 'LAST_MODEL' ? t('console.ai.keepOne') : t('console.ai.modelError'), undefined, {
        tone: 'warning',
      });
      return void consoleAi<AsstState>('console_assistant').then((x) => x.ok && setSt(x.result));
    }
    setSt(r.result);
    toast(t('console.ai.listSaved'));
    if (focusId) requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  };
  const move = (i: number, to: number) => {
    if (to < 0 || to >= st.models.length || to === i) return;
    const next = [...st.models];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x!);
    void save(next, `ai-as-${to < i ? 'up' : 'down'}-${x!.model}`);
  };
  const setRule = async (rule: 'short' | 'whole_demo' | 'fallback', model: string) => {
    if (ro) return;
    const r = await consoleAi<AsstState & { old: string }>('console_auto_rule_set', { rule, model });
    if (!r.ok) return toast(t('console.ai.modelError'), undefined, { tone: 'warning' });
    setSt(r.result);
    toast(t('console.ai.ruleSaved'));
    requestAnimationFrame(() => document.getElementById(`ai-rule-${rule}`)?.focus());
  };
  const checked = st.models.filter((m) => m.proposed && m.available);
  const rec = checked.filter((m) => m.tag === 'recommended');
  const others = checked.filter((m) => m.tag !== 'recommended');
  // Même remplaçant que le serveur (replacementOf) : premier Recommandé du menu, sinon le premier
  const replacement = (rec[0] ?? checked[0])?.label ?? '';
  const RULES = ['short', 'whole_demo', 'fallback'] as const;
  const stale = staleKey.split(',');
  const ruleOptions = (withNext: boolean) => (
    <>
      {withNext && <option value="next">{t('console.ai.nextInList')}</option>}
      {/* Tous les modèles : la valeur en cours reste visible même si elle n'est plus proposée (Auto prend
          alors le premier du menu) ; seuls les modèles proposés et utilisables peuvent être choisis */}
      {st.models.map((m) => (
        <option key={m.model} value={m.model} disabled={!m.available || !m.proposed}>
          {m.proposed ? m.label : t('console.ai.notProposed', { name: m.label })}
        </option>
      ))}
    </>
  );
  return (
    <section className="fd-card" aria-labelledby="ai-as-t">
      <h3 id="ai-as-t" className="console-h2">
        {t('console.ai.assistant')}
      </h3>
      <p className="fd-muted console-ai-help">{t('console.ai.assistantHelp')}</p>
      <div className="console-ai-as">
        <div>
          <ol className="console-ai-aslist">
            {st.models.map((m, i) => (
              <li
                key={m.model}
                className={`console-ai-asrow${m.available ? '' : ' is-off'}${drag === i ? ' is-drag' : ''}`}
                onDragOver={(e) => {
                  if (drag !== null) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag !== null) move(drag, i);
                  setDrag(null);
                }}
              >
                <span
                  className="console-ai-handle"
                  draggable={!ro}
                  aria-hidden="true"
                  onDragStart={() => setDrag(i)}
                  onDragEnd={() => setDrag(null)}
                >
                  <GripVertical />
                </span>
                <input
                  type="checkbox"
                  id={`ai-as-p-${m.model}`}
                  checked={m.proposed}
                  disabled={ro || !m.available}
                  aria-describedby={lastHelp ? 'ai-as-keep' : undefined}
                  onChange={(e) =>
                    void save(
                      st.models.map((x) => (x.model === m.model ? { ...x, proposed: e.target.checked } : x)),
                      `ai-as-p-${m.model}`,
                    )
                  }
                />
                <label htmlFor={`ai-as-p-${m.model}`} className="console-ai-name">
                  <b>{m.label}</b>
                  <small>
                    {m.available
                      ? PROVIDER_LABEL[m.provider]
                      : t('console.ai.addKeyFor', { name: PROVIDER_LABEL[m.provider] })}
                  </small>
                </label>
                <Select
                  id={`ai-as-tag-${m.model}`}
                  size="sm"
                  aria-label={t('console.ai.tagOf', { name: m.label })}
                  value={m.tag}
                  disabled={ro || !m.available}
                  onChange={(e) =>
                    void save(
                      st.models.map((x) => (x.model === m.model ? { ...x, tag: e.target.value as Tag } : x)),
                      `ai-as-tag-${m.model}`,
                    )
                  }
                >
                  <option value="none">{t('console.ai.tag.none')}</option>
                  <option value="recommended">{t('console.ai.tag.recommended')}</option>
                  <option value="beta">{t('console.ai.tag.beta')}</option>
                </Select>
                <span className="console-ai-moves">
                  <button
                    type="button"
                    id={`ai-as-up-${m.model}`}
                    className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                    aria-label={t('console.ai.moveUp', { name: m.label })}
                    aria-disabled={ro || i === 0 || undefined}
                    onClick={() => !ro && move(i, i - 1)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    id={`ai-as-down-${m.model}`}
                    className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                    aria-label={t('console.ai.moveDown', { name: m.label })}
                    aria-disabled={ro || i === st.models.length - 1 || undefined}
                    onClick={() => !ro && move(i, i + 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
          {lastHelp && (
            <p className="field-error" id="ai-as-keep" role="alert">
              {lastHelp}
            </p>
          )}
          <div className="console-ai-auto">
            <h4>
              <Sparkles aria-hidden="true" />
              {t('console.ai.autoTitle')}
            </h4>
            {RULES.map((rule) => {
              const warn = stale.includes(rule);
              return (
                <div key={rule} className="console-ai-rule">
                  <label htmlFor={`ai-rule-${rule}`}>{t(`console.ai.rule.${rule}`)}</label>
                  <ChevronRight aria-hidden="true" className="console-ai-arrow" />
                  {/* Recette UX : même motif que « Modèle retiré » (bordure orange, phrase dessous) */}
                  <div className={`console-ai-pick${warn ? ' is-retired' : ''}`}>
                    <Select
                      id={`ai-rule-${rule}`}
                      size="md"
                      value={st.rules[rule]}
                      disabled={ro}
                      aria-describedby={warn ? `ai-rule-${rule}-w` : undefined}
                      onChange={(e) => void setRule(rule, e.target.value)}
                    >
                      {ruleOptions(rule === 'fallback')}
                    </Select>
                  </div>
                  {warn && (
                    <span className="console-ai-warn console-ai-rule__warn" id={`ai-rule-${rule}-w`}>
                      <TriangleAlert aria-hidden="true" />
                      {t('console.ai.ruleNotProposed', { model: replacement })}
                    </span>
                  )}
                </div>
              );
            })}
            <p className="fd-muted console-ai-help">{t('console.ai.autoHelp')}</p>
          </div>
        </div>
        <div className="console-ai-preview">
          <p className="console-ai-preview__t" id="ai-prev-t">
            {t('console.ai.preview')}
          </p>
          <div className="aim-menu console-ai-preview__menu" role="group" aria-labelledby="ai-prev-t">
            <div className="aim-item">
              <span className="aim-tile" aria-hidden="true">
                <Sparkles />
              </span>
              <span className="aim-tx">
                <b>{t('ai.model.auto')}</b>
                <small>{t('ai.model.autoHelp')}</small>
              </span>
              <Check className="aim-check" aria-hidden="true" />
            </div>
            {rec.length > 0 && (
              <>
                <div className="aim-sep" />
                <div className="aim-head">{t('ai.model.recommended')}</div>
                {rec.map((m) => (
                  <div key={m.model} className="aim-item">
                    <span className="aim-tile" aria-hidden="true">
                      <span className="aim-mono">{m.label[0]}</span>
                    </span>
                    <span className="aim-tx">
                      <b>{m.label}</b>
                    </span>
                  </div>
                ))}
              </>
            )}
            {/* Comme dans l'éditeur : pas d'« Autres modèles » quand le sous-menu serait vide */}
            {others.length > 0 && (
              <>
                <div className="aim-sep" />
                <div className="aim-item aim-more">
                  <span className="aim-tile" aria-hidden="true" />
                  <span className="aim-tx">
                    <b>{t('ai.model.others')}</b>
                  </span>
                  <ChevronRight className="aim-check" aria-hidden="true" />
                </div>
              </>
            )}
          </div>
          <p className="fd-muted console-ai-help">{t('console.ai.previewHelp')}</p>
        </div>
      </div>
    </section>
  );
}
