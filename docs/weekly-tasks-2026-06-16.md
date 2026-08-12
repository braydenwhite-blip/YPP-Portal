# YPP Tech Team — Weekly Tasks: June 16–20, 2026

**Focus: People Strategy — making the Action Tracker, Meetings Tracker, and Command Center genuinely great to use**

> Expected vs. Actual — copy into the tracking sheet each week:
>
> | Task | Owner | Expected by | Actual | Notes |
> |------|-------|-------------|--------|-------|

---

## Where We Are Right Now

The bones are built. We have a real operating system — meetings create decisions, decisions create actions, actions move initiatives forward, and the Command Center shows what matters. This week is about making that system feel **finished and delightful**, not just functional. We are adding the features that make people want to open the portal every day.

---

## BRAYDEN — The Engine

> The things that make the data honest. Do not let others touch these.

---

### 1. "What actually happened?" — Capture Outcomes When Work Is Done

**The problem today:** When someone marks an action complete, it just disappears. There's no record of what the result was, no note about what was learned, and no clear next step. Over time, the portal fills up with completed items that are just... gone.

**What we're building:** When someone marks an action done, a short panel slides open and asks:
- *How did it go?* — four choices: Delivered in full / Partially done / This became something else / We decided to drop it
- *What happened?* — one short sentence (optional but encouraged)
- *Should we follow up?* — a date picker for the next check-in, if needed

The same thing for BLOCKED actions — when someone marks something blocked, we ask *Why is this stuck?* so the blocker isn't just invisible.

This data already exists in the database. This week we are building the UI that collects it and shows it on the action's page.

**Why this matters:** Leadership needs to know not just what got done, but whether it actually worked. "Delivered" vs "Dropped" vs "Partial" tells a completely different story about the team's execution.

---

### 2. Feedback Reminders — Stop the Black Hole

**The problem today:** When leadership asks someone for feedback, the request goes out and then... nothing happens automatically. There's no nudge if the person hasn't responded in a week.

**What we're building:** A nightly automated check that looks at all open feedback requests, finds the ones where the due date has passed, and sends a single polite reminder email to each person who hasn't responded yet. One reminder, not spam. Stops automatically once they respond.

**Why this matters:** Right now Aveena has to manually chase people down. This should happen on its own.

---

### 3. Quarterly Review Pre-Fill from Real Evidence

**The problem today:** When leadership sits down to write a quarterly review for an instructor, they're starting from a blank page. They have to remember what that person actually did.

**What we're building:** When you open a quarterly review, the form pre-fills with a suggested paragraph based on real data — their leadership contributions, the students they've advised, the feedback that's come in, the actions they've led. It reads like: *"Brayden took ownership of the curriculum review process, supported 4 students through advising, and led 3 initiative actions to completion this quarter."* Leadership edits it, but they're not starting from nothing.

**Why this matters:** Reviews become faster to write and more grounded in actual evidence. Less "I think they did well" and more "here's what the data says."

---

### 4. Make the Help Agent Know About the People Dashboard

**The problem today:** Leadership can't search for "feedback" or "check-in" in the portal's search bar and find the People & Performance page. It's invisible to the Help Agent.

**What we're building:** Add People & Performance to the search suggestions — so typing "feedback" or "check-in" or "quarterly review" in the Help Agent surfaces the right page. Only visible to Leadership, not everyone.

---

### 5. Test the Full Loop — From Meeting to Done

At the end of the week, personally run through this full flow on staging:

- Create a meeting → add agenda → record a decision → convert it to an action → set the action as blocked with a reason → unblock it → complete it with an outcome note → open the Command Center and confirm the story is visible

This should tell one coherent story, not feel like four disconnected tools.

---

## ANTHEA — The Look and Feel

> Own how everything looks and feels. Review before anything gets called done. If it doesn't feel right, say so.

---

### 1. QA the New Command Center Workspaces

The Today / Decide / Meet / Review / Follow Up / Delegate workspaces were just shipped. Before we point Sam and Zach to them, walk through each one and flag anything that looks unfinished.

