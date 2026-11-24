/**
 * Paramètres › Marque › Page publique (retours client du 24/11 §6.1, maquettes
 * lot1-parametres/page-publique-*). Le réglage du catalogue public de l'espace, servi par le lecteur à
 * /c/{adresse} : ce n'est pas un deuxième catalogue.
 *  - Un espace a une seule adresse publique. Si elle affiche un centre de formation, activer la page
 *    publique prend sa place après confirmation ; les réglages du centre ne sont pas modifiés.
 *  - « Enregistrer » enregistre et met en ligne d'un coup quand l'interrupteur est activé.
 *  - L'interrupteur dit pourquoi il refuse : liens publics coupés, ou aucune démo en accès ouvert.
 */
import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  Globe,
  GripVertical,
  Images,
  Info,
} from 'lucide-react';
import { Button } from '@flowdsiml/ui';
import type { ContentType } from '@flowdsiml/core';
import { SettingsShell } from '../SettingsShell';
import { supabase } from '../../../lib/supabase';
import { PLAYER_URL } from '../../../lib/env';
import { loadDemoTypes } from '../../../lib/demoTypes';
import { useWorkspace } from '../../../workspace/WorkspaceProvider';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { MediaLibrary, mediaUrl } from '../../../components/media/MediaLibrary';
import { errorMessage } from '../../../lib/errors';
import { centerUrl, defaultSlug } from '../../center/centerDraft';
import './public-page.css';

