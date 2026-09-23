"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { EmailsGuideContent } from "@/lib/guide/content/guides/emails-types";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import { EmailsStage } from "@/components/guide/guides/emails/EmailsStage";
import { EmailLifecycle } from "@/components/guide/guides/emails/sections/EmailLifecycle";
import { StatusInterpretation } from "@/components/guide/guides/emails/sections/StatusInterpretation";
import { DeliveryTimeline } from "@/components/guide/guides/emails/sections/DeliveryTimeline";
import { FailedEmailTroubleshooting } from "@/components/guide/guides/emails/sections/FailedEmailTroubleshooting";
import { emailsEn } from "@/lib/guide/content/guides/emails-en";
import { emailsFa } from "@/lib/guide/content/guides/emails-fa";
import type { SceneRenderContext } from "@/components/guide/CinematicWalkthrough";

/**
 * EmailsGuideView — the client view for /guide/emails.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the root
 * layout) and picks the matching content dictionary. The page itself never
 * makes any API or DB request — the walkthrough stage uses local demo state
 * only. See EmailsStage for the honesty contract.
 *
 * Honesty contract (REGRESSION-PROTECTED):
 *   The real /dashboard/emails page is a 31-line PLACEHOLDER. This guide
 *   teaches the concept of email delivery tracking honestly: the stage
 *   mirrors the actual placeholder UI as it ships today, then explicitly
 *   labels every concept-preview scene ("Concept preview — not the real UI
 *   today") so users know what's real and what's a teaching aid. The
 *   deliverability backend IS real and shipped (Phase 11) — the gap is the
 *   dashboard page wiring.
 *
 * The view passes the resolved localized stage copy to EmailsStage (so the
 * simulated Emails page mirrors the active locale) and the resolved
 * localized creative-section copy to each creative section. Neither the
 * stage nor the creative sections read locale directly — they consume the
 * typed content model, mirroring the Contacts / Templates / Broadcasts
 * reference implementation pattern.
 */

export function EmailsGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: EmailsGuideContent = locale === "fa" ? emailsFa : emailsEn;

  // Bind the stage copy to the EmailsStage via a closure that satisfies
  // the SceneRenderer signature (SceneRenderContext → ReactNode).
  const renderScene = React.useCallback(
    (ctx: SceneRenderContext) => <EmailsStage {...ctx} copy={content.stage} />,
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
          <EmailLifecycle copy={content.creative.lifecycle} />
          <StatusInterpretation copy={content.creative.statusInterpretation} />
          <DeliveryTimeline copy={content.creative.deliveryTimeline} />
          <FailedEmailTroubleshooting copy={content.creative.failedTroubleshooting} />
        </>
      }
    />
  );
}
