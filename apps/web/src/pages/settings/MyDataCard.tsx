import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert, Download, TriangleAlert, UsersRound } from 'lucide-react';
import { Button, Modal } from '@flowdsiml/ui';
import { strToU8, zipSync } from 'fflate';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { useAuth } from '../../auth/AuthProvider';
import { useToast } from '../../components/Toast';
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
// Retours client 21/11 : les logos de l'espace (branding) partent aussi avec un espace supprimé
const BUCKETS = ['captures', 'videos', 'voices', 'html', 'media', 'branding'];

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
  const toast = useToast();
  const { user } = useAuth();
  const { select } = useWorkspace();
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [check, setCheck] = useState<Check | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reauth, setReauth] = useState(false);

  // Retour de « Me reconnecter » : la modale de suppression se rouvre
  useEffect(() => {
    if (params.get('delete') !== '1') return;
    const next = new URLSearchParams(params);
    next.delete('delete');
    setParams(next, { replace: true });
    void openDelete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function prepareExport() {
    setExporting(true);
    setExportErr(null);
    try {
      const { data, error } = await supabase.rpc('export_my_data');
      if (error) throw error;
      const d = (data ?? {}) as Record<string, unknown>;
      const files: Record<string, Uint8Array> = {
        'LISEZMOI.txt': strToU8(t('myData.readme', { date: new Date().toLocaleString(i18n.language) })),
      };
      for (const [k, f] of FILES) files[f] = strToU8(JSON.stringify(d[k] ?? null, null, 2));
      // Photo de profil (bucket avatars, dossier de la personne) : jointe telle quelle
      if (user)
        for (const path of await listAll('avatars', user.id, 1)) {
          const { data: blob } = await supabase.storage.from('avatars').download(path);
          if (blob)
            files[`photo-de-profil.${path.split('.').pop()}`] = new Uint8Array(await blob.arrayBuffer());
        }
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
      // Confirmation passagère : un toast, jamais un texte posé dans la page
      toast(t('myData.done'));
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
      // Photo de profil effacée d'abord ; un reste éventuel est inscrit pour la purge par la base
      if (user) {
        const mine = await listAll('avatars', user.id, 1);
        if (mine.length) await supabase.storage.from('avatars').remove(mine);
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
    <>
      <section className="stg-sec st-mydata" aria-labelledby="md-title">
        <div className="stg-sec__head">
          <div>
            <h2 id="md-title">{t('myData.title')}</h2>
            <p>{t('myData.exportBody')}</p>
          </div>
          <div className="stg-sec__acts">
            <Button
              icon={<Download aria-hidden="true" />}
              disabled={exporting}
              onClick={() => void prepareExport()}
            >
              {exporting ? t('myData.preparing') : t('myData.export')}
            </Button>
          </div>
        </div>
        {exporting && <div className="st-mydata-bar" aria-hidden="true" />}
        {exportErr && (
          <p className="stg-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            {exportErr}
          </p>
        )}
      </section>
      <section className="stg-danger" aria-labelledby="md-danger">
        <div>
          <h2 id="md-danger">{t('myData.danger')}</h2>
          <p>{t('myData.deleteHelp')}</p>
        </div>
        <Button className="stg-btn-danger st-mydata-del" onClick={() => void openDelete()}>
          {t('myData.delete')}
        </Button>
      </section>

      <Modal
        open={!!check}
        onClose={() => setCheck(null)}
        size="md"
        tone={blocked ? 'default' : 'danger'}
        icon={blocked ? <UsersRound /> : <TriangleAlert />}
        title={t(blocked ? 'myData.blockedTitle' : 'myData.confirmTitle')}
        closeLabel={t('common.close')}
        className="st-mydata-dlg"
        footer={
          blocked ? (
            <Button onClick={() => setCheck(null)}>{t('common.close')}</Button>
          ) : (
            <>
              <Button onClick={() => setCheck(null)}>{t('common.cancel')}</Button>
              <Button variant="danger" type="submit" form="md-form" disabled={!ready || busy || needReauth}>
                {t('myData.deleteConfirm')}
              </Button>
            </>
          )
        }
      >
        {check && blocked ? (
          <div className="st-mydata-body">
            <p>{t('myData.blockedBody')}</p>
            <ul className="st-mydata-list">
              {check.blocking.map((w) => (
                <li key={w.id}>
                  <b>{w.name}</b>
                  <Button
                    onClick={() => {
                      select(w.id);
                      setCheck(null);
                      navigate('/settings/members');
                    }}
                  >
                    {t('myData.changeOwner')}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : check ? (
          <form
            id="md-form"
            className="st-mydata-body"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && !busy) void confirmDelete();
            }}
          >
            <p>{t('myData.confirmBody')}</p>
            {needReauth && (
              <div className="st-mydata-reauth" role="alert">
                <p className="st-mydata-warn">
                  <TriangleAlert size={16} aria-hidden="true" />
                  <span>{t('myData.errReauth')}</span>
                </p>
                <Button onClick={() => void reconnect()}>{t('myData.reconnect')}</Button>
              </div>
            )}
            {check.solo.map((w) => (
              <p key={w.id} className="st-mydata-warn st-mydata-solo" role="note">
                <TriangleAlert size={16} aria-hidden="true" />
                <span>{t('myData.soloDeleted', { name: w.name, count: w.demos })}</span>
              </p>
            ))}
            {!needReauth && (
              <>
                <div className="fd-modal__field">
                  <label htmlFor="md-email">{t('myData.email')}</label>
                  <input
                    id="md-email"
                    className="fd-input"
                    type="email"
                    autoComplete="email"
                    name="email"
                    value={email}
                    aria-describedby="md-email-h"
                    onChange={(e) => {
                      setErr(null);
                      setEmail(e.target.value);
                    }}
                  />
                  <span className="stg-help" id="md-email-h">
                    {t('myData.emailHelp', { email: user?.email ?? '' })}
                  </span>
                </div>
                {check.hasPassword && (
                  <div className="fd-modal__field">
                    <label htmlFor="md-pwd">{t('myData.password')}</label>
                    <input
                      id="md-pwd"
                      className="fd-input"
                      type="password"
                      autoComplete="current-password"
                      name="password"
                      value={password}
                      onChange={(e) => {
                        setErr(null);
                        setPassword(e.target.value);
                      }}
                    />
                  </div>
                )}
                <label className="stg-opt">
                  <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />
                  <span>{t('myData.sure')}</span>
                </label>
              </>
            )}
            {err && !needReauth && (
              <p className="stg-error" role="alert">
                <CircleAlert size={16} aria-hidden="true" />
                {err}
              </p>
            )}
          </form>
        ) : null}
      </Modal>
    </>
  );
}
