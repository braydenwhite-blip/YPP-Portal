# Family Portal Session 1 foundation

Session 1 introduces a flexible family model without duplicating student identities. Students remain `User` records with the `STUDENT` role. Guardians remain `User` records with parent/family roles and receive a `GuardianProfile` for family-specific preferences.

## Legacy compatibility

Approved, non-archived `ParentStudent` rows and approved `ParentStudentConnection` rows are backfilled into `StudentGuardianRelationship` by the migration. New relationship records are the preferred source of truth. The runtime compatibility layer in `lib/family-access.ts` falls back to approved, non-archived `ParentStudent` links only when no active new relationship exists for a guardian. Rejected, pending, revoked, or archived legacy links do not grant access.

Household membership is intentionally separate from guardianship authority. A `HouseholdMember` row never grants access by itself; loaders and actions must require an active `StudentGuardianRelationship` or an approved legacy fallback.

## Restricted information

Family portal DTO helpers remove internal notes, reviewer notes, blocker notes, review notes, internal scoring, safeguarding notes, and similar operational fields before records are rendered in student or guardian routes.
