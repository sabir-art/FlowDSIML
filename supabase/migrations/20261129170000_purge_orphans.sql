-- Purge planifiée de storage_orphans (accord du chef) : fichiers restés au stockage après la suppression
-- d'un compte ou d'un espace (L28 « Mes données ») et photos de profil (20261129160000). Supabase
-- interdit la suppression directe dans storage.objects : chaque nuit, pg_cron appelle webhooks-dispatch
-- (tâche purge_orphans, secret Vault déjà en place), qui retire les fichiers par l'API Storage, par lots
-- bornés, et journalise le nombre retiré. Idempotent.

/** Lot d'orphelins à retirer (les plus anciens d'abord), limité aux buckets de l'app. */
create or replace function public.storage_orphans_claim(p_limit int default 500)
returns table (id bigint, bucket text, path text) language sql stable security definer set search_path = '' as $$
  select o.id, o.bucket, o.path from public.storage_orphans o
   where o.bucket in ('captures', 'videos', 'voices', 'html', 'media', 'published', 'avatars')
   order by o.id
   limit least(greatest(coalesce(p_limit, 500), 1), 1000);
$$;

/** Orphelins traités (fichier retiré ou déjà absent) : lignes supprimées, nombre renvoyé. */
create or replace function public.storage_orphans_done(p_ids bigint[])
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.storage_orphans where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end $$;

/** Appel nocturne s'il reste des orphelins ; Vault, pg_net ou secret absents : rien. */
create or replace function public.storage_orphans_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.storage_orphans_claim(1)) then return; end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    raise notice 'orphelins : Vault ou pg_net indisponible, purge différée';
    return;
  end if;
  execute 'select (select decrypted_secret from vault.decrypted_secrets where name = $1),
                  (select decrypted_secret from vault.decrypted_secrets where name = $2)'
    into v_url, v_secret using 'webhooks_dispatch_url', 'webhooks_dispatch_secret';
  if v_url is null or v_secret is null then
    raise notice 'orphelins : secret ou URL de dispatch absents de Vault, purge différée';
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    using v_url, '{"task":"purge_orphans"}'::jsonb,
          jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json');
end $$;

revoke all on function public.storage_orphans_claim(int), public.storage_orphans_done(bigint[]),
  public.storage_orphans_tick() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.storage_orphans_claim(int), public.storage_orphans_done(bigint[]) to service_role';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_storage_orphans_purge', '41 3 * * *', 'select public.storage_orphans_tick()');
  else
    raise notice 'pg_cron indisponible : purge des orphelins non planifiée';
  end if;
end $$;
