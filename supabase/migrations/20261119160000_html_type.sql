-- A8 (L20) : type d'étape « html ». Fichier à part : une nouvelle valeur d'enum doit être validée
-- avant d'être utilisée (20261119160100_html_sandbox.sql).
alter type public.step_kind add value if not exists 'html';
