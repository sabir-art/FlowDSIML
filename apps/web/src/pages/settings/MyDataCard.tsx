import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Trash2 } from 'lucide-react';
import { strToU8, zipSync } from 'fflate';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

type Check = {
  blocking: Array<{ id: string; name: string }>;
  solo: Array<{ id: string; name: string; demos: number }>;
  hasPassword: boolean;
  recentAuth: boolean;
};

const FILES: Array<[key: string, file: string]> = [
  ['profile', 'profil.json'],
  ['workspaces', 'espaces-et-roles.json'],
  ['comments', 'commentaires.json'],
  ['notifications', 'notifications.json'],
  ['preferences', 'preferences.json'],
  ['publicationConfirmations', 'confirmations-de-publication.json'],
];
const BUCKETS = ['captures', 'videos', 'voices', 'html', 'media'];

/** Tous les fichiers sous un préfixe (dossiers parcourus jusqu'à 3 niveaux). */
async function listAll(bucket: string, prefix: string, depth = 3): Promise<string[]> {
  const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const it of data ?? []) {
    const path = `${prefix}/${it.name}`;
    if (it.id) out.push(path);
    else if (depth > 1) out.push(...(await listAll(bucket, path, depth - 1)));
  }
  return out;
}

/**
 * L28-07 / L28-08 : carte « Mes données » de Mon profil. Export .zip préparé et téléchargé dans le
 * navigateur (rien n'est conservé sur le serveur). Suppression du compte : bloquée pour le seul
 * propriétaire d'un espace qui a d'autres membres ; espaces dont l'utilisateur est le seul membre
 * supprimés avec leurs fichiers ; adresse e-mail, mot de passe s'il existe, case de confirmation.
 */
