# Training Journey Builder — Visual (JSON-free) Beat Editing

This note documents the visual editing layer added on top of the existing
Admin Journey Editor (`/admin/journeys`). The goal: a non-technical YPP leader
can edit the interactive training journey — reflection prompts, quiz answers,
sort/match steps, and feedback copy — through forms, **without touching JSON**.

## What shipped

1. **Structured, JSON-free beat editor for ALL 13 beat kinds.** The "Edit beat"
   modal renders kind-specific form fields instead of a raw JSON textarea for
   every `InteractiveBeatKind`:
   - **Reflection:** prompt, min/max length, acknowledgement message.
   - **Sort order:** add/remove/reorder steps (arranged in their *correct* order;
     the runtime shuffles for the learner), partial-credit toggle, feedback.
   - **Fill in the blank:** prompt, multiple accepted answers (add/remove),
     case-sensitivity, optional hint, feedback.
   - **Match pairs:** add/remove matching pairs (left → right), partial-credit
     toggle, optional hint, feedback.
   - **Concept reveal:** add/remove/reorder reveal panels (title + body).
   - **Content block:** add/remove/reorder reading sections (optional heading +
     body), optional supporting image (URL/alt/caption), takeaway.
   - **Scenario choice:** add/remove options, mark the one correct option
     (radio), feedback.
   - **Multi-select:** add/remove options, tick every correct option, scoring
     mode (all-or-nothing / threshold + minimum), feedback.
   - **Spot the mistake:** passage + clickable phrases entered as text (character
     offsets computed automatically), mark the mistake, hint, feedback.
   - **Branching scenario:** root prompt, options with optional "leads to beat
     sourceKey", no-wrong-answer toggle or marked correct option, feedback.
   - **Compare:** two options (label + body), mark the stronger (A/B), optional
     required rationale tag, feedback.
   - **Hotspot:** image URL with a live preview, regions defined as percentages
     (with overlay boxes), mark the correct region, hint, feedback.
   - **Message composer:** snippet pools (label, min/max selections, snippets
     with comma-separated tags) plus required/banned rubric tags, feedback.
   - **Advanced (JSON)** escape hatch remains one click away for every kind.
   - **Unsaved-changes guard:** closing the modal with edits prompts for
     confirmation.
   - Admins can also **add** any of the 13 kinds from the Beats tab with
     schema-valid starter defaults (`EDITOR_SUPPORTED_KINDS` / `BEAT_DEFAULTS`).

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
- **All 13 beat kinds now have a visual editor.** No kind requires the JSON
  fallback for editing. The Advanced (JSON) panel is retained as an optional
  power-user escape hatch. To add a future kind, extend `STRUCTURED_BEAT_KINDS`
  + `beat-config-forms.ts` + the `beat-config-form.tsx` switch, and (to allow
  *adding* it) `EDITOR_SUPPORTED_KINDS` / `BEAT_DEFAULTS` in
  `lib/journey-editor/beat-defaults.ts`.
- **A few advanced sub-fields stay on a friendly-but-simplified surface:**
  `HOTSPOT` regions are edited as numeric percentages (not drag-on-image),
  `SPOT_THE_MISTAKE` targets are entered as phrases (offsets computed via the
  first match in the passage), and `MESSAGE_COMPOSER` tags use comma-separated
  inputs. Per-option `incorrectFeedback` overrides beyond the `default` entry
  are preserved on save but edited via the Advanced (JSON) panel.
- **Assignments tab** is still a placeholder (`setAssignments` action + UI is
  the next editor gap).
- **Module-level metadata** (title/intro/estimated time) for legacy modules is
  edited in the existing `/admin/training` manager; the journey editor focuses
  on interactive beat content.
