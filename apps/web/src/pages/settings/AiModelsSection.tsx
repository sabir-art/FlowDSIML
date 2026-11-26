import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspaceModels } from '../../lib/ai';
import { useToast } from '../../components/Toast';

/**
 * L41 étape 5 (spec UX §5) : Paramètres › Assistance IA, « Modèles proposés dans l'assistant ». Seulement les
 * modèles cochés dans la Console, dans leur ordre ; Auto en tête, toujours proposé. Le propriétaire peut
 * retirer des modèles, pas en ajouter (au moins un coché). Les admins lisent ; les autres rôles ne voient rien.
 */
export function AiModelsSection({ ws, role }: { ws: string; role: string | undefined }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { state, set } = useWorkspaceModels(ws);
  const [busy, setBusy] = useState(false);
  const [keep, setKeep] = useState(false);
  const [failed, setFailed] = useState(false);
  if (role !== 'owner' && role !== 'admin') return null;
  if (!state || !state.all.length) return null;
  const owner = role === 'owner';
  const checked = (id: string) => (state.chosen ? state.chosen.includes(id) : true);

  const toggle = async (id: string, on: boolean) => {
    const next = state.all.map((m) => m.id).filter((m) => (m === id ? on : checked(m)));
    if (!next.length) return setKeep(true);
    setKeep(false);
    setFailed(false);
    const prev = state.chosen;
    set({ ...state, chosen: next });
    setBusy(true);
    const { data, error } = await supabase.rpc('set_ai_models', { p_ws: ws, p_models: next });
    setBusy(false);
    if (error) {
      set({ ...state, chosen: prev });
      return setFailed(true);
    }
    set({ ...state, chosen: (data as { models: string[] }).models });
    toast(t('ai.models.saved'));
  };

  return (
    <section className="stg-sec ai-models" aria-labelledby="ai-models-title">
      <div className="stg-sec__head">
        <div>
          <h2 id="ai-models-title">{t('ai.models.title')}</h2>
          <p id="ai-models-help">{t('ai.models.help')}</p>
        </div>
        {!owner && (
          <span className="stg-readonly">
            <Lock aria-hidden="true" />
            {t('ai.models.ownersOnly')}
          </span>
        )}
      </div>
      <fieldset className="stg-row stg-fieldset" aria-describedby="ai-models-help ai-models-keep-help">
        <legend className="sr-only">{t('ai.models.title')}</legend>
        <div className="stg-text">
          <p className="stg-help" id="ai-models-keep-help">
            {t('ai.models.keepHelp')}
          </p>
        </div>
        <div className="stg-ctl stg-opts ai-models__list">
          <label className="stg-opt">
            <input type="checkbox" checked disabled />
            <span className="ai-models__tx">
              <span>
                <b>{t('ai.model.auto')}</b> <span className="ai-models__always">{t('ai.models.always')}</span>
              </span>
              <small>{t('ai.model.autoHelp')}</small>
            </span>
          </label>
          {state.all.map((m) => (
            <label key={m.id} className="stg-opt">
              <input
                type="checkbox"
                id={`ai-wm-${m.id}`}
                checked={checked(m.id)}
                disabled={!owner || busy}
                aria-describedby={keep ? 'ai-models-keep' : undefined}
                onChange={(e) => void toggle(m.id, e.target.checked)}
              />
              <span className="ai-models__tx">
                <span>
                  <b>{m.label}</b>
                  {m.tag === 'recommended' && (
                    <span className="ai-models__tag">{t('ai.model.recommended')}</span>
                  )}
                  {m.tag === 'beta' && <span className="aim-beta">{t('ai.model.beta')}</span>}
                </span>
                <small>
                  {t(`ai.model.help.${m.id}`, {
                    defaultValue: `${t(`console.ai.speed.${m.speed}`)} · ${t(`console.ai.cost.${m.cost}`)}`,
                  })}
                </small>
              </span>
            </label>
          ))}
          {keep && (
            <p className="field-error" id="ai-models-keep" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              {t('ai.models.keepOne')}
            </p>
          )}
          {failed && (
            <p className="stg-error ai-error" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              {t('ai.settings.saveError')}
            </p>
          )}
        </div>
      </fieldset>
    </section>
  );
}
