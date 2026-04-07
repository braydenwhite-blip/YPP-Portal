# V1 authentication scope

## In scope for v1 sign-off

- Email + password (bcrypt).
- Password reset via expiring token.
- Email verification on signup (where enabled).
- Rate limiting and account lockout after failed attempts (see env + [`lib/auth`](../lib/auth)).
- Role-based access: Student, Instructor, Mentor, Admin, Chapter President.

## Deferred (product support not required for v1)

- Google OAuth.
- Magic Link (route may exist for dev; not part of v1 support matrix).
- TOTP / 2FA (UI may exist; not part of v1 support matrix).

Support and marketing copy should emphasize **email + password**. Optional: set internal policy to hide deferred entry points on login in production builds.
