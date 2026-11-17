import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  EyeOff,
  ImageOff,
  ImagePlus,
  MousePointerClick,
  Plus,
  Target,
  Type,
  ZoomIn,
} from 'lucide-react';
import { Menu } from '../../components/Menu';
import type { StepRow } from './types';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DemoEditor } from './useDemoEditor';

export function StepList({
  editor,
  current,
  onSelect,
  readOnly,
}: {
  editor: DemoEditor;
  current: number;
  onSelect: (i: number) => void;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const chapterTitle = (id: string | null) => editor.chapters.find((c) => c.id === id)?.title;

  return (
    <div className="steplist">
      <ol aria-label={t('editor.steps')}>
        {editor.steps.map((s, i) => {
          const url = s.image_path ? editor.imageUrls[s.image_path] : undefined;
          const chapter = chapterTitle(s.chapter_id);
          const showChapter = chapter && chapterTitle(editor.steps[i - 1]?.chapter_id ?? null) !== chapter;
          return (
            <li
              key={s.id}
              draggable={!readOnly}
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(i);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== i) {
                  void editor.moveStep(dragFrom, i);
                  onSelect(i);
                }
                setDragFrom(null);
                setOver(null);
              }}
              className={`${i === current ? 'active' : ''} ${over === i ? 'over' : ''}`}
            >
              {showChapter && <div className="steplist-chapter">{chapter}</div>}
              <button className="steplist-item" onClick={() => onSelect(i)} aria-current={i === current}>
                <span className="steplist-n">{i + 1}</span>
                {url ? (
                  <img src={url} alt="" />
                ) : (
                  <span
                    className={`steplist-text ${s.kind === 'text' ? 'steplist-text--card' : ''}`}
                    aria-hidden="true"
                  >
                    {s.kind === 'text' ? (
                      <span className="steplist-text__card">{s.title || t('editor.untitled')}</span>
                    ) : (
                      <ImageOff size={20} />
                    )}
                  </span>
                )}
                <span className="steplist-title">{s.title || t('editor.untitled')}</span>
                <StepBadges step={s} hotspots={editor.hotspots.filter((h) => h.step_id === s.id).length} />
              </button>
              {!readOnly && (
                <span className="steplist-move">
                  <button
                    aria-label={t('editor.moveUp')}
                    disabled={i === 0}
                    onClick={() => void editor.moveStep(i, i - 1).then(() => onSelect(i - 1))}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    aria-label={t('editor.moveDown')}
                    disabled={i === editor.steps.length - 1}
                    onClick={() => void editor.moveStep(i, i + 1).then(() => onSelect(i + 1))}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <div className="stack" style={{ gap: 6, padding: 8 }}>
          <Menu
            label={t('editor.addStep')}
            align="start"
            trigger={{ icon: <Plus />, text: t('editor.addStep'), block: true }}
            items={[
              {
                label: t('editor.addTextStep'),
                icon: <Type />,
                onSelect: () =>
                  void editor.addTextStep(current, t('editor.newTextStep')).then(() => onSelect(current + 1)),
              },
              { label: t('editor.addImageStep'), icon: <ImagePlus />, onSelect: () => file.current?.click() },
            ]}
          />
          <input
            ref={file}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void editor.addImageStep(current, f).then(() => onSelect(current + 1));
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Icônes d'état d'une étape dans le rail (ED10). */
function StepBadges({ step, hotspots }: { step: StepRow; hotspots: number }) {
  const { t } = useTranslation();
  const blurs = Array.isArray(step.blurs) ? step.blurs.length : 0;
  const items = [
    hotspots > 0 && { icon: <Target />, label: t('editor.badgeHotspots', { count: hotspots }) },
    step.gate_form_id && { icon: <ClipboardList />, label: t('editor.badgeForm') },
    step.cta && { icon: <MousePointerClick />, label: t('editor.badgeCta') },
    step.zoom && { icon: <ZoomIn />, label: t('editor.badgeZoom') },
    blurs > 0 && { icon: <EyeOff />, label: t('editor.badgeBlurs', { count: blurs }) },
  ].filter(Boolean) as Array<{ icon: React.ReactNode; label: string }>;
  if (!items.length) return null;
  return (
    <span className="steplist-badges">
      {items.map((b) => (
        <span key={b.label} title={b.label} aria-label={b.label} role="img">
          {b.icon}
        </span>
      ))}
    </span>
  );
}
