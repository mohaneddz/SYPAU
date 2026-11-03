# One-time adb setup for SYPAU's system-level access, and checks on what it buys.
#
#   .\scripts\systemAccess.ps1 status     what's granted now, and the radios' real state
#   .\scripts\systemAccess.ps1 grant      WRITE_SECURE_SETTINGS + BLUETOOTH_CONNECT (survive reboots)
#   .\scripts\systemAccess.ps1 revoke     undo `grant`
#   .\scripts\systemAccess.ps1 watch      print the radios' real state every second (run during the probe)
#   .\scripts\systemAccess.ps1 owner      check whether device ownership can be set; prints the command
#
# Grants made with `pm grant` persist across reboots and app updates, and are
# dropped only on uninstall or `revoke`. Device ownership also persists, but
# Android refuses to assign it while any account is signed in on the phone.

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('status', 'grant', 'revoke', 'watch', 'owner')]
  [string]$Action,
  [string]$Serial
)

$package = 'com.mohaned.sypau'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$target = if ($Serial) { @('-s', $Serial) } else { @() }
$grantable = @('android.permission.WRITE_SECURE_SETTINGS', 'android.permission.BLUETOOTH_CONNECT')

function Shell([string]$command) {
  (& $adb @target shell $command) -join "`n"
}

function RadioState {
  $wifi = if ((Shell 'dumpsys wifi') -match 'Wi-Fi is enabled') { 'on' } else { 'off' }
  $bluetooth = if ((Shell 'dumpsys bluetooth_manager') -match 'state:\s*ON') { 'on' } else { 'off' }
  $airplane = Shell 'settings get global airplane_mode_on'
  $data = Shell 'settings get global mobile_data'
  $registry = Shell 'dumpsys telephony.registry'
  $radio = if ($registry -match 'mServiceState=\{mVoiceRegState=(\d)') { @('in service', 'out of service', 'emergency only', 'radio off')[[int]$Matches[1]] } else { 'unknown' }
  "wifi=$wifi bluetooth=$bluetooth cellular=$radio mobile_data(setting)=$data airplane(setting)=$airplane"
}

switch ($Action) {
  'status' {
    $dump = Shell "dumpsys package $package"
    foreach ($permission in $grantable) {
      $granted = $dump -match [regex]::Escape($permission) + ': granted=true'
      "{0,-45} {1}" -f $permission, ($(if ($granted) { 'granted' } else { 'not granted' }))
    }
    $owner = Shell 'dpm list-owners'
    "device owner: $(if ($owner -match $package) { 'SYPAU' } else { 'none' })"
    RadioState
  }
  'grant' {
    foreach ($permission in $grantable) { & $adb @target shell pm grant $package $permission }
    & $PSCommandPath status -Serial $Serial
  }
  'revoke' {
    foreach ($permission in $grantable) { & $adb @target shell pm revoke $package $permission }
    & $PSCommandPath status -Serial $Serial
  }
  'watch' {
    while ($true) { "$(Get-Date -Format HH:mm:ss) $(RadioState)"; Start-Sleep -Seconds 1 }
  }
  'owner' {
    $accounts = ([regex]::Matches((Shell 'dumpsys account'), 'Account \{name=')).Count
    $users = ([regex]::Matches((Shell 'pm list users'), 'UserInfo\{')).Count
    "signed-in accounts: $accounts    users: $users"
    if ($accounts -gt 0 -or $users -gt 1) {
      'Android will refuse: device ownership can only be set with no accounts and a single user.'
      'Removing every account (and re-adding them afterwards) is the only way without a factory reset.'
    } else {
      "Ready. Run:  adb shell dpm set-device-owner $package/expo.modules.sypausystem.SypauDeviceAdmin"
    }
  }
}
