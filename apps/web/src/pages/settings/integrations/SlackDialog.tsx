/**
 * ALERT-01 §7-8 : Paramètres › Intégrations, carte Slack. Webhook entrant de l'espace pour les alertes
 * analytics. L'adresse est un secret : elle est enregistrée, jamais relue (état « Connecté » seulement).
 * Leads et commentaires restent visibles en gris, « Bientôt ».
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, Send } from 'lucide-react';
import { Button, Modal } from '@flowdsiml/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';

/** Même contrôle que la base : https et hôte hooks.slack.com. */
export const slackUrlOk = (u: string) =>
  /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]{8,200}$/.test(u);

export async function slackConnected(ws: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('slack_webhook_connected', { p_ws: ws });
  return !error && data === true;
}

export function SlackDialog({
  ws,
  connected,
  logo,
  onClose,
  onChanged,
}: {
  ws: string;
  connected: boolean;
  logo: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const [confirm, ask] = useConfirm();
  const [url, setUrl] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!connected) field.current?.focus();
  }, [connected]);

  /** Enregistre l'adresse saisie. false : adresse refusée (le champ le dit). */
  async function save(): Promise<boolean> {
    const v = url.trim();
    if (!slackUrlOk(v)) {
      setErr(true);
      field.current?.focus();
      return false;
    }
    const { error } = await supabase.rpc('slack_webhook_set', { p_ws: ws, p_url: v });
    if (error) {
      setErr(true);
      return false;
    }
    setUrl('');
    await onChanged();
    return true;
  }
  /** Range un message de test, puis demande son envoi immédiat (le lien et l'envoi se font côté serveur). */
  async function test() {
    const queued = await supabase.rpc('slack_webhook_test', { p_ws: ws });
    if (queued.error || typeof queued.data !== 'number') {
      toast(
        t(
          queued.error?.message.includes('SLACK_RATE')
            ? 'integrations.slack.testRate'
            : 'integrations.slack.testKo',
        ),
      );
      return;
    }
    const sent = await supabase.functions.invoke<{ ok: boolean }>('webhooks-dispatch', {
      body: { slack_test: queued.data },
    });
    toast(t(!sent.error && sent.data?.ok ? 'integrations.slack.testOk' : 'integrations.slack.testKo'));
  }
  const run = (f: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (await save()) toast(t('integrations.slack.saved'));
    })();
  };

  return (
    <>
      {/* La confirmation est une fenêtre à part, jamais imbriquée dans celle de Slack */}
      {confirm}
      <Modal
        open
        onClose={onClose}
        size="md"
        icon={<img src={logo} alt="" width={20} height={20} />}
        title={t('integrations.soon_slack')}
        closeLabel={t('common.close')}
        describedBy={`${id}-d`}
        footer={
          connected ? (
            <>
              <Button
                variant="danger"
                aria-disabled={busy || undefined}
                onClick={run(async () => {
                  const yes = await ask({
                    title: t('integrations.slack.removeTitle'),
                    body: t('integrations.slack.removeBody'),
                    confirmLabel: t('integrations.slack.remove'),
                    danger: true,
                  });
                  if (!yes) return;
                  await supabase.rpc('slack_webhook_remove', { p_ws: ws });
                  await onChanged();
                  toast(t('integrations.slack.removed'));
                })}
              >
                {t('integrations.slack.remove')}
              </Button>
              <Button icon={<Send size={16} />} aria-disabled={busy || undefined} onClick={run(test)}>
                {t('integrations.sendTest')}
              </Button>
            </>
          ) : (
            <>
              <Button
                icon={<Send size={16} />}
                aria-disabled={busy || undefined}
                onClick={run(async () => {
                  // Le test part sur l'adresse enregistrée : elle est d'abord enregistrée
                  if (await save()) await test();
                })}
              >
                {t('integrations.sendTest')}
              </Button>
              <Button variant="primary" type="submit" form={`${id}-f`} aria-disabled={busy || undefined}>
                {t('integrations.save')}
              </Button>
            </>
          )
        }
      >
        <div className="int-slack">
          <p id={`${id}-d`}>{t('integrations.slack.body')}</p>
          <ul className="int-slack__scope">
            <li>{t('integrations.slack.scopeAlerts')}</li>
            <li aria-disabled="true">
              {t('integrations.slack.scopeLeads')} <span className="soon-text">{t('shell.soon')}</span>
            </li>
            <li aria-disabled="true">
              {t('integrations.slack.scopeComments')} <span className="soon-text">{t('shell.soon')}</span>
            </li>
          </ul>
          {connected ? (
            <p className="int-on int-slack__state" role="status">
              <i aria-hidden="true" />
              {t('integrations.slack.connected')}
            </p>
          ) : (
            <form id={`${id}-f`} onSubmit={onSubmit} noValidate>
              <div className="fd-modal__field">
                <label htmlFor={`${id}-u`}>{t('integrations.slack.url')}</label>
                <input
                  ref={field}
                  id={`${id}-u`}
                  className="fd-input"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://hooks.slack.com/services/…"
                  value={url}
                  aria-invalid={err || undefined}
                  aria-describedby={`${id}-ue`}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setErr(false);
                  }}
                />
                <span className={err ? 'stg-error' : 'stg-help'} id={`${id}-ue`}>
                  {err && <CircleAlert size={16} aria-hidden="true" />}
                  {t(err ? 'integrations.slack.urlError' : 'integrations.slack.urlHelp')}
                </span>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}
