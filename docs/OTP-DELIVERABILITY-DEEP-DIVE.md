# OTP Email Deliverability — Exhaustive Engineering Deep-Dive

> **Audience:** an engineer building a production-grade email-OTP verification system who cannot ask recipients to whitelist the sender.
> **Method:** research synthesized from official provider docs (Google, Microsoft, Yahoo, Apple, Proton), IETF RFCs, ESP best-practice guides (Postmark, Mailgun, SES, Resend, SparkPost), deliverability-vendor research (Validity, Litmus, GlockApps, Red Sift, Dmarcian), and community evidence (Reddit r/emaildeliverability & r/Emailmarketing, Stack Overflow, Hacker News, GitHub issues).
> **Evidence tags used below:** `[OFFICIAL]` provider/IETF documentation · `[ESP-GUIDE]` an ESP's published best practice · `[VENDOR-RESEARCH]` deliverability vendor measurement · `[COMMUNITY]` practitioner consensus · `[EXPERIMENT]` published experiment/large-scale measurement.

---

## 0. Executive summary (TL;DR)

Inbox placement for transactional OTP email is determined by **three stacked layers**, in descending order of leverage:

1. **Authentication** (SPF + DKIM + DMARC, aligned). Without this you fail at the connection layer for Gmail/Yahoo/Outlook — they enforce it as of Feb 2024. **Highest leverage, lowest cost.** `[OFFICIAL]`
2. **Sender reputation** (domain reputation primarily; IP reputation secondary at Outlook). Built by volume + engagement + low spam-complaint rate over time. You can't buy it; you warm it. **Highest long-term leverage, but slow.** `[OFFICIAL: Google Postmaster Tools]`
3. **Content & structure** (clean subject, multipart MIME, List-Unsubscribe header, minimal marketing-like HTML). Mostly determines tab placement (Primary vs Promotions) and the spam-vs-not margin for borderline reputation. `[COMMUNITY + ESP-GUIDE]`

The single highest-ROI move, full stop: **send from a domain you own via a managed transactional ESP (Postmark, SES, Resend) instead of `@gmail.com` over Gmail SMTP.** Free-webmail From addresses are a documented spam signal you cannot fully overcome, and you cannot publish DKIM/DMARC for `gmail.com`. This is a config + DNS change, not a code rewrite.

Two things are genuinely impossible without optimization: (a) guaranteeing 100% inbox placement — filters are probabilistic ML models, not rules; (b) defeating Apple Mail Privacy Protection's effect on open-rate telemetry. Plan for **multi-channel fallback** (passkeys/TOTP as the upgrade path, SMS as the emergency channel) rather than chasing 100% email delivery.

---

## 1. The mental model: how mail actually reaches an inbox

### 1.1 The journey

```
Your app (MUA) → Mail Submission Agent (MSA) → [MTA hops] → recipient MTA → Mail Delivery Agent (MDA) → inbox OR spam
```

At the recipient MDA there are **two filtering passes**:

1. **Connection / authentication layer** — does the connecting IP pass SPF? Does the message pass DKIM? Does DMARC align? Does the reverse DNS (PTR) match? Is the IP on a blocklist? This is largely binary and standards-based.
2. **Content / reputation layer** — a machine-learning model scores the message using hundreds of signals: sender reputation, historical complaint rate, content features, recipient engagement (opens, replies, "mark not spam"), and per-recipient personalization. This is probabilistic and provider-specific.

`[OFFICIAL: Gmail sender guidelines]` `[OFFICIAL: Microsoft Defender for Office 365 anti-spam]`

### 1.2 The critical distinction: "delivered" ≠ "in inbox"

A `250 OK` SMTP response (which your ESP counts as "delivered") only means the recipient MDA accepted the message. It may then route to Spam, Promotions, or even silently drop it for high-volume senders. **"Delivery rate" is a technical metric; "inbox placement" is the one that matters.** `[VENDOR-RESEARCH: Litmus, "Deliverability Myth: Why You Need to Measure Inbox Placement"]` `[VENDOR-RESEARCH: e-warmup.com inbox-placement analysis]`

**Implication:** you must measure inbox placement (GlockApps / mail-tester), not just delivery.

---

## 2. The authentication stack (the foundation)

### 2.1 SPF — Sender Policy Framework (RFC 7208)

- **What:** A TXT record at the domain apex listing IPs/hosts authorized to send for that domain. Recipients check the connecting IP against it.
- **Why it works:** Lets the recipient reject mail from unauthorized IPs claiming to be your domain. Without it, Gmail/Yahoo treat you as unauthenticated → bulk/spam. `[OFFICIAL: Google sender guidelines]`
- **Evidence:** `[OFFICIAL]` — required by Gmail & Yahoo since Feb 2024 for bulk senders (>5,000/day).
- **Impact:** **High** (table stakes — you fail without it).
- **Cost:** $0 (DNS only).
- **Trade-offs / complexity:** Low. One TXT record. Use `~all` (softfail) during warm-up, `-all` (hardfail) once stable. Watch the 10-DNS-lookup limit (RFC 7208 §4.6.4) — nested `include:` chains can break SPF silently.

```
example.com.  TXT  "v=spf1 include:_spf.google.com include:amazonses.com ~all"
```

