# Full YPP Portal Integration Plan

Two tracks: (A) Fix the 3D scene, (B) Connect the world to the full portal.

---

## TRACK A — Fix 3D Scene Loading (Priority: CRITICAL)

The 3D scene has never loaded on Vercel production across 4+ sessions. The SVG fallback always shows after the 20-second timeout.

### Root Cause Analysis

The CSP fix (`font-src`, `connect-src`) was necessary but NOT sufficient. The real blockers are:

1. **Massive chunk size** — 19 files use `import * as THREE from "three"` which imports the ENTIRE Three.js library (~600KB minified) and prevents tree-shaking. Combined with `@react-three/drei` (Sky, Text, Billboard, Float, MapControls) and 25+ local components, the 3D chunk is likely **1.5–2MB+ minified**. On slow connections this exceeds the 20s timeout.

2. **Heavy `Text` component** — `@react-three/drei`'s `Text` uses `troika-three-text` which bundles an OpenType font parser, SDF text renderer, and creates Web Workers at runtime. Used in 7 landmark/label files. This alone adds ~200KB+ to the chunk.

3. **No chunk preloading** — The chunk only starts downloading when the `WorldScene3D` component first renders, AFTER passion-world.tsx has loaded. There's no preloading or prefetching.

4. **No diagnostic visibility** — We can't tell whether the chunk fails to download, fails to evaluate, or just times out. No console output from the chunk loading process.

### Phase A1: Diagnostics (estimate: small)
Add console timestamps to passion-world.tsx so we can see exactly what happens:
- Log when `use3D` becomes true
- Log when WorldScene3D starts loading (wrap the dynamic import factory)
- Log if the import resolves or rejects
- Increase timeout to 30s temporarily
- This tells us: is it a download timeout, eval error, or rendering crash?

### Phase A2: Tree-shake Three.js (estimate: medium)
Replace `import * as THREE from "three"` with named imports across all 19 files:
- `ocean.tsx`: needs `ShaderMaterial, Color, PlaneGeometry, DoubleSide, Float32BufferAttribute, BufferGeometry, Mesh, Vector3`
- `sky-environment.tsx`: needs `Points, PointsMaterial, Float32BufferAttribute, BufferGeometry, Mesh`
- `world-scene.tsx`: needs `Color, PCFSoftShadowMap`
- etc. for all 19 files
- This could reduce the Three.js portion from ~600KB to ~200KB

### Phase A3: Replace heavy `Text` with HTML overlays (estimate: medium)
The drei `Text` component (troika-three-text) is used in 7 files for 3D labels:
- `quest-board.tsx`, `mentor-tower.tsx`, `achievement-shrine.tsx`, `chapter-town.tsx`, `seasonal-events.tsx`, `compass.tsx`, `island-label.tsx`
- Replace with `Html` from drei (renders DOM elements in 3D space) or simple sprite-based labels
- This removes troika-three-text (~200KB+) and its Web Worker complexity entirely

### Phase A4: Prefetch the 3D chunk (estimate: small)
Add a prefetch hint so the browser starts downloading the 3D chunk immediately when passion-world.tsx loads, instead of waiting for `use3D` to become true:
```tsx
// At module scope in passion-world.tsx
const worldSceneChunk = import("./scene/world-scene");
```
Or use `<link rel="prefetch">` for the webpack chunk.

### Phase A5: Fallback lightweight 3D (estimate: medium)
If the full 3D scene is still too heavy, create a "lite" 3D scene:
- Simple blue plane for ocean (no shader)
- No Sky component (use scene.background color)
- No Text/Billboard (use Html overlays)
- No Weather, SeasonalTheme, AmbientLife
- Just islands + camera controls
- This would be a ~50KB chunk vs 1.5MB

---

## TRACK B — Connect Quiz to Islands & Full Portal Integration

### Phase B1: Quiz → Island Creation (Priority: HIGH)
**Goal**: When a user completes the discovery quiz, create `StudentInterest` records that become islands in the world.