Specifically:
- Does each workspace feel like it has one clear job? Or does it feel like a list of random things?
- Does the Calm mode actually feel calm — executive, clean, less visual noise?
- Do the action cards feel clear — can you scan them in 3 seconds and know what's needed?
- Does the Follow Up workspace surface the right loose ends (things that came out of meetings but haven't been resolved yet)?
- Does the My Queue actually feel like something useful to open every morning?

Write a short list of what needs to change — even small copy issues, spacing weirdness, anything that feels off. Give each one a severity: cosmetic / confusing / broken.

---

### 2. Design the "What Happened?" Capture Panel

Brayden is building the backend for outcome capture (what we built in task #1 above). You own what it looks like.

Design how the panel feels when someone completes an action:
- It should feel lightweight and fast — not like a form to dread filling out
- The four outcome choices (Delivered / Partial / Became Something Else / Dropped) should be clear and honest — not corporate jargon
- The optional note field should have a helpful placeholder, not just say "Notes"
- If someone picks "Dropped," the tone should feel matter-of-fact — not like they failed

Same for the BLOCKED panel — it should feel like asking a teammate "hey, what's stopping you?" not like a performance review.

Deliver: wireframe, Figma sketch, or just detailed notes on how you want each state to look and feel. Brayden will build from that.

---

### 3. Review the People & Performance Page

The People & Performance page (`/people/performance`) was just built. It shows every person on the team with their workload, monthly check-ins, feedback status, and quarterly review placement.

Walk through it as a Leadership user and flag:
- Is it immediately clear what each column means?
- Does "Needs check-in" vs "Feedback pending" feel distinct enough?
- When you click "Request feedback" on someone, does the drawer feel trustworthy — does it look like a real, professional feedback request or does it feel clunky?
- When you see the monthly check-in dots, is it immediately obvious what red/yellow/green/blue means?
- Is the Quarterly Review placement (the Performance vs Potential grid) explained well enough that a new admin would understand it?

Deliver: a list of specific things to fix, with screenshots where helpful.

---

### 4. Visual Direction for the Action Tracker Upgrade

Wesley is going to rebuild the filter bar and preset chips on the Action Tracker this week. Before he starts, give him direction:

- Open `/actions/all` right now and compare it to `/work` (the Work Hub)
- They should feel like the same product — same card style, same filter style, same color language
- Note the biggest visual differences between the two pages
- Decide: should we match the Work Hub exactly, or is there a reason the Action Tracker's filters should look different?

Deliver: 3–4 sentences of direction Wesley can work from, plus any specific components in the codebase he should reference.

---

### 5. Structured Feedback Responses — Design the New Form

Right now the feedback form is one big text box. The plan is to break it into four real questions:

1. What did this person do well?
2. What could they improve?
3. Did they follow through on what they committed to?
4. Anything leadership should know?

Each would be a short paragraph box, not a long essay.

Design how this form should look — tone, layout, label copy. It should feel conversational and honest, not like an HR form. The person filling it out should feel like they're giving a real teammate a fair read, not writing a performance review.

This won't ship this week — but the design should be done by Friday so it can be built next week.

---

## WESLEY — Building the New Surfaces

> Own the implementation of the UI. Anthea reviews your work before it's called done. If something is unclear, ask Anthea first, then Brayden.

---

### 1. Rebuild the Action Tracker Filter Bar

The filter bar on the Action Tracker (`/actions/all`) still looks like an older version of the portal. Everything else on the page was updated — the filter bar was left behind.

Rebuild it to match the new design system. Everything it currently does (filter by status, priority, type, owner, preset views, saved views) stays exactly the same. Only the visual look changes.

Use the same filter chips and filter bar style that's used on the Work Hub (`/work`) — they should feel identical.

---

### 2. Rebuild the Action Tracker Preset Chips and Saved Views Bar

Same deal — the quick-filter preset chips ("Overdue," "High Priority," "Blocked," "Needs Input") and the saved views bar still look old. Rebuild them to match the new design system.

These are the things people click most often when they open the Action Tracker. They should be the sharpest part of the page.

---

### 3. Rebuild the "New Action" Form

The form you fill out when you create a new action (`/actions/new`) still uses the old styling. It has some sophisticated features — it pre-fills based on where you came from, shows quality warnings if your action is too vague, and shows the strategic context.

Rebuild the visual shell to match the new design. Keep every single behavior exactly the same — don't touch the logic, only the look. Think of it like re-painting a car without changing what's under the hood.

Pay special attention to:
- The quality warning chips (they tell you if your action is missing a "who" or "by when") — these should feel helpful, not alarming
- The "Linked to [Class/Mentorship/Person]" chip — it should be clearly visible so people know this action is connected to something specific
- The "Definition of done" field — it should have a welcoming placeholder like "How will you know this is done?"

---

### 4. Build the Outcome Capture Panel (with Brayden)

Once Brayden has the backend wired up (see his task #1), build the UI for it.

When someone clicks "Mark done" on an action, show a small panel with:
- Four outcome choices as pill buttons: Delivered / Partially done / Became something else / Dropped
- A one-line text field: "What happened?" (placeholder: "In one sentence...")
- A date picker: "Schedule a follow-up check-in?" (labeled as optional)
- A "Save and close" button

For the BLOCKED outcome: same lightweight panel with just a text field: "What's in the way?" and a save button.

Get Anthea's design direction before building the visual layout.

---

### 5. People & Performance Page — Fix Issues from Anthea's QA

After Anthea does her QA of the People & Performance page (see her task #3), implement whatever fixes she flags that are clearly UI — things like copy changes, layout issues, tooltip text, empty state messages. Anything that touches the data layer goes to Brayden.

---

## End of Week — How We Know This Was a Good Week

By Friday, these things should be true:

**The Action Tracker feels complete:**
- [ ] When you complete an action, you can record what happened — and that shows on the action's page
- [ ] When you block an action, you can write why — and that's visible to everyone watching it
- [ ] The filter bar, preset chips, and saved views all look like the rest of the new portal
- [ ] Creating a new action feels as polished as anything else in the product

**The People & Performance page feels trustworthy:**
- [ ] The feedback request drawer gives leadership confidence before they send — they can see the context and preview the email
- [ ] The monthly check-in dots are immediately readable
- [ ] Anthea's QA list is implemented

**The Command Center is something you'd actually open every morning:**
- [ ] Each workspace has one clear job
- [ ] Calm mode actually feels calm
- [ ] My Queue shows the right things

**The feedback loop works without manual chasing:**
- [ ] Reminder emails go out automatically when someone hasn't responded by the due date

**Testing:**
- [ ] Brayden has walked through the full meeting → decision → action → outcome loop on staging
- [ ] Nothing is broken in the Action Tracker or Meetings Tracker after this week's changes
