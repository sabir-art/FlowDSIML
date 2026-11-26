-- L41 étape 3 (docs/tech/ia-fournisseurs.md §5) : modèle par fonction, repli et coupure.
--  * ai_function_models : le modèle choisi dans la Console pour une fonction ; sans ligne, le modèle par
--    défaut du code (aucun changement de comportement tant que rien n'est choisi).
--  * ai_cut : fonctions de l'espace coupées pour tous les espaces (clé du fournisseur manquante ou
--    refusée), tenue à jour par l’Edge Function `ai` ; ai_status la rend dans « unavailable ».
--  * Journal : ai.model_changed (fonction, ancien et nouveau modèle).

create table if not exists public.ai_function_models (
  fn text primary key check (fn in ('assistant', 'write', 'suggest', 'translate', 'voice', 'captions')),
  model text not null check (model ~ '^[a-z0-9._-]{1,80}$'),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.ai_function_models enable row level security;
revoke all on table public.ai_function_models from public, anon, authenticated;
grant select on table public.ai_function_models to service_role;

create table if not exists public.ai_cut (
  feature text primary key,
  since timestamptz not null default now()
);
alter table public.ai_cut enable row level security;
revoke all on table public.ai_cut from public, anon, authenticated;
grant select on table public.ai_cut to service_role;

-- Choix d'un modèle (Edge Function, au nom d'un admin de la plateforme) ; null : retour au défaut.
-- p_label : libellé lisible du journal (« Traduction · Claude Sonnet (défaut) → Claude Opus »), écrit
-- par l'Edge Function à partir du catalogue ; sans lui, les identifiants.
create or replace function public.ai_set_function_model(p_fn text, p_model text, p_actor uuid, p_label text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if p_fn not in ('assistant', 'write', 'suggest', 'translate', 'voice', 'captions') then
    raise exception 'BAD_FUNCTION';
  end if;
  if p_model is not null and p_model !~ '^[a-z0-9._-]{1,80}$' then raise exception 'BAD_MODEL'; end if;
  if not exists (select 1 from public.platform_admins where user_id = p_actor and role = 'admin') then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  select model into v_old from public.ai_function_models where fn = p_fn;
  if p_model is null then
    delete from public.ai_function_models where fn = p_fn;
  else
    insert into public.ai_function_models (fn, model, updated_by, updated_at)
    values (p_fn, p_model, p_actor, now())
    on conflict (fn) do update set model = excluded.model, updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  end if;
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label)
  values (p_actor, 'ai.model_changed', 'ai', p_fn,
          left(coalesce(nullif(p_label, ''),
                        p_fn || ' · ' || coalesce(v_old, 'défaut') || ' → ' || coalesce(p_model, 'défaut')), 200));
  return jsonb_build_object('old', v_old);
end $$;

-- Fonctions de l'espace coupées : l'ensemble est remplacé (rôle de service)
create or replace function public.ai_set_cut(p_features text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from unnest(coalesce(p_features, '{}')) f where f <> all (public.ai_features())) then
    raise exception 'INVALID_FEATURE';
  end if;
  delete from public.ai_cut where feature <> all (coalesce(p_features, '{}'));
  insert into public.ai_cut (feature) select f from unnest(coalesce(p_features, '{}')) f
  on conflict (feature) do nothing;
end $$;

revoke all on function public.ai_set_function_model(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.ai_set_cut(text[]) from public, anon, authenticated;
grant execute on function public.ai_set_function_model(text, text, uuid, text) to service_role;
grant execute on function public.ai_set_cut(text[]) to service_role;

-- ai_status : inchangé, plus « unavailable »
create or replace function public.ai_status(p_ws uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_cfg jsonb;
  v_month date := date_trunc('month', (now() at time zone 'utc'))::date;
  v_today date := (now() at time zone 'utc')::date;
  v_used int;
  v_tokens bigint;
  v_mine int;
  v_tts int;
  v_stt int;
begin
  if not public.has_role(p_ws, 'viewer') then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  v_cfg := public.ai_config(p_ws);
  select coalesce(sum(requests), 0), coalesce(sum(input_tokens + output_tokens), 0),
         coalesce(sum(tts_seconds), 0), coalesce(sum(stt_seconds), 0)
    into v_used, v_tokens, v_tts, v_stt
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
    'ttsUsed', v_tts,
    'ttsQuota', v_cfg -> 'monthlyTtsSeconds',
    'sttUsed', v_stt,
    'sttQuota', v_cfg -> 'monthlySttSeconds',
    'renewsOn', (v_month + interval '1 month')::date,
    'canEdit', public.has_role(p_ws, 'editor'),
    'canManage', public.has_role(p_ws, 'admin'),
    -- L41 étape 3 : fonctions coupées pour tous les espaces (clé du fournisseur manquante ou refusée),
    -- sans nom de fournisseur : l'app affiche « Indisponible pour le moment »
    'unavailable', (select coalesce(jsonb_agg(feature order by feature), '[]'::jsonb) from public.ai_cut)
  );
end $$;
revoke all on function public.ai_status(uuid) from public, anon;
grant execute on function public.ai_status(uuid) to authenticated;

