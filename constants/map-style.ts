import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

import rawStyle from './map-style.json';

/**
 * OpenFreeMap's free "dark" vector style (https://tiles.openfreemap.org/styles/dark),
 * recoloured to SYPAU's near-black greyscale so the cyan boundaries are the only
 * saturated thing on screen. Needs no API key.
 *
 * Layer ids are matched when the palette is regenerated, not at runtime, so a
 * schema change upstream leaves those layers their original colour rather than
 * breaking the map.
 */
export const SYPAU_MAP_STYLE = rawStyle as unknown as StyleSpecification;
