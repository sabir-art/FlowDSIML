-- Aide : article « Accessibilité de TutoClick » (apps/web/src/aide/accessibilite-tutoclick.md).
-- La déclaration d'accessibilité y renvoie pour le retour d'information : « Cet article vous a aidé ? »
-- n'accepte un avis que pour un article connu en base (help_articles, L41). Une ligne de référence,
-- rien d'autre ne change (table, droits et RLS inchangés).
insert into public.help_articles (slug) values ('accessibilite-tutoclick') on conflict do nothing;
