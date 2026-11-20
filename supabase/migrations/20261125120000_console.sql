-- L41 : retours sur l'aide et Console propriétaire (équipe TutoClick, hors de tout espace client).
--
-- Accès : aucune table n'est lisible ni modifiable par anon ou authenticated (aucun grant). Tout passe
-- par des RPC security definer :
--   * côté client (tout compte connecté) : vote et commentaire sur un article, réponse enregistrée,
--     annonces publiées et point de nouveauté ;
--   * console : lecture si is_platform_owner(), écriture si is_platform_admin() ; chaque écriture ajoute
--     sa ligne au journal dans la même transaction. Aucune RPC ne renvoie l'auteur d'un retour.
-- platform_admins : aucune ligne insérée ici (le premier admin est créé en SQL par l'exploitation).

-- Article d'aide de la console (L51, lot 2) : réservé, côté app, aux comptes qui ont un rôle dans la console
insert into public.help_articles (slug) values ('console-proprietaire') on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'read_only' check (role in ('admin', 'read_only')),
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now()
);

create table if not exists public.improvement_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'triage' check (status in ('triage', 'planned', 'in_progress', 'done', 'rejected')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  article text references public.help_articles (slug) on delete set null,
  note text not null default '' check (char_length(note) <= 2000),
  reject_reason text check (char_length(reject_reason) <= 280),
  -- Lien seulement (aucun appel à GitHub) : ticket ou demande de fusion
  github_url text check (github_url ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/(issues|pull)/[0-9]{1,9}$'),
  announced_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'rejected' or char_length(btrim(coalesce(reject_reason, ''))) > 0)
);

create table if not exists public.improvement_history (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.improvement_items (id) on delete cascade,
  status text not null,
  actor_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists improvement_history_item on public.improvement_history (item_id, at);

create table if not exists public.help_feedback_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  article text not null references public.help_articles (slug) on delete cascade,
  helpful boolean not null,
  page text not null default '' check (page ~ '^[a-z0-9.-]{0,60}$'),
  author_id uuid references auth.users (id) on delete set null,
  -- Réponse en vigueur ; une réponse remplacée n'est gardée que pour le commentaire qu'elle porte
  is_current boolean not null default true,
  comment text check (char_length(comment) between 1 and 500),
  comment_status text check (comment_status in ('new', 'linked', 'archived')),
  backlog_item_id uuid references public.improvement_items (id) on delete set null,
  comment_at timestamptz,
  created_at timestamptz not null default now(),
  check ((comment is null) = (comment_status is null))
);
create unique index if not exists help_feedback_entries_one on public.help_feedback_entries (workspace_id, article, author_id)
  where is_current;
create index if not exists help_feedback_entries_created on public.help_feedback_entries (created_at);
create index if not exists help_feedback_entries_item on public.help_feedback_entries (backlog_item_id);

create table if not exists public.console_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action ~ '^[a-z_.]{1,40}$'),
  object_type text not null default '' check (char_length(object_type) <= 20),
  object_id text not null default '' check (char_length(object_id) <= 60),
  object_label text not null default '' check (char_length(object_label) <= 200)
);
create index if not exists console_audit_at on public.console_audit (at desc);

