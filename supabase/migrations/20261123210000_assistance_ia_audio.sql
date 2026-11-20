-- L30 065/066 : voix de synthèse et sous-titres automatiques (ElevenLabs), après la levée « IA » du client.
-- Pas de changement de droits : mêmes rôles (éditeur+ via l'Edge Function « ai », service_role pour
-- ai_reserve / ai_commit), mêmes politiques. Ajouts :
--  * fonctions activables « voice » et « captions » (settings.ai.features, cochées par défaut comme les autres) ;
--  * ai_usage.audio_seconds et plans.limits.ai_monthly_audio_seconds : quota mensuel en secondes d'audio ;
--  * ai_reserve(…, p_audio_seconds) et ai_commit(…, p_audio_seconds), anciennes signatures retirées.
-- Le fichier 20261123200000_assistance_ia.sql est sur main (figé) : les fonctions sont redéfinies ici.

update public.plans set limits = limits || jsonb_build_object('ai_monthly_audio_seconds',
    case code when 'free' then 300 when 'pro' then 3600 when 'business' then 14400 else 36000 end)
  where not (limits ? 'ai_monthly_audio_seconds');

alter table public.ai_usage add column if not exists audio_seconds int not null default 0 check (audio_seconds >= 0);

create or replace function public.ai_features()
returns text[] language sql immutable set search_path = '' as $$
  select array['write', 'translate', 'suggest', 'generate', 'dataset', 'chart', 'assistant', 'voice', 'captions'];
$$;

