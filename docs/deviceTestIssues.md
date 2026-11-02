# Device test issues

First pass on a physical phone: Realme RMX3921, ColorOS, Android 16 (API 36), 1080×2412.
Dev client build, 2026-11-02. Checked boxes are fixed.

## Layout and text

- [ ] **Home status strip crops the last item.** "NOTIFICATION" runs off the right edge of the torn-paper strip (Alarms · Calls · Notification). The three columns don't fit at this width; the label needs to shrink or the strip needs to reflow.
- [ ] **Boundary type labels break mid-word.** On Create zone, "POLYGON" renders as "POLYGO / N" and "FREEHAND" as "FREEHA / ND". The three segments are too narrow for the label at that size.
- [ ] **Zone name breaks mid-word on Zone detail.** "TESTZONE" renders as "TESTZON / E". The display title needs to shrink to fit (or wrap only at word boundaries) — any single-word name longer than ~7 characters breaks.
- [ ] **Confirm dialog button wraps.** "OPEN SETTINGS" wraps onto two lines inside its button; the two-button row leaves the primary button too narrow for its label.
- [ ] **Mute behaviour cards and the icon row clip at the sheet padding**, not the screen edge, on Create zone. Reads as cropped rather than as a horizontal scroller.
- [ ] **"Not active" on Home's Silence time card wraps to two lines** in a column that has room for one.

## Wrong or misleading information

- [ ] **"Watching" doesn't mean monitoring is running.** Home's chip reads `automationEnabled`, not whether geofences are actually registered. On first launch registration failed (no background location) and Home still said "Watching".
- [ ] **A stale error outlives its cause.** "Couldn't watch your zones — Background location permission is needed" stays in the activity log and on Home's activity card, and keeps the bell's red dot lit, after the permission was granted and a fence registered successfully. Nothing logs that monitoring recovered.
- [ ] **Polygon zones show a "Radius".** The Zones list shows "Radius 266 m" for a triangle. A polygon has no radius; the value is presumably its bounding circle. Zone detail shows the same number unlabelled ("~266M · 0.08 KM²").
- [ ] **Debug screen says LIVE on a stale fix.** The GPS debug card shows the LIVE badge while "Last update" is 7 minutes old.
- [ ] **"P10" on Zone detail is unexplained.** The categories card shows "P10" with no hint that it means priority 10.
- [ ] **Same screen, two titles.** The bell opens "ACTIVITY"; the Activity tab and Home's "View all" open "ACTIVITY LOG".

## Navigation

- [ ] **Tab screens show a back arrow and stack on each other.** Every tab root (Zones, Activity, Profile) has a back arrow, and switching tabs pushes onto history — back from Profile returned to a Zone detail opened two tabs earlier.
- [ ] **"Profile" tab opens "Profiles".** The tab is labelled Profile with a person icon (reads as an account screen), but it's the list of alarm profiles. Settings → "Alarm profiles" leads to the same list.

## Loading and feedback

- [ ] **The map is blank for several seconds.** Create zone shows a flat black map area for ~5 s before tiles appear, with no loading state.

## Platform (ColorOS)

- [x] **Battery step never completes.** ColorOS's "Allow background usage" switch doesn't add the app to Android's Doze whitelist, which is what the check reads. Fixed in `SettingsLauncher.kt` by sending the direct `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` prompt first — **needs a native rebuild to verify.**
- [ ] **ColorOS freezes the app in the background.** `dumpsys location` logs `Freeze: true, Reason: FreezeControl` for SYPAU each time it's backgrounded. Geofence wake-ups may not arrive while frozen; untested until a real zone crossing.
- [ ] **Stale v2 database crashes startup.** A database stamped `user_version = 2` from an earlier build had no `isDefault` column; `migrate()` skips it and every profile query fails ("SYPAU couldn't start"). Worked around on this phone by deleting the database; the migration itself is unchanged.

## Fixed this session

- [x] **Confirm dialogs bounced on open** — spring removed from the entrance (`feedback.tsx`).

## Not tested yet

- Entering or leaving a zone for real (profile applying, ringer/DND changes, exit restore).
- Alarms firing inside a zone.
- Radius and freehand zone drawing, editing geometry, pause/delete, profile editing.