create table if not exists public.product_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 90),
  body text not null check (char_length(btrim(body)) between 1 and 400),
  article text references public.help_articles (slug) on delete set null,
  item_id uuid references public.improvement_items (id) on delete set null,
  state text not null default 'draft' check (state in ('draft', 'published', 'withdrawn')),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news_seen (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['platform_admins', 'improvement_items', 'improvement_history', 'help_feedback_entries',
                           'console_audit', 'product_news', 'news_seen'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Garde-fous
-- ---------------------------------------------------------------------------
-- Au moins un admin ; personne ne change ni ne retire son propre rôle. La suppression de son propre
-- compte (cascade depuis auth.users) reste possible.
create or replace function private.guard_platform_admins()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then return null; end if;
  if old.user_id = (select auth.uid()) then raise exception 'OWN_ROLE' using errcode = '42501'; end if;
  if not exists (select 1 from public.platform_admins where role = 'admin') then
    raise exception 'LAST_ADMIN' using errcode = '23514';
  end if;
  return null;
end $$;
drop trigger if exists platform_admins_guard on public.platform_admins;
create trigger platform_admins_guard after update or delete on public.platform_admins
  for each row execute function private.guard_platform_admins();

-- Journal : ni modification ni suppression (hors purge à 12 mois, qui pose app.console_purge)
create or replace function private.guard_console_audit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('app.console_purge', true) = 'on' then return old; end if;
  raise exception 'AUDIT_READ_ONLY' using errcode = '42501';
end $$;
drop trigger if exists console_audit_ro on public.console_audit;
create trigger console_audit_ro before update or delete on public.console_audit
  for each row execute function private.guard_console_audit();
drop trigger if exists console_audit_no_truncate on public.console_audit;
create trigger console_audit_no_truncate before truncate on public.console_audit
  for each statement execute function private.guard_console_audit();

-- Compte supprimé (author_id → null) ou espace supprimé (workspace_id → null) : le commentaire est
-- effacé, le vote reste compté
create or replace function private.forget_help_comment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (old.author_id is not null and new.author_id is null) or (old.workspace_id is not null and new.workspace_id is null) then
    new.comment := null;
    new.comment_status := null;
    new.comment_at := null;
  end if;
  return new;
end $$;
drop trigger if exists help_feedback_entries_forget on public.help_feedback_entries;
create trigger help_feedback_entries_forget before update on public.help_feedback_entries
  for each row execute function private.forget_help_comment();

-- ---------------------------------------------------------------------------
-- Rôles de la plateforme
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_platform_owner() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function private.console_read()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_owner() then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
end $$;
create or replace function private.console_write()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'NOT_FOUND' using errcode = '42501'; end if;
end $$;
create or replace function private.console_log(p_action text, p_type text, p_id text, p_label text)
returns void language sql security definer set search_path = '' as $$
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label)
  values ((select auth.uid()), p_action, coalesce(p_type, ''), coalesce(p_id, ''), left(coalesce(p_label, ''), 200));
$$;
revoke all on function private.console_read() from public, anon, authenticated;
revoke all on function private.console_write() from public, anon, authenticated;
revoke all on function private.console_log(text, text, text, text) from public, anon, authenticated;

-- Donnée personnelle : adresse e-mail ou numéro de 9 chiffres ou plus (espaces et points ignorés)
create or replace function private.has_personal_data(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' or regexp_replace(p, '[\s.]', '', 'g') ~ '[0-9]{9,}';
$$;

-- Ancien compteur anonyme (L26-02) : remplacé par les agrégats calculés sur help_feedback_entries.
-- La table reste (historique, lecture réservée au service) ; sa RPC n'a plus d'appelant.
drop function if exists public.help_feedback(text, boolean);

-- ---------------------------------------------------------------------------
-- Côté client : vote, commentaire, réponse enregistrée
-- ---------------------------------------------------------------------------
create or replace function public.help_vote(p_article text, p_helpful boolean, p_page text, p_workspace uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null or p_workspace is null or not public.has_role(p_workspace, 'viewer') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_helpful is null or not exists (select 1 from public.help_articles where slug = p_article) then
    raise exception 'ARTICLE_INVALID';
  end if;
  if coalesce(p_page, '') !~ '^[a-z0-9.-]{0,60}$' then raise exception 'PAGE_INVALID'; end if;
  -- Une réponse par article et par personne dans l'espace : la nouvelle remplace l'ancienne ;
  -- un commentaire déjà envoyé reste lié à l'ancienne réponse
  delete from public.help_feedback_entries
   where workspace_id = p_workspace and article = p_article and author_id = v_uid and is_current and comment is null;
  update public.help_feedback_entries set is_current = false
   where workspace_id = p_workspace and article = p_article and author_id = v_uid and is_current;
  insert into public.help_feedback_entries (workspace_id, article, helpful, page, author_id)
  values (p_workspace, p_article, p_helpful, coalesce(p_page, ''), v_uid)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.help_comment(p_entry uuid, p_text text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_text text := btrim(coalesce(p_text, ''));
begin
  if v_uid is null then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if char_length(v_text) not between 1 and 500 then raise exception 'COMMENT_LENGTH'; end if;
  if private.has_personal_data(v_text) then raise exception 'PERSONAL_DATA'; end if;
  if (select count(*) from public.help_feedback_entries
       where author_id = v_uid and comment_at > now() - interval '1 day') >= 20 then
    raise exception 'RATE_LIMIT';
  end if;
  update public.help_feedback_entries
     set comment = v_text, comment_status = 'new', comment_at = now()
   where id = p_entry and author_id = v_uid and is_current and not helpful and comment is null;
  if not found then raise exception 'ENTRY_INVALID'; end if;
end $$;

create or replace function public.my_help_vote(p_article text, p_workspace uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', id, 'helpful', helpful, 'commented', comment is not null)
    from public.help_feedback_entries
   where author_id = (select auth.uid()) and workspace_id = p_workspace and article = p_article and is_current;
$$;

-- ---------------------------------------------------------------------------
-- Côté client : Nouveautés (annonces publiées seulement)
-- ---------------------------------------------------------------------------
create or replace function public.list_product_news()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'article', n.article,
                                               'publishedAt', n.published_at,
                                               'unread', n.published_at > coalesce(s.last_seen_at, '-infinity'))
                            order by n.published_at desc), '[]'::jsonb)
    from public.product_news n
    left join public.news_seen s on s.user_id = (select auth.uid())
   where n.state = 'published' and (select auth.uid()) is not null;
$$;
create or replace function public.news_unseen_count()
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.product_news n
   where n.state = 'published' and (select auth.uid()) is not null
     and n.published_at > coalesce((select last_seen_at from public.news_seen where user_id = (select auth.uid())),
                                   '-infinity');
$$;
create or replace function public.news_mark_seen()
returns void language sql security definer set search_path = '' as $$
  insert into public.news_seen (user_id, last_seen_at) select (select auth.uid()), now()
   where (select auth.uid()) is not null
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
$$;

-- ---------------------------------------------------------------------------
-- Console : lecture (propriétaires de la plateforme)
-- ---------------------------------------------------------------------------
-- Rôle du compte connecté dans la console (null pour tout autre compte : rien n'est révélé)
create or replace function public.console_me()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.platform_admins where user_id = (select auth.uid());
$$;

create or replace function public.console_overview(p_days int default 90)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 366)));
begin
  perform private.console_read();
  return jsonb_build_object(
    'yes', (select count(*) from public.help_feedback_entries where is_current and helpful and created_at >= v_from),
    'no', (select count(*) from public.help_feedback_entries where is_current and not helpful and created_at >= v_from),
    'articles', (select count(distinct article) from public.help_feedback_entries where is_current and created_at >= v_from),
    'newComments', (select count(*) from public.help_feedback_entries where comment_status = 'new'),
    'triage', (select count(*) from public.improvement_items where status = 'triage'),
    'activity', coalesce((select jsonb_agg(x order by (x ->> 'at') desc) from (
        select jsonb_build_object('at', a.at, 'action', a.action, 'objectType', a.object_type,
                                  'label', a.object_label, 'actor', coalesce(p.full_name, ''),
                                  'actorEmail', coalesce(u.email, '')) as x
          from public.console_audit a
          left join auth.users u on u.id = a.actor_id
          left join public.profiles p on p.id = a.actor_id
         where a.action <> 'console.open'
         order by a.at desc limit 4) y), '[]'::jsonb));
