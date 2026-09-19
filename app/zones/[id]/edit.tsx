import { useLocalSearchParams } from 'expo-router';

import { ZoneForm } from '@/components/sypau/zoneForm';
import { useZoneStore } from '@/state/useZoneStore';

export default function EditZoneRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const zone = useZoneStore((s) => s.byId(id));

  return <ZoneForm existing={zone} />;
}
