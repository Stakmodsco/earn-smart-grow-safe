// Payment method catalog grouped by country.
// "International" methods reuse the legacy app_settings.payment_instructions config.
// Country-specific methods define their own form schema, validation and helper text.

export type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "select" | "textarea";
  options?: { value: string; label: string; disabled?: boolean; note?: string }[];
  required?: boolean;
  // Validation
  pattern?: string; // RegExp source
  patternMessage?: string;
  minLength?: number;
  maxLength?: number;
};

export type MethodDef = {
  id: string;
  label: string;
  // Icon name from lucide-react
  icon: "Building2" | "Bitcoin" | "Smartphone" | "Ticket" | "Send" | "Wallet";
  // If true, render legacy instructions block from app_settings (provider, account, etc.)
  useLegacyInstructions?: boolean;
  // Helper text shown above the form
  description?: string;
  // Specific guidance about screenshot requirement (always required, but text varies)
  proofHint?: string;
  // Custom form fields the user must fill (data goes into notes JSON)
  fields?: FieldDef[];
};

export type CountryDef = {
  id: string;
  label: string;
  flag: string;
  methods: MethodDef[];
};

export const COUNTRIES: CountryDef[] = [
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
        proofHint: "Upload a screenshot of the completed bank transfer showing the date, amount and reference.",
      },
      {
        id: "crypto",
        label: "Crypto (USDT)",
        icon: "Bitcoin",
        useLegacyInstructions: true,
        proofHint: "Upload a screenshot of the on-chain transaction (TXID, amount and destination address visible).",
      },
      {
        id: "mobile_money",
        label: "Mobile Money",
        icon: "Smartphone",
        useLegacyInstructions: true,
        proofHint: "Upload the SMS confirmation or app receipt showing the transaction ID and amount.",
      },
    ],
  },
  {
    id: "ZA",
    label: "South Africa",
    flag: "🇿🇦",
    methods: [
      {
        id: "za_voucher",
        label: "Voucher",
        icon: "Ticket",
        description:
          "Buy a voucher at any retailer, then enter the pin below. Funds are credited only once an admin verifies the pin matches the voucher type and amount.",
        proofHint:
          "Upload a clear photo or scan of the voucher slip showing the pin, serial and store stamp. This is required so admins can match it against the pin you submitted.",
        fields: [
          {
            key: "voucher_type",
            label: "Voucher type",
            type: "select",
            required: true,
            options: [
              { value: "OTT", label: "OTT Voucher" },
              { value: "1VOUCHER", label: "1Voucher" },
              { value: "BLU", label: "Blu Voucher" },
              { value: "EASYLOAD", label: "EasyLoad Voucher" },
              { value: "ANYTIME", label: "Anytime Voucher" },
            ],
          },
          {
            key: "pin",
            label: "Voucher PIN",
            placeholder: "12 to 19 digits",
            required: true,
            pattern: "^\\d{12,19}$",
            patternMessage: "Voucher PIN must be 12–19 digits with no spaces.",
            minLength: 12,
            maxLength: 19,
          },
          {
            key: "serial",
            label: "Serial number (optional)",
            placeholder: "If printed on the slip",
            pattern: "^[A-Za-z0-9-]{4,32}$",
            patternMessage: "Serial may only contain letters, numbers and dashes (4–32 chars).",
            maxLength: 32,
          },
        ],
      },
      {
        id: "za_cashsend",
        label: "CashSend",
        icon: "Send",
        description: "Send via your bank's CashSend / Send-iMali / CashPay service, then enter the reference and pin.",
        proofHint:
          "Upload a screenshot of the CashSend confirmation from your banking app showing the reference and amount.",
        fields: [
          {
            key: "bank",
            label: "Sending bank",
            type: "select",
            required: true,
            options: [
              { value: "CAPITEC", label: "Capitec" },
              { value: "NEDBANK", label: "Nedbank" },
              { value: "STANDARD", label: "Standard Bank" },
              { value: "ABSA", label: "Absa Bank" },
            ],
          },
          {
            key: "reference",
            label: "CashSend reference",
            placeholder: "10–14 digit reference",
            required: true,
            pattern: "^\\d{8,16}$",
            patternMessage: "Reference must be 8–16 digits.",
            minLength: 8,
            maxLength: 16,
          },
          {
            key: "pin",
            label: "CashSend PIN",
            placeholder: "4–8 digit withdrawal pin",
            required: true,
            pattern: "^\\d{4,8}$",
            patternMessage: "CashSend PIN must be 4–8 digits.",
            minLength: 4,
            maxLength: 8,
          },
        ],
      },
    ],
  },
  {
    id: "GH",
    label: "Ghana",
    flag: "🇬🇭",
    methods: [
      {
        id: "gh_mobile_wallet",
        label: "Mobile Wallet",
        icon: "Wallet",
        description: "Send from your mobile wallet, then enter the transaction ID exactly as it appears on the SMS.",
        proofHint:
          "Upload a screenshot of the SMS receipt or wallet app showing the transaction ID, amount and recipient.",
        fields: [
          {
            key: "wallet",
            label: "Wallet provider",
            type: "select",
            required: true,
            options: [
              { value: "VODAFONE", label: "Vodafone Cash" },
              { value: "MTN", label: "MTN MoMo — On maintenance", disabled: true, note: "Temporarily unavailable" },
            ],
          },
          {
            key: "sender_number",
            label: "Sender phone number",
            placeholder: "+233XXXXXXXXX",
            required: true,
            pattern: "^\\+?233\\d{9}$",
            patternMessage: "Use a valid Ghana number, e.g. +233241234567.",
            maxLength: 14,
          },
          {
            key: "transaction_id",
            label: "Transaction ID",
            placeholder: "From your SMS receipt",
            required: true,
            pattern: "^[A-Za-z0-9.]{8,32}$",
            patternMessage: "Transaction ID must be 8–32 letters/digits.",
            minLength: 8,
            maxLength: 32,
          },
        ],
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

// All known method IDs — used for server-side allow-list / client guard.
export const ALL_METHOD_IDS: string[] = COUNTRIES.flatMap((c) => c.methods.map((m) => m.id));

// Returns the country a given method belongs to, or null if unknown.
export const countryForMethod = (methodId: string): string | null => {
  for (const c of COUNTRIES) {
    if (c.methods.some((m) => m.id === methodId)) return c.id;
  }
  return null;
};
