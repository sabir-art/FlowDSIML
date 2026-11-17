-- FlowDSIML — F1 : données sensibles (liens publics par workspace, avertissement RGPD journalisé).
-- Idempotent, additif.
--  * workspaces.public_links_enabled : true pour les workspaces EXISTANTS (aucun lien en ligne cassé),
--    false par défaut pour les nouveaux. Modifiable par un admin+ (grant de colonne + RLS ws_update).
--    Quand il vaut false : publish_demo et la création de liens personnalisés refusent (PUBLIC_DISABLED).
--  * demo_versions.public_ack : confirmation RGPD de la publication publique (auteur, date, deux cases,
--    bilan calculé côté serveur : zones floutées, étapes avec détections non floutées).
--  * publish_demo(p_demo, p_ack) : remplace publish_demo(p_demo) (drop + create : la signature change),
--    corps identique à 20261117131000 avec les deux contrôles ci-dessus.

alter table public.workspaces add column if not exists public_links_enabled boolean not null default true;
alter table public.workspaces alter column public_links_enabled set default false;
grant update (public_links_enabled) on public.workspaces to authenticated;

alter table public.demo_versions add column if not exists public_ack jsonb;

-- Liens personnalisés : refusés quand les liens publics sont désactivés
create or replace function public.share_links_public_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select w.public_links_enabled from public.demos d join public.workspaces w on w.id = d.workspace_id
                   where d.id = new.demo_id), false) then
    raise exception 'PUBLIC_DISABLED' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.share_links_public_guard() from public, anon, authenticated;
drop trigger if exists share_links_public_guard on public.share_links;
create trigger share_links_public_guard before insert on public.share_links
  for each row execute function public.share_links_public_guard();

drop function if exists public.publish_demo(uuid);

create or replace function public.publish_demo(p_demo uuid, p_ack jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
begin
  select * into d from public.demos where id = p_demo and deleted_at is null;
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
    select row_number() over (order by s.position, s.created_at) as n, s.blurs, s.element_meta -> 'pii' as pii
    from public.steps s where s.demo_id = p_demo
  )
  select jsonb_build_object(
    'by', (select auth.uid()),
    'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'reviewed', true,
    'fictional', true,
    'blurred', coalesce(sum(
      case when jsonb_typeof(st.blurs) = 'array' then jsonb_array_length(st.blurs) else 0 end
      + case when jsonb_typeof(st.pii) = 'array'
          then (select count(*) from jsonb_array_elements(st.pii) p where coalesce((p ->> 'blurred')::boolean, false))
          else 0 end), 0),
    'pendingSteps', coalesce(jsonb_agg(st.n order by st.n) filter (where jsonb_typeof(st.pii) = 'array'
      and exists (select 1 from jsonb_array_elements(st.pii) p where not coalesce((p ->> 'blurred')::boolean, false))), '[]'::jsonb))
  into v_ack from st;

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
        then 'assets/' || st.id || '-' || md5(st.image_path) || '.webp' end as pub_path
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
      'zoom', s.zoom,
      'cta', s.cta,
      'options', s.options,
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

  v_manifest := jsonb_build_object(
    'schemaVersion', 1,
    'demoId', p_demo::text,
    'versionId', v_id::text,
    'workspaceId', d.workspace_id::text,
    'title', d.title,
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
    'trackUrl', null
  );

  insert into public.demo_versions (id, demo_id, workspace_id, number, manifest, published_by, public_ack)
  values (v_id, p_demo, d.workspace_id, v_number, v_manifest, (select auth.uid()), v_ack);

  return jsonb_build_object('versionId', v_id, 'number', v_number, 'manifest', v_manifest, 'copies', v_copies);
end $$;

revoke all on function public.publish_demo(uuid, jsonb) from public, anon;
grant execute on function public.publish_demo(uuid, jsonb) to authenticated;
