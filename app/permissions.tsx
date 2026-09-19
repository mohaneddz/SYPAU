import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { RedButton } from '@/components/sypau/controls';
import { SypauPermissionRow } from '@/components/sypau/feedback';
import { HandUnderline } from '@/components/sypau/header';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { Display, SectionTitle, SypauText } from '@/components/sypau/text';
import { openSettings } from '@/core/nativeBridge';
import { SypauColor, SypauSpace } from '@/constants/sypau';
import { useEngineStore } from '@/state/useEngineStore';

type PermissionsRouteProps = {
  /** Embedded under Settings, where the "continue" CTA doesn't belong. */
  embedded?: boolean;
};

/**
 * Each requirement gets its own row: what it is, why SYPAU wants it, where it
 * currently stands, and one action. Nothing is requested in a batch, and the
 * app stays usable when the optional ones are declined.
 */
export function PermissionsScreen({ embedded = false }: PermissionsRouteProps) {
  const permissions = useEngineStore((s) => s.permissions);
  const capabilities = useEngineStore((s) => s.capabilities);
  const refresh = useEngineStore((s) => s.refreshNativeState);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestForegroundLocation = useCallback(async () => {
    setRequesting(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } finally {
      setRequesting(false);
      refresh();
    }
  }, [refresh]);

  const requestBackgroundLocation = useCallback(async () => {
    setRequesting(true);
    try {
      // Android only grants this after foreground is held, and from 11 it can
      // only be granted from Settings — so fall through to the app page.
      const foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status !== 'granted') {
        await Location.requestForegroundPermissionsAsync();
      }

      if (permissions.locationBackground.canRequestInApp) {
        await Location.requestBackgroundPermissionsAsync();
      } else {
        openSettings('app');
      }
    } finally {
      setRequesting(false);
      refresh();
    }
  }, [permissions.locationBackground.canRequestInApp, refresh]);

  const requestNotifications = useCallback(async () => {
    setRequesting(true);
    try {
      await Notifications.requestPermissionsAsync();
    } finally {
      setRequesting(false);
      refresh();
    }
  }, [refresh]);

  const locationReady = permissions.locationForeground.granted;
  const canContinue = locationReady;

  return (
    <SypauScaffold
      title={embedded ? 'Permissions' : undefined}
      wordmark={!embedded}
      showBack={embedded}
      showNav={embedded}>
      {!embedded ? (
        <View style={{ gap: SypauSpace.xs }}>
          <Display>Set up access</Display>
          <HandUnderline width={180} />
          <SypauText variant="body" color={SypauColor.boneMuted}>
            SYPAU only asks for what it needs to notice a boundary and act on it.
          </SypauText>
        </View>
      ) : null}

      <SectionTitle>Location</SectionTitle>

      <SypauPermissionRow
        icon="pin"
        title="Precise location"
        description="Works out which of your zones you're standing in."
        granted={permissions.locationForeground.granted}
        actionLabel={requesting ? 'Asking…' : 'Allow'}
        onAction={requestForegroundLocation}
      />

      <SypauPermissionRow
        icon="layers"
        title="Background location"
        description="Lets SYPAU notice a crossing while the app is closed. Without it, zones only work while you're looking at the app."
        granted={permissions.locationBackground.granted}
        actionLabel={permissions.locationBackground.canRequestInApp ? 'Allow' : 'Open settings'}
        onAction={requestBackgroundLocation}
      />

      <SypauPermissionRow
        icon="target"
        title="Location services"
        description="Your device's location switch has to be on."
        granted={permissions.locationServicesEnabled.granted}
        actionLabel="Open settings"
        onAction={() => openSettings('location')}
      />

      <SectionTitle>System control</SectionTitle>

      <SypauPermissionRow
        icon="dnd"
        title="Do Not Disturb access"
        description="Needed to silence the ringer and switch Do Not Disturb on your behalf."
        granted={permissions.dndAccess.granted}
        actionLabel="Open settings"
        onAction={() => openSettings('dnd')}
      />

      <SypauPermissionRow
        icon="sun"
        title="Modify system settings"
        description="Only needed if a profile changes brightness, screen timeout or ring vibration."
        granted={permissions.writeSystemSettings.granted}
        actionLabel="Open settings"
        onAction={() => openSettings('writeSettings')}
      />

      <SectionTitle>Reliability</SectionTitle>

      <SypauPermissionRow
        icon="bell"
        title="Notifications"
        description="Tells you when a profile activates or something needs your attention."
        granted={permissions.notifications.granted}
        actionLabel="Allow"
        onAction={requestNotifications}
      />

      <SypauPermissionRow
        icon="battery"
        title="Battery optimisation"
        description="Android may stop SYPAU in the background. Excluding it keeps zone monitoring alive."
        granted={permissions.batteryOptimizationExempt.granted}
        actionLabel="Open settings"
        onAction={() => openSettings('batteryOptimization')}
      />

      {capabilities.dnd.status === 'unsupported' ? (
        <SypauText variant="bodySm" color={SypauColor.amber}>
          System control isn&rsquo;t available in this build. Zones and profiles still work, but
          SYPAU can&rsquo;t change your device until you run a development build.
        </SypauText>
      ) : null}

      {!embedded ? (
        <RedButton
          label={canContinue ? 'Start using SYPAU' : 'Continue anyway'}
          sublabel={canContinue ? undefined : 'Zones need location to work'}
          onPress={() => router.replace('/home')}
        />
      ) : null}
    </SypauScaffold>
  );
}

export default function PermissionsRoute() {
  return <PermissionsScreen />;
}
