-- F7 (L21) : type d'étape « vidéo ». Fichier à part : une nouvelle valeur d'enum doit être validée
-- avant d'être utilisée (20261119150100_video_mobile.sql).
alter type public.step_kind add value if not exists 'video';
