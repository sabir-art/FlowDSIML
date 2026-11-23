import type { TFunction } from 'i18next';

/**
 * Mot de passe refusé par Supabase Auth : le serveur ne cite que les règles qui ont échoué (longueur,
 * caractères exigés, mot de passe connu dans des fuites). Le message reprend ces règles, sans supposer
 * la politique en vigueur.
 */
export function weakPasswordMessage(t: TFunction, msg: string, locale = 'fr'): string {
  const parts: string[] = [];
  const len = /at least (\d+) characters/i.exec(msg);
  if (len) parts.push(t('errors.pwLength', { min: Number(len[1]) }));
  const sets = /at least one character of each:\s*(.+)$/i.exec(msg)?.[1] ?? '';
  if (sets) {
    const kinds: string[] = [];
    const lower = sets.includes('abcdefghijklmnopqrstuvwxyz');
    const upper = sets.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    // « Lettres et chiffres » : minuscules et majuscules forment un seul jeu
    if (sets.includes('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'))
      kinds.push(t('errors.pwLetter'));
    else {
      if (lower) kinds.push(t('errors.pwLower'));
      if (upper) kinds.push(t('errors.pwUpper'));
    }
    if (sets.includes('0123456789')) kinds.push(t('errors.pwDigit'));
    if (/[!@#$%^&*]/.test(sets)) kinds.push(t('errors.pwSymbol'));
    if (kinds.length)
      parts.push(
        t('errors.pwChars', { list: new Intl.ListFormat(locale, { type: 'conjunction' }).format(kinds) }),
      );
  }
  if (/known to be weak|easy to guess|pwned/i.test(msg)) parts.push(t('errors.pwPwned'));
  return parts.length ? parts.join(' ') : t('errors.weakPassword');
}

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
    // L49 : réglage « Captures HTML »
    [/HTML_CAPTURE_DOMAIN_INVALID/, 'htmlCapture.domainInvalid'],
    [/HTML_CAPTURE_DOMAIN_MAX/, 'htmlCapture.domainMax'],
    [/HTML_CAPTURE_DOMAIN_REQUIRED/, 'htmlCapture.domainRequired'],
    [/HTML_CAPTURE_DISABLED/, 'htmlCapture.blockedByAdmin'],
    [/HTML_CAPTURE_DOMAIN\b/, 'htmlCapture.blockedDomain'],
    // L27 : règles de partage de l'espace
    [/RULE_MODE\b/, 'rules.errMode'],
    [/RULE_PUBLISH/, 'rules.errPublish'],
    [/RULE_EXPORTS/, 'rules.errExports'],
    [/RULE_MODES_EMPTY/, 'rules.modesEmpty'],
    [/GDPR_ACK_REQUIRED/, 'errors.gdprAck'],
    [/CONFIRMATION_MISMATCH/, 'errors.confirmMismatch'],
    [/DEMO_NOT_FOUND/, 'errors.demoNotFound'],
    [/Invalid login credentials/i, 'errors.badCredentials'],
    [/Email not confirmed/i, 'errors.emailNotConfirmed'],
    [/User already registered/i, 'errors.alreadyRegistered'],
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
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code === 'weak_password' || /Password should|known to be weak/i.test(msg))
    return weakPasswordMessage(t, msg, t('errors.listLocale'));
  for (const [re, key] of known) if (re.test(msg)) return t(key);
  return t('errors.generic', { message: msg });
}
