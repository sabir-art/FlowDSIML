import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, TriangleAlert } from 'lucide-react';
import type { ChoiceAction, RuleCond } from '@flowdsiml/manifest';
import { Button, NativeSelect as Select } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asAction, asStepOptions, type StepRow } from '../types';
import { isDead } from '../branch';
import { loopsWithoutExit } from '../reachability';
import {
  MAX_COND_RULES,
  condRules,
  missingDest,
  newRule,
  opsFor,
  withCondRules,
  type CondRule,
} from '../rules';
import { DestinationSelect } from './DestinationSelect';

const ICON = { size: 16, 'aria-hidden': true } as const;

/** Valeur du select « Si » : « var:<clé> », « answer:<étape> », « score » ou « ab ». */
const sourceValue = (c: RuleCond) =>
  c.source === 'var' ? `var:${c.key ?? ''}` : c.source === 'answer' ? `answer:${c.stepId ?? ''}` : c.source;

/**
 * L25-10 : section « Suite de l'étape » du panneau Étape. Règles « Si … alors aller à » (variable,
 * réponse à une étape, score du quiz, variante A/B ; opérateurs en liste fermée), « Sinon, aller à »
 * toujours présent, 8 règles au plus. Destination manquante : erreur (publication bloquée) ; boucle
 * sans sortie : alerte non bloquante.
 */
