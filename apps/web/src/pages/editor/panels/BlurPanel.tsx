import { PanelTitle } from './PanelTitle';
import { ChevronLeft, EyeOff, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asRects, type Selection, type StepRow } from '../types';

export function BlurPanel({
  editor,
  step,
  index,
  readOnly,
  setSelection,
}: {
  editor: DemoEditor;
  step: StepRow;
  index: number;
  readOnly: boolean;
  setSelection: (s: Selection) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <PanelTitle icon={<EyeOff />}>{t('editor.blurN', { n: index + 1 })}</PanelTitle>
        <Button
          size="sm"
          variant="ghost"
          icon={<ChevronLeft />}
          onClick={() => setSelection({ kind: 'step' })}
        >
          {t('editor.backToStep')}
        </Button>
      </div>
      <p className="fd-muted">{t('editor.blurHint')}</p>
      {!readOnly && (
        <Button
          variant="ghost"
          className="btn-danger-ghost"
          icon={<Trash2 />}
          onClick={() => {
            editor.updateStep(step.id, { blurs: asRects(step.blurs).filter((_, i) => i !== index) });
            setSelection({ kind: 'step' });
          }}
        >
          {t('editor.deleteBlur')}
        </Button>
      )}
    </div>
  );
}
