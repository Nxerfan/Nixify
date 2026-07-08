# Email Deliverability — keeping OTP emails out of the spam folder

This document explains **why** transactional OTP emails sometimes land in spam
and exactly **what MailGuard does about it** and **what you must do** at the
DNS/account level. It covers the Gmail-SMTP path (Architecture A) and the
upgrade to a self-hosted relay on a custom domain (Architecture B/C), which is
the definitive fix.

---

## TL;DR

| Symptom | Most likely cause | Fix |
| --- | --- | --- |
| Mail lands in spam, From is `@gmail.com` | Free-webmail From address; no custom DKIM/DMARC possible | Move to a custom domain (below) OR accept Gmail's reputation for low volume |
| Mail lands in spam, From is your domain | Missing SPF / DKIM / DMARC | Set the three DNS records (below) |
| Mail lands in spam, auth passes | Content/structure, no List-Unsubscribe, new sender | Already fixed in code; warm up the account |
| `535-5.7.8 Username and Password not accepted` | Using a Gmail account password instead of an App Password | Generate a 16-char App Password (Google Account → Security → App passwords) |

---

## 1. The three pillars of sender authentication

Spam filters score every incoming message on whether the sender is who they
claim to be. Three DNS records establish that, in increasing strength:

### SPF (Sender Policy Framework) — "which IPs may send for this domain?"
A TXT record at the domain apex listing the authorized sending IPs/hosts.

```
example.com.  TXT  "v=spf1 include:_spf.google.com ~all"
```

- `include:_spf.google.com` — required when sending via Gmail SMTP.
- `~all` (softfail) is recommended during warm-up; move to `-all` (hardfail)
  once you're confident.
- Without SPF, recipient providers treat your mail as unverified → spam.

### DKIM (DomainKeys Identified Mail) — "this message was signed by this domain"
A cryptographic signature added by the sending mail server. The recipient
verifies it against a **public key** you publish in DNS.

DNS record (TXT) at `<selector>._domainkey.<domain>`:

```
mailguard._domainkey.example.com.  TXT  "v=DKIM1; k=rsa; p=MIIBIjANBgkq..."
```

`p=` is the base64 public key. Generate the keypair:

```bash
openssl genrsa -out dkim-private.pem 2048
openssl rsa -in dkim-private.pem -pubout -out dkim-public.pem
# Copy the base64 block (between the PEM headers) into the p= field.
```

**MailGuard signs outgoing mail automatically** when you set `DKIM_DOMAIN`,
`DKIM_SELECTOR`, and `DKIM_PRIVATE_KEY` (see `.env.example`). Store the private
key with literal `\n` escapes on a single line.

> ⚠️ **For `@gmail.com` From addresses, DKIM signing is pointless** — you can't
> publish a DKIM record for `gmail.com` (Google owns it). Gmail applies its own
> DKIM signature to outgoing mail. The `DKIM_*` env vars are for **custom
> domains you control**.

### DMARC — "what should the recipient do if SPF/DKIM fail?"
A TXT record at `_dmarc.<domain>` that ties SPF and DKIM together with a policy.

```
_dmarc.example.com.  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; adkim=s; aspf=s"
```

- Start with `p=none` (monitor) and review the `rua` reports, then move to
  `p=quarantine`, then `p=reject`.
- `adkim=s` / `aspf=s` = strict alignment (the From domain must match the
  DKIM/SPF domain).

> Gmail's own `_dmarc.gmail.com` is `p=none` (monitor). You can't change it.

---

## 2. The Gmail-SMTP limitation (Architecture A)

When you send FROM `nixacompany01@gmail.com` via Gmail SMTP:

- ✅ **SPF passes** — Gmail's SMTP servers are in `_spf.google.com`.
- ✅ **DKIM passes** — Gmail signs the message with a `gmail.com` DKIM key.
- ❌ **You can't publish your own DKIM/DMARC** for `gmail.com`.

