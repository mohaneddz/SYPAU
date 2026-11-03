# Switching radios without root or Shizuku

Can SYPAU turn Wi-Fi, Bluetooth, mobile data and airplane mode on and off from a zone, given a one-time adb step and nothing that has to be redone after a reboot?

Test phone: Realme 13 Pro+ (RMX3921), ColorOS, Android 16. The "Verified" column is filled from the radio probe (GPS debug → **Probe radio control**) with the radios' real state watched over adb (`scripts/systemAccess.ps1 watch`). Until then, entries are marked *expected*.

## What a one-time adb step can give an app

| Grant | How | Survives reboot | What it actually unlocks |
|---|---|---|---|
| `WRITE_SECURE_SETTINGS` | `pm grant` (it carries the `development` flag) | Yes, until uninstall or `pm revoke` | Writing `Settings.Secure` / `Settings.Global` values |
| `BLUETOOTH_CONNECT` | `pm grant` (ordinary runtime permission) | Yes | Calling the Bluetooth APIs at all; not permission to switch the adapter |
| Device owner | `dpm set-device-owner` | Yes, until released | Exemption from the Android 10 Wi-Fi block (and, I believe, the Android 13 Bluetooth block — to verify) |
| `NETWORK_SETTINGS`, `NETWORK_AIRPLANE_MODE`, `BLUETOOTH_PRIVILEGED`, `MODIFY_PHONE_STATE` | — | — | Not grantable: signature/privileged only. These are what the radio switches actually check. |

Writing a setting is not the same as switching a radio. The Wi-Fi, Bluetooth and telephony services keep their own state and don't watch `wifi_on`, `bluetooth_on` or `mobile_data` for changes, and airplane mode only takes effect with a broadcast only the system may send. So `WRITE_SECURE_SETTINGS` is expected to change the stored value and nothing else — which is exactly why the probe reads the radio back instead of the setting.

## Per radio

| Radio | Route | Expected | Verified |
|---|---|---|---|
| Wi-Fi | `WifiManager.setWifiEnabled` | Refused (returns false) for apps targeting Android 10+ | — |
| Wi-Fi | `Settings.Global wifi_on` | Setting written, radio unchanged | — |
| Wi-Fi | `setWifiEnabled` as device owner | Works | — |
| Bluetooth | `BluetoothAdapter.enable/disable` | Refused for apps targeting Android 13+ | — |
| Bluetooth | `Settings.Global bluetooth_on` | Setting written, radio unchanged | — |
| Bluetooth | `enable/disable` as device owner | Possibly works — unconfirmed | — |
| Mobile data | `Settings.Global mobile_data` | Setting written, data unchanged | — |
| Mobile data | any app API | `TelephonyManager.setDataEnabled` needs `MODIFY_PHONE_STATE`; not grantable, and device owner doesn't help | — |
| Airplane mode | `Settings.Global airplane_mode_on` | Setting written, radios unchanged (no broadcast) | — |

## Why adb itself can do what the app can't

`adb shell svc wifi disable`, `svc bluetooth disable`, `svc data disable` and `cmd connectivity airplane-mode enable` all work — because they run as adb's shell user, which holds the privileged permissions above. A grant can't hand those to an app. Running commands *as* that shell user from inside an app is precisely what Shizuku does, and its non-root mode has to be restarted after every reboot. That's the trade-off the next step would be weighing.

## Device ownership, in practice

- Android only accepts `dpm set-device-owner` when **no accounts are signed in** and there's a single user. On a phone in daily use that means removing every account (Google, Realme/HeyTap, …), running the command, then signing back in.
- While SYPAU is device owner it can't be uninstalled until ownership is released (GPS debug → **Release device owner**).
- The admin component holds **no policies**: it can't lock, wipe or restrict the phone. Ownership is used only for the Wi-Fi (and possibly Bluetooth) exemption.
- `scripts/systemAccess.ps1 owner` checks whether the phone is currently eligible and prints the exact command.

## Commands

```powershell
.\scripts\systemAccess.ps1 grant    # WRITE_SECURE_SETTINGS + BLUETOOTH_CONNECT
.\scripts\systemAccess.ps1 watch    # leave running while the probe flips each radio
.\scripts\systemAccess.ps1 status
.\scripts\systemAccess.ps1 revoke
.\scripts\systemAccess.ps1 owner
```
