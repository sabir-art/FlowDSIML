-- L28 035 : voix off ajoutée après coup sur une étape (spec docs/ux/specs/l28-complements.md §3, schéma A
-- validé par le chef d'équipe). Idempotent.
--  * steps : voice_path (bucket voices, <ws>/<démo>/<uuid>.<ext>), voice_duration_ms (2 min au plus),
--    voice_transcript (sous-titres, obligatoire pour publier), voice_autoplay (lancer à l'arrivée).
--  * bucket voices : privé, 5 Mo, MP3 / M4A / WAV / WebM ; quota de 500 Mo partagé avec la médiathèque
--    et les vidéos.
--  * Publication : un trigger sur demo_versions (même principe que les règles de partage L27) refuse
--    VOICE_TRANSCRIPT:<n> et ajoute step.voice au manifeste enregistré ; l'app copie les pistes dans
--    « published » et publie ce manifeste. publish_demo n'est pas redéfinie.

alter table public.steps add column if not exists voice_path text;
alter table public.steps add column if not exists voice_duration_ms int;
alter table public.steps add column if not exists voice_transcript text;
alter table public.steps add column if not exists voice_autoplay boolean not null default true;
alter table public.steps drop constraint if exists steps_voice_ok;
alter table public.steps add constraint steps_voice_ok check (
  (voice_path is null or voice_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp3|m4a|wav|webm)$')
  and (voice_duration_ms is null or voice_duration_ms between 1 and 120000)
  and (voice_transcript is null or char_length(voice_transcript) <= 4000));

-- Piste rangée sous le dossier du workspace, fichier présent, quota partagé
create or replace function public.steps_voice_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_total bigint;
begin
  if new.voice_path is not null and public.path_uuid(new.voice_path, 1) is distinct from new.workspace_id then
    raise exception 'VOICE_PATH' using errcode = '23514';
  end if;
  if new.voice_path is not null and (tg_op = 'INSERT' or new.voice_path is distinct from old.voice_path) then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'voices' and o.name = new.voice_path) then
      raise exception 'VOICE_OBJECT_MISSING' using errcode = 'P0001';
    end if;
    select coalesce(sum((o.metadata ->> 'size')::bigint), 0) into v_total
      from storage.objects o
     where o.bucket_id in ('media', 'videos', 'voices') and o.name like new.workspace_id::text || '/%';
    if v_total > 524288000 then raise exception 'MEDIA_QUOTA' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
revoke all on function public.steps_voice_check() from public, anon, authenticated;
drop trigger if exists steps_voice_check on public.steps;
create trigger steps_voice_check before insert or update of voice_path on public.steps
  for each row execute function public.steps_voice_check();

-- ===== Stockage =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voices', 'voices', false, 5242880, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm'];
-- Les pistes publiées sont copiées dans « published » (privé, URL signées par open-demo)
update storage.buckets
   set allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg', 'application/json', 'video/webm',
                                  'text/html', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav',
                                  'audio/x-wav', 'audio/webm']
 where id = 'published';

drop policy if exists voices_select on storage.objects;
create policy voices_select on storage.objects for select to authenticated
  using (bucket_id = 'voices' and public.has_role(public.path_uuid(name, 1), 'viewer'));
drop policy if exists voices_insert on storage.objects;
create policy voices_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'voices' and public.has_role(public.path_uuid(name, 1), 'editor'));
drop policy if exists voices_update on storage.objects;
create policy voices_update on storage.objects for update to authenticated
  using (bucket_id = 'voices' and public.has_role(public.path_uuid(name, 1), 'editor'));
drop policy if exists voices_delete on storage.objects;
create policy voices_delete on storage.objects for delete to authenticated
  using (bucket_id = 'voices' and public.has_role(public.path_uuid(name, 1), 'editor'));

-- Occupation partagée (médiathèque + vidéos + voix)
create or replace function public.media_used(p_ws uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'Accès refusé' using errcode = '42501'; end if;
  return (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
          where o.bucket_id in ('media', 'videos', 'voices') and o.name like p_ws::text || '/%');
end $$;

-- ===== Publication =====
-- Chemin publié d'une piste : assets/voice-<nom du fichier>. À plat, comme les autres ressources signées ; immuable, car une nouvelle piste a un autre nom.
create or replace function public.voice_pub_path(p_path text)
returns text language sql immutable set search_path = '' as $$
  select 'assets/voice-' || split_part(p_path, '/', 3);
$$;

create or replace function public.demo_versions_voice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_bad int;
  v_voices jsonb;
begin
  -- Étape n (ordre de l'éditeur) : voix sans transcription
  select min(n) into v_bad from (
    select row_number() over (order by s.position, s.created_at) as n, s.voice_path, s.voice_transcript
      from public.steps s where s.demo_id = new.demo_id
  ) x
  where x.voice_path is not null and coalesce(btrim(x.voice_transcript), '') = '';
  if v_bad is not null then
    raise exception 'VOICE_TRANSCRIPT:%', v_bad using errcode = 'P0001';
  end if;
  select coalesce(jsonb_object_agg(s.id::text, jsonb_build_object(
           'src', public.voice_pub_path(s.voice_path),
           'durationMs', s.voice_duration_ms,
           'transcript', btrim(s.voice_transcript),
           'autoplay', s.voice_autoplay)), '{}'::jsonb)
    into v_voices
    from public.steps s where s.demo_id = new.demo_id and s.voice_path is not null;
  if v_voices <> '{}'::jsonb and jsonb_typeof(new.manifest -> 'steps') = 'array' then
    new.manifest := jsonb_set(new.manifest, '{steps}', (
      select coalesce(jsonb_agg(case when v_voices ? (st ->> 'id')
                                     then st || jsonb_build_object('voice', v_voices -> (st ->> 'id'))
                                     else st end order by ord), '[]'::jsonb)
        from jsonb_array_elements(new.manifest -> 'steps') with ordinality as e(st, ord)));
  end if;
  return new;
end $$;
revoke all on function public.demo_versions_voice() from public, anon, authenticated;
drop trigger if exists demo_versions_voice on public.demo_versions;
create trigger demo_versions_voice before insert on public.demo_versions
  for each row execute function public.demo_versions_voice();
