# YPP Portal — Conversion Rate Audit & Redesign Plan

Scope: instructor application, summer workshop application, workshop proposal flow, onboarding, mentorship questions. Stack: Next.js + Supabase + Vercel. Goal: more students/instructors **start** and **finish** the application.

---

## 1. Brutal Conversion-Rate Audit

The portal currently behaves like a job application, not a youth program. The instructor flow alone asks for **~25 fields across 5 steps**, with **6+ essay-style textareas**, before an applicant has any signal of fit. The summer-workshop track piles **8 more textareas** inside a single "Teaching" step — a wall of empty white boxes is the single biggest abandonment trigger in the product.

Top systemic issues:

- **Essays-before-engagement.** Course outline, first-class plan, workshop hook, backup plan, adapting-on-the-fly — all required, all before account confirmation feels "worth it."
- **Two parallel proposal flows.** Summer-workshop applicants write a workshop outline at signup (8 fields) and then write it *again* in Workshop Design Studio (13 fields). Massive redundancy.
- **Required ≠ essential.** Phone, DOB, ZIP, country, graduation year, hours/week, interview availability are all front-loaded. None of them affect first-pass review.
- **Formal voice.** "Walk us through the most relevant teaching, tutoring, coaching, camp, or mentoring experience…" reads like a job posting, not a youth program.
- **No micro-rewards.** Progress stepper exists but no completion %, no "nice work", no celebratory feedback between steps.
- **Mobile hostility.** Stacked textareas with 4–6 rows each force ~30+ seconds of typing per field on a phone — the dominant device for teens.
- **Fear of rejection is invisible-ly amplified** by language like "reviewers", "evaluation", "rubric-style" prompts. Nothing tells applicants "most people get a real response within X days" or "we're hiring lots of people."

---

## 2. Biggest Drop-Off Risk Points (ranked)

1. **Step 4 "Teaching" of instructor signup** — first textarea ("Teaching experience"). This is where ~50–70% of drop-off likely happens. It's the first time the user is asked to *write*.
2. **Summer-workshop nested card (8 sub-fields).** Each textarea is a mini-essay. Users are not yet committed enough to brainstorm a curriculum.
3. **Step 5 Availability + referral emails.** Asking for "emails of people who can speak to your teaching" at signup feels like a job — referral fear.
4. **Onboarding Step 2 conditional profile form** — surprise parent email/phone request after the quiz feels bait-and-switch.
5. **Workshop Design Studio "Custom" path** — 17 fields on one page with a sidebar issue list that visibly counts "X items to finish." Demoralizing.
6. **Account step "How did you hear about YPP?"** — required-feeling conditional dropdown before the user has even started. Move to post-submit.
7. **Re-apply form** — pre-fills 25 fields on one giant page. Users see a wall, not a "5-minute update."

---

## 3. New Simplified Application Structure

Target: **5 minutes, 3 short screens, 1 optional essay**.

### Instructor / Summer Workshop — unified short application

**Screen 1 — "Tell us who you are" (30 sec)**
- First name (text)
- Email
- Password (or "Continue with Google" — see §10)
- One-tap chips: *"I want to teach…"* → `Summer workshop` · `Year-round class` · `Not sure yet`

**Screen 2 — "Your school & subject" (45 sec)**
- High school name (text, with autocomplete from prior submissions)
- Graduation year (chip selector: 2025 · 2026 · 2027 · 2028 · 2029)
- Subject(s) you'd love to teach (multi-select chips: STEM, Writing, Art, CS, Music, Math, Business, Health, Other)

**Screen 3 — "Show us a spark" (3–5 min, ONLY required text)**
- *One* prompt, your choice (radio of 3):
  - "A topic I could talk about for an hour"
  - "A time I helped someone learn something"
  - "A workshop idea I'd love to run"
- Single textarea, **150-char minimum, 600-char soft cap**, with a live char counter and "Looking great ✨" at 150.
- Optional: 60-sec video upload ("skip — totally optional").

**Screen 4 — "You're in review" (celebration)**
- Confetti / check.
- "We usually reply within 5 days. Most applicants we interview get accepted."
- Soft secondary CTA: *"Want to stand out? Add 2 more details →"* (opens the *previously required* fields as optional: phone, DOB, hours/week, availability, referrals, motivation).

Everything else (course outline, first-class plan, learning objectives, materials, backup plan, safety notes, capacity, location) moves to **post-acceptance** as the Workshop Design Studio is *already designed to handle*. The signup form should not duplicate it.

### Student onboarding — 2 screens, no quiz gate

**Screen 1 — Vibes (one tap each)**
- Topics you're into (multi-select chip cloud, no min)
- "I learn best by…" (chips)
- "Right now I want to…" (chips)
- Skip button visible from start (no penalty).

**Screen 2 — Account basics**
- Grade (chip: 6 7 8 9 10 11 12)
- School (text)
- Parent email + phone — **only if under 13 or required by program**, otherwise collected at first session signup.
- Big green "Let's go".

