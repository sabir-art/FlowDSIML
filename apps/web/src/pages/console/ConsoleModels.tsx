/**
 * L41 (spec UX l41-console-modeles-ia, docs/tech/ia-fournisseurs.md §4) : onglet Console « Modèles IA ».
 * Étape 2 : en-tête et section Fournisseurs. Les clés passent par l'Edge Function `ai` (actions console_*) :
 * collée une seule fois, testée, enregistrée dans le coffre seulement si le test réussit, jamais
 * réaffichée (ni en clair, ni masquée, ni ses derniers caractères). Lecture seule : tout est visible,
 * les actions sont désactivées.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, History, KeyRound, Plug } from 'lucide-react';
import { Modal } from '@flowdsiml/ui';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { WriteButton } from './shared';

type Provider = 'anthropic' | 'openai' | 'elevenlabs';
interface ProviderState {
  provider: Provider;
  label: string;
  state: 'connected' | 'refused' | 'missing';
  source: 'vault' | 'env' | null;
  addedAt: string | null;
  lastTest: { at: string; ok: boolean; cause: string | null; ms: number | null } | null;
}

/** Appel d'une action de la Console sur l'Edge Function `ai` ; erreur : code et cause seulement. */
async function consoleAi<T>(action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('ai', { body: { action, ...extra } });
  if (!error) return { ok: true as const, result: (data as { result: T }).result };
  let body: { error?: string; cause?: string; status?: number } = {};
  const ctx = (error as { context?: Response }).context;
  try {
    if (ctx && typeof ctx.json === 'function') body = await ctx.json();
  } catch {
    /* corps illisible : erreur générique */
  }
  return { ok: false as const, error: body.error ?? 'NETWORK', cause: body.cause, status: body.status };
}

