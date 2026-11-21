-- L49 P4 : Google Safe Browsing (docs/ux/specs/l49-securite-html.md §4.1). Le rapport d'une page garde la
-- liste des adresses signalées (« blocked ») avec dangerousLinks et l'état de la vérification.

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
        -- L49 P4 : adresses signalées par Google Safe Browsing (éditeur : « Bloqué, site signalé »)
        when e.key = 'blocked' then jsonb_typeof(e.value) <> 'array' or jsonb_array_length(e.value) > 300
          or exists (select 1 from jsonb_array_elements(e.value) b
                     where jsonb_typeof(b) <> 'string' or char_length(b #>> '{}') > 2000)
        else true
      end);
$$;

-- Un lien signalé ne peut pas être autorisé : l'opération « extlink » vers une adresse signalée est
-- retirée à chaque écriture de html_ops (même si un éditeur ouvert la renvoie après la vérification).
create or replace function public.steps_extlink_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  b jsonb;
begin
  if new.kind <> 'html' or new.html_path is null then return new; end if;
  select p.security -> 'blocked' into b from public.html_page_security p
  where p.path = new.html_path and p.workspace_id = new.workspace_id;
  if b is null or jsonb_typeof(b) <> 'array' or jsonb_array_length(b) = 0 then return new; end if;
  new.html_ops := coalesce((
    select jsonb_agg(o order by ord) from jsonb_array_elements(new.html_ops) with ordinality as e(o, ord)
    where not (o ->> 'op' = 'extlink' and b ? (o ->> 'value'))), '[]'::jsonb);
  return new;
end $$;
revoke all on function public.steps_extlink_guard() from public, anon, authenticated;
drop trigger if exists steps_extlink_guard on public.steps;
create trigger steps_extlink_guard before insert or update of html_ops, html_path on public.steps
  for each row execute function public.steps_extlink_guard();