### 2.2 DKIM — DomainKeys Identified Mail (RFC 6376)

- **What:** The sending MTA cryptographically signs selected headers + body hash with a private key; the recipient verifies against a public key in DNS at `<selector>._domainkey.<domain>`.
- **Why it works:** Proves the message wasn't tampered with in transit and authenticates the **domain**, not just the IP (so it survives forwarding). `[OFFICIAL: RFC 6376]`
- **Evidence:** `[OFFICIAL]` — required by Gmail/Yahoo 2024 rules; must be aligned with the From domain for DMARC.
- **Impact:** **High** (table stakes + the only auth that survives forwarding).
- **Cost:** $0 (generate keys with openssl).
- **Trade-offs / complexity:** Low–medium. Rotate keys annually. Use 2048-bit RSA (1024-bit is deprecated). Sign `From:Subject:Date:To:MIME-Version:Content-Type:Message-ID` and the body. MailGuard already supports app-level DKIM via `DKIM_DOMAIN`/`DKIM_SELECTOR`/`DKIM_PRIVATE_KEY`.
- **Key gotcha for `@gmail.com` From:** you **cannot** publish a DKIM record for `gmail.com` — Google owns it. Gmail applies its own DKIM. So app-level DKIM is only useful with a **custom From domain**.

### 2.3 DMARC — Domain-based Message Authentication, Reporting & Conformance (RFC 7489)

- **What:** A TXT record at `_dmarc.<domain>` that ties SPF and DKIM together via **identifier alignment** and specifies a policy (`none`/`quarantine`/`reject`) plus a reporting address (`rua`).
- **Why it works:** Recipients enforce your stated policy on mail that fails SPF+DKIM alignment, and send you aggregate (RUA) + forensic (RUF) reports. `[OFFICIAL: RFC 7489]`
- **Evidence:** `[OFFICIAL]` — Gmail/Yahoo require a DMARC record published for the From domain since Feb 2024 (even `p=none` satisfies the rule, but `p=quarantine`/`reject` is the goal).
- **Impact:** **High** (required; also the gate for BIMI).
- **Cost:** $0 (DNS) + optional $ for a RUA analyzer (Postmark, dmarcian, Red Sift).
- **Alignment modes:** `aspf=` and `adkim=` — `relaxed` (default, allows subdomain match) vs `strict` (exact match). **Use relaxed** unless you have a specific reason; strict breaks legitimate subdomain setups. `[COMMUNITY: Reddit r/DMARC]` `[ESP-GUIDE: Valimail, Mimecast]`
- **Ramp:** `p=none` (monitor) → `p=quarantine` → `p=reject`. Review RUA reports at each step.

```
_dmarc.example.com.  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; adkim=r; aspf=r; fo=1"
```

### 2.4 BIMI — Brand Indicators for Message Identification

- **What:** Publishes where your logo lives (SVG) so participating mailboxes (Gmail, Fastmail, Yahoo, others) display it next to your messages. Requires a VMC (Verified Mark Certificate, ~$1,500–3,000/yr from DigiCert/Entrust) for the blue-checkmark in Gmail; a CMC (Common Mark Certificate, cheaper) now exists for lower tiers.
- **Why people think it helps:** brand recognition → higher open rates → better engagement → better reputation. `[VENDOR-RESEARCH: Red Sift claims 4–6% higher open rates]`
- **The truth on deliverability:** **BIMI does NOT directly improve inbox placement.** It is a *security/trust* standard, not a deliverability one. Quoting Mailgun's *State of Email 2025*: "BIMI does not directly impact deliverability or do anything to authenticate your emails." `[VENDOR-RESEARCH: Mailgun State of Email 2024/2025]` `[COMMUNITY: Reddit r/Emailmarketing — "None of these things (BIMI, DMARC, DKIM, SPF) are intended to improve your deliverability. All of them are intended to improve your security."]` Confirmed by mailwarm.com: "a VMC assures reputable logo display and a Gmail checkmark, it does not guarantee inbox placement."
- **Impact on *inbox placement*:** **None directly.** Indirect/low via engagement lift.
- **Cost:** High ($1.5K–3K/yr VMC + trademark registration required).
- **Trade-off:** Worth it for established brands that already have good reputation; pointless for a new sender with reputation problems. Requires DMARC `p=quarantine` or `reject` first.

### 2.5 ARC — Authenticated Received Chain (RFC 8617)

- **What:** Preserves authentication results across forwarding/mailing-list hops so a forwarded message that would fail DMARC (because the forwarder modified it) can still be evaluated.
- **Why it's irrelevant for OTP:** OTP mail is **direct** (you → recipient MTA), not forwarded through mailing lists. ARC matters for newsletters/forwarders, not transactional direct mail.
- **Status:** IETF is winding down the ARC experiment due to low adoption. `[VENDOR-RESEARCH: Red Sift, "IETF calls for end of ARC experiment"]`
- **Impact:** **None** for your use case. Skip it.

### 2.6 MTA-STS (RFC 8461) + TLS-RPT (RFC 8460)

