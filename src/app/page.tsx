"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import {
  ShieldCheck,
  Mail,
  KeyRound,
  Gift,
  ArrowRight,
  CheckCircle2,
  Zap,
  Lock,
  Globe,
  Code2,
  Sparkles,
  ChevronDown,
  Terminal,
  BarChart3,
  Palette,
  Webhook,
  TrendingUp,
  Server,
  Clock,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { CustomCursor } from "@/app/auth/components/CustomCursor";
import { AnimatedText } from "@/app/auth/components/AnimatedText";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LandingPage() {
  return (
    <>
      <AmbientBackground />
      <CustomCursor />
      <HeroSection />
      <LiveStatsBar />
      <FeaturesSection />
      <OtpDemoSection />
      <TemplateShowcase />
      <CodePreviewSection />
      <ComparisonSection />
      <HowItWorksSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}

// ─── HERO ──────────────────────────────────────────────────────────────────

function HeroSection() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, -80]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <section className="relative flex min-h-screen items-center justify-center px-4">
      {/* Hero radial glow — smooth, no rectangular clipping */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(16,185,129,0.18) 0%, rgba(20,184,166,0.08) 30%, transparent 65%)",
        }}
      />

      <motion.div
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative z-10 mx-auto max-w-4xl text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-1.5 text-xs text-emerald-300/80"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          Real email verification · Zero cost · No credit card
        </motion.div>

        {/* Headline — word-by-word reveal */}
        <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          <AnimatedText
            text="Verify emails"
            delay={0.2}
            className="text-gray-100"
          />
          <br />
          <AnimatedText
            text="instantly."
            delay={0.6}
            className="text-gray-100"
          />
        </h1>

        {/* Subtitle */}
        <motion.p
          className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-gray-400 sm:text-lg"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5, ease: EASE }}
        >
          Nixify sends actual 6-digit OTP codes to a real inbox over SMTP.
          Single-use, rate-limited, brute-force-protected. Start free, swap to
          your own mail server whenever you like.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5, ease: EASE }}
        >
          <Button
            asChild
            size="lg"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] sm:w-auto"
          >
            <Link href="/auth">
              Get started — free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="w-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-100 hover:bg-emerald-500/10 hover:text-white sm:w-auto"
          >
            <Link href="/auth">Log in</Link>
          </Button>
        </motion.div>

        <motion.p
          className="mt-5 text-xs text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          No credit card · 30-day trial · Cancel anytime
        </motion.p>
      </motion.div>

      {/* Scroll indicator — positioned within the initial viewport (visible without scrolling) */}
      <motion.div
        className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{
          delay: 1.5,
          y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
        aria-hidden="true"
      >
        <span className="text-[10px] uppercase tracking-widest text-gray-600">
          Scroll
        </span>
        <ChevronDown className="h-4 w-4 text-emerald-400/60" />
      </motion.div>
    </section>
  );
}

// ─── LIVE STATS BAR ────────────────────────────────────────────────────────

function LiveStatsBar() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const stats = [
    { value: 1247, label: "Users verified", icon: ShieldCheck },
    { value: 48392, label: "OTPs delivered", icon: Mail },
    { value: 99.9, suffix: "%", label: "Delivery rate", icon: TrendingUp },
    { value: 0, prefix: "$", label: "Cost to start", icon: Gift },
  ];

  return (
    <section
      ref={ref}
      className="relative border-y border-emerald-500/10 bg-[#060907]/60 backdrop-blur-xl"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: i * 0.1, duration: 0.5, ease: EASE }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <stat.icon className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-xl font-bold tabular-nums text-gray-100">
                {stat.prefix}
                <CountUp value={stat.value} inView={inView} />
                {stat.suffix}
              </div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── FEATURES ──────────────────────────────────────────────────────────────

function FeaturesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const features = [
    {
      icon: Mail,
      title: "Real SMTP delivery",
      text: "Codes delivered over actual SMTP via Gmail App Password. Swap to any provider later — the transport is pluggable.",
      color: "#34d399",
    },
    {
      icon: Lock,
      title: "Single-use, rate-limited",
      text: "Every 6-digit code is one-time, expiry-bound, and protected against brute force and resend abuse.",
      color: "#2dd4bf",
    },
    {
      icon: Zap,
      title: "Sub-second verification",
      text: "Constant-time HMAC compare, atomic single-use enforcement, and DB-backed rate limiting — no in-memory state.",
      color: "#6ee7b7",
    },
    {
      icon: Gift,
      title: "1-month free trial",
      text: "Verify your email and complete your profile to instantly activate a 30-day trial. No card required.",
      color: "#14b8a6",
    },
    {
      icon: Globe,
      title: "SMTP-swappable",
      text: "Start with Gmail, move to a self-hosted Postfix relay later by changing env vars only — zero code changes.",
      color: "#5eead4",
    },
    {
      icon: Server,
      title: "Serverless-safe",
      text: "All state in Postgres/SQLite. No in-memory rate limits or counters. Deploys free on Vercel Hobby tier.",
      color: "#34d399",
    },
  ];

  return (
    <section ref={ref} className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Features"
          title="Built for production, free to start"
          subtitle="Everything you need to confirm an email is real — with a trial that activates the moment you verify."
          inView={inView}
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-xl border border-gray-800/40 bg-gray-950/40 p-6 backdrop-blur-xl"
            >
              {/* Hover glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${f.color}10, transparent 70%)`,
                }}
              />
              <div
                className="relative flex size-12 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/5 transition-all group-hover:scale-110"
                style={{ boxShadow: `0 0 0 1px ${f.color}15` }}
              >
                <f.icon className="size-5" style={{ color: f.color }} />
              </div>
              <h3 className="relative mt-4 text-base font-semibold text-gray-100">
                {f.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-gray-500">
                {f.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── OTP DEMO ──────────────────────────────────────────────────────────────

function OtpDemoSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [demoDigits, setDemoDigits] = useState(["", "", "", "", "", ""]);

  // Animate the demo OTP filling in when in view
  useEffect(() => {
    if (!inView) return;
    const target = "482917".split("");
    const timers: ReturnType<typeof setTimeout>[] = [];
    target.forEach((d, i) => {
      timers.push(
        setTimeout(
          () => {
            setDemoDigits((prev) => {
              const next = [...prev];
              next[i] = d;
              return next;
            });
          },
          600 + i * 250,
        ),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <section ref={ref} className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left: copy */}
          <div>
            <SectionHeader
              eyebrow="How it works"
              title="A code. In an inbox. Verified."
              subtitle="No magic links to click, no third-party apps to install. Just a 6-digit code that works everywhere."
              inView={inView}
              align="left"
            />
            <motion.div
              className="mt-8 space-y-3"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              {[
                { icon: Mail, text: "User enters their email" },
                { icon: KeyRound, text: "We send a 6-digit code via SMTP" },
                { icon: CheckCircle2, text: "User enters the code — verified" },
              ].map((step, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-gray-800/40 bg-gray-950/30 p-3"
                  initial={{ opacity: 0, x: -12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{
                    delay: 0.5 + i * 0.1,
                    duration: 0.4,
                    ease: EASE,
                  }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
                    <step.icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <span className="text-sm text-gray-300">{step.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Right: animated OTP card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6, ease: EASE }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/10 bg-[#060907]/80 p-8 backdrop-blur-xl">
              {/* Mock email header */}
              <div className="mb-6 flex items-center gap-2 border-b border-gray-800/40 pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">Nixify</p>
                  <p className="text-xs text-gray-600">Verify your email</p>
                </div>
              </div>

              <p className="mb-4 text-xs text-gray-500">
                Enter this code to continue
              </p>

              {/* OTP boxes */}
              <div className="flex justify-center gap-2">
                {demoDigits.map((d, i) => (
                  <motion.div
                    key={i}
                    className="flex h-14 w-12 items-center justify-center rounded-xl border bg-gray-950/50 text-center text-2xl font-bold"
                    animate={{
                      borderColor: d
                        ? "rgba(52,211,153,0.4)"
                        : "rgba(75,85,99,0.25)",
                      boxShadow: d ? "0 0 20px rgba(52,211,153,0.08)" : "none",
                      scale: d ? [1.2, 1] : 1,
                    }}
                    transition={{
                      scale: { type: "spring", stiffness: 300, damping: 15 },
                    }}
                    style={{ color: d ? "#34d399" : "transparent" }}
                  >
                    {d || "0"}
                  </motion.div>
                ))}
              </div>

              <p className="mt-6 text-center text-xs text-gray-600">
                <Clock className="mr-1 inline h-3 w-3" />
                Expires in 10 minutes
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── TEMPLATE SHOWCASE ────────────────────────────────────────────────────

function TemplateShowcase() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const templates = [
    { name: "Minimal", colors: ["#ffffff", "#0f172a"], accent: "#0f172a" },
    { name: "Discord", colors: ["#36393f", "#5865f2"], accent: "#5865f2" },
    { name: "Cyber", colors: ["#0a0e0a", "#00ff41"], accent: "#00ff41" },
    { name: "Luxury", colors: ["#0a0a0a", "#d4af37"], accent: "#d4af37" },
    { name: "Glass", colors: ["#a78bfa", "#67e8f9"], accent: "#7c3aed" },
    { name: "Stripe", colors: ["#f6f9fc", "#635bff"], accent: "#635bff" },
  ];

  return (
    <section ref={ref} className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Email Themes"
          title="20 templates. Infinite branding."
          subtitle="Customize every email with your logo, colors, and fonts. No HTML knowledge required."
          inView={inView}
        />
        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {templates.map((tpl, i) => (
            <motion.div
              key={tpl.name}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
              whileHover={{ y: -6, scale: 1.03 }}
              className="group cursor-pointer"
            >
              <div
                className="relative aspect-[3/4] overflow-hidden rounded-xl border border-gray-800/40"
                style={{
                  background: `linear-gradient(135deg, ${tpl.colors[0]}, ${tpl.colors[1]})`,
                }}
              >
                {/* Mock email */}
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
                  <div
                    className="text-[8px] font-bold"
                    style={{ color: tpl.accent }}
                  >
                    Nixify
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((j) => (
                      <div
                        key={j}
                        className="h-5 w-4 rounded border"
                        style={{
                          borderColor: `${tpl.accent}40`,
                          background: `${tpl.accent}10`,
                        }}
                      >
                        <div
                          className="flex h-full items-center justify-center text-[8px] font-bold"
                          style={{ color: tpl.accent }}
                        >
                          {tpl.name[0]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="pb-3 text-xs font-medium text-white">
                    {tpl.name}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
        >
          <ExploreTemplatesButton />
        </motion.div>
      </div>
    </section>
  );
}

// ─── CODE PREVIEW ──────────────────────────────────────────────────────────

function CodePreviewSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [lang, setLang] = useState<"curl" | "js" | "python">("js");

  const snippets: Record<string, string> = {
    js: `import { Nixify } from '@nixify/nodejs';

const mg = new Nixify('mg_live_xxx');

// Send a 6-digit OTP
const { requestId } = await mg.otp.send({
  email: 'user@example.com',
  purpose: 'signup',
});

// Verify it
const { verified } = await mg.otp.verify({
  email: 'user@example.com',
  code: '482917',
});`,
    curl: `curl -X POST https://api.nixify.dev/api/v1/otp/send \\
  -H 'Authorization: Bearer mg_live_xxx' \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"user@example.com","purpose":"signup"}'`,
    python: `import requests

res = requests.post(
    'https://api.nixify.dev/api/v1/otp/send',
    headers={'Authorization': 'Bearer mg_live_xxx'},
    json={'email': 'user@example.com', 'purpose': 'signup'}
)
print(res.json())`,
  };

  return (
    <section ref={ref} className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          eyebrow="Developer Experience"
          title="Integrate in under 10 minutes"
          subtitle="Official SDKs for Node.js, Python, Go, and more. Or just use cURL."
          inView={inView}
        />
        <motion.div
          className="mt-12 overflow-hidden rounded-2xl border border-gray-800/50 bg-[#060907]/80 backdrop-blur-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6, ease: EASE }}
        >
          {/* Tab bar */}
          <div className="flex items-center gap-1 border-b border-gray-800/50 px-4 py-2">
            {(["js", "curl", "python"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  lang === l
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {l === "js" ? "JavaScript" : l === "curl" ? "cURL" : "Python"}
              </button>
            ))}
            <div className="ml-auto flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-rose-500/30" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500/30" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/30" />
            </div>
          </div>
          {/* Code */}
          <div className="overflow-x-auto p-6">
            <pre className="text-sm leading-relaxed">
              <code className="font-mono text-gray-300">
                {snippets[lang].split("\n").map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.5 + i * 0.03, duration: 0.3 }}
                    className="whitespace-pre"
                  >
                    <span className="mr-4 select-none text-gray-700">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      dangerouslySetInnerHTML={{ __html: highlightLine(line) }}
                    />
                  </motion.div>
                ))}
              </code>
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function highlightLine(line: string): string {
  return line
    .replace(
      /(&|<|>)/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!,
    )
    .replace(/(['"`].*?['"`])/g, '<span style="color:#6ee7b7">$1</span>')
    .replace(
      /\b(const|await|import|from|new|print|curl|requests)\b/g,
      '<span style="color:#2dd4bf">$1</span>',
    )
    .replace(
      /\b(Nixify|mg|otp|send|verify|post)\b/g,
      '<span style="color:#34d399">$1</span>',
    )
    .replace(/(\/\/.*)/g, '<span style="color:#4b5563">$1</span>');
}

// ─── COMPARISON ────────────────────────────────────────────────────────────

function ComparisonSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const rows = [
    { feature: "Real SMTP delivery", nixify: true, others: "Paid plan" },
    { feature: "Single-use codes", nixify: true, others: "Add-on" },
    { feature: "Brute-force protection", nixify: true, others: false },
    { feature: "Rate limiting (DB-backed)", nixify: true, others: "In-memory" },
    {
      feature: "Email theme customization",
      nixify: "20 templates",
      others: "Premium",
    },
    { feature: "Sandbox mode", nixify: true, others: false },
    { feature: "Price", nixify: "$0/mo", others: "$20+/mo" },
  ];

  return (
    <section ref={ref} className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          eyebrow="Comparison"
          title="Why Nixify?"
          subtitle="Everything you'd get from a paid ESP — for zero cost."
          inView={inView}
        />
        <motion.div
          className="mt-12 overflow-hidden rounded-2xl border border-gray-800/40 bg-gray-950/40 backdrop-blur-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="px-6 py-4 text-left text-gray-500">Feature</th>
                <th className="px-6 py-4 text-center text-emerald-400">
                  Nixify
                </th>
                <th className="px-6 py-4 text-center text-gray-600">Others</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <motion.tr
                  key={row.feature}
                  className="border-b border-gray-800/30 last:border-0"
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 1 } : {}}
                  transition={{ delay: 0.4 + i * 0.05 }}
                >
                  <td className="px-6 py-3.5 text-gray-300">{row.feature}</td>
                  <td className="px-6 py-3.5 text-center">
                    {row.nixify === true ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-400" />
                    ) : (
                      <span className="font-medium text-emerald-300">
                        {row.nixify}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-center text-gray-600">
                    {row.others === true ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-gray-600" />
                    ) : row.others === false ? (
                      <span className="text-gray-700">—</span>
                    ) : (
                      row.others
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}

// ─── HOW IT WORKS ──────────────────────────────────────────────────────────

function HowItWorksSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const steps = [
    { icon: Mail, title: "Sign up", text: "Enter your email and a password." },
    {
      icon: KeyRound,
      title: "Get a code",
      text: "We email you a 6-digit verification code.",
    },
    {
      icon: CheckCircle2,
      title: "Verify",
      text: "Enter the code to confirm your email.",
    },
    {
      icon: Gift,
      title: "Start trial",
      text: "Complete your profile — 30-day trial activates instantly.",
    },
  ];

  return (
    <section ref={ref} className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          eyebrow="Get started"
          title="From signup to active trial in under a minute"
          inView={inView}
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.5, ease: EASE }}
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="absolute top-8 left-[60%] hidden h-px w-full bg-gradient-to-r from-emerald-500/30 to-transparent lg:block" />
              )}
              <div className="relative">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/15 bg-emerald-500/5">
                  <step.icon className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="mb-1 text-xs font-medium text-emerald-400">
                  Step {i + 1}
                </div>
                <h3 className="text-base font-semibold text-gray-100">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">{step.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ───────────────────────────────────────────────────────────────────

function FaqSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [open, setOpen] = useState<number | null>(0);

  const faqs = [
    {
      q: "Is it really free?",
      a: "Yes. The entire stack runs on free tiers: Vercel Hobby, Neon Postgres free, and Gmail SMTP (free with App Password). No credit card required anywhere.",
    },
    {
      q: "Does it actually send real emails?",
      a: "Yes. OTP codes are delivered over real SMTP using your Gmail App Password. No mocks, no stubs — real delivery to a real inbox.",
    },
    {
      q: "Can I use my own SMTP server?",
      a: "Yes. The mail transport is a swappable interface. Start with Gmail SMTP (Architecture A), move to a self-hosted Postfix relay (Architecture C) by changing env vars only — zero code changes.",
    },
    {
      q: "How are OTP codes secured?",
      a: "Codes are generated with crypto.randomInt (rejection-sampled, no modulo bias), stored as HMAC-SHA256 hashes (never plaintext), compared with timingSafeEqual (constant-time), and enforced single-use via atomic database writes.",
    },
    {
      q: "Can I customize the email appearance?",
      a: "Yes. 20 professionally designed templates (2 free, 18 Pro) with full branding customization — logo, colors, fonts, layout. No HTML knowledge required.",
    },
  ];

  return (
    <section ref={ref} className="relative px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <SectionHeader eyebrow="FAQ" title="Questions?" inView={inView} />
        <div className="mt-12 space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08, duration: 0.4, ease: EASE }}
              className="overflow-hidden rounded-xl border border-gray-800/40 bg-gray-950/30 backdrop-blur-xl"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-gray-200">
                  {faq.q}
                </span>
                <motion.div
                  animate={{ rotate: open === i ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </motion.div>
              </button>
              <motion.div
                initial={false}
                animate={{
                  height: open === i ? "auto" : 0,
                  opacity: open === i ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: EASE }}
                className="overflow-hidden"
              >
                <p className="px-5 pb-4 text-sm leading-relaxed text-gray-500">
                  {faq.a}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FINAL CTA ────────────────────────────────────────────────────────────

function FinalCtaSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative px-4 py-32 sm:px-6">
      <motion.div
        className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/30 to-gray-950/40 p-12 text-center backdrop-blur-xl"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {/* Ambient glow — radial-gradient fades naturally to transparent (no rectangular clipping) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(16,185,129,0.18) 0%, rgba(20,184,166,0.06) 35%, transparent 70%)",
          }}
        />

        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={inView ? { scale: 1, rotate: 0 } : {}}
          transition={{
            delay: 0.2,
            type: "spring",
            stiffness: 200,
            damping: 12,
          }}
          className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
        >
          <Sparkles className="h-8 w-8 text-emerald-400" />
        </motion.div>

        <h2 className="relative text-3xl font-bold tracking-tight text-gray-100 sm:text-4xl">
          Ready to verify?
        </h2>
        <p className="relative mx-auto mt-3 max-w-md text-gray-400">
          Start sending real OTP emails in under 10 minutes. No credit card, no
          setup fee, no lock-in.
        </p>
        <div className="relative mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            asChild
            size="lg"
            className="bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
          >
            <Link href="/auth">
              Get started — free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="border border-emerald-500/20 bg-emerald-500/5 text-emerald-100 hover:bg-emerald-500/10 hover:text-white"
          >
            <Link href="/dashboard/docs">Read the docs</Link>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}

// ─── SHARED COMPONENTS ─────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  inView,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  inView: boolean;
  align?: "center" | "left";
}) {
  return (
    <div
      className={
        align === "center" ? "mx-auto max-w-2xl text-center" : "text-left"
      }
    >
      <motion.span
        className="mb-3 inline-block text-xs font-medium uppercase tracking-wider text-emerald-400/70"
        initial={{ opacity: 0, y: 8 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {eyebrow}
      </motion.span>
      <motion.h2
        className="text-3xl font-bold tracking-tight text-gray-100 sm:text-4xl"
        initial={{ opacity: 0, y: 12 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          className="mt-3 text-gray-500"
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

/** Count-up number using spring physics — starts when `inView` is true. */
function CountUp({ value, inView }: { value: number; inView: boolean }) {
  const spring = useSpring(0, { stiffness: 50, damping: 18 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) spring.set(value);
  }, [inView, spring, value]);

  useEffect(() => {
    return spring.on("change", (v) => {
      setDisplay(
        value >= 1000
          ? Math.round(v).toLocaleString()
          : value % 1 === 0
            ? String(Math.round(v))
            : v.toFixed(1),
      );
    });
  }, [spring, value]);

  return <>{display}</>;
}

/**
 * "Explore all 20 templates" button — redirects to the user Branding page if
 * the visitor is authenticated, otherwise to the user login page (/auth).
 * Never sends visitors to the admin login.
 */
function ExploreTemplatesButton() {
  const [href, setHref] = useState<string>("/auth");

  useEffect(() => {
    let cancelled = false;
    // Quick auth probe: /api/profile/me returns 200 when the user has a session.
    fetch("/api/profile/me", { cache: "no-store" })
      .then((r) => {
        if (cancelled) return;
        setHref(r.ok ? "/dashboard/branding" : "/auth");
      })
      .catch(() => {
        if (!cancelled) setHref("/auth");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Button
      asChild
      variant="ghost"
      className="border border-emerald-500/20 bg-emerald-500/5 text-emerald-100 hover:bg-emerald-500/10 hover:text-white"
    >
      <Link href={href}>
        <Palette className="size-4" />
        Explore all 20 templates
      </Link>
    </Button>
  );
}
