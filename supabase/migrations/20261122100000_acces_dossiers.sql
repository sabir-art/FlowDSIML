-- L27-09 (123, Enterprise) : accès restreint par dossier (spec docs/ux/specs/l27-marque-regles.md §4.5).
-- Idempotent. Migration à part, relue par le chef avant déploiement.
--  * folders.restricted + folder_members : un dossier restreint n'est visible que des membres choisis ;
--    administrateurs et propriétaires y ont toujours accès. La restriction vaut pour les sous-dossiers.
--  * folder_visible(ws, folder) : stable, security definer. Chemins rapides : démo hors dossier, appel
--    sans utilisateur (lecteurs publics, service role, tâches planifiées : inchangés), espace sans dossier
--    restreint, administrateur. demo_visible(demo) : idem pour une démo.
--  * Filtrage côté serveur : politiques de lecture de demos, folders et de toutes les tables liées à une
--    démo ; RPC en security definer (analytics, apprenants, leads, temps réel, actions sur une démo)
--    redéfinies à l'identique avec le filtre (génération mécanique, voir la fin du fichier).
--  * Les liens déjà partagés restent valables : la restriction porte sur l'espace de travail, pas sur la
--    diffusion (open-demo, lecteur, page publique, centre de formation ne changent pas).

alter table public.folders add column if not exists restricted boolean not null default false;
create index if not exists folders_restricted_idx on public.folders (workspace_id) where restricted;

create table if not exists public.folder_members (
  folder_id uuid not null references public.folders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);
create index if not exists folder_members_user_idx on public.folder_members (user_id);
alter table public.folder_members enable row level security;
revoke all on public.folder_members from anon, authenticated;
grant select on public.folder_members to authenticated;
drop policy if exists folder_members_select on public.folder_members;
create policy folder_members_select on public.folder_members for select to authenticated
  using (public.has_role(workspace_id, 'admin') or user_id = (select auth.uid()));

-- Visibilité d'un dossier (et de ses sous-dossiers) pour l'utilisateur connecté
create or replace function public.folder_visible(p_ws uuid, p_folder uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_folder is null
      or (select auth.uid()) is null
      or not exists (select 1 from public.folders f where f.workspace_id = p_ws and f.restricted)
      or public.has_role(p_ws, 'admin')
      or not exists (
        with recursive anc as (
          select f.id, f.parent_id, f.restricted from public.folders f where f.id = p_folder
          union all
          select f.id, f.parent_id, f.restricted from public.folders f join anc on f.id = anc.parent_id
        )
        select 1 from anc
         where anc.restricted
           and not exists (select 1 from public.folder_members m
                            where m.folder_id = anc.id and m.user_id = (select auth.uid()))
      );
$$;
revoke all on function public.folder_visible(uuid, uuid) from public, anon;
grant execute on function public.folder_visible(uuid, uuid) to authenticated;

create or replace function public.demo_visible(p_demo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.folder_visible(d.workspace_id, d.folder_id) from public.demos d where d.id = p_demo), true);
$$;
revoke all on function public.demo_visible(uuid) from public, anon;
grant execute on function public.demo_visible(uuid) to authenticated;


-- Dossiers et démos masqués pour l'utilisateur connecté (tous ses espaces), calculés une fois par requête
-- dans les politiques et les RPC : « (select public.my_hidden_folders()) » est évalué une seule fois.
-- Vide sans utilisateur, pour les administrateurs, et dans un espace sans dossier restreint.
create or replace function public.my_hidden_folders()
returns uuid[] language sql stable security definer set search_path = '' as $$
  with recursive t as (
    select f.id from public.folders f
     where f.restricted
       and exists (select 1 from public.members m
                    where m.workspace_id = f.workspace_id and m.user_id = (select auth.uid()) and m.role < 'admin')
       and not exists (select 1 from public.folder_members fm
                        where fm.folder_id = f.id and fm.user_id = (select auth.uid()))
    union
    select c.id from public.folders c join t on c.parent_id = t.id
  )
  select coalesce(array_agg(id), '{}') from t;
$$;
revoke all on function public.my_hidden_folders() from public, anon;
grant execute on function public.my_hidden_folders() to authenticated;

create or replace function public.my_hidden_demos()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(d.id), '{}') from public.demos d
   where d.folder_id = any (public.my_hidden_folders());
$$;
revoke all on function public.my_hidden_demos() from public, anon;
grant execute on function public.my_hidden_demos() to authenticated;

