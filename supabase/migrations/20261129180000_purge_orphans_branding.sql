-- Relecture du chef (purge_orphans) : le bucket « branding » (logos d'espace, chemin <espace>/…) est
-- effacé avec un espace supprimé (Mes données) ; ce qui n'a pas pu l'être est inscrit dans
-- storage_orphans. On l'ajoute à la liste blanche de la purge. Idempotent.
create or replace function public.storage_orphans_claim(p_limit int default 500)
returns table (id bigint, bucket text, path text) language sql stable security definer set search_path = '' as $$
  select o.id, o.bucket, o.path from public.storage_orphans o
   where o.bucket in ('captures', 'videos', 'voices', 'html', 'media', 'published', 'avatars', 'branding')
   order by o.id
   limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;
revoke all on function public.storage_orphans_claim(int) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.storage_orphans_claim(int) to service_role';
  end if;
end $$;
