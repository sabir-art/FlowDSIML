import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CircleCheck, RefreshCw, Sparkles, X } from 'lucide-react';
import type { DemoEditor } from '../../pages/editor/useDemoEditor';
import { asSettings } from '../../pages/editor/types';
import { useToast } from '../Toast';
import { AiRequestError, aiBlock, callAi, useAiStatus } from '../../lib/ai';
import { looksTechnical } from '@flowdsiml/core';
import { asVideo } from '../../pages/editor/video/videoModel';
import { markAiApplied, useBlockText } from './AiWrite';
import './ai.css';

export type SuggestionType = 'clarity' | 'length' | 'accessibility' | 'consistency';
/** Champ visé : `s:<étape>:title`, `h:<bulle>:title`, `h:<bulle>:body`. */
export interface Suggestion {
  id: string;
  key: string;
  n: number;
  type: SuggestionType;
  message: string;
  proposal: string;
  /** Contrôle local, sans IA (libellé « Vérification »). */
  local?: boolean;
  /** Contrôle local : ouvre l'élément au lieu d'appliquer un texte. */
  stepId?: string;
}

/** Textes envoyés au plus pour une analyse (limite de la fonction ai). */
export const MAX_TEXTS = 100;

/**
 * L63 : TOUS les textes de TOUTES les étapes, dans l'ordre de lecture. Titre et texte de l'étape, titre
 * et texte de chaque bulle (captures, pages HTML), titre et texte de chaque pause d'une vidéo. L'id dit où
 * écrire : `s:<étape>:title|body`, `h:<bulle>:title|body`, `p:<étape>:title|body:<pause>`.
 */
export function demoTexts(
  editor: Pick<DemoEditor, 'steps' | 'hotspots'>,
): Array<{ id: string; text: string; n: number }> {
  const out: Array<{ id: string; text: string; n: number }> = [];
  const add = (id: string, text: string | null | undefined, n: number) => {
    if (text?.trim()) out.push({ id, text, n });
  };
  editor.steps.forEach((s, i) => {
    add(`s:${s.id}:title`, s.title, i + 1);
    add(`s:${s.id}:body`, s.body, i + 1);
    for (const h of editor.hotspots
      .filter((x) => x.step_id === s.id)
      .sort((a, b) => a.position - b.position)) {
      add(`h:${h.id}:title`, h.title, i + 1);
      add(`h:${h.id}:body`, h.body, i + 1);
    }
    if (s.kind === 'video')
      for (const p of asVideo(s.video).pauses) {
        add(`p:${s.id}:title:${p.id}`, p.title, i + 1);
        add(`p:${s.id}:body:${p.id}`, p.body, i + 1);
      }
  });
  return out;
}

/** Début d'un texte cité dans un signalement : première ligne, 24 caractères au plus. */
export const excerpt = (text: string, max = 24) => {
  const line =
    text
      .split(/[\r\n]+/)
      .find((l) => l.trim())
      ?.replace(/\s+/g, ' ')
      .trim() ?? '';
  return line.length > max ? `${line.slice(0, max).trimEnd()}…` : line;
};

/** Bulle au-delà de laquelle la lecture devient difficile (contrôle local). */
export const BUBBLE_MAX = 280;

