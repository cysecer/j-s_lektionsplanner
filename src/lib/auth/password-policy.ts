/**
 * Password rules following NIST SP 800-63B (rev. 4) for single-factor
 * passwords: length is what counts. No composition rules, no forced
 * rotation, any Unicode allowed, but known/guessable passwords are rejected.
 */

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordProblem =
  "tooShort" | "tooLong" | "common" | "repetitive" | "sequential" | "contextual";

/** Length in Unicode code points after NFKC normalisation (as NIST requires). */
export function passwordLength(password: string): number {
  return [...password.normalize("NFKC")].length;
}

function isRepetitive(p: string): boolean {
  // Whole password made of one short unit repeated, e.g. "aaaa…" or "abcabcabc…".
  for (let unit = 1; unit <= 4; unit++) {
    const chunk = p.slice(0, unit);
    if (chunk.repeat(Math.ceil(p.length / unit)).slice(0, p.length) === p) return true;
  }
  return false;
}

function isSequential(p: string): boolean {
  const codes = [...p].map((c) => c.codePointAt(0)!);
  const ascending = codes.every((c, i) => i === 0 || c - codes[i - 1]! === 1);
  const descending = codes.every((c, i) => i === 0 || codes[i - 1]! - c === 1);
  return ascending || descending;
}

/**
 * Checks a new password. `blocklist` holds lower-cased known passwords;
 * `context` holds words specific to this user/service (email, name, club).
 */
export function checkPassword(
  password: string,
  options: { blocklist: ReadonlySet<string>; context: string[] },
): PasswordProblem | null {
  const length = passwordLength(password);
  if (length < PASSWORD_MIN_LENGTH) return "tooShort";
  if (length > PASSWORD_MAX_LENGTH) return "tooLong";

  const normalized = password.normalize("NFKC").toLowerCase();
  const compact = normalized.replace(/\s+/g, "");
  if (isRepetitive(compact)) return "repetitive";
  if (isSequential(compact)) return "sequential";
  if (options.blocklist.has(normalized) || options.blocklist.has(compact)) return "common";

  // Reject passwords made mostly of context words, e.g. "lektionsplaner2024!"
  // or "nina test lektionsplaner": strip all of them and judge what is left.
  const words = options.context
    .map((w) => w.normalize("NFKC").toLowerCase().replace(/\s+/g, ""))
    .filter((w) => w.length >= 4)
    .sort((a, b) => b.length - a.length);
  let rest = compact;
  for (const word of words) rest = rest.replaceAll(word, "");
  if (rest !== compact && [...rest].length < 8) return "contextual";
  return null;
}

/** Context words for a user: email local part and domain, name parts, app and club. */
export function passwordContext(input: {
  email: string;
  name?: string | null;
  clubName?: string | null;
}) {
  const email = input.email.toLowerCase();
  const [local = "", domain = ""] = email.split("@");
  const parts = (value: string | null | undefined) => (value ?? "").split(/[^\p{L}\p{N}]+/u);
  return [
    "lektionsplaner",
    "lektionsvorbereitung",
    "jugendundsport",
    email,
    local,
    ...parts(local),
    ...parts(domain.split(".")[0]),
    input.name ?? "",
    ...parts(input.name),
    input.clubName ?? "",
    ...parts(input.clubName),
  ].filter((w) => w.length >= 4);
}