Current state: Quiz saves `PassionQuizResult` with `topPassionIds` and awards 50 XP, but does NOT create `StudentInterest` records. Islands come from `StudentInterest` records via `getWorldData()`.

Changes needed:
1. **Update `/api/discover/quiz/save/route.ts`**:
   - After saving quiz result, find or create `PassionArea` records matching the top passion categories
   - Create `StudentInterest` records for the top 3 passions (set first as `isPrimary`)
   - Skip creating if interest already exists
   - Return created interest IDs in the response

2. **Update `DiscoveryQuizPanel`**:
   - After quiz completion and save, show a "Your islands are being created!" message
   - Call `router.refresh()` or re-fetch world data to show new islands
   - Add a `onQuizComplete` callback prop that triggers world data refresh

3. **Update `passion-world.tsx`**:
   - Accept `onQuizComplete` from DiscoveryQuizPanel
   - Re-fetch world data when quiz completes (via server action `getWorldData()`)
   - Show a brief animation/toast when new islands appear

### Phase B2: Island Deep Links (Priority: HIGH)
**Goal**: Clicking actions within island panels navigates to the relevant portal page.

Changes to `island-detail.tsx`:
- Add "View Courses" button → links to `/my-courses` (filtered by passion area)
- Add "View Badges" button → links to `/achievements/badges`
- Add "Take Challenge" button → links to `/challenges`
- Add "Start Project" button → links to `/incubator`
- Use `next/link` or `router.push()` for navigation

### Phase B3: Landmark Deep Links (Priority: HIGH)
**Goal**: Landmark panels link to their corresponding portal features.

| Landmark | Panel | Deep Links |
|----------|-------|------------|
| Quest Board | `quest-panel.tsx` | "View All Challenges" → `/challenges`, "Daily Challenges" → `/challenges/daily` |
| Mentor Tower | `mentor-panel.tsx` | "Find a Mentor" → `/mentorship`, "My Mentor" → `/my-mentor`, "Office Hours" → `/office-hours` |
| Achievement Shrine | `shrine-panel.tsx` | "Badge Gallery" → `/achievements/badges`, "Certificates" → `/certificates`, "Leaderboard" → `/leaderboards` |
| Chapter Town | `chapter-panel.tsx` | "My Chapter" → `/chapter`, "Chapter Events" → `/events`, "Study Groups" → `/study-groups` |
| Events Hub | `events-panel.tsx` | "All Events" → `/events`, "Calendar" → `/calendar`, "Competitions" → `/competitions` |

### Phase B4: Dashboard World Preview Card (Priority: MEDIUM)
**Goal**: Add a "Passion World" preview card to the main dashboard (`app/(app)/page.tsx`).

The student quick-actions already have a "Passion World" card linking to `/world`. Enhance it:
- Show island count, total passion XP, and current level
- Mini preview of top 3 passion icons
- "Enter World" button
- Uses the existing `WorldData` from a lightweight server query (not the full `getWorldData()`)

### Phase B5: World → Navigation Integration (Priority: MEDIUM)
**Goal**: Add more entry/exit points between the world and other portal features.

1. **World back button** → already exists ("← Dashboard")
2. **Add quick-nav buttons** in the world HUD or as a floating menu:
   - My Courses, Challenges, Events, Profile
3. **World link in sidebar** → already exists at `/world` in the "Main" nav section

### Phase B6: XP Synchronization (Priority: MEDIUM)
**Goal**: XP earned anywhere in the portal reflects immediately in the world.

Current state: `getWorldData()` reads from `StudentXP` and `XPTransaction` tables. XP is awarded by various API endpoints. The world shows XP correctly when loaded, but doesn't update live.

Changes:
1. **Real-time XP toast in world**: When XP is earned (e.g., quiz completion), show a "+50 XP" animation in the world HUD
2. **Re-fetch on return**: When user navigates back to `/world` from another page, re-fetch `getWorldData()` to show updated XP
3. **Future**: WebSocket or Server-Sent Events for live XP updates (not needed initially)

### Phase B7: Passion-Aware Course Recommendations (Priority: LOW)
**Goal**: World data informs course recommendations.

