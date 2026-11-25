-- Retours client du 24/11 (2e série) §7 : page Extension. L'extension déclare sa version et sa dernière
-- capture, pour que la page affiche « Version » et « Dernière capture ». Nouveau fichier, idempotent ;
-- extension_seen (appelée par les versions déjà publiées) ne change pas.
--  * profiles.extension_version : dernière version déclarée (« 0.3.0 ») ; absente : version publiée
--    avant cette déclaration.
--  * profiles.extension_last_capture_at, extension_last_demo : dernière capture envoyée par l'extension.
--  * public.extension_report(p_version, p_demo) : appelée par l'extension après connexion (version seule)
--    et après l'envoi d'une capture (avec la démo créée). Chacun n'écrit que sa propre ligne ; une démo
--    n'est retenue que si la personne y a accès.

alter table public.profiles
  add column if not exists extension_version text,
  add column if not exists extension_last_capture_at timestamptz,
  add column if not exists extension_last_demo uuid references public.demos (id) on delete set null;
alter table public.profiles drop constraint if exists profiles_extension_version_check;
alter table public.profiles add constraint profiles_extension_version_check
  check (extension_version is null or extension_version ~ '^[0-9]{1,3}(\.[0-9]{1,3}){1,2}$');

create or replace function public.extension_report(p_version text, p_demo uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := (select auth.uid());
  v_version text := case when p_version ~ '^[0-9]{1,3}(\.[0-9]{1,3}){1,2}$' then p_version end;
  v_demo uuid;
begin
  if v_me is null then raise exception 'Accès refusé' using errcode = '42501'; end if;
  -- La démo n'est retenue que si elle existe et que la personne est membre de son espace
  select d.id into v_demo from public.demos d
   where d.id = p_demo and d.deleted_at is null and public.has_role(d.workspace_id, 'viewer');
  update public.profiles
     set extension_seen_at = coalesce(extension_seen_at, now()),
         extension_version = coalesce(v_version, extension_version),
         extension_last_capture_at = case when v_demo is not null then now() else extension_last_capture_at end,
         extension_last_demo = coalesce(v_demo, extension_last_demo)
   where id = v_me;
end $$;
revoke all on function public.extension_report(text, uuid) from public, anon;
grant execute on function public.extension_report(text, uuid) to authenticated;
