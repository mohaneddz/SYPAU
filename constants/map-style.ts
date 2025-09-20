import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

import rawStyle from './map-style.json';

/**
 * OpenFreeMap's free "dark" vector style (https://tiles.openfreemap.org/styles/dark),
 * recolored to the app's "Silence Origami" Prism palette — see .idea/plan.md §9.
 * Requires no API key. Regenerate via the same source + palette if OpenFreeMap's
 * base layer schema changes (layer ids are matched by name at customization time,
 * not at runtime, so a schema change would just leave those layers un-recolored
 * rather than breaking the map).
 */
export const BLUEPRINT_MAP_STYLE = rawStyle as unknown as StyleSpecification;
