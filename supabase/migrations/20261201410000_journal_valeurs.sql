-- L41 étape 6 (docs/tech/ia-fournisseurs.md §8, spec UX §6) : le journal de la Console garde l'ancienne et
-- la nouvelle valeur d'un changement (jamais une clé).
--  * console_audit : colonnes old_value et new_value (200 caractères au plus, nulles pour les anciennes
--    lignes et les actions sans valeur) ; console_audit_list les rend.
--  * private.console_log : variante à six paramètres ; celle à quatre reste.
--  * Modèles IA : les fonctions d'écriture écrivent les deux valeurs. Clés : un état (« Aucune clé »,
--    « Clé enregistrée », « Test réussi », « Échec : UNAUTHORIZED », « Jamais testée » avant un premier test), jamais la clé. Modèles, liste de
--    l'assistant et règles d'Auto : libellés lisibles fournis par l'Edge Function (catalogue), sinon les
--    identifiants. Le libellé de l'objet devient le nom de ce qui change (« Traduction », « Anthropic »).
--  Les migrations précédentes ne changent pas : les fonctions sont remplacées ici.

alter table public.console_audit
  add column if not exists old_value text check (char_length(old_value) <= 200),
  add column if not exists new_value text check (char_length(new_value) <= 200);

create or replace function private.console_log(
  p_action text, p_type text, p_id text, p_label text, p_old text, p_new text
) returns void language sql security definer set search_path = '' as $$
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label, old_value, new_value)
  values ((select auth.uid()), p_action, coalesce(p_type, ''), coalesce(p_id, ''), left(coalesce(p_label, ''), 200),
          left(p_old, 200), left(p_new, 200));
$$;
revoke all on function private.console_log(text, text, text, text, text, text) from public, anon, authenticated;

