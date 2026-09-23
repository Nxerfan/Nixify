"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { BrandingGuideContent } from "@/lib/guide/content/guides/branding-types";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import { BrandingStage } from "@/components/guide/guides/branding/BrandingStage";
import { BrandingBeforeAfter } from "@/components/guide/guides/branding/sections/BrandingBeforeAfter";
import { BrandAnatomy } from "@/components/guide/guides/branding/sections/BrandAnatomy";
import { EmailChangesExplainer } from "@/components/guide/guides/branding/sections/EmailChangesExplainer";
import { BrandingConsistencyChecklist } from "@/components/guide/guides/branding/sections/BrandingConsistencyChecklist";
import { brandingEn } from "@/lib/guide/content/guides/branding-en";
import { brandingFa } from "@/lib/guide/content/guides/branding-fa";
import type { SceneRenderContext } from "@/components/guide/CinematicWalkthrough";

/**
 * BrandingGuideView — the client view for /guide/branding.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the root
 * layout) and picks the matching content dictionary. The page itself never
 * makes any API or DB request — the walkthrough stage uses local demo state
 * only. See BrandingStage for the safety contract.
 *
 * The view passes the resolved localized stage copy to BrandingStage (so the
 * simulated Email Themes editor mirrors the active locale) and the resolved
 * localized creative-section copy to each creative section. Neither the stage
 * nor the creative sections read locale directly — they consume the typed
 * content model, mirroring the Contacts reference implementation pattern.
 */
export function BrandingGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: BrandingGuideContent = locale === "fa" ? brandingFa : brandingEn;

  // Bind the stage copy to the BrandingStage via a closure that satisfies
  // the SceneRenderer signature (SceneRenderContext → ReactNode).
  const renderScene = React.useCallback(
    (ctx: SceneRenderContext) => <BrandingStage {...ctx} copy={content.stage} />,
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
          <BrandingBeforeAfter copy={content.creative.beforeAfter} />
          <BrandAnatomy copy={content.creative.anatomy} />
          <EmailChangesExplainer copy={content.creative.emailChanges} />
          <BrandingConsistencyChecklist copy={content.creative.consistencyChecklist} />
        </>
      }
    />
  );
}
