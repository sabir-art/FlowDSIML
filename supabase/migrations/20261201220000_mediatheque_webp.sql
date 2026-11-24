-- Médiathèque : le format WebP est accepté (retours client du 24/11 §3.2 et §3.4, décision du chef).
-- Nouveau fichier ; idempotent.
--  * Le bucket « media » et la table media_files acceptent image/webp. Le type réel reste lu par la
--    fonction media sur la signature du fichier (RIFF … WEBP), jamais sur l'extension ni le type annoncé.
--  * Page publique : un logo WebP de la médiathèque est un logo valide.

update storage.buckets
   set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'font/woff2']
 where id = 'media';

alter table public.media_files drop constraint if exists media_files_mime_check;
alter table public.media_files add constraint media_files_mime_check
  check (mime in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'font/woff2'));

-- Redéfinie à l'identique de 20261201190000_page_publique_catalogue.sql, avec .webp pour le logo
create or replace function public.public_page_valid(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_object_keys(p) k
                     where k not in ('title', 'tagline', 'logo', 'demos', 'contact', 'madeWith'))
    and (not p ? 'title' or (jsonb_typeof(p -> 'title') = 'string' and char_length(p ->> 'title') <= 120))
    and (not p ? 'tagline' or (jsonb_typeof(p -> 'tagline') = 'string' and char_length(p ->> 'tagline') <= 160))
    and (not p ? 'logo' or jsonb_typeof(p -> 'logo') = 'null'
         or (jsonb_typeof(p -> 'logo') = 'string'
             and (p ->> 'logo') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.(png|jpe?g|svg|webp)$'))
    and (not p ? 'demos' or p -> 'demos' = '"all"'::jsonb
         or (jsonb_typeof(p -> 'demos') = 'array' and jsonb_array_length(p -> 'demos') <= 100
             and not exists (select 1 from jsonb_array_elements(p -> 'demos') d
                              where jsonb_typeof(d) <> 'string'
                                 or (d #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))
    and (not p ? 'contact' or (jsonb_typeof(p -> 'contact') = 'string' and char_length(p ->> 'contact') <= 200
         and ((p ->> 'contact') = '' or (p ->> 'contact') ~ '^https://[^\s<>"]+$'
              or (p ->> 'contact') ~ '^[^@\s<>"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$')))
    and (not p ? 'madeWith' or jsonb_typeof(p -> 'madeWith') = 'boolean');
$$;
