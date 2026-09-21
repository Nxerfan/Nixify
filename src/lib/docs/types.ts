/**
 * Shared documentation content model.
 *
 * Both the public /docs page and the dashboard /dashboard/docs page consume
 * this typed structure. The content is defined once (per locale) and rendered
 * by the shared DocsShell component.
 *
 * Technical tokens (API paths, HTTP methods, JSON, code, headers, field names)
 * are stored as raw strings and rendered LTR via <Ltr> or <code dir="ltr">.
 * They are NEVER translated.
 */

import type { ComponentType } from "react";

export interface DocSection {
  /** Anchor ID for deep-linking (#<id>). */
  id: string;
  /** Localized label for the sidebar nav. */
  label: string;
  /** Lucide icon component. */
  icon: ComponentType<{ className?: string }>;
  /** Optional badge (e.g. "POST", "GET"). */
  methodBadge?: string;
  /** Optional group label for task-oriented grouping. */
  group?: string;
}

export interface DocNavGroup {
  /** Group label (e.g. "Getting Started", "API Reference"). */
  label: string;
  /** Sections in this group. */
  sections: DocSection[];
}

export interface CodeExample {
  /** Language label (e.g. "curl", "JavaScript", "Python"). */
  lang: string;
  /** The code string. */
  code: string;
}

export interface EndpointParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface EndpointDoc {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  description: string;
  params?: EndpointParam[];
  requestExample?: CodeExample;
  responseExample?: string;
  responseStatus: number;
}

export interface DocContent {
  /** Page title. */
  title: string;
  /** Page subtitle. */
  subtitle: string;
  /** Navigation groups (for the sidebar). */
  navGroups: DocNavGroup[];
  /** Task-oriented quick links (e.g. "Send my first OTP"). */
  quickLinks?: { label: string; anchor: string }[];
  /** Whether this is the dashboard variant (affects back button). */
  isDashboard?: boolean;
}