create or replace function public.console_audit_list(p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.console_read();
  return coalesce((select jsonb_agg(x order by (x ->> 'at') desc) from (
      select jsonb_build_object('id', a.id, 'at', a.at, 'actor', coalesce(p.full_name, u.email, ''),
                                'actorId', a.actor_id, 'action', a.action, 'objectType', a.object_type,
                                'label', a.object_label, 'old', a.old_value, 'new', a.new_value) as x
        from public.console_audit a
        left join auth.users u on u.id = a.actor_id
        left join public.profiles p on p.id = a.actor_id
       order by a.at desc limit greatest(1, least(p_limit, 2000))) y), '[]'::jsonb);
end $$;

-- Nom lisible d'un fournisseur (journal)
create or replace function private.ai_provider_label(p text)
returns text language sql immutable set search_path = '' as $$
  select case p when 'anthropic' then 'Anthropic' when 'openai' then 'OpenAI'
                when 'elevenlabs' then 'ElevenLabs' else p end;
$$;
revoke all on function private.ai_provider_label(text) from public, anon, authenticated;

-- État du dernier test d'une clé, tel qu'il s'écrit dans le journal
create or replace function private.ai_test_state(p_at timestamptz, p_ok boolean, p_cause text)
returns text language sql immutable set search_path = '' as $$
  select case when p_at is null then 'Jamais testée' when p_ok then 'Test réussi'
              else 'Échec : ' || coalesce(p_cause, 'PROVIDER') end;
$$;
revoke all on function private.ai_test_state(timestamptz, boolean, text) from public, anon, authenticated;

-- Clé enregistrée : même signature, le journal porte l'état avant et après
create or replace function public.ai_key_save(p_provider text, p_key text, p_actor uuid, p_ms integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text := 'ai_key_' || p_provider;
  v_id uuid;
  v_had boolean;
begin
  if p_provider not in ('anthropic', 'openai', 'elevenlabs') then raise exception 'BAD_PROVIDER'; end if;
  if p_key is null or char_length(p_key) not between 10 and 500 or p_key ~ '\s' then
    raise exception 'BAD_KEY';
  end if;
  if not exists (select 1 from public.platform_admins where user_id = p_actor and role = 'admin') then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  if to_regclass('vault.secrets') is null then raise exception 'NO_VAULT'; end if;
  execute 'select id from vault.secrets where name = $1 limit 1' into v_id using v_name;
  v_had := v_id is not null;
  if v_had then
    execute 'select vault.update_secret($1, $2)' using v_id, p_key;
  else
    execute 'select vault.create_secret($1, $2)' using p_key, v_name;
  end if;
  insert into public.ai_providers as a (provider, added_at, added_by, last_test_at, last_test_ok, last_test_error, last_test_ms)
  values (p_provider, now(), p_actor, now(), true, null, greatest(0, least(p_ms, 600000)))
  on conflict (provider) do update set
    added_at = excluded.added_at, added_by = excluded.added_by, last_test_at = excluded.last_test_at,
    last_test_ok = true, last_test_error = null, last_test_ms = excluded.last_test_ms;
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label, old_value, new_value)
  values (p_actor, case when v_had then 'ai.key_replaced' else 'ai.key_added' end, 'ai', p_provider,
          private.ai_provider_label(p_provider),
          case when v_had then 'Clé enregistrée' else 'Aucune clé' end,
          case when v_had then 'Clé remplacée, test réussi' else 'Clé enregistrée, test réussi' end);
  return jsonb_build_object('replaced', v_had);
end $$;

-- Résultat d'un test : même signature, état du test précédent et du nouveau
create or replace function public.ai_key_tested(
  p_provider text, p_ok boolean, p_cause text, p_ms integer, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if p_provider not in ('anthropic', 'openai', 'elevenlabs') then raise exception 'BAD_PROVIDER'; end if;
  if p_cause is not null and p_cause !~ '^[A-Z_]{1,30}$' then raise exception 'BAD_CAUSE'; end if;
  if not exists (select 1 from public.platform_admins where user_id = p_actor and role = 'admin') then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  select private.ai_test_state(last_test_at, last_test_ok, last_test_error) into v_old
    from public.ai_providers where provider = p_provider;
  insert into public.ai_providers as a (provider, last_test_at, last_test_ok, last_test_error, last_test_ms)
  values (p_provider, now(), p_ok, case when p_ok then null else p_cause end, greatest(0, least(p_ms, 600000)))
  on conflict (provider) do update set
    last_test_at = excluded.last_test_at, last_test_ok = excluded.last_test_ok,
    last_test_error = excluded.last_test_error, last_test_ms = excluded.last_test_ms;
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label, old_value, new_value)
  values (p_actor, 'ai.key_tested', 'ai', p_provider, private.ai_provider_label(p_provider),
          coalesce(v_old, 'Jamais testée'), private.ai_test_state(now(), p_ok, p_cause));
end $$;

-- Modèle par fonction : p_old et p_new (libellés lisibles) s'ajoutent ; sans eux, les identifiants
drop function if exists public.ai_set_function_model(text, text, uuid, text);
create or replace function public.ai_set_function_model(
  p_fn text, p_model text, p_actor uuid, p_label text default null, p_old text default null, p_new text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
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
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label, old_value, new_value)
  values (p_actor, 'ai.model_changed', 'ai', p_fn, left(coalesce(nullif(p_label, ''), p_fn), 200),
          left(coalesce(nullif(p_old, ''), v_old, 'défaut'), 200),
          left(coalesce(nullif(p_new, ''), p_model, 'défaut'), 200));
  return jsonb_build_object('old', v_old);
end $$;

-- Liste de l'assistant : liste avant et après (libellés de l'Edge Function, sinon les identifiants)
drop function if exists public.ai_assistant_set(jsonb, uuid, text);
create or replace function public.ai_assistant_set(
  p_models jsonb, p_actor uuid, p_label text default null, p_old text default null, p_new text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform private.ai_admin_or_fail(p_actor);
  if jsonb_typeof(p_models) <> 'array' or jsonb_array_length(p_models) = 0 or jsonb_array_length(p_models) > 50 then
    raise exception 'BAD_LIST';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_models) e where (e ->> 'proposed')::boolean) then
    raise exception 'LAST_MODEL';
  end if;
  select string_agg(model, ', ' order by position) into v_old from public.ai_assistant_models where proposed;
  delete from public.ai_assistant_models
   where model not in (select e ->> 'model' from jsonb_array_elements(p_models) e);
  insert into public.ai_assistant_models (model, position, proposed, tag, updated_by, updated_at)
  select e ->> 'model', (e ->> 'position')::int, (e ->> 'proposed')::boolean, coalesce(e ->> 'tag', 'none'),
         p_actor, now()
    from jsonb_array_elements(p_models) e
  on conflict (model) do update set position = excluded.position, proposed = excluded.proposed,
    tag = excluded.tag, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label, old_value, new_value)
  values (p_actor, 'ai.assistant_list', 'ai', 'assistant', left(coalesce(nullif(p_label, ''), 'assistant'), 200),
          left(coalesce(nullif(p_old, ''), v_old, ''), 200),
          left(coalesce(nullif(p_new, ''),
               (select string_agg(model, ', ' order by position) from public.ai_assistant_models where proposed)), 200));
end $$;

-- Règle d'Auto : modèle avant et après
drop function if exists public.ai_auto_rule_set(text, text, uuid, text);
create or replace function public.ai_auto_rule_set(
  p_rule text, p_model text, p_actor uuid, p_label text default null, p_old text default null, p_new text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform private.ai_admin_or_fail(p_actor);
  if p_rule not in ('short', 'whole_demo', 'fallback') then raise exception 'BAD_RULE'; end if;
  if p_model is null or p_model !~ '^[a-z0-9._-]{1,80}$' then raise exception 'BAD_MODEL'; end if;
  select model into v_old from public.ai_auto_rules where rule = p_rule;
  insert into public.ai_auto_rules (rule, model, updated_by, updated_at) values (p_rule, p_model, p_actor, now())
  on conflict (rule) do update set model = excluded.model, updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label, old_value, new_value)
  values (p_actor, 'ai.auto_rule', 'ai', p_rule, left(coalesce(nullif(p_label, ''), p_rule), 200),
          left(coalesce(nullif(p_old, ''), v_old, '-'), 200), left(coalesce(nullif(p_new, ''), p_model), 200));
  return jsonb_build_object('old', v_old);
end $$;

revoke all on function public.ai_set_function_model(text, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.ai_assistant_set(jsonb, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.ai_auto_rule_set(text, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.ai_set_function_model(text, text, uuid, text, text, text) to service_role;
grant execute on function public.ai_assistant_set(jsonb, uuid, text, text, text) to service_role;
grant execute on function public.ai_auto_rule_set(text, text, uuid, text, text, text) to service_role;
