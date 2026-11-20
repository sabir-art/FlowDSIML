/**
 * L38-8 (revue formation n° 8) : aide affichée après un import d'images. Elle dit quoi faire sur l'étape en
 * cours (poser le hotspot, puis écrire la consigne), puis propose l'étape suivante qui n'a pas encore de
 * bulle. Masquable ; elle ne revient pas tant que l'éditeur reste ouvert.
 */
import { ArrowRight, Lightbulb, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from './useDemoEditor';
import type { Tool } from './Canvas';

export function GuideBar({
  editor,
  index,
  tool,
  onNext,
  onHide,
}: {
  editor: DemoEditor;
  index: number;
  tool: Tool;
  onNext: (index: number) => void;
  onHide: () => void;
}) {
  const { t } = useTranslation();
  const bubbles = (stepId: string) => editor.hotspots.filter((h) => h.step_id === stepId);
  const step = editor.steps[index];
  if (!step) return null;
  const mine = bubbles(step.id);
  const filled = mine.some((h) => h.title.trim() || h.body?.replace(/<[^>]*>/g, '').trim());
  const nextIdx = editor.steps.findIndex(
    (s, i) => i !== index && s.kind === 'image' && bubbles(s.id).length === 0,
  );
  const image = step.kind === 'image';
  const msg =
    image && mine.length === 0
      ? t('editor.guide.place')
      : image && !filled
        ? t('editor.guide.write')
        : nextIdx < 0
          ? t('editor.guide.done')
          : null;
  const showNext = (!image || filled) && nextIdx >= 0;
  return (
    <div className="guide-bar" role="status">
      <Lightbulb aria-hidden="true" />
      <span className="grow">{msg}</span>
      {showNext && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onNext(nextIdx)}>
          {t('editor.guide.next')}
          <ArrowRight aria-hidden="true" />
        </button>
      )}
      {tool !== 'hotspot' && mine.length === 0 && image && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => window.dispatchEvent(new Event('fd:add-hotspot'))}
        >
          {t('editor.addHotspot')}
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-sm"
        aria-label={t('editor.guide.hide')}
        title={t('editor.guide.hide')}
        onClick={onHide}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
