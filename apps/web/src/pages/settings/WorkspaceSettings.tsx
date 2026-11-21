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
import { WsLogo } from '../../components/WorkspaceSwitcher';
import { SUPPORT_EMAIL_RE, SUPPORT_HTTPS_RE } from '../../lib/support';
import { Status } from '@flowdsiml/ui';

const HTTPS = /^https:\/\/\S+$/;

/**
 * Paramètres › Général (PRM-11), mise en page de la maquette parametres.html : une carte à sections
 * en deux colonnes (Identité, Confidentialité et partage, Langue et région), pied Annuler / Enregistrer,
 * puis la zone de danger. Le site web est rangé dans workspaces.settings (comme la politique de
 * confidentialité) ; le logo, la langue par défaut et le fuseau horaire sont annoncés Bientôt.
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
  const soon = <Status size="sm">{t('shell.soon')}</Status>;

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
      <p id={`${id}-error`} className="field-error">
        {urlError.text}
      </p>
    ) : null;
  const described = (id: string, help: string) => (urlError?.id === id ? `${id}-error ${help}` : help);

  return (
    <SettingsShell>
      {dialog}
      <form className="card st-gen" onSubmit={save}>
        {error && (
          <div className="alert alert-danger st-gen-alert" role="alert">
            {error}
          </div>
        )}
        <div className="form-sec">
          <div className="intro">
            <h2 className="t-h3">{t('workspace.identity')}</h2>
            <p className="t-caption muted">{t('workspace.identityHelp')}</p>
          </div>
          <div>
            <div className="logo-up">
              <WsLogo name={name || ws.name} />
              <div className="col">
                <span className="row st-logo-btn">
                  <button type="button" className="btn btn-secondary btn-sm" aria-disabled="true">
                    {t('workspace.changeLogo')}
                  </button>
                  {soon}
                </span>
                <span className="help">{t('workspace.logoHelp')}</span>
              </div>
            </div>
            <div className="field st-gen-first">
              <label htmlFor="ws-name">{t('workspace.wsName')}</label>
              <input
                id="ws-name"
                className="input"
                required
                maxLength={80}
                disabled={!editable}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ws-site">{t('workspace.website')}</label>
              <input
                id="ws-site"
                className="input"
                type="url"
                inputMode="url"
                placeholder="https://…"
                maxLength={500}
                disabled={!editable}
                value={website}
                aria-invalid={urlError?.id === 'ws-site' ? true : undefined}
                aria-describedby={urlError?.id === 'ws-site' ? 'ws-site-error' : undefined}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  setUrlError(null);
                }}
              />
              {errFor('ws-site')}
            </div>
            <div className="field">
              <label htmlFor="ws-slug">{t('workspace.slug')}</label>
              <input
                id="ws-slug"
                className="input"
                required
                pattern="[a-z0-9][a-z0-9-]{1,59}"
                disabled={!editable}
                value={slug}
                aria-describedby="ws-slug-help"
                onChange={(e) => setSlug(e.target.value)}
              />
              <span id="ws-slug-help" className="help">
                {t('workspace.slugHelp')}
              </span>
            </div>
          </div>
        </div>

        <div className="form-sec">
          <div className="intro">
            <h2 className="t-h3">{t('workspace.sharing')}</h2>
            <p className="t-caption muted">{t('workspace.sharingHelp')}</p>
          </div>
          <div>
            <div className="field">
              <label htmlFor="ws-privacy">{t('workspace.privacyUrl')}</label>
              <input
                id="ws-privacy"
                className="input"
                type="url"
                inputMode="url"
                placeholder="https://…"
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
              <span id="ws-privacy-help" className="help">
                {t('workspace.privacyUrlHelp')}
              </span>
            </div>
            <div className="field">
              <label htmlFor="ws-help">{t('help.contactLabel')}</label>
              <input
                id="ws-help"
                className="input"
                inputMode="email"
                placeholder="support@exemple.example"
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
              <span id="ws-help-help" className="help">
                {t('help.contactHelp')}
              </span>
            </div>
            <div className="setting">
              <div>
                <b id="ws-public-label">{t('workspace.publicLinks')}</b>
                <p id="ws-public-help" className="t-caption muted">
                  {t('workspace.publicLinksHelp')}
                  {!editable && ` ${t('workspace.publicLinksAdmin')}`}
                </p>
              </div>
              <span className="switch">
                <input
                  type="checkbox"
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
                <span />
              </span>
            </div>
          </div>
        </div>

        <div className="form-sec">
          <div className="intro">
            <h2 className="t-h3">{t('workspace.region')}</h2>
          </div>
          <div>
            <div className="field">
              <label htmlFor="ws-lang">
                {t('workspace.defaultLang')} {soon}
              </label>
              <select id="ws-lang" className="select" disabled defaultValue="fr">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ws-tz">
                {t('workspace.timezone')} {soon}
              </label>
              <select id="ws-tz" className="select" disabled defaultValue="Europe/Paris">
                <option value="Europe/Paris">Europe/Paris</option>
              </select>
            </div>
          </div>
        </div>

        {editable && (
          <div className="form-sec st-gen-foot">
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {t('common.save')}
            </button>
          </div>
        )}

        {can('workspace.delete') && (
          <div className="form-sec st-danger">
            <div className="intro">
              <h2 className="t-h3">{t('workspace.danger')}</h2>
              <p className="t-caption muted">{t('workspace.dangerHelp')}</p>
            </div>
            <div className="row between wrap st-danger-row">
              <div>
                <b>{t('workspace.delete')}</b>
                <p className="t-caption muted">
                  {counts?.demos
                    ? t('workspace.deleteHintCounts', {
                        demos: t('workspace.nDemos', { count: counts.demos, n: formatNumber(counts.demos) }),
                      })
                    : t('workspace.deleteHint')}
                </p>
              </div>
              <button type="button" className="btn btn-secondary st-danger-btn" onClick={() => void remove()}>
                {t('workspace.delete')}
              </button>
            </div>
          </div>
        )}
      </form>
    </SettingsShell>
  );
}
