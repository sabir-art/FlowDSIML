-- L26-01 et L26 §3.4 : prise en main d'un espace et parcours « Apprendre TutoClick ».
--  * profiles.extension_seen_at : l'extension a répondu au moins une fois (RPC extension_seen, appelée par
--    l'extension après connexion).
--  * onboarding_prefs : « Masquer la prise en main », pour la personne (et l'espace).
--  * onboarding_done : date du 7 sur 7 (« Votre espace est prêt » pendant 7 jours).
--  * workspace_onboarding(p_ws) : les 7 étapes, calculées côté serveur (éditeurs et plus).
--  * learn_progress : modules terminés du parcours « Apprendre TutoClick », par personne.

alter table public.profiles add column if not exists extension_seen_at timestamptz;

create or replace function public.extension_seen() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Accès refusé' using errcode = '42501'; end if;
  update public.profiles set extension_seen_at = coalesce(extension_seen_at, now()) where id = (select auth.uid());
end $$;
revoke all on function public.extension_seen() from public, anon;
grant execute on function public.extension_seen() to authenticated;

create table if not exists public.onboarding_prefs (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  hidden_at timestamptz,
  primary key (user_id, workspace_id)
);
alter table public.onboarding_prefs enable row level security;
revoke all on public.onboarding_prefs from anon;
grant select, insert, update, delete on public.onboarding_prefs to authenticated;
drop policy if exists onboarding_prefs_own on public.onboarding_prefs;
create policy onboarding_prefs_own on public.onboarding_prefs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.has_role(workspace_id, 'viewer'));

create table if not exists public.onboarding_done (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  done_at timestamptz not null default now()
);
alter table public.onboarding_done enable row level security;
revoke all on public.onboarding_done from anon, authenticated;

create or replace function public.workspace_onboarding(p_ws uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s jsonb;
  v_done timestamptz;
begin
  if not public.has_role(p_ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  s := jsonb_build_object(
    'brand', exists (select 1 from public.workspaces w where w.id = p_ws and w.logo_path is not null)
             or exists (select 1 from public.themes t where t.workspace_id = p_ws and t.is_default and t.tokens <> '{}'::jsonb),
    'extension', exists (select 1 from public.members m join public.profiles p on p.id = m.user_id
                         where m.workspace_id = p_ws and p.extension_seen_at is not null),
    'capture', exists (select 1 from public.steps st join public.demos d on d.id = st.demo_id
                       where st.workspace_id = p_ws and d.deleted_at is null and st.image_path is not null),
    -- Capture passée par l'écran de vérification des données de l'extension (F1 §1)
    'pii', exists (select 1 from public.steps st join public.demos d on d.id = st.demo_id
                   where st.workspace_id = p_ws and d.deleted_at is null and st.element_meta ? 'pii'),
    'publish', exists (select 1 from public.demos d where d.workspace_id = p_ws and d.deleted_at is null and d.status = 'published'),
    'invite', (select count(*) from public.members m where m.workspace_id = p_ws) >= 2,
    'distribute', exists (select 1 from public.share_links l where l.workspace_id = p_ws and l.variables <> '{}'::jsonb)
                  or exists (select 1 from public.diffusions x where x.workspace_id = p_ws)
                  or exists (select 1 from public.demo_pages pg where pg.workspace_id = p_ws and pg.enabled)
  );
  select done_at into v_done from public.onboarding_done where workspace_id = p_ws;
  if v_done is null and not exists (select 1 from jsonb_each(s) e where e.value = 'false'::jsonb) then
    insert into public.onboarding_done (workspace_id) values (p_ws) on conflict do nothing
      returning done_at into v_done;
  end if;
  return jsonb_build_object(
    'steps', s,
    'doneAt', v_done,
    'hiddenAt', (select hidden_at from public.onboarding_prefs where user_id = (select auth.uid()) and workspace_id = p_ws)
  );
end $$;
revoke all on function public.workspace_onboarding(uuid) from public, anon;
grant execute on function public.workspace_onboarding(uuid) to authenticated;

create table if not exists public.learn_progress (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  module text not null check (module in ('capturer', 'modifier', 'flouter', 'publier', 'diffuser', 'statistiques')),
  done_at timestamptz not null default now(),
  primary key (user_id, module)
);
alter table public.learn_progress enable row level security;
revoke all on public.learn_progress from anon;
grant select, insert, delete on public.learn_progress to authenticated;
drop policy if exists learn_progress_own on public.learn_progress;
create policy learn_progress_own on public.learn_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
