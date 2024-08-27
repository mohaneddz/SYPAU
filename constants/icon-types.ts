import type { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type { IconType } from '@/types/fold';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

export const ICON_TYPE_META: Record<IconType, { label: string; icon: MaterialIconName }> = {
  school: { label: 'School', icon: 'school' },
  studying: { label: 'Studying', icon: 'menu-book' },
  sleeping: { label: 'Sleeping', icon: 'bedtime' },
  awake: { label: 'Awake', icon: 'wb-sunny' },
  tired: { label: 'Tired', icon: 'nights-stay' },
  praying: { label: 'Praying', icon: 'self-improvement' },
  custom: { label: 'Custom', icon: 'auto-awesome' },
};

export const ICON_TYPE_ORDER: IconType[] = [
  'school',
  'sleeping',
  'studying',
  'awake',
  'tired',
  'praying',
  'custom',
];
