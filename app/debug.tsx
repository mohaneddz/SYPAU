import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DarkCard } from '@/components/sypau/cards';
import { RedButton, StatusChip } from '@/components/sypau/controls';
import { SypauConfirmDialog } from '@/components/sypau/feedback';
import { SypauIcon } from '@/components/sypau/icon';
import { SypauScaffold } from '@/components/sypau/scaffold';
import { Display, SectionTitle, SypauText } from '@/components/sypau/text';
import { ZoneMap } from '@/components/sypau/zoneMap';
import { isNativeAvailable } from '@/core/nativeBridge';
import { isLocationUpdatesRunning } from '@/core/monitoring';
import { SypauAsset, SypauColor, SypauRadius, SypauSpace } from '@/constants/sypau';
import { listEvents } from '@/db/events';
import { distanceToGeometry } from '@/engine/geo';
import { useSypauEngine } from '@/hooks/useSypauEngine';
import { useEngineStore } from '@/state/useEngineStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useZoneStore } from '@/state/useZoneStore';
import { formatDistance } from '@/utils/geometry';

type SelfTestResult = { label: string; passed: boolean; detail: string };

export default function DebugRoute() {
  const { refreshLocation } = useSypauEngine();

  const fix = useEngineStore((s) => s.fix);
  const engine = useEngineStore((s) => s.engine);
  const monitoring = useEngineStore((s) => s.monitoring);
  const permissions = useEngineStore((s) => s.permissions);
  const capabilities = useEngineStore((s) => s.capabilities);
  const diagnostics = useEngineStore((s) => s.diagnostics);
  const refreshNativeState = useEngineStore((s) => s.refreshNativeState);

  const zones = useZoneStore((s) => s.zones);
  const settings = useSettingsStore((s) => s.settings);

  const [selfTest, setSelfTest] = useState<SelfTestResult[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    refreshNativeState();
  }, [refreshNativeState]);

  const activeZone = zones.find((zone) => zone.id === engine.activeZoneId) ?? null;
  const distanceToBoundary =
    fix && activeZone ? distanceToGeometry(fix.point, activeZone.geometry) : null;

  const runSelfTest = useCallback(async () => {
    const locationUpdatesRunning = await isLocationUpdatesRunning();

    setSelfTest([
      check('Location permission', permissions.locationForeground.granted, 'Precise location'),
      check('Background permission', permissions.locationBackground.granted, 'Background location'),
      check('Location services', permissions.locationServicesEnabled.granted, 'Device location switch'),
      check('Notification permission', permissions.notifications.granted, 'Post notifications'),
      check('Do Not Disturb access', permissions.dndAccess.granted, 'Notification policy'),
      check(
        'Battery optimisation',
        permissions.batteryOptimizationExempt.granted,
        'Exempt from Doze'
      ),
      check('Native bridge', isNativeAvailable(), 'Kotlin module attached'),
      check('Geofencing API', monitoring.registeredGeofences > 0, `${monitoring.registeredGeofences} registered`),
      check(
        'Location service',
        settings.trackingMode !== 'highAccuracy' || locationUpdatesRunning,
        settings.trackingMode === 'highAccuracy'
          ? 'Foreground service running'
          : 'Not needed in this mode'
      ),
      check('Database', zones.length >= 0, 'Readable'),
      check(
        'System control',
        capabilities.dnd.status === 'availableDirectly',
        capabilities.dnd.detail
      ),
    ]);
  }, [permissions, monitoring, settings.trackingMode, zones.length, capabilities.dnd]);

  const exportLogs = async () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        fix,
        engine: {
          activeZoneId: engine.activeZoneId,
          matchedZoneIds: engine.matchedZoneIds,
          ownedKeys: engine.ownedKeys,
        },
        monitoring,
        permissions,
        capabilities,
        diagnostics,
        recentEvents: listEvents({ limit: 200 }),
      };

      const file = new FileSystem.File(FileSystem.Paths.cache.uri, 'sypauDiagnostics.json');
      file.write(JSON.stringify(payload, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
        return;
      }
      setNotice(`Saved to ${file.uri}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Couldn’t write the diagnostics file.');
    }
  };

  return (
    <SypauScaffold
      wordmark
      showBack
      headerRight={<StatusChip label="Debug" tone="red" />}>
      <View style={styles.hero}>
        <View style={styles.flex}>
          <Display>GPS Debug</Display>
          <SypauText variant="body" color={SypauColor.cyan}>
            Location tracking diagnostic
          </SypauText>
        </View>
        <Image source={SypauAsset.foldedMap} style={styles.heroArt} contentFit="contain" />
      </View>

      <SectionTitle>Current location</SectionTitle>
      <DarkCard>
        <View style={styles.cardHeader}>
          <SypauIcon name="target" size={16} color={SypauColor.cyan} />
          <SypauText variant="label" caps style={styles.flex}>
            Fix
          </SypauText>
          <StatusChip label={fix ? 'Live' : 'Waiting'} tone={fix ? 'cyan' : 'neutral'} />
        </View>

        <View style={styles.split}>
          <View style={styles.flex}>
            <Metric label="Latitude" value={fix ? fix.point.latitude.toFixed(5) : '—'} />
            <Metric label="Longitude" value={fix ? fix.point.longitude.toFixed(5) : '—'} />
            <Metric
              label="Accuracy"
              value={fix?.accuracyMeters != null ? `${fix.accuracyMeters.toFixed(1)} m` : '—'}
              highlight
            />
            <Metric
              label="Speed"
              value={
                fix?.speedMetersPerSecond != null
                  ? `${fix.speedMetersPerSecond.toFixed(1)} m/s`
                  : '—'
              }
            />
            <Metric
              label="Bearing"
              value={fix?.headingDegrees != null ? `${Math.round(fix.headingDegrees)}°` : '—'}
            />
            <Metric label="Provider" value={fix?.provider ?? '—'} />
            <Metric
              label="Last update"
              value={fix ? new Date(fix.timestamp).toLocaleTimeString() : '—'}
            />
          </View>

          {fix ? (
            <ZoneMap
              geometries={activeZone ? [{ id: activeZone.id, geometry: activeZone.geometry }] : []}
              userLocation={fix.point}
              interactive={false}
              zoom={15}
              style={styles.miniMap}
            />
          ) : null}
        </View>
      </DarkCard>

      <SectionTitle>Geofence status</SectionTitle>
      <DarkCard>
        <View style={styles.cardHeader}>
          <SypauIcon name="pin" size={16} color={SypauColor.cyan} />
          <SypauText variant="label" caps style={styles.flex}>
            Zones
          </SypauText>
          <StatusChip
            label={activeZone ? `Inside ${activeZone.name}` : 'Outside'}
            tone={activeZone ? 'cyan' : 'neutral'}
          />
        </View>

        <Metric label="Active zone" value={activeZone?.name ?? 'None'} />
        <Metric label="Status" value={activeZone ? 'Inside' : 'Outside'} highlight />
        <Metric
          label="Distance to boundary"
          value={distanceToBoundary !== null ? formatDistance(distanceToBoundary) : '—'}
        />
        <Metric label="Matching zones" value={String(engine.matchedZoneIds.length)} />
        <Metric label="Registered fences" value={String(monitoring.registeredGeofences)} />
        <Metric
          label="Controls held"
          value={engine.ownedKeys.length > 0 ? engine.ownedKeys.join(', ') : 'None'}
        />
      </DarkCard>

      <View style={styles.split}>
        <DarkCard style={styles.flex}>
          <View style={styles.cardHeader}>
            <SypauIcon name="zap" size={16} color={SypauColor.cyan} />
            <SypauText variant="label" caps>
              Background
            </SypauText>
          </View>
          <Metric label="State" value={monitoring.running ? 'Active' : 'Stopped'} highlight />
          <Metric label="Mode" value={settings.trackingMode} />
          <Metric label="Since" value={formatDuration(monitoring.startedAt)} />
          <Metric label="Updates" value={String(monitoring.updateCount)} />
        </DarkCard>

        <DarkCard style={styles.flex}>
          <View style={styles.cardHeader}>
            <SypauIcon name="activity" size={16} color={SypauColor.cyan} />
            <SypauText variant="label" caps>
              Task health
            </SypauText>
          </View>
          <Metric label="Native bridge" value={isNativeAvailable() ? 'Running' : 'Absent'} highlight />
          <Metric label="Geofence monitor" value={monitoring.running ? 'Running' : 'Idle'} />
          <Metric label="Database" value="Running" />
          <Metric label="Last heartbeat" value={formatAgo(monitoring.lastHeartbeatAt)} />
        </DarkCard>
      </View>

      <SectionTitle>Recent logs</SectionTitle>
      <DarkCard>
        {diagnostics.length === 0 ? (
          <SypauText variant="bodySm" color={SypauColor.boneFaint}>
            Nothing logged this session.
          </SypauText>
        ) : (
          diagnostics.slice(0, 12).map((line) => (
            <View key={line.id} style={styles.logRow}>
              <SypauText variant="bodySm" color={SypauColor.boneFaint}>
                {new Date(line.timestamp).toLocaleTimeString()}
              </SypauText>
              <View
                style={[
                  styles.logDot,
                  {
                    backgroundColor:
                      line.severity === 'error'
                        ? SypauColor.red
                        : line.severity === 'warning'
                          ? SypauColor.amber
                          : SypauColor.cyan,
                  },
                ]}
              />
              <SypauText
                variant="bodySm"
                style={styles.flex}
                color={line.severity === 'error' ? SypauColor.red : SypauColor.bone}>
                {line.message}
              </SypauText>
              {line.detail ? (
                <SypauText variant="bodySm" color={SypauColor.boneFaint}>
                  {line.detail}
                </SypauText>
              ) : null}
            </View>
          ))
        )}
      </DarkCard>

      {selfTest ? (
        <>
          <SectionTitle>Self test</SectionTitle>
          <DarkCard>
            {selfTest.map((result) => (
              <View key={result.label} style={styles.logRow}>
                <SypauIcon
                  name={result.passed ? 'check' : 'close'}
                  size={14}
                  color={result.passed ? SypauColor.green : SypauColor.amber}
                />
                <SypauText variant="bodySm" style={styles.flex}>
                  {result.label}
                </SypauText>
                <SypauText
                  variant="bodySm"
                  color={result.passed ? SypauColor.green : SypauColor.amber}>
                  {result.detail}
                </SypauText>
              </View>
            ))}
          </DarkCard>
        </>
      ) : null}

      <RedButton label="Force location update" onPress={() => void refreshLocation()} />

      <View style={styles.actions}>
        <RedButton
          label="Run self test"
          variant="outline"
          onPress={() => void runSelfTest()}
          style={styles.flex}
        />
        <RedButton
          label="Export logs"
          variant="outline"
          onPress={() => void exportLogs()}
          style={styles.flex}
        />
      </View>

      <SypauConfirmDialog
        visible={notice !== null}
        title="Diagnostics"
        message={notice ?? ''}
        confirmLabel="Got it"
        cancelLabel="Close"
        onCancel={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
      />
    </SypauScaffold>
  );
}

function check(label: string, passed: boolean, detail: string): SelfTestResult {
  return { label, passed, detail };
}

function Metric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <SypauText variant="bodySm" color={SypauColor.boneMuted}>
        {label}
      </SypauText>
      <SypauText variant="bodySm" color={highlight ? SypauColor.cyan : SypauColor.bone}>
        {value}
      </SypauText>
    </View>
  );
}

function formatDuration(startedAt: number | null): string {
  if (!startedAt) return '—';

  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');

  return `${hours}:${minutes}:${remainder}`;
}

function formatAgo(timestamp: number | null): string {
  if (!timestamp) return '—';

  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: SypauSpace.md },
  heroArt: { width: 130, height: 90 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    marginBottom: SypauSpace.md,
  },

  split: { flexDirection: 'row', gap: SypauSpace.md },
  miniMap: { width: 130, height: 150, borderRadius: SypauRadius.chip },

  metric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    gap: SypauSpace.md,
  },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SypauSpace.sm,
    paddingVertical: SypauSpace.xs,
  },
  logDot: { width: 7, height: 7, borderRadius: 4 },

  actions: { flexDirection: 'row', gap: SypauSpace.md },
});
