"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { AutomationsGuideContent } from "@/lib/guide/content/guides/automations-types";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import { AutomationsStage } from "@/components/guide/guides/automations/AutomationsStage";
import { TriggerActionFlow } from "@/components/guide/guides/automations/sections/TriggerActionFlow";
import { ExecutionStory } from "@/components/guide/guides/automations/sections/ExecutionStory";
import { EventJourney } from "@/components/guide/guides/automations/sections/EventJourney";
import { SafeDesignChecklist } from "@/components/guide/guides/automations/sections/SafeDesignChecklist";
import { automationsEn } from "@/lib/guide/content/guides/automations-en";
import { automationsFa } from "@/lib/guide/content/guides/automations-fa";
import type { SceneRenderContext } from "@/components/guide/CinematicWalkthrough";

/**
 * AutomationsGuideView — the client view for /guide/automations.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the root
 * layout) and picks the matching content dictionary. The page itself never
 * makes any API or DB request — the walkthrough stage uses local demo state
 * only. See AutomationsStage for the safety contract.
 *
 * The view passes the resolved localized stage copy to AutomationsStage
 * (so the simulated Automations page mirrors the active locale) and the
 * resolved localized creative-section copy to each creative section.
 * Neither the stage nor the creative sections read locale directly — they
 * consume the typed content model, mirroring the Contacts and Branding
 * reference implementation pattern.
 */
export function AutomationsGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: AutomationsGuideContent = locale === "fa" ? automationsFa : automationsEn;

  // Bind the stage copy to the AutomationsStage via a closure that satisfies
  // the SceneRenderer signature (SceneRenderContext → ReactNode).
  const renderScene = React.useCallback(
    (ctx: SceneRenderContext) => <AutomationsStage {...ctx} copy={content.stage} />,
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
          <TriggerActionFlow copy={content.creative.triggerActionFlow} />
          <ExecutionStory copy={content.creative.executionStory} />
          <EventJourney copy={content.creative.eventJourney} />
          <SafeDesignChecklist copy={content.creative.safeDesignChecklist} />
        </>
      }
    />
  );
}