/** Contrôles déjà faits sans IA (§5 : en tête, libellés « Vérification »). */
export function localChecks(
  editor: Pick<DemoEditor, 'steps' | 'hotspots'>,
  t: (k: string, o?: object) => string,
) {
  const out: Suggestion[] = [];
  editor.steps.forEach((s, i) => {
    if ((s.kind === 'image' || s.kind === 'html') && !(s.alt_text ?? '').trim())
      out.push({
        id: `alt:${s.id}`,
        key: `s:${s.id}:alt`,
        n: i + 1,
        type: 'accessibility',
        message: t('ai.suggest.altMissing'),
        proposal: '',
        local: true,
        stepId: s.id,
      });
    // L63 : titre technique né de la capture (sélecteur, textes collés) : à réécrire
    for (const f of demoTexts({ steps: [s], hotspots: editor.hotspots }))
      if (f.id.endsWith(':title') && looksTechnical(f.text))
        out.push({
          id: `tech:${f.id}`,
          key: f.id,
          n: i + 1,
          type: 'clarity',
          // Recette 277f878 §1 : citer le champ et le début du texte, sinon deux signalements se confondent
          message: t('ai.suggest.technical', {
            field: t(`ai.suggest.technicalField.${f.id.split(':')[0]}`),
            excerpt: excerpt(f.text),
          }),
          proposal: '',
          local: true,
          stepId: s.id,
        });
    for (const h of editor.hotspots.filter((x) => x.step_id === s.id))
      if (h.body.length > BUBBLE_MAX)
        out.push({
          id: `len:${h.id}`,
          key: `h:${h.id}:body`,
          n: i + 1,
          type: 'length',
          message: t('ai.suggest.tooLong', { n: h.body.length, max: BUBBLE_MAX }),
          proposal: '',
          local: true,
          stepId: s.id,
        });
  });
  return out;
}

/**
 * L30-04 : panneau « Suggestions ». Contrôles locaux en tête, puis au plus 10 propositions de
 * l'Assistance IA, chacune avec « Appliquer » et « Ignorer ». Jamais recalculé sans action.
 */