-- Régler l'accès d'un dossier (administrateurs, plan Enterprise)
create or replace function public.set_folder_access(p_folder uuid, p_restricted boolean, p_users uuid[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.folders where id = p_folder;
  if v_ws is null or not public.has_role(v_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not coalesce((public.plan_limit(v_ws, 'share_rules') #>> '{}')::boolean, false) then
    raise exception 'PLAN_REQUIRED:share_rules' using errcode = 'P0001';
  end if;
  update public.folders set restricted = coalesce(p_restricted, false) where id = p_folder;
  delete from public.folder_members where folder_id = p_folder;
  if p_restricted then
    -- Seulement des membres de l'espace ; administrateurs et propriétaires ont toujours accès
    insert into public.folder_members (folder_id, user_id, workspace_id)
    select p_folder, m.user_id, v_ws from public.members m
     where m.workspace_id = v_ws and m.user_id = any (coalesce(p_users, '{}')) and m.role < 'admin'
    on conflict do nothing;
  end if;
end $$;
revoke all on function public.set_folder_access(uuid, boolean, uuid[]) from public, anon;
grant execute on function public.set_folder_access(uuid, boolean, uuid[]) to authenticated;

-- Membres qui ne verraient plus une démo déplacée dans ce dossier (confirmation avant déplacement)
create or replace function public.folder_hidden_count(p_folder uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when public.has_role(f.workspace_id, 'editor') then (
    select count(*)::int from public.members m
     where m.workspace_id = f.workspace_id and m.role < 'admin'
       and exists (
         with recursive anc as (
           select x.id, x.parent_id, x.restricted from public.folders x where x.id = p_folder
           union all
           select x.id, x.parent_id, x.restricted from public.folders x join anc on x.id = anc.parent_id
         )
         select 1 from anc where anc.restricted
           and not exists (select 1 from public.folder_members fm where fm.folder_id = anc.id and fm.user_id = m.user_id))
  ) end
  from public.folders f where f.id = p_folder;
$$;
revoke all on function public.folder_hidden_count(uuid) from public, anon;
grant execute on function public.folder_hidden_count(uuid) to authenticated;

-- Le statut restreint ne change que par set_folder_access
revoke insert, update on public.folders from authenticated;
grant insert (id, workspace_id, parent_id, name) on public.folders to authenticated;
grant update (parent_id, name) on public.folders to authenticated;

-- ===== Politiques : demos, folders et tables liées à une démo =====
do $$
declare
  p record;
begin
  -- demos : lecture, modification, suppression
  for p in select policyname, qual from pg_policies
            where schemaname = 'public' and tablename = 'demos' and cmd in ('SELECT', 'UPDATE', 'DELETE')
              and qual not like '%my_hidden%' loop
    execute format('alter policy %I on public.demos using ((%s) and (folder_id is null or not (folder_id = any ((select public.my_hidden_folders())::uuid[]))))',
                   p.policyname, p.qual);
  end loop;
  for p in select policyname, qual from pg_policies
            where schemaname = 'public' and tablename = 'folders' and cmd in ('SELECT', 'UPDATE', 'DELETE')
              and qual not like '%my_hidden%' loop
    execute format('alter policy %I on public.folders using ((%s) and not (id = any ((select public.my_hidden_folders())::uuid[])))',
                   p.policyname, p.qual);
  end loop;
  -- Tables portant demo_id : lecture (et écriture « for all », modification, suppression)
  for p in select pl.tablename, pl.policyname, pl.qual from pg_policies pl
            where pl.schemaname = 'public' and pl.cmd in ('SELECT', 'ALL', 'UPDATE', 'DELETE')
              and pl.qual is not null and pl.qual not like '%my_hidden%'
              and pl.tablename <> 'demos'
              and exists (select 1 from information_schema.columns c
                           where c.table_schema = 'public' and c.table_name = pl.tablename and c.column_name = 'demo_id') loop
    execute format('alter policy %I on public.%I using ((%s) and (demo_id is null or not (demo_id = any ((select public.my_hidden_demos())::uuid[]))))',
                   p.policyname, p.tablename, p.qual);
  end loop;
end $$;

-- ===== RPC en security definer : filtre de dossier =====
-- Redéfinitions générées mécaniquement à partir des définitions en vigueur (identiques, sauf le filtre
-- ajouté sur la lecture de la démo) : « folder_visible(…) » pour une démo lue seule, « my_hidden_folders() »
-- et « my_hidden_demos() » (calculés une fois par requête) pour les listes et les agrégats.
-- Exclues : lecteurs publics et service (public_page, personal_page, resolve_share_link, submit_lead,
-- track_events, submit_quiz_attempt, learner_resume, issue_certificate, demo_gate, finalize_publication),
-- workspace_onboarding (indicateurs oui/non) et session_visits (numéros de visite de sessions déjà
-- filtrées par workspace_sessions).

-- ab_end(p_test uuid, p_keep text)
CREATE OR REPLACE FUNCTION public.ab_end(p_test uuid, p_keep text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t public.ab_tests;
begin
  select * into t from public.ab_tests where id = p_test and public.demo_visible(demo_id) for update;
  if t.id is null or not public.has_role(t.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if t.status <> 'running' then raise exception 'AB_NOT_RUNNING' using errcode = 'P0001'; end if;
  if p_keep is not null and p_keep not in ('A', 'B') then raise exception 'AB_BAD_KEEP' using errcode = 'P0001'; end if;
  if p_keep = 'B' and t.hotspot_id is not null then
    update public.hotspots set
      title = left(coalesce(t.variant_b ->> 'title', ''), 200),
      body = left(coalesce(t.variant_b ->> 'body', ''), 4000),
      cta = case when jsonb_typeof(t.variant_b -> 'cta') = 'object' then t.variant_b -> 'cta' end
    where id = t.hotspot_id;
  end if;
  update public.ab_tests set status = case when p_keep is null then 'stopped' else 'ended' end,
    kept = p_keep, ended_at = now() where id = p_test;
  update public.demos set updated_at = now() where id = t.demo_id;
end $function$;

-- ab_results(p_test uuid, p_goal text)
CREATE OR REPLACE FUNCTION public.ab_results(p_test uuid, p_goal text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t public.ab_tests;
  v_goal text;
begin
  select * into t from public.ab_tests where id = p_test and public.demo_visible(demo_id);
  if t.id is null or not public.has_role(t.workspace_id, 'viewer') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_goal := coalesce(p_goal, t.goal);
  if v_goal not in ('completion', 'cta', 'lead') then raise exception 'AB_BAD_GOAL' using errcode = 'P0001'; end if;
  return (
    with ev as (
      select e.visitor_id, e.props ->> 'abv' as v, e.type
      from public.events e
      where e.demo_id = t.demo_id and e.props ->> 'abt' = t.id::text and e.props ->> 'abv' in ('A', 'B')
        and e.occurred_at >= t.started_at and (t.ended_at is null or e.occurred_at <= t.ended_at)
    ), per as (
      select v, count(distinct visitor_id) as visitors,
        count(distinct visitor_id) filter (where type = case v_goal
          when 'completion' then 'demo_complete' when 'cta' then 'cta_click' else 'form_submit' end) as reached
      from ev group by v
    )
    select jsonb_build_object('goal', v_goal,
      'A', coalesce((select jsonb_build_object('visitors', visitors, 'reached', reached) from per where v = 'A'),
                    '{"visitors": 0, "reached": 0}'::jsonb),
      'B', coalesce((select jsonb_build_object('visitors', visitors, 'reached', reached) from per where v = 'B'),
                    '{"visitors": 0, "reached": 0}'::jsonb))
  );
end $function$;

-- ab_start(p_hotspot uuid, p_label text)
CREATE OR REPLACE FUNCTION public.ab_start(p_hotspot uuid, p_label text DEFAULT 'Variante B'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h public.hotspots;
  s public.steps;
  v_n int;
  v_id uuid;
begin
  select * into h from public.hotspots where id = p_hotspot;
  if h.id is null or not public.has_role(h.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select * into s from public.steps where id = h.step_id;
  if s.kind <> 'image' or s.image_path is null then raise exception 'AB_STEP_KIND' using errcode = 'P0001'; end if;
  perform 1 from public.demos where id = s.demo_id and public.folder_visible(workspace_id, folder_id) for update;
  select n into v_n from (
    select row_number() over (order by st.position, st.created_at) as n, st.id
    from public.steps st where st.demo_id = s.demo_id
  ) x join public.ab_tests t on t.step_id = x.id and t.status = 'running';
  if v_n is not null then raise exception 'AB_ALREADY_RUNNING:%', v_n using errcode = 'P0001'; end if;
  insert into public.ab_tests (workspace_id, demo_id, step_id, hotspot_id, label_b, variant_b)
  values (h.workspace_id, s.demo_id, s.id, h.id, left(coalesce(nullif(btrim(p_label), ''), 'Variante B'), 40),
          jsonb_build_object('title', h.title, 'body', h.body, 'cta', h.cta))
  returning id into v_id;
  update public.demos set updated_at = now() where id = s.demo_id;
  return v_id;
end $function$;

-- ab_update(p_test uuid, p_label text, p_b jsonb, p_split integer, p_goal text)
CREATE OR REPLACE FUNCTION public.ab_update(p_test uuid, p_label text DEFAULT NULL::text, p_b jsonb DEFAULT NULL::jsonb, p_split integer DEFAULT NULL::integer, p_goal text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t public.ab_tests;
  v_fields text[] := '{}';
  v_b jsonb;
begin
  select * into t from public.ab_tests where id = p_test and public.demo_visible(demo_id) for update;
  if t.id is null or not public.has_role(t.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if t.status <> 'running' then raise exception 'AB_NOT_RUNNING' using errcode = 'P0001'; end if;
  if p_b is not null then
    if jsonb_typeof(p_b) <> 'object' then raise exception 'AB_BAD_VARIANT' using errcode = 'P0001'; end if;
    v_b := t.variant_b;
    if p_b ? 'title' then v_b := jsonb_set(v_b, '{title}', to_jsonb(coalesce(p_b ->> 'title', ''))); v_fields := array_append(v_fields, 'title'); end if;
    if p_b ? 'body' then v_b := jsonb_set(v_b, '{body}', to_jsonb(coalesce(p_b ->> 'body', ''))); v_fields := array_append(v_fields, 'body'); end if;
    if p_b ? 'cta' then v_b := jsonb_set(v_b, '{cta}', coalesce(p_b -> 'cta', 'null'::jsonb)); v_fields := array_append(v_fields, 'cta'); end if;
  end if;
  update public.ab_tests set
    variant_b = coalesce(v_b, variant_b),
    label_b = coalesce(left(nullif(btrim(p_label), ''), 40), label_b),
    split_b = coalesce(p_split, split_b),
    goal = coalesce(p_goal, goal),
    -- 100 entrées au plus : les plus anciennes sortent
    history = case when cardinality(v_fields) > 0 then
      (select jsonb_agg(x.e order by x.i) from jsonb_array_elements(
         history || jsonb_build_array(jsonb_build_object('at', now(), 'by', (select auth.uid()), 'fields', to_jsonb(v_fields))))
         with ordinality as x(e, i)
       where x.i > jsonb_array_length(history) + 1 - 100)
      else history end
  where id = p_test;
  if v_b is not null or p_split is not null then
    update public.demos set updated_at = now() where id = t.demo_id;
  end if;
end $function$;

-- choice_results(p_demo uuid, p_from timestamp with time zone, p_to timestamp with time zone)
CREATE OR REPLACE FUNCTION public.choice_results(p_demo uuid, p_from timestamp with time zone DEFAULT (now() - '30 days'::interval), p_to timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id);
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    with c as (
      select e.step_id, e.props ->> 'choice' as label, e.visitor_id
      from public.events e
      where e.demo_id = p_demo and e.type = 'hotspot_click' and e.props ? 'choice'
        and e.occurred_at between p_from and p_to
    ), done as (
      select distinct visitor_id from public.events
      where demo_id = p_demo and type = 'demo_complete' and occurred_at between p_from and p_to
    )
    select jsonb_agg(jsonb_build_object('stepId', step_id, 'choices', choices))
    from (select step_id, jsonb_agg(jsonb_build_object('label', label, 'visitors', n, 'completed', k) order by n desc) as choices
          from (select c.step_id, c.label, count(distinct c.visitor_id) as n,
                       count(distinct c.visitor_id) filter (where c.visitor_id in (select visitor_id from done)) as k
                from c group by 1, 2) x
          group by step_id) y), '[]'::jsonb);
end $function$;

-- default_style_impact(p_ws uuid)
CREATE OR REPLACE FUNCTION public.default_style_impact(p_ws uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when public.has_role(p_ws, 'viewer') then (
    select count(*)::int from public.demos d
     where d.workspace_id = p_ws and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[])) and d.theme_id is null
       and not coalesce(d.settings -> 'theme' ? 'primary', false)
  ) end;
$function$;

-- demo_analytics(p_demo uuid, p_from timestamp with time zone, p_to timestamp with time zone)
CREATE OR REPLACE FUNCTION public.demo_analytics(p_demo uuid, p_from timestamp with time zone DEFAULT (now() - '30 days'::interval), p_to timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ws uuid;
begin
  select workspace_id into ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id);
  if ws is null or not public.has_role(ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (
    with e as (
      select * from public.events where demo_id = p_demo and occurred_at >= p_from and occurred_at <= p_to
    ), v as (
      select *, case when link_id is not null then 'link' when embed_origin is not null then 'embed' else 'direct' end as source
      from e where type = 'demo_view'
    )
    select jsonb_build_object(
      'views', (select count(*) from v),
      'visitors', (select count(distinct visitor_id) from v),
      'completions', (select count(distinct session_id) from e where type = 'demo_complete'),
      'ctaClicks', (select count(*) from e where type = 'cta_click'),
      'leads', (select count(*) from public.leads l where l.demo_id = p_demo and l.created_at >= p_from and l.created_at <= p_to),
      'steps', coalesce((select jsonb_agg(jsonb_build_object('stepIndex', step_index, 'visitors', c) order by step_index)
                from (select step_index, count(distinct visitor_id) c from e where type = 'step_view' and step_index is not null group by step_index) x), '[]'::jsonb),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', dday, 'views', c, 'visitors', u) order by dday)
                from (select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as dday, count(*) c, count(distinct visitor_id) u
                      from v group by 1) y), '[]'::jsonb),
      'sources', jsonb_build_object(
        'direct', (select count(*) from v where source = 'direct'),
        'embed', (select count(*) from v where source = 'embed'),
        'link', (select count(*) from v where source = 'link'))
    )
  );
end $function$;

-- demo_embed_views(p_demo uuid)
CREATE OR REPLACE FUNCTION public.demo_embed_views(p_demo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id);
  if v_ws is null or not public.has_role(v_ws, 'viewer') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('origin', origin, 'views', views, 'last_at', last_at) order by views desc)
      from (
        select e.embed_origin as origin, count(*)::int as views, max(e.occurred_at) as last_at
          from public.events e
         where e.demo_id = p_demo and e.type = 'demo_view' and e.embed_origin is not null
           and e.occurred_at > now() - interval '90 days'
         group by e.embed_origin
         order by count(*) desc
         limit 20
      ) s
  ), '[]'::jsonb);
end $function$;

-- demo_workspace(p_demo uuid)
CREATE OR REPLACE FUNCTION public.demo_workspace(p_demo uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select workspace_id from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id);
$function$;

-- duplicate_demo(p_demo uuid)
CREATE OR REPLACE FUNCTION public.duplicate_demo(p_demo uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.demos;
  v_new uuid := gen_random_uuid();
begin
  select * into d from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id) and deleted_at is null;
  if d.id is null or not public.has_role(d.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;

  insert into public.demos (id, workspace_id, folder_id, title, theme_id, settings, cover_path, created_by)
  values (v_new, d.workspace_id, d.folder_id, left(d.title || ' (copie)', 160), d.theme_id, d.settings, d.cover_path, (select auth.uid()));

  drop table if exists pg_temp._map;
  create temp table _map (old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _map select id, gen_random_uuid() from public.chapters where demo_id = p_demo;
  insert into public.chapters (id, demo_id, workspace_id, title, position)
    select m.new_id, v_new, d.workspace_id, c.title, c.position from public.chapters c join _map m on m.old_id = c.id;

  insert into _map select id, gen_random_uuid() from public.forms where demo_id = p_demo;
  insert into public.forms (id, workspace_id, demo_id, title, description, submit_label, fields, consent_text, skippable)
    select m.new_id, f.workspace_id, v_new, f.title, f.description, f.submit_label, f.fields, f.consent_text, f.skippable
    from public.forms f join _map m on m.old_id = f.id;

  insert into _map select id, gen_random_uuid() from public.steps where demo_id = p_demo;
  insert into public.steps (id, demo_id, workspace_id, position, chapter_id, kind, image_path, image_width, image_height,
                            snapshot_path, title, body, zoom, blurs, gate_form_id, cta, page_url, page_title, element_meta, options,
                            before_image_path, before_image_width, before_image_height, before_blurs)
    select m.new_id, v_new, d.workspace_id, s.position, mc.new_id, s.kind, s.image_path, s.image_width, s.image_height,
           s.snapshot_path, s.title, s.body, s.zoom, s.blurs, mf.new_id, s.cta, s.page_url, s.page_title, s.element_meta,
           -- les choix de parcours (F1) pointent vers les nouvelles étapes et les nouveaux chapitres
           case when jsonb_typeof(s.options -> 'choices') = 'array' then jsonb_set(s.options, '{choices}', coalesce((
             select jsonb_agg(case
               when c -> 'action' ->> 'type' = 'goto' then jsonb_set(c, '{action,stepId}', to_jsonb(coalesce(
                 (select g.new_id::text from _map g where g.old_id::text = c -> 'action' ->> 'stepId'), c -> 'action' ->> 'stepId')))
               when c -> 'action' ->> 'type' = 'chapter' then jsonb_set(c, '{action,chapterId}', to_jsonb(coalesce(
                 (select g.new_id::text from _map g where g.old_id::text = c -> 'action' ->> 'chapterId'), c -> 'action' ->> 'chapterId')))
               else c end order by ord)
             from jsonb_array_elements(s.options -> 'choices') with ordinality as x(c, ord)), '[]'::jsonb))
           else s.options end,
           -- L17 : capture « Avant » (même fichier, comme image_path)
           s.before_image_path, s.before_image_width, s.before_image_height, s.before_blurs
    from public.steps s join _map m on m.old_id = s.id
    left join _map mc on mc.old_id = s.chapter_id
    left join _map mf on mf.old_id = s.gate_form_id;

  -- L17 : origine « Étape n » d'une capture Avant / Après : vers la nouvelle étape
  update public.steps ns set options = jsonb_set(ns.options, array['beforeAfter', 'sources', k, 'stepId'], to_jsonb(g.new_id::text))
    from (values ('before'), ('after')) as side(k), _map g
    where ns.demo_id = v_new and ns.options #>> array['beforeAfter', 'sources', side.k, 'kind'] = 'step'
      and g.old_id::text = ns.options #>> array['beforeAfter', 'sources', side.k, 'stepId'];

  insert into public.hotspots (step_id, demo_id, workspace_id, x, y, w, h, title, body, placement, action, cta, pulse, position, style)
    select m.new_id, v_new, d.workspace_id, h.x, h.y, h.w, h.h, h.title, h.body, h.placement,
           -- les cibles "goto" pointent vers les nouvelles étapes
           case when h.action ->> 'type' = 'goto'
             then jsonb_build_object('type', 'goto', 'stepId', coalesce((select g.new_id::text from _map g where g.old_id::text = h.action ->> 'stepId'), h.action ->> 'stepId'))
             else h.action end,
           h.cta, h.pulse, h.position, h.style
    from public.hotspots h join _map m on m.old_id = h.step_id;

  -- F2 : questions du quiz, étapes liées remappées
  insert into public.quiz_questions (demo_id, workspace_id, position, type, prompt, answers, explanation, step_id, points)
    select v_new, d.workspace_id, q.position, q.type, q.prompt, q.answers, q.explanation, ms.new_id, q.points
    from public.quiz_questions q left join _map ms on ms.old_id = q.step_id
    where q.demo_id = p_demo;

  return v_new;
end $function$;

-- glossary_usage(p_ws uuid)
CREATE OR REPLACE FUNCTION public.glossary_usage(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    with dm as (
      select public.demo_text(d.id) as txt from public.demos d
      where d.workspace_id = p_ws and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[])) and d.status = 'published'
    )
    select jsonb_agg(jsonb_build_object('id', g.id,
             'modules', (select count(*) from dm where public.glossary_in_text(dm.txt, g.term, g.forms))))
    from public.glossary_terms g where g.workspace_id = p_ws), '[]'::jsonb);
end $function$;

-- grant_quiz_attempt(p_learner uuid, p_demo uuid)
CREATE OR REPLACE FUNCTION public.grant_quiz_attempt(p_learner uuid, p_demo uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_ws uuid; n int;
begin
  select workspace_id into v_ws from public.learners where id = p_learner;
  if v_ws is null or not public.has_role(v_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if not exists (select 1 from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id) and workspace_id = v_ws) then raise exception 'DEMO_NOT_FOUND'; end if;
  insert into public.learner_overrides (learner_id, demo_id, workspace_id, extra_attempts) values (p_learner, p_demo, v_ws, 1)
  on conflict (learner_id, demo_id) do update set extra_attempts = least(public.learner_overrides.extra_attempts + 1, 20)
  returning extra_attempts into n;
  return n;
end $function$;

-- learner_detail(p_learner uuid)
CREATE OR REPLACE FUNCTION public.learner_detail(p_learner uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_ws uuid;
begin
  select workspace_id into v_ws from public.learners where id = p_learner;
  if v_ws is null or not public.has_role(v_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object(
    'events', (select coalesce(jsonb_agg(x order by x ->> 'at' desc), '[]'::jsonb) from (
      select jsonb_build_object('type', e.type, 'demoId', e.demo_id, 'stepIndex', e.step_index, 'at', e.occurred_at) as x
      from public.events e join public.learner_visitors lv on lv.workspace_id = e.workspace_id and lv.visitor_id = e.visitor_id
      where lv.learner_id = p_learner and e.type in ('demo_view', 'demo_complete', 'form_submit') and not (e.demo_id = any ((select public.my_hidden_demos())::uuid[]))
      order by e.occurred_at desc limit 100) t),
    'attempts', (select coalesce(jsonb_agg(jsonb_build_object('demoId', q.demo_id, 'score', q.score, 'passed', q.passed,
        'correct', q.correct, 'total', q.total, 'answers', q.answers, 'at', q.created_at) order by q.created_at desc), '[]'::jsonb)
      from public.quiz_attempts q join public.learner_visitors lv on lv.workspace_id = q.workspace_id and lv.visitor_id = q.visitor_id
      where lv.learner_id = p_learner and not (q.demo_id = any ((select public.my_hidden_demos())::uuid[]))),
    'reminders', (select coalesce(jsonb_agg(r.created_at order by r.created_at desc), '[]'::jsonb)
      from public.learner_reminders r where r.learner_id = p_learner)
  );
end $function$;

-- learners_progress(p_workspace uuid)
CREATE OR REPLACE FUNCTION public.learners_progress(p_workspace uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

-- live_demo(p_demo uuid)
CREATE OR REPLACE FUNCTION public.live_demo(p_demo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
  v_named boolean;
  v_day timestamptz := (date_trunc('day', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris';
begin
  select workspace_id into v_ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id) and deleted_at is null;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  -- Identité (apprenant, e-mail du lead) : editor et plus, comme les RLS leads et learners
  v_named := public.has_role(v_ws, 'editor');
  return (
    with last as (
      select distinct on (e.visitor_id) e.visitor_id, e.occurred_at, e.step_id, e.step_index, e.device, e.country, e.type,
        min(e.occurred_at) over (partition by e.visitor_id) as since
      from public.events e
      where e.demo_id = p_demo and e.occurred_at > now() - interval '5 minutes'
      order by e.visitor_id, e.occurred_at desc
    ), top as (
      select * from last order by occurred_at desc limit 20
    )
    select jsonb_build_object(
      'kpis', jsonb_build_object(
        'live', (select count(*) from last),
        'views30', (select count(*) from public.events where demo_id = p_demo and type = 'demo_view'
                      and occurred_at > now() - interval '30 minutes'),
        'ctaToday', (select count(*) from public.events where demo_id = p_demo and type = 'cta_click' and occurred_at >= v_day),
        'leadsToday', (select count(*) from public.leads where demo_id = p_demo and created_at >= v_day)),
      'stepsTotal', (select count(*) from public.steps where demo_id = p_demo),
      'more', greatest((select count(*) from last) - 20, 0),
      'visitors', coalesce((select jsonb_agg(jsonb_build_object(
          'key', left(md5(t.visitor_id), 10),
          'lastAt', t.occurred_at, 'since', t.since, 'stepIndex', t.step_index,
          'stepTitle', (select nullif(st.title, '') from public.steps st where st.demo_id = p_demo and st.id::text = t.step_id),
          'device', t.device, 'country', t.country, 'lastType', t.type,
          -- L19-01 : le visiteur est-il un apprenant suivi ? (sans nom ni e-mail pour les rôles sans suivi
          -- nominatif) ; structure de l'apprenant seulement pour les rôles avec suivi nominatif
          'learner', exists (select 1 from public.learner_visitors lv
                               where lv.workspace_id = v_ws and lv.visitor_id = t.visitor_id),
          'structure', case when v_named then
              (select s.name from public.learner_visitors lv
                 join public.learners l on l.id = lv.learner_id
                 join public.structures s on s.id = l.structure_id
                 where lv.workspace_id = v_ws and lv.visitor_id = t.visitor_id limit 1) end,
          'identity', case when v_named then coalesce(
              (select coalesce(nullif(l.full_name, ''), l.email) from public.learner_visitors lv
                 join public.learners l on l.id = lv.learner_id
                 where lv.workspace_id = v_ws and lv.visitor_id = t.visitor_id),
              (select ld.email from public.leads ld where ld.demo_id = p_demo and ld.visitor_id = t.visitor_id
                 order by ld.created_at desc limit 1)) end)
        order by t.occurred_at desc) from top t), '[]'::jsonb)
    )
  );
end $function$;

-- live_visits(p_demo uuid)
CREATE OR REPLACE FUNCTION public.live_visits(p_demo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id) and deleted_at is null;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if not coalesce((select visit_measure from public.workspaces where id = v_ws), false) then
    return '{}'::jsonb;
  end if;
  return coalesce((
    with live as (
      select distinct on (e.visitor_id) e.visitor_id, e.session_id,
        private.visitor_key(v_ws, e.visitor_id) as vkey
      from public.events e
      where e.demo_id = p_demo and e.occurred_at > now() - interval '5 minutes' and e.visitor_id not like 's:%'
      order by e.visitor_id, e.occurred_at desc
    )
    select jsonb_object_agg(left(md5(l.visitor_id), 10), vs.visit_no)
    from live l
    join private.visit_sessions(v_ws, (select array_agg(distinct vkey) from live)) vs
      on vs.session_id = l.session_id and vs.visitor_key = l.vkey), '{}'::jsonb);
end $function$;

-- media_usage(p_ws uuid)
CREATE OR REPLACE FUNCTION public.media_usage(p_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'demos', (
      select count(*) from public.demos d
      where d.workspace_id = p_ws and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
        and (strpos(d.settings::text, m.path) > 0
             or exists (select 1 from public.steps s where s.demo_id = d.id and strpos(s.options::text, m.path) > 0)))))
    from public.media_files m where m.workspace_id = p_ws), '[]'::jsonb);
end $function$;

-- present_remote_start(p_demo uuid)
CREATE OR REPLACE FUNCTION public.present_remote_start(p_demo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
  v_code text := private.remote_code();
  r public.present_remotes;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id) and deleted_at is null;
  if v_ws is null or not public.has_role(v_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  update public.present_remotes set ended_at = now(), code_hash = null, token_hash = null
    where owner = auth.uid() and demo_id = p_demo and ended_at is null;
  insert into public.present_remotes (workspace_id, demo_id, owner, code_hash, code_expires_at, channel_key)
  values (v_ws, p_demo, auth.uid(), private.sha(v_code), now() + interval '5 minutes',
          encode(extensions.gen_random_bytes(16), 'hex'))
  returning * into r;
  return jsonb_build_object('id', r.id, 'code', v_code, 'codeExpiresAt', r.code_expires_at,
                            'channel', r.channel_key, 'expiresAt', r.expires_at);
end $function$;

-- publish_demo(p_demo uuid, p_ack jsonb)
CREATE OR REPLACE FUNCTION public.publish_demo(p_demo uuid, p_ack jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.demos;
  ws public.workspaces;
  lim jsonb;
  n_published bigint;
  v_number int;
  v_id uuid := gen_random_uuid();
  v_theme jsonb;
  v_steps jsonb;
  v_copies jsonb;
  v_forms jsonb;
  v_manifest jsonb;
  lead_forms boolean;
  v_ack jsonb;
  v_quiz jsonb;
  v_bad int;
  v_ba int;
  v_glossary jsonb;
  v_dataset jsonb;
  v_ab jsonb;
  v_video int;
  v_html int;
begin
  select * into d from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id) and deleted_at is null;
  if d.id is null then raise exception 'DEMO_NOT_FOUND'; end if;
  if not public.has_role(d.workspace_id, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select * into ws from public.workspaces where id = d.workspace_id;
  select limits into lim from public.plans where code = ws.plan_code;

  if d.status <> 'published' then
    select count(*) into n_published from public.demos
      where workspace_id = d.workspace_id and status = 'published' and deleted_at is null;
    if public.limit_reached(d.workspace_id, 'published_demos', n_published) then
      raise exception 'PLAN_LIMIT:published_demos' using errcode = 'P0001';
    end if;
  end if;

  if not exists (select 1 from public.steps where demo_id = p_demo) then
    raise exception 'DEMO_EMPTY';
  end if;

  -- L17 : une étape Avant / Après n'est publiable qu'avec ses deux captures
  select min(n) into v_ba from (
    select row_number() over (order by s.position, s.created_at) as n, s.*
    from public.steps s where s.demo_id = p_demo
  ) x
  where x.kind::text = 'before_after' and (x.image_path is null or x.before_image_path is null);
  if v_ba is not null then
    raise exception 'BEFORE_AFTER_INCOMPLETE:%', v_ba using errcode = 'P0001';
  end if;

  -- F7 : une étape vidéo n'est publiable qu'avec son fichier et sa durée
  select min(n) into v_video from (
    select row_number() over (order by s.position, s.created_at) as n, s.*
    from public.steps s where s.demo_id = p_demo
  ) x
  where x.kind::text = 'video' and (x.video_path is null or x.video_duration_ms is null);
  if v_video is not null then
    raise exception 'VIDEO_MISSING:%', v_video using errcode = 'P0001';
  end if;

  -- A8 : une étape HTML n'est publiable qu'avec sa page capturée
  select min(n) into v_html from (
    select row_number() over (order by s.position, s.created_at) as n, s.*
    from public.steps s where s.demo_id = p_demo
  ) x
  where x.kind::text = 'html' and x.html_path is null;
  if v_html is not null then
    raise exception 'HTML_MISSING:%', v_html using errcode = 'P0001';
  end if;

  -- F2 : quiz du module (après la dernière étape). Publication bloquée tant qu'une question est invalide.
  select min(n) into v_bad from (
    select row_number() over (order by q.position, q.created_at) as n, q.*
    from public.quiz_questions q where q.demo_id = p_demo
  ) x
  where btrim(x.prompt) = ''
     -- L19 : note de 0 à 10 et réponse écrite, en mode Sondage seulement, sans choix de réponse
     or (x.type in ('nps', 'text') and coalesce(d.settings -> 'quiz' ->> 'mode', 'quiz') <> 'survey')
     or (x.type not in ('nps', 'text') and (jsonb_array_length(x.answers) < 2
       or exists (select 1 from jsonb_array_elements(x.answers) a where btrim(coalesce(a ->> 'label', '')) = '')
       or (coalesce(d.settings -> 'quiz' ->> 'mode', 'quiz') = 'quiz'
           and not exists (select 1 from jsonb_array_elements(x.answers) a where coalesce((a ->> 'correct')::boolean, false)))));
  if v_bad is not null then
    raise exception 'QUIZ_INVALID:%', v_bad using errcode = 'P0001';
  end if;
  select case when count(*) = 0 then null else jsonb_build_object(
      'mode', case when d.settings -> 'quiz' ->> 'mode' = 'survey' then 'survey' else 'quiz' end,
      'threshold', least(greatest(coalesce((d.settings -> 'quiz' ->> 'threshold')::int, 70), 0), 100),
      'attempts', least(greatest(coalesce((d.settings -> 'quiz' ->> 'attempts')::int, 3), 0), 5),
      'feedback', case when d.settings -> 'quiz' ->> 'feedback' = 'end' then 'end' else 'each' end,
      'shuffle', coalesce((d.settings -> 'quiz' ->> 'shuffle')::boolean, true),
      'required', coalesce((d.settings -> 'quiz' ->> 'required')::boolean, true),
      'questions', jsonb_agg(jsonb_build_object(
        'id', q.id::text, 'type', q.type, 'prompt', q.prompt, 'answers', q.answers,
        'explanation', q.explanation, 'stepId', q.step_id::text, 'points', q.points
      ) order by q.position, q.created_at)) end
  into v_quiz from public.quiz_questions q where q.demo_id = p_demo;

  -- F1 : liens publics désactivables par workspace (désactivés par défaut pour les nouveaux).
  -- Toute publication est publique tant que les modes restreints (F3) n'existent pas.
  if not ws.public_links_enabled then
    raise exception 'PUBLIC_DISABLED' using errcode = 'P0001';
  end if;
  -- F1 : avertissement RGPD confirmé à chaque publication publique (deux cases), journalisé
  if p_ack is null or not coalesce((p_ack ->> 'reviewed')::boolean, false)
     or not coalesce((p_ack ->> 'fictional')::boolean, false) then
    raise exception 'GDPR_ACK_REQUIRED' using errcode = 'P0001';
  end if;
  -- Bilan calculé côté serveur (zones floutées, détections laissées non floutées par étape)
  with st as (
    select row_number() over (order by s.position, s.created_at) as n, s.blurs, s.before_blurs, s.element_meta -> 'pii' as pii
    from public.steps s where s.demo_id = p_demo
  )
  select jsonb_build_object(
    'by', (select auth.uid()),
    'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'reviewed', true,
    'fictional', true,
    'blurred', coalesce(sum(
      case when jsonb_typeof(st.blurs) = 'array' then jsonb_array_length(st.blurs) else 0 end
      -- L17 : zones floutées de la capture « Avant », comptées comme celles de l'étape
      + case when jsonb_typeof(st.before_blurs) = 'array' then jsonb_array_length(st.before_blurs) else 0 end
      + case when jsonb_typeof(st.pii) = 'array'
          then (select count(*) from jsonb_array_elements(st.pii) p where coalesce((p ->> 'blurred')::boolean, false))
          else 0 end), 0),
    'pendingSteps', coalesce(jsonb_agg(st.n order by st.n) filter (where jsonb_typeof(st.pii) = 'array'
      and exists (select 1 from jsonb_array_elements(st.pii) p where not coalesce((p ->> 'blurred')::boolean, false))), '[]'::jsonb))
  into v_ack from st;
  -- L25-09 : le bilan RGPD compte le jeu de données publié (lignes et colonnes liées)
  v_ack := v_ack || coalesce((select jsonb_build_object('dataset', jsonb_build_object(
      'rows', jsonb_array_length(ds.rows),
      'columns', (select count(*) from jsonb_array_elements_text(ds.columns) x(c)
                  where x.c = ds.link_column
                     or exists (select 1 from jsonb_array_elements(ds.bindings) b where b ->> 'column' = x.c))))
    from public.demo_datasets ds where ds.demo_id = p_demo), '{}'::jsonb);

  lead_forms := coalesce((lim ->> 'lead_forms')::boolean, false);

  select coalesce(max(number), 0) + 1 into v_number from public.demo_versions where demo_id = p_demo;

  -- Thème : thème choisi (ou défaut du workspace) + surcharges de la démo
  select coalesce(t.tokens, '{}'::jsonb) into v_theme from public.themes t
    where t.id = coalesce(d.theme_id, (select id from public.themes where workspace_id = d.workspace_id and is_default limit 1));
  v_theme := coalesce(v_theme, '{}'::jsonb) || coalesce(d.settings -> 'theme', '{}'::jsonb);
  v_theme := v_theme || jsonb_build_object(
    'showBranding', not coalesce((lim ->> 'remove_branding')::boolean, false) or coalesce((v_theme ->> 'showBranding')::boolean, true)
  );

  with s as (
    select st.*, row_number() over (order by st.position, st.created_at) - 1 as idx,
      case when st.image_path is not null
        then 'assets/' || st.id || '-' || md5(st.image_path) || '.webp' end as pub_path,
      case when st.kind::text = 'before_after' and st.before_image_path is not null
        then 'assets/' || st.id || '-b-' || md5(st.before_image_path) || '.webp' end as before_pub_path,
      case when st.kind::text = 'video' and st.video_path is not null
        then 'assets/' || st.id || '-v-' || md5(st.video_path) || '.webm' end as video_pub_path,
      case when st.kind::text = 'html' and st.html_path is not null
        then 'assets/' || st.id || '-h-' || md5(st.html_path) || '.html' end as html_pub_path,
      -- L25-01 : capture pleine page (animation de défilement), copiée comme l'image de l'étape
      case when st.image_path is not null and st.options #>> '{fullPage,path}' is not null
        then 'assets/' || st.id || '-p-' || md5(st.options #>> '{fullPage,path}') || '.webp' end as full_pub_path
    from public.steps st where st.demo_id = p_demo
  )
  select
    jsonb_agg(jsonb_build_object(
      'id', s.id::text,
      'chapterId', s.chapter_id::text,
      'kind', s.kind,
      'image', case when s.pub_path is not null then jsonb_build_object(
        'url', s.pub_path, 'width', coalesce(s.image_width, 1280), 'height', coalesce(s.image_height, 800)) end,
      'snapshotUrl', null,
      'title', s.title,
      'body', s.body,
      'blurs', s.blurs,
      -- L17 : capture « Avant » et ses zones floutées (traitées comme blurs : incrustées à la publication)
      'beforeAfter', case when s.before_pub_path is not null then jsonb_build_object(
        'layout', coalesce(s.options #>> '{beforeAfter,layout}', 'side'),
        'labels', jsonb_build_object(
          'before', left(coalesce(s.options #>> '{beforeAfter,labels,before}', ''), 20),
          'after', left(coalesce(s.options #>> '{beforeAfter,labels,after}', ''), 20)),
        'notes', jsonb_build_object(
          'before', left(coalesce(s.options #>> '{beforeAfter,notes,before}', ''), 140),
          'after', left(coalesce(s.options #>> '{beforeAfter,notes,after}', ''), 140)),
        'before', jsonb_build_object('url', s.before_pub_path,
          'width', coalesce(s.before_image_width, 1280), 'height', coalesce(s.before_image_height, 800)),
        'beforeBlurs', s.before_blurs) end,
      -- F7 : vidéo de l'onglet (coupes, pauses-étapes, sous-titres) et image de chaque pause
      'video', case when s.video_pub_path is not null then jsonb_build_object(
        'url', s.video_pub_path,
        'durationMs', s.video_duration_ms,
        'cuts', coalesce(s.video -> 'cuts', '[]'::jsonb),
        'pauses', coalesce(s.video -> 'pauses', '[]'::jsonb),
        'captions', coalesce(s.video -> 'captions', '[]'::jsonb),
        'captionsDefault', coalesce((s.video ->> 'captionsDefault')::boolean, coalesce((s.video ->> 'hasVoice')::boolean, false)),
        'autoplayMuted', coalesce((s.video ->> 'autoplayMuted')::boolean, true),
        'hasVoice', coalesce((s.video ->> 'hasVoice')::boolean, false),
        'frames', coalesce((select jsonb_object_agg(f.key, 'assets/' || s.id || '-f-' || md5(f.value #>> '{}') || '.webp')
                            from jsonb_each(coalesce(s.video -> 'frames', '{}'::jsonb)) f), '{}'::jsonb)) end,
      -- A8 : page HTML capturée (servie en iframe srcdoc sandbox) et ses opérations. Les liens vers
      -- une étape absente de la démo sont retirés ; meta réduite à ce que le lecteur affiche.
      'html', case when s.html_pub_path is not null then jsonb_build_object(
        'url', s.html_pub_path,
        'ops', coalesce((select jsonb_agg(e.op order by e.ord) from jsonb_array_elements(s.html_ops) with ordinality as e(op, ord)
                         where e.op ->> 'op' <> 'link' or exists (
                           select 1 from public.steps t where t.demo_id = p_demo and t.id::text = e.op ->> 'value')), '[]'::jsonb),
        'title', left(coalesce(s.html_meta ->> 'title', ''), 200),
        'viewport', s.html_meta -> 'viewport',
        -- Liens de la page résolus vers une autre page de la démo (même adresse, sans fragment ni
        -- barre finale) : liaison automatique du Sandbox. Aucune adresse n'est publiée.
        'links', coalesce((select jsonb_agg(jsonb_build_object('sel', l ->> 'sel', 'step', t.id::text))
                           from jsonb_array_elements(coalesce(s.html_meta -> 'links', '[]'::jsonb)) l
                           join lateral (select t.id from public.steps t
                                         where t.demo_id = p_demo and t.kind::text = 'html' and t.id <> s.id
                                           and regexp_replace(regexp_replace(t.html_meta ->> 'url', '#.*$', ''), '/$', '')
                                             = regexp_replace(regexp_replace(l ->> 'href', '#.*$', ''), '/$', '')
                                         order by t.position, t.created_at limit 1) t on true), '[]'::jsonb)) end,
      'zoom', s.zoom,
      'cta', s.cta,
      -- L25-01 : le chemin de stockage de la page entière n'est jamais publié, seulement sa copie
      'options', (s.options - 'beforeAfter' - 'fullPage')
        || case when s.full_pub_path is not null then jsonb_build_object('fullPage', jsonb_build_object(
             'url', s.full_pub_path,
             'width', (s.options #>> '{fullPage,width}')::int,
             'height', (s.options #>> '{fullPage,height}')::int,
             'top', (s.options #>> '{fullPage,top}')::int,
             'viewportHeight', (s.options #>> '{fullPage,viewportHeight}')::int)) else '{}'::jsonb end,
      'gateFormId', case when lead_forms then s.gate_form_id::text end,
      'hotspots', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', h.id::text, 'x', h.x, 'y', h.y, 'w', h.w, 'h', h.h,
          'title', h.title, 'body', h.body, 'placement', h.placement,
          'action', h.action, 'cta', h.cta, 'pulse', h.pulse,
          -- mode Spotlight réglé pour toute la démo : il s'impose à chaque hotspot
          'style', case when d.settings ->> 'mode' = 'spotlight' then 'spotlight' else h.style end
        ) order by h.position, h.created_at)
        from public.hotspots h where h.step_id = s.id), '[]'::jsonb)
    ) order by s.idx),
    coalesce(jsonb_agg(jsonb_build_object('from', s.image_path, 'to', p_demo::text || '/' || s.pub_path))
      filter (where s.pub_path is not null), '[]'::jsonb)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.before_image_path, 'to', p_demo::text || '/' || s.before_pub_path))
      filter (where s.before_pub_path is not null), '[]'::jsonb)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.options #>> '{fullPage,path}', 'to', p_demo::text || '/' || s.full_pub_path))
      filter (where s.full_pub_path is not null), '[]'::jsonb)
    -- F7 : la vidéo (bucket videos, copiée telle quelle) et les images des pauses (bucket captures)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.video_path, 'to', p_demo::text || '/' || s.video_pub_path,
                                             'bucket', 'videos'))
      filter (where s.video_pub_path is not null), '[]'::jsonb)
    || coalesce((select jsonb_agg(jsonb_build_object('from', f.value #>> '{}',
                    'to', p_demo::text || '/assets/' || s2.id || '-f-' || md5(f.value #>> '{}') || '.webp'))
                 from public.steps s2, jsonb_each(coalesce(s2.video -> 'frames', '{}'::jsonb)) f
                 where s2.demo_id = p_demo and s2.kind::text = 'video' and s2.video_path is not null), '[]'::jsonb)
    -- A8 : page HTML (bucket html, copiée telle quelle)
    || coalesce(jsonb_agg(jsonb_build_object('from', s.html_path, 'to', p_demo::text || '/' || s.html_pub_path,
                                             'bucket', 'html'))
      filter (where s.html_pub_path is not null), '[]'::jsonb)
  into v_steps, v_copies
  from s;

  if lead_forms then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id::text, 'title', f.title, 'description', f.description, 'submitLabel', f.submit_label,
      'fields', f.fields, 'consentText', f.consent_text, 'skippable', f.skippable)), '[]'::jsonb)
    into v_forms from public.forms f where f.demo_id = p_demo;
  else
    v_forms := '[]'::jsonb;
  end if;

  -- L17 : glossaire (termes présents dans la démo), null si le soulignement est désactivé
  if coalesce((ws.settings #>> '{glossary,underline}')::boolean, true)
     and coalesce((d.settings ->> 'glossary')::boolean, true) then
    select coalesce(jsonb_agg(jsonb_build_object(
        'term', g.term, 'oldTerm', g.old_term, 'definition', g.definition, 'forms', to_jsonb(g.forms))
        order by g.term), '[]'::jsonb)
      into v_glossary
    from public.glossary_terms g
    where g.workspace_id = d.workspace_id
      and public.glossary_in_text(public.demo_text(p_demo), g.term, g.forms);
  end if;

  -- L18 : test A/B en cours (variante B rendue par le lecteur comme la bulle A)
  select jsonb_build_object('testId', t.id::text, 'hotspotId', t.hotspot_id::text, 'splitB', t.split_b,
      'b', jsonb_build_object('title', coalesce(t.variant_b ->> 'title', ''), 'body', coalesce(t.variant_b ->> 'body', ''),
                              'cta', case when jsonb_typeof(t.variant_b -> 'cta') = 'object' then t.variant_b -> 'cta' end))
    into v_ab
  from public.ab_tests t
  where t.demo_id = p_demo and t.status = 'running'
    and exists (select 1 from public.hotspots h where h.id = t.hotspot_id);

  -- L25-09 : jeu de données publié réduit aux colonnes liées (et à la colonne de correspondance)
  select case when ds.id is null then null else jsonb_build_object(
      'columns', coalesce((select jsonb_agg(x.c order by x.o) from jsonb_array_elements_text(ds.columns) with ordinality x(c, o)
                           where x.c = ds.link_column
                              or exists (select 1 from jsonb_array_elements(ds.bindings) b where b ->> 'column' = x.c)), '[]'::jsonb),
      'rows', coalesce((select jsonb_agg((select jsonb_agg(r -> (x.o::int - 1) order by x.o)
                                          from jsonb_array_elements_text(ds.columns) with ordinality x(c, o)
                                          where x.c = ds.link_column
                                             or exists (select 1 from jsonb_array_elements(ds.bindings) b where b ->> 'column' = x.c)))
                        from jsonb_array_elements(ds.rows) r), '[]'::jsonb),
      'bindings', ds.bindings, 'rowMode', ds.row_mode, 'linkColumn', ds.link_column) end
    into v_dataset
  from (select 1) one left join public.demo_datasets ds on ds.demo_id = p_demo;

  v_manifest := jsonb_build_object(
    'schemaVersion', 1,
    'demoId', p_demo::text,
    'versionId', v_id::text,
    'workspaceId', d.workspace_id::text,
    -- PLY-01 : nom du workspace (en-tête du lecteur, « Données traitées par … »)
    'workspaceName', left(coalesce(ws.name, ''), 120),
    'title', d.title,
    -- F7 : démo capturée au format mobile (cadre téléphone, feuille du bas, « Touchez »)
    'device', d.device,
    'viewport', d.viewport,
    -- A8 : démo guidée ou Sandbox (navigation libre entre pages HTML reliées)
    'kind', d.kind,
    'sandbox', case when d.kind = 'sandbox' then jsonb_build_object(
      'start', coalesce(
        (select t.id::text from public.steps t where t.demo_id = p_demo and t.id::text = d.sandbox ->> 'start'),
        (select t.id::text from public.steps t where t.demo_id = p_demo order by t.position, t.created_at limit 1)),
      'autoLink', coalesce((d.sandbox ->> 'autoLink')::boolean, true),
      'unlinked', coalesce(d.sandbox ->> 'unlinked', 'toast'),
      'guide', coalesce((d.sandbox ->> 'guide')::boolean, false),
      'keyPages', coalesce((select jsonb_agg(k) from jsonb_array_elements_text(coalesce(d.sandbox -> 'keyPages', '[]'::jsonb)) k
                            where exists (select 1 from public.steps t where t.demo_id = p_demo and t.id::text = k)), '[]'::jsonb)) end,
    'locale', coalesce(d.settings ->> 'locale', 'fr'),
    'publishedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'theme', v_theme,
    'variables', coalesce((select jsonb_agg(jsonb_build_object('key', v.key, 'label', v.label, 'default', v.default_value))
                           from public.variables v where v.workspace_id = d.workspace_id), '[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('id', c.id::text, 'title', c.title) order by c.position)
                          from public.chapters c where c.demo_id = p_demo), '[]'::jsonb),
    'steps', v_steps,
    'forms', v_forms,
    'allowedEmbedOrigins', coalesce(d.settings -> 'allowedEmbedOrigins', '[]'::jsonb),
    -- P6 : bouton d'action du client affiché en permanence dans le player (ex. « Réserver une démo »)
    'cta', case when jsonb_typeof(d.settings -> 'cta') = 'object' and d.settings -> 'cta' ? 'url' then d.settings -> 'cta' end,
    -- P13 : lien « Confidentialité » du workspace sous les formulaires de lead (https uniquement)
    'privacyUrl', case when (ws.settings ->> 'privacyUrl') ~ '^https://[^\s]+$' then ws.settings ->> 'privacyUrl' end,
    -- F1 : checklist de progression et lecture automatique (réglages de la démo)
    'checklist', case when jsonb_typeof(d.settings -> 'checklist') = 'object'
                       and coalesce((d.settings -> 'checklist' ->> 'enabled')::boolean, false)
                  then jsonb_build_object(
                    'title', left(coalesce(d.settings -> 'checklist' ->> 'title', ''), 80),
                    'position', case when d.settings -> 'checklist' ->> 'position' in ('left', 'right', 'collapsed')
                                     then d.settings -> 'checklist' ->> 'position' else 'right' end)
                  end,
    'autoplay', case when jsonb_typeof(d.settings -> 'autoplay') = 'object'
                      and coalesce((d.settings -> 'autoplay' ->> 'enabled')::boolean, false)
                 then jsonb_build_object('enabled', true,
                        'delayMs', least(greatest(coalesce((d.settings -> 'autoplay' ->> 'delayMs')::int, 4000), 1500), 30000))
                 end,
    -- F2 : quiz de validation (ou sondage) après la dernière étape
    'quiz', v_quiz,
    'glossary', v_glossary,
    'ab', v_ab,
    -- L25-09 : jeu de données (colonnes liées seulement, contrôlé à l'écriture)
    'dataset', v_dataset,
    'trackUrl', null
  );

  insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by, public_ack)
  values (v_id, p_demo, d.workspace_id, v_number, v_manifest, (select auth.uid()), v_ack);

  return jsonb_build_object('versionId', v_id, 'number', v_number, 'manifest', v_manifest, 'copies', v_copies);
end $function$;

-- quiz_stats(p_demo uuid)
CREATE OR REPLACE FUNCTION public.quiz_stats(p_demo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
  v_out jsonb;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id);
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select jsonb_build_object(
    'attempts', (select count(*) from public.quiz_attempts where demo_id = p_demo),
    'visitors', (select count(distinct visitor_id) from public.quiz_attempts where demo_id = p_demo),
    'passRate', (select coalesce(avg(case when passed then 1.0 else 0 end), 0) from public.quiz_attempts where demo_id = p_demo),
    'avgScore', (select coalesce(round(avg(score)), 0) from public.quiz_attempts where demo_id = p_demo),
    'questions', coalesce((
      with per as (
        select a ->> 'questionId' as qid, coalesce((a ->> 'correct')::boolean, false) as ok, a -> 'answerIds' as ids
        from public.quiz_attempts t, jsonb_array_elements(t.answers) a where t.demo_id = p_demo
      ), q as (
        select qid, count(*) as answered, avg(case when ok then 1.0 else 0 end) as rate from per group by qid
      ), ch as (
        select qid, jsonb_object_agg(id, n) as choices
        from (select qid, g as id, count(*) as n from per, jsonb_array_elements_text(ids) g group by qid, g) z
        group by qid
      )
      select jsonb_agg(jsonb_build_object('questionId', q.qid, 'answered', q.answered, 'correctRate', q.rate,
                                          'choices', coalesce(ch.choices, '{}'::jsonb)) order by q.qid)
      from q left join ch on ch.qid = q.qid), '[]'::jsonb))
  into v_out;
  return v_out;
end $function$;

-- record_diffusion(p_demo uuid, p_kind text, p_label text, p_settings jsonb)
CREATE OR REPLACE FUNCTION public.record_diffusion(p_demo uuid, p_kind text, p_label text, p_settings jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
  v_version uuid;
  v_id uuid;
begin
  select workspace_id, current_version_id into v_ws, v_version
    from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id) and deleted_at is null;
  if v_ws is null or not public.has_role(v_ws, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  insert into public.diffusions (workspace_id, demo_id, kind, label, settings, version_id, created_by)
  values (v_ws, p_demo, p_kind, btrim(p_label), coalesce(p_settings, '{}'::jsonb), v_version, auth.uid())
  on conflict (demo_id, kind, label) do update
    set settings = excluded.settings,
        version_id = excluded.version_id,
        last_at = now(),
        uses = public.diffusions.uses + 1
  returning id into v_id;
  return v_id;
end $function$;

-- save_demo_as_template(p_demo uuid, p_name text, p_description text, p_category text, p_with_captures boolean, p_ack boolean)
CREATE OR REPLACE FUNCTION public.save_demo_as_template(p_demo uuid, p_name text, p_description text, p_category text, p_with_captures boolean, p_ack boolean DEFAULT NULL::boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.demos;
  v_id uuid;
  v_struct jsonb;
begin
  select * into d from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id) and deleted_at is null;
  if d.id is null or not public.has_role(d.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'NAME_INVALID'; end if;
  -- Bilan RGPD : un modèle avec captures exige la même confirmation qu'une publication
  if coalesce(p_with_captures, false) and not coalesce(p_ack, false) then
    raise exception 'GDPR_ACK_REQUIRED' using errcode = 'P0001';
  end if;

  with st as (
    select s.*, (row_number() over (order by s.position, s.created_at) - 1)::int as idx
    from public.steps s where s.demo_id = p_demo
  ), steps_json as (
    select st.chapter_id, st.idx, jsonb_strip_nulls(jsonb_build_object(
      'type', case when st.kind = 'text' and st.options ->> 'display' = 'popup' then 'popup'
                   when st.kind = 'text' then 'texte'
                   when st.options -> 'animation' ->> 'type' = 'typing' then 'saisie'
                   else 'bulle' end,
      'title', st.title,
      'body', st.body,
      'cta', st.cta,
      'options', case when p_with_captures then st.options - 'choices' - 'rules' - 'rulesElse' - 'branch' - 'beforeAfter'
                      else st.options - 'choices' - 'rules' - 'rulesElse' - 'branch' - 'beforeAfter' - 'tab' - 'tabCaptured'
                           - 'crop' - 'fullPage' end,
      'image', case when p_with_captures and st.image_path is not null then jsonb_build_object(
                 'path', st.image_path, 'width', st.image_width, 'height', st.image_height, 'blurs', st.blurs) end,
      'capture', case when st.kind = 'text' then null else true end,
      'hotspots', (select coalesce(jsonb_agg(jsonb_build_object(
                     'x', h.x, 'y', h.y, 'w', h.w, 'h', h.h, 'title', h.title, 'body', h.body,
                     'placement', h.placement, 'pulse', h.pulse, 'style', h.style, 'cta', h.cta,
                     'action', case when h.action ->> 'type' = 'goto' then jsonb_build_object('type', 'goto',
                                 'stepIndex', (select t.idx from st t where t.id::text = h.action ->> 'stepId'))
                               else h.action end) order by h.position), '[]'::jsonb)
                   from public.hotspots h where h.step_id = st.id)
    )) as j
    from st
  ), chapters_json as (
    select c.position, jsonb_build_object('title', c.title, 'steps',
      coalesce((select jsonb_agg(sj.j order by sj.idx) from steps_json sj where sj.chapter_id = c.id), '[]'::jsonb)) as j
    from public.chapters c where c.demo_id = p_demo
  )
  select jsonb_build_object(
    'settings', coalesce(d.settings, '{}'::jsonb) - 'variables' - 'allowedEmbedOrigins',
    'themeId', d.theme_id,
    'chapters',
      case when exists (select 1 from steps_json where chapter_id is null)
        then jsonb_build_array(jsonb_build_object('title', '', 'steps',
               (select jsonb_agg(sj.j order by sj.idx) from steps_json sj where sj.chapter_id is null)))
        else '[]'::jsonb end
      || coalesce((select jsonb_agg(cj.j order by cj.position) from chapters_json cj), '[]'::jsonb),
    'quiz', coalesce((select jsonb_agg(jsonb_build_object('type', q.type, 'prompt', q.prompt, 'answers', q.answers,
                        'explanation', q.explanation, 'points', q.points) order by q.position)
                      from public.quiz_questions q where q.demo_id = p_demo), '[]'::jsonb)
  ) into v_struct;

  insert into public.demo_templates (workspace_id, name, description, category, icon, structure, with_captures, created_by)
  values (d.workspace_id, btrim(p_name), left(coalesce(p_description, ''), 200), p_category, 'layout-template',
          v_struct, coalesce(p_with_captures, false), (select auth.uid()))
  returning id into v_id;
  return v_id;
end $function$;

-- segment_count(p_workspace uuid, p_segment jsonb, p_from timestamp with time zone, p_to timestamp with time zone)
CREATE OR REPLACE FUNCTION public.segment_count(p_workspace uuid, p_segment jsonb, p_from timestamp with time zone, p_to timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return jsonb_build_object(
    'visitors', cardinality(private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to)),
    'total', (select count(distinct visitor_id) from public.events e join public.demos d on d.id = e.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
              where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to));
end $function$;

-- structure_overview(p_path uuid)
CREATE OR REPLACE FUNCTION public.structure_overview(p_path uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_ws uuid;
begin
  select workspace_id into v_ws from public.paths where id = p_path;
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (
    with mods as (
      select m.demo_id, m.required, m.position, d.title from public.path_modules m
      join public.demos d on d.id = m.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[])) where m.path_id = p_path
    ), lm as (
      select lm.* from public.learner_modules(v_ws) lm where lm.demo_id in (select demo_id from mods)
    ), lrn as (
      select l.id, l.structure_id from public.learners l where l.workspace_id = v_ws
        and exists (select 1 from lm where lm.learner_id = l.id and lm.status <> 'not_started')
    ), trained as (
      select lrn.id, lrn.structure_id,
             bool_and(lm.status = 'validated') filter (where mods.required) as ok
      from lrn join lm on lm.learner_id = lrn.id join mods on mods.demo_id = lm.demo_id
      group by lrn.id, lrn.structure_id
    )
    select jsonb_build_object(
      'goal', (select goal from public.paths where id = p_path),
      'learners', (select count(*) from lrn),
      'trained', (select count(*) from trained where ok),
      'modules', (select coalesce(jsonb_agg(jsonb_build_object('demoId', demo_id, 'title', title, 'required', required) order by position), '[]'::jsonb) from mods),
      'structures', (select coalesce(jsonb_agg(x order by x ->> 'name'), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', s.id, 'name', s.name,
          'learners', (select count(*) from lrn where lrn.structure_id is not distinct from s.id),
          'trainedRate', (select case when count(*) < 5 then null else round(avg(case when t.ok then 1.0 else 0 end), 4) end
                          from trained t where t.structure_id is not distinct from s.id),
          'cells', (select coalesce(jsonb_object_agg(c.demo_id, case when c.n < 5 then null else round(c.ok::numeric / c.n, 4) end), '{}'::jsonb)
                    from (select lm.demo_id, count(*) as n, count(*) filter (where lm.status = 'validated') as ok
                          from lrn join lm on lm.learner_id = lrn.id
                          where lrn.structure_id is not distinct from s.id group by lm.demo_id) c)) as x
        from (select id, name from public.structures where workspace_id = v_ws
              union all select null::uuid, null::text where exists (select 1 from lrn where structure_id is null)) s) y)
    )
  );
end $function$;

-- survey_results(p_demo uuid, p_from timestamp with time zone, p_to timestamp with time zone)
CREATE OR REPLACE FUNCTION public.survey_results(p_demo uuid, p_from timestamp with time zone DEFAULT (now() - '30 days'::interval), p_to timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id);
  if v_ws is null or not public.has_role(v_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    with qs as (
      select q.id, q.type, q.prompt, q.answers, q.position from public.quiz_questions q where q.demo_id = p_demo
    ), last as (
      select distinct on (a.visitor_id, d ->> 'questionId') a.visitor_id, d
      from public.quiz_attempts a, jsonb_array_elements(a.answers) d
      where a.demo_id = p_demo and a.created_at between p_from and p_to
      order by a.visitor_id, d ->> 'questionId', a.created_at desc
    )
    select jsonb_agg(jsonb_build_object('id', qs.id, 'type', qs.type, 'prompt', qs.prompt,
      'responses', (select count(*) from last where last.d ->> 'questionId' = qs.id::text
                      and (qs.type <> 'nps' or last.d ->> 'value' is not null)
                      and (qs.type <> 'text' or coalesce((last.d ->> 'answered')::boolean, false))),
      'nps', case when qs.type = 'nps' then (
        select jsonb_build_object('histogram', (select jsonb_agg(coalesce(c.n, 0) order by g.v) from generate_series(0, 10) g(v)
                 left join (select (last.d ->> 'value')::int as v, count(*) n from last
                            where last.d ->> 'questionId' = qs.id::text and last.d ->> 'value' is not null group by 1) c on c.v = g.v),
          'score', case when count(*) >= 20 then round(100.0 * (count(*) filter (where (last.d ->> 'value')::int >= 9)
                                                 - count(*) filter (where (last.d ->> 'value')::int <= 6)) / count(*))::int end)
        from last where last.d ->> 'questionId' = qs.id::text and last.d ->> 'value' is not null) end,
      'choices', case when qs.type in ('single', 'multiple', 'truefalse') then (
        select jsonb_agg(jsonb_build_object('id', ans ->> 'id', 'label', ans ->> 'label',
                 'n', (select count(*) from last where last.d ->> 'questionId' = qs.id::text
                        and coalesce(last.d -> 'answerIds', '[]'::jsonb) ? (ans ->> 'id'))))
        from jsonb_array_elements(qs.answers) ans) end)
      order by qs.position)
    from qs), '[]'::jsonb);
end $function$;

-- survey_texts(p_demo uuid, p_question text, p_limit integer)
CREATE OR REPLACE FUNCTION public.survey_texts(p_demo uuid, p_question text DEFAULT NULL::text, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id);
  if v_ws is null or not public.has_role(v_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('at', t.created_at, 'questionId', t.question_id, 'text', t.body,
                                        'learner', l.full_name) order by t.created_at desc)
    from (select * from public.survey_text_answers where demo_id = p_demo
            and (p_question is null or question_id = p_question)
          order by created_at desc limit least(greatest(coalesce(p_limit, 200), 1), 500)) t
    left join public.learner_visitors lv on lv.workspace_id = t.workspace_id and lv.visitor_id = t.visitor_id
    left join public.learners l on l.id = lv.learner_id), '[]'::jsonb);
end $function$;

-- unpublish_demo(p_demo uuid)
CREATE OR REPLACE FUNCTION public.unpublish_demo(p_demo uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ws uuid;
begin
  select workspace_id into ws from public.demos where id = p_demo and public.folder_visible(workspace_id, folder_id);
  if ws is null or not public.has_role(ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  update public.demos set status = 'draft' where id = p_demo;
end $function$;

-- workspace_analytics(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_demo uuid, p_source text, p_segment jsonb)
CREATE OR REPLACE FUNCTION public.workspace_analytics(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone DEFAULT now(), p_demo uuid DEFAULT NULL::uuid, p_source text DEFAULT NULL::text, p_segment jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_vis text[];
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_source is not null and p_source not in ('direct', 'embed', 'link', 'page') then
    raise exception 'Source inconnue' using errcode = '22023';
  end if;
  if p_segment is not null then
    v_vis := private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to);
  end if;
  return (
    with e as (
      select e.*,
        case when e.channel = 'page' then 'page' when e.link_id is not null then 'link' when e.embed_origin is not null then 'embed' else 'direct' end as source
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
        and (p_demo is null or e.demo_id = p_demo)
        and (v_vis is null or e.visitor_id = any (v_vis))
    ), f as (
      -- filtre de source appliqué aux indicateurs ; la répartition des sources reste globale
      select * from e where p_source is null or source = p_source
    ), v as (select * from f where type = 'demo_view')
    select jsonb_build_object(
      'views', (select count(*) from v),
      'visitors', (select count(distinct visitor_id) from v),
      'completions', (select count(distinct session_id) from f where type = 'demo_complete'),
      'ctaClicks', (select count(*) from f where type = 'cta_click'),
      -- agrégat seulement (aucune donnée personnelle) : visible dès le rôle viewer
      'leads', (select count(*) from public.leads l
                join public.demos d on d.id = l.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
                where l.workspace_id = p_workspace and l.created_at >= p_from and l.created_at <= p_to
                  and (p_demo is null or l.demo_id = p_demo)
                  and (v_vis is null or l.visitor_id = any (v_vis))
                  -- un lead ne porte que link_id : « link » si présent, sinon direct ou intégration
                  and (p_source is null or (p_source = 'link') = (l.link_id is not null))),
      'daily', coalesce((select jsonb_agg(jsonb_build_object('day', dday, 'views', vw, 'completions', cp) order by dday)
                from (select to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') as dday,
                             count(*) filter (where type = 'demo_view') as vw,
                             count(distinct session_id) filter (where type = 'demo_complete') as cp
                      from f where type in ('demo_view', 'demo_complete') group by 1) y), '[]'::jsonb),
      'sources', jsonb_build_object(
        'direct', (select count(*) from e where type = 'demo_view' and source = 'direct'),
        'embed', (select count(*) from e where type = 'demo_view' and source = 'embed'),
        'link', (select count(*) from e where type = 'demo_view' and source = 'link'),
        'page', (select count(*) from e where type = 'demo_view' and source = 'page')),
      'segmentVisitors', case when v_vis is not null then cardinality(v_vis) end
    )
  );
end $function$;

-- workspace_kpis(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone)
CREATE OR REPLACE FUNCTION public.workspace_kpis(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (
    with e as (
      select e.* from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
    )
    select jsonb_build_object(
      'views', (select count(*) from e where type = 'demo_view'),
      'visitors', (select count(distinct visitor_id) from e where type = 'demo_view'),
      'completions', (select count(distinct session_id) from e where type = 'demo_complete'),
      'leads', (select count(*) from public.leads l join public.demos d on d.id = l.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
                where l.workspace_id = p_workspace and l.created_at >= p_from and l.created_at <= p_to)
    )
  );
end $function$;

-- workspace_leads(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_demo uuid, p_limit integer, p_offset integer, p_segment jsonb)
CREATE OR REPLACE FUNCTION public.workspace_leads(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone DEFAULT now(), p_demo uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_segment jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_vis text[];
begin
  if not public.has_role(p_workspace, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_segment is not null then
    v_vis := private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to);
    if cardinality(v_vis) < 5 then
      return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'tooSmall', true);
    end if;
  end if;
  return (
    with l as (
      select l.* from public.leads l
      left join public.demos d on d.id = l.demo_id
      where l.workspace_id = p_workspace and l.created_at >= p_from and l.created_at <= p_to
        and (d.id is null or (d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))))
        and (p_demo is null or l.demo_id = p_demo)
        and (v_vis is null or l.visitor_id = any (v_vis))
    )
    select jsonb_build_object(
      'total', (select count(*) from l),
      'rows', coalesce((select jsonb_agg(r order by r.created_at desc) from (
        select l.id, l.email, l.fields, l.consent, l.created_at, l.demo_id,
          p.max_step, coalesce(p.completed, false) as completed,
          (select count(*) from public.steps st where st.demo_id = l.demo_id) as steps_total
        from l
        left join lateral (
          select max(e.step_index) as max_step, bool_or(e.type = 'demo_complete') as completed
          from public.events e
          where e.workspace_id = p_workspace and e.demo_id = l.demo_id and e.visitor_id = l.visitor_id
        ) p on true
        order by l.created_at desc
        limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset)
      ) r), '[]'::jsonb)
    )
  );
end $function$;

-- workspace_overview(p_workspace uuid, p_days integer)
CREATE OR REPLACE FUNCTION public.workspace_overview(p_workspace uuid, p_days integer DEFAULT 30)
 RETURNS TABLE(demo_id uuid, views bigint, visitors bigint, completions bigint, leads bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return query
    select d.id,
      (select count(*) from public.events e where e.demo_id = d.id and e.type = 'demo_view' and e.occurred_at > now() - make_interval(days => p_days)),
      (select count(distinct e.visitor_id) from public.events e where e.demo_id = d.id and e.type = 'demo_view' and e.occurred_at > now() - make_interval(days => p_days)),
      (select count(distinct e.session_id) from public.events e where e.demo_id = d.id and e.type = 'demo_complete' and e.occurred_at > now() - make_interval(days => p_days)),
      (select count(*) from public.leads l where l.demo_id = d.id and l.created_at > now() - make_interval(days => p_days))
    from public.demos d where d.workspace_id = p_workspace and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]));
end $function$;

-- workspace_returning(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_demo uuid, p_source text, p_segment jsonb)
CREATE OR REPLACE FUNCTION public.workspace_returning(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone DEFAULT now(), p_demo uuid DEFAULT NULL::uuid, p_source text DEFAULT NULL::text, p_segment jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_on boolean;
  v_gap int;
  v_vis text[];
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_source is not null and p_source not in ('direct', 'embed', 'link', 'page') then
    raise exception 'Source inconnue' using errcode = '22023';
  end if;
  select visit_measure, visit_gap_minutes into v_on, v_gap from public.workspaces where id = p_workspace;
  if not v_on then
    return jsonb_build_object('enabled', false, 'gapMinutes', v_gap);
  end if;
  if p_segment is not null then
    v_vis := private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to);
  end if;
  return (
    with e as (
      select e.session_id, e.demo_id, private.visitor_key(p_workspace, e.visitor_id) as vkey
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
        and e.type = 'demo_view' and e.visitor_id not like 's:%'
        and (p_demo is null or e.demo_id = p_demo)
        and (v_vis is null or e.visitor_id = any (v_vis))
        and (p_source is null or p_source = case when e.channel = 'page' then 'page' when e.link_id is not null then 'link'
                                                  when e.embed_origin is not null then 'embed' else 'direct' end)
    ), vs as (
      select * from private.visit_sessions(p_workspace, (select array_agg(distinct vkey) from e))
    ), pv as (
      -- visites de la période de chaque visiteur (sessions vues pendant la période)
      select e.vkey, max(vs.visit_no) as last_no, count(distinct vs.visit_no) as visits
      from e join vs on vs.session_id = e.session_id and vs.visitor_key = e.vkey
      group by e.vkey
    ), dv as (
      select e.demo_id, count(distinct e.vkey) as total,
        count(distinct e.vkey) filter (where vs.visit_no >= 2) as ret
      from e join vs on vs.session_id = e.session_id and vs.visitor_key = e.vkey
      group by e.demo_id
    )
    select jsonb_build_object(
      'enabled', true,
      'gapMinutes', v_gap,
      'total', (select count(*) from pv),
      'visitors', (select count(*) from pv where last_no >= 2),
      'avgVisits', (select round(avg(visits)::numeric, 1) from pv where last_no >= 2),
      'topDemos', coalesce((select jsonb_agg(jsonb_build_object('demoId', x.demo_id, 'title', x.title,
                                                               'visitors', x.total, 'returning', x.ret)
                                             order by x.ret desc, x.total desc)
                            from (select dv.*, d.title from dv join public.demos d on d.id = dv.demo_id
                                  where dv.ret > 0 order by dv.ret desc, dv.total desc limit 3) x), '[]'::jsonb)
    )
  );
end $function$;

-- workspace_sessions(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_demo uuid, p_source text, p_limit integer, p_offset integer, p_segment jsonb)
CREATE OR REPLACE FUNCTION public.workspace_sessions(p_workspace uuid, p_from timestamp with time zone, p_to timestamp with time zone DEFAULT now(), p_demo uuid DEFAULT NULL::uuid, p_source text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_segment jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- Mêmes droits que la RLS leads_select : email et champs des leads réservés aux rôles editor et plus
  can_leads boolean := public.has_role(p_workspace, 'editor');
  v_vis text[];
begin
  if not public.has_role(p_workspace, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if p_segment is not null then
    v_vis := private.segment_visitors(p_workspace, private.segment_def(p_workspace, p_segment), p_from, p_to);
    -- Sous 5 visiteurs : agrégats seulement, aucune ligne (risque de réidentification)
    if cardinality(v_vis) < 5 then
      return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'tooSmall', true);
    end if;
  end if;
  return (
    with e as (
      select e.*,
        case when e.channel = 'page' then 'page' when e.link_id is not null then 'link' when e.embed_origin is not null then 'embed' else 'direct' end as source
      from public.events e
      join public.demos d on d.id = e.demo_id and d.deleted_at is null and not (d.folder_id is not null and d.folder_id = any ((select public.my_hidden_folders())::uuid[]))
      where e.workspace_id = p_workspace and e.occurred_at >= p_from and e.occurred_at <= p_to
        and (p_demo is null or e.demo_id = p_demo)
        and (v_vis is null or e.visitor_id = any (v_vis))
    ), s as (
      select session_id, min(demo_id::text)::uuid as demo_id, min(visitor_id) as visitor_id,
        (array_agg(source order by occurred_at))[1] as source,
        min(occurred_at) as started_at,
        extract(epoch from max(occurred_at) - min(occurred_at))::int as duration_s,
        max(step_index) as max_step,
        bool_or(type = 'demo_complete') as completed,
        (array_agg(device order by occurred_at desc) filter (where device is not null))[1] as device,
        (array_agg(country order by occurred_at desc) filter (where country is not null))[1] as country
      from e group by session_id
    ), sf as (
      select * from s where p_source is null or source = p_source
    )
    select jsonb_build_object(
      'total', (select count(*) from sf),
      'rows', coalesce((select jsonb_agg(r order by r.started_at desc) from (
        select sf.session_id, sf.demo_id, sf.source, sf.started_at, sf.duration_s, sf.max_step, sf.completed,
          sf.device, sf.country,
          (select count(*) from public.steps st where st.demo_id = sf.demo_id) as steps_total,
          (l.email is not null) as has_lead,
          case when can_leads then l.email end as lead_email,
          case when can_leads then l.fields end as lead_fields
        from sf
        left join lateral (
          select email, fields from public.leads l
          where l.workspace_id = p_workspace and l.visitor_id = sf.visitor_id and l.demo_id = sf.demo_id
          order by l.created_at desc limit 1
        ) l on true
        order by sf.started_at desc
        limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
      ) r), '[]'::jsonb)
    )
  );
end $function$;

