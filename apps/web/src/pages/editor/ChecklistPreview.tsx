import { useTranslation } from 'react-i18next';
import { useVarCatalog } from '../../lib/varCatalog';
import { usePreviewMode, varPreview } from './vars/varPreview';
import { Circle, CircleCheck, ListChecks } from 'lucide-react';
import type { DemoEditor } from './useDemoEditor';
import { asSettings } from './types';

const ICON = { size: 16, 'aria-hidden': true } as const;

/**
 * A2-03 : aperçu de la checklist sur le canevas (carte de 260 px, comme dans le lecteur). Un
 * élément par chapitre (ou par étape sans chapitre), coché quand l'étape affichée a dépassé sa
 * dernière étape. Repliée : pilule.
 */
export function ChecklistPreview({ editor, index }: { editor: DemoEditor; index: number }) {
  const catalog = useVarCatalog(editor.variables);
  const mode = usePreviewMode();
  const { t } = useTranslation();
  const settings = asSettings(editor.demo?.settings);
  const cl = settings.checklist;
  if (!cl?.enabled) return null;
  const steps = editor.steps;
  const items = editor.chapters.length
    ? editor.chapters.map((c) => {
        const idx = steps.map((s, i) => (s.chapter_id === c.id ? i : -1)).filter((i) => i >= 0);
        const last = idx.length ? Math.max(...idx) : -1;
        return { id: c.id, title: c.title, done: last >= 0 && index > last, current: idx.includes(index) };
      })
    : steps.map((s, i) => ({
        id: s.id,
        title: s.title || t('editor.stepN', { n: i + 1 }),
        done: index > i,
        current: index === i,
      }));
  const done = items.filter((x) => x.done).length;
  // L46-bis : variables du titre remplacées comme dans le canevas (exemples ou valeurs de repli)
  const vp = varPreview(catalog, editor.variables, mode);
  const title = vp.text(cl.title ?? '') || t('editor.advanced.checklist.headingPlaceholder');
  const side = cl.position === 'left' ? 'left' : 'right';
  if (cl.position === 'collapsed')
    return (
      <div
        className={`ck-prev ck-prev--${side}`}
        aria-label={t('editor.advanced.checklist.title')}
        role="note"
      >
        <span className="ck-pill">
          <ListChecks {...ICON} />
          {title}
          <b>
            {done}/{items.length}
          </b>
        </span>
      </div>
    );
  return (
    <section className={`ck-prev ck-prev--${side}`} aria-label={t('editor.advanced.checklist.title')}>
      <p className="ck-title">{title}</p>
      <p className="ck-progress">{t('editor.advanced.checklist.progress', { done, total: items.length })}</p>
      <span className="ck-bar" aria-hidden="true">
        <span style={{ width: `${(done / Math.max(1, items.length)) * 100}%` }} />
      </span>
      <ul>
        {items.map((x) => (
          <li key={x.id} className={x.current ? 'cur' : undefined}>
            {x.done ? <CircleCheck {...ICON} className="ok" /> : <Circle {...ICON} />}
            <span>{x.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
