import { SettingsShell } from './SettingsShell';
import { useConfirm } from '../../components/ConfirmDialog';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { formatNumber } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useToast } from '../../components/Toast';
import { CircleAlert } from 'lucide-react';
import { Button, Select } from '@flowdsiml/ui';
import { SUPPORT_EMAIL_RE, SUPPORT_HTTPS_RE } from '../../lib/support';

const HTTPS = /^https:\/\/\S+$/;

/**
 * Paramètres › Général, maquette lot1-parametres/general : trois sections posées sur le fond de contenu
 * (Identité, Confidentialité et partage, Langue et région) en rangées « libellé et aide | contrôle »,
 * Annuler et Enregistrer dans la barre de page, puis la Zone de danger encadrée à part. Le site web est
 * rangé dans workspaces.settings (comme la politique de confidentialité) ; le logo, la langue des
 * nouvelles démos et le fuseau horaire sont annoncés « Bientôt ».
 */
export function WorkspaceSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const navigate = useNavigate();
  const { current, can, reload } = useWorkspace();
  const ws = current!;
  const wsSettings = (ws.settings ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof wsSettings[k] === 'string' ? (wsSettings[k] as string) : '');
  const savedPrivacy = str('privacyUrl');
  const savedWebsite = str('websiteUrl');
  // L26-02 : contact d'aide (e-mail ou lien https) proposé en bas du panneau d'aide
  const savedHelp = str('helpContact');
  const [helpContact, setHelpContact] = useState(savedHelp);
  const [name, setName] = useState(ws.name);
  const [slug, setSlug] = useState(ws.slug);
  const [website, setWebsite] = useState(savedWebsite);
  const [privacyUrl, setPrivacyUrl] = useState(savedPrivacy);
  const [urlError, setUrlError] = useState<{ id: string; text: string } | null>(null);
  const [counts, setCounts] = useState<{ demos: number; leads: number } | null>(null);
  const { busy, error, run } = useAction();
  const editable = can('workspace.settings');
  const soon = <span className="stg-soon">{t('shell.soon')}</span>;

  const reset = () => {
    setName(ws.name);
    setSlug(ws.slug);
    setWebsite(savedWebsite);
    setPrivacyUrl(savedPrivacy);
    setHelpContact(savedHelp);
    setUrlError(null);
  };

  useEffect(reset, [ws.name, ws.slug, savedPrivacy, savedWebsite, savedHelp]);

  // PRM-06 / PRM-11 : conséquences chiffrées de la suppression
  useEffect(() => {
    if (!can('workspace.delete')) return;
    void Promise.all([
      supabase
        .from('demos')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws.id)
        .is('deleted_at', null),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
    ]).then(([d, l]) => setCounts({ demos: d.count ?? 0, leads: l.count ?? 0 }));
  }, [ws.id, can]);

  async function save(e: FormEvent) {
    e.preventDefault();
    for (const [id, v] of [
      ['ws-site', website],
      ['ws-privacy', privacyUrl],
    ] as const) {
      if (v.trim() && !HTTPS.test(v.trim())) {
        setUrlError({ id, text: t('validation.httpsUrl') });
        document.getElementById(id)?.focus();
        return;
      }
    }
    const hc = helpContact.trim();
    if (hc && !SUPPORT_HTTPS_RE.test(hc) && !SUPPORT_EMAIL_RE.test(hc)) {
      setUrlError({ id: 'ws-help', text: t('help.contactInvalid') });
      document.getElementById('ws-help')?.focus();
      return;
    }
    setUrlError(null);
    const settings = {
      ...wsSettings,
      helpContact: hc || null,
      privacyUrl: privacyUrl.trim() || null,
      websiteUrl: website.trim() || null,
    };
    await run(async () => {
      check(await supabase.from('workspaces').update({ name, slug, settings }).eq('id', ws.id));
      await reload();
      toast(t('workspace.saved'));
    });
  }

  async function remove() {
    if (
      !(await ask({
        title: t('workspace.deleteTitle', { name: ws.name }),
        body: counts?.demos
          ? t('workspace.deleteBodyCounts', {
              demos: t('workspace.nDemos', { count: counts.demos, n: formatNumber(counts.demos) }),
              leads: t('workspace.nLeads', { count: counts.leads, n: formatNumber(counts.leads) }),
            })
          : t('workspace.deleteHint'),
        confirmLabel: t('workspace.deleteForever'),
        danger: true,
        requireText: ws.name,
        requireLabel: (
          <>
            {t('workspace.typeName1')} <b>{ws.name}</b> {t('workspace.typeName2')}
          </>
        ),
      }))
    )
      return;
    void run(async () => {
      check(await supabase.from('workspaces').delete().eq('id', ws.id));
      await reload();
      navigate('/', { replace: true });
    });
  }

  const errFor = (id: string) =>
    urlError?.id === id ? (
      <p id={`${id}-error`} className="stg-error">
        <CircleAlert size={16} aria-hidden="true" />
        {urlError.text}
      </p>
    ) : null;
  const described = (id: string, help?: string) =>
    [urlError?.id === id ? `${id}-error` : null, help].filter(Boolean).join(' ') || undefined;

  return (
    <SettingsShell
      legacy={false}
      actions={
        editable ? (
          <>
            <Button onClick={reset} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" type="submit" form="ws-form" disabled={busy}>
              {t('common.save')}
            </Button>
          </>
        ) : undefined
      }
    >
      {dialog}
      <form id="ws-form" onSubmit={save} noValidate={false}>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        <section className="stg-sec" aria-labelledby="ws-sec-identity">
          <div className="stg-sec__head">
            <div>
              <h2 id="ws-sec-identity">{t('workspace.identity')}</h2>
              <p>{t('workspace.identityHelp')}</p>
            </div>
          </div>
          {/* §18.6 : rangées à filets, l'écart est porté par leur padding de 20 px */}
          <div data-gap-exempt="">
            <div className="stg-row">
              <div>
                <div className="stg-lab">
                  {t('workspace.logo')} {soon}
                </div>
                <div className="stg-help">{t('workspace.logoHelp')}</div>
              </div>
              <div className="stg-ctl">
                <div className="stg-lr">
                  <span className="stg-logo" aria-hidden="true">
                    {((name || ws.name).trim()[0] ?? '?').toUpperCase()}
                  </span>
                  <Button aria-disabled="true">{t('workspace.changeLogo')}</Button>
                </div>
              </div>
            </div>
            <div className="stg-row">
              <div>
                <label className="stg-lab" htmlFor="ws-name">
                  {t('workspace.wsName')}
                </label>
              </div>
              <div className="stg-ctl">
                <input
                  id="ws-name"
                  className="fd-input"
                  required
                  maxLength={80}
                  autoComplete="organization"
                  disabled={!editable}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
            <div className="stg-row">
              <div>
                <label className="stg-lab" htmlFor="ws-site">
                  {t('workspace.website')}
                </label>
              </div>
              <div className="stg-ctl">
                <input
                  id="ws-site"
                  className="fd-input"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder={t('workspace.websitePlaceholder')}
                  maxLength={500}
                  disabled={!editable}
                  value={website}
                  aria-invalid={urlError?.id === 'ws-site' ? true : undefined}
                  aria-describedby={described('ws-site')}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                    setUrlError(null);
                  }}
                />
                {errFor('ws-site')}
              </div>
            </div>
            <div className="stg-row">
              <div>
                <label className="stg-lab" htmlFor="ws-slug">
                  {t('workspace.slug')}
                </label>
                <div id="ws-slug-help" className="stg-help">
                  {t('workspace.slugHelp')}
                </div>
              </div>
              <div className="stg-ctl">
                <div className="stg-group stg-short">
                  <span className="stg-group__pre" aria-hidden="true">
                    {t('workspace.slugPrefix')}
                  </span>
                  <input
                    id="ws-slug"
                    required
                    pattern="[a-z0-9][a-z0-9-]{1,59}"
                    autoComplete="off"
                    disabled={!editable}
                    value={slug}
                    aria-describedby="ws-slug-help"
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="stg-sec" aria-labelledby="ws-sec-sharing">
          <div className="stg-sec__head">
            <div>
              <h2 id="ws-sec-sharing">{t('workspace.sharing')}</h2>
              <p>{t('workspace.sharingHelp')}</p>
            </div>
          </div>
          <div data-gap-exempt="">
            <div className="stg-row">
              <div>
                <label className="stg-lab" htmlFor="ws-privacy">
                  {t('workspace.privacyUrl')}
                </label>
                <div id="ws-privacy-help" className="stg-help">
                  {t('workspace.privacyUrlHelp')}
                </div>
              </div>
              <div className="stg-ctl">
                <input
                  id="ws-privacy"
                  className="fd-input"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder={t('workspace.privacyPlaceholder')}
                  maxLength={500}
                  disabled={!editable}
                  value={privacyUrl}
                  aria-invalid={urlError?.id === 'ws-privacy' ? true : undefined}
                  aria-describedby={described('ws-privacy', 'ws-privacy-help')}
                  onChange={(e) => {
                    setPrivacyUrl(e.target.value);
                    setUrlError(null);
                  }}
                />
                {errFor('ws-privacy')}
              </div>
            </div>
            <div className="stg-row">
              <div>
                <label className="stg-lab" htmlFor="ws-help">
                  {t('help.contactLabel')}
                </label>
                <div id="ws-help-help" className="stg-help">
                  {t('help.contactHelp')}
                </div>
              </div>
              <div className="stg-ctl">
                <input
                  id="ws-help"
                  className="fd-input"
                  inputMode="email"
                  autoComplete="off"
                  placeholder={t('workspace.supportPlaceholder')}
                  maxLength={500}
                  disabled={!editable}
                  value={helpContact}
                  aria-invalid={urlError?.id === 'ws-help' ? true : undefined}
                  aria-describedby={described('ws-help', 'ws-help-help')}
                  onChange={(e) => {
                    setHelpContact(e.target.value);
                    setUrlError(null);
                  }}
                />
                {errFor('ws-help')}
              </div>
            </div>
            <div className="stg-row stg-row--inline">
              <div>
                <div className="stg-lab" id="ws-public-label">
                  {t('workspace.publicLinks')}
                </div>
                <div id="ws-public-help" className="stg-help">
                  {t('workspace.publicLinksHelp')}
                  {!editable && ` ${t('workspace.publicLinksAdmin')}`}
                </div>
              </div>
              <div className="stg-ctl">
                <label className="fd-switch">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-labelledby="ws-public-label"
                    aria-describedby="ws-public-help"
                    checked={ws.public_links_enabled}
                    disabled={!editable || busy}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      void run(async () => {
                        check(
                          await supabase
                            .from('workspaces')
                            .update({ public_links_enabled: enabled })
                            .eq('id', ws.id),
                        );
                        await reload();
                        toast(t('workspace.saved'));
                      });
                    }}
                  />
                  <span className="fd-switch__track" aria-hidden="true" />
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className="stg-sec" aria-labelledby="ws-sec-region">
          <div className="stg-sec__head">
            <div>
              <h2 id="ws-sec-region">{t('workspace.region')}</h2>
            </div>
          </div>
          <div data-gap-exempt="">
            <div className="stg-row">
              <div>
                <label className="stg-lab" htmlFor="ws-lang">
                  {t('workspace.defaultLang')} {soon}
                </label>
              </div>
              <div className="stg-ctl">
                <Select id="ws-lang" className="stg-short" disabled defaultValue="fr">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </Select>
              </div>
            </div>
            <div className="stg-row">
              <div>
                <label className="stg-lab" htmlFor="ws-tz">
                  {t('workspace.timezone')} {soon}
                </label>
              </div>
              <div className="stg-ctl">
                <Select id="ws-tz" className="stg-short" disabled defaultValue="Europe/Paris">
                  <option value="Europe/Paris">Europe/Paris</option>
                </Select>
              </div>
            </div>
          </div>
        </section>
      </form>

      {can('workspace.delete') && (
        <section className="stg-danger" aria-labelledby="ws-danger">
          <div>
            <h2 id="ws-danger">{t('workspace.danger')}</h2>
            <p>
              {counts?.demos
                ? t('workspace.deleteHintCounts', {
                    demos: t('workspace.ownDemos', { count: counts.demos, n: formatNumber(counts.demos) }),
                  })
                : t('workspace.deleteHint')}
            </p>
          </div>
          <Button className="stg-btn-danger" onClick={() => void remove()}>
            {t('workspace.delete')}
          </Button>
        </section>
      )}
    </SettingsShell>
  );
}
