-- L30 Assistance IA (schéma G, validé par le chef d'équipe).
--  * workspaces.settings.ai = {enabled, features{...}, monthlyRequests, userDailyRequests} :
--    écrit UNIQUEMENT par set_ai_settings (owner/admin) ; un déclencheur refuse toute autre écriture
--    de la clé « ai » (la colonne settings reste modifiable par les admins pour le reste).
--  * Quota de l'espace : demandes par mois civil (UTC), borné par le plan (plans.limits.ai_monthly_requests)
--    et par un plafond de jetons (plans.limits.ai_monthly_tokens). Limite par utilisateur et par jour.
--  * ai_usage : compteurs seuls (jamais de prompt ni de réponse). Lecture : admin, ou ses propres lignes.
--    Aucune écriture client : ai_reserve / ai_commit sont réservées au service_role (Edge Function « ai »).

-- ===== Limites du plan =====
update public.plans set limits = limits
  || jsonb_build_object('ai_monthly_requests',
       case code when 'free' then 50 when 'pro' then 500 when 'business' then 2000 else 5000 end)
  || jsonb_build_object('ai_monthly_tokens',
       case code when 'free' then 300000 when 'pro' then 3000000 when 'business' then 12000000 else 30000000 end)
  where not (limits ? 'ai_monthly_requests');

-- ===== Fonctions activables =====
create or replace function public.ai_features()
returns text[] language sql immutable set search_path = '' as $$
  select array['write', 'translate', 'suggest', 'generate', 'dataset', 'chart', 'assistant'];
$$;

-- Réglage effectif (valeurs par défaut, bornes du plan). Interne.
create or replace function public.ai_config(p_ws uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with w as (
    select coalesce(w.settings -> 'ai', '{}'::jsonb) as ai,
           coalesce((p.limits ->> 'ai_monthly_requests')::int, 0) as plan_req,
           coalesce((p.limits ->> 'ai_monthly_tokens')::bigint, 0) as plan_tok
      from public.workspaces w join public.plans p on p.code = w.plan_code
     where w.id = p_ws
  )
  select jsonb_build_object(
    'enabled', coalesce((ai ->> 'enabled')::boolean, false),
    'features', (select coalesce(jsonb_object_agg(f, coalesce((ai -> 'features' ->> f)::boolean, true)), '{}'::jsonb)
                   from unnest(public.ai_features()) f),
    'monthlyRequests', least(coalesce((ai ->> 'monthlyRequests')::int, plan_req), plan_req),
    'userDailyRequests', coalesce((ai ->> 'userDailyRequests')::int, 30),
    'monthlyTokens', plan_tok
  ) from w;
$$;
revoke all on function public.ai_config(uuid) from public, anon, authenticated;

create or replace function public.ai_enabled(p_ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((public.ai_config(p_ws) ->> 'enabled')::boolean, false);
$$;
revoke all on function public.ai_enabled(uuid) from public, anon;
grant execute on function public.ai_enabled(uuid) to authenticated, service_role;

-- ===== Compteurs =====
create table if not exists public.ai_usage (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  requests int not null default 0 check (requests >= 0),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  primary key (workspace_id, user_id, day)
);
create index if not exists ai_usage_ws_day on public.ai_usage (workspace_id, day);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role(workspace_id, 'admin'));

-- ===== Protection de settings.ai =====
create or replace function public.workspaces_ai_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('fd.ai_set', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.settings := coalesce(new.settings, '{}'::jsonb) - 'ai';
  elsif (new.settings -> 'ai') is distinct from (old.settings -> 'ai') then
    raise exception 'AI_SETTINGS_RPC_ONLY' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.workspaces_ai_guard() from public, anon, authenticated;
drop trigger if exists workspaces_ai_guard on public.workspaces;
create trigger workspaces_ai_guard before insert or update of settings on public.workspaces
  for each row execute function public.workspaces_ai_guard();

-- ===== Réglage (owner/admin) =====
-- p_features : objet {fonction: booléen} ; clés inconnues refusées. Quotas bornés par le plan.
create or replace function public.set_ai_settings(
  p_ws uuid, p_enabled boolean, p_features jsonb default null,
  p_monthly_requests int default null, p_user_daily_requests int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cur jsonb;
  v_plan int;
  v_new jsonb;
begin
  if not public.has_role(p_ws, 'admin') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_enabled is null then raise exception 'INVALID' using errcode = '22023'; end if;
  if p_features is not null and (jsonb_typeof(p_features) <> 'object'
      or exists (select 1 from jsonb_each(p_features) e
                  where e.key <> all (public.ai_features()) or jsonb_typeof(e.value) <> 'boolean')) then
    raise exception 'INVALID_FEATURES' using errcode = '22023';
  end if;
  select coalesce(settings -> 'ai', '{}'::jsonb) into v_cur from public.workspaces where id = p_ws;
  v_plan := coalesce((select (p.limits ->> 'ai_monthly_requests')::int
                        from public.workspaces w join public.plans p on p.code = w.plan_code where w.id = p_ws), 0);
  if p_monthly_requests is not null and (p_monthly_requests < 1 or p_monthly_requests > v_plan) then
    raise exception 'AI_QUOTA_OUT_OF_PLAN' using errcode = '22023';
  end if;
  if p_user_daily_requests is not null and (p_user_daily_requests < 1 or p_user_daily_requests > 500) then
    raise exception 'INVALID' using errcode = '22023';
  end if;
  v_new := v_cur || jsonb_build_object('enabled', p_enabled);
  if p_features is not null then
    v_new := v_new || jsonb_build_object('features', coalesce(v_cur -> 'features', '{}'::jsonb) || p_features);
  end if;
  if p_monthly_requests is not null then v_new := v_new || jsonb_build_object('monthlyRequests', p_monthly_requests); end if;
  if p_user_daily_requests is not null then v_new := v_new || jsonb_build_object('userDailyRequests', p_user_daily_requests); end if;
  perform set_config('fd.ai_set', '1', true);
  update public.workspaces set settings = settings || jsonb_build_object('ai', v_new), updated_at = now() where id = p_ws;
  perform set_config('fd.ai_set', '0', true);
  return public.ai_status(p_ws);
end $$;

-- ===== État lu par l'interface (membres) : désactivé / quota atteint sans appel au fournisseur =====
create or replace function public.ai_status(p_ws uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cfg jsonb;
  v_month date := date_trunc('month', (now() at time zone 'utc'))::date;
  v_today date := (now() at time zone 'utc')::date;
  v_used int;
  v_tokens bigint;
  v_mine int;
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_cfg := public.ai_config(p_ws);
  select coalesce(sum(requests), 0), coalesce(sum(input_tokens + output_tokens), 0) into v_used, v_tokens
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
    'renewsOn', (v_month + interval '1 month')::date,
    'canEdit', public.has_role(p_ws, 'editor'),
    'canManage', public.has_role(p_ws, 'admin')
  );
end $$;
revoke all on function public.ai_status(uuid) from public, anon;
grant execute on function public.ai_status(uuid) to authenticated;

revoke all on function public.set_ai_settings(uuid, boolean, jsonb, int, int) from public, anon;
grant execute on function public.set_ai_settings(uuid, boolean, jsonb, int, int) to authenticated;

-- ===== Réservation et clôture (Edge Function « ai », service_role) =====
-- Réserve une demande AVANT l'appel au fournisseur (verrou par espace : pas de dépassement concurrent).
create or replace function public.ai_reserve(p_ws uuid, p_user uuid, p_feature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cfg jsonb;
  v_month date := date_trunc('month', (now() at time zone 'utc'))::date;
  v_today date := (now() at time zone 'utc')::date;
  v_used int;
  v_tokens bigint;
  v_mine int;
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
  select coalesce(sum(requests), 0), coalesce(sum(input_tokens + output_tokens), 0) into v_used, v_tokens
    from public.ai_usage where workspace_id = p_ws and day >= v_month;
  if v_used >= (v_cfg ->> 'monthlyRequests')::int or v_tokens >= (v_cfg ->> 'monthlyTokens')::bigint then
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

-- Ajoute les jetons consommés. p_refund : l'appel au fournisseur a échoué sans réponse, la demande
-- réservée est rendue (une erreur ne consomme pas le quota).
create or replace function public.ai_commit(p_ws uuid, p_user uuid, p_input bigint, p_output bigint, p_refund boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'utc')::date;
begin
  if p_input < 0 or p_output < 0 then raise exception 'INVALID' using errcode = '22023'; end if;
  insert into public.ai_usage (workspace_id, user_id, day, input_tokens, output_tokens)
    values (p_ws, p_user, v_today, p_input, p_output)
    on conflict (workspace_id, user_id, day) do update
      set input_tokens = public.ai_usage.input_tokens + excluded.input_tokens,
          output_tokens = public.ai_usage.output_tokens + excluded.output_tokens,
          requests = greatest(public.ai_usage.requests - case when p_refund then 1 else 0 end, 0);
end $$;

revoke all on function public.ai_reserve(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.ai_commit(uuid, uuid, bigint, bigint, boolean) from public, anon, authenticated;
grant execute on function public.ai_reserve(uuid, uuid, text) to service_role;
grant execute on function public.ai_commit(uuid, uuid, bigint, bigint, boolean) to service_role;