end $$;

create or replace function public.console_workspaces()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.console_read();
  return coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name) order by w.name)
                     from public.workspaces w
                    where exists (select 1 from public.help_feedback_entries e where e.workspace_id = w.id)), '[]'::jsonb);
end $$;

create or replace function public.console_articles(p_days int default 90, p_workspace uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 366)));
begin
  perform private.console_read();
  return coalesce((select jsonb_agg(jsonb_build_object('article', a.slug, 'yes', a.yes, 'no', a.no,
                                                       'comments', a.comments, 'items', a.items))
    from (select h.slug,
                 count(*) filter (where e.is_current and e.helpful) as yes,
                 count(*) filter (where e.is_current and not e.helpful) as no,
                 count(*) filter (where e.comment is not null) as comments,
                 (select count(*) from public.improvement_items i
                   where i.article = h.slug and i.status not in ('done', 'rejected')) as items
            from public.help_articles h
            join public.help_feedback_entries e on e.article = h.slug and e.created_at >= v_from
                 and (p_workspace is null or e.workspace_id = p_workspace)
           group by h.slug) a), '[]'::jsonb);
end $$;

create or replace function public.console_comments(p_days int default 90, p_workspace uuid default null,
                                                    p_article text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_from timestamptz := now() - make_interval(days => greatest(1, least(p_days, 366)));
begin
  perform private.console_read();
  -- Jamais l'auteur : article, page, nom de l'espace, date, texte, statut, élément rattaché
  return coalesce((select jsonb_agg(jsonb_build_object(
             'id', e.id, 'article', e.article, 'page', e.page,
             'workspace', coalesce(w.name, ''), 'at', e.comment_at, 'text', e.comment,
             'status', e.comment_status, 'itemId', e.backlog_item_id, 'itemTitle', i.title)
           order by e.comment_at desc)
      from public.help_feedback_entries e
      left join public.workspaces w on w.id = e.workspace_id
      left join public.improvement_items i on i.id = e.backlog_item_id
     where e.comment is not null and e.comment_at >= v_from
       and (p_workspace is null or e.workspace_id = p_workspace)
       and (p_article is null or e.article = p_article)), '[]'::jsonb);
end $$;

create or replace function public.console_items()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.console_read();
  return coalesce((select jsonb_agg(jsonb_build_object(
             'id', i.id, 'title', i.title, 'status', i.status, 'priority', i.priority, 'article', i.article,
             'githubUrl', i.github_url, 'rejectReason', i.reject_reason, 'note', i.note,
             'announced', exists (select 1 from public.product_news n where n.item_id = i.id and n.state = 'published'),
             'feedback', (select count(*) from public.help_feedback_entries e where e.backlog_item_id = i.id),
             'createdAt', i.created_at, 'updatedAt', i.updated_at)
           order by i.updated_at desc)
      from public.improvement_items i), '[]'::jsonb);
end $$;

create or replace function public.console_item(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.console_read();
  return (select jsonb_build_object(
      'id', i.id, 'title', i.title, 'status', i.status, 'priority', i.priority, 'article', i.article,
      'githubUrl', i.github_url, 'rejectReason', i.reject_reason, 'note', i.note, 'announcedAt', i.announced_at,
      'announced', exists (select 1 from public.product_news n where n.item_id = i.id and n.state = 'published'),
      'feedback', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'article', e.article,
                                    'workspace', coalesce(w.name, ''), 'at', e.comment_at, 'text', e.comment)
                                  order by e.comment_at desc)
                             from public.help_feedback_entries e left join public.workspaces w on w.id = e.workspace_id
                            where e.backlog_item_id = i.id), '[]'::jsonb),
      'history', coalesce((select jsonb_agg(jsonb_build_object('status', h.status, 'at', h.at,
                                    'actor', coalesce(p.full_name, u.email, '')) order by h.at)
                             from public.improvement_history h
                             left join auth.users u on u.id = h.actor_id
                             left join public.profiles p on p.id = h.actor_id
                            where h.item_id = i.id), '[]'::jsonb))
    from public.improvement_items i where i.id = p_id);
