import { useEffect, useRef } from 'preact/hooks';
import { ArrowRight, CircleCheck, Clock, Lock, Play } from 'lucide-preact';
import type { ResumeInfo } from './api';
import { fmt, type Dict } from './i18n';
import { SysFrame } from './Gate';
import { ModalBox } from './modalFocus';

/** Reprise utile : prénom connu, module commencé mais pas terminé. */
export function resumable(r: ResumeInfo | null): r is Required<Pick<ResumeInfo, 'firstName'>> & ResumeInfo {
  const m = r?.module;
  return !!r?.firstName && !!m && m.status !== 'validated' && m.seen > 0 && m.seen < m.total;
}

/**
 * L13 : « Bon retour » (maquette refonte/f3-suivi.html, état Reprise). L'apprenant identifié par son
 * lien personnalisé reprend à l'étape où il s'était arrêté, ou recommence le module.
 */
export function ResumeCard({
  t,
  info,
  title,
  workspace,
  onResume,
  onRestart,
}: {
  t: Dict;
  info: ResumeInfo;
  title: string;
  workspace: string;
  onResume: () => void;
  onRestart: () => void;
}) {
  const r = t.resume as unknown as Record<string, string>;
  const m = info.module!;
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const mods = info.path?.modules ?? [];
  const curIdx = mods.findIndex((x) => x.current);
  const moduleTitle = curIdx >= 0 ? mods[curIdx]!.title : title;
  const next = m.seen + 1;
  return (
    <SysFrame t={t} info={{ title, workspace }} label={fmt(r, 'title', { name: info.firstName! })}>
      <ModalBox class="p-card p-sys-card p-resume" labelledby="p-rs-t">
        <span class="p-resume-badge">
          <Clock size={16} aria-hidden="true" />
          {r.badge}
        </span>
        <h1 id="p-rs-t" tabIndex={-1} ref={ref}>
          {fmt(r, 'title', { name: info.firstName! })}
        </h1>
        <p class="p-sub">{fmt(r, 'where', { n: next, total: m.total, module: moduleTitle })}</p>
        <div class="p-resume-steps" role="img" aria-label={fmt(r, 'stepAria', { n: next, total: m.total })}>
          {Array.from({ length: Math.min(m.total, 30) }, (_, i) => (
            <span key={i} class={i < next ? 'on' : ''} />
          ))}
        </div>
        {mods.length > 1 && (
          <ul class="p-resume-mods" aria-label={fmt(r, 'modules', { path: info.path!.title })}>
            {mods.map((x, i) => {
              const done = x.status === 'validated';
              const locked = !done && !x.current && info.path!.ordered && i > curIdx && curIdx >= 0;
              return (
                <li key={i} class={x.current ? 'cur' : ''}>
                  <span class={`p-resume-ic${done ? ' ok' : x.current ? ' cur' : ''}`} aria-hidden="true">
                    {done ? (
                      <CircleCheck size={18} />
                    ) : x.current ? (
                      <Play size={18} />
                    ) : locked ? (
                      <Lock size={18} />
                    ) : null}
                  </span>
                  <span>
                    {i + 1} · {x.title}
                  </span>
                  <span class={`p-resume-st${done ? ' ok' : ''}`}>
                    {done
                      ? r.validated
                      : x.current
                        ? `${next} / ${m.total}`
                        : locked
                          ? fmt(r, 'after', { n: i })
                          : x.seen
                            ? `${x.seen} / ${x.total}`
                            : r.notStarted}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div class="p-resume-acts">
          <button type="button" class="p-btn p-btn-secondary" onClick={onRestart}>
            {r.restart}
          </button>
          <button type="button" class="p-btn p-btn-primary" onClick={onResume}>
            {fmt(r, 'resume', { n: next })}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </ModalBox>
    </SysFrame>
  );
}
