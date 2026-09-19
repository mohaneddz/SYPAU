import { useLocalSearchParams } from 'expo-router';

import { ProfileForm } from '@/components/sypau/profileForm';
import { useProfileStore } from '@/state/useProfileStore';

export default function EditProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfileStore((s) => s.byId(id));

  return <ProfileForm existing={profile} />;
}
