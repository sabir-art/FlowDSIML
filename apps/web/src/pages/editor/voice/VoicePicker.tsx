import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Pause, Play, Search, X } from 'lucide-react';
import { AiRequestError, callAi } from '../../../lib/ai';
import { useAudioText } from '../../../components/ai/AiAudio';

/** L62 §8 : une voix du compte, telle que la fonction ai la renvoie (aucun nom de fournisseur). */
export interface VoiceInfo {
  id: string;
  name: string;
  gender: 'f' | 'm' | 'n';
  accent: string;
  style: string;
  langs: string[];
  recommended: boolean;
  own: boolean;
}

/** Recherche sans tenir compte des accents ni de la casse. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Voix qui répondent à la recherche (nom, accent, style) et aux filtres. */
export function filterVoices(
  list: VoiceInfo[],
  q: string,
  f: { lang: string | null; gender: 'f' | 'm' | 'n' | null },
): VoiceInfo[] {
  const needle = fold(q.trim());
  return list.filter(
    (v) =>
      (!needle || fold(`${v.name} ${v.accent} ${v.style}`).includes(needle)) &&
      (!f.lang || v.langs.includes(f.lang)) &&
      (!f.gender || v.gender === f.gender),
  );
}

/** Exemples déjà écoutés, par voix et par langue : une seule demande par session. */
const samples = new Map<string, string>();

/**
 * L62 §8 : sélecteur de voix. Déclencheur de 40 px (avatar, nom, style), fenêtre de 400 px : recherche,
 * puces Langue et Genre, sections « Recommandées pour … » et « Toutes les voix », lignes de 56 px sans
 * colonne de coche (CHOIX-01 : la voix choisie porte une pastille cochée sur son avatar), Écouter rond.
 * Écouter n'est jamais l'action de choix. Clavier : flèches, Entrée choisit, Espace écoute, Échap ferme.
 */
