# Device test issues

First pass on a physical phone: Realme RMX3921, ColorOS, Android 16 (API 36), 1080×2412.
Dev client build, 2026-11-02. Checked boxes are fixed; "verified" means seen on that phone after the fix.

## Layout and text

- [x] **Home status strip crops the last item.** "NOTIFICATIONS" ran off the right edge of the torn-paper strip. Labels now shrink to fit their column. Verified.
- [x] **Boundary type labels break mid-word.** "POLYGO / N", "FREEHA / ND" on Create zone. Segmented labels are single-line and shrink to fit. Verified.
- [x] **Zone name breaks mid-word on Zone detail.** "TESTZON / E". A single-word name now gets one line and shrinks; multi-word names may still use two. Verified.
- [x] **Confirm dialog button wraps.** "OPEN SETTINGS" took two lines. Red button labels are single-line, and the dialog gives the primary button more room. Verified.
- [x] **Create zone scrollers clip at the sheet padding.** The icon row and mute behaviour cards now run to the sheet's edge. Verified.
- [x] **"Not active" on Home's Silence time card wraps.** Now reads "Off" at full size.

## Wrong or misleading information

- [x] **"Watching" doesn't mean monitoring is running.** Home and the Zones list now read registered fences / the location service: "Watching" only when something is listening, "Not watching" (amber) when not, "No zones yet" with nothing to watch. Verified ("Watching" with 1 fence).
- [x] **A stale error outlives its cause.** A successful registration after a failure now logs "Watching your zones again", fences re-register when you come back from Settings, and the bell's dot only lights while the newest entry is an error or warning. Verified (recovery entry logged, dot cleared).
- [x] **Polygon zones show a "Radius".** The list now says "Across" with the shape's width; Zone detail says "532m wide · 0.08 km²". Verified.
- [x] **Debug screen says LIVE on a stale fix.** The badge turns amber "Stale · Nm ago" once the fix is over a minute old. Not seen on device.
- [x] **"P10" on Zone detail is unexplained.** Now "Priority 10". Verified.
- [x] **Same screen, two titles.** The header couldn't fit "Activity Log" and Android dropped "Log". The screen is now titled "Activity", matching its tab. Verified.

## Navigation

- [x] **Tab screens show a back arrow and stack on each other.** Tabs now reset to Home and push the one tab, so back from any tab returns to Home; tab screens no longer show a back arrow. Verified (back from Activity → Home).
- [x] **"Profile" tab opens "Profiles".** Renamed "Profiles" with the layers icon. The duplicate "Alarm profiles" row in Settings is gone. Verified.

## Loading and feedback

- [x] **The map is blank for several seconds.** Interactive maps show "Loading map" until the first full render (10 s fallback). Not seen on device — tiles were already cached on the re-test.

## Platform (ColorOS)

- [x] **Battery step never completes.** ColorOS's "Allow background usage" switch doesn't add the app to Android's Doze whitelist, which is what the check reads. The button now sends Android's direct "Let app always run in background?" prompt. Verified the prompt appears; granting it from that prompt not yet confirmed.
- [ ] **ColorOS freezes the app in the background.** `dumpsys location` logged `Freeze: true, Reason: FreezeControl` while SYPAU had no battery exemption. Expected to stop once the exemption above is granted; only a real zone crossing with the screen off will confirm it.
- [x] **Stale v2 database crashes startup.** Schema v3 adds `profiles.isDefault` in place when a v2 file lacks it, keeping existing zones and profiles. Not reproduced on device (the broken file was already deleted).

## Fixed earlier this session

- [x] **Confirm dialogs bounced on open** — spring removed from the entrance.

## Not tested yet

- Entering or leaving a zone for real (profile applying, ringer/DND changes, exit restore).
- Alarms firing inside a zone.
- Radius and freehand zone drawing, editing geometry, pause/delete, profile editing.