export function MyDataCard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { select } = useWorkspace();
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [params, setParams] = useSearchParams();
  const [check, setCheck] = useState<Check | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);

  // Retour de « Me reconnecter » : la modale de suppression se rouvre
  useEffect(() => {
    if (params.get('delete') !== '1') return;
    const next = new URLSearchParams(params);
    next.delete('delete');
    setParams(next, { replace: true });
    void openDelete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (check && !d.open) d.showModal();
    else if (!check && d.open) d.close();
  }, [check]);

  async function prepareExport() {
    setExporting(true);
    setExportErr(null);
    setExported(false);
    try {
      const { data, error } = await supabase.rpc('export_my_data');
      if (error) throw error;
      const d = (data ?? {}) as Record<string, unknown>;
      const files: Record<string, Uint8Array> = {
        'LISEZMOI.txt': strToU8(t('myData.readme', { date: new Date().toLocaleString(i18n.language) })),
      };
      for (const [k, f] of FILES) files[f] = strToU8(JSON.stringify(d[k] ?? null, null, 2));
      const zip = zipSync(files, { level: 6 });
      const name = `mes-donnees-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExported(true);
    } catch {
      setExportErr(t('myData.exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  async function openDelete() {
    setErr(null);
    setReauth(false);
    setEmail('');
    setPassword('');
    setSure(false);
    const { data, error } = await supabase.rpc('account_deletion_check');
    if (error) return setExportErr(errorMessage(t, error));
    setCheck(data as unknown as Check);
  }

  async function confirmDelete() {
    if (!check) return;
    setBusy(true);
    setErr(null);
    try {
      if (email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase()) throw new Error('EMAIL_MISMATCH');
      // Mot de passe : nouvelle connexion juste avant (connexion de moins de 5 minutes exigée par la base)
      if (check.hasPassword) {
        const r = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (r.error) throw new Error('PASSWORD_MISMATCH');
      }
      // Fichiers des espaces supprimés avec le compte : effacés d'abord ; échecs confiés à la purge différée
      const orphans: Array<{ bucket: string; path: string }> = [];
      for (const ws of check.solo) {
        const paths: Array<[string, string]> = [];
        for (const b of BUCKETS) for (const p of await listAll(b, ws.id)) paths.push([b, p]);
        const demos = await supabase.from('demos').select('id').eq('workspace_id', ws.id);
        for (const d of demos.data ?? [])
          for (const p of await listAll('published', d.id, 2)) paths.push(['published', p]);
        for (const b of new Set(paths.map(([x]) => x))) {
          const mine = paths.filter(([x]) => x === b).map(([, p]) => p);
          for (let i = 0; i < mine.length; i += 100) {
            const part = mine.slice(i, i + 100);
            const r = await supabase.storage.from(b).remove(part);
            if (r.error) orphans.push(...part.map((path) => ({ bucket: b, path })));
          }
        }
      }
      const { error } = await supabase.rpc('delete_my_account', {
        p_email: email.trim(),
        p_password: check.hasPassword ? password : null,
        p_orphans: orphans,
      });
      if (error) throw error;
      // Message affiché par la page de connexion (la garde des routes y renvoie à la déconnexion)
      try {
        sessionStorage.setItem('fd.accountDeleted', '1');
      } catch {
        /* stockage indisponible */
      }
      await supabase.auth.signOut();
      navigate('/login?deleted=1', { replace: true });
    } catch (e) {
      const msg = (e as { message?: string }).message ?? '';
      if (/REAUTH_REQUIRED/.test(msg)) setReauth(true);
      setErr(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  }

  const blocked = !!check?.blocking.length;
  // Sans mot de passe à saisir, une connexion ancienne se refait avant le formulaire
  const needReauth = reauth || (!!check && !check.hasPassword && !check.recentAuth);
  const reconnect = async () => {
    await supabase.auth.signOut();
    navigate(`/login?redirect=${encodeURIComponent('/settings/profile?delete=1')}`, { replace: true });
  };
  const ready = !!email.trim() && sure && (!check?.hasPassword || !!password);
  return (
    <section className="card st-gen st-mydata" aria-labelledby="md-title">
      <div className="form-sec">
        <div className="intro">
          <h2 className="t-h3" id="md-title">
            {t('myData.title')}
          </h2>
        </div>
        <div>
          <p className="muted">{t('myData.exportBody')}</p>
          <div className="row wrap st-mydata-act">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={exporting}
              onClick={() => void prepareExport()}
            >
              <Download aria-hidden="true" />
              {exporting ? t('myData.preparing') : t('myData.export')}
            </button>
            <span className="help" role="status">
              {exported ? t('myData.done') : ''}
            </span>
          </div>
          {exporting && <div className="st-mydata-bar" aria-hidden="true" />}
          {exportErr && (
            <p className="field-error" role="alert">
              {exportErr}
            </p>
          )}
          <hr className="divider" />
          <button type="button" className="btn btn-secondary st-mydata-del" onClick={() => void openDelete()}>
            <Trash2 aria-hidden="true" />
            {t('myData.delete')}
          </button>
        </div>
      </div>

      <dialog
        ref={dlg}
        className="mk dialog st-mydata-dlg"
        aria-labelledby="md-dlg-t"
        onClose={() => setCheck(null)}
      >
        {check && blocked ? (
          <>
            <div className="modal-head">
              <h2 id="md-dlg-t">{t('myData.blockedTitle')}</h2>
            </div>
            <div className="modal-body">
              <p>{t('myData.blockedBody')}</p>
              <ul className="st-mydata-list">
                {check.blocking.map((w) => (
                  <li key={w.id}>
                    <b>{w.name}</b>{' '}
                    <button
                      type="button"
                      className="mk-link-inline"
                      onClick={() => {
                        select(w.id);
                        setCheck(null);
                        navigate('/settings/members');
                      }}
                    >
                      {t('myData.changeOwner')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setCheck(null)}>
                {t('common.close')}
              </button>
            </div>
          </>
        ) : check ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && !busy) void confirmDelete();
            }}
          >
            <div className="modal-head">
              <h2 id="md-dlg-t">{t('myData.confirmTitle')}</h2>
            </div>
            <div className="modal-body">
              <p>{t('myData.confirmBody')}</p>
              {needReauth && (
                <div className="alert alert-warning st-mydata-reauth" role="alert">
                  <p>{t('myData.errReauth')}</p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void reconnect()}>
                    {t('myData.reconnect')}
                  </button>
                </div>
              )}
              {check.solo.map((w) => (
                <p key={w.id} className="alert alert-warning st-mydata-solo" role="note">
                  {t('myData.soloDeleted', { name: w.name, count: w.demos })}
                </p>
              ))}
              {!needReauth && (
                <>
                  <div className="field">
                    <label htmlFor="md-email">{t('myData.email')}</label>
                    <input
                      id="md-email"
                      className="input"
                      type="email"
                      autoComplete="email"
                      value={email}
                      aria-describedby="md-email-h"
                      onChange={(e) => {
                        setErr(null);
                        setEmail(e.target.value);
                      }}
                    />
                    <span className="help" id="md-email-h">
                      {t('myData.emailHelp', { email: user?.email ?? '' })}
                    </span>
                  </div>
                  {check.hasPassword && (
                    <div className="field">
                      <label htmlFor="md-pwd">{t('myData.password')}</label>
                      <input
                        id="md-pwd"
                        className="input"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                          setErr(null);
                          setPassword(e.target.value);
                        }}
                      />
                    </div>
                  )}
                  <label className="check">
                    <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
                    {t('myData.sure')}
                  </label>
                </>
              )}
              {err && !needReauth && (
                <p className="field-error" role="alert">
                  {err}
                </p>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setCheck(null)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-danger" disabled={!ready || busy || needReauth}>
                {t('myData.deleteConfirm')}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </section>
  );
}
