import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
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
                  <span className="steplist-text">{s.kind === 'text' ? 'Aa' : '…'}</span>
                )}
                <span className="steplist-title">{s.title || t('editor.untitled')}</span>
              </button>
              {!readOnly && (
                <span className="steplist-move">
                  <button
                    aria-label={t('editor.moveUp')}
                    disabled={i === 0}
                    onClick={() => void editor.moveStep(i, i - 1).then(() => onSelect(i - 1))}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={t('editor.moveDown')}
                    disabled={i === editor.steps.length - 1}
                    onClick={() => void editor.moveStep(i, i + 1).then(() => onSelect(i + 1))}
                  >
                    ↓
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!readOnly && (
        <div className="stack" style={{ gap: 6, padding: 8 }}>
          <Button
            size="sm"
            onClick={() =>
              void editor.addTextStep(current, t('editor.newTextStep')).then(() => onSelect(current + 1))
            }
          >
            + {t('editor.addTextStep')}
          </Button>
          <Button size="sm" onClick={() => file.current?.click()}>
            + {t('editor.addImageStep')}
          </Button>
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
