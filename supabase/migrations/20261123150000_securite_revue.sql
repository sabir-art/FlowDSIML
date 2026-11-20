-- L29 revue de sécurité (docs/tech/securite-revue.md), corrections sans changement de droits. Idempotent.
--  * R5 : les fonctions de déclencheur ne sont plus exécutables par public, anon ni authenticated
--    (appel déjà refusé par PostgreSQL hors déclencheur : hygiène).
--  * R3 : submit_lead plafonne aussi le volume par démo (300 leads par heure), car la limite par
--    visiteur repose sur un identifiant déclaré par l'appelant.

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

create or replace function public.submit_lead(p_demo uuid, p_version uuid, p_email text, p_fields jsonb DEFAULT '{}'::jsonb, p_consent boolean DEFAULT false, p_visitor text DEFAULT NULL::text, p_link_token text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
  v_link uuid;
  v_id uuid;
  v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'BAD_EMAIL'; end if;
  if pg_column_size(p_fields) > 4000 or jsonb_typeof(p_fields) <> 'object' then raise exception 'BAD_FIELDS'; end if;

  select v.workspace_id into v_ws from public.demo_versions v join public.demos d on d.id = v.demo_id
    where v.id = p_version and v.demo_id = p_demo and d.status = 'published' and d.deleted_at is null;
  if v_ws is null then raise exception 'DEMO_NOT_FOUND'; end if;
  if not coalesce((public.plan_limit(v_ws, 'lead_forms') #>> '{}')::boolean, false) then
    raise exception 'PLAN_LIMIT:lead_forms' using errcode = 'P0001';
  end if;
  -- Anti-abus minimal : 20 soumissions max par visiteur et par heure.
  if p_visitor is not null and (
    select count(*) from public.leads where visitor_id = p_visitor and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  -- Revue de sécurité R3 : plafond par démo (visitor_id est déclaré par l'appelant)
  if (select count(*) from public.leads where demo_id = p_demo and created_at > now() - interval '1 hour') >= 300 then
    raise exception 'RATE_LIMITED';
  end if;

  if p_link_token is not null then
    select id into v_link from public.share_links where token = p_link_token and demo_id = p_demo;
  end if;

  insert into public.leads (workspace_id, demo_id, version_id, link_id, visitor_id, email, fields, consent)
  values (v_ws, p_demo, p_version, v_link, left(p_visitor, 64), v_email, p_fields, p_consent)
  returning id into v_id;
  return v_id;
end $function$;
revoke all on function public.submit_lead(uuid, uuid, text, jsonb, boolean, text, text) from public;
grant execute on function public.submit_lead(uuid, uuid, text, jsonb, boolean, text, text) to anon, authenticated;
