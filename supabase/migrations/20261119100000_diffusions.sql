-- L16 (F6) : « Où ce module est diffusé ». Une ligne par diffusion connue d'un module : paquet SCORM
-- exporté, code d'intégration copié (iframe, widget, intranet), e-mail préparé. Aucune donnée
-- d'apprenant ; les vues par site intégrant sont calculées à partir des événements existants.

create table if not exists public.diffusions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  kind text not null check (kind in ('scorm', 'intranet', 'widget', 'iframe', 'email')),
  label text not null check (char_length(label) between 1 and 120),
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 2048),
  version_id uuid references public.demo_versions (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  uses int not null default 1 check (uses >= 1),
  unique (demo_id, kind, label)
);
create index if not exists diffusions_ws_idx on public.diffusions (workspace_id);

alter table public.diffusions enable row level security;
revoke all on public.diffusions from public, anon, authenticated;
grant select, delete on public.diffusions to authenticated;

drop policy if exists diffusions_select on public.diffusions;
create policy diffusions_select on public.diffusions for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));
drop policy if exists diffusions_delete on public.diffusions;
create policy diffusions_delete on public.diffusions for delete to authenticated
  using (public.has_role(workspace_id, 'editor'));

-- Enregistre (ou rafraîchit) une diffusion : éditeur et plus, module non supprimé.
create or replace function public.record_diffusion(p_demo uuid, p_kind text, p_label text, p_settings jsonb default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_ws uuid;
  v_version uuid;
  v_id uuid;
begin
  select workspace_id, current_version_id into v_ws, v_version
    from public.demos where id = p_demo and deleted_at is null;
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
end $$;

-- Vues par site intégrant (événements demo_view avec embed_origin), 90 derniers jours, 20 sites.
create or replace function public.demo_embed_views(p_demo uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.demos where id = p_demo;
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
end $$;

revoke all on function public.record_diffusion(uuid, text, text, jsonb), public.demo_embed_views(uuid)
  from public, anon;
grant execute on function public.record_diffusion(uuid, text, text, jsonb), public.demo_embed_views(uuid)
  to authenticated;
