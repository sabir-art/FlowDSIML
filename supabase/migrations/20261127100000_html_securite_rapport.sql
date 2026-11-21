-- L49 P2 : rapport d'analyse de sécurité des pages HTML capturées (docs/ux/specs/l49-securite-html.md §3).
--  * html_page_security : compteurs calculés par html-ingest (service_role) pour chaque page stockée ;
--    aucune écriture possible depuis l'app ou l'extension (RLS sans politique).
--  * steps.html_meta.security : recopié de cette table par un trigger, jamais de la valeur envoyée par le
--    navigateur. Une page sans compteurs (capturée avant L49) n'a pas de rapport.

create table if not exists public.html_page_security (
  path text primary key check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.html$'),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  security jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.html_page_security enable row level security;
revoke all on public.html_page_security from anon, authenticated;
grant select, insert on public.html_page_security to service_role;

-- Compteurs valides : entiers positifs ou nuls, liste fermée ; date d'analyse ; état de Safe Browsing (P4)
create or replace function public.html_security_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'object'
    and not exists (
      select 1 from jsonb_each(v) e
      where case
        when e.key in ('scripts', 'handlers', 'frames', 'forms', 'externalLinks', 'piiReplaced', 'other', 'dangerousLinks')
          then jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}')::numeric < 0
            or (e.value #>> '{}')::numeric <> trunc((e.value #>> '{}')::numeric)
        when e.key = 'analyzedAt' then jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') > 40
        when e.key = 'safeBrowsing' then (e.value #>> '{}') is distinct from 'ok' and (e.value #>> '{}') is distinct from 'unavailable'
        else true
      end);
$$;
alter table public.html_page_security drop constraint if exists html_page_security_ok;
alter table public.html_page_security add constraint html_page_security_ok check (public.html_security_ok(security));

-- html_meta accepte la clé « security » (même contrôle que la table)
create or replace function public.html_meta_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'object'
    and not exists (select 1 from jsonb_object_keys(v) k
                    where k not in ('title', 'url', 'bytes', 'viewport', 'links', 'blurred', 'canvases', 'security'))
    and (v -> 'title' is null or (jsonb_typeof(v -> 'title') = 'string' and char_length(v ->> 'title') <= 200))
    and (v -> 'url' is null or (jsonb_typeof(v -> 'url') = 'string' and char_length(v ->> 'url') <= 2000))
    and (v -> 'bytes' is null or (jsonb_typeof(v -> 'bytes') = 'number' and (v ->> 'bytes')::numeric between 0 and 10485760))
    and (v -> 'blurred' is null or jsonb_typeof(v -> 'blurred') = 'number')
    and (v -> 'canvases' is null or jsonb_typeof(v -> 'canvases') = 'number')
    and (v -> 'viewport' is null or (jsonb_typeof(v -> 'viewport') = 'object'
         and jsonb_typeof(v -> 'viewport' -> 'w') = 'number' and jsonb_typeof(v -> 'viewport' -> 'h') = 'number'
         and (v -> 'viewport') - 'w' - 'h' = '{}'::jsonb))
    and (v -> 'links' is null or (jsonb_typeof(v -> 'links') = 'array' and jsonb_array_length(v -> 'links') <= 300
         and not exists (select 1 from jsonb_array_elements(v -> 'links') l
                         where jsonb_typeof(l) <> 'object'
                            or exists (select 1 from jsonb_object_keys(l) k where k not in ('sel', 'href', 'label'))
                            or jsonb_typeof(l -> 'sel') <> 'string' or char_length(l ->> 'sel') not between 1 and 500
                            or coalesce(l ->> 'href', '') !~ '^https?://' or char_length(l ->> 'href') > 2000
                            or (l -> 'label' is not null and (jsonb_typeof(l -> 'label') <> 'string' or char_length(l ->> 'label') > 120)))))
    and (v -> 'security' is null or public.html_security_ok(v -> 'security'));
$$;

-- Le rapport vient toujours du serveur : la valeur envoyée par le navigateur est remplacée
create or replace function public.steps_html_security()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s jsonb;
begin
  if new.kind = 'html' and new.html_path is not null then
    select p.security into s from public.html_page_security p
    where p.path = new.html_path and p.workspace_id = new.workspace_id;
  end if;
  new.html_meta := case when s is null then coalesce(new.html_meta, '{}'::jsonb) - 'security'
                        else coalesce(new.html_meta, '{}'::jsonb) || jsonb_build_object('security', s) end;
  return new;
end $$;
revoke all on function public.steps_html_security() from public, anon, authenticated;
drop trigger if exists steps_html_security on public.steps;
create trigger steps_html_security before insert or update of html_path, html_meta on public.steps
  for each row execute function public.steps_html_security();