export function VoicePicker({
  ws,
  lang,
  voices,
  value,
  disabled,
  labelledBy,
  describedBy,
  onChange,
}: {
  ws: string;
  lang: string;
  voices: VoiceInfo[];
  /** Identifiant de la voix choisie. */
  value: string;
  disabled?: boolean;
  labelledBy: string;
  describedBy?: string;
  onChange: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const at = useAudioText();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [fLang, setFLang] = useState<string | null>(lang);
  const [fGender, setFGender] = useState<'f' | 'm' | 'n' | null>(null);
  const [chip, setChip] = useState<'lang' | 'gender' | null>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [why, setWhy] = useState('');
  const audio = useRef<HTMLAudioElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = labelledBy;

  const langName = (l: string) => {
    try {
      return new Intl.DisplayNames([i18n.language], { type: 'language' }).of(l) ?? l;
    } catch {
      return l;
    }
  };
  const genderName = (g: VoiceInfo['gender']) => t(`ai.voice.picker.gender_${g}`);
  const meta = (v: VoiceInfo) => [genderName(v.gender), v.accent, v.style].filter(Boolean).join(' · ');
  const chosen = voices.find((v) => v.id === value) ?? null;

  const shown = useMemo(
    () => filterVoices(voices, q, { lang: fLang, gender: fGender }),
    [voices, q, fLang, fGender],
  );
  const filtered = !!q.trim() || fGender !== null || fLang !== lang;
  const rec = shown.filter((v) => v.recommended && fLang === lang);
  const rest = filtered ? shown : shown.filter((v) => !(v.recommended && fLang === lang));
  // Ordre de lecture du clavier : recommandées puis les autres
  const order = filtered ? shown : [...rec, ...rest];
  const langs = useMemo(
    () => [...new Set([lang, ...voices.flatMap((v) => v.langs)])].filter(Boolean),
    [voices, lang],
  );

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
  };
  useEffect(() => () => stop(), []);
  const close = (focusTrigger = true) => {
    setOpen(false);
    setChip(null);
    stop();
    if (focusTrigger) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    // Chaque ouverture repart d'une recherche vide (les filtres restent)
    setQ('');
    search.current?.focus();
    const i = order.findIndex((v) => v.id === value);
    setActive(i >= 0 ? i : 0);
    const off = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setActive(0), [q, fLang, fGender]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  // Une seule écoute à la fois ; l'exemple est lu dans la langue de la démo, mis en cache
  const listen = async (v: VoiceInfo) => {
    if (playing === v.id) return stop();
    stop();
    setWhy('');
    const key = `${v.id}:${lang}`;
    let src = samples.get(key);
    if (!src) {
      setLoading(v.id);
      try {
        src = (await callAi<{ audio: string }>(ws, 'voice_sample', lang, { voice: v.id })).audio;
        samples.set(key, src);
      } catch (e) {
        setWhy(e instanceof AiRequestError ? e.code : 'ERROR');
        setLoading(null);
        return;
      }
      setLoading(null);
    }
    const a = new Audio(src);
    audio.current = a;
    a.onended = () => {
      if (audio.current === a) setPlaying(null);
    };
    setPlaying(v.id);
    await a.play().catch(() => setPlaying(null));
  };
  const choose = (v: VoiceInfo) => {
    onChange(v.id);
    close();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      // Échap ferme la fenêtre du sélecteur, pas le panneau qui la contient
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (chip) return setChip(null);
      return close();
    }
    if (chip) return;
    const inSearch = e.target === search.current;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!order.length) return;
      setActive((i) => (e.key === 'ArrowDown' ? Math.min(order.length - 1, i + 1) : Math.max(0, i - 1)));
      if (inSearch) listRef.current?.focus();
    } else if (e.key === 'Enter' && order[active] && (inSearch || e.target === listRef.current)) {
      e.preventDefault();
      choose(order[active]!);
    } else if (e.key === ' ' && e.target === listRef.current && order[active]) {
      e.preventDefault();
      void listen(order[active]!);
    }
  };
  const clearFilters = () => {
    setQ('');
    setFLang(lang);
    setFGender(null);
  };

  const row = (v: VoiceInfo, idx: number) => {
    const on = v.id === value;
    return (
      <div
        key={v.id}
        id={`${id}-o-${v.id}`}
        role="option"
        aria-selected={on}
        data-idx={idx}
        className={`vp-row${on ? ' is-on' : ''}${idx === active ? ' is-active' : ''}`}
        onClick={() => choose(v)}
        onMouseMove={() => setActive(idx)}
      >
        <span className="vp-av" aria-hidden="true" data-initial={v.name.slice(0, 1).toUpperCase()}>
          {on && (
            <span className="vp-av-check">
              <Check />
            </span>
          )}
        </span>
        <span className="vp-tx">
          <span className="vp-name">
            <span className="vp-nm">{v.name}</span>
            {v.recommended && <span className="vp-rec">{t('ai.voice.picker.recommended')}</span>}
          </span>
          <span className="vp-meta">{meta(v)}</span>
        </span>
        <button
          type="button"
          tabIndex={-1}
          className={`vp-listen${playing === v.id ? ' is-playing' : ''}`}
          aria-label={t(playing === v.id ? 'ai.voice.picker.pause' : 'ai.voice.picker.listen', {
            name: v.name,
          })}
          aria-busy={loading === v.id || undefined}
          onClick={(e) => {
            e.stopPropagation();
            void listen(v);
          }}
        >
          {playing === v.id ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>
      </div>
    );
  };

  return (
    <div className="vp" ref={root} onKeyDown={open ? onKey : undefined}>
      <button
        ref={trigger}
        type="button"
        className="vp-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelledBy} ${id}-cur`}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {/* Initiale en CSS : hors du texte du bouton, le nom accessible reprend tout le texte visible */}
        <span
          className="vp-av"
          aria-hidden="true"
          data-initial={(chosen?.name ?? '?').slice(0, 1).toUpperCase()}
        />
        <span className="vp-tx" id={`${id}-cur`}>
          <span className="vp-name">{chosen?.name ?? t('ai.voice.picker.none')}</span>{' '}
          {/* Espace réel : le nom accessible reprend le texte visible tel qu'il se lit (axe, 2.5.3) */}
          {chosen && <span className="vp-meta">{meta(chosen)}</span>}
        </span>
        <ChevronDown aria-hidden="true" className="vp-chev" />
      </button>
      {open && (
        <div className="vp-pop" role="dialog" aria-label={t('ai.voice.picker.title')}>
          <div className="vp-search">
            <Search aria-hidden="true" />
            <input
              ref={search}
              type="search"
              className="input"
              value={q}
              placeholder={t('ai.voice.picker.search')}
              aria-label={t('ai.voice.picker.search')}
              aria-controls={`${id}-lb`}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                className="vp-clear"
                aria-label={t('ai.voice.picker.clearSearch')}
                onClick={() => {
                  setQ('');
                  search.current?.focus();
                }}
              >
                <X aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="vp-chips">
            {(
              [
                [
                  'lang',
                  t('ai.voice.picker.langChip', { lang: fLang ? langName(fLang) : t('ai.voice.picker.all') }),
                  fLang !== lang,
                ],
                [
                  'gender',
                  t('ai.voice.picker.genderChip', {
                    gender: fGender ? genderName(fGender) : t('ai.voice.picker.all'),
                  }),
                  fGender !== null,
                ],
              ] as const
            ).map(([k, label, on]) => (
              <span key={k} className="vp-chip-wrap">
                <button
                  type="button"
                  className={`vp-chip${on ? ' is-on' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={chip === k}
                  onClick={() => setChip(chip === k ? null : k)}
                >
                  {label}
                  <ChevronDown aria-hidden="true" />
                </button>
                {chip === k && (
                  <div className="vp-chip-menu" role="menu">
                    {(k === 'lang'
                      ? [null, ...langs].map((l) => ({
                          v: l,
                          label: l ? langName(l) : t('ai.voice.picker.all'),
                          on: fLang === l,
                          set: () => setFLang(l),
                        }))
                      : ([null, 'f', 'm', 'n'] as const).map((g) => ({
                          v: g,
                          label: g ? genderName(g) : t('ai.voice.picker.all'),
                          on: fGender === g,
                          set: () => setFGender(g),
                        }))
                    ).map((o) => (
                      <button
                        key={String(o.v)}
                        type="button"
                        role="menuitemradio"
                        aria-checked={o.on}
                        className="vp-chip-item"
                        onClick={() => {
                          o.set();
                          setChip(null);
                          search.current?.focus();
                        }}
                      >
                        {o.label}
                        {o.on && <Check aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            ))}
          </div>
          {order.length ? (
            <div
              ref={listRef}
              id={`${id}-lb`}
              className="vp-list"
              role="listbox"
              tabIndex={0}
              aria-label={t('ai.voice.picker.title')}
              aria-activedescendant={order[active] ? `${id}-o-${order[active]!.id}` : undefined}
            >
              {!filtered && rec.length > 0 && (
                <div role="group" aria-labelledby={`${id}-g1`}>
                  <div className="vp-sec" id={`${id}-g1`}>
                    {t('ai.voice.picker.recFor', {
                      lang: langName(lang),
                      context: /^[aeiouyéèêh]/i.test(langName(lang)) ? 'vowel' : undefined,
                    })}{' '}
                    <span>{rec.length}</span>
                  </div>
                  {rec.map((v, i) => row(v, i))}
                </div>
              )}
              <div role="group" aria-labelledby={`${id}-g2`}>
                <div className="vp-sec" id={`${id}-g2`}>
                  {filtered ? t('ai.voice.picker.results') : t('ai.voice.picker.allVoices')}{' '}
                  <span>{shown.length}</span>
                </div>
                {rest.map((v, i) => row(v, (filtered ? 0 : rec.length) + i))}
              </div>
            </div>
          ) : (
            <div className="vp-empty" role="status">
              <b>{t('ai.voice.picker.noneFor', { q: q.trim() || '…' })}</b>
              <span>{t('ai.voice.picker.noneHelp')}</span>
              <button type="button" className="link-button" onClick={clearFilters}>
                {t('ai.voice.picker.clearFilters')}
              </button>
            </div>
          )}
          {why && (
            <p className="vp-why" role="alert">
              {/* L62 : la cause quand le service de voix refuse, sinon le message général */}
              {at.provider(why) || t('ai.voice.sampleError')}
            </p>
          )}
          <div className="vp-foot">
            <span>{t('ai.voice.picker.footLang', { lang: langName(lang) })}</span>
            <span>
              {filtered
                ? t('ai.voice.picker.countResults', { count: shown.length })
                : t('ai.voice.picker.countAll', { count: voices.length })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
