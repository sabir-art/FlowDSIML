import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useToast } from './Toast';
import { Menu } from './Menu';

/** Pastille d'initiale du workspace ; teinte stable dérivée du nom (une couleur par workspace). */
const TINTS = ['ws-logo--a', 'ws-logo--b', 'ws-logo--c', 'ws-logo--d'];
function tint(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}
export function WsLogo({ name, small }: { name: string; small?: boolean }) {
  return (
    <span className={`ws-logo ${tint(name)}${small ? ' ws-logo--sm' : ''}`} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * CAD-02 : sélecteur de workspace de la maquette (bloc en haut de la barre latérale, toujours visible) :
 * pastille, nom, « Plan … · n membres », menu avec coche sur le workspace actif et « Nouveau workspace ».
 */
export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaces, current, select } = useWorkspace();
  const toast = useToast();
  const [members, setMembers] = useState<number | null>(null);

  useEffect(() => {
    if (!current) return;
    setMembers(null);
    void supabase
      .rpc('workspace_usage', { p_workspace: current.id })
      .then(({ data }) => setMembers((data as { members?: number } | null)?.members ?? null));
  }, [current]);

  if (!current) return null;
  // L48-A §1 : « Espace · n membres » (plus de nom d'offre)
  const meta = [t('nav.workspace'), members !== null ? t('nav.wsMembers', { count: members }) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="ws-wrap">
      <Menu
        label={t('nav.workspace')}
        align="start"
        custom={{
          className: 'ws-switch',
          content: (
            <>
              <WsLogo name={current.name} />
              <span className="ws-text">
                <b>{current.name}</b>
                <small>{meta}</small>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </>
          ),
        }}
        items={[
          ...workspaces.map((w) => ({
            label: w.name,
            icon: <WsLogo name={w.name} small />,
            current: w.id === current.id,
            end:
              w.id === current.id ? <Check size={16} aria-hidden="true" className="ws-check" /> : undefined,
            onSelect: () => {
              if (w.id === current.id) return;
              // Correctif client : un changement d'espace ramène toujours sur Démos du nouvel espace
              select(w.id);
              navigate('/');
              toast(t('nav.wsSwitched', { name: w.name }));
            },
          })),
          'separator' as const,
          { label: t('nav.newWorkspace'), icon: <Plus />, onSelect: () => navigate('/onboarding') },
        ]}
      />
    </div>
  );
}
