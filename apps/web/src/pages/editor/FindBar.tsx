import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { DemoEditor } from './useDemoEditor';
import { asCta, asStepOptions, type StepRow } from './types';
import {
  findAll,
  replaceAt,
  replaceIn,
  snippet,
  type FindOptions,
  type FindScope,
  type Match,
  type TextField,
} from './findReplace';
import { useToast } from '../../components/Toast';

/** Tous les textes modifiables de la démo, étape par étape. */
export function collectFields(editor: DemoEditor): TextField[] {
  return editor.steps.flatMap((s, stepIndex) => {
    const o = asStepOptions(s.options);
    const own: TextField[] = [
      { table: 'steps', id: s.id, field: 'title', kind: 'title', stepIndex, text: s.title },
      { table: 'steps', id: s.id, field: 'body', kind: 'bubble', stepIndex, text: s.body },
      {
        table: 'steps',
        id: s.id,
        field: 'options.buttonLabel',
        kind: 'button',
        stepIndex,
        text: o.buttonLabel,
      },
      { table: 'steps', id: s.id, field: 'options.prevLabel', kind: 'button', stepIndex, text: o.prevLabel },
    ];
    const hs = editor.hotspots
      .filter((h) => h.step_id === s.id)
      .sort((a, b) => a.position - b.position)
      .flatMap((h): TextField[] => [
        { table: 'hotspots', id: h.id, field: 'title', kind: 'bubble', stepIndex, text: h.title },
        { table: 'hotspots', id: h.id, field: 'body', kind: 'bubble', stepIndex, text: h.body },
        {
          table: 'hotspots',
          id: h.id,
          field: 'cta.label',
          kind: 'button',
          stepIndex,
          text: asCta(h.cta)?.label ?? '',
        },
      ]);
    return [...own, ...hs].filter((f) => f.text);
  });
}

/** Écrit un nouveau texte dans le champ visé (colonne, options de l'étape ou CTA du hotspot). */
function writeField(editor: DemoEditor, f: TextField, text: string) {
  if (f.table === 'steps') {
    if (f.field.startsWith('options.')) {
      const s = editor.steps.find((x) => x.id === f.id)!;
      const key = f.field.slice('options.'.length);
      editor.updateStep(f.id, {
        options: { ...asStepOptions(s.options), [key]: text } as unknown as StepRow['options'],
      });
    } else editor.updateStep(f.id, { [f.field]: text });
  } else if (f.field === 'cta.label') {
    const h = editor.hotspots.find((x) => x.id === f.id)!;
    editor.updateHotspot(f.id, { cta: { ...asCta(h.cta)!, label: text } });
  } else editor.updateHotspot(f.id, { [f.field]: text });
}

/**
 * L12-04 : barre « Rechercher et remplacer » flottant en haut à droite du canevas (Ctrl F, Échap pour
 * fermer). Résultats par étape avec le terme surligné ; « Tout remplacer » en une seule annulation.
 */
