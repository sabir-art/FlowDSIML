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
  for (const [re, key] of known) if (re.test(msg)) return t(key);
  return t('errors.generic', { message: msg });
}
