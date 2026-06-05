# Email Deliverability — keeping YPP mail out of spam

Portal mail (password resets, magic links, application updates, notifications,
digests) is sent through `lib/email.ts`, which supports **Resend** (default) or
**SMTP**. Whether those messages land in the inbox or the spam folder is decided
almost entirely by **how the sending domain is set up in DNS** — not by the app
code. This doc is the checklist for getting it right.

> TL;DR: verify your domain and add **SPF + DKIM + DMARC** records, send `From:`
> that verified domain (never `@resend.dev`), set a real `Reply-To`, and include
> a `List-Unsubscribe` header. The app already adds the headers for you once the
> env vars are set; the DNS records are on you.

---

## 1. Authenticate the sending domain (the #1 fix)

Spam filters trust mail that is cryptographically proven to come from your
domain. You need all three records on the domain used in `EMAIL_FROM`
(e.g. `youthpassionproject.org`).

### SPF
Authorizes which servers may send for your domain. One `TXT` record on the root:

```
v=spf1 include:_spf.resend.com ~all
```

(If you also send via Google Workspace/SMTP, include them too, e.g.
`v=spf1 include:_spf.google.com include:_spf.resend.com ~all`. Keep it to a
single SPF record.)

### DKIM
Signs each message so receivers can verify it wasn't altered. Resend gives you
DKIM `CNAME`/`TXT` records when you add a domain — paste them into DNS exactly.
For Google Workspace SMTP, generate DKIM in the Admin console and publish it.

### DMARC
Tells receivers what to do when SPF/DKIM fail, and gives you reporting. Start in
monitor mode, then tighten:

```
# TXT record at _dmarc.youthpassionproject.org
v=DMARC1; p=none; rua=mailto:dmarc@youthpassionproject.org; fo=1
```

Once reports look clean (mail is aligned and passing), move `p=none` →
`p=quarantine` → `p=reject`.

### Verify
- Resend → **Domains** must show the domain as **Verified** (green).
- Send a test to a Gmail account, open **Show original**, and confirm
  `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.
- Tools: [mail-tester.com](https://www.mail-tester.com) (aim for 10/10),
  MXToolbox SPF/DMARC checkers.

---

## 2. Use a real, verified `From` (not the test sender)

- `EMAIL_FROM` must be an address **on the verified domain**, e.g.
  `Youth Passion Project <noreply@youthpassionproject.org>`.
- `onboarding@resend.dev` / `@resend.dev` only delivers to *your own* Resend
  account address — it is for testing and will look like spam to everyone else.
  `lib/email.ts` already appends a warning to errors when it detects this.

---

## 3. Reply-To + List-Unsubscribe (handled in code, gated by env)

`lib/email.ts` automatically attaches these once you configure the env vars —
no per-call changes needed:

| Env var | Effect |
| --- | --- |
| `EMAIL_REPLY_TO` | Sets `Reply-To`. A monitored inbox is a positive trust signal. |
| `EMAIL_UNSUBSCRIBE_URL` | Adds `List-Unsubscribe` **and** one-click `List-Unsubscribe-Post` (HTTPS endpoint that accepts POST). |
| `EMAIL_UNSUBSCRIBE_MAILTO` | Adds a `mailto:` `List-Unsubscribe` target (works on its own; no endpoint needed). |

Gmail and Yahoo **require** `List-Unsubscribe` for bulk senders. Set at least
`EMAIL_UNSUBSCRIBE_MAILTO`; add `EMAIL_UNSUBSCRIBE_URL` when an unsubscribe
endpoint exists so the one-click header is emitted.

---

## 4. Content & sending hygiene

- Always send a **plaintext part** — `sendEmail` derives one from the HTML
  automatically, so keep using it rather than raw provider calls.
- Avoid spammy patterns: ALL-CAPS subjects, "FREE!!!", link shorteners,
  mismatched/huge images, single big image with no text.
- Keep a stable `From` name/address; don't rotate senders.
- **Warm up** a new domain — ramp volume gradually rather than blasting
  thousands on day one.
- Keep bounces/complaints low: don't email addresses that hard-bounce again.

---

## 5. How to test

```bash
# Inspect config + flag common problems (no send):
npm run email:check

# Send a live diagnostic and report the provider result:
npm run email:check -- --send-to you@example.com
```

Then open the received message in Gmail → **Show original** and confirm SPF,
DKIM, and DMARC all say **PASS**. If any fail, fix DNS (section 1) first — code
changes won't help until authentication passes.
