import { useTranslation } from 'react-i18next';
import type { ChoiceAction } from '@flowdsiml/manifest';
import { Select } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { missingDest } from '../rules';

/** Valeur du select de destination : « step:<id> », « chapter:<id> », « end » ou « url ». */
const destValue = (a: ChoiceAction) =>
  a.type === 'goto' ? `step:${a.stepId}` : a.type === 'chapter' ? `chapter:${a.chapterId}` : a.type;

/**
 * Liste des destinations d'une règle (L22-09, L25-10) : étape suivante, étapes, chapitres, fin,
 * lien. Destination supprimée ou non choisie : signalée (aria-invalid).
 */
export function DestinationSelect({
  editor,
  index,
  readOnly,
  label,
  action,
  dead,
  onChange,
}: {
  editor: DemoEditor;
  index: number;
  readOnly: boolean;
  label: string;
  action: ChoiceAction;
  dead: boolean;
  onChange: (a: ChoiceAction) => void;
}) {
  const { t } = useTranslation();
  const nextStep = editor.steps[index + 1];
  const missing = missingDest(action);
  const invalid = dead || missing;
  return (
    <span className="br-dest">
      <Select
        aria-label={label}
        aria-invalid={invalid || undefined}
        className={invalid ? 'is-invalid' : undefined}
        disabled={readOnly}
        value={missing ? 'none' : dead ? 'dead' : destValue(action)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(
            v === 'next'
              ? { type: 'next' }
              : v.startsWith('step:')
                ? { type: 'goto', stepId: v.slice(5) }
                : v.startsWith('chapter:')
                  ? { type: 'chapter', chapterId: v.slice(8) }
                  : v === 'url'
                    ? { type: 'url', url: 'https://' }
                    : { type: 'end' },
          );
        }}
      >
        {missing && (
          <option value="none" disabled>
            {t('editor.rules.chooseDest')}
          </option>
        )}
        {dead && !missing && (
          <option value="dead" disabled>
            {t('editor.branch.deleted')}
          </option>
        )}
        <option value="next">
          {nextStep ? t('editor.branch.next', { n: index + 2 }) : t('editor.branch.nextEnd')}
        </option>
        {editor.steps.map((s, j) =>
          j === index ? null : (
            <option key={s.id} value={`step:${s.id}`}>
              {t('editor.advanced.choice.toStep', { n: j + 1, title: s.title || t('editor.untitled') })}
            </option>
          ),
        )}
        {editor.chapters.map((ch) => (
          <option key={ch.id} value={`chapter:${ch.id}`}>
            {t('editor.advanced.choice.toChapter', { title: ch.title || t('editor.untitled') })}
          </option>
        ))}
        <option value="end">{t('editor.advanced.choice.toEnd')}</option>
        <option value="url">{t('editor.advanced.choice.toUrl')}</option>
      </Select>
      {action.type === 'url' && (
        <input
          className="fd-input"
          type="url"
          aria-label={t('editor.branch.url', { label })}
          disabled={readOnly}
          value={action.url}
          onChange={(e) => onChange({ type: 'url', url: e.target.value })}
        />
      )}
    </span>
  );
}
