import { useEffect, useState, type ReactNode } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Tables } from '@flowdsiml/supabase-types';
import { ChartColumn, ChevronLeft, EyeOff, Mail, Pencil, Play, Rocket, Share2, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loading } from '../../components/guards';
import { Menu } from '../../components/Menu';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import '../../styles/maquette.css';
import '../../styles/maquette-ajouts.css';
import '../../styles/maquette-peau.css';
import { ShareDialog, useShareWindow } from '../share/ShareDialog';
import { useUnpublish } from '../share/useUnpublish';
import { usePublicPageList } from '../share/usePublicPageList';
import './demo-views.css';

export type DemoView = 'analytics' | 'leads' | 'visitors';
export type DemoViewContext = { demo: Tables<'demos'>; view: DemoView };
/** Démo de la vue courante (Analytics, Leads, Visiteurs). */
export const useDemoView = () => useOutletContext<DemoViewContext>();
/** Origine gardée d'onglet en onglet : « ← Analytics » quand on vient de l'Analytics de l'espace. */
type Origin = { from?: 'analytics' } | null;

/**
 * Retours client du 24/11 (2e série) §9 : vues d'une démo hors de l'éditeur (Analytics, Leads, Visiteurs).
 * Même barre que l'éditeur : retour, nom et état de la démo, onglets Édition · Aperçu · Analytics · Leads ·
 * Visiteurs, puis « Partager » et « Publier ». La barre latérale de l'application n'apparaît pas ; changer
 * d'onglet ne quitte pas la démo.
 */
export function DemoViewShell() {
  const { t, i18n } = useTranslation();
  const { demoId = '' } = useParams();
  const loc = useLocation();
  const navigate = useNavigate();
  const share = useShareWindow();
  const { current: ws } = useWorkspace();
  const publicPage = usePublicPageList(ws?.id);
  const { can } = useWorkspace();
  const [demo, setDemo] = useState<Tables<'demos'> | null | undefined>(undefined);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const view = (loc.pathname.split('/').pop() ?? 'analytics') as DemoView;
  const origin = (loc.state as Origin) ?? null;
  const fromAnalytics = origin?.from === 'analytics';

  useEffect(() => {
    let alive = true;
    void (async () => {
      const d = await supabase.from('demos').select('*').eq('id', demoId).maybeSingle();
      if (!alive) return;
      setDemo(d.data ?? null);
      if (d.data?.current_version_id) {
        const v = await supabase
          .from('demo_versions')
          .select('published_at')
          .eq('id', d.data.current_version_id)
          .maybeSingle();
        if (alive) setPublishedAt(v.data?.published_at ?? null);
      } else setPublishedAt(null);
    })();
    return () => {
      alive = false;
    };
  }, [demoId, rev]);
  // §1 : « Retirer la publication… » du menu ⋯ (l'état de publication, pas un accès)
  const [unpublishDialog, unpublish] = useUnpublish(demo, () => setRev((n) => n + 1));

  if (demo === undefined) return <Loading />;
  if (demo === null) return <Navigate to="/" replace />;
  if (view === 'leads' && !can('leads.view')) return <Navigate to={`/demos/${demoId}/analytics`} replace />;

  const published = demo.status === 'published';
  const state = published
    ? publishedAt
      ? t('demoViews.publishedOn', {
          date: new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(
            new Date(publishedAt),
          ),
        })
      : t('status.published')
    : t('demoViews.notPublished');
  const tabs: Array<{ id: 'edit' | 'preview' | DemoView; to: string; icon: ReactNode; label: string }> = [
    { id: 'edit', to: `/demos/${demoId}/edit`, icon: <Pencil />, label: t('editor.modeEdit') },
    { id: 'preview', to: `/demos/${demoId}/preview`, icon: <Play />, label: t('editor.preview') },
    { id: 'analytics', to: `/demos/${demoId}/analytics`, icon: <ChartColumn />, label: t('nav.analytics') },
    ...(can('leads.view')
      ? [{ id: 'leads' as const, to: `/demos/${demoId}/leads`, icon: <Mail />, label: t('kpi.leads') }]
      : []),
    { id: 'visitors', to: `/demos/${demoId}/visitors`, icon: <Users />, label: t('demoViews.visitors') },
  ];
  const current = tabs.find((x) => x.id === view) ?? tabs[2]!;

  return (
    <div className="mk dv">
      <header className="dv-bar">
        <div className="dv-bar__l">
          <Link
            className="dv-back"
            to={fromAnalytics ? '/analytics' : '/'}
            /* Le libellé est masqué sous 900 px : le lien garde son nom */
            aria-label={t('demoViews.backTo', {
              name: fromAnalytics ? t('nav.analytics') : t('demos.title'),
            })}
          >
            <ChevronLeft aria-hidden="true" />
            <span>{fromAnalytics ? t('nav.analytics') : t('demos.title')}</span>
          </Link>
          <span className="ed-vsep" aria-hidden="true" />
          <div className="dv-tt" data-gap-exempt="">
            <b title={demo.title}>{demo.title}</b>
            <span className={`dv-state${published ? ' is-pub' : ''}`}>{state}</span>
          </div>
        </div>
        <nav className="dv-tabs" aria-label={t('demoViews.tabs')}>
          {tabs.map((x) => (
            <NavLink key={x.id} to={x.to} state={origin} end>
              {x.icon}
              {x.label}
            </NavLink>
          ))}
        </nav>
        {/* À 390 px : les onglets deviennent un bouton-menu (aucun défilement horizontal) */}
        <div className="dv-tabs-menu">
          <Menu
            label={t('demoViews.tabs')}
            trigger={{ text: current.label, chevron: true }}
            items={tabs.map((x) => ({
              label: x.label,
              icon: x.icon,
              current: x.id === view,
              onSelect: () => navigate(x.to, { state: origin }),
            }))}
          />
        </div>
        <div className="dv-bar__r">
          {(publicPage.itemFor(demo).length > 0 || (can('demo.publish') && published)) && (
            <Menu
              label={t('editor.more')}
              items={[
                ...publicPage.itemFor(demo),
                ...(can('demo.publish') && published
                  ? [
                      ...(publicPage.itemFor(demo).length ? ['separator' as const] : []),
                      {
                        label: t('share.unpublishMenu'),
                        icon: <EyeOff />,
                        danger: true,
                        onSelect: () => void unpublish(),
                      },
                    ]
                  : []),
              ]}
            />
          )}
          <button
            type="button"
            className="fd-btn dv-share"
            data-share-open=""
            aria-label={t('editor.share')}
            title={t('editor.share')}
            onClick={share.open}
          >
            <Share2 size={16} aria-hidden="true" />
            <span>{t('editor.share')}</span>
          </button>
          {can('demo.publish') && (
            <Link className="fd-btn fd-btn--primary" to={`/demos/${demoId}/edit`} state={{ publish: true }}>
              <Rocket size={16} aria-hidden="true" />
              {t('publish.publish')}
            </Link>
          )}
        </div>
      </header>
      {unpublishDialog}
      {share.view && (
        <ShareDialog
          demoId={demoId}
          view={share.view}
          onView={share.setView}
          onClose={share.close}
          justPublished={share.justPublished}
        />
      )}
      <main className="dv-main" id="main">
        <div className="dv-wrap">
          <h1 className="sr-only">{t(`demoViews.h1.${view}`, { title: demo.title })}</h1>
          <Outlet context={{ demo, view } satisfies DemoViewContext} />
        </div>
      </main>
    </div>
  );
}
