# Session 5 Authenticated QA Harness

Set `ENABLE_YPP_QA_AUTH=true` in a non-production environment and POST `{ "role": "chapter-president" }` to `/api/qa/session` to set the QA role cookie. The route returns 404 in production or when the guard is unset. Supported roles: student, guardian, instructor, chapter-president, leadership, restricted-safety-staff.

This harness is for rendered QA orchestration only; production authentication is not bypassed.
