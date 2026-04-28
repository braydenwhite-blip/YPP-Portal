# Instructor Training Modules — Audit & Plan

This folder preserves the architectural audit and improvement plan for the
Instructor Training Modules system in the YPP Pathways Portal.

The goal of the work is to take the existing training subsystem — interactive
beats, the academy curriculum, the Lesson Design Studio, and the readiness
aggregate — and make it **trustworthy, legible, and scalable** without
rewriting it. The chassis is good; the gaps are in completion integrity,
canonical semantics, reviewer visibility, and content polish.

## Contents

- [`phase-1-audit.md`](./phase-1-audit.md) — read-only discovery audit:
  system map, severity-ranked findings, completion/UX/integration audits,
  shipping risks.
- [`phase-2-plan.md`](./phase-2-plan.md) — sequenced architecture plan
  organized into 7 small, committable workstreams with a recommended first
  PR.

## Product Rules That Constrain This Work

Training modules are **pass / complete**. They are not graded.

The portal already uses a purple / green / yellow / red rating system. That
system belongs **only** in:

- interview review
- admin/reviewer readiness signals
- applicant/instructor risk summaries
- decision support

It must **not** be introduced into the learner-facing training experience.
Training can still rely on internal pass thresholds, checks for understanding,
required submissions, and completion gates — but the learner sees a binary
status, not a color or a public score.

## Status

| Phase | State |
|---|---|
| Phase 1 — Discovery audit | Complete |
| Phase 2 — Architecture plan | Complete |
| WS1 PR-1 — Quiz completion integrity | **Shipped** (commit `a7db9b4`) |
| WS1 remaining — video completion, reflection gating | Pending |
| WS2 — Canonical completion model | Pending |
| WS3 — Studio capstone semantics | Pending |
| WS4 — Training evidence for reviewers | Pending |
| WS5 — Admin cohort triage | Pending |
| WS6 — Cleanup / confusion reduction | Pending |
| WS7 — Curriculum content quality pass | Pending |
