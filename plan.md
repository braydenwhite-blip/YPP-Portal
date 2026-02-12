# Plan: 10x the Passion World

The current map has good bones — SVG ocean, animated waves, category-themed islands, a HUD, an activity log, and 5 landmark placeholders. But it's functionally thin: you can click an island and drag the map. That's it. Here's how we blow it open.

---

## Phase 1: Make the Map Feel Alive

**Goal:** Every pixel should breathe. The world should feel like a living place, not a static diagram.

### 1A. Ambient Life System
- **Fireflies / Sparkles** — Tiny glowing dots that drift slowly across the ocean (SVG circles with opacity keyframes). Density increases near high-XP islands.
- **Water Ripples** — Concentric circle pulses radiating from each island base, fading out. Different speed per island (active = faster).
- **Tree Sway** — Slight rotational oscillation on tree canopy ellipses (2-3deg, staggered timing).
- **Seabirds** — 2-3 tiny V-shaped paths that loop slowly across the sky above the clouds.
- **Day/Night Cycle** — Tint the ocean gradient based on real time of day: warm orange at morning, cool blue midday, purple at sunset, dark navy at night. Stars appear at night.

### 1B. Weather System (Tied to Activity)
- If the student earned XP in the last 24h → **sunshine** (golden light rays from top).
- If idle for 3+ days → **light fog** rolls in (semi-transparent white overlay on ocean).
- On the day they leveled up → **aurora borealis** ribbons in the sky.
- During seasonal events → **falling confetti / snowflakes / petals** based on season.

### 1C. Island Evolution Visuals
Right now islands just get bigger. Instead, make each progression level visually distinct:
- **EXPLORING** — Sandy atoll. No trees. A single planted seed. Tiny flag says "New".
- **DEVELOPING** — Small green island. 3 palm trees. A campfire. Dock appears on the shore.
- **ADVANCING** — Lush island with forest. Stone path. A cottage. Fishing boat at dock. Smoke from chimney.
- **MASTERING** — Grand island. Castle/workshop on top. Lighthouse. Bridge connecting to nearby islands. Glowing aura around the whole island.

Each transition should be earned — show "Island Evolved!" toast when level changes.

---

## Phase 2: Make It Interactive

**Goal:** Every element should be clickable, explorable, and responsive to touch/keyboard.

### 2A. Island Interactions
- **Hover** — Island scales up 10%, glow ring appears, tooltip shows name + level.
- **Click** — Current detail panel, BUT now it also has action buttons:
  - "Continue Learning" → links to enrolled courses for that passion
  - "Take a Challenge" → links to challenges tagged to that passion
  - "View Badges" → shows earned badges for that passion with icons
  - "Start Project" → links to incubator for that passion area
- **Long-press / Right-click** — Context menu: "Set as Primary", "View History", "Share Island"
- **Double-click** — "Zoom to island" — smoothly animates viewBox to center + zoom on that island

### 2B. Landmark Interactions (These Are Real Destinations Now)
Each landmark should be clickable and route to the actual feature:

| Landmark | Click Action | Visual Cue |
|----------|-------------|------------|
| Quest Board | → `/challenges` page | Pulsing "!" icon if new quests available |
| Mentor Tower | → `/mentorship` or show mentor chat panel | Lit windows if mentor is online |
| Achievement Shrine | → `/badges` page or inline badge gallery | Glow intensity based on badge count |
| Chapter Town | → `/chapter` page | Smoke from chimneys, more buildings = more members |
| Seasonal Events | → `/events` page | Tent color changes by season, music note particles if active |

### 2C. Navigation Controls
- **Zoom** — Mouse wheel zooms in/out (clamp 0.5x to 3x). Pinch-to-zoom on mobile.
- **Minimap** — Small 120x80 inset (bottom-left) showing all islands as dots, current viewport as a rectangle. Click minimap to jump.
- **Fit All** — Button in HUD: resets view to show all islands.
- **Keyboard**: Arrow keys pan, +/- zoom, Tab cycles islands, Enter selects, Escape deselects, `?` toggles help overlay.

### 2D. Search & Filter
- Search bar (top-right): type to highlight matching islands (others fade to 30% opacity).
- Category filter chips: click ARTS/MUSIC/STEM etc. to highlight only those islands.

---

## Phase 3: Make the Data Sing

**Goal:** All that fetched data should be visible and meaningful.

### 3A. Enhanced Detail Panel
Current panel shows 4 numbers. New panel shows:
- **Progress Ring** — circular SVG showing % to next passion level (EXPLORING→DEVELOPING = 0-100%)
- **Milestone Checklist** — "To reach Developing: Complete 2 courses, Earn 1 badge, Log 100 XP"
- **Badge Shelf** — Row of earned badge icons (actual icons from DB `badge.icon`), clickable
- **Course List** — Enrolled courses with completion %, links
- **Recent Activity** — Last 3 XP transactions *for this specific passion* (filter `recentActivity` by `passionId`)
- **Connection Web** — "Related passions:" show linked islands with lines

### 3B. Floating XP Toasts
When `recentActivity` items are newer than session start, show floating "+25 XP" text that rises from the relevant island and fades. This makes recent progress feel real.

### 3C. Island Stat Rings
Around each island, show faint concentric data rings (like planetary rings):
- Inner ring = course completion %
- Outer ring = badge progress

These appear on hover, vanish otherwise to keep the map clean.

### 3D. Connection Bridges
Replace the meaningless dashed lines with actual bridges between islands that share `relatedAreaIds`. Bridge thickness = connection strength. This shows how passions relate.

