-- Une démo créée par un membre naît toujours en brouillon, sans version en ligne : le statut et la
-- version courante ne changent que par publish_demo / finalize_publication / unpublish_demo (comme pour
-- UPDATE, déjà limité par colonne).

-- ===== 1. Création d'une démo : toujours en brouillon =====
create or replace function public.demos_insert_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Seules les écritures directes d'un membre (ou d'un anonyme) sont visées : les fonctions du schéma
  -- (security definer) et le service gardent la main.
  if current_user in ('authenticated', 'anon')
     and (new.status::text <> 'draft' or new.current_version_id is not null) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.demos_insert_guard() from public, anon, authenticated;
drop trigger if exists demos_insert_guard on public.demos;
create trigger demos_insert_guard before insert on public.demos
  for each row execute function public.demos_insert_guard();
