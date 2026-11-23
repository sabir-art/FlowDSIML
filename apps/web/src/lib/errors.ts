import type { TFunction } from 'i18next';
import { PASSWORD_POLICY, passwordRules } from './passwordPolicy';

/** Catégories de caractères qu'une politique Supabase Auth peut exiger. */
type CharKind = 'letter' | 'lower' | 'upper' | 'digit' | 'symbol';
const HAS: Record<CharKind, RegExp> = {
  letter: /\p{L}/u,
  lower: /\p{Ll}/u,
  upper: /\p{Lu}/u,
  digit: /\d/,
  symbol: /[^\p{L}\d\s]/u,
};

/**
 * Mot de passe refusé par Supabase Auth. Le serveur donne un code (« same_password », « weak_password »
 * avec ses raisons : length, characters, pwned) et un texte qui ne cite que les règles en échec. Le code
 * prime, le texte sert de secours ; quand le serveur ne précise pas une valeur, la politique de l'app
 * (lib/passwordPolicy.ts) la donne. Si le mot de passe saisi est connu, seules les catégories qui lui
 * manquent sont citées. Renvoie null si l'erreur ne concerne pas le mot de passe.
 */
export function passwordErrorMessage(t: TFunction, err: unknown, password?: string): string | null {
  const o = (typeof err === 'object' && err ? err : {}) as Record<string, unknown>;
  const msg = 'message' in o ? String(o.message) : String(err);
  const code = typeof o.code === 'string' ? o.code : '';
  if (code === 'same_password' || /different from the old password/i.test(msg)) return t('errors.pwSame');
  const weak = (o.weak_password as { reasons?: unknown } | undefined)?.reasons ?? o.reasons;
  const reasons = Array.isArray(weak) ? weak.map(String) : [];
  const textual = /Password should (be at least|contain)|known to be weak|easy to guess/i.test(msg);
  if (code !== 'weak_password' && !reasons.length && !textual) return null;

  const parts: string[] = [];
  const len = /at least (\d+) characters/i.exec(msg);
  if (len || reasons.includes('length'))
    parts.push(t('errors.pwLength', { min: len ? Number(len[1]) : PASSWORD_POLICY.minLength }));

  const sets = /at least one character of each:\s*(.+)$/i.exec(msg)?.[1] ?? '';
  let kinds: CharKind[] = [];
  if (sets) {
    // « Lettres et chiffres » : minuscules et majuscules forment un seul jeu
    if (sets.includes('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')) kinds.push('letter');
    else {
      if (sets.includes('abcdefghijklmnopqrstuvwxyz')) kinds.push('lower');
      if (sets.includes('ABCDEFGHIJKLMNOPQRSTUVWXYZ')) kinds.push('upper');
    }
    if (sets.includes('0123456789')) kinds.push('digit');
    if (/[!@#$%^&*]/.test(sets)) kinds.push('symbol');
  } else if (reasons.includes('characters')) {
    if (PASSWORD_POLICY.letter) kinds.push('letter');
    if (PASSWORD_POLICY.digit) kinds.push('digit');
  }
  if (password !== undefined) {
    const missing = kinds.filter((k) => !HAS[k].test(password));
    // Le serveur a refusé : si rien ne semble manquer, toutes les catégories exigées sont rappelées
    if (missing.length) kinds = missing;
  }
  if (kinds.length)
    parts.push(
      t('errors.pwChars', {
        list: new Intl.ListFormat(t('errors.listLocale'), { type: 'conjunction' }).format(
          kinds.map((k) => t(`errors.pwKind.${k}`)),
        ),
      }),
    );
  if (reasons.includes('pwned') || /known to be weak|easy to guess/i.test(msg))
    parts.push(t('errors.pwPwned'));
  return parts.length ? parts.join(' ') : t('errors.weakPassword');
}

/** Traduit une erreur Supabase / RPC en message utilisateur. */
/**
 * Avant l'envoi : ce qui manque au mot de passe selon la politique de l'app, dans les mêmes phrases que
 * les refus du serveur. Renvoie null si toutes les règles sont respectées.
 */
export function localPasswordError(t: TFunction, password: string): string | null {
  const missing = passwordRules(password)
    .filter((r) => !r.ok)
    .map((r) => r.rule);
  if (!missing.length) return null;
  const parts: string[] = [];
  if (missing.includes('length')) parts.push(t('errors.pwLength', { min: PASSWORD_POLICY.minLength }));
  const kinds = missing.filter((r) => r !== 'length');
  if (kinds.length)
    parts.push(
      t('errors.pwChars', {
        list: new Intl.ListFormat(t('errors.listLocale'), { type: 'conjunction' }).format(
          kinds.map((k) => t(`errors.pwKind.${k}`)),
        ),
      }),
    );
  return parts.join(' ');
}

/**
 * @param opts.password mot de passe saisi (jamais gardé ni journalisé) : précise les catégories manquantes
 */
export function errorMessage(t: TFunction, err: unknown, opts?: { password?: string }): string {
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
  const pw = passwordErrorMessage(t, err, opts?.password);
  if (pw) return pw;
  for (const [re, key] of known) if (re.test(msg)) return t(key);
  return t('errors.generic', { message: msg });
}
