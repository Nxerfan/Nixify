"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { BroadcastsGuideContent } from "@/lib/guide/content/guides/broadcasts-types";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import { BroadcastsStage } from "@/components/guide/guides/broadcasts/BroadcastsStage";
import { BroadcastLifecycle } from "@/components/guide/guides/broadcasts/sections/BroadcastLifecycle";
import { PreSendSafetyChecklist } from "@/components/guide/guides/broadcasts/sections/PreSendSafetyChecklist";
import { AudienceTemplateFlow } from "@/components/guide/guides/broadcasts/sections/AudienceTemplateFlow";
import { SendNowVsSchedule } from "@/components/guide/guides/broadcasts/sections/SendNowVsSchedule";
import { broadcastsEn } from "@/lib/guide/content/guides/broadcasts-en";
import { broadcastsFa } from "@/lib/guide/content/guides/broadcasts-fa";
import type { SceneRenderContext } from "@/components/guide/CinematicWalkthrough";

/**
 * BroadcastsGuideView — the client view for /guide/broadcasts.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the root
 * layout) and picks the matching content dictionary. The page itself never
 * makes any API or DB request — the walkthrough stage uses local demo state
 * only. See BroadcastsStage for the safety contract.
 *
 * The view passes the resolved localized stage copy to BroadcastsStage
 * (so the simulated Broadcasts page mirrors the active locale) and the
 * resolved localized creative-section copy to each creative section.
 * Neither the stage nor the creative sections read locale directly — they
 * consume the typed content model, mirroring the Contacts, Automations,
 * and Templates reference implementation pattern.
 */
export function BroadcastsGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: BroadcastsGuideContent =
    locale === "fa" ? broadcastsFa : broadcastsEn;

  // Bind the stage copy to the BroadcastsStage via a closure that satisfies
  // the SceneRenderer signature (SceneRenderContext → ReactNode).
  const renderScene = React.useCallback(
    (ctx: SceneRenderContext) => <BroadcastsStage {...ctx} copy={content.stage} />,
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
          <BroadcastLifecycle copy={content.creative.lifecycle} />
          <PreSendSafetyChecklist copy={content.creative.preSendChecklist} />
          <AudienceTemplateFlow copy={content.creative.audienceTemplateFlow} />
          <SendNowVsSchedule copy={content.creative.sendNowVsSchedule} />
        </>
      }
    />
  );
}
