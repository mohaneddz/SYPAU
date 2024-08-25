# SYPAU — Android-only (Expo) — Full Build Plan (plan.md)

> Product: SYPAU (Shut Your Phone Alarm Up)  
> Concept: “Silence Origami” (folds on a blueprint map).  
> Platform: React Native + Expo (Android only).  
> Target run: Expo Go for UI + basic location features; **advanced system-control requires a custom dev client / prebuild**.

---

## 0) Non-negotiable reality check (Expo Go constraints)

### What Expo Go can do well (MVP)
- Render maps + draw zones (circle/polygon).
- Detect “inside zone” using foreground location updates.
- Run **background location** using `expo-task-manager` + `expo-location` on Android (works, but needs correct permissions and user settings).
- Show activity logs, “armed” state, zone engagement UI.
- Adjust **in-app alarm behavior** if SYPAU owns the alarm feature (recommended).

### What Expo Go cannot reliably do (without native permissions / custom build)
- Force system **Do Not Disturb** / Notification Policy access.
- Change **ringer mode** / system alarm volume / override other alarm apps.
- Advanced geofencing APIs (Google Play Services geofencing) as a native module.

**Strategy**
- Build SYPAU as a “field engine” + UI in Expo.
- For the actual “shut alarms up” promise:
  - **MVP**: SYPAU provides its own alarm/timer. When inside a fold, alarms become gentle (vibrate/low volume) and/or require a less disruptive confirmation.
  - **V1+ (still Expo-managed but with custom dev client)**: add native modules or config plugins to control DND, ringer, etc.

---

## 1) Core product requirements (the app must do these)

1. User can create “Folds” (zones) by drawing on a map.
2. Each Fold has:
   - name
   - icon type (School / Studying / Sleeping / Awake / Tired / Praying / Custom)
   - geometry (circle or polygon)
   - enabled toggle
   - priority (1–10)
   - assigned Profile (set of actions)
3. App monitors location and determines:
   - Enter Fold
   - Exit Fold
   - Overlap resolution (priority rule)
4. When user enters a Fold:
   - Apply “Profile” (within Expo limits for MVP)
   - Push a snapshot on a “restore stack”
5. When user exits:
   - Restore previous state from stack
6. Provide a timeline log:
   - Entered, Exited, GPS drift, Holding, Permission changes
7. UI must match “Silence Origami” identity:
   - blueprint map + paper fold overlays + prism edge highlight
   - command ring instead of bottom nav
   - restrained colors

---

## 2) Final UX + pages (exact screens)

### Page A — Splash
- Full black
- Folded “S” logo center
- 1-line tagline: “Fold silence into places.”
- Auto-advance to Onboarding if first run else Map.

### Page B — Onboarding (3 steps max)
1) Draw: show line → fold
2) Engage: show perimeter light run → “ENGAGED”
3) Restore: show “RESTORED”
CTA: “Create first Fold”

### Page C — Main Map (Home)
**Layout**
- Fullscreen blueprint map
- Top bar:
  - left: status chip (ARMED / IDLE / HOLDING)
  - center: Active Fold name if inside one, else “No active fold”
  - right: gear icon (Settings)
- Bottom:
  - thin pill appears only when active: “Inside: <Fold> — ENGAGED”
- Floating **Command Ring** (bottom-right)
  - closed: circular button with fold glyph
  - open: radial actions:
    1) Draw Fold
    2) My Fields
    3) Modes
- Map overlays:
  - Folds drawn as paper patches:
    - interior: semi-opaque “paper” texture (very subtle)
    - border: crease line + prism edge
    - active fold border “breathes” slowly

**Interactions**
- Tap fold overlay → open Fold Detail
- Long press on map → quick-create circle fold (optional shortcut)

### Page D — Create Fold (Studio Mode)
**Step 1: Pick draw mode**
- Freehand polygon (default)
- Circle
- Polygon (point-by-point)

**Step 2: Draw**
- While drawing:
  - show vertices/points
  - snap assist (mild)
- “Close shape” action:
  - for polygon: auto-close when end near start
  - for circle: drag to set radius

**Step 3: Configure**
- Name input
- Icon type select (grid)
- Prism edge color (3 options only)
- Priority slider 1–10
- Assign Profile (Modes)
- Save button

### Page E — Fold Detail
- Header: Fold name + enabled toggle
- Cards (modules):
  - Geometry summary (type + area estimate)
  - Profile assigned (tap to change)
  - Priority control
  - Restore behavior:
    - Restore on exit (default ON)
    - Grace/dwell time (0–60s)
