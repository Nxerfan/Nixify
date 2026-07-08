"use client";

import Link from "next/link";
import { motion, useScroll, useSpring } from "framer-motion";
import { ShieldCheck, Github, Twitter, Mail, ArrowUp, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Premium site footer — animated scroll-progress bar at top, newsletter signup,
 * link columns with hover arrows, animated socials, back-to-top button.
 */

export function SiteFooter() {
  const year = 2026;
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  // Scroll progress bar (top of footer)
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    toast({ title: "Subscribed!", description: "We'll keep you in the loop." });
    setEmail("");
    setTimeout(() => setSubscribed(false), 3000);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer
      className="relative mt-auto w-full overflow-hidden border-t border-emerald-500/10 backdrop-blur-xl"
      style={{ backgroundColor: "rgba(6,9,7,0.8)" }}
      aria-label="Site footer"
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
        {/* Top section: brand + newsletter */}
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
                Real OTP email verification. Zero-cost, self-hostable, SMTP-swappable.
                Built for developers who ship.
              </p>
            </div>
          </motion.div>

          {/* Newsletter */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
          >
            <p className="mb-2 text-sm font-medium text-gray-200">Stay in the loop</p>
            <p className="mb-3 text-xs text-gray-500">Product updates, new templates, deliverability tips. No spam.</p>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-lg border border-gray-800/60 bg-gray-950/50 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 outline-none transition-all focus:border-emerald-500/40 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
                aria-label="Email for newsletter"
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
              >
                {subscribed ? "Subscribed!" : "Subscribe"}
                {!subscribed && <ArrowRight className="size-3.5" />}
              </motion.button>
            </form>
          </motion.div>
        </div>

        {/* Divider */}
        <div className="my-8 h-px bg-gradient-to-r from-transparent via-gray-800/60 to-transparent" />

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <FooterColumn
            title="Product"
            links={[
              { label: "Sign up", href: "/auth" },
              { label: "Sign in", href: "/auth" },
              { label: "Dashboard", href: "/dashboard" },
              { label: "Pricing", href: "/auth" },
            ]}
          />
          <FooterColumn
            title="Developers"
            links={[
              { label: "Documentation", href: "/dashboard/docs" },
              { label: "API Playground", href: "/dashboard/playground" },
              { label: "Error Explorer", href: "/dashboard/errors" },
              { label: "Request Logs", href: "/dashboard/logs" },
            ]}
          />
          <FooterColumn
            title="Customize"
            links={[
              { label: "Pricing", href: "/pricing" },
              { label: "Webhooks", href: "/dashboard/webhooks" },
              { label: "API Keys", href: "/dashboard/api-keys" },
              { label: "Branding", href: "/dashboard/branding" },
            ]}
          />
          <FooterColumn
            title="Company"
            links={[
              { label: "About", href: "/about" },
              { label: "Blog", href: "/" },
              { label: "Contact", href: "mailto:hello@nixify.dev" },
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Service", href: "/terms" },
            ]}
          />
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-800/40 pt-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <p className="text-xs text-gray-600">
              &copy; {year} Nixify &middot; All rights reserved
            </p>
            {/* Status indicator */}
            <span className="hidden items-center gap-1.5 text-xs text-emerald-400/70 sm:flex">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              All systems operational
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Socials */}
            <div className="flex items-center gap-2">
              {[
                { icon: Github, label: "GitHub" },
                { icon: Twitter, label: "Twitter" },
                { icon: Mail, label: "Email" },
              ].map((s) => (
                <motion.a
                  key={s.label}
                  href={s.label === "Email" ? "mailto:hello@nixify.dev" : "#"}
                  aria-label={s.label}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex size-9 items-center justify-center rounded-lg border border-gray-800/60 text-gray-500 transition-all hover:border-emerald-500/30 hover:text-emerald-400"
                >
                  <s.icon className="size-4" />
                </motion.a>
              ))}
            </div>

            {/* Back to top */}
            <motion.button
              onClick={scrollToTop}
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Back to top"
              className="flex size-9 items-center justify-center rounded-lg border border-gray-800/60 text-gray-500 transition-all hover:border-emerald-500/30 hover:text-emerald-400"
            >
              <ArrowUp className="size-4" />
            </motion.button>
          </div>
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
