// Payment method catalog grouped by country.
// Each country lists explicit transfer instructions (provider, account, etc.)
// so the user can pay manually and submit proof.
//
// Countries WITHOUT a specific entry will see the synthetic "COMING_SOON"
// country (resolved by `scopeForCountry`).

export type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "select" | "textarea";
  options?: { value: string; label: string; disabled?: boolean; note?: string }[];
  required?: boolean;
  pattern?: string;
  patternMessage?: string;
  minLength?: number;
  maxLength?: number;
};

export type MethodDef = {
  id: string;
  label: string;
  icon: "Building2" | "Bitcoin" | "Smartphone" | "Ticket" | "Send" | "Wallet";
  useLegacyInstructions?: boolean;
  description?: string;
  proofHint?: string;
  fields?: FieldDef[];
  // Inline structured instructions rendered as labelled rows (with copy buttons)
  instructions?: {
    provider?: string;
    account_name?: string;
    account_number?: string;
    network?: string;
    address?: string;
    notes?: string;
    steps?: string[];
  };
};

export type CountryDef = {
  id: string;
  label: string;
  flag: string;
  comingSoon?: boolean;
  methods: MethodDef[];
};

const COMMON_PROOF = "Upload a clear screenshot of your payment receipt showing the date, amount and reference.";

