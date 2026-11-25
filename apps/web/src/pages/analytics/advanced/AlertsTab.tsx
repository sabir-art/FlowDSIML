import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  BellRing,
  Eye,
  GraduationCap,
  Link2,
  MousePointerClick,
  Plus,
  TriangleAlert,
  UserPlus,
  X,
} from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/Toast';
import { useAuth } from '../../../auth/AuthProvider';
import { emailDigestAvailable } from '../../../components/notifications/useNotifications';
import { useConfirm } from '../../../components/ConfirmDialog';
import { Loading } from '../../../components/guards';
import type { Segment } from './SegmentsTab';
import { Empty, Status, Select } from '@flowdsiml/ui';

export type Alert = Tables<'alerts'>;
export const TRIGGERS = [
  'lead',
  'cta',
  'link_opened',
  'completion_below',
  'views_above',
  'quiz_failed_last',
  'structure_below_goal',
] as const;
export type Trigger = (typeof TRIGGERS)[number];
const ICON = {
  lead: UserPlus,
  cta: MousePointerClick,
  link_opened: Link2,
  completion_below: BarChart3,
  views_above: Eye,
  quiz_failed_last: TriangleAlert,
  structure_below_goal: GraduationCap,
};
export const hasThreshold = (t: string) => t === 'completion_below' || t === 'views_above';
type Demos = Array<{ id: string; title: string }>;

/**
 * L19-05 / 06 : alertes du workspace (liste, interrupteur, modale de création et de modification).
 * Canaux : dans l'app et webhook (alert.triggered) ; e-mail et Slack « Bientôt ». Lecture pour tous
 * les membres, écriture pour les éditeurs (RLS).
 */