create or replace function public.ai_config(p_ws uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with w as (
    select coalesce(w.settings -> 'ai', '{}'::jsonb) as ai,
           coalesce((p.limits ->> 'ai_monthly_requests')::int, 0) as plan_req,
           coalesce((p.limits ->> 'ai_monthly_tokens')::bigint, 0) as plan_tok,
           coalesce((p.limits ->> 'ai_monthly_audio_seconds')::int, 0) as plan_audio
      from public.workspaces w join public.plans p on p.code = w.plan_code
     where w.id = p_ws
  )
  select jsonb_build_object(
    'enabled', coalesce((ai ->> 'enabled')::boolean, false),
    'features', (select coalesce(jsonb_object_agg(f, coalesce((ai -> 'features' ->> f)::boolean, true)), '{}'::jsonb)
                   from unnest(public.ai_features()) f),
    'monthlyRequests', least(coalesce((ai ->> 'monthlyRequests')::int, plan_req), plan_req),
    'userDailyRequests', coalesce((ai ->> 'userDailyRequests')::int, 30),
    'monthlyTokens', plan_tok,
    'monthlyAudioSeconds', plan_audio
  ) from w;
$$;
revoke all on function public.ai_config(uuid) from public, anon, authenticated;

create or replace function public.ai_status(p_ws uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cfg jsonb;
  v_month date := date_trunc('month', (now() at time zone 'utc'))::date;
  v_today date := (now() at time zone 'utc')::date;
  v_used int;
  v_tokens bigint;
  v_mine int;
  v_audio int;
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_cfg := public.ai_config(p_ws);
  select coalesce(sum(requests), 0), coalesce(sum(input_tokens + output_tokens), 0), coalesce(sum(audio_seconds), 0)
    into v_used, v_tokens, v_audio
    from public.ai_usage where workspace_id = p_ws and day >= v_month;
  select coalesce(sum(requests), 0) into v_mine
    from public.ai_usage where workspace_id = p_ws and user_id = (select auth.uid()) and day = v_today;
  return jsonb_build_object(
    'enabled', v_cfg -> 'enabled',
    'features', v_cfg -> 'features',
    'used', v_used,
    'quota', v_cfg -> 'monthlyRequests',
    'userToday', v_mine,
    'userDailyRequests', v_cfg -> 'userDailyRequests',
    'workspaceQuotaReached', v_used >= (v_cfg ->> 'monthlyRequests')::int or v_tokens >= (v_cfg ->> 'monthlyTokens')::bigint,
    'userQuotaReached', v_mine >= (v_cfg ->> 'userDailyRequests')::int,
    'audioUsed', v_audio,
    'audioQuota', v_cfg -> 'monthlyAudioSeconds',
    'audioQuotaReached', v_audio >= (v_cfg ->> 'monthlyAudioSeconds')::int,
    'renewsOn', (v_month + interval '1 month')::date,
    'canEdit', public.has_role(p_ws, 'editor'),
    'canManage', public.has_role(p_ws, 'admin')
  );
end $$;
revoke all on function public.ai_status(uuid) from public, anon;
grant execute on function public.ai_status(uuid) to authenticated;

drop function if exists public.ai_reserve(uuid, uuid, text);
create or replace function public.ai_reserve(p_ws uuid, p_user uuid, p_feature text, p_audio_seconds int default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cfg jsonb;
  v_month date := date_trunc('month', (now() at time zone 'utc'))::date;
  v_today date := (now() at time zone 'utc')::date;
  v_used int;
  v_tokens bigint;
  v_mine int;
  v_audio int;
begin
  if p_feature is null or p_feature <> all (public.ai_features()) then
    raise exception 'INVALID_FEATURE' using errcode = '22023';
  end if;
  if not exists (select 1 from public.members m
                  where m.workspace_id = p_ws and m.user_id = p_user and m.role >= 'editor') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform 1 from public.workspaces where id = p_ws for update;
  v_cfg := public.ai_config(p_ws);
  if not (v_cfg ->> 'enabled')::boolean or not coalesce((v_cfg -> 'features' ->> p_feature)::boolean, false) then
    raise exception 'AI_DISABLED' using errcode = 'P0001';
  end if;
  if p_audio_seconds < 0 or p_audio_seconds > 3600 then raise exception 'INVALID' using errcode = '22023'; end if;
  select coalesce(sum(requests), 0), coalesce(sum(input_tokens + output_tokens), 0), coalesce(sum(audio_seconds), 0)
    into v_used, v_tokens, v_audio
    from public.ai_usage where workspace_id = p_ws and day >= v_month;
  if v_used >= (v_cfg ->> 'monthlyRequests')::int or v_tokens >= (v_cfg ->> 'monthlyTokens')::bigint then
    raise exception 'AI_QUOTA_WORKSPACE' using errcode = 'P0001';
  end if;
  -- Voix et sous-titres (ElevenLabs) : quota mensuel en secondes d'audio
  if p_feature in ('voice', 'captions') and v_audio + p_audio_seconds > (v_cfg ->> 'monthlyAudioSeconds')::int then
    raise exception 'AI_QUOTA_WORKSPACE' using errcode = 'P0001';
  end if;
  select coalesce(sum(requests), 0) into v_mine
    from public.ai_usage where workspace_id = p_ws and user_id = p_user and day = v_today;
  if v_mine >= (v_cfg ->> 'userDailyRequests')::int then
    raise exception 'AI_QUOTA_USER' using errcode = 'P0001';
  end if;
  insert into public.ai_usage (workspace_id, user_id, day, requests) values (p_ws, p_user, v_today, 1)
    on conflict (workspace_id, user_id, day) do update set requests = public.ai_usage.requests + 1;
  return jsonb_build_object('renewsOn', (v_month + interval '1 month')::date);
end $$;

drop function if exists public.ai_commit(uuid, uuid, bigint, bigint, boolean);
create or replace function public.ai_commit(p_ws uuid, p_user uuid, p_input bigint, p_output bigint, p_refund boolean default false, p_audio_seconds int default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'utc')::date;
begin
  if p_input < 0 or p_output < 0 or p_audio_seconds < 0 or p_audio_seconds > 3600 then raise exception 'INVALID' using errcode = '22023'; end if;
  insert into public.ai_usage (workspace_id, user_id, day, input_tokens, output_tokens, audio_seconds)
    values (p_ws, p_user, v_today, p_input, p_output, p_audio_seconds)
    on conflict (workspace_id, user_id, day) do update
      set input_tokens = public.ai_usage.input_tokens + excluded.input_tokens,
          output_tokens = public.ai_usage.output_tokens + excluded.output_tokens,
          audio_seconds = public.ai_usage.audio_seconds + excluded.audio_seconds,
          requests = greatest(public.ai_usage.requests - case when p_refund then 1 else 0 end, 0);
end $$;

revoke all on function public.ai_reserve(uuid, uuid, text, int) from public, anon, authenticated;
revoke all on function public.ai_commit(uuid, uuid, bigint, bigint, boolean, int) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid, uuid, text, int) to service_role;
grant execute on function public.ai_commit(uuid, uuid, bigint, bigint, boolean, int) to service_role;
