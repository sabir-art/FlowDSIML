-- L29 schéma F (validé par le chef d'équipe), revue de sécurité R1 et R2 (docs/tech/securite-revue.md).
--  * R1 : resolve_share_link ne renvoie plus l'e-mail du destinataire dans les variables du lien.
--  * R2 : learner_resume exige que l'espace autorise les liens publics, comme issue_certificate.
-- Idempotent.

create or replace function public.resolve_share_link(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object('demoId', l.demo_id, 'linkId', l.id,
                            -- R1 : jamais l'e-mail du destinataire (aucun préremplissage ne l'utilise)
                            'variables', coalesce(l.variables, '{}'::jsonb) - 'email',
                            'datasetRow', l.dataset_row)
  from public.share_links l join public.demos d on d.id = l.demo_id
  where l.token = p_token and l.is_active and (l.expires_at is null or l.expires_at > now())
    and d.status = 'published' and d.deleted_at is null;
$function$;
revoke all on function public.resolve_share_link(text) from public;
grant execute on function public.resolve_share_link(text) to anon, authenticated;

create or replace function public.learner_resume(p_link_token text, p_demo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_link public.share_links;
  l public.learners;
  v_first text;
  v_out jsonb;
begin
  select sl.* into v_link from public.share_links sl join public.demos d on d.id = sl.demo_id
    -- R2 : liens publics coupés par l'espace : même réponse vide (comme issue_certificate)
    join public.workspaces w on w.id = sl.workspace_id and w.public_links_enabled
   where sl.token = p_link_token and sl.demo_id = p_demo and sl.is_active
     and (sl.expires_at is null or sl.expires_at > now())
     and d.status = 'published' and d.deleted_at is null;
  if not found then return '{}'::jsonb; end if;
  select * into l from public.learners where share_link_id = v_link.id;
  if not found then return '{}'::jsonb; end if;
  v_first := coalesce(nullif(btrim(v_link.variables ->> 'first_name'), ''), split_part(btrim(l.full_name), ' ', 1));
  select jsonb_build_object(
    'firstName', left(coalesce(v_first, ''), 60),
    'module', (select jsonb_build_object('demoId', lm.demo_id, 'seen', lm.steps_seen, 'total', lm.total_steps, 'status', lm.status)
               from public.learner_modules(l.workspace_id) lm where lm.learner_id = l.id and lm.demo_id = p_demo),
    'path', (select jsonb_build_object('title', p.title, 'ordered', p.ordered,
                'modules', (select coalesce(jsonb_agg(jsonb_build_object('title', d.title, 'status', lm.status,
                               'seen', lm.steps_seen, 'total', lm.total_steps, 'current', m.demo_id = p_demo) order by m.position), '[]'::jsonb)
                            from public.path_modules m
                            -- Seulement les modules publiés : aucun titre de brouillon ni de démo supprimée
                            join public.demos d on d.id = m.demo_id and d.status = 'published' and d.deleted_at is null
                            left join public.learner_modules(l.workspace_id) lm on lm.learner_id = l.id and lm.demo_id = m.demo_id
                            where m.path_id = p.id))
             from public.paths p join public.path_modules pm on pm.path_id = p.id and pm.demo_id = p_demo
             order by p.created_at limit 1)
  ) into v_out;
  return v_out;
end $function$;
revoke all on function public.learner_resume(text, uuid) from public;
grant execute on function public.learner_resume(text, uuid) to anon, authenticated;