So authentication *passes*, yet the mail can still go to spam because:

1. **Free-webmail From addresses are a spam signal** for transactional mail.
   Recipient providers (Gmail, Outlook, Yahoo) penalize business/transactional
   mail sent from `@gmail.com`/`@outlook.com`/`@yahoo.com` because spammers
   abuse free accounts. Legitimate transactional mail is expected to come from
   a domain the sender owns.
2. **New account, no reputation.** A brand-new Gmail account has no sending
   history; first messages are scored skeptically until recipients interact
   (open, mark not-spam, reply).
3. **Self-sends** (From == To) can trigger quirks in Gmail's own filtering.

### What MailGuard already does to mitigate this (code-level)

These are applied to **every** outgoing message regardless of transport:

- **Clean subject** — no OTP code in the subject line (avoids the spammy
  `"...is 123456"` pattern; also keeps the code off lock-screen previews).
- **Professional HTML** — table-based, inline-CSS, branded header, prominent
  code box, footer with "why you received this" + a contact-tip line. Looks
  like real transactional mail, not auto-generated spam.
- **Complete plain-text alternative** — some filters penalize HTML-only mail.
- **`List-Unsubscribe` header** (RFC 2369) + `List-Unsubscribe-Post` — Gmail
  and Yahoo show an Unsubscribe button and treat the sender as a legitimate
  mailer.
- **`Reply-To`** — a monitored address (configurable via `MAIL_REPLY_TO`).
- **`Auto-Submitted: auto-generated`** (RFC 3834) — suppresses auto-responders.
- **`X-Auto-Response-Suppress: All`** — suppresses OOF/vacation replies.

### What you must do at the account/inbox level (Gmail, today)

These are **not** code changes — they're inbox actions that build reputation:

1. **Mark the first OTP email "Not spam"** in the recipient Gmail. This is the
   fastest, most effective single action — it tells Gmail's filter this sender
   is wanted. Future codes from the same sender will land in the inbox.
2. **Add the sender to Contacts** — `nixacompany01@gmail.com` as a contact in
   the recipient account. Gmail never filters contacts to spam.
3. **Warm up the account** — send a few OTP emails per day for the first week,
   have recipients open them and mark not-spam. Don't blast volume on day one.
4. **Don't exceed Gmail's limits** — ~500/day for consumer Gmail. MailGuard's
  rate limiter (3 sends/min, 10/hour per email) keeps you well under this.
5. **Keep 2-Step Verification + the App Password active** — if you disable
   either, SMTP auth breaks.

> These steps will get Gmail-to-Gmail OTPs into the inbox reliably for
> **testing and low volume**. For a production service, move to a custom domain.

---

## 3. The definitive fix: send from a custom domain

When you own the sending domain, you can set SPF + DKIM + DMARC yourself, and
recipient providers treat your mail as a first-class sender. This is the
production-grade path and is a **pure configuration change** — no code changes.

### Option B — Gmail "Send mail as" with a custom domain (still $0/month)

Google Workspace (or even a free Gmail account with a custom domain configured
via "Send mail as") lets you send from `noreply@yourdomain.com` through Gmail's
SMTP. You publish SPF (`include:_spf.google.com`) and Google's DKIM, plus your
own DMARC. Mail is sent from Gmail's reputable IPs but your domain is the From.

Setup:
1. Own a domain. Add it to Google Workspace (or Gmail "Settings → Accounts →
   Send mail as").
2. Publish SPF: `yourdomain.com TXT "v=spf1 include:_spf.google.com ~all"`.
3. Enable DKIM in Google Workspace Admin → Apps → Gmail → Authenticate email
   (Google generates the key; you publish the TXT record).
4. Publish DMARC: `_dmarc.yourdomain.com TXT "v=DMARC1; p=quarantine; rua=mailto:you@yourdomain.com"`.
5. Set MailGuard env:
   ```
   SMTP_FROM="MailGuard <noreply@yourdomain.com>"
   SMTP_USER=nixacompany01@gmail.com   # the Gmail account you auth with
   SMTP_PASS=<app password>
   ```

### Option C — Self-hosted Postfix relay (doc Phase 7)

A VPS with Postfix, your domain, full DNS control. See
[`UPGRADE-TO-SELFHOSTED.md`](./UPGRADE-TO-SELFHOSTED.md). For this path, set
MailGuard's `DKIM_*` env vars so the app signs every message (Postfix can also
DKIM-sign via OpenDKIM, but signing in the app is simpler and tested).

