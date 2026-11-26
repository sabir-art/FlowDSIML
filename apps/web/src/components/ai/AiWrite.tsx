import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Briefcase, Equal, Heart, Sparkles, TriangleAlert, WandSparkles } from 'lucide-react';
import { Menu, type MenuItem, type MenuRadioGroup } from '../Menu';
import { useToast } from '../Toast';
import {
  AiRequestError,
  aiBlock,
  callAi,
  lostVariables,
  useAiStatus,
  type AiBlock,
  type AiFeature,
  type AiStatus,
} from '../../lib/ai';
import './ai.css';

export type WriteAction = 'simplify' | 'shorten' | 'spelling' | 'from_title' | 'tone';
export type Tone = 'neutral' | 'warm' | 'formal';

/** Repère « IA » : champ dont le texte vient d'une proposition appliquée, jusqu'à la prochaine saisie. */
const applied = new Map<string, string>();
export const markAiApplied = (key: string, text: string) => applied.set(key, text);
export const isAiApplied = (key: string, text: string) => applied.get(key) === text;

export function AiBadge({
  fieldKey,
  text,
  marked = false,
}: {
  fieldKey: string;
  text: string;
  marked?: boolean;
}) {
  const { t } = useTranslation();
  if (!marked && !isAiApplied(fieldKey, text)) return null;
  return (
    <span className="ai-badge" title={t('ai.badgeLabel')}>
      <span aria-hidden="true">{t('ai.badge')}</span>
      <span className="sr-only">{t('ai.badgeLabel')}</span>
    </span>
  );
}

const fmtDate = (iso: string | null, lang: string) =>
  iso ? new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso)) : '';

/** Message d'indisponibilité (infobulle des entrées, règle 4 et 6). */
export function useBlockText() {
  const { t, i18n } = useTranslation();
  return (b: AiBlock, s: AiStatus | null) =>
    b === 'disabled'
      ? t('ai.disabled')
      : b === 'unavailable'
        ? t('ai.unavailable')
        : b === 'role'
          ? t('ai.role')
          : b === 'quota'
            ? [
                t('ai.quota'),
                s?.renewsOn ? t('ai.quotaRenews', { date: fmtDate(s.renewsOn, i18n.language) }) : '',
              ]
                .filter(Boolean)
                .join(' ')
            : b === 'userQuota'
              ? t('ai.userQuota')
              : '';
}

/** Entrée désactivée (aria-disabled, focalisable) avec explication ; lien vers le réglage pour un admin. */
export function DisabledEntry({
  status,
  label,
  feature = 'write',
  tip,
  autoFocus = false,
}: {
  status: AiStatus | null;
  label: string;
  feature?: AiFeature;
  /** Infobulle propre à la fonction quand elle est désactivée (voix, sous-titres). */
  tip?: string;
  /**
   * Recette UX (L41 étape 3) : l'entrée vient d'être coupée pendant une demande ; elle reprend le focus,
   * et sa description (« Indisponible pour le moment ») est annoncée.
   */
  autoFocus?: boolean;
}) {
  const id = useId();
  const btn = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (autoFocus) btn.current?.focus();
  }, [autoFocus]);
  const blockText = useBlockText();
  const { t } = useTranslation();
  const b = aiBlock(status, feature);
  // Recette UX (L41 étape 3) : l'infobulle s'ouvre au-dessus de l'entrée quand la place manque dessous
  const [above, setAbove] = useState(false);
  const place = (e: { currentTarget: HTMLElement }) => {
    const wrap = e.currentTarget.closest('.ai-disabled-wrap') ?? e.currentTarget;
    const tipEl = document.getElementById(id);
    const r = wrap.getBoundingClientRect();
    const h = tipEl?.offsetHeight ?? 0;
    setAbove(r.bottom + 6 + h > window.innerHeight - 8 && r.top - 6 - h >= 8);
  };
  return (
    <span className="ai-disabled-wrap" onMouseEnter={place}>
      <button
        ref={btn}
        type="button"
        className="btn btn-ghost btn-xs ai-entry"
        aria-disabled="true"
        aria-describedby={id}
        onFocus={place}
        onClick={(e) => e.preventDefault()}
      >
        <WandSparkles aria-hidden="true" />
        {label}
      </button>
      <span id={id} className={`ai-tip${above ? ' ai-tip--above' : ''}`} role="tooltip">
        {b === 'disabled' && tip ? tip : blockText(b, status)}
      </span>
      {status?.canManage && b === 'disabled' && (
        <Link className="t-caption" to="/settings/ai">
          {t('ai.disabledAdmin')}
        </Link>
      )}
    </span>
  );
}