- Actions:
  - Edit geometry
  - Delete fold

### Page F — My Fields (List)
- Search bar
- List rows:
  - icon + name
  - status: Active now / Nearby / Idle
  - enabled toggle
  - priority badge
- Tap row → Fold Detail
- FAB: Create Fold

### Page G — Modes (Profiles)
Profiles = predefined statuses:
- School
- Studying
- Sleeping
- Awake
- Tired
- Praying
- Custom

Each Profile has:
- In-app alarm behavior (MVP)
- Notification behavior (MVP limited)
- Future: DND/ringer (V1+)

### Page H — Activity / Timeline
- Reverse chronological list
- Each item:
  - time
  - event label (ENTER, EXIT, HOLDING, GPS_DRIFT, PERMISSION)
  - details
- Filter by fold or event type

### Page I — Settings
- Permissions checklist (location foreground/background)
- Location accuracy:
  - Battery / Balanced / Precise
- Polling interval presets
- Dwell/Hysteresis settings
- Export/Import data (JSON)
- About / version / debug

---

## 3) The “Field Engine” (logic spec)

### 3.1 Definitions
- Fold = zone geometry + rules
- Profile = actions to apply while inside
- “Active Fold Set” = folds containing current location
- “Resolved Active Fold” = single fold chosen by overlap rule

### 3.2 Overlap rule (use Priority-based)
- Highest priority wins
- Tie-break:
  1) smaller area wins
  2) if still tie, most recently entered wins

### 3.3 Enter/Exit detection (robust)
Because GPS drifts:
- Use **dwell time**: fold must be continuously “inside” for `dwellEnterMs` before confirming Enter.
- Use **hysteresis buffer**:
  - consider inside if distance to border <= buffer
  - or for circle: radius +/- buffer
- Use **holding state** on drift:
  - if toggling inside/outside rapidly within `driftWindowMs`, emit HOLDING event and freeze state until stable.

### 3.4 Restore Stack (must be correct)
We simulate “restore previous state” even if only applying in-app settings in MVP.

Data structure:
- `stateStack: Array<{ foldId, appliedProfileId, snapshot: AppStateSnapshot, ts }>`
- `baselineSnapshot: AppStateSnapshot` captured when engine starts (or app launch)

Rules:
- On resolved fold change `prevResolved -> nextResolved`:
  - If nextResolved is null:
    - pop everything, restore baseline
  - If prevResolved is null and nextResolved exists:
    - push snapshot, apply next profile
  - If prevResolved exists and nextResolved exists and ids differ:
    - push snapshot, apply next profile
- On app restart:
  - recompute resolved fold at startup and rebuild stack as:
    - baseline snapshot + apply resolved fold profile (single level)
  - log ENGINE_RESTART

Snapshot content (MVP):
- app-owned alarm settings:
  - alarm intensity mode
  - vibration toggle
  - “gentle confirm” toggle
- UI-only state:
  - active fold id
  - last location timestamp

Future snapshot content (V1+ native):
- DND mode
- ringer mode
- media volume
- alarm volume

---

## 4) Data model (storage)

Use SQLite (Expo `expo-sqlite`) or MMKV; SQLite is safer for structured queries/logs.

### Tables
**folds**
- id (uuid)
- name (text)
- iconType (text)
- edgeColor (text: cyan|violet|amber)
- enabled (int)
- priority (int)
- geometryType (text: circle|polygon)
- geometryJson (text) // circle: {center, radius}; polygon: [{lat,lng},...]
- profileId (uuid)
- createdAt, updatedAt

**profiles**
- id (uuid)
- name (text)
- presetKey (text nullable) // "school", "praying", etc
- configJson (text) // alarm rules etc
- createdAt, updatedAt

**events**
- id (uuid)
- ts (int)
- type (text) // ENTER, EXIT, RESOLVE, HOLDING, GPS_DRIFT, PERMISSION, ERROR
- foldId (uuid nullable)
- payloadJson (text)

**settings**
- key (text primary key)
- valueJson (text)

---

## 5) Alarm strategy (how SYPAU actually “shuts alarms up” in MVP)

### MVP (Expo-only) — SYPAU-owned alarm
SYPAU includes:
- simple alarms + timers
- alarm plays via `expo-av` (sound) + vibration via RN
- when inside a fold:
  - switch to gentle sound or vibrate-only
  - optional “soft confirm”: single tap to dismiss instead of loud ring
  - optional “delay escalation”: start gentle for X seconds, then louder only if still not dismissed AND not inside fold

