-- EXT-02 §6.1 : type d'étape « Fenêtre » (image + texte). C'est une étape de texte dont l'affichage vaut
-- « window » ; son image est rangée dans image_path, déjà publiée et déjà contrôlée (dossier de l'espace).
-- Seule la liste des affichages permis change ; le reste de la contrainte est repris à l'identique.
alter table public.steps drop constraint if exists steps_options_object;
alter table public.steps add constraint steps_options_object check (
  jsonb_typeof(options) = 'object'
  and (not options ? 'choices' or (jsonb_typeof(options -> 'choices') = 'array' and jsonb_array_length(options -> 'choices') <= 6))
  and coalesce(options ->> 'display', 'screen') in ('screen', 'popup', 'window')
  and coalesce(options ->> 'variant', 'info') in ('info', 'instruction')
  and coalesce(options ->> 'background', 'blur') in ('blur', 'color'));
