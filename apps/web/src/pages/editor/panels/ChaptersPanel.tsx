import { useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';

export function ChaptersPanel({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <h3 className="panel-title">{t('editor.chapters')}</h3>
      <p className="fd-muted" style={{ fontSize: 12 }}>
        {t('editor.chaptersHint')}
      </p>
      {editor.chapters.map((c) => (
        <div key={c.id} className="row">
          <input
            className="fd-input"
            style={{ flex: 1 }}
            aria-label={t('editor.chapter')}
            maxLength={120}
            disabled={readOnly}
            value={c.title}
            onChange={(e) => editor.updateChapter(c.id, { title: e.target.value })}
          />
          {!readOnly && (
            <Button size="sm" variant="danger" onClick={() => void editor.deleteChapter(c.id)}>
              ✕
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button
          onClick={() => void editor.addChapter(t('editor.chapterN', { n: editor.chapters.length + 1 }))}
        >
          {t('editor.addChapter')}
        </Button>
      )}
    </div>
  );
}