export function Models() {
  const { t } = useTranslation();
  const [list, setList] = useState<ProviderState[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [keyFor, setKeyFor] = useState<ProviderState | null>(null);
  const load = useCallback(() => {
    void consoleAi<ProviderState[]>('console_providers').then((r) => {
      if (r.ok) setList(r.result);
      else setFailed(true);
    });
  }, []);
  useEffect(load, [load]);

  if (failed)
    return (
      <p className="alert alert-danger" role="alert">
        {t('console.ai.loadError')}
      </p>
    );
  if (!list)
    return (
      <p className="sr-only" role="status">
        {t('console.loading')}
      </p>
    );
  const none = list.every((p) => p.state === 'missing');
  return (
    <div className="console-stack">
      <div className="console-card-head console-ai-head">
        <div>
          <h2 className="console-ai-title">{t('console.ai.title')}</h2>
          <p className="fd-muted">{t('console.ai.sub')}</p>
        </div>
        <Link className="fd-btn fd-btn--sm" to="/console/equipe">
          <History aria-hidden="true" />
          {t('console.ai.history')}
        </Link>
      </div>
      {none && (
        <section className="fd-card console-ai-empty" aria-labelledby="ai-empty-t">
          <span className="console-ai-empty__ic" aria-hidden="true">
            <KeyRound />
          </span>
          <h3 id="ai-empty-t">{t('console.ai.emptyTitle')}</h3>
          <p className="fd-muted">{t('console.ai.emptyBody')}</p>
          <WriteButton className="fd-btn fd-btn--primary fd-btn--sm" onClick={() => setKeyFor(list[0]!)}>
            <KeyRound aria-hidden="true" />
            {t('console.ai.addAny')}
          </WriteButton>
        </section>
      )}
      <section className="fd-card" aria-labelledby="ai-prov-t">
        <h3 id="ai-prov-t" className="console-h2">
          {t('console.ai.providers')}
        </h3>
        <p className="fd-muted console-ai-help">{t('console.ai.providersHelp')}</p>
        <ul className="console-ai-list" role="list">
          {list.map((p) => (
            <ProviderRow key={p.provider} p={p} quiet={none} onKey={() => setKeyFor(p)} onTested={load} />
          ))}
          <li className="console-ai-row is-soon">
            <span className="console-ai-tile" aria-hidden="true">
              <Plug />
            </span>
            <div className="console-ai-name">
              <b>{t('console.ai.others')}</b>
              <small>{t('console.ai.othersHelp')}</small>
            </div>
            <span className="console-ai-state">{t('console.ai.soon')}</span>
            <span />
          </li>
        </ul>
      </section>
      {keyFor && (
        <KeyDialog
          p={keyFor}
          onClose={() => setKeyFor(null)}
          onSaved={() => {
            setKeyFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Libellé d'une cause nommée (« Le fournisseur refuse la clé (401) »). */
function causeText(
  t: (k: string, o?: Record<string, unknown>) => string,
  cause?: string | null,
  status?: number,
) {
  const known = [
    'KEY_REFUSED',
    'KEY_FORBIDDEN',
    'MODEL_UNKNOWN',
    'BUSY',
    'PROVIDER_DOWN',
    'TIMEOUT',
    'NETWORK',
  ];
  return t(`console.ai.cause.${known.includes(cause ?? '') ? cause : 'PROVIDER'}`, { status: status ?? '' });
}

function ProviderRow({
  p,
  quiet,
  onKey,
  onTested,
}: {
  p: ProviderState;
  /** État vide : « Ajouter la clé » en secondaire, « Ajouter une clé » reste le seul bouton primaire. */
  quiet: boolean;
  onKey: () => void;
  onTested: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const has = p.state !== 'missing';
  const test = async () => {
    setBusy(true);
    const r = await consoleAi<{ ok: boolean; ms: number; cause?: string; status?: number }>(
      'console_key_test',
      {
        provider: p.provider,
      },
    );
    setBusy(false);
    if (r.ok && r.result.ok) toast(t('console.ai.testOk', { name: p.label, ms: r.result.ms }));
    else if (r.ok)
      toast(
        t('console.ai.testKo', { name: p.label, cause: causeText(t, r.result.cause, r.result.status) }),
        undefined,
        { tone: 'warning' },
      );
    else
      toast(
        t('console.ai.testKo', { name: p.label, cause: causeText(t, r.cause ?? r.error, r.status) }),
        undefined,
        { tone: 'warning' },
      );
    onTested();
  };
  const helpId = `ai-${p.provider}-h`;
  return (
    <li className="console-ai-row">
      <span className="console-ai-tile" aria-hidden="true">
        {p.label[0]}
      </span>
      <div className="console-ai-name">
        <b>{p.label}</b>
        <small>{t(`console.ai.use.${p.provider}`)}</small>
      </div>
      <span className="console-ai-state">
        {p.state === 'connected' ? (
          <span className="console-ai-pill is-ok">
            <Check aria-hidden="true" />
            {t('console.ai.connected')}
          </span>
        ) : p.state === 'refused' ? (
          <span className="console-ai-pill is-bad">{t('console.ai.refused')}</span>
        ) : (
          <span className="console-ai-pill is-warn">{t('console.ai.missing')}</span>
        )}
      </span>
      <div className="console-ai-acts">
        <small className="fd-muted" id={helpId}>
          {p.state === 'refused'
            ? causeText(t, p.lastTest?.cause, undefined)
            : p.source === 'vault' && p.addedAt
              ? t('console.ai.addedOn', { date: formatDate(p.addedAt) })
              : p.source === 'env'
                ? t('console.ai.deployed')
                : ''}
        </small>
        {has && (
          <WriteButton
            className="fd-btn fd-btn--sm"
            label={t('console.ai.testOf', { name: p.label })}
            disabled={busy}
            onClick={() => void test()}
          >
            {t('console.ai.test')}
          </WriteButton>
        )}
        <WriteButton
          className={`fd-btn fd-btn--sm${has || quiet ? '' : ' fd-btn--primary'}`}
          label={t(has ? 'console.ai.replaceOf' : 'console.ai.addOf', { name: p.label })}
          onClick={onKey}
        >
          {!has && <KeyRound aria-hidden="true" />}
          {t(has ? 'console.ai.replace' : 'console.ai.add')}
        </WriteButton>
      </div>
    </li>
  );
}

function KeyDialog({ p, onClose, onSaved }: { p: ProviderState; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const has = p.state !== 'missing';
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const value = key.trim();
    setErr(null);
    if (value.length < 10 || /\s/.test(value)) return setErr(t('console.ai.badKey'));
    setBusy(true);
    const r = await consoleAi<{ ok: true; ms: number; replaced: boolean }>('console_key_save', {
      provider: p.provider,
      key: value,
    });
    setBusy(false);
    // La clé ne reste pas dans la page, quel que soit le résultat
    setKey('');
    if (r.ok) {
      toast(
        t(r.result.replaced ? 'console.ai.replaced' : 'console.ai.added', { name: p.label, ms: r.result.ms }),
      );
      onSaved();
    } else if (r.error === 'KEY_TEST') setErr(causeText(t, r.cause, r.status));
    else if (r.error === 'BAD_KEY') setErr(t('console.ai.badKey'));
    else setErr(t('console.ai.saveError'));
  }
  return (
    <Modal
      open
      onClose={onClose}
      icon={<KeyRound />}
      title={t(has ? 'console.ai.replaceTitle' : 'console.ai.addTitle', { name: p.label })}
      closeLabel={t('common.close')}
      onDismiss={busy ? () => undefined : undefined}
      footer={
        <>
          <button type="button" className="fd-btn" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="ai-key-f" className="fd-btn fd-btn--primary" disabled={busy}>
            {busy ? t('console.ai.testing') : t('console.ai.testSave')}
          </button>
        </>
      }
    >
      <form id="ai-key-f" className="field" onSubmit={submit} noValidate>
        <label htmlFor="ai-key">{t('console.ai.keyLabel')}</label>
        <input
          id="ai-key"
          className="input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={err ? true : undefined}
          aria-describedby={`ai-key-h${err ? ' ai-key-e' : ''}`}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        {err && (
          <span className="field-error" id="ai-key-e" role="alert">
            {err}
          </span>
        )}
        <span className="help" id="ai-key-h">
          {t('console.ai.keyHelp')}
        </span>
      </form>
    </Modal>
  );
}