### 3E. Use DB-Stored Icon & Color
The `PassionArea` model has `icon` and `color` fields. If they exist, use them instead of the hardcoded emoji/theme system. Fall back to the category theme if null.

---

## Phase 4: Progression & Rewards Feel

**Goal:** Make the student feel their growth viscerally.

### 4A. Level-Up Ceremony
When the student's global level increases:
- Full-screen golden particle burst
- Level number animates up (old → new with scale bounce)
- New title appears with typewriter effect
- Sound effect (optional, off by default)
- "Level Up!" banner persists for 5 seconds

### 4B. Island Growth Animation
When an island evolves (EXPLORING → DEVELOPING etc.):
- The island shakes, glows
- Old elements dissolve (particles)
- New elements build in (trees grow, buildings rise)
- "Island Evolved!" floating text

### 4C. XP Trail
As you earn XP, show a golden trail/wake flowing from the source island toward the HUD XP bar, like coins being collected.

### 4D. Streak Indicator
If the student has been active for consecutive days, show a flame icon on the HUD with the streak count. Flame gets bigger with longer streaks.

---

## Phase 5: Polish & Production Quality

**Goal:** Make it feel like a shipped product, not a prototype.

### 5A. Performance
- **Memoize** `Island` component with `React.memo` + compare only `island.id` and `isSelected`
- **Debounce** pan handler (requestAnimationFrame instead of every mousemove)
- **Virtualize** — if >20 islands, only render islands within the current viewBox ± buffer
- **Move inline styles to CSS module** — cleaner, cacheable, no re-parse on render

### 5B. Loading & Error States
- **Skeleton** — While `getWorldData()` loads, show ocean gradient + pulsing placeholder islands
- **Error boundary** — Wrap `<PassionWorld>` in error boundary, show "Your world is loading..." with retry button
- **Suspense** — Use React Suspense on the page for streaming

### 5C. Accessibility
- Every island gets `role="button"`, `aria-label="{name} island, {level}, {xp} XP"`, `tabIndex={0}`
- Every landmark gets `role="link"`, `aria-label`
- HUD stats get `aria-live="polite"` for screen reader updates
- Focus ring visible on keyboard navigation
- High-contrast mode: thicker borders, pattern fills instead of color-only

### 5D. Mobile Excellence
- Touch: tap island, two-finger pinch zoom, swipe to pan
- Bottom sheet instead of side panel for island detail (slides up from bottom on mobile)
- Landmarks get larger tap targets (48px minimum)
- HUD collapses to a single row with expand toggle
- Activity log becomes a swipe-up drawer

### 5E. Onboarding
First time a student visits `/world`:
- Animated intro: camera zooms from sky down to their first island
- Tooltip sequence: "This is your Passion World" → "Each island is a passion you're exploring" → "Click an island to see your progress" → "Visit landmarks to discover quests, mentors, and more"
- Stored in localStorage so it only shows once

### 5F. Sound Design (Optional, Off by Default)
- Ambient ocean waves (low volume, loopable)
- Soft chime when selecting island
- Achievement jingle on level up
- Toggle in HUD: speaker icon on/off

---

## What This Leaves Room For (Not Built Yet)

These features get placeholder landmarks and data hooks but are NOT implemented in this phase:

| Future Feature | Current Hook | What to Build Later |
|---|---|---|
| **Quest Board** | Landmark + `/challenges` link | Full quest system with daily/weekly/seasonal quests, rewards, progress tracking |
| **Mentor Tower** | Landmark + mentor name display | Real-time mentor chat, scheduled sessions, mentor matching |
| **Achievement Shrine** | Landmark + badge/cert counts | Full badge gallery, certificate viewer, achievement paths, rarity display |
| **Chapter Town** | Landmark + chapter name/count | Chapter leaderboards, collaborative goals, chapter events |
| **XP & Levels** | HUD bar + level title | Full XP history page, level rewards, prestige system |
| **Seasonal Events** | Landmark + event/challenge count | Seasonal themes, limited-time challenges, event calendar integration |

---

## Implementation Order

| Step | What | Files Touched | Complexity |
|------|------|--------------|------------|
| 1 | Phase 5A+5B: Performance + loading/error states | `passion-world.tsx`, `page.tsx` | Low |
| 2 | Phase 2C: Zoom + minimap + keyboard nav | `passion-world.tsx` | Medium |
| 3 | Phase 1C: Island evolution visuals (4 distinct tiers) | `passion-world.tsx` | Medium |
| 4 | Phase 2A+2B: Rich interactions (hover, landmarks click, action buttons) | `passion-world.tsx` | Medium |
| 5 | Phase 3A: Enhanced detail panel (progress ring, badges, courses) | `passion-world.tsx`, `world-actions.ts` | Medium |
| 6 | Phase 1A: Ambient life (fireflies, ripples, tree sway, birds) | `passion-world.tsx` | Medium |
| 7 | Phase 3B+3C+3D: Floating XP, stat rings, real bridges | `passion-world.tsx`, `world-actions.ts` | Medium |
| 8 | Phase 4: Level-up ceremony + island growth animation | `passion-world.tsx` | High |
| 9 | Phase 1B: Weather system | `passion-world.tsx`, `world-actions.ts` | Medium |
| 10 | Phase 5C+5D: Accessibility + mobile excellence | `passion-world.tsx` | Medium |
| 11 | Phase 5E: Onboarding tutorial | `passion-world.tsx` | Medium |
| 12 | Phase 2D: Search + filter | `passion-world.tsx` | Low |
| 13 | Phase 5F: Sound design (optional) | `passion-world.tsx` + audio assets | Low |

Each step is independently shippable. Total: ~13 PRs if done incrementally.
