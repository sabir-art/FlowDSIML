# F3 : brouillon en pause

F3 (suivi des apprenants) est suspendu à la demande du chef d'équipe, en attendant la fin du chantier de conformité aux maquettes (D13).

La migration et son test pgTAP sont rangés ici pour qu'ils ne partent pas en production : Deploy applique tout le contenu de `supabase/migrations`.

À la reprise de F3 :
- remettre `20261117131300_suivi_apprenants.sql` dans `supabase/migrations/` (avec un horodatage plus récent si d'autres migrations ont été ajoutées entre-temps) et `suivi.test.sql` dans `supabase/tests/` ;
- intégrer F3b, accordé sur le principe : OTP Supabase pour l'accès par domaine, bucket privé et URL signées pour l'accès restreint. Pour les relances, mailto groupé en attendant un SMTP.