export function SuggestionsPanel({
  editor,
  ws,
  onClose,
  onOpenStep,
}: {
  editor: DemoEditor;
  ws: string;
  onClose: () => void;
  onOpenStep: (stepId: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const blockText = useBlockText();
  const { status } = useAiStatus(ws);
  const lang = asSettings(editor.demo!.settings).locale ?? 'fr';
  const [local] = useState(() => localChecks(editor, (k, o) => String(t(k, o as never))));
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'busy' | 'ready' | 'error' | 'blocked'>('idle');
  const [message, setMessage] = useState('');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const ctrl = useRef<AbortController | null>(null);
  const head = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    head.current?.focus();
    return () => ctrl.current?.abort();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fields = () => demoTexts(editor);

  const analyse = async () => {
    const b = aiBlock(status, 'suggest');
    if (b) {
      setMessage(blockText(b, status));
      return setPhase('blocked');
    }
    const f = fields().slice(0, MAX_TEXTS);
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setPhase('busy');
    try {
      const r = await callAi<{
        suggestions: Array<{ id: string; type: SuggestionType; message: string; proposal: string }>;
      }>(ws, 'suggest', lang, { items: f.map(({ id, text }) => ({ id, text })) }, c.signal);
      const nOf = new Map(f.map((x) => [x.id, x.n]));
      setList(
        r.suggestions
          .slice(0, 10)
          .map((s, i) => ({ ...s, id: `ai:${i}:${s.id}`, key: s.id, n: nOf.get(s.id) ?? 0 }))
          .sort((a, b) => a.n - b.n),
      );
      // Vérifications locales ignorées : le restent ; propositions précédentes remplacées
      setHidden((h) => new Set([...h].filter((id) => !id.startsWith('ai:'))));
      setPhase('ready');
    } catch (e) {
      if (e instanceof AiRequestError && e.code === 'ABORTED') return setPhase('idle');
      if (e instanceof AiRequestError && (e.code === 'AI_QUOTA_WORKSPACE' || e.code === 'AI_QUOTA_USER')) {
        setMessage(blockText(e.code === 'AI_QUOTA_USER' ? 'userQuota' : 'quota', status));
        return setPhase('blocked');
      }
      setPhase('error');
    }
  };

  const current = (key: string) => demoTexts(editor).find((f) => f.id === key)?.text ?? '';
  const write = (key: string, text: string) => {
    const [kind, id, field, ...rest] = key.split(':');
    if (kind === 's') editor.updateStep(id!, field === 'body' ? { body: text } : { title: text });
    else if (kind === 'p') {
      // Pause-étape d'une vidéo : seule cette pause change, le reste du montage est gardé tel quel
      const step = editor.steps.find((s) => s.id === id);
      const raw = step?.video;
      if (!step || !raw || typeof raw !== 'object' || Array.isArray(raw)) return;
      const pauseId = rest.join(':');
      const pauses = Array.isArray(raw.pauses) ? raw.pauses : [];
      editor.updateStep(id!, {
        video: {
          ...raw,
          pauses: pauses.map((p) =>
            p && typeof p === 'object' && !Array.isArray(p) && p.id === pauseId
              ? { ...p, [field!]: text }
              : p,
          ),
        },
      });
    } else editor.updateHotspot(id!, field === 'title' ? { title: text } : { body: text });
  };
  const apply = (s: Suggestion) => {
    const before = current(s.key);
    markAiApplied(s.key, s.proposal);
    write(s.key, s.proposal);
    setHidden((h) => new Set(h).add(s.id));
    toast(t('ai.applied'), { label: t('ai.undo'), durationMs: 8000, onClick: () => write(s.key, before) });
  };
  const ignore = (s: Suggestion) => setHidden((h) => new Set(h).add(s.id));

  const visible = [...local, ...(list ?? [])].filter((s) => !hidden.has(s.id));
  const steps = [...new Set(visible.map((s) => s.n))].sort((a, b) => a - b);
  const typeLabel = (s: Suggestion) => t(`ai.suggest.type.${s.type}`);

  return createPortal(
    <div className="mk">
      <aside className="ai-suggest" role="dialog" aria-modal="false" aria-labelledby="ai-sg-t">
        <div className="ai-suggest-head">
          <h2 id="ai-sg-t" tabIndex={-1} ref={head}>
            {t('ai.suggest.title')}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="ai-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void analyse()}
            disabled={phase === 'busy'}
          >
            <RefreshCw aria-hidden="true" />
            {list ? t('ai.suggest.again') : t('ai.suggest.analyse')}
          </button>
          {list && (
            <p className="ai-mention">
              <Sparkles aria-hidden="true" />
              {t('ai.mention')}
            </p>
          )}
        </div>
        <div className="ai-suggest-body" aria-busy={phase === 'busy'}>
          <span className="sr-only" role="status">
            {phase === 'ready' ? t('ai.ready') : ''}
          </span>
          {phase === 'busy' && (
            <div className="ai-preview">
              <p className="ai-after">{t('ai.suggest.busy')}</p>
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
            </div>
          )}
          {phase === 'blocked' && (
            <p className="ai-after" role="alert">
              {message}
            </p>
          )}
          {phase === 'error' && (
            <div className="ai-preview">
              <p className="ai-after" role="alert">
                {t('ai.error')}
              </p>
              <div className="ai-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void analyse()}>
                  {t('ai.retry')}
                </button>
              </div>
            </div>
          )}
          {visible.length === 0 && phase !== 'busy' && (list || phase === 'idle') && (
            <p className="ai-empty">
              <CircleCheck aria-hidden="true" />
              {list ? t('ai.suggest.none') : t('ai.suggest.intro')}
            </p>
          )}
          {steps.map((n) => (
            <section key={n} aria-labelledby={`ai-sg-s${n}`}>
              <h3 id={`ai-sg-s${n}`} className="ai-sg-step">
                {n ? t('ai.write.step', { n }) : t('ai.translate.demo')}
              </h3>
              <ul className="ai-sg-list">
                {visible
                  .filter((s) => s.n === n)
                  .map((s) => (
                    <li key={s.id} className="ai-preview">
                      <p className="ai-sg-meta">
                        <span className={`fd-badge ai-sg-badge${s.local ? ' is-local' : ''}`}>
                          {s.local ? t('ai.suggest.check') : typeLabel(s)}
                        </span>
                        {s.local && <span className="t-caption muted">{typeLabel(s)}</span>}
                      </p>
                      <p className="ai-after">{s.message}</p>
                      {s.proposal && (
                        <p className="ai-sg-proposal">
                          <span className="sr-only">{t('ai.afterSr')} </span>
                          {s.proposal}
                        </p>
                      )}
                      <div className="ai-actions">
                        {s.local ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => s.stepId && onOpenStep(s.stepId)}
                          >
                            {t('ai.suggest.open')}
                          </button>
                        ) : (
                          s.proposal && (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => apply(s)}>
                              {t('ai.apply')}
                            </button>
                          )
                        )}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => ignore(s)}>
                          {t('ai.ignore')}
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
