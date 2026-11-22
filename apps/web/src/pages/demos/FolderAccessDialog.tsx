import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@flowdsiml/ui';
import { AvatarPhoto } from '../../components/AvatarPhoto';
import { Info, Lock, Search } from 'lucide-react';
import type { Tables } from '@flowdsiml/supabase-types';
import { supabase } from '../../lib/supabase';
import { check } from '../../lib/useAction';
import { errorMessage } from '../../lib/errors';

type Member = { user_id: string; full_name: string; email: string; role: string };
const isAdminRole = (r: string) => r === 'admin' || r === 'owner';
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/**
 * L27-09 : « Accès au dossier « nom » » (administrateurs, plan Enterprise). Tout l'espace, ou membres
 * choisis ; administrateurs et propriétaires toujours cochés. Le filtrage est fait par la base.
 */
export function FolderAccessDialog({
  folder,
  onClose,
  onSaved,
}: {
  folder: Tables<'folders'>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [restricted, setRestricted] = useState(folder.restricted);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void Promise.all([
      supabase.rpc('list_members', { p_workspace: folder.workspace_id }),
      supabase.from('folder_members').select('user_id').eq('folder_id', folder.id),
    ]).then(([m, fm]) => {
      setMembers((m.data ?? []) as Member[]);
      setChosen(new Set((fm.data ?? []).map((x) => x.user_id)));
    });
  }, [folder.id, folder.workspace_id]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return members.filter((m) => !n || `${m.full_name} ${m.email}`.toLowerCase().includes(n));
  }, [members, q]);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      check(
        await supabase.rpc('set_folder_access', {
          p_folder: folder.id,
          p_restricted: restricted,
          p_users: restricted ? [...chosen] : [],
        }),
      );
      onSaved();
      onClose();
    } catch (e) {
      setErr(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      className="fa-dialog"
      icon={<Lock />}
      title={t('folderAccess.title', { name: folder.name })}
      closeLabel={t('common.close')}
      footer={
        <>
          <button type="button" className="fd-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="fd-btn fd-btn--primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      {/* MODAL-01 : le cadre vient de Modal ; le contenu garde ses styles (« mk ») */}
      <div className="mk fa-body">
        <fieldset className="fa-choices">
          <legend className="sr-only">{t('folderAccess.who')}</legend>
          <label className="check">
            <input type="radio" name="fa-mode" checked={!restricted} onChange={() => setRestricted(false)} />
            {t('folderAccess.all')}
          </label>
          <label className="check">
            <input type="radio" name="fa-mode" checked={restricted} onChange={() => setRestricted(true)} />
            {t('folderAccess.chosen')}
          </label>
        </fieldset>
        {restricted && (
          <fieldset className="fa-members">
            <legend className="sr-only">{t('folderAccess.members')}</legend>
            <label className="search-pill fa-search">
              <Search aria-hidden="true" />
              <input
                className="fd-input"
                type="search"
                aria-label={t('folderAccess.search')}
                placeholder={t('folderAccess.search')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <p className="t-caption muted" id="fa-admins">
              {t('folderAccess.adminsAlways')}
            </p>
            <ul className="fa-list">
              {shown.map((m) => {
                const admin = isAdminRole(m.role);
                const name = m.full_name || m.email;
                return (
                  <li key={m.user_id}>
                    <label className="fa-member">
                      <input
                        type="checkbox"
                        checked={admin || chosen.has(m.user_id)}
                        aria-disabled={admin || undefined}
                        aria-describedby={admin ? 'fa-admins' : undefined}
                        onChange={(e) => {
                          if (admin) return;
                          const next = new Set(chosen);
                          if (e.target.checked) next.add(m.user_id);
                          else next.delete(m.user_id);
                          setChosen(next);
                        }}
                      />
                      <span className="avatar avatar-sm" aria-hidden="true">
                        {initials(name)}
                        <AvatarPhoto userId={m.user_id} />
                      </span>
                      <span className="fa-name">{name}</span>
                      <span className="t-caption muted">{t(`roles.${m.role}`)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
        <div className="alert alert-info fa-note" role="note">
          <Info aria-hidden="true" />
          <span className="t-caption">{t('folderAccess.linksStay')}</span>
        </div>
        {err && (
          <p className="field-error" role="alert">
            {err}
          </p>
        )}
      </div>
    </Modal>
  );
}
