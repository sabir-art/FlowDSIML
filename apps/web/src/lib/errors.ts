import type { TFunction } from 'i18next';

/** Traduit une erreur Supabase / RPC en message utilisateur. */
export function errorMessage(t: TFunction, err: unknown): string {
  const msg =
    typeof err === 'object' && err && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  const known: Array<[RegExp, string]> = [
    [/PLAN_LIMIT:published_demos/, 'errors.planPublished'],
    [/PLAN_LIMIT:members/, 'errors.planMembers'],
    [/PLAN_LIMIT:steps_per_demo/, 'errors.planSteps'],
    [/PLAN_LIMIT:lead_forms/, 'errors.planLeadForms'],
    [/INVITATION_EMAIL_MISMATCH/, 'errors.inviteEmail'],
    [/INVITATION_EXPIRED/, 'errors.inviteExpired'],
    [/INVITATION_ALREADY_USED/, 'errors.inviteUsed'],
    [/INVITATION_NOT_FOUND/, 'errors.inviteNotFound'],
    [/DEMO_EMPTY/, 'errors.demoEmpty'],
    [/BEFORE_AFTER_INCOMPLETE/, 'errors.beforeAfterIncomplete'],
    [/VIDEO_MISSING/, 'errors.videoMissingAny'],
    [/VIDEO_OBJECT_MISSING|VIDEO_PATH/, 'errors.videoMissingAny'],
    [/HTML_MISSING|HTML_OBJECT_MISSING|HTML_PATH/, 'errors.htmlMissingAny'],
    [/NO_VISIBLE_DEMO/, 'errors.noVisibleDemo'],
    [/PUBLIC_DISABLED/, 'errors.publicDisabled'],
    // L28-08 : suppression du compte
    [/REAUTH_REQUIRED/, 'myData.errReauth'],
    [/EMAIL_MISMATCH/, 'myData.errEmail'],
    [/PASSWORD_MISMATCH/, 'myData.errPassword'],
    [/ACCOUNT_SOLE_OWNER/, 'myData.blockedBody'],
    // L28 035 : voix off
    [/VOICE_TRANSCRIPT/, 'editor.voice.publishMissingAny'],
    [/VOICE_OBJECT_MISSING|VOICE_PATH/, 'editor.voice.uploadError'],
    // L28 082 : adresse personnalisée
    [/ADDRESS_FORMAT/, 'share.address.invalid'],
    [/ADDRESS_RESERVED/, 'share.address.reserved'],
    [/ADDRESS_RETRY/, 'share.address.retry'],
    // L27 : règles de partage de l'espace
    [/RULE_MODE\b/, 'rules.errMode'],
    [/RULE_PUBLISH/, 'rules.errPublish'],
    [/RULE_EXPORTS/, 'rules.errExports'],
    [/RULE_MODES_EMPTY/, 'rules.modesEmpty'],
    [/PLAN_REQUIRED:share_rules/, 'rules.errPlan'],
    [/GDPR_ACK_REQUIRED/, 'errors.gdprAck'],
    [/CONFIRMATION_MISMATCH/, 'errors.confirmMismatch'],
    [/DEMO_NOT_FOUND/, 'errors.demoNotFound'],
    [/Invalid login credentials/i, 'errors.badCredentials'],
    [/Email not confirmed/i, 'errors.emailNotConfirmed'],
    [/User already registered/i, 'errors.alreadyRegistered'],
    [/Password should be/i, 'errors.weakPassword'],
    [/rate limit|too many/i, 'errors.rateLimited'],
    [/owner/i, 'errors.ownerRule'],
    [/permission denied|Accès refusé|42501|row-level security/i, 'errors.forbidden'],
    [/Failed to fetch|NetworkError/i, 'errors.network'],
  ];
  const quiz = /QUIZ_INVALID:(\d+)/.exec(msg);
  if (quiz) return t('errors.quizInvalid', { n: quiz[1] });
  // L26-04 : étapes « À capturer » restantes
  const cap = /TO_CAPTURE:(\d+)/.exec(msg);
  if (cap) return t('templates.toCaptureLeft', { count: Number(cap[1]) });
  if (/TEMPLATE_NOT_FOUND/.test(msg)) return t('templates.notFound');
  const exp = /RULE_EXPIRY:(\d+)/.exec(msg);
  if (exp) return t('rules.errExpiry', { n: Number(exp[1]) });
  for (const [re, key] of known) if (re.test(msg)) return t(key);
  return t('errors.generic', { message: msg });
}