type View =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'proposal'; text: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'error' };

/**
 * L30-02 : « Assistance IA » d'un champ de texte de bulle. Menu des actions, puis aperçu
 * avant/après sous le champ ; rien n'est écrit avant « Appliquer » (règles communes §0).
 */
export function AiWrite({
  ws,
  lang,
  fieldKey,
  text,
  title,
  onApply,
  onAll,
}: {
  ws: string;
  /** Langue de la démo (la réponse est rédigée dans cette langue). */
  lang: string;
  fieldKey: string;
  text: string;
  title: string;
  /** `undo` : retour au texte d'avant (Annuler du toast), le repère « IA » est alors retiré. */
  onApply: (next: string, before: string, undo?: boolean) => void;
  /** « Pour toutes les étapes » (Corriger l'orthographe seulement). */
  onAll?: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const blockText = useBlockText();
  const { status } = useAiStatus(ws);
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [last, setLast] = useState<{ action: WriteAction; tone?: Tone; variant: number } | null>(null);
  const [announce, setAnnounce] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  const before = useRef(text);
  // Coupée par TutoClick pendant une demande : l'entrée désactivée reprendra le focus
  const justCut = useRef(false);
  useEffect(() => () => ctrl.current?.abort(), []);
  // Le champ change (autre hotspot) : l'aperçu en cours est abandonné
  useEffect(() => {
    ctrl.current?.abort();
    setView({ kind: 'idle' });
  }, [fieldKey]);

  const b = aiBlock(status, 'write');
  if (b === 'disabled' || b === 'role' || b === 'unavailable')
    return (
      <DisabledEntry
        status={status}
        label={t('ai.write.menu')}
        autoFocus={b === 'unavailable' && justCut.current}
      />
    );

  const run = async (action: WriteAction, tone?: Tone, variant = 0) => {
    setLast({ action, tone, variant });
    const blocked = aiBlock(status, 'write');
    if (blocked) return setView({ kind: 'blocked', message: blockText(blocked, status) });
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    before.current = text;
    setAnnounce('');
    setView({ kind: 'busy' });
    try {
      const r = await callAi<{ text: string }>(
        ws,
        'write',
        lang,
        { action, tone, text, title, variant },
        c.signal,
      );
      setView({ kind: 'proposal', text: r.text });
      setAnnounce(t('ai.ready'));
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setView({ kind: 'idle' });
      if (e instanceof AiRequestError && e.code === 'AI_QUOTA_WORKSPACE')
        return setView({
          kind: 'blocked',
          message: blockText('quota', { ...status!, renewsOn: e.renewsOn ?? status?.renewsOn ?? null }),
        });
      if (e instanceof AiRequestError && e.code === 'AI_QUOTA_USER')
        return setView({ kind: 'blocked', message: blockText('userQuota', status) });
      if (e instanceof AiRequestError && e.code === 'AI_DISABLED')
        return setView({ kind: 'blocked', message: t('ai.disabled') });
      if (e instanceof AiRequestError && e.code === 'UNAVAILABLE') {
        justCut.current = true;
        setAnnounce(t('ai.unavailable'));
        return setView({ kind: 'blocked', message: t('ai.unavailable') });
      }
      setView({ kind: 'error' });
    }
  };

  const items: Array<MenuItem | MenuRadioGroup | 'separator'> = [
    { label: t('ai.write.simplify'), onSelect: () => void run('simplify'), disabled: !text.trim() },
    { label: t('ai.write.shorten'), onSelect: () => void run('shorten'), disabled: !text.trim() },
    { label: t('ai.write.spelling'), onSelect: () => void run('spelling'), disabled: !text.trim() },
    ...(!text.trim()
      ? [{ label: t('ai.write.fromTitle'), onSelect: () => void run('from_title'), disabled: !title.trim() }]
      : []),
    {
      radios: {
        label: t('ai.write.tone'),
        value: '',
        options: [
          { value: 'neutral', label: t('ai.write.neutral'), icon: <Equal /> },
          { value: 'warm', label: t('ai.write.warm'), icon: <Heart /> },
          { value: 'formal', label: t('ai.write.formal'), icon: <Briefcase /> },
        ],
        onChange: (v) => text.trim() && void run('tone', v as Tone),
      },
    },
  ];
  if (onAll) items.push('separator', { label: t('ai.write.all'), onSelect: onAll });

  const lost = view.kind === 'proposal' ? lostVariables(before.current, view.text) : [];
  const apply = () => {
    if (view.kind !== 'proposal') return;
    const prev = before.current;
    markAiApplied(fieldKey, view.text);
    onApply(view.text, prev);
    setView({ kind: 'idle' });
    toast(t('ai.applied'), {
      label: t('ai.undo'),
      durationMs: 8000,
      onClick: () => onApply(prev, view.text, true),
    });
  };

  return (
    <>
      <span className="ai-write">
        <Menu
          label={t('ai.write.menu')}
          align="start"
          trigger={{ icon: <WandSparkles aria-hidden="true" />, text: t('ai.write.menu'), chevron: true }}
          items={items}
        />
      </span>
      <span className="sr-only" role="status">
        {announce}
      </span>
      {view.kind !== 'idle' && (
        <div
          className="ai-preview"
          role="group"
          aria-label={t('ai.proposal')}
          aria-busy={view.kind === 'busy'}
        >
          <h4>{t('ai.proposal')}</h4>
          {view.kind === 'busy' && (
            <>
              <p className="ai-after">{t('ai.busy')}</p>
              <div className="ai-progress" aria-hidden="true" />
              <div className="ai-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => ctrl.current?.abort()}
                >
                  {t('ai.stop')}
                </button>
              </div>
            </>
          )}
          {view.kind === 'blocked' && (
            <>
              <p className="ai-after" role="alert">
                {view.message}
              </p>
              <div className="ai-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setView({ kind: 'idle' })}
                >
                  {t('common.close')}
                </button>
              </div>
            </>
          )}
          {view.kind === 'error' && (
            <>
              <p className="ai-after" role="alert">
                {aiBlock(status, 'write') === 'unavailable' ? t('ai.unavailable') : t('ai.error')}
              </p>
              <div className="ai-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => last && void run(last.action, last.tone, last.variant)}
                >
                  {t('ai.retry')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setView({ kind: 'idle' })}
                >
                  {t('ai.ignore')}
                </button>
              </div>
            </>
          )}
          {view.kind === 'proposal' && (
            <>
              {before.current.trim() && (
                <p className="ai-before">
                  <span className="sr-only">{t('ai.beforeSr')} </span>
                  {before.current}
                </p>
              )}
              <p className="ai-after">
                <span className="sr-only">{t('ai.afterSr')} </span>
                {view.text}
              </p>
              {lost.map((v) => (
                <p key={v} className="alert alert-warning ai-lost" role="alert">
                  <TriangleAlert aria-hidden="true" />
                  {t('ai.lostVar', { name: `{{${v}}}` })}
                </p>
              ))}
              <p className="ai-mention">
                <Sparkles aria-hidden="true" />
                {t('ai.mention')}
              </p>
              <div className="ai-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={apply}>
                  {t('ai.apply')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setView({ kind: 'idle' })}
                >
                  {t('ai.ignore')}
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => last && void run(last.action, last.tone, last.variant + 1)}
                >
                  {t('ai.another')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
