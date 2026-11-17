import { BarChart3, Check, Copy, ExternalLink, GlobeLock, Link2, Pencil, Power } from 'lucide-react';
import { useConfirm } from '../../components/ConfirmDialog';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button, Card, Field, Select } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { embedSnippet, publicDemoUrl, shareLinkUrl } from '../../lib/embed';
import { unpublishDemo } from '../../lib/publish';
import { formatDate } from '../../lib/format';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { asSettings } from '../editor/types';
import { SharePreview } from './SharePreview';
import { usePlan } from '../../lib/plan';
import { PlanFormsWarning } from '../../components/PlanFormsWarning';

function CopyField({
  id,
  label,
  value,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Field label={label} htmlFor={id}>
      <div className="row" style={{ alignItems: 'stretch' }}>
        {multiline ? (
          <textarea
            id={id}
            className="fd-textarea"
            readOnly
            rows={5}
            value={value}
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
          />
        ) : (
          <input id={id} className="fd-input" readOnly value={value} style={{ flex: 1 }} />
        )}
        <Button
          icon={<Copy />}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? t('common.copied') : t('common.copy')}
        </Button>
      </div>
    </Field>
  );
}

export function SharePage() {
  const { t } = useTranslation();
  const [dialog, ask] = useConfirm();
  const { demoId = '' } = useParams();
  const [params] = useSearchParams();
  const { can } = useWorkspace();
  const [demo, setDemo] = useState<Tables<'demos'> | null>(null);
  const [links, setLinks] = useState<Tables<'share_links'>[]>([]);
  const [versions, setVersions] = useState<Pick<Tables<'demo_versions'>, 'id' | 'number' | 'published_at'>[]>(
    [],
  );
  const [variables, setVariables] = useState<Tables<'variables'>[]>([]);
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [expires, setExpires] = useState('');
  const [origins, setOrigins] = useState('');
  const { error, success, run } = useAction();
  const editable = can('demo.edit');
  const plan = usePlan();
  const [gatedSteps, setGatedSteps] = useState(0);

  const load = useCallback(async () => {
    const d = await supabase.from('demos').select('*').eq('id', demoId).maybeSingle();
    setDemo(d.data);
    if (!d.data) return;
    setOrigins((asSettings(d.data.settings).allowedEmbedOrigins ?? []).join('\n'));
    const [l, v, vars] = await Promise.all([
      supabase
        .from('share_links')
        .select('*')
        .eq('demo_id', demoId)
        .order('created_at', { ascending: false }),
      supabase
        .from('demo_versions')
        .select('id, number, published_at')
        .eq('demo_id', demoId)
        .order('number', { ascending: false })
        .limit(10),
      supabase.from('variables').select('*').eq('workspace_id', d.data.workspace_id).order('key'),
    ]);
    setLinks(l.data ?? []);
    setVersions(v.data ?? []);
    setVariables(vars.data ?? []);
    const gated = await supabase
      .from('steps')
      .select('id', { count: 'exact', head: true })
      .eq('demo_id', demoId)
      .not('gate_form_id', 'is', null);
    setGatedSteps(gated.count ?? 0);
  }, [demoId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!demo) return <Loading />;
  const published = demo.status === 'published';
  const url = publicDemoUrl(demo.id);

  async function createLink(e: FormEvent) {
    e.preventDefault();
    const vars = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
    await run(async () => {
      const created = check(
        await supabase
          .from('share_links')
          .insert({
            demo_id: demoId,
            workspace_id: demo!.workspace_id,
            name,
            variables: vars,
            expires_at: expires ? new Date(Date.now() + Number(expires) * 86400_000).toISOString() : null,
          })
          .select('token')
          .single(),
      );
      // P10 : le lien créé est copié automatiquement
      await navigator.clipboard?.writeText(shareLinkUrl(created.token)).catch(() => undefined);
      setName('');
      setValues({});
      setExpires('');
      await load();
    }, t('share.linkCreatedCopied'));
  }

  return (
    <div className="stack" style={{ maxWidth: 1180 }}>
      {dialog}
      <div className="page-head">
        <h1>
          {t('share.title')} — {demo.title}
        </h1>
        <div className="row">
          <Link className="fd-btn" to={`/demos/${demoId}/edit`}>
            <Pencil size={16} aria-hidden="true" />
            {t('share.backToEditor')}
          </Link>
          <Link className="fd-btn" to={`/demos/${demoId}/analytics`}>
            <BarChart3 size={16} aria-hidden="true" />
            {t('nav.analytics')}
          </Link>
        </div>
      </div>
      {params.get('published') && <Alert kind="success">{t('share.justPublished')}</Alert>}
      {published && !plan.leadForms && gatedSteps > 0 && <PlanFormsWarning variant="share" />}
      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <div className="share-layout">
        <div className="stack">
          {!published ? (
            <Card>
              <p>{t('share.notPublished')}</p>
              <Link className="fd-btn fd-btn--primary" to={`/demos/${demoId}/edit`}>
                <Pencil size={16} aria-hidden="true" />
                {t('share.goPublish')}
              </Link>
            </Card>
          ) : (
            <>
              <Card>
                <h2 style={{ marginTop: 0 }}>{t('share.publicLink')}</h2>
                <CopyField id="pub-url" label={t('share.publicLinkHint')} value={url} />
                <div className="url-params">
                  <p className="fd-muted">{t('share.urlVariables')}</p>
                  <code className="code-block">
                    <span className="code-block__base">{url}</span>
                    <mark className="code-block__var">
                      ?{variables[0]?.key ?? 'company'}=
                      {encodeURIComponent(variables[0]?.default_value || 'Acme')}
                    </mark>
                  </code>
                </div>
                <div className="row">
                  <a className="fd-btn" href={url} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} aria-hidden="true" />
                    {t('share.open')}
                  </a>
                  {editable && (
                    <Button
                      icon={<GlobeLock />}
                      variant="ghost"
                      className="btn-danger-ghost"
                      onClick={() =>
                        void ask({
                          title: t('share.unpublish'),
                          body: t('share.confirmUnpublish'),
                          confirmLabel: t('share.unpublish'),
                          danger: true,
                        }).then(
                          (yes) =>
                            yes &&
                            void run(async () => {
                              await unpublishDemo(demoId);
                              await load();
                            }, t('share.unpublished')),
                        )
                      }
                    >
                      {t('share.unpublish')}
                    </Button>
                  )}
                </div>
              </Card>
              <Card>
                <h2 style={{ marginTop: 0 }}>{t('share.embed')}</h2>
                <CopyField
                  id="embed"
                  label={t('share.embedHint')}
                  value={embedSnippet(url, demo.title)}
                  multiline
                />
                <Field label={t('share.allowedOrigins')} htmlFor="origins">
                  <textarea
                    id="origins"
                    className="fd-textarea"
                    rows={3}
                    disabled={!editable}
                    placeholder={'www.acme.example\n*.acme.example'}
                    value={origins}
                    onChange={(e) => setOrigins(e.target.value)}
                  />
                </Field>
                <p className="fd-muted" style={{ fontSize: 12 }}>
                  {t('share.allowedOriginsHint')}
                </p>
                {editable && (
                  <Button
                    icon={<Check />}
                    onClick={() =>
                      void run(async () => {
                        const list = origins
                          .split(/\s+/)
                          .map((o) => o.trim())
                          .filter(Boolean)
                          .slice(0, 20);
                        check(
                          await supabase
                            .from('demos')
                            .update({ settings: { ...asSettings(demo.settings), allowedEmbedOrigins: list } })
                            .eq('id', demoId),
                        );
                        await load();
                      }, t('share.originsSaved'))
                    }
                  >
                    {t('common.save')}
                  </Button>
                )}
              </Card>
            </>
          )}

          <Card>
            <h2 style={{ marginTop: 0 }}>{t('share.personalLinks')}</h2>
            <p className="fd-muted">{t('share.personalLinksHint')}</p>
            {editable && (
              <form onSubmit={createLink} className="stack" style={{ gap: 0 }}>
                <Field label={t('share.linkName')} htmlFor="ln">
                  <input
                    id="ln"
                    className="fd-input"
                    required
                    maxLength={120}
                    placeholder={t('share.linkNamePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                {variables.map((v) => (
                  <Field key={v.id} label={v.label || v.key} htmlFor={`lv-${v.key}`}>
                    <input
                      id={`lv-${v.key}`}
                      className="fd-input"
                      maxLength={200}
                      placeholder={v.default_value}
                      value={values[v.key] ?? ''}
                      onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
                    />
                  </Field>
                ))}
                <Field label={t('share.expires')} htmlFor="lx">
                  <Select id="lx" value={expires} onChange={(e) => setExpires(e.target.value)}>
                    <option value="">{t('share.expiresNever')}</option>
                    {[7, 30, 90].map((d) => (
                      <option key={d} value={String(d)}>
                        {t('share.expiresIn', {
                          count: d,
                          date: formatDate(new Date(Date.now() + d * 86400_000).toISOString()),
                        })}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div>
                  <Button icon={<Link2 />} type="submit" variant="primary">
                    {t('share.createLink')}
                  </Button>
                </div>
              </form>
            )}
            {links.length > 0 && (
              <table className="fd-table" style={{ marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>{t('share.linkName')}</th>
                    <th>{t('editor.variables')}</th>
                    <th>{t('share.expires')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id} style={{ opacity: l.is_active ? 1 : 0.5 }}>
                      <td>{l.name || '—'}</td>
                      <td style={{ fontSize: 12 }}>
                        {Object.entries((l.variables as Record<string, string>) ?? {})
                          .map(([k, v]) => `${k}=${v}`)
                          .join(', ') || '—'}
                      </td>
                      <td>{l.expires_at ? formatDate(l.expires_at) : '—'}</td>
                      <td>
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                          <Button
                            icon={<Copy />}
                            size="sm"
                            onClick={() => void navigator.clipboard.writeText(shareLinkUrl(l.token))}
                          >
                            {t('members.copyLink')}
                          </Button>
                          {editable && (
                            <>
                              <Button
                                icon={<Power />}
                                size="sm"
                                onClick={() =>
                                  void run(async () => {
                                    check(
                                      await supabase
                                        .from('share_links')
                                        .update({ is_active: !l.is_active })
                                        .eq('id', l.id),
                                    );
                                    await load();
                                  })
                                }
                              >
                                {l.is_active ? t('share.disable') : t('share.enable')}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  void run(async () => {
                                    check(await supabase.from('share_links').delete().eq('id', l.id));
                                    await load();
                                  })
                                }
                              >
                                {t('common.delete')}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {versions.length > 0 && (
            <Card>
              <h2 style={{ marginTop: 0 }}>{t('share.versions')}</h2>
              <ul className="version-list">
                {versions.map((v) => (
                  <li key={v.id}>
                    <span>
                      v{v.number} · {formatDate(v.published_at)}
                    </span>
                    {v.id === demo.current_version_id && (
                      <span className="fd-badge status-published">{t('share.live')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <aside className="share-aside">
          <SharePreview demo={demo} playerUrl={url} published={published} />
        </aside>
      </div>
    </div>
  );
}
