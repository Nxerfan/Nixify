export interface PricingTier {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  isPopular: boolean;
  ctaText: string;
  features: string[];
}

export interface ComparisonRow {
  feature: string;
  tooltip: string;
  free: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

export interface FAQItem {
  q: string;
  a: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    description: "For side projects and testing.",
    isPopular: false,
    ctaText: "Start free",
    features: [
      "1 email template",
      "100 OTP emails / month",
      "Sandbox mode",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 20,
    priceYearly: 16,
    description: "For growing apps that need real verification.",
    isPopular: true,
    ctaText: "Get Started",
    features: [
      "20 email templates",
      "10,000 OTP emails / month",
      "Full branding + Brand Kit",
      "Theme builder",
      "Webhooks + API keys",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 100,
    priceYearly: 80,
    description: "For high-volume platforms with custom needs.",
    isPopular: false,
    ctaText: "Get started",
    features: [
      "Unlimited templates",
      "1,000,000 OTP emails / month",
      "Dedicated IP + SMTP relay",
      "Custom DKIM/SPF/DMARC",
      "SLA 99.99% uptime",
      "Dedicated support engineer",
    ],
  },
];

export const COMPARISON_DATA: ComparisonRow[] = [
  {
    feature: "Email templates",
    tooltip: "More templates = less time on email design.",
    free: "1",
    pro: "20",
    enterprise: "Unlimited",
  },
  {
    feature: "OTP emails / month",
    tooltip: "Each verification email counts as one OTP.",
    free: "100",
    pro: "10,000",
    enterprise: "1,000,000",
  },
  {
    feature: "Brand Kit",
    tooltip: "Save your brand assets once and reuse across templates.",
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: "Theme builder",
    tooltip: "Drag-and-drop components to build email structure.",
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: "Multi-language",
    tooltip: "One template, 5 languages. Auto-detects recipient language.",
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: "Webhooks",
    tooltip: "Receive HTTP callbacks when OTPs are sent or verified.",
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: "API keys",
    tooltip: "Generate dev/prod keys with fine-grained scopes.",
    free: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: "Dedicated IP",
    tooltip: "Your own sending IP — reputation isn't shared.",
    free: false,
    pro: false,
    enterprise: true,
  },
  {
    feature: "SLA 99.99%",
    tooltip: "Legally binding uptime guarantee with financial credits.",
    free: false,
    pro: false,
    enterprise: true,
  },
  {
    feature: "Support",
    tooltip: "Pro gets priority (<24h). Enterprise gets a dedicated engineer.",
    free: "Community",
    pro: "Priority (<24h)",
    enterprise: "Dedicated engineer",
  },
];

export const FAQS: FAQItem[] = [
  {
    q: "Can I switch plans?",
    a: "Absolutely. Upgrade or downgrade anytime — changes take effect immediately and we prorate the difference. No lock-in, no penalties.",
  },
  {
    q: "What payment methods?",
    a: "All major credit cards (Visa, Mastercard, Amex) via Stripe. Enterprise customers can pay by invoice with NET-30 terms.",
  },
  {
    q: "Is there a free trial?",
    a: "The Free plan is free forever with 100 OTPs/month. Paid plans include a 30-day money-back guarantee, so you can try Pro risk-free.",
  },
  {
    q: "How does billing work?",
    a: "Billing is monthly or yearly (your choice). Yearly saves 20%. You're charged on the same date each cycle. Cancel anytime — no hidden fees.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel with one click from your dashboard. You keep access until the end of your billing period, then your account reverts to the Free plan.",
  },
];

// ─── ROI Calculator constants ────────────────────────────────────────────────
// Used by src/app/pricing/components/ROIWidget.tsx. Numbers are illustrative
// averages — actual costs vary by team. The widget's job is to show order-of-
// magnitude savings, not precise quotes.
export const ROI_CONSTANTS = {
  // Fully-loaded cost of an in-house OTP system (engineer time + SMTP + infra).
  inHouseCostPerOtp: 0.02, // $0.02 / OTP when accounting for engineer time
  // Nixify Pro pricing used in the comparison.
  proMonthlyBase: 20, // $20/mo base
  proCostPerOtp: 0.002, // ~$0.002 / OTP (well below in-house cost)
} as const;

// ─── Testimonials ────────────────────────────────────────────────────────────
// Used by src/app/pricing/components/Testimonials.tsx.
export interface Testimonial {
  name: string;
  role: string;
  company: string;
  quote: string;
  initials: string;
  accent: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sara Chen",
    role: "CTO",
    company: "Stripeflow",
    quote:
      "Nixify replaced our in-house OTP system in an afternoon. Deliverability went from 78% to 99.2% — worth every penny.",
    initials: "SC",
    accent: "#34d399",
  },
  {
    name: "Marco Rossi",
    role: "Lead Engineer",
    company: "Vercel-Tools",
    quote:
      "The webhooks + API keys design is exactly what I'd build if I had a week. Saved my team a sprint.",
    initials: "MR",
    accent: "#2dd4bf",
  },
  {
    name: "Priya Patel",
    role: "Founder",
    company: "Authless",
    quote:
      "We started on Free, upgraded to Pro at 1k users, MAX at 50k. The pricing scales with us, never against us.",
    initials: "PP",
    accent: "#6ee7b7",
  },
];
