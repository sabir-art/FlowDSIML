/**
 * Paramètres › Mon compte › Notifications (retours client du 24/11 §6.3, maquette lot1-parametres/notifs).
 * Un tableau par événement, « Dans l'app » et « Par e-mail », puis les démos coupées. Chaque choix est
 * enregistré tout de suite et ne vaut que pour la personne (RLS : chacun sa ligne).
 *  - une mention est toujours notifiée dans l'app (L28) : son interrupteur reste activé ;
 *  - un événement coupé dans l'app ne part pas par e-mail : son interrupteur e-mail est désactivé ;
 *  - l'e-mail est un accord de la personne : rien ne part tant qu'elle n'a rien activé ;
 *  - sans service d'envoi configuré, la colonne e-mail reste visible, désactivée, avec « Bientôt ».
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';
import { emailDigestAvailable } from '../../components/notifications/useNotifications';
import { SettingsShell } from './SettingsShell';

/** Événements réglables, dans l'ordre du tableau. « lead » : notification à venir (lot suivant). */
const EVENTS = ['mention', 'reply', 'comment', 'resolved', 'alert', 'lead'] as const;
type EventKey = (typeof EVENTS)[number];
/** Événements qui ont une notification aujourd'hui. */
const LIVE: EventKey[] = ['mention', 'reply', 'comment', 'resolved', 'alert'];
type Flags = Partial<Record<EventKey, boolean>>;

const asFlags = (raw: unknown): Flags =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Flags) : {};

