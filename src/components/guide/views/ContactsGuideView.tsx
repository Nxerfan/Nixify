"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { GuideContent } from "@/lib/guide/content/types";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import { ContactsStage } from "@/components/guide/scenes/ContactsStage";
import { ContactJourney } from "@/components/guide/sections/contacts/ContactJourney";
import { ManualAddVsImport } from "@/components/guide/sections/contacts/ManualAddVsImport";
import { ConsentExplainer } from "@/components/guide/sections/contacts/ConsentExplainer";
import { ContactAnatomy } from "@/components/guide/sections/contacts/ContactAnatomy";
import { contactsEn } from "@/lib/guide/content/contacts-en";
import { contactsFa } from "@/lib/guide/content/contacts-fa";

/**
 * ContactsGuideView — the client view for /guide/contacts.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the root
 * layout) and picks the matching content dictionary. The page itself never
 * makes any API or DB request — the walkthrough stage uses local demo state
 * only. See ContactsStage for the safety contract.
 *
 * If you arrived here looking for the route file: see
 * src/app/guide/[section]/page.tsx. This component is the slug-specific
 * view for the `contacts` slug.
 */

export function ContactsGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: GuideContent = locale === "fa" ? contactsFa : contactsEn;

  return (
    <GuidePageLayout
      routeKey={content.routeKey}
      backHref={content.backHref}
      chapters={content.chapters}
      stepCount={content.stepCount}
      durationMin={content.durationMin}
      writtenSteps={content.writtenSteps}
      whyWhen={content.whyWhen}
      mistakes={content.mistakes}
      proTips={content.proTips}
      troubleshooting={content.troubleshooting}
      checklist={content.checklist}
      whatNext={content.whatNext}
      related={content.related}
      renderScene={ContactsStage}
      creativeSections={
        <>
          <ContactJourney />
          <ManualAddVsImport />
          <ConsentExplainer />
          <ContactAnatomy />
        </>
      }
    />
  );
}
