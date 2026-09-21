"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { TemplatesGuideContent } from "@/lib/guide/content/guides/templates-types";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import { TemplatesStage } from "@/components/guide/guides/templates/TemplatesStage";
import { TemplateAnatomy } from "@/components/guide/guides/templates/sections/TemplateAnatomy";
import { VariablePlayground } from "@/components/guide/guides/templates/sections/VariablePlayground";
import { VersionHistory } from "@/components/guide/guides/templates/sections/VersionHistory";
import { SafeTestSend } from "@/components/guide/guides/templates/sections/SafeTestSend";
import { templatesEn } from "@/lib/guide/content/guides/templates-en";
import { templatesFa } from "@/lib/guide/content/guides/templates-fa";
import type { SceneRenderContext } from "@/components/guide/CinematicWalkthrough";

/**
 * TemplatesGuideView — the client view for /guide/templates.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the root
 * layout) and picks the matching content dictionary. The page itself never
 * makes any API or DB request — the walkthrough stage uses local demo state
 * only. See TemplatesStage for the safety contract.
 *
 * The view passes the resolved localized stage copy to TemplatesStage
 * (so the simulated Templates page mirrors the active locale) and the
 * resolved localized creative-section copy to each creative section.
 * Neither the stage nor the creative sections read locale directly — they
 * consume the typed content model, mirroring the Contacts and Automations
 * reference implementation pattern.
 */
export function TemplatesGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: TemplatesGuideContent = locale === "fa" ? templatesFa : templatesEn;

  // Bind the stage copy to the TemplatesStage via a closure that satisfies
  // the SceneRenderer signature (SceneRenderContext → ReactNode).
  const renderScene = React.useCallback(
    (ctx: SceneRenderContext) => <TemplatesStage {...ctx} copy={content.stage} />,
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
          <TemplateAnatomy copy={content.creative.anatomy} />
          <VariablePlayground copy={content.creative.variableSubstitution} />
          <VersionHistory copy={content.creative.versionHistory} />
          <SafeTestSend copy={content.creative.safeTestSend} />
        </>
      }
    />
  );
}