This makes the app deliver its promise without needing system-level controls.

### V1+ (Android native)
- If you want to control device DND/ringer:
  - requires Notification Policy Access and native modules/config plugins
  - build with Expo Dev Client or prebuild EAS

---

## 6) Tech stack & libraries

### Core
- Expo SDK latest stable
- TypeScript
- React Navigation (native stack)
- Zustand (state) or Redux Toolkit (either is fine)
- `expo-location`
- `expo-task-manager`
- `react-native-maps` (Google provider on Android)
- `expo-sqlite` (storage)
- `expo-haptics` (drawing feedback)
- `expo-av` (alarm sounds)
- `react-native-svg` (fold overlays and “paper edge” drawing)
- `react-native-reanimated` (breathing edge, command ring)

---

## 7) Project structure (exact)

```

/sypau
/app
App.tsx
/src
/assets
/textures (paper grain)
/icons
/sounds
/components
CommandRing/
FoldOverlay/
FoldCard/
StatusChip/
PrismEdge/
/db
schema.ts
queries.ts
migrate.ts
/engine
fieldEngine.ts
geo.ts
overlap.ts
drift.ts
snapshots.ts
tasks.ts
/navigation
RootNavigator.tsx
routes.ts
/screens
Splash.tsx
Onboarding.tsx
MapHome.tsx
CreateFold.tsx
FoldDetail.tsx
FieldsList.tsx
Modes.tsx
Activity.tsx
Settings.tsx
/state
useStore.ts
selectors.ts
/theme
colors.ts
typography.ts
tokens.ts
mapStyle.ts
/utils
uuid.ts
time.ts
log.ts

```

---

## 8) UI design tokens (must match identity)

### Colors
- InkBlack: #05060A
- DeepCharcoal: #0D111C
- PaperShadow: #141A2B
- AshPaper: #E9ECF2
- WarmPaper: #F4F1EA
- PrismCyan: #34F6D3
- PrismViolet: #7B5CFF
- PrismAmber: #FFB86B

### Typography scale
- H1: 28 / 34, weight 700, tracking +1
- H2: 22 / 28, weight 700
- Body: 15 / 22, weight 400
- Caption: 12 / 16, weight 500

### Radii
- Card: 22
- Button: 18
- CommandRing: 28

### Motion rules
- Active edge “breath”: 2.4s in/out, subtle
- Enter animation: perimeter sweep 600ms
- Exit animation: dissolve 450ms
- Haptics: light tick on vertex, medium on save/engage

---

## 9) Map styling (blueprint)
- Roads: thin, low contrast
- POIs minimized
- Labels subdued
- Map style JSON in `/theme/mapStyle.ts`

---

## 10) Geometry algorithms (deterministic)

### 10.1 Circle contains point
Use Haversine distance:
- inside if `distance(point, center) <= radius + bufferMeters`

### 10.2 Polygon contains point
Use ray casting in lat/lng space (ok for small areas):
- treat as planar for local zones
- for accuracy, project to mercator (simple) before ray casting

### 10.3 Polygon area estimate (optional)
Compute planar area after projection; show approximate.

---

## 11) Background monitoring approach

### Monitoring modes
- Foreground mode: high responsiveness (Map open)
- Background mode: lower frequency to save battery

### Expo Task
- Define task name: `SYPAU_LOCATION_TASK`
- Start updates when user arms monitoring:
  - `Location.startLocationUpdatesAsync(taskName, { accuracy, timeInterval, distanceInterval, showsBackgroundLocationIndicator: false })`
- Persist “armed = true” in settings so engine can restart on app reopen.

### Event pipeline
Task receives location -> `fieldEngine.tick(location)`:
1) load enabled folds from store/db (cache in memory)
2) compute active fold set
3) resolve fold
4) apply enter/exit transitions
5) write events to db
6) update store

---

## 12) Workflows (end-to-end)

### Workflow 1: First run
1) Splash → Onboarding
2) Request foreground location permission
3) Map Home opens
4) User taps Command Ring → Draw Fold
5) User draws polygon, names it, selects profile “Praying”, saves
6) App prompts background permission (optional now, required for background)
7) Engine armed

### Workflow 2: Enter fold
1) Background task gets new location
2) Engine detects stable inside after dwell time
3) Logs ENTER + RESOLVE
4) UI updates “Inside: X — ENGAGED”
5) Apply profile (MVP: alarm behavior, UI indicator)