export function AlertsTab({
  wsId,
  demos,
  segments,
  canEdit,
  isAdmin,
  onCount,
}: {
  wsId: string;
  demos: Demos;
  segments: Segment[];
  canEdit: boolean;
  isAdmin: boolean;
  onCount?: (n: number) => void;
}) {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [paths, setPaths] = useState<Array<{ id: string; title: string }>>([]);
  const [editing, setEditing] = useState<Alert | 'new' | null>(null);
  const toast = useToast();
  const { user } = useAuth();
  // ALERT-01 §4 : après « Ne plus recevoir ces e-mails », l'app le dit une fois
  useEffect(() => {
    if (!user) return;
    let live = true;
    void supabase
      .from('notification_settings')
      .select('alert_email_cleared_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!live || !data?.alert_email_cleared_at) return;
        toast(t('analytics.adv.al.emailCleared'));
        // La requête ne part qu'une fois attendue (then)
        void supabase
          .from('notification_settings')
          .update({ alert_email_cleared_at: null })
          .eq('user_id', user.id)
          .then(() => undefined);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const load = async () => {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: true });
    const list = (data ?? []) as Alert[];
    setAlerts(list);
    onCount?.(list.filter((a) => a.active).length);
  };
  useEffect(() => {
    void load();
    void supabase
      .from('paths')
      .select('id, title')
      .eq('workspace_id', wsId)
      .then(({ data }) => setPaths((data ?? []) as Array<{ id: string; title: string }>));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  const label = useAlertLabel(demos, segments, paths);
  if (!alerts) return <Loading />;

  async function toggle(a: Alert, on: boolean) {
    setAlerts((l) => l!.map((x) => (x.id === a.id ? { ...x, active: on } : x)));
    const { error } = await supabase.from('alerts').update({ active: on }).eq('id', a.id);
    await (error ? load() : load());
  }

  return (
    <div className="card l19">
      <div className="card-head">
        <div>
          <h2 className="t-h3">{t('analytics.adv.al.title')}</h2>
          <p className="t-caption muted">{t('analytics.adv.al.intro')}</p>
        </div>
        {canEdit && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            {t('analytics.adv.al.new')}
          </button>
        )}
      </div>
      {alerts.length === 0 && (
        <Empty
          live
          icon={<BellRing />}
          title={t('analytics.adv.al.emptyTitle')}
          body={t('analytics.adv.al.empty')}
        />
      )}
      <ul className="l19-alerts">
        {alerts.map((a) => {
          const Icon = ICON[a.trigger as Trigger] ?? BellRing;
          const l = label(a);
          return (
            <li key={a.id} className="al-row">
              <span className="ic" aria-hidden="true">
                <Icon />
              </span>
              <span>
                {canEdit ? (
                  <button type="button" className="l19-link l19-al-name" onClick={() => setEditing(a)}>
                    {l.title}
                  </button>
                ) : (
                  <b>{l.title}</b>
                )}
                <span className="t-caption muted l19-block">{l.meta}</span>
              </span>
              <Status size="sm" tone={a.active ? 'success' : 'neutral'}>
                {a.active ? t('analytics.adv.al.active') : t('analytics.adv.al.paused')}
              </Status>
              <span className="switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={a.active}
                  disabled={!canEdit}
                  aria-label={t('analytics.adv.al.toggle', { name: l.title })}
                  onChange={(e) => void toggle(a, e.target.checked)}
                />
                <span aria-hidden="true" />
              </span>
            </li>
          );
        })}
      </ul>
      {editing && (
        <AlertDialog
          wsId={wsId}
          alert={editing === 'new' ? null : editing}
          demos={demos}
          segments={segments}
          paths={paths}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function useAlertLabel(demos: Demos, segments: Segment[], paths: Array<{ id: string; title: string }>) {
  const { t } = useTranslation();
  return (a: Alert) => {
    const title = t(`analytics.adv.al.t_${a.trigger}`, { n: a.threshold ?? 0 });
    const scope =
      a.trigger === 'structure_below_goal'
        ? (paths.find((p) => p.id === a.path_id)?.title ?? '—')
        : a.segment_id
          ? t('analytics.adv.al.segmentScope', {
              name: segments.find((s) => s.id === a.segment_id)?.name ?? '—',
            })
          : a.demo_id
            ? (demos.find((d) => d.id === a.demo_id)?.title ?? '—')
            : t('analytics.allDemos');
    const channels = a.channels.map((c) => t(`analytics.adv.al.ch_${c}`)).join(t('analytics.adv.al.chJoin'));
    return { title, meta: [scope, channels, t(`analytics.adv.al.fq_${a.frequency}`)].join(' · ') };
  };
}

function AlertDialog({
  wsId,
  alert,
  demos,
  segments,
  paths,
  isAdmin,
  onClose,
  onSaved,
}: {
  wsId: string;
  alert: Alert | null;
  demos: Demos;
  segments: Segment[];
  paths: Array<{ id: string; title: string }>;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [dialog, ask] = useConfirm();
  const [trigger, setTrigger] = useState<Trigger>((alert?.trigger as Trigger) ?? 'lead');
  const [threshold, setThreshold] = useState(String(alert?.threshold ?? 50));
  const [demo, setDemo] = useState(alert?.demo_id ?? '');
  const [path, setPath] = useState(alert?.path_id ?? paths[0]?.id ?? '');
  const [segment, setSegment] = useState(alert?.segment_id ?? '');
  const [channels, setChannels] = useState<string[]>(alert?.channels ?? ['app']);
  const [frequency, setFrequency] = useState(alert?.frequency ?? 'immediate');
  const [err, setErr] = useState<string | null>(null);
  // Domaine du webhook abonné (lisible par les administrateurs seulement, RLS de webhooks)
  const [hook, setHook] = useState<string | null | undefined>(undefined);
  // ALERT-01 : l'e-mail part à l'adresse de la personne qui a créé l'alerte ; case active seulement si
  // l'envoi d'e-mails est configuré (même contrôle que Paramètres › Notifications) et si c'est son alerte
  const { user } = useAuth();
  const [mailOk, setMailOk] = useState(false);
  useEffect(() => {
    let live = true;
    void emailDigestAvailable().then((ok) => live && setMailOk(ok));
    return () => {
      live = false;
    };
  }, []);
  // ALERT-01 §7 : « Slack » actif quand l'espace a enregistré son webhook entrant
  const [slackOn, setSlackOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void supabase
      .rpc('slack_webhook_connected', { p_ws: wsId })
      .then(({ data, error }) => live && setSlackOn(!error && data === true));
    return () => {
      live = false;
    };
  }, [wsId]);
  const mine = !alert || alert.created_by === user?.id;
  const mail = channels.includes('email');

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    if (!isAdmin) return;
    void supabase
      .from('webhooks')
      .select('url, events, state')
      .eq('workspace_id', wsId)
      .then(({ data }) => {
        const w = ((data ?? []) as Array<{ url: string; events: string[]; state: string }>).find(
          (x) => x.events.includes('alert.triggered') && x.state === 'active',
        );
        setHook(w ? new URL(w.url).host : null);
      });
  }, [wsId, isAdmin]);

  const pct = trigger === 'completion_below';
  const num = Number(threshold);
  const thresholdOk =
    !hasThreshold(trigger) || (Number.isInteger(num) && num >= 1 && num <= (pct ? 100 : 1_000_000));
  const webhookOff = isAdmin && hook === null;

  async function submit() {
    setErr(null);
    if (!thresholdOk)
      return setErr(pct ? t('analytics.adv.al.thresholdPct') : t('analytics.adv.al.thresholdViews'));
    if (trigger === 'structure_below_goal' && !path) return setErr(t('analytics.adv.al.pathRequired'));
    const chans = channels.filter(
      (c) =>
        c === 'app' ||
        (c === 'webhook' && !webhookOff) ||
        (c === 'email' && (mailOk || !mine)) ||
        // « Slack » déjà choisi reste, même si le webhook de l'espace a été retiré entre-temps
        (c === 'slack' && (slackOn || !!alert?.channels.includes('slack'))),
    );
    // « E-mail » : l'alerte reste toujours visible dans l'app
    if (chans.includes('email') && !chans.includes('app')) chans.unshift('app');
    if (!chans.length) return setErr(t('analytics.adv.al.channelRequired'));
    const row = {
      trigger,
      threshold: hasThreshold(trigger) ? num : null,
      demo_id: trigger === 'structure_below_goal' ? null : demo || null,
      path_id: trigger === 'structure_below_goal' ? path : null,
      segment_id: trigger === 'structure_below_goal' ? null : segment || null,
      channels: chans,
      frequency,
    };
    const { error } = alert
      ? await supabase.from('alerts').update(row).eq('id', alert.id)
      : await supabase.from('alerts').insert({ ...row, workspace_id: wsId });
    if (error) return setErr(t('analytics.adv.al.error'));
    toast(alert ? t('analytics.adv.al.updated') : t('analytics.adv.al.created'));
    await onSaved();
    ref.current?.close();
  }

  async function remove() {
    if (!alert) return;
    const yes = await ask({
      title: t('analytics.adv.al.deleteTitle'),
      body: t('analytics.adv.al.deleteBody'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!yes) return;
    await supabase.from('alerts').delete().eq('id', alert.id);
    await onSaved();
    ref.current?.close();
  }

  const toggleCh = (c: string, on: boolean) =>
    setChannels((l) => (on ? [...new Set([...l, c])] : l.filter((x) => x !== c)));

  return (
    <dialog ref={ref} className="mk l19-alert" aria-labelledby={`${id}-t`} onClose={onClose}>
      {dialog}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="modal-head">
          <h2 id={`${id}-t`}>{alert ? t('analytics.adv.al.editTitle') : t('analytics.adv.al.new')}</h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={t('common.close')}
            onClick={() => ref.current?.close()}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body col l19-form">
          <div className="field">
            <label htmlFor={`${id}-q`}>{t('analytics.adv.al.when')}</label>
            <Select id={`${id}-q`} value={trigger} onChange={(e) => setTrigger(e.target.value as Trigger)}>
              {TRIGGERS.map((k) => (
                <option key={k} value={k}>
                  {t(`analytics.adv.al.w_${k}`)}
                </option>
              ))}
            </Select>
          </div>
          {trigger === 'structure_below_goal' ? (
            <div className="field">
              <label htmlFor={`${id}-p`}>{t('analytics.adv.al.path')}</label>
              <Select id={`${id}-p`} value={path} onChange={(e) => setPath(e.target.value)}>
                {paths.length === 0 && <option value="">{t('analytics.adv.al.noPath')}</option>}
                {paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || t('demos.untitled')}
                  </option>
                ))}
              </Select>
              <p className="help">{t('analytics.adv.al.pathHelp')}</p>
            </div>
          ) : (
            <div className={hasThreshold(trigger) ? 'l19-2col' : undefined}>
              {hasThreshold(trigger) && (
                <div className="field">
                  <label htmlFor={`${id}-s`}>
                    {pct ? t('analytics.adv.al.thrPct') : t('analytics.adv.al.thrViews')}
                  </label>
                  <input
                    id={`${id}-s`}
                    className="input num"
                    inputMode="numeric"
                    value={threshold}
                    aria-invalid={!thresholdOk || undefined}
                    onChange={(e) => setThreshold(e.target.value.replace(/\D/g, '').slice(0, 7))}
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor={`${id}-d`}>{t('analytics.adv.al.demo')}</label>
                <Select id={`${id}-d`} value={demo} onChange={(e) => setDemo(e.target.value)}>
                  <option value="">{t('analytics.allDemos')}</option>
                  {demos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          {trigger !== 'structure_below_goal' && (
            <div className="field">
              <label htmlFor={`${id}-g`}>
                {t('analytics.adv.al.segment')} <span className="opt">{t('analytics.adv.al.optional')}</span>
              </label>
              <Select id={`${id}-g`} value={segment} onChange={(e) => setSegment(e.target.value)}>
                <option value="">{t('analytics.adv.al.allVisitors')}</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {trigger === 'completion_below' && <p className="help">{t('analytics.adv.al.completionHelp')}</p>}
          {trigger === 'views_above' && <p className="help">{t('analytics.adv.al.viewsHelp')}</p>}
          <fieldset className="l19-fs">
            <legend className="t-label">{t('analytics.adv.al.notify')}</legend>
            <div className="col l19-checks">
              <label className="check" data-tip={mail ? t('analytics.adv.al.appLocked') : undefined}>
                <input
                  type="checkbox"
                  checked={mail || channels.includes('app')}
                  disabled={mail}
                  aria-describedby={mail ? `${id}-al` : undefined}
                  onChange={(e) => toggleCh('app', e.target.checked)}
                />
                {t('analytics.adv.al.inApp')}
                {mail && (
                  <span id={`${id}-al`} className="sr-only">
                    {t('analytics.adv.al.appLocked')}
                  </span>
                )}
              </label>
              <label className="check" aria-disabled={webhookOff || undefined}>
                <input
                  type="checkbox"
                  disabled={webhookOff}
                  checked={channels.includes('webhook') && !webhookOff}
                  onChange={(e) => toggleCh('webhook', e.target.checked)}
                />
                {/* Domaine du webhook : texte secondaire, sur la ligne de base du libellé */}
                <span>
                  {t('analytics.adv.al.chWebhookLabel')}
                  {hook && <span className="l19-hook">{`\u00a0· ${hook}`}</span>}
                </span>
              </label>
              {webhookOff ? (
                <p className="help l19-indent">
                  <Link to="/settings/integrations">{t('analytics.adv.al.configure')}</Link>
                </p>
              ) : (
                !isAdmin && <p className="help l19-indent">{t('analytics.adv.al.webhookHelp')}</p>
              )}
              {mailOk ? (
                <>
                  <label className="check" aria-disabled={!mine || undefined}>
                    <input
                      type="checkbox"
                      // Non modifiable mais focalisable : l'aide est lue (aria-disabled, pas disabled)
                      aria-disabled={!mine || undefined}
                      checked={mail}
                      aria-describedby={`${id}-em`}
                      onChange={(e) => mine && toggleCh('email', e.target.checked)}
                    />
                    {t('analytics.adv.al.email')}
                  </label>
                  <p className="help l19-indent" id={`${id}-em`}>
                    {t(mine ? 'analytics.adv.al.emailHelp' : 'analytics.adv.al.emailOwner')}
                  </p>
                </>
              ) : (
                <label className="check is-soon" aria-disabled="true">
                  <input type="checkbox" disabled checked={mail} readOnly />
                  {t('analytics.adv.al.email')} <span className="soon-text">{t('shell.soon')}</span>
                </label>
              )}
              <label className="check" aria-disabled={!slackOn || undefined}>
                <input
                  type="checkbox"
                  disabled={!slackOn}
                  checked={channels.includes('slack')}
                  onChange={(e) => toggleCh('slack', e.target.checked)}
                />
                {t('analytics.adv.al.slack')}
              </label>
              {slackOn === false && (
                <p className="help l19-indent">
                  {isAdmin ? (
                    <Link to="/settings/integrations?categorie=communication">
                      {t('analytics.adv.al.configure')}
                    </Link>
                  ) : (
                    t('analytics.adv.al.slackHelp')
                  )}
                </p>
              )}
            </div>
          </fieldset>
          <div className="field">
            <span className="t-label" id={`${id}-fl`}>
              {t('analytics.adv.al.frequency')}
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby={`${id}-fl`}>
              {(['immediate', 'daily', 'weekly'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={frequency === f}
                  onClick={() => setFrequency(f)}
                >
                  {t(`analytics.adv.al.f_${f}`)}
                </button>
              ))}
            </div>
          </div>
          <p className="help">{t('analytics.adv.al.antiNoise')}</p>
          {err && (
            <p className="help is-error" role="alert">
              {err}
            </p>
          )}
        </div>
        <div className="modal-foot">
          {alert && (
            <button type="button" className="btn btn-ghost l19-del" onClick={() => void remove()}>
              {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {alert ? t('common.save') : t('analytics.adv.al.create')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
