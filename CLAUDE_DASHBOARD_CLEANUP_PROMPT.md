You are a senior product-minded frontend engineer working inside an existing Next.js 14 + App Router codebase.

Your task: make the dashboard experience much cleaner and easier to use, while keeping the exact same functionality.

Project context:
- This is the YPP portal.
- It has role-based dashboards/navigation (admin, instructor, student, mentor, chapter lead, parent).
- There are many existing routes, pages, and workflows already wired.

Non-negotiable constraints:
1. Do NOT remove features.
2. Do NOT break existing flows.
3. Do NOT remove existing routes/URLs.
4. Do NOT change role permissions/authorization behavior.
5. Do NOT change backend business logic unless absolutely required for UI cleanup.
6. Keep database schema changes to zero unless strictly necessary.
7. Preserve current functionality end-to-end.

Definition of success:
- The dashboard/navigation feels cleaner, less overwhelming, and easier to scan.
- Users can still do everything they could before.
- No regressions in auth, role access, enrollment flows, class management, or admin workflows.

What I want you to do (in order):

Step 1: Audit
- Audit current dashboard + navigation UX.
- Identify clutter, duplicated patterns, confusing sections, and low-signal UI.
- List pain points by role.

Step 2: Redesign plan (no code yet)
- Propose a cleaner information architecture.
- Propose a simpler nav grouping strategy.
- Propose a cleaner dashboard layout system (hero, KPIs, action cards, recent activity, etc.).
- Keep all existing capabilities discoverable.
- Show an old->new mapping for each important screen/entry point.

Step 3: Implement safely
- Implement in small commits/patches with minimal risk.
- Reuse existing data/actions/routes.
- Prefer component extraction and UI composition improvements over logic rewrites.
- Preserve all current route links and functional entry points.
- Keep responsive behavior (desktop + mobile).
- Keep accessibility standards (labels, keyboard, contrast, semantics).

Step 4: Regression protection
- Add/adjust tests for key navigation and dashboard flows.
- Verify role-based visibility still works.
- Verify all major CTAs still reach the same outcomes.

Step 5: Deliverables
- Provide:
  1. What you changed
  2. Why it is cleaner
  3. Proof that functionality stayed intact
  4. Any remaining UX debt
  5. Follow-up optional improvements (separate from required scope)

Important implementation rules:
- Keep existing functionality exactly intact.
- If you think a feature should be removed, do not remove it; instead relocate or de-emphasize it.
- If anything is unclear, choose the safer path that preserves behavior.
- Prioritize clarity, consistency, and reduced cognitive load.
