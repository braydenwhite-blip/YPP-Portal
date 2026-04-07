# Marketing site: link the portal (PR checklist)

Repository: [YPPTech/youth-passion-project](https://github.com/YPPTech/youth-passion-project) (e.g. [ypp-website-one.vercel.app](https://ypp-website-one.vercel.app/)).

## Edits to make

1. Replace **“Portal coming soon”** (nav / hero / footer) with the **production portal URL** (single canonical domain).
2. Footer **Resources → Student portal**: link to sign-in or sign-up path (e.g. `https://<portal>/login`).
3. Align button styles with existing purple palette (no new brand colors required).

## After merge

- Verify links from marketing site open the portal over HTTPS.
- Confirm `NEXTAUTH_URL` on Vercel includes the same hostname users land on.