```
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=mailguard
SMTP_PASS=<strong password>
SMTP_FROM="MailGuard <noreply@yourdomain.com>"
DKIM_DOMAIN=yourdomain.com
DKIM_SELECTOR=mailguard
DKIM_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----
```

And publish:
- SPF: `yourdomain.com TXT "v=spf1 ip4:<vps-ip> ~all"`
- DKIM: `mailguard._domainkey.yourdomain.com TXT "v=DKIM1; k=rsa; p=<base64>"`
- DMARC: `_dmarc.yourdomain.com TXT "v=DMARC1; p=quarantine; rua=mailto:you@yourdomain.com"`
- PTR (reverse DNS) on the VPS IP → `mail.yourdomain.com` (set with your VPS
  provider). Without PTR, many providers reject/bulk your mail.

---

## 4. Content rules (what the email itself must look like)

Spam filters also score the message body. MailGuard's renderer follows these:

- ✅ Both plain-text **and** HTML parts (multipart/alternative).
- ✅ Subject describes the message; no code/URLs in the subject.
- ✅ Branded, recognizable sender name (`MailGuard <…>`).
- ✅ Clear "why you received this" footer.
- ✅ "If you didn't request this, ignore this email" line.
- ✅ No spam trigger words ("FREE", "CLICK HERE", all-caps, excessive `!`).
- ✅ No attachments, no remote images, no tracking pixels (OTP mail should be
  lightweight and privacy-respecting).
- ✅ Inline CSS only (many clients strip `<style>` blocks).
- ✅ Physical/operational contact info is good practice (CAN-SPAM/GDPR) — add a
  real postal address in the footer for production.

---

## 5. Verifying your setup

After deploying DNS changes, verify:

- **SPF:** `dig +short TXT yourdomain.com` → shows the SPF record.
- **DKIM:** `dig +short TXT mailguard._domainkey.yourdomain.com` → shows the
  public key.
- **DMARC:** `dig +short TXT _dmarc.yourdomain.com` → shows the policy.
- **End-to-end:** send a real OTP to an address at
  [mail-tester.com](https://www.mail-tester.com/) (free) — it scores your email
  0–10 and reports exactly which checks pass/fail. Aim for 9–10.
- **Gmail's "show original":** open the received email in Gmail → ⋮ → "Show
  original" → check `Authentication-Results`. You want `spf=pass`,
  `dkim=pass`, `dmarc=pass`.

---

## 6. What changed in this codebase (deliverability hardening)

| File | Change |
| --- | --- |
| `src/lib/mail/transport.ts` | Added `List-Unsubscribe`, `List-Unsubscribe-Post`, `Reply-To`, `Auto-Submitted`, `X-Auto-Response-Suppress` headers on every message. Added optional DKIM signing (`DKIM_DOMAIN`/`DKIM_SELECTOR`/`DKIM_PRIVATE_KEY`). |
| `src/lib/otp/verifier.ts` | Rewrote email rendering: clean subject (no code), complete plain-text body, professional table-based HTML with branded header + footer, proper escaping. |
| `.env.example` | Documented `APP_NAME`, `MAIL_REPLY_TO`, and the optional `DKIM_*` vars. |
| `docs/EMAIL-DELIVERABILITY.md` | This document. |

No application flow changed — the OTP engine, rate limiting, single-use
enforcement, and all routes are identical. Only the *email envelope and body*
were hardened.
