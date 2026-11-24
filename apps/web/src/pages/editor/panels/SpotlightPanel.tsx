import { Accessibility, Flashlight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FREE_SPOTLIGHT } from '@flowdsiml/manifest';
import { Slider, Switch } from '@flowdsiml/ui';
import type { DemoEditor } from '../useDemoEditor';
import { asSettings, freeSpotlightOf } from '../types';

/**
 * EXT-02 §6.3 : panneau « Projecteur ». Réglage de toute la démo : un halo suit le pointeur du visiteur
 * sur les étapes capture, le reste est assombri. Taille du halo (px à l'échelle d'une capture de 1 280 px)
 * et assombrissement ; halo fixe si le visiteur préfère moins d'animations.
 */
export function SpotlightPanel({ editor, readOnly }: { editor: DemoEditor; readOnly: boolean }) {
  const { t } = useTranslation();
  const settings = asSettings(editor.demo!.settings);
  const sp = freeSpotlightOf(settings);
  const set = (patch: Partial<typeof sp>) =>
    editor.updateDemo({ settings: { ...settings, spotlight: { ...sp, ...patch } } });
  // Les touches d'un curseur règlent sa valeur, pas l'étape (raccourcis de l'éditeur)
  const keep = (e: { key: string; stopPropagation: () => void }) => {
    if (/^(Arrow|Home$|End$|Page)/.test(e.key)) e.stopPropagation();
  };
  return (
    <div className="sp-panel">
      <div className="sp-card">
        <Switch
          label={
            <>
              <Flashlight aria-hidden="true" />
              {t('editor.spotlight.enable')}
            </>
          }
          checked={sp.enabled}
          disabled={readOnly}
          aria-describedby="sp-help"
          onChange={(e) => set({ enabled: e.target.checked })}
        />
      </div>
      <p className="sp-help" id="sp-help">
        {t('editor.spotlight.help')}
      </p>
      <div className="sp-field" onKeyDown={keep}>
        <span className="sp-label" id="sp-size">
          {t('editor.spotlight.size')} <span className="sp-val">· {sp.size} px</span>
        </span>
        <Slider
          aria-labelledby="sp-size"
          min={FREE_SPOTLIGHT.size.min}
          max={FREE_SPOTLIGHT.size.max}
          step={10}
          value={sp.size}
          valueText={`${sp.size} px`}
          disabled={readOnly || !sp.enabled}
          onChange={(v) => set({ size: v })}
        />
      </div>
      <div className="sp-field" onKeyDown={keep}>
        <span className="sp-label" id="sp-dim">
          {t('editor.spotlight.dim')} <span className="sp-val">· {sp.dim} %</span>
        </span>
        <Slider
          aria-labelledby="sp-dim"
          min={FREE_SPOTLIGHT.dim.min}
          max={FREE_SPOTLIGHT.dim.max}
          step={5}
          value={sp.dim}
          valueText={`${sp.dim} %`}
          disabled={readOnly || !sp.enabled}
          onChange={(v) => set({ dim: v })}
        />
      </div>
      <div className="sp-card">
        <Switch
          label={
            <>
              <Accessibility aria-hidden="true" />
              <span>{t('editor.spotlight.fixed')}</span>
            </>
          }
          checked={sp.fixedOnReducedMotion}
          disabled={readOnly || !sp.enabled}
          onChange={(e) => set({ fixedOnReducedMotion: e.target.checked })}
        />
      </div>
    </div>
  );
}
