/**
 * L41 §8 : Équipe (propriétaires de la plateforme, rôles) et journal d'audit (lecture seule,
 * filtres Personne et Action, export). Ajout : compte TutoClick existant, par e-mail ; un compte
 * inconnu donne « introuvable » sans rien révéler.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Download, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { WriteButton, actionLabel, exportCsv, rpcError, useConsoleRole } from './shared';
import { assistantListChanges } from './auditChange';
import type { PlatformRole } from './platform';
import { Select } from '@flowdsiml/ui';

interface Owner {
  userId: string;
  email: string;
  name: string;
  role: PlatformRole;
  me: boolean;
  lastActivity: string | null;
}
interface Entry {
  id: number;
  at: string;
  actor: string;
  actorId: string | null;
  action: string;
  objectType: string;
  label: string;
  /** L41 étape 6 : ancienne et nouvelle valeur (nulles pour les anciennes lignes). */
  old?: string | null;
  new?: string | null;
}

export function Team() {
  const { t } = useTranslation();
  const toast = useToast();
  const admin = useConsoleRole() === 'admin';
  const [team, setTeam] = useState<Owner[] | null>(null);
  const [log, setLog] = useState<Entry[]>([]);
  const [adding, setAdding] = useState(false);
  const [who, setWho] = useState('');
  const [what, setWhat] = useState('');
  // L41 : « Historique des changements » de Modèles IA arrive filtré sur les actions IA (?objet=ai)
  const [params, setParams] = useSearchParams();
  const objet = params.get('objet');
  const words = {
    order: t('console.tm.change.order'),
    proposed: t('console.tm.change.proposed'),
    notProposed: t('console.tm.change.notProposed'),
    noTag: t('console.tm.change.noTag'),
  };
  const [dialog, ask] = useConfirm();
  const load = useCallback(() => {
    void supabase.rpc('console_team').then(({ data }) => setTeam((data as unknown as Owner[]) ?? []));
    void supabase
      .rpc('console_audit_list', { p_limit: 500 })
      .then(({ data }) => setLog((data as unknown as Entry[]) ?? []));
  }, []);
  useEffect(load, [load]);
  const actions = useMemo(() => [...new Set(log.map((e) => e.action))].sort(), [log]);
  const rows = log.filter(
    (e) => (!who || e.actorId === who) && (!what || e.action === what) && (!objet || e.objectType === objet),
  );

  const setRole = async (o: Owner, role: PlatformRole) => {
    const { error } = await supabase.rpc('console_set_owner_role', { p_user: o.userId, p_role: role });
    if (error) toast(rpcError(t, error.message));
    load();
  };
  const remove = async (o: Owner) => {
    const ok = await ask({
      title: t('console.tm.removeTitle', { name: o.name || o.email }),
      body: t('console.tm.removeBody'),
      confirmLabel: t('console.tm.remove'),
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc('console_remove_owner', { p_user: o.userId });
    if (error) toast(rpcError(t, error.message));
    load();
  };
  if (!team)
    return (
      <p className="sr-only" role="status">
        {t('console.loading')}
      </p>
    );
  return (
    <div className="console-stack">
      {dialog}
      <h2 className="sr-only">{t('console.tabs.team')}</h2>
      <section className="fd-card" aria-labelledby="tm-t">
        <div className="console-card-head">
          <h2 id="tm-t" className="console-h2">
            {t('console.tm.team')}
          </h2>
          <WriteButton className="fd-btn fd-btn--sm" onClick={() => setAdding(true)}>
            <UserPlus aria-hidden="true" />
            {t('console.tm.add')}
          </WriteButton>
        </div>
        <div className="table-wrap">
          <table className="table console-table">
            <caption className="sr-only">{t('console.tm.team')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('console.tm.person')}</th>
                <th scope="col">{t('console.tm.role')}</th>
                <th scope="col">{t('console.tm.last')}</th>
                <th scope="col">
                  <span className="sr-only">{t('console.tm.remove')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {team.map((o) => (
                <tr key={o.userId}>
                  <th scope="row">
                    <b>{o.name || o.email}</b>
                    <small className="console-sub">{o.email}</small>
                  </th>
                  <td>
                    <Select
                      size="sm"
                      aria-label={t('console.tm.roleOf', { name: o.name || o.email })}
                      value={o.role}
                      disabled={!admin || o.me}
                      onChange={(e) => void setRole(o, e.target.value as PlatformRole)}
                    >
                      <option value="admin">{t('console.role.admin')}</option>
                      <option value="read_only">{t('console.role.read_only')}</option>
                    </Select>
                  </td>
                  <td className="fd-muted">{o.lastActivity ? formatDateTime(o.lastActivity) : '—'}</td>
                  <td className="r">
                    {!o.me && (
                      <WriteButton
                        className="fd-btn fd-btn--ghost fd-btn--icon fd-btn--sm"
                        label={t('console.tm.removeOf', { name: o.name || o.email })}
                        onClick={() => void remove(o)}
                      >
                        <Trash2 aria-hidden="true" />
                      </WriteButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="fd-card" aria-labelledby="au-t">
        <div className="console-card-head">
          <h2 id="au-t" className="console-h2">
            {t('console.tm.audit')}
          </h2>
          <label className="console-filter">
            <span>{t('console.tm.person')}</span>
            <Select size="sm" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">{t('console.fb.all')}</option>
              {team.map((o) => (
                <option key={o.userId} value={o.userId}>
                  {o.name || o.email}
                </option>
              ))}
            </Select>
          </label>
          <label className="console-filter">
            <span>{t('console.tm.action')}</span>
            <Select size="sm" value={what} onChange={(e) => setWhat(e.target.value)}>
              <option value="">{t('console.fb.all')}</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(t, a)}
                </option>
              ))}
            </Select>
          </label>
          {objet === 'ai' && (
            <span className="console-filter-on">
              {t('console.tm.onlyAi')}
              <button type="button" className="fd-btn fd-btn--ghost fd-btn--sm" onClick={() => setParams({})}>
                {t('console.tm.showAll')}
              </button>
            </span>
          )}
          <button
            type="button"
            className="fd-btn fd-btn--sm"
            onClick={() =>
              exportCsv(
                'journal',
                'export.audit',
                ['date', 'personne', 'action', 'objet', 'avant', 'après'],
                // Libellé de l'action (pas le code) ; listes complètes de l'assistant gardées
                rows.map((e) => [e.at, e.actor, actionLabel(t, e.action), e.label, e.old ?? '', e.new ?? '']),
              )
            }
          >
            <Download aria-hidden="true" />
            {t('console.export')}
          </button>
        </div>
        <div className="table-wrap">
          <table className="table console-table">
            <caption className="sr-only">{t('console.tm.audit')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('console.tm.date')}</th>
                <th scope="col">{t('console.tm.person')}</th>
                <th scope="col">{t('console.tm.action')}</th>
                <th scope="col">{t('console.tm.object')}</th>
                <th scope="col">{t('console.tm.before')}</th>
                <th scope="col">{t('console.tm.after')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                // Liste de l'assistant : seulement ce qui change, une ligne par changement (recette UX)
                const ch =
                  e.action === 'ai.assistant_list' ? assistantListChanges(e.old, e.new, words) : null;
                return (
                  <tr key={e.id}>
                    <td className="fd-muted console-audit-at">{formatDateTime(e.at)}</td>
                    <td>{e.actor}</td>
                    <td>{actionLabel(t, e.action)}</td>
                    {ch ? (
                      <>
                        <td>
                          {ch.map((c, i) => (
                            <div key={i}>{c.object}</div>
                          ))}
                        </td>
                        <td className="console-audit-val">
                          {ch.map((c, i) => (
                            <div key={i}>{c.before}</div>
                          ))}
                        </td>
                        <td className="console-audit-val">
                          {ch.map((c, i) => (
                            <div key={i}>{c.after}</div>
                          ))}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{e.label}</td>
                        {/* Une seule valeur vide se lit « — » ; aucune valeur : cellules vides (ancienne ligne) */}
                        <td className="console-audit-val">{e.old ?? (e.new ? '—' : '')}</td>
                        <td className="console-audit-val">{e.new ?? (e.old ? '—' : '')}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="fd-muted console-note">{t('console.tm.retention')}</p>
      </section>
      {adding && (
        <AddOwner
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddOwner({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformRole>('read_only');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc('console_add_owner', { p_email: email.trim(), p_role: role });
    if (error) return setMsg(rpcError(t, error.message));
    if (data === 'introuvable') return setMsg(t('console.tm.notFound'));
    if (data === 'deja') return setMsg(t('console.tm.already'));
    toast(t('console.tm.added'));
    onAdded();
  }
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ao-t" onSubmit={submit}>
        <div className="modal-head">
          <h2 id="ao-t">{t('console.tm.add')}</h2>
        </div>
        <div className="modal-body fd-stack">
          {msg && (
            <p className="alert alert-danger" role="alert">
              {msg}
            </p>
          )}
          <div className="field">
            <label htmlFor="ao-mail">{t('console.tm.email')}</label>
            <input
              id="ao-mail"
              className="input"
              type="email"
              required
              autoFocus
              autoComplete="off"
              aria-describedby="ao-h"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <span className="help" id="ao-h">
              {t('console.tm.emailHelp')}
            </span>
          </div>
          <div className="field">
            <label htmlFor="ao-role">{t('console.tm.role')}</label>
            <Select id="ao-role" value={role} onChange={(e) => setRole(e.target.value as PlatformRole)}>
              <option value="read_only">{t('console.role.read_only')}</option>
              <option value="admin">{t('console.role.admin')}</option>
            </Select>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="fd-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="fd-btn fd-btn--primary">
            {t('console.tm.addBtn')}
          </button>
        </div>
      </form>
    </div>
  );
}
