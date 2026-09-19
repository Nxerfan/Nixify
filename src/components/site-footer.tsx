"use client";

import Link from "next/link";
import { motion, useScroll, useSpring } from "framer-motion";
import { ShieldCheck, ArrowUp, ArrowRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Site footer — animated scroll-progress bar at top, brand + tagline, link
 * columns with hover arrows, back-to-top button.
 *
 * Non-interactive only: no fake newsletter signup (there is no backend for it),
 * no fake system-status indicator (no health check is wired up here), no
 * dead social links. Honest, non-interactive copy replaces the newsletter.
 */

export function SiteFooter() {
  const year = 2026;
  const t = useTranslations();

  // Scroll progress bar (top of footer)
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer
      className="relative mt-auto w-full overflow-hidden border-t border-emerald-500/10 backdrop-blur-xl"
      style={{ backgroundColor: "rgba(6,9,7,0.8)" }}
      aria-label={t("footer.aria.label")}
    >
      {/* Scroll progress bar */}
      <motion.div
        className="absolute left-0 right-0 top-0 h-0.5 origin-left bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500"
        style={{ scaleX: progress }}
      />

      {/* Ambient glow — radial-gradient only (no blur-3xl, which clipped to a rectangle inside overflow-hidden) */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-40 h-80"
        style={{
          background:
            "radial-gradient(ellipse 50% 100% at 50% 100%, rgba(16,185,129,0.20) 0%, rgba(20,184,166,0.06) 40%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
        {/* Top section: brand + stay-updated copy */}
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          {/* Brand */}
          <motion.div
            className="flex items-start gap-3"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <motion.div
              className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20"
              whileHover={{ scale: 1.08, rotate: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <ShieldCheck className="size-5 text-emerald-400" aria-hidden="true" />
            </motion.div>
            <div className="space-y-2">
              <p className="text-base font-semibold text-gray-100">Nixify</p>
              <p className="max-w-xs text-sm leading-relaxed text-gray-500">
                {t("footer.tagline")}
              </p>
            </div>
          </motion.div>

          {/* Stay updated — honest, non-interactive copy */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          >
            <p className="mb-2 text-sm font-medium text-gray-200">{t("footer.stayUpdated")}</p>
            <p className="text-xs text-gray-500">
              {t("footer.stayUpdatedDesc")}
            </p>
            <Link
              href="/blog"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-400 transition-colors hover:text-emerald-300"
            >
              {t("footer.readBlog")}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </motion.div>
        </div>

        {/* Divider */}
        <div className="my-8 h-px bg-gradient-to-r from-transparent via-gray-800/60 to-transparent" />

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <FooterColumn
            title={t("footer.columns.product")}
            links={[
              { label: t("footer.links.signUp"), href: "/auth" },
              { label: t("footer.links.signIn"), href: "/auth" },
              { label: t("footer.links.dashboard"), href: "/dashboard" },
              { label: t("footer.links.pricing"), href: "/pricing" },
            ]}
          />
          <FooterColumn
            title={t("footer.columns.developers")}
            links={[
              { label: t("footer.links.documentation"), href: "/docs" },
              { label: t("footer.links.apiPlayground"), href: "/dashboard/playground" },
              { label: t("footer.links.errorExplorer"), href: "/dashboard/errors" },
              { label: t("footer.links.requestLogs"), href: "/dashboard/logs" },
            ]}
          />
          <FooterColumn
            title={t("footer.columns.customize")}
            links={[
              { label: t("footer.links.pricing"), href: "/pricing" },
              { label: t("footer.links.webhooks"), href: "/dashboard/webhooks" },
              { label: t("footer.links.apiKeys"), href: "/dashboard/api-keys" },
              { label: t("footer.links.branding"), href: "/dashboard/branding" },
            ]}
          />
          <FooterColumn
            title={t("footer.columns.company")}
            links={[
              { label: t("footer.links.about"), href: "/about" },
              { label: t("footer.links.blog"), href: "/blog" },
              { label: t("footer.links.privacyPolicy"), href: "/privacy" },
              { label: t("footer.links.termsOfService"), href: "/terms" },
            ]}
          />
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-800/40 pt-6 sm:flex-row">
          <p className="text-xs text-gray-600">
            &copy; {year} Nixify &middot; {t("footer.allRightsReserved")}
          </p>

          {/* Back to top */}
          <motion.button
            onClick={scrollToTop}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.95 }}
            aria-label={t("footer.aria.backToTop")}
            className="flex size-9 items-center justify-center rounded-lg border border-gray-800/60 text-gray-500 transition-all hover:border-emerald-500/30 hover:text-emerald-400"
          >
            <ArrowUp className="size-4" />
          </motion.button>
        </div>
      </div>
    </footer>
  );
}

// ---- Sub-components --------------------------------------------------------

/** Footer link column with hover-arrow effect on each link. */
function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-600">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="group flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-emerald-400"
            >
              <ArrowRight className="size-3 -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              <span className="transition-transform group-hover:translate-x-0.5">{link.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