export function FindBar({
  editor,
  readOnly,
  onGoto,
  onHits,
  onClose,
}: {
  editor: DemoEditor;
  readOnly: boolean;
  onGoto: (stepIndex: number, hotspotId: string | null) => void;
  /** Nombre de résultats par étape (pastilles du rail). */
  onHits: (hits: Record<number, number>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [by, setBy] = useState('');
  const [opts, setOpts] = useState<FindOptions>({ caseSensitive: false, wholeWord: false, scope: 'all' });
  const [cur, setCur] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const fields = useMemo(() => collectFields(editor), [editor]);
  const matches = useMemo(() => findAll(fields, q, opts), [fields, q, opts]);
  const current: Match | undefined = matches[Math.min(cur, matches.length - 1)];

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const hits: Record<number, number> = {};
    for (const m of matches) hits[m.stepIndex] = (hits[m.stepIndex] ?? 0) + 1;
    onHits(hits);
  }, [matches]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onHits({}), []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (i: number) => {
    if (!matches.length) return;
    const n = (i + matches.length) % matches.length;
    setCur(n);
    const m = matches[n]!;
    onGoto(m.stepIndex, m.table === 'hotspots' ? m.id : null);
  };

  const replaceOne = () => {
    if (!current || readOnly) return;
    writeField(editor, current, replaceAt(current.text, current.start, current.end, by));
  };
  const replaceAll = () => {
    if (!matches.length || readOnly) return;
    const n = matches.length;
    const touched = new Map<string, TextField>();
    for (const m of matches) touched.set(`${m.table}:${m.id}:${m.field}`, m);
    editor.batch(() => {
      // Libellés d'une même étape regroupés : une seule écriture de ses options
      const stepOpts = new Map<string, Record<string, string>>();
      for (const f of touched.values()) {
        const text = replaceIn(f.text, q, by, opts);
        if (f.table === 'steps' && f.field.startsWith('options.')) {
          stepOpts.set(f.id, { ...(stepOpts.get(f.id) ?? {}), [f.field.slice(8)]: text });
        } else writeField(editor, f, text);
      }
      for (const [id, patch] of stepOpts) {
        const s = editor.steps.find((x) => x.id === id)!;
        editor.updateStep(id, {
          options: { ...asStepOptions(s.options), ...patch } as unknown as StepRow['options'],
        });
      }
    });
    toast(t('editor.find.replaced', { count: n }));
  };

  const where = (m: Match) =>
    m.stepIndex === editor.steps.length - 1 && editor.steps[m.stepIndex]?.kind === 'text'
      ? t('editor.find.end')
      : t('editor.find.step', { n: m.stepIndex + 1 });
  const scopes: FindScope[] = ['all', 'bubbles', 'titles'];

  return (
    <div
      className="find"
      role="search"
      aria-label={t('editor.find.label')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
        if (e.key === 'Enter' && (e.target as HTMLElement).id === 'find-q') {
          e.preventDefault();
          go(cur + (e.shiftKey ? -1 : 1));
        }
      }}
    >
      <div className="row-3">
        <input
          ref={input}
          id="find-q"
          className="input grow"
          value={q}
          aria-label={t('editor.find.query')}
          onChange={(e) => {
            setQ(e.target.value);
            setCur(0);
          }}
        />
        <span className="count" role="status">
          {q ? t('editor.find.count', { n: matches.length ? cur + 1 : 0, total: matches.length }) : ''}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={t('editor.find.prev')}
          disabled={!matches.length}
          onClick={() => go(cur - 1)}
        >
          <ChevronUp aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={t('editor.find.next')}
          disabled={!matches.length}
          onClick={() => go(cur + 1)}
        >
          <ChevronDown aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label={t('editor.find.close')}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="row-3">
        <input
          className="input grow"
          value={by}
          disabled={readOnly}
          aria-label={t('editor.find.by')}
          onChange={(e) => setBy(e.target.value)}
        />
        <button
          type="button"
          className="opt-btn"
          aria-pressed={opts.caseSensitive}
          aria-label={t('editor.find.case')}
          title={t('editor.find.case')}
          onClick={() => setOpts({ ...opts, caseSensitive: !opts.caseSensitive })}
        >
          Aa
        </button>
        <button
          type="button"
          className="opt-btn"
          aria-pressed={opts.wholeWord}
          aria-label={t('editor.find.word')}
          title={t('editor.find.word')}
          onClick={() => setOpts({ ...opts, wholeWord: !opts.wholeWord })}
        >
          ab
        </button>
      </div>
      <div className="row-3">
        <select
          className="select input-sm grow"
          aria-label={t('editor.find.scope')}
          value={opts.scope}
          onChange={(e) => setOpts({ ...opts, scope: e.target.value as FindScope })}
        >
          {scopes.map((s) => (
            <option key={s} value={s}>
              {t(`editor.find.scopes.${s}`)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!current || readOnly}
          onClick={replaceOne}
        >
          {t('editor.find.replace')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!matches.length || readOnly}
          onClick={replaceAll}
        >
          {t('editor.find.replaceAll', { n: matches.length })}
        </button>
      </div>
      {matches.length > 0 && (
        <ul aria-label={t('editor.find.results')}>
          {matches.map((m, i) => {
            const sn = snippet(m.text, m.start, m.end);
            const isCur = m === current;
            return (
              <li key={`${m.table}${m.id}${m.field}${m.start}`} aria-current={isCur ? 'true' : undefined}>
                <button type="button" onClick={() => go(i)}>
                  <span className="where">{where(m)}</span>
                  <span>
                    {m.field === 'title' && m.table === 'steps' && `${t('editor.find.titlePrefix')} `}
                    {sn.before}
                    <mark className={`hit${isCur ? ' cur' : ''}`}>{sn.hit}</mark>
                    {sn.after}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="help find-help">{t('editor.find.help', { example: '{{first_name}}' })}</p>
    </div>
  );
}
