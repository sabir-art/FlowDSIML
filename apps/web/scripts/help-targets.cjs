/**
 * Correspondance entre les cibles des scénarios (hypothèses d'après les maquettes) et les noms
 * accessibles réels de l'app. Clé : « visite#n° d'étape ». `before` : clics de préparation.
 * Les textes des bulles ne changent pas ; les écarts de sens sont signalés à la Lead UX.
 */
const LIST = { role: 'list', name: 'Étapes, réordonnables avec Espace puis les flèches' };
const HOTSPOT_ITEM = { role: 'button', name: '1. Créez une opportunité' };
const BLUR_STEP = { role: 'button', name: '2 Écran 2 1 zone floutée' };
module.exports = {
  'page:demos#4': { role: 'group', name: 'Statut' },
  'page:editor#1': LIST,
  'page:editor#3': { before: [HOTSPOT_ITEM] },
  'page:editor#4': { name: 'Flou ou masque' },
  'page:distribution#1': { name: 'SCORM' },
  'page:analytics#1': { selector: '.kpis' },
  'page:center#1': { role: 'region', name: 'Type de centre' },
  'page:center#2': { name: 'Adresse de la page' },
  'page:center#3': { role: 'region', name: 'Formations visibles' },
  'page:distribution#4': { exact: false },
  'page:learners#1': { selector: '.l13-table' },
  'page:learners#2': { selector: '.l13-table .l13-name:has-text("Léa Exemple")' },
  'page:learners#3': { name: 'Exporter CSV' },
  'page:settings#3': { name: 'Contact d’aide' },
  'learn:edit#1': LIST,
  'learn:edit#3': { before: [HOTSPOT_ITEM] },
  'learn:blur#1': { name: 'Flou ou masque' },
  'learn:blur#2': { before: [BLUR_STEP, { role: 'button', name: 'Flou ou masque' }] },
  'learn:blur#3': {
    role: 'radiogroup',
    name: 'Style de masquage',
    reload: true,
    before: [BLUR_STEP, { selector: '.canvas-blur' }],
  },
  'learn:blur#4': { role: 'radio', name: 'Toutes les étapes, même position' },
  'learn:blur#5': { before: [{ role: 'button', name: 'Publier' }] },
  'learn:share#2': { role: 'link', name: 'Partager' },
  'learn:distribute#1': { name: 'Plus d’options' },
  'learn:distribute#2': { name: 'SCORM' },
  'learn:distribute#7': { exact: false },
  'learn:distribute#6': { name: 'Copier le code d’intégration', before: [{ role: 'tab', name: 'Intranet' }] },
  'learn:analytics#1': { selector: '.kpis' },
  'learn:analytics#4': { name: 'Leads 1' },
};
