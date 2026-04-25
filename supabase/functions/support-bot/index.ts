// Lightweight FAQ-driven support bot. No external API key required —
// matches keyword patterns and falls back to a "we'll get back to you" reply.
import { corsHeaders, json } from "../_shared/utils.ts";

type Rule = { match: RegExp; reply: string };

const RULES: Rule[] = [
  {
    match: /\b(withdraw|cashout|payout)\b/i,
    reply:
      "Withdrawals: head to **Withdraw** from the menu. Note that funds are " +
      "released **5 days after your most recent approved upgrade or deposit** " +
      "to protect against fraud. After that, requests are reviewed within 24h.",
  },
  {
    match: /\b(upgrade|level|silver|gold|platinum|tier)\b/i,
    reply:
      "Upgrades unlock higher daily caps and faster withdrawals. Pay via the " +
      "**Upgrade** page, then submit your transaction PIN + screenshot. Admins " +
      "review within minutes during business hours.",
  },
  {
    match: /\b(refer|invite|friend|share)\b/i,
    reply:
      "Earn 10% from your direct referrals (Level 1) and 3% from their referrals " +
      "(Level 2). Open **Referrals** and tap **Copy share link** to grab your invite link.",
  },
  {
    match: /\b(check[\s-]?in|daily reward|streak)\b/i,
    reply:
      "Daily check-in pays a small bonus once every 24h. Click **Daily Check-in** on the " +
      "Activities page — your balance updates instantly and you'll be redirected to the dashboard.",
  },
  {
    match: /\b(password|forgot|reset|login|sign[\s-]?in)\b/i,
    reply:
      "Use the **Sign in** page; if you forgot your password, contact support at " +
      "support@monetra.app and we'll send you a reset link.",
  },
  {
    match: /\b(2fa|two[\s-]?factor|authenticator|otp)\b/i,
    reply:
      "Two-factor auth is rolling out. Once enabled, you'll be prompted from your " +
      "**Profile** page to scan a QR code with Google Authenticator or Authy.",
  },
  {
    match: /\b(unlock|locked|fee|top[\s-]?up)\b/i,
    reply:
      "Locked tiles can be unlocked individually with a small top-up from your main " +
      "balance, or unlocked for free by upgrading your tier. Gold unlocks everything; " +
      "Silver unlocks everything except VIP Stream.",
  },
  {
    match: /\b(captcha|robot)\b/i,
    reply:
      "Captcha is currently disabled while we test the experience. " +
      "Bot protection will return shortly.",
  },
  {
    match: /\b(hi|hello|hey|yo|good\s(morning|afternoon|evening))\b/i,
    reply:
      "Hi 👋 I'm Monetra's support bot. Ask me about withdrawals, upgrades, " +
      "referrals, daily check-in or unlocks.",
  },
];

const FALLBACK =
  "I couldn't match that to a known topic. Try keywords like *withdraw*, " +
  "*upgrade*, *referral*, *check-in* or *unlock*. For complex issues email " +
  "support@monetra.app and a human will reply within 24h.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").slice(0, 1000);
    if (!message.trim()) return json({ reply: "Please type a question." });

    const hit = RULES.find((r) => r.match.test(message));
    return json({ reply: hit?.reply ?? FALLBACK });
  } catch (e) {
    return json({ reply: "Sorry, something went wrong. Try again.", error: String(e) }, 200);
  }
});
