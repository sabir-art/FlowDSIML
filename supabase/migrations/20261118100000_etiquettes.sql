-- FlowDSIML — L12-07 : étiquettes des démos (organiser et filtrer par outil, public ou module).
-- Idempotent, additif.
--  * tags : étiquettes du workspace (nom unique sans tenir compte de la casse, une des 5 couleurs de la
--    palette DSI). 20 au plus par workspace.
--  * demo_tags : étiquettes d'une démo, 5 au plus par démo. Démo et étiquette du même workspace.
--  * RLS : lecture dès viewer, écriture éditeur (comme les dossiers).
--  * duplicate_demo n'est pas modifiée : la copie ne reprend pas les étiquettes.

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 32),
  color text not null default 'blue' check (color in ('blue', 'green', 'orange', 'raspberry', 'plum')),
  created_at timestamptz not null default now()
);
create unique index if not exists tags_ws_name_idx on public.tags (workspace_id, lower(btrim(name)));

create table if not exists public.demo_tags (
  demo_id uuid not null references public.demos (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (demo_id, tag_id)
);
create index if not exists demo_tags_tag_idx on public.demo_tags (tag_id);

alter table public.tags enable row level security;
alter table public.demo_tags enable row level security;
grant select, insert, update, delete on public.tags, public.demo_tags to authenticated;

do $$
declare t text;
begin
  foreach t in array array['tags', 'demo_tags'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_role(workspace_id, ''viewer''))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(workspace_id, ''editor''))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(workspace_id, ''editor'')) with check (public.has_role(workspace_id, ''editor''))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_role(workspace_id, ''editor''))', t || '_delete', t);
  end loop;
end $$;

-- Limites et cohérence (démo et étiquette du même workspace)
create or replace function public.tags_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.tags where workspace_id = new.workspace_id) >= 20 then
    raise exception 'TAG_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.tags_guard() from public, anon, authenticated;
drop trigger if exists tags_guard on public.tags;
create trigger tags_guard before insert on public.tags for each row execute function public.tags_guard();

create or replace function public.demo_tags_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.demos d join public.tags t on t.workspace_id = d.workspace_id
                 where d.id = new.demo_id and t.id = new.tag_id and d.workspace_id = new.workspace_id) then
    raise exception 'TAG_WORKSPACE' using errcode = 'P0001';
  end if;
  if (select count(*) from public.demo_tags where demo_id = new.demo_id) >= 5 then
    raise exception 'DEMO_TAG_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.demo_tags_guard() from public, anon, authenticated;
drop trigger if exists demo_tags_guard on public.demo_tags;
create trigger demo_tags_guard before insert on public.demo_tags for each row execute function public.demo_tags_guard();

-- L'étiquette d'une démo ne change pas de démo ni de workspace (ajout / retrait seulement)
revoke update on public.demo_tags from authenticated;
-- Une étiquette ne change pas de workspace
revoke update on public.tags from authenticated;
grant update (name, color) on public.tags to authenticated;
