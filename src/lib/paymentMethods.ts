// Payment method catalog grouped by country.
// "International" methods reuse the legacy app_settings.payment_instructions config.
// Country-specific methods define their own form schema.

export type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "select" | "textarea";
  options?: { value: string; label: string; disabled?: boolean; note?: string }[];
  required?: boolean;
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
  // Custom form fields the user must fill (data goes into notes JSON)
  fields?: FieldDef[];
  // If true, the proof upload is optional (e.g. voucher pin already serves as proof)
  proofOptional?: boolean;
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
      { id: "bank", label: "Bank Transfer", icon: "Building2", useLegacyInstructions: true },
      { id: "crypto", label: "Crypto (USDT)", icon: "Bitcoin", useLegacyInstructions: true },
      { id: "mobile_money", label: "Mobile Money", icon: "Smartphone", useLegacyInstructions: true },
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
        proofOptional: true,
        description:
          "Buy a voucher at any retailer, then enter the pin below. Funds are credited once an admin verifies the pin.",
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
          { key: "pin", label: "Voucher PIN", placeholder: "16-digit pin", required: true },
          { key: "serial", label: "Serial number (optional)", placeholder: "If printed on slip" },
        ],
      },
      {
        id: "za_cashsend",
        label: "CashSend",
        icon: "Send",
        description: "Send via your bank's CashSend service, then enter the reference and pin.",
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
          { key: "reference", label: "CashSend reference", placeholder: "e.g. 1234567890", required: true },
          { key: "pin", label: "CashSend PIN", placeholder: "Withdrawal pin", required: true },
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
        description: "Send from your mobile wallet, then enter the transaction ID.",
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
          { key: "sender_number", label: "Sender phone number", placeholder: "+233 …", required: true },
          { key: "transaction_id", label: "Transaction ID", placeholder: "From your SMS receipt", required: true },
        ],
      },
    ],
  },
];

export const findMethod = (methodId: string) => {
  for (const c of COUNTRIES) {
    const m = c.methods.find((mm) => mm.id === methodId);
    if (m) return { country: c, method: m };
  }
  return null;
};
