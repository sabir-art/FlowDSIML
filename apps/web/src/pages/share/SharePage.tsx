import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Tables } from '@flowdsiml/supabase-types';
import { Alert, Button, Card, Field } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { check, useAction } from '../../lib/useAction';
import { embedSnippet, publicDemoUrl, shareLinkUrl } from '../../lib/embed';
import { unpublishDemo } from '../../lib/publish';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { Loading } from '../../components/guards';
import { asSettings } from '../editor/types';

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
      check(
        await supabase.from('share_links').insert({
          demo_id: demoId,
          workspace_id: demo!.workspace_id,
          name,
          variables: vars,
          expires_at: expires ? new Date(expires).toISOString() : null,
        }),
      );
      setName('');
      setValues({});
      setExpires('');
      await load();
    }, t('share.linkCreated'));
  }

  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <h1>
          {t('share.title')} — {demo.title}
        </h1>
        <div className="row">
          <Link className="fd-btn" to={`/demos/${demoId}/edit`}>
            {t('share.backToEditor')}
          </Link>
          <Link className="fd-btn" to={`/demos/${demoId}/analytics`}>
            {t('nav.analytics')}
          </Link>
        </div>
      </div>
      {params.get('published') && <Alert kind="success">{t('share.justPublished')}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      {!published ? (
        <Card>
          <p>{t('share.notPublished')}</p>
          <Link className="fd-btn fd-btn--primary" to={`/demos/${demoId}/edit`}>
            {t('share.goPublish')}
          </Link>
        </Card>
      ) : (
        <>
          <Card>
            <h2 style={{ marginTop: 0 }}>{t('share.publicLink')}</h2>
            <CopyField id="pub-url" label={t('share.publicLinkHint')} value={url} />
            <p className="fd-muted" style={{ fontSize: 12 }}>
              {t('share.urlVariables')} <code>{`${url}?company=Acme`}</code>
            </p>
            <div className="row">
              <a className="fd-btn" href={url} target="_blank" rel="noreferrer">
                {t('share.open')}
              </a>
              {editable && (
                <Button
                  variant="danger"
                  onClick={() =>
                    confirm(t('share.confirmUnpublish')) &&
                    void run(async () => {
                      await unpublishDemo(demoId);
                      await load();
                    }, t('share.unpublished'))
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
                placeholder={'www.acme.com\n*.acme.com'}
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
              />
            </Field>
            <p className="fd-muted" style={{ fontSize: 12 }}>
              {t('share.allowedOriginsHint')}
            </p>
            {editable && (
              <Button
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
              <Field key={v.id} label={`{{${v.key}}} — ${v.label}`} htmlFor={`lv-${v.key}`}>
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
              <input
                id="lx"
                className="fd-input"
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </Field>
            <div>
              <Button type="submit" variant="primary">
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
                  <td>{l.expires_at ? new Date(l.expires_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Button
                        size="sm"
                        onClick={() => void navigator.clipboard.writeText(shareLinkUrl(l.token))}
                      >
                        {t('members.copyLink')}
                      </Button>
                      {editable && (
                        <>
                          <Button
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
          <ul>
            {versions.map((v) => (
              <li key={v.id}>
                v{v.number} — {new Date(v.published_at).toLocaleString()}{' '}
                {v.id === demo.current_version_id && <span className="fd-badge">{t('share.live')}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
