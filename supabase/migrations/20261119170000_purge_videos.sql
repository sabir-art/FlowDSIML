-- L25 (dette F7) : purge des vidéos jamais rattachées à une étape. Elles comptent dans le quota de
-- 500 Mo tant qu'elles existent (envoi interrompu, étape refusée, démo jamais créée…).
-- Supabase interdit la suppression directe dans storage.objects (le fichier resterait dans le
-- stockage) : la base liste les orphelins, la fonction webhooks-dispatch (appel planifié, secret
-- déjà dans Vault) les retire par l'API Storage. Aucun nouveau secret ni réglage.

/** Vidéos de plus de 24 h citées par aucune étape (toutes démos, y compris supprimées). */
create or replace function public.orphan_videos(p_limit int default 200)
returns table (name text) language sql stable security definer set search_path = '' as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'videos'
     and o.created_at < now() - interval '24 hours'
     and not exists (select 1 from public.steps s where s.video_path = o.name)
   order by o.created_at
   limit least(greatest(coalesce(p_limit, 200), 1), 1000);
$$;

/** Appel de la purge s'il y a des orphelins ; Vault, pg_net ou secret absents : rien. */
create or replace function public.videos_purge_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.orphan_videos(1)) then
    return;
  end if;
  if to_regclass('vault.decrypted_secrets') is null or to_regnamespace('net') is null then
    raise notice 'vidéos : Vault ou pg_net indisponible, purge différée';
    return;
  end if;
  execute 'select (select decrypted_secret from vault.decrypted_secrets where name = $1),
                  (select decrypted_secret from vault.decrypted_secrets where name = $2)'
    into v_url, v_secret using 'webhooks_dispatch_url', 'webhooks_dispatch_secret';
  if v_url is null or v_secret is null then
    raise notice 'vidéos : secret ou URL de dispatch absents de Vault, purge différée';
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    using v_url, '{"task":"purge_videos"}'::jsonb,
          jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json');
end $$;

revoke all on function public.orphan_videos(int), public.videos_purge_tick() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.orphan_videos(int) to service_role';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('fd_videos_purge', '37 * * * *', 'select public.videos_purge_tick()');
  else
    raise notice 'pg_cron indisponible : purge des vidéos orphelines non planifiée';
  end if;
end $$;
