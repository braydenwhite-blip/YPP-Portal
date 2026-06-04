# Training Journey Builder — Visual (JSON-free) Beat Editing

This note documents the visual editing layer added on top of the existing
Admin Journey Editor (`/admin/journeys`). The goal: a non-technical YPP leader
can edit the interactive training journey — reflection prompts, quiz answers,
sort/match steps, and feedback copy — through forms, **without touching JSON**.

## What shipped

1. **Structured, JSON-free beat editor.** The "Edit beat" modal now renders
   kind-specific form fields instead of a raw JSON textarea for the four
   editor-supported beat kinds: `REFLECTION`, `SORT_ORDER`, `FILL_IN_BLANK`,
   `MATCH_PAIRS`.
   - Reflection: prompt, min/max length, acknowledgement message.
   - Sort order: add/remove/reorder steps (arranged in their *correct* order;
     the runtime shuffles for the learner), partial-credit toggle, correct &
     incorrect feedback.
   - Fill in the blank: prompt, multiple accepted answers (add/remove),
     case-sensitivity, optional hint, correct & incorrect feedback.
   - Match pairs: add/remove matching pairs (left → right), partial-credit
     toggle, optional hint, correct & incorrect feedback.
   - **Advanced (JSON)** escape hatch is one click away and is the default for
     beat kinds that don't have a visual editor yet.
   - **Unsaved-changes guard:** closing the modal with edits prompts for
     confirmation.

2. **Lossless + schema-safe.** Saving converts the form back into a config
   object that is re-validated by `updateDraftBeat()` against the same Zod
   `configSchema` used at import and runtime. Advanced fields the form does not
   surface (e.g. `acceptedPatterns`, immersion feedback fields) are preserved
   across a round-trip.

3. **Bridge to real modules** (`scripts/adopt-interactive-journeys-into-editor.mjs`).
   Surfaces existing imported curriculum modules in the editor (see below).

### Files

| File | Role |
| --- | --- |
| `lib/journey-editor/beat-config-forms.ts` | Pure config ⇄ form-model conversion (unit-tested). |
| `app/(app)/admin/journeys/[id]/beat-config-form.tsx` | Kind-specific form UI. |
| `app/(app)/admin/journeys/[id]/beat-editor-modal.tsx` | Modal: structured form + JSON fallback + unsaved-changes guard. |
| `app/globals.css` | Scoped styles for the editor + config forms. |
| `scripts/adopt-interactive-journeys-into-editor.mjs` | Legacy → editor bridge. |
| `tests/lib/journey-editor-beat-config-forms.test.ts` | Round-trip / schema-validity tests. |

## How an admin edits a journey

1. Go to **/admin/journeys** and open a journey.
2. On **Overview**, click **Start a new draft** if there's no DRAFT yet.
3. Go to **Beats**. Drag to reorder, **Add a beat**, or click a beat to edit it.
4. In the modal, edit content with the visual fields. Click **Save**.
5. On **Versions**, click **Publish** when ready (archives the prior published
   version). Use **Roll back here** on an archived version to revert.

Access is limited to ADMIN / CONTENT_ADMIN (edit + publish) and STAFF
(read-only), via `requireJourneyEditor()`.

## Making the real curriculum modules editable

Imported curriculum (`npm run training:import`) lives in the legacy
`InteractiveJourney` / `InteractiveBeat` tables, with `journeyVersionId = null`,
so those beats don't appear in the editor by default. The bridge script
attaches them to an editable DRAFT version **without cloning, renaming, or
deleting any beat** (it only sets `journeyVersionId` on existing rows and
creates `Journey` / `JourneyVersion` rows):

```bash
npm run journey-editor:adopt-modules         # dry run — prints what it would do
npm run journey-editor:adopt-modules:apply   # write the changes
```

The instructor runtime reads beats via the `InteractiveJourney` relation
(independent of `JourneyVersion.status`), so adoption does **not** change what
instructors see.

## Known limitations / future work

- **Draft isolation for adopted (legacy) journeys is not byte-isolated yet.**
  Adopted beats are the same rows the runtime renders, so editing them in a
  DRAFT takes effect for instructors immediately. True copy-on-write drafts for
  legacy journeys require removing the legacy `@@unique([journeyId, sourceKey])`
  constraint and cloning beats per version (the deferred "resolver bridge").
  Journeys authored entirely in the editor are unaffected.
- **Visual editors exist for 4 of the 13 beat kinds.** The rest
  (`CONCEPT_REVEAL`, `CONTENT_BLOCK`, `SCENARIO_CHOICE`, `MULTI_SELECT`,
  `SPOT_THE_MISTAKE`, `HOTSPOT`, `BRANCHING_SCENARIO`, `COMPARE`,
  `MESSAGE_COMPOSER`) remain editable via the Advanced (JSON) panel until their
  form panes land. Add a new kind by extending `STRUCTURED_BEAT_KINDS` +
  `beat-config-forms.ts` + `beat-config-form.tsx`, and (to allow *adding* it)
  `EDITOR_SUPPORTED_KINDS` in `lib/journey-editor/beat-defaults.ts`.
- **Assignments tab** is still a placeholder (`setAssignments` action + UI is
  the next editor gap).
- **Module-level metadata** (title/intro/estimated time) for legacy modules is
  edited in the existing `/admin/training` manager; the journey editor focuses
  on interactive beat content.
