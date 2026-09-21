"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { WebhooksGuideContent } from "@/lib/guide/content/guides/webhooks-types";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import { WebhooksStage } from "@/components/guide/guides/webhooks/WebhooksStage";
import { EventJourney } from "@/components/guide/guides/webhooks/sections/EventJourney";
import { EndpointAnatomy } from "@/components/guide/guides/webhooks/sections/EndpointAnatomy";
import { SigningVerification } from "@/components/guide/guides/webhooks/sections/SigningVerification";
import { DeliveryLifecycle } from "@/components/guide/guides/webhooks/sections/DeliveryLifecycle";
import { webhooksEn } from "@/lib/guide/content/guides/webhooks-en";
import { webhooksFa } from "@/lib/guide/content/guides/webhooks-fa";
import type { SceneRenderContext } from "@/components/guide/CinematicWalkthrough";

/**
 * WebhooksGuideView — the client view for /guide/webhooks.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the
 * root layout) and picks the matching content dictionary. The page itself
 * never makes any API or DB request — the walkthrough stage uses local
 * demo state only. See WebhooksStage for the safety contract.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   The real /dashboard/webhooks page is a fully-shipped UI (~1038 lines).
 *   This guide mirrors it honestly: the stage shows the real header,
 *   endpoints table, deliveries table, and the three dialogs (Create,
 *   Secret reveal, Deactivate). No real fetch() calls anywhere — all rows
 *   are seed demo data chosen to exercise every visible status
 *   (delivered / failed / pending + active / inactive endpoints). The
 *   signing secret shown in the reveal scene is a synthetic local string;
 *   it has never been a real secret.
 *
 * The view passes the resolved localized stage copy to WebhooksStage (so
 * the simulated Webhooks page mirrors the active locale) and the resolved
 * localized creative-section copy to each creative section. Neither the
 * stage nor the creative sections read locale directly — they consume
 * the typed content model, mirroring the Contacts / Broadcasts / API Keys
 * reference implementation pattern.
 */

export function WebhooksGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: WebhooksGuideContent = locale === "fa" ? webhooksFa : webhooksEn;

  // Bind the stage copy to the WebhooksStage via a closure that satisfies
  // the SceneRenderer signature (SceneRenderContext → ReactNode).
  const renderScene = React.useCallback(
    (ctx: SceneRenderContext) => <WebhooksStage {...ctx} copy={content.stage} />,
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
          <EventJourney copy={content.creative.eventJourney} />
          <EndpointAnatomy copy={content.creative.endpointAnatomy} />
          <SigningVerification copy={content.creative.signingVerification} />
          <DeliveryLifecycle copy={content.creative.deliveryLifecycle} />
        </>
      }
    />
  );
}
