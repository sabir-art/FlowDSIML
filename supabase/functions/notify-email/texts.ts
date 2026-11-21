// E-mails P2 : textes du résumé, repris de apps/web/src/locales/fr.json (même texte que dans l'app).
// Copie nécessaire (la fonction est déployée seule) ; un test de l'app vérifie qu'ils restent identiques.
export const FR: Record<string, string> = {
  'notifications.k_mention': '{{actor}} vous a mentionné·e dans « {{demo}} » · étape {{step}}',
  'notifications.k_reply': '{{actor}} a répondu à votre commentaire · « {{demo}} » · étape {{step}}',
  'notifications.k_comment': '{{actor}} a commenté « {{demo}} » · étape {{step}}',
  'notifications.k_resolved': '{{actor}} a résolu votre commentaire · « {{demo}} » · étape {{step}}',
  'notifications.k_invite': '{{actor}} vous invite à rejoindre « {{workspace}} »',
  'notifications.someone': 'Un membre',
  'notifications.allDemos': 'toutes les démos',
  'notifications.alert_lead_one': '1 nouveau lead · {{demo}}',
  'notifications.alert_lead_other': '{{count}} nouveaux leads · {{demo}}',
  'notifications.alert_cta_one': '1 clic sur le bouton d’action · {{demo}}',
  'notifications.alert_cta_other': '{{count}} clics sur le bouton d’action · {{demo}}',
  'notifications.alert_link_opened_one': '1 lien personnalisé ouvert · {{demo}}',
  'notifications.alert_link_opened_other': '{{count}} liens personnalisés ouverts · {{demo}}',
  'notifications.alert_quiz_failed_last_one':
    '1 apprenant a échoué au quiz à sa dernière tentative · {{demo}}',
  'notifications.alert_quiz_failed_last_other':
    '{{count}} apprenants ont échoué au quiz à leur dernière tentative · {{demo}}',
  'notifications.alert_completion_below':
    'Taux de complétion à {{value}} %, sous le seuil de {{threshold}} % · {{demo}}',
  'notifications.alert_views_above': '{{value}} vues en 24 h, au-dessus du seuil de {{threshold}} · {{demo}}',
  'notifications.alert_structure_below_goal':
    'Une structure est à {{value}} % de personnes formées, sous l’objectif de {{threshold}} %',
  'demos.untitled': 'Nouvelle démo',
  'email.digest.subject_one': '1 nouvelle notification dans TutoClick',
  'email.digest.subject_other': '{{count}} nouvelles notifications dans TutoClick',
  'email.digest.more_one': 'Et 1 autre dans TutoClick',
  'email.digest.more_other': 'Et {{count}} autres dans TutoClick',
  'email.digest.open': 'Ouvrir les notifications',
  'email.digest.why':
    'Vous recevez cet e-mail parce que vous avez activé les notifications par e-mail dans TutoClick.',
  'email.digest.unsubscribe': 'Ne plus recevoir ces e-mails',
};
