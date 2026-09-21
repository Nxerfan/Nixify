"use client";

import * as React from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ApiKeysGuideContent } from "@/lib/guide/content/guides/api-keys-types";
import { GuidePageLayout } from "@/components/guide/GuidePageLayout";
import { ApiKeysStage } from "@/components/guide/guides/api-keys/ApiKeysStage";
import { KeyAnatomy } from "@/components/guide/guides/api-keys/sections/KeyAnatomy";
import { LiveVsTest } from "@/components/guide/guides/api-keys/sections/LiveVsTest";
import { ScopesExplainer } from "@/components/guide/guides/api-keys/sections/ScopesExplainer";
import { SecureStorageChecklist } from "@/components/guide/guides/api-keys/sections/SecureStorageChecklist";
import { apiKeysEn } from "@/lib/guide/content/guides/api-keys-en";
import { apiKeysFa } from "@/lib/guide/content/guides/api-keys-fa";
import type { SceneRenderContext } from "@/components/guide/CinematicWalkthrough";

/**
 * ApiKeysGuideView — the client view for /guide/api-keys.
 *
 * Reads the active locale from the canonical LocaleProvider (set by the
 * root layout) and picks the matching content dictionary. The page itself
 * never makes any API or DB request — the walkthrough stage uses local
 * demo state only. See ApiKeysStage for the safety contract.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   The real /dashboard/api-keys page is a fully-shipped UI (~779 lines).
 *   This guide mirrors it honestly: the stage shows the real header,
 *   quota card, keys table, and the three dialogs (Create, Reveal,
 *   Revoke). No real fetch() calls anywhere — all rows are seed demo
 *   data chosen to exercise every visible status (active, expired,
 *   revoked) and every environment × scope combination. The full key
 *   shown in the reveal scene is a synthetic local string; it has never
 *   been a real key.
 *
 * The view passes the resolved localized stage copy to ApiKeysStage (so
 * the simulated API Keys page mirrors the active locale) and the resolved
 * localized creative-section copy to each creative section. Neither the
 * stage nor the creative sections read locale directly — they consume
 * the typed content model, mirroring the Contacts / Templates /
 * Broadcasts reference implementation pattern.
 */

export function ApiKeysGuideView(): React.ReactElement {
  const { locale } = useLocale();
  const content: ApiKeysGuideContent = locale === "fa" ? apiKeysFa : apiKeysEn;

  // Bind the stage copy to the ApiKeysStage via a closure that satisfies
  // the SceneRenderer signature (SceneRenderContext → ReactNode).
  const renderScene = React.useCallback(
    (ctx: SceneRenderContext) => <ApiKeysStage {...ctx} copy={content.stage} />,
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
          <KeyAnatomy copy={content.creative.keyAnatomy} />
          <LiveVsTest copy={content.creative.liveVsTest} />
          <ScopesExplainer copy={content.creative.scopesExplainer} />
          <SecureStorageChecklist copy={content.creative.secureStorageChecklist} />
        </>
      }
    />
  );
}
