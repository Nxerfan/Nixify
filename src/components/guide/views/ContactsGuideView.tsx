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
import type { SceneRenderContext } from "@/components/guide/CinematicWalkthrough";

/**
 * ContactsGuideView — the client view for /guide/contacts.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the root
 * layout) and picks the matching content dictionary. The page itself never
 * makes any API or DB request — the walkthrough stage uses local demo state
 * only. See ContactsStage for the safety contract.
 *
 * The view passes the resolved localized stage copy to ContactsStage (so the
 * simulated product UI mirrors the active locale) and the resolved localized
 * creative-section copy to each creative section. Neither the stage nor the
 * creative sections read locale directly — they consume the typed content
 * model, keeping the reference implementation scalable.
 */

export function ContactsGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: GuideContent = locale === "fa" ? contactsFa : contactsEn;

  // Bind the stage copy to the ContactsStage via a closure that satisfies
  // the SceneRenderer signature (SceneRenderContext → ReactNode).
  const renderScene = React.useCallback(
    (ctx: SceneRenderContext) => <ContactsStage {...ctx} copy={content.stage} />,
    [content.stage],
  );

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
      renderScene={renderScene}
      creativeSections={
        <>
          <ContactJourney copy={content.creative.journey} />
          <ManualAddVsImport copy={content.creative.manualVsImport} />
          <ConsentExplainer copy={content.creative.consent} />
          <ContactAnatomy copy={content.creative.anatomy} />
        </>
      }
    />
  );
}