const SLUG = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;
const TAGLINE_MAX = 160;
/** Lien de contact : vide, adresse e-mail ou adresse https (même règle que la base). */
export const contactValid = (v: string) =>
  v === '' || /^https:\/\/[^\s<>"]+$/.test(v) || /^[^@\s<>"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(v);

interface Form {
  enabled: boolean;
  slug: string;
  title: string;
  tagline: string;
  /** Fichier de la médiathèque, ou null : logo de l'espace. */
  logo: string | null;
  mode: 'all' | 'chosen';
  /** Démos choisies, dans l'ordre d'affichage. */
  chosen: string[];
  contact: string;
  madeWith: boolean;
}
interface Info {
  publicLinks: boolean;
  demos: Array<{ id: string; title: string; kind: string }>;
  centre: { title: string } | null;
}
type Stored = {
  title?: string;
  tagline?: string;
  logo?: string | null;
  demos?: 'all' | string[];
  contact?: string;
  madeWith?: boolean;
};

const same = (a: Form, b: Form) => JSON.stringify(a) === JSON.stringify(b);
/** Adresse sans le protocole, comme elle se lit et se dicte. */
const shown = (url: string) => url.replace(/^https?:\/\//, '');

export function PublicPage() {
  const { t } = useTranslation();
  const id = useId();
  const { current, can } = useWorkspace();
  const toast = useToast();
  const [dialog, ask] = useConfirm();
  const ws = current?.id;
  const allowed = can('workspace.settings');
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [types, setTypes] = useState<Record<string, ContentType>>({});
  const [wsLogo, setWsLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slugTaken, setSlugTaken] = useState(false);
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const drag = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!ws || !current) return;
    const [row, inf, space] = await Promise.all([
      supabase
        .from('training_centers')
        .select('slug, draft, public_page, public_page_enabled')
        .eq('workspace_id', ws)
        .maybeSingle(),
      supabase.rpc('public_page_info', { p_ws: ws }),
      supabase.from('workspaces').select('logo_path').eq('id', ws).maybeSingle(),
    ]);
    const data = (inf.data ?? { publicLinks: false, demos: [], centre: null }) as unknown as Info;
    const page = (row.data?.public_page ?? {}) as Stored;
    // Premier réglage : on reprend ce que disait l'ancien catalogue de Parcours de formation, s'il existe
    const old = (row.data?.draft ?? {}) as { heroTitle?: string; heroSubtitle?: string; help?: string };
    const next: Form = {
      enabled: !!row.data?.public_page_enabled,
      slug: row.data?.slug ?? defaultSlug(current.name),
      title: page.title ?? old.heroTitle ?? '',
      tagline: page.tagline ?? (old.heroSubtitle ?? '').slice(0, TAGLINE_MAX),
      logo: page.logo ?? null,
      mode: Array.isArray(page.demos) ? 'chosen' : 'all',
      chosen: Array.isArray(page.demos) ? page.demos : [],
      contact: page.contact ?? old.help ?? '',
      madeWith: page.madeWith !== false,
    };
    setInfo(data);
    setForm(next);
    setSaved(next);
    setSlugTaken(false);
    const path = space.data?.logo_path;
    setWsLogo(path ? supabase.storage.from('branding').getPublicUrl(path).data.publicUrl : null);
    setTypes(await loadDemoTypes(ws, data.demos));
  }, [ws, current]);
  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed)
    return (
      <SettingsShell legacy={false}>
        <div className="stg-empty" role="status">
          <span className="stg-empty__tile" aria-hidden="true">
            <Globe size={20} />
          </span>
          <h2>{t('publicPage.noAccess')}</h2>
          <div className="stg-empty__acts">
            <Link className="fd-btn" to="/settings/workspace">
              {t('integrations.backGeneral')}
            </Link>
          </div>
        </div>
      </SettingsShell>
    );
  if (!form || !saved || !info || !ws) return <SettingsShell legacy={false}>{null}</SettingsShell>;

  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const url = centerUrl(PLAYER_URL, form.slug);
  const prefix = shown(centerUrl(PLAYER_URL, ''));
  const slugOk = SLUG.test(form.slug);
  const contactOk = contactValid(form.contact.trim());
  // Pourquoi la page ne peut pas être activée (l'interrupteur reste visible, désactivé)
  const refusal = !info.publicLinks ? 'links' : info.demos.length === 0 ? 'demos' : null;
  const enabled = form.enabled && !refusal;
  // Liste : les démos choisies dans leur ordre, puis les autres
  const known = new Set(info.demos.map((d) => d.id));
  const picked = form.chosen.filter((x) => known.has(x));
  const ordered = [
    ...picked.map((x) => info.demos.find((d) => d.id === x)!),
    ...info.demos.filter((d) => !picked.includes(d.id)),
  ];
  const noneChosen = form.mode === 'chosen' && picked.length === 0;
  const dirty = !same(form, saved);
  const canSave = dirty && slugOk && contactOk && !(enabled && noneChosen) && !busy;

  const move = (demoId: string, to: number) => {
    const list = picked.filter((x) => x !== demoId);
    list.splice(Math.max(0, Math.min(to, list.length)), 0, demoId);
    set({ chosen: list });
  };
  const toggle = (demoId: string, on: boolean) =>
    set({ chosen: on ? [...picked, demoId] : picked.filter((x) => x !== demoId) });
  const onDrop = (e: DragEvent, target: string) => {
    e.preventDefault();
    const from = drag.current;
    drag.current = null;
    if (from && from !== target && picked.includes(target)) move(from, picked.indexOf(target));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  const save = async () => {
    if (!canSave) return;
    // Un centre de formation est en ligne à cette adresse : la page publique prend sa place, sur confirmation
    const replaces = enabled && !saved.enabled && !!info.centre;
    if (replaces) {
      const yes = await ask({
        title: t('publicPage.replaceTitle'),
        body: t('publicPage.replaceBody', { address: shown(url), title: info.centre!.title }),
        confirmLabel: t('publicPage.replaceConfirm'),
        alert: true,
      });
      if (!yes) return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('save_public_page', {
      p_ws: ws,
      p_slug: form.slug,
      p_page: {
        title: form.title.trim(),
        tagline: form.tagline.trim(),
        logo: form.logo,
        demos: form.mode === 'chosen' ? picked : 'all',
        contact: form.contact.trim(),
        madeWith: form.madeWith,
      },
      p_enabled: enabled,
      p_replace: replaces,
    });
    setBusy(false);
    if (error) {
      if (error.message === 'SLUG_TAKEN') return setSlugTaken(true);
      const key = { PUBLIC_DISABLED: 'refusal.links', NO_VISIBLE_DEMO: 'refusal.demos' }[error.message];
      toast(key ? t(`publicPage.${key}`) : errorMessage(t, error), undefined, { tone: 'warning' });
      return void load();
    }
    toast(
      t(enabled ? 'publicPage.savedOn' : 'publicPage.savedOff'),
      enabled
        ? { label: t('publicPage.view'), onClick: () => window.open(url, '_blank', 'noopener') }
        : undefined,
    );
    void load();
  };

  const logoSrc = form.logo ? mediaUrl(form.logo) : wsLogo;
  const count = picked.length;

  return (
    <SettingsShell
      legacy={false}
      actions={
        <>
          {saved.enabled ? (
            <a
              className="fd-btn"
              href={centerUrl(PLAYER_URL, saved.slug)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} aria-hidden="true" />
              {t('publicPage.view')}
              <span className="sr-only">{t('publicPage.newTab')}</span>
            </a>
          ) : (
            <Button icon={<ExternalLink size={16} />} disabled title={t('publicPage.viewOff')}>
              {t('publicPage.view')}
            </Button>
          )}
          <Button onClick={() => (setForm(saved), setSlugTaken(false))} disabled={busy || !dirty}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!canSave}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {info.centre && !saved.enabled && (
        <p className="stg-banner pp-banner" role="status">
          <Info size={16} aria-hidden="true" />
          <span>
            <b>{t('publicPage.centreNow', { title: info.centre.title })}</b>{' '}
            {t('publicPage.centreNext', { address: shown(url) })}
          </span>
        </p>
      )}

      <section className="stg-sec" aria-labelledby={`${id}-t`}>
        <div className="stg-sec__head">
          <div>
            <h2 id={`${id}-t`}>{t('publicPage.title')}</h2>
            <p>{t('publicPage.sub')}</p>
          </div>
        </div>
        <div className="stg-row stg-row--inline">
          <div className="stg-text" data-gap-exempt="">
            <div className="stg-lab" id={`${id}-on`}>
              {t('publicPage.title')}
            </div>
            {refusal ? (
              <div className="stg-error pp-refusal" id={`${id}-onh`}>
                <CircleAlert size={14} aria-hidden="true" />
                <span>
                  {t(`publicPage.refusal.${refusal}`)}{' '}
                  <Link to={refusal === 'links' ? '/settings/security' : '/'}>
                    {t(`publicPage.refusalFix.${refusal}`)}
                  </Link>
                </span>
              </div>
            ) : (
              <div className="stg-help" id={`${id}-onh`}>
                {t('publicPage.enabledHelp')}
              </div>
            )}
          </div>
          <div className="stg-ctl">
            <label className="fd-switch">
              <input
                type="checkbox"
                role="switch"
                aria-labelledby={`${id}-on`}
                aria-describedby={`${id}-onh`}
                checked={enabled}
                disabled={!!refusal}
                onChange={(e) => set({ enabled: e.target.checked })}
              />
              <span className="fd-switch__track" aria-hidden="true" />
            </label>
          </div>
        </div>
        <div className="stg-row">
          <div className="stg-text" data-gap-exempt="">
            <label className="stg-lab" htmlFor={`${id}-slug`}>
              {t('publicPage.address')}
            </label>
            <div className={slugOk && !slugTaken ? 'stg-help' : 'stg-error'} id={`${id}-slugh`}>
              {(!slugOk || slugTaken) && <CircleAlert size={14} aria-hidden="true" />}
              {t(
                slugTaken
                  ? 'publicPage.addressTaken'
                  : slugOk
                    ? 'publicPage.addressHelp'
                    : 'publicPage.addressError',
              )}
            </div>
          </div>
          <div className="stg-ctl">
            <div className="fd-copy pp-addr">
              {/* §18.6 : le préfixe et la fin de l'adresse se lisent d'un seul tenant, sans écart */}
              <div className="fd-copy__field pp-addr__field" data-align-zone="" data-gap-exempt="">
                <span className="pp-addr__pre" aria-hidden="true">
                  {prefix}
                </span>
                <input
                  id={`${id}-slug`}
                  className="pp-addr__input"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={48}
                  value={form.slug}
                  aria-invalid={!slugOk || slugTaken || undefined}
                  aria-describedby={`${id}-slugh`}
                  onChange={(e) => {
                    set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') });
                    setSlugTaken(false);
                  }}
                />
                <button
                  type="button"
                  className={`fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm fd-copy__btn${copied ? ' is-ok' : ''}`}
                  aria-label={t('publicPage.copyAddress')}
                  disabled={!slugOk}
                  onClick={() => void copy()}
                >
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                </button>
              </div>
              <span className="fd-copy__ok" role="status">
                {copied ? t('publicPage.addressCopied') : ''}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="stg-sec" aria-labelledby={`${id}-h`}>
        <div className="stg-sec__head">
          <div>
            <h2 id={`${id}-h`}>{t('publicPage.header')}</h2>
            <p>{t('publicPage.headerSub')}</p>
          </div>
        </div>
        <div className="stg-row">
          <div className="stg-text" data-gap-exempt="">
            <div className="stg-lab">{t('publicPage.logo')}</div>
            <div className="stg-help">{t('publicPage.logoHelp')}</div>
          </div>
          <div className="stg-ctl">
            <div className="pp-logo">
              {logoSrc ? (
                <img className="pp-logo__img" src={logoSrc} alt="" width={56} height={56} />
              ) : (
                <span className="pp-logo__tile" aria-hidden="true">
                  {[...(current?.name || 'T')][0]!.toUpperCase()}
                </span>
              )}
              <span className="pp-logo__state">
                {t(form.logo ? 'publicPage.logoChosen' : 'publicPage.logoSpace')}
              </span>
              <div className="pp-logo__acts">
                {form.logo && (
                  <Button onClick={() => set({ logo: null })}>{t('publicPage.logoReset')}</Button>
                )}
                <Button icon={<Images size={16} />} onClick={() => setPicking(true)}>
                  {t('media.choose')}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="stg-row">
          <div className="stg-text">
            <label className="stg-lab" htmlFor={`${id}-title`}>
              {t('publicPage.pageTitle')}
            </label>
          </div>
          <div className="stg-ctl">
            <input
              id={`${id}-title`}
              className="fd-input"
              autoComplete="off"
              maxLength={120}
              value={form.title}
              placeholder={current?.name}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
        </div>
        <div className="stg-row">
          <div className="stg-text" data-gap-exempt="">
            <label className="stg-lab" htmlFor={`${id}-tag`}>
              {t('publicPage.tagline')}
            </label>
            <div className="stg-help" id={`${id}-tagh`}>
              {t('publicPage.taglineHelp')}
            </div>
          </div>
          <div className="stg-ctl pp-ctl-col">
            <textarea
              id={`${id}-tag`}
              className="fd-input pp-tagline"
              rows={2}
              maxLength={TAGLINE_MAX}
              value={form.tagline}
              aria-describedby={`${id}-tagh ${id}-tagc`}
              onChange={(e) => set({ tagline: e.target.value })}
            />
            <span className="pp-count" id={`${id}-tagc`}>
              {form.tagline.length} / {TAGLINE_MAX}
            </span>
          </div>
        </div>
      </section>

      <section className="stg-sec" aria-labelledby={`${id}-d`}>
        <div className="stg-sec__head">
          <div>
            <h2 id={`${id}-d`}>{t('publicPage.demos')}</h2>
            <p>{t('publicPage.demosSub')}</p>
          </div>
        </div>
        <div className="stg-opts pp-radios" role="radiogroup" aria-labelledby={`${id}-d`}>
          {(['all', 'chosen'] as const).map((m) => (
            <label key={m} className="stg-opt">
              <input
                type="radio"
                name={`${id}-mode`}
                checked={form.mode === m}
                aria-describedby={`${id}-m-${m}`}
                onChange={() => set({ mode: m })}
              />
              <span>
                <b>{t(`publicPage.mode.${m}.name`)}</b>
                <span className="stg-help" id={`${id}-m-${m}`}>
                  {t(`publicPage.mode.${m}.help`)}
                </span>
              </span>
            </label>
          ))}
        </div>
        {form.mode === 'chosen' &&
          (info.demos.length === 0 ? (
            <p className="stg-help pp-note">{t('publicPage.noDemo')}</p>
          ) : (
            <>
              {/* §18.6 : lignes à filets de 52 px, l'écart est porté par la hauteur des lignes */}
              <ul className="pp-pick" data-gap-exempt="" aria-label={t('publicPage.pickLabel')}>
                {ordered.map((d) => {
                  const on = picked.includes(d.id);
                  const at = picked.indexOf(d.id);
                  return (
                    <li
                      key={d.id}
                      className={on ? 'is-on' : undefined}
                      draggable={on}
                      onDragStart={() => (drag.current = d.id)}
                      onDragOver={(e) => on && drag.current && e.preventDefault()}
                      onDrop={(e) => onDrop(e, d.id)}
                    >
                      <span className="pp-pick__grip" aria-hidden="true">
                        {on && <GripVertical size={16} />}
                      </span>
                      <input
                        type="checkbox"
                        className="pp-pick__box"
                        checked={on}
                        aria-label={t('publicPage.show', { title: d.title })}
                        onChange={(e) => toggle(d.id, e.target.checked)}
                      />
                      <b className="pp-pick__name">{d.title}</b>
                      {types[d.id] && <span className="pp-pick__type">{t(`ctype.tone.${types[d.id]}`)}</span>}
                      <span className="pp-pick__grow" />
                      {on && (
                        <>
                          <button
                            type="button"
                            className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                            aria-label={t('publicPage.moveUp', { title: d.title })}
                            aria-disabled={at === 0 || undefined}
                            onClick={() => at > 0 && move(d.id, at - 1)}
                          >
                            <ArrowUp aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                            aria-label={t('publicPage.moveDown', { title: d.title })}
                            aria-disabled={at === picked.length - 1 || undefined}
                            onClick={() => at < picked.length - 1 && move(d.id, at + 1)}
                          >
                            <ArrowDown aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className={noneChosen ? 'stg-error pp-note' : 'stg-help pp-note'} role="status">
                {noneChosen && <CircleAlert size={14} aria-hidden="true" />}
                {noneChosen ? t('publicPage.pickNone') : t('publicPage.picked', { count })}
              </p>
            </>
          ))}
      </section>

      <section className="stg-sec" aria-labelledby={`${id}-f`}>
        <div className="stg-sec__head">
          <div>
            <h2 id={`${id}-f`}>{t('publicPage.footer')}</h2>
          </div>
        </div>
        <div className="stg-row">
          <div className="stg-text" data-gap-exempt="">
            <label className="stg-lab" htmlFor={`${id}-c`}>
              {t('publicPage.contact')}
            </label>
            <div className={contactOk ? 'stg-help' : 'stg-error'} id={`${id}-ch`}>
              {!contactOk && <CircleAlert size={14} aria-hidden="true" />}
              {t(contactOk ? 'publicPage.contactHelp' : 'publicPage.contactError')}
            </div>
          </div>
          <div className="stg-ctl">
            <input
              id={`${id}-c`}
              className="fd-input"
              autoComplete="off"
              spellCheck={false}
              maxLength={200}
              value={form.contact}
              aria-invalid={!contactOk || undefined}
              aria-describedby={`${id}-ch`}
              onChange={(e) => set({ contact: e.target.value })}
            />
          </div>
        </div>
        <div className="stg-row stg-row--inline">
          <div className="stg-text">
            <div className="stg-lab" id={`${id}-mw`}>
              {t('publicPage.madeWith')}
            </div>
          </div>
          <div className="stg-ctl">
            <label className="fd-switch">
              <input
                type="checkbox"
                role="switch"
                aria-labelledby={`${id}-mw`}
                checked={form.madeWith}
                onChange={(e) => set({ madeWith: e.target.checked })}
              />
              <span className="fd-switch__track" aria-hidden="true" />
            </label>
          </div>
        </div>
      </section>

      {picking && (
        <MediaLibrary
          wsId={ws}
          kind="logo"
          onClose={() => setPicking(false)}
          onPick={(file) => {
            setPicking(false);
            // Image seulement (la médiathèque range aussi des polices)
            if (/\.(png|jpe?g|svg)$/i.test(file.path)) set({ logo: file.path });
          }}
        />
      )}
      {dialog}
    </SettingsShell>
  );
}
