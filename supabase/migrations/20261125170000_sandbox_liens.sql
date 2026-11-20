-- L48-G §5 : liens sans page du Sandbox. Les liens « laissés volontairement » (le message de clic non relié
-- reste) sont gardés dans demos.sandbox.ignoredLinks : [{ url, from }], url http(s) de 2 048 caractères
-- au plus, from = id de la page d'origine ; 500 entrées au plus. Redéfinition de sandbox_ok
-- (20261119160100, migration figée) ; la contrainte demos_sandbox_check l'appelle telle quelle.
create or replace function public.sandbox_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select v is null or (jsonb_typeof(v) = 'object'
    and not exists (select 1 from jsonb_object_keys(v) k
                    where k not in ('start', 'autoLink', 'unlinked', 'guide', 'keyPages', 'ignoredLinks'))
    and (v -> 'start' is null or jsonb_typeof(v -> 'start') = 'null'
         or (v ->> 'start') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    and (v -> 'autoLink' is null or jsonb_typeof(v -> 'autoLink') = 'boolean')
    and (v -> 'guide' is null or jsonb_typeof(v -> 'guide') = 'boolean')
    and (v -> 'unlinked' is null or (v ->> 'unlinked') in ('toast', 'none', 'highlight'))
    and (v -> 'keyPages' is null or (jsonb_typeof(v -> 'keyPages') = 'array' and jsonb_array_length(v -> 'keyPages') <= 200
         and not exists (select 1 from jsonb_array_elements(v -> 'keyPages') k
                         where coalesce(k #>> '{}', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
    and (v -> 'ignoredLinks' is null or (jsonb_typeof(v -> 'ignoredLinks') = 'array'
         and jsonb_array_length(v -> 'ignoredLinks') <= 500
         and not exists (select 1 from jsonb_array_elements(v -> 'ignoredLinks') x
                         where jsonb_typeof(x) <> 'object'
                            or exists (select 1 from jsonb_object_keys(x) k where k not in ('url', 'from'))
                            or coalesce(x ->> 'url', '') !~ '^https?://\S+$'
                            or length(x ->> 'url') > 2048
                            or coalesce(x ->> 'from', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))));
$$;
