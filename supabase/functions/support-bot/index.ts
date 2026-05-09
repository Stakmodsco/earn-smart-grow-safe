// Lightweight FAQ-driven support bot. No external API key required —
// matches keyword patterns and falls back to a "we'll escalate" reply.
// Bold formatting uses **double asterisks** which the client renders as bold.
import { corsHeaders, json } from "../_shared/utils.ts";

type Rule = { match: RegExp; reply: string };

const RULES: Rule[] = [
  {
    match: /\b(withdraw|cashout|payout|withdrawal)\b/i,
    reply:
      "Withdrawals: head to **Withdraw** from the menu. Funds are released **5 days after your most recent approved upgrade or deposit** to protect against fraud. After that, requests are reviewed within 24h and typically reach your wallet within minutes once approved.",
  },
  {
    match: /\b(upgrade|level|silver|gold|platinum|tier)\b/i,
    reply:
      "Upgrades unlock higher daily caps and faster withdrawals. Pay via the **Upgrade** page, then submit your transaction PIN + screenshot. Admins review within minutes during business hours.",
  },
  {
    match: /\b(refer|invite|friend|share|referral)\b/i,
    reply:
      "Earn **10%** from your direct referrals (Level 1) and **3%** from their referrals (Level 2). Open **Referrals** and tap **Copy share link** to grab your invite link.",
  },
  {
    match: /\b(check[\s-]?in|daily reward|streak)\b/i,
    reply:
      "Daily check-in pays a small bonus once every 24h. Click **Daily Check-in** on the Activities page — your balance updates instantly.",
  },
  {
    match: /\b(forgot|reset)\b.*\b(password)\b|\bpassword\b.*\b(forgot|reset)\b/i,
    reply:
      "On the **Sign in** page tap **Forgot your password?** — we'll email you a secure reset link. Open the link and choose a new password.",
  },
  {
    match: /\b(login|sign[\s-]?in|can'?t (log|sign)\s?in|locked out)\b/i,
    reply:
      "If you can't sign in, double-check your email and password. Use **Forgot your password?** on the sign-in page to receive a reset link. If the issue persists, escalate this chat and our team will help.",
  },
  {
    match: /\b(2fa|two[\s-]?factor|authenticator|otp)\b/i,
    reply:
      "Two-factor auth is rolling out. Once enabled, you'll be prompted from your **Profile** page to scan a QR code with Google Authenticator or Authy.",
  },
  {
    match: /\b(unlock|locked|fee|top[\s-]?up)\b/i,
    reply:
      "Locked tiles can be unlocked individually with a small top-up from your main balance, or unlocked for free by upgrading your tier. Gold unlocks everything; Silver unlocks everything except VIP Stream.",
  },
  {
    match: /\b(payment|pay|deposit|method|card|bank|crypto|usdt|trc20|wallet)\b/i,
    reply:
      "We support local payment methods specific to each country plus **USDT (TRC20)** crypto for everyone else. Pick your level on the **Upgrade** page and you'll see the methods available where you are.",
  },
  {
    match: /\b(currency|exchange|fx|local money)\b/i,
    reply:
      "Prices and balances are shown in **your local currency**, detected automatically from your country. You can override this from your Profile if you travel.",
  },
  {
    match: /\b(bonus|signup\s?bonus|welcome)\b/i,
    reply:
      "Every new member gets a **$20 signup bonus** credited to both your main and locked balance. Locked funds become withdrawable once you reach the minimum withdrawal limit.",
  },
  {
    match: /\b(cap|limit|max|maximum|daily cap)\b/i,
    reply:
      "Each level has a **daily earning cap** to keep payouts sustainable. Higher tiers raise the cap. You can see your current cap on the Dashboard.",
  },
  {
    match: /\b(task|earn|earning|watch|spin)\b/i,
    reply:
      "Tasks include daily check-in, Watch & Earn, Spin & Win, and more. Most tiles need at least **Level 1 (Silver)**. Open **Activities** to see what's available to you right now.",
  },
  {
    match: /\b(pending|waiting|approve|approval|review)\b/i,
    reply:
      "Upgrade and withdrawal requests are reviewed by admins, usually within minutes during business hours and within 24h otherwise. You can see status updates in **Requests** or **Receipts**.",
  },
  {
    match: /\b(rejected|denied|declined|not approved)\b/i,
    reply:
      "If a request was rejected, the most common reasons are mismatched payment details, blurry screenshots, or duplicate transactions. Re-submit with a clearer screenshot, or escalate this chat to our team.",
  },
  {
    match: /\b(account|delete|close|remove)\b/i,
    reply:
      "To close or delete your account, escalate this chat to our team and include your registered email — a human agent will handle the request.",
  },
  {
    match: /\b(scam|legit|safe|trust|real)\b/i,
    reply:
      "Cheddar4u uses **server-validated rewards**, hard daily caps, and automated withdrawals — no balance tampering and no infinite-earning loops. Every reward is logged transparently in your Receipts.",
  },
  {
    match: /\b(contact|email|reach|human|agent|support team|live)\b/i,
    reply:
      "You can reach the live support team any time by tapping **Escalate to live support** below this message, or emailing **support@cheddar4u.app**. Tickets are usually answered within 24h.",
  },
  {
    match: /\b(thank|thanks|thx|appreciate)\b/i,
    reply: "You're welcome! 🎉 Anything else I can help with?",
  },
  {
    match: /\b(hi|hello|hey|yo|good\s(morning|afternoon|evening))\b/i,
    reply:
      "Hi 👋 I'm the Cheddar4u Support assistant. Ask me about withdrawals, upgrades, referrals, daily check-in, unlocks, payments, account access — anything platform related.",
  },
];

const FALLBACK =
  "I'm not 100% sure I understood that. Try keywords like *withdraw*, *upgrade*, *referral*, *check-in*, *unlock*, *payment*, *password*, or *bonus*.\n\nIf this didn't help, tap **Escalate to live support** and a human will get back to you.";

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
