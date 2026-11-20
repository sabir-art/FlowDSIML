import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Tables, WorkspaceRole } from '@flowdsiml/supabase-types';
import { can as canDo, type Action } from '@flowdsiml/core';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

export type WorkspaceWithRole = Tables<'workspaces'> & { role: WorkspaceRole };

interface WorkspaceState {
  loading: boolean;
  /** Lecture des espaces en échec (réseau, serveur) : la liste est inconnue, pas vide. */
  error: boolean;
  /** Relit les espaces en repassant par l'état de chargement (bouton « Réessayer »). */
  retry: () => void;
  workspaces: WorkspaceWithRole[];
  current: WorkspaceWithRole | null;
  select: (id: string) => void;
  reload: () => Promise<void>;
  can: (action: Action) => boolean;
}

const Ctx = createContext<WorkspaceState | null>(null);
const KEY = 'fd.workspace';

function readSaved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(readSaved);

  const reload = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    const { data, error: readError } = await supabase
      .from('members')
      .select('role, workspaces(*)')
      .eq('user_id', user.id)
      .order('created_at');
    // Panne de lecture : on garde la liste connue et on le signale (jamais « aucun espace » → onboarding)
    if (readError) {
      setError(true);
      setLoading(false);
      return;
    }
    setError(false);
    const list = (data ?? [])
      .filter((m) => m.workspaces)
      .map((m) => ({ ...(m.workspaces as Tables<'workspaces'>), role: m.role }));
    setWorkspaces(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const current = useMemo(
    () => workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null,
    [workspaces, currentId],
  );

  const value: WorkspaceState = {
    loading,
    error,
    retry: () => {
      setLoading(true);
      void reload();
    },
    workspaces,
    current,
    select: (id) => {
      setCurrentId(id);
      try {
        localStorage.setItem(KEY, id);
      } catch {
        /* ignore */
      }
    },
    reload,
    can: (action) => canDo(current?.role, action),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkspace hors WorkspaceProvider');
  return ctx;
}
