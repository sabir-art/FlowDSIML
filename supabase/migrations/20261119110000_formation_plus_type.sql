-- L17 : type d'étape « Avant / Après ». Valeur ajoutée seule dans ce fichier : une valeur nouvelle
-- d'un enum n'est pas utilisable dans la transaction qui l'ajoute (voir 20261119110100).
alter type public.step_kind add value if not exists 'before_after';
