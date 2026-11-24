-- EXT-02 §6.4 : réglages de la voix off pour toute la démo, lus par le lecteur public.
-- demos.settings.voice = { autoplay, captions, player } ; le manifeste publié reçoit « voice » :
--   captions : sous-titres affichés par défaut (vrai sauf réglage contraire ; le visiteur garde son bouton) ;
--   player   : « bubble » (lecteur dans la bulle, par défaut) ou « bar » (boutons de la barre du lecteur).
-- La lecture automatique reste portée par chaque étape (steps.voice_autoplay), comme avant.
-- Le déclencheur de publication est redéfini : même contrôle (transcription obligatoire), même forme de
-- step.voice, avec la clé « voice » en plus quand la démo a au moins une voix.

create or replace function public.demo_versions_voice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_bad int;
  v_voices jsonb;
  v_settings jsonb;
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
    -- Réglages de la démo : toute valeur inattendue retombe sur le défaut (jamais d'erreur de conversion)
    select coalesce(d.settings -> 'voice', '{}'::jsonb) into v_settings
      from public.demos d where d.id = new.demo_id;
    new.manifest := new.manifest || jsonb_build_object('voice', jsonb_build_object(
      'captions', coalesce(v_settings ->> 'captions', 'true') <> 'false',
      'player', case when v_settings ->> 'player' = 'bar' then 'bar' else 'bubble' end));
  end if;
  return new;
end $$;
revoke all on function public.demo_versions_voice() from public, anon, authenticated;