- Island detail panel shows "Recommended Courses" based on the island's passion category
- Query courses that match the passion area's `interestArea`
- Show top 3 with "Enroll" links

### Phase B8: Onboarding Quiz Integration (Priority: LOW)
**Goal**: Add the discovery quiz as a step in the onboarding wizard.

Current onboarding: Welcome → Pathways → Profile → Goals → Complete.
New flow: Welcome → Pathways → **Discovery Quiz** → Profile → Goals → Complete.

- Add new step after pathway selection
- Embed the quiz component (reuse `DiscoveryQuizPanel` logic)
- Create initial islands from quiz results during onboarding
- User arrives at the world with islands already populated

### Phase B9: Badge/Certificate Display on Islands (Priority: LOW)
**Goal**: Islands visually show earned badges and certificates.

- In the SVG world: add small badge icons floating near islands
- In the 3D world: add floating 3D badge meshes above islands
- Island detail panel already shows badge/challenge/project counts

### Phase B10: World Sharing & Social (Priority: LOW)
**Goal**: Students can share their world progress.

- "Share World" button generates a shareable summary image or link
- Shows total islands, level, XP, top passions
- Could link to `/portfolio` or `/showcase`

---

## Implementation Order (Recommended)

### Sprint 1 — Make it Work
1. **A1**: Diagnostics (understand why 3D fails)
2. **A2**: Tree-shake Three.js (reduce chunk size)
3. **A3**: Replace Text with HTML overlays (remove troika)
4. **B1**: Quiz → Island creation (core feature)

### Sprint 2 — Connect Everything
5. **A4**: Prefetch 3D chunk
6. **B2**: Island deep links
7. **B3**: Landmark deep links
8. **B4**: Dashboard world preview card

### Sprint 3 — Polish
9. **B5**: World ↔ Navigation integration
10. **B6**: XP synchronization
11. **A5**: Lightweight 3D fallback (if full 3D still fails)

### Sprint 4 — Enhance
12. **B7**: Passion-aware course recommendations
13. **B8**: Onboarding quiz integration
14. **B9**: Badge display on islands
15. **B10**: World sharing

---

## Files Affected

### Track A (3D Fix)
- `components/world/passion-world.tsx` — diagnostics, prefetch
- `components/world/scene/world-scene.tsx` — tree-shake THREE
- `components/world/scene/ocean.tsx` — tree-shake THREE
- `components/world/scene/sky-environment.tsx` — tree-shake THREE
- `components/world/scene/camera-controller.tsx` — tree-shake THREE
- `components/world/scene/cinematic-intro.tsx` — tree-shake THREE
- `components/world/scene/ambient-life.tsx` — tree-shake THREE
- `components/world/scene/weather.tsx` — tree-shake THREE
- `components/world/scene/seasonal-theme.tsx` — tree-shake THREE
- `components/world/islands/island-mesh.tsx` — tree-shake THREE
- `components/world/islands/island-trees.tsx` — tree-shake THREE
- `components/world/islands/island-structures.tsx` — tree-shake THREE
- `components/world/landmarks/*.tsx` — tree-shake THREE, replace Text
- `components/world/effects/*.tsx` — tree-shake THREE
- `components/world/hooks/use-world-controls.ts` — tree-shake THREE

### Track B (Portal Integration)
- `app/api/discover/quiz/save/route.ts` — create StudentInterest records
- `components/world/overlay/discovery-quiz-panel.tsx` — onComplete callback
- `components/world/overlay/island-detail.tsx` — deep link buttons
- `components/world/overlay/quest-panel.tsx` — deep link buttons
- `components/world/overlay/mentor-panel.tsx` — deep link buttons
- `components/world/overlay/shrine-panel.tsx` — deep link buttons
- `components/world/overlay/chapter-panel.tsx` — deep link buttons
- `components/world/overlay/events-panel.tsx` — deep link buttons
- `components/world/passion-world.tsx` — quiz refresh, nav buttons
- `app/(app)/page.tsx` — world preview card
- `app/(app)/world/page.tsx` — data refresh on return
