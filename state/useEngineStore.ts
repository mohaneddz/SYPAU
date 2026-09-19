import { create } from 'zustand';

import { getCapabilities, getMonitoringStatus, getPermissions } from '@/core/nativeBridge';
import { INITIAL_ENGINE_STATE, type EngineState } from '@/core/zoneEngine';
import type { LatLng } from '@/engine/geo';
import type {
  CapabilityMap,
  MonitoringStatus,
  PermissionKey,
  PermissionState,
} from '@/types/capability';

export type LocationFix = {
  point: LatLng;
  accuracyMeters: number | null;
  speedMetersPerSecond: number | null;
  headingDegrees: number | null;
  timestamp: number;
  provider: string;
};

export type DiagnosticLine = {
  id: string;
  timestamp: number;
  message: string;
  detail: string | null;
  severity: 'info' | 'warning' | 'error';
};

type EngineStore = {
  engine: EngineState;
  fix: LocationFix | null;
  capabilities: CapabilityMap;
  permissions: Record<PermissionKey, PermissionState>;
  monitoring: MonitoringStatus;
  diagnostics: DiagnosticLine[];

  setEngine: (engine: EngineState) => void;
  setFix: (fix: LocationFix) => void;
  refreshNativeState: () => void;
  pushDiagnostic: (line: Omit<DiagnosticLine, 'id' | 'timestamp'>) => void;
};

/** Diagnostics are a live tail for the debug screen, not a persisted log. */
const MAX_DIAGNOSTICS = 60;

export const useEngineStore = create<EngineStore>((set, get) => ({
  engine: INITIAL_ENGINE_STATE,
  fix: null,
  capabilities: getCapabilities(),
  permissions: getPermissions(),
  monitoring: getMonitoringStatus(),
  diagnostics: [],

  setEngine: (engine) => set({ engine }),

  setFix: (fix) => set({ fix }),

  refreshNativeState: () =>
    set({
      capabilities: getCapabilities(),
      permissions: getPermissions(),
      monitoring: getMonitoringStatus(),
    }),

  pushDiagnostic: (line) => {
    const entry: DiagnosticLine = {
      ...line,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    set({ diagnostics: [entry, ...get().diagnostics].slice(0, MAX_DIAGNOSTICS) });
  },
}));
