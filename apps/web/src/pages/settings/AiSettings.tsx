import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Shield, X } from 'lucide-react';
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
import '../../components/ai/ai.css';

/** Fonctions à venir, listées sous les cases (§2) : toujours désactivées, badge « Bientôt ». */
const SOON = [{ k: 'images', icon: <ImagePlus aria-hidden="true" /> }] as const;

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

  return (
    <SettingsShell>
      <section className="soon-page ai-settings" aria-labelledby="ai-t">
        <h2 className="t-h2" id="ai-t">
          {t('ai.name')}
        </h2>
        <p className="muted">{t('ai.settings.sub')}</p>
        {error && (
          <p className="alert alert-danger" role="alert">
            {t('ai.settings.loadError')}
          </p>
        )}
        <div className="card card-pad">
          <div className="setting">
            <div>
              <b id="ai-sw">{t('ai.settings.switch')}</b>
              <p className="t-caption muted" id="ai-sw-help">
                {status?.enabled ? t('ai.settings.on') : t('ai.settings.off')}
                {!manage && status && <> {t('ai.settings.readOnly')}</>}
              </p>
            </div>
            <span className="switch">
              <input
                type="checkbox"
                role="switch"
                aria-labelledby="ai-sw"
                aria-describedby="ai-sw-help"
                checked={!!status?.enabled}
                disabled={!manage || busy || !status}
                onChange={(e) => void onSwitch(e.target.checked)}
              />
              <span aria-hidden="true" />
            </span>
          </div>
          <Notice />
          {failed && (
            <p className="alert alert-danger" role="alert">
              {t('ai.settings.saveError')}
            </p>
          )}
          {status?.enabled && (
            <>
              <div className="ai-quota">
                <b id="ai-q">
                  {status.quota != null
                    ? t('ai.settings.quota', { used: status.used, quota: status.quota })
                    : t('ai.settings.quotaNone', { count: status.used })}
                </b>
                {status.quota != null && (
                  <div
                    className="ai-bar"
                    role="progressbar"
                    aria-labelledby="ai-q"
                    aria-valuemin={0}
                    aria-valuemax={status.quota}
                    aria-valuenow={Math.min(status.used, status.quota)}
                  >
                    <span
                      style={{ width: `${Math.min(100, (status.used / Math.max(1, status.quota)) * 100)}%` }}
                    />
                  </div>
                )}
                {status.renewsOn && (
                  <p className="t-caption muted">
                    {t('ai.settings.renews', { date: date(status.renewsOn) })}
                  </p>
                )}
              </div>
              <fieldset className="ai-features">
                <legend>{t('ai.settings.features')}</legend>
                {AI_FEATURES.filter((f) => !AUDIO_FEATURES.includes(f)).map((f) => (
                  <label key={f} className="check">
                    <input
                      type="checkbox"
                      checked={local[f] ?? status.features[f]}
                      disabled={!manage || busy}
                      onChange={(e) => {
                        setLocal((l) => ({ ...l, [f]: e.target.checked }));
                        void save(true, { [f]: e.target.checked });
                      }}
                    />
                    {t(`ai.feature.${f}`)}
                  </label>
                ))}
              </fieldset>
              {/* L30b §2 : voix et sous-titres, consentement séparé (ElevenLabs, audio) */}
              <fieldset className="ai-features ai-audio">
                <legend>{t('ai.audioSettings.title')}</legend>
                <Notice k="ai.audioSettings.notice" />
                {AUDIO_FEATURES.map((f) => {
                  const used = (f === 'voice' ? status.ttsUsed : status.sttUsed) ?? 0;
                  const quota = f === 'voice' ? status.ttsQuota : status.sttQuota;
                  return (
                    <div key={f} className="ai-audio-row">
                      <label className="check">
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
                        {t(`ai.feature.${f}`)}
                      </label>
                      <p className="t-caption" id={`ai-q-${f}`}>
                        {quota != null
                          ? t(`ai.audioSettings.quota_${f}`, {
                              used: formatSeconds(used),
                              quota: formatSeconds(quota),
                            })
                          : t(`ai.audioSettings.used_${f}`, { used: formatSeconds(used) })}
                      </p>
                      {quota != null && (
                        <div
                          className="ai-bar"
                          role="progressbar"
                          aria-labelledby={`ai-q-${f}`}
                          aria-valuemin={0}
                          aria-valuemax={quota}
                          aria-valuenow={Math.min(used, quota)}
                        >
                          <span style={{ width: `${Math.min(100, (used / Math.max(1, quota)) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {status.renewsOn && (
                  <p className="t-caption muted">
                    {t('ai.settings.renews', { date: date(status.renewsOn) })}
                  </p>
                )}
                {SOON.map((s) => (
                  <label key={s.k} className="check is-soon">
                    <input type="checkbox" disabled aria-describedby={`ai-soon-${s.k}`} />
                    {s.icon}
                    {t(`ai.soon.${s.k}`)}
                    <span className="fd-badge" id={`ai-soon-${s.k}`}>
                      {t('shell.soon')}
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
        </div>
      </section>
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

/** Bandeau de confidentialité (texte de la spec, vérifié contre la configuration réelle). */
function Notice({ k = 'ai.settings.notice' }: { k?: string }) {
  const { t } = useTranslation();
  return (
    <div className="alert ai-notice">
      <Shield aria-hidden="true" />
      <p>{t(k)}</p>
    </div>
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="mk">
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ai-on-t">
          <div className="modal-head">
            <h2 id="ai-on-t">
              {audio ? t(`ai.audioSettings.enableTitle_${audio}`) : t('ai.settings.enableTitle')}
            </h2>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="modal-body">
            <Notice k={audio ? 'ai.audioSettings.notice' : undefined} />
            <label className="check">
              <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} autoFocus />
              {t('ai.settings.read')}
            </label>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" disabled={!read || busy} onClick={onConfirm}>
              {t('ai.settings.enable')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