export function NotificationSettings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { current } = useWorkspace();
  const toast = useToast();
  const me = user?.id;
  const ws = current?.id;
  const hasRow = useRef(false);
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Flags>({});
  const [email, setEmail] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState<Flags>({});
  const [emailAvailable, setEmailAvailable] = useState(false);
  const [muted, setMuted] = useState<Array<{ demoId: string; title: string }>>([]);

  useEffect(() => {
    let live = true;
    void emailDigestAvailable().then((ok) => live && setEmailAvailable(ok));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!me) return;
    let live = true;
    void supabase
      .from('notification_settings')
      .select('prefs, email, email_prefs')
      .eq('user_id', me)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        hasRow.current = !!data;
        setPrefs(asFlags(data?.prefs));
        setEmail(!!data?.email);
        setEmailPrefs(asFlags(data?.email_prefs));
        setReady(true);
      });
    return () => {
      live = false;
    };
  }, [me]);
  const loadMuted = useCallback(async () => {
    if (!ws || !me) return;
    const { data } = await supabase
      .from('notification_mutes')
      .select('demo_id, demos(title)')
      .eq('workspace_id', ws);
    setMuted(
      ((data ?? []) as unknown as Array<{ demo_id: string; demos: { title: string } | null }>).map((m) => ({
        demoId: m.demo_id,
        title: m.demos?.title ?? '',
      })),
    );
  }, [ws, me]);
  useEffect(() => void loadMuted(), [loadMuted]);

  /** Dans l'app : activé sauf réglage contraire ; la mention l'est toujours. */
  const inApp = (k: EventKey) => k === 'mention' || prefs[k] !== false;
  /** Par e-mail : sous l'accord global ; un événement non réglé suit cet accord. */
  const byEmail = (k: EventKey) => email && emailPrefs[k] !== false && inApp(k);

  const save = async (patch: { prefs?: Flags; email?: boolean; email_prefs?: Flags }) => {
    if (!me) return false;
    const { error } = hasRow.current
      ? await supabase.from('notification_settings').update(patch).eq('user_id', me)
      : await supabase.from('notification_settings').insert({ user_id: me, ...patch });
    if (!error) hasRow.current = true;
    else toast(t('notifSettings.saveError'), undefined, { tone: 'warning' });
    return !error;
  };
  const toggleApp = async (k: EventKey, on: boolean) => {
    const before = prefs;
    const next = { ...prefs, [k]: on };
    setPrefs(next);
    if (!(await save({ prefs: next }))) setPrefs(before);
  };
  const toggleEmail = async (k: EventKey, on: boolean) => {
    const before = { email, emailPrefs };
    // Chaque événement est écrit : l'état affiché devient l'état enregistré, sans valeur implicite
    const next = Object.fromEntries(LIVE.map((e) => [e, e === k ? on : byEmail(e)])) as Flags;
    const any = LIVE.some((e) => next[e]);
    setEmailPrefs(next);
    setEmail(any);
    if (!(await save({ email: any, email_prefs: next }))) {
      setEmail(before.email);
      setEmailPrefs(before.emailPrefs);
    }
  };
  const unmute = async (demoId: string, title: string) => {
    const { error } = await supabase.from('notification_mutes').delete().eq('demo_id', demoId);
    await loadMuted();
    if (!error) toast(t('notifSettings.unmuted', { title }));
  };

  return (
    <SettingsShell legacy={false}>
      <section className="stg-sec" aria-labelledby="nt-title" aria-busy={!ready || undefined}>
        <div className="stg-sec__head">
          <div>
            <h2 id="nt-title">{t('notifSettings.title')}</h2>
            <p>{t('notifSettings.sub')}</p>
          </div>
        </div>
        <table className="stg-table nt-table">
          <thead>
            <tr>
              <th scope="col">{t('notifSettings.event')}</th>
              <th scope="col" className="nt-c">
                {t('notifSettings.inApp')}
              </th>
              <th scope="col" className="nt-c">
                {t('notifSettings.byEmail')}
                {!emailAvailable && <span className="stg-soon nt-soon">{t('shell.soon')}</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((k) => {
              const soon = !LIVE.includes(k);
              const name = t(`notifSettings.events.${k}.name`);
              return (
                <tr key={k}>
                  <th scope="row" className="nt-ev">
                    <b>
                      {name}
                      {soon && <span className="stg-soon nt-soon">{t('shell.soon')}</span>}
                    </b>
                    <span className="nt-sub">{t(`notifSettings.events.${k}.help`)}</span>
                  </th>
                  <td className="nt-c">
                    <label className="fd-switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={t('notifSettings.inAppFor', { name })}
                        aria-describedby={k === 'mention' ? 'nt-mention' : undefined}
                        checked={!soon && inApp(k)}
                        disabled={soon || k === 'mention' || !ready}
                        onChange={(e) => void toggleApp(k, e.target.checked)}
                      />
                      <span className="fd-switch__track" aria-hidden="true" />
                    </label>
                  </td>
                  <td className="nt-c">
                    <label className="fd-switch">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={t('notifSettings.byEmailFor', { name })}
                        checked={!soon && emailAvailable && byEmail(k)}
                        disabled={soon || !emailAvailable || !inApp(k) || !ready}
                        onChange={(e) => void toggleEmail(k, e.target.checked)}
                      />
                      <span className="fd-switch__track" aria-hidden="true" />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="stg-help nt-help" id="nt-mention">
          {t('notifSettings.mentionHelp')}
        </p>
        <p className="stg-help nt-help">{t('notifSettings.emailHelp')}</p>
      </section>

      <section className="stg-sec" aria-labelledby="nt-muted">
        <div className="stg-sec__head">
          <div>
            <h2 id="nt-muted">{t('notifSettings.mutedTitle')}</h2>
            <p>{t('notifSettings.mutedSub')}</p>
          </div>
        </div>
        {muted.length ? (
          <ul className="nt-muted">
            {muted.map((m) => (
              <li key={m.demoId}>
                <b>{m.title}</b>
                <Button
                  size="sm"
                  aria-label={t('notifSettings.unmuteFor', { title: m.title })}
                  onClick={() => void unmute(m.demoId, m.title)}
                >
                  {t('notifSettings.unmute')}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="stg-help nt-none">{t('notifSettings.mutedNone')}</p>
        )}
      </section>
    </SettingsShell>
  );
}
