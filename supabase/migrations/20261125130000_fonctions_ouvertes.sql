-- L48-A §6 : plus aucune fonction n'est réservée à une offre (décision du client du 20 novembre :
-- outil interne de la DSI, sans paiement). Les vérifications serveur lisent plan_limit(ws, clé) :
-- elles laissent donc passer pour toutes les offres. Les quotas (démos publiées, membres, IA, voix,
-- stockage, conservation) ne changent pas. Aucun droit de rôle ne change.
update public.plans
   set limits = limits || '{"lead_forms": true, "remove_branding": true, "share_rules": true}'::jsonb;