end $$;

create or replace function public.console_news()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.console_read();
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body,
                                                       'article', n.article, 'itemId', n.item_id, 'itemTitle', i.title,
                                                       'state', n.state, 'publishedAt', n.published_at,
                                                       'updatedAt', n.updated_at)
                                    order by coalesce(n.published_at, n.updated_at) desc)
                     from public.product_news n left join public.improvement_items i on i.id = n.item_id), '[]'::jsonb);
end $$;

-- Équipe : ce sont des comptes de l'équipe TutoClick (jamais des répondants)
create or replace function public.console_team()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.console_read();
  return coalesce((select jsonb_agg(jsonb_build_object(
             'userId', a.user_id, 'email', u.email, 'name', coalesce(p.full_name, ''), 'role', a.role,
             'me', a.user_id = (select auth.uid()),
             'lastActivity', (select max(c.at) from public.console_audit c where c.actor_id = a.user_id))
           order by a.added_at)
      from public.platform_admins a
      join auth.users u on u.id = a.user_id
      left join public.profiles p on p.id = a.user_id), '[]'::jsonb);
end $$;

create or replace function public.console_audit_list(p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.console_read();
  return coalesce((select jsonb_agg(x order by (x ->> 'at') desc) from (
      select jsonb_build_object('id', a.id, 'at', a.at, 'actor', coalesce(p.full_name, u.email, ''),
                                'actorId', a.actor_id, 'action', a.action, 'objectType', a.object_type,
                                'label', a.object_label) as x
        from public.console_audit a
        left join auth.users u on u.id = a.actor_id
        left join public.profiles p on p.id = a.actor_id
       order by a.at desc limit greatest(1, least(p_limit, 2000))) y), '[]'::jsonb);
end $$;

-- Ouverture de la console et exports : tracés pour tout propriétaire (lecture seule comprise)
create or replace function public.console_log_event(p_action text, p_label text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.console_read();
  if p_action not in ('console.open', 'export.articles', 'export.comments', 'export.backlog', 'export.audit') then
    raise exception 'ACTION_INVALID';
  end if;
  perform private.console_log(p_action, 'console', '', left(coalesce(p_label, ''), 80));
end $$;

-- ---------------------------------------------------------------------------
-- Console : écriture (admins de la plateforme), journalisée
-- ---------------------------------------------------------------------------
create or replace function private.item_label(p_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select title from public.improvement_items where id = p_id;
$$;

create or replace function public.console_create_item(p_title text, p_priority text default 'medium',
                                                       p_article text default null, p_github_url text default null,
                                                       p_comments uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.console_write();
  insert into public.improvement_items (title, priority, article, github_url, created_by, updated_by)
  values (btrim(p_title), coalesce(p_priority, 'medium'), nullif(p_article, ''), nullif(btrim(coalesce(p_github_url, '')), ''),
          (select auth.uid()), (select auth.uid()))
  returning id into v_id;
  insert into public.improvement_history (item_id, status, actor_id) values (v_id, 'triage', (select auth.uid()));
  perform private.console_log('item.create', 'item', v_id::text, btrim(p_title));
  if coalesce(cardinality(p_comments), 0) > 0 then perform public.console_link_comments(v_id, p_comments); end if;
  return v_id;
end $$;

create or replace function public.console_update_item(p_id uuid, p_patch jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old public.improvement_items;
  v_new public.improvement_items;
begin
  perform private.console_write();
  select * into v_old from public.improvement_items where id = p_id for update;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  if p_patch ->> 'status' = 'rejected'
     and char_length(btrim(coalesce(p_patch ->> 'rejectReason', v_old.reject_reason, ''))) = 0 then
    raise exception 'REJECT_REASON';
  end if;
  update public.improvement_items set
    title = coalesce(btrim(p_patch ->> 'title'), title),
    priority = coalesce(p_patch ->> 'priority', priority),
    article = case when p_patch ? 'article' then nullif(p_patch ->> 'article', '') else article end,
    note = coalesce(p_patch ->> 'note', note),
    github_url = case when p_patch ? 'githubUrl' then nullif(btrim(coalesce(p_patch ->> 'githubUrl', '')), '') else github_url end,
    status = coalesce(p_patch ->> 'status', status),
    reject_reason = case when coalesce(p_patch ->> 'status', status) = 'rejected'
                         then coalesce(nullif(btrim(p_patch ->> 'rejectReason'), ''), reject_reason) else null end,
    updated_by = (select auth.uid()), updated_at = now()
  where id = p_id
  returning * into v_new;
  if v_new.status is distinct from v_old.status then
    insert into public.improvement_history (item_id, status, actor_id) values (p_id, v_new.status, (select auth.uid()));
    perform private.console_log('item.status.' || v_new.status, 'item', p_id::text, v_new.title);
  end if;
  if v_new.priority is distinct from v_old.priority then
    perform private.console_log('item.priority', 'item', p_id::text, v_new.title);
  end if;
  if v_new.github_url is distinct from v_old.github_url then
    perform private.console_log('item.ticket', 'item', p_id::text, v_new.title);
  end if;
  if v_new.title is distinct from v_old.title or v_new.article is distinct from v_old.article
     or v_new.note is distinct from v_old.note then
    perform private.console_log('item.edit', 'item', p_id::text, v_new.title);
  end if;
end $$;

create or replace function public.console_link_comments(p_item uuid, p_comments uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform private.console_write();
  if not exists (select 1 from public.improvement_items where id = p_item and status not in ('done', 'rejected')) then
    raise exception 'ITEM_CLOSED';
  end if;
  update public.help_feedback_entries set comment_status = 'linked', backlog_item_id = p_item
   where id = any (p_comments) and comment is not null;
  get diagnostics v_n = row_count;
  perform private.console_log('feedback.link', 'item', p_item::text, private.item_label(p_item) || ' (' || v_n || ')');
  return (select count(*) from public.help_feedback_entries where backlog_item_id = p_item);
end $$;

-- Remettre à « Nouveau » (détacher ou annuler un classement) ou classer sans suite
create or replace function public.console_set_comments(p_comments uuid[], p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  perform private.console_write();
  if p_status not in ('new', 'archived') then raise exception 'STATUS_INVALID'; end if;
  update public.help_feedback_entries set comment_status = p_status, backlog_item_id = null
   where id = any (p_comments) and comment is not null;
  get diagnostics v_n = row_count;
  perform private.console_log(case p_status when 'new' then 'feedback.reopen' else 'feedback.archive' end,
                              'feedback', '', v_n || ' commentaire(s)');
end $$;

create or replace function public.console_delete_comment(p_comment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_article text;
begin
  perform private.console_write();
  update public.help_feedback_entries set comment = null, comment_status = null, comment_at = null, backlog_item_id = null
   where id = p_comment and comment is not null
  returning article into v_article;
  if v_article is null then raise exception 'COMMENT_NOT_FOUND'; end if;
  -- Le journal ne garde que l'article, jamais le texte
  perform private.console_log('feedback.delete', 'article', v_article, v_article);
end $$;

create or replace function public.console_save_news(p_id uuid, p_title text, p_body text, p_article text,
                                                     p_item uuid, p_publish boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_was text;
begin
  perform private.console_write();
  if v_id is null then
    insert into public.product_news (title, body, article, item_id, created_by)
    values (btrim(p_title), btrim(p_body), nullif(p_article, ''), p_item, (select auth.uid()))
    returning id into v_id;
    v_was := 'draft';
  else
    select state into v_was from public.product_news where id = v_id for update;
    if v_was is null then raise exception 'NEWS_NOT_FOUND'; end if;
    update public.product_news set title = btrim(p_title), body = btrim(p_body), article = nullif(p_article, ''),
           item_id = p_item, updated_at = now() where id = v_id;
  end if;
  if p_publish and v_was <> 'published' then
    update public.product_news set state = 'published', published_at = now(), updated_at = now() where id = v_id;
    update public.improvement_items set announced_at = now() where id = p_item;
    perform private.console_log('news.publish', 'news', v_id::text, btrim(p_title));
  else
    perform private.console_log(case when p_id is null then 'news.draft' else 'news.edit' end, 'news', v_id::text, btrim(p_title));
  end if;
  return v_id;
end $$;

create or replace function public.console_withdraw_news(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_title text;
begin
  perform private.console_write();
  update public.product_news set state = 'withdrawn', updated_at = now() where id = p_id and state = 'published'
  returning title into v_title;
  if v_title is null then raise exception 'NEWS_NOT_FOUND'; end if;
  perform private.console_log('news.withdraw', 'news', p_id::text, v_title);
end $$;

-- Opérations d'équipe (ajout, rôle, retrait) : au plus 20 par heure et par admin
create or replace function private.team_rate_limit()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.console_audit
       where actor_id = (select auth.uid()) and action in ('owner.add', 'owner.role', 'owner.remove', 'owner.lookup')
         and at > now() - interval '1 hour') >= 20 then
    raise exception 'RATE_LIMIT' using errcode = '54000';
  end if;
end $$;
revoke all on function private.team_rate_limit() from public, anon, authenticated;

-- Ajout d'un propriétaire : compte existant, cherché par e-mail. Réponse identique (« introuvable »)
-- si le compte n'existe pas : rien n'est révélé.
create or replace function public.console_add_owner(p_email text, p_role text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  perform private.console_write();
  if p_role not in ('admin', 'read_only') then raise exception 'ROLE_INVALID'; end if;
  perform private.team_rate_limit();
  select id into v_uid from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  if v_uid is null then
    -- Recherche comptée dans le plafond, sans rien révéler (ni l'adresse cherchée ni le résultat)
    perform private.console_log('owner.lookup', 'owner', '', '');
    return 'introuvable';
  end if;
  insert into public.platform_admins (user_id, role, added_by) values (v_uid, p_role, (select auth.uid()))
  on conflict (user_id) do nothing;
  if not found then return 'deja'; end if;
  perform private.console_log('owner.add', 'owner', v_uid::text, lower(btrim(p_email)) || ' · ' || p_role);
  return 'ok';
end $$;

create or replace function public.console_set_owner_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  perform private.console_write();
  if p_role not in ('admin', 'read_only') then raise exception 'ROLE_INVALID'; end if;
  if p_user = (select auth.uid()) then raise exception 'OWN_ROLE' using errcode = '42501'; end if;
  perform private.team_rate_limit();
  update public.platform_admins set role = p_role where user_id = p_user;
  if not found then raise exception 'OWNER_NOT_FOUND'; end if;
  select email into v_email from auth.users where id = p_user;
  perform private.console_log('owner.role', 'owner', p_user::text, coalesce(v_email, '') || ' · ' || p_role);
end $$;

create or replace function public.console_remove_owner(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  perform private.console_write();
  if p_user = (select auth.uid()) then raise exception 'OWN_ROLE' using errcode = '42501'; end if;
  perform private.team_rate_limit();
  delete from public.platform_admins where user_id = p_user;
  if not found then raise exception 'OWNER_NOT_FOUND'; end if;
  select email into v_email from auth.users where id = p_user;
  perform private.console_log('owner.remove', 'owner', p_user::text, coalesce(v_email, ''));
end $$;

-- Droits d'exécution : connectés seulement (les contrôles sont dans chaque fonction)
do $$
declare f text;
begin
  foreach f in array array[
    'help_vote(text, boolean, text, uuid)', 'help_comment(uuid, text)', 'my_help_vote(text, uuid)',
    'list_product_news()', 'news_unseen_count()', 'news_mark_seen()', 'console_me()',
    'console_overview(int)', 'console_workspaces()', 'console_articles(int, uuid)',
    'console_comments(int, uuid, text)', 'console_items()', 'console_item(uuid)', 'console_news()',
    'console_team()', 'console_audit_list(int)', 'console_log_event(text, text)',
    'console_create_item(text, text, text, text, uuid[])', 'console_update_item(uuid, jsonb)',
    'console_link_comments(uuid, uuid[])', 'console_set_comments(uuid[], text)', 'console_delete_comment(uuid)',
    'console_save_news(uuid, text, text, text, uuid, boolean)', 'console_withdraw_news(uuid)',
    'console_add_owner(text, text)', 'console_set_owner_role(uuid, text)', 'console_remove_owner(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function private.item_label(uuid) from public, anon, authenticated;
revoke all on function private.guard_platform_admins() from public, anon, authenticated;
revoke all on function private.forget_help_comment() from public, anon, authenticated;
revoke all on function private.guard_console_audit() from public, anon, authenticated;
revoke all on function private.has_personal_data(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Purge à 12 mois : commentaires (vidés, le vote reste) et journal
-- ---------------------------------------------------------------------------
create or replace function public.purge_console()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.help_feedback_entries set comment = null, comment_status = null, comment_at = null
   where comment_at < now() - interval '12 months';
  perform set_config('app.console_purge', 'on', true);
  delete from public.console_audit where at < now() - interval '12 months';
  perform set_config('app.console_purge', 'off', true);
end $$;
revoke all on function public.purge_console() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_purge_console', '53 3 * * *', 'select public.purge_console()');
  else
    raise notice 'pg_cron indisponible : purge de la console non planifiée';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- « Mes données » : réponses et commentaires sur l'aide (reprise de 20261123130000, une clé de plus)
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  return jsonb_build_object(
    'exportedAt', now(),
    'profile', (select jsonb_build_object('id', u.id, 'email', u.email, 'fullName', p.full_name,
                                          'locale', p.locale, 'createdAt', u.created_at)
                  from auth.users u left join public.profiles p on p.id = u.id where u.id = v_uid),
    'workspaces', coalesce((select jsonb_agg(jsonb_build_object('name', w.name, 'role', m.role, 'since', m.created_at)
                                             order by w.name)
                              from public.members m join public.workspaces w on w.id = m.workspace_id
                             where m.user_id = v_uid), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('workspace', w.name, 'demo', d.title, 'body', c.body,
                                                              'createdAt', c.created_at, 'resolvedAt', c.resolved_at)
                                           order by c.created_at)
                            from public.step_comments c
                            join public.demos d on d.id = c.demo_id
                            join public.workspaces w on w.id = c.workspace_id
                           where c.author_id = v_uid), '[]'::jsonb),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'demo', d.title,
                                                                   'createdAt', n.created_at, 'readAt', n.read_at)
                                                order by n.created_at)
                                 from public.notifications n left join public.demos d on d.id = n.demo_id
                                where n.user_id = v_uid), '[]'::jsonb),
    'preferences', jsonb_build_object(
      'notifications', (select s.prefs from public.notification_settings s where s.user_id = v_uid),
      'mutedDemos', coalesce((select jsonb_agg(d.title order by d.title) from public.notification_mutes nm
                                join public.demos d on d.id = nm.demo_id where nm.user_id = v_uid), '[]'::jsonb)),
    'publicationConfirmations', coalesce((select jsonb_agg(jsonb_build_object('demo', d.title, 'version', v.number,
                                                                              'confirmation', v.public_ack)
                                                           order by v.published_at)
                                            from public.demo_versions v join public.demos d on d.id = v.demo_id
                                           where v.public_ack ->> 'by' = v_uid::text), '[]'::jsonb),
    -- L41 : réponses et commentaires sur l'aide
    'helpFeedback', coalesce((select jsonb_agg(jsonb_build_object('article', e.article, 'helpful', e.helpful,
                                                                  'comment', e.comment, 'createdAt', e.created_at)
                                               order by e.created_at)
                                from public.help_feedback_entries e where e.author_id = v_uid), '[]'::jsonb));
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
