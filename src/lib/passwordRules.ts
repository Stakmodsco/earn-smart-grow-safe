// Centralised signup password & email rules so they stay consistent between
// validation and the help text shown to users.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "yopmail.com", "trashmail.com", "throwawaymail.com", "fakeinbox.com",
]);

export type EmailIssue = "format" | "disposable" | "long";

export function validateEmail(raw: string): EmailIssue | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return "long";
  if (!EMAIL_RE.test(email)) return "format";
  const domain = email.split("@")[1] ?? "";
  if (DISPOSABLE_DOMAINS.has(domain)) return "disposable";
  return null;
}

export const EMAIL_HINT =
  "Use a real email — confirmation links, withdrawal alerts and 2FA codes go here.";

// ─── Password ────────────────────────────────────────────────────────────────

export type PasswordCheck = {
  id: string;
  label: string;
  ok: boolean;
};

export function checkPassword(pw: string): PasswordCheck[] {
  return [
    { id: "len", label: "At least 8 characters", ok: pw.length >= 8 },
    { id: "upper", label: "One uppercase letter (A–Z)", ok: /[A-Z]/.test(pw) },
    { id: "lower", label: "One lowercase letter (a–z)", ok: /[a-z]/.test(pw) },
    { id: "digit", label: "One number (0–9)", ok: /\d/.test(pw) },
    { id: "symbol", label: "One symbol (!@#$…)", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export function passwordIsStrong(pw: string): boolean {
  return checkPassword(pw).every((c) => c.ok);
}

export function passwordError(pw: string): string | null {
  if (!passwordIsStrong(pw)) {
    const failing = checkPassword(pw).filter((c) => !c.ok).map((c) => c.label.toLowerCase());
    return `Password needs: ${failing.join(", ")}.`;
  }
  if (pw.length > 72) return "Password must be 72 characters or fewer.";
  return null;
}

export function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = `${upper}${lower}${digits}${symbols}`;
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 16) chars.push(pick(all));
  return chars.sort(() => Math.random() - 0.5).join("");
}