export const COUNTRIES: CountryDef[] = [
  // ─── International / fallback (uses settings.payment_instructions) ────────
  {
    id: "INT",
    label: "International",
    flag: "🌍",
    methods: [
      {
        id: "bank",
        label: "Bank Transfer",
        icon: "Building2",
        useLegacyInstructions: true,
        proofHint: "Upload a screenshot of the completed bank transfer.",
      },
      {
        id: "crypto",
        label: "Crypto (USDT TRC20)",
        icon: "Bitcoin",
        useLegacyInstructions: true,
        proofHint: "Upload a screenshot of the on-chain transaction (TXID and amount visible).",
      },
    ],
  },

  // ─── South Africa (vouchers + cash send) ──────────────────────────────────
  {
    id: "ZA",
    label: "South Africa",
    flag: "🇿🇦",
    methods: [
      {
        id: "za_voucher", label: "Voucher (OTT/1Voucher/Blu)", icon: "Ticket",
        description: "Buy a voucher at any retailer, then enter the pin below. Funds are credited only after admin verifies the pin.",
        proofHint: "Upload a clear photo of the voucher slip showing the pin and store stamp.",
        fields: [
          { key: "voucher_type", label: "Voucher type", type: "select", required: true,
            options: [
              { value: "OTT", label: "OTT Voucher" },
              { value: "1VOUCHER", label: "1Voucher" },
              { value: "BLU", label: "Blu Voucher" },
            ] },
          { key: "pin", label: "Voucher PIN", required: true, pattern: "^\\d{12,19}$", patternMessage: "12–19 digits, no spaces.", minLength: 12, maxLength: 19 },
        ],
      },
    ],
  },

  // ─── Ghana (Vodafone Cash via MTN-to-Vodafone *170#) ──────────────────────
  {
    id: "GH",
    label: "Ghana",
    flag: "🇬🇭",
    methods: [
      {
        id: "gh_vodafone_cash", label: "Vodafone Cash (via MTN *170#)", icon: "Smartphone",
        description: "Send from MTN to Vodafone using *170# → Option 1 (Transfer Money) → Option 5 (Other Network) → Option 2 (Vodafone).",
        proofHint: "Upload the SMS confirmation showing the transaction ID and amount.",
        instructions: {
          provider: "Vodafone Cash",
          account_name: "Mohammed Sadiq Hamis",
          account_number: "0505706531",
          steps: [
            "Dial *170# on MTN",
            "Choose Option 1 — Transfer Money",
            "Choose Option 5 — Other Network",
            "Choose Option 2 — Vodafone",
            "Enter recipient: 0505706531",
            "Enter amount and confirm",
          ],
          notes: "Then submit the screenshot below.",
        },
        fields: [
          { key: "transaction_id", label: "Transaction ID", placeholder: "From your SMS receipt", required: true,
            pattern: "^[A-Za-z0-9.]{6,32}$", patternMessage: "6–32 letters/digits.", minLength: 6, maxLength: 32 },
          { key: "sender_number", label: "Your MTN number", placeholder: "+233XXXXXXXXX", required: true,
            pattern: "^\\+?233\\d{9}$", patternMessage: "Use a valid Ghana number, e.g. +233241234567.", maxLength: 14 },
        ],
      },
    ],
  },

  // ─── Uganda (Airtel Money / International Money Transfer) ─────────────────
  {
    id: "UG",
    label: "Uganda",
    flag: "🇺🇬",
    methods: [
      {
        id: "ug_airtel_money", label: "Orange Money / Airtel Money (*145#)", icon: "Smartphone",
        description: "Use *145# → Option 4 (International Money Transfer) → choose UGANDA AIRTEL.",
        proofHint: "Upload the SMS or app confirmation with transaction ID.",
        instructions: {
          provider: "UGANDA AIRTEL",
          account_name: "FLORENCE NYABURU",
          account_number: "+256759225960",
          steps: [
            "Dial *145#",
            "Enter your secret code",
            "Choose Option 4 — International Money Transfer",
            "Choose country: UGANDA AIRTEL",
            "Recipient number: +256759225960",
            "Enter the amount shown above",
          ],
        },
        fields: [
          { key: "transaction_id", label: "Transaction ID", placeholder: "From SMS receipt", required: true,
            pattern: "^[A-Za-z0-9.]{6,32}$", patternMessage: "6–32 letters/digits.", minLength: 6, maxLength: 32 },
        ],
      },
    ],
  },

  // ─── Botswana (Jazz Cash bank transfer) ───────────────────────────────────
  {
    id: "BW",
    label: "Botswana",
    flag: "🇧🇼",
    methods: [
      {
        id: "bw_jazz_cash", label: "Jazz Cash Bank Transfer", icon: "Building2",
        description: "Send via Jazz Cash to the account below.",
        proofHint: COMMON_PROOF,
        instructions: {
          provider: "Jazz Cash",
          account_name: "Anas Javed",
          account_number: "03706886185",
        },
        fields: [
          { key: "transaction_id", label: "Transaction ID / reference", required: true,
            pattern: "^[A-Za-z0-9.\\-]{6,40}$", patternMessage: "6–40 letters/digits.", minLength: 6, maxLength: 40 },
        ],
      },
    ],
  },

  // ─── Pakistan (Jazz Cash) ─────────────────────────────────────────────────
  {
    id: "PK",
    label: "Pakistan",
    flag: "🇵🇰",
    methods: [
      {
        id: "pk_jazz_cash", label: "Jazz Cash", icon: "Wallet",
        description: "Send via Jazz Cash to the wallet below.",
        proofHint: COMMON_PROOF,
        instructions: {
          provider: "Jazz Cash",
          account_name: "Anas Javed",
          account_number: "03706886185",
        },
        fields: [
          { key: "transaction_id", label: "Transaction ID", required: true,
            pattern: "^[A-Za-z0-9.\\-]{6,40}$", patternMessage: "6–40 letters/digits.", minLength: 6, maxLength: 40 },
        ],
      },
    ],
  },

  // ─── Bangladesh (bKash, Send Money only) ──────────────────────────────────
  {
    id: "BD",
    label: "Bangladesh",
    flag: "🇧🇩",
    methods: [
      {
        id: "bd_bkash", label: "bKash (Send Money)", icon: "Smartphone",
        description: "Send via bKash — SEND MONEY ONLY (do not use Payment). Minimum 1000 Taka.",
        proofHint: "Upload the bKash app screenshot showing the Trx ID.",
        instructions: {
          provider: "bKash",
          account_number: "01768508100",
          notes: "1000 Taka and above. SEND MONEY ONLY.",
        },
        fields: [
          { key: "transaction_id", label: "bKash Trx ID", placeholder: "e.g. 9A1B2C3D4E", required: true,
            pattern: "^[A-Z0-9]{8,12}$", patternMessage: "Trx ID is 8–12 uppercase letters/digits.", minLength: 8, maxLength: 12 },
          { key: "sender_number", label: "Your bKash number", placeholder: "01XXXXXXXXX", required: true,
            pattern: "^01\\d{9}$", patternMessage: "Must be 11 digits starting with 01.", minLength: 11, maxLength: 11 },
        ],
      },
    ],
  },

  // ─── Coming-soon fallback for every other country ─────────────────────────
  {
    id: "COMING_SOON",
    label: "Coming soon",
    flag: "🚧",
    comingSoon: true,
    methods: [
      {
        id: "coming_soon",
        label: "Local payments coming soon",
        icon: "Building2",
        description:
          "We don't have a local payment partner in your country yet. Please choose International (Crypto) above, or contact support to be notified when local methods launch in your region.",
      },
    ],
  },
];

export const findCountry = (countryId: string) =>
  COUNTRIES.find((c) => c.id === countryId) ?? null;

export const findMethod = (methodId: string) => {
  for (const c of COUNTRIES) {
    const m = c.methods.find((mm) => mm.id === methodId);
    if (m) return { country: c, method: m };
  }
  return null;
};

export const ALL_METHOD_IDS: string[] = COUNTRIES.flatMap((c) => c.methods.map((m) => m.id));

export const countryForMethod = (methodId: string): string | null => {
  for (const c of COUNTRIES) {
    if (c.methods.some((m) => m.id === methodId)) return c.id;
  }
  return null;
};
