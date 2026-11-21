-- L52 P1 : 8 couleurs d'étiquettes (ardoise, sarcelle et violet en plus). Aucune donnée ne change.
alter table public.tags drop constraint if exists tags_color_check;
alter table public.tags add constraint tags_color_check
  check (color in ('blue', 'green', 'orange', 'raspberry', 'plum', 'slate', 'teal', 'violet'));
