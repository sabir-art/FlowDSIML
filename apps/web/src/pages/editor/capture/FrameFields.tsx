import { useTranslation } from 'react-i18next';
import { DEFAULT_FRAME, type Frame } from '@flowdsiml/manifest';
import type { DemoEditor } from '../useDemoEditor';
import { asSettings } from '../types';
import { allTabs } from './tabs';

/** Cadre réglé de la démo (défaut : celui que publie la première publication). */
export const demoFrame = (editor: DemoEditor): Frame => {
  const theme = asSettings(editor.demo?.settings).theme as { frame?: Partial<Frame> } | undefined;
  return { ...DEFAULT_FRAME, ...(theme?.frame ?? {}) };
};

const STYLES = ['light', 'dark', 'minimal', 'none'] as const;

/**
 * L25-03 : section « Cadre du navigateur » de l'onglet Design (toute la démo). Remplace la bascule
 * d'A2-01. Démo mobile : « Cadre du téléphone » (Afficher / Masquer).
 */
export function FrameFields({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const frame = demoFrame(editor);
  const settings = asSettings(editor.demo?.settings);
  const set = (patch: Partial<Frame>) =>
    editor.updateDemo({
      settings: {
        ...settings,
        theme: { ...(settings.theme ?? {}), frame: { ...frame, ...patch } },
      } as never,
    });
  const mobile = editor.demo?.device === 'mobile';
  const firstUrl = editor.steps.find((s) => s.page_url)?.page_url?.replace(/^https?:\/\//, '') ?? '';
  const firstTitle =
    allTabs(editor.steps)[0]?.title ||
    editor.steps.find((s) => s.page_title)?.page_title ||
    editor.demo?.title ||
    '';
  const off = readOnly || frame.style === 'none';

  if (mobile)
    return (
      <div className="field">
        <span className="t-label" id="fr-phone-l">
          {t('editor.frame.phone')}
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="fr-phone-l">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={frame.phone === v}
              disabled={readOnly}
              onClick={() => set({ phone: v })}
            >
              {t(v ? 'editor.frame.show' : 'editor.frame.hide')}
            </button>
          ))}
        </div>
      </div>
    );

  const toggle = (key: 'addressBar' | 'tabs' | 'windowButtons', label: string) => (
    <div className="setting">
      <span className="t-label" id={`fr-${key}-l`}>
        {label}
      </span>
      <span className="switch">
        <input
          type="checkbox"
          aria-labelledby={`fr-${key}-l`}
          checked={frame[key]}
          disabled={off}
          onChange={(e) => set({ [key]: e.target.checked })}
        />
        <span />
      </span>
    </div>
  );

  return (
    // L45 (E10) : un groupe par réglage (interrupteur, puis le champ qu'il ouvre)
    <div className="fr-fields fd-stack fd-stack--group">
      <div className="field">
        <span className="t-label" id="fr-style-l">
          {t('editor.frame.style')}
        </span>
        <div className="segmented frame-seg" role="radiogroup" aria-labelledby="fr-style-l">
          {STYLES.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={frame.style === k}
              disabled={readOnly}
              onClick={() => set({ style: k })}
            >
              {t(`editor.frame.style_${k}`)}
            </button>
          ))}
        </div>
      </div>
      {toggle('addressBar', t('editor.frame.addressBar'))}
      {frame.addressBar && (
        <div className="field">
          <label className="t-label" htmlFor="fr-address">
            {t('editor.frame.address')}
          </label>
          <input
            id="fr-address"
            className="input input-sm"
            value={frame.address}
            maxLength={120}
            placeholder={firstUrl || 'app.example.com'}
            disabled={off}
            aria-describedby="fr-address-h"
            onChange={(e) => set({ address: e.target.value })}
          />
          <span className="help" id="fr-address-h">
            {t('editor.frame.addressHelp')}
          </span>
        </div>
      )}
      {toggle('tabs', t('editor.frame.tabs'))}
      {frame.tabs && (
        <div className="field">
          <label className="t-label" htmlFor="fr-tab">
            {t('editor.frame.tabTitle')}
          </label>
          <input
            id="fr-tab"
            className="input input-sm"
            value={frame.tabTitle}
            maxLength={80}
            placeholder={firstTitle}
            disabled={off}
            aria-describedby="fr-tab-h"
            onChange={(e) => set({ tabTitle: e.target.value })}
          />
          <span className="help" id="fr-tab-h">
            {t('editor.frame.tabTitleHelp')}
          </span>
        </div>
      )}
      {frame.style !== 'minimal' && toggle('windowButtons', t('editor.frame.windowButtons'))}
    </div>
  );
}
