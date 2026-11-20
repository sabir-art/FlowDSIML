-- L28-05 (051, reprise Lead UX) : image d'une capture HTML. Petite migration : html_ops_ok accepte
--  * la clé « fit » sur une opération image : « contain » (Ajuster, par défaut) ou « cover » (Remplir) ;
--  * l'opération « mask » (« Masquer l'image » : aplat de la couleur de fond, à la même taille), sans valeur.
-- Le reste de la règle est inchangé (20261119210000_l25_donnees.sql). Idempotent.
create or replace function public.html_ops_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 500
    and not exists (
      select 1 from jsonb_array_elements(v) o
      where jsonb_typeof(o) <> 'object'
         or exists (select 1 from jsonb_object_keys(o) k where k not in ('id', 'sel', 'sels', 'op', 'value', 'before', 'scope', 'group', 'fit'))
         or coalesce(o ->> 'id', '') !~ '^[A-Za-z0-9_-]{1,40}$'
         or jsonb_typeof(o -> 'sel') <> 'string' or char_length(o ->> 'sel') not between 1 and 500
         or coalesce(o ->> 'op', '') not in ('text', 'hide', 'blur', 'link', 'image', 'remove', 'style', 'chart', 'mask')
         or coalesce(o ->> 'scope', '') not in ('step', 'all')
         or (o -> 'group' is not null and coalesce(o ->> 'group', '') !~ '^[A-Za-z0-9_-]{1,40}$')
         -- L25-07 : plusieurs éléments pour un style (une seule ligne de modification)
         or (o -> 'sels' is not null and (o ->> 'op' <> 'style' or jsonb_typeof(o -> 'sels') <> 'array'
             or jsonb_array_length(o -> 'sels') not between 1 and 200
             or exists (select 1 from jsonb_array_elements(o -> 'sels') x
                        where jsonb_typeof(x) <> 'string' or char_length(x #>> '{}') not between 1 and 500)))
         or (o ->> 'op' = 'style' and not public.html_style_ok(o -> 'value'))
         or (o ->> 'op' = 'chart' and not public.html_chart_ok(o -> 'value'))
         or (o ->> 'op' not in ('style', 'chart') and o -> 'value' is not null
             and (jsonb_typeof(o -> 'value') <> 'string' or char_length(o ->> 'value') > 5000))
         or (o -> 'before' is not null and (jsonb_typeof(o -> 'before') <> 'string' or char_length(o ->> 'before') > 5000))
         or (o ->> 'op' in ('text', 'link', 'image') and jsonb_typeof(o -> 'value') is distinct from 'string')
         or (o ->> 'op' = 'link' and (o ->> 'value') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         -- L28-05 : Ajuster (contain) ou Remplir (cover), sur une image remplacée seulement
         or (o -> 'fit' is not null and (o ->> 'op' <> 'image' or coalesce(o ->> 'fit', '') not in ('contain', 'cover')))
         -- L28-05 : « Masquer l'image » (aplat de la couleur de fond), sans valeur
         or (o ->> 'op' = 'mask' and o -> 'value' is not null)
         or (o ->> 'op' = 'image' and (o ->> 'value') !~ '^[0-9a-f-]{36}/[0-9A-Za-z/._-]{1,200}\.(webp|png|jpe?g|gif|svg)$'));
$$;