### Workflow 3: Exit fold
1) Engine sees stable outside after dwell time
2) Logs EXIT
3) Restores snapshot (baseline or previous fold)
4) UI shows “RESTORED” toast (subtle)

### Workflow 4: Overlap
1) Inside multiple folds
2) Resolve by priority
3) If resolved fold changes, log RESOLVE_CHANGE and apply new profile

### Workflow 5: GPS drift
1) Rapid toggles
2) Engine enters HOLDING
3) Log HOLDING + reason
4) Freeze state until stable window passes

---

## 13) Step-by-step build orders for the IDE (do in this exact order)

### Phase 1 — Project boot
1) Create Expo TS project
2) Install deps:
   - react-navigation, native stack
   - react-native-maps
   - expo-location, expo-task-manager
   - expo-sqlite
   - expo-av, expo-haptics
   - react-native-svg
   - react-native-reanimated
   - zustand
3) Add Android config in `app.json`:
   - location permissions + background
   - Google Maps API key if needed

### Phase 2 — Theme + identity
1) Implement tokens in `/theme`
2) Implement base components:
   - Card, Button, StatusChip
3) Implement “paper texture overlay” (subtle image + opacity)

### Phase 3 — Navigation + screens shell
1) Set up RootNavigator
2) Add all screens with placeholders
3) Make CommandRing component and open/close animation

### Phase 4 — DB layer
1) Create schema + migrations
2) CRUD for folds, profiles, events
3) Seed default profiles (School, Studying, Sleeping, Awake, Tired, Praying)

### Phase 5 — Map + overlays
1) Render blueprint map
2) Load folds from DB
3) Draw fold overlays using SVG on top of map
4) Tap overlay -> Fold Detail

### Phase 6 — Create Fold studio
1) Implement circle mode (easiest)
2) Implement polygon point mode
3) Implement freehand polygon simplification:
   - downsample points
   - simplify (Ramer–Douglas–Peucker) optional
4) Save geometry to DB

### Phase 7 — Field engine
1) Implement geo helpers:
   - haversine
   - polygon contains
2) Implement drift + dwell logic
3) Implement overlap resolver
4) Implement state stack + baseline snapshot
5) Write events to DB

### Phase 8 — Location integration
1) Foreground location updates on Map screen
2) Background task updates:
   - define task
   - start/stop monitoring toggle in Settings
3) Permissions UI checklist

### Phase 9 — Alarms MVP (SYPAU-owned)
1) Add alarm creation UI (basic: time + label)
2) Alarm scheduler:
   - for Expo, simplest: local notification + open app
   - for true sound playback in background, you’ll likely need native / dev client
3) In-app alarm screen:
   - apply fold profile: gentle mode if active fold

### Phase 10 — Polish + testing
1) Activity timeline filters
2) Export/import JSON
3) Stress tests for drift
4) Battery-friendly defaults
5) Crash-safe persistence

---

## 14) Acceptance criteria (definition of done)

### UI
- All screens implemented and navigable
- Fold overlays feel “paper fold” + prism edge
- Command ring works perfectly

### Logic
- Enter/Exit is stable (no flicker)
- Overlap resolution consistent
- Events recorded
- Restores baseline correctly

### Permissions
- Foreground permission requested and handled
- Background permission flow explained and handled

### MVP Promise
- SYPAU alarms behave gently inside folds and restore outside.

---

## 15) Debug tools (must include)
- Developer toggle in Settings: “Show GPS debug”
- On map: show current lat/lng + accuracy radius
- Button: “Simulate location” (optional dev only)
- Log export

---

## 16) Future upgrades (post-MVP)
- Native DND/ringer control via config plugins + Notification Policy access
- True geofencing via Google geofencing API
- Widgets / quick toggles
- Wear OS companion (optional)

---

## 17) Implementation notes (avoid common failures)
- Cache folds in memory; don’t hit DB on every location tick.
- Keep background interval conservative:
  - balanced: 15–30s and/or 50–100m distance
- Always guard against null permission states.
- Always write ENGINE_ERROR events if a task throws.

---

## 18) Deliverables checklist
- [ ] Working Expo app with all screens
- [ ] Create/Edit/Delete folds
- [ ] Profiles + assign to fold
- [ ] Engine: enter/exit + overlap + drift holding
- [ ] Timeline log
- [ ] Settings + permissions helper
- [ ] Alarms MVP (SYPAU-owned gentle alarms)