- **What:** MTA-STS tells senders "only deliver to my MX over valid TLS, never downgrade to plaintext." TLS-RPT is the reporting channel for TLS failures.
- **Why it matters:** Transport security, **not** deliverability. But a misconfigured MTA-STS in `enforce` mode can *hurt* your inbound delivery if your TLS cert lapses. `[COMMUNITY: jamieweb.net]`
- **Impact on OTP sending:** **None** (you're the sender; MTA-STS is published by the *receiving* domain). Relevant only if you run your own inbound MX.
- **Skip for OTP sending.**

---

## 3. Reputation (the long game)

Reputation is the single biggest determinant of inbox placement once auth passes. It is built slowly and lost quickly. `[OFFICIAL: Google Postmaster Tools docs]`

### 3.1 Domain reputation vs IP reputation

- **Gmail** moved to **domain-centric** reputation and deprecated IP-reputation reporting in Postmaster Tools v1. `[VENDOR-RESEARCH: badsender.com, "Gmail no longer tracks IP reputation and domains" (Postmaster Tools v1 sunset)]` Your From domain's reputation now dominates at Gmail.
- **Microsoft (Outlook/M365)** still weights **IP reputation heavily** (SNDS is IP-centric). `[OFFICIAL: Microsoft SNDS]`
- **Yahoo/AOL** uses domain reputation (Verizon/Yahoo Sender Hub emphasizes From-domain alignment).
- **Implication:** you need to manage *both* — a clean domain (Gmail/Yahoo) and a clean IP (Outlook).

### 3.2 Dedicated IP vs shared IP

- **Dedicated IP:** your reputation alone, full control, but you must warm it and sustain minimum volume or reputation decays. **Minimum viable volume: ~50,000 emails/week** (Customer.io docs); Salesforce Marketing Cloud cites 250K+/month. `[ESP-GUIDE: Customer.io, Litmus, Salesforce]`
- **Shared IP:** you inherit the pool's reputation. Bad for high-volume (one bad neighbor hurts you), **good for low/variable volume** because the pool is always warm.
- **For OTP at startup volume (<50K/week): use shared IP.** A dedicated IP you can't keep warm is worse than shared. `[ESP-GUIDE: Litmus — "If your send volume has fluctuations, a shared IP will be better"]`

### 3.3 Domain age & warming

- New sending domains skip warm-up → ~80% spam rate. `[VENDOR-RESEARCH: moderninbound.com 14-day protocol data]`
- **30-day ramp:** start 5–10/day, +10–15%/day, monitor spam rate in Postmaster Tools. `[ESP-GUIDE: Postmark "How to warm up a domain"; Mailgun; MailerCheck; SMTP2GO]`
- OTP volume is naturally low per-recipient, which helps — but a sudden burst to a cold domain still gets throttled. Pre-warm before a product launch.

### 3.4 Sending frequency & reputation management

- Consistent daily volume > bursty sends. ISPs flag sudden spikes as suspicious. `[ESP-GUIDE: Mailgun warm-up guide]`
- Honor unsubscribes and bounces instantly. Every send to a dead address damages reputation.
- Keep spam-complaint rate <0.1% (target), <0.3% (Gmail's hard threshold). `[OFFICIAL: Gmail sender guidelines]`

### 3.5 Separate transactional from marketing mail

- **Use a subdomain** for transactional mail (e.g. `auth@mail.example.com` vs `newsletter@example.com`). Isolates reputation: a marketing misstep won't drag your OTP delivery down.
- `[ESP-GUIDE: Postmark, Mailgun, SparkPost all recommend this]` — Postmark's entire product is built on transactional-only streams for this reason.

---

## 4. Content & structure (what the ML scores)

### 4.1 Subject line

- **Best practice (consensus across ESPs + observed patterns):** brand-prefixed, descriptive, no code, no ALL-CAPS, no exclamation marks.
- **OpenAI's actual subject:** `"OpenAI - Verify your email"` `[COMMUNITY: loops.so examples]` — clean, brand-first, no code.
- **GitHub, Stripe, Discord** all follow the same pattern: `"<Brand> - <Action>"` or `"<Action> - <Brand>"`, plain text, no emoji, no code in subject.
- **Why no code in subject:** (a) some filters flag numeric-code patterns as spammy; (b) the code leaks onto lock-screen previews, which is a minor security issue. `[COMMUNITY: Postmark, Mailgun best practices]`
- **Impact:** Medium (subject affects open rate, which feeds reputation; weak direct deliverability effect).

### 4.2 HTML vs plain text — use BOTH (multipart/alternative)

- **The answer is not "plain text wins."** The answer is **multipart/alternative with a complete plain-text part and an HTML part.** `[ESP-GUIDE: Litmus, SendCheckit, Mailflow Authority — "Every HTML email should include a plain text version using multipart/alternative. This isn't optional — it's a deliverability signal."]` `[OFFICIAL-ish: RFC 2046]`
- Plain-text-only is no longer a meaningful deliverability boost at Gmail (its ML is content-agnostic on format), BUT some filters (SpamAssassin, corporate gateways) still penalize HTML-only. Including both costs nothing.
- MailGuard already does this (sends both `text` and `html`).

### 4.3 MIME structure

- `Content-Type: multipart/alternative` with a `text/plain` part and a `text/html` part. Both must contain the **same message** (RFC 2046 §5.1.4 — "the entities are alternative forms of the same data"). `[OFFICIAL: RFC 2046]` `[COMMUNITY: Word to the Wise]`
- UTF-8 throughout.
- Don't nest multipart weirdly.

### 4.4 Headers that influence deliverability

| Header | RFC | Purpose | Impact | In MailGuard? |
| --- | --- | --- | --- | --- |
| `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` | RFC 2369 / RFC 8058 | **Mandatory** for Gmail bulk senders since June 2024. Gmail/Yahoo show an Unsubscribe button. Treats you as legit. | **High** | ✅ |
| `Auto-Submitted: auto-generated` | RFC 3834 | Tells auto-responders not to reply (suppresses OOF noise, reduces reputation-damaging reply loops). | Medium | ✅ |
| `X-Auto-Response-Suppress: All` | Microsoft convention | Suppresses Exchange OOF/auto-replies. | Medium (Outlook) | ✅ |
| `Reply-To` | RFC 5322 | A monitored inbox. Bounces/replies go somewhere real. | Low–Medium | ✅ |
| `Message-ID` | RFC 5322 | Required for threading; some filters penalize missing it. Nodemailer auto-generates. | Low (table stakes) | ✅ |
| `Date` | RFC 5322 | Required. Missing/wrong → instant spam. Nodemailer auto-sets. | Low (table stakes) | ✅ |
| `Precedence: bulk` | Legacy | Some use for transactional; controversial. Skip — `Auto-Submitted` is the modern equivalent. | Negligible | n/a |
| `Return-Path` (envelope sender) | RFC 5321 | Where bounces go. Should match your domain for DMARC alignment. ESP-managed. | Medium | ✅ (via ESP) |

`[OFFICIAL: RFC 8058 — Gmail requires one-click unsubscribe]` `[ESP-GUIDE: Mailgun RFC 8058 guide]` `[OFFICIAL: RFC 3834]`

### 4.5 Promotions-tab avoidance (Gmail-specific)

Gmail's tab classification is an ML model with **hundreds of signals**, not a rule list. `[COMMUNITY: Suped, MailSlurp]` However, observed patterns:

- **Transactional OTP mail usually goes to Primary by default** — because it's one-to-one, recipient-initiated, short, no marketing content, no images, no "unsubscribe from our newsletter" framing. `[ESP-GUIDE: wpmailsmtp, groupmail — "Plain text emails or minimally formatted messages consistently reach the Primary tab more frequently than heavily designed promotional emails."]`
- **What pushes mail to Promotions:** heavy HTML, many images, discount codes, "buy now" language, multiple CTAs, marketing unsubscribe framing, JSON-LD Promotions-tab annotations (those are *for* marketing). `[OFFICIAL: Google Developers — Promotions-tab annotations are explicitly a marketing feature]`
- **Action:** keep OTP HTML minimal, single-purpose, no marketing. MailGuard's template already does this.

### 4.6 What to AVOID (content red flags)

- Tracking pixels / open-beacons on OTP mail — adds no value (the user *will* open it) and some privacy-focused filters penalize them.
- Remote images — many clients block by default; adds no value for OTP.
- Lots of links (>3) — spam signal.
- Spam words: FREE, GUARANTEE, CLICK HERE, all-caps, excessive `!`, `$` amounts.
- White-on-white text (instant spam trigger).
- Attachments (OTP mail should never have them).
- HTML-only (no plain text part).

---

## 5. Provider-specific behaviors

### 5.1 Gmail

- **2024 bulk-sender requirements** (>5,000/day to Gmail): SPF + DKIM + DMARC, spam rate <0.3% in Postmaster Tools, RFC 8058 one-click unsubscribe. `[OFFICIAL: Google sender guidelines]` Non-compliance → bulked or rejected.
- **Reputation is now domain-centric** (Postmaster Tools v1 IP-reputation sunset). `[VENDOR-RESEARCH: badsender.com]`
- **Tab classification:** ML-based, transactional mail generally goes Primary. `[COMMUNITY]`
- **MPP-adjacent:** Google is rolling out similar privacy features; open-rate telemetry increasingly unreliable.
- **Monitoring:** Google Postmaster Tools (free) — spam rate, domain/IP reputation, auth success, delivery errors. `[OFFICIAL: gmail.com/postmaster]`

### 5.2 Outlook / Microsoft 365

- **SmartScreen is dead** (deprecated 2020s); replaced by **Exchange Online Protection (EOP)** + Defender for Office. `[OFFICIAL: Microsoft Tech Community blog]`
- **IP reputation is still heavily weighted** — SNDS is IP-centric. `[OFFICIAL: Microsoft SNDS]`
- **Junk Email Reporting Program (JMRP):** free, gives you feedback when Outlook users mark your mail as junk. `[OFFICIAL: Microsoft JMRP]`
- **Delist portal:** if your IP gets blocked, request removal at the Microsoft Anti-Spam IP Delist Portal. `[OFFICIAL: Microsoft Q&A]`
- **Tendency:** Outlook is *stricter* than Gmail for new senders. Plan for longer warm-up. `[COMMUNITY: r/emaildeliverability]`

### 5.3 Yahoo / AOL

- **Feb 2024 requirements** mirror Gmail's: SPF + DKIM + DMARC (even `p=none` satisfies), one-click unsubscribe. `[OFFICIAL: Yahoo Sender Hub]`
- Domain-reputation-centric.
- Generally less aggressive than Gmail/Outlook once auth passes.

### 5.4 Apple Mail / iCloud

- **Mail Privacy Protection (MPP)** (iOS 15+, macOS Monterey+): pre-fetches mail content and fires the tracking pixel *whether or not the user opens it*. `[OFFICIAL: Apple; Mailchimp FAQ]`
- **Effect on deliverability:** none directly — MPP doesn't change *whether* mail lands in the inbox. `[VENDOR-RESEARCH: Validity — MPP affects open-rate measurement, not placement]`
- **Effect on metrics:** open rates are inflated/unreliable for Apple Mail users (50%+ of opens per Litmus market share). Stop using open rate as a reputation proxy for that segment; use clicks, replies, "mark not spam" instead.
- **iCloud** mail uses standard SPF/DKIM/DMARC.

### 5.5 Proton Mail

- Standard SPF/DKIM/DMARC enforcement; supports custom domains with full auth. `[OFFICIAL: Proton support]`
- Bayesian + user-trained personal filter. `[OFFICIAL: Proton blog]`
- Small user base relative to Gmail/Outlook; not a primary optimization target, but compliant auth handles it.

---

## 6. Infrastructure: SMTP providers compared

Self-hosted Postfix on a VPS is the *cheapest* path but the *worst* for deliverability at low volume — you inherit a fresh IP with no reputation, no warm pool, and you must manage PTR/blocklists yourself. A managed ESP shares a warm, monitored IP pool with strong aggregate reputation.

| Provider | Deliverability | Cost | DX | Best for |
| --- | --- | --- | --- | --- |
| **Postmark** | Excellent (transactional-only streams) | $$ ($15/mo base + per-email) | Good | Best deliverability for pure transactional `[ESP-GUIDE: Postmark, buildmvpfast]` |
| **Amazon SES** | Very good (shared warm pool) | $ (cheapest at scale, $0.10/1K) | Medium | Cost at scale `[COMMUNITY: Reddit r/webdev benchmarks]` |
| **Resend** | Very good | $$ | Excellent | Developer experience `[ESP-GUIDE: buildmvpfast]` |
| **Mailgun** | Good | $$ | Good | General-purpose |
| **SendGrid** | Good (declined reputation in recent years per community) | $$ | Good | Legacy/market share |
| **SparkPost** | Very good | $$ | Good | Analytics |
| **Gmail SMTP (App Password)** | Poor for transactional (free-webmail From signal) | $0 | n/a | Testing only |
| **Self-hosted Postfix** | Poor at low volume (cold IP) | $ (VPS cost) | Low | Full control; Architecture C |

`[VENDOR-RESEARCH: Mailtrap 2026 transactional comparison, buildmvpfast, mailertogo, pingram]` `[COMMUNITY: Reddit r/webdev benchmarks]`

**Recommendation:** for production OTP at $0 budget, **Amazon SES free tier** (62K emails/yr free from EC2-Lambda, or 3.5M/mo from SES-only if you can get out of the sandbox) is the best deliverability-per-dollar. Postmark if you can spend $15/mo for the best pure-transactional reputation.

**Gmail SMTP limitation (your current setup):** sending FROM `@gmail.com` is a documented spam signal for transactional mail — you can't publish DKIM/DMARC for `gmail.com`. Acceptable for testing/low-volume; move to a custom domain via SES/Postmark for production.

---

## 7. Monitoring & testing

| Tool | What it does | Cost | When |
| --- | --- | --- | --- |
| **Google Postmaster Tools** | Gmail domain reputation, spam rate, auth, delivery errors | Free | Always-on |
| **Microsoft SNDS** | Outlook IP reputation, complaint rate, spam-trap hits | Free | Always-on |
| **Microsoft JMRP** | Forwarded complaint feedback from Outlook users | Free | Always-on |
| **mail-tester.com** | Content + auth score (0–10) to a single test address | Free (3/day) | Every code/template change |
| **GlockApps** | Real inbox-placement % across Gmail/Outlook/Yahoo/Apple | Paid ($25+/mo) | Pre-launch + periodic |
| **Litmus / Email on Acid** | Render preview + spam-filter checks | Paid ($99+/mo) | Template work |
| **dmarcian / Postmark DMARC / Red Sift OnDMARC** | RUA report parsing | Freemium | Always-on |
| **MXToolbox / dig** | DNS record verification | Free | After DNS changes |

`[VENDOR-RESEARCH: mailflowauthority, wpmailsmtp tool reviews]` `[COMMUNITY: Reddit r/Emailmarketing "which tool to trust"]`

---

## 8. Rate limiting & retry strategy

### 8.1 Per-recipient send rate limiting (already in MailGuard)

- 3 sends/min/email, 10/hour/email. Prevents a single user from burning your reputation. `[matches Gmail's own guidance against bursts]`

### 8.2 SMTP retry policy (RFC 5321 §4.5.4.1)

- **4xx responses (transient — 421, 450, 451, 452):** retry with **exponential backoff**. Typical schedule: 5min → 30min → 2hr → 6hr → 24hr, up to ~72hr. `[OFFICIAL: RFC 5321]` `[ESP-GUIDE: Courier, InboxKit, mailertogo]`
- **5xx responses (permanent — 550, 551, 553):** do NOT retry. Suppress the address (it's invalid or blocked). Retrying a 550 (mailbox doesn't exist) damages your reputation. `[COMMUNITY: InboxKit]`
- **Connection failures:** treat as transient, retry.
- **Managed ESPs handle this for you.** If self-hosting Postfix, configure the queue lifetime (default 5d) and don't custom-retry on top.

---

## 9. Alternative & complementary verification channels

If email deliverability is the constraint, **diversify the channel** so a single failure mode can't block a user.

| Channel | Deliverability | Cost | Security | UX | When to use |
| --- | --- | --- | --- | --- | --- |
| **Email OTP** | Medium (dependent on this whole doc) | $0–low | Medium (phishable) | Familiar | Default primary |
| **Magic link (email)** | Same as email OTP | $0–low | Medium (token must be single-use, short TTL) | One-click | Conversion-friendly alt to OTP |
| **TOTP authenticator app (RFC 6238)** | Perfect (no channel — offline) | $0 | High (phishing-resistant vs OTP, shared secret) | Requires setup | MFA upgrade; recurring users |
| **Passkeys / WebAuthn (FIDO2)** | Perfect (no channel) | $0 | Highest (phishing-resistant, no shared secret) | Best (biometric) | New-build default for returning users |
| **SMS OTP** | High (~98% delivery) | $$ (per-message) | Low (SIM-swap, SS7) | Familiar | Fallback when email fails |
| **Push notification (app)** | High (if app installed) | $0–low | High | Best for returning users | Users with your app |

`[VENDOR-RESEARCH: Arkesel, Authgear, LoginRadius, MojoAuth comparisons]`

**Recommended architecture:** Email OTP as primary → on second successful login, offer TOTP/passkey enrollment → SMS as emergency fallback (rate-limited, paid). This is the pattern GitHub, Google, and Microsoft converged on.

---

## 10. Real-world patterns (what big companies do)

Examining actual verification emails `[COMMUNITY: loops.so/examples]`:

- **OpenAI:** subject `"OpenAI - Verify your email"`. Clean, concise, brand-first.
- **GitHub:** `"Verify your email address"` with `noreply@github.com`. Plain-text-feeling, minimal HTML.
- **Stripe:** `"<amount> receipt from <brand>"` style — descriptive, no code in subject.
- **Discord:** brand-prefixed, code in a prominent box, minimal HTML.

**The common thread:** minimal, single-purpose, brand-prefixed subject, no marketing chrome, plain-text-friendly HTML, one clear CTA. This is the opposite of marketing email and is *why* it lands in Primary. MailGuard's hardened template follows this pattern.

---

## 11. Common myths that don't work (or not how you think)

| Myth | Reality | Source |
| --- | --- |--- |
| BIMI improves inbox placement | No — it's a security/trust standard. Mailgun State of Email: "BIMI does not directly impact deliverability." | `[VENDOR-RESEARCH: Mailgun]` |
| Plain-text always beats HTML | No — multipart/alternative is the answer; HTML-only is bad, plain-text-only is neutral at Gmail | `[ESP-GUIDE: Litmus, SendCheckit]` |
| "Add to contacts" fixes deliverability | True for *that one user*, not scalable — and you said you can't ask | `[COMMUNITY]` |
| Adding many unsubscribe links helps | The RFC 8058 one-click *header* is what matters, not in-body links | `[OFFICIAL: RFC 8058]` |
| White-on-white keyword stuffing works | Instant spam trigger | `[COMMUNITY]` |
| Delivery rate = inbox placement | False — `250 OK` ≠ inbox. Measure inbox placement separately | `[VENDOR-RESEARCH: Litmus, e-warmup]` |
| SPF `-all` hardfail hurts deliverability | False — `-all` is correct and signals you're serious about auth | `[OFFICIAL: Google]` |
| Dedicated IP is always better | False — below ~50K/week it's worse (can't keep warm) | `[ESP-GUIDE: Litmus, Customer.io]` |
| Hiding your code in an image helps | False — image-only OTP is bad for accessibility, blocked images, and some filters | `[COMMUNITY]` |

---

## 12. Trusted-sender programs & reputation services

There is **no pay-to-skip-spam** program. The legitimate programs are **diagnostic**, not preferential:

- **Google Postmaster Tools** — monitoring only. `[OFFICIAL]`
- **Microsoft SNDS + JMRP + Delist Portal** — monitoring + complaint feedback + self-service delist. `[OFFICIAL]`
- **Return Path / Validity Sender Score** — commercial reputation scoring (a number 0–100). Widely referenced but not a "whitelist." `[VENDOR]`
- **DNSWL** (Swiss-based public whitelist) — free to apply; some filters consult it. Low impact. `[VENDOR]`
- **BIMI/VMC** — trust signal, not a placement boost (see §2.4).

---

## 13. Prioritized action plan (ranked by ROI = impact ÷ effort)

### Tier 0 — Table stakes (fail without these)

| # | Action | Impact | Effort | Cost |
|---|--------|--------|--------|------|
| 1 | **SPF** record on sending domain (`include:` your ESP) | High | 5 min | $0 |
| 2 | **DKIM** signing (ESP-managed or app-level via MailGuard `DKIM_*`) | High | 15 min | $0 |
| 3 | **DMARC** record (`p=none` to start, ramp to `quarantine`) | High | 10 min | $0 |
| 4 | **RFC 8058 one-click List-Unsubscribe** header (already in MailGuard) | High | 0 | $0 |
| 5 | **Multipart/alternative** (text + HTML — already in MailGuard) | Medium | 0 | $0 |

### Tier 1 — Highest ROI (do these next)

| # | Action | Impact | Effort | Cost |
|---|--------|--------|--------|------|
| 6 | **Move From off `@gmail.com`** to a custom domain you control | **Very High** | 1 hr | $10/yr domain |
| 7 | **Switch SMTP from Gmail to a managed ESP** (SES free tier or Postmark $15/mo) | **Very High** | 2 hrs | $0–15/mo |
| 8 | **Use a transactional subdomain** (`auth@example.com` not `hello@example.com`) to isolate reputation | High | 30 min | $0 |
| 9 | **Register + verify Google Postmaster Tools** and **Microsoft SNDS/JMRP** | High | 30 min | $0 |
| 10 | **Warm the domain** (30-day ramp; OTP naturally low-volume helps) | High | 1 hr planning | $0 |
| 11 | **Clean subject line** (brand-prefixed, no code — already in MailGuard) | Medium | 0 | $0 |

### Tier 2 — Medium ROI

| # | Action | Impact | Effort | Cost |
|---|--------|--------|--------|------|
| 12 | DMARC ramp `none` → `quarantine` → `reject` after 30d clean RUA reports | High | 1 hr | $0 (+optional analyzer) |
| 13 | Test with **mail-tester.com** after every template change (aim 9–10) | Medium | 10 min | $0 |
| 14 | Run **GlockApps** inbox-placement test pre-launch | High | 1 hr | $25/mo |
| 15 | Configure **SMTP retry/backoff** (or use an ESP that handles it) | Medium | 1 hr | $0 |
| 16 | DKIM **key rotation** policy (annual) | Low | 30 min | $0 |
| 17 | Add a monitored **Reply-To** (already in MailGuard) | Low | 0 | $0 |

### Tier 3 — Advanced optimizations

| # | Action | Impact | Effort | Cost |
|---|--------|--------|--------|------|
| 18 | **BIMI + VMC** (only after DMARC `p=quarantine`+ and established reputation) | Low (deliverability) / Medium (brand) | 1 day + paperwork | $1.5K–3K/yr |
| 19 | **Dedicated IP** (only if >50K/week sustained) | Medium | 2 hrs + ongoing | $30+/mo |
| 20 | **DMARC RUA analyzer** (dmarcian / Red Sift / Postmark DMARC) | Medium | 1 hr | Freemium |
| 21 | Separate **promotional subdomain** so marketing never touches auth@ | Medium | 30 min | $0 |
| 22 | **Inbox-placement monitoring** in CI (GlockApps API / Mailtrap) | Medium | 1 day | Paid |
| 23 | **Passkey / WebAuthn** enrollment on second login to reduce email reliance long-term | High (strategic) | 2–3 days | $0 |

---

## 14. Things that are impossible regardless of optimization

Be honest about these — don't waste cycles chasing them:

1. **Guaranteeing 100% inbox placement.** Filters are probabilistic ML models with per-user personalization. Even Microsoft's own transactional mail occasionally lands in spam. Target ≥95% inbox placement, not 100%. `[VENDOR-RESEARCH: Mailgun State of Email]`
2. **Defeating Apple Mail Privacy Protection's effect on open-rate telemetry.** MPP pre-fetches and fires the pixel regardless of user action. You cannot distinguish a real open from a pre-fetch. Stop using open rate as a reputation signal for Apple Mail users; use clicks/replies/mark-not-spam. `[OFFICIAL: Apple]`
3. **Forcing a message into the Gmail Primary tab.** Tab classification is an opaque ML model. You can *bias* it (minimal HTML, no marketing signals) but not *guarantee* it. `[COMMUNITY: Suped, MailSlurp]`
4. **Publishing SPF/DKIM/DMARC for a domain you don't own** (e.g. `gmail.com`). You inherit the owner's auth posture. `[OFFICIAL: RFC 7208/6376/7489]`
5. **Bypassing a recipient's personal filter** (rules, "always mark as spam"). No sender-side optimization overcomes a user manually filtering you. This is *why* you can't rely on asking them to whitelist — but it also means a determined recipient can always sink you.
6. **Instant reputation on a new domain/IP.** Warming takes weeks; there is no paid shortcut. `[ESP-GUIDE: Postmark, Mailgun, MailerCheck]`
7. **Reliable deliverability from `@gmail.com`/`@outlook.com`/`@yahoo.com` From addresses for transactional mail.** Free-webmail From is a structural spam signal you cannot fully overcome. `[COMMUNITY: broad consensus]`
8. **Avoiding all blocklists forever.** Even clean senders hit a spam trap eventually. The answer is monitoring (SNDS/Postmaster) + fast remediation, not prevention.

---

## 15. Appendix

### 15.1 DNS record templates (for `example.com` sending via Amazon SES)

```
; SPF (10-lookup limit aware)
example.com.              TXT  "v=spf1 include:amazonses.com -all"

; DKIM (3 keys for rotation — SES convention)
abcdefghijk._domainkey.example.com.  CNAME  abcdefghijk.dkim.amazonses.com
lmnopqrstuvw._domainkey.example.com.  CNAME  lmnopqrstuvw.dkim.amazonses.com
zyxwvutsrqpo._domainkey.example.com.  CNAME  zyxwvutsrqpo.dkim.amazonses.com

; DMARC
_dmarc.example.com.       TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; adkim=r; aspf=r; fo=1"

; BIMI (optional, after p=quarantine)
default._bimi.example.com.  TXT  "v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem"
```

### 15.2 Verification commands

```bash
dig +short TXT example.com                       # SPF
dig +short TXT <selector>._domainkey.example.com # DKIM public key
dig +short TXT _dmarc.example.com                # DMARC
dig +short MX example.com                        # MX (if receiving)
dig +short A mail.example.com                    # sending IP (for PTR check)
host <ip>                                        # reverse DNS / PTR
```

### 15.3 Reading Gmail's "Show original"

Open the received email in Gmail → ⋮ → Show original → check the `Authentication-Results` header:

```
Authentication-Results: mx.google.com;
   dkim=pass header.i=@example.com header.s=abcdefghijk;
   spf=pass (mailfrom: bounce@example.com) smtp.mailfrom=bounce@example.com;
   dmarc=pass (p=quarantine dis=none) header.from=example.com
```

All three must say `pass` and the domains must **align** (the `header.from=` domain must match the DKIM `header.i=` domain and the SPF `mailfrom` domain for DMARC alignment).

### 15.4 SMTP retry pseudo-config (if self-hosting; managed ESPs do this for you)

```
# Postfix main.cf
maximal_queue_lifetime = 3d
minimal_backoff_time   = 300s    # 5 min
maximal_backoff_time   = 6h
bounce_queue_lifetime  = 3d
```

The exponential schedule is then automatic. For app-level retry on 4xx, a simple loop:

```ts
const delays = [5*60_000, 30*60_000, 2*3600_000, 6*3600_000, 24*3600_000];
for (const d of delays) {
  try { await send(); break; }
  catch (e) { if (is5xx(e)) throw e; await sleep(d); }
}
```

---

## Sources cited (selection)

- `[OFFICIAL]` Google, "Email sender guidelines" — support.google.com/mail/answer/81126
- `[OFFICIAL]` Yahoo Sender Hub — senders.yahooinc.com/best-practices
- `[OFFICIAL]` Microsoft, "Anti-spam protection in Defender for Office 365" — learn.microsoft.com
- `[OFFICIAL]` Microsoft, "Deprecating SmartScreen in Outlook and Exchange" — techcommunity.microsoft.com
- `[OFFICIAL]` Microsoft SNDS / JMRP — substrate.office.com/ip-domain-management-snds
- `[OFFICIAL]` Apple Mail Privacy Protection — apple.com, Mailchimp FAQ
- `[OFFICIAL]` Proton, "Anti-spoofing for custom domains" — proton.me/support
- `[OFFICIAL]` RFC 5321 (SMTP), RFC 7208 (SPF), RFC 6376 (DKIM), RFC 7489 (DMARC), RFC 8058 (one-click unsubscribe), RFC 8461 (MTA-STS), RFC 8460 (TLS-RPT), RFC 8617 (ARC), RFC 3834 (Auto-Submitted), RFC 2046 (MIME)
- `[ESP-GUIDE]` Postmark — "How to warm up a domain", "Transactional email providers"
- `[ESP-GUIDE]` Mailgun — "Domain warm-up", "RFC 8058", *State of Email 2024/2025*
- `[ESP-GUIDE]` Litmus — "Dedicated vs shared IP", "Plain text emails"
- `[VENDOR-RESEARCH]` Validity — "Mystery of declining open rates" (MPP)
- `[VENDOR-RESEARCH]` Red Sift — "IETF end of ARC experiment", BIMI guide
- `[VENDOR-RESEARCH]` Dmarcian, PowerDMARC, EasyDMARC, MxToolbox — protocol explainers
- `[VENDOR-RESEARCH]` Mailtrap, buildmvpfast, mailertogo, pingram — ESP comparisons
- `[VENDOR-RESEARCH]` GlockApps, mail-tester, Mailflow Authority — testing tools
- `[COMMUNITY]` Reddit r/emaildeliverability, r/Emailmarketing, r/DMARC, r/webdev
- `[COMMUNITY]` Loops.so — "Account verification email examples" (OpenAI et al.)
- `[COMMUNITY]` Word to the Wise (Laura Atkins), Spam Resource

---

*This document complements [`EMAIL-DELIVERABILITY.md`](./EMAIL-DELIVERABILITY.md) (the practical fix-it guide) and [`UPGRADE-TO-SELFHOSTED.md`](./UPGRADE-TO-SELFHOSTED.md) (the Architecture C migration path).*
