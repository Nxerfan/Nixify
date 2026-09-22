"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTranslations } from "@/i18n";
import type { FAQItem } from "@/lib/pricingData";

/**
 * Pricing FAQ — accordion of questions.
 *
 * The FAQ items themselves are stored as translation-key prefixes in
 * `FAQS` (src/lib/pricingData.ts). Each FAQItem has `{ key }` where `key`
 * points into the i18n dictionaries (`pricing.faq.items.N`). The
 * component resolves `<key>.q` and `<key>.a` via `useTranslations()` so the
 * rendered FAQ copy is localized per locale — Persian under `fa`, English
 * under `en`. The "Questions?" header is also localized.
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
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("pricing.faq.title")}
        </h2>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq, i) => (
          <AccordionItem
            key={i}
            value={`item-${i}`}
            className="overflow-hidden rounded-xl border border-border/60 bg-card/30 backdrop-blur-xl px-5"
          >
            <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-4">
              {t(`${faq.key}.q`)}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground/70 pb-4">
              {t(`${faq.key}.a`)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
