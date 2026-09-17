/**
 * Blog locale resolver — reuses the existing Phase 12 i18n architecture.
 *
 * Reads the locale from the request's cookie/header context (same as the
 * root layout) to determine which blog locale to serve. Falls back to en.
 */

import { headers } from "next/headers";
import { readLocaleCookieFromHeader } from "@/lib/i18n/cookie";
import { getGeoLocale } from "@/lib/i18n/geo";
import { parseAcceptLanguage } from "@/lib/i18n/accept-language";
import type { BlogLocale } from "./types";

export async function resolveLocaleFromHeaders(): Promise<BlogLocale> {
  const headerStore = await headers();

  // 1. Cookie
  const cookieLocale = readLocaleCookieFromHeader(headerStore.get("cookie"));
  if (cookieLocale === "en" || cookieLocale === "fa") return cookieLocale;

  // 2. Geo hint
  const req = new Request("http://localhost", { headers: headerStore });
  const geoLocale = getGeoLocale(req);
  if (geoLocale === "en" || geoLocale === "fa") return geoLocale;

  // 3. Accept-Language
  const alHeader = headerStore.get("accept-language");
  if (alHeader) {
    const list = parseAcceptLanguage(alHeader);
    if (list.length > 0 && (list[0] === "en" || list[0] === "fa")) return list[0];
  }

  // 4. Default
  return "en";
}
