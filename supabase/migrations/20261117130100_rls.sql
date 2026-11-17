-- FlowDSIML — Row Level Security
-- Principe : anon n'a accès à AUCUNE table (le player passe par Storage public et des RPC contrôlées).
-- Les droits reposent sur public.has_role(workspace_id, rôle minimal).

do $$
declare t text;
begin
  foreach t in array array[
    'plans', 'profiles', 'workspaces', 'members', 'invitations', 'folders', 'themes', 'variables',
    'demos', 'chapters', 'forms', 'steps', 'hotspots', 'demo_versions', 'share_links', 'leads',
    'subscriptions', 'events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Helper pour (re)créer une politique de façon idempotente.
create or replace function pg_temp.policy(tbl text, name text, cmd text, using_expr text, check_expr text default null)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I', name, tbl);
  execute format(
    'create policy %I on public.%I for %s to authenticated %s %s',
    name, tbl, cmd,
    case when using_expr is not null then 'using (' || using_expr || ')' else '' end,
    case when check_expr is not null then 'with check (' || check_expr || ')' else '' end
  );
end $$;

-- plans : lecture publique (page tarifs)
grant select on public.plans to anon;
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to anon, authenticated using (true);

-- profiles : soi-même + co-membres
select pg_temp.policy('profiles', 'profiles_select', 'select',
  'id = (select auth.uid()) or exists (select 1 from public.members a join public.members b on a.workspace_id = b.workspace_id where a.user_id = (select auth.uid()) and b.user_id = profiles.id)');
select pg_temp.policy('profiles', 'profiles_update', 'update', 'id = (select auth.uid())', 'id = (select auth.uid())');

-- workspaces
select pg_temp.policy('workspaces', 'ws_select', 'select', 'public.has_role(id, ''viewer'')');
select pg_temp.policy('workspaces', 'ws_update', 'update', 'public.has_role(id, ''admin'')', 'public.has_role(id, ''admin'')');
select pg_temp.policy('workspaces', 'ws_delete', 'delete', 'public.has_role(id, ''owner'')');
-- Le plan ne se change pas depuis le client : UPDATE limité à certaines colonnes.
revoke update on public.workspaces from authenticated;
grant update (name, slug, logo_path, settings) on public.workspaces to authenticated;

-- members
select pg_temp.policy('members', 'members_select', 'select', 'public.has_role(workspace_id, ''viewer'')');
select pg_temp.policy('members', 'members_update', 'update',
  'public.has_role(workspace_id, ''admin'')', 'public.has_role(workspace_id, ''admin'')');
select pg_temp.policy('members', 'members_delete', 'delete',
  'public.has_role(workspace_id, ''admin'') or user_id = (select auth.uid())');
-- insertion uniquement via RPC (create_workspace, accept_invitation) ; seul le rôle est modifiable
revoke insert on public.members from authenticated;
revoke update on public.members from authenticated;
grant update (role) on public.members to authenticated;

-- invitations
select pg_temp.policy('invitations', 'inv_select', 'select', 'public.has_role(workspace_id, ''admin'')');
select pg_temp.policy('invitations', 'inv_insert', 'insert', null,
  'public.has_role(workspace_id, ''admin'') and (role <> ''owner'' or public.has_role(workspace_id, ''owner'')) and invited_by = (select auth.uid())');
select pg_temp.policy('invitations', 'inv_delete', 'delete', 'public.has_role(workspace_id, ''admin'')');

-- Tables de contenu : lecture viewer, écriture editor.
do $$
declare t text;
begin
  foreach t in array array['folders', 'themes', 'variables', 'demos', 'chapters', 'forms', 'steps', 'hotspots', 'share_links'] loop
    perform pg_temp.policy(t, t || '_select', 'select', 'public.has_role(workspace_id, ''viewer'')');
    perform pg_temp.policy(t, t || '_insert', 'insert', null, 'public.has_role(workspace_id, ''editor'')');
    perform pg_temp.policy(t, t || '_update', 'update', 'public.has_role(workspace_id, ''editor'')', 'public.has_role(workspace_id, ''editor'')');
    perform pg_temp.policy(t, t || '_delete', 'delete', 'public.has_role(workspace_id, ''editor'')');
  end loop;
end $$;

-- Le statut et la version courante d'une démo ne changent que via publish_demo / unpublish_demo.
revoke update on public.demos from authenticated;
grant update (folder_id, title, theme_id, settings, cover_path, deleted_at) on public.demos to authenticated;

-- demo_versions : lecture seule (écriture via publish_demo)
select pg_temp.policy('demo_versions', 'versions_select', 'select', 'public.has_role(workspace_id, ''viewer'')');

-- leads : données personnelles → editor minimum ; suppression admin (droit à l'effacement)
select pg_temp.policy('leads', 'leads_select', 'select', 'public.has_role(workspace_id, ''editor'')');
select pg_temp.policy('leads', 'leads_delete', 'delete', 'public.has_role(workspace_id, ''admin'')');

-- events : lecture viewer ; insertion via track_events / Edge Function uniquement
select pg_temp.policy('events', 'events_select', 'select', 'public.has_role(workspace_id, ''viewer'')');

-- subscriptions : lecture membres
select pg_temp.policy('subscriptions', 'subs_select', 'select', 'public.has_role(workspace_id, ''viewer'')');
