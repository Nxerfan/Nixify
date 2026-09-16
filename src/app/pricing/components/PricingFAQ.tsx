"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTranslations } from "@/i18n";
import type { FAQItem } from "@/lib/pricingData";

/**
 * Pricing FAQ — accordion of questions.
 *
 * The questions themselves come from `FAQS` in src/lib/pricingData.ts (which
 * has been curated to remove Stripe / money-back / NET-30 / one-click
 * cancellation claims). The "Questions?" header is localized.
 */
interface Props {
  faqs: FAQItem[];
}

export function PricingFAQ({ faqs }: Props) {
  const t = useTranslations();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <span className="mb-2 inline-block text-xs font-medium uppercase tracking-wider text-emerald-400/70">
          {t("pricing.faq.eyebrow")}
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-gray-100">
          {t("pricing.faq.title")}
        </h2>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq, i) => (
          <AccordionItem
            key={i}
            value={`item-${i}`}
            className="overflow-hidden rounded-xl border border-gray-800/40 bg-gray-950/30 backdrop-blur-xl px-5"
          >
            <AccordionTrigger className="text-sm font-medium text-gray-200 hover:no-underline py-4">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-gray-500 pb-4">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
