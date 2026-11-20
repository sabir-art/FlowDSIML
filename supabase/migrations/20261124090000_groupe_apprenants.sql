-- L38 paquet 2 (revue formation n° 3) : groupe (session de formation) porté par le lien personnalisé.
-- Texte libre, posé à la création du lien ou à l'import d'une liste, modifiable depuis la fiche de
-- l'apprenant (mise à jour du lien, déjà permise aux éditeurs par les politiques de share_links).
-- Pas de changement de droits : nouvelle colonne d'une table existante, mêmes politiques ; learners_progress
-- garde son contrôle (editor) et ses filtres de dossiers, et renvoie en plus le groupe du lien de chaque
-- apprenant.

alter table public.share_links
  add column if not exists cohort text not null default ''
  check (char_length(cohort) <= 80 and cohort = btrim(cohort));

create index if not exists share_links_ws_cohort_idx on public.share_links (workspace_id, cohort) where cohort <> '';

create or replace function public.learners_progress(p_workspace uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not public.has_role(p_workspace, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object(
    'paths', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'ordered', p.ordered, 'goal', p.goal,
        'modules', (select coalesce(jsonb_agg(jsonb_build_object('demoId', m.demo_id, 'title', d.title, 'required', m.required,
                       'hasQuiz', jsonb_typeof(v.manifest -> 'quiz') = 'object',
                       'threshold', coalesce((v.manifest -> 'quiz' ->> 'threshold')::int, 70)) order by m.position), '[]'::jsonb)
                    from public.path_modules m join public.demos d on d.id = m.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
                    left join public.demo_versions v on v.id = d.current_version_id
                    where m.path_id = p.id)) order by p.created_at), '[]'::jsonb)
      from public.paths p where p.workspace_id = p_workspace),
    'structures', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::jsonb)
      from public.structures s where s.workspace_id = p_workspace),
    'learners', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'email', l.email, 'name', l.full_name, 'source', l.source, 'structureId', l.structure_id,
        'createdAt', l.created_at,
        'linkId', l.share_link_id,
        'group', coalesce((select sl.cohort from public.share_links sl where sl.id = l.share_link_id), ''),
        'lastReminder', (select max(r.created_at) from public.learner_reminders r where r.learner_id = l.id),
        'modules', (select coalesce(jsonb_agg(jsonb_build_object(
            'demoId', lm.demo_id, 'total', lm.total_steps, 'seen', lm.steps_seen, 'completed', lm.completed,
            'hasQuiz', lm.has_quiz, 'best', lm.best_score, 'used', lm.attempts_used, 'max', lm.attempts_max,
            'status', lm.status, 'lastActivity', lm.last_activity)), '[]'::jsonb)
          from public.learner_modules(p_workspace) lm where lm.learner_id = l.id)
      ) order by l.created_at desc), '[]'::jsonb)
      from public.learners l where l.workspace_id = p_workspace)
  );
end $function$;
revoke all on function public.learners_progress(uuid) from public, anon;
grant execute on function public.learners_progress(uuid) to authenticated;