### Workshop Design Studio (post-acceptance only)
- Keep but break the 17-field page into **3 tabs**: Idea · Plan · Logistics. Autosave already exists; surface "Draft saved" prominently.
- Replace "Issues to finish: X" sidebar with a positive "X of Y done · 1 left to unlock submit."

---

## 4. Exact Fields to REMOVE from signup

Move to post-acceptance, optional, or admin-collected:

| Field | File ref | Why |
|---|---|---|
| Legal name | instructor signup §2 | Collect at offer letter / I-9. Preferred name is enough now. |
| Date of birth | §2 | Not needed for first-pass review. |
| Phone number | §2 | Optional after acceptance. |
| ZIP / postal code | §3 | Country + state covers regional fit. |
| Country (when only US/Other) | §3 | Default US; ask only if state autocomplete fails. |
| Course outline (textarea) | §4 STANDARD | Belongs in Design Studio. |
| First-session sketch (textarea) | §4 STANDARD | Belongs in Design Studio. |
| Workshop title / age range / duration / learning goals / activity flow / materials / engagement hook / adapting-on-the-fly (8 textareas) | §4 SUMMER | All duplicated in Workshop Design Studio. Delete from signup. |
| Optional motivation textarea | §4 | Already optional, but remove — it intimidates by *existing*. |
| Interview availability (text) | §5 | Ask via scheduling link after first-pass screen. |
| Hours per week | §5 | Ask after acceptance during scheduling. |
| Preferred start date | §5 | Ask after acceptance. |
| Referral emails | §5 | Move to optional "Boost your application" panel after submit. |
| "How did you hear about YPP?" + conditional detail | Account step | Show on the *thank-you* screen, not the entry screen. |
| Student onboarding quiz "all three required" gating | onboarding-wizard.tsx | Make every quiz answer optional; allow skip. |
| Parent email/phone in onboarding step 2 | student-steps.tsx | Move to first-session signup unless legally required. |

---

## 5. Exact Fields to MERGE / Consolidate

- **Legal name + Preferred first name → "Your name"** (single field; legal name only at offer stage).
- **City + State + ZIP + Country → "Where do you live?"** (one input with Google Places–style autocomplete, parsed server-side).
- **School name + Graduation year → "School & class"** (one row, two inline inputs).
- **Teaching experience + Motivation + Course idea → ONE "Show us a spark" prompt** with 3 radio options (see §3 Screen 3). Replace 3 textareas with 1.
- **Workshop outline (8 textareas at signup) + Workshop Design Studio form → single source of truth in Design Studio**, gated to post-acceptance.
- **Workshop Design Studio: Opening hook + Main activity + Wrap-up → "Walk through the workshop"** — one combined textarea with three light placeholders ("Hook · Main · Wrap"). Reduces 3 boxes to 1 with built-in scaffolding.
- **Backup plan + Adapting on the fly → "Plan B"** (one prompt).
- **Materials needed + Safety notes → "Anything we should bring or watch for?"** (one textarea, optional unless in-person + sharp/hot/messy keyword).
- **Onboarding quiz Q1+Q2+Q3 → one screen of chip clouds** (no per-question gating).

---

## 6. What Should Become OPTIONAL or POST-ACCEPTANCE

**Optional at signup:**
- Phone, DOB, exact city, subjects of interest, hours/week, motivation, referrals, video.

**Collected after first-pass screen (interview scheduling):**
- Interview availability, hours/week, preferred start date.

**Collected post-acceptance (during onboarding):**
- Legal name, full address, I-9 / tax info, emergency contact, training scheduling.

**Collected only when needed:**
- Parent email/phone — only at first session signup or if under 13.
- Workshop curriculum details — only inside Workshop Design Studio once accepted.

---

## 7. Suggested UX/UI Changes

- **One-question-per-screen** for the first 3 screens. Big input, single CTA, no scrolling.
- **Replace textareas with chip selectors** wherever a finite answer set exists (subjects, format, age range, duration in 30/45/60/90 min chips, capacity in 10/15/20/25/30).
- **Char-count rewards.** Live "Looking great ✨" badge appears at the minimum threshold rather than red errors. Never show a red error before the user has typed.
- **Progress as percent, not steps.** "65% done · about 2 minutes left." Inflate the early-progress feel (start at 10%, not 0%).
- **Sticky "Save & finish later" pill** on every screen — current localStorage autosave is invisible; surface it.
- **Mobile-first redesign.** All inputs full-width, 48px tap targets, no side-by-side fields, native pickers for date/grade.
- **Confetti / haptic on submit.** Cheap, hugely effective on completion screens.
- **Replace the Workshop Design Studio sidebar "Issues to finish: X"** with a positive "X done · 1 to go." Same data, opposite framing.
- **Skip is always visible** in onboarding — never trap the user.
- **Auto-advance** after chip selection (no extra "Next" tap on single-select screens).
- **Smart defaults** from social auth: pre-fill name/email; skip password if SSO.
- **Show acceptance signal early.** Tag on screen 1: *"We accept most applicants who submit. Don't overthink it."*

---

## 8. Copywriting Tone Changes

