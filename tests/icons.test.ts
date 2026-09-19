import featherGlyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json';
import materialGlyphs from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import { GLYPHS } from '@/components/sypau/icon';

/**
 * A misspelled glyph name doesn't fail to compile or throw — it renders a "?"
 * box on the device, which is only caught by looking at the right screen. This
 * catches it in the suite instead.
 */
describe('icon glyphs', () => {
  const entries = Object.entries(GLYPHS);

  it('maps every icon to a glyph that exists in its font', () => {
    const missing = entries.filter(([, glyph]) => {
      const font = glyph.set === 'material' ? materialGlyphs : featherGlyphs;
      return !(glyph.name in font);
    });

    expect(missing).toEqual([]);
  });

  it('covers the whole vocabulary', () => {
    expect(entries.length).toBeGreaterThan(40);
    for (const [, glyph] of entries) {
      expect(glyph.name).not.toBe('');
    }
  });
});
