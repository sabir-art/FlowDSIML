-- L41 étape 2 (docs/tech/ia-fournisseurs.md §4) : clés des fournisseurs IA dans le coffre (Vault).
--  * Une clé par fournisseur, secret « ai_key_<fournisseur> », écrite seulement après un test réussi,
--    par l'Edge Function `ai` (rôle de service), jamais relue par le navigateur ni par une RPC client.
--  * Table ai_providers : l'état seul (date d'ajout, dernier test), jamais la clé. RLS fermée ; la Console
--    la lit par l'Edge Function, qui ajoute l'état des clés de déploiement (repli de la transition).
--  * Journal console_audit : ai.key_added, ai.key_replaced, ai.key_tested (cause nommée, jamais la clé).

create table if not exists public.ai_providers (
  provider text primary key check (provider in ('anthropic', 'openai', 'elevenlabs')),
  added_at timestamptz,
  added_by uuid references auth.users (id) on delete set null,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_error text check (last_test_error is null or last_test_error ~ '^[A-Z_]{1,30}$'),
  last_test_ms integer check (last_test_ms is null or last_test_ms between 0 and 600000)
);
alter table public.ai_providers enable row level security;
revoke all on table public.ai_providers from public, anon, authenticated;

-- Lecture de la clé : Edge Function seulement. Sans coffre (base de test, local), null.
create or replace function public.ai_key_read(p_provider text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  if p_provider not in ('anthropic', 'openai', 'elevenlabs') then return null; end if;
  if to_regclass('vault.decrypted_secrets') is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v using 'ai_key_' || p_provider;
  return v;
end $$;

-- Enregistrement d'une clé testée : coffre, état, journal (auteur : le compte de la Console, vérifié admin)
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
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label)
  values (p_actor, case when v_had then 'ai.key_replaced' else 'ai.key_added' end, 'ai', p_provider, p_provider);
  return jsonb_build_object('replaced', v_had);
end $$;

-- Résultat d'un test (clé enregistrée ou de déploiement) : état et journal, cause nommée seulement
create or replace function public.ai_key_tested(
  p_provider text, p_ok boolean, p_cause text, p_ms integer, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_provider not in ('anthropic', 'openai', 'elevenlabs') then raise exception 'BAD_PROVIDER'; end if;
  if p_cause is not null and p_cause !~ '^[A-Z_]{1,30}$' then raise exception 'BAD_CAUSE'; end if;
  if not exists (select 1 from public.platform_admins where user_id = p_actor and role = 'admin') then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
  insert into public.ai_providers as a (provider, last_test_at, last_test_ok, last_test_error, last_test_ms)
  values (p_provider, now(), p_ok, case when p_ok then null else p_cause end, greatest(0, least(p_ms, 600000)))
  on conflict (provider) do update set
    last_test_at = excluded.last_test_at, last_test_ok = excluded.last_test_ok,
    last_test_error = excluded.last_test_error, last_test_ms = excluded.last_test_ms;
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label)
  values (p_actor, 'ai.key_tested', 'ai', p_provider,
          p_provider || ' · ' || case when p_ok then 'ok' else coalesce(p_cause, 'PROVIDER') end);
end $$;

revoke all on function public.ai_key_read(text) from public, anon, authenticated;
revoke all on function public.ai_key_save(text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.ai_key_tested(text, boolean, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.ai_key_read(text) to service_role;
grant execute on function public.ai_key_save(text, text, uuid, integer) to service_role;
grant execute on function public.ai_key_tested(text, boolean, text, integer, uuid) to service_role;
grant select on table public.ai_providers to service_role;
