/**
 * L41 : éléments communs de la Console propriétaire (rôle, actions en lecture seule, export CSV,
 * libellés des statuts et des priorités).
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toCsv } from '@flowdsiml/core';
import { downloadText } from '../../lib/download';
import { supabase } from '../../lib/supabase';
import { articleBySlug } from '../../help/articles';
import type { PlatformRole } from './platform';

export const RoleCtx = createContext<PlatformRole>('read_only');
export const useConsoleRole = () => useContext(RoleCtx);

export type ItemStatus = 'triage' | 'planned' | 'in_progress' | 'done' | 'rejected';
export const STATUSES: ItemStatus[] = ['triage', 'planned', 'in_progress', 'done', 'rejected'];
export type Priority = 'high' | 'medium' | 'low';
export const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

export interface Item {
  id: string;
  title: string;
  status: ItemStatus;
  priority: Priority;
  article: string | null;
  githubUrl: string | null;
  rejectReason: string | null;
  note: string;
  announced: boolean;
  feedback: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  article: string;
  page: string;
  workspace: string;
  at: string;
  text: string;
  status: 'new' | 'linked' | 'archived';
  itemId: string | null;
  itemTitle: string | null;
}

export const articleTitle = (slug: string | null | undefined) =>
  slug ? (articleBySlug(slug)?.title ?? slug) : '';
export const articleSection = (slug: string | null | undefined) =>
  slug ? (articleBySlug(slug)?.section ?? '') : '';

/** Ticket GitHub : adresse d'un ticket ou d'une demande de fusion (lien seulement, aucun appel). */
export const GITHUB_RE =
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/(issues|pull)\/(\d{1,9})$/;
export const ticketNumber = (url: string | null | undefined) =>
  url ? (GITHUB_RE.exec(url)?.[2] ?? null) : null;

/** Export CSV (« ; », UTF-8 avec BOM, dates ISO), journalisé ; jamais l'identité d'un répondant. */
export function exportCsv(name: string, action: string, headers: string[], rows: unknown[][]) {
  downloadText(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows, ';'));
  void supabase
    .rpc('console_log_event', { p_action: action, p_label: `${rows.length}` })
    .then(() => undefined);
}

/**
 * Action d'écriture : désactivée en lecture seule (aria-disabled, explication en infobulle),
 * jamais masquée.
 */
export function WriteButton({
  className = 'fd-btn',
  onClick,
  children,
  label,
  disabled,
  pressed,
}: {
  className?: string;
  onClick: () => void;
  children: ReactNode;
  label?: string;
  disabled?: boolean;
  pressed?: boolean;
}) {
  const { t } = useTranslation();
  const ro = useConsoleRole() !== 'admin';
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={ro || disabled || undefined}
      data-tip={ro ? t('console.roHint') : undefined}
      onClick={() => {
        if (!ro && !disabled) onClick();
      }}
    >
      {children}
    </button>
  );
}

/** Message d'erreur des RPC de la console, en clair. */
export function rpcError(t: (k: string) => string, message: string) {
  const code = /([A-Z_]{4,})/.exec(message)?.[1] ?? '';
  const known = ['REJECT_REASON', 'LAST_ADMIN', 'OWN_ROLE', 'ITEM_CLOSED', 'NOT_FOUND'];
  return known.includes(code) ? t(`console.err.${code}`) : t('console.err.generic');
}

/** Libellé d'une action du journal (« item.status.done » → console.action.item_status_done). */
export const actionLabel = (t: (k: string, o?: Record<string, unknown>) => string, action: string) =>
  t(`console.action.${action.replace(/\./g, '_')}`, { defaultValue: action });
