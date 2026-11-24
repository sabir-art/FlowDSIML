-- Médiathèque (retours client du 24/11 §3.2) : renommer un fichier et changer sa catégorie depuis le
-- menu de sa carte. Nouveau fichier ; idempotent.
--  * La table reste fermée en écriture directe : deux fonctions, réservées aux éditeurs et plus de
--    l'espace du fichier (comme l'import et la suppression).
--  * Catégorie : Logo ou Image. Une police reste une police, et un fichier image ne devient pas une
--    police (la catégorie suit le type réel du fichier).
--  * Tout fichier a déjà une catégorie (colonne obligatoire) : aucune donnée à reprendre.

create or replace function public.rename_media_file(p_id uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.media_files where id = p_id;
  if ws is null or not public.has_role(ws, 'editor') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 120 then
    raise exception 'NOM_INVALIDE' using errcode = '22023';
  end if;
  update public.media_files set name = btrim(p_name) where id = p_id;
end $$;
revoke all on function public.rename_media_file(uuid, text) from public, anon;
grant execute on function public.rename_media_file(uuid, text) to authenticated;

create or replace function public.set_media_kind(p_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.media_files;
begin
  select * into f from public.media_files where id = p_id;
  if f.id is null or not public.has_role(f.workspace_id, 'editor') then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('logo', 'image') or f.kind = 'font' then
    raise exception 'CATEGORIE_INVALIDE' using errcode = '22023';
  end if;
  update public.media_files set kind = p_kind where id = p_id;
end $$;
revoke all on function public.set_media_kind(uuid, text) from public, anon;
grant execute on function public.set_media_kind(uuid, text) to authenticated;