| Today | Replace with |
|---|---|
| "Walk us through the most relevant teaching, tutoring, coaching, camp, or mentoring experience…" | "Ever helped a younger kid get something? Tell us about it." |
| "Rough course outline" | "Skip — you'll plan this with us later." (deleted) |
| "Interview availability" | "We'll find a time that works — pick a slot after you submit." (deleted) |
| "Hours per week you can commit" | (deleted at signup) |
| "Emails of people who can speak to your teaching" | "Optional: drop a teacher's email if they'd hype you up." |
| "Submit application" | "Send it ✨" |
| "Your application is under review." | "You're in. We usually reply within a few days." |
| "Application denied" / "Decision" | "Not this round — here's what would help next time." |
| "Reviewer" | "YPP team" |
| "Rubric / evaluation" | "Quick read-through" |
| "How did you hear about YPP?" (required-feeling) | Move to post-submit, label "One more thing (optional)" |

Voice rules: second-person, short, warm, lowercase-ok, never "shall/must/required-by", use one emoji per screen max, no exclamation point inflation.

---

## 9. Highest-Impact Implementation Priorities

**P0 — Ship this week (biggest funnel lift, smallest code):**
1. **Make signup Step 4 (Teaching) one textarea + chip prompt selector.** Delete `courseIdea`, `courseOutline`, `firstClassPlan`, and the 8 workshopOutline fields *from the signup form* (keep DB columns; just hide them — Workshop Design Studio fills them post-acceptance). File: `app/(app)/applications/instructor/new/*` and the signup multi-step flow.
2. **Make Step 5 (Availability) entirely optional** (or delete from signup; collect via scheduling link).
3. **Move "How did you hear about YPP?" to the post-submit thank-you page.**
4. **Onboarding: remove required-all-three gate on the quiz.** Always allow "Skip for now."
5. **Copy pass** across all required-field labels using §8 table.

**P1 — Next sprint (compounding wins):**
6. Replace duration / age-range / capacity / format text inputs with chip selectors.
7. Add live char-count celebration ("Looking great ✨") and remove pre-submit red errors.
8. Surface autosave with a visible "Draft saved · resume any time" pill.
9. Convert progress stepper to percentage bar with inflated early progress.
10. Add a confetti/success state to the submit screen with realistic acceptance framing.

**P2 — Following sprint:**
11. Single-question-per-screen mobile redesign of signup screens 1–3.
12. Google/Apple SSO (skips email + password).
13. Optional 60-sec video upload.
14. Re-apply form: redesign as "What's changed?" diff view, not a 25-field wall.
15. Workshop Design Studio: tabs (Idea/Plan/Logistics) + merge redundant textareas per §5.

---

## 10. Fastest Wins (Ship Today)

Each is a small, surgical change — minutes to hours of work, no new infra:

- **Delete the 8 workshop-outline textareas from the signup `WorkshopOutline` nested card** (`SUMMER_WORKSHOP_INSTRUCTOR` track). Replace with a single sentence: *"You'll design your workshop with us after you're in."* Drops the signup from ~25 fields to ~17 instantly.
- **Make `teachingExperience` the only required textarea**, drop required from `courseIdea`, `courseOutline`, `firstClassPlan`, and `motivation`. Even better: hide them from the form entirely (keep nullable in DB).
- **Remove `interviewAvailability`, `hoursPerWeek`, `preferredStartDate`, `referralEmails` from signup** — collect via a Calendly-style scheduling page after first-pass review.
- **Make `phoneNumber`, `dateOfBirth`, `zipCode`, `country` optional**; delete the `country` select if only "US / Other" — default to US.
- **Banner copy on summer-workshop landing page**: change "Now hiring Summer Workshop Instructors — a fast-start teaching role" to *"Apply in 5 minutes. Most applicants get an interview."*
- **Submit button text** everywhere: "Submit application" → "Send it ✨".
- **Onboarding quiz**: change the validation hint to a "Skip for now →" link; remove the required gate in `student-steps.tsx`.
- **Thank-you screen**: add "We usually respond within a few days" + the "How did you hear about us?" question (single dropdown, optional).
- **Mobile**: change every `rows={4}` / `rows={5}` / `rows={6}` textarea to `rows={2}` — reduces visual weight by ~60% with zero behavior change.
- **Autosave pill**: add a small floating "Draft saved ✓" toast tied to existing localStorage save in the signup wizard — users currently don't know they can leave and return.

Estimated impact, conservative: cutting signup fields by ~40% and replacing the most-feared textarea wall typically lifts application *start→finish* conversion **2–3×** on similar youth program funnels, and lifts *visit→start* by 30–50% via the "apply in 5 minutes" framing.

---

## Out of Scope (Preserved)

- Admin scoring rubrics, review states, and decision flow — unchanged. All "removed" fields stay in the DB and are simply collected later in the lifecycle (Workshop Design Studio, scheduling page, post-acceptance onboarding). Mentor matching and workshop quality standards are preserved because the *same* curriculum data is still captured — just at the moment the applicant is bought-in instead of evaluating whether to start.
