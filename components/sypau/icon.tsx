import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { SypauColor } from '@/constants/sypau';
import type { ProfileIcon } from '@/types/profile';
import type { ZoneIcon } from '@/types/zone';

/**
 * One icon vocabulary for the whole app, so a zone and the profile it points
 * at can share a name without each screen picking its own icon set.
 */
export type SypauIconName =
  | ProfileIcon
  | ZoneIcon
  | 'pin'
  | 'polygon'
  | 'radius'
  | 'freehand'
  | 'target'
  | 'plus'
  | 'minus'
  | 'locate'
  | 'back'
  | 'chevron'
  | 'edit'
  | 'trash'
  | 'pause'
  | 'copy'
  | 'search'
  | 'filter'
  | 'export'
  | 'import'
  | 'volume'
  | 'volumeOff'
  | 'vibrate'
  | 'dnd'
  | 'wifi'
  | 'bluetooth'
  | 'signal'
  | 'airplane'
  | 'sun'
  | 'clock'
  | 'battery'
  | 'phone'
  | 'phoneOff'
  | 'message'
  | 'alert'
  | 'check'
  | 'close'
  | 'info'
  | 'activity'
  | 'settings'
  | 'user'
  | 'bug'
  | 'map'
  | 'layers'
  | 'zap'
  | 'refresh'
  | 'undo'
  | 'lock';

export type Glyph = { set: 'feather' | 'material'; name: string };

/** Exported so the suite can check every name against the real font. */
export const GLYPHS: Record<SypauIconName, Glyph> = {
  home: { set: 'feather', name: 'home' },
  school: { set: 'material', name: 'school-outline' },
  book: { set: 'feather', name: 'book-open' },
  moon: { set: 'feather', name: 'moon' },
  briefcase: { set: 'feather', name: 'briefcase' },
  dumbbell: { set: 'material', name: 'dumbbell' },
  coffee: { set: 'feather', name: 'coffee' },
  heart: { set: 'feather', name: 'heart' },
  shield: { set: 'feather', name: 'shield' },
  bell: { set: 'feather', name: 'bell' },

  pin: { set: 'feather', name: 'map-pin' },
  polygon: { set: 'material', name: 'vector-polygon' },
  radius: { set: 'material', name: 'circle-outline' },
  freehand: { set: 'material', name: 'draw' },
  target: { set: 'material', name: 'target' },

  plus: { set: 'feather', name: 'plus' },
  minus: { set: 'feather', name: 'minus' },
  locate: { set: 'feather', name: 'crosshair' },
  back: { set: 'feather', name: 'arrow-left' },
  chevron: { set: 'feather', name: 'chevron-right' },
  edit: { set: 'feather', name: 'edit-2' },
  trash: { set: 'feather', name: 'trash-2' },
  pause: { set: 'feather', name: 'pause' },
  copy: { set: 'feather', name: 'copy' },
  search: { set: 'feather', name: 'search' },
  filter: { set: 'feather', name: 'filter' },
  export: { set: 'feather', name: 'upload' },
  import: { set: 'feather', name: 'download' },

  volume: { set: 'feather', name: 'volume-2' },
  volumeOff: { set: 'feather', name: 'volume-x' },
  vibrate: { set: 'material', name: 'vibrate' },
  dnd: { set: 'material', name: 'bell-cancel-outline' },
  wifi: { set: 'feather', name: 'wifi' },
  bluetooth: { set: 'feather', name: 'bluetooth' },
  signal: { set: 'material', name: 'signal' },
  airplane: { set: 'material', name: 'airplane' },
  sun: { set: 'feather', name: 'sun' },
  clock: { set: 'feather', name: 'clock' },
  battery: { set: 'feather', name: 'battery-charging' },

  phone: { set: 'feather', name: 'phone' },
  phoneOff: { set: 'feather', name: 'phone-off' },
  message: { set: 'feather', name: 'message-circle' },
  alert: { set: 'feather', name: 'alert-triangle' },
  check: { set: 'feather', name: 'check' },
  close: { set: 'feather', name: 'x' },
  info: { set: 'feather', name: 'info' },

  activity: { set: 'feather', name: 'activity' },
  settings: { set: 'feather', name: 'settings' },
  user: { set: 'feather', name: 'user' },
  bug: { set: 'material', name: 'bug-outline' },
  map: { set: 'feather', name: 'map' },
  layers: { set: 'feather', name: 'layers' },
  zap: { set: 'feather', name: 'zap' },
  refresh: { set: 'feather', name: 'refresh-cw' },
  undo: { set: 'feather', name: 'rotate-ccw' },
  lock: { set: 'feather', name: 'lock' },
};

type SypauIconProps = {
  name: SypauIconName;
  size?: number;
  color?: string;
};

export function SypauIcon({ name, size = 20, color = SypauColor.bone }: SypauIconProps) {
  const glyph = GLYPHS[name] ?? GLYPHS.pin;

  if (glyph.set === 'material') {
    return <MaterialCommunityIcons name={glyph.name as never} size={size} color={color} />;
  }
  return <Feather name={glyph.name as never} size={size} color={color} />;
}
