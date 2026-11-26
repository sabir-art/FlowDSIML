-- L41 étape 4 (docs/tech/ia-fournisseurs.md §6, spec UX §4) : modèles proposés dans l'assistant et
-- règles d'« Auto ».
--  * ai_assistant_models : ordre du menu, case Proposer, étiquette (Sans, Recommandé, Bêta). Au moins un
--    modèle proposé (refus « LAST_MODEL »).
--  * ai_auto_rules : demandes courtes, analyse de toute la démo, repli (« next » : le suivant de la liste).
--  * Valeurs de départ : le comportement actuel (Sonnet et Opus proposés et recommandés, Auto sur Sonnet).
--  * Écriture par l'Edge Function `ai` (rôle de service) au nom d'un admin de la plateforme ; journal
--    ai.assistant_list et ai.auto_rule avec un libellé lisible.

create table if not exists public.ai_assistant_models (
  model text primary key check (model ~ '^[a-z0-9._-]{1,80}$'),
  position integer not null check (position between 0 and 999),
  proposed boolean not null default false,
  tag text not null default 'none' check (tag in ('none', 'recommended', 'beta')),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.ai_assistant_models enable row level security;
revoke all on table public.ai_assistant_models from public, anon, authenticated;
grant select on table public.ai_assistant_models to service_role;

create table if not exists public.ai_auto_rules (
  rule text primary key check (rule in ('short', 'whole_demo', 'fallback')),
  model text not null check (model ~ '^[a-z0-9._-]{1,80}$'),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.ai_auto_rules enable row level security;
revoke all on table public.ai_auto_rules from public, anon, authenticated;
grant select on table public.ai_auto_rules to service_role;

insert into public.ai_assistant_models (model, position, proposed, tag) values
  ('claude-sonnet-5-5', 1, true, 'recommended'),
  ('claude-opus-5-5', 2, true, 'recommended'),
  ('claude-haiku-5-5', 3, false, 'none')
on conflict (model) do nothing;
insert into public.ai_auto_rules (rule, model) values
  ('short', 'claude-sonnet-5-5'),
  ('whole_demo', 'claude-sonnet-5-5'),
  ('fallback', 'next')
on conflict (rule) do nothing;

create or replace function private.ai_admin_or_fail(p_actor uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.platform_admins where user_id = p_actor and role = 'admin') then
    raise exception 'NOT_FOUND' using errcode = '42501';
  end if;
end $$;
revoke all on function private.ai_admin_or_fail(uuid) from public, anon, authenticated;

-- Liste complète remplacée : [{ model, position, proposed, tag }] ; au moins un modèle proposé
create or replace function public.ai_assistant_set(p_models jsonb, p_actor uuid, p_label text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.ai_admin_or_fail(p_actor);
  if jsonb_typeof(p_models) <> 'array' or jsonb_array_length(p_models) = 0 or jsonb_array_length(p_models) > 50 then
    raise exception 'BAD_LIST';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_models) e where (e ->> 'proposed')::boolean) then
    raise exception 'LAST_MODEL';
  end if;
  delete from public.ai_assistant_models
   where model not in (select e ->> 'model' from jsonb_array_elements(p_models) e);
  insert into public.ai_assistant_models (model, position, proposed, tag, updated_by, updated_at)
  select e ->> 'model', (e ->> 'position')::int, (e ->> 'proposed')::boolean, coalesce(e ->> 'tag', 'none'),
         p_actor, now()
    from jsonb_array_elements(p_models) e
  on conflict (model) do update set position = excluded.position, proposed = excluded.proposed,
    tag = excluded.tag, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label)
  values (p_actor, 'ai.assistant_list', 'ai', 'assistant', left(coalesce(nullif(p_label, ''), 'assistant'), 200));
end $$;

create or replace function public.ai_auto_rule_set(p_rule text, p_model text, p_actor uuid, p_label text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform private.ai_admin_or_fail(p_actor);
  if p_rule not in ('short', 'whole_demo', 'fallback') then raise exception 'BAD_RULE'; end if;
  if p_model is null or p_model !~ '^[a-z0-9._-]{1,80}$' then raise exception 'BAD_MODEL'; end if;
  select model into v_old from public.ai_auto_rules where rule = p_rule;
  insert into public.ai_auto_rules (rule, model, updated_by, updated_at) values (p_rule, p_model, p_actor, now())
  on conflict (rule) do update set model = excluded.model, updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
  insert into public.console_audit (actor_id, action, object_type, object_id, object_label)
  values (p_actor, 'ai.auto_rule', 'ai', p_rule,
          left(coalesce(nullif(p_label, ''), p_rule || ' · ' || coalesce(v_old, '-') || ' → ' || p_model), 200));
  return jsonb_build_object('old', v_old);
end $$;

revoke all on function public.ai_assistant_set(jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.ai_auto_rule_set(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.ai_assistant_set(jsonb, uuid, text) to service_role;
grant execute on function public.ai_auto_rule_set(text, text, uuid, text) to service_role;