export function NextRulesFields({
  editor,
  step,
  index,
  readOnly,
}: {
  editor: DemoEditor;
  step: StepRow;
  index: number;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const opts = asStepOptions(step.options);
  const rules = condRules(opts);
  const elseAction: ChoiceAction = opts.rulesElse ?? { type: 'next' };
  const stepIds = new Set(editor.steps.map((s) => s.id));
  const chapterIds = new Set(editor.chapters.map((c) => c.id));
  const menus = editor.steps
    .map((s, j) => ({ s, j, labels: asStepOptions(s.options).choices.map((c) => c.label) }))
    .filter(({ s, labels }) => s.id !== step.id && labels.length > 0);

  const save = (next: CondRule[], elseA: ChoiceAction = elseAction) =>
    editor.updateStep(step.id, {
      options: {
        ...opts,
        ...withCondRules(opts, next),
        rulesElse: elseA.type === 'next' ? undefined : elseA,
      } as unknown as StepRow['options'],
    });
  const setRule = (k: number, patch: Partial<CondRule>) =>
    save(rules.map((r, j) => (j === k ? { ...r, ...patch } : r)));
  const setCond = (k: number, patch: Partial<RuleCond>) =>
    setRule(k, { cond: { ...rules[k]!.cond, ...patch } });

  function setSource(k: number, v: string) {
    const [src, id] = v.split(':') as [RuleCond['source'], string | undefined];
    const ops = opsFor(src);
    const cur = rules[k]!.cond;
    const cond: RuleCond = {
      source: src,
      op: ops.includes(cur.op) ? cur.op : ops[0]!,
      value: src === 'ab' ? 'B' : src === 'answer' ? (menus.find((m) => m.s.id === id)?.labels[0] ?? '') : '',
      ...(src === 'var' ? { key: id } : {}),
      ...(src === 'answer' ? { stepId: id } : {}),
    };
    setRule(k, { cond });
  }

  const loops = useMemo(
    () =>
      loopsWithoutExit(
        editor.steps.map((s) => ({
          id: s.id,
          chapterId: s.chapter_id,
          options: asStepOptions(s.options),
          hotspotActions: editor.hotspots.filter((h) => h.step_id === s.id).map((h) => asAction(h.action)),
        })),
      ),
    [editor.steps, editor.hotspots],
  );

  function valueField(r: CondRule, k: number) {
    const label = t('editor.rules.value', { n: k + 1 });
    if (r.cond.source === 'ab')
      return (
        <Select
          aria-label={label}
          disabled={readOnly}
          value={r.cond.value}
          onChange={(e) => setCond(k, { value: e.target.value })}
        >
          <option value="A">A</option>
          <option value="B">B</option>
        </Select>
      );
    const menu = r.cond.source === 'answer' ? menus.find((m) => m.s.id === r.cond.stepId) : undefined;
    if (menu && (r.cond.op === 'is' || r.cond.op === 'isNot'))
      return (
        <Select
          aria-label={label}
          disabled={readOnly}
          value={r.cond.value}
          onChange={(e) => setCond(k, { value: e.target.value })}
        >
          {menu.labels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      );
    return (
      <input
        className="fd-input"
        aria-label={label}
        disabled={readOnly}
        maxLength={200}
        inputMode={
          r.cond.source === 'score' || r.cond.op === 'lt' || r.cond.op === 'gt' ? 'decimal' : undefined
        }
        placeholder={t('editor.rules.valuePh')}
        value={r.cond.value}
        onChange={(e) => setCond(k, { value: e.target.value })}
      />
    );
  }

  return (
    <section className="sec panel-group rules-sec" aria-labelledby={`nr-${step.id}`}>
      {/* L45 (E9) : même titre de section que les autres sections du panneau */}
      <h2 className="sec-title" id={`nr-${step.id}`}>
        {t('editor.rules.title')}
      </h2>
      <p className="fd-help" style={{ margin: 0 }}>
        {t('editor.rules.intro')}
      </p>
      {rules.map((r, k) => {
        const missing = missingDest(r.goto);
        const dead = !missing && isDead(r.goto, stepIds, chapterIds);
        const errId = `nr-err-${step.id}-${k}`;
        return (
          <div key={k} className="br-rule" role="group" aria-label={t('editor.rules.group', { n: k + 1 })}>
            <div className="br-row">
              <b>{t('editor.rules.if')}</b>
              <Select
                aria-label={t('editor.rules.source', { n: k + 1 })}
                disabled={readOnly}
                value={sourceValue(r.cond)}
                onChange={(e) => setSource(k, e.target.value)}
              >
                {editor.variables.map((v) => (
                  <option key={v.id} value={`var:${v.key}`}>
                    {t('editor.rules.src_var', { key: `{{${v.key}}}` })}
                  </option>
                ))}
                {r.cond.source === 'var' && !editor.variables.some((v) => v.key === r.cond.key) && (
                  <option value={sourceValue(r.cond)}>
                    {t('editor.rules.src_var', { key: `{{${r.cond.key ?? ''}}}` })}
                  </option>
                )}
                {menus.map(({ s, j }) => (
                  <option key={s.id} value={`answer:${s.id}`}>
                    {t('editor.rules.src_answer', { n: j + 1 })}
                  </option>
                ))}
                <option value="score">{t('editor.rules.src_score')}</option>
                <option value="ab">{t('editor.rules.src_ab')}</option>
              </Select>
              {!readOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 />}
                  aria-label={t('editor.rules.remove', { n: k + 1 })}
                  title={t('editor.rules.remove', { n: k + 1 })}
                  onClick={() => save(rules.filter((_, j) => j !== k))}
                />
              )}
            </div>
            <div className="br-row nr-cond">
              <Select
                className="nr-op"
                aria-label={t('editor.rules.op', { n: k + 1 })}
                disabled={readOnly}
                value={r.cond.op}
                onChange={(e) => setCond(k, { op: e.target.value as RuleCond['op'] })}
              >
                {opsFor(r.cond.source).map((o) => (
                  <option key={o} value={o}>
                    {t(`editor.rules.op_${o}`)}
                  </option>
                ))}
              </Select>
              {valueField(r, k)}
            </div>
            <div className="br-row">
              <b>{t('editor.rules.then')}</b>
              <span aria-describedby={missing ? errId : undefined}>
                <DestinationSelect
                  editor={editor}
                  index={index}
                  readOnly={readOnly}
                  label={t('editor.rules.dest', { n: k + 1 })}
                  action={r.goto}
                  dead={dead}
                  onChange={(goto) => setRule(k, { goto })}
                />
              </span>
            </div>
            {missing && (
              <p className="field-error" id={errId}>
                {t('editor.rules.missing')}
              </p>
            )}
          </div>
        );
      })}
      <div className="br-rule br-else">
        <div className="br-row">
          <b>{t('editor.rules.else')}</b>
          <DestinationSelect
            editor={editor}
            index={index}
            readOnly={readOnly}
            label={t('editor.rules.elseDest')}
            action={elseAction}
            dead={isDead(elseAction, stepIds, chapterIds)}
            onChange={(a) => save(rules, a)}
          />
        </div>
      </div>
      {!readOnly && (
        <Button
          size="sm"
          variant="default"
          icon={<Plus />}
          disabled={rules.length >= MAX_COND_RULES}
          onClick={() => save([...rules, newRule(editor.variables[0]?.key ?? null)])}
        >
          {t('editor.rules.add')}
        </Button>
      )}
      <p className="fd-help">{t('editor.rules.help')}</p>
      {rules.length > 0 && loops.includes(index) && (
        <div className="fd-alert fd-alert--warning" role="status">
          <TriangleAlert {...ICON} />
          <div>{t('editor.rules.loop')}</div>
        </div>
      )}
    </section>
  );
}
