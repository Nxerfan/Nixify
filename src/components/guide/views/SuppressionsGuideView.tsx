"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { SuppressionsGuideContent } from "@/lib/guide/content/guides/suppressions-types";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import { SuppressionsStage } from "@/components/guide/guides/suppressions/SuppressionsStage";
import { SuppressionReasonAnatomy } from "@/components/guide/guides/suppressions/sections/SuppressionReasonAnatomy";
import { ActiveVsLifted } from "@/components/guide/guides/suppressions/sections/ActiveVsLifted";
import { SafeLiftingDecisionTree } from "@/components/guide/guides/suppressions/sections/SafeLiftingDecisionTree";
import { EligibilityRelationship } from "@/components/guide/guides/suppressions/sections/EligibilityRelationship";
import { suppressionsEn } from "@/lib/guide/content/guides/suppressions-en";
import { suppressionsFa } from "@/lib/guide/content/guides/suppressions-fa";
import type { SceneRenderContext } from "@/components/guide/CinematicWalkthrough";

/**
 * SuppressionsGuideView — the client view for /guide/suppressions.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the
 * root layout) and picks the matching content dictionary. The page itself
 * never makes any API or DB request — the walkthrough stage uses local
 * demo state only. See SuppressionsStage for the safety contract.
 *
 * The view passes the resolved localized stage copy to SuppressionsStage
 * (so the simulated Suppressions page mirrors the active locale) and the
 * resolved localized creative-section copy to each creative section.
 * Neither the stage nor the creative sections read locale directly — they
 * consume the typed content model, mirroring the Contacts, Branding,
 * Automations, Templates, and Broadcasts reference implementation pattern.
 */
export function SuppressionsGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: SuppressionsGuideContent =
    locale === "fa" ? suppressionsFa : suppressionsEn;

  // Bind the stage copy to the SuppressionsStage via a closure that
  // satisfies the SceneRenderer signature (SceneRenderContext → ReactNode).
  const renderScene = React.useCallback(
    (ctx: SceneRenderContext) => <SuppressionsStage {...ctx} copy={content.stage} />,
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
          <SuppressionReasonAnatomy copy={content.creative.reasonAnatomy} />
          <ActiveVsLifted copy={content.creative.activeVsLifted} />
          <SafeLiftingDecisionTree copy={content.creative.safeLiftingDecisionTree} />
          <EligibilityRelationship copy={content.creative.eligibilityRelationship} />
        </>
      }
    />
  );
}
