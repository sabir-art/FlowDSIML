-- FlowDSIML — Commentaires internes par étape (panneau « Commentaires » de l'éditeur).
-- Internes à l'équipe : jamais publiés dans le manifeste ni visibles dans le player
-- (publish_demo ne lit pas cette table ; anon n'y a aucun accès).
-- Idempotent, additif.

create table if not exists public.step_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  demo_id uuid not null references public.demos (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists step_comments_step_idx on public.step_comments (step_id, created_at);
create index if not exists step_comments_demo_idx on public.step_comments (demo_id) where resolved_at is null;

-- Contexte dérivé de l'étape (empêche un rattachement croisé) ; auteur = utilisateur connecté.
create or replace function public.step_comments_context() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select s.workspace_id, s.demo_id into new.workspace_id, new.demo_id from public.steps s where s.id = new.step_id;
    if new.workspace_id is null then raise exception 'STEP_NOT_FOUND'; end if;
    if auth.uid() is not null then new.author_id := auth.uid(); end if;
  else
    -- Seul le texte change par UPDATE direct ; la résolution passe par set_comment_resolved.
    new.workspace_id := old.workspace_id;
    new.demo_id := old.demo_id;
    new.step_id := old.step_id;
    new.author_id := old.author_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists step_comments_context on public.step_comments;
create trigger step_comments_context before insert or update on public.step_comments
  for each row execute function public.step_comments_context();

alter table public.step_comments enable row level security;
revoke all on public.step_comments from anon;
grant select, insert, delete on public.step_comments to authenticated;
revoke update on public.step_comments from authenticated;
grant update (body) on public.step_comments to authenticated;

drop policy if exists step_comments_select on public.step_comments;
create policy step_comments_select on public.step_comments for select to authenticated
  using (public.has_role(workspace_id, 'viewer'));
-- Tout membre (viewer compris) peut commenter, en son nom.
drop policy if exists step_comments_insert on public.step_comments;
create policy step_comments_insert on public.step_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and public.has_role(workspace_id, 'viewer'));
-- Modifier : l'auteur seulement. Supprimer : l'auteur, ou admin et plus.
drop policy if exists step_comments_update on public.step_comments;
create policy step_comments_update on public.step_comments for update to authenticated
  using (author_id = (select auth.uid()) and public.has_role(workspace_id, 'viewer'))
  with check (author_id = (select auth.uid()));
drop policy if exists step_comments_delete on public.step_comments;
create policy step_comments_delete on public.step_comments for delete to authenticated
  using ((author_id = (select auth.uid()) and public.has_role(workspace_id, 'viewer'))
         or public.has_role(workspace_id, 'admin'));

-- Résoudre / rouvrir : l'auteur, ou tout éditeur et plus.
create or replace function public.set_comment_resolved(p_comment uuid, p_resolved boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.step_comments;
begin
  select * into c from public.step_comments where id = p_comment;
  if c.id is null then raise exception 'COMMENT_NOT_FOUND'; end if;
  if not (public.has_role(c.workspace_id, 'editor')
          or (c.author_id = auth.uid() and public.has_role(c.workspace_id, 'viewer'))) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  update public.step_comments
    set resolved_at = case when p_resolved then now() end,
        resolved_by = case when p_resolved then auth.uid() end
    where id = p_comment;
end $$;
revoke all on function public.set_comment_resolved(uuid, boolean) from public, anon;
grant execute on function public.set_comment_resolved(uuid, boolean) to authenticated;

-- Temps réel : la table rejoint la publication supabase_realtime (si elle existe, une seule fois).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'step_comments') then
    execute 'alter publication supabase_realtime add table public.step_comments';
  end if;
end $$;
