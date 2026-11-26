import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Shield } from 'lucide-react';
import { Button, Modal } from '@flowdsiml/ui';
import { SettingsShell } from './SettingsShell';
import { supabase } from '../../lib/supabase';
import {
  AI_FEATURES,
  AUDIO_FEATURES,
  formatSeconds,
  refreshAiStatus,
  useAiStatus,
  type AiFeature,
} from '../../lib/ai';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { AiModelsSection } from './AiModelsSection';
import '../../components/ai/ai.css';

/** Fonctions à venir, listées sous les cases (§2) : toujours désactivées, mention « Bientôt ». */
const SOON = [{ k: 'images' }] as const;

/** L30-01 : Paramètres › Assistance IA (opt-in de l'espace, quota du mois, fonctions activables). */
export function AiSettings() {
  const { t, i18n } = useTranslation();
  const { current } = useWorkspace();
  const toast = useToast();
  const [confirmNode, confirm] = useConfirm();
  const { status, error } = useAiStatus(current?.id);
  const [asking, setAsking] = useState(false);
  const [askingAudio, setAskingAudio] = useState<'voice' | 'captions' | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Cases : affichage immédiat, puis état relu en base
  const [local, setLocal] = useState<Partial<Record<AiFeature, boolean>>>({});
  const manage = !!status?.canManage;

  const save = async (enabled: boolean, features?: Partial<Record<AiFeature, boolean>>) => {
    if (!current) return false;
    setBusy(true);
    const { error: e } = await supabase.rpc('set_ai_settings', {
      p_ws: current.id,
      p_enabled: enabled,
      p_features: features ?? null,
    });
    setBusy(false);
    setFailed(!!e);
    if (!e) await refreshAiStatus();
    setLocal({});
    return !e;
  };

  const onSwitch = async (on: boolean) => {
    if (on) return setAsking(true);
    const ok = await confirm({
      title: t('ai.settings.offTitle'),
      body: t('ai.settings.offBody'),
      confirmLabel: t('ai.settings.offConfirm'),
    });
    if (ok && (await save(false))) toast(t('ai.settings.offToast'));
  };

  const date = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso))
      : '';

  const meter = (labelId: string, used: number, quota: number) => (
    <div
      className="stg-meter"
      role="progressbar"
      aria-labelledby={labelId}
      aria-valuemin={0}
      aria-valuemax={quota}
      aria-valuenow={Math.min(used, quota)}
    >
      <span style={{ width: `${Math.min(100, (used / Math.max(1, quota)) * 100)}%` }} />
    </div>
  );
  const renews = status?.renewsOn ? (
    <div className="stg-help">{t('ai.settings.renews', { date: date(status.renewsOn) })}</div>
  ) : null;

  return (
    <SettingsShell legacy={false}>
      <section className="stg-sec ai-settings" aria-labelledby="ai-title">
        <div className="stg-sec__head">
          <div>
            <h2 id="ai-title">{t('ai.name')}</h2>
            <p>{t('ai.settings.sub')}</p>
          </div>
        </div>
        {error && (
          <p className="stg-error ai-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {t('ai.settings.loadError')}
          </p>
        )}
        <div className="stg-row stg-row--inline">
          <div className="stg-text" data-gap-exempt="">
            <div className="stg-lab" id="ai-sw">
              {t('ai.settings.switch')}
            </div>
            <div className="stg-help ai-notice" id="ai-sw-help">
              {t('ai.settings.notice')}
              {!manage && status && <> {t('ai.settings.readOnly')}</>}
            </div>
          </div>
          <div className="stg-ctl">
            <label className="fd-switch">
              <input
                type="checkbox"
                role="switch"
                aria-labelledby="ai-sw"
                aria-describedby="ai-sw-help"
                checked={!!status?.enabled}
                disabled={!manage || busy || !status}
                onChange={(e) => void onSwitch(e.target.checked)}
              />
              <span className="fd-switch__track" aria-hidden="true" />
            </label>
          </div>
        </div>
        {failed && (
          <p className="stg-error ai-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {t('ai.settings.saveError')}
          </p>
        )}
        {status?.enabled && (
          <>
            <div className="stg-row">
              <div className="stg-text ai-quota" data-gap-exempt="">
                <div className="stg-lab" id="ai-q">
                  {status.quota != null
                    ? t('ai.settings.quota', { used: status.used, quota: status.quota })
                    : t('ai.settings.quotaNone', { count: status.used })}
                </div>
                {renews}
              </div>
              <div className="stg-ctl">
                {status.quota != null && meter('ai-q', status.used, status.quota)}
              </div>
            </div>
            <fieldset className="stg-row stg-fieldset ai-features">
              <legend className="sr-only">{t('ai.settings.features')}</legend>
              <div className="stg-text">
                <div className="stg-lab" aria-hidden="true">
                  {t('ai.settings.features')}
                </div>
              </div>
              <div className="stg-ctl stg-opts">
                {AI_FEATURES.filter((f) => !AUDIO_FEATURES.includes(f)).map((f) => (
                  <label key={f} className="stg-opt">
                    <input
                      type="checkbox"
                      checked={local[f] ?? status.features[f]}
                      disabled={!manage || busy}
                      onChange={(e) => {
                        setLocal((l) => ({ ...l, [f]: e.target.checked }));
                        void save(true, { [f]: e.target.checked });
                      }}
                    />
                    <span>{t(`ai.feature.${f}`)}</span>
                  </label>
                ))}
                {SOON.map((s) => (
                  <label key={s.k} className="stg-opt is-soon">
                    <input type="checkbox" disabled />
                    <span>
                      <span>
                        {t(`ai.soon.${s.k}`)} <span className="stg-soon">{t('shell.soon')}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
      </section>
      {/* L41 étape 5 : modèles de l'assistant gardés par l'espace (propriétaire ; admins en lecture) */}
      {status?.enabled && current && <AiModelsSection ws={current.id} role={current.role} />}
      {status?.enabled && (
        /* L30b §2 : voix et sous-titres, consentement séparé (ElevenLabs, audio) */
        <section className="stg-sec ai-features ai-audio" aria-labelledby="ai-audio-title">
          <div className="stg-sec__head">
            <div>
              <h2 id="ai-audio-title">{t('ai.audioSettings.title')}</h2>
              <p>{t('ai.audioSettings.notice')}</p>
            </div>
          </div>
          {AUDIO_FEATURES.map((f) => {
            const used = (f === 'voice' ? status.ttsUsed : status.sttUsed) ?? 0;
            const quota = f === 'voice' ? status.ttsQuota : status.sttQuota;
            return (
              <div key={f} className="stg-row">
                <div className="stg-text" data-gap-exempt="">
                  <label className="stg-opt">
                    <input
                      type="checkbox"
                      checked={local[f] ?? status.features[f]}
                      disabled={!manage || busy}
                      onChange={(e) => {
                        if (e.target.checked) return setAskingAudio(f as 'voice' | 'captions');
                        setLocal((l) => ({ ...l, [f]: false }));
                        void save(true, { [f]: false });
                      }}
                    />
                    <span>
                      <b>{t(`ai.feature.${f}`)}</b>
                    </span>
                  </label>
                </div>
                <div className="stg-ctl">
                  {quota != null && meter(`ai-q-${f}`, used, quota)}
                  <span className="stg-help" id={`ai-q-${f}`}>
                    {quota != null
                      ? t(`ai.audioSettings.quota_${f}`, {
                          used: formatSeconds(used),
                          quota: formatSeconds(quota),
                        })
                      : t(`ai.audioSettings.used_${f}`, { used: formatSeconds(used) })}
                  </span>
                </div>
              </div>
            );
          })}
          {renews && <div className="ai-renews">{renews}</div>}
        </section>
      )}
      {confirmNode}
      {askingAudio && (
        <EnableDialog
          audio={askingAudio}
          onClose={() => setAskingAudio(null)}
          onConfirm={async () => {
            const f = askingAudio;
            setLocal((l) => ({ ...l, [f]: true }));
            if (await save(true, { [f]: true })) {
              setAskingAudio(null);
              toast(t(`ai.audioSettings.onToast_${f}`));
            }
          }}
          busy={busy}
        />
      )}
      {asking && (
        <EnableDialog
          onClose={() => setAsking(false)}
          onConfirm={async () => {
            if (await save(true)) {
              setAsking(false);
              toast(t('ai.settings.onToast'));
            }
          }}
          busy={busy}
        />
      )}
    </SettingsShell>
  );
}

function EnableDialog({
  onClose,
  onConfirm,
  busy,
  audio,
}: {
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  /** L30b §2 : confirmation dédiée à la voix ou aux sous-titres (autre fournisseur, audio). */
  audio?: 'voice' | 'captions';
}) {
  const { t } = useTranslation();
  const [read, setRead] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      icon={<Shield />}
      title={audio ? t(`ai.audioSettings.enableTitle_${audio}`) : t('ai.settings.enableTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={!read || busy} onClick={onConfirm}>
            {t('ai.settings.enable')}
          </Button>
        </>
      }
    >
      {/* Texte de confidentialité de la spec, vérifié contre la configuration réelle */}
      <div className="ai-consent">
        <p>{t(audio ? 'ai.audioSettings.notice' : 'ai.settings.notice')}</p>
        <label className="stg-opt">
          <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} autoFocus />
          <span>{t('ai.settings.read')}</span>
        </label>
      </div>
    </Modal>
  );
}